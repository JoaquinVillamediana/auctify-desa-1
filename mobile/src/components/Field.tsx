import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface FieldProps extends TextInputProps {
  label: string;
  /** Marca el campo como obligatorio (agrega `*`). */
  required?: boolean;
  /** Mensaje de error del campo (resalta el borde). */
  error?: string;
}

/**
 * Campo de formulario con label, marca de obligatorio y mensaje de error.
 * Acepta todas las props de TextInput.
 */
export function Field({ label, required = false, error, style, ...inputProps }: FieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TextInput
        style={[styles.input, !!error && styles.inputError, style]}
        placeholderTextColor={colors.text.tertiary}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.text.primary, marginBottom: spacing.xs },
  required: { color: colors.feedback.error },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
  },
  inputError: { borderColor: colors.border.error },
  error: { ...typography.caption, color: colors.feedback.error, marginTop: spacing.xs },
});
