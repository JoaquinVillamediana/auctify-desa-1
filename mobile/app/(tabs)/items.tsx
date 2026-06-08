import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { get } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { colors, typography, spacing } from '@/theme';
import type { InclusionRequest } from '@/api/types';
import type { ApiError } from '@/api/client';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  under_inspection: 'En inspección',
  proposal_sent: 'Propuesta recibida',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  proposal_rejected: 'Prop. rechazada',
};

const STATUS_COLORS: Record<string, string> = {
  pending: colors.feedback.warning,
  under_inspection: colors.feedback.info,
  proposal_sent: colors.brand.primary,
  accepted: colors.feedback.success,
  rejected: colors.feedback.error,
  proposal_rejected: colors.feedback.error,
};

type InclusionRequestWithProduct = InclusionRequest & {
  product?: {
    catalogDescription?: string | null;
    photos?: Array<{ photoUrl: string }>;
  };
};

export default function ItemsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<InclusionRequestWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<InclusionRequestWithProduct[]>('/inclusion-requests');
      setRequests(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar tus artículos.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Recargar al volver a la tab
  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  function renderItem({ item }: { item: InclusionRequestWithProduct }) {
    const statusColor = STATUS_COLORS[item.status] ?? colors.text.secondary;
    const thumb = item.product?.photos?.[0]?.photoUrl;
    const label = item.product?.catalogDescription ?? item.itemDescription;
    const hasProposal = item.status === 'proposal_sent';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/items/${item.id}`)}
        activeOpacity={0.7}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbIcon}>🖼</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{label}</Text>

          <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>

          {hasProposal && (
            <Text style={styles.proposalCta}>Ver propuesta →</Text>
          )}

          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleDateString('es-AR')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis artículos</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/items/new')}
        >
          <Text style={styles.newBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loading />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchRequests}>
            <Text style={styles.retryLink}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <EmptyState
              title="Aún no tenés artículos"
              message="Acá vas a ver el estado de tus solicitudes de inclusión en subastas."
              actionLabel="Solicitar inclusión"
              onAction={() => router.push('/items/new')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { ...typography.heading2, color: colors.text.primary },
  newBtn: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  newBtnText: { ...typography.bodySmall, color: '#fff', fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flex: 1, padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  errorText: { ...typography.body, color: colors.feedback.error, textAlign: 'center', marginBottom: spacing.sm },
  retryLink: { ...typography.bodySmall, color: colors.brand.primary },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  thumb: { width: 80, height: 80 },
  thumbPlaceholder: {
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: { fontSize: 24 },
  cardBody: { flex: 1, padding: spacing.sm, justifyContent: 'space-between' },
  cardTitle: { ...typography.label, color: colors.text.primary, marginBottom: spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  proposalCta: { ...typography.bodySmall, color: colors.brand.primary, fontWeight: '600', marginBottom: spacing.xs },
  date: { ...typography.caption, color: colors.text.tertiary },
});
