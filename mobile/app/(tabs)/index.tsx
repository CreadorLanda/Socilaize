import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import { TabScene } from '@/components/ui/tab-scene';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { listChats, type ChatDTO } from '@/data/api/messages';
import { bootstrapGroups } from '@/data/group-store';
import {
  addCustomFilter,
  removeCustomFilter,
  useCustomFilters,
  type CustomFilter,
} from '@/data/filter-store';
import type { ChatPreview } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const BUILTIN_IDS = ['all', 'unread', 'read', 'groups', 'pending'];

export default function ChatsScreen() {
  const { colors } = useTheme();
  const customFilters = useCustomFilters();

  const [activeFilter, setActiveFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomFilter | null>(null);
  const [apiChats, setApiChats] = useState<ChatDTO[]>([]);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Fetch real chats + groups from the API.
  useEffect(() => {
    listChats()
      .then(setApiChats)
      .catch(() => {
        /* API not available — empty list */
      })
      .finally(() => setApiLoaded(true));
    bootstrapGroups().catch(() => {});
  }, []);

  // Drop back to "All" if the active custom filter gets removed.
  useEffect(() => {
    if (!BUILTIN_IDS.includes(activeFilter) && !customFilters.some((f) => f.id === activeFilter)) {
      setActiveFilter('all');
    }
  }, [customFilters, activeFilter]);

  // Map API chats to the local ChatPreview type.
  const chats = useMemo(() => {
    if (!apiLoaded) return [] as ChatPreview[];
    const combined: ChatPreview[] = apiChats.map((c) => ({
      id: c.id,
      name: c.title ?? 'Unknown',
      username: '',
      avatarUri: c.avatar_url ?? '',
      lastMessage: c.last_message?.content ?? '',
      timestamp: c.last_message ? new Date(c.last_message.created_at).toLocaleTimeString() : '',
      unreadCount: c.unread_count,
      online: false,
      source: 'native' as const,
      isPending: c.status === 'pending',
      isGroup: c.type === 'group',
      memberCount: c.type === 'group' ? undefined : undefined,
    }));

    if (activeFilter === 'pending') return combined.filter((c) => c.isPending);
    if (activeFilter === 'unread') return combined.filter((c) => c.unreadCount > 0);
    if (activeFilter === 'read') return combined.filter((c) => c.unreadCount === 0);
    if (activeFilter === 'groups') return combined.filter((c) => c.isGroup);
    const custom = customFilters.find((f) => f.id === activeFilter);
    if (custom) return combined.filter((c) => custom.chatIds.includes(c.id));
    return combined;
  }, [activeFilter, customFilters, apiChats, apiLoaded]);

  const handleSaveFilter = (name: string, chatIds: string[]) => {
    const id = addCustomFilter(name, chatIds);
    setActiveFilter(id);
    setShowCreate(false);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) removeCustomFilter(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <TabScene>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <>
              <FilterBar
                active={activeFilter}
                custom={customFilters}
                onSelect={setActiveFilter}
                onCreate={() => setShowCreate(true)}
                onDeleteRequest={setDeleteTarget}
              />
            </>
          }
          renderItem={({ item }) => <ChatRow chat={item} />}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.divider }]} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="filter-outline"
              title={t('chats.filter_empty_title')}
              description={t('chats.filter_empty_hint')}
            />
          }
          contentContainerStyle={styles.list}
        />

        <Pressable
          onPress={() => router.push('/search')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            pressed && styles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('chats.new_chat')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>

      <CreateFilterSheet
        visible={showCreate}
        chats={apiChats}
        onClose={() => setShowCreate(false)}
        onSave={handleSaveFilter}
      />
      <DeleteFilterModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </TabScene>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────
function FilterBar({
  active,
  custom,
  onSelect,
  onCreate,
  onDeleteRequest,
}: {
  active: string;
  custom: CustomFilter[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDeleteRequest: (filter: CustomFilter) => void;
}) {
  const { colors } = useTheme();
  const builtins = [
    { id: 'all', label: t('chats.filter_all') },
    { id: 'unread', label: t('chats.filter_unread') },
    { id: 'read', label: t('chats.filter_read') },
    { id: 'groups', label: t('chats.filter_groups') },
    { id: 'pending', label: t('chats.filter_pending') },
  ];

  return (
    <View style={[styles.filterWrap, { backgroundColor: colors.background, borderBottomColor: colors.divider }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {builtins.map((f) => (
          <FilterChip
            key={f.id}
            label={f.label}
            active={active === f.id}
            onPress={() => onSelect(f.id)}
          />
        ))}
        {custom.map((f) => (
          <FilterChip
            key={f.id}
            label={f.name}
            active={active === f.id}
            onPress={() => onSelect(f.id)}
            onLongPress={() => onDeleteRequest(f)}
          />
        ))}
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.addChip,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('chats.filter_create_title')}
        >
          <Ionicons name="add" size={18} color={colors.textSecondary} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  onLongPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={({ pressed }) => [
        styles.chip,
        active
          ? { backgroundColor: colors.primary, borderColor: colors.primary }
          : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        style={[styles.chipText, { color: active ? colors.onPrimary : colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Create-filter sheet ───────────────────────────────────────────────────────
function CreateFilterSheet({
  visible,
  chats,
  onClose,
  onSave,
}: {
  visible: boolean;
  chats: ChatDTO[];
  onClose: () => void;
  onSave: (name: string, chatIds: string[]) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setName('');
      setSelected(new Set());
    }
  }, [visible]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSave = name.trim().length > 0 && selected.size > 0;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding">
          <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.sheetHandle}>
              <View style={[styles.sheetHandleBar, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {t('chats.filter_create_title')}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('chats.filter_name_placeholder')}
              placeholderTextColor={colors.textMuted}
              style={[
                styles.nameInput,
                { backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border },
              ]}
              maxLength={24}
            />

            <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>
              {t('chats.filter_select_chats')}
            </Text>

            <ScrollView style={styles.chatSelectScroll} showsVerticalScrollIndicator={false}>
              {chats.map((chat) => {
                const on = selected.has(chat.id);
                return (
                  <Pressable
                    key={chat.id}
                    onPress={() => toggle(chat.id)}
                    style={({ pressed }) => [styles.selectRow, pressed && { backgroundColor: colors.surfaceMuted }]}
                  >
                    <View style={[styles.selectAvatar, { backgroundColor: colors.surfaceMuted }]}>
                      <Ionicons name="person" size={20} color={colors.textMuted} />
                    </View>
                    <Text style={[styles.selectName, { color: colors.text }]} numberOfLines={1}>
                      {chat.title ?? 'Chat'}
                    </Text>
                    <View
                      style={[
                        styles.checkCircle,
                        on
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { borderColor: colors.border },
                      ]}
                    >
                      {on ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={canSave ? () => onSave(name.trim(), [...selected]) : undefined}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.surfaceMuted },
                pressed && canSave && { opacity: 0.9 },
                { marginBottom: Math.max(insets.bottom, Spacing.md) },
              ]}
              accessibilityRole="button"
            >
              <Text style={[styles.saveBtnText, { color: canSave ? colors.onPrimary : colors.textMuted }]}>
                {t('chats.filter_save')}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function DeleteFilterModal({
  target,
  onCancel,
  onConfirm,
}: {
  target: CustomFilter | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal transparent animationType="fade" visible={!!target} onRequestClose={onCancel}>
      <View style={styles.dimOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.promptIcon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </View>
          <Text style={[styles.promptTitle, { color: colors.text }]}>
            {t('chats.filter_delete_title')}
          </Text>
          <Text style={[styles.promptBody, { color: colors.textSecondary }]} numberOfLines={1}>
            {target?.name}
          </Text>
          <View style={styles.promptActions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.promptBtn, { borderColor: colors.border }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.promptBtnText, { color: colors.text }]}>{t('chats.filter_cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.promptBtn,
                { backgroundColor: colors.danger, borderColor: colors.danger },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.promptBtnText, { color: '#FFFFFF' }]}>{t('chats.filter_delete')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ChatRow({ chat }: { chat: ChatPreview }) {
  const { colors } = useTheme();
  const unread = chat.unreadCount > 0;
  return (
    <Pressable
      onPress={() => router.push(`/chat/${chat.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.background },
        pressed && [styles.rowPressed, { backgroundColor: colors.surfaceMuted }],
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('chats.open_chat', { name: chat.name })}
    >
      <View>
        <Image
          source={{ uri: chat.avatarUri }}
          style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}
          contentFit="cover"
        />
        {chat.isAI ? (
          <View style={[styles.groupBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Ionicons name="sparkles" size={10} color={colors.onPrimary} />
          </View>
        ) : chat.source === 'whatsapp' ? (
          <View style={[styles.groupBadge, { backgroundColor: '#25D366', borderColor: colors.background }]}>
            <Ionicons name="logo-whatsapp" size={11} color="#FFFFFF" />
          </View>
        ) : chat.isGroup ? (
          <View style={[styles.groupBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
            <Ionicons name="people" size={11} color={colors.onPrimary} />
          </View>
        ) : chat.online ? (
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: colors.success, borderColor: colors.background },
            ]}
          />
        ) : null}
        {chat.isPending ? (
          <View style={[styles.groupBadge, { backgroundColor: colors.warning, borderColor: colors.background }]}>
            <Ionicons name="person-add" size={10} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.name, { color: colors.text }, unread && styles.nameUnread]}
            numberOfLines={1}
          >
            {chat.name}
          </Text>
          <Text
            style={[
              styles.time,
              { color: colors.textMuted },
              unread && [styles.timeUnread, { color: colors.primary }],
            ]}
          >
            {chat.timestamp}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[
              styles.preview,
              { color: colors.textSecondary },
              unread && [styles.previewUnread, { color: colors.text }],
            ]}
            numberOfLines={1}
          >
            {chat.lastMessage}
          </Text>
          <View style={styles.badges}>
            {chat.pinned ? (
              <Ionicons name="pin" size={14} color={colors.textMuted} />
            ) : null}
            {unread ? (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.unreadBadgeText, { color: colors.onPrimary }]}>
                  {chat.unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const AVATAR = 54;
const STORY = 60;

const styles = StyleSheet.create({
  container: { flex: 1 },

  list: { paddingBottom: 96, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
  },
  rowPressed: {},
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radii.pill,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: Radii.pill,
    borderWidth: 2.5,
  },
  groupBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: Radii.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  name: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  nameUnread: { fontWeight: '700' },
  time: { ...Typography.micro },
  timeUnread: { fontWeight: '700' },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  preview: { ...Typography.caption, flex: 1 },
  previewUnread: { fontWeight: '500' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radii.pill,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    marginLeft: Spacing.lg + AVATAR + Spacing.md,
  },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterWrap: {
    borderBottomWidth: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '700',
    maxWidth: 130,
  },
  addChip: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Create-filter sheet ──────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: Spacing.lg,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  sheetTitle: { ...Typography.h3 },
  nameInput: {
    ...Typography.body,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginTop: Spacing.xs,
  },
  selectLabel: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  chatSelectScroll: {
    maxHeight: 300,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.md,
  },
  selectAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
  },
  selectName: {
    ...Typography.body,
    fontSize: 15,
    flex: 1,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.pill,
    marginTop: Spacing.md,
  },
  saveBtnText: {
    ...Typography.body,
    fontWeight: '700',
  },

  // ── Delete confirm ───────────────────────────────────────────────────────────
  dimOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  promptCard: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
  },
  promptIcon: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  promptTitle: { ...Typography.h3, textAlign: 'center' },
  promptBody: { ...Typography.caption, textAlign: 'center' },
  promptActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, width: '100%' },
  promptBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
  },
  promptBtnText: { ...Typography.caption, fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
});
