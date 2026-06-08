import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { get } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { Metrics, ClientCategory } from '@/api/types';
import type { ApiError } from '@/api/client';

const CATEGORY_COLORS: Record<ClientCategory, string> = {
  common: '#9CA3AF',
  special: '#6B7280',
  silver: '#94A3B8',
  gold: '#F59E0B',
  platinum: '#8B5CF6',
};

const CATEGORY_LABELS: Record<ClientCategory, string> = {
  common: 'Común',
  special: 'Especial',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

interface StatCardProps {
  value: string | number;
  label: string;
  accent?: boolean;
}

function StatCard({ value, label, accent = false }: StatCardProps) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </View>
  );
}

export default function MetricsScreen() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchMetrics() {
    try {
      const data = await get<Metrics>('/me/metrics');
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar las métricas.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMetrics().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  }, []);

  if (loading) return <Loading />;

  if (error) {
    return (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis métricas</Text>
        </View>
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchMetrics().finally(() => setLoading(false));
          }}
        />
      </>
    );
  }

  const isEmpty = (metrics?.auctionsAttended ?? 0) === 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis métricas</Text>
      </View>

      {isEmpty ? (
        <EmptyState
          title="Todavía no participaste en ninguna subasta"
          message="Cuando te unas a una subasta, acá verás tus estadísticas de participación, pujas y ganancias."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
        >
          {/* Sección de resumen */}
          <Text style={styles.sectionLabel}>RESUMEN</Text>

          <View style={styles.statGrid}>
            <StatCard value={metrics?.auctionsAttended ?? 0} label="Subastas asistidas" />
            <StatCard value={metrics?.auctionsWon ?? 0} label="Subastas ganadas" />
          </View>

          <View style={styles.statGrid}>
            <StatCard value={formatCurrency(metrics?.totalBidAmount ?? 0)} label="Total ofertado" accent />
            <StatCard value={formatCurrency(metrics?.totalPaidAmount ?? 0)} label="Total pagado" accent />
          </View>

          {/* Desglose por categoría */}
          {(metrics?.byCategory?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>POR CATEGORÍA</Text>

              <View style={styles.tableCard}>
                {/* Cabecera */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellWide]}>Categoría</Text>
                  <Text style={styles.tableHeaderCell}>Asistidas</Text>
                  <Text style={styles.tableHeaderCell}>Ganadas</Text>
                </View>

                {metrics!.byCategory.map((row, index) => {
                  const cat = row.category as ClientCategory;
                  const color = CATEGORY_COLORS[cat] ?? '#9CA3AF';
                  const label = CATEGORY_LABELS[cat] ?? row.category;
                  const isLast = index === metrics!.byCategory.length - 1;

                  return (
                    <View key={row.category} style={[styles.tableRow, isLast && styles.tableRowLast]}>
                      <View style={[styles.tableCellWide, styles.categoryCell]}>
                        <View style={[styles.categoryDot, { backgroundColor: color }]} />
                        <Text style={styles.categoryLabel}>{label}</Text>
                      </View>
                      <Text style={styles.tableCell}>{row.attended}</Text>
                      <Text style={styles.tableCell}>{row.won}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: { ...typography.heading2, color: colors.text.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  sectionLabel: {
    ...typography.overline,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    ...CARD_SHADOW,
  },
  statCardAccent: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  statValue: {
    ...typography.heading2,
    color: colors.brand.primary,
    marginBottom: 4,
  },
  statValueAccent: {
    color: '#FFFFFF',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  statLabelAccent: {
    color: 'rgba(255,255,255,0.8)',
  },
  tableCard: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    ...CARD_SHADOW,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableHeaderCell: {
    flex: 1,
    ...typography.overline,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCellWide: { flex: 2 },
  tableCell: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text.primary,
    textAlign: 'center',
  },
  categoryCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  categoryLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
