# Autenticación y roles

> Responde a dos correcciones de la Entrega 1:
> - **Identidad desde el JWT**, no desde IDs enviados por el cliente.
> - **Claridad de qué endpoints son de usuario común, dueño y admin.**

Ver también [`decisions/ADR-003-jwt-identity.md`](./decisions/ADR-003-jwt-identity.md).

---

## 1. Autenticación (JWT)

- Esquema: **Bearer JWT** (`Authorization: Bearer <token>`), declarado como `bearerAuth` en el OpenAPI.
- El token se obtiene en `POST /auth/login` y `POST /auth/activate`.
- **Payload del JWT** (claims): `sub` (clientId), `document`, `category`, `roles` (`["CLIENT"]`,
  `["CLIENT","OWNER"]`, `["ADMIN"]`…), `iat`, `exp`.
- El backend expone **`GET /auth/me`** para que el front obtenga el usuario actual a partir del token
  (evita que el front "adivine" su propio `clientId`).

### Registro en 2 etapas

```
Etapa 1 — POST /auth/register (multipart)
  document(DNI), firstName, lastName, email, address, countryId, idCardFront, idCardBack, photo?
  → crea Client { admitted:false, passwordHash:null }
  → respuesta { client, nextStep: "await_admission_email" }

(Empresa) PATCH /clients/{id}  { admitted:true, category:"silver" }
  → emite ActivationToken + mail

Etapa 2 — POST /auth/activate  { token, password }
  → setea passwordHash, marca token usado
  → responde { token: <JWT>, user }   // evita un login extra

Login — POST /auth/login  { document, password }
  → 401 credenciales inválidas · 403 no admitido / suspendido (Error.code)
```

---

## 2. Regla de identidad: **el actor sale del token**

> **Corrección E1:** varios endpoints recibían `clientId` / `ownerId` / `attendeeId` desde el front.
> Cuando la operación la hace **el propio usuario logueado**, ese ID se **deriva del JWT**, no del body.

**Patrón:**
- Operaciones "sobre mí mismo" → el `clientId` se toma de `req.auth.sub`. El body **no** lo lleva (y si
  lo lleva, se **ignora**).
- Endpoints **de admin** que operan sobre terceros → **sí** reciben el ID explícito en la ruta/body, pero
  exigen rol `ADMIN`.
- `attendeeId` para pujar → el backend **resuelve** el `Attendee` a partir de (`auctionId` del ítem +
  `clientId` del token). El front no lo manda.

| Endpoint | Antes (E1) | Ahora |
|----------|-----------|-------|
| `POST /auctions/{id}/connect` | body `clientId` | **token** |
| `POST /auctions/{id}/disconnect` | body `clientId` | **token** |
| `POST /auctions/{id}/attendees` (auto-registro) | body `clientId` | **token** (admin puede pasar `clientId`) |
| `GET /auctions/{id}/live-status` | query `clientId` | **token** (para `youWereOutbid`) |
| `POST /items/{id}/bids` | body `attendeeId` | **token** → resuelve attendee; body solo `amount`, `paymentMethodId` |
| `GET /clients/{id}/metrics`, `/notifications`, `/penalties`, `/payment-methods` | path `id` | preferir **`/me/...`**; el `id` solo lo usa admin |

> Se agregan alias **`/me/...`** (`/me`, `/me/metrics`, `/me/notifications`, `/me/payment-methods`,
> `/me/penalties`, `/me/sessions`) que operan sobre el cliente del token. Los `/clients/{id}/...` quedan
> para **admin**.

---

## 3. Matriz de roles por endpoint

`A` = anónimo (sin token) · `C` = cliente/postor · `O` = dueño · `ADM` = admin/empresa · `SYS` = sistema.

