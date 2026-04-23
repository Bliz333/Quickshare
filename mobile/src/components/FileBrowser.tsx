import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatBytes } from '../lib/format';
import { Theme } from '../theme';
import type { QuickShareFileInfo, QuickShareUser } from '../types/quickshare';

interface FileBrowserProps {
  actionDraftName: string;
  actionMode: 'rename' | 'move' | null;
  actionMoveTargetId: string;
  actionTargetLabel: string | null;
  allFolders: QuickShareFileInfo[];
  createFolderName: string;
  currentFolderId: number | null;
  isLoggedIn: boolean;
  files: QuickShareFileInfo[];
  loading: boolean;
  path: Array<{ id: number | null; label: string }>;
  profile: QuickShareUser;
  error: string | null;
  onCreateFolder: () => void;
  onCreateFolderNameChange: (value: string) => void;
  onDeleteItem: (entry: QuickShareFileInfo) => void;
  onDownloadFile: (entry: QuickShareFileInfo) => void;
  onFolderPress: (entry: QuickShareFileInfo) => void;
  onPathPress: (id: number | null) => void;
  onRefresh: () => void;
  onRenameDraftChange: (value: string) => void;
  onMoveTargetChange: (value: string) => void;
  onSelectMove: (entry: QuickShareFileInfo) => void;
  onSelectRename: (entry: QuickShareFileInfo) => void;
  onShareFile: (entry: QuickShareFileInfo) => void;
  onSignOut: () => void;
  onUpload: () => void;
  onPreviewFile: (entry: QuickShareFileInfo) => void;
  onSubmitAction: () => void;
}

