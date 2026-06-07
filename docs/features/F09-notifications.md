# F09 — Notificaciones

**⭐ MVP · Depende de: F01 · Habilita: —.**

## Objetivo y valor
Mantener al postor y al dueño informados de **eventos que les conciernen** (admisión, ganancia de subasta,
propuesta de inclusión, multa, rechazo de ítem) mediante un **centro de notificaciones** en la app. El
badge de no leídas da visibilidad inmediata sin requerir que el usuario navegue activamente.

## Alcance
**Incluye:** `GET /me/notifications` (con filtro `unreadOnly`), `POST /notifications/{id}/read`. Tipos:
`admission`, `auction_winner`, `inclusion_proposal`, `penalty`, `item_rejected`, `info`. Campo `payload`
para navegación contextual. Badge en la UI con el count de no leídas.
**No incluye:** push notifications (requiere FCM/APNs, post-MVP), suscripciones en tiempo real (polling
no aplica acá, es on-demand), borrado de notificaciones, notificaciones de admin.

## Modelo de datos
`Notification`: `id`, `clientId`, `type` (NotificationType), `title`, `message`, `read` (bool, default
false), `payload?` (JSON, para navegación contextual), `createdAt`.

### Dónde se generan las notificaciones (por tipo)
| Tipo | Quién la genera | Dónde | Feature |
|------|----------------|-------|---------|
| `admission` | SYSTEM/ADMIN al ejecutar `PATCH /clients/{id}` con `admitted: true` | F01 (admisión del cliente) | F01 |
| `auction_winner` | SYSTEM al crear `SaleRecord` | `POST /sale-records` | F07 |
| `inclusion_proposal` | SYSTEM al ejecutar `POST /inclusion-requests/{id}/inspection` con `result: accepted` | F06 |
| `penalty` | SYSTEM al generar `Penalty` desde `POST /sale-records/{id}/pay` con `INSUFFICIENT_FUNDS` | F07 |
| `item_rejected` | SYSTEM al ejecutar `POST /inclusion-requests/{id}/inspection` con `result: rejected` | F06 |
| `info` | SYSTEM en otros eventos (ej. rechazo de propuesta por el dueño) | F06 |

### `payload` por tipo (para navegación)
```json
// admission
{ "nextStep": "activate" }

// auction_winner
{ "saleRecordId": 42, "amount": 15100, "commission": 1510, "shippingCost": 500 }

// inclusion_proposal
{ "inclusionRequestId": 7, "proposedBasePrice": 12000, "proposedCommission": 1200, "proposedAuctionId": 5 }

// penalty
{ "penaltyId": 3, "penaltyAmount": 1510, "saleRecordId": 42 }

// item_rejected
{ "inclusionRequestId": 7, "rejectionReason": "El bien no cumple los requisitos de estado." }

// info
{ "message": "Tu propuesta fue rechazada. El bien será devuelto con cargo." }
```

## Backend — endpoints

### `GET /me/notifications` — JWT · rol CLIENT o OWNER
- `clientId` del token (`req.auth.sub`).
- **Query params:** `unreadOnly` (bool, default false). Si `true` → solo `read: false`.
- Ordenadas por `createdAt` descendente (más nuevas primero).
- **200** → array de `Notification` + header o campo extra `unreadCount` (útil para el badge).

  ```json
  {
    "items": [...],
    "unreadCount": 3
  }
  ```

### `POST /notifications/{id}/read` — JWT · rol CLIENT o OWNER
- Solo puede marcar como leídas las propias notificaciones (validar `notification.clientId === req.auth.sub`).
- Setea `read = true`.
- **204** → sin body.
- **404** `RESOURCE_NOT_FOUND` si la notificación no existe o no pertenece al cliente.

> **Helper interno (service):** `createNotification(clientId, type, title, message, payload?)` — llamado
> desde los services de F01, F06 y F07. No es un endpoint público.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Badge de notificaciones
- El tab o ícono de notificaciones muestra un badge rojo con el `unreadCount`.
- Se actualiza al navegar a la pantalla o al hacer pull-to-refresh.
- No hay polling aquí (es on-demand); el badge usa el valor de la última llamada a `GET /me/notifications`.