| Recurso / Endpoint | A | C | O | ADM | SYS |
|--------------------|:-:|:-:|:-:|:--:|:--:|
| `POST /auth/register`, `/auth/login`, `/auth/activate` | ✅ | | | | |
| `GET /auth/me` | | ✅ | ✅ | ✅ | |
| `GET /countries` | ✅ | ✅ | ✅ | ✅ | |
| `GET /auctions`, `/auctions/{id}` | ✅ | ✅ | ✅ | ✅ | |
| `GET /auctions/{id}/catalog` | ✅¹ | ✅ | ✅ | ✅ | |
| `POST /auctions`, `PATCH /auctions/{id}` | | | | ✅ | |
| `GET /auctions/{id}/streaming` | | ✅ | ✅ | ✅ | |
| `POST /auctions/{id}/attendees` | | ✅ (self) | | ✅ | |
| `GET /auctions/{id}/attendees` | | | | ✅ | |
| `POST /auctions/{id}/connect` · `/disconnect` | | ✅ | | | |
| `GET /auctions/{id}/live-status` | | ✅ | | ✅ | |
| `GET /me/payment-methods` · `POST` · `DELETE /payment-methods/{id}` | | ✅ | | | |
| `POST /payment-methods/{id}/verify` | | | | ✅ | |
| `GET /items`, `/items/{id}`, `/items/{id}/bids` | ✅¹ | ✅ | ✅ | ✅ | |
| `POST /items`, `POST /items/{id}` (catalog) | | | | ✅ | |
| `POST /items/{id}/bids` | | ✅² | | | |
| `GET /products?ownerId`, `/products/{id}` | | | ✅ (own) | ✅ | |
| `POST /products`, `PATCH /products/{id}` | | | ✅ | ✅ | |
| `GET /products/{id}/location` | | | ✅ (own) | ✅ | |
| `POST /products/{id}/photos` | | | ✅ | ✅ | |
| `POST /inclusion-requests`, `GET ?ownerId`, `GET /{id}` | | | ✅ | ✅ | |
| `POST /inclusion-requests/{id}/inspection` | | | | ✅ | |
| `POST /inclusion-requests/{id}/owner-response` | | | ✅ | | |
| `GET /owners`, `POST /owners`, `GET /owners/{id}` | | | ✅ (self) | ✅ | |
| `GET/POST /owners/{id}/payout-accounts` | | | ✅ (own) | ✅ | |
| `GET /insurance/{policy}` | | | ✅ (own) | ✅ | |
| `POST /insurance/{policy}/coverage-increase` | | | ✅ (own) | | |
| `GET /sale-records` | | ✅ (own) | ✅ (own) | ✅ | |
| `POST /sale-records` | | | | | ✅ |
| `PATCH /sale-records/{id}/shipping` | | ✅ (buyer) | | | |
| `POST /sale-records/{id}/pay` ⭐ | | ✅ (buyer) | | | |
| `GET /me/penalties` · `GET /clients/{id}/penalties` | | ✅ (self) | | ✅ | |
| `POST /penalties` | | | | | ✅ |
| `POST /penalties/{id}/pay` | | ✅ (self) | | ✅ | |
| `GET /me/notifications`, `POST /notifications/{id}/read` | | ✅ | ✅ | | |
| `GET /me/metrics` · `GET /clients/{id}/metrics` | | ✅ (self) | | ✅ | |
| `GET /clients`, `PATCH /clients/{id}` (admitir/categoría/baja) | | | | ✅ | |

¹ Catálogo/ítems: **público**, pero `basePrice` solo se devuelve a usuarios **autenticados** (cualquier
categoría). Anónimo → `basePrice: null`. (Corrección E1: **no** hace falta estar asistiendo a la subasta.)
² Requiere estar **conectado** a la subasta del ítem y tener **medio de pago verificado**.
⭐ Endpoint **nuevo** (corrección E1: faltaba pagar la compra ganada).

> **MVP / cátedra:** el rol `ADMIN` y los flujos `SYS` pueden simularse con un usuario seed o endpoints
> internos protegidos por un header simple. No es necesario un panel de admin completo para el MVP, pero
> los endpoints deben **exigir el rol** correcto.

---

## 4. Middleware (backend)

- `requireAuth` → valida JWT, puebla `req.auth = { sub, document, category, roles }`. 401 si falta/inválido.
- `requireRole(...roles)` → 403 si el token no tiene el rol.
- `optionalAuth` → para catálogo/ítems: si hay token válido lo puebla; si no, sigue como anónimo
  (controla la visibilidad de `basePrice`).
- `requireSelfOrAdmin(idParam)` → permite si `req.auth.sub === id` **o** rol `ADMIN`.
