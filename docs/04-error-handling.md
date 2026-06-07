# Manejo de errores

> Documento exigido por la **Entrega 2** ("descripción del manejo de errores: campos obligatorios,
> opcionales, alertas, conexión a internet, etc."). Aplica a **backend** (contrato) y **mobile** (UX).

---

## 1. Envelope de error (backend)

Todo error de negocio devuelve el mismo schema `Error`:

```json
{
  "code": "BID_OUT_OF_RANGE",
  "message": "El importe debe estar entre 15.100 y 17.000",
  "details": { "minAllowed": 15100, "maxAllowed": 17000 }
}
```

- `code`: del enum `ErrorCode` (estable, lo consume el front para decidir el mensaje/acción).
- `message`: texto legible (puede mostrarse al usuario).
- `details`: objeto opcional con contexto (ej. rangos, campos inválidos).

### Catálogo de `ErrorCode`

| code | HTTP | Cuándo | Acción sugerida en mobile |
|------|------|--------|---------------------------|
| `VALIDATION_ERROR` | 400 | Campos obligatorios/ inválidos | Resaltar campos (`details.fields`) |
| `RESOURCE_NOT_FOUND` | 404 | ID inexistente | Pantalla "no encontrado" / volver |
| `DUPLICATE_ENTRY` | 409 | DNI/email ya registrado, etc. | Mensaje inline en el campo |
| `INVALID_TOKEN` | 400 | Token de activación inválido/expirado | Reenviar / volver a login |
| `ACCOUNT_ALREADY_ACTIVATED` | 409 | Activar cuenta ya activa | Ir a login |
| `NOT_ADMITTED` | 403 | Cliente sin admitir | Pantalla "pendiente de verificación" |
| `CATEGORY_INSUFFICIENT` | 403 | Categoría < categoría de subasta | Mensaje + ocultar acción de pujar |
| `NO_VERIFIED_PAYMENT_METHOD` | 403 | Sin medio de pago verificado | CTA "agregar medio de pago" |
| `PAYMENT_METHOD_NOT_OWNED` | 403 | El medio no es del postor | Re-elegir medio |
| `CHECK_LIMIT_EXCEEDED` | 403 | Compras > monto del cheque | Mensaje + elegir otro medio |
| `CLIENT_BLOCKED` | 403 | Cliente bloqueado por multa/justicia | Pantalla "cuenta bloqueada" + multas |
| `NOT_CONNECTED` | 403 | Pujar/ver live sin sesión activa | Reconectar a la subasta |
| `ALREADY_CONNECTED` | 409 | Ya hay sesión activa (otra subasta) | Ofrecer desconectar la otra |
| `BID_OUT_OF_RANGE` | 422 | Fuera de [min, max] | Mostrar rango (`details`) y reintentar |
| `BID_SUPERSEDED` | 409 | El ítem cambió por otra puja | Refrescar live-status y reintentar |
| `MISSING_PHOTOS` | 400 | Inclusión con < 6 fotos | Bloquear envío hasta 6 fotos |
| `DECLARATION_REQUIRED` | 400 | Falta declarar propiedad/legalidad | Marcar checkboxes obligatorios |
| `INSUFFICIENT_FUNDS` | 422 | Pago de compra sin fondos → genera multa | Mostrar multa generada + 72hs |

> Códigos HTTP siguiendo IANA. 401 = no autenticado; 403 = autenticado sin permiso; 422 = válido
> sintácticamente pero viola regla de negocio (puja fuera de rango, fondos insuficientes).

---

## 2. Validación de entrada (backend)

- Validar **en el borde** con esquemas (recomendado **zod**). Nunca confiar en el cliente.
- 400 `VALIDATION_ERROR` con `details.fields = { campo: "motivo" }`.
- Reglas de obligatoriedad por endpoint: ver cada feature (sección "Validaciones").
- Las reglas de **negocio** (rango de puja, categoría, fondos) se validan en el **service**, no solo en el form.

---

## 3. Manejo de errores en mobile (UX)

### Campos del formulario
- **Obligatorios:** marcados con `*`; validación local antes de enviar (no esperar al 400).
- **Opcionales:** claramente indicados; no bloquean el submit.
- Error del backend (`VALIDATION_ERROR.details.fields`) → resaltar el campo correspondiente.

### Alertas / feedback
- Éxito → toast/snackbar breve.
- Error de negocio (`Error.code` conocido) → mensaje específico (tabla de arriba) inline o en banner.
- Error inesperado (5xx / code desconocido) → mensaje genérico "Algo salió mal, reintentá" + log.

### Conexión a internet
- Detectar offline (`@react-native-community/netinfo`) → banner "Sin conexión" y deshabilitar acciones de red.
- **Timeouts** en todas las llamadas (cliente API). Mostrar "Reintentar".
- **Polling de live-status:** si una request falla, **no** romper la pantalla; reintentar en el próximo
  tick y mostrar un indicador sutil de "reconectando".

### Estados de carga
- Toda pantalla con datos remotos maneja **loading / empty / error / success**.
- Acciones (pujar, pagar, enviar inclusión) → botón con estado `loading` y **deshabilitado** mientras se
  espera confirmación (clave para la regla de "una puja a la vez").

---

## 4. Concurrencia en pujas (resumen)

- El front envía header **`Idempotency-Key`** en cada puja y **bloquea** el botón hasta la confirmación.
- `409 BID_SUPERSEDED` → refrescar `live-status` y rearmar el rango antes de reintentar.
- `422 BID_OUT_OF_RANGE` → mostrar `details.minAllowed`/`maxAllowed`.
- Detalle completo en [`F05-bidding.md`](./features/F05-bidding.md) y
  [`ADR-002`](./decisions/ADR-002-realtime-polling.md).
