# F04 — Sesión en vivo + polling

**🔓 habilitador MVP · Depende de: F02 (medio de pago verificado), F03 (subastas/catálogo) · Habilita: F05 (pujar).**

## Objetivo y valor
Que el postor pueda **conectarse** a una subasta abierta (y desconectarse), y que la app mantenga el
estado en vivo actualizado mediante **polling** del endpoint `GET /auctions/{id}/live-status`. Esta
feature es la "sala de espera" del postor: ve el ítem activo, las mejores ofertas y la cantidad de
conectados en tiempo real antes de pujar. La caja de puja la provee F05.

## Alcance
**Incluye:** `POST /auctions/{id}/connect` (valida todos los pre-requisitos), `POST /auctions/{id}/disconnect`,
`GET /auctions/{id}/live-status` (polling cada 2–3 s), hook `usePolling` en el mobile, lógica de re-render
selectivo por `version`, pausa del polling en background/offline, chequeo "1 sesión activa global" → 409.
**No incluye:** la caja de puja (F05), streaming de video (externo), inscripción de asistente como flujo
separado (se resuelve automáticamente al conectar si aún no es asistente).

## Decisión de diseño: polling en lugar de WebSockets
El estado en vivo se obtiene mediante **polling HTTP** cada 2–3 segundos. La justificación completa,
los trade-offs (latencia vs. complejidad de infraestructura) y la mitigación de colisiones están en
[`../decisions/ADR-002-realtime-polling.md`](../decisions/ADR-002-realtime-polling.md).

## Modelo de datos
`AuctionSession` (`id`, `auctionId`, `clientId`, `startedAt`, `endedAt?`, `active`).
**Invariante:** a lo sumo 1 `AuctionSession` con `active = true` por cliente en todo el sistema.
`Attendee` (`auctionId`, `clientId`, `bidderNumber` secuencial). Se crea automáticamente al conectar si
no existe para la combinación (`auctionId`, `clientId`).
`Auction.version` — contador incremental; sube con cada `AuctionEvent`.
`AuctionLiveStatus` — objeto derivado (no se persiste): ver schema en OpenAPI.

## Backend — endpoints

### `POST /auctions/{id}/connect` — JWT · rol CLIENT
- **Identidad:** `clientId` se toma de `req.auth.sub`; **no se acepta en el body** (corrección E1).
- **Validaciones (en orden; devolver el primer error que falle):**
  1. Subasta existe y `status = open` → si no, 404 o `VALIDATION_ERROR`.
  2. `client.admitted = true` → si no, **403 `NOT_ADMITTED`**.
  3. `client.blocked = false` → si no, **403 `CLIENT_BLOCKED`**.
  4. `auction.category ≤ client.category` → si no, **403 `CATEGORY_INSUFFICIENT`**.
  5. `hasVerifiedPaymentMethod = true` → si no, **403 `NO_VERIFIED_PAYMENT_METHOD`**.
  6. No existe otra `AuctionSession` activa del cliente (en cualquier subasta) → si sí, **409 `ALREADY_CONNECTED`**
     (el response incluye en `details` el `auctionId` de la sesión activa para que el front ofrezca desconectarla).
- Si pasa todas: crear `AuctionSession { active: true, startedAt: now }`. Si el cliente no es
  `Attendee` de la subasta todavía, crear `Attendee` con el siguiente `bidderNumber` disponible.
- **200** → `AuctionSession`.

### `POST /auctions/{id}/disconnect` — JWT · rol CLIENT
- Identidad desde token. Busca la `AuctionSession` activa del cliente para esta subasta.
- Setea `active = false`, `endedAt = now`.
- **204** si se desconectó correctamente.
- **404** si no hay sesión activa para esta subasta.

