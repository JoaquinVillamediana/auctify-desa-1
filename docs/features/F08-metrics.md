# F08 — Métricas

**⭐ MVP · Depende de: F05 (pujar; necesita datos de Bid/Attendee) · Habilita: —.**

## Objetivo y valor
Dar al postor **visibilidad de su propia participación**: cuántas subastas asistió, cuántas ganó, cuánto
ofertó y cuánto pagó, desglosado por categoría de subasta. Es una feature de cierre que convierte los datos
acumulados por el circuito de pujas en información útil para el usuario.

## Alcance
**Incluye:** `GET /me/metrics` (el propio cliente, desde el token), `GET /clients/{id}/metrics` (admin
sobre cualquier cliente), cómputo agregado desde `Attendee`, `Bid` y `SaleRecord`. Pantalla de dashboard
con tarjetas y desglose por categoría.
**No incluye:** métricas de la empresa/admin (fuera del alcance de la app mobile), exportación de datos,
histórico temporal por período, métricas de ítems (cuántos ítems subastados, etc.).

## Modelo de datos
No hay entidad nueva. Las métricas son **derivadas** en tiempo de consulta:

| Métrica | Fuente |
|---------|--------|
| `auctionsAttended` | `count(Attendee)` donde `clientId = me` |
| `auctionsWon` | `count(SaleRecord)` donde `clientId = me` y `boughtByCompany = false` |
| `totalBidAmount` | `sum(Bid.amount)` donde `attendee.clientId = me` |
| `totalPaidAmount` | `sum(SaleRecord.amount + commission + shippingCost)` donde `clientId = me` y `paymentStatus = paid` |
| `byCategory[].attended` | `count(Attendee)` agrupado por `auction.category` |
| `byCategory[].won` | `count(SaleRecord)` agrupado por `auction.category` |

Schema de respuesta (ver OpenAPI `Metrics`):
```json
{
  "auctionsAttended": 12,
  "auctionsWon": 3,
  "totalBidAmount": 45000,
  "totalPaidAmount": 38000,
  "byCategory": [
    { "category": "silver", "attended": 8, "won": 2 },
    { "category": "gold",   "attended": 4, "won": 1 }
  ]
}
```

## Backend — endpoints

### `GET /me/metrics` — JWT · rol CLIENT
- `clientId` del token (`req.auth.sub`).
- Ejecuta las 4 consultas agregadas + la consulta de desglose por categoría en una sola llamada al
  service (idealmente con `Promise.all` para paralelizar las queries).
- **200** → `Metrics`.

### `GET /clients/{id}/metrics` — JWT · rol ADMIN
- Idéntico al anterior pero para cualquier cliente.
- **200** → `Metrics`.
- **404** `RESOURCE_NOT_FOUND` si el cliente no existe.

> **Relación entre endpoints:** el alias `/me/metrics` es el que usa el front. El `/clients/{id}/metrics`
> queda para el panel admin (ver [`03-auth-and-roles.md`](../03-auth-and-roles.md)).

## Reglas de negocio
- `byCategory` solo incluye las categorías en las que el cliente participó (no devolver categorías con
  `attended: 0`).
- `totalPaidAmount` incluye comisión y costo de envío (total real desembolsado), no solo el `amount` de la puja.
- Si el cliente no tiene pujas ni asistencias → todos los valores en 0 y `byCategory: []`.
- Las queries deben ser performantes: usar índices sobre `Attendee.clientId`, `Bid.attendeeId`,
  `SaleRecord.clientId`. En SQLite esto no requiere configuración especial pero hay que tenerlo en mente.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### Pantalla de métricas (dashboard)
Accesible desde el perfil o tab de métricas.

**Tarjetas de resumen:**
- "Subastas asistidas": `auctionsAttended`
- "Subastas ganadas": `auctionsWon`
- "Total ofertado": `totalBidAmount` formateado con moneda
- "Total pagado": `totalPaidAmount` formateado con moneda

**Desglose por categoría:**
- Lista/tabla: columnas `Categoría`, `Asistidas`, `Ganadas`.
- Solo las categorías en que el cliente participó.
- Badge de color por categoría (common → gris, silver → plateado, gold → dorado, platinum → violeta).

**Estados:**
- **loading**: skeleton de las 4 tarjetas + lista.
- **empty**: "Todavía no participaste en ninguna subasta" (si `auctionsAttended === 0`).
- **error**: banner "No se pudieron cargar las métricas" con botón "Reintentar".
- **success**: tarjetas y desglose visibles.

**Formateo de moneda:**
- Usar la moneda de cada `SaleRecord` (puede ser ARS o USD). En `totalBidAmount` y `totalPaidAmount`,
  si hay registros mixtos (ARS y USD), mostrar cada moneda por separado o solo en la moneda predominante
  (definir con el equipo; recomendado: desglose por moneda).

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Cliente no existe | GET /clients/{id}/metrics | `RESOURCE_NOT_FOUND` | 404 |
| No autenticado | GET /me/metrics | 401 (sin ErrorCode) | 401 |

No hay validaciones de negocio complejas; los errores principales son de autenticación/autorización y
de recursos no encontrados.

## Criterios de aceptación
- **Dado** un cliente que asistió a 3 subastas y ganó 1 **cuando** llama `GET /me/metrics` **entonces** `auctionsAttended: 3`, `auctionsWon: 1`.
- **Dado** que el cliente ganó una subasta y pagó `amount: 10000`, `commission: 1000`, `shippingCost: 500` **entonces** `totalPaidAmount: 11500`.
- **Dado** un cliente sin participaciones **cuando** llama `GET /me/metrics` **entonces** todos los valores son 0 y `byCategory: []`.
- **Dado** participación en subastas `silver` y `gold` **cuando** llama las métricas **entonces** `byCategory` tiene 2 entradas (silver y gold, sin entradas con 0).
- **Dado** un admin **cuando** llama `GET /clients/{id}/metrics` de un cliente existente **entonces** recibe sus métricas.
- **Dado** un cliente llamando `GET /clients/{otraId}/metrics` **entonces** 403 (no es admin).

## Checklist de TODOs

**Backend**
- [ ] Módulo `metrics`: service con las 5 queries agregadas (paralelas con `Promise.all`).
- [ ] Route `GET /me/metrics` (identidad desde token).
- [ ] Route `GET /clients/{id}/metrics` protegida con `requireRole('ADMIN')`.
- [ ] Filtrar `byCategory` para excluir categorías con 0 asistencias.
- [ ] `totalPaidAmount` = suma de `amount + commission + shippingCost` con `paymentStatus = paid`.

**Mobile**
- [ ] Pantalla de métricas con las 4 tarjetas de resumen.
- [ ] Lista de desglose por categoría con badges de color.
- [ ] Estados loading/empty/error/success.
- [ ] Formateo de moneda (al menos ARS; manejar USD si hay registros mixtos).

**Tests**
- [ ] Unit: cada métrica calculada correctamente con datos de prueba (incluye `totalPaidAmount` con comisión y envío).
- [ ] Unit: `byCategory` no incluye categorías con 0.
- [ ] Integración: cliente con datos → `GET /me/metrics` devuelve los valores correctos.
- [ ] Integración: admin → `GET /clients/{id}/metrics` OK; cliente → `GET /clients/{otraId}/metrics` → 403.
