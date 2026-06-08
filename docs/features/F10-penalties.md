# F10 — Multas

**post-MVP · Depende de: F07 (ventas y pago) · Habilita: —.**

## Objetivo y valor
Implementar el mecanismo de **sanción económica** por impago de una compra ganada: multa del 10% del
valor ofertado, **bloqueo del cliente** hasta que la pague, y **desbloqueo automático** al pagarla (si
no quedan otras pendientes). Cierra el ciclo de responsabilidad del postor y desincentiva el abandono
de una puja ganadora.

## Alcance
**Incluye:** `POST /penalties` (SYSTEM, al detectar impago en F07), `GET /me/penalties` (cliente ve las
propias), `GET /clients/{id}/penalties` (admin), `POST /penalties/{id}/pay` (cliente paga y se desbloquea
si no quedan más pendientes). Toggle `Client.blocked`. Pantalla de multas + banner de cuenta bloqueada.
**No incluye:** el proceso judicial (fuera de alcance explícito del dominio), el plazo de 72 hs
automatizado (es solo informativo en el MVP), panel admin para gestionar multas, cancelación de multas
por la empresa.

## Modelo de datos
`Penalty`: `id`, `clientId`, `auctionId`, `itemId`, `amount` (10% del `SaleRecord.amount` al momento
del impago), `status` (PenaltyStatus: `pending` → `paid`), `createdAt`, `paidAt?`.

`Client.blocked` (bool): se setea `true` cuando se genera una multa. Se setea `false` cuando
`POST /penalties/{id}/pay` se ejecuta y **no quedan más multas `pending`** para ese cliente.

### Relación con F07
La multa se genera en `POST /sale-records/{id}/pay` cuando el backend devuelve `INSUFFICIENT_FUNDS` (422).
El service de F07 llama internamente a `POST /penalties` (servicio interno, no HTTP entre microservicios)
con `{ clientId, auctionId, itemId, amount: 0.10 * saleRecord.amount }`.

### Regla de bloqueo
- Generar multa → `Client.blocked = true`.
- `POST /penalties/{id}/pay` exitoso → verificar si `count(Penalty, clientId, status=pending) === 0`
  → si 0, `Client.blocked = false`.
- Un cliente bloqueado recibe **403 `CLIENT_BLOCKED`** al intentar conectarse a una subasta (F04) o pujar (F05).

## Backend — endpoints

### `POST /penalties` — JWT · rol SYSTEM
- Invocado internamente desde el service de F07 (no por el front directamente).
- **Body:** `PenaltyCreateRequest` (`clientId`, `auctionId`, `itemId`, `amount`).
- Crea `Penalty { status: 'pending' }` y setea `Client.blocked = true`.
- Emite `Notification { type: 'penalty' }` al cliente (F09).
- **201** → `Penalty`.

### `GET /me/penalties` — JWT · rol CLIENT
- `clientId` del token.
- **200** → array de `Penalty`, ordenadas por `createdAt` descendente.
- Incluye las `paid` también (historial completo).

### `GET /clients/{id}/penalties` — JWT · rol ADMIN
- Para cualquier cliente.
- Mismo response que el anterior.
- **404** `RESOURCE_NOT_FOUND` si el cliente no existe.

### `POST /penalties/{id}/pay` — JWT · rol CLIENT
- Solo puede pagar el propio cliente (`penalty.clientId === req.auth.sub`) o admin.
- Flujo:
  1. Validar que `penalty.status === 'pending'`.
  2. Marcar `status → paid`, `paidAt = now`.
  3. Contar `Penalty` pendientes del cliente: si `count === 0` → `Client.blocked = false`.
- **200** → `Penalty` con `status: paid` y, en el response, incluir `{ clientUnblocked: boolean }` para
  que el front pueda informar al usuario si su cuenta fue desbloqueada.
- **400** `VALIDATION_ERROR` si la multa ya está pagada.
- **403** si no es el propio cliente ni admin.
- **404** `RESOURCE_NOT_FOUND` si la multa no existe.

> **Dev / atajo:** en `NODE_ENV=development`, `POST /penalties/{id}/pay` no requiere un medio de pago
> real (acepta la acción sin parámetros adicionales). En producción debería validar un medio de pago,
> pero esto es post-MVP.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Banner de cuenta bloqueada
- Si `GET /auth/me` devuelve `blocked: true` → mostrar un **banner persistente** en la pantalla principal
  (o un modal bloqueante) con el mensaje "Tu cuenta está bloqueada por multas impagas" y un CTA "Ver multas".
