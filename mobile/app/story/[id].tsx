import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SlideSwap } from '@/components/ui/slide-swap';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { reactStory, viewStory } from '@/data/api/stories';
import type { Story, StoryComment } from '@/data/mock';
import {
  bootstrapStories,
  ensureStory,
  markStoryViewedLocal,
  useStories,
} from '@/data/story-store';
import { t } from '@/i18n';

const REACTIONS = ['❤️', '🔥', '😂', '😮', '🙌'] as const;
type ReplyMode = 'comment' | 'private';

/** Poll/question captions may be plain text or JSON `{ q, a?, b? }`. */
function parseInteractiveCaption(
  caption: string,
  kind: string,
): { q: string; a?: string; b?: string } {
  const trimmed = (caption || '').trim();
  if ((kind === 'poll' || kind === 'question') && trimmed.startsWith('{')) {
    try {
      const o = JSON.parse(trimmed) as { q?: string; a?: string; b?: string };
      return { q: o.q || trimmed, a: o.a, b: o.b };
    } catch {
      /* fall through */
    }
  }
  return { q: trimmed };
}

export default function StoryViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const allStories = useStories();
  // Include own stories so "Your frame" opens the real API story.
  const visibleStories = allStories;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [reactBurst, setReactBurst] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<ReplyMode>('comment');
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [localComments, setLocalComments] = useState<Record<string, StoryComment[]>>({});
  const [hydrating, setHydrating] = useState(true);

  // Ensure feed + target story exist from the API (no mock fallback).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHydrating(true);
      await bootstrapStories().catch(() => {});
      if (id) await ensureStory(id).catch(() => {});
      if (!cancelled) setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || visibleStories.length === 0) return;
    const found = visibleStories.findIndex((item) => item.id === id);
    if (found >= 0) setIndex(found);
  }, [id, visibleStories]);

  const story = visibleStories[index];
  const progress = useSharedValue(0);

  // Mark viewed on server + local when story changes.
  useEffect(() => {
    if (!story?.id) return;
    if (/^[0-9a-f-]{36}$/i.test(story.id)) {
      viewStory(story.id).catch(() => {});
    }
    markStoryViewedLocal(story.id);
  }, [story?.id]);

  const comments = useMemo(() => {
    if (!story) return [] as StoryComment[];
    const base = story.comments ?? [];
    const extra = localComments[story.id] ?? [];
    return [...extra, ...base];
  }, [story, localComments]);

  useEffect(() => {
    [visibleStories[index - 1], visibleStories[index + 1]].forEach((item) => {
      if (item && item.kind !== 'text' && item.kind !== 'audio') Image.prefetch(item.coverUri);
    });
  }, [index, visibleStories]);

  // Pause auto-advance while comments sheet is open.
  useEffect(() => {
    if (commentsOpen) setPaused(true);
    else setPaused(false);
  }, [commentsOpen]);

  const goPrev = useCallback(() => {
    setReply('');
    setCommentsOpen(false);
    if (index > 0) setIndex((i) => i - 1);
    else router.back();
  }, [index]);

  const goNext = useCallback(() => {
    setReply('');
    setCommentsOpen(false);
    if (index < visibleStories.length - 1) setIndex((i) => i + 1);
    else router.back();
  }, [index, visibleStories.length]);

  useEffect(() => {
    // Live stories stay open — no auto-advance.
    if (!story || paused || story.isLive) {
      cancelAnimation(progress);
      if (story?.isLive) progress.value = 1;
      return;
    }
    progress.value = 0;
    const durationMs = Math.max(4, story.durationSec) * 1000;
    progress.value = withTiming(
      1,
      { duration: durationMs, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(goNext)();
      },
    );
    return () => cancelAnimation(progress);
  }, [story?.id, paused, progress, goNext, story]);

  const longPress = Gesture.LongPress()
    .minDuration(160)
    .onStart(() => {
      runOnJS(setPaused)(true);
    })
    .onEnd(() => {
      runOnJS(setPaused)(false);
    })
    .onFinalize(() => {
      runOnJS(setPaused)(false);
    });

  const fireReact = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReactBurst(emoji);
    setToast(t('stories.react_sent'));
    setTimeout(() => setReactBurst(null), 700);
    setTimeout(() => setToast(null), 1400);
    if (story?.id && /^[0-9a-f-]{36}$/i.test(story.id)) {
      reactStory(story.id, emoji).catch(() => {});
    }
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text || !story) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();

    if (replyMode === 'private') {
      setReply('');
      setToast(t('stories.private_reply_sent'));
      setTimeout(() => setToast(null), 1400);
      return;
    }

    if (story.allowComments === false) {
      setToast(t('stories.comments_off'));
      setTimeout(() => setToast(null), 1400);
      return;
    }

    const anon = replyAnonymous && story.allowAnonymousReplies !== false;
    const next: StoryComment = {
      id: `local-${Date.now()}`,
      author: anon ? t('stories.anonymous_author') : 'You',
      avatarUri: anon
        ? 'https://api.dicebear.com/9.x/shapes/png?seed=anon-me&backgroundColor=374151&size=200'
        : 'https://api.dicebear.com/9.x/avataaars/png?seed=you&backgroundColor=EEF2FF&size=200',
      text,
      postedAt: t('channel.just_now'),
      isAnonymous: anon,
    };
    setLocalComments((prev) => ({
      ...prev,
      [story.id]: [next, ...(prev[story.id] ?? [])],
    }));
    setReply('');
    setToast(t('stories.comment_sent'));
    setTimeout(() => setToast(null), 1400);
    if (!commentsOpen) setCommentsOpen(true);
  };

  if (!story) {
    return (
      <SafeAreaView style={styles.fallback}>
        <StatusBar style="light" />
        <Pressable onPress={() => router.back()} style={styles.closeFallback}>
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </Pressable>
        <Text style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 24 }}>
          {hydrating ? '…' : t('stories.add_title')}
        </Text>
      </SafeAreaView>
    );
  }

  const isTextStory =
    story.kind === 'text' ||
    story.kind === 'poll' ||
    story.kind === 'question' ||
    !story.coverUri;
  const isAudio = story.kind === 'audio';
  const interactive = parseInteractiveCaption(story.caption, story.kind);
  const displayName = story.isAnonymous ? t('stories.anonymous_author') : story.user;
  const commentsEnabled = story.allowComments !== false;
  const totalComments = comments.length + comments.reduce((n, c) => n + (c.replies?.length ?? 0), 0);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <SlideSwap index={index}>
        {isTextStory || isAudio ? (
          <View style={[styles.textBackdrop, { backgroundColor: isAudio ? '#12141A' : story.accent }]}>
            <View style={styles.textOrbA} />
            <View style={styles.textOrbB} />
            <View style={styles.textGrain} />
          </View>
        ) : (
          <>
            <Image
              source={{ uri: story.coverUri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.vignetteTop} />
            <View style={styles.vignetteBottom} />
          </>
        )}

        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.progressRow}>
            {visibleStories.map((item, i) => (
              <View key={item.id} style={styles.progressTrack}>
                {i < index ? (
                  <View style={[styles.progressFill, { width: '100%' }]} />
                ) : i === index ? (
                  <ProgressFill progress={progress} />
                ) : (
                  <View style={[styles.progressFill, { width: 0 }]} />
                )}
              </View>
            ))}
          </View>

          <View style={styles.header}>
            <View
              style={[
                styles.avatarRing,
                { borderColor: story.isViewed ? 'rgba(255,255,255,0.45)' : story.accent },
              ]}
            >
              <Image
                source={{ uri: story.isAnonymous ? story.avatarUri : story.avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
            </View>

            <View style={styles.identity}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {displayName}
                </Text>
                {story.isLive ? (
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>{t('stories.live_now')}</Text>
                  </View>
                ) : (
                  <VisibilityPill visibility={story.visibility} />
                )}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {story.isLive
                  ? t('stories.live_viewers', {
                      count: story.liveViewers ?? story.viewers,
                    })
                  : `${story.postedAt} · ${t('stories.expires', { time: story.expiresIn })}`}
              </Text>
            </View>

            {paused && !commentsOpen ? (
              <Animated.View entering={FadeIn.duration(120)} style={styles.pausePill}>
                <Ionicons name="pause" size={12} color="#FFF" />
                <Text style={styles.pauseText}>{t('stories.hold_to_pause')}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityLabel={t('stories.close')}
            >
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </Pressable>
          </View>

          <GestureDetector gesture={longPress}>
            <View style={styles.tapLayer}>
              <Pressable onPress={goPrev} style={styles.tapZone} accessibilityLabel={t('stories.previous')} />
              <Pressable onPress={goNext} style={styles.tapZone} accessibilityLabel={t('stories.next')} />
            </View>
          </GestureDetector>

          <View style={styles.storyBody} pointerEvents="none">
            {story.kind === 'video' ? (
              <View style={styles.videoBadge}>
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={styles.videoBadgeText}>{story.durationSec}s</Text>
              </View>
            ) : null}

            {isAudio ? (
              <View style={styles.audioCard}>
                <View style={styles.audioOrb}>
                  <Ionicons name="mic" size={34} color="#FFF" />
                </View>
                <Text style={styles.audioLabel}>{t('stories.play_audio')}</Text>
                <Text style={styles.audioDuration}>{story.audioSec ?? story.durationSec}s</Text>
              </View>
            ) : null}

            {story.kind === 'poll' ? (
              <View style={styles.pollPreview}>
                <Text style={styles.pollEyebrow}>{t('stories.poll_mode')}</Text>
                <Text style={styles.pollQuestion}>{interactive.q || story.caption}</Text>
                <View style={styles.pollOpt}>
                  <Text style={styles.pollOptText}>
                    {interactive.a || t('stories.poll_yes')}
                  </Text>
                </View>
                <View style={styles.pollOpt}>
                  <Text style={styles.pollOptText}>
                    {interactive.b || t('stories.poll_no')}
                  </Text>
                </View>
              </View>
            ) : story.kind === 'question' ? (
              <View style={styles.pollPreview}>
                <Text style={styles.pollEyebrow}>{t('stories.question_mode')}</Text>
                <Text style={styles.pollQuestion}>{interactive.q || story.caption}</Text>
                <View style={[styles.pollOpt, { backgroundColor: '#EEF2FF' }]}>
                  <Text style={[styles.pollOptText, { color: story.accent }]}>
                    {t('stories.answer_placeholder')}
                  </Text>
                </View>
              </View>
            ) : story.caption ? (
              <Text style={[styles.caption, isTextStory && styles.textCaption]}>
                {story.caption}
              </Text>
            ) : null}
          </View>

          {reactBurst ? (
            <Animated.View
              entering={FadeInDown.springify()}
              exiting={FadeOut.duration(200)}
              style={styles.burst}
              pointerEvents="none"
            >
              <Text style={styles.burstEmoji}>{reactBurst}</Text>
            </Animated.View>
          ) : null}

          {toast ? (
            <Animated.View entering={FadeIn.duration(150)} style={styles.toast}>
              <Text style={styles.toastText}>{toast}</Text>
            </Animated.View>
          ) : null}
        </SafeAreaView>
      </SlideSwap>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={styles.metrics}>
          <Metric icon="eye-outline" label={t('stories.views', { count: story.viewers })} />
          <Pressable onPress={() => commentsEnabled && setCommentsOpen(true)} hitSlop={8}>
            <Metric
              icon="chatbubble-ellipses-outline"
              label={t('stories.comments_count', { count: totalComments || story.replies })}
            />
          </Pressable>
        </View>

        <View style={styles.reactTray}>
          {REACTIONS.map((emoji) => (
            <ReactChip key={emoji} emoji={emoji} onPress={() => fireReact(emoji)} />
          ))}
          {commentsEnabled ? (
            <Pressable onPress={() => setCommentsOpen(true)} style={styles.commentsBtn}>
              <Ionicons name="chatbubbles" size={17} color="#FFF" />
              <Text style={styles.commentsBtnText}>
                {story.isLive ? t('stories.live_chat') : t('stories.view_comments')}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Live chat ticker */}
        {story.isLive && comments.length > 0 ? (
          <View style={styles.liveTicker}>
            {comments.slice(0, 3).map((c) => (
              <View key={c.id} style={styles.liveTickerRow}>
                <Text style={styles.liveTickerAuthor}>
                  {c.isAnonymous ? t('stories.anonymous_author') : c.author}
                </Text>
                <Text style={styles.liveTickerText} numberOfLines={1}>
                  {c.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Reply mode switcher */}
        <View style={styles.modeSwitch}>
          <ModeTab
            active={replyMode === 'comment'}
            label={t('stories.comment_public')}
            hint={t('stories.comment_public_hint')}
            disabled={!commentsEnabled}
            onPress={() => setReplyMode('comment')}
          />
          <ModeTab
            active={replyMode === 'private'}
            label={t('stories.reply_private')}
            hint={t('stories.reply_private_hint')}
            onPress={() => setReplyMode('private')}
          />
        </View>

        {replyMode === 'comment' && commentsEnabled && story.allowAnonymousReplies !== false ? (
          <Pressable
            onPress={() => setReplyAnonymous((v) => !v)}
            style={styles.anonToggle}
            hitSlop={6}
          >
            <Ionicons
              name={replyAnonymous ? 'checkbox' : 'square-outline'}
              size={16}
              color="rgba(255,255,255,0.85)"
            />
            <Text style={styles.anonToggleText}>{t('stories.reply_as_anonymous')}</Text>
          </Pressable>
        ) : null}

        {!commentsEnabled && replyMode === 'comment' ? (
          <Text style={styles.commentsOff}>{t('stories.comments_off')}</Text>
        ) : (
          <View style={styles.replyRow}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={styles.replyInput}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => setPaused(true)}
                  onBlur={() => !commentsOpen && setPaused(false)}
                  placeholder={
                    replyMode === 'private'
                      ? t('stories.reply_placeholder')
                      : t('stories.comment_placeholder')
                  }
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={styles.input}
                  returnKeyType="send"
                  onSubmitEditing={sendReply}
                />
              </BlurView>
            ) : (
              <View style={[styles.replyInput, styles.replyInputAndroid]}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => setPaused(true)}
                  onBlur={() => !commentsOpen && setPaused(false)}
                  placeholder={
                    replyMode === 'private'
                      ? t('stories.reply_placeholder')
                      : t('stories.comment_placeholder')
                  }
                  placeholderTextColor="rgba(255,255,255,0.62)"
                  style={styles.input}
                  returnKeyType="send"
                  onSubmitEditing={sendReply}
                />
              </View>
            )}
            <Pressable
              onPress={sendReply}
              style={({ pressed }) => [
                styles.sendButton,
                { backgroundColor: reply.trim() ? story.accent : 'rgba(255,255,255,0.18)' },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
              accessibilityLabel={t('stories.send_comment')}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>

      <CommentsSheet
        visible={commentsOpen}
        story={story}
        comments={comments}
        bottomInset={insets.bottom}
        onClose={() => setCommentsOpen(false)}
        onReply={(text, anonymous) => {
          if (!text.trim()) return;
          const anon = anonymous && story.allowAnonymousReplies !== false;
          const next: StoryComment = {
            id: `local-${Date.now()}`,
            author: anon ? t('stories.anonymous_author') : 'You',
            avatarUri: anon
              ? 'https://api.dicebear.com/9.x/shapes/png?seed=anon-me&backgroundColor=374151&size=200'
              : 'https://api.dicebear.com/9.x/avataaars/png?seed=you&backgroundColor=EEF2FF&size=200',
            text: text.trim(),
            postedAt: t('channel.just_now'),
            isAnonymous: anon,
          };
          setLocalComments((prev) => ({
            ...prev,
            [story.id]: [next, ...(prev[story.id] ?? [])],
          }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function VisibilityPill({ visibility }: { visibility?: Story['visibility'] }) {
  const v = visibility ?? 'contacts';
  const label =
    v === 'public'
      ? t('stories.visibility_public')
      : v === 'close'
        ? t('stories.visibility_close')
        : t('stories.visibility_contacts');
  const icon: keyof typeof Ionicons.glyphMap =
    v === 'public' ? 'globe-outline' : v === 'close' ? 'star' : 'people-outline';
  return (
    <View style={styles.visPill}>
      <Ionicons name={icon} size={10} color="rgba(255,255,255,0.85)" />
      <Text style={styles.visPillText}>{label}</Text>
    </View>
  );
}

function ProgressFill({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progress.value * 100))}%`,
  }));
  return <Animated.View style={[styles.progressFill, style]} />;
}

function Metric({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={15} color="rgba(255,255,255,0.82)" />
      <Text style={styles.metricText}>{label}</Text>
    </View>
  );
}

function ReactChip({ emoji, onPress }: { emoji: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => {
        scale.value = withSequence(
          withSpring(1.28, { damping: 8, stiffness: 320 }),
          withSpring(1, { damping: 12, stiffness: 220 }),
        );
        onPress();
      }}
      hitSlop={6}
    >
      <Animated.View style={[styles.reactChip, style]}>
        <Text style={styles.reactEmoji}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  );
}

function ModeTab({
  active,
  label,
  hint,
  onPress,
  disabled,
}: {
  active: boolean;
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.modeTab,
        active && styles.modeTabActive,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.modeTabLabel, active && styles.modeTabLabelActive]}>{label}</Text>
      <Text style={styles.modeTabHint} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

const SHEET_EMOJIS = ['❤️', '🔥', '😂', '👏', '😮', '🙌', '💯', '✨'];

function CommentsSheet({
  visible,
  story,
  comments,
  bottomInset,
  onClose,
  onReply,
}: {
  visible: boolean;
  story: Story;
  comments: StoryComment[];
  bottomInset: number;
  onClose: () => void;
  onReply: (text: string, anonymous: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [anon, setAnon] = useState(false);
  const canAnon = story.allowAnonymousReplies !== false;
  const isLive = !!story.isLive;

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.commentsSheet, { paddingBottom: Math.max(bottomInset, 16) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetGrip} />
          <View style={styles.sheetHeader}>
            <View>
              <View style={styles.sheetTitleRow}>
                {isLive ? (
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>{t('stories.live_now')}</Text>
                  </View>
                ) : null}
                <Text style={styles.sheetTitle}>
                  {isLive ? t('stories.live_chat') : t('stories.comments')}
                </Text>
              </View>
              <Text style={styles.sheetCount}>
                {t('stories.comments_count', { count: comments.length })}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.sheetClose} hitSlop={10}>
              <Ionicons name="close" size={18} color="#FFF" />
            </Pressable>
          </View>

          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            style={styles.commentList}
            contentContainerStyle={
              comments.length === 0 ? styles.commentEmptyWrap : styles.commentListContent
            }
            ListEmptyComponent={
              <View style={styles.commentEmptyCard}>
                <Ionicons name="chatbubbles-outline" size={36} color="rgba(255,255,255,0.35)" />
                <Text style={styles.commentEmpty}>{t('stories.no_comments')}</Text>
              </View>
            }
            renderItem={({ item }) => <CommentRow comment={item} />}
          />

          {story.allowComments !== false ? (
            <View style={styles.sheetComposer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sheetEmojiRow}
              >
                {SHEET_EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setDraft((d) => d + e)}
                    style={styles.sheetEmojiBtn}
                  >
                    <Text style={styles.sheetEmoji}>{e}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {canAnon ? (
                <Pressable onPress={() => setAnon((v) => !v)} style={styles.anonToggle}>
                  <Ionicons
                    name={anon ? 'checkbox' : 'square-outline'}
                    size={16}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.anonToggleText}>{t('stories.reply_as_anonymous')}</Text>
                </Pressable>
              ) : null}
              <View style={styles.sheetInputRow}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('stories.comment_placeholder')}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.sheetInput}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    onReply(draft, anon);
                    setDraft('');
                  }}
                />
                <Pressable
                  onPress={() => {
                    onReply(draft, anon);
                    setDraft('');
                  }}
                  style={[
                    styles.sheetSend,
                    {
                      backgroundColor: draft.trim()
                        ? isLive
                          ? '#EF4444'
                          : story.accent
                        : 'rgba(255,255,255,0.15)',
                    },
                  ]}
                >
                  <Ionicons name="send" size={16} color="#FFF" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.commentsOff}>{t('stories.comments_off')}</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CommentRow({ comment }: { comment: StoryComment }) {
  return (
    <View style={styles.commentRow}>
      <Image source={{ uri: comment.avatarUri }} style={styles.commentAvatar} contentFit="cover" />
      <View style={styles.commentBody}>
        <View style={styles.commentBubble}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentAuthor}>
              {comment.isAnonymous ? t('stories.anonymous_author') : comment.author}
            </Text>
            <Text style={styles.commentTime}>{comment.postedAt}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
        {comment.replies?.map((r) => (
          <View key={r.id} style={styles.nestedReply}>
            <Image source={{ uri: r.avatarUri }} style={styles.nestedAvatar} contentFit="cover" />
            <View style={styles.commentBubble}>
              <Text style={styles.commentAuthor}>
                {r.isAnonymous ? t('stories.anonymous_author') : r.author}
                <Text style={styles.commentTime}> · {r.postedAt}</Text>
              </Text>
              <Text style={styles.commentText}>{r.text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0C10' },
  fallback: { flex: 1, backgroundColor: '#0B0C10' },
  closeFallback: {
    width: 48,
    height: 48,
    margin: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1, paddingHorizontal: Spacing.md },
  vignetteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '28%',
    backgroundColor: 'rgba(11,12,16,0.48)',
  },
  vignetteBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(11,12,16,0.58)',
  },
  textBackdrop: { ...StyleSheet.absoluteFillObject },
  textOrbA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.16)',
    top: '18%',
    left: '-12%',
  },
  textOrbB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.12)',
    bottom: '22%',
    right: '-8%',
  },
  textGrain: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.04)' },
  progressRow: { flexDirection: 'row', gap: 4, paddingTop: Spacing.sm },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: Radii.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: Radii.pill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    borderWidth: 2,
    padding: 1.5,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%', borderRadius: Radii.pill },
  identity: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...Typography.bodyStrong, color: '#FFFFFF', flexShrink: 1 },
  visPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  visPillText: { ...Typography.micro, color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: '#EF4444',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  livePillText: {
    ...Typography.micro,
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.6,
  },
  meta: { ...Typography.micro, color: 'rgba(255,255,255,0.78)', marginTop: 1 },
  pausePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pauseText: { ...Typography.micro, color: '#FFF', fontWeight: '600' },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 100,
    bottom: 260,
    flexDirection: 'row',
  },
  tapZone: { flex: 1 },
  storyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: 220,
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: Spacing.lg,
  },
  videoBadgeText: { ...Typography.caption, color: '#FFFFFF', fontWeight: '600' },
  audioCard: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  audioOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(45,91,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLabel: { ...Typography.bodyStrong, color: '#FFF' },
  audioDuration: { ...Typography.caption, color: 'rgba(255,255,255,0.7)' },
  pollPreview: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  pollEyebrow: {
    ...Typography.micro,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pollQuestion: { ...Typography.h3, color: '#111827' },
  pollOpt: {
    minHeight: 46,
    borderRadius: Radii.lg,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollOptText: { ...Typography.bodyStrong, color: '#111827' },
  caption: {
    ...Typography.h2,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  textCaption: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.4 },
  burst: { position: 'absolute', alignSelf: 'center', top: '42%' },
  burstEmoji: { fontSize: 72 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 280,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  toastText: { ...Typography.caption, color: '#FFF', fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  metrics: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricText: { ...Typography.micro, color: 'rgba(255,255,255,0.82)' },
  reactTray: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reactChip: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reactEmoji: { fontSize: 20 },
  commentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  commentsBtnText: { ...Typography.micro, color: '#FFF', fontWeight: '700' },
  liveTicker: {
    gap: 4,
    maxHeight: 88,
    overflow: 'hidden',
  },
  liveTickerRow: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  liveTickerAuthor: { ...Typography.micro, color: '#FFF', fontWeight: '800' },
  liveTickerText: { ...Typography.micro, color: 'rgba(255,255,255,0.88)', flexShrink: 1 },
  modeSwitch: { flexDirection: 'row', gap: Spacing.sm },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modeTabActive: {
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  modeTabLabel: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', fontWeight: '700' },
  modeTabLabelActive: { color: '#FFF' },
  modeTabHint: { ...Typography.micro, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontSize: 10 },
  anonToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  anonToggleText: { ...Typography.micro, color: 'rgba(255,255,255,0.85)' },
  commentsOff: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  replyInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  replyInputAndroid: { backgroundColor: 'rgba(0,0,0,0.38)' },
  input: {
    ...Typography.body,
    color: '#FFFFFF',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  commentsSheet: {
    maxHeight: '78%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#12141A',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: Spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { ...Typography.h3, color: '#FFF', fontSize: 18 },
  sheetCount: { ...Typography.caption, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentList: { maxHeight: 340 },
  commentListContent: { paddingBottom: Spacing.sm, gap: 2 },
  commentEmptyWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xxl },
  commentEmptyCard: { alignItems: 'center', gap: Spacing.sm },
  commentEmpty: { ...Typography.body, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  commentRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1F2937' },
  commentBody: { flex: 1, gap: 6 },
  commentBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderTopLeftRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
  commentTime: { ...Typography.micro, color: 'rgba(255,255,255,0.45)' },
  commentText: { ...Typography.body, color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  nestedReply: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  nestedAvatar: { width: 24, height: 24, borderRadius: 12 },
  sheetComposer: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  sheetEmojiRow: { gap: 8, paddingVertical: 2 },
  sheetEmojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetEmoji: { fontSize: 20 },
  sheetInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sheetInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    ...Typography.body,
  },
  sheetSend: {
    width: 46,
    height: 46,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSendText: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
});
