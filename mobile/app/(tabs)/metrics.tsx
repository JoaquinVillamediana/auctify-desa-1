import { View, Text, StyleSheet } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { colors, typography, spacing } from '@/theme';

/**
 * Metricas del postor (F08).
 * TODO → docs/features/F08-metrics.md
 *
 * Esta pantalla mostrara:
 * - Subastas asistidas y ganadas
 * - Total ofertado / pagado
 * - Historial de pujas
 * - Desglose por categoria de subasta
 * Endpoint: GET /me/metrics
 */
export default function MetricsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis métricas</Text>
      </View>

      <EmptyState
        title="Métricas próximamente"
        message="Acá verás tu historial de participación, pujas y ganancias en subastas."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.text.primary,
  },
});
