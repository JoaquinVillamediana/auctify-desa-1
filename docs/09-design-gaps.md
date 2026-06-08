# 09 — Gaps de diseño (objetivo: pixel-perfect)

> **Fuente de verdad:** capturas Figma ↔ app (decisión del equipo: *solo fotos*, sin
> llamadas a Figma MCP). Los tokens base (paleta, tipografías Manrope/Inter, spacing
> 4/8/16/24/32/40, radios) ya están extraídos del Figma en `mobile/src/theme/` — gran
> parte del trabajo es **aplicar esos tokens de forma consistente**.

## Leyenda

| Marca | Significado | Cómo se trata |
|-------|-------------|---------------|
| 🎨 | **Pixel / estilo** — solo aspecto. No toca lógica, datos ni navegación. | Se ejecuta directo. |
| 🏗️ | **Estructural** — cambia arquitectura de info, navegación o modelo de datos. | Requiere decisión (ver abajo). |
| 🐛 | **Bug** — además de estético, hay algo roto. | Se arregla junto al estilo. |

---

## Decisiones estructurales — ✅ RESUELTAS

### D1 — Tab bar → ✅ **4 tabs como Figma**
- **Tabs:** `Home` · `Subastas` · `Mis pujas` · `Perfil`.
- `Notificaciones` → **campana** del navbar superior.
- `Métricas` → **stat cards** en Home + **stat pills** en Perfil.
- `Compras` y `Mis artículos` → **drawer** de la hamburguesa.

### D2 — Modelo de Home → ✅ **Feed de ítems en vivo**
- Home = **feed de lotes en vivo** (imagen + timer + puja actual + `PUJAR`/`OFERTAR` inline).
- La lista de **subastas (eventos)** se mueve al tab `Subastas`.
- Requiere que el back exponga ítems en vivo con puja actual (endpoints de items ya existen — verificar agregación).

### D3 — Identidad de login → ✅ **Email**
- Login por **email** (no DNI). Cambios: `POST /auth/login` (back) + validación + `email @unique` en `Client` + seed.
- Registro sigue pidiendo DNI (documento real), pero la autenticación es por email.
- Credenciales nuevas: `admin@auctify.dev` / `juan.postor@ejemplo.com`.

### D4 — Navbar superior + hamburguesa (drawer) → ✅ **Sí (consecuencia de D1)**
- App bar global: hamburguesa (izq, abre drawer) + wordmark `AUCTIFY` (centro) + campana (der, notificaciones).
- El drawer aloja `Compras`, `Mis artículos` y demás destinos fuera de los 4 tabs.

---

## Gaps por pantalla

### 0. Splash — ✅ HECHO · `src/components/SplashScreen.tsx`
> Degradé azul (`expo-linear-gradient`) + tile translúcido con gema (Ionicons `diamond`) +
> wordmark + subtítulo. Cableado en `app/_layout.tsx` (carga de fuentes) y `app/index.tsx` (hidratación).
**Figma:** fondo azul con degradé (de `#1E3A8A` a un azul más oscuro), centrado: tile redondeado translúcido con **logo gema/diamante** blanco, wordmark **AUCTIFY** (Manrope ExtraBold, blanco), subtítulo `GALERÍA DE ALTA VELOCIDAD` (overline, azul claro).
**Actual:** no hay splash (se removió el asset de `app.json` porque dejaba Expo Go en blanco).

Tareas:
- [ ] 🎨 Componente `SplashScreen` renderizado por código (View con degradé via `expo-linear-gradient` o capas, sin asset) mostrado mientras hidrata fuentes/auth en `app/index.tsx`.
- [ ] 🎨 Tile redondeado (`radius.lg`, fondo translúcido `rgba(255,255,255,0.12)`) + glifo gema (SVG simple o `@expo/vector-icons` `diamond`).
- [ ] 🎨 Wordmark `AUCTIFY` (Manrope ExtraBold, blanco) + subtítulo overline azul claro.
- [ ] 🐛 Verificar que no quede en blanco en Expo Go (sin assets externos).

---

### 1. Login — `app/(auth)/login.tsx` · ✅ HECHO
> Implementado: login por **email** (back+mobile, sin migración), card con `Bienvenido` + ayuda,
> labels overline, inputs `filled` con iconos mail/ojo, botón `INGRESAR →`, footer `Crear cuenta`,
> activación como link secundario. `Field` y `Button` extendidos. Verificado: tsc back+mobile, curl 200/401/400.
**Figma:** wordmark `AUCTIFY` arriba (azul) → **card blanca redondeada con sombra** que contiene: `Bienvenido` (heading) + texto de ayuda + label `EMAIL` con icono de sobre + label `CONTRASEÑA` con link `¿Olvidó contraseña?` e input con icono de ojo + botón **`INGRESAR →`** (azul, full-width) → fuera de la card, centrado: `¿Todavía no tenes cuenta? **Crear cuenta**`.
**Actual:** todo plano sin card; `Auctify` + `Iniciá sesión para pujar`; campos `DNI / Documento *` y `Contraseña *` (con asterisco); botón `Ingresar`; links subrayados `Registrate` y `Tengo un token de activación`.

