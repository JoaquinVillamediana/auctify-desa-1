import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePolling } from '@/hooks/usePolling';
import { get, post } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { AuctionLiveStatus, PaymentMethod } from '@/api/types';
import type { ApiError } from '@/api/client';

/**
 * Pantalla de subasta en vivo (F04 / F05).
 *
 * - Polling de GET /auctions/{id}/live-status cada 2.5 s
 * - Re-render solo si cambia `version`
 * - Caja de puja con validacion local de rango
 * - Botón deshabilitado hasta confirmación 201 (regla "una puja a la vez")
 * - Manejo de 422 BID_OUT_OF_RANGE, 409 BID_SUPERSEDED, 403 varios
 *
 * TODO → docs/features/F04-session.md (connect/disconnect)
 * TODO → docs/features/F05-bidding.md (lógica completa de puja)
 */
export default function AuctionLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [bidAmount, setBidAmount] = useState('');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  // Polling del estado en vivo — pausa automaticamente si offline o en background
  const {
    data: liveStatus,
    loading,
    error: pollError,
    retry,
  } = usePolling<AuctionLiveStatus>(
    () => get<AuctionLiveStatus>(`/auctions/${id}/live-status`),
    {
      intervalMs: 2500,
      // Solo re-renderiza si la version cambio
      hasChanged: (prev, next) => prev?.version !== next?.version,
    }
  );

  // Cargar medios de pago del cliente una sola vez
  // TODO → usar GET /me/payment-methods cuando el alias /me este disponible
  // Por ahora se deja vacio; conectar cuando el backend implemente el endpoint

  async function handleBid() {
    if (!liveStatus?.currentItem) return;

    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) {
      setBidError('Ingresá un importe válido');
      return;
    }

    const { minBidAllowed, maxBidAllowed } = liveStatus.currentItem;

    if (minBidAllowed !== null && minBidAllowed !== undefined && amount < minBidAllowed) {
      setBidError(`El mínimo permitido es ${formatCurrency(minBidAllowed)}`);
      return;
    }

    if (maxBidAllowed !== null && maxBidAllowed !== undefined && amount > maxBidAllowed) {
      setBidError(`El máximo permitido es ${formatCurrency(maxBidAllowed)}`);
      return;
    }

    if (!selectedPaymentMethodId) {
      setBidError('Seleccioná un medio de pago');
      return;
    }

    setSubmitting(true);
    setBidError(null);
    setBidSuccess(null);

    // Generar Idempotency-Key unico para esta puja (regla de concurrencia)
    const idempotencyKey = `${user?.id}-${liveStatus.currentItem.itemId}-${Date.now()}`;

    try {
      await post(
        `/items/${liveStatus.currentItem.itemId}/bids`,
        { amount, paymentMethodId: selectedPaymentMethodId },
        { 'Idempotency-Key': idempotencyKey }
      );

      // 201 — puja registrada
      setBidAmount('');
      setBidSuccess('¡Puja registrada!');
      setTimeout(() => setBidSuccess(null), 3000);
    } catch (err) {
      const apiError = err as ApiError;

      switch (apiError.code) {
        case 'BID_OUT_OF_RANGE': {
          const { minAllowed, maxAllowed } = (apiError.details ?? {}) as Record<string, number>;
          setBidError(
            `Fuera de rango. Mínimo: ${formatCurrency(minAllowed)}, Máximo: ${formatCurrency(maxAllowed)}`
          );
          break;
        }
        case 'BID_SUPERSEDED':
          // Alguien pujó mientras tanto — el polling se encargara de refrescar
          setBidError('Otro postor te ganó de mano. Esperá el nuevo estado y volvé a intentar.');
          break;
        case 'NOT_CONNECTED':
          setBidError('No estás conectado a esta subasta. Reconectate para pujar.');
          break;
        case 'NO_VERIFIED_PAYMENT_METHOD':
          setBidError('No tenés un medio de pago verificado. Agregá uno desde tu perfil.');
          break;
        case 'CLIENT_BLOCKED':
          setBidError('Tu cuenta está bloqueada. Abonás la multa pendiente para continuar.');
          break;
        case 'CHECK_LIMIT_EXCEEDED':
          setBidError('Superaste el límite del cheque certificado. Elegí otro medio de pago.');
          break;
        default:
          setBidError(apiError.message ?? 'Error al registrar la puja. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !liveStatus) return <Loading />;

  if (pollError && !liveStatus) {
    return <ErrorView message="No se pudo conectar a la subasta." onRetry={retry} />;
  }

  const item = liveStatus?.currentItem;
  const canBid = user?.hasVerifiedPaymentMethod && liveStatus?.auctionStatus === 'open' && !!item;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Barra de navegacion */}
      <View style={styles.navBar}>
        <Button
          title="← Volver"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <View style={styles.connectedBadge}>
          <Text style={styles.connectedText}>
            {liveStatus?.connectedCount ?? '—'} conectados
          </Text>
        </View>
      </View>

      {/* Estado de la subasta */}
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>
          {liveStatus?.auctionStatus === 'open' ? 'En curso' : 'Cerrada'}
        </Text>
        {pollError && (
          <Text style={styles.reconnectingText}>Reconectando…</Text>
        )}
      </View>

      {/* Item activo */}
      {item ? (
        <View style={styles.itemCard}>
          <Text style={styles.itemDescription}>{item.catalogDescription}</Text>

          <View style={styles.bidRow}>
            <View>
              <Text style={styles.bidLabel}>Mejor oferta</Text>
              <Text style={styles.bidAmount}>
                {item.bestBid != null ? formatCurrency(item.bestBid) : 'Sin ofertas'}
              </Text>
            </View>
            {item.bestBidBidderNumber != null && (
              <View style={styles.bidderBadge}>
                <Text style={styles.bidderText}>Postor #{item.bestBidBidderNumber}</Text>
              </View>
            )}
          </View>

          <View style={styles.rangeRow}>
            <Text style={styles.rangeText}>
              Min: {item.minBidAllowed != null ? formatCurrency(item.minBidAllowed) : '—'}
            </Text>
            {item.maxBidAllowed != null && (
              <Text style={styles.rangeText}>
                Max: {formatCurrency(item.maxBidAllowed)}
              </Text>
            )}
          </View>

          <Text style={styles.bidCount}>{item.bidCount} puja(s)</Text>

          {/* Alerta youWereOutbid */}
          {liveStatus.youWereOutbid && (
            <View style={styles.outbidBanner}>
              <Text style={styles.outbidText}>¡Te superaron! Podés mejorar tu oferta.</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.itemCard}>
          <Text style={styles.noItemText}>
            {liveStatus?.auctionStatus === 'closed'
              ? 'La subasta ha finalizado.'
              : 'Esperando el próximo ítem…'}
          </Text>
        </View>
      )}

      {/* Caja de puja */}
      {canBid ? (
        <View style={styles.bidBox}>
          <Text style={styles.bidBoxTitle}>Realizar puja</Text>

          {bidSuccess && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{bidSuccess}</Text>
            </View>
          )}

          {bidError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{bidError}</Text>
            </View>
          )}

          <TextInput
            style={styles.amountInput}
            value={bidAmount}
            onChangeText={(t) => {
              setBidAmount(t);
              setBidError(null);
            }}
            placeholder={item?.minBidAllowed != null ? formatCurrency(item.minBidAllowed) : 'Importe'}
            keyboardType="decimal-pad"
            editable={!submitting}
          />

          {/* TODO → F05: selector de medio de pago verificado */}
          {paymentMethods.length > 0 ? (
            <View style={styles.paymentMethodPlaceholder}>
              <Text style={styles.paymentMethodText}>Seleccioná un medio de pago (TODO)</Text>
            </View>
          ) : (
            <Text style={styles.paymentMethodHint}>
              Tus medios de pago verificados aparecerán aquí.
            </Text>
          )}

          <Button
            title="Pujar"
            onPress={handleBid}
            loading={submitting}
            style={styles.bidButton}
          />
        </View>
      ) : !user?.hasVerifiedPaymentMethod ? (
        <View style={styles.noBidBanner}>
          <Text style={styles.noBidText}>
            Necesitás un medio de pago verificado para pujar. Agregá uno desde tu perfil.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
    paddingTop: 60,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  connectedBadge: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  connectedText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  statusLabel: {
    ...typography.label,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reconnectingText: {
    ...typography.caption,
    color: colors.feedback.warning,
    fontStyle: 'italic',
  },
  itemCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  itemDescription: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  bidLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bidAmount: {
    ...typography.heading2,
    color: colors.brand.accent,
    fontWeight: '800',
  },
  bidderBadge: {
    backgroundColor: colors.brand.primaryLight,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  bidderText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  rangeText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  bidCount: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  outbidBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  outbidText: {
    ...typography.bodySmall,
    color: colors.feedback.warning,
    fontWeight: '600',
  },
  noItemText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  bidBox: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  bidBoxTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  successBanner: {
    backgroundColor: colors.feedback.successBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  successText: {
    ...typography.bodySmall,
    color: colors.feedback.success,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
  },
  paymentMethodPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  paymentMethodText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  paymentMethodHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  bidButton: {
    marginTop: spacing.xs,
  },
  noBidBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 10,
    padding: spacing.md,
  },
  noBidText: {
    ...typography.body,
    color: colors.feedback.warning,
    lineHeight: 22,
  },
});
