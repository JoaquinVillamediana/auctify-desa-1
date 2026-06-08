import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Loading } from '@/components/Loading';

/**
 * Root layout: carga las fuentes del diseño (Manrope + Inter, del Figma `Auctify - DA1`),
 * y envuelve la app en AuthProvider + SafeAreaProvider.
 * OfflineBanner se superpone globalmente sobre cualquier pantalla.
 */
/**
 * Espera a que termine la hidratación de la sesión (JWT desde storage) antes de
 * renderizar cualquier pantalla. Evita el race en el que una pantalla dispara un
 * request autenticado antes de que el token esté disponible (p.ej. abrir /auction/:id
 * directo en web → 401).
 */
function RootNavigator() {
  const { loading } = useAuth();
  if (loading) return <Loading message="Cargando…" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Esperamos a las fuentes; si fallan, igual renderizamos (fallback a fuente del sistema).
  if (!fontsLoaded && !fontError) {
    return <Loading message="Cargando…" />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <OfflineBanner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
