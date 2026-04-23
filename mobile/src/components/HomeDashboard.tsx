import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '../lib/format';
import { Theme } from '../theme';
import type {
  QuickShareDirectTransportSummary,
  QuickShareShareLink,
  QuickShareTransferDirectSession,
  QuickShareTransferDevice,
  QuickShareTransferPublicShare,
  QuickShareTransferTask,
  QuickShareUser,
} from '../types/quickshare';

interface HomeDashboardProps {
  deviceTransferError: string | null;
  deviceTransferLoading: boolean;
  directSessionError: string | null;
  directSessionLoading: boolean;
  directShareLoading: boolean;
  directShareError: string | null;
  devices: QuickShareTransferDevice[];
  incomingTasks: QuickShareTransferTask[];
  outgoingTasks: QuickShareTransferTask[];
  latestDirectControlMessage: string | null;
  latestIncomingDirectFile: string | null;
  latestDirectTransport: QuickShareDirectTransportSummary | null;
  latestShare: QuickShareShareLink | null;
  latestDirectSession: QuickShareTransferDirectSession | null;
  latestTransferPickup: QuickShareTransferPublicShare | null;
  onCreateDirectShare: () => void;
  onDeleteTransferTask: (task: QuickShareTransferTask) => void;
  onPrepareDirectSession: (deviceId: string) => void;
  onDownloadIncomingTransfer: (task: QuickShareTransferTask) => void;
  onSaveIncomingDirectFile: () => void;
  onSaveIncomingTransfer: (task: QuickShareTransferTask) => void;
  onSendToDevice: (deviceId: string) => void;
  onGoToGoogleLogin: () => void;
  onGoToFiles: () => void;
  onGoToPricing: () => void;
  onGoToShare: () => void;
  onGoToAccount: () => void;
  profile: QuickShareUser | null;
  syncLoading: boolean;
  transferTaskActionError: string | null;
  transferTaskActionLoadingId: number | null;
}

