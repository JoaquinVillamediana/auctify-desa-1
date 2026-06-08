# ADR-002 — Tiempo real por polling (no WebSocket/SSE)

**Estado:** Aceptado · **Contexto:** corrección de la Entrega 1 que pedía **justificar** esta decisión.

> Cita de la corrección (Grupo 03): *"El tiempo real está resuelto por polling cada 2-3 segundos… deberían
> justificar mejor esta decisión… Si mantienen polling, deberían explicar: por qué eligieron polling y no
> WebSocket/SSE, cómo evitan mostrar información vieja, qué pasa si dos usuarios pujan casi al mismo tiempo."*

## Decisión

Mantenemos **polling** sobre `GET /auctions/{id}/live-status` cada **2–3 s** mientras la pantalla en vivo
está en foco. La **autoridad** sobre el estado de la puja es **siempre el backend** (el cliente nunca decide
quién va ganando); el polling solo **refresca una vista**.

## Por qué polling y no WebSocket/SSE

1. **Simplicidad y alcance académico:** sin servidor de sockets, sin manejo de reconexión/heartbeats/
   back-pressure. Menos superficie de error para un TPO con 3 personas y plazos acotados.
2. **Despliegue (Entrega 3):** el backend debe quedar accesible online. Muchos PaaS gratuitos cortan
   conexiones de larga duración o no garantizan WebSockets estables; un `GET` corto es trivialmente
   hosteable y escalable detrás de cualquier proxy/CDN.
3. **Stateless y horizontal:** al no mantener conexión, cualquier instancia responde cualquier request;
   no hace falta sticky sessions ni un bus de pub/sub entre instancias.
4. **Compatibilidad mobile:** en Expo/React Native, `fetch` con intervalo es robusto frente a cambios de
   red (wifi↔datos) y a la app yendo a background; reconectar un socket en mobile es notablemente más frágil.
5. **La cadencia alcanza para el caso de uso:** la subasta es **presencial** y el martillero conduce el
   ritmo; 2–3 s de latencia de **visualización** es aceptable. La **validez de la puja** no depende del
   polling (ver más abajo): se valida en el `POST` contra el estado real.

**Trade-off aceptado:** más requests "vacías" y hasta ~3 s de latencia visual. Mitigamos el costo con el
contador `version` + requests condicionales (abajo). Si en el futuro hiciera falta menor latencia, la
migración natural es **SSE** (unidireccional, simple sobre HTTP) reutilizando el mismo modelo de eventos
(`AuctionEvent`), sin cambiar la lógica de validación.

## Cómo evitamos mostrar información vieja (stale data)

- **Contador `version`:** `Auction.version` es un entero que **se incrementa con cada evento**
  (`new_bid`, `item_opened`, `item_closed`, `item_sold`, …). El `live-status` lo devuelve.
- El cliente guarda su `version` local y **solo re-renderiza si la del server es mayor** → nada de
  parpadeos ni de "pisar" datos más nuevos con respuestas que llegan desordenadas.
- **Requests condicionales / orden:** se descartan respuestas cuya `version` sea **menor o igual** a la ya
  vista (si por latencia llega tarde una respuesta vieja, se ignora). Opcionalmente el server soporta
  `ETag: "v<version>"` + `If-None-Match` para responder `304` y ahorrar payload.
- **El rango de puja viaja en el `live-status`** (`minBidAllowed`/`maxBidAllowed`/`bestBid`): el front
  siempre valida contra el último estado conocido, y el backend **revalida** al recibir el `POST`.
- **`youWereOutbid`** (derivado del token) avisa al usuario que su oferta fue superada aunque no estuviera
  mirando ese instante.

## Qué pasa si dos usuarios pujan casi al mismo tiempo

La **corrección clave**: la concurrencia **no** se resuelve en el polling sino en el `POST /items/{id}/bids`,
de forma **atómica** en el backend.

1. **Una puja a la vez por asistente:** el front manda header **`Idempotency-Key`** y **bloquea el botón**
   hasta recibir la confirmación (`201`). Reenviar la misma key devuelve la misma puja (no duplica).
2. **Transacción + serialización:** el server recalcula `bestBid`/rango **dentro de una transacción** y
   aplica control optimista por `version` (o `BEGIN IMMEDIATE`/`SELECT … FOR UPDATE` equivalente). Solo
   **una** de dos pujas concurrentes gana la carrera.
3. **`409 BID_SUPERSEDED`:** si entre que el usuario leyó el estado y envió su puja **otro** ya movió el
   `best`, el server rechaza con `409`. El front **refresca** el `live-status`, recalcula el rango mínimo y
   **pide confirmar de nuevo** (nunca acepta a ciegas un monto contra un estado viejo).
4. **`422 BID_OUT_OF_RANGE`:** si el monto quedó fuera de `[minAllowed, maxAllowed]`, se rechaza con el
   rango en `details` para que el usuario corrija.
5. **Orden garantizado:** todas las pujas se persisten con `timestamp`+`id`; el historial respeta el orden
   real de aceptación en el server, no el de llegada al cliente.

Resultado: aunque la **vista** tenga hasta 3 s de atraso, **nunca** se confirma una puja inválida ni se
"pierden"/duplican pujas; la verdad la define el backend en el momento del `POST`.

## Parámetros

| Parámetro | Valor | Nota |
|-----------|-------|------|
| Intervalo de polling | 2–3 s | Solo con la pantalla en **foco**; pausar en background/offline. |
| Backoff ante error | reintentar al siguiente tick | No romper la UI; indicador sutil de "reconectando". |
| Clave de cambio | `version` | Re-render solo si cambió. |
| Idempotencia | header `Idempotency-Key` | Una puja a la vez por asistente. |

## Consecuencias

- ✅ Simple de implementar, testear y desplegar; robusto en mobile.
- ✅ Concurrencia correcta garantizada por el backend (no por el canal de tiempo real).
- ⚠️ Latencia visual de hasta ~3 s y tráfico extra → mitigado con `version`/`304`.
- 🔁 Camino de evolución claro a **SSE** si se necesitara, sin tocar las reglas de puja.
