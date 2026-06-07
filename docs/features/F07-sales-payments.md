# F07 — Ventas y pago de la compra

**✅ recomendado (cierra el circuito) · Depende de: F05 (pujar) · Habilita: F10 (multas).**

## Objetivo y valor
Cerrar el **circuito económico** de la subasta: cuando nadie supera la última puja, se registra la venta,
el comprador elige **envío o retiro**, y **paga** la compra con uno de sus medios verificados. Si no tiene
fondos se genera una multa y se bloquea al cliente (F10). Sin este flujo el postor puja pero nunca
concluye la transacción.

## Alcance
**Incluye:** `POST /sale-records` (SYSTEM al cerrar el ítem), `GET /sale-records` (comprador/dueño ven
los suyos; admin ve todos), `PATCH /sale-records/{id}/shipping` (retiro o envío), `POST /sale-records/{id}/pay`
(paga la compra; genera multa + bloqueo si `INSUFFICIENT_FUNDS`). Notificación privada al ganador con el
desglose. Regla de cheque certificado (respeta `reservedAmount`). Empresa compra al base si nadie pujó.
**No incluye:** pasarela de pago real (simulado en dev), cobro al dueño del bien (F11), seguros (F11),
pago de multas (F10).

## Modelo de datos
`SaleRecord`: `id`, `auctionId`, `ownerId`, `productId`, `clientId` (ganador), `amount`, `commission`,
`shippingCost?`, `pickupInPerson` (bool, default false), `shippingAddress?`, `paymentMethodId`,
`boughtByCompany` (bool; true si nadie pujó), `paymentStatus` (SalePaymentStatus: `pending` → `paid`/`failed`),
`paidAt?`, `createdAt`.

`Penalty`: `id`, `clientId`, `auctionId`, `itemId`, `amount` (10% del `SaleRecord.amount`), `status`
(`pending` → `paid`), `createdAt`.

## Reglas de negocio

- **Cierre de ítem (SYSTEM):** cuando nadie supera la última puja, el backend detecta el cierre (el admin
  / rematador cierra el ítem actualizando su `status → sold`). El sistema (`SYSTEM`) invoca `POST /sale-records`
  con el ganador. Si nadie pujó → `boughtByCompany: true`, `clientId` es el de la empresa.
- **Seguro y retiro:** si `pickupInPerson = true` → el comprador **pierde la cobertura del seguro** del bien.
  El backend debe asentar esto en el `SaleRecord`.
- **Shipping address:** si `pickupInPerson = false` → `shippingAddress` es **requerido** en `PATCH /shipping`.
- **Pagar:** `POST /sale-records/{id}/pay` → `clientId` del token debe coincidir con `saleRecord.clientId`.
  En dev, simular que el cobro es exitoso si `paymentMethod.status === 'verified'`.
  Si se simula fallo → **422 `INSUFFICIENT_FUNDS`**: generar `Penalty` (10% de `amount`), bloquear cliente
  (`Client.blocked = true`), emitir notificación `penalty` (F09). El cliente tiene 72 hs para regularizar
  (plazo informativo, no automatizado en el MVP).
- **Cheque certificado:** en el `POST /sale-records/{id}/pay`, si `paymentMethodId` apunta a un
  `certified_check`, la suma de `SaleRecord.amount` pagados + el nuevo `amount` **no puede superar**
  `PaymentMethod.reservedAmount`. Si supera → 422 `INSUFFICIENT_FUNDS` (misma ruta que el impago).
- **Notificación al ganador:** al crear el `SaleRecord`, emitir `Notification { type: 'auction_winner' }`
  al `clientId` con `payload: { saleRecordId, amount, commission, shippingCost }`.

## Backend — endpoints

### `POST /sale-records` — JWT · rol SYSTEM
- Invocado por el backend al cerrar el ítem (no por el front).
- **Body:** `SaleRecordCreateRequest` (`auctionId`, `ownerId`, `productId`, `clientId`, `amount`,
  `commission`, `shippingCost?`, `pickupInPerson?`, `paymentMethodId`).
