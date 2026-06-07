import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { ApiError } from '@/api/client';

/**
 * Pantalla de login (F01).
 * Campos: documento (DNI) + contraseña.
 * Maneja: 401 credenciales inválidas, 403 NOT_ADMITTED / CLIENT_BLOCKED.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [document, setDocument] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ document?: string; password?: string; general?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!document.trim()) next.document = 'El DNI es obligatorio';
    if (!password) next.password = 'La contraseña es obligatoria';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await login(document.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'NOT_ADMITTED') {
        // Redirigir a pantalla "pendiente de admision"
        router.replace('/(auth)/pending');
        return;
      }

      if (apiError.code === 'CLIENT_BLOCKED') {
        setErrors({ general: 'Tu cuenta está bloqueada por una multa pendiente. Contactá a la empresa.' });
        return;
      }

      // 401 u otro error de credenciales
      setErrors({ general: apiError.message ?? 'Credenciales inválidas. Verificá tu DNI y contraseña.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Auctify</Text>
      <Text style={styles.subtitle}>Iniciá sesión para pujar</Text>

      {errors.general ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      ) : null}

      <Field
        label="DNI / Documento"
        required
        value={document}
        onChangeText={setDocument}
        error={errors.document}
        placeholder="30111222"
        keyboardType="numeric"
        autoCapitalize="none"
      />

      <Field
        label="Contraseña"
        required
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="••••••••"
        secureTextEntry
      />

      <Button
        title="Ingresar"
        onPress={handleLogin}
        loading={loading}
        style={styles.button}
      />

      <Link href="/(auth)/register" style={styles.link}>
        <Text style={styles.linkText}>¿No tenés cuenta? Registrate</Text>
      </Link>

      <Link href="/(auth)/activate" style={styles.link}>
        <Text style={styles.linkText}>Tengo un token de activación</Text>
      </Link>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading1,
    color: colors.brand.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  button: {
    marginTop: spacing.md,
  },
  link: {
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.brand.primary,
    textDecorationLine: 'underline',
  },
});
