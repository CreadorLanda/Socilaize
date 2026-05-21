import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from 'expo-audio';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttachmentBubble } from '@/components/chat/attachment-bubbles';
import { AttachmentComposer } from '@/components/chat/attachment-composer';
import { EmptyState } from '@/components/ui/empty-state';
import { StateTransition } from '@/components/ui/state-transition';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { dandaraReply, dandaraSuggestions } from '@/data/dandara';
import { useGroup } from '@/data/group-store';
import {
  CHATS,
  DANDARA,
  MESSAGES,
  type MediaAttachment,
  type Message,
  type MessageAttachment,
} from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const CHAT_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const REACTION_BAR_HEIGHT = 56;
const MENU_ITEM_HEIGHT = 48;
const MENU_GAP = 10;
const REPLY_THRESHOLD = 56;
const LOCK_THRESHOLD = 78;
const CANCEL_THRESHOLD = 96;
const VOICE_BARS = 26;

const ATTACH_ITEMS: { key: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'document', icon: 'document-text', color: '#8B5CF6' },
  { key: 'gallery', icon: 'images', color: '#EC4899' },
  { key: 'games', icon: 'game-controller', color: '#0EA5E9' },
  { key: 'dandara', icon: 'sparkles', color: '#A855F7' },
  { key: 'location', icon: 'location', color: '#22C55E' },
  { key: 'contact', icon: 'person', color: '#3B82F6' },
  { key: 'poll', icon: 'stats-chart', color: '#F59E0B' },
  { key: 'event', icon: 'calendar', color: '#EF4444' },
];

function formatDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type ReactionEntry = { emoji: string; count: number; mine: boolean };

type GroupedMessage = Message & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

type MenuTarget = {
  msg: GroupedMessage;
  rect: { x: number; y: number; width: number; height: number };
  mine: boolean;
};

