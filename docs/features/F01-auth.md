# F01 — Auth: registro (2 etapas) + activación + login

**MVP ⭐ · Depende de:** F00 · **Habilita:** todo el resto.

## Objetivo y valor
Permitir que un postor se **registre** (etapa 1), sea **admitido** por la empresa, **active** su cuenta
generando contraseña (etapa 2) y **loguee** obteniendo un **JWT**. Es la puerta de entrada a la app.

## Alcance
**Incluye:** registro multipart con fotos de documento (**DNI**), pantalla "pendiente de admisión",
activación con token, login, `GET /auth/me`, persistencia de sesión (token en `SecureStore`).
**No incluye:** la verificación/admisión en sí (la hace admin vía `PATCH /clients/{id}`, ver F03/roles),
recupero de contraseña (post-MVP), OAuth.

## Modelo de datos
`Client` (con `document`=DNI, `passwordHash`, `admitted`, `category`, `idCardFront/BackUrl`), `ActivationToken`, `Country`.

## Backend — endpoints

### `POST /auth/register` — `multipart/form-data` · público
- **Campos obligatorios:** `document` (DNI), `firstName`, `lastName`, `email`, `address`, `countryId`,
  `idCardFront` (binary), `idCardBack` (binary). **Opcional:** `photo`.
- Crea `Client { admitted:false, passwordHash:null, category:null }`. Guarda las imágenes (en dev:
  carpeta `uploads/`, devolver URL local; en prod: storage).
- **201** → `{ client, nextStep: "await_admission_email" }`.
- **400** `VALIDATION_ERROR` (faltan campos / email mal formado). **409** `DUPLICATE_ENTRY` (DNI o email ya existen).

### `POST /auth/activate` — público
- Body: `{ token, password (min 8) }`.
- Valida `ActivationToken` (existe, no usado, no expirado) → setea `passwordHash` (bcrypt/argon2),
  marca token `usedAt`. Devuelve **200** `{ token: <JWT>, user }`.
- **400** `INVALID_TOKEN`. **409** `ACCOUNT_ALREADY_ACTIVATED`.

### `POST /auth/login` — público
- Body: `{ document, password }`.
- **200** `{ token: <JWT>, user }`. **401** credenciales inválidas.
- **403** `NOT_ADMITTED` (no admitido) o `CLIENT_BLOCKED` (bloqueado/suspendido) con envelope `Error`.

### `GET /auth/me` — requiere JWT
- Devuelve el `Client` del token (incluye `category`, `admitted`, `hasVerifiedPaymentMethod`). **401** sin token.

> **Admisión (admin):** `PATCH /clients/{id}` con `{ admitted:true, category }` → genera `ActivationToken`
> + envía mail (en dev: loguear el token / devolverlo en la respuesta para poder activar). Emite
> notificación `admission` (F09).

## Mobile — pantallas (Figma `Auctify - DA1.fig`)
1. **Login** — DNI + contraseña. Maneja 401 (credenciales) y 403 (`NOT_ADMITTED`/`CLIENT_BLOCKED`).
2. **Registro (etapa 1)** — form con DNI, nombre, apellido, email, domicilio, país (picker de `/countries`),
   captura de **foto frente y dorso del documento** + foto de perfil opcional (`expo-image-picker`).
3. **Pendiente de admisión** — pantalla informativa tras `nextStep: await_admission_email`.
4. **Activación (etapa 2)** — input de token (o deep-link desde el mail) + nueva contraseña + repetir.
   Al éxito guarda el JWT y entra logueado.
5. **Estados:** botones con `loading` y deshabilitados durante la request; validación local de obligatorios.

**Sesión:** guardar JWT en `expo-secure-store`; `AuthContext` expone `user`, `login`, `activate`,
`register`, `logout`; al abrir la app, hidratar desde el token (`GET /auth/me`).

## Validaciones y errores
- DNI: requerido, string no vacío, **único**.
- Email: formato válido, único. Password: min 8.
- Mapear `DUPLICATE_ENTRY` al campo (DNI/email) en el form. `VALIDATION_ERROR.details.fields` → resaltar.

## Criterios de aceptación
- **Dado** un DNI/email nuevos **cuando** completo etapa 1 **entonces** queda `admitted:false` y veo "pendiente".
- **Dado** un cliente admitido con token válido **cuando** activo con password **entonces** recibo JWT y entro logueado.
- **Dado** un cliente no admitido **cuando** intento loguear **entonces** recibo 403 `NOT_ADMITTED`.
- **Dado** un DNI ya registrado **cuando** me registro **entonces** recibo 409 `DUPLICATE_ENTRY`.
- `GET /auth/me` con JWT devuelve mi usuario; sin JWT → 401.

## Checklist de TODOs
**Backend**
- [ ] Módulo `auth` (controller + service + routes) y `clients` (mínimo para `PATCH`/admisión).
- [ ] Hash de password (argon2/bcrypt), emisión/verificación de JWT (`jsonwebtoken`).
- [ ] Manejo de `multipart` (multer) + guardado de imágenes en dev (`uploads/`).
- [ ] Generación de `ActivationToken` (random + `expiresAt`) en la admisión; en dev exponer el token.
- [ ] Middlewares `requireAuth` / `optionalAuth` (reutilizables por todas las features).
- [ ] Validación con zod; errores con envelope `Error`.

**Mobile**
- [ ] `AuthContext` + persistencia con `expo-secure-store`.
- [ ] Pantallas Login / Registro / Pendiente / Activación (grupo `(auth)` en `expo-router`).
- [ ] `expo-image-picker` para fotos de documento; picker de países.
- [ ] Interceptor del cliente API que adjunta `Authorization: Bearer`.

**Tests**
- [ ] Unit: validación de registro, expiración de token, login (admitido/no admitido/bloqueado).
- [ ] Integración: register → admitir → activate → login → /me (happy path).
