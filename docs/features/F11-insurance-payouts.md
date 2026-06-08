# F11 — Seguros y cuentas de cobro

**post-MVP · Depende de: F06 (inclusión — el bien debe estar aceptado) · Habilita: —.**

## Objetivo y valor
Dar al **dueño** visibilidad y control sobre los activos logísticos de su bien una vez aceptado por la
empresa: ver la **póliza de seguro** y la **ubicación física** del bien en el depósito, **aumentar la
cobertura** del seguro pagando la diferencia del premio, y gestionar las **cuentas de cobro** (cuentas a
la vista donde la empresa acredita el dinero de la venta). Las cuentas deben declararse **antes** del
inicio de la subasta.

## Alcance
**Incluye:** `GET /insurance/{policyNumber}` (ver póliza), `POST /insurance/{policyNumber}/coverage-increase`
(solicitar aumento de cobertura), `GET /products/{id}/location` (ubicación en depósito),
`GET /owners/{id}/payout-accounts` (cuentas de cobro declaradas), `POST /owners/{id}/payout-accounts`
(declarar nueva cuenta). Póliza combinada (cubre varios bienes del mismo dueño).
**No incluye:** la creación de la póliza ni la liquidación del seguro (los hace la compañía aseguradora
externa), el pago real del premio adicional (simulado en dev), validación de cuentas bancarias del exterior
(se acepta cualquier IBAN/CBU declarado), gestión de seguros por admin más allá de los endpoints existentes.

## Modelo de datos
`Insurance`: `policyNumber` PK, `company`, `combinedPolicy` (bool, puede cubrir varios bienes del mismo dueño),
`amount` (cobertura actual, basada en el precio base del bien).

`ProductLocation`: `productId` PK/FK 1:1, `warehouse` (nombre y sector del depósito), `address`, `receivedAt`.

`PayoutAccount`: `id`, `ownerId` FK, `bank`, `countryId?` (puede ser del exterior), `currency` (ARS/USD),
`cbuOrIban`, `accountHolder`, `declaredAt`. **Invariante:** debe declararse ANTES del `startsAt` de la
subasta donde el bien está incluido.

### Póliza combinada
Si `combinedPolicy = true`, la póliza cubre varias piezas del mismo dueño (el campo `Product.insurancePolicy`
apunta a ella en más de un `Product`). El dueño ve el `amount` total de la póliza; el aumento de cobertura
se aplica a toda la póliza.

## Reglas de negocio
- Solo el **dueño del bien** puede ver la póliza y la ubicación (validar que `product.ownerId ===
  req.auth.ownerId` o rol ADMIN).
- El aumento de cobertura: `newAmount` debe ser estrictamente mayor al `amount` actual → si no,
  **400 `VALIDATION_ERROR`** con mensaje descriptivo.
- `premiumDelta` = diferencia del premio a pagar (calculado por la empresa / compañía aseguradora;
  en dev se puede calcular como un porcentaje fijo del delta, ej. 2%).
- `POST /owners/{id}/payout-accounts` con `ownerId` del token (validar que `req.auth.ownerId === id`
  o rol ADMIN). La cuenta queda registrada con `declaredAt = now`.
- Si el dueño intenta declarar una cuenta después de que la subasta del bien ya empezó (`auction.startsAt
  <= now`) → el backend puede permitirlo (la validación del plazo es de negocio, no técnica) pero debe
  advertir que ya no aplica para esa subasta.

## Backend — endpoints

### `GET /insurance/{policyNumber}` — JWT · rol OWNER (propio) / ADMIN
- Validar que algún `Product.insurancePolicy === policyNumber` pertenezca al `ownerId` del token,
  o rol ADMIN.
- **200** → `Insurance` (con `policyNumber`, `company`, `combinedPolicy`, `amount`).
- **404** `RESOURCE_NOT_FOUND` si la póliza no existe.
- **403** si el dueño no tiene ningún bien con esa póliza.

