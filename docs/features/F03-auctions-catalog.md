# F03 — Subastas y catálogo

**🔓 habilitador MVP · Depende de: F01 · Habilita: F04 (sesión en vivo), F07 (ventas).**

## Objetivo y valor
Que el postor pueda **descubrir subastas** con filtros, ver el **detalle de una subasta** y explorar el
**catálogo de ítems** (fotos, descripción, precio base). El precio base es visible a cualquier usuario
autenticado — no hace falta estar inscripto a la subasta (corrección E1). Las subastas con `status:
scheduled` también se listan. Es el punto de entrada al producto para el postor.

## Alcance
**Incluye:** listado con filtros (`status`, `category`, `currency`, `date`, `accessibleForClient`),
detalle de subasta, catálogo completo con `basePrice` a autenticados (`null` a anónimos), detalle de ítem
(fotos, datos del producto, artista/historia si aplica), URL de streaming (solo admitidos), `GET /items`,
`GET /items/{id}`. Creación y actualización de subastas por ADMIN.
**No incluye:** conectarse en vivo (F04), pujar (F05), inscripción como asistente (se hace en F04 al
conectar), gestión de catálogo/ítems por admin más allá de crear/actualizar.

## Modelo de datos
`Auction` (`status: scheduled|open|closed`, `category`, `currency`, `version`, `currentItemId`, …),
`Catalog` (1:1 con `Auction`), `CatalogItem` (`lotNumber`, `basePrice`, `status`, `auctioned`),
`Product` (`catalogDescription`, `fullDescription`, `artist?`, `historicalDate?`, `history?`), `Photo`.

## Reglas de negocio

- **Acceso por categoría:** `auction.category` debe ser `≤` la categoría del cliente (orden:
  `common < special < silver < gold < platinum`). Un cliente `silver` accede a subastas `common`,
  `special` y `silver`, pero no a `gold` ni `platinum`. El filtro `accessibleForClient` del listado
  aplica esta lógica vía el `clientId` del token (no del query param, que es solo para admin).
- **`basePrice` y autenticación:** campo `basePrice` de `CatalogItem` → devolver si el request tiene
  JWT válido (cualquier categoría); `null` si es anónimo. Usar middleware `optionalAuth`.
  (Corrección E1: **no** hace falta ser asistente de la subasta.)
- **Ítems secuenciales:** cada `CatalogItem` tiene `lotNumber` incremental dentro de su catálogo.
  Ordenar por `lotNumber` al devolver el catálogo.
- **Estado `scheduled`:** una subasta puede estar `scheduled` antes de abrirse; se lista normalmente
  pero no tiene ítem activo.
- **Streaming:** solo accesible a usuarios con `admitted: true`; la URL viene del campo `streamingUrl`
  del `Auction` (servicio externo, no generado por la app).

## Backend — endpoints

### `GET /auctions` — `optionalAuth`
- **Query params:** `status` (scheduled|open|closed), `category`, `currency`, `date` (ISO date),
  `accessibleForClient` (boolean; si `true` filtra por categoría del token → requiere JWT).
- **200** → array de `Auction` (sin catálogo, sin ítems). Incluir `itemCount`, `attendeeCount` en la
  respuesta para mostrar en el listado.
- Sin parámetros devuelve todas las subastas activas y programadas.

### `GET /auctions/{id}` — `optionalAuth`
- **200** → `AuctionDetail` (incluye `catalogId`, `itemCount`, `attendeeCount`).
- **404** `RESOURCE_NOT_FOUND`.

### `POST /auctions` — JWT · rol ADMIN
- **Body:** `AuctionCreateRequest` (`startsAt`, `status`, `category`, `currency`, opcionales: `auctioneerId`,
  `location`, `attendeeCapacity`, `hasWarehouse`, `ownSecurity`, `isCollection`, `collectionName`).
- **201** → `Auction` creada.
- **400** `VALIDATION_ERROR`.

### `PATCH /auctions/{id}` — JWT · rol ADMIN
- **Body:** `AuctionUpdateRequest` (campos opcionales; solo los enviados se actualizan).
- Permite transicionar `status`: `scheduled → open → closed`.
- **200** → `Auction` actualizada. **404** `RESOURCE_NOT_FOUND`.

### `GET /auctions/{id}/catalog` — `optionalAuth`
- Devuelve `CatalogDetail` (catálogo + ítems con `lotNumber` ordenado).
- `basePrice` de cada `CatalogItem`: si hay JWT válido → valor real; si no → `null`.
- **200** `CatalogDetail`. **404** `RESOURCE_NOT_FOUND`.

### `GET /auctions/{id}/streaming` — JWT · `admitted: true`
- Devuelve `{ url, expiresAt }` con la URL del servicio externo.
- **403** `NOT_ADMITTED` si el cliente no está admitido.
- **403** `CATEGORY_INSUFFICIENT` si la categoría es insuficiente.
- **404** si la subasta no tiene `streamingUrl`.

### `GET /items` — `optionalAuth`
- **Query params:** `catalogId`, `auctionId` (atajo que resuelve el `catalogId` internamente), `auctioned`.
- `basePrice` igual que en catálogo (nulo a anónimos).
- **200** → array de `CatalogItem`.

### `GET /items/{id}` — `optionalAuth`
- **200** → `CatalogItemDetail` (incluye `productDetail` con fotos, `bestBid`, `minBidAllowed`,
  `maxBidAllowed`). `basePrice` con la misma regla.
