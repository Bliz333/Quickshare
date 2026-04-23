import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '../lib/format';
import { Theme } from '../theme';
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
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.heroCard}>
        <View style={s.heroIcon}><Text style={s.heroIconText}>{(profile.nickname || profile.username || 'Q').slice(0, 1).toUpperCase()}</Text></View>
        <Text style={s.heroTitle}>Account</Text>
        <Text style={s.heroSubtitle}>{profile.nickname || profile.username}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Identity</Text>
        <InfoRow label="Username" value={profile.username} />
        <InfoRow label="Nickname" value={profile.nickname || '-'} />
        <InfoRow label="Email" value={profile.email || '-'} />
        <InfoRow label="Role" value={profile.role || 'USER'} />
        <InfoRow label="VIP expiry" value={profile.vipExpireTime || '-'} />
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Quota</Text>
        <InfoRow label="Storage used" value={formatBytes(profile.storageUsed)} />
        <InfoRow label="Storage limit" value={formatBytes(profile.storageLimit)} />
        <InfoRow label="Download used" value={String(profile.downloadUsed ?? 0)} />
        <InfoRow label="Download limit" value={String(profile.downloadLimit ?? 0)} />
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Environment</Text>
        <InfoRow label="API base" value={apiBaseUrl} />
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Notifications</Text>
        {notificationLoading ? <Text style={s.metaText}>Refreshing notifications…</Text> : null}
        {notificationError ? <Text style={s.errorText}>{notificationError}</Text> : null}

        <Text style={s.sectionLabel}>Personal</Text>
        {personalNotifications.length ? personalNotifications.map((notification) => (
          <NotificationCard key={`personal-${notification.id}`} notification={notification} />
        )) : <Text style={s.metaText}>No personal notifications yet.</Text>}

        <Text style={s.sectionLabel}>Global</Text>
        {globalNotifications.length ? globalNotifications.map((notification) => (
          <NotificationCard key={`global-${notification.id}`} notification={notification} />
        )) : <Text style={s.metaText}>No global notifications yet.</Text>}
      </View>

      <Pressable onPress={onSignOut} style={({ pressed }) => [s.signOutButton, pressed ? s.signOutPressed : null]}>
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

function NotificationCard({ notification }: { notification: QuickShareNotification }) {
  return (
    <View style={s.notificationCard}>
      <Text style={s.notificationTitle}>{notification.subject || 'Untitled notification'}</Text>
      <Text style={s.metaText}>{notification.createTime || '-'}</Text>
      <Text style={s.notificationBody}>{notification.body || '-'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: {
    gap: Theme.space6,
    paddingBottom: Theme.space24,
  },
  heroCard: {
    backgroundColor: Theme.surfaceTintDark,
    borderRadius: Theme.radius3xl,
    padding: Theme.space12,
    alignItems: 'center',
    gap: Theme.space4,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.radius2xl,
    backgroundColor: Theme.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSize2xl,
    fontWeight: '800',
  },
  heroTitle: {
    color: Theme.text,
    fontSize: Theme.fontSize2xl,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
  },
  card: {
    backgroundColor: Theme.surface,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    gap: Theme.space5,
    padding: Theme.space9,
  },
  eyebrow: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeSm,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    gap: Theme.space2,
    backgroundColor: Theme.surfaceSunken,
    borderRadius: Theme.radiusLg,
    padding: Theme.space5,
  },
  label: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeSm,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  value: {
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
  },
  sectionLabel: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeSm,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  notificationCard: {
    backgroundColor: Theme.surfaceSunken,
    borderColor: Theme.borderStrong,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    gap: Theme.space3,
    padding: Theme.space6,
  },
  notificationTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  notificationBody: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
    lineHeight: 18,
  },
  metaText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeSm,
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: Theme.danger,
    borderRadius: Theme.radiusXl,
    justifyContent: 'center',
    minHeight: Theme.touchMin,
  },
  signOutPressed: {
    opacity: 0.88,
  },
  signOutText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeMd,
    fontWeight: '800',
  },
});
