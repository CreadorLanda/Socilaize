import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { STORIES, type Story } from '@/data/mock';
import { t } from '@/i18n';

export default function StoriesScreen() {
  const me = STORIES.find((s) => s.isOwn);
  const others = STORIES.filter((s) => !s.isOwn);

  return (
    <View style={styles.safe}>
      <FlatList
        data={others}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          me ? (
            <View style={styles.section}>
              <Pressable style={styles.myStory} accessibilityRole="button">
                <View style={styles.myAvatarWrap}>
                  <Image source={{ uri: me.avatarUri }} style={styles.myAvatar} contentFit="cover" />
                  <View style={styles.addBadge}>
                    <Ionicons name="add" size={16} color={Colors.light.onPrimary} />
                  </View>
                </View>
                <View style={styles.myStoryText}>
                  <Text style={styles.myStoryTitle}>{t('stories.add_title')}</Text>
                  <Text style={styles.myStorySubtitle}>{t('stories.add_subtitle')}</Text>
                </View>
              </Pressable>
              <Text style={styles.sectionLabel}>{t('stories.recent')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <StoryRow story={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
      />

      <Pressable
        onPress={() => {}}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel={t('stories.add_title')}
      >
        <Ionicons name="camera" size={22} color={Colors.light.onPrimary} />
      </Pressable>
    </View>
  );
}

function StoryRow({ story }: { story: Story }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open story from ${story.user}`}
    >
      <View
        style={[styles.ring, story.isViewed ? styles.ringViewed : styles.ringActive]}
      >
        <View style={styles.ringInner}>
          <Image source={{ uri: story.avatarUri }} style={styles.avatar} contentFit="cover" />
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {story.user}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {story.username} · {story.isViewed ? t('stories.viewed') : t('stories.new')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.light.textMuted} />
    </Pressable>
  );
}

const AVATAR = 52;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },

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

  list: { paddingBottom: 96 },
  section: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.sm },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },

  myStory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.light.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  myAvatarWrap: { width: AVATAR + 4, height: AVATAR + 4 },
  myAvatar: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: Radii.pill,
    backgroundColor: Palette.neutral[100],
  },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  myStoryText: { flex: 1 },
  myStoryTitle: { ...Typography.bodyStrong, color: Colors.light.text },
  myStorySubtitle: { ...Typography.caption, color: Colors.light.textSecondary, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowPressed: { backgroundColor: Palette.neutral[100] },
  ring: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  ringActive: {
    backgroundColor: 'transparent',
    borderWidth: 2.5,
    borderColor: Palette.brand[500],
  },
  ringViewed: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Palette.neutral[300],
  },
  ringInner: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    backgroundColor: Palette.neutral[100],
  },
  avatar: { width: '100%', height: '100%' },
  rowText: { flex: 1 },
  rowTitle: { ...Typography.bodyStrong, color: Colors.light.text },
  rowSubtitle: { ...Typography.caption, color: Colors.light.textSecondary, marginTop: 2 },
  divider: {
    height: 1,
    backgroundColor: Colors.light.divider,
    marginLeft: Spacing.xl + AVATAR + Spacing.md + 8,
  },
});
