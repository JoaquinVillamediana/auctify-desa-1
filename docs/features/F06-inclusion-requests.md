# F06 — Subir ítem (solicitud de inclusión)

**⭐ MVP · Depende de: F01 · Habilita: F11 (seguros y cuentas de cobro).**

## Objetivo y valor
Que un **dueño** pueda **proponer un bien** para ser subastado: crear el bien, subir ≥6 fotos, declarar
propiedad y origen lícito, y luego **seguir el estado** de la solicitud (inspección → propuesta → aceptación
o rechazo). Es el canal de origen de los bienes que componen los catálogos.

## Alcance
**Incluye:** `POST /products` (draft `available:false`), `POST /products/{id}/photos` (≥6 fotos),
`POST /inclusion-requests` (con declaraciones obligatorias), `GET /inclusion-requests?ownerId` + filtros,
`GET /inclusion-requests/{id}` (dueño ve su solicitud), `POST /inclusion-requests/{id}/inspection`
(ADMIN), `POST /inclusion-requests/{id}/owner-response` (OWNER acepta/rechaza propuesta). Estado "mis
artículos". Colecciones (múltiples bienes del mismo dueño).
**No incluye:** el pago real de la devolución con cargo (fuera de alcance), la creación de la subasta
destino (la hace admin por separado, ver F03), seguros y cuentas de cobro (F11).

## Modelo de datos
`Product` (`available: false` en draft, `ownerId` por token, `artist?`, `historicalDate?`, `history?`,
`pieceCount`), `Photo` (mínimo 6 por inclusión), `InclusionRequest` (`ownerId`, `productId`,
`ownershipDeclared`, `legalityDeclared`, `status`: pending → under_inspection → accepted/rejected →
proposal_sent → proposal_rejected/accepted, `rejectionReason?`, `proposedBasePrice?`,
`proposedCommission?`, `proposedAuctionId?`, `returnShippingCost?`).

### Ciclo de vida de `InclusionRequest.status`
```
pending
  └→ under_inspection  (ADMIN mueve el bien a inspección física)
       ├→ rejected      (ADMIN rechaza; returnShippingCost con cargo al dueño)
       └→ proposal_sent (ADMIN acepta y envía propuesta con basePrice/commission/auctionId)
                         ├→ accepted          (OWNER acepta la propuesta)
                         └→ proposal_rejected (OWNER rechaza; devuelta con cargo)
```

### Colecciones
Cuando un mismo dueño tiene muchos bienes → la subasta puede marcarse como `isCollection: true` con
`collectionName`. Esto no cambia el flujo de inclusión; cada bien tiene su propia `InclusionRequest`.

## Reglas de negocio
- `ownerId` se toma de `req.auth.sub` (token); el body **no** lo lleva (corrección E1).
- El producto referenciado en la `InclusionRequest` debe tener **≥6 fotos** en `Photo` → si no,
  **400 `MISSING_PHOTOS`**.
- `ownershipDeclared` y `legalityDeclared` deben ser **ambos `true`** → si no, **400 `DECLARATION_REQUIRED`**.
- Si ADMIN rechaza la inspección: `returnShippingCost` es el costo de devolución con cargo al dueño
  (visible en la app).
- Si OWNER rechaza la propuesta: también se genera devolución con cargo al dueño (`returnShippingCost`
  se registra en la `InclusionRequest`).
- Solo el dueño del producto puede ver y operar sobre sus `InclusionRequest` (validar
  `inclusionRequest.ownerId === req.auth.sub` o rol ADMIN).

## Backend — endpoints

### `POST /products` — JWT · rol OWNER
- **Body:** `{ fullDescription, catalogDescription?, date?, pieceCount?, artist?, historicalDate?, history? }`.
- `ownerId` del token; `available: false` (draft).
- **201** → `Product` creado (sin fotos aún).
- **400** `VALIDATION_ERROR` si faltan campos obligatorios.

### `POST /products/{id}/photos` — JWT · rol OWNER · `multipart/form-data`
- **Body:** `{ photo: binary }` (una foto por llamada; el front llama este endpoint ≥6 veces).
- Solo el dueño del producto puede agregar fotos (validar `product.ownerId === req.auth.sub`).
- **201** → `Photo` creada con `photoUrl`.
- **404** `RESOURCE_NOT_FOUND` si el producto no existe o no es del dueño.

