import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { get } from '@/api/client';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { Auction } from '@/api/types';

/**
 * Lista de subastas disponibles (F03 / F04).
 * Maneja estados: cargando / vacio / error / exito.
 * Navega a la pantalla de subasta en vivo al tocar una.
 */
export default function AuctionsScreen() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchAuctions() {
    try {
      const data = await get<Auction[]>('/auctions');
      setAuctions(data);
      setError(null);
    } catch {
      setError('No se pudieron cargar las subastas. Verificá tu conexión.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchAuctions().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAuctions();
    setRefreshing(false);
  }, []);

  if (loading) return <Loading />;

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setLoading(true);
          fetchAuctions().finally(() => setLoading(false));
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Subastas</Text>
      </View>

      <FlatList
        data={auctions}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={auctions.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin subastas disponibles"
            message="No hay subastas activas en este momento. Volvé más tarde."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/auction/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardCategory}>{item.category.toUpperCase()}</Text>
              <View style={[styles.statusBadge, item.status === 'open' ? styles.badgeOpen : styles.badgeClosed]}>
                <Text style={styles.statusText}>{item.status === 'open' ? 'En curso' : 'Cerrada'}</Text>
              </View>
            </View>

            <Text style={styles.cardLocation}>{item.location ?? 'Ubicación a confirmar'}</Text>
            <Text style={styles.cardDate}>
              {new Date(item.startsAt).toLocaleString('es-AR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
            <Text style={styles.cardCurrency}>{item.currency}</Text>
          </TouchableOpacity>
        )}
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
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
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
  cardCategory: {
    ...typography.label,
    color: colors.brand.accent,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeOpen: {
    backgroundColor: colors.feedback.successBackground,
  },
  badgeClosed: {
    backgroundColor: colors.background.secondary,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  cardLocation: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardDate: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  cardCurrency: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