- No ocultar el banner hasta que `blocked: false`.

### 2. Lista de multas
- Accesible desde el banner, desde el perfil o desde una notificación `penalty` (F09).
- Cada fila: ítem/subasta asociada, `amount` formateado, `status` (badge: Pendiente / Pagado), `createdAt`.
- Si `status === 'pending'` → botón "Pagar multa" en la fila o en el detalle.

### 3. Pagar multa
- Botón "Pagar multa" en la fila o en una pantalla de detalle.
- Confirmación via `Alert` "¿Confirmás el pago de la multa de $X?".
- Llama `POST /penalties/{id}/pay`.
- Si **200** y `clientUnblocked: true` → toast "Multa pagada. Tu cuenta fue desbloqueada." y banner desaparece.
- Si **200** y `clientUnblocked: false` → toast "Multa pagada. Tenés otras multas pendientes."
- Si **400** → "Esta multa ya estaba pagada."

**Estados de la lista:** loading / empty ("No tenés multas registradas") / error / success.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Multa ya pagada | POST /penalties/{id}/pay | `VALIDATION_ERROR` | 400 |
| Multa no encontrada | POST /penalties/{id}/pay | `RESOURCE_NOT_FOUND` | 404 |
| No es el propio cliente | POST /penalties/{id}/pay | 403 | 403 |
| Cliente bloqueado intenta conectarse a subasta | POST /connect (F04) | `CLIENT_BLOCKED` | 403 |
| Cliente bloqueado intenta pujar | POST /bids (F05) | `CLIENT_BLOCKED` | 403 |

## Criterios de aceptación
- **Dado** que el pago de una compra falla (`INSUFFICIENT_FUNDS`) **cuando** se procesa en F07 **entonces** se crea una `Penalty` con `amount = 10% del saleRecord.amount` y `Client.blocked = true`.
- **Dado** un cliente bloqueado **cuando** llama `POST /auctions/{id}/connect` **entonces** 403 `CLIENT_BLOCKED`.
- **Dado** que el cliente paga su única multa pendiente **cuando** llama `POST /penalties/{id}/pay` **entonces** 200, `status: paid`, `clientUnblocked: true`, y `Client.blocked = false`.
- **Dado** que el cliente tiene 2 multas pendientes y paga una **cuando** llama `POST /penalties/{id}/pay` **entonces** `clientUnblocked: false` (queda otra multa pendiente).
- **Dado** que la multa ya está pagada **cuando** se intenta pagar de nuevo **entonces** 400 `VALIDATION_ERROR`.
- **Dado** un cliente sin multas **cuando** llama `GET /me/penalties` **entonces** array vacío y el banner no se muestra.

## Checklist de TODOs

**Backend**
- [ ] Módulo `penalties`: routes `POST /penalties`, `GET /me/penalties`, `GET /clients/{id}/penalties`, `POST /penalties/{id}/pay`.
- [ ] Service `pay`: marcar `paid`, contar pendientes y actualizar `Client.blocked` atómicamente.
- [ ] Response de `POST /penalties/{id}/pay` incluye `clientUnblocked: boolean`.
- [ ] `POST /penalties` protegido con rol SYSTEM.
- [ ] Emitir `Notification { type: 'penalty' }` al crear la multa (helper de F09).
- [ ] Integración con F07: el service de pago llama al service de penalties al detectar `INSUFFICIENT_FUNDS`.

**Mobile**
- [ ] Banner de cuenta bloqueada visible en pantalla principal si `Client.blocked = true`.
- [ ] Pantalla lista de multas con botón de pago por fila.
- [ ] Toast diferenciado según `clientUnblocked`.
- [ ] Navegación desde notificación `penalty` (F09) a la pantalla de multas.

**Tests**
- [ ] Unit: generación de multa (10% del amount).
- [ ] Unit: desbloqueo solo si `count(pending) === 0` tras el pago.
- [ ] Unit: segundo pago de multa pagada → `VALIDATION_ERROR`.
- [ ] Integración: F07 impago → multa creada + `blocked = true` → `POST /penalties/{id}/pay` → `blocked = false`.
- [ ] Integración: cliente bloqueado → `POST /connect` → 403 `CLIENT_BLOCKED`.
