import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlideSwap } from '@/components/ui/slide-swap';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { STORIES } from '@/data/mock';
import { t } from '@/i18n';

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const visibleStories = useMemo(() => STORIES.filter((item) => !item.isOwn), []);

  // The route param only seeds the starting point. After that, moving between
  // stories is local state — no route navigation, so the screen never
  // unmounts and there is no white flash between stories.
  const [index, setIndex] = useState(() => {
    const found = visibleStories.findIndex((item) => item.id === id);
    return found >= 0 ? found : 0;
  });

  const story = visibleStories[index];

  // Warm the neighbouring covers so a switch never waits on the network.
  useEffect(() => {
    [visibleStories[index - 1], visibleStories[index + 1]].forEach((item) => {
      if (item && item.kind !== 'text') Image.prefetch(item.coverUri);
    });
  }, [index, visibleStories]);

  if (!story) {
    return (
      <SafeAreaView style={styles.fallback}>
        <StatusBar style="light" />
        <Pressable onPress={() => router.back()} style={styles.closeFallback}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
      </SafeAreaView>
    );
  }

  const isTextStory = story.kind === 'text';

  const goPrev = () => (index > 0 ? setIndex(index - 1) : router.back());
  const goNext = () =>
    index < visibleStories.length - 1 ? setIndex(index + 1) : router.back();

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <SlideSwap index={index}>
        {isTextStory ? (
          <View style={[styles.textBackdrop, { backgroundColor: story.accent }]}>
            <View style={styles.textHalo} />
          </View>
        ) : (
          <>
            <Image
              source={{ uri: story.coverUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <View style={styles.scrim} />
          </>
        )}

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.progressRow}>
            {visibleStories.map((item, i) => (
              <View key={item.id} style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: i < index ? '100%' : i === index ? '62%' : '0%' },
                  ]}
                />
              </View>
            ))}
          </View>

          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityLabel={t('stories.close')}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>

            <Image source={{ uri: story.avatarUri }} style={styles.avatar} contentFit="cover" />

            <View style={styles.identity}>
              <Text style={styles.name} numberOfLines={1}>
                {story.user}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {story.postedAt} · {t('stories.expires', { time: story.expiresIn })}
              </Text>
            </View>

            <Pressable hitSlop={12} style={styles.iconButton} accessibilityLabel={t('common.more')}>
              <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.tapLayer}>
            <Pressable onPress={goPrev} style={styles.tapZone} accessibilityLabel={t('stories.previous')} />
            <Pressable onPress={goNext} style={styles.tapZone} accessibilityLabel={t('stories.next')} />
          </View>

          <View style={styles.storyBody} pointerEvents="none">
            {story.kind === 'video' ? (
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.videoBadgeText}>{story.durationSec}s</Text>
              </View>
            ) : null}

            <Text style={[styles.caption, isTextStory && styles.textCaption]}>{story.caption}</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Ionicons name="eye-outline" size={17} color="rgba(255,255,255,0.82)" />
                <Text style={styles.metricText}>{t('stories.views', { count: story.viewers })}</Text>
              </View>
              <View style={styles.metric}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.82)" />
                <Text style={styles.metricText}>{t('stories.replies', { count: story.replies })}</Text>
              </View>
            </View>

            <View style={styles.replyRow}>
              <View style={styles.replyInput}>
                <TextInput
                  placeholder={t('stories.reply_placeholder')}
                  placeholderTextColor="rgba(255,255,255,0.72)"
                  style={styles.input}
                />
              </View>
              <Pressable style={styles.sendButton} accessibilityLabel={t('chat.send')}>
                <Ionicons name="send" size={19} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </SlideSwap>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050609',
  },
  fallback: {
    flex: 1,
    backgroundColor: '#050609',
  },
  closeFallback: {
    width: 48,
    height: 48,
    margin: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  textBackdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textHalo: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ scale: 1.4 }],
  },
  progressRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  identity: {
    flex: 1,
  },
  name: {
    ...Typography.bodyStrong,
    color: '#FFFFFF',
  },
  meta: {
    ...Typography.micro,
    color: 'rgba(255,255,255,0.78)',
    marginTop: 1,
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 112,
    bottom: 126,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
  },
  storyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.38)',
    marginBottom: Spacing.lg,
  },
  videoBadgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  caption: {
    ...Typography.h2,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.38)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  textCaption: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  footer: {
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricText: {
    ...Typography.micro,
    color: 'rgba(255,255,255,0.82)',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  replyInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(0,0,0,0.24)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  input: {
    ...Typography.body,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
