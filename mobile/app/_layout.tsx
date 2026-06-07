import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthContext';
import { OfflineBanner } from '@/components/OfflineBanner';

/**
 * Root layout: envuelve toda la app en AuthProvider + SafeAreaProvider.
 * OfflineBanner se superpone globalmente sobre cualquier pantalla.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <OfflineBanner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
