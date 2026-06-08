# ADR-003 — La identidad sale del JWT, no de IDs enviados por el cliente

**Estado:** Aceptado · **Contexto:** corrección de la Entrega 1.

> Cita de la corrección: *"Varios endpoints reciben clientId, ownerId o attendeeId desde el frontend. En
> operaciones donde el usuario está logueado, el usuario debería salir del JWT/token y no de un ID enviado
> por el cliente."*

## Problema
Endpoints como `connect/disconnect`, `attendees`, `live-status` y `bids` recibían el `clientId`/`attendeeId`
en el body o query. Eso permite **suplantación** (mandar el ID de otro) y duplica la fuente de verdad de
"quién soy".

## Decisión
1. **El actor de una operación propia se deriva del token** (`req.auth.sub`), nunca del body/query. Si el
   cliente igual lo manda, se **ignora**.
2. Se agrega **`GET /auth/me`** y alias **`/me/...`** (`/me`, `/me/metrics`, `/me/notifications`,
   `/me/payment-methods`, `/me/penalties`) que operan sobre el cliente del token.
3. Para **pujar**, el backend **resuelve el `Attendee`** a partir de (`token.sub` + la subasta del ítem);
   el body solo lleva `amount` y `paymentMethodId`.
4. Los `/clients/{id}/...` con `id` explícito quedan **solo para `ADMIN`** (operar sobre terceros), con
   `requireRole(ADMIN)` (o `requireSelfOrAdmin`).

## Implementación
- Middlewares `requireAuth`, `optionalAuth`, `requireRole`, `requireSelfOrAdmin` (ver
  [`../03-auth-and-roles.md`](../03-auth-and-roles.md)).
- El JWT lleva `sub`, `document`, `category`, `roles`.
- `optionalAuth` habilita el caso del **catálogo**: `basePrice` se muestra si hay token válido (cualquier
  categoría), `null` si es anónimo.

## Consecuencias
- ✅ No se puede operar en nombre de otro; menos parámetros en el front; autorización clara por rol.
- ⚠️ El OpenAPI cambió (se quitaron `clientId`/`attendeeId` de varios bodies/queries y se agregó `/me/...`).
  Documentado en [`../07-corrections-entrega1.md`](../07-corrections-entrega1.md).
