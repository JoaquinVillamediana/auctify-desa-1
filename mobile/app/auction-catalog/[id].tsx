import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { AuctionCatalog } from '@/api/types';

/**
 * Catálogo de ítems de una subasta (F03).
 * Lista ítems ordenados por lotNumber. Resalta el ítem activo.
 * basePrice solo se muestra si el usuario está autenticado (lo maneja el backend).
 */
export default function AuctionCatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [catalog, setCatalog] = useState<AuctionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    get<AuctionCatalog>(`/auctions/${id}/catalog`)
      .then(setCatalog)
      .catch(() => setError('No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="← Volver" variant="ghost" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Catálogo</Text>
      </View>

      {catalog?.description && (
        <Text style={styles.description}>{catalog.description}</Text>
      )}

      <FlatList
        data={catalog?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={(catalog?.items ?? []).length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState title="Sin ítems" message="Este catálogo no tiene ítems todavía." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.status === 'active' && styles.cardActive]}
            onPress={() => router.push(`/item/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.cardRow}>
              <Text style={styles.lotNumber}>Lote {item.lotNumber}</Text>
              {item.status === 'active' && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>🔴 En vivo</Text>
                </View>
              )}
              {item.status === 'sold' && (
                <View style={styles.soldBadge}>
                  <Text style={styles.soldBadgeText}>Vendido</Text>
                </View>
              )}
            </View>

            <Text style={styles.itemDescription} numberOfLines={2}>
              {item.catalogDescription ?? 'Sin descripción'}
            </Text>

            <Text style={styles.itemPrice}>
              {item.basePrice !== null && item.basePrice !== undefined
                ? `Base: $${item.basePrice.toLocaleString('es-AR')}`
                : 'Iniciá sesión para ver el precio base'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: { ...typography.heading3, color: colors.text.primary, marginLeft: spacing.sm },
  description: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontStyle: 'italic',
  },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardActive: {
    borderColor: colors.feedback.live,
    borderWidth: 2,
    backgroundColor: colors.feedback.errorBackground,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  lotNumber: { ...typography.label, color: colors.text.tertiary, fontWeight: '600' },
  liveBadge: { backgroundColor: colors.feedback.live, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  liveBadgeText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  soldBadge: { backgroundColor: colors.background.secondary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  soldBadgeText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  itemDescription: { ...typography.body, color: colors.text.primary, marginBottom: 6 },
  itemPrice: { ...typography.bodySmall, color: colors.brand.primary, fontWeight: '600' },
});
