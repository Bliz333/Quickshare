import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '../lib/format';
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
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>QuickShare Mobile</Text>
        <Text style={styles.heroTitle}>Hi, {displayName}</Text>
        <Text style={styles.heroText}>
          Share from entry like the web homepage, then log in only when you need personal netdisk features.
        </Text>
      </View>

      <View style={styles.quickActionsRow}>
        <QuickAction label="Direct Share" emoji="📤" onPress={onCreateDirectShare} />
        <QuickAction label="My Files" emoji="📁" onPress={onGoToFiles} />
        <QuickAction label="Share Center" emoji="🔗" onPress={onGoToShare} />
      </View>

      <View style={styles.quickActionsRow}>
        <QuickAction label="Account" emoji="👤" onPress={onGoToAccount} />
        <QuickAction label="Plans" emoji="💳" onPress={onGoToPricing} />
        {!profile ? <QuickAction label="Google Sign-in" emoji="🟢" onPress={onGoToGoogleLogin} /> : null}
      </View>

      {profile ? (
        <View style={styles.metricsCard}>
          <Text style={styles.sectionTitle}>Storage</Text>
          <Text style={styles.metricText}>
            Used {formatBytes(profile.storageUsed)} / {formatBytes(profile.storageLimit)}
          </Text>
          <Text style={styles.metricText}>
            Downloads {profile.downloadUsed ?? 0} / {profile.downloadLimit ?? 0}
          </Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Guest mode</Text>
          <Text style={styles.infoText}>You can upload, create share links, open public shares, and check pickup tokens without signing in.</Text>
          <Text style={styles.infoText}>Sign in only when you want to use your personal netdisk.</Text>
        </View>
      )}

      {latestShare ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Latest share link</Text>
          <Text style={styles.infoTitle}>{latestShare.fileName || latestShare.shareCode}</Text>
          <Text style={styles.infoText}>Share code: {latestShare.shareCode}</Text>
          <Text style={styles.infoText}>Extract code: {latestShare.extractCode || 'auto-generated'}</Text>
        </View>
      ) : null}

      {latestDirectSession ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Latest direct session</Text>
          <Text style={styles.infoText}>Pair session: {latestDirectSession.pairSessionId || '-'}</Text>
          <Text style={styles.infoText}>Peer: {latestDirectSession.peerLabel || latestDirectSession.peerDeviceId || '-'}</Text>
          <Text style={styles.infoText}>Self device: {latestDirectSession.selfDeviceId || '-'}</Text>
          {latestDirectControlMessage ? <Text style={styles.infoText}>Last control message: {latestDirectControlMessage}</Text> : null}
          {latestIncomingDirectFile ? (
            <>
              <Text style={styles.infoText}>Incoming file: {latestIncomingDirectFile}</Text>
              <View style={styles.rowButtons}>
                <SmallAction label="Save incoming file" onPress={onSaveIncomingDirectFile} />
              </View>
            </>
          ) : null}
          {latestDirectTransport ? (
            <>
              <Text style={styles.infoText}>Connection: {latestDirectTransport.connectionState || '-'}</Text>
              <Text style={styles.infoText}>Signaling: {latestDirectTransport.signalingState || '-'}</Text>
              <Text style={styles.infoText}>Control channel: {latestDirectTransport.controlChannelState || '-'}</Text>
              <Text style={styles.infoText}>File channel: {latestDirectTransport.fileChannelState || '-'}</Text>
              <Text style={styles.infoText}>Local offer ready: {latestDirectTransport.hasLocalOffer ? 'yes' : 'no'}</Text>
            </>
          ) : null}
        </View>
      ) : null}

      {latestTransferPickup ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Latest pickup token</Text>
          <Text style={styles.infoTitle}>{latestTransferPickup.fileName || latestTransferPickup.shareToken}</Text>
          <Text style={styles.infoText}>Token: {latestTransferPickup.shareToken}</Text>
          <Text style={styles.infoText}>Status: {latestTransferPickup.status || 'unknown'}</Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Homepage direct transfer</Text>
        <Text style={styles.infoText}>Pick a file from the home screen and create a ready-to-receive pickup token without going through the netdisk first.</Text>
        {directShareError ? <Text style={styles.errorText}>{directShareError}</Text> : null}
        <Pressable onPress={onCreateDirectShare} style={({ pressed }) => [styles.primaryButton, pressed ? styles.quickActionPressed : null]}>
          {directShareLoading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Create pickup from Home</Text>}
        </Pressable>
      </View>

      {profile ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Connected devices</Text>
          {syncLoading ? <Text style={styles.infoText}>Refreshing device list…</Text> : null}
          {deviceTransferError ? <Text style={styles.errorText}>{deviceTransferError}</Text> : null}
          {directSessionError ? <Text style={styles.errorText}>{directSessionError}</Text> : null}
          {devices.length ? devices.slice(0, 4).map((device) => (
            <View key={device.deviceId} style={styles.deviceRow}>
              <Text style={styles.infoText}>• {device.deviceName || device.deviceId} {device.current ? '(This device)' : device.online ? '(Online)' : '(Offline)'}</Text>
              {!device.current ? (
                <View style={styles.rowButtons}>
                  <Pressable onPress={() => onSendToDevice(device.deviceId)} style={({ pressed }) => [styles.smallPrimaryButton, pressed ? styles.quickActionPressed : null, deviceTransferLoading ? styles.quickActionPressed : null]}>
                    <Text style={styles.smallPrimaryButtonText}>{deviceTransferLoading ? 'Sending…' : 'Send file'}</Text>
                  </Pressable>
                  <SmallAction label={directSessionLoading ? 'Preparing…' : 'Direct link'} onPress={() => onPrepareDirectSession(device.deviceId)} />
                </View>
              ) : null}
            </View>
          )) : <Text style={styles.infoText}>No same-account devices reported yet.</Text>}
        </View>
      ) : null}

      {profile ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Recent transfer tasks</Text>
          {transferTaskActionError ? <Text style={styles.errorText}>{transferTaskActionError}</Text> : null}
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
          }) : <Text style={styles.infoText}>No incoming transfer tasks yet.</Text>}
        </View>
      ) : null}

      {profile ? (
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Outgoing transfers</Text>
          {outgoingTasks.length ? outgoingTasks.slice(0, 4).map((task) => (
            <TransferTaskCard key={task.id} onDelete={() => onDeleteTransferTask(task)} task={task} />
          )) : <Text style={styles.infoText}>No outgoing transfer tasks yet.</Text>}
        </View>
      ) : null}
    </ScrollView>
  );
}

