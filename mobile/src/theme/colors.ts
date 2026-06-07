/**
 * Paleta de colores de Auctify.
 *
 * IMPORTANTE: Estos son valores PLACEHOLDER.
 * TODO: sync exact values from Figma Auctify - DA1.fig
 *
 * Criterio de diseño del placeholder:
 * - `brand.primary`: índigo profundo (estética de sala de subastas premium)
 * - `brand.accent`: dorado/ámbar (contraste elegante, asociado al martillo y el valor)
 * - `feedback.*`: colores estándar de feedback (rojo/verde/amarillo/azul) con variantes claras
 */

export const colors = {
  brand: {
    /** Azul índigo profundo — color principal de la marca. */
    primary: '#1E1B4B',
    /** Variante clara del primario — fondos sutiles, chips activos. */
    primaryLight: '#EDE9FE',
    /** Dorado ámbar — acento, precios, valores destacados. */
    accent: '#B45309',
    /** Variante clara del acento. */
    accentLight: '#FEF3C7',
  },

  background: {
    /** Fondo principal de pantallas. */
    primary: '#FAFAFA',
    /** Fondo secundario — cards, inputs, secciones. */
    secondary: '#F3F4F6',
    /** Fondo de cards con sombra. */
    card: '#FFFFFF',
    /** Fondo highlight (notificacion no leida, fila activa). */
    highlight: '#EDE9FE',
  },

  text: {
    /** Texto principal — titulos, labels. */
    primary: '#111827',
    /** Texto secundario — subtitulos, datos de apoyo. */
    secondary: '#6B7280',
    /** Texto terciario — hints, timestamps, captions. */
    tertiary: '#9CA3AF',
    /** Texto sobre fondo oscuro (botones primarios). */
    inverse: '#FFFFFF',
  },

  border: {
    /** Borde default de inputs, cards. */
    default: '#E5E7EB',
    /** Borde activo / focused. */
    active: '#1E1B4B',
    /** Borde de error. */
    error: '#EF4444',
  },

  feedback: {
    error: '#DC2626',
    errorBackground: '#FEF2F2',
    success: '#16A34A',
    successBackground: '#F0FDF4',
    warning: '#D97706',
    warningBackground: '#FFFBEB',
    info: '#2563EB',
    infoBackground: '#EFF6FF',
  },
} as const;
