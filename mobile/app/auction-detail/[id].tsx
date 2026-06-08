import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { AuctionDetail } from '@/api/types';

/**
 * Detalle de subasta (F03).
 * Muestra info de la subasta, botones para ver catálogo, streaming y conectarse.
 */
export default function AuctionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStreaming, setLoadingStreaming] = useState(false);

  useEffect(() => {
    get<AuctionDetail>(`/auctions/${id}`)
      .then(setAuction)
      .catch(() => setError('No se pudo cargar la subasta.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function openStreaming() {
    setLoadingStreaming(true);
    try {
      const { url } = await get<{ url: string }>(`/auctions/${id}/streaming`);
      await Linking.openURL(url);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'NOT_ADMITTED') {
        Alert.alert('Acceso restringido', 'Tu cuenta aún no fue admitida.');
      } else if (code === 'CATEGORY_INSUFFICIENT') {
        Alert.alert('Acceso restringido', 'Tu categoría no es suficiente para esta subasta.');
      } else {
        Alert.alert('Error', 'No hay URL de streaming disponible.');
      }
    } finally {
      setLoadingStreaming(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !auction) return <ErrorView message={error ?? 'Error al cargar'} onRetry={() => {
    setLoading(true);
    setError(null);
    get<AuctionDetail>(`/auctions/${id}`).then(setAuction).catch(() => setError('No se pudo cargar la subasta.')).finally(() => setLoading(false));
  }} />;

  const isOpen = auction.status === 'open';
  const isScheduled = auction.status === 'scheduled';
  const canSeeStreaming = user?.admitted && auction.streamingUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botón volver */}
      <Button title="← Volver" variant="ghost" onPress={() => router.back()} style={styles.backButton} />

      {/* Badge de estado */}
      <View style={[styles.statusBadge, isOpen ? styles.badgeOpen : isScheduled ? styles.badgeScheduled : styles.badgeClosed]}>
        <Text style={styles.statusText}>
          {isOpen ? '🔴 En curso' : isScheduled ? '🕐 Próxima' : '✅ Cerrada'}
        </Text>
      </View>

      {/* Info principal */}
      <View style={styles.section}>
        <Text style={styles.categoryLabel}>{auction.category.toUpperCase()}</Text>
        <Text style={styles.location}>{auction.location ?? 'Ubicación a confirmar'}</Text>
        <Text style={styles.date}>
          {new Date(auction.startsAt).toLocaleString('es-AR', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
        </Text>
      </View>

      {/* Detalles */}
      <View style={styles.card}>
        <DetailRow label="Moneda" value={auction.currency} />
        <DetailRow label="Ítems" value={String(auction.itemCount)} />
        <DetailRow label="Asistentes" value={String(auction.attendeeCount)} />
        {auction.attendeeCapacity && (
          <DetailRow label="Capacidad" value={String(auction.attendeeCapacity)} />
        )}
        {auction.isCollection && auction.collectionName && (
          <DetailRow label="Colección" value={auction.collectionName} />
        )}
        {auction.hasWarehouse && (
          <DetailRow label="Depósito" value="Disponible" />
        )}
      </View>

      {/* Si está programada, mostrar fecha de inicio */}
      {isScheduled && (
        <View style={styles.scheduledBanner}>
          <Text style={styles.scheduledText}>
            Esta subasta comienza el {new Date(auction.startsAt).toLocaleDateString('es-AR', { dateStyle: 'long' })}
          </Text>
        </View>
      )}

      {/* Acciones */}
      <View style={styles.actions}>
        {auction.catalogId && (
          <Button
            title="Ver catálogo"
            onPress={() => router.push(`/auction-catalog/${id}`)}
            style={styles.actionButton}
          />
        )}

        {canSeeStreaming && (
          <Button
            title="Ver streaming"
            variant="outline"
            onPress={openStreaming}
            loading={loadingStreaming}
            style={styles.actionButton}
          />
        )}

        {isOpen && (
          <Button
            title="Conectarme en vivo"
            onPress={() => router.push(`/auction/${id}`)}
            style={styles.actionButton}
          />
        )}
      </View>
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
  content: { padding: spacing.md, paddingTop: 60 },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  badgeOpen: { backgroundColor: colors.feedback.successBackground },
  badgeScheduled: { backgroundColor: colors.feedback.infoBackground },
  badgeClosed: { backgroundColor: colors.background.secondary },
  statusText: { ...typography.label, fontWeight: '700', color: colors.text.primary },
  section: { marginBottom: spacing.md },
  categoryLabel: { ...typography.label, color: colors.brand.accent, fontWeight: '700', marginBottom: 4 },
  location: { ...typography.heading2, color: colors.text.primary, marginBottom: 4 },
  date: { ...typography.body, color: colors.text.secondary },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  detailLabel: { ...typography.bodySmall, color: colors.text.secondary },
  detailValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  scheduledBanner: {
    backgroundColor: colors.feedback.infoBackground,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  scheduledText: { ...typography.body, color: colors.feedback.info },
  actions: { gap: spacing.sm },
  actionButton: {},
});