Tareas:
- [ ] 🎨 Envolver el formulario en una **card** (`background.card`, `radius.lg`, sombra suave, padding `lg`).
- [ ] 🎨 Wordmark `AUCTIFY` separado arriba de la card.
- [ ] 🎨 Agregar heading `Bienvenido` + texto de ayuda (`text.secondary`).
- [ ] 🎨 Labels en estilo **overline** (`EMAIL`, `CONTRASEÑA`) en vez de label normal con `*`.
- [ ] 🎨 Extender `Field` para soportar **icono trailing** (sobre / ojo toggle de visibilidad).
- [ ] 🎨 Botón `INGRESAR →` (uppercase + icono flecha). Extender `Button` para icono trailing.
- [ ] 🎨 Footer `¿Todavía no tenes cuenta? Crear cuenta` (link no subrayado, `Crear cuenta` en `brand.primary`).
- [ ] 🏗️ **D3**: definir DNI vs email. Si DNI → relabel visual; si email → cambio de back + validación.
- [ ] 🎨 `¿Olvidó contraseña?` no tiene endpoint → mostrar visual pero deshabilitado, o decidir omitir.
- [ ] 🎨 Conservar acceso a `activación` (flujo real F01) en un lugar secundario (el Figma no lo muestra).

---

### 2. Perfil — `app/(tabs)/profile.tsx` · ✅ HECHO
> AppBar + avatar grande con badge de edición + nombre + chip de categoría + **3 stat pills**
> (Victorias=won, Activas=attended, Ofertas=bidCount, de `/me/metrics`) + filas de menú con
> icono+subtítulo+chevron (Métodos de pago / Compras / Mis multas) + botón **SALIR punteado**.
> Decisión: `Configuración`/`Historial` del mock → mapeados a flujos reales existentes.
**Figma:** navbar (hamburguesa + AUCTIFY + icono) → avatar circular grande (**foto** + badge de edición azul) → nombre `Juan Carlos` → **3 stat pills** (`24 VICTORIAS` · `12 ACTIVAS` · `89 OFERTAS`) → filas de menú con **icono + título + subtítulo + chevron** (`Configuración`, `Métodos de pago`, `Historial`) → botón **`↩ SALIR`** con borde punteado.
**Actual:** avatar con inicial `U` + `DNI` + `email`; filas de datos `Categoría/Estado/Medio verificado`; menú `Medios de pago`/`Mis multas` (sin icono ni subtítulo); botón `Cerrar sesión` (outline); banner warning.

Tareas:
- [ ] 🎨 Avatar más grande, centrado, con badge de edición (la **foto** real requiere feature de upload → fuera de alcance; mantener inicial estilizada).
- [ ] 🎨 Mostrar **nombre** prominente (quitar DNI/email del header, o moverlos a "Configuración").
- [ ] 🏗️ **Stat pills** Victorias/Activas/Ofertas → vienen de métricas (**D1/D2**: dónde viven las métricas).
- [ ] 🎨 Filas de menú con **icono + subtítulo + chevron** (no solo título).
- [ ] 🏗️ IA del menú: Figma = `Configuración`/`Métodos de pago`/`Historial`. Actual = `Medios de pago`/`Mis multas`. `Configuración` e `Historial` no existen; `Mis multas` no está en el mock. Definir mapa (**D1**).
- [ ] 🎨 Botón logout `SALIR` con **borde punteado** + icono.
- [ ] 🎨 Decidir qué pasa con `Categoría/Estado/Medio verificado` y el **warning de medio de pago** (útiles funcionalmente; el mock no los muestra → moverlos a "Configuración" o conservarlos como sección).

---