- Si `clientId` corresponde a la empresa → `boughtByCompany: true`.
- Emite `Notification { type: 'auction_winner' }` al comprador.
- Actualiza `CatalogItem.status → sold` (o `unsold` si `boughtByCompany`).
- **201** → `SaleRecord` con `paymentStatus: pending`.

### `GET /sale-records` — JWT · CLIENT (propios como comprador) / OWNER (propios como vendedor) / ADMIN (todos)
- **Query params:** `auctionId`, `clientId` (solo admin), `ownerId` (solo admin).
- El backend filtra automáticamente: `CLIENT` ve solo donde `saleRecord.clientId === req.auth.sub`;
  `OWNER` ve solo donde `saleRecord.ownerId === req.auth.ownerId` (si el mismo usuario es ambos, ve ambas vistas).
- **200** → array de `SaleRecord`.

### `PATCH /sale-records/{id}/shipping` — JWT · rol CLIENT (comprador)
- Solo puede el comprador (`saleRecord.clientId === req.auth.sub`).
- **Body:** `{ pickupInPerson: boolean, shippingAddress?: string }`.
- Si `pickupInPerson = false` y `shippingAddress` no se provee → **400 `VALIDATION_ERROR`**.
- Si `pickupInPerson = true` → registrar en el `SaleRecord`; avisar en la respuesta que se pierde el seguro
  (`insuranceLost: true` en el response o en un campo del `SaleRecord`).
- **200** → `SaleRecord` actualizado.
- **404** `RESOURCE_NOT_FOUND`.

### `POST /sale-records/{id}/pay` — JWT · rol CLIENT (comprador)
> Endpoint nuevo — corrección E1: faltaba el paso de pagar la compra ganada.

- Solo el comprador puede pagar (`saleRecord.clientId === req.auth.sub`).
- **Body:** `{ paymentMethodId }`.
- Validaciones:
  1. `paymentMethodId` pertenece al cliente del token (`PAYMENT_METHOD_NOT_OWNED`).
  2. El medio está `verified` (`NO_VERIFIED_PAYMENT_METHOD`).
  3. Si `certified_check`: suma de pagos anteriores + `amount` ≤ `reservedAmount` (`INSUFFICIENT_FUNDS`).
  4. (Dev) Simular cobro: siempre exitoso si medio verificado, salvo que se simule fallo explícitamente.
- Si éxito: `paymentStatus → paid`, `paidAt = now`. **200** → `SaleRecord`.
- Si `INSUFFICIENT_FUNDS` (422):
  1. `paymentStatus → failed`.
  2. `POST /penalties` con `amount = 0.10 * saleRecord.amount`.
  3. `Client.blocked = true`.
  4. Emitir `Notification { type: 'penalty' }` (F09).
  5. Devuelve **422** con `{ code: 'INSUFFICIENT_FUNDS', message: '...', details: { penaltyAmount, penaltyId } }`.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Mis compras (lista)
- Listado de `SaleRecord` donde el usuario es el comprador.
- Cada fila: foto del ítem, `catalogDescription`, `amount`, `paymentStatus` (badge: pendiente/pagado/fallido).
- Tap → detalle de compra.

### 2. Detalle de compra
- Desglose completo: importe (`amount`), comisión (`commission`), costo de envío (`shippingCost` si aplica).
- Total a pagar = `amount + commission + shippingCost`.
- Estado actual: "Pendiente de pago" / "Pagado" / "Falló el pago".
- Si `paymentStatus === 'pending'` → mostrar sección de envío/retiro (si aún no elegido) y botón "Pagar".

### 3. Elegir envío o retiro
- Radio buttons: "Retirar en persona" / "Envío a domicilio".
- Si "Envío": campo de dirección requerido.
- Advertencia visible: "Si retirás en persona, **perdés la cobertura del seguro**" (confirm Alert al seleccionar retiro).
- Botón "Confirmar modalidad" → `PATCH /sale-records/{id}/shipping`.

