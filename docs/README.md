# Documentación de Auctify

Punto de entrada de la documentación. **Orden de lectura sugerido** según para qué venís.

## 🚀 Quiero empezar a desarrollar
1. [`00-overview.md`](./00-overview.md) — qué es Auctify, actores, glosario, reglas y MVP.
2. [`01-architecture.md`](./01-architecture.md) — monorepo, stack, cómo corre todo, despliegue.
3. [`02-data-model.md`](./02-data-model.md) — entidades, enums, relaciones (espejo del `schema.prisma`).
4. [`03-auth-and-roles.md`](./03-auth-and-roles.md) — JWT, identidad por token y matriz de roles.
5. [`04-error-handling.md`](./04-error-handling.md) — contrato de errores + UX de errores en mobile.
6. **[`features/README.md`](./features/README.md) — hoja de ruta: tomá una feature en orden.**

## 🎨 Diseño (Figma → código)
- [`08-design-system.md`](./08-design-system.md) — tokens (colores/tipografía/spacing) extraídos del Figma `Auctify - DA1`, mapa de pantallas (node IDs) y trazabilidad de diseño.

## 📐 Quiero entender una decisión técnica
- [`decisions/ADR-001-stack.md`](./decisions/ADR-001-stack.md) — por qué Node/Express + Expo + Prisma/SQLite.
- [`decisions/ADR-002-realtime-polling.md`](./decisions/ADR-002-realtime-polling.md) — **polling vs WebSocket/SSE**, datos viejos y pujas simultáneas (corrección E1).
- [`decisions/ADR-003-jwt-identity.md`](./decisions/ADR-003-jwt-identity.md) — identidad desde el JWT (corrección E1).
- [`decisions/ADR-004-auction-states.md`](./decisions/ADR-004-auction-states.md) — estado `scheduled` (corrección E1).

## ✅ Quiero ver qué corrigieron de la Entrega 1
- [`07-corrections-entrega1.md`](./07-corrections-entrega1.md) — mapa observación → dónde se resolvió.

## 📜 Contrato de la API
- [`../auctify-openapi.yaml`](../auctify-openapi.yaml) — OpenAPI 3.0. Pegalo en
  [editor.swagger.io](https://editor.swagger.io) o usá Redoc para navegarlo. Cada operación tiene `x-roles`.

---

## Mapa de features

| # | Feature | MVP |
|---|---------|:---:|
| F00 | [Setup](./features/F00-setup.md) | 🧱 |
| F01 | [Auth (registro/login)](./features/F01-auth.md) | ⭐ |
| F02 | [Medios de pago](./features/F02-payment-methods.md) | 🔓 |
| F03 | [Subastas y catálogo](./features/F03-auctions-catalog.md) | 🔓 |
| F04 | [Sesión en vivo + polling](./features/F04-auction-session-live.md) | 🔓 |
| F05 | [Pujar](./features/F05-bidding.md) | ⭐ |
| F06 | [Subir ítem (inclusión)](./features/F06-inclusion-requests.md) | ⭐ |
| F07 | [Ventas y pago](./features/F07-sales-payments.md) | ✅ |
| F08 | [Métricas](./features/F08-metrics.md) | ⭐ |
| F09 | [Notificaciones](./features/F09-notifications.md) | ⭐ |
| F10 | [Multas](./features/F10-penalties.md) | — |
| F11 | [Seguros y cuentas de cobro](./features/F11-insurance-payouts.md) | — |

> ⭐ MVP · 🧱 base · 🔓 habilitador del MVP · ✅ cierra el circuito.
