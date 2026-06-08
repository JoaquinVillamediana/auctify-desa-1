import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, patch, post } from '@/api/client';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { SaleRecord, PaymentMethod } from '@/api/types';
import type { ApiError } from '@/api/client';

/**
 * Detalle de compra (F07).
 * Muestra desglose, permite elegir envío/retiro y pagar.
 */
export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [purchase, setPurchase] = useState<SaleRecord | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del formulario de envío
  const [pickupInPerson, setPickupInPerson] = useState<boolean | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [savingShipping, setSavingShipping] = useState(false);

  // Estado del pago
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([
      get<SaleRecord>(`/sale-records/${id}`).catch(() => null),
      get<PaymentMethod[]>('/me/payment-methods').catch(() => []),
    ]).then(([saleRecord, methods]) => {
      if (saleRecord) {
        setPurchase(saleRecord);
        setPickupInPerson(saleRecord.pickupInPerson);
        setShippingAddress(saleRecord.shippingAddress ?? '');
      } else {
        setError('No se encontró la compra.');
      }
      const verified = (methods as PaymentMethod[]).filter((m) => m.status === 'verified');
      setPaymentMethods(verified);
    }).finally(() => setLoading(false));
  }, [id]);

  async function saveShipping() {
    if (pickupInPerson === null) return;

    if (!pickupInPerson && !shippingAddress.trim()) {
      Alert.alert('Error', 'Ingresá una dirección de envío.');
      return;
    }

    if (pickupInPerson) {
      Alert.alert(
        'Confirmar retiro',
        'Si retirás en persona, perdés la cobertura del seguro del bien. ¿Confirmás?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => doSaveShipping() },
        ]
      );
    } else {
      await doSaveShipping();
    }
  }

  async function doSaveShipping() {
    setSavingShipping(true);
    try {
      const updated = await patch<SaleRecord>(`/sale-records/${id}/shipping`, {
        pickupInPerson,
        shippingAddress: pickupInPerson ? undefined : shippingAddress,
      });
      setPurchase(updated);
      Alert.alert('Listo', 'Modalidad de entrega guardada.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar.');
    } finally {
      setSavingShipping(false);
    }
  }

  async function pay() {
    if (!selectedPaymentMethodId) {
      Alert.alert('Error', 'Seleccioná un medio de pago.');
      return;
    }

    setPaying(true);
    try {
      const updated = await post<SaleRecord>(`/sale-records/${id}/pay`, {
        paymentMethodId: selectedPaymentMethodId,
      });
      setPurchase(updated);
      Alert.alert('¡Pago exitoso!', 'Tu pago fue procesado correctamente.');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'INSUFFICIENT_FUNDS') {
        const details = apiError.details as { penaltyAmount?: number; penaltyId?: number } | undefined;
        Alert.alert(
          'Pago fallido',
          `No se pudo procesar el pago. Se generó una multa de $${details?.penaltyAmount?.toFixed(2) ?? '?'}. Tenés 72 hs para regularizar.`,
          [{ text: 'OK' }]
        );
      } else if (apiError.code === 'NO_VERIFIED_PAYMENT_METHOD') {
        Alert.alert('Error', 'El medio de pago no está verificado.');
      } else if (apiError.code === 'PAYMENT_METHOD_NOT_OWNED') {
        Alert.alert('Error', 'Ese medio de pago no te pertenece.');
      } else {
        Alert.alert('Error', apiError.message ?? 'No se pudo procesar el pago.');
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !purchase) return <ErrorView message={error ?? 'Error'} onRetry={() => router.back()} />;

  const total = purchase.amount + purchase.commission + (purchase.shippingCost ?? 0);
  const isPending = purchase.paymentStatus === 'pending';
  const isPaid = purchase.paymentStatus === 'paid';
  const isFailed = purchase.paymentStatus === 'failed';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button title="← Volver" variant="ghost" onPress={() => router.back()} style={styles.backButton} />

      <Text style={styles.title}>Detalle de compra</Text>

      {/* Estado de pago */}
      <View style={[styles.statusBanner, isPaid ? styles.bannerPaid : isFailed ? styles.bannerFailed : styles.bannerPending]}>
        <Text style={styles.statusText}>
          {isPaid ? '✅ Pagado' : isFailed ? '❌ Pago fallido' : '⏳ Pendiente de pago'}
        </Text>
      </View>

      {/* Desglose */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Desglose</Text>
        <DetailRow label="Importe" value={`$${purchase.amount.toLocaleString('es-AR')}`} />
        <DetailRow label="Comisión" value={`$${purchase.commission.toLocaleString('es-AR')}`} />
        {purchase.shippingCost != null && (
          <DetailRow label="Envío" value={`$${purchase.shippingCost.toLocaleString('es-AR')}`} />
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a pagar</Text>
          <Text style={styles.totalValue}>${total.toLocaleString('es-AR')}</Text>
        </View>
      </View>

      {/* Envío / retiro */}
      {isPending && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modalidad de entrega</Text>

          <View style={styles.radioRow}>
            <Button
              title="Retirar en persona"
              variant={pickupInPerson === true ? 'primary' : 'outline'}
              onPress={() => setPickupInPerson(true)}
              style={styles.radioButton}
            />
            <Button
              title="Envío a domicilio"
              variant={pickupInPerson === false ? 'primary' : 'outline'}
              onPress={() => setPickupInPerson(false)}
              style={styles.radioButton}
            />
          </View>

          {pickupInPerson === false && (
            <TextInput
              style={styles.input}
              placeholder="Dirección de envío"
              value={shippingAddress}
              onChangeText={setShippingAddress}
            />
          )}

          {pickupInPerson === true && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>⚠️ Si retirás en persona, perdés la cobertura del seguro del bien.</Text>
            </View>
          )}

          <Button
            title="Confirmar modalidad"
            onPress={saveShipping}
            loading={savingShipping}
            style={styles.confirmButton}
          />
        </View>
      )}

      {/* Pago */}
      {isPending && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pago</Text>

          {paymentMethods.length === 0 ? (
            <Text style={styles.noMethodText}>No tenés medios de pago verificados. Agregá uno desde tu perfil.</Text>
          ) : (
            <>
              {paymentMethods.map((method) => (
                <TouchablePaymentMethod
                  key={method.id}
                  method={method}
                  selected={selectedPaymentMethodId === method.id}
                  onSelect={() => setSelectedPaymentMethodId(method.id)}
                />
              ))}

              <Button
                title="Confirmar pago"
                onPress={pay}
                loading={paying}
                style={styles.payButton}
              />
            </>
          )}
        </View>
      )}

      {isPaid && purchase.paidAt && (
        <Text style={styles.paidAt}>
          Pagado el {new Date(purchase.paidAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
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

function TouchablePaymentMethod({ method, selected, onSelect }: { method: PaymentMethod; selected: boolean; onSelect: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.paymentMethod, selected && styles.paymentMethodSelected]}
      onPress={onSelect}
    >
      <Text style={styles.paymentMethodText}>
        {method.type === 'bank_account' ? '🏦' : method.type === 'credit_card' ? '💳' : '📄'} {method.detail}
      </Text>
      <Text style={styles.paymentMethodCurrency}>{method.currency}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.md, paddingTop: 60 },
  backButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  title: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.md },
  statusBanner: {
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  bannerPaid: { backgroundColor: colors.feedback.successBackground },
  bannerFailed: { backgroundColor: colors.feedback.errorBackground },
  bannerPending: { backgroundColor: colors.feedback.warningBackground },
  statusText: { ...typography.body, fontWeight: '700', color: colors.text.primary },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  cardTitle: { ...typography.label, color: colors.text.secondary, textTransform: 'uppercase', fontWeight: '700', marginBottom: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  detailLabel: { ...typography.body, color: colors.text.secondary },
  detailValue: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: 4,
  },
  totalLabel: { ...typography.body, color: colors.text.primary, fontWeight: '700' },
  totalValue: { ...typography.heading3, color: colors.brand.primary, fontWeight: '800' },
  radioRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  radioButton: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  warningBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningText: { ...typography.bodySmall, color: colors.feedback.warning },
  confirmButton: { marginTop: 4 },
  noMethodText: { ...typography.body, color: colors.text.secondary, fontStyle: 'italic' },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.xs,
  },
  paymentMethodSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
  },
  paymentMethodText: { ...typography.body, color: colors.text.primary },
  paymentMethodCurrency: { ...typography.caption, color: colors.text.tertiary },
  payButton: { marginTop: spacing.sm },
  paidAt: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.sm },
});
