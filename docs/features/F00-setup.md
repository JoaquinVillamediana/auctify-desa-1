# F00 — Setup del proyecto

**🧱 base · Depende de: — · Habilita: todo el resto (F01 en adelante).**

## Objetivo y valor
Dejar **ambos proyectos corriendo y comunicados**: el backend respondiendo en `http://localhost:8080/v1`,
el mobile apuntando a esa URL y el circuito de smoke test funcionando (login con datos de seed → JWT →
`GET /auth/me`). Sin este setup cualquier otra feature no puede desarrollarse ni probarse.

## Alcance
**Incluye:** instalación de dependencias, variables de entorno, migración de DB, seed de datos mínimos,
`npm run dev` en backend y `npx expo start` en mobile, verificación CORS, smoke test del circuito completo,
descripción del layout del monorepo.
**No incluye:** despliegue a producción (Entrega 3), panel de admin, configuración de CI/CD, OAuth,
recupero de contraseña.

## Modelo de datos involucrado
Seed mínimo (de `docs/02-data-model.md` §5):
- 1 `Country` (Argentina, `id:32`)
- 1 `Client` admitido con `category: gold`, `passwordHash` seteado, 1 `PaymentMethod` `verified`
- 1 `Owner`
- 1 `Auction` con `status: open`, `category: silver`, `currency: ARS`
- 1 `Catalog` con 2–3 `CatalogItem` (`status: pending`/`active`), cada uno con su `Product` y ≥6 `Photo`
- 1 usuario admin (puede ser un `Client` con rol `ADMIN` o un registro separado según implementación)

## Backend — configuración

### Estructura de carpetas (backend)
```
backend/
  src/
    modules/        ← un directorio por recurso (auth, clients, auctions, …)
    middleware/     ← requireAuth, requireRole, optionalAuth
    prisma/         ← schema.prisma, seed.ts, client singleton
    utils/          ← errorEnvelope, …
  .env.example
  package.json
```

### Pasos de setup
```bash
cd backend
npm install
cp .env.example .env          # completar DATABASE_URL y JWT_SECRET
npm run prisma:migrate        # crea las tablas según schema.prisma
npm run seed                  # pobla con los datos de desarrollo
npm run dev                   # nodemon / ts-node-dev en :8080
```

### Variables de entorno (`.env.example`)
```
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-change-in-prod"
PORT=8080
```

### Health check
```
GET /health   → 200 { status: "ok", timestamp: <ISO> }
```
Sin autenticación. Úsalo para verificar que el servidor levanta.

### Base path y CORS
- Todas las rutas bajo `/v1` (declarado como prefijo global en Express).
- CORS habilitado en development para `http://localhost:8081` (Expo web) y `*` para el dispositivo físico.
  En el servidor Express: `app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? '*' }))`.
- Agregar `CORS_ORIGINS` a `.env.example`.

## Mobile — configuración

### Estructura de carpetas (mobile)
```
mobile/
  app/
    (auth)/         ← Login, Registro, Activación, Pendiente
    (tabs)/         ← pantallas principales tras login
  components/       ← UI reutilizable
  contexts/         ← AuthContext, etc.
  services/         ← apiClient.ts (axios/fetch con baseURL + interceptor JWT)
  .env.example
```

### Pasos de setup
```bash
cd mobile
npm install
cp .env.example .env.local    # o .env, según expo-env
npx expo start
```

### Variables de entorno (`.env.example`)
```
EXPO_PUBLIC_API_URL=http://localhost:8080/v1
```

> **Dispositivo físico:** `localhost` no funciona desde el teléfono. Usar la IP LAN de la computadora
> (ej. `http://192.168.1.100:8080/v1`). Con Expo Go, la IP del tunnel de Expo también puede funcionar.
> Documentar la IP en el README del proyecto para facilitar el setup del equipo.

### Cliente API (`services/apiClient.ts`)
- Base URL desde `process.env.EXPO_PUBLIC_API_URL`.
- Interceptor que adjunta `Authorization: Bearer <token>` desde `SecureStore`.
- Timeout global de 10 s; en caso de timeout mostrar "Reintentar".
- Interceptor de respuesta: si 401 → limpiar token y redirigir a Login.

## Smoke test (circuito mínimo)
Una vez que ambos servicios corren:

1. `GET http://localhost:8080/health` → `200 { status: "ok" }`.
2. `POST /v1/auth/login` body `{ document: "SEED_DNI", password: "SEED_PASS" }` → `200 { token, user }`.
3. `GET /v1/auth/me` con `Authorization: Bearer <token>` → `200` con el `Client` del seed.
4. `GET /v1/auctions` → lista con al menos la subasta seeded.
5. Desde el mobile (simulador o dispositivo): completar los pasos 2–4 desde la UI.

El smoke test se considera **verde** cuando los 5 pasos devuelven las respuestas esperadas.

## Validaciones y errores
- Si `DATABASE_URL` no existe o es inválida → el servidor debe logear el error y no iniciar (`process.exit(1)`).
- Si `JWT_SECRET` no está definida → igual, no iniciar.
- El seed debe ser **idempotente**: si ya existe el dato, no duplicarlo (usar `upsert` en Prisma).

## Criterios de aceptación
- **Dado** que corro `npm run dev` en backend **entonces** `GET /health` devuelve 200.
- **Dado** el seed ejecutado **cuando** hago login con `SEED_DNI`/`SEED_PASS` **entonces** recibo un JWT válido.
- **Dado** un JWT válido **cuando** llamo `GET /auth/me` **entonces** recibo el `Client` con `admitted:true`.
- **Dado** que inicio Expo **cuando** apunto al backend con la IP LAN **entonces** el login desde el dispositivo funciona.
- **Dado** que el backend no está corriendo **cuando** el mobile hace un request **entonces** muestra "Sin conexión" o "Reintentar".

## Checklist de TODOs

**Backend**
- [ ] `package.json` con scripts `dev`, `build`, `prisma:migrate`, `seed`.
- [ ] `schema.prisma` con todas las entidades de `docs/02-data-model.md` (SQLite en dev).
- [ ] `.env.example` con `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGINS`.
- [ ] `GET /health` sin autenticación.
- [ ] CORS configurado para dev (origen wildcard o lista configurable).
- [ ] `seed.ts` idempotente: Country, Client (gold, verified PM), Owner, Auction open, Catalog, Items, Photos, Admin.
- [ ] Prefijo global `/v1` en Express.
- [ ] Middlewares base: `requireAuth`, `requireRole`, `optionalAuth`, `requireSelfOrAdmin`.
- [ ] Envelope de error (`{ code, message, details }`) desde utils compartido.

**Mobile**
- [ ] `.env.example` con `EXPO_PUBLIC_API_URL`.
- [ ] `services/apiClient.ts` con baseURL, interceptor JWT y timeout.
- [ ] `AuthContext` con `login`, `logout`, `user` y persistencia en `expo-secure-store`.
- [ ] Grupo de rutas `(auth)` con pantallas de Login, Registro, Pendiente, Activación.
- [ ] README del mobile con instrucciones de IP LAN para dispositivo físico.

**Tests**
- [ ] Test de humo: script o test de integración que valida `GET /health` → 200.
- [ ] Test de integración: seed presente → `POST /auth/login` → `GET /auth/me` (happy path).
