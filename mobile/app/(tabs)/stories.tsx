import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { TabScene } from '@/components/ui/tab-scene';
import { useTheme } from '@/hooks/use-theme';
import { STORIES, type Story } from '@/data/mock';
import { t } from '@/i18n';

export default function StoriesScreen() {
  const { colors } = useTheme();
  const me = STORIES.find((s) => s.isOwn);
  const others = STORIES.filter((s) => !s.isOwn);

  return (
    <TabScene>
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        data={others}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          me ? (
            <View style={styles.section}>
              <Pressable
                onPress={() => router.push('/story/create')}
                style={[styles.myStory, { backgroundColor: colors.surface, borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <View style={styles.myAvatarWrap}>
                  <Image
                    source={{ uri: me.avatarUri }}
                    style={[styles.myAvatar, { backgroundColor: colors.surfaceMuted }]}
                    contentFit="cover"
                  />
                  <View
                    style={[styles.addBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}
                  >
                    <Ionicons name="add" size={16} color={colors.onPrimary} />
                  </View>
                </View>
                <View style={styles.myStoryText}>
                  <Text style={[styles.myStoryTitle, { color: colors.text }]}>{t('stories.add_title')}</Text>
                  <Text style={[styles.myStorySubtitle, { color: colors.textSecondary }]}>
                    {t('stories.add_subtitle')}
                  </Text>
                </View>
              </Pressable>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('stories.recent')}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <StoryRow story={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => (
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
        )}
      />

      <Pressable
        onPress={() => router.push('/story/create')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, shadowColor: colors.primary },
          pressed && styles.fabPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('stories.add_title')}
      >
        <Ionicons name="camera" size={22} color={colors.onPrimary} />
      </Pressable>
    </View>
    </TabScene>
  );
}

function StoryRow({ story }: { story: Story }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/story/${story.id}`)}
      style={({ pressed }) => [
        styles.row,
        pressed && [styles.rowPressed, { backgroundColor: colors.surfaceMuted }],
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('stories.open_story', { name: story.user })}
    >
      <View
        style={[
          styles.ring,
          {
            borderColor: story.isViewed ? colors.border : colors.primary,
            borderWidth: story.isViewed ? 2 : 2.5,
          },
        ]}
      >
        <View style={[styles.ringInner, { backgroundColor: colors.surfaceMuted }]}>
          <Image source={{ uri: story.avatarUri }} style={styles.avatar} contentFit="cover" />
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {story.user}
        </Text>
        <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {story.postedAt} · {story.isViewed ? t('stories.viewed') : t('stories.new')}
        </Text>
      </View>
      <View style={[styles.kindBadge, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons
          name={story.kind === 'video' ? 'videocam' : story.kind === 'text' ? 'text' : 'image'}
          size={14}
          color={colors.textSecondary}
        />
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const AVATAR = 52;

const styles = StyleSheet.create({
  safe: { flex: 1 },

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

  list: { paddingBottom: 96 },
  section: { paddingHorizontal: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing.sm },
  sectionLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.md,
  },

  myStory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  myAvatarWrap: { width: AVATAR + 4, height: AVATAR + 4 },
  myAvatar: {
    width: AVATAR + 4,
    height: AVATAR + 4,
    borderRadius: Radii.pill,
  },
  addBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  myStoryText: { flex: 1 },
  myStoryTitle: { ...Typography.bodyStrong },
  myStorySubtitle: { ...Typography.caption, marginTop: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  rowPressed: {},
  ring: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  ringInner: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  rowText: { flex: 1 },
  rowTitle: { ...Typography.bodyStrong },
  rowSubtitle: { ...Typography.caption, marginTop: 2 },
  kindBadge: {
    width: 30,
    height: 30,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginLeft: Spacing.xl + AVATAR + Spacing.md + 8,
  },
});