### `POST /inclusion-requests` — JWT · rol OWNER
- **Body:** `{ productId, itemDescription, ownershipDeclared: true, legalityDeclared: true, artist?, historicalDate?, history? }`.
- `ownerId` del token.
- Validaciones:
  1. `ownershipDeclared === true && legalityDeclared === true` → si no, **400 `DECLARATION_REQUIRED`**.
  2. `count(Photo, productId) >= 6` → si no, **400 `MISSING_PHOTOS`**.
  3. El producto pertenece al owner del token.
- Crea `InclusionRequest { status: 'pending' }`.
- **201** → `InclusionRequest`.

### `GET /inclusion-requests` — JWT · rol OWNER (propias) / ADMIN (todas)
- **Query params:** `ownerId` (admin filtra por dueño; OWNER solo ve las suyas), `status`.
- `ownerId` del OWNER se toma del token; admin puede pasar un `ownerId` explícito.
- **200** → array de `InclusionRequest`.

### `GET /inclusion-requests/{id}` — JWT · OWNER (solo la propia) / ADMIN
- **200** → `InclusionRequest` con todos los campos.
- **403** si es de otro dueño. **404** `RESOURCE_NOT_FOUND`.

### `POST /inclusion-requests/{id}/inspection` — JWT · rol ADMIN
- **Body:**
  ```json
  {
    "result": "accepted" | "rejected",
    "rejectionReason": "...",         // requerido si rejected
    "returnShippingCost": 500,        // requerido si rejected
    "basePrice": 15000,               // requerido si accepted
    "commission": 1500,               // requerido si accepted
    "proposedAuctionId": 8            // opcional si accepted
  }
  ```
- Si `rejected`: actualiza `status → rejected`, guarda `rejectionReason` y `returnShippingCost`.
  Emite notificación `item_rejected` al dueño (F09).
- Si `accepted`: actualiza `status → proposal_sent`, guarda `proposedBasePrice`, `proposedCommission`,
  `proposedAuctionId`. Emite notificación `inclusion_proposal` al dueño (F09).
- **200** → `InclusionRequest` actualizada.
- **400** `VALIDATION_ERROR` si faltan campos obligatorios según `result`.

### `POST /inclusion-requests/{id}/owner-response` — JWT · rol OWNER
- Solo puede responder el dueño de la solicitud y cuando `status === 'proposal_sent'`.
- **Body:** `{ accepted: boolean, reason?: string }`.
- Si `accepted: true`: `status → accepted`. El product puede marcarse `available: true` para ser incluido.
- Si `accepted: false`: `status → proposal_rejected`, `returnShippingCost` se registra (la empresa establece
  el costo de devolución). Emite notificación `info` al dueño confirmando el rechazo.
- **200** → `InclusionRequest`.
- **400** `VALIDATION_ERROR` si `status` no es `proposal_sent`.

### `GET /products` — JWT · OWNER (propios) / ADMIN
- **Query params:** `ownerId` (OWNER solo ve los suyos; admin puede filtrar), `available`.
- Útil para la pantalla "mis artículos" combinada con las solicitudes.

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Alta de bien (form)
- Campos: `catalogDescription`, `fullDescription` (textarea), `date?`, `pieceCount?`, `artist?`,
  `historicalDate?`, `history?`.
- Al guardar → `POST /products` (draft) → navegar a la pantalla de carga de fotos.

### 2. Carga de ≥6 fotos
- Grilla de miniaturas con botón "+" para agregar (usa `expo-image-picker`).
- Contador "X/6 fotos" — el botón "Continuar" se habilita recién con ≥6.
- Cada foto se sube individualmente con `POST /products/{id}/photos`.
- Indicador de progreso por foto (loading individual).

### 3. Declaración + envío
- Dos checkboxes obligatorios con texto legal:
  - "Declaro ser el legítimo propietario del bien" (`ownershipDeclared`).
  - "Declaro que el bien tiene origen lícito" (`legalityDeclared`).
- Ambos deben estar marcados para habilitar el botón "Enviar solicitud".
- Si el backend devuelve `MISSING_PHOTOS` o `DECLARATION_REQUIRED` → mostrar error inline.
- Al enviar exitosamente → toast "Solicitud enviada" y navegar a "mis artículos".

### 4. Lista "mis artículos" (estado de solicitudes)
- Combina `GET /inclusion-requests` (filtrado por token) y `GET /products` del dueño.
- Cada item muestra: foto principal, `catalogDescription`, `status` de la solicitud, fecha.
- Estados con badge de color: `pending`, `under_inspection`, `proposal_sent`, `accepted`, `rejected`, `proposal_rejected`.
- Tap → detalle de la solicitud.
- Si `status === 'proposal_sent'` → mostrar CTA "Ver propuesta" prominente.

