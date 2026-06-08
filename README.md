# Auctify — Grupo 03

**TPO DAI · 1C 2026** — Juan Ignacio Molina · Joaquín Villamediana · Valentino Femia

Auctify es una **app móvil de subastas en vivo** para una casa de remates de Buenos Aires. Dos perfiles
conviven en la misma app: **postores**, que se registran, cargan un medio de pago y **pujan en vivo** sobre
ítems de un catálogo; y **dueños/consignantes**, que **proponen artículos**, los envían al depósito y cobran
una vez rematados. El comportamiento refleja el relevamiento (categorías de usuario, topes de puja, multas
del 10% por default, póliza de seguro, una sola subasta activa por usuario a la vez).

🎨 **Diseño (Figma):** https://www.figma.com/design/jAhnt4cbFjnNdgULvkhfzU/Auctify---DA1

> Este repo es un **monorepo**: backend + app mobile + documentación + contrato OpenAPI.
> La trazabilidad con el diseño es obligatoria (lo entregado debe coincidir con lo diseñado).

---

## Estructura

```
auctify-desa-1/
├── auctify-openapi.yaml   # Contrato de la API REST (fuente de verdad front↔back)
├── backend/               # Node + Express + TypeScript + Prisma (SQLite en dev)
├── mobile/                # Expo (React Native) + expo-router + TypeScript
└── docs/                  # Documentación: overview, modelo, ADRs y specs por feature
```

## Stack

| | |
|---|---|
| **Mobile** | Expo (React Native), TypeScript, expo-router, expo-secure-store |
| **Backend** | Node + Express + TypeScript, Prisma, zod, JWT |
| **DB** | SQLite (dev) → PostgreSQL (producción, Entrega 3) |
| **Contrato** | OpenAPI 3.0 (`auctify-openapi.yaml`), base `http://localhost:8080/v1` |

Decisiones y justificaciones en [`docs/decisions/`](./docs/decisions/) (incluye la justificación de
**polling** y de **identidad por JWT** que pidió la cátedra).

---

## Quick start

> Requisitos: Node 20+ (probado en 24), npm, y la app **Expo Go** en tu celular (o un emulador).

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate   # crea la base SQLite
npm run seed             # datos de prueba (imprime credenciales)
npm run dev              # http://localhost:8080/v1  (health: /health)
```

### 2) Mobile
```bash
cd mobile
npm install
cp .env.example .env     # setear EXPO_PUBLIC_API_URL
npx expo start
```
> En un **dispositivo físico**, `EXPO_PUBLIC_API_URL` debe apuntar a la **IP LAN** de tu compu
> (ej. `http://192.168.0.10:8080/v1`), no a `localhost`.

Detalle completo del setup en [`docs/features/F00-setup.md`](./docs/features/F00-setup.md).

---

## Documentación

Empezá por acá → [`docs/README.md`](./docs/README.md)

- [`docs/00-overview.md`](./docs/00-overview.md) — dominio, actores, glosario, reglas y MVP.
- [`docs/02-data-model.md`](./docs/02-data-model.md) — entidades, enums, relaciones.
- [`docs/03-auth-and-roles.md`](./docs/03-auth-and-roles.md) — JWT y matriz de roles.
- [`docs/04-error-handling.md`](./docs/04-error-handling.md) — errores (back) y UX de errores (mobile).
- [`docs/decisions/`](./docs/decisions/) — ADRs (stack, polling, identidad JWT, estados de subasta).
- [`docs/07-corrections-entrega1.md`](./docs/07-corrections-entrega1.md) — dónde se resolvió cada corrección.
- **[`docs/features/`](./docs/features/README.md) — specs accionables por feature, en orden de desarrollo.**

## Cómo trabajar

1. Leé el overview y el modelo de datos.
2. Tomá una feature **en orden** desde [`docs/features/README.md`](./docs/features/README.md)
   (rama `feat/Fxx-slug`, PR contra `main`, checklist de _Definition of Done_).
3. El **MVP** (⭐) es: login/registro · pujar · subir ítem · métricas · notificaciones.

## Entregas

- **E1 (hecha):** maquetado, wireframes, paleta, Figma, ícono/splash, OpenAPI.
- **E2:** back + front al 50%, **un circuito completo integrado** (login → subasta → conectarse → pujar) y
  [manejo de errores](./docs/04-error-handling.md).
- **E3:** app completa, backend online (PostgreSQL), frontend instalable en un dispositivo.