### 2. Lista de notificaciones
- Cada ítem: ícono por tipo, `title`, `message` (truncado a 2 líneas), fecha relativa (ej. "hace 3 min").
- Items no leídos → fondo distinto (ej. azul claro) para diferenciarlos visualmente.
- Tap en un ítem:
  1. Llama `POST /notifications/{id}/read` (en background, no esperar).
  2. Navega según `type` y `payload`:
     - `admission` → pantalla de activación o perfil.
     - `auction_winner` → detalle de compra (F07), pasando `saleRecordId`.
     - `inclusion_proposal` → detalle de solicitud (F06), pasando `inclusionRequestId`.
     - `penalty` → lista de multas (F10), pasando `penaltyId`.
     - `item_rejected` → detalle de solicitud (F06), pasando `inclusionRequestId`.
     - `info` → ninguna navegación adicional (solo marcar leída).
- Botón "Marcar todas como leídas" (opcional, si el tiempo lo permite): llama `POST /notifications/{id}/read`
  por cada no leída.

**Estados:**
- **loading**: skeleton de items.
- **empty**: "No tenés notificaciones" (si array vacío).
- **error**: "No se pudieron cargar las notificaciones" con "Reintentar".
- **success**: lista de notificaciones.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Notificación no encontrada o de otro cliente | POST /notifications/{id}/read | `RESOURCE_NOT_FOUND` | 404 |
| No autenticado | GET /me/notifications | 401 | 401 |

## Criterios de aceptación
- **Dado** que el cliente es admitido **cuando** el admin ejecuta `PATCH /clients/{id}` con `admitted:true` **entonces** aparece una notificación `admission` en `GET /me/notifications`.
- **Dado** que el cliente gana una subasta **cuando** se registra el `SaleRecord` **entonces** aparece una notificación `auction_winner` con `payload.saleRecordId`.
- **Dado** que el cliente tiene 3 notificaciones no leídas **cuando** llama `GET /me/notifications` **entonces** `unreadCount: 3`.
- **Dado** que el cliente llama `POST /notifications/{id}/read` **entonces** 204 y la notificación queda `read: true`.
- **Dado** un filtro `?unreadOnly=true` **cuando** todas las notificaciones son leídas **entonces** `items: []` y `unreadCount: 0`.
- **Dado** que el cliente toca una notificación `inclusion_proposal` **entonces** navega al detalle de la solicitud correspondiente.
- **Dado** que un cliente intenta marcar la notificación de otro **entonces** 404 `RESOURCE_NOT_FOUND`.

## Checklist de TODOs

**Backend**
- [ ] Módulo `notifications`: routes `GET /me/notifications`, `POST /notifications/{id}/read`.
- [ ] `GET /me/notifications` con filtro `unreadOnly` y respuesta con `unreadCount`.
- [ ] Ownership check en `POST /notifications/{id}/read`.
- [ ] Helper `createNotification(clientId, type, title, message, payload?)` disponible en todos los services que lo necesitan.
- [ ] Llamar al helper desde los services de admisión (F01), inspección y respuesta del dueño (F06), creación de SaleRecord y pago fallido (F07).

**Mobile**
- [ ] Badge de `unreadCount` en el ícono/tab de notificaciones.
- [ ] Pantalla lista con diferenciación visual de leídas/no leídas.
- [ ] Navegación contextual por `type`/`payload`.
- [ ] Marcar como leída en background al tocar.
- [ ] Estados loading/empty/error/success.

**Tests**
- [ ] Unit: helper `createNotification` crea el registro con los campos correctos.
- [ ] Unit: `GET /me/notifications?unreadOnly=true` filtra correctamente.
- [ ] Integración: admisión del cliente → existe notificación `admission` en `GET /me/notifications`.
- [ ] Integración: `POST /notifications/{id}/read` → `read: true`; llamar de nuevo es idempotente.
- [ ] Integración: cliente no puede marcar la notificación de otro → 404.