### `GET /auctions/{id}/live-status` — JWT · rol CLIENT
- Identidad desde token (para calcular `youWereOutbid`; no enviar `clientId` por query param desde el front).
- **Cada llamada devuelve:**
  ```json
  {
    "version": 347,
    "auctionId": 12,
    "auctionStatus": "open",
    "connectedCount": 42,
    "currentItem": {
      "itemId": 31,
      "productId": 50,
      "catalogDescription": "Reloj antiguo de bolsillo",
      "basePrice": 10000,
      "bestBid": 15100,
      "bestBidBidderNumber": 12,
      "minBidAllowed": 15200,
      "maxBidAllowed": 17000,
      "bidCount": 7
    },
    "youWereOutbid": false,
    "lastEvent": {
      "type": "new_bid",
      "timestamp": "2026-06-20T20:15:33-03:00",
      "data": {}
    },
    "updatedAt": "2026-06-20T20:15:33-03:00"
  }
  ```
- `currentItem` es `null` si la subasta no tiene ítem activo (aún no empezó, o terminó el último ítem).
- `minBidAllowed`/`maxBidAllowed` son `null` para subastas `gold`/`platinum` (sin límites).
- `youWereOutbid`: true si el cliente era el mejor postor del ítem activo y fue superado.
- `connectedCount`: cantidad de sesiones activas en la subasta.
- **200** `AuctionLiveStatus`.
- **403** `NOT_CONNECTED` si el cliente no tiene sesión activa en esta subasta.
- **404** si la subasta no existe.

> **Optimización de polling:** el front compara el `version` recibido con el local. Solo re-renderiza si
> cambió. Esto evita renders innecesarios en períodos de calma. Ver `usePolling` en Mobile.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Flujo de conexión / desconexión
- Desde la pantalla de detalle de la subasta (F03), botón "Conectarme" llama a `POST /auctions/{id}/connect`.
- Si **200** → navegar a la pantalla en vivo.
- Si **409 `ALREADY_CONNECTED`** → `Alert` "Ya estás conectado a otra subasta. ¿Querés desconectarte de
  esa para unirte a esta?" → llamar `POST /auctions/{activeAuctionId}/disconnect` y luego reintentar el connect.
- Si **403** → mostrar mensaje según `code`:
  - `NOT_ADMITTED` → "Tu cuenta no está verificada aún".
  - `CLIENT_BLOCKED` → navegar a pantalla de cuenta bloqueada (multas, F10).
  - `CATEGORY_INSUFFICIENT` → "Tu categoría no es suficiente para esta subasta".
  - `NO_VERIFIED_PAYMENT_METHOD` → "Necesitás al menos un medio de pago verificado" con CTA a F02.
- Botón "Desconectarme" llama `POST /auctions/{id}/disconnect` → volver al detalle de la subasta.

### 2. Pantalla en vivo (contenedor de F05)
- **Header de la sesión:**
  - Nombre/descripción del ítem activo.
  - Foto principal del ítem.
  - Mejor oferta (`bestBid`) + número de postor (`bestBidBidderNumber`).
  - Tu número de postor (`bidderNumber` del `Attendee`).
  - `connectedCount` y `bidCount`.
- Banner "Te superaron" (`youWereOutbid === true`) → alerta visual prominente.
- El área de la caja de puja la provee **F05**.
- Si `currentItem === null` → mostrar "Esperando el próximo ítem…".
- Indicador de reconexión: si el polling falla ≥2 veces consecutivas → banner sutil "Reconectando…";
  no romper la pantalla.

### 3. Hook `usePolling`
```typescript
// Pseudocódigo — implementar en mobile/hooks/usePolling.ts
function usePolling(auctionId, intervalMs = 2500) {
  const [liveStatus, setLiveStatus] = useState(null)
  const lastVersion = useRef(null)

  useEffect(() => {
    const tick = async () => {
      const data = await fetchLiveStatus(auctionId)
      if (data.version !== lastVersion.current) {
        lastVersion.current = data.version
        setLiveStatus(data)   // solo re-render si version cambió
      }
    }
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [auctionId])

  // Pausa en background (AppState inactive/background) y offline (NetInfo)
  useAppStatePause(id)
  useOfflinePause(id)

  return liveStatus
}
```
- **Pausa en background:** cuando `AppState` cambia a `inactive`/`background` → pausar el interval.
  Al volver a `active` → reanudar y hacer un fetch inmediato.
