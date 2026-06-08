import { View, Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { EmptyState } from '@/components/EmptyState';
import { colors, typography, spacing } from '@/theme';

/**
 * Mis articulos — estado de solicitudes de inclusion (F06).
 * TODO → docs/features/F06-inclusion-requests.md
 *
 * Esta pantalla mostrara:
 * - Lista de solicitudes de inclusion del dueno (GET /inclusion-requests?ownerId=me)
 * - Estado de cada solicitud (pending / under_inspection / accepted / rejected / proposal_sent)
 * - CTA para nueva solicitud de inclusion
 * - Detalle de propuesta y aceptacion/rechazo del dueno
 */
export default function ItemsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis artículos</Text>
      </View>

      <EmptyState
        title="Aún no tenés artículos"
        message="Acá vas a ver el estado de tus solicitudes de inclusión de bienes en subastas."
        actionLabel="Solicitar inclusión"
        onAction={() => {
          // TODO → F06: navegar a pantalla de nueva solicitud de inclusion
        }}
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
