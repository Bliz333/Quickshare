import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { formatBytes } from '../lib/format';
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
    <View style={styles.wrapper}>
      <View style={styles.headerCard}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerIdentity}>
            <Text style={styles.headerTitle}>My Netdisk</Text>
            <Text style={styles.headerSubtitle}>{displayName}</Text>
          </View>
          <Pressable onPress={onSignOut} style={({ pressed }) => [styles.ghostButton, pressed ? styles.ghostButtonPressed : null]}>
            <Text style={styles.ghostButtonText}>Sign out</Text>
          </Pressable>
        </View>
        <Text style={styles.headerMeta}>
          Folder: {currentFolderId === null ? 'Root' : `#${currentFolderId}`} · Files: {files.length}
        </Text>
        <ScrollView contentContainerStyle={styles.breadcrumbRow} horizontal showsHorizontalScrollIndicator={false}>
          {path.map((segment, index) => (
            <View key={`${segment.id ?? 'root'}-${index}`} style={styles.breadcrumbItem}>
              <Pressable onPress={() => onPathPress(segment.id)}>
                <Text style={styles.breadcrumbText}>{segment.label}</Text>
              </Pressable>
              {index < path.length - 1 ? <Text style={styles.breadcrumbDivider}>/</Text> : null}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.actionsRow}>
        <Pressable onPress={onRefresh} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
          <Text style={styles.primaryButtonText}>{loading ? 'Refreshing…' : 'Refresh list'}</Text>
        </Pressable>
        <Pressable disabled={!isLoggedIn} onPress={onUpload} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null, !isLoggedIn ? styles.disabledButton : null]}>
          <Text style={styles.secondaryButtonText}>Upload</Text>
        </Pressable>
      </View>

      <View style={styles.createFolderRow}>
        <TextInput
          onChangeText={onCreateFolderNameChange}
          placeholder="New folder name"
          placeholderTextColor="#94a3b8"
          style={styles.folderInput}
          value={createFolderName}
          editable={isLoggedIn}
        />
        <Pressable disabled={!isLoggedIn} onPress={onCreateFolder} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null, !isLoggedIn ? styles.disabledButton : null]}>
          <Text style={styles.secondaryButtonText}>Create</Text>
        </Pressable>
      </View>

      {actionTargetLabel ? (
        <View style={styles.actionPanel}>
          <Text style={styles.actionPanelTitle}>{actionMode === 'rename' ? 'Rename item' : 'Move item'}</Text>
          <Text style={styles.helperText}>Target: {actionTargetLabel}</Text>
          {actionMode === 'rename' ? (
            <TextInput
              onChangeText={onRenameDraftChange}
              placeholder="New item name"
              placeholderTextColor="#94a3b8"
              style={styles.folderInput}
              value={actionDraftName}
            />
          ) : (
            <TextInput
              onChangeText={onMoveTargetChange}
              placeholder="Target folder ID (0 = Root)"
              placeholderTextColor="#94a3b8"
              style={styles.folderInput}
              value={actionMoveTargetId}
            />
          )}
          {actionMode === 'move' && allFolders.length ? (
            <Text style={styles.helperText}>Available folders: {allFolders.map(folder => `${folder.id}:${folder.name || folder.originalName || folder.fileName}`).slice(0, 6).join(' · ')}</Text>
          ) : null}
          <Pressable onPress={onSubmitAction} style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null]}>
            <Text style={styles.primaryButtonText}>{actionMode === 'rename' ? 'Apply rename' : 'Apply move'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoggedIn ? <Text style={styles.helperText}>Sign in to use your personal netdisk, upload files, and create folders.</Text> : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#2563eb" />
            <Text style={styles.loadingText}>Loading files…</Text>
          </View>
        ) : files.length ? (
          files.map((entry) => {
            const label = entry.originalName || entry.fileName || entry.name || `Entry #${entry.id}`;
            const isFolder = entry.isFolder === 1;
            return (
              <Pressable
                key={entry.id}
                onPress={() => (isFolder ? onFolderPress(entry) : undefined)}
                style={({ pressed }) => [styles.fileCard, pressed && isFolder ? styles.fileCardPressed : null]}
              >
                <View style={styles.fileCardHeader}>
                  <Text style={styles.fileEmoji}>{isFolder ? '📁' : '📄'}</Text>
                  <View style={styles.fileTitleWrap}>
                    <Text numberOfLines={2} style={styles.fileTitle}>{label}</Text>
                    <Text style={styles.fileMeta}>
                      {isFolder ? `Folder · ${entry.fileCount ?? 0} items` : `${entry.fileType || 'file'} · ${formatBytes(entry.fileSize)}`}
                    </Text>
                    {!isFolder ? (
                      <View style={styles.rowButtons}>
                        <ActionChip accessibilityLabel={`Preview ${label}`} label="Preview" onPress={() => onPreviewFile(entry)} />
                        <ActionChip accessibilityLabel={`Download ${label}`} label="Download" onPress={() => onDownloadFile(entry)} />
                        <ActionChip accessibilityLabel={`Share ${label}`} label="Share" onPress={() => onShareFile(entry)} />
                        <ActionChip accessibilityLabel={`Rename ${label}`} label="Rename" onPress={() => onSelectRename(entry)} />
                        <ActionChip accessibilityLabel={`Move ${label}`} label="Move" onPress={() => onSelectMove(entry)} />
                        <ActionChip accessibilityLabel={`Delete ${label}`} label="Delete" onPress={() => onDeleteItem(entry)} />
                      </View>
                    ) : (
                      <View style={styles.rowButtons}>
                        <ActionChip accessibilityLabel={`Rename ${label}`} label="Rename" onPress={() => onSelectRename(entry)} />
                        <ActionChip accessibilityLabel={`Move ${label}`} label="Move" onPress={() => onSelectMove(entry)} />
                        <ActionChip accessibilityLabel={`Delete ${label}`} label="Delete" onPress={() => onDeleteItem(entry)} />
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No files in this folder yet.</Text>
            <Text style={styles.emptyText}>
              Upload a file, create a folder, or open another tab to work with sharing and pickup flows.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ActionChip({ accessibilityLabel, label, onPress }: { accessibilityLabel: string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.chipButton, pressed ? styles.chipButtonPressed : null]}>
      <Text style={styles.chipButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 20,
    gap: 10,
    padding: 20,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  headerIdentity: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '600',
  },
  headerMeta: {
    color: '#334155',
    fontSize: 13,
  },
  breadcrumbRow: {
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  breadcrumbText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  breadcrumbDivider: {
    color: '#64748b',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-start',
  },
  createFolderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  folderInput: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0f172a',
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.45,
  },
  helperText: {
    color: '#64748b',
    fontSize: 13,
  },
  actionPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  actionPanelTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  ghostButton: {
    borderColor: '#93c5fd',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostButtonPressed: {
    opacity: 0.88,
  },
  ghostButtonText: {
    color: '#1d4ed8',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    gap: 12,
    paddingBottom: 48,
  },
  loadingState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 32,
  },
  loadingText: {
    color: '#475569',
    fontSize: 14,
  },
  fileCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  fileCardPressed: {
    opacity: 0.88,
  },
  fileCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  fileEmoji: {
    fontSize: 24,
  },
  fileTitleWrap: {
    flex: 1,
    gap: 4,
  },
  fileTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  fileMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  rowButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  chipButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipButtonPressed: {
    opacity: 0.88,
  },
  chipButtonText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
