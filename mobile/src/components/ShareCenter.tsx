import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Theme } from '../theme';
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
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.eyebrow}>Create share links</Text>
        <Text style={s.bodyText}>
          Use the Files tab to upload or choose a file, then create a share link from the file row.
        </Text>
        {props.createShareLoading ? <Text style={s.pendingText}>Creating share link…</Text> : null}
        {props.latestShare ? (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>{props.latestShare.fileName || props.latestShare.shareCode}</Text>
            <View style={s.chipRow}>
              <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
                <Text style={s.metaChipLabel}>Share code</Text>
                <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{props.latestShare.shareCode}</Text>
              </View>
              <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
                <Text style={s.metaChipLabel}>Extract code</Text>
                <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{props.latestShare.extractCode || '-'}</Text>
              </View>
            </View>
            <View style={s.actionRail}>
              <Pressable onPress={props.onOpenLatestSharePreview} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
                <Text style={s.outlineBtnText}>Preview</Text>
              </Pressable>
              <Pressable onPress={props.onOpenLatestShareDownload} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
                <Text style={s.filledBtnText}>Download</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Open public share</Text>
        <TextInput
          onChangeText={props.onPublicShareCodeChange}
          placeholder="Share code"
          placeholderTextColor={Theme.textTertiary}
          style={s.textInput}
          value={props.publicShareCode}
        />
        <TextInput
          onChangeText={props.onPublicShareExtractCodeChange}
          placeholder="Extract code"
          placeholderTextColor={Theme.textTertiary}
          style={s.textInput}
          value={props.publicShareExtractCode}
        />
        {props.publicShareError ? <Text style={s.errorText}>{props.publicShareError}</Text> : null}
        <Pressable onPress={props.onLookupPublicShare} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
          <Text style={s.filledBtnText}>{props.publicShareLoading ? 'Loading…' : 'Lookup share'}</Text>
        </Pressable>
        {props.publicShareResult ? (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>{props.publicShareResult.fileName || props.publicShareResult.shareCode}</Text>
            <View style={[s.metaChip, { backgroundColor: Theme.accent10, alignSelf: 'flex-start' }]}>
              <Text style={[s.metaChipValue, { color: Theme.accent }]}>{props.publicShareResult.fileType || 'unknown'}</Text>
            </View>
            <View style={s.actionRail}>
              <Pressable onPress={props.onOpenPublicSharePreview} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
                <Text style={s.outlineBtnText}>Preview</Text>
              </Pressable>
              <Pressable onPress={props.onOpenPublicShareDownload} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
                <Text style={s.filledBtnText}>Download</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.eyebrow}>Transfer pickup</Text>
        <TextInput
          onChangeText={props.onTransferPickupTokenChange}
          placeholder="Pickup token"
          placeholderTextColor={Theme.textTertiary}
          style={s.textInput}
          value={props.transferPickupToken}
        />
        {props.transferPickupError ? <Text style={s.errorText}>{props.transferPickupError}</Text> : null}
        <Pressable onPress={props.onLookupTransferPickup} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
          <Text style={s.filledBtnText}>{props.transferPickupLoading ? 'Loading…' : 'Lookup pickup'}</Text>
        </Pressable>
        {props.transferPickupResult ? (
          <View style={s.resultCard}>
            <Text style={s.resultTitle}>{props.transferPickupResult.fileName || props.transferPickupResult.shareToken}</Text>
            <View style={s.chipRow}>
              <View style={[s.metaChip, { backgroundColor: props.transferPickupResult.ready ? Theme.success10 : Theme.warning08 }]}>
                <Text style={s.metaChipLabel}>Status</Text>
                <Text style={[s.metaChipValue, { color: props.transferPickupResult.ready ? Theme.successDark : Theme.warningDark }]}>{props.transferPickupResult.status || 'unknown'}</Text>
              </View>
              <View style={[s.metaChip, { backgroundColor: Theme.primary06 }]}>
                <Text style={s.metaChipLabel}>Token</Text>
                <Text style={[s.metaChipValue, { color: Theme.primaryDark }]}>{props.transferPickupResult.shareToken}</Text>
              </View>
            </View>
            <View style={s.actionRail}>
              <Pressable onPress={props.onOpenTransferPickupPreview} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
                <Text style={s.outlineBtnText}>Preview</Text>
              </Pressable>
              <Pressable onPress={props.onOpenTransferPickupDownload} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
                <Text style={s.outlineBtnText}>Download</Text>
              </Pressable>
              <Pressable onPress={props.onSaveTransferPickup} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
                <Text style={s.filledBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: {
    gap: Theme.space6,
    paddingBottom: Theme.space24,
  },
  card: {
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
  bodyText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
    lineHeight: 20,
  },
  pendingText: {
    color: Theme.primary,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: Theme.surfaceSunken,
    borderColor: Theme.borderInput,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    paddingHorizontal: Theme.space7,
    paddingVertical: Theme.space6,
    minHeight: Theme.touchMin,
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  filledBtn: {
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    minHeight: Theme.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.space8,
  },
  filledBtnText: {
    color: Theme.textInverse,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  outlineBtn: {
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusLg,
    minHeight: Theme.touchMin - 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.space6,
  },
  outlineBtnText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusXl,
    gap: Theme.space4,
    padding: Theme.space7,
  },
  resultTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '700',
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
  actionRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space3,
  },
  pressed: {
    opacity: 0.85,
  },
});
