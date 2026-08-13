import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Card, IconButton, Text } from 'react-native-paper';
import IconBadge from '../components/IconBadge';
import { getNotificationMeta, useNotifications } from '../context/NotificationsContext';
import { colors } from '../theme/colors';
import { useNotificationRefetch } from '../hooks/useNotificationRefetch';
import type { RootStackScreenProps } from '../navigation/types';

const formatTimestamp = (isoDate: string) =>
  new Date(isoDate).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function NotificationsScreen({ navigation }: RootStackScreenProps<'Notifications'>) {
  const { notifications, isLoading, markAsRead, refresh } = useNotifications();

  // Unthrottled: a new notification (e.g. a card payment alert) must show up the instant
  // the student opens this screen, not up to 30s later.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useNotificationRefetch(refresh);

  const canGoBack = navigation.canGoBack();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        {canGoBack && (
          <IconButton icon="arrow-left" onPress={() => navigation.goBack()} style={styles.backButton} />
        )}
        <Text variant="titleLarge" style={styles.headerTitle}>
          Notifications
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
      >
        {notifications.length > 0 ? (
          notifications.map((notification) => {
            const meta = getNotificationMeta(notification.type);
            return (
              <TouchableOpacity
                key={notification.id}
                style={[styles.row, notification.read && styles.rowRead]}
                onPress={() => markAsRead(notification.id)}
                activeOpacity={0.7}
              >
                <IconBadge icon={meta.icon} color={meta.color} size={40} />
                <View style={styles.rowMiddle}>
                  <Text style={styles.rowTitle}>{notification.title}</Text>
                  <Text style={styles.rowMessage}>{notification.message}</Text>
                  <Text style={styles.rowTimestamp}>{formatTimestamp(notification.createdAt)}</Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })
        ) : (
          <Card style={styles.emptyCard} mode="elevated">
            <Card.Content style={styles.emptyState}>
              <Avatar.Icon
                icon="bell-outline"
                size={56}
                style={styles.emptyIcon}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>You&apos;re all caught up.</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginLeft: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowRead: {
    opacity: 0.5,
  },
  rowMiddle: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontWeight: '700',
    color: colors.heading,
    fontSize: 14,
  },
  rowMessage: {
    fontSize: 13,
    color: colors.label,
    marginTop: 2,
  },
  rowTimestamp: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
    marginTop: 6,
  },
  emptyCard: {
    borderRadius: 16,
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    backgroundColor: colors.background,
    marginBottom: 14,
  },
  emptyTitle: {
    fontWeight: '700',
    color: colors.heading,
    marginBottom: 6,
  },
  emptySubtitle: {
    color: colors.muted,
  },
});