export function HomeDashboard({
  deviceTransferError,
  deviceTransferLoading,
  directSessionError,
  directSessionLoading,
  directShareLoading,
  directShareError,
  devices,
  incomingTasks,
  outgoingTasks,
  latestDirectControlMessage,
  latestIncomingDirectFile,
  latestDirectTransport,
  latestShare,
  latestDirectSession,
  latestTransferPickup,
  onCreateDirectShare,
  onDeleteTransferTask,
  onPrepareDirectSession,
  onDownloadIncomingTransfer,
  onSaveIncomingDirectFile,
  onSaveIncomingTransfer,
  onSendToDevice,
  onGoToGoogleLogin,
  onGoToFiles,
  onGoToPricing,
  onGoToShare,
  onGoToAccount,
  profile,
  syncLoading,
  transferTaskActionError,
  transferTaskActionLoadingId,
}: HomeDashboardProps) {
  const displayName = profile?.nickname || profile?.username || 'Guest';

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.heroCard}>
        <View style={s.heroIconWrap}>
          <View style={s.heroIcon}>
            <Text style={s.heroIconText}>Q</Text>
          </View>
        </View>
        <Text style={s.heroEyebrow}>QuickShare Mobile</Text>
        <Text style={s.heroTitle}>Hi, {displayName}</Text>
        <Text style={s.heroText}>
          Share files instantly, manage your cloud storage, and connect your devices.
        </Text>
      </View>

      <View style={s.quickActionsRow}>
        <QuickAction icon="↗" label="Direct Share" tint={Theme.primary08} tintDark={Theme.primary14} tintText={Theme.primary} onPress={onCreateDirectShare} />
        <QuickAction icon="☰" label="My Files" tint={Theme.success10} tintDark={Theme.success05} tintText={Theme.success} onPress={onGoToFiles} />
        <QuickAction icon="⬡" label="Share Center" tint={Theme.accent10} tintDark={Theme.accent18} tintText={Theme.accent} onPress={onGoToShare} />
      </View>

      <View style={s.quickActionsRow}>
        <QuickAction icon="◎" label="Account" tint={Theme.primary08} tintDark={Theme.primary14} tintText={Theme.primaryDark} onPress={onGoToAccount} />
        <QuickAction icon="★" label="Plans" tint={Theme.warning08} tintDark={Theme.warning08} tintText={Theme.warning} onPress={onGoToPricing} />
        {!profile ? <QuickAction icon="G" label="Google Sign-in" tint={Theme.success10} tintDark={Theme.success05} tintText={Theme.success} onPress={onGoToGoogleLogin} /> : null}
      </View>

      {profile ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Storage</Text>
          <View style={s.metricsRow}>
            <View style={[s.metricChip, { backgroundColor: Theme.primary06 }]}>
              <Text style={s.metricChipLabel}>Used</Text>
              <Text style={[s.metricChipValue, { color: Theme.primaryDark }]}>{formatBytes(profile.storageUsed)}</Text>
            </View>
            <View style={[s.metricChip, { backgroundColor: Theme.primary06 }]}>
              <Text style={s.metricChipLabel}>Limit</Text>
              <Text style={[s.metricChipValue, { color: Theme.primaryDark }]}>{formatBytes(profile.storageLimit)}</Text>
            </View>
            <View style={[s.metricChip, { backgroundColor: Theme.success10 }]}>
              <Text style={s.metricChipLabel}>Downloads</Text>
              <Text style={[s.metricChipValue, { color: Theme.successDark }]}>{profile.downloadUsed ?? 0}/{profile.downloadLimit ?? 0}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Guest mode</Text>
          <Text style={s.bodyText}>You can upload, create share links, open public shares, and check pickup tokens without signing in.</Text>
          <Text style={s.bodyText}>Sign in only when you want to use your personal netdisk.</Text>
        </View>
      )}

      {latestShare ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Latest share link</Text>
          <Text style={s.cardTitle}>{latestShare.fileName || latestShare.shareCode}</Text>
          <View style={s.chipRow}>
            <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
              <Text style={s.metaChipLabel}>Share code</Text>
              <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{latestShare.shareCode}</Text>
            </View>
            <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
              <Text style={s.metaChipLabel}>Extract code</Text>
              <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{latestShare.extractCode || 'auto-generated'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {latestDirectSession ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Latest direct session</Text>
          <View style={s.chipRow}>
            <View style={[s.metaChip, { backgroundColor: Theme.accent10 }]}>
              <Text style={s.metaChipLabel}>Pair session</Text>
              <Text style={[s.metaChipValue, { color: Theme.accent }]}>{latestDirectSession.pairSessionId || '-'}</Text>
            </View>
            <View style={[s.metaChip, { backgroundColor: Theme.accent10 }]}>
              <Text style={s.metaChipLabel}>Peer</Text>
              <Text style={[s.metaChipValue, { color: Theme.accent }]}>{latestDirectSession.peerLabel || latestDirectSession.peerDeviceId || '-'}</Text>
            </View>
          </View>
          {latestDirectControlMessage ? <Text style={s.bodyText}>Last control message: {latestDirectControlMessage}</Text> : null}
          {latestIncomingDirectFile ? (
            <View style={s.actionRail}>
              <Text style={s.bodyText}>Incoming file ready: {latestIncomingDirectFile}</Text>
              <Pressable onPress={onSaveIncomingDirectFile} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
                <Text style={s.filledBtnText}>Save incoming file</Text>
              </Pressable>
            </View>
          ) : null}
          {latestDirectTransport ? (
            <View style={s.statusGrid}>
              <StatusDot label="Connection" value={latestDirectTransport.connectionState || '-'} color={latestDirectTransport.connectionState === 'connected' ? Theme.success : Theme.textTertiary} />
              <StatusDot label="Signaling" value={latestDirectTransport.signalingState || '-'} color={Theme.textSecondary} />
              <StatusDot label="Control" value={latestDirectTransport.controlChannelState || '-'} color={latestDirectTransport.controlChannelState === 'open' ? Theme.success : Theme.textTertiary} />
              <StatusDot label="File" value={latestDirectTransport.fileChannelState || '-'} color={latestDirectTransport.fileChannelState === 'open' ? Theme.success : Theme.textTertiary} />
            </View>
          ) : null}
        </View>
      ) : null}

      {latestTransferPickup ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Latest pickup token</Text>
          <Text style={s.cardTitle}>{latestTransferPickup.fileName || latestTransferPickup.shareToken}</Text>
          <View style={s.chipRow}>
            <View style={[s.metaChip, { backgroundColor: Theme.success10 }]}>
              <Text style={s.metaChipLabel}>Token</Text>
              <Text style={[s.metaChipValue, { color: Theme.successDark }]}>{latestTransferPickup.shareToken}</Text>
            </View>
            <View style={[s.metaChip, { backgroundColor: latestTransferPickup.status === 'ready' ? Theme.success10 : Theme.warning08 }]}>
              <Text style={s.metaChipLabel}>Status</Text>
              <Text style={[s.metaChipValue, { color: latestTransferPickup.status === 'ready' ? Theme.successDark : Theme.warningDark }]}>{latestTransferPickup.status || 'unknown'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={s.surfaceCard}>
        <Text style={s.eyebrow}>Homepage direct transfer</Text>
        <Text style={s.bodyText}>Pick a file and create a ready-to-receive pickup token without going through the netdisk first.</Text>
        {directShareError ? <Text style={s.errorText}>{directShareError}</Text> : null}
        <Pressable onPress={onCreateDirectShare} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
          {directShareLoading ? <ActivityIndicator color={Theme.textInverse} /> : <Text style={s.filledBtnText}>Create pickup from Home</Text>}
        </Pressable>
      </View>

      {profile ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Connected devices</Text>
          {syncLoading ? <Text style={s.bodyText}>Refreshing device list…</Text> : null}
          {deviceTransferError ? <Text style={s.errorText}>{deviceTransferError}</Text> : null}
          {directSessionError ? <Text style={s.errorText}>{directSessionError}</Text> : null}
          {devices.length ? devices.slice(0, 4).map((device) => (
            <View key={device.deviceId} style={s.deviceRow}>
              <View style={s.deviceInfo}>
                <View style={[s.deviceDot, { backgroundColor: device.current ? Theme.primary : device.online ? Theme.success : Theme.textTertiary }]} />
                <Text style={s.deviceName}>{device.deviceName || device.deviceId}</Text>
                <Text style={s.deviceBadge}>{device.current ? 'This device' : device.online ? 'Online' : 'Offline'}</Text>
              </View>
              {!device.current ? (
                <View style={s.actionRail}>
                  <Pressable onPress={() => onSendToDevice(device.deviceId)} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null, deviceTransferLoading ? s.pressed : null]}>
                    <Text style={s.filledBtnText}>{deviceTransferLoading ? 'Sending…' : 'Send file'}</Text>
                  </Pressable>
                  <Pressable onPress={() => onPrepareDirectSession(device.deviceId)} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
                    <Text style={s.outlineBtnText}>{directSessionLoading ? 'Preparing…' : 'Direct link'}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )) : <Text style={s.bodyText}>No same-account devices reported yet.</Text>}
        </View>
      ) : null}

      {profile ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Recent transfer tasks</Text>
          {transferTaskActionError ? <Text style={s.errorText}>{transferTaskActionError}</Text> : null}
          {incomingTasks.length ? incomingTasks.slice(0, 4).map((task) => {
            const transferReady = Boolean(task.attempts?.some((attempt) => attempt.transferMode === 'relay' && attempt.transferId));
            return (
              <TransferTaskCard
                actionLoading={transferTaskActionLoadingId === task.id}
                key={task.id}
                onDelete={() => onDeleteTransferTask(task)}
                onDownload={transferReady ? () => onDownloadIncomingTransfer(task) : undefined}
                onSave={transferReady ? () => onSaveIncomingTransfer(task) : undefined}
                task={task}
              />
            );
          }) : <Text style={s.bodyText}>No incoming transfer tasks yet.</Text>}
        </View>
      ) : null}

      {profile ? (
        <View style={s.surfaceCard}>
          <Text style={s.eyebrow}>Outgoing transfers</Text>
          {outgoingTasks.length ? outgoingTasks.slice(0, 4).map((task) => (
            <TransferTaskCard key={task.id} onDelete={() => onDeleteTransferTask(task)} task={task} />
          )) : <Text style={s.bodyText}>No outgoing transfer tasks yet.</Text>}
        </View>
      ) : null}
    </ScrollView>
  );
}