export function FileBrowser({
  actionDraftName,
  actionMode,
  actionMoveTargetId,
  actionTargetLabel,
  allFolders,
  createFolderName,
  currentFolderId,
  isLoggedIn,
  files,
  loading,
  path,
  profile,
  error,
  onCreateFolder,
  onCreateFolderNameChange,
  onDeleteItem,
  onDownloadFile,
  onFolderPress,
  onPathPress,
  onRefresh,
  onRenameDraftChange,
  onMoveTargetChange,
  onSelectMove,
  onSelectRename,
  onShareFile,
  onSignOut,
  onUpload,
  onPreviewFile,
  onSubmitAction,
}: FileBrowserProps) {
  const displayName = profile.nickname || profile.username || profile.email || 'QuickShare User';

  return (
    <View style={s.wrapper}>
      <View style={s.headerCard}>
        <View style={s.headerTopRow}>
          <View style={s.headerIdentity}>
            <Text style={s.headerTitle}>My Netdisk</Text>
            <Text style={s.headerSubtitle}>{displayName}</Text>
          </View>
          <Pressable onPress={onSignOut} style={({ pressed }) => [s.ghostButton, pressed ? s.pressed : null]}>
            <Text style={s.ghostButtonText}>Sign out</Text>
          </Pressable>
        </View>
        <View style={s.breadcrumbRow}>
          <ScrollView contentContainerStyle={s.breadcrumbScroll} horizontal showsHorizontalScrollIndicator={false}>
            {path.map((segment, index) => (
              <View key={`${segment.id ?? 'root'}-${index}`} style={s.breadcrumbItem}>
                <Pressable onPress={() => onPathPress(segment.id)}>
                  <Text style={[s.breadcrumbText, index === path.length - 1 ? s.breadcrumbActive : null]}>{segment.label}</Text>
                </Pressable>
                {index < path.length - 1 ? <Text style={s.breadcrumbDivider}>›</Text> : null}
              </View>
            ))}
          </ScrollView>
          <View style={s.fileCountBadge}>
            <Text style={s.fileCountText}>{files.length}</Text>
          </View>
        </View>
      </View>

      <View style={s.actionsRow}>
        <Pressable onPress={onUpload} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
          <Text style={s.filledBtnText}>Upload</Text>
        </Pressable>
        <Pressable onPress={onRefresh} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null]}>
          <Text style={s.outlineBtnText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>

      <View style={s.createFolderRow}>
        <TextInput
          onChangeText={onCreateFolderNameChange}
          placeholder="New folder name"
          placeholderTextColor={Theme.textTertiary}
          style={s.textInput}
          value={createFolderName}
          editable={isLoggedIn}
        />
        <Pressable disabled={!isLoggedIn} onPress={onCreateFolder} style={({ pressed }) => [s.outlineBtn, pressed ? s.pressed : null, !isLoggedIn ? s.disabled : null]}>
          <Text style={s.outlineBtnText}>Create</Text>
        </Pressable>
      </View>

      {actionTargetLabel ? (
        <View style={s.actionPanel}>
          <Text style={s.actionPanelTitle}>{actionMode === 'rename' ? 'Rename item' : 'Move item'}</Text>
          <View style={s.actionTargetChip}>
            <Text style={s.actionTargetText}>{actionTargetLabel}</Text>
          </View>
          {actionMode === 'rename' ? (
            <TextInput
              onChangeText={onRenameDraftChange}
              placeholder="New item name"
              placeholderTextColor={Theme.textTertiary}
              style={s.textInput}
              value={actionDraftName}
            />
          ) : (
            <>
              {allFolders.length > 0 ? (
                <ScrollView style={s.folderPicker} contentContainerStyle={s.folderPickerContent}>
                  <Pressable onPress={() => onMoveTargetChange('0')} style={({ pressed }) => [s.folderPickerItem, pressed ? s.pressed : null, actionMoveTargetId === '0' ? s.folderPickerItemSelected : null]}>
                    <Text style={s.folderPickerIcon}>📁</Text>
                    <Text style={s.folderPickerLabel}>Root</Text>
                    <Text style={s.folderPickerId}>#0</Text>
                  </Pressable>
                  {allFolders.slice(0, 12).map((folder) => {
                    const folderName = folder.name || folder.originalName || folder.fileName || `Folder #${folder.id}`;
                    const folderId = String(folder.id);
                    return (
                      <Pressable key={folder.id} onPress={() => onMoveTargetChange(folderId)} style={({ pressed }) => [s.folderPickerItem, pressed ? s.pressed : null, actionMoveTargetId === folderId ? s.folderPickerItemSelected : null]}>
                        <Text style={s.folderPickerIcon}>📁</Text>
                        <Text style={s.folderPickerLabel} numberOfLines={1}>{folderName}</Text>
                        <Text style={s.folderPickerId}>#{folder.id}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <TextInput
                  onChangeText={onMoveTargetChange}
                  placeholder="Target folder ID (0 = Root)"
                  placeholderTextColor={Theme.textTertiary}
                  style={s.textInput}
                  value={actionMoveTargetId}
                />
              )}
            </>
          )}
          <Pressable onPress={onSubmitAction} style={({ pressed }) => [s.filledBtn, pressed ? s.pressed : null]}>
            <Text style={s.filledBtnText}>{actionMode === 'rename' ? 'Apply rename' : 'Apply move'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoggedIn ? <Text style={s.helperText}>Sign in to use your personal netdisk, upload files, and create folders.</Text> : null}

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <ScrollView contentContainerStyle={s.listContent}>
        {loading ? (
          <View style={s.loadingState}>
            <ActivityIndicator color={Theme.primary} />
            <Text style={s.loadingText}>Loading files…</Text>
          </View>
        ) : files.length ? (
          files.map((entry) => {
            const label = entry.originalName || entry.fileName || entry.name || `Entry #${entry.id}`;
            const isFolder = entry.isFolder === 1;
            return (
              <Pressable
                key={entry.id}
                onPress={() => (isFolder ? onFolderPress(entry) : undefined)}
                style={({ pressed }) => [s.fileCard, pressed && isFolder ? s.pressed : null]}
              >
                <View style={s.fileCardHeader}>
                  <View style={[s.fileIconContainer, { backgroundColor: isFolder ? Theme.primary08 : Theme.accent10 }]}>
                    <Text style={s.fileIconText}>{isFolder ? '📁' : '📄'}</Text>
                  </View>
                  <View style={s.fileTitleWrap}>
                    <Text numberOfLines={2} style={s.fileTitle}>{label}</Text>
                    <Text style={s.fileMeta}>
                      {isFolder ? `${entry.fileCount ?? 0} items` : `${entry.fileType || 'file'} · ${formatBytes(entry.fileSize)}`}
                    </Text>
                  </View>
                </View>
                <View style={s.fileActions}>
                  {!isFolder ? (
                    <>
                      <ActionChip label="Preview" color={Theme.primary} onPress={() => onPreviewFile(entry)} />
                      <ActionChip label="Download" color={Theme.primary} onPress={() => onDownloadFile(entry)} />
                      <ActionChip label="Share" color={Theme.accent} onPress={() => onShareFile(entry)} />
                      <ActionChip label="Rename" color={Theme.textSecondary} onPress={() => onSelectRename(entry)} />
                      <ActionChip label="Move" color={Theme.textSecondary} onPress={() => onSelectMove(entry)} />
                      <ActionChip label="Delete" color={Theme.danger} onPress={() => onDeleteItem(entry)} />
                    </>
                  ) : (
                    <>
                      <ActionChip label="Rename" color={Theme.textSecondary} onPress={() => onSelectRename(entry)} />
                      <ActionChip label="Move" color={Theme.textSecondary} onPress={() => onSelectMove(entry)} />
                      <ActionChip label="Delete" color={Theme.danger} onPress={() => onDeleteItem(entry)} />
                    </>
                  )}
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyIconText}>📂</Text>
            </View>
            <Text style={s.emptyTitle}>No files in this folder yet.</Text>
            <Text style={s.emptyText}>
              Upload a file, create a folder, or open another tab to work with sharing and pickup flows.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActionChip({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.chipButton, { borderColor: `${color}26` }, pressed ? s.pressed : null]}>
      <Text style={[s.chipButtonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: Theme.space6,
  },
  headerCard: {
    backgroundColor: Theme.surfaceTintDark,
    borderRadius: Theme.radius2xl,
    gap: Theme.space5,
    padding: Theme.space10,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.space6,
    justifyContent: 'space-between',
  },
  headerIdentity: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: Theme.text,
    fontSize: Theme.fontSize2xl,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.space3,
  },
  breadcrumbScroll: {
    alignItems: 'center',
    gap: Theme.space1,
  },
  breadcrumbItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.space1,
  },
  breadcrumbText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '600',
  },
  breadcrumbActive: {
    color: Theme.primaryDark,
    fontWeight: '800',
  },
  breadcrumbDivider: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeBase,
  },
  fileCountBadge: {
    backgroundColor: Theme.primary14,
    borderRadius: Theme.radiusFull,
    paddingHorizontal: Theme.space3,
    paddingVertical: Theme.space1,
    minWidth: 24,
    alignItems: 'center',
  },
  fileCountText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Theme.space5,
  },
  createFolderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.space5,
  },
  textInput: {
    backgroundColor: Theme.surfaceSunken,
    borderColor: Theme.borderInput,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    color: Theme.text,
    flex: 1,
    fontSize: Theme.fontSizeBase,
    paddingHorizontal: Theme.space7,
    paddingVertical: Theme.space6,
    minHeight: Theme.touchMin,
  },
  filledBtn: {
    backgroundColor: Theme.primaryDark,
    borderRadius: Theme.radiusLg,
    paddingHorizontal: Theme.space8,
    paddingVertical: Theme.space6,
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
    paddingHorizontal: Theme.space8,
    paddingVertical: Theme.space6,
    minHeight: Theme.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeBase,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  ghostButton: {
    borderColor: Theme.primaryLight,
    borderRadius: Theme.radiusLg,
    borderWidth: 1,
    paddingHorizontal: Theme.space7,
    paddingVertical: Theme.space5,
    minHeight: Theme.touchMin - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  helperText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
    lineHeight: 18,
  },
  errorText: {
    color: Theme.danger,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  actionPanel: {
    backgroundColor: Theme.surface,
    borderRadius: Theme.radiusXl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
    gap: Theme.space5,
    padding: Theme.space7,
  },
  actionPanelTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '800',
  },
  actionTargetChip: {
    backgroundColor: Theme.surfaceTint,
    borderRadius: Theme.radiusMd,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space3,
    alignSelf: 'flex-start',
  },
  actionTargetText: {
    color: Theme.primaryDark,
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  folderPicker: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Theme.borderInput,
    borderRadius: Theme.radiusLg,
  },
  folderPickerContent: {
    gap: 0,
  },
  folderPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.space4,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space5,
    borderBottomWidth: 1,
    borderBottomColor: Theme.border,
  },
  folderPickerItemSelected: {
    backgroundColor: Theme.primary06,
  },
  folderPickerIcon: {
    fontSize: Theme.fontSizeLg,
  },
  folderPickerLabel: {
    flex: 1,
    color: Theme.text,
    fontSize: Theme.fontSizeBase,
    fontWeight: '600',
  },
  folderPickerId: {
    color: Theme.textTertiary,
    fontSize: Theme.fontSizeCaption,
  },
  listContent: {
    gap: Theme.space5,
    paddingBottom: Theme.space24,
  },
  loadingState: {
    alignItems: 'center',
    gap: Theme.space5,
    paddingVertical: Theme.space16,
  },
  loadingText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
  },
  fileCard: {
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
    padding: Theme.space5,
    gap: Theme.space4,
  },
  fileCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Theme.space5,
  },
  fileIconContainer: {
    width: 42,
    height: 42,
    borderRadius: Theme.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconText: {
    fontSize: Theme.fontSizeXl,
  },
  fileTitleWrap: {
    flex: 1,
    gap: 2,
  },
  fileTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '700',
  },
  fileMeta: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeCaption,
  },
  fileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.space3,
    paddingLeft: 47,
  },
  chipButton: {
    backgroundColor: Theme.surface,
    borderRadius: Theme.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Theme.space5,
    paddingVertical: Theme.space3,
  },
  chipButtonText: {
    fontSize: Theme.fontSizeCaption,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius2xl,
    borderWidth: 1,
    borderColor: Theme.borderStrong,
    gap: Theme.space5,
    padding: Theme.space12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.radius2xl,
    backgroundColor: Theme.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconText: {
    fontSize: 28,
  },
  emptyTitle: {
    color: Theme.text,
    fontSize: Theme.fontSizeMd,
    fontWeight: '700',
  },
  emptyText: {
    color: Theme.textSecondary,
    fontSize: Theme.fontSizeBase,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
