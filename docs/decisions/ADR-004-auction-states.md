# ADR-004 — Estado `scheduled` en las subastas

**Estado:** Aceptado · **Contexto:** corrección de la Entrega 1.

> Cita de la corrección: *"AuctionCreateRequest solo permite open y closed como estados. Para crear una
> subasta, convendría tener un estado tipo scheduled, porque se pueden tener subastas con fecha y hora
> futuras."*

## Decisión
El enum `AuctionStatus` pasa a ser **`scheduled | open | closed`**.

### Ciclo de vida
```
scheduled ──(llega startsAt / la empresa abre)──▶ open ──(termina el remate)──▶ closed
```
- **`scheduled`**: creada con `startsAt` futuro. Visible en listados y catálogo (con `basePrice` para
  registrados), pero **no** admite `connect` ni pujas.
- **`open`**: en curso. Admite `connect`, `live-status` y pujas (`F04`/`F05`).
- **`closed`**: finalizada. Solo lectura (historial, ventas, métricas).

### Reglas asociadas
- `POST /auctions` por defecto crea en `scheduled` (salvo que se indique `open`).
- Solo se puede **conectar/pujar** si `status = open` (si no → error de negocio).
- El listado `GET /auctions?status=` acepta los tres valores.
- La transición `scheduled → open → closed` la maneja la empresa/sistema (`SYS`/`ADMIN`).

## Impacto
- `Auction.status`, `AuctionCreateRequest.status`, `AuctionUpdateRequest.status` y el filtro `status` del
  listado incluyen `scheduled` (actualizado en `auctify-openapi.yaml`).
- `02-data-model.md` ya refleja `AuctionStatus = scheduled | open | closed` con default `scheduled`.

## Consecuencias
- ✅ Modela subastas futuras de forma explícita; habilita una pantalla de "próximas subastas".
- ⚠️ Las features `F03`/`F04` deben chequear `status = open` antes de permitir conexión/puja.
