import type { TextStyle } from 'react-native';

/**
 * Escala tipográfica de Auctify.
 *
 * TODO: sync exact values from Figma `Auctify - DA1.fig`.
 *
 * Criterio (corrección Entrega 1 — "cuidado con la letra muy chica"):
 * tamaños CÓMODOS y legibles. El cuerpo es 16; nada baja de 13.
 */
export const typography = {
  heading1: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
  heading2: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  heading3: { fontSize: 19, fontWeight: '700', lineHeight: 25 },
  /** Texto base — mínimo legible recomendado. */
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  /** Mínimo absoluto del sistema: nunca por debajo de 13. */
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 17 },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