### `POST /insurance/{policyNumber}/coverage-increase` — JWT · rol OWNER (propio)
- Validar que el dueño del token tenga algún bien con esa póliza.
- **Body:** `{ newAmount: number }`.
- Validar `newAmount > insurance.amount` → si no, **400 `VALIDATION_ERROR`** `"newAmount debe ser mayor al monto actual"`.
- En dev: calcular `premiumDelta = (newAmount - amount) * 0.02` (2% de la diferencia). Actualizar
  `insurance.amount = newAmount` y devolver la respuesta (en prod, la compañía aseguradora confirmaría).
- **200** → `{ policyNumber, previousAmount, newAmount, premiumDelta, status: 'confirmed' }`.
  (En producción sería `status: 'pending'` hasta confirmación de la aseguradora.)
- **400** `VALIDATION_ERROR` si `newAmount <= amount`.
- **404** `RESOURCE_NOT_FOUND`.

### `GET /products/{id}/location` — JWT · rol OWNER (propio) / ADMIN
- Validar que `product.ownerId === req.auth.ownerId` o rol ADMIN.
- **200** → `ProductLocation` (`warehouse`, `address`, `receivedAt`).
- **404** si el producto no existe o no tiene `ProductLocation` aún (el bien puede no haber llegado al depósito).

### `GET /owners/{id}/payout-accounts` — JWT · rol OWNER (propio) / ADMIN
- `id` debe coincidir con `req.auth.ownerId` o rol ADMIN.
- **200** → array de `PayoutAccount`.

### `POST /owners/{id}/payout-accounts` — JWT · rol OWNER (propio)
- `ownerId` del token; también validar que `id === req.auth.ownerId`.
- **Body:** `PayoutAccountCreateRequest` (`bank`, `currency`, `cbuOrIban`, `accountHolder`, `countryId?`).
- Todos los campos de la lista son **requeridos** (excepto `countryId`, que es opcional para cuentas locales).
- **201** → `PayoutAccount` con `declaredAt = now`.
- **400** `VALIDATION_ERROR` si faltan campos obligatorios.

> **Alias `/me/...`:** si el equipo lo implementa, `GET /me/payout-accounts` y `POST /me/payout-accounts`
> son equivalentes usando el `ownerId` del token, evitando pasar `{id}` en la ruta. Consistente con el
> patrón del resto de la app (ver [`03-auth-and-roles.md`](../03-auth-and-roles.md)).

## Mobile — pantallas (Figma `Auctify - DA1.fig`)

### 1. Ver seguro y ubicación del bien
- Accesible desde el detalle de una `InclusionRequest` aceptada o desde "mis artículos" (F06).
- **Sección seguro:** `policyNumber`, `company`, `amount` formateado, `combinedPolicy` (si aplica, indicar
  "Póliza combinada — cubre X bienes").
- **Sección ubicación:** `warehouse` (nombre del depósito y sector), `address`, `receivedAt` formateado.
  Si no hay ubicación aún → "El bien aún no fue recibido en el depósito".
- Botón "Aumentar cobertura" → flujo de aumento.

### 2. Aumentar cobertura del seguro
- Input de `newAmount` (number, con hint del `amount` actual).
- Validación local: `newAmount` debe ser mayor al actual (mostrar error inline antes de enviar).
- Mostrar `premiumDelta` estimado (calcular localmente con la misma fórmula del backend, o mostrar tras
  el 200).
- Botón "Confirmar aumento" con estado `loading`.
- Al éxito: toast "Cobertura actualizada a $X. Premio adicional: $Y." y actualizar la pantalla con el
  nuevo `amount`.

### 3. Administrar cuentas de cobro
- Lista de `PayoutAccount`: banco, cuenta, moneda, titular, `declaredAt`.
- Si la lista está vacía → estado **empty** con CTA "Declarar cuenta".
- Botón "Agregar cuenta" → formulario con los campos: banco, CBU/IBAN, titular, moneda, país (opcional).
- Advertencia si no hay cuentas declaradas: "Declarar tu cuenta antes del inicio de la subasta para
  recibir el pago de la venta".
