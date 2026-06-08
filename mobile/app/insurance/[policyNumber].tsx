import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, post } from '@/api/client';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { Insurance } from '@/api/types';

/**
 * Detalle de póliza de seguro y aumento de cobertura (F11).
 */
export default function InsuranceScreen() {
  const { policyNumber } = useLocalSearchParams<{ policyNumber: string }>();
  const router = useRouter();

  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de aumento
  const [newAmount, setNewAmount] = useState('');
  const [increasing, setIncreasing] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    get<Insurance>(`/insurance/${policyNumber}`)
      .then(setInsurance)
      .catch(() => setError('No se pudo cargar la póliza.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [policyNumber]);

  async function increaseCoverage() {
    const amount = parseFloat(newAmount);

    if (isNaN(amount) || amount <= 0) {
      setAmountError('Ingresá un monto válido.');
      return;
    }

    if (insurance && amount <= insurance.amount) {
      setAmountError(`Debe ser mayor al monto actual ($${insurance.amount.toLocaleString('es-AR')}).`);
      return;
    }

    setAmountError(null);
    setIncreasing(true);

    try {
      const result = await post<{
        policyNumber: string;
        previousAmount: number;
        newAmount: number;
        premiumDelta: number;
        status: string;
      }>(`/insurance/${policyNumber}/coverage-increase`, { newAmount: amount });

      Alert.alert(
        'Cobertura actualizada',
        `Nueva cobertura: $${result.newAmount.toLocaleString('es-AR')}. Premio adicional: $${result.premiumDelta.toFixed(2)}.`
      );
      setInsurance((prev) => prev ? { ...prev, amount: result.newAmount } : null);
      setNewAmount('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo aumentar la cobertura.');
    } finally {
      setIncreasing(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !insurance) return <ErrorView message={error ?? 'Error'} onRetry={load} />;

  const estimatedDelta = newAmount && parseFloat(newAmount) > insurance.amount
    ? ((parseFloat(newAmount) - insurance.amount) * 0.02).toFixed(2)
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Button title="← Volver" variant="ghost" onPress={() => router.back()} style={styles.backButton} />
      <Text style={styles.title}>Seguro del bien</Text>

      {/* Info de la póliza */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Póliza</Text>
        <DetailRow label="N° de póliza" value={insurance.policyNumber} />
        <DetailRow label="Compañía" value={insurance.company} />
        <DetailRow label="Cobertura actual" value={`$${insurance.amount.toLocaleString('es-AR')}`} />
        {insurance.combinedPolicy && (
          <View style={styles.combinedBadge}>
            <Text style={styles.combinedText}>Póliza combinada — cubre varios bienes del mismo dueño</Text>
          </View>
        )}
      </View>

      {/* Aumentar cobertura */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aumentar cobertura</Text>
        <Text style={styles.hint}>Monto actual: ${insurance.amount.toLocaleString('es-AR')}</Text>

        <TextInput
          style={[styles.input, amountError ? styles.inputError : null]}
          placeholder="Nuevo monto de cobertura"
          value={newAmount}
          onChangeText={(t) => {
            setNewAmount(t);
            setAmountError(null);
          }}
          keyboardType="decimal-pad"
        />

        {amountError && <Text style={styles.errorText}>{amountError}</Text>}

        {estimatedDelta && (
          <Text style={styles.deltaText}>Premio estimado: ${estimatedDelta}</Text>
        )}

        <Button
          title="Confirmar aumento"
          onPress={increaseCoverage}
          loading={increasing}
          style={styles.button}
        />
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
  title: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.md },
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
  combinedBadge: {
    backgroundColor: colors.brand.primaryLight,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  combinedText: { ...typography.bodySmall, color: colors.brand.primary },
  hint: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  inputError: { borderColor: colors.border.error },
  errorText: { ...typography.caption, color: colors.feedback.error, marginBottom: spacing.xs },
  deltaText: { ...typography.bodySmall, color: colors.feedback.success, marginBottom: spacing.sm },
  button: {},
});
