import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { CHATS, STORIES, type ChatPreview, type Story } from '@/data/mock';
import { t } from '@/i18n';

export default function ChatsScreen() {
  const me = STORIES.find((s) => s.isOwn);
  const others = STORIES.filter((s) => !s.isOwn);

  return (
    <View style={styles.container}>
      <FlatList
        data={CHATS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <StoryStrip me={me} others={others} />
        }
        renderItem={({ item }) => <ChatRow chat={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        stickyHeaderIndices={[]}
      />

      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('chats.new_chat')}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={Colors.light.onPrimary} />
      </Pressable>
    </View>
  );
}

function StoryStrip({ me, others }: { me?: Story; others: Story[] }) {
  return (
    <View style={styles.stripWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {me ? (
          <Pressable style={styles.storyItem} accessibilityRole="button">
            <View style={[styles.storyRing, styles.storyRingMine]}>
              <View style={styles.storyInner}>
                <Image source={{ uri: me.avatarUri }} style={styles.storyAvatar} contentFit="cover" />
              </View>
              <View style={styles.storyAddBadge}>
                <Ionicons name="add" size={14} color={Colors.light.onPrimary} />
              </View>
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>
              {t('chats.your_story')}
            </Text>
          </Pressable>
        ) : null}

        {others.map((s) => (
          <Pressable key={s.id} style={styles.storyItem} accessibilityRole="button">
            <View style={[styles.storyRing, s.isViewed ? styles.storyRingViewed : styles.storyRingActive]}>
              <View style={styles.storyInner}>
                <Image source={{ uri: s.avatarUri }} style={styles.storyAvatar} contentFit="cover" />
              </View>
            </View>
            <Text style={styles.storyLabel} numberOfLines={1}>
              {s.user}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ChatRow({ chat }: { chat: ChatPreview }) {
  const unread = chat.unreadCount > 0;
  return (
    <Pressable
      onPress={() => router.push(`/chat/${chat.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${chat.name}`}
    >
      <View>
        <Image source={{ uri: chat.avatarUri }} style={styles.avatar} contentFit="cover" />
        {chat.online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.rowText}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={[styles.time, unread && styles.timeUnread]}>{chat.timestamp}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {chat.lastMessage}
          </Text>
          <View style={styles.badges}>
            {chat.pinned ? (
              <Ionicons name="pin" size={14} color={Colors.light.textMuted} />
            ) : null}
            {unread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
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
  container: { flex: 1, backgroundColor: Colors.light.background },

  list: { paddingBottom: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: Colors.light.background,
  },
  rowPressed: { backgroundColor: Palette.neutral[100] },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radii.pill,
    backgroundColor: Palette.neutral[100],
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.success,
    borderWidth: 2.5,
    borderColor: Colors.light.background,
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
    color: Colors.light.text,
    flex: 1,
  },
  nameUnread: { fontWeight: '700' },
  time: { ...Typography.micro, color: Colors.light.textMuted },
  timeUnread: { color: Colors.light.primary, fontWeight: '700' },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  preview: { ...Typography.caption, color: Colors.light.textSecondary, flex: 1 },
  previewUnread: { color: Colors.light.text, fontWeight: '500' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    ...Typography.micro,
    color: Colors.light.onPrimary,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.light.divider,
    marginLeft: Spacing.lg + AVATAR + Spacing.md,
  },

  stripWrap: {
    backgroundColor: Colors.light.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
  },
  strip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    width: STORY + 16,
    gap: Spacing.xs,
  },
  storyRing: {
    width: STORY + 6,
    height: STORY + 6,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
  },
  storyRingActive: { backgroundColor: Palette.brand[500] },
  storyRingViewed: { backgroundColor: Palette.neutral[300] },
  storyRingMine: { backgroundColor: Palette.neutral[200] },
  storyInner: {
    width: STORY,
    height: STORY,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    backgroundColor: Colors.light.background,
    padding: 2,
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: Palette.neutral[100],
  },
  storyAddBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: Colors.light.background,
  },
  storyLabel: {
    ...Typography.micro,
    color: Colors.light.textSecondary,
    maxWidth: STORY + 12,
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.brand[500],
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: {
    backgroundColor: Palette.brand[600],
    transform: [{ scale: 0.95 }],
  },
});