- **404** `RESOURCE_NOT_FOUND`.

> **Admin — gestión de catálogo:** `POST /items` y `PATCH /items/{id}` (crear/actualizar ítem en un
> catálogo), disponibles para admin. Ver OpenAPI para los schemas `CatalogItemCreateRequest`.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Listado de subastas
- Filtros: `status` (scheduled/open/closed), `category`, `currency`, `date`. Aplicable desde la UI
  (chips o panel de filtros).
- Cada tarjeta muestra: fecha, `location`, `category`, `currency`, `itemCount`, `attendeeCount`, estado.
- Subastas `gold`/`platinum` con badge visual para diferenciarlas.
- Si el cliente no tiene categoría suficiente para una subasta → mostrar de todas formas pero marcar como
  "Acceso restringido" (no ocultar).
- Estados: **loading** (skeleton), **empty** ("No hay subastas disponibles"), **error** (reintentar).

### 2. Detalle de subasta
- Cabecera: fecha, horario, lugar, rematador (si disponible), moneda, categoría.
- Link/botón "Ver catálogo" → navega al catálogo.
- Link/botón "Ver streaming" → solo si admitido y hay `streamingUrl`; abre en navegador externo o WebView.
- Botón "Conectarme" → navega a F04 (visible solo si `auction.status === 'open'`).
- Si `status: scheduled` → mostrar cuenta regresiva o fecha de inicio.

### 3. Catálogo + lista de ítems
- Lista de ítems ordenada por `lotNumber`.
- Cada ítem: foto principal (thumbnail), `catalogDescription`, `basePrice` (si autenticado, si no "—"),
  `status` del ítem.
- Ítem activo (`status: active`) resaltado con badge "En vivo".
- Tap en ítem → detalle del ítem.

### 4. Detalle de ítem
- Galería de fotos (carrusel o grilla).
- `fullDescription`, `catalogDescription`, `pieceCount`.
- Si aplica: `artist`, `historicalDate`, `history` (ficha cultural del bien).
- `basePrice` (visible a autenticados; sino "Iniciá sesión para ver el precio base").
- `bestBid`, `minBidAllowed`/`maxBidAllowed` (si ítem activo y autenticado).
- Botón "Ir a la subasta" que lleva a la pantalla de sesión en vivo (F04).

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Subasta no existe | GET /auctions/{id} | `RESOURCE_NOT_FOUND` | 404 |
| Ítem no existe | GET /items/{id} | `RESOURCE_NOT_FOUND` | 404 |
| Cliente sin categoría suficiente para streaming | GET /auctions/{id}/streaming | `CATEGORY_INSUFFICIENT` | 403 |
| Cliente no admitido para streaming | GET /auctions/{id}/streaming | `NOT_ADMITTED` | 403 |
| `status` inválido en creación | POST /auctions | `VALIDATION_ERROR` | 400 |

## Criterios de aceptación
- **Dado** un usuario anónimo **cuando** llama `GET /auctions/{id}/catalog` **entonces** `basePrice` de cada ítem es `null`.
- **Dado** un usuario autenticado (cualquier categoría) **cuando** llama `GET /auctions/{id}/catalog` **entonces** `basePrice` tiene valor real.
- **Dado** una subasta `scheduled` **cuando** la lista por `status=scheduled` **entonces** aparece en la respuesta.
- **Dado** un cliente `silver` **cuando** filtra con `accessibleForClient=true` **entonces** no aparecen subastas `gold` ni `platinum`.
- **Dado** un cliente admitido con categoría suficiente **cuando** llama `GET /auctions/{id}/streaming` **entonces** recibe la URL.
- **Dado** que un admin crea una subasta **entonces** aparece en `GET /auctions` y tiene `status: scheduled`.

## Checklist de TODOs

**Backend**
- [ ] Módulo `auctions`: routes, controller, service con filtros y paginación básica.
- [ ] Módulo `catalogs`/`items`: `GET /auctions/{id}/catalog`, `GET /items`, `GET /items/{id}`.
- [ ] Middleware `optionalAuth` aplicado en catálogo e ítems para controlar visibilidad de `basePrice`.
- [ ] Lógica de filtro `accessibleForClient`: comparar orden de categorías desde el token.
- [ ] `GET /auctions/{id}/streaming` con chequeo de `admitted` y categoría.
- [ ] `POST /auctions`, `PATCH /auctions/{id}` protegidos con `requireRole('ADMIN')`.
- [ ] `CatalogItemDetail` incluye `bestBid`, `minBidAllowed`, `maxBidAllowed` (derivados, reutilizar lógica de F05).

**Mobile**
- [ ] Pantalla listado de subastas con filtros (chips).
- [ ] Pantalla detalle de subasta con link a streaming.
- [ ] Pantalla catálogo (lista de ítems por `lotNumber`) con badge "En vivo" en ítem activo.
- [ ] Pantalla detalle de ítem: galería, ficha cultural, precios según autenticación.
- [ ] Manejo de `CATEGORY_INSUFFICIENT` y `NOT_ADMITTED` al intentar acceder al streaming.

**Tests**
- [ ] Unit: lógica de orden de categorías (common < special < silver < gold < platinum).
- [ ] Unit: `basePrice` → nulo si anónimo, valor real si autenticado.
- [ ] Integración: `GET /auctions` con filtro `status=open` devuelve solo open; `GET /auctions/{id}/catalog` con y sin JWT.
- [ ] Integración: cliente `silver` no puede acceder al streaming de subasta `gold`.
