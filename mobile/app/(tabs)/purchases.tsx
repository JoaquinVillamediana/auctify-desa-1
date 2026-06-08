import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { get } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { SaleRecord } from '@/api/types';

/**
 * Mis compras — lista de SaleRecord donde el usuario es el comprador (F07).
 */
export default function PurchasesScreen() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPurchases() {
    try {
      const data = await get<SaleRecord[]>('/sale-records');
      setPurchases(data);
      setError(null);
    } catch {
      setError('No se pudieron cargar tus compras.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchPurchases().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPurchases();
    setRefreshing(false);
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={() => { setLoading(true); fetchPurchases().finally(() => setLoading(false)); }} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis compras</Text>
      </View>

      <FlatList
        data={purchases}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={purchases.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin compras"
            message="Todavía no ganaste ningún ítem en una subasta."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/purchase/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.amount}>${item.amount.toLocaleString('es-AR')}</Text>
              <View style={[styles.statusBadge, paymentStatusStyle(item.paymentStatus)]}>
                <Text style={styles.statusText}>{paymentStatusLabel(item.paymentStatus)}</Text>
              </View>
            </View>
            <Text style={styles.description} numberOfLines={1}>
              {item.product?.catalogDescription ?? `Ítem de subasta #${item.auctionId}`}
            </Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString('es-AR', { dateStyle: 'medium' })}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function paymentStatusLabel(status: string): string {
  if (status === 'paid') return 'Pagado';
  if (status === 'failed') return 'Falló';
  return 'Pendiente';
}

function paymentStatusStyle(status: string) {
  if (status === 'paid') return { backgroundColor: colors.feedback.successBackground };
  if (status === 'failed') return { backgroundColor: colors.feedback.errorBackground };
  return { backgroundColor: colors.feedback.warningBackground };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: { ...typography.heading2, color: colors.text.primary },
  list: { padding: spacing.md },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  amount: { ...typography.heading3, color: colors.brand.primary, fontWeight: '800' },
  statusBadge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: 6 },
  statusText: { ...typography.caption, fontWeight: '600', color: colors.text.primary },
  description: { ...typography.body, color: colors.text.secondary, marginBottom: 4 },
  date: { ...typography.caption, color: colors.text.tertiary },
});
