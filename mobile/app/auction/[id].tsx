import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
  FlatList,
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

// ── Tipos internos ───────────────────────────────────────────────────────────

type ConnectState =
  | 'idle'           // aún no intentamos conectar
  | 'connecting'     // POST /connect en curso
  | 'connected'      // sesión activa
  | 'error';         // falló la conexión y no hay sesión

/**
 * Pantalla de subasta en vivo — F04 (sesión) + F05 (pujar).
 *
 * Flujo completo:
 *   1. Al montar: POST /auctions/:id/connect
 *      - 409 ALREADY_CONNECTED → Alert con opción de desconectar la otra sesión
 *      - 403 → mostrar motivo sin pantalla de puja
 *   2. Polling de GET /auctions/:id/live-status cada 2.5 s (solo si connected)
 *      - Re-render solo si version cambia (ADR-002)
 *   3. Carga medios de pago verificados vía GET /me/payment-methods
 *   4. Caja de puja con validación local de rango + Idempotency-Key
 *   5. Al desmontar: best-effort POST /auctions/:id/disconnect
 *
 * Ver docs/features/F04-auction-session-live.md y F05-bidding.md
 */
export default function AuctionLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ── Estado de la conexión ────────────────────────────────────────────────
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Medios de pago verificados del cliente ───────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);

  // ── Estado de la puja ────────────────────────────────────────────────────
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  // Ref para desconectar al desmontar sin generar dependencia extra
  const auctionId = id;
  const disconnectOnUnmount = useRef(false);

  // ── Polling del estado en vivo ──────────────────────────────────────────
  // Solo activo cuando estamos conectados
  const {
    data: liveStatus,
    loading: pollLoading,
    error: pollError,
    retry: retryPoll,
  } = usePolling<AuctionLiveStatus>(
    () => get<AuctionLiveStatus>(`/auctions/${auctionId}/live-status`),
    {
      intervalMs: 2500,
      // Solo re-renderiza si la version cambio (ADR-002)
      hasChanged: (prev, next) => prev?.version !== next?.version,
      // Pausa el polling si no estamos conectados
      enabled: connectState === 'connected',
    }
  );

  // ── Conexión al montar ────────────────────────────────────────────────────

  const connectToAuction = useCallback(async () => {
    setConnectState('connecting');
    setConnectError(null);

    try {
      await post(`/auctions/${auctionId}/connect`, {});
      setConnectState('connected');
      disconnectOnUnmount.current = true;
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'ALREADY_CONNECTED') {
        // Hay una sesión activa en otra subasta — ofrecer desconectar
        const otherAuctionId = (apiError.details as Record<string, unknown>)?.auctionId;
        Alert.alert(
          'Ya estás conectado',
          `Estás conectado a otra subasta. ¿Querés desconectarte para unirte a ésta?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                setConnectState('error');
                setConnectError('Cancelaste la conexión.');
              },
            },
            {
              text: 'Desconectarme',
              onPress: async () => {
                try {
                  if (otherAuctionId) {
                    await post(`/auctions/${otherAuctionId}/disconnect`, {});
                  }
                  // Reintentar la conexión
                  await post(`/auctions/${auctionId}/connect`, {});
                  setConnectState('connected');
                  disconnectOnUnmount.current = true;
                } catch (retryErr) {
                  const retryApiError = retryErr as ApiError;
                  setConnectState('error');
                  setConnectError(
                    retryApiError.message ?? 'No se pudo conectar. Intentá de nuevo.'
                  );
                }
              },
            },
          ]
        );
      } else {
        // Errores 403 u otros
        setConnectState('error');
        setConnectError(mapConnectError(apiError));
      }
    }
  }, [auctionId]);

  // ── Desconexión al desmontar ─────────────────────────────────────────────

  useEffect(() => {
    // Esperar a que se hidrate la sesión (token disponible) antes de conectar.
    // Evita el race en cold-load de /auction/:id (connect sin JWT → 401).
    if (authLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    void connectToAuction();

    return () => {
      // Best-effort: no esperamos la respuesta al desmontar
      if (disconnectOnUnmount.current) {
        void post(`/auctions/${auctionId}/disconnect`, {}).catch(() => {
          // Ignorar errores de desconexión al salir
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, authLoading, user]);

  // ── Cargar medios de pago verificados ────────────────────────────────────

  useEffect(() => {
    if (connectState !== 'connected') return;

    async function loadPaymentMethods() {
      try {
        const methods = await get<PaymentMethod[]>('/me/payment-methods');
        const verified = methods.filter((m) => m.status === 'verified');
        setPaymentMethods(verified);
        // Pre-seleccionar el primer medio si solo hay uno
        if (verified.length === 1) {
          setSelectedPaymentMethodId(verified[0].id);
        }
      } catch {
        // Si falla no bloqueamos la pantalla; el usuario puede seguir viendo
      }
    }

    void loadPaymentMethods();
  }, [connectState]);

  // ── Desconexión manual ───────────────────────────────────────────────────

  const handleDisconnect = useCallback(async () => {
    try {
      await post(`/auctions/${auctionId}/disconnect`, {});
      disconnectOnUnmount.current = false;
    } catch {
      // Ignorar errores; igual volvemos atrás
    }
    router.back();
  }, [auctionId, router]);

  // ── Puja ──────────────────────────────────────────────────────────────────

  const handleBid = useCallback(async () => {
    if (!liveStatus?.currentItem) return;
    setBidError(null);

    const amount = parseFloat(bidAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setBidError('Ingresá un importe válido');
      return;
    }

    // Validación local de rango
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

    // Bloquear el botón hasta la confirmación 201 (regla "una puja a la vez")
    setSubmitting(true);
    setBidSuccess(null);

    // Generar Idempotency-Key única para esta puja (formato: userId-itemId-timestamp)
    const idempotencyKey = `${user?.id ?? 'anon'}-${liveStatus.currentItem.itemId}-${Date.now()}`;

    try {
      await post(
        `/items/${liveStatus.currentItem.itemId}/bids`,
        {
          amount,
          paymentMethodId: selectedPaymentMethodId,
          // Pasamos el bestBid conocido para detección de BID_SUPERSEDED en el backend
          knownBestBid: liveStatus.currentItem.bestBid ?? null,
        },
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
          // El backend devuelve details.minAllowed y details.maxAllowed
          const details = (apiError.details ?? {}) as Record<string, number | null>;
          const min = details.minAllowed;
          const max = details.maxAllowed;
          setBidError(
            min !== null && min !== undefined
              ? max !== null && max !== undefined
                ? `Fuera de rango. Mínimo: ${formatCurrency(min)}, Máximo: ${formatCurrency(max)}`
                : `El mínimo permitido es ${formatCurrency(min)}`
              : 'Importe fuera de rango. Refrescá e intentá de nuevo.'
          );
          break;
        }
        case 'BID_SUPERSEDED':
          // Alguien pujó mientras tanto; el polling refrescará el estado
          setBidError('Otro postor pujó antes que vos. Refrescá el estado y volvé a intentar.');
          retryPoll();
          break;
        case 'NOT_CONNECTED':
          setBidError('No estás conectado a esta subasta. Volvé a entrar.');
          setConnectState('error');
          setConnectError('Sesión perdida. Volvé a conectarte.');
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
        case 'PAYMENT_METHOD_NOT_OWNED':
          setBidError('El medio de pago seleccionado no te pertenece.');
          break;
        default:
          setBidError(apiError.message ?? 'Error al registrar la puja. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    liveStatus,
    bidAmount,
    selectedPaymentMethodId,
    user?.id,
    retryPoll,
  ]);

  // ── Renders de estado ─────────────────────────────────────────────────────

  if (connectState === 'idle' || connectState === 'connecting') {
    return <Loading />;
  }

  if (connectState === 'error') {
    return (
      <ErrorView
        message={connectError ?? 'No se pudo conectar a la subasta.'}
        onRetry={() => void connectToAuction()}
      />
    );
  }

  // connectState === 'connected'
  if (pollLoading && !liveStatus) {
    return <Loading />;
  }

  if (pollError && !liveStatus) {
    return (
      <ErrorView
        message="No se pudo cargar el estado de la subasta."
        onRetry={retryPoll}
      />
    );
  }

  const item = liveStatus?.currentItem;
  const canBid =
    connectState === 'connected' &&
    liveStatus?.auctionStatus === 'open' &&
    !!item &&
    paymentMethods.length > 0;

  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Barra de navegación */}
      <View style={styles.navBar}>
        <Button
          title="← Volver"
          variant="ghost"
          onPress={handleDisconnect}
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
        <View style={styles.liveDot} />
        <Text style={styles.statusLabel}>
          {liveStatus?.auctionStatus === 'open' ? 'En curso' : 'Cerrada'}
        </Text>
        {/* Banner de reconexión si el polling falla ≥2 veces (detectado por pollError) */}
        {pollError && (
          <Text style={styles.reconnectingText}>Reconectando…</Text>
        )}
      </View>

      {/* Ítem activo */}
      {item ? (
        <View style={styles.itemCard}>
          <Text style={styles.itemDescription}>{item.catalogDescription}</Text>

          {/* Mejor oferta */}
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

          {/* Rango permitido */}
          <View style={styles.rangeRow}>
            {item.minBidAllowed != null ? (
              <Text style={styles.rangeText}>
                Min: {formatCurrency(item.minBidAllowed)}
              </Text>
            ) : null}
            {item.maxBidAllowed != null ? (
              <Text style={styles.rangeText}>
                Max: {formatCurrency(item.maxBidAllowed)}
              </Text>
            ) : null}
            {item.minBidAllowed === null && item.maxBidAllowed === null ? (
              <Text style={styles.rangeText}>Sin límites de rango</Text>
            ) : null}
          </View>

          {/* Cantidad de pujas */}
          <Text style={styles.bidCount}>{item.bidCount} puja(s)</Text>

          {/* Banner "Te superaron" */}
          {liveStatus?.youWereOutbid && (
            <View style={styles.outbidBanner}>
              <Text style={styles.outbidText}>
                ¡Te superaron! Podés mejorar tu oferta.
              </Text>
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

          {/* Feedback de éxito */}
          {bidSuccess ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{bidSuccess}</Text>
            </View>
          ) : null}

          {/* Feedback de error */}
          {bidError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{bidError}</Text>
            </View>
          ) : null}

          {/* Input de importe */}
          <Text style={styles.inputLabel}>Importe a pujar</Text>
          <TextInput
            style={styles.amountInput}
            value={bidAmount}
            onChangeText={(t) => {
              setBidAmount(t);
              setBidError(null);
            }}
            placeholder={
              item?.minBidAllowed != null
                ? `Mín: ${formatCurrency(item.minBidAllowed)}`
                : 'Importe'
            }
            keyboardType="decimal-pad"
            editable={!submitting}
            accessibilityLabel="Importe de la puja"
          />

          {/* Selector de medio de pago */}
          <Text style={styles.inputLabel}>Medio de pago</Text>
          <TouchableOpacity
            style={styles.paymentSelector}
            onPress={() => setShowPaymentSelector((v) => !v)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Seleccionar medio de pago"
          >
            <Text style={styles.paymentSelectorText}>
              {selectedMethod
                ? `${paymentMethodLabel(selectedMethod)}`
                : 'Seleccioná un medio de pago'}
            </Text>
            <Text style={styles.paymentSelectorChevron}>
              {showPaymentSelector ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Lista desplegable de medios de pago */}
          {showPaymentSelector && (
            <View style={styles.paymentDropdown}>
              <FlatList
                data={paymentMethods}
                keyExtractor={(m) => String(m.id)}
                renderItem={({ item: method }) => (
                  <TouchableOpacity
                    style={[
                      styles.paymentOption,
                      method.id === selectedPaymentMethodId && styles.paymentOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethodId(method.id);
                      setShowPaymentSelector(false);
                      setBidError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.paymentOptionText,
                        method.id === selectedPaymentMethodId &&
                          styles.paymentOptionTextSelected,
                      ]}
                    >
                      {paymentMethodLabel(method)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Botón Pujar — deshabilitado mientras hay una puja en curso */}
          <Button
            title={submitting ? 'Registrando…' : 'Pujar'}
            onPress={handleBid}
            loading={submitting}
            disabled={submitting}
            style={styles.bidButton}
          />
        </View>
      ) : connectState === 'connected' && paymentMethods.length === 0 ? (
        // Sin medios de pago verificados — modo solo lectura
        <View style={styles.noBidBanner}>
          <Text style={styles.noBidText}>
            Necesitás un medio de pago verificado para pujar. Agregalo desde tu perfil.
          </Text>
        </View>
      ) : connectState === 'connected' && liveStatus?.auctionStatus === 'closed' ? (
        <View style={styles.noBidBanner}>
          <Text style={styles.noBidText}>La subasta está cerrada.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formatea un número al estilo moneda argentina. */
function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

/** Etiqueta legible para un medio de pago. */
function paymentMethodLabel(method: PaymentMethod): string {
  const typeLabels: Record<string, string> = {
    bank_account: 'Cuenta bancaria',
    credit_card: 'Tarjeta de crédito',
    certified_check: 'Cheque certificado',
  };
  const type = typeLabels[method.type] ?? method.type;
  const extra = method.bank ? ` — ${method.bank}` : '';
  return `${type}${extra} (${method.currency})`;
}

/** Traduce errores de conexión a mensajes amigables. */
function mapConnectError(err: ApiError): string {
  switch (err.code) {
    case 'NOT_ADMITTED':
      return 'Tu cuenta no está verificada aún.';
    case 'CLIENT_BLOCKED':
      return 'Tu cuenta está bloqueada. Regularizá tu situación para continuar.';
    case 'CATEGORY_INSUFFICIENT':
      return 'Tu categoría no es suficiente para esta subasta.';
    case 'NO_VERIFIED_PAYMENT_METHOD':
      return 'Necesitás al menos un medio de pago verificado para conectarte.';
    case 'VALIDATION_ERROR':
      return 'La subasta no está abierta en este momento.';
    default:
      return err.message ?? 'No se pudo conectar a la subasta. Intentá de nuevo.';
  }
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
    paddingTop: 60,
    paddingBottom: 40,
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
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.feedback.live,
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
    marginLeft: spacing.xs,
  },
  itemCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    flexWrap: 'wrap',
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
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.warning,
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
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.success,
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
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  inputLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
  },
  paymentSelector: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  paymentSelectorText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  paymentSelectorChevron: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  paymentDropdown: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    backgroundColor: colors.background.card,
    marginBottom: spacing.sm,
    maxHeight: 180,
    overflow: 'hidden',
  },
  paymentOption: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  paymentOptionSelected: {
    backgroundColor: colors.background.highlight,
  },
  paymentOptionText: {
    ...typography.body,
    color: colors.text.primary,
  },
  paymentOptionTextSelected: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  bidButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand.accent,
  },
  noBidBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 10,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.warning,
  },
  noBidText: {
    ...typography.body,
    color: colors.feedback.warning,
    lineHeight: 22,
  },
});
