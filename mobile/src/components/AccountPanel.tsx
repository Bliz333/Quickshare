import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '../lib/format';
import type { QuickShareNotification, QuickShareUser } from '../types/quickshare';

interface AccountPanelProps {
  apiBaseUrl: string;
  globalNotifications: QuickShareNotification[];
  notificationError: string | null;
  notificationLoading: boolean;
  onSignOut: () => void;
  personalNotifications: QuickShareNotification[];
  profile: QuickShareUser;
}

export function AccountPanel({
  apiBaseUrl,
  globalNotifications,
  notificationError,
  notificationLoading,
  onSignOut,
  personalNotifications,
  profile,
}: AccountPanelProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Account</Text>
        <InfoRow label="Username" value={profile.username} />
        <InfoRow label="Nickname" value={profile.nickname || '-'} />
        <InfoRow label="Email" value={profile.email || '-'} />
        <InfoRow label="Role" value={profile.role || 'USER'} />
        <InfoRow label="VIP expiry" value={profile.vipExpireTime || '-'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Quota</Text>
        <InfoRow label="Storage used" value={formatBytes(profile.storageUsed)} />
        <InfoRow label="Storage limit" value={formatBytes(profile.storageLimit)} />
        <InfoRow label="Download used" value={String(profile.downloadUsed ?? 0)} />
        <InfoRow label="Download limit" value={String(profile.downloadLimit ?? 0)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Environment</Text>
        <InfoRow label="API base" value={apiBaseUrl} />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Notifications</Text>
        {notificationLoading ? <Text style={styles.metaText}>Refreshing notifications…</Text> : null}
        {notificationError ? <Text style={styles.errorText}>{notificationError}</Text> : null}

        <Text style={styles.sectionLabel}>Personal</Text>
        {personalNotifications.length ? personalNotifications.map((notification) => (
          <NotificationCard key={`personal-${notification.id}`} notification={notification} />
        )) : <Text style={styles.metaText}>No personal notifications yet.</Text>}

        <Text style={styles.sectionLabel}>Global</Text>
        {globalNotifications.length ? globalNotifications.map((notification) => (
          <NotificationCard key={`global-${notification.id}`} notification={notification} />
        )) : <Text style={styles.metaText}>No global notifications yet.</Text>}
      </View>

      <Pressable onPress={onSignOut} style={({ pressed }) => [styles.signOutButton, pressed ? styles.signOutPressed : null]}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function NotificationCard({ notification }: { notification: QuickShareNotification }) {
  return (
    <View style={styles.notificationCard}>
      <Text style={styles.notificationTitle}>{notification.subject || 'Untitled notification'}</Text>
      <Text style={styles.metaText}>{notification.createTime || '-'}</Text>
      <Text style={styles.notificationBody}>{notification.body || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  row: {
    gap: 4,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    color: '#0f172a',
    fontSize: 14,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  notificationCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  notificationTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  notificationBody: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  metaText: {
    color: '#64748b',
    fontSize: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 48,
  },
  signOutPressed: {
    opacity: 0.88,
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
