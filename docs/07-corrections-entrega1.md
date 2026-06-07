# Correcciones de la Entrega 1 — dónde se resolvieron

Mapeo de **cada observación** del feedback (Grupo 03) + las notas del equipo, al lugar donde quedó resuelta.
Útil para defender la Entrega 2 ("acá está lo que nos marcaron").

## Observaciones del corrector

| # | Observación (Entrega 1) | Resolución | Dónde |
|---|--------------------------|------------|-------|
| 1 | **Wireframes:** pantallas de alta fidelidad con mucho contenido, riesgo de **letra muy chica** | Escala tipográfica con **mínimos legibles** (cuerpo ≥ 15–16) en el theme; nota de trazabilidad con Figma | `mobile/src/theme/*`, `01-architecture.md` §4, `mobile/README.md` |
| 2 | **Polling:** justificar polling vs WebSocket/SSE; evitar datos viejos; dos pujas casi simultáneas | ADR completo: por qué polling, `version` para no mostrar stale, concurrencia atómica en el `POST` (idempotencia, `BID_SUPERSEDED`) | [`decisions/ADR-002-realtime-polling.md`](./decisions/ADR-002-realtime-polling.md), `F04`, `F05` |
| 3 | **`basePrice`** debía verse para cualquier **registrado**, no solo asistentes | `basePrice` se devuelve a cualquier **autenticado** (cualquier categoría); `null` solo anónimo | `auctify-openapi.yaml` (`/auctions/{id}/catalog`, `CatalogItem`), `03-auth-and-roles.md`, `F03` |
| 4 | **Identidad por JWT**, no `clientId`/`ownerId`/`attendeeId` del front | Actor desde el token; se quitan IDs de bodies/queries; se agregan `GET /auth/me` y `/me/...` | [`decisions/ADR-003-jwt-identity.md`](./decisions/ADR-003-jwt-identity.md), `03-auth-and-roles.md` |
| 5 | Faltaba endpoint para **pagar la compra ganada** | Nuevo `POST /sale-records/{id}/pay`; `SaleRecord.paymentStatus`/`paidAt`; sin fondos → `INSUFFICIENT_FUNDS` + multa | `auctify-openapi.yaml`, `F07-sales-payments.md`, `F10-penalties.md` |
| 6 | Agregar estado **`scheduled`** para subastas futuras | `AuctionStatus = scheduled \| open \| closed`; ciclo de vida documentado | [`decisions/ADR-004-auction-states.md`](./decisions/ADR-004-auction-states.md), `auctify-openapi.yaml`, `02-data-model.md` |
| 7 | Aclarar endpoints de **usuario común / dueño / admin** | Matriz de roles + `x-roles` en cada operación del OpenAPI | `03-auth-and-roles.md`, `auctify-openapi.yaml` (`x-roles`) |

## Notas / ajustes del equipo

| Nota | Resolución | Dónde |
|------|------------|-------|
| **Agregar DNI** | `Client.document` = **DNI** (único, identificador de login), documentado en el spec | `02-data-model.md`, `auctify-openapi.yaml`, `F01-auth.md` |
| **Subasta = conjunto de ítems que se subastan secuencialmente** | `CatalogItem.lotNumber` (orden), `Auction.currentItemId`, `ItemStatus` (pending→active→…); `live-status.currentItem` | `02-data-model.md`, `F03`, `F04`, `F05` |
| **Pendiente de confirmación del artículo** | Regla "una puja a la vez": confirmación obligatoria del sistema antes de aceptar otra puja; ítem en `pending_confirmation` durante el registro | `F05-bidding.md`, `ADR-002` |
| **Estado de mis artículos** | Pantalla "Mis artículos" del dueño con estado de inclusión/producto (`GET /inclusion-requests?ownerId`, `GET /products?ownerId`) | `F06-inclusion-requests.md`, `mobile/app/(tabs)/items.tsx` |
| **MVP:** login/registro, pujar, subir ítem, métricas, notificaciones | Marcado ⭐ en la hoja de ruta; circuito crítico definido | [`features/README.md`](./features/README.md) |
