# F02 — Medios de pago

**🔓 habilitador MVP · Depende de: F01 · Habilita: F04 (conectarse), F05 (pujar).**

## Objetivo y valor
Que el postor pueda **registrar, listar y eliminar** sus medios de pago y que la empresa (admin) pueda
**verificarlos o rechazarlos**. Sin al menos un medio de pago verificado el cliente puede ver subastas
pero **no puede pujar** (regla `hasVerifiedPaymentMethod`). Es el habilitador principal para el circuito
de pujas.

## Alcance
**Incluye:** alta de `bank_account` (nacional/extranjera), `credit_card` (nacional/extranjera) y
`certified_check` (con monto reservado); listado de los propios medios; baja; verificación/rechazo por
admin; campo derivado `hasVerifiedPaymentMethod` en `GET /auth/me`.
**No incluye:** pasarela de pago real (el cobro de la compra es F07), edición de un medio ya registrado
(baja y dar de alta de nuevo), validación de datos bancarios externos.

## Modelo de datos
`PaymentMethod`: `id`, `clientId`, `type` (PaymentMethodType), `currency` (ARS/USD), `detail`,
`bank?`, `countryId?`, `reservedAmount?` (solo `certified_check`), `status` (PaymentStatus: `pending` →
`verified`/`rejected`), `rejectionReason?`, `createdAt`.

`Client.hasVerifiedPaymentMethod` — **derivado**: existe ≥1 `PaymentMethod` con `status = verified`.

## Backend — endpoints

### `GET /me/payment-methods` — JWT · rol CLIENT
- Devuelve todos los `PaymentMethod` del cliente del token (no enviar `clientId` desde el front).
- **200** → array de `PaymentMethod` (puede ser vacío).

### `POST /me/payment-methods` — JWT · rol CLIENT
- **Body:** `{ type, currency, detail, bank?, countryId?, reservedAmount? }`.
- `clientId` se toma de `req.auth.sub`; **no se acepta en el body**.
- Reglas de validación por tipo:
  - `bank_account`: `detail` requerido (CBU/IBAN), `bank` recomendado, `currency` requerido.
  - `credit_card`: `detail` requerido (últimos 4 dígitos o alias), `currency` requerido.
  - `certified_check`: `reservedAmount` requerido y > 0, `currency` requerido.
- Queda `status: pending`. La verificación la hace admin.
- **201** → `PaymentMethod` creado.
- **400** `VALIDATION_ERROR` (campos faltantes o inválidos).

### `DELETE /payment-methods/{id}` — JWT · rol CLIENT
- Solo puede borrar su propio medio (validar `paymentMethod.clientId === req.auth.sub`).
- No permitir baja si el medio está referenciado en una puja o compra pendiente (devolver 409 con mensaje
  descriptivo o `VALIDATION_ERROR`).
- **204** si se eliminó. **404** `RESOURCE_NOT_FOUND` si no existe. **403** si no es del cliente.

### `POST /payment-methods/{id}/verify` — JWT · rol ADMIN
- **Body:** `{ status: "verified" | "rejected", reason?: string }`.
- Actualiza `PaymentMethod.status`; si `rejected`, guarda `rejectionReason`.
- **200** → `PaymentMethod` actualizado.
- **404** `RESOURCE_NOT_FOUND`.

> **Dev / atajo:** para poder completar el circuito sin un admin real, el seed incluye 1 medio verificado.
> Opcionalmente, exponer `POST /dev/payment-methods/{id}/verify` protegido por header `X-Dev-Secret`
> (solo en `NODE_ENV=development`).

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Lista de medios de pago
- Accesible desde el perfil/settings del usuario.
- Muestra cada medio con `type`, `currency`, `detail` y el estado (`pending` / `verified` / `rejected`).
- Indicador visual claro: `verified` → verde, `pending` → amarillo, `rejected` → rojo con motivo.
- Si no hay medios → estado **empty** con CTA "Agregar medio de pago".
- Botón de alta (navega a formulario). Swipe o botón de baja.
- Si `hasVerifiedPaymentMethod === false` → banner de aviso "Necesitás al menos un medio verificado para pujar".

