import { Redirect } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { Loading } from '@/components/Loading';

/**
 * Pantalla de bootstrap: espera a que se hidrate la sesión (JWT desde storage) y
 * redirige de forma **declarativa** con <Redirect> (seguro respecto al montaje del
 * navegador — evita "Attempted to navigate before mounting the Root Layout").
 * - Sesión válida → /(tabs)
 * - Sin sesión → /(auth)/login
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}
