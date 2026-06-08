# Auctify — Visión general del dominio

> **TPO DAI — 1C2026 · Grupo 03** (Juan Ignacio Molina, Joaquín Villamediana, Valentino Femia)
> App mobile (React Native / Expo) + Backend (Node + Express + TypeScript) para subastas dinámicas ascendentes.

Este documento es el punto de entrada conceptual. Antes de tomar cualquier feature, leelo junto con
[`02-data-model.md`](./02-data-model.md), [`03-auth-and-roles.md`](./03-auth-and-roles.md) y la
[hoja de ruta de features](./features/README.md).

---

## 1. ¿Qué es Auctify?

La empresa realiza subastas **presenciales**. Auctify es la app que permite a los usuarios:

1. **Participar online** como **postores** en esas subastas (ver el catálogo, conectarse en vivo y pujar).
2. **Solicitar la inclusión** de bienes propios en futuras subastas (como **dueños**).

La app **consume e integra** el sistema existente de la empresa (subastas, dueños, postores, ofertas,
rematadores). No reemplaza ese sistema: lo complementa con el canal móvil.

### Modalidad de subasta: dinámica ascendente

- Se parte de un **precio base** (precio de reserva).
- Los postores ven las ofertas de la competencia **en tiempo real** y pueden mejorar la suya mientras
  el ítem esté abierto.
- Gana quien ofrece el **precio mayor** cuando ya nadie puja más alto.
- Una **subasta es un conjunto de ítems que se subastan secuencialmente** (lote por lote, uno a la vez).

---

## 2. Actores (roles)

| Rol | Quién es | Qué hace en la app |
|-----|----------|--------------------|
| **Postor / Cliente** (`CLIENT`) | Persona registrada y admitida | Ve catálogos, se registra en subastas, se conecta en vivo, **puja**, paga, ve métricas y notificaciones |
| **Dueño** (`OWNER`) | Persona que entrega bienes para subastar | **Solicita inclusión** de bienes, declara cuentas de cobro, ve estado/ubicación/seguro de sus ítems |
| **Empresa / Admin** (`ADMIN`) | Operador interno de la empresa | Admite clientes y asigna categoría, verifica medios de pago, crea subastas/catálogos/ítems, inspecciona inclusiones, gestiona seguros |
| **Sistema** (`SYSTEM`) | Procesos automáticos del backend | Registra ventas al cerrar un ítem, genera multas, emite notificaciones, transiciona estados de subasta |

> Un mismo humano puede ser **a la vez** postor y dueño. Ver [`03-auth-and-roles.md`](./03-auth-and-roles.md).

Fuera de alcance (lo provee un tercero, no se desarrolla): el **servicio de streaming** de la subasta y
la **compañía de seguros**. La app solo expone URLs / datos de esos servicios.

---

## 3. Glosario

| Término | Definición |
|---------|------------|
| **Subasta / Remate** | Competencia de ofertas por un conjunto de ítems que se rematan secuencialmente. Tiene día, hora, categoría, moneda, rematador y catálogo. |
| **Catálogo** | Lista de ítems de una subasta. Es **público**, pero el **precio base** solo lo ven los usuarios **registrados** (de cualquier categoría). |
| **Ítem / Lote / Pieza** | Unidad que se subasta. Puede estar compuesta por varios elementos (ej.: juego de té de 18 piezas). Tiene número de pieza, descripción, precio base, dueño y ~6 fotos. |
| **Producto** | El bien físico (con fotos, seguro, ubicación, dueño). Un ítem de catálogo referencia un producto. |
| **Precio base** | Valor inicial de reserva del ítem. |
| **Puja** | Una oferta de dinero sobre el ítem activo. Cada oferta de un postor es una puja. |
| **Postor** | Persona que participa ofreciendo dinero para comprar el ítem. |
| **Categoría** | Nivel del cliente (`common`, `special`, `silver`, `gold`, `platinum`). Determina a qué subastas puede acceder. |
| **Rematador / Martillero** | Quien conduce la subasta presencial. |
| **Asistente (Attendee)** | Cliente registrado en una subasta puntual; recibe un **número de postor** (`bidderNumber`) secuencial. |
| **Sesión** | Conexión en vivo de un cliente a una subasta. Un cliente **no puede** estar conectado a más de una subasta a la vez. |
| **Comisión** | Lo que cobra la empresa por la venta de un ítem. |
| **Solicitud de inclusión** | Pedido de un dueño para que la empresa subaste un bien suyo. |
| **Colección** | Subasta compuesta solo por bienes de un mismo dueño (cuando son muchos). |
| **Multa (Penalty)** | 10% del valor ofertado, generada si el ganador no paga. Bloquea al cliente hasta abonarla. |

---

## 4. Reglas de negocio clave (resumen)

Estas reglas son la "fuente de verdad" del comportamiento. Cada feature detalla las que le aplican.

### Registro y admisión (2 etapas)
1. **Etapa 1:** el postor carga datos personales (**DNI/documento**, nombre, apellido, domicilio, país)
   y **fotos del documento (frente y dorso)**. Queda `admitted = false`.
2. La empresa lo **verifica externamente** y, si lo acepta, le asigna una **categoría**.
3. **Etapa 2:** se le envía un mail con un **token**; el usuario ingresa y **genera su contraseña**.
4. Luego debe registrar **al menos un medio de pago** para poder pujar.

