import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Loading } from '@/components/Loading';

/**
 * Pantalla de bootstrap: hidrata el token de SecureStore y redirige.
 * - Si hay sesion valida → /(tabs)
 * - Si no → /(auth)/login
 */
export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  // Mostrar spinner mientras se hidrata la sesion desde SecureStore
  return <Loading />;
}
