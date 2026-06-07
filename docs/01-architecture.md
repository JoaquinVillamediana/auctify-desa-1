# Arquitectura

## 1. Monorepo

```
auctify-desa-1/
├── auctify-openapi.yaml      # Contrato de la API (fuente de verdad del front↔back)
├── backend/                  # Node + Express + TypeScript + Prisma (SQLite en dev)
├── mobile/                   # Expo (React Native) + expo-router + TypeScript
└── docs/                     # Esta documentación
    ├── 00-overview.md ...    # Referencia transversal
    ├── decisions/            # ADRs (decisiones de arquitectura)
    └── features/             # Specs accionables por feature (en orden)
```

Por qué monorepo: un solo lugar para el contrato (`auctify-openapi.yaml`), los docs y ambos proyectos;
facilita mantener front y back **alineados** y la trazabilidad que pide la cátedra.

## 2. Componentes

```
┌─────────────────────┐        HTTPS / JSON           ┌──────────────────────┐
│   Mobile (Expo)     │  ───────────────────────────▶ │   Backend (Express)  │
│   expo-router       │  ◀───────────────────────────  │   /v1, JWT bearer    │
│   AuthContext+SecureStore                            │   zod · Prisma        │
│   API client (fetch)│   polling GET live-status      │                       │
└─────────────────────┘   cada 2–3 s                   └───────────┬──────────┘
        │                                                          │
        │ servicios externos (fuera de alcance):                   ▼
        │  • streaming de la subasta (URL)                   ┌────────────┐
        │  • compañía de seguros                             │  SQLite    │  → PostgreSQL (Entrega 3)
        ▼                                                    └────────────┘
   Expo Go / build instalable
```

- **Front ↔ Back:** REST sobre `/v1`, JSON, autenticación **Bearer JWT**. El contrato es
  `auctify-openapi.yaml`.
- **Tiempo real:** **polling** de `GET /auctions/{id}/live-status` (no WebSocket). Justificación y manejo
  de concurrencia/datos viejos en [`decisions/ADR-002-realtime-polling.md`](./decisions/ADR-002-realtime-polling.md).
- **Persistencia:** Prisma con **SQLite** en desarrollo (cero setup); el modelo se mantiene portable a
  **PostgreSQL** para producción (Entrega 3). Ver [`ADR-001`](./decisions/ADR-001-stack.md).

## 3. Backend (resumen)

- Capas: `routes` → `controller` → `service` (reglas de negocio) → `prisma` (datos).
- Transversal: `middleware/auth` (JWT + roles), `middleware/validate` (zod), `middleware/error`
  (envelope `Error`), `lib/errors` (`AppError` + `ErrorCode`).
- Un **módulo por dominio** en `src/modules/*`. `auth` queda implementado como **módulo de referencia**;
  el resto se desarrolla siguiendo `docs/features/`.
- Config por **variables de entorno** (`.env`): `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`,
  `UPLOAD_DIR`, `CORS_ORIGIN`. Nada de secretos hardcodeados.

## 4. Mobile (resumen)

- **expo-router** (file-based) con grupos `(auth)` y `(tabs)`.
- `AuthContext` + `expo-secure-store` para el JWT; `src/api/client.ts` adjunta el bearer y parsea el
  envelope de error a un `ApiError` tipado, con **timeout** y manejo de **offline** (`netinfo`).
- `src/theme` con tokens (colores/tipografía) — **deben sincronizarse con el Figma `Auctify - DA1.fig`**.
  Tamaños de fuente legibles (cuerpo ≥ 15–16) por la observación de la cátedra sobre "letra muy chica".
- `usePolling` para el `live-status` (re-render solo si cambia `version`).

## 5. Flujo de desarrollo

1. Levantar backend (`F00`): `npm install` → `npm run prisma:migrate` → `npm run seed` → `npm run dev`.
2. Levantar mobile (`F00`): `npm install` → setear `EXPO_PUBLIC_API_URL` → `npx expo start`.
3. Tomar features **en orden** desde [`features/README.md`](./features/README.md).
4. Cada cambio que toque el modelo actualiza `schema.prisma` **y** `docs/02-data-model.md`.

## 6. Despliegue (Entrega 3)

- **Backend accesible online:** desplegar en Render / Railway / Fly.io. Migrar `DATABASE_URL` a
  **PostgreSQL** gestionado (Supabase/Neon/Render PG) — sin cambios de modelo (ver ADR-001). Setear
  `JWT_SECRET` y `CORS_ORIGIN` por entorno.
- **Frontend instalable:** build con **EAS Build** (APK/IPA) o distribución vía **Expo Go**; apuntar
  `EXPO_PUBLIC_API_URL` al backend desplegado.
- **Uploads:** en dev se guardan en `uploads/`; en prod usar un object storage (S3-compatible) y guardar la URL.

## 7. Seguridad (checklist mínima)

- Passwords con hash (argon2/bcrypt). JWT firmado con secreto por entorno.
- Validación de input con zod en el borde. Autorización por rol en cada endpoint (ver `03-auth-and-roles.md`).
- No loguear secretos ni tokens. CORS restringido en producción.
- Idempotencia en pujas (`Idempotency-Key`) para evitar duplicados (ver `ADR-002`).

## 8. Testing

- Backend: **vitest** + supertest (unit de reglas + integración de endpoints). Objetivo 80%.
- Reglas críticas a cubrir sí o sí: rango de puja (+ exención gold/platino), límite de cheque,
  concurrencia de pujas, acceso por categoría.