### Medios de pago
- Tipos: **cuenta bancaria** (incluso extranjera), **tarjeta de crédito** (nacional/extranjera) o
  **cheque certificado** por un monto determinado.
- Deben estar **verificados por la empresa ANTES** de la subasta.
- Para **pujar** se requiere **al menos un medio de pago verificado**. Sin eso, solo se puede **ver**.
- **Cheque certificado:** la suma de compras del cliente **no puede superar** el monto del cheque.

### Acceso a una subasta
- El cliente debe estar **registrado y admitido**.
- La **categoría de la subasta** debe ser **≤** la categoría del cliente.
- Solo un medio de pago verificado habilita a pujar.

### Reglas de puja (sobre el ítem activo)
- La puja debe ser **≥ mejor oferta actual + 1% del precio base**.
- La puja debe ser **≤ última oferta + 20% del precio base**.
- Ejemplo: base `10.000`, última oferta `15.000` → mínimo `15.100`, máximo `17.000`.
- **Estos límites NO aplican** a subastas de categoría **`gold` y `platinum`**.
- **Confirmación obligatoria:** tras pujar, la app **no permite otra puja del mismo asistente** hasta
  recibir la **confirmación** del sistema de que la transacción se registró e informó al resto.

### Cierre de ítem y venta
- Cuando nadie supera la última puja, ese postor pasa a ser **dueño** del ítem.
- Se registra la venta (medio de pago, importe, comisiones, costo de envío) y el ítem se marca **vendido**.
- Se le informa por **mensaje privado** el importe a pagar (pujado + comisiones + envío).
- El comprador puede **retirar en persona**, pero **pierde la cobertura del seguro**.
- Si **nadie puja** por un ítem, la **empresa lo compra al precio base** al finalizar.

### Incumplimiento de pago
- Si el ganador no tiene los fondos: **multa = 10% del valor ofertado**, debe abonarla **antes** de
  participar en otra subasta, y presentar los fondos **dentro de 72 hs**.
- Si no cumple, el caso pasa a la **justicia** (fuera de alcance) y el cliente queda **bloqueado**.

### Subastas en paralelo y monedas
- La empresa puede correr **varias subastas a la vez**; un cliente **solo se conecta a una** por vez.
- Cada subasta es en **ARS o USD** (no bimonetaria). Las de USD se cancelan en USD.

### Inclusión de bienes (dueños)
1. El dueño carga datos del bien, **≥ 6 fotos** y declara **propiedad** y **origen lícito**.
2. La empresa puede pedir el bien para **inspección** (envío a la dirección indicada).
3. Si **rechaza**, devuelve el bien **con cargo** al dueño (visible el motivo en la app).
4. Si **acepta**, lo incluye en una futura subasta e informa fecha, lugar, **precio base** y **comisiones**.
5. El dueño puede **no aceptar** el precio base/comisiones → devolución con cargo.
6. Si hay muchos bienes de un mismo dueño → **colección** con su nombre.

### Cobros, seguro y ubicación
- El dinero de las ventas se acredita en una **cuenta a la vista** del dueño (puede ser del exterior),
  **declarada antes** del inicio de la subasta.
- Cada bien recibido se **asegura** según su precio base. Una póliza puede cubrir **varias piezas del
  mismo dueño**.
- El dueño puede ver **ubicación (depósito)** y **póliza** de su bien, y **aumentar la cobertura**
  pagando la diferencia del premio.

### Métricas
- Cada usuario ve su participación: subastas asistidas, veces que ganó, historial de pujas, importes
  ofertados/pagados, desglose por categoría, etc.

---

## 5. Alcance del MVP

El MVP prioriza el **circuito completo del postor** + carga de bienes:

1. **Login / Registro** (2 etapas + activación) → [`F01`](./features/F01-auth.md)
2. **Pujar** (conectarse en vivo + ofertar con validación y confirmación) → [`F05`](./features/F05-bidding.md)
3. **Subir ítem** (solicitud de inclusión de un bien) → [`F06`](./features/F06-inclusion-requests.md)
4. **Métricas** → [`F08`](./features/F08-metrics.md)
5. **Notificaciones** → [`F09`](./features/F09-notifications.md)

> Pujar depende de features **habilitadoras** (medios de pago, subastas/catálogo, sesión en vivo).
> El orden completo y las dependencias están en la [hoja de ruta](./features/README.md).

---

## 6. Tiempo real

El estado en vivo de la subasta se resuelve con **polling** (`GET /auctions/{id}/live-status` cada 2–3 s).
La decisión, sus límites y cómo se evita mostrar información vieja / manejar pujas casi simultáneas están
documentados en [`decisions/ADR-002-realtime-polling.md`](./decisions/ADR-002-realtime-polling.md)
(responde a la corrección de la Entrega 1).

---

## 7. Entregas (consigna)

- **Entrega 1 (hecha):** maquetado + wireframes alta fidelidad + paleta + Figma + ícono/splash + OpenAPI.
- **Entrega 2:** backend + frontend al **50%**, front conectado al back con **al menos un circuito
  completo integrado**, y **descripción del manejo de errores** ([`04-error-handling.md`](./04-error-handling.md)).
- **Entrega 3:** app **completamente funcional**, backend **accesible online**, frontend **instalable** en un dispositivo.

> **Trazabilidad del diseño:** lo entregado debe coincidir con lo definido en el diseño (Figma
> `Auctify - DA1.fig`). No se aprueban trabajos cuyo funcionamiento difiera del diseñado.
