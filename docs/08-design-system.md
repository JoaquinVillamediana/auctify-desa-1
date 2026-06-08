# Sistema de diseño (Figma → código)

> **Trazabilidad de diseño** (exigida por la cátedra). Tokens **extraídos del Figma**
> [`Auctify - DA1`](https://www.figma.com/design/jAhnt4cbFjnNdgULvkhfzU/Auctify---DA1) y volcados a
> `mobile/src/theme/*`. Fuente: pantalla **High-Fidelity: Home** (node `35:1431`).

## Identidad

Azul profundo de marca + **acento marrón cálido** (martillo / madera de remate) sobre neutros *slate*,
con verde "en vivo / termina pronto" y rojo "VIVO". Tipografía **Manrope** (títulos) + **Inter** (UI).

## Tokens

### Colores → `mobile/src/theme/colors.ts`
| Token | Hex | Uso en el diseño |
|-------|-----|------------------|
| `brand.primary` | `#1E3A8A` | Headings, precios, logo "AUCTIFY", CTA secundario ("OFERTAR") |
| `brand.primaryStrong` | `#1D4ED8` | Nav activo, links |
| `brand.primaryAccent` | `#0058BE` | Tarjeta de stat secundaria |
| `brand.primaryLight` | `#DBEAFE` | Chips, fondos sutiles, fila activa |
| `brand.accent` | `#6E2D00` | Acento marrón (urgencia, "tiempo restante") |
| `brand.accentStrong` | `#4B1C00` | Fondo del CTA destacado "PUJAR" |
| `background.primary` | `#F8F9FA` | Fondo de pantalla |
| `background.card` | `#FFFFFF` | Cards |
| `background.secondary` | `#F1F5F9` | Secciones / divisores |
| `text.primary` | `#0F172A` | Texto oscuro / inputs |
| `text.secondary` | `#64748B` | Descripciones |
| `text.tertiary` | `#94A3B8` | Micro-labels, hints |
| `border.default` | `#F1F5F9` | Bordes de cards/inputs |
| `feedback.success` | `#10B981` | "Termina pronto / verificado" |
| `feedback.live` | `#EF4444` | Badge "VIVO" |

### Tipografía → `mobile/src/theme/typography.ts`
- **Familias:** `Manrope` (ExtraBold/Bold) para títulos · `Inter` (Regular/Medium/SemiBold/Bold) para
  cuerpo y UI · monoespaciada para timers (`04:12:09`). Cargadas en `app/_layout.tsx` con
  `@expo-google-fonts/inter` y `@expo-google-fonts/manrope`.
- **Escala:** `display` 34 · `heading1` 30 · `heading2` 24 · `heading3` 19 · `body` 16 · `bodySmall` 14
  · `label` 14 · `overline` 11 (mayúscula + tracking) · `caption` 12.
- **Legibilidad (corrección E1):** el cuerpo nunca baja de 16; los 10–11px se reservan solo para
  micro-labels en mayúscula con tracking (como en el diseño).

### Spacing y radios → `mobile/src/theme/spacing.ts`
- **spacing:** 4 / 8 / 16 / 24 / 32 / 40 (`xs…xxl`).
- **radius:** 12 / 16 / 24 / 32 / 40 + `pill` (9999).

## Mapa de pantallas (Figma node IDs)

Para extraer una pantalla puntual con el MCP de Figma (`get_design_context`/`get_screenshot`):

| Pantalla | node ID | Estado | Feature |
|----------|---------|--------|---------|
| Splash | `35:1183` | — | F00 |
| Login | `35:1211` | wireframe | F01 |
| **Home (hi-fi)** | `35:1431` | alta fidelidad | F03/F08 |
| **Payment Methods (hi-fi)** | `35:872` | alta fidelidad | F02 |
| **Bidding: Success (hi-fi)** | `35:1367` | alta fidelidad | F05/F07 |
| Profile | `37:30` | wireframe | F01 |

Navegación: bottom tab bar con **Home · Subastas · Mis pujas · Perfil**.

## ⚠️ Acceso al Figma (importante)

- El archivo vive en el **org de MercadoLibre** en Figma; se accede con la cuenta de trabajo
  (`juan.molina@mercadolibre.com`), **no** con la personal.
- Esa cuenta tiene seat **View** → el MCP de Figma permite **~6 lecturas por mes**. Usar con criterio:
  preferir `get_metadata` (estructura) y **una** `get_design_context` por pantalla, y cachear/anotar acá
  lo extraído en vez de re-consultar.

## Pendiente

- Las pantallas de dominio del mobile siguen siendo **scaffolds**; al desarrollar cada feature, alinear
  el layout a su pantalla de Figma (node IDs arriba) usando estos tokens. Ícono/splash: exportar desde el
  frame `Splash Screen` (`35:1183`) a `mobile/assets/`.