- No hay baja de cuentas de cobro (fuera de alcance en el MVP).

**Estados de todas las pantallas:** loading / empty / error (reintentar) / success.

## Validaciones y errores

| Regla | Endpoint | `ErrorCode` | HTTP |
|-------|----------|-------------|------|
| `newAmount` <= `amount` actual | POST /coverage-increase | `VALIDATION_ERROR` | 400 |
| Póliza no encontrada | GET/POST /insurance | `RESOURCE_NOT_FOUND` | 404 |
| Producto sin ubicación | GET /products/{id}/location | `RESOURCE_NOT_FOUND` | 404 |
| Dueño no tiene el bien de esa póliza | GET/POST /insurance | 403 | 403 |
| Faltan campos en cuenta de cobro | POST /owners/{id}/payout-accounts | `VALIDATION_ERROR` | 400 |
| Cuenta declarada por otro dueño | POST /owners/{id}/payout-accounts | 403 | 403 |

## Criterios de aceptación
- **Dado** un dueño con un bien aceptado con póliza `POL-2026-0001` **cuando** llama `GET /insurance/POL-2026-0001` **entonces** 200 con los datos de la póliza.
- **Dado** `amount: 50000` **cuando** el dueño solicita aumento a `newAmount: 75000` **entonces** 200 con `premiumDelta` > 0 y la póliza actualizada a 75000.
- **Dado** `newAmount = 30000` (menor al actual) **cuando** el dueño intenta el aumento **entonces** 400 `VALIDATION_ERROR`.
- **Dado** que el bien llegó al depósito **cuando** el dueño llama `GET /products/{id}/location` **entonces** 200 con `warehouse` y `receivedAt`.
- **Dado** que el bien aún no llegó al depósito **cuando** el dueño llama `GET /products/{id}/location` **entonces** 404.
- **Dado** que el dueño declara una cuenta de cobro **cuando** llama `POST /owners/{id}/payout-accounts` **entonces** 201 y aparece en `GET /owners/{id}/payout-accounts`.
- **Dado** un dueño B intenta ver el seguro de un bien del dueño A **entonces** 403.
- **Dado** una póliza combinada (`combinedPolicy: true`) **entonces** el campo se refleja en la UI con la nota de "póliza combinada".

## Checklist de TODOs

**Backend**
- [ ] Módulo `insurance`: `GET /insurance/{policyNumber}`, `POST /insurance/{policyNumber}/coverage-increase` con ownership check.
- [ ] Route `GET /products/{id}/location` con ownership check.
- [ ] Módulo `payout-accounts`: `GET /owners/{id}/payout-accounts`, `POST /owners/{id}/payout-accounts`.
- [ ] Validación `newAmount > amount` en coverage-increase.
- [ ] Cálculo de `premiumDelta` (2% del delta en dev).
- [ ] Ownership check para todas las operaciones del dueño.
- [ ] `declaredAt = now` al crear la cuenta de cobro.

**Mobile**
- [ ] Pantalla de seguro + ubicación (desde detalle de solicitud aceptada).
- [ ] Formulario de aumento de cobertura con validación local del `newAmount`.
- [ ] Pantalla de cuentas de cobro con lista y formulario de alta.
- [ ] Advertencia de plazo (declarar antes del inicio de la subasta).
- [ ] Estados loading/empty/error/success en todas las pantallas.

**Tests**
- [ ] Unit: `newAmount` > `amount` requerido; `premiumDelta` calculado correctamente.
- [ ] Unit: ownership check en seguro y ubicación.
- [ ] Integración: dueño ve su póliza → aumenta cobertura → nueva `amount` en `GET /insurance`.
- [ ] Integración: dueño declara cuenta → aparece en listado.
- [ ] Integración: dueño B no puede ver el seguro del dueño A → 403.
