/**
 * Escala de espaciado (múltiplos de 4). Usar siempre estos tokens en vez de números mágicos.
 * TODO: sync con el grid del Figma `Auctify - DA1.fig`.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
