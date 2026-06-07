import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface EmptyStateProps {
  title: string;
  message?: string;
}

/** Estado vacío centrado (listas sin resultados). */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.heading3, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
});