- **Pausa offline:** con `@react-native-community/netinfo`, si no hay conexión → pausar; al reconectar → reanudar.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Cliente no admitido | POST /connect | `NOT_ADMITTED` | 403 |
| Cliente bloqueado | POST /connect | `CLIENT_BLOCKED` | 403 |
| Categoría insuficiente | POST /connect | `CATEGORY_INSUFFICIENT` | 403 |
| Sin medio verificado | POST /connect | `NO_VERIFIED_PAYMENT_METHOD` | 403 |
| Ya conectado (otra subasta) | POST /connect | `ALREADY_CONNECTED` | 409 |
| Sin sesión activa al polling | GET /live-status | `NOT_CONNECTED` | 403 |
| Subasta no encontrada | POST /connect, GET /live-status | `RESOURCE_NOT_FOUND` | 404 |

## Criterios de aceptación
- **Dado** un cliente con categoría suficiente y medio verificado **cuando** se conecta **entonces** 200 y queda registrado como `Attendee` con `bidderNumber` asignado.
- **Dado** un cliente ya conectado a subasta A **cuando** intenta conectarse a subasta B **entonces** 409 `ALREADY_CONNECTED` con `details.auctionId = A`.
- **Dado** que un cliente se desconecta **cuando** llama `/disconnect` **entonces** `AuctionSession.active = false` y `live-status` ya no lo cuenta en `connectedCount`.
- **Dado** que el `version` no cambia entre dos polls **entonces** el hook NO re-renderiza la UI.
- **Dado** que el dispositivo pierde conexión **cuando** el polling está activo **entonces** el interval se pausa y se muestra el banner de reconexión.
- **Dado** un cliente sin medio verificado **cuando** intenta conectarse **entonces** 403 `NO_VERIFIED_PAYMENT_METHOD` y la app muestra el CTA de F02.
- Un cliente **no puede** conectarse a dos subastas simultáneamente.

## Checklist de TODOs

**Backend**
- [ ] Módulo `auction-session`: routes `/auctions/{id}/connect`, `/auctions/{id}/disconnect`, `/auctions/{id}/live-status`.
- [ ] Service connect: validaciones en orden (admitted → blocked → categoría → PM verificado → sesión única global); crear `AuctionSession` y `Attendee` (si no existe) en transacción.
- [ ] Service disconnect: encontrar sesión activa, setear `active=false`, `endedAt`.
- [ ] Service live-status: construir `AuctionLiveStatus` con todos los campos; calcular `youWereOutbid` desde token; calcular `connectedCount`, `minBidAllowed`, `maxBidAllowed` (reutilizar lógica de F05).
- [ ] `409 ALREADY_CONNECTED` incluye `details.auctionId` de la sesión activa.
- [ ] Identidad desde `req.auth.sub` (no del body).

**Mobile**
- [ ] Pantalla en vivo: header con datos del ítem activo, `youWereOutbid`, `connectedCount`.
- [ ] Flujo connect/disconnect con manejo de todos los 403/409.
- [ ] Hook `usePolling` con re-render selectivo por `version`.
- [ ] Pausa del polling en `AppState` background y offline (`netinfo`).
- [ ] Banner de reconexión si el polling falla ≥2 veces.

**Tests**
- [ ] Unit: validaciones de connect (orden correcto; primer error gana).
- [ ] Unit: `youWereOutbid` calculado correctamente (cliente era best → fue superado).
- [ ] Integración: connect → live-status → disconnect → live-status (connectedCount baja).
- [ ] Integración: segundo connect mientras hay sesión activa → 409 `ALREADY_CONNECTED`.