### 4. Pagar
- Selector de medio de pago (solo los `verified`).
- Desglose del total antes de confirmar.
- Botón "Confirmar pago" con estado `loading`.
- Si **200**: toast "Pago registrado" y el estado de la compra cambia a "Pagado".
- Si **422 `INSUFFICIENT_FUNDS`**: modal "No se pudo procesar el pago. Se generó una multa de $X. Tenés 72 hs para regularizar." con CTA a la pantalla de multas (F10).
- Si **403 `NO_VERIFIED_PAYMENT_METHOD`** o `PAYMENT_METHOD_NOT_OWNED`: mensaje inline + CTA.

**Estados de todas las pantallas:** loading / empty / error (reintentar) / success.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| `shippingAddress` faltante si `pickupInPerson: false` | PATCH /shipping | `VALIDATION_ERROR` | 400 |
| Medio no pertenece al comprador | POST /pay | `PAYMENT_METHOD_NOT_OWNED` | 403 |
| Medio no verificado | POST /pay | `NO_VERIFIED_PAYMENT_METHOD` | 403 |
| Sin fondos (o cheque excedido) | POST /pay | `INSUFFICIENT_FUNDS` | 422 |
| `SaleRecord` no encontrado | PATCH/POST | `RESOURCE_NOT_FOUND` | 404 |
| No es el comprador | PATCH/POST | 403 (sin ErrorCode específico) | 403 |

## Criterios de aceptación
- **Dado** un ítem cerrado **cuando** el sistema registra la venta **entonces** el ganador recibe una notificación `auction_winner` con el desglose.
- **Dado** que nadie pujó **cuando** el ítem se cierra **entonces** `SaleRecord.boughtByCompany = true`.
- **Dado** que el comprador elige retiro en persona **entonces** `pickupInPerson: true` y se avisa la pérdida del seguro.
- **Dado** que el comprador intenta pagar sin `shippingAddress` (envío seleccionado) **entonces** 400 `VALIDATION_ERROR`.
- **Dado** que el pago es exitoso **cuando** llama `POST /pay` **entonces** `paymentStatus → paid` y `paidAt` se setea.
- **Dado** fondos insuficientes **cuando** el pago falla **entonces** 422 `INSUFFICIENT_FUNDS`, se genera multa de 10%, cliente bloqueado, notificación `penalty` emitida.
- **Dado** un cheque con `reservedAmount: 50000` y compras previas de 48000 **cuando** intenta pagar 5000 más **entonces** 422 `INSUFFICIENT_FUNDS`.

## Checklist de TODOs

**Backend**
- [ ] Módulo `sale-records`: routes `GET /sale-records`, `POST /sale-records`, `PATCH /{id}/shipping`, `POST /{id}/pay`.
- [ ] Service `pay`: validar ownership de medio, verificado, límite de cheque; simular pago; si falla → multa + bloqueo + notificación.
- [ ] Filtrado de `GET /sale-records` por rol: CLIENT ve sus compras, OWNER sus ventas, ADMIN todo.
- [ ] `POST /sale-records` protegido con rol SYSTEM (header interno en dev).
- [ ] Emitir `Notification { type: 'auction_winner' }` al crear el SaleRecord.
- [ ] Emitir `Notification { type: 'penalty' }` si `INSUFFICIENT_FUNDS` (F09).
- [ ] Actualizar `CatalogItem.status → sold/unsold` al registrar la venta.

**Mobile**
- [ ] Pantalla "mis compras" con lista de SaleRecord y estados de pago.
- [ ] Pantalla detalle de compra con desglose y flujo de envío/retiro.
- [ ] Selector de medio de pago (solo verified) en pantalla de pago.
- [ ] Manejo de 422 `INSUFFICIENT_FUNDS` con modal de multa y CTA a F10.
- [ ] Advertencia de pérdida de seguro al elegir retiro.

**Tests**
- [ ] Unit: cálculo de multa (10% del amount).
- [ ] Unit: límite de cheque certificado al pagar.
- [ ] Unit: filtrado de `GET /sale-records` según rol.
- [ ] Integración: puja ganadora → `POST /sale-records` (SYSTEM) → `PATCH /shipping` → `POST /pay` (happy path).
- [ ] Integración: `POST /pay` con fondos insuficientes → 422 + `Penalty` creada + `Client.blocked = true`.
