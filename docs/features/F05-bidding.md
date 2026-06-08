# F05 — Pujar (oferta en vivo)

**MVP ⭐ · Depende de:** F04 (sesión + live-status), F02 (medio de pago), F03 (subasta/ítem).

## Objetivo y valor
Permitir que un postor **conectado** ofrezca por el **ítem activo**, con validación de rango, verificación
de medio de pago, **confirmación obligatoria** (una puja a la vez) e **idempotencia** ante concurrencia.
Es el corazón del producto.

## Alcance
**Incluye:** crear puja (`POST /items/{id}/bids`), historial (`GET /items/{id}/bids`), cálculo de
rangos min/max, exención gold/platino, regla del cheque, integración con `live-status` para detectar
`youWereOutbid` y refrescar tras `BID_SUPERSEDED`.
**No incluye:** cierre del ítem y registro de venta (eso es F07), conexión/desconexión (F04).

## Modelo de datos
`Bid` (con `idempotencyKey` único, `paymentMethodId`, `amount`, `winner`), `CatalogItem` (`status`,
`basePrice`), `Attendee` (resuelto por token+subasta), `PaymentMethod`, `AuctionEvent` (`new_bid`).

## Reglas de negocio (núcleo)
Sea `base = item.basePrice`, `best = mejor puja actual` (o `null`), `last = última puja`:
- **Mínimo:** `amount ≥ (best ?? base) + 0.01 * base`. (Primera puja: `≥ base + 1%`… en la práctica el
  mínimo inicial es `base`; definir con la cátedra. Por defecto: primera puja `≥ base`.)
- **Máximo:** `amount ≤ last + 0.20 * base` (si hay `last`).
- **Exención:** si `auction.category ∈ {gold, platinum}` → **no** aplican min/max (solo `> best`).
- **Conectado:** el cliente debe tener **sesión activa** en la subasta del ítem (`NOT_CONNECTED`).
- **Medio de pago:** `paymentMethodId` debe ser del cliente (`PAYMENT_METHOD_NOT_OWNED`) y estar
  **verificado** (`NO_VERIFIED_PAYMENT_METHOD`).
- **Cheque certificado:** si el medio es `certified_check`, la **suma de compras/compromisos** del cliente
  no puede superar `reservedAmount` (`CHECK_LIMIT_EXCEEDED`).
- **Bloqueo:** cliente `blocked` → `CLIENT_BLOCKED`.
- **Una puja a la vez:** no se acepta otra puja **del mismo asistente** hasta confirmar la anterior
  (idempotencia + estado de ítem `pending_confirmation` durante el registro).

## Backend — endpoints

### `POST /items/{id}/bids` — requiere JWT · header `Idempotency-Key` (obligatorio)
- **Body:** `{ amount, paymentMethodId }`. (El `attendeeId` se **resuelve del token** + subasta del ítem —
  corrección E1: no se envía desde el front.)
- **Flujo (transaccional):**
  1. Si `Idempotency-Key` ya existe → devolver la **misma** respuesta previa (idempotente).
  2. Resolver `attendee` por (`item.catalog.auctionId`, `token.sub`). Validar sesión activa.
  3. Validar medio de pago (propiedad, verificado, límite de cheque).
  4. Recalcular `best`/`last` **dentro de la transacción**; validar rango (salvo gold/platino).
  5. Si el `best` cambió respecto del que el front conocía → **409 `BID_SUPERSEDED`**.
  6. Insertar `Bid`, marcar como mejor, crear `AuctionEvent(new_bid)`, **incrementar `auction.version`**.
  7. Confirmar transacción → **201** con el `Bid`.
- **Errores:** 400 `VALIDATION_ERROR` · 403 (`NO_VERIFIED_PAYMENT_METHOD`, `PAYMENT_METHOD_NOT_OWNED`,
  `NOT_CONNECTED`, `CATEGORY_INSUFFICIENT`, `CLIENT_BLOCKED`, `CHECK_LIMIT_EXCEEDED`) · **409 `BID_SUPERSEDED`** ·
  **422 `BID_OUT_OF_RANGE`** (`details: { minAllowed, maxAllowed }`).

