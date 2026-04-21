import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { QuickShareShareLink, QuickShareTransferPublicShare } from '../types/quickshare';

interface ShareCenterProps {
  createShareLoading: boolean;
  latestShare: QuickShareShareLink | null;
  publicShareCode: string;
  publicShareError: string | null;
  publicShareExtractCode: string;
  publicShareLoading: boolean;
  publicShareResult: QuickShareShareLink | null;
  transferPickupError: string | null;
  transferPickupLoading: boolean;
  transferPickupResult: QuickShareTransferPublicShare | null;
  transferPickupToken: string;
  onLookupPublicShare: () => void;
  onLookupTransferPickup: () => void;
  onOpenLatestShareDownload: () => void;
  onOpenLatestSharePreview: () => void;
  onOpenPublicShareDownload: () => void;
  onOpenPublicSharePreview: () => void;
  onOpenTransferPickupDownload: () => void;
  onOpenTransferPickupPreview: () => void;
  onPublicShareCodeChange: (value: string) => void;
  onPublicShareExtractCodeChange: (value: string) => void;
  onSaveTransferPickup: () => void;
  onTransferPickupTokenChange: (value: string) => void;
}

export function ShareCenter(props: ShareCenterProps) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create share links</Text>
        <Text style={styles.helperText}>
          Use the Files tab to upload or choose a file, then create a share link from the file row.
        </Text>
        {props.createShareLoading ? <Text style={styles.pendingText}>Creating share link…</Text> : null}
        {props.latestShare ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{props.latestShare.fileName || props.latestShare.shareCode}</Text>
            <Text style={styles.resultText}>Share code: {props.latestShare.shareCode}</Text>
            <Text style={styles.resultText}>Extract code: {props.latestShare.extractCode || '-'}</Text>
            <View style={styles.rowButtons}>
              <SmallAction label="Preview" onPress={props.onOpenLatestSharePreview} />
              <SmallAction label="Download" onPress={props.onOpenLatestShareDownload} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Open public share</Text>
        <TextInput
          onChangeText={props.onPublicShareCodeChange}
          placeholder="Share code"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={props.publicShareCode}
        />
        <TextInput
          onChangeText={props.onPublicShareExtractCodeChange}
          placeholder="Extract code"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={props.publicShareExtractCode}
        />
        {props.publicShareError ? <Text style={styles.errorText}>{props.publicShareError}</Text> : null}
        <Pressable onPress={props.onLookupPublicShare} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
          <Text style={styles.primaryButtonText}>{props.publicShareLoading ? 'Loading…' : 'Lookup share'}</Text>
        </Pressable>
        {props.publicShareResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{props.publicShareResult.fileName || props.publicShareResult.shareCode}</Text>
            <Text style={styles.resultText}>Type: {props.publicShareResult.fileType || 'unknown'}</Text>
            <View style={styles.rowButtons}>
              <SmallAction label="Preview" onPress={props.onOpenPublicSharePreview} />
              <SmallAction label="Download" onPress={props.onOpenPublicShareDownload} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Transfer pickup</Text>
        <TextInput
          onChangeText={props.onTransferPickupTokenChange}
          placeholder="Pickup token"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={props.transferPickupToken}
        />
        {props.transferPickupError ? <Text style={styles.errorText}>{props.transferPickupError}</Text> : null}
        <Pressable onPress={props.onLookupTransferPickup} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
          <Text style={styles.primaryButtonText}>{props.transferPickupLoading ? 'Loading…' : 'Lookup pickup'}</Text>
        </Pressable>
      {props.transferPickupResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{props.transferPickupResult.fileName || props.transferPickupResult.shareToken}</Text>
            <Text style={styles.resultText}>Status: {props.transferPickupResult.status || 'unknown'}</Text>
            <Text style={styles.resultText}>Ready: {props.transferPickupResult.ready ? 'yes' : 'no'}</Text>
            <Text style={styles.resultText}>Pickup token: {props.transferPickupResult.shareToken}</Text>
            <Text style={styles.resultText}>Pickup URL: {props.transferPickupResult.pickupUrl || '-'}</Text>
            <View style={styles.rowButtons}>
              <SmallAction label="Preview" onPress={props.onOpenTransferPickupPreview} />
              <SmallAction label="Download" onPress={props.onOpenTransferPickupDownload} />
              <SmallAction label="Save" onPress={props.onSaveTransferPickup} />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SmallAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.smallButton, pressed ? styles.smallButtonPressed : null]}>
      <Text style={styles.smallButtonText}>{label}</Text>
    </Pressable>
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
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  pendingText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  resultCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    gap: 6,
    padding: 14,
  },
  resultTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  resultText: {
    color: '#334155',
    fontSize: 13,
  },
  rowButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
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
});
