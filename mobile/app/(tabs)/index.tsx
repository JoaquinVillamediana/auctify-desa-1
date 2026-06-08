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
import { colors, typography, spacing, radius } from '@/theme';
import type { Auction } from '@/api/types';

type StatusFilter = 'all' | 'open' | 'scheduled' | 'closed';

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Todas',
  open: 'En curso',
  scheduled: 'Próximas',
  closed: 'Cerradas',
};

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
      setError('No se pudieron cargar las subastas.');
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Auctify</Text>
        <Text style={styles.logoSub}>subastas · mobile</Text>
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersRow}
        contentContainerStyle={styles.filtersContent}
      >
        {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {FILTER_LABELS[s]}
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
        renderItem={({ item, index }) => {
          const prev = index > 0 ? auctions[index - 1] : null;
          const showLiveSection =
            statusFilter === 'all' &&
            item.status === 'open' &&
            (prev === null || prev.status !== 'open');
          const showUpcomingSection =
            statusFilter === 'all' &&
            item.status === 'scheduled' &&
            (prev === null || prev.status !== 'scheduled');

          return (
            <>
              {showLiveSection && (
                <View style={styles.sectionRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.sectionLabel}>En vivo ahora</Text>
                </View>
              )}
              {showUpcomingSection && (
                <Text style={[styles.sectionLabel, { marginTop: spacing.sm }]}>Próximas</Text>
              )}

              <TouchableOpacity
                style={[styles.card, item.status === 'open' && styles.cardLive]}
                onPress={() => router.push(`/auction-detail/${item.id}`)}
                activeOpacity={0.75}
              >
                {/* Left: image area */}
                <View style={[styles.cardImg, item.status === 'open' && styles.cardImgLive]}>
                  <Text style={styles.cardImgText}>{item.status === 'open' ? 'live' : 'img'}</Text>
                </View>

                {/* Right: info */}
                <View style={styles.cardInfo}>
                  <View style={styles.pillsRow}>
                    <StatusPill status={item.status} />
                    <View style={styles.pillOutline}>
                      <Text style={styles.pillOutlineText}>{item.currency}</Text>
                    </View>
                    <View style={styles.pillHighlight}>
                      <Text style={styles.pillHighlightText}>Cat. {item.category.toUpperCase()}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardLocation} numberOfLines={1}>
                    {item.location ?? 'Ubicación a confirmar'}
                  </Text>
                  <Text style={styles.cardDate}>
                    {new Date(item.startsAt).toLocaleString('es-AR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </Text>
                  {item.itemCount !== undefined && (
                    <Text style={styles.cardMeta}>
                      {item.itemCount} piezas · {item.attendeeCount ?? 0} asistentes
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </>
          );
        }}
      />
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === 'open') {
    return (
      <View style={styles.pillLive}>
        <Text style={styles.pillLiveText}>● En vivo</Text>
      </View>
    );
  }
  if (status === 'scheduled') {
    return (
      <View style={styles.pillInfo}>
        <Text style={styles.pillInfoText}>Próxima</Text>
      </View>
    );
  }
  return (
    <View style={styles.pillOutline}>
      <Text style={styles.pillOutlineText}>Cerrada</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  logo: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 26,
    color: colors.brand.primary,
    letterSpacing: -0.5,
  },
  logoSub: { ...typography.caption, color: colors.text.tertiary, marginTop: 1 },

  filtersRow: { maxHeight: 48, backgroundColor: colors.background.primary },
  filtersContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  chipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  list: { padding: spacing.md, paddingBottom: spacing.xl },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.feedback.live },
  sectionLabel: { ...typography.overline, color: colors.text.secondary, marginBottom: 8 },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardLive: { borderColor: colors.feedback.live },

  cardImg: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  cardImgLive: { backgroundColor: '#FEF2F2' },
  cardImgText: { ...typography.caption, color: colors.text.tertiary },

  cardInfo: { flex: 1, padding: spacing.sm },
  pillsRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginBottom: 6 },

  pillLive: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.live,
  },
  pillLiveText: { fontSize: 11, color: '#fff', fontWeight: '700' },

  pillInfo: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.infoBackground,
    borderWidth: 1,
    borderColor: colors.feedback.info,
  },
  pillInfoText: { ...typography.caption, color: colors.feedback.info, fontWeight: '700' },

  pillOutline: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  pillOutlineText: { ...typography.caption, color: colors.text.secondary },

  pillHighlight: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primaryLight,
  },
  pillHighlightText: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },

  cardLocation: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600', marginBottom: 2 },
  cardDate: { ...typography.caption, color: colors.text.secondary, marginBottom: 2 },
  cardMeta: { ...typography.caption, color: colors.text.tertiary },
});
