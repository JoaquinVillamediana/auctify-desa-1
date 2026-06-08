import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { colors, typography, spacing } from '@/theme';

const CATEGORY_LABELS: Record<string, string> = {
  common: 'Común',
  special: 'Especial',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

/**
 * Perfil del cliente (F01 / F02).
 * Muestra los datos del usuario del AuthContext (hidratados desde GET /auth/me).
 * Acciones: logout, agregar medio de pago (TODO→F02).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  if (loading) return <Loading />;

  if (!user) {
    // No deberia ocurrir: el layout raiz redirige si no hay sesion
    return null;
  }

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {user.name?.charAt(0).toUpperCase() ?? 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.document}>DNI: {user.document}</Text>
        {user.email ? <Text style={styles.email}>{user.email}</Text> : null}
      </View>

      {/* Categoria y estado */}
      <View style={styles.infoSection}>
        <InfoRow label="Categoría" value={user.category ? CATEGORY_LABELS[user.category] ?? user.category : '—'} />
        <InfoRow label="Estado" value={user.admitted ? 'Admitido' : 'Pendiente de admisión'} />
        <InfoRow
          label="Medio de pago verificado"
          value={user.hasVerifiedPaymentMethod ? 'Sí' : 'No'}
          valueColor={user.hasVerifiedPaymentMethod ? colors.feedback.success : colors.feedback.error}
        />
        {user.blocked && (
          <InfoRow label="Cuenta" value="Bloqueada" valueColor={colors.feedback.error} />
        )}
      </View>

      {/* Acciones */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/payment-methods')}
        >
          <Text style={styles.actionLabel}>Medios de pago</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => router.push('/penalties')}
        >
          <Text style={styles.actionLabel}>Mis multas</Text>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Button
        title="Cerrar sesión"
        variant="outline"
        onPress={handleLogout}
        style={styles.logoutButton}
      />

      {!user.hasVerifiedPaymentMethod && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            Necesitas al menos un medio de pago verificado para pujar. Agregá uno en "Medios de pago".
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  label: {
    ...typography.body,
    color: colors.text.secondary,
  },
  value: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarInitial: {
    ...typography.heading2,
    color: '#FFFFFF',
  },
  name: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: 2,
  },
  document: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  email: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
  },
  infoSection: {
    marginBottom: spacing.md,
  },
  actions: {
    marginBottom: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  actionLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  actionArrow: {
    ...typography.heading2,
    color: colors.text.tertiary,
  },
  logoutButton: {
    marginTop: spacing.md,
  },
  warningBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.feedback.warning,
    lineHeight: 20,
  },
});