### 5. Detalle de solicitud / Ver y responder propuesta
- Muestra el `status` actual y la descripción de cada etapa.
- Si `status === 'rejected'`: mostrar `rejectionReason` y `returnShippingCost` (costo de devolución con cargo).
- Si `status === 'proposal_sent'`:
  - Mostrar `proposedBasePrice`, `proposedCommission`, nombre de la subasta propuesta.
  - Botones "Aceptar propuesta" y "Rechazar propuesta" con confirmación (`Alert`).
  - "Aceptar" → `POST /inclusion-requests/{id}/owner-response { accepted: true }` → status `accepted`.
  - "Rechazar" → idem con `accepted: false` → status `proposal_rejected`, mostrar el `returnShippingCost`.

**Estados de todas las pantallas:** loading / empty / error (reintentar) / success.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| Menos de 6 fotos al crear solicitud | POST /inclusion-requests | `MISSING_PHOTOS` | 400 |
| `ownershipDeclared` o `legalityDeclared` no son `true` | POST /inclusion-requests | `DECLARATION_REQUIRED` | 400 |
| Producto sin `fullDescription` | POST /products | `VALIDATION_ERROR` | 400 |
| Solicitud no encontrada | GET/POST /inclusion-requests/{id}/... | `RESOURCE_NOT_FOUND` | 404 |
| Dueño intenta responder solicitud que no es suya | POST /owner-response | 403 (sin ErrorCode específico) | 403 |
| Responder solicitud que no está en `proposal_sent` | POST /owner-response | `VALIDATION_ERROR` | 400 |

## Criterios de aceptación
- **Dado** un dueño **cuando** carga el producto con solo 4 fotos y envía la solicitud **entonces** 400 `MISSING_PHOTOS`.
- **Dado** que el dueño no marca los checkboxes **cuando** intenta enviar **entonces** el botón está deshabilitado (validación local) y el backend devuelve `DECLARATION_REQUIRED` si se fuerza.
- **Dado** que admin inspecciona y acepta **cuando** el dueño ve "mis artículos" **entonces** el status es `proposal_sent` y hay CTA de respuesta.
- **Dado** que el dueño acepta la propuesta **cuando** llama a `/owner-response { accepted: true }` **entonces** status cambia a `accepted`.
- **Dado** que el dueño rechaza la propuesta **cuando** llama a `/owner-response { accepted: false }` **entonces** status es `proposal_rejected` y se muestra `returnShippingCost`.
- **Dado** un dueño con varios bienes **cuando** ve "mis artículos" **entonces** ve todos sus bienes con su estado individual.

## Checklist de TODOs

**Backend**
- [ ] Módulo `products`: `POST /products`, `GET /products?ownerId`, `POST /products/{id}/photos`.
- [ ] Módulo `inclusion-requests`: routes y service completo del ciclo de vida.
- [ ] Validación de ≥6 fotos antes de crear `InclusionRequest`.
- [ ] Validación `ownershipDeclared && legalityDeclared === true`.
- [ ] `ownerId` del token (no del body).
- [ ] Ownership check en `GET /inclusion-requests/{id}` y `POST /owner-response`.
- [ ] Emitir `Notification` tipo `inclusion_proposal` al aceptar y `item_rejected` al rechazar en inspección (F09).
- [ ] `PATCH /products/{id}` para marcar `available: true` al aceptar la propuesta.

**Mobile**
- [ ] Flujo en 3 pasos: form → fotos → declaración (stack de navegación).
- [ ] Grilla de fotos con contador y límite mínimo de 6.
- [ ] Checkboxes de declaración obligatorios.
- [ ] Lista "mis artículos" con badges de estado.
- [ ] Pantalla detalle/propuesta con acciones Aceptar/Rechazar y manejo de `returnShippingCost`.

**Tests**
- [ ] Unit: validación de ≥6 fotos y declaraciones.
- [ ] Unit: ownership check en `/owner-response`.
- [ ] Unit: transición de estados (propuesta solo desde `proposal_sent`).
- [ ] Integración: flujo completo → producto → fotos → solicitud → inspección → owner-response.
- [ ] Integración: dueño B no puede ver la solicitud del dueño A.
