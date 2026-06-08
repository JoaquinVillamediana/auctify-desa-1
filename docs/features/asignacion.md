# Asignación y plan de trabajo **paralelo** — Grupo 03

> Objetivo: que los **3 trabajen en paralelo desde el día 1**, sin bloquearse. Detalle de cada feature
> en su `Fxx-*.md`. Dependencias técnicas en [`README.md`](./README.md).

## Por qué ya se puede paralelizar

La **base está hecha (F00)** y eso desbloquea todo:
- `schema.prisma` **completo** (todas las entidades) → nadie necesita crear modelos nuevos.
- **Auth funcionando** + **seed** con datos listos (cliente admitido `gold`, medio de pago verificado,
  subasta `open`, catálogo y 3 ítems). Login: DNI `30111222` / `Secret123!`.
- **Shell del mobile** lista: `AuthContext`, cliente API, theme (tokens del Figma), componentes, tabs.

Entonces cada uno construye su **carril vertical** (endpoints backend + pantallas mobile) **contra el
backend corriendo + seed + el contrato OpenAPI**, en paralelo.

## Carriles (cada uno 100% en una sola mano)

| Persona | Carril | Features |
|---------|--------|----------|
| **Juan** (`juanimoli`) | En vivo & pujas (el core de tiempo real) | **F02** medios de pago · **F04** sesión+live · **F05** pujar · **F10** multas |
| **Joaco** (`JoaquinVillamediana`) | Subastas, ventas & finanzas del dueño | **F03** subastas+catálogo · **F07** ventas+pago · **F11** seguros+cuentas de cobro |
| **Valen** | Onboarding, inclusión & info | **F01** auth (UI) · **F06** subir ítem · **F08** métricas · **F09** notificaciones |

> El **orden interno** de cada carril lo decide cada uno; nadie depende del código de otro para empezar.

## Cómo se desacopla (clave del paralelismo)

Las dependencias entre features se resuelven con **seed / endpoints dev**, NO esperando al compañero:

| Si tu feature "depende" de… | En vez de esperar, hacé… |
|------------------------------|--------------------------|
| **F07 ventas** ← F05 pujar | Sembrá un `SaleRecord` (o usá `POST /sale-records`) y construí *pagar* / *envío* contra eso. |
| **F08 métricas** ← F05 pujar | Sembrá `Bid`/`SaleRecord` y computá las métricas sobre esos datos. |
| **F10 multas** ← F07 impago | Sembrá/`POST /penalties` una multa y construí *pagar multa* / *bloqueo*. |
| **F05 pujar** ← F04 sesión (UI) | Usá el `connect` del backend (o sembrá una `AuctionSession` activa) y pujá. |
| **F04 live** ← F02/F03 | Ya tenés subasta + medio de pago verificado en el seed. |
| Cualquier pantalla ← endpoint del otro aún no hecho | Mockéa la respuesta en el cliente API hasta que exista. |

Regla de oro: **cada feature se tiene que poder probar sola** con el seed corriendo.

## Lo "core" → una sola mano o al final

| Core | Cómo lo manejamos |
|------|-------------------|
| **`schema.prisma` / migraciones** | **Congelado** (ya está completo). Si hace falta un cambio, lo hace **solo Juan** (`prisma migrate dev`) y el resto sincroniza con `prisma migrate dev` / `prisma generate`. **Nunca** editar el schema en paralelo. |
| **Motor de pujas / tiempo real (F04+F05)** | Lógica concurrente delicada (transacción, idempotencia, `BID_SUPERSEDED`). **Solo Juan**, aislada en su carril. Los demás consumen `GET /live-status` o lo mockean. |
| **Wiring SYSTEM entre features** (cierre de ítem → `SaleRecord` → notificación → métricas; impago → multa → bloqueo) | **Fase de integración final, juntos.** Hasta entonces cada uno usa endpoints **dev/admin** para disparar su parte. |
| **Infra mobile compartida** (`api/client.ts`, `auth/AuthContext.tsx`, `theme/*`, `app/(tabs)/_layout.tsx`) | Ya hecha → **congelada**. Cambios sólo coordinados por el grupo. |

## Protocolo para no pisarse (git)

- Rama por feature: `feat/Fxx-slug`. PRs **chicos**, uno por feature, contra `main`.
- **Agregá archivos nuevos**, no edites compartidos: backend en `src/modules/<feature>/`, mobile en
  `app/<ruta>` o `app/(tabs)/<pantalla>.tsx`. Así casi no hay merge conflicts.
- Si tocás un **archivo compartido** (schema, `_layout`, `client.ts`, `theme/`) → avisá en el grupo antes.
- Si **extendés el seed**, agregá tu propio bloque **idempotente** (`upsert`/`findFirst`) — no reescribas los de otro.

## Fases

1. **Ahora — en paralelo:** los 3 arrancan su carril contra el backend + seed. (F00 ✅, F01 backend ✅.)
2. **Integración (al final, juntos):** conectar los flujos `SYSTEM`, reemplazar los triggers dev por el
   wiring real y validar el circuito end-to-end (incluye el manejo de errores de `04-error-handling.md`).

> **MVP (Entrega 2):** F01 · F02 · F03 · F04 · F05 · F06 · F08 · F09. **Post-MVP:** F07 (pago real), F10, F11.
> El circuito **login → JWT → app** ya está demostrado.
