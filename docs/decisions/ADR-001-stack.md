# ADR-001 — Stack tecnológico

**Estado:** Aceptado.

## Contexto
TPO de subastas con **app mobile** + **backend** REST (OpenAPI ya definido en Entrega 1, base `/v1`).
Equipo de 3, plazos de cátedra, y requisitos de entrega: backend **hosteable online** (E3) y frontend
**instalable en un dispositivo** (E3).

## Decisión

| Capa | Elección | Por qué |
|------|----------|---------|
| **Mobile** | **Expo (React Native) + TypeScript + expo-router** | Setup mínimo, prueba inmediata en celular con Expo Go (clave para E3), routing por archivos, build con EAS. |
| **Backend** | **Node + Express + TypeScript** | **Un solo lenguaje (TS) en todo el stack**, alineado con el OpenAPI, rápido de scaffolding y de desplegar. |
| **ORM** | **Prisma** | Migraciones + tipos TS generados; misma API para SQLite y PostgreSQL. |
| **DB (dev)** | **SQLite** | Cero setup local (archivo). |
| **DB (prod, E3)** | **PostgreSQL** | Gestionado (Supabase/Neon/Render); el modelo es portable. |
| **Validación** | **zod** | Esquemas en el borde + tipos inferidos. |
| **Auth** | **JWT (bearer)** | Stateless, simple, encaja con polling y multi-instancia. |
| **Tests** | **vitest + supertest** | Rápido, TS nativo. |

## SQLite → PostgreSQL sin dolor
Para mantener la portabilidad evitamos features SQLite-only:
- **Enums** se modelan como `String` con valores documentados (SQLite no soporta enums en Prisma) y se
  validan en código con uniones TS + zod.
- **Campos JSON** (`AuctionEvent.data`, `Notification.payload`) se guardan como `String` (JSON serializado).
- Sin tipos ni SQL específicos del motor. Migrar = cambiar `provider` + `DATABASE_URL` y regenerar migraciones.

## Alternativas consideradas
- **NestJS:** más estructura pero más boilerplate; innecesario para el alcance.
- **Spring Boot / FastAPI:** introducen un segundo lenguaje fuera del ecosistema RN; más fricción de
  scaffolding y deploy para el equipo.
- **MongoDB:** el dominio es fuertemente **relacional** (clientes, subastas, ítems, pujas, medios de pago,
  ventas) con integridad y agregaciones → un relacional encaja mejor.

## Consecuencias
- ✅ Un lenguaje, contrato compartido, despliegue simple, prueba en dispositivo inmediata.
- ⚠️ Hay que respetar la convención "enums como string" para no romper la portabilidad a PG.
