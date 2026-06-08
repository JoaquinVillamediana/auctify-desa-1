import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, typography } from '@/theme';

/**
 * Bottom tabs de la app principal.
 * Tabs: Subastas | Mis articulos | Metricas | Notificaciones | Perfil
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.background.primary,
          borderTopColor: colors.border.default,
        },
        tabBarLabelStyle: {
          ...typography.caption,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Subastas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔨</Text>,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Mis artículos',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="metrics"
        options={{
          title: 'Métricas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notificaciones',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔔</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}
