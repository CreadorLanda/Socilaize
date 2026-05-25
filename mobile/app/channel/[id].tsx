import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
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
import { Radii, Spacing, Typography } from '@/constants/theme';
import { toggleFollow, useIsFollowing } from '@/data/channel-store';
import { CHANNELS, CURRENT_USER, type ChannelComment, type ChannelPost } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

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
  const channel = useMemo(() => CHANNELS.find((c) => c.id === id), [id]);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const followId = channel?.id ?? id ?? '';
  const isFollowing = useIsFollowing(followId);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [actionPostId, setActionPostId] = useState<string | null>(null);
  const [actionAnchor, setActionAnchor] = useState<{ x: number; y: number } | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commentReplyTo, setCommentReplyTo] = useState<{ id: string; author: string } | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    setPosts(channel?.posts ?? []);
  }, [channel]);

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
    () => posts.reduce((sum, p) => sum + (p.comments?.length ?? 0), 0),
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

  const applyReactionDelta = (
    reactions: NonNullable<ChannelPost['reactions']>,
    emoji: string,
    delta: number,
  ) => {
    const index = reactions.findIndex((item) => item.emoji === emoji);
    if (index === -1) {
      if (delta > 0) reactions.push({ emoji, count: delta });
      return;
    }
    const nextCount = reactions[index].count + delta;
    if (nextCount <= 0) { reactions.splice(index, 1); return; }
    reactions[index] = { ...reactions[index], count: nextCount };
  };

  const handleReaction = (emoji: string) => {
    if (!actionPostId) return;
    updatePost(actionPostId, (post) => {
      const reactions = [...(post.reactions ?? [])];
      const current = post.myReaction ?? null;
      if (current) applyReactionDelta(reactions, current, -1);
      if (current === emoji) return { ...post, reactions, myReaction: null };
      applyReactionDelta(reactions, emoji, 1);
      return { ...post, reactions, myReaction: emoji };
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
    closeActionBar();
    setCommentPostId(postId);
    setCommentDraft('');
    setCommentAnonymous(false);
  };

  const closeCommentSheet = () => {
    setCommentPostId(null);
    setCommentDraft('');
    setCommentAnonymous(false);
    setCommentReplyTo(null);
    setExpandedComments(new Set());
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
    if (!text || !commentPostId) return;
    const comment: ChannelComment = {
      id: `c${Date.now()}`,
      text,
      timestamp: t('channel.just_now'),
      anonymous: commentAnonymous,
      authorName: commentAnonymous ? undefined : CURRENT_USER.name,
      pending: true,
      likes: 0,
    };
    const replyTo = commentReplyTo;
    updatePost(commentPostId, (post) => {
      const list = post.comments ?? [];
      if (replyTo) {
        return {
          ...post,
          comments: list.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies ?? []), comment] } : c,
          ),
        };
      }
      return { ...post, comments: [...list, comment] };
    });
    if (replyTo) {
      setExpandedComments((prev) => new Set(prev).add(replyTo.id));
    } else {
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
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
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
          <Image
            source={{ uri: channel.avatarUri }}
            style={[styles.headerAvatar, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
          />
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
              {channel.handle}
            </Text>
          </View>
        </Pressable>
        <View style={styles.headerActions}>
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
            onLongPress={(event) => openActionBar(item.id, event)}
            onOpenComments={() => openCommentSheet(item.id)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={[styles.channelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHead}>
                <Image
                  source={{ uri: channel.avatarUri }}
                  style={[styles.cardAvatar, { backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                />
                <View style={styles.cardTitle}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                      {channel.name}
                    </Text>
                    {channel.verified ? (
                      <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
                    ) : null}
                  </View>
                  <Text style={[styles.handle, { color: colors.textSecondary }]}>{channel.handle}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={[styles.handle, { color: colors.textSecondary }]}>
                  {t('channel.members', { count: formatCount(channel.members) })}
                </Text>
                <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                <View style={[styles.categoryChip, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                    {t(`discover.cat_${channel.category}`)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.adminNote, { borderColor: colors.divider }]}>
              <Ionicons name="megaphone-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.adminNoteText, { color: colors.textSecondary }]}>
                {t('channel.admins_only')}
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

      {/* Floating reaction bar */}
      <Modal transparent animationType="fade" visible={!!actionPost} onRequestClose={closeActionBar}>
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeActionBar} />
          <View
            style={[
              styles.actionBar,
              { backgroundColor: colors.surface, borderColor: colors.border },
              actionBarStyle,
            ]}
          >
            {QUICK_REACTIONS.map((emoji) => {
              const active = actionPost?.myReaction === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  style={[
                    styles.actionEmoji,
                    active && { backgroundColor: colors.surfaceMuted, borderColor: colors.primary },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('channel.react', { emoji })}
                >
                  <Text style={styles.actionEmojiText}>{emoji}</Text>
                </Pressable>
              );
            })}
            <View style={[styles.actionSep, { backgroundColor: colors.border }]} />
            <Pressable
              onPress={() => actionPostId && openCommentSheet(actionPostId)}
              style={({ pressed }) => [
                styles.actionCommentBtn,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('channel.comment')}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
              <Text style={[styles.actionCommentText, { color: colors.text }]}>
                {t('channel.comment')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Comment sheet — TikTok style ──────────────────────────────── */}
      <Modal
        transparent
        animationType="slide"
        visible={!!commentPost}
        onRequestClose={closeCommentSheet}
      >
        <View style={styles.commentOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCommentSheet} />
          <KeyboardAvoidingView behavior="padding">
            <View style={[styles.commentSheet, { backgroundColor: colors.surfaceElevated }]}>

              {/* Drag pill */}
              <View style={styles.dragHandle}>
                <View style={[styles.dragHandleBar, { backgroundColor: colors.border }]} />
              </View>

              {/* Header */}
              <View style={[styles.commentSheetHeader, { borderBottomColor: colors.divider }]}>
                <Text style={[styles.commentSheetTitle, { color: colors.text }]}>
                  {t('channel.comments')}
                  {comments.length > 0 ? (
                    <Text style={[styles.commentSheetCount, { color: colors.textSecondary }]}>
                      {' '}·{' '}{countComments(comments)}
                    </Text>
                  ) : null}
                </Text>
                <Pressable onPress={closeCommentSheet} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>

              {/* Comment list */}
              <ScrollView
                ref={commentScrollRef}
                style={styles.commentScroll}
                contentContainerStyle={styles.commentScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                    <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                    <Text style={[styles.commentEmptyTitle, { color: colors.text }]}>
                      {t('channel.no_comments')}
                    </Text>
                    <Text style={[styles.commentEmptyHint, { color: colors.textSecondary }]}>
                      {t('channel.comment_approval_hint')}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Quick emoji bar */}
              <View style={[styles.emojiBar, { borderTopColor: colors.divider }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.emojiBarScroll}
                >
                  {COMMENT_EMOJIS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => setCommentDraft((d) => d + emoji)}
                      style={({ pressed }) => [styles.emojiBarBtn, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.emojiBarText}>{emoji}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Replying-to bar */}
              {commentReplyTo ? (
                <View style={[styles.replyingBar, { backgroundColor: colors.surfaceMuted, borderTopColor: colors.divider }]}>
                  <Ionicons name="arrow-undo-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.replyingText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('channel.replying_to', { name: commentReplyTo.author })}
                  </Text>
                  <Pressable onPress={() => setCommentReplyTo(null)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : null}

              {/* Composer — TikTok style: avatar + pill input + Post/GIF */}
              <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
                <View
                  style={[
                    styles.composerAvatar,
                    { backgroundColor: `${colors.primary}22` },
                  ]}
                >
                  <Text style={[styles.composerAvatarText, { color: colors.primary }]}>
                    {CURRENT_USER.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.composerInputWrap, { backgroundColor: colors.surfaceMuted }]}>
                  <TextInput
                    ref={commentInputRef}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder={t('channel.comment_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.composerInput, { color: colors.text }]}
                    multiline
                  />
                  <Pressable
                    onPress={commentDraft.trim() ? submitComment : undefined}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('channel.comment_post')}
                  >
                    <Text
                      style={[
                        styles.composerPost,
                        { color: commentDraft.trim() ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {commentDraft.trim() ? t('channel.comment_post') : 'GIF'}
                    </Text>
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
  onLongPress,
  onOpenComments,
}: {
  post: ChannelPost;
  onLongPress: (event: GestureResponderEvent) => void;
  onOpenComments: () => void;
}) {
  const { colors } = useTheme();
  const reactions = post.reactions ?? [];
  const commentCount = post.comments?.length ?? 0;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={220}
      style={({ pressed }) => [
        styles.postCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.92 },
      ]}
    >
      {post.mediaUri ? (
        <Image
          source={{ uri: post.mediaUri }}
          style={[styles.postMedia, { backgroundColor: colors.surfaceMuted }]}
          contentFit="cover"
        />
      ) : null}

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
                    backgroundColor: active ? colors.primary : colors.surfaceMuted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.reactionText, { color: active ? colors.onPrimary : colors.text }]}>
                  {reaction.emoji} {formatCount(reaction.count)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.postFoot}>
        <View style={styles.postFootItem}>
          <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.postViews, { color: colors.textMuted }]}>{formatCount(post.views)}</Text>
        </View>
        <Pressable onPress={onOpenComments} style={styles.postFootItem}>
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.postViews, { color: colors.textMuted }]}>
            {formatCount(commentCount)}
          </Text>
        </Pressable>
        <View style={styles.postFootSpacer} />
        <Text style={[styles.postTime, { color: colors.textMuted }]}>{post.timestamp}</Text>
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
    <View style={[styles.commentRow, isReply && styles.commentRowReply, comment.pending && styles.commentPendingRow]}>
      <View
        style={[
          styles.commentAvatar,
          isReply && styles.commentAvatarSmall,
          { backgroundColor: isAnon ? colors.surfaceMuted : `${colors.primary}22` },
        ]}
      >
        <Text
          style={[
            isReply ? styles.commentAvatarTextSmall : styles.commentAvatarText,
            { color: isAnon ? colors.textMuted : colors.primary },
          ]}
        >
          {initial}
        </Text>
      </View>

      <View style={styles.commentBody}>
        <Text style={[styles.commentAuthorText, { color: colors.text }]}>{author}</Text>
        <Text style={[styles.commentContent, { color: colors.text }]} numberOfLines={8}>
          {comment.text}
        </Text>
        <View style={styles.commentMeta}>
          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>{comment.timestamp}</Text>
          {comment.pending ? (
            <Text style={[styles.commentPending, { color: colors.textSecondary }]}>
              · {t('channel.pending_approval')}
            </Text>
          ) : null}
          <Pressable onPress={handleReply} hitSlop={8}>
            <Text style={[styles.commentReply, { color: colors.textSecondary }]}>
              {t('channel.reply')}
            </Text>
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
              <Text style={[styles.viewRepliesText, { color: colors.textSecondary }]}>
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

      {/* Like button + count */}
      <Pressable onPress={handleLike} hitSlop={10} style={styles.commentLikeBtn}>
        <Animated.View style={heartStyle}>
          <Ionicons
            name={comment.liked ? 'heart' : 'heart-outline'}
            size={isReply ? 13 : 16}
            color={comment.liked ? '#FF3040' : colors.textMuted}
          />
        </Animated.View>
        {likes > 0 ? (
          <Text style={[styles.commentLikeCount, { color: comment.liked ? '#FF3040' : colors.textMuted }]}>
            {likes}
          </Text>
        ) : null}
      </Pressable>
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
  listHeader: { paddingTop: Spacing.lg, gap: Spacing.lg },
  channelCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardAvatar: { width: 60, height: 60, borderRadius: Radii.xl },
  cardTitle: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { ...Typography.h2, fontSize: 20, flexShrink: 1 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  handle: { ...Typography.caption },
  dot: { width: 3, height: 3, borderRadius: Radii.pill },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    marginLeft: Spacing.xs,
  },
  categoryText: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  adminNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminNoteText: { ...Typography.caption, flex: 1 },
  postsHeader: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },

  // ── Post card ────────────────────────────────────────────────────────────────
  postCard: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  postText: { ...Typography.body, lineHeight: 21 },
  postMedia: { width: '100%', height: 180, borderRadius: Radii.md },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  reactionPill: {
    borderRadius: Radii.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reactionText: { ...Typography.micro, fontWeight: '700' },
  postFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 2,
  },
  postFootItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postFootSpacer: { flex: 1 },
  postViews: { ...Typography.micro },
  postTime: { ...Typography.micro },

  // ── Reaction action bar ──────────────────────────────────────────────────────
  actionBar: {
    position: 'absolute',
    height: ACTION_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.pill,
    borderWidth: 1,
    padding: 6,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  actionEmoji: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  actionEmojiText: { fontSize: 18 },
  actionSep: { width: 1, height: 22, marginHorizontal: 2 },
  actionCommentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.pill,
  },
  actionCommentText: { ...Typography.caption, fontWeight: '600' },

  // ── Comment sheet (TikTok style) ─────────────────────────────────────────────
  commentOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentSheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    height: '72%',
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
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
  commentSheetTitle: { ...Typography.bodyStrong },
  commentSheetCount: { ...Typography.body, fontWeight: '400' },
  commentScroll: { flex: 1 },
  commentScrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  commentEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  commentEmptyTitle: { ...Typography.bodyStrong },
  commentEmptyHint: {
    ...Typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
  },

  // Comment rows (TikTok style)
  commentRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'flex-start',
  },
  commentRowReply: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
  },
  commentPendingRow: { opacity: 0.55 },
  commentAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  commentAvatarSmall: { width: 32, height: 32 },
  commentAvatarText: { ...Typography.body, fontWeight: '700' },
  commentAvatarTextSmall: { ...Typography.caption, fontWeight: '700' },
  commentBody: { flex: 1, gap: 4 },
  commentAuthorText: { ...Typography.caption, fontWeight: '700', lineHeight: 17 },
  commentContent: { ...Typography.caption, lineHeight: 20 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  commentTime: { ...Typography.micro },
  commentPending: { ...Typography.micro },
  commentReply: { ...Typography.micro, fontWeight: '600' },
  commentLikeBtn: { alignItems: 'center', gap: 3, paddingLeft: Spacing.xs, paddingTop: 2 },
  commentLikeCount: { ...Typography.micro },
  viewReplies: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
    marginBottom: 2,
  },
  replyLine: { width: 22, height: 1, borderRadius: 1 },
  viewRepliesText: { ...Typography.micro, fontWeight: '700' },
  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyingText: { ...Typography.micro, flex: 1 },

  // Quick emoji bar
  emojiBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.xs + 1,
  },
  emojiBarScroll: {
    paddingHorizontal: Spacing.md,
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiBarBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBarText: { fontSize: 22 },

  // Composer (TikTok: avatar + pill input + Post/GIF)
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  composerAvatar: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  composerAvatarText: { fontSize: 14, fontWeight: '700' as const },
  composerInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 42,
    gap: Spacing.sm,
  },
  composerInput: { ...Typography.caption, flex: 1, minHeight: 28, maxHeight: 90 },
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
