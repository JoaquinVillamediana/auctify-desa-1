import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, FlatList, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { CatalogItemFull } from '@/api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Detalle de un ítem del catálogo (F03).
 * Galería de fotos, ficha del producto, precios.
 */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<CatalogItemFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<CatalogItemFull>(`/items/${id}`)
      .then(setItem)
      .catch(() => setError('No se pudo cargar el ítem.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (error || !item) return <ErrorView message={error ?? 'Error'} onRetry={() => {
    setLoading(true);
    setError(null);
    get<CatalogItemFull>(`/items/${id}`).then(setItem).catch(() => setError('No se pudo cargar.')).finally(() => setLoading(false));
  }} />;

  const photos = item.product?.photos ?? [];
  const isActive = item.status === 'active';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button title="← Volver" variant="ghost" onPress={() => router.back()} style={styles.backButton} />

      {/* Badge de lote y estado */}
      <View style={styles.topRow}>
        <Text style={styles.lotLabel}>Lote {item.lotNumber}</Text>
        {isActive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>🔴 En vivo</Text>
          </View>
        )}
      </View>

      {/* Galería de fotos */}
      {photos.length > 0 && (
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item: photoUrl }) => (
            <Image
              source={{ uri: photoUrl }}
              style={styles.photo}
              resizeMode="cover"
            />
          )}
          style={styles.gallery}
        />
      )}

      {/* Descripción */}
      <View style={styles.section}>
        <Text style={styles.title}>{item.product?.catalogDescription ?? 'Sin descripción'}</Text>
        {item.product?.fullDescription && (
          <Text style={styles.fullDescription}>{item.product.fullDescription}</Text>
        )}
        {item.product?.pieceCount && item.product.pieceCount > 1 && (
          <Text style={styles.metaText}>Cantidad de piezas: {item.product.pieceCount}</Text>
        )}
      </View>

      {/* Ficha cultural */}
      {(item.product?.artist || item.product?.historicalDate || item.product?.history) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ficha del bien</Text>
          {item.product?.artist && <DetailRow label="Artista / Autor" value={item.product.artist} />}
          {item.product?.historicalDate && <DetailRow label="Período" value={item.product.historicalDate} />}
          {item.product?.history && (
            <View>
              <Text style={styles.detailLabel}>Historia</Text>
              <Text style={styles.historyText}>{item.product.history}</Text>
            </View>
          )}
        </View>
      )}

      {/* Precios */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Precios</Text>
        {item.basePrice !== null && item.basePrice !== undefined ? (
          <>
            <DetailRow label="Precio base" value={`$${item.basePrice.toLocaleString('es-AR')}`} />
            <DetailRow label="Comisión" value={`${(item.commission * 100).toFixed(0)}%`} />
          </>
        ) : (
          <Text style={styles.noPriceText}>Iniciá sesión para ver el precio base</Text>
        )}

        {isActive && item.bestBid !== null && item.bestBid !== undefined && (
          <DetailRow label="Mejor oferta" value={`$${item.bestBid.toLocaleString('es-AR')}`} />
        )}
        {isActive && item.minBidAllowed && (
          <DetailRow label="Mínima puja" value={`$${item.minBidAllowed.toLocaleString('es-AR')}`} />
        )}
      </View>

      {/* Botón ir a la subasta */}
      {isActive && (
        <Button
          title="Ir a la subasta en vivo"
          onPress={() => {
            // Navegar al catálogo padre para encontrar auctionId
            router.back();
          }}
          style={styles.liveButton}
        />
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingTop: 60, paddingBottom: spacing.xl },
  backButton: { alignSelf: 'flex-start', marginHorizontal: spacing.md, marginBottom: spacing.sm },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  lotLabel: { ...typography.label, color: colors.text.tertiary, fontWeight: '600' },
  liveBadge: { backgroundColor: colors.feedback.live, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  liveBadgeText: { ...typography.caption, color: '#fff', fontWeight: '700' },
  gallery: { marginBottom: spacing.md },
  photo: { width: SCREEN_WIDTH, height: 280 },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: 4 },
  fullDescription: { ...typography.body, color: colors.text.secondary, marginBottom: 4 },
  metaText: { ...typography.bodySmall, color: colors.text.tertiary },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.label, color: colors.text.secondary, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  detailLabel: { ...typography.bodySmall, color: colors.text.secondary },
  detailValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  historyText: { ...typography.bodySmall, color: colors.text.primary, marginTop: 4 },
  noPriceText: { ...typography.body, color: colors.text.tertiary, fontStyle: 'italic' },
  liveButton: { marginHorizontal: spacing.md },
});
