# Hoja de ruta de features

> Cada feature es una unidad de trabajo **independiente y tomable por una persona**. Están **ordenadas
> por dependencias**: hacelas de arriba hacia abajo. Cada archivo `Fxx-*.md` tiene el detalle accionable
> (endpoints, pantallas, reglas, validaciones, criterios de aceptación y **checklist de TODOs**).

Antes de tomar una feature, leé: [`../00-overview.md`](../00-overview.md),
[`../02-data-model.md`](../02-data-model.md), [`../03-auth-and-roles.md`](../03-auth-and-roles.md),
[`../04-error-handling.md`](../04-error-handling.md) y el contrato [`../../auctify-openapi.yaml`](../../auctify-openapi.yaml).

---

## Orden de desarrollo

| # | Feature | MVP | Depende de | Objetivo en una línea |
|---|---------|:---:|------------|-----------------------|
| **F00** | [Setup del proyecto](./F00-setup.md) | 🧱 base | — | Backend y mobile corren, DB conectada, health-check, seed, cliente API |
| **F01** | [Auth: registro + activación + login](./F01-auth.md) | ⭐ | F00 | Postor se registra (2 etapas), se admite, activa clave y loguea (JWT) |
| **F02** | [Medios de pago](./F02-payment-methods.md) | 🔓 habilitador | F01 | Alta/baja/listado de medios de pago + verificación (admin) |
| **F03** | [Subastas y catálogo](./F03-auctions-catalog.md) | 🔓 habilitador | F01 | Listar/ver subastas (filtros) y catálogo con `basePrice` para registrados |
| **F04** | [Sesión en vivo + polling](./F04-auction-session-live.md) | 🔓 habilitador | F02, F03 | Conectar/desconectar (1 a la vez) y `live-status` por polling |
| **F05** | [Pujar](./F05-bidding.md) | ⭐ | F04 | Ofertar con validación de rango, confirmación e idempotencia |
| **F06** | [Subir ítem (inclusión)](./F06-inclusion-requests.md) | ⭐ | F01 | Dueño carga bien + ≥6 fotos, declara, sigue estado de inspección/propuesta |
| **F07** | [Ventas y pago de la compra](./F07-sales-payments.md) | ✅ recomendado | F05 | Cierre de ítem → venta, elegir envío/retiro y **pagar** la compra ganada |
| **F08** | [Métricas](./F08-metrics.md) | ⭐ | F05 | Participaciones, ganadas, importes, desglose por categoría |
| **F09** | [Notificaciones](./F09-notifications.md) | ⭐ | F01 | Listar / marcar leídas (admisión, ganador, propuesta, multa…) |
| **F10** | [Multas](./F10-penalties.md) | post-MVP | F07 | Multa 10% por impago, bloqueo y desbloqueo al pagar |
| **F11** | [Seguros y cuentas de cobro](./F11-insurance-payouts.md) | post-MVP | F06 | Póliza, ubicación de depósito, aumento de cobertura, payout accounts |

**Leyenda:** ⭐ MVP explícito · 🧱 base · 🔓 habilitador del MVP (necesario para pujar) · ✅ cierra el circuito.

### Camino crítico del MVP (circuito integrado de Entrega 2)

```
F00 → F01 → F02 → F03 → F04 → F05  (→ F07)
                         └→ "al menos un circuito completo": login → ver subasta → conectarse → pujar
F01 → F06 (subir ítem)
F01 → F08 (métricas) , F09 (notificaciones)
```

> Sugerencia de paralelización en el equipo (3 personas) tras F00–F01:
> - **Persona A:** F02 → F04 → F05 (núcleo de pujas).
> - **Persona B:** F03 → F07 (subastas/ventas).
> - **Persona C:** F06 → F08 → F09 (inclusión, métricas, notificaciones).

---

## Convenciones

### Definition of Done (por feature)
- [ ] Endpoints del backend implementados según el OpenAPI (status codes y `ErrorCode` correctos).
- [ ] Reglas de negocio validadas en el **service** (no solo en el form).
- [ ] Pantallas mobile con estados **loading / empty / error / success**.
- [ ] Identidad desde el **JWT** donde corresponde (ver `03-auth-and-roles.md`).
- [ ] Tests: unit de reglas + al menos 1 de integración del endpoint principal (objetivo 80%).
- [ ] Manejo de errores según [`04-error-handling.md`](../04-error-handling.md).
- [ ] Trazabilidad con el diseño Figma (`Auctify - DA1.fig`).
- [ ] `schema.prisma` y este `docs/` actualizados si el modelo cambió.

### Git
- Rama por feature: `feat/Fxx-slug` (ej. `feat/F05-bidding`).
- Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- PR por feature contra `main`, con checklist de DoD.

### Estructura de cada spec (`Fxx-*.md`)
1. **Objetivo** y **valor**.
2. **Dependencias** (features previas).
3. **Alcance** (incluye / **no** incluye).
4. **Modelo de datos** involucrado.
5. **Backend** — endpoints (método, ruta, auth/rol, request, response, errores) + reglas de negocio.
6. **Mobile** — pantallas/flujo (referencia a Figma) + estados.
7. **Validaciones y errores** (`ErrorCode`).
8. **Criterios de aceptación** (Gherkin-ish).
9. **Checklist de TODOs** (Backend / Mobile / Tests).
