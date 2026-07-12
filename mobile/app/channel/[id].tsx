import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCount } from '@/components/ui/follow-button';
import { ReactionTray } from '@/components/ui/reaction-tray';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { mediaFileURL, uploadMedia } from '@/data/api/media';
import {
  addChannelPost,
  addCommentToPost,
  canManage,
  canPublish,
  loadPostComments,
  refreshChannel,
  setPostReaction,
  toggleFollow,
  useChannel,
  useIsFollowing,
} from '@/data/channel-store';
import { CURRENT_USER, type ChannelComment, type ChannelPost } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import * as ImagePicker from 'expo-image-picker';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const COMMENT_EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
const ACTION_BAR_WIDTH = 360;
const ACTION_BAR_HEIGHT = 44;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const countComments = (list: ChannelComment[]) =>
  list.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0);

export default function ChannelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const channel = useChannel(id);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const followId = channel?.id ?? id ?? '';
  const isFollowing = useIsFollowing(followId);
  const publishOk = canPublish(channel);
  const manageOk = canManage(channel);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [postKind, setPostKind] = useState<
    'text' | 'image' | 'video' | 'game' | 'live' | 'voice'
  >('text');
  const [postGame, setPostGame] = useState<
    'trivia' | 'dice' | 'would_you_rather' | 'quick_draw' | 'emoji_race'
  >('trivia');
  const [actionPostId, setActionPostId] = useState<string | null>(null);
  const [actionAnchor, setActionAnchor] = useState<{ x: number; y: number } | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commentReplyTo, setCommentReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentFocused, setCommentFocused] = useState(false);
  const commentInputRef = useRef<TextInput>(null);
  const commentScrollRef = useRef<ScrollView>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const actionBarWidth = Math.min(ACTION_BAR_WIDTH, screenWidth - Spacing.lg * 2);
  const actionBarPosition = useMemo(() => {
    if (!actionAnchor) return null;
    const left = clamp(
      actionAnchor.x - actionBarWidth / 2,
      Spacing.md,
      screenWidth - actionBarWidth - Spacing.md,
    );
    const top = clamp(
      actionAnchor.y - ACTION_BAR_HEIGHT - Spacing.md,
      insets.top + Spacing.sm,
      screenHeight - ACTION_BAR_HEIGHT - insets.bottom - Spacing.sm,
    );
    return { left, top };
  }, [actionAnchor, actionBarWidth, insets.bottom, insets.top, screenHeight, screenWidth]);
  const actionBarStyle = {
    left: actionBarPosition?.left ?? Spacing.lg,
    top: actionBarPosition?.top ?? insets.top + Spacing.xl,
    width: actionBarWidth,
  };

  // Hydrate channel + posts from API when opening a real channel.
  useEffect(() => {
    if (!id) return;
    refreshChannel(id).catch(() => {});
  }, [id]);

  useEffect(() => {
    setPosts(channel?.posts ?? []);
  }, [channel, channel?.posts]);

  const actionPost = useMemo(
    () => posts.find((post) => post.id === actionPostId),
    [posts, actionPostId],
  );
  const commentPost = useMemo(
    () => posts.find((post) => post.id === commentPostId),
    [posts, commentPostId],
  );
  const comments = commentPost?.comments ?? [];
  const mediaCount = useMemo(() => posts.filter((p) => !!p.mediaUri).length, [posts]);
  const commentCount = useMemo(
    () => posts.reduce((sum, p) => sum + countComments(p.comments ?? []), 0),
    [posts],
  );
  const ruleDefaults = [
    t('channel.rules_item_1'),
    t('channel.rules_item_2'),
    t('channel.rules_item_3'),
  ];
  const rules = channel?.rules && channel.rules.length > 0 ? channel.rules : ruleDefaults;

  const updatePost = (postId: string, updater: (post: ChannelPost) => ChannelPost) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? updater(post) : post)));
  };

  const handleReaction = (emoji: string) => {
    if (!actionPostId || !channel) return;
    const current = actionPost?.myReaction ?? null;
    // Toggle off when re-selecting the same emoji.
    setPostReaction(channel.id, actionPostId, current === emoji ? null : emoji);
    // Mirror into local posts for snappy UI before store re-emit.
    updatePost(actionPostId, (post) => {
      const reactions = [...(post.reactions ?? [])];
      const apply = (em: string, delta: number) => {
        const i = reactions.findIndex((r) => r.emoji === em);
        if (i < 0) {
          if (delta > 0) reactions.push({ emoji: em, count: delta });
          return;
        }
        const n = reactions[i].count + delta;
        if (n <= 0) reactions.splice(i, 1);
        else reactions[i] = { ...reactions[i], count: n };
      };
      if (current) apply(current, -1);
      if (current !== emoji) apply(emoji, 1);
      return {
        ...post,
        reactions,
        myReaction: current === emoji ? null : emoji,
      };
    });
    closeActionBar();
  };

  function closeActionBar() {
    setActionPostId(null);
    setActionAnchor(null);
  }

  function openActionBar(postId: string, event: GestureResponderEvent) {
    setActionPostId(postId);
    setActionAnchor({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
  }

  const openCommentSheet = (postId: string) => {
    if (channel?.settings && channel.settings.commentsEnabled === false) {
      return;
    }
    closeActionBar();
    setCommentPostId(postId);
    setCommentDraft('');
    setCommentAnonymous(false);
    if (channel) {
      loadPostComments(channel.id, postId)
        .then((list) => {
          updatePost(postId, (p) => ({ ...p, comments: list }));
        })
        .catch(() => {});
    }
  };

  const closeCommentSheet = () => {
    setCommentPostId(null);
    setCommentDraft('');
    setCommentAnonymous(false);
    setCommentReplyTo(null);
    setExpandedComments(new Set());
    setCommentFocused(false);
  };

  const handleFollowPress = () => {
    if (!followId) return;
    if (!isFollowing) toggleFollow(followId);
    setShowNotifPrompt(true);
  };

  const handleUnfollow = () => {
    if (!followId) return;
    if (isFollowing) toggleFollow(followId);
    setNotifEnabled(false);
    setShowMoreMenu(false);
  };

  const submitComment = () => {
    const text = commentDraft.trim();
    if (!text || !commentPostId || !channel) return;
    const replyTo = commentReplyTo;
    // Nested replies stay local-only for now; top-level posts hit the API.
    if (replyTo) {
      const comment: ChannelComment = {
        id: `c${Date.now()}`,
        text,
        timestamp: t('channel.just_now'),
        anonymous: commentAnonymous,
        authorName: commentAnonymous ? undefined : CURRENT_USER.name,
        pending: true,
        likes: 0,
      };
      updatePost(commentPostId, (post) => {
        const list = post.comments ?? [];
        return {
          ...post,
          comments: list.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies ?? []), comment] } : c,
          ),
        };
      });
      setExpandedComments((prev) => new Set(prev).add(replyTo.id));
    } else {
      const comment = addCommentToPost(
        channel.id,
        commentPostId,
        text,
        commentAnonymous,
        CURRENT_USER.name,
      );
      if (comment) {
        updatePost(commentPostId, (post) => ({
          ...post,
          comments: [...(post.comments ?? []), comment],
        }));
      }
      setTimeout(() => commentScrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
    setCommentDraft('');
    setCommentAnonymous(false);
    setCommentReplyTo(null);
  };

  const toggleCommentLike = (commentId: string) => {
    if (!commentPostId) return;
    const flip = (c: ChannelComment): ChannelComment => {
      if (c.id === commentId) {
        const liked = !c.liked;
        return { ...c, liked, likes: Math.max(0, (c.likes ?? 0) + (liked ? 1 : -1)) };
      }
      return c.replies ? { ...c, replies: c.replies.map(flip) } : c;
    };
    updatePost(commentPostId, (post) => ({
      ...post,
      comments: (post.comments ?? []).map(flip),
    }));
  };

  const toggleReplies = (commentId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const openReplyTo = (target: { id: string; author: string }) => {
    setCommentReplyTo(target);
    setTimeout(() => commentInputRef.current?.focus(), 80);
  };

  if (!channel) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={[styles.fallback, { color: colors.text }]}>{t('channel.not_found')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark ? colors.surface : colors.surface,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { backgroundColor: colors.surfaceMuted }]}
          accessibilityLabel={t('auth.back')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => router.push(`/channel-info/${channel.id}`)}
          style={({ pressed }) => [styles.headerInfo, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={t('channel.info_title')}
        >
          <View style={[styles.headerAvatarRing, { borderColor: colors.primary }]}>
            <Image
              source={{ uri: channel.avatarUri }}
              style={[styles.headerAvatar, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
            />
          </View>
          <View style={styles.headerText}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
                {channel.name}
              </Text>
              {channel.verified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
              ) : null}
            </View>
            <Text style={[styles.headerHandle, { color: colors.textSecondary }]} numberOfLines={1}>
              {channel.handle} · {t('channel.members', { count: formatCount(channel.members) })}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
          {manageOk ? (
            <Pressable
              onPress={() => router.push(`/channel/settings/${channel.id}`)}
              style={({ pressed }) => [
                styles.followBtn,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityLabel={t('channel_settings.title')}
            >
              <Ionicons name="settings-outline" size={14} color={colors.text} />
              <Text style={[styles.followBtnText, { color: colors.text }]}>
                {t('channel_settings.manage_short')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleFollowPress}
              style={({ pressed }) => [
                styles.followBtn,
                isFollowing
                  ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border }
                  : { backgroundColor: colors.primary, borderColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isFollowing ? t('discover.following') : t('discover.follow')}
            >
              {isFollowing && notifEnabled ? (
                <Ionicons name="notifications" size={12} color={colors.text} />
              ) : null}
              <Text style={[styles.followBtnText, { color: isFollowing ? colors.text : colors.onPrimary }]}>
                {isFollowing ? t('discover.following') : t('discover.follow')}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowMoreMenu(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.moreBtn, pressed && { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.more')}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Post
            post={item}
            channelId={channel.id}
            onLongPress={(event) => openActionBar(item.id, event)}
            onOpenComments={() => openCommentSheet(item.id)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Cinematic channel hero */}
            <Pressable
              onPress={() => router.push(`/channel-info/${channel.id}`)}
              style={styles.hero}
            >
              <Image
                source={{ uri: channel.coverUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              <View style={styles.heroScrim} />
              <View style={styles.heroBottom}>
                <Image
                  source={{ uri: channel.avatarUri }}
                  style={styles.heroAvatar}
                  contentFit="cover"
                />
                <View style={styles.heroMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.heroName} numberOfLines={1}>
                      {channel.name}
                    </Text>
                    {channel.verified ? (
                      <Ionicons name="checkmark-circle" size={16} color="#6F8BFF" />
                    ) : null}
                  </View>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {channel.handle} · {t('channel.members', { count: formatCount(channel.members) })}
                  </Text>
                  <Text style={styles.heroDesc} numberOfLines={2}>
                    {channel.description}
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Stats strip */}
            <View style={[styles.statsStrip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.text }]}>{posts.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('channel.stats_posts')}
                </Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: colors.divider }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.text }]}>{mediaCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('channel.stats_media')}
                </Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: colors.divider }]} />
              <View style={styles.statCell}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {formatCount(channel.members)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {t('channel.stats_followers')}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.adminNote,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Ionicons name="megaphone-outline" size={14} color={colors.primary} />
              <Text style={[styles.adminNoteText, { color: colors.textSecondary }]}>
                {channel.settings?.whoCanPost === 'everyone'
                  ? t('channel_create.post_everyone_hint')
                  : channel.settings?.whoCanPost === 'publishers'
                    ? t('channel_create.post_publishers_hint')
                    : t('channel.admins_only')}
              </Text>
            </View>

            <Text style={[styles.postsHeader, { color: colors.textSecondary }]}>
              {t('channel.posts')}
            </Text>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      />

      {publishOk ? (
        <Pressable
          onPress={() => setComposerOpen(true)}
          style={({ pressed }) => [
            styles.postFab,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
              bottom: insets.bottom + Spacing.lg,
            },
            pressed && { transform: [{ scale: 0.96 }] },
          ]}
          accessibilityLabel={t('channel_create.new_post')}
        >
          <Ionicons name="create-outline" size={22} color={colors.onPrimary} />
        </Pressable>
      ) : null}

      {/* New post composer */}
      <Modal
        transparent
        animationType="slide"
        visible={composerOpen}
        onRequestClose={() => setComposerOpen(false)}
      >
        <View style={styles.postComposerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setComposerOpen(false)} />
          <KeyboardAvoidingView behavior="padding" style={styles.postComposerKav}>
            <View
              style={[
                styles.postComposerSheet,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, Spacing.md),
                },
              ]}
            >
              <View style={styles.postComposerHeader}>
                <Text style={[styles.postComposerTitle, { color: colors.text }]}>
                  {t('channel_create.new_post')}
                </Text>
                <Pressable onPress={() => setComposerOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              {/* Post type picker */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.postKindRow}
              >
                {(
                  [
                    ['text', 'text', t('channel_post.kind_text')],
                    ['image', 'image', t('channel_post.kind_image')],
                    ['video', 'videocam', t('channel_post.kind_video')],
                    ['game', 'game-controller', t('channel_post.kind_game')],
                    ['live', 'radio', t('channel_post.kind_live')],
                    ['voice', 'mic', t('channel_post.kind_voice')],
                  ] as const
                ).map(([kind, icon, label]) => {
                  const active = postKind === kind;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => setPostKind(kind)}
                      style={[
                        styles.postKindChip,
                        {
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? `${colors.primary}14` : colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Ionicons
                        name={icon}
                        size={16}
                        color={active ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.postKindText,
                          { color: active ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {postKind === 'game' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.postKindRow}
                >
                  {(
                    [
                      ['trivia', t('hangout.game_trivia')],
                      ['dice', t('hangout.game_dice')],
                      ['would_you_rather', t('hangout.game_wyr')],
                      ['quick_draw', t('hangout.game_draw')],
                      ['emoji_race', t('hangout.game_emoji')],
                    ] as const
                  ).map(([g, label]) => {
                    const active = postGame === g;
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setPostGame(g)}
                        style={[
                          styles.postKindChip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? `${colors.primary}14` : colors.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.postKindText,
                            { color: active ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {(postKind === 'live' || postKind === 'voice') && channel ? (
                <Pressable
                  onPress={() => {
                    setComposerOpen(false);
                    router.push(
                      `/hangout/${channel.id}?mode=${postKind === 'live' ? 'live' : 'voice'}`,
                    );
                  }}
                  style={[styles.hangoutLaunch, { backgroundColor: `${colors.primary}14`, borderColor: colors.primary }]}
                >
                  <Ionicons
                    name={postKind === 'live' ? 'radio' : 'mic'}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.hangoutLaunchText, { color: colors.primary }]}>
                    {postKind === 'live'
                      ? t('channel_post.open_live')
                      : t('channel_post.open_voice')}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </Pressable>
              ) : null}

              <TextInput
                value={postDraft}
                onChangeText={setPostDraft}
                placeholder={
                  postKind === 'game'
                    ? t('channel_post.game_caption')
                    : postKind === 'live'
                      ? t('channel_post.live_caption')
                      : postKind === 'voice'
                        ? t('channel_post.voice_caption')
                        : t('channel_create.post_placeholder')
                }
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
                style={[
                  styles.postComposerInput,
                  { color: colors.text, backgroundColor: colors.surfaceMuted },
                ]}
              />
              <Pressable
                onPress={async () => {
                  if (!channel) return;
                  const needsText = postKind === 'text' || postKind === 'game';
                  if (needsText && !postDraft.trim()) return;

                  const defaults: Record<string, string> = {
                    image: t('channel_post.default_image'),
                    video: t('channel_post.default_video'),
                    live: t('channel_post.default_live'),
                    voice: t('channel_post.default_voice'),
                    game: t('channel_post.default_game'),
                  };

                  let mediaUri: string | undefined;
                  if (postKind === 'image' || postKind === 'video') {
                    const picked = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: postKind === 'video' ? ['videos'] : ['images'],
                      quality: 0.85,
                    });
                    if (picked.canceled || !picked.assets?.[0]) return;
                    const asset = picked.assets[0];
                    try {
                      const uploaded = await uploadMedia({
                        uri: asset.uri,
                        mimeType:
                          asset.mimeType ??
                          (postKind === 'video' ? 'video/mp4' : 'image/jpeg'),
                        width: asset.width,
                        height: asset.height,
                      });
                      mediaUri = uploaded.url;
                    } catch {
                      // Fall back to local preview so the post still lands in UI.
                      mediaUri = asset.uri;
                    }
                  }

                  const post = addChannelPost(channel.id, {
                    text: postDraft.trim() || defaults[postKind] || t('channel_create.post_placeholder'),
                    type: postKind,
                    mediaUri,
                    gameKind: postKind === 'game' ? postGame : undefined,
                    isLive: postKind === 'live' || postKind === 'voice',
                    liveViewers: postKind === 'live' || postKind === 'voice' ? 1 : undefined,
                  });
                  if (post) {
                    setPosts((prev) => [post, ...prev]);
                    setPostDraft('');
                    setPostKind('text');
                    setComposerOpen(false);
                    if (postKind === 'live' || postKind === 'voice') {
                      router.push(
                        `/hangout/${channel.id}?mode=${postKind === 'live' ? 'live' : 'voice'}`,
                      );
                    }
                  }
                }}
                disabled={
                  (postKind === 'text' || postKind === 'game') && !postDraft.trim()
                }
                style={[
                  styles.postComposerSend,
                  {
                    backgroundColor:
                      (postKind !== 'text' && postKind !== 'game') || postDraft.trim()
                        ? postKind === 'live'
                          ? '#EF4444'
                          : colors.primary
                        : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={{
                    ...Typography.bodyStrong,
                    color:
                      (postKind !== 'text' && postKind !== 'game') || postDraft.trim()
                        ? colors.onPrimary
                        : colors.textMuted,
                  }}
                >
                  {postKind === 'live'
                    ? t('channel_post.go_live')
                    : postKind === 'voice'
                      ? t('channel_post.start_voice')
                      : t('channel_create.publish_post')}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Premium reaction tray */}
      <ReactionTray
        visible={!!actionPost}
        activeEmoji={actionPost?.myReaction}
        emojis={QUICK_REACTIONS}
        anchor={actionBarPosition ? { ...actionBarStyle, width: actionBarWidth } : null}
        onSelect={handleReaction}
        onComment={() => actionPostId && openCommentSheet(actionPostId)}
        onClose={closeActionBar}
        commentLabel={t('channel.comment')}
      />

      {/* ── Comment sheet ───────────────────────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={!!commentPost}
        onRequestClose={closeCommentSheet}
        statusBarTranslucent
      >
        <View style={styles.commentOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCommentSheet} />
          <KeyboardAvoidingView
            behavior="padding"
            keyboardVerticalOffset={0}
            style={styles.commentKav}
          >
            <View
              style={[
                styles.commentSheet,
                {
                  backgroundColor: isDark ? '#12141A' : colors.surfaceElevated,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                  // Cap height so the sheet sits on the bottom edge; keyboard pushes it up.
                  maxHeight: screenHeight * (commentFocused ? 0.92 : 0.78),
                },
              ]}
            >
              <View style={styles.dragHandle}>
                <View style={[styles.dragHandleBar, { backgroundColor: colors.border }]} />
              </View>

              {/* Header — compact */}
              <View style={[styles.commentSheetHeader, { borderBottomColor: colors.divider }]}>
                <View style={styles.commentSheetHeaderLeft}>
                  <Text style={[styles.commentSheetTitle, { color: colors.text }]}>
                    {t('channel.comments')}
                  </Text>
                  <Text style={[styles.commentSheetCount, { color: colors.textSecondary }]}>
                    {countComments(comments)}
                  </Text>
                </View>
                <Pressable
                  onPress={closeCommentSheet}
                  hitSlop={12}
                  style={[styles.commentCloseBtn, { backgroundColor: colors.surfaceMuted }]}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </Pressable>
              </View>

              {/* Post context — hide while typing to free vertical space */}
              {commentPost && !commentFocused ? (
                <View
                  style={[
                    styles.postContext,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
                  <Text
                    style={[styles.postContextText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {commentPost.text}
                  </Text>
                </View>
              ) : null}

              <ScrollView
                ref={commentScrollRef}
                style={styles.commentScroll}
                contentContainerStyle={
                  comments.length === 0
                    ? styles.commentScrollEmpty
                    : styles.commentScrollContent
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                {comments.length ? (
                  comments.map((comment) => (
                    <CommentRow
                      key={comment.id}
                      comment={comment}
                      expanded={expandedComments.has(comment.id)}
                      onReply={openReplyTo}
                      onLike={toggleCommentLike}
                      onToggleReplies={toggleReplies}
                    />
                  ))
                ) : (
                  <View style={styles.commentEmpty}>
                    <View
                      style={[
                        styles.commentEmptyOrb,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceMuted },
                      ]}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.primary} />
                    </View>
                    <Text style={[styles.commentEmptyTitle, { color: colors.text }]}>
                      {t('channel.no_comments')}
                    </Text>
                    <Text style={[styles.commentEmptyHint, { color: colors.textSecondary }]}>
                      {t('channel.comment_approval_hint')}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Bottom dock — hugs the screen bottom; only safe-area when keyboard is closed */}
              <View
                style={[
                  styles.composerDock,
                  {
                    backgroundColor: isDark ? '#0E1016' : colors.surface,
                    borderTopColor: colors.divider,
                    paddingBottom: commentFocused
                      ? Spacing.sm
                      : Math.max(insets.bottom, Spacing.sm),
                  },
                ]}
              >
                {/* Emojis only when not typing — avoids pushing the input up */}
                {!commentFocused ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.emojiBarScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {COMMENT_EMOJIS.map((emoji) => (
                      <Pressable
                        key={emoji}
                        onPress={() => {
                          setCommentDraft((d) => d + emoji);
                          commentInputRef.current?.focus();
                        }}
                        style={[
                          styles.emojiBarBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.07)'
                              : colors.surfaceMuted,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={styles.emojiBarText}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                {commentReplyTo ? (
                  <View
                    style={[
                      styles.replyingBar,
                      {
                        backgroundColor: isDark ? 'rgba(45,91,255,0.12)' : `${colors.primary}12`,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Ionicons name="return-down-forward" size={14} color={colors.primary} />
                    <Text style={[styles.replyingText, { color: colors.text }]} numberOfLines={1}>
                      {t('channel.replying_to', { name: commentReplyTo.author })}
                    </Text>
                    <Pressable onPress={() => setCommentReplyTo(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ) : null}

                {/* Identity chips only when dock is expanded */}
                {!commentFocused ? (
                  <View style={styles.identityRow}>
                    <Pressable
                      onPress={() => setCommentAnonymous(false)}
                      style={[
                        styles.identityChip,
                        {
                          borderColor: !commentAnonymous ? colors.primary : colors.border,
                          backgroundColor: !commentAnonymous
                            ? `${colors.primary}14`
                            : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.identityDot, { backgroundColor: colors.primary }]}>
                        <Text style={styles.identityDotText}>
                          {CURRENT_USER.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.identityLabel,
                          { color: !commentAnonymous ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {CURRENT_USER.name.split(' ')[0]}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setCommentAnonymous(true)}
                      style={[
                        styles.identityChip,
                        {
                          borderColor: commentAnonymous ? colors.primary : colors.border,
                          backgroundColor: commentAnonymous
                            ? `${colors.primary}14`
                            : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.identityDot, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons name="eye-off" size={12} color={colors.textMuted} />
                      </View>
                      <Text
                        style={[
                          styles.identityLabel,
                          { color: commentAnonymous ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {t('channel.anonymous')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View style={styles.composer}>
                  <Pressable
                    onPress={() => {
                      // Quick toggle identity while typing
                      if (commentFocused) setCommentAnonymous((v) => !v);
                    }}
                    style={[
                      styles.composerAvatar,
                      {
                        backgroundColor: commentAnonymous
                          ? colors.surfaceMuted
                          : `${colors.primary}22`,
                      },
                    ]}
                  >
                    {commentAnonymous ? (
                      <Ionicons name="eye-off" size={15} color={colors.textMuted} />
                    ) : (
                      <Text style={[styles.composerAvatarText, { color: colors.primary }]}>
                        {CURRENT_USER.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </Pressable>
                  <View
                    style={[
                      styles.composerInputWrap,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceMuted,
                        borderColor: commentFocused ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      ref={commentInputRef}
                      value={commentDraft}
                      onChangeText={setCommentDraft}
                      onFocus={() => setCommentFocused(true)}
                      onBlur={() => setCommentFocused(false)}
                      placeholder={t('channel.comment_placeholder')}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.composerInput, { color: colors.text }]}
                      multiline
                      maxLength={500}
                      textAlignVertical="center"
                    />
                  </View>
                  <Pressable
                    onPress={submitComment}
                    disabled={!commentDraft.trim()}
                    style={({ pressed }) => [
                      styles.composerSend,
                      {
                        backgroundColor: commentDraft.trim()
                          ? colors.primary
                          : colors.surfaceMuted,
                      },
                      pressed && commentDraft.trim() && { opacity: 0.88 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t('channel.comment_post')}
                  >
                    <Ionicons
                      name="send"
                      size={16}
                      color={commentDraft.trim() ? colors.onPrimary : colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Notification prompt */}
      <Modal
        transparent
        animationType="fade"
        visible={showNotifPrompt}
        onRequestClose={() => setShowNotifPrompt(false)}
      >
        <View style={styles.dimOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowNotifPrompt(false)} />
          <View style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.promptIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.promptTitle, { color: colors.text }]}>
              {t('channel.notif_title')}
            </Text>
            <Text style={[styles.promptBody, { color: colors.textSecondary }]}>
              {t('channel.notif_body')}
            </Text>
            <View style={styles.promptActions}>
              <Pressable
                onPress={() => { setNotifEnabled(false); setShowNotifPrompt(false); }}
                style={({ pressed }) => [styles.promptBtn, { borderColor: colors.border }, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.promptBtnText, { color: colors.text }]}>{t('channel.notif_off')}</Text>
              </Pressable>
              <Pressable
                onPress={() => { setNotifEnabled(true); setShowNotifPrompt(false); }}
                style={({ pressed }) => [
                  styles.promptBtn,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.promptBtnText, { color: colors.onPrimary }]}>{t('channel.notif_on')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* More menu */}
      <Modal
        transparent
        animationType="fade"
        visible={showMoreMenu}
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <View style={styles.bottomOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowMoreMenu(false)} />
          <View style={[styles.moreMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isFollowing ? (
              <Pressable
                onPress={handleUnfollow}
                style={[styles.moreItem, { borderBottomColor: colors.divider }]}
              >
                <Text style={[styles.moreItemText, { color: colors.danger }]}>
                  {t('channel.unfollow')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setShowMoreMenu(false)} style={styles.moreItem}>
              <Text style={[styles.moreItemText, { color: colors.text }]}>
                {t('profile.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Channel info sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={showInfo}
        onRequestClose={() => setShowInfo(false)}
      >
        <View style={[styles.infoOverlay, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInfo(false)} />
          <View style={[styles.infoSheet, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={styles.infoHeader}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>{t('channel.info_title')}</Text>
              <Pressable onPress={() => setShowInfo(false)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.infoProfile}>
              <Image
                source={{ uri: channel.avatarUri }}
                style={[styles.infoAvatar, { backgroundColor: colors.surfaceMuted }]}
                contentFit="cover"
              />
              <View style={styles.infoMeta}>
                <View style={styles.infoNameRow}>
                  <Text style={[styles.infoName, { color: colors.text }]} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  {channel.verified ? (
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  ) : null}
                </View>
                <Text style={[styles.infoHandle, { color: colors.textSecondary }]}>{channel.handle}</Text>
              </View>
            </View>
            <View style={styles.infoStats}>
              <InfoStat label={t('channel.stats_media')} value={formatCount(mediaCount)} />
              <InfoStat label={t('channel.stats_followers')} value={formatCount(channel.members)} />
              <InfoStat label={t('channel.stats_comments')} value={formatCount(commentCount)} />
            </View>
            <View style={styles.infoSection}>
              <Text style={[styles.infoSectionTitle, { color: colors.textSecondary }]}>
                {t('channel.bio')}
              </Text>
              <Text style={[styles.infoSectionText, { color: colors.text }]}>
                {channel.description}
              </Text>
            </View>
            <View style={styles.infoSection}>
              <Text style={[styles.infoSectionTitle, { color: colors.textSecondary }]}>
                {t('channel.rules')}
              </Text>
              <View style={styles.rulesList}>
                {rules.map((rule) => (
                  <View key={rule} style={styles.ruleRow}>
                    <View style={[styles.ruleDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.ruleText, { color: colors.text }]}>{rule}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Post card ───────────────────────────────────────────────────────────────────
function Post({
  post,
  channelId,
  onLongPress,
  onOpenComments,
}: {
  post: ChannelPost;
  channelId: string;
  onLongPress: (event: GestureResponderEvent) => void;
  onOpenComments: () => void;
}) {
  const { colors } = useTheme();
  const reactions = post.reactions ?? [];
  const commentCount = post.comments?.length ?? 0;
  const kind = post.type ?? (post.mediaUri ? 'image' : 'text');
  const mediaUri = post.mediaUri ? mediaFileURL(post.mediaUri) : undefined;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={220}
      style={({ pressed }) => [
        styles.postCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: '#0B1020',
        },
        pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
      ]}
    >
      {mediaUri && (kind === 'image' || kind === 'video') ? (
        <View style={styles.postMediaWrap}>
          <Image
            source={{ uri: mediaUri }}
            style={[styles.postMedia, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
          />
          {kind === 'video' ? (
            <View style={styles.mediaBadge}>
              <Ionicons name="play" size={14} color="#FFF" />
            </View>
          ) : null}
        </View>
      ) : null}

      {kind === 'game' ? (
        <Pressable
          onPress={() =>
            router.push(`/hangout/${channelId}?mode=voice&game=${post.gameKind ?? 'trivia'}`)
          }
          style={[styles.specialCard, { backgroundColor: `${colors.primary}12`, borderColor: colors.primary }]}
        >
          <View style={[styles.specialIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="game-controller" size={20} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.specialTitle, { color: colors.text }]}>
              {t('channel_post.kind_game')}
              {post.gameKind
                ? ` · ${t(
                    post.gameKind === 'would_you_rather'
                      ? 'hangout.game_wyr'
                      : post.gameKind === 'quick_draw'
                        ? 'hangout.game_draw'
                        : post.gameKind === 'emoji_race'
                          ? 'hangout.game_emoji'
                          : post.gameKind === 'dice'
                            ? 'hangout.game_dice'
                            : 'hangout.game_trivia',
                  )}`
                : ''}
            </Text>
            <Text style={[styles.specialHint, { color: colors.textSecondary }]}>
              {t('channel_post.tap_play')}
            </Text>
          </View>
          <Ionicons name="play-circle" size={28} color={colors.primary} />
        </Pressable>
      ) : null}

      {(kind === 'live' || kind === 'voice') ? (
        <Pressable
          onPress={() =>
            router.push(`/hangout/${channelId}?mode=${kind === 'live' ? 'live' : 'voice'}`)
          }
          style={[
            styles.specialCard,
            {
              backgroundColor: kind === 'live' ? 'rgba(239,68,68,0.1)' : `${colors.primary}12`,
              borderColor: kind === 'live' ? '#EF4444' : colors.primary,
            },
          ]}
        >
          <View
            style={[
              styles.specialIcon,
              { backgroundColor: kind === 'live' ? '#EF4444' : colors.primary },
            ]}
          >
            <Ionicons
              name={kind === 'live' ? 'radio' : 'mic'}
              size={20}
              color="#FFF"
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {kind === 'live' && post.isLive ? (
                <View style={styles.liveMini}>
                  <View style={styles.liveMiniDot} />
                  <Text style={styles.liveMiniText}>{t('hangout.live')}</Text>
                </View>
              ) : null}
              <Text style={[styles.specialTitle, { color: colors.text }]}>
                {kind === 'live' ? t('channel_post.kind_live') : t('channel_post.kind_voice')}
              </Text>
            </View>
            <Text style={[styles.specialHint, { color: colors.textSecondary }]}>
              {post.isLive
                ? t('hangout.people', { count: post.liveViewers ?? 1 })
                : t('channel_post.tap_join')}
            </Text>
          </View>
          <Ionicons
            name="enter-outline"
            size={22}
            color={kind === 'live' ? '#EF4444' : colors.primary}
          />
        </Pressable>
      ) : null}

      <View style={styles.postBody}>
        <Text style={[styles.postText, { color: colors.text }]}>{post.text}</Text>

        {reactions.length > 0 ? (
          <View style={styles.reactionRow}>
            {reactions.map((reaction) => {
              const active = post.myReaction === reaction.emoji;
              return (
                <View
                  key={reaction.emoji}
                  style={[
                    styles.reactionPill,
                    {
                      backgroundColor: active ? `${colors.primary}18` : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reactionText,
                      { color: active ? colors.primary : colors.text },
                    ]}
                  >
                    {reaction.emoji} {formatCount(reaction.count)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.postFoot, { borderTopColor: colors.divider }]}>
          <View style={styles.postFootItem}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.postViews, { color: colors.textMuted }]}>
              {formatCount(post.views)}
            </Text>
          </View>
          <Pressable onPress={onOpenComments} style={styles.postFootItem} hitSlop={6}>
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.postViews, { color: colors.textMuted }]}>
              {formatCount(commentCount)}
            </Text>
          </Pressable>
          <View style={styles.postFootSpacer} />
          <Text style={[styles.postTime, { color: colors.textMuted }]}>{post.timestamp}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Comment row — TikTok style, with threaded replies ───────────────────────────
function CommentRow({
  comment,
  expanded,
  isReply,
  parentId,
  onReply,
  onLike,
  onToggleReplies,
}: {
  comment: ChannelComment;
  expanded?: boolean;
  isReply?: boolean;
  parentId?: string;
  onReply: (target: { id: string; author: string }) => void;
  onLike: (id: string) => void;
  onToggleReplies?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const isAnon = comment.anonymous;
  const author = isAnon ? t('channel.anonymous') : comment.authorName || t('channel.anonymous');
  const initial = isAnon ? '?' : author.charAt(0).toUpperCase();
  const likes = comment.likes ?? 0;
  const replies = comment.replies ?? [];

  const pop = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const handleLike = () => {
    pop.value = withSequence(
      withTiming(1.4, { duration: 110 }),
      withSpring(1, { damping: 6, stiffness: 220 }),
    );
    onLike(comment.id);
  };

  const handleReply = () => {
    onReply({ id: isReply ? parentId ?? comment.id : comment.id, author });
  };

  return (
    <View
      style={[
        styles.commentRow,
        isReply && styles.commentRowReply,
        comment.pending && styles.commentPendingRow,
      ]}
    >
      <View
        style={[
          styles.commentAvatar,
          isReply && styles.commentAvatarSmall,
          {
            backgroundColor: isAnon ? colors.surfaceMuted : `${colors.primary}22`,
            borderColor: isAnon ? colors.border : `${colors.primary}33`,
          },
        ]}
      >
        {isAnon ? (
          <Ionicons name="eye-off" size={isReply ? 12 : 15} color={colors.textMuted} />
        ) : (
          <Text
            style={[
              isReply ? styles.commentAvatarTextSmall : styles.commentAvatarText,
              { color: colors.primary },
            ]}
          >
            {initial}
          </Text>
        )}
      </View>

      <View style={styles.commentBody}>
        <View
          style={[
            styles.commentBubble,
            {
              backgroundColor: isAnon
                ? colors.surfaceMuted
                : `${colors.primary}0C`,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.commentAuthorRow}>
            <Text style={[styles.commentAuthorText, { color: colors.text }]}>{author}</Text>
            {isAnon ? (
              <View style={[styles.anonTag, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.anonTagText, { color: colors.textMuted }]}>
                  {t('channel.anonymous')}
                </Text>
              </View>
            ) : null}
            {comment.pending ? (
              <View style={[styles.pendingTag, { backgroundColor: `${colors.warning}22` }]}>
                <Text style={[styles.pendingTagText, { color: colors.warning }]}>
                  {t('channel.pending_approval')}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.commentContent, { color: colors.text }]} numberOfLines={8}>
            {comment.text}
          </Text>
        </View>

        <View style={styles.commentMeta}>
          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
            {comment.timestamp}
          </Text>
          <Pressable onPress={handleReply} hitSlop={8} style={styles.metaAction}>
            <Text style={[styles.commentReply, { color: colors.textSecondary }]}>
              {t('channel.reply')}
            </Text>
          </Pressable>
          <Pressable onPress={handleLike} hitSlop={8} style={styles.metaAction}>
            <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 3 }, heartStyle]}>
              <Ionicons
                name={comment.liked ? 'heart' : 'heart-outline'}
                size={13}
                color={comment.liked ? '#FF3040' : colors.textMuted}
              />
              {likes > 0 ? (
                <Text
                  style={[
                    styles.commentLikeCount,
                    { color: comment.liked ? '#FF3040' : colors.textMuted },
                  ]}
                >
                  {likes}
                </Text>
              ) : null}
            </Animated.View>
          </Pressable>
        </View>

        {!isReply && replies.length > 0 ? (
          <>
            <Pressable
              onPress={() => onToggleReplies?.(comment.id)}
              style={styles.viewReplies}
              hitSlop={6}
            >
              <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.viewRepliesText, { color: colors.primary }]}>
                {expanded
                  ? t('channel.hide_replies')
                  : replies.length === 1
                    ? t('channel.view_one_reply')
                    : t('channel.view_replies', { count: replies.length })}
              </Text>
            </Pressable>
            {expanded
              ? replies.map((r) => (
                  <CommentRow
                    key={r.id}
                    comment={r}
                    isReply
                    parentId={comment.id}
                    onReply={onReply}
                    onLike={onLike}
                  />
                ))
              : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

// ── Info stat ───────────────────────────────────────────────────────────────────
function InfoStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoStat, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.infoStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.infoStatLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fallback: { ...Typography.body, padding: Spacing.xl },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginLeft: Spacing.xs,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: Radii.pill },
  headerText: { flex: 1 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerName: { ...Typography.bodyStrong, flexShrink: 1 },
  headerHandle: { ...Typography.micro },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
  },
  followBtnText: { ...Typography.micro, fontWeight: '700' },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── List header ─────────────────────────────────────────────────────────────
  listHeader: { paddingTop: Spacing.md, gap: Spacing.md },
  hero: {
    height: 200,
    borderRadius: Radii.xl + 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,16,32,0.48)',
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  heroMeta: { flex: 1, gap: 2 },
  heroName: { ...Typography.h3, color: '#FFF', flexShrink: 1 },
  heroSub: { ...Typography.micro, color: 'rgba(255,255,255,0.78)' },
  heroDesc: { ...Typography.caption, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { ...Typography.h2, fontSize: 20, flexShrink: 1 },
  handle: { ...Typography.caption },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.xl,
    borderWidth: 1,
    paddingVertical: Spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...Typography.bodyStrong, fontSize: 16 },
  statLabel: { ...Typography.micro },
  statSep: { width: 1, height: 28 },
  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  adminNoteText: { ...Typography.caption, flex: 1 },
  postsHeader: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  headerAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    padding: 1.5,
    overflow: 'hidden',
  },

  // ── Post card ────────────────────────────────────────────────────────────────
  postCard: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  postMediaWrap: { width: '100%', height: 200 },
  postMedia: { width: '100%', height: '100%' },
  mediaBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialCard: {
    margin: Spacing.md,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
  },
  specialIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specialTitle: { ...Typography.bodyStrong, fontSize: 14 },
  specialHint: { ...Typography.caption, marginTop: 2 },
  liveMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: '#EF4444',
  },
  liveMiniDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFF' },
  liveMiniText: { ...Typography.micro, color: '#FFF', fontWeight: '800', fontSize: 9 },
  postBody: { padding: Spacing.md, gap: Spacing.sm },
  postText: { ...Typography.body, lineHeight: 22 },
  postKindRow: { gap: Spacing.sm, paddingBottom: 2 },
  postKindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
  },
  postKindText: { ...Typography.micro, fontWeight: '700' },
  hangoutLaunch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
  },
  hangoutLaunchText: { ...Typography.bodyStrong, fontSize: 14, flex: 1 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  reactionPill: {
    borderRadius: Radii.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  reactionText: { ...Typography.micro, fontWeight: '700' },
  postFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 2,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postFootItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postFootSpacer: { flex: 1 },
  postViews: { ...Typography.micro },
  postTime: { ...Typography.micro },

  postFab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 54,
    height: 54,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  postComposerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  postComposerKav: { width: '100%', justifyContent: 'flex-end' },
  postComposerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  postComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postComposerTitle: { ...Typography.h3, fontSize: 17 },
  postComposerInput: {
    ...Typography.body,
    minHeight: 120,
    borderRadius: Radii.lg,
    padding: Spacing.md,
    textAlignVertical: 'top',
  },
  postComposerSend: {
    minHeight: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Comment sheet ────────────────────────────────────────────────────────────
  commentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentKav: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  commentSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: 'hidden',
    // No fixed height — sheet hugs the bottom; maxHeight is set inline.
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
  },
  commentSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentSheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  commentHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentSheetTitle: { ...Typography.bodyStrong, fontSize: 16 },
  commentSheetCount: { ...Typography.caption },
  commentCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  postContextText: { ...Typography.caption, flex: 1, lineHeight: 17 },
  commentScroll: {
    // Give the list a real flex region between header and dock
    maxHeight: 360,
    minHeight: 140,
  },
  commentScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  commentScrollEmpty: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    justifyContent: 'center',
    minHeight: 160,
  },
  commentEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  commentEmptyOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentEmptyTitle: { ...Typography.bodyStrong, fontSize: 15 },
  commentEmptyHint: {
    ...Typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },

  // Comment rows
  commentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    alignItems: 'flex-start',
  },
  commentRowReply: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    marginLeft: Spacing.sm,
  },
  commentPendingRow: { opacity: 0.7 },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
  commentAvatarSmall: { width: 30, height: 30 },
  commentAvatarText: { ...Typography.body, fontWeight: '700' },
  commentAvatarTextSmall: { ...Typography.caption, fontWeight: '700' },
  commentBody: { flex: 1, gap: 6 },
  commentBubble: {
    borderRadius: 16,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  commentAuthorText: { ...Typography.caption, fontWeight: '700', lineHeight: 17 },
  anonTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.pill,
  },
  anonTagText: { ...Typography.micro, fontWeight: '700', fontSize: 9 },
  pendingTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.pill,
  },
  pendingTagText: { ...Typography.micro, fontWeight: '700', fontSize: 9 },
  commentContent: { ...Typography.body, fontSize: 14, lineHeight: 20 },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: 4,
  },
  commentTime: { ...Typography.micro },
  commentPending: { ...Typography.micro },
  commentReply: { ...Typography.micro, fontWeight: '700' },
  metaAction: { flexDirection: 'row', alignItems: 'center' },
  commentLikeCount: { ...Typography.micro, fontWeight: '600' },
  viewReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
    marginBottom: 2,
    paddingLeft: 4,
  },
  replyLine: { width: 22, height: 1.5, borderRadius: 1 },
  viewRepliesText: { ...Typography.micro, fontWeight: '700' },

  // Composer dock — pinned to sheet bottom (not floating mid-screen)
  composerDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    gap: Spacing.xs + 2,
  },
  emojiBarScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  emojiBarBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emojiBarText: { fontSize: 18 },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  replyingText: { ...Typography.caption, flex: 1, fontWeight: '600' },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  identityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
  },
  identityDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityDotText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  identityLabel: { ...Typography.micro, fontWeight: '700', fontSize: 11 },
  identityHint: { ...Typography.micro, flex: 1, fontSize: 10 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  composerAvatarText: { fontSize: 13, fontWeight: '700' as const },
  composerInputWrap: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    minHeight: 40,
    maxHeight: 96,
    justifyContent: 'center',
  },
  composerInput: { ...Typography.body, fontSize: 15, maxHeight: 80, padding: 0 },
  composerSend: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  composerPost: { ...Typography.caption, fontWeight: '700' },

  // ── Notification prompt ──────────────────────────────────────────────────────
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
  promptBody: { ...Typography.caption, textAlign: 'center', lineHeight: 19 },
  promptActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, width: '100%' },
  promptBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
  },
  promptBtnText: { ...Typography.caption, fontWeight: '700' },

  // ── More menu ────────────────────────────────────────────────────────────────
  bottomOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  moreMenu: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  moreItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreItemText: { ...Typography.bodyStrong, textAlign: 'center' },

  // ── Channel info sheet ───────────────────────────────────────────────────────
  infoOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
  },
  infoSheet: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
    maxHeight: '85%',
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoTitle: { ...Typography.h3 },
  infoProfile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  infoAvatar: { width: 64, height: 64, borderRadius: Radii.xl },
  infoMeta: { flex: 1, gap: 4 },
  infoNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  infoName: { ...Typography.h2, fontSize: 20, flexShrink: 1 },
  infoHandle: { ...Typography.caption },
  infoStats: { flexDirection: 'row', gap: Spacing.sm },
  infoStat: {
    flex: 1,
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 3,
  },
  infoStatValue: { ...Typography.bodyStrong },
  infoStatLabel: { ...Typography.micro, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoSection: { gap: Spacing.sm },
  infoSectionTitle: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoSectionText: { ...Typography.body, lineHeight: 21 },
  rulesList: { gap: Spacing.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  ruleDot: { width: 6, height: 6, borderRadius: Radii.pill, marginTop: 7 },
  ruleText: { ...Typography.body, lineHeight: 20, flex: 1 },
});