function QuickAction({ emoji, label, onPress }: { emoji: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed ? styles.quickActionPressed : null]}>
      <Text style={styles.quickActionEmoji}>{emoji}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.smallButton, pressed ? styles.smallButtonPressed : null]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
  );
}

function formatTaskTime(value?: string): string {
  if (!value) {
    return 'Not yet';
  }
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
  return (
    <View style={styles.taskCard}>
      <Text style={styles.infoText}>• {task.fileName || `Task #${task.id}`} · {task.stage || task.attemptStatus || 'unknown'}</Text>
      <Text style={styles.infoText}>Mode: {task.currentTransferMode || task.transferMode || 'relay'} · Peer: {task.peerLabel || task.peerDeviceId || '-'}</Text>
      <Text style={styles.infoText}>Progress: {task.completedChunks ?? 0}/{task.totalChunks ?? 0}</Text>
      {task.failureReason ? <Text style={styles.errorText}>Failure: {task.failureReason}</Text> : null}
      {task.startReason ? <Text style={styles.infoText}>Started: {task.startReason}</Text> : null}
      {task.endReason ? <Text style={styles.infoText}>Ended: {task.endReason}</Text> : null}
      {task.startTime ? <Text style={styles.infoText}>Start time: {formatTaskTime(task.startTime)}</Text> : null}
      <Text style={styles.infoText}>Saved: {formatTaskTime(task.savedToNetdiskAt)}</Text>
      <Text style={styles.infoText}>Completed: {formatTaskTime(task.completedAt)}</Text>
      {task.failedAt ? <Text style={styles.infoText}>Failed at: {formatTaskTime(task.failedAt)}</Text> : null}
      {task.fallbackAt ? <Text style={styles.infoText}>Fallback at: {formatTaskTime(task.fallbackAt)}</Text> : null}
      {onDownload || onSave || onDelete ? (
        <View style={styles.rowButtons}>
          {onDownload ? <SmallAction label={actionLoading ? 'Working…' : 'Download'} onPress={onDownload} /> : null}
          {onSave ? <SmallAction label={actionLoading ? 'Working…' : 'Save'} onPress={onSave} /> : null}
          {onDelete ? <SmallAction label={actionLoading ? 'Working…' : 'Delete'} onPress={onDelete} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 48,
  },
  heroCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 24,
    gap: 8,
    padding: 22,
  },
  heroEyebrow: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  heroText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#dbeafe',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    paddingVertical: 18,
  },
  quickActionPressed: {
    opacity: 0.88,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  metricsCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    padding: 18,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  metricText: {
    color: '#475569',
    fontSize: 14,
  },
  infoTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  infoText: {
    color: '#475569',
    fontSize: 13,
  },
  deviceRow: {
    gap: 8,
  },
  taskCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 14,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 46,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  smallPrimaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
  },
  smallPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  smallButton: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallButtonPressed: {
    opacity: 0.88,
  },
  smallButtonText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  rowButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
});