### 3. Home — `app/(tabs)/index.tsx` (+ `app/(tabs)/_layout.tsx`) · ✅ HECHO
> AppBar + 2 **stat cards** (participaciones/ganadas) + sección "Subastas en vivo" + cards de lote
> (imagen real, badge VIVO + categoría, precio base, CTA **PUJAR** marrón → remate en vivo).
> **Desviación honesta:** el modelo no tiene timer por ítem (la subasta abre 1 ítem por vez), así que
> **no se muestra countdown**; el CTA navega al remate `/auction/[id]` donde se puja de verdad. Las
> imágenes usan las URLs del seed (picsum) con placeholder de fallback.
**Figma:** navbar (hamburguesa + AUCTIFY + **campana**) → **2 stat cards** (`TOTAL PARTICIPACIONES 24`, `SUBASTAS GANADAS 08`) → sección `Subastas En Vivo` + `Ver todo` → **cards de ítem** grandes: imagen real, tag `PREMIUM`, badge `● VIVO`, título, descripción, timer `FINALIZA EN 04:12:09`, `PUJA ACTUAL $12,450` + botón **`PUJAR`** (marrón acento) / segundo card con badge verde `TERMINA PRONTO`, `OFERTA ACTUAL` + `OFERTAR` (azul) → sección `Siguientes subastas`.
**Actual:** header `Auctify / subastas · mobile` → chips `Todas/En curso/Próximas/Cerradas` → **cards de subasta (evento)**: placeholder de texto `live`/`img`, pills de estado/moneda/categoría, ubicación, fecha. Sin imágenes, sin timer, sin puja, sin CTA, sin stats.

Tareas:
- [ ] 🏗️ **D2**: Home como **feed de ítems en vivo** (imagen + timer + puja actual + `PUJAR`) vs lista de eventos. Es el gap más grande.
- [ ] 🏗️ **Stat cards** arriba (Total participaciones / Subastas ganadas) — de métricas (**D1/D2**).
- [ ] 🏗️ **Navbar** con campana (notificaciones) + hamburguesa (**D1/D4**).
- [ ] 🐛 **Imágenes no se renderizan**: las cards muestran texto `live`/`img`, no hay `<Image>`. Los `Product.photos` (URLs picsum del seed) no se están usando. *Riesgo:* picsum puede estar bloqueado por la red corporativa → quizá necesitemos imágenes empaquetadas.
- [ ] 🎨 Card de ítem destacada: imagen full-width, `radius.xxl` (40), tag PREMIUM, badge VIVO, timer mono, bloque de puja + CTA.
- [ ] 🎨 CTA `PUJAR` en **marrón acento** (`brand.accent`/`accentStrong`); `OFERTAR` en azul.
- [ ] 🎨 Badge verde `TERMINA PRONTO` (`feedback.success`).
- [ ] 🎨 Los chips de filtro (`Todas/En curso/...`) no están en el Home del Figma → moverlos al tab `Subastas`.

---

### Tab bar / navegación — `app/(tabs)/_layout.tsx` · ✅ HECHO
> 4 tabs con iconos vectoriales (Ionicons): Home · Subastas · Mis pujas · Perfil. AppBar global
> (`src/components/AppBar.tsx`: hamburguesa + wordmark + campana→notificaciones) + drawer
> (`src/components/AppDrawer.tsx`) con Compras/Mis artículos/Métricas/Notificaciones/Medios de pago/Multas.
> Back: `bidCount` agregado a `/me/metrics` + nuevo `GET /me/bids` para el tab "Mis pujas".
> Tab bar **custom** (`AuctifyTabBar` en `_layout.tsx`) por clipping de labels en react-native-web.
> **AppBar unificado** con modo subpantalla (← atrás + título + acción) aplicado a las 6 vistas
> de campana/drawer (notificaciones, compras, mis artículos, métricas, medios de pago, multas);
> `ScreenContainer` ganó slot `header`. **Top bar unificado en TODA la app** (20 pantallas): los 4 tabs
> (modo raíz), y todas las secundarias/detalle en modo subpantalla (← + título). Incluye subasta en vivo
> (`onBack`=desconectar sesión), flujo de puja, y flujo de dueño/inclusión (`items/new`, `items/[id]/*`,
> `insurance`, `payout-accounts`). Único excluido a propósito: el **flujo de auth** (login/registro/activación/
> pendiente) que tiene su propio diseño pre-login. Verificado por grep: no queda ningún header ad-hoc.
- [ ] 🏗️ **D1**: 4 tabs (Figma) vs 6 (actual).
- [ ] 🎨 Reemplazar **emojis** por iconos vectoriales reales (`@expo/vector-icons`, incluido en Expo, offline-friendly).
- [ ] 🎨 Estilo de tab bar (alturas, activo en `brand.primary`, label overline) según Figma.

---

## Pendiente de fotos
_(se completa a medida que llegan las capturas)_

- Registro · Activación · Pendiente de admisión
- Subasta en vivo · Detalle de subasta · Catálogo de subasta
- Detalle de ítem · Nuevo ítem · Gestión/Declarar/Fotos de ítem
- Detalle de compra · Medios de pago · Cuentas de cobro · Multas · Seguro/Póliza
- (las que falten)