### `GET /items/{id}/bids` — JWT
- Historial **en orden cronológico** (`timestamp`, `id`). Incluye `bidderNumber` del asistente.

> **Concurrencia:** usar transacción + bloqueo optimista por `auction.version` o `SELECT … FOR UPDATE`
> equivalente (en SQLite, serializar por transacción/`BEGIN IMMEDIATE`). Ver
> [`ADR-002`](../decisions/ADR-002-realtime-polling.md).

## Mobile — pantalla de subasta en vivo (Figma `Auctify - DA1.fig`)
- **Header:** ítem activo (descripción, foto), **mejor oferta** + `bidderNumber`, tu número de postor,
  `connectedCount`, contador de pujas.
- **Polling** de `GET /auctions/{id}/live-status` cada 2–3 s; re-render solo si cambia `version`
  (ver F04). Bandera `youWereOutbid` → alerta visual ("te superaron").
- **Caja de puja:** input con sugerencia del **mínimo** y validación local contra `minBidAllowed`/
  `maxBidAllowed` del `live-status`. Selector de medio de pago (verificados).
- **Al pujar:** generar `Idempotency-Key` (uuid), **deshabilitar** el botón con `loading` hasta la
  **confirmación 201**; recién ahí habilitar de nuevo. (Regla "una puja a la vez".)
- **Manejo de respuestas:**
  - 201 → toast "Puja registrada", refrescar header.
  - 422 `BID_OUT_OF_RANGE` → mostrar rango de `details` y reposicionar el input.
  - 409 `BID_SUPERSEDED` → refrescar `live-status`, recalcular rango, pedir confirmar de nuevo.
  - 403 → mensaje según `code` (CTA agregar medio de pago, reconectar, etc.).
- **Sin medio de pago verificado / categoría insuficiente:** ocultar la caja de puja y mostrar el motivo
  (modo solo lectura).

## Criterios de aceptación
- **Dado** base 10.000 y última oferta 15.000 (subasta `silver`) **cuando** pujo 15.100 **entonces** 201;
  **cuando** pujo 15.000 **entonces** 422 con `minAllowed:15100`; **cuando** pujo 17.001 **entonces** 422 con `maxAllowed:17000`.
- **Dado** subasta `gold` **cuando** pujo cualquier valor `> best` **entonces** no se aplican min/max.
- **Dado** que no estoy conectado **cuando** pujo **entonces** 403 `NOT_CONNECTED`.
- **Dado** que reenvío la **misma** `Idempotency-Key` **entonces** obtengo la misma puja (no se duplica).
- **Dado** que otro pujó entre mi lectura y mi envío **entonces** 409 `BID_SUPERSEDED` y la app me hace refrescar.
- **Dado** un cheque de 50.000 con compras por 48.000 **cuando** intento comprometer 5.000 más **entonces** 403 `CHECK_LIMIT_EXCEEDED`.

## Checklist de TODOs
**Backend**
- [ ] `bids` service con cálculo de `minBidAllowed`/`maxBidAllowed` (reutilizable en `live-status` y `items/{id}`).
- [ ] Transacción atómica + control de versión/serialización; manejo de `Idempotency-Key`.
- [ ] Validaciones de conexión, medio de pago, límite de cheque, bloqueo, categoría.
- [ ] Emitir `AuctionEvent(new_bid)` e incrementar `auction.version`.
- [ ] `GET /items/{id}/bids` ordenado.

**Mobile**
- [ ] Pantalla live (consumiendo F04) con caja de puja y selector de medio de pago.
- [ ] Generación de `Idempotency-Key` + bloqueo del botón hasta confirmación.
- [ ] Manejo de 422 / 409 / 403 con la UX descripta.
- [ ] Indicador `youWereOutbid`.

**Tests**
- [ ] Unit: cálculo de rango (incluye exención gold/platino), límite de cheque.
- [ ] Integración: dos pujas concurrentes → una 201 y otra 409 `BID_SUPERSEDED`; idempotencia.
