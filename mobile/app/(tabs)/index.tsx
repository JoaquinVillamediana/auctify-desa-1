import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { get } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { Auction } from '@/api/types';

type StatusFilter = 'all' | 'open' | 'scheduled' | 'closed';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  open: 'En curso',
  scheduled: 'Próximas',
  closed: 'Cerradas',
};

/**
 * Lista de subastas disponibles (F03).
 * Filtros por status. Navega al detalle al tocar.
 */
export default function AuctionsScreen() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  async function fetchAuctions(status?: string) {
    try {
      const path = status && status !== 'all' ? `/auctions?status=${status}` : '/auctions';
      const data = await get<Auction[]>(path);
      setAuctions(data);
      setError(null);
    } catch {
      setError('No se pudieron cargar las subastas. Verificá tu conexión.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchAuctions(statusFilter).finally(() => setLoading(false));
  }, [statusFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAuctions(statusFilter);
    setRefreshing(false);
  }, [statusFilter]);

  if (loading) return <Loading />;

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setLoading(true);
          fetchAuctions(statusFilter).finally(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subastas</Text>
      </View>

      {/* Filtros de estado */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow} contentContainerStyle={styles.filtersContent}>
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {STATUS_LABELS[s]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={auctions}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={auctions.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin subastas disponibles"
            message="No hay subastas con ese filtro. Probá con otro."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/auction-detail/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardCategory}>{item.category.toUpperCase()}</Text>
              <View style={[styles.statusBadge, statusStyle(item.status)]}>
                <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
              </View>
            </View>

            <Text style={styles.cardLocation}>{item.location ?? 'Ubicación a confirmar'}</Text>
            <Text style={styles.cardDate}>
              {new Date(item.startsAt).toLocaleString('es-AR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>

            <View style={styles.cardFooter}>
              <Text style={styles.cardCurrency}>{item.currency}</Text>
              {item.itemCount !== undefined && (
                <Text style={styles.cardMeta}>{item.itemCount} ítems · {item.attendeeCount ?? 0} asistentes</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function statusLabel(status: string): string {
  if (status === 'open') return 'En curso';
  if (status === 'scheduled') return 'Próxima';
  return 'Cerrada';
}

function statusStyle(status: string) {
  if (status === 'open') return styles.badgeOpen;
  if (status === 'scheduled') return styles.badgeScheduled;
  return styles.badgeClosed;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: { ...typography.heading2, color: colors.text.primary },
  filtersRow: { maxHeight: 48, backgroundColor: colors.background.primary },
  filtersContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  chipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  chipTextActive: { color: colors.text.inverse },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardCategory: { ...typography.label, color: colors.brand.accent, fontWeight: '700' },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 6 },
  badgeOpen: { backgroundColor: colors.feedback.successBackground },
  badgeScheduled: { backgroundColor: colors.feedback.infoBackground },
  badgeClosed: { backgroundColor: colors.background.secondary },
  statusText: { ...typography.caption, fontWeight: '600', color: colors.text.primary },
  cardLocation: { ...typography.body, color: colors.text.primary, fontWeight: '600', marginBottom: 2 },
  cardDate: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCurrency: { ...typography.caption, color: colors.text.tertiary },
  cardMeta: { ...typography.caption, color: colors.text.tertiary },
});