function groupMessages(messages: Message[]): GroupedMessage[] {
  return messages.map((msg, i) => {
    const breaksWith = (other?: Message) =>
      !other ||
      other.system ||
      msg.system ||
      other.fromMe !== msg.fromMe ||
      other.senderName !== msg.senderName;
    return {
      ...msg,
      isFirstInGroup: breaksWith(messages[i - 1]),
      isLastInGroup: breaksWith(messages[i + 1]),
    };
  });
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useMemo(() => CHATS.find((c) => c.id === id), [id]);
  const initial = useMemo<Message[]>(() => MESSAGES[id ?? ''] ?? [], [id]);
  const [messages, setMessages] = useState<Message[]>(initial);
  const [draft, setDraft] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionEntry[]>>({});
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [composeKind, setComposeKind] = useState<string | null>(null);
  const [dandaraTyping, setDandaraTyping] = useState(false);
  const { colors, isDark } = useTheme();

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordPhase, setRecordPhase] = useState<'idle' | 'recording' | 'locked'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const recordStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordPermRef = useRef(false);
  const dandaraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<GroupedMessage>>(null);
  const composerInputRef = useRef<TextInput>(null);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const recOriginX = useSharedValue(0);
  const recOriginY = useSharedValue(0);
  const recActive = useSharedValue(false);
  const recLocked = useSharedValue(false);
  const recCancelled = useSharedValue(false);
  const micScale = useSharedValue(1);
  const micHalo = useSharedValue(0);
  const recExit = useSharedValue(0);

  const micStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: micScale.value },
    ],
  }));

  useEffect(() => {
    requestRecordingPermissionsAsync()
      .then((r) => {
        recordPermRef.current = r.granted;
      })
      .catch(() => {});
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (dandaraTimerRef.current) clearTimeout(dandaraTimerRef.current);
    };
  }, []);

  // Keep the latest message (and Dandara's typing bubble) in view.
  useEffect(() => {
    if (searchMode) return;
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length, dandaraTyping, searchMode]);

  const isGroup = !!chat?.isGroup;
  const isAIChat = !!chat?.isAI;
  const group = useGroup(isGroup ? id : undefined);

  // Apply the group's history settings: hide pre-join messages when history is
  // off, and cap how many of them a new member can see.
  const visible = useMemo<Message[]>(() => {
    if (!isGroup || !group) return messages;
    const historical = messages.filter((m) => m.historical);
    const rest = messages.filter((m) => !m.historical);
    if (!group.historyEnabled) return rest;
    const shown =
      group.historyLimit === Infinity ? historical : historical.slice(-group.historyLimit);
    return [...shown, ...rest];
  }, [messages, isGroup, group]);

  const trimmedQuery = query.trim();
  const searching = searchMode && trimmedQuery.length > 0;

  const filtered = useMemo<Message[]>(() => {
    if (!searching) return visible;
    const q = trimmedQuery.toLowerCase();
    return visible.filter((m) => !m.system && m.text.toLowerCase().includes(q));
  }, [visible, searching, trimmedQuery]);

  const grouped = useMemo(() => groupMessages(filtered), [filtered]);

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={[styles.fallback, { color: colors.text }]}>{t('chat.not_found')}</Text>
      </SafeAreaView>
    );
  }

  const appendMessage = (msg: Omit<Message, 'id' | 'timestamp' | 'fromMe' | 'status'>) => {
    setMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, fromMe: true, timestamp: nowTime(), status: 'sent', ...msg },
    ]);
  };

  const appendDandara = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `d${Date.now()}`,
        text,
        fromMe: false,
        timestamp: nowTime(),
        isAI: true,
        senderName: DANDARA.name,
        senderAvatarUri: DANDARA.avatarUri,
      },
    ]);
  };

  const triggerDandara = (prompt: string) => {
    setDandaraTyping(true);
    if (dandaraTimerRef.current) clearTimeout(dandaraTimerRef.current);
    dandaraTimerRef.current = setTimeout(() => {
      setDandaraTyping(false);
      appendDandara(dandaraReply(prompt));
    }, 1400);
  };

  // ── Voice recording ──────────────────────────────────────────────────────
  const resetRecordingValues = () => {
    dragX.value = 0;
    dragY.value = 0;
    recActive.value = false;
    recLocked.value = false;
    recCancelled.value = false;
    micScale.value = withTiming(1, { duration: 150 });
    micHalo.value = 0;
    recExit.value = 0;
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const beginRecording = async () => {
    if (!recordPermRef.current) {
      const r = await requestRecordingPermissionsAsync().catch(() => null);
      recordPermRef.current = !!r?.granted;
      if (!recordPermRef.current) {
        recActive.value = false;
        return;
      }
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch {
      recActive.value = false;
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    recordStartRef.current = Date.now();
    setElapsedSec(0);
    setRecordPhase('recording');
    micScale.value = withSpring(1.7, { damping: 12 });
    micHalo.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    stopTimer();
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - recordStartRef.current) / 1000));
    }, 300);
  };

  const lockRecording = () => {
    setRecordPhase('locked');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    micScale.value = withTiming(1, { duration: 150 });
    micHalo.value = 0;
  };

  const finishRecording = async () => {
    stopTimer();
    const duration = Math.round((Date.now() - recordStartRef.current) / 1000);
    setRecordPhase('idle');
    resetRecordingValues();
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = audioRecorder.uri;
      if (uri && duration >= 1) {
        appendMessage({
          text: '',
          media: { type: 'audio', uri, durationSec: duration },
          replyTo: replyTarget
            ? { id: replyTarget.id, text: replySnippet(replyTarget), fromMe: replyTarget.fromMe, senderName: replyTarget.senderName, icon: replyIcon(replyTarget) }
            : undefined,
        });
      }
    } catch {
      /* discard on failure */
    }
    setReplyTarget(null);
  };

  const cancelRecording = async () => {
    stopTimer();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    recExit.value = withTiming(1, { duration: 260 });
    dragX.value = withTiming(0, { duration: 200 });
    dragY.value = withTiming(0, { duration: 200 });
    micScale.value = withTiming(1, { duration: 200 });
    micHalo.value = 0;
    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {
      /* nothing to discard */
    }
    setTimeout(() => {
      setRecordPhase('idle');
      resetRecordingValues();
    }, 280);
  };

  const recordGesture = Gesture.LongPress()
    .minDuration(220)
    .maxDistance(100000)
    .shouldCancelWhenOutside(false)
    .onStart((e) => {
      recOriginX.value = e.absoluteX;
      recOriginY.value = e.absoluteY;
      dragX.value = 0;
      dragY.value = 0;
      recActive.value = true;
      recLocked.value = false;
      recCancelled.value = false;
      recExit.value = 0;
      runOnJS(beginRecording)();
    })
    .onTouchesMove((e) => {
      if (!recActive.value || recLocked.value || recCancelled.value) return;
      const touch = e.allTouches[0];
      if (!touch) return;
      const dx = Math.min(0, touch.absoluteX - recOriginX.value);
      const dy = Math.min(0, touch.absoluteY - recOriginY.value);
      if (dy < -LOCK_THRESHOLD) {
        recLocked.value = true;
        dragX.value = withTiming(0);
        dragY.value = withTiming(0);
        runOnJS(lockRecording)();
        return;
      }
      if (dx < -CANCEL_THRESHOLD) {
        recCancelled.value = true;
        runOnJS(cancelRecording)();
        return;
      }
      dragX.value = dx;
      dragY.value = dy;
    })
    .onEnd(() => {
      const wasActive = recActive.value;
      recActive.value = false;
      if (!wasActive || recLocked.value || recCancelled.value) return;
      runOnJS(finishRecording)();
    });

  const openMenu = (target: MenuTarget) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMenuTarget(target);
  };

  const closeMenu = () => setMenuTarget(null);

  const handleReact = (msgId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const list = [...(prev[msgId] ?? [])];
      const mineIdx = list.findIndex((r) => r.mine);
      const myEmoji = mineIdx >= 0 ? list[mineIdx].emoji : null;

      if (mineIdx >= 0) {
        if (list[mineIdx].count <= 1) list.splice(mineIdx, 1);
        else list[mineIdx] = { ...list[mineIdx], count: list[mineIdx].count - 1, mine: false };
      }
      if (myEmoji === emoji) return { ...prev, [msgId]: list };

      const idx = list.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) list[idx] = { ...list[idx], count: list[idx].count + 1, mine: true };
      else list.push({ emoji, count: 1, mine: true });

      return { ...prev, [msgId]: list };
    });
  };

  const reactFromMenu = (emoji: string) => {
    if (!menuTarget) return;
    handleReact(menuTarget.msg.id, emoji);
    Haptics.selectionAsync().catch(() => {});
  };

  const replyFromMenu = () => {
    if (menuTarget) setReplyTarget(menuTarget.msg);
  };

  const copyFromMenu = () => {
    if (menuTarget?.msg.text) Clipboard.setStringAsync(menuTarget.msg.text).catch(() => {});
  };

  const replyFromSwipe = (msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReplyTarget(msg);
  };

  const submitText = (text: string) => {
    if (!text) return;
    appendMessage({
      text,
      replyTo: replyTarget
        ? { id: replyTarget.id, text: replySnippet(replyTarget), fromMe: replyTarget.fromMe, senderName: replyTarget.senderName, icon: replyIcon(replyTarget) }
        : undefined,
    });
    setReplyTarget(null);
    if (isAIChat || /@dandara/i.test(text)) triggerDandara(text);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    submitText(text);
    setDraft('');
  };

  const addAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const media: MediaAttachment = {
      type: asset.type === 'video' ? 'video' : 'image',
      uri: asset.uri,
      durationSec: asset.duration ? Math.round(asset.duration / 1000) : undefined,
    };
    appendMessage({
      text: draft.trim(),
      media,
      replyTo: replyTarget
        ? { id: replyTarget.id, text: replySnippet(replyTarget), fromMe: replyTarget.fromMe, senderName: replyTarget.senderName, icon: replyIcon(replyTarget) }
        : undefined,
    });
    setDraft('');
    setReplyTarget(null);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) addAsset(result.assets[0]);
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) addAsset(result.assets[0]);
  };

  // One-line preview for a quoted/replied message.
  const replySnippet = (m: Message): string => {
    if (m.attachment) {
      const k = m.attachment.kind;
      if (k === 'document') return t('chat.attach_document');
      if (k === 'location') return t('chat.attach_location');
      if (k === 'contact') return t('chat.attach_contact');
      if (k === 'poll') return t('chat.poll_label');
      if (k === 'event') return t('chat.event_label');
      return t('chat.game_invite');
    }
    if (m.media) {
      return m.media.type === 'audio' ? t('chat.voice_message') : t('chat.attach_gallery');
    }
    return m.text;
  };

  // Icon shown next to a quoted/replied message preview.
  const replyIcon = (m: Message): keyof typeof Ionicons.glyphMap | undefined => {
    if (m.attachment) {
      const k = m.attachment.kind;
      if (k === 'document') return 'document-text';
      if (k === 'location') return 'location';
      if (k === 'contact') return 'person';
      if (k === 'poll') return 'stats-chart';
      if (k === 'event') return 'calendar';
      return 'game-controller';
    }
    if (m.media) {
      if (m.media.type === 'audio') return 'mic';
      if (m.media.type === 'video') return 'videocam';
      return 'image';
    }
    return undefined;
  };

  const sendAttachment = (attachment: MessageAttachment) => {
    appendMessage({
      text: '',
      attachment,
      replyTo: replyTarget
        ? { id: replyTarget.id, text: replySnippet(replyTarget), fromMe: replyTarget.fromMe, senderName: replyTarget.senderName, icon: replyIcon(replyTarget) }
        : undefined,
    });
    setReplyTarget(null);
    setComposeKind(null);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const dot = asset.name.lastIndexOf('.');
    const ext = dot >= 0 ? asset.name.slice(dot + 1) : 'file';
    const bytes = asset.size ?? 0;
    const sizeLabel =
      bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        : bytes > 0
          ? `${Math.max(1, Math.round(bytes / 1024))} KB`
          : '—';
    sendAttachment({ kind: 'document', name: asset.name, ext, sizeLabel });
  };

  const handleAttachPick = (key: string) => {
    setShowAttach(false);
    // Let the menu finish dismissing before the next surface appears.
    if (key === 'gallery') {
      setTimeout(pickFromLibrary, 300);
    } else if (key === 'document') {
      setTimeout(pickDocument, 300);
    } else if (key === 'dandara') {
      setDraft((d) => (/@dandara/i.test(d) ? d : `@Dandara ${d}`));
      setTimeout(() => composerInputRef.current?.focus(), 320);
    } else {
      setTimeout(() => setComposeKind(key), 280);
    }
  };

  const handleVote = (msgId: string, optionId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        const att = m.attachment;
        if (m.id !== msgId || !att || att.kind !== 'poll') return m;
        const options = att.options.map((o) => {
          if (o.id === optionId) {
            return { ...o, voted: !o.voted, votes: o.votes + (o.voted ? -1 : 1) };
          }
          if (!att.multi && o.voted) {
            return { ...o, voted: false, votes: o.votes - 1 };
          }
          return o;
        });
        return { ...m, attachment: { ...att, options } };
      }),
    );
  };

  const hasDraft = draft.trim().length > 0;
  const memberCount = group?.members.length ?? chat.memberCount ?? 0;

  const closeSearch = () => {
    setSearchMode(false);
    setQuery('');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <StateTransition transitionKey={searchMode}>
      {searchMode ? (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
          <Pressable
            onPress={closeSearch}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityLabel={t('chat.close_search')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={[styles.searchField, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('chat.search_placeholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={[styles.searchInput, { color: colors.text }]}
            />
            {trimmedQuery.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && [styles.iconBtnPressed, { backgroundColor: colors.surfaceMuted }],
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <Pressable
            style={styles.peer}
            hitSlop={6}
            onPress={
              isGroup
                ? () => router.push({ pathname: '/modal', params: { groupId: chat.id } })
                : undefined
            }
            accessibilityRole={isGroup ? 'button' : undefined}
            accessibilityLabel={isGroup ? t('chat.group_settings') : undefined}
          >
            <View>
              <Image
                source={{ uri: chat.avatarUri }}
                style={[styles.peerAvatar, { backgroundColor: colors.surfaceMuted }]}
                contentFit="cover"
              />
              {chat.online && !isGroup ? (
                <View
                  style={[
                    styles.peerOnlineDot,
                    { backgroundColor: colors.success, borderColor: colors.surface },
                  ]}
                />
              ) : null}
            </View>
            <View style={styles.peerInfo}>
              <Text style={[styles.peerName, { color: colors.text }]} numberOfLines={1}>
                {chat.name}
              </Text>
              <Text style={[styles.peerStatus, { color: colors.textSecondary }]} numberOfLines={1}>
                {isAIChat
                  ? t('chat.ai_subtitle')
                  : isGroup
                    ? t('group.members_count', { count: memberCount })
                    : chat.online
                      ? t('chats.online')
                      : t('chats.last_seen')}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              hitSlop={8}
              style={styles.iconBtn}
              onPress={() => setSearchMode(true)}
              accessibilityLabel={t('chat.search')}
            >
              <Ionicons name="search" size={20} color={colors.text} />
            </Pressable>
            {isGroup ? (
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => router.push({ pathname: '/modal', params: { groupId: chat.id } })}
                accessibilityLabel={t('chat.group_settings')}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
              </Pressable>
            ) : (
              <>
                <Pressable
                  hitSlop={8}
                  style={styles.iconBtn}
                  onPress={() => router.push(`/call/${chat.id}?mode=video`)}
                  accessibilityLabel={t('call.video_call')}
                >
                  <Ionicons name="videocam-outline" size={22} color={colors.text} />
                </Pressable>
                <Pressable
                  hitSlop={8}
                  style={styles.iconBtn}
                  onPress={() => router.push(`/call/${chat.id}?mode=voice`)}
                  accessibilityLabel={t('call.voice_call')}
                >
                  <Ionicons name="call-outline" size={20} color={colors.text} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      </StateTransition>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={[styles.thread, { backgroundColor: colors.surfaceMuted }]}>
          <StateTransition transitionKey={searchMode} style={styles.flex}>
          <FlatList
            ref={listRef}
            data={grouped}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              item.system ? (
                <SystemDivider text={t('chat.joined')} />
              ) : (
                <Bubble
                  msg={item}
                  isGroup={isGroup}
                  query={searching ? trimmedQuery : ''}
                  reactions={reactionsMap[item.id] ?? []}
                  onOpenMenu={openMenu}
                  onReact={handleReact}
                  onReply={replyFromSwipe}
                  onVote={handleVote}
                />
              )
            }
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              searchMode ? null : (
                <View style={styles.threadHeader}>
                  {isGroup && group ? (
                    <HistoryBanner
                      enabled={group.historyEnabled}
                      viewOnly={group.historyMode === 'view-only'}
                      shown={visible.filter((m) => m.historical).length}
                      limit={group.historyLimit}
                    />
                  ) : (
                    <View style={[styles.dayPill, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.dayPillText, { color: colors.textSecondary }]}>
                        {t('chat.today')}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.e2eNotice, { backgroundColor: colors.surface }]}>
                    <Ionicons
                      name={isAIChat ? 'sparkles' : 'lock-closed'}
                      size={11}
                      color={colors.textSecondary}
                    />
                    <Text style={[styles.e2eNoticeText, { color: colors.textSecondary }]}>
                      {isAIChat ? t('chat.ai_disclaimer') : t('chat.encrypted_notice')}
                    </Text>
                  </View>
                </View>
              )
            }
            ListFooterComponent={dandaraTyping ? <TypingBubble /> : null}
            ListEmptyComponent={
              searching ? (
                <EmptyState
                  icon="search-outline"
                  title={t('chat.search_empty_title')}
                  description={t('chat.search_empty', { query: trimmedQuery })}
                />
              ) : null
            }
          />
          </StateTransition>
        </View>

        {searchMode ? null : (
          <View style={[styles.composerWrap, { backgroundColor: colors.surfaceMuted }]}>
            {/* Dandara suggestion chips — before the first message */}
            {isAIChat && recordPhase === 'idle' && !messages.some((m) => m.fromMe) ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.suggestRow}
              >
                {dandaraSuggestions().map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => submitText(s)}
                    style={({ pressed }) => [
                      styles.suggestChip,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="sparkles-outline" size={13} color={colors.primary} />
                    <Text style={[styles.suggestChipText, { color: colors.text }]} numberOfLines={1}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Reply preview bar — hidden while recording */}
            {replyTarget && recordPhase === 'idle' ? (
              <View style={[styles.replyBar, { backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
                <View style={[styles.replyBarStripe, { backgroundColor: colors.primary }]} />
                <View style={styles.replyBarContent}>
                  <Text style={[styles.replyBarName, { color: colors.primary }]} numberOfLines={1}>
                    {replyTarget.fromMe ? t('chat.you') : replyTarget.senderName ?? chat.name}
                  </Text>
                  <View style={styles.replySnippetRow}>
                    {replyIcon(replyTarget) ? (
                      <Ionicons name={replyIcon(replyTarget)} size={13} color={colors.textSecondary} />
                    ) : null}
                    <Text style={[styles.replyBarText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {replySnippet(replyTarget)}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => setReplyTarget(null)} hitSlop={10}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            {/* Composer row */}
            <View style={styles.composerRow}>
              {recordPhase === 'idle' ? (
                <View style={[styles.composer, { backgroundColor: colors.surface }]}>
                  <Pressable hitSlop={8} style={styles.composerLeft}>
                    <Ionicons name="happy-outline" size={22} color={colors.textSecondary} />
                  </Pressable>
                  <TextInput
                    ref={composerInputRef}
                    value={draft}
                    onChangeText={setDraft}
                    placeholder={t('chat.composer_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.composerInput, { color: colors.text }]}
                  />
                  <Pressable
                    hitSlop={8}
                    style={styles.composerRight}
                    onPress={() => setShowAttach(true)}
                    accessibilityLabel={t('chat.attach')}
                  >
                    <Ionicons name="attach" size={22} color={colors.textSecondary} />
                  </Pressable>
                  {!hasDraft ? (
                    <Pressable
                      hitSlop={8}
                      style={styles.composerRight}
                      onPress={openCamera}
                      accessibilityLabel={t('chat.camera')}
                    >
                      <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <RecordingStrip
                  phase={recordPhase}
                  elapsedSec={elapsedSec}
                  dragX={dragX}
                  recExit={recExit}
                  onTrashPress={cancelRecording}
                />
              )}

              {recordPhase === 'locked' ? (
                <Pressable
                  onPress={finishRecording}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    { backgroundColor: colors.primary, shadowColor: colors.primary },
                    pressed && styles.sendBtnPressed,
                  ]}
                  accessibilityLabel={t('chat.send')}
                >
                  <Ionicons name="arrow-up" size={22} color={colors.onPrimary} />
                </Pressable>
              ) : hasDraft ? (
                <Pressable
                  onPress={handleSend}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    { backgroundColor: colors.primary, shadowColor: colors.primary },
                    pressed && styles.sendBtnPressed,
                  ]}
                  accessibilityLabel={t('chat.send')}
                >
                  <Ionicons name="arrow-up" size={22} color={colors.onPrimary} />
                </Pressable>
              ) : (
                <View style={styles.micWrap}>
                  {recordPhase === 'recording' ? <MicHalo halo={micHalo} /> : null}
                  {recordPhase === 'recording' ? <LockIndicator dragY={dragY} /> : null}
                  <GestureDetector gesture={recordGesture}>
                    <Animated.View
                      accessibilityLabel={t('chat.record_voice')}
                      style={[
                        styles.sendBtn,
                        { backgroundColor: colors.primary, shadowColor: colors.primary },
                        micStyle,
                      ]}
                    >
                      <Ionicons name="mic" size={22} color={colors.onPrimary} />
                    </Animated.View>
                  </GestureDetector>
                </View>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* iOS-style reaction & context menu */}
      {menuTarget ? (
        <ReactionMenu
          target={menuTarget}
          isGroup={isGroup}
          reactions={reactionsMap[menuTarget.msg.id] ?? []}
          onReact={reactFromMenu}
          onReply={replyFromMenu}
          onCopy={copyFromMenu}
          onClose={closeMenu}
        />
      ) : null}

      {/* Attachment menu */}
      <AttachSheet
        visible={showAttach}
        onClose={() => setShowAttach(false)}
        onPick={handleAttachPick}
      />

      {/* Attachment compose sheets */}
      <AttachmentComposer
        kind={composeKind}
        onClose={() => setComposeKind(null)}
        onSend={sendAttachment}
      />
    </SafeAreaView>
  );
}

function SystemDivider({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.systemRow}>
      <View style={[styles.systemPill, { backgroundColor: colors.surface }]}>
        <Ionicons name="person-add" size={11} color={colors.textSecondary} />
        <Text style={[styles.systemText, { color: colors.textSecondary }]}>{text}</Text>
      </View>
    </View>
  );
}

function HistoryBanner({
  enabled,
  viewOnly,
  shown,
  limit,
}: {
  enabled: boolean;
  viewOnly: boolean;
  shown: number;
  limit: number;
}) {
  const { colors } = useTheme();
  if (!enabled) {
    return (
      <View style={[styles.historyBanner, { backgroundColor: colors.surface }]}>
        <Ionicons name="eye-off-outline" size={13} color={colors.textSecondary} />
        <Text style={[styles.historyBannerText, { color: colors.textSecondary }]}>
          {t('chat.history_off')}
        </Text>
      </View>
    );
  }
  const allShown = limit === Infinity;
  return (
    <View style={[styles.historyBanner, { backgroundColor: colors.surface }]}>
      <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
      <Text style={[styles.historyBannerText, { color: colors.textSecondary }]}>
        {allShown
          ? t('chat.history_banner_all')
          : t('chat.history_banner', { count: shown })}
        {viewOnly ? `  ·  ${t('chat.history_view_only')}` : ''}
      </Text>
    </View>
  );
}

function HighlightedText({
  text,
  query,
  style,
  highlight,
}: {
  text: string;
  query: string;
  style: StyleProp<TextStyle>;
  highlight: string;
}) {
  if (!query) return <Text style={style}>{text}</Text>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  let idx = lower.indexOf(q, from);
  while (idx !== -1) {
    if (idx > from) parts.push({ text: text.slice(from, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    from = idx + q.length;
    idx = lower.indexOf(q, from);
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.match ? (
          <Text key={i} style={{ backgroundColor: highlight, fontWeight: '700' }}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </Text>
  );
}

function MetaRow({ msg, onMedia }: { msg: GroupedMessage; onMedia?: boolean }) {
  const { colors } = useTheme();
  const mine = msg.fromMe;
  return (
    <View style={[styles.metaRow, onMedia && styles.metaOverlay]}>
      <Text
        style={[
          styles.metaTime,
          { color: colors.textMuted },
          mine && !onMedia && styles.metaTimeMine,
          onMedia && styles.metaTimeOnMedia,
        ]}
      >
        {msg.timestamp}
      </Text>
      {mine ? (
        <Ionicons
          name={msg.status === 'read' ? 'checkmark-done' : 'checkmark'}
          size={14}
          color={
            onMedia
              ? '#FFFFFF'
              : msg.status === 'read'
                ? '#9DC1FF'
                : 'rgba(255,255,255,0.75)'
          }
        />
      ) : null}
    </View>
  );
}

function MediaContent({ media }: { media: MediaAttachment }) {
  const { colors } = useTheme();
  if (media.type === 'video') {
    return (
      <View style={[styles.media, { backgroundColor: colors.surfaceMuted }]}>
        <Image source={{ uri: media.uri }} style={styles.mediaImage} contentFit="cover" />
        <View style={styles.videoScrim}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={26} color={colors.text} />
          </View>
        </View>
        <View style={styles.videoBadge}>
          <Ionicons name="videocam" size={12} color="#FFFFFF" />
          <Text style={styles.videoBadgeText}>
            {media.durationSec != null
              ? `${Math.floor(media.durationSec / 60)}:${String(media.durationSec % 60).padStart(2, '0')}`
              : t('chat.video')}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.media, { backgroundColor: colors.surfaceMuted }]}>
      <Image source={{ uri: media.uri }} style={styles.mediaImage} contentFit="cover" />
    </View>
  );
}

// Voice message bubble — play/pause, waveform progress, duration.
function VoiceMessage({ uri, durationSec, mine }: { uri: string; durationSec: number; mine: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const total = status.duration && status.duration > 0 ? status.duration : durationSec || 1;
  const elapsed = status.currentTime;
  const playing = status.playing;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  useEffect(() => {
    if (status.didJustFinish) {
      player.seekTo(0);
      player.pause();
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      if (status.didJustFinish || elapsed >= total - 0.05) player.seekTo(0);
      player.play();
    }
  };

  const bars = useMemo(
    () =>
      Array.from(
        { length: VOICE_BARS },
        (_, i) => 0.34 + 0.66 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.55)),
      ),
    [],
  );

  const tint = mine ? colors.onPrimary : colors.text;
  const dim = mine ? 'rgba(255,255,255,0.38)' : colors.border;
  const shownTime = playing || elapsed > 0 ? elapsed : total;

  return (
    <View style={styles.voiceMsg}>
      <Pressable onPress={toggle} hitSlop={8} style={styles.voicePlay}>
        <Ionicons name={playing ? 'pause' : 'play'} size={21} color={tint} />
      </Pressable>
      <View style={styles.voiceWave}>
        {bars.map((h, i) => {
          const active = i / VOICE_BARS <= progress;
          return (
            <View
              key={i}
              style={[styles.voiceBar, { height: 5 + h * 15, backgroundColor: active ? tint : dim }]}
            />
          );
        })}
      </View>
      <Text style={[styles.voiceTime, { color: mine ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
        {formatDuration(shownTime)}
      </Text>
    </View>
  );
}

// Pulsing halo behind the mic while recording.
function MicHalo({ halo }: { halo: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 0.7, 1], [0.4, 0.12, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(halo.value, [0, 1], [1, 2.5]) }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.micHalo, { backgroundColor: colors.primary }, style]} />;
}

// Lock hint pill above the mic — fills as the finger drags up.
function LockIndicator({ dragY }: { dragY: SharedValue<number> }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [-32, 0], [1, 0.5], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(dragY.value, [-LOCK_THRESHOLD, 0], [-10, 0], Extrapolation.CLAMP) },
      { scale: interpolate(dragY.value, [-LOCK_THRESHOLD, 0], [1.16, 1], Extrapolation.CLAMP) },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.lockIndicator, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      <Ionicons name="lock-closed" size={15} color={colors.textSecondary} />
      <Ionicons name="chevron-up" size={11} color={colors.textMuted} />
    </Animated.View>
  );
}

// Recording strip — replaces the input pill while recording or locked.
function RecordingStrip({
  phase,
  elapsedSec,
  dragX,
  recExit,
  onTrashPress,
}: {
  phase: 'recording' | 'locked';
  elapsedSec: number;
  dragX: SharedValue<number>;
  recExit: SharedValue<number>;
  onTrashPress: () => void;
}) {
  const { colors } = useTheme();
  const dot = useSharedValue(1);

  useEffect(() => {
    dot.value = withRepeat(withTiming(0.2, { duration: 550 }), -1, true);
  }, [dot]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
  const stripStyle = useAnimatedStyle(() => ({
    opacity: 1 - recExit.value,
    transform: [{ translateX: -recExit.value * 90 }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-CANCEL_THRESHOLD, -10, 0], [0, 0.5, 0.7], Extrapolation.CLAMP),
    transform: [{ translateX: Math.max(dragX.value, -70) }],
  }));

  return (
    <Animated.View style={[styles.recStrip, { backgroundColor: colors.surface }, stripStyle]}>
      {phase === 'locked' ? (
        <Pressable onPress={onTrashPress} hitSlop={10} style={styles.recTrash}>
          <Ionicons name="trash-outline" size={21} color={colors.danger} />
        </Pressable>
      ) : null}
      <Animated.View style={[styles.recDot, { backgroundColor: colors.danger }, dotStyle]} />
      <Text style={[styles.recTimer, { color: colors.text }]}>{formatDuration(elapsedSec)}</Text>
      {phase === 'recording' ? (
        <Animated.View style={[styles.recHint, hintStyle]}>
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
          <Text style={[styles.recHintText, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('chat.slide_to_cancel')}
          </Text>
        </Animated.View>
      ) : (
        <Text style={[styles.recHintText, { color: colors.textSecondary, marginLeft: Spacing.sm }]}>
          {t('chat.recording')}
        </Text>
      )}
    </Animated.View>
  );
}

// WhatsApp-style attachment grid — slides up when the paperclip is tapped.
function AttachSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.attachOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.attachSheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: Math.max(insets.bottom, Spacing.lg) },
          ]}
        >
          <View style={styles.attachHandle}>
            <View style={[styles.attachHandleBar, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.attachGrid}>
            {ATTACH_ITEMS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => onPick(item.key)}
                style={({ pressed }) => [styles.attachItem, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={t(`chat.attach_${item.key}`)}
              >
                <View style={[styles.attachIcon, { backgroundColor: `${item.color}22` }]}>
                  <Ionicons name={item.icon} size={26} color={item.color} />
                </View>
                <Text style={[styles.attachLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t(`chat.attach_${item.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Animated dot for Dandara's typing indicator.
function TypingDot({ index }: { index: number }) {
  const { colors } = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(index * 160, withRepeat(withTiming(1, { duration: 480 }), -1, true));
  }, [v, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + v.value * 0.65,
    transform: [{ translateY: -3 * v.value }],
  }));
  return <Animated.View style={[styles.typingDot, { backgroundColor: colors.textMuted }, style]} />;
}

// "Dandara is typing" bubble shown while a reply is being prepared.
function TypingBubble() {
  const { colors } = useTheme();
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowTheirs]}>
      <Image
        source={{ uri: DANDARA.avatarUri }}
        style={[styles.senderAvatar, { backgroundColor: colors.surfaceMuted }]}
        contentFit="cover"
      />
      <View
        style={[
          styles.bubble,
          styles.bubbleTheirs,
          styles.bubbleTheirsTail,
          styles.typingBubble,
          { backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.typingDots}>
          <TypingDot index={0} />
          <TypingDot index={1} />
          <TypingDot index={2} />
        </View>
      </View>
    </View>
  );
}

// Inner content of a chat bubble — shared by the live bubble and the menu clone.
function BubbleBody({
  msg,
  mine,
  isGroup,
  query,
  onVote,
}: {
  msg: GroupedMessage;
  mine: boolean;
  isGroup: boolean;
  query: string;
  onVote?: (optionId: string) => void;
}) {
  const { colors } = useTheme();
  const isAudio = msg.media?.type === 'audio';
  const isVisualMedia = !!msg.media && !isAudio;
  const hasAttachment = !!msg.attachment;
  const hasText = msg.text.trim().length > 0;
  const mediaOnly = isVisualMedia && !hasText;
  const showSender = (isGroup || !!msg.isAI) && !mine && msg.isFirstInGroup && !!msg.senderName;

  return (
    <>
      {msg.replyTo ? (
        <View
          style={[
            styles.replyQuote,
            {
              backgroundColor: mine ? 'rgba(0,0,0,0.12)' : colors.surfaceMuted,
              borderLeftColor: mine ? 'rgba(255,255,255,0.55)' : colors.primary,
            },
          ]}
        >
          <Text
            style={[styles.replyQuoteName, { color: mine ? 'rgba(255,255,255,0.9)' : colors.primary }]}
            numberOfLines={1}
          >
            {msg.replyTo.fromMe ? t('chat.you') : msg.replyTo.senderName ?? ''}
          </Text>
          <View style={styles.replySnippetRow}>
            {msg.replyTo.icon ? (
              <Ionicons
                name={msg.replyTo.icon as keyof typeof Ionicons.glyphMap}
                size={12}
                color={mine ? 'rgba(255,255,255,0.7)' : colors.textSecondary}
              />
            ) : null}
            <Text
              style={[styles.replyQuoteText, { color: mine ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}
              numberOfLines={2}
            >
              {msg.replyTo.text}
            </Text>
          </View>
        </View>
      ) : null}

      {showSender ? (
        <View style={styles.senderRow}>
          {msg.isAI ? <Ionicons name="sparkles" size={11} color={colors.primary} /> : null}
          <Text style={[styles.senderName, { color: colors.primary }]} numberOfLines={1}>
            {msg.senderName}
          </Text>
        </View>
      ) : null}

      {isVisualMedia ? <MediaContent media={msg.media!} /> : null}

      {isAudio ? (
        <VoiceMessage uri={msg.media!.uri} durationSec={msg.media!.durationSec ?? 0} mine={mine} />
      ) : null}

      {msg.attachment ? (
        <AttachmentBubble attachment={msg.attachment} mine={mine} onVote={onVote} />
      ) : null}

      {hasText ? (
        <View style={isVisualMedia ? styles.captionWrap : undefined}>
          <HighlightedText
            text={msg.text}
            query={query}
            highlight={colors.warning}
            style={[styles.bubbleText, { color: mine ? colors.onPrimary : colors.text }]}
          />
          <MetaRow msg={msg} />
        </View>
      ) : null}

      {(isAudio || hasAttachment) && !hasText ? <MetaRow msg={msg} /> : null}

      {mediaOnly ? <MetaRow msg={msg} onMedia /> : null}
    </>
  );
}

function Bubble({
  msg,
  isGroup,
  query,
  reactions,
  onOpenMenu,
  onReact,
  onReply,
  onVote,
}: {
  msg: GroupedMessage;
  isGroup: boolean;
  query: string;
  reactions: ReactionEntry[];
  onOpenMenu: (target: MenuTarget) => void;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: GroupedMessage) => void;
  onVote: (msgId: string, optionId: string) => void;
}) {
  const { colors } = useTheme();
  const mine = msg.fromMe;
  const isVisualMedia = !!msg.media && msg.media.type !== 'audio';
  const showAvatar = (isGroup || !!msg.isAI) && !mine;
  const bubbleRef = useRef<View>(null);
  const translateX = useSharedValue(0);

  // Swipe right to reply — drag the bubble, release past the threshold.
  const pan = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.min(Math.max(e.translationX, 0), 84);
    })
    .onEnd((e) => {
      if (e.translationX > REPLY_THRESHOLD) runOnJS(onReply)(msg);
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [12, REPLY_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(translateX.value, [12, REPLY_THRESHOLD], [0.4, 1], Extrapolation.CLAMP) },
    ],
  }));

  const handleLongPress = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        onOpenMenu({ msg, rect: { x, y, width, height }, mine });
      }
    });
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[
          styles.bubbleRow,
          mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
          !msg.isLastInGroup && styles.bubbleRowGrouped,
        ]}
      >
        {showAvatar ? (
          msg.isLastInGroup ? (
            <Image
              source={{ uri: msg.senderAvatarUri }}
              style={[styles.senderAvatar, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
            />
          ) : (
            <View style={styles.senderAvatarSpacer} />
          )
        ) : null}

        <Animated.View style={[styles.bubbleGroup, mine && styles.bubbleGroupMine, swipeStyle]}>
          {/* Swipe-to-reply icon — revealed as the bubble slides right */}
          <Animated.View style={[styles.swipeReplyIcon, replyIconStyle]} pointerEvents="none">
            <View style={[styles.swipeReplyCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="arrow-undo" size={15} color={colors.primary} />
            </View>
          </Animated.View>

          <Pressable
            ref={bubbleRef}
            onLongPress={handleLongPress}
            delayLongPress={260}
            style={[
              styles.bubble,
              mine
                ? [styles.bubbleMine, { backgroundColor: colors.primary }]
                : [styles.bubbleTheirs, { backgroundColor: colors.surface }],
              isVisualMedia && styles.bubbleWithMedia,
              mine && msg.isLastInGroup && styles.bubbleMineTail,
              !mine && msg.isLastInGroup && styles.bubbleTheirsTail,
            ]}
          >
            <BubbleBody
              msg={msg}
              mine={mine}
              isGroup={isGroup}
              query={query}
              onVote={(optId) => onVote(msg.id, optId)}
            />
          </Pressable>

          {/* Reaction pills */}
          {reactions.length > 0 ? (
            <View style={[styles.reactionPills, mine && styles.reactionPillsMine]}>
              {reactions.map((r) => (
                <Pressable
                  key={r.emoji}
                  onPress={() => onReact(msg.id, r.emoji)}
                  style={[
                    styles.reactionPill,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    r.mine && { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}55` },
                  ]}
                >
                  <Text style={styles.reactionPillEmoji}>{r.emoji}</Text>
                  {r.count > 1 ? (
                    <Text style={[styles.reactionPillCount, { color: r.mine ? colors.primary : colors.textSecondary }]}>
                      {r.count}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

// iOS-style focused context menu: blurs the screen, keeps only the tapped
// message crisp, with a reaction bar above and an action menu below.
function ReactionMenu({
  target,
  isGroup,
  reactions,
  onReact,
  onReply,
  onCopy,
  onClose,
}: {
  target: MenuTarget;
  isGroup: boolean;
  reactions: ReactionEntry[];
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get('window');
  const { msg, rect, mine } = target;

  const [visible, setVisible] = useState(true);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 240 });
  }, [progress]);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const hasText = msg.text.trim().length > 0;
  const isVisualMedia = !!msg.media && msg.media.type !== 'audio';
  const menuItems = hasText ? 2 : 1;
  const menuH = menuItems * MENU_ITEM_HEIGHT;
  const menuW = 230;
  const barW = CHAT_REACTIONS.length * 46 + 14;

  // Vertical placement — shift the bubble so the bar and menu stay on-screen.
  const topSafe = insets.top + 8;
  const botSafe = screenH - insets.bottom - 8;
  const minTop = topSafe + REACTION_BAR_HEIGHT + MENU_GAP;
  const maxTop = botSafe - menuH - MENU_GAP - rect.height;
  let bubbleTop = rect.y;
  if (bubbleTop < minTop) bubbleTop = minTop;
  if (bubbleTop > maxTop) bubbleTop = Math.max(minTop, maxTop);
  const shift = bubbleTop - rect.y;

  const clampX = (x: number, w: number) => Math.max(8, Math.min(screenW - w - 8, x));
  const barLeft = clampX(mine ? rect.x + rect.width - barW : rect.x, barW);
  const menuLeft = clampX(mine ? rect.x + rect.width - menuW : rect.x, menuW);
  const barTop = bubbleTop - MENU_GAP - REACTION_BAR_HEIGHT;
  const menuTop = bubbleTop + rect.height + MENU_GAP;

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, shift]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.03]) },
    ],
  }));
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.1, 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.1, 1], [0.6, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [12, 0]) },
    ],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.2, 0.85], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.2, 1], [0.82, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [-10, 0]) },
    ],
  }));

  const myEmoji = reactions.find((r) => r.mine)?.emoji ?? null;

  return (
    <Modal transparent statusBarTranslucent animationType="fade" visible={visible} onRequestClose={close}>
      {/* Frosted backdrop */}
      <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(160)}>
        <BlurView
          intensity={isDark ? 90 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' },
          ]}
        />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      {/* Reaction bar */}
      <Animated.View
        style={[
          styles.menuBar,
          { backgroundColor: colors.surface, top: barTop, left: barLeft, width: barW },
          barStyle,
        ]}
      >
        {CHAT_REACTIONS.map((emoji) => {
          const active = myEmoji === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => {
                onReact(emoji);
                close();
              }}
              style={({ pressed }) => [
                styles.menuBarBtn,
                active && { backgroundColor: `${colors.primary}22` },
                pressed && { transform: [{ scale: 1.22 }] },
              ]}
            >
              <Text style={styles.menuBarEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Cloned message bubble — stays crisp above the blur */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bubble,
          mine
            ? [styles.bubbleMine, styles.bubbleMineTail, { backgroundColor: colors.primary }]
            : [styles.bubbleTheirs, styles.bubbleTheirsTail, { backgroundColor: colors.surface }],
          isVisualMedia && styles.bubbleWithMedia,
          { position: 'absolute', left: rect.x, top: rect.y, width: rect.width },
          bubbleStyle,
        ]}
      >
        <BubbleBody msg={msg} mine={mine} isGroup={isGroup} query="" />
      </Animated.View>

      {/* Context menu */}
      <Animated.View
        style={[
          styles.menuCard,
          { backgroundColor: colors.surface, top: menuTop, left: menuLeft, width: menuW },
          menuStyle,
        ]}
      >
        <Pressable
          onPress={() => {
            onReply();
            close();
          }}
          style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceMuted }]}
        >
          <Text style={[styles.menuItemText, { color: colors.text }]}>{t('chat.reply')}</Text>
          <Ionicons name="arrow-undo-outline" size={18} color={colors.text} />
        </Pressable>
        {hasText ? (
          <>
            <View style={[styles.menuSep, { backgroundColor: colors.divider }]} />
            <Pressable
              onPress={() => {
                onCopy();
                close();
              }}
              style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[styles.menuItemText, { color: colors.text }]}>{t('chat.copy')}</Text>
              <Ionicons name="copy-outline" size={17} color={colors.text} />
            </Pressable>
          </>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fallback: { ...Typography.body, padding: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.6 },
  peer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  peerAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
  },
  peerOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: Radii.pill,
    borderWidth: 2,
  },
  peerInfo: { flex: 1 },
  peerName: { ...Typography.bodyStrong, fontSize: 16 },
  peerStatus: { ...Typography.caption, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 2 },

  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    fontSize: 15,
    padding: 0,
  },

  thread: { flex: 1 },
  threadContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  threadHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dayPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  dayPillText: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  e2eNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    maxWidth: '88%',
  },
  e2eNoticeText: {
    ...Typography.micro,
    fontSize: 10,
  },
  historyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.md,
    maxWidth: '92%',
  },
  historyBannerText: {
    ...Typography.micro,
    flex: 1,
  },

  systemRow: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  systemText: {
    ...Typography.micro,
    fontWeight: '600',
  },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleRowGrouped: { marginBottom: 2 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubbleGroup: { alignItems: 'flex-start', maxWidth: '82%' },
  bubbleGroupMine: { alignItems: 'flex-end' },

  swipeReplyIcon: {
    position: 'absolute',
    left: -44,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeReplyCircle: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  replyQuote: {
    borderLeftWidth: 3,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 5,
    gap: 2,
  },
  replyQuoteName: { ...Typography.micro, fontWeight: '700' },
  replyQuoteText: { ...Typography.micro, lineHeight: 16, flex: 1 },
  replySnippetRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  reactionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -6,
    paddingBottom: 4,
    paddingLeft: 4,
  },
  reactionPillsMine: { justifyContent: 'flex-end', paddingLeft: 0, paddingRight: 4 },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  reactionPillEmoji: { fontSize: 13 },
  reactionPillCount: { ...Typography.micro, fontWeight: '600' },

  menuBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: REACTION_BAR_HEIGHT,
    borderRadius: Radii.pill,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  menuBarBtn: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBarEmoji: { fontSize: 27 },

  menuCard: {
    position: 'absolute',
    borderRadius: Radii.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: MENU_ITEM_HEIGHT,
  },
  menuItemText: { ...Typography.body, fontSize: 15 },
  menuSep: { height: StyleSheet.hairlineWidth },

  senderAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radii.pill,
  },
  senderAvatarSpacer: { width: 26 },
  bubble: {
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 16,
  },
  bubbleWithMedia: {
    padding: 4,
    overflow: 'hidden',
  },
  bubbleMine: {},
  bubbleMineTail: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleTheirsTail: {
    borderBottomLeftRadius: 4,
  },
  senderName: {
    ...Typography.caption,
    fontWeight: '700',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  bubbleText: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 20,
  },
  captionWrap: {
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: 1,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  metaOverlay: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    marginTop: 0,
  },
  metaTime: {
    ...Typography.micro,
    fontSize: 10.5,
  },
  metaTimeMine: { color: 'rgba(255,255,255,0.85)' },
  metaTimeOnMedia: { color: '#FFFFFF' },

  media: {
    width: 232,
    height: 232,
    borderRadius: 13,
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%' },
  videoScrim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  videoBadgeText: {
    ...Typography.micro,
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '600',
  },

  composerWrap: {
    flexDirection: 'column',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarStripe: {
    width: 3,
    height: 34,
    borderRadius: Radii.pill,
    flexShrink: 0,
  },
  replyBarContent: { flex: 1, gap: 2 },
  replyBarName: { ...Typography.caption, fontWeight: '700' },
  replyBarText: { ...Typography.caption, flex: 1 },
  composer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  composerLeft: {
    width: 38,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerRight: {
    width: 36,
    height: 38,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Typography.body,
    fontSize: 15,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sendBtnPressed: {
    transform: [{ scale: 0.94 }],
  },

  // ── Voice message bubble ─────────────────────────────────────────────────────
  voiceMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 2,
    minWidth: 196,
  },
  voicePlay: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 22,
  },
  voiceBar: {
    flex: 1,
    borderRadius: Radii.pill,
  },
  voiceTime: {
    ...Typography.micro,
    fontVariant: ['tabular-nums'],
  },

  // ── Voice recording ──────────────────────────────────────────────────────────
  micWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micHalo: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
  },
  lockIndicator: {
    position: 'absolute',
    bottom: 58,
    width: 38,
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  recStrip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 24,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  recTrash: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: Radii.pill,
  },
  recTimer: {
    ...Typography.body,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    minWidth: 42,
  },
  recHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  recHintText: {
    ...Typography.caption,
  },

  // ── Attachment menu ──────────────────────────────────────────────────────────
  attachOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  attachSheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    paddingHorizontal: Spacing.sm,
  },
  attachHandle: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  attachHandleBar: {
    width: 36,
    height: 4,
    borderRadius: Radii.pill,
  },
  attachGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  attachItem: {
    width: '25%',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  attachIcon: {
    width: 60,
    height: 60,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachLabel: {
    ...Typography.caption,
    textAlign: 'center',
  },

  // ── Dandara AI ───────────────────────────────────────────────────────────────
  typingBubble: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: Radii.pill,
  },
  suggestRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  suggestChipText: {
    ...Typography.caption,
    fontWeight: '600',
    maxWidth: 210,
  },
});
