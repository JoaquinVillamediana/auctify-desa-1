import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

interface ScreenContainerProps {
  children: ReactNode;
  /** Envuelve en ScrollView (default true). `scrollable` es alias de `scroll`. */
  scroll?: boolean;
  scrollable?: boolean;
  /** Centra el contenido verticalmente (pantallas simples tipo onboarding). */
  centered?: boolean;
}

/**
 * Contenedor base de pantalla: respeta el safe-area, aplica padding y fondo.
 */
export function ScreenContainer({ children, scroll, scrollable, centered = false }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.lg,
    paddingHorizontal: spacing.md,
  };

  // Por defecto scrollable, salvo que sea una pantalla centrada.
  const useScroll = (scrollable ?? scroll ?? true) && !centered;

  if (useScroll) {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, padding]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.flex, styles.content, centered && styles.centered, padding]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background.primary },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
});
