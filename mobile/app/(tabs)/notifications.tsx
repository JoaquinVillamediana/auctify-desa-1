import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { get, post } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing } from '@/theme';
import type { Notification } from '@/api/types';

/**
 * Notificaciones del cliente (F09).
 * TODO → docs/features/F09-notifications.md
 *
 * Esta pantalla mostrara:
 * - Lista de notificaciones (GET /me/notifications)
 * - Badge de no leidas
 * - Marcar como leida al tocar (POST /notifications/{id}/read)
 * Tipos: admission, auction_winner, inclusion_proposal, penalty, item_rejected, info
 */
export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO → F09: reemplazar con GET /me/notifications cuando el alias /me este disponible
    // Por ahora placeholder
    setLoading(false);
  }, []);

  async function markRead(id: number) {
    try {
      await post(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // Ignorar silenciosamente — el proximo refresh corregira el estado
    }
  }

  if (loading) return <Loading />;

  if (error) {
    return (
      <ErrorView
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          // TODO: re-fetch
          setLoading(false);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notificaciones</Text>
        {notifications.filter((n) => !n.read).length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {notifications.filter((n) => !n.read).length}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin notificaciones"
            message="Acá aparecerán tus notificaciones: admisión, pujas ganadas, propuestas de inclusión y más."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notifCard, !item.read && styles.notifCardUnread]}
            onPress={() => !item.read && markRead(item.id)}
            activeOpacity={0.8}
          >
            {!item.read && <View style={styles.unreadDot} />}
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifMessage}>{item.message}</Text>
              <Text style={styles.notifDate}>
                {new Date(item.createdAt).toLocaleDateString('es-AR')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.brand.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  list: {
    padding: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.card,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  notifCardUnread: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.background.highlight,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand.primary,
    marginTop: 6,
    marginRight: spacing.sm,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  notifMessage: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  notifDate: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