function QuickAction({ icon, label, tint, tintText, onPress }: { icon: string; label: string; tint: string; tintDark: string; tintText: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.quickAction, pressed ? s.pressed : null]}>
      <View style={[s.quickActionIcon, { backgroundColor: tint }]}>
        <Text style={[s.quickActionIconText, { color: tintText }]}>{icon}</Text>
      </View>
      <Text style={s.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function StatusDot({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.statusDotRow}>
      <View style={[s.statusDot, { backgroundColor: color }]} />
      <Text style={s.statusDotLabel}>{label}</Text>
      <Text style={s.statusDotValue}>{value}</Text>
    </View>
  );
}

function formatTaskTime(value?: string): string {
  if (!value) return 'Not yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function TransferTaskCard({
  actionLoading = false,
  onDelete,
  onDownload,
  onSave,
  task,
}: {
  actionLoading?: boolean;
  onDelete?: () => void;
  onDownload?: () => void;
  onSave?: () => void;
  task: QuickShareTransferTask;
}) {
  const stage = task.stage || task.attemptStatus || 'unknown';
  const mode = task.currentTransferMode || task.transferMode || 'relay';
  return (
    <View style={s.taskCard}>
      <View style={s.taskHeader}>
        <Text style={s.taskFileName}>{task.fileName || `Task #${task.id}`}</Text>
        <View style={[s.stageChip, { backgroundColor: stage === 'completed' ? Theme.success10 : Theme.primary06 }]}>
          <Text style={[s.stageChipText, { color: stage === 'completed' ? Theme.successDark : Theme.primaryDark }]}>{stage}</Text>
        </View>
      </View>
      <View style={s.chipRow}>
        <View style={[s.metaChip, { backgroundColor: Theme.primary03 }]}>
          <Text style={s.metaChipLabel}>Mode</Text>
          <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{mode}</Text>
        </View>
        <View style={[s.metaChip, { backgroundColor: Theme.primary03 }]}>
          <Text style={s.metaChipLabel}>Peer</Text>
          <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{task.peerLabel || task.peerDeviceId || '-'}</Text>
        </View>
        <View style={[s.metaChip, { backgroundColor: Theme.primary03 }]}>
          <Text style={s.metaChipLabel}>Progress</Text>
          <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{task.completedChunks ?? 0}/{task.totalChunks ?? 0}</Text>
        </View>
      </View>
      {task.failureReason ? <Text style={s.errorText}>Failure: {task.failureReason}</Text> : null}
      {task.startTime ? <Text style={s.captionText}>Started: {formatTaskTime(task.startTime)}</Text> : null}
      <Text style={s.captionText}>Completed: {formatTaskTime(task.completedAt)}</Text>
      {onDownload || onSave || onDelete ? (
        <View style={s.actionRail}>
          {onDownload ? <Pressable onPress={onDownload} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}><Text style={s.outlineBtnText}>{actionLoading ? 'Working…' : 'Download'}</Text></Pressable> : null}
          {onSave ? <Pressable onPress={onSave} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}><Text style={s.outlineBtnText}>{actionLoading ? 'Working…' : 'Save'}</Text></Pressable> : null}
          {onDelete ? <Pressable onPress={onDelete} style={({ pressed }) => [s.outlineBtnDanger, pressed ? s.pressed : null]}><Text style={s.outlineBtnDangerText}>{actionLoading ? 'Working…' : 'Delete'}</Text></Pressable> : null}
        </View>
      ) : null}
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
    gap: Theme.space4,
    padding: Theme.space12,
    paddingBottom: Theme.space14,
  },
  heroIconWrap: {
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.radiusLg,
    backgroundColor: Theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeXl,
    fontWeight: '800',
  },
  heroEyebrow: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeSm,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: Theme.text,
    fontSize: Theme.fontSize3xl,
    fontWeight: '800',
  },
  heroText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
    lineHeight: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Theme.space6,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
    flex: 1,
    gap: Theme.space5,
    paddingVertical: Theme.space7,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: Theme.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconText: {
    fontSize: Theme.fontSizeLg,
    fontWeight: '800',
  },
  quickActionLabel: {
    color: Theme.text,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
    textAlign: 'center',
  },
  surfaceCard: {
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
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
  cardTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '700',
  },
  bodyText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
    lineHeight: 20,
  },
  captionText: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeCaption,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Theme.space4,
  },
  metricChip: {
    borderRadius: Theme.radiusLg,
    padding: Theme.space5,
    flex: 1,
    gap: 2,
  },
  metricChipLabel: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeXs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricChipValue: {
    fontSize: Theme.fontSizeBase,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space3,
  },
  metaChip: {
    borderRadius: Theme.radiusMd,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space3,
    gap: 1,
  },
  metaChipLabel: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeXs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metaChipValue: {
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  filledBtn: {
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    paddingHorizontal: Theme.space8,
    paddingVertical: Theme.space3,
    minHeight: Theme.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledBtnText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  outlineBtn: {
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusLg,
    paddingHorizontal: Theme.space6,
    paddingVertical: Theme.space3,
    minHeight: Theme.touchMin - 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  outlineBtnDanger: {
    backgroundColor: Theme.danger12,
    borderRadius: Theme.radiusLg,
    paddingHorizontal: Theme.space6,
    paddingVertical: Theme.space3,
    minHeight: Theme.touchMin - 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnDangerText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  actionRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space3,
    marginTop: Theme.space2,
  },
  deviceRow: {
    gap: Theme.space3,
    paddingVertical: Theme.space2,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.space3,
  },
  deviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceName: {
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  deviceBadge: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeCaption,
  },
  taskCard: {
    backgroundColor: Theme.surfaceSunken,
    borderRadius: Theme.radiusXl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
    gap: Theme.space3,
    padding: Theme.space5,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.space3,
  },
  taskFileName: {
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
    flex: 1,
  },
  stageChip: {
    borderRadius: Theme.radiusFull,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space1,
  },
  stageChipText: {
    fontSize: Theme.fontSizeXs,
    fontWeight: '800',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space4,
    marginTop: Theme.space2,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.space2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotLabel: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeXs,
    fontWeight: '600',
  },
  statusDotValue: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeXs,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