### 2. Alta de medio de pago (form)
- Selector de `type`: los campos visibles cambian según el tipo elegido:
  - Todos: `currency` (ARS / USD), `detail`, `bank`.
  - Solo `certified_check`: campo adicional `reservedAmount`.
  - Solo `bank_account`/`credit_card` extranjera: `countryId` (picker).
- Validación local antes de enviar (campos obligatorios marcados con `*`).
- Botón "Guardar" con estado `loading`; al éxito volver a la lista con toast "Medio registrado. Queda pendiente de verificación.".

### 3. Baja de medio de pago
- Confirmación via `Alert` antes de llamar `DELETE /payment-methods/{id}`.
- Si el backend devuelve error (ej. medio con compra referenciada) → mostrar el mensaje de error.

### 4. (Dev) Acción de verificación
- En modo desarrollo, la lista puede mostrar un botón "Verificar [dev]" que llama a `POST /payment-methods/{id}/verify` con `status: verified`.
- Útil para completar el circuito sin acceso al panel admin.

**Estados de la pantalla lista:** `loading` (skeleton) · `empty` · `error` (reintentar) · `success`.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Faltan campos obligatorios (`type`, `currency`, `detail`) | POST /me/payment-methods | `VALIDATION_ERROR` | 400 |
| `reservedAmount` no positivo en `certified_check` | POST /me/payment-methods | `VALIDATION_ERROR` | 400 |
| Medio no pertenece al cliente | DELETE /payment-methods/{id} | `VALIDATION_ERROR` | 403 |
| Medio no encontrado | DELETE / POST verify | `RESOURCE_NOT_FOUND` | 404 |

En el formulario: `VALIDATION_ERROR.details.fields` → resaltar el campo correspondiente.

## Criterios de aceptación
- **Dado** un cliente sin medios **cuando** accedo a "mis medios" **entonces** veo el estado empty con CTA.
- **Dado** que registro un `certified_check` con `reservedAmount: 50000` **entonces** queda `status: pending`.
- **Dado** que admin verifica el medio **cuando** vuelvo a la lista **entonces** veo el badge `verified` y `hasVerifiedPaymentMethod: true` en `GET /auth/me`.
- **Dado** que el medio rechazado muestra `rejectionReason` **cuando** lo veo en la lista **entonces** el motivo de rechazo es visible.
- **Dado** que intento borrar un medio `verified` sin compras pendientes **entonces** 204 y desaparece de la lista.
- **Dado** un cliente sin medio verificado **cuando** intenta pujar **entonces** recibe 403 `NO_VERIFIED_PAYMENT_METHOD` (la caja de puja está oculta en F05).

## Checklist de TODOs

**Backend**
- [ ] Módulo `payment-methods`: routes `/me/payment-methods`, `/payment-methods/{id}`, `/payment-methods/{id}/verify`.
- [ ] Service: crear, listar del token, eliminar (con ownership check), verificar (rol ADMIN).
- [ ] Validación con zod diferenciada por `type` (schema condicional para `reservedAmount`).
- [ ] `hasVerifiedPaymentMethod` derivado al incluir el client en `GET /auth/me`.
- [ ] Endpoint dev `POST /dev/payment-methods/{id}/verify` (solo `NODE_ENV=development`).

**Mobile**
- [ ] Pantalla lista de medios (`/payment-methods/index`) con estados loading/empty/error/success.
- [ ] Pantalla alta (`/payment-methods/new`) con form que cambia por tipo.
- [ ] Acción de baja con confirmación.
- [ ] Badge de estado (colores) y banner de aviso sin medio verificado.
- [ ] Botón dev de verificación visible solo en modo desarrollo.

**Tests**
- [ ] Unit: validación de campos por tipo (incluye `reservedAmount` requerido en cheque).
- [ ] Unit: `hasVerifiedPaymentMethod` derivado (true solo si ≥1 `verified`).
- [ ] Integración: alta → listar → verificar (admin) → `GET /auth/me` devuelve `hasVerifiedPaymentMethod: true`.
- [ ] Integración: `DELETE` de medio ajeno → 403.
