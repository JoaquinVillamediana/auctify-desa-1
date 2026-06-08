import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, post } from '@/api/client';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { PayoutAccount } from '@/api/types';

/**
 * Cuentas de cobro del dueño (F11).
 * Lista y permite declarar nuevas cuentas.
 */
export default function PayoutAccountsScreen() {
  const { ownerId } = useLocalSearchParams<{ ownerId: string }>();
  const router = useRouter();

  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario nueva cuenta
  const [showForm, setShowForm] = useState(false);
  const [bank, setBank] = useState('');
  const [cbuOrIban, setCbuOrIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    get<PayoutAccount[]>(`/owners/${ownerId}/payout-accounts`)
      .then(setAccounts)
      .catch(() => setError('No se pudieron cargar las cuentas.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [ownerId]);

  async function addAccount() {
    if (!bank.trim() || !cbuOrIban.trim() || !accountHolder.trim()) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const newAccount = await post<PayoutAccount>(`/owners/${ownerId}/payout-accounts`, {
        bank: bank.trim(),
        cbuOrIban: cbuOrIban.trim(),
        accountHolder: accountHolder.trim(),
        currency,
      });
      setAccounts((prev) => [newAccount, ...prev]);
      setShowForm(false);
      setBank('');
      setCbuOrIban('');
      setAccountHolder('');
      Alert.alert('Listo', 'Cuenta declarada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo declarar la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={load} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Button title="← Volver" variant="ghost" onPress={() => router.back()} />
        <Text style={styles.headerTitle}>Cuentas de cobro</Text>
      </View>

      {/* Advertencia */}
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>
          ⚠️ Declarar tu cuenta antes del inicio de la subasta para recibir el pago de la venta.
        </Text>
      </View>

      {/* Formulario nuevo */}
      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Nueva cuenta</Text>
          <TextInput style={styles.input} placeholder="Banco" value={bank} onChangeText={setBank} />
          <TextInput style={styles.input} placeholder="CBU o IBAN" value={cbuOrIban} onChangeText={setCbuOrIban} />
          <TextInput style={styles.input} placeholder="Titular de la cuenta" value={accountHolder} onChangeText={setAccountHolder} />

          <View style={styles.currencyRow}>
            <Button
              title="ARS"
              variant={currency === 'ARS' ? 'primary' : 'outline'}
              onPress={() => setCurrency('ARS')}
              style={styles.currencyButton}
            />
            <Button
              title="USD"
              variant={currency === 'USD' ? 'primary' : 'outline'}
              onPress={() => setCurrency('USD')}
              style={styles.currencyButton}
            />
          </View>

          <View style={styles.formActions}>
            <Button title="Cancelar" variant="ghost" onPress={() => setShowForm(false)} style={styles.formButton} />
            <Button title="Guardar" onPress={addAccount} loading={saving} style={styles.formButton} />
          </View>
        </View>
      )}

      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={accounts.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={
          !showForm ? (
            <Button title="+ Agregar cuenta" onPress={() => setShowForm(true)} style={styles.addButton} />
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin cuentas declaradas"
            message="Declará una cuenta para recibir el pago de tus ventas."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.bank}>{item.bank}</Text>
              <Text style={styles.currencyBadge}>{item.currency}</Text>
            </View>
            <Text style={styles.cbu}>{item.cbuOrIban}</Text>
            <Text style={styles.holder}>{item.accountHolder}</Text>
            <Text style={styles.date}>
              Declarada el {new Date(item.declaredAt).toLocaleDateString('es-AR', { dateStyle: 'medium' })}
            </Text>
          </View>
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
  warningBanner: {
    backgroundColor: colors.feedback.warningBackground,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: 10,
  },
  warningText: { ...typography.bodySmall, color: colors.feedback.warning },
  form: {
    backgroundColor: colors.background.card,
    margin: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  formTitle: { ...typography.label, color: colors.text.secondary, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase' },
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
  currencyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  currencyButton: { flex: 1 },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formButton: { flex: 1 },
  addButton: { margin: spacing.md, marginBottom: 0 },
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
  bank: { ...typography.body, color: colors.text.primary, fontWeight: '700' },
  currencyBadge: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },
  cbu: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 2 },
  holder: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 4 },
  date: { ...typography.caption, color: colors.text.tertiary },
});
