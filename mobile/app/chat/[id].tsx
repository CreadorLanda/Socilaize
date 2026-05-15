import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { CHATS, MESSAGES, type MediaAttachment, type Message } from '@/data/mock';
import { t } from '@/i18n';

type GroupedMessage = Message & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

function groupMessages(messages: Message[]): GroupedMessage[] {
  return messages.map((msg, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    return {
      ...msg,
      isFirstInGroup: !prev || prev.fromMe !== msg.fromMe,
      isLastInGroup: !next || next.fromMe !== msg.fromMe,
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

  const grouped = useMemo(() => groupMessages(messages), [messages]);

  if (!chat) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.fallback}>{t('chat.not_found')}</Text>
      </SafeAreaView>
    );
  }

  const appendMessage = (msg: Omit<Message, 'id' | 'timestamp' | 'fromMe' | 'status'>) => {
    setMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, fromMe: true, timestamp: nowTime(), status: 'sent', ...msg },
    ]);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    appendMessage({ text });
    setDraft('');
  };

  const addAsset = (asset: ImagePicker.ImagePickerAsset) => {
    const media: MediaAttachment = {
      type: asset.type === 'video' ? 'video' : 'image',
      uri: asset.uri,
      durationSec: asset.duration ? Math.round(asset.duration / 1000) : undefined,
    };
    appendMessage({ text: draft.trim(), media });
    setDraft('');
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

  const hasDraft = draft.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.iconBtnPressed]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
        </Pressable>

        <Pressable style={styles.peer} hitSlop={6}>
          <View>
            <Image source={{ uri: chat.avatarUri }} style={styles.peerAvatar} contentFit="cover" />
            {chat.online ? <View style={styles.peerOnlineDot} /> : null}
          </View>
          <View style={styles.peerInfo}>
            <Text style={styles.peerName} numberOfLines={1}>
              {chat.name}
            </Text>
            <Text style={styles.peerStatus} numberOfLines={1}>
              {chat.online ? t('chats.online') : t('chats.last_seen')}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => router.push(`/call/${chat.id}?mode=video`)}
            accessibilityLabel={t('call.video_call')}
          >
            <Ionicons name="videocam-outline" size={22} color={Colors.light.text} />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={styles.iconBtn}
            onPress={() => router.push(`/call/${chat.id}?mode=voice`)}
            accessibilityLabel={t('call.voice_call')}
          >
            <Ionicons name="call-outline" size={20} color={Colors.light.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.thread}>
          <FlatList
            data={grouped}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Bubble msg={item} />}
            contentContainerStyle={styles.threadContent}
            ListHeaderComponent={
              <View style={styles.threadHeader}>
                <View style={styles.dayPill}>
                  <Text style={styles.dayPillText}>{t('chat.today')}</Text>
                </View>
                <View style={styles.e2eNotice}>
                  <Ionicons name="lock-closed" size={11} color={Colors.light.textSecondary} />
                  <Text style={styles.e2eNoticeText}>{t('chat.encrypted_notice')}</Text>
                </View>
              </View>
            }
          />
        </View>

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <Pressable hitSlop={8} style={styles.composerLeft}>
              <Ionicons name="happy-outline" size={22} color={Colors.light.textSecondary} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={t('chat.composer_placeholder')}
              placeholderTextColor={Colors.light.textMuted}
              multiline
              style={styles.composerInput}
            />
            <Pressable
              hitSlop={8}
              style={styles.composerRight}
              onPress={pickFromLibrary}
              accessibilityLabel={t('chat.attach')}
            >
              <Ionicons name="attach" size={22} color={Colors.light.textSecondary} />
            </Pressable>
            {!hasDraft ? (
              <Pressable
                hitSlop={8}
                style={styles.composerRight}
                onPress={openCamera}
                accessibilityLabel={t('chat.camera')}
              >
                <Ionicons name="camera-outline" size={22} color={Colors.light.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={hasDraft ? handleSend : undefined}
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed]}
            accessibilityLabel={hasDraft ? t('chat.send') : t('chat.record_voice')}
          >
            <Ionicons
              name={hasDraft ? 'arrow-up' : 'mic'}
              size={22}
              color={Colors.light.onPrimary}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaRow({ msg, onMedia }: { msg: GroupedMessage; onMedia?: boolean }) {
  const mine = msg.fromMe;
  return (
    <View style={[styles.metaRow, onMedia && styles.metaOverlay]}>
      <Text
        style={[
          styles.metaTime,
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
  if (media.type === 'video') {
    return (
      <View style={styles.media}>
        <Image source={{ uri: media.uri }} style={styles.mediaImage} contentFit="cover" />
        <View style={styles.videoScrim}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={26} color={Colors.light.text} />
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
    <View style={styles.media}>
      <Image source={{ uri: media.uri }} style={styles.mediaImage} contentFit="cover" />
    </View>
  );
}

function Bubble({ msg }: { msg: GroupedMessage }) {
  const mine = msg.fromMe;
  const hasMedia = !!msg.media;
  const hasText = msg.text.trim().length > 0;
  const mediaOnly = hasMedia && !hasText;

  return (
    <View
      style={[
        styles.bubbleRow,
        mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        !msg.isLastInGroup && styles.bubbleRowGrouped,
      ]}
    >
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          hasMedia && styles.bubbleWithMedia,
          mine && msg.isLastInGroup && styles.bubbleMineTail,
          !mine && msg.isLastInGroup && styles.bubbleTheirsTail,
        ]}
      >
        {hasMedia ? <MediaContent media={msg.media!} /> : null}

        {hasText ? (
          <View style={hasMedia ? styles.captionWrap : undefined}>
            <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{msg.text}</Text>
            <MetaRow msg={msg} />
          </View>
        ) : null}

        {mediaOnly ? <MetaRow msg={msg} onMedia /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  fallback: { ...Typography.body, color: Colors.light.text, padding: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.divider,
    backgroundColor: Colors.light.surface,
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
  iconBtnPressed: { opacity: 0.6, backgroundColor: Palette.neutral[100] },
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
    backgroundColor: Palette.neutral[100],
  },
  peerOnlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.success,
    borderWidth: 2,
    borderColor: Colors.light.surface,
  },
  peerInfo: { flex: 1 },
  peerName: { ...Typography.bodyStrong, color: Colors.light.text, fontSize: 16 },
  peerStatus: { ...Typography.caption, color: Colors.light.textSecondary, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 2 },

  thread: { flex: 1, backgroundColor: '#EEF1F6' },
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
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  dayPillText: {
    ...Typography.micro,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  e2eNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    maxWidth: '88%',
  },
  e2eNoticeText: {
    ...Typography.micro,
    color: Colors.light.textSecondary,
    fontSize: 10,
  },

  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bubbleRowGrouped: { marginBottom: 2 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 16,
  },
  bubbleWithMedia: {
    padding: 4,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: Colors.light.primary,
  },
  bubbleMineTail: {
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.light.surface,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  bubbleTheirsTail: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    ...Typography.body,
    color: Colors.light.text,
    fontSize: 15,
    lineHeight: 20,
  },
  bubbleTextMine: { color: Colors.light.onPrimary },
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
    color: Colors.light.textMuted,
    fontSize: 10.5,
  },
  metaTimeMine: { color: 'rgba(255,255,255,0.85)' },
  metaTimeOnMedia: { color: '#FFFFFF' },

  media: {
    width: 232,
    height: 232,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: Palette.neutral[200],
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    backgroundColor: '#EEF1F6',
  },
  composer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.surface,
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
    color: Colors.light.text,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Palette.brand[500],
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  sendBtnPressed: {
    backgroundColor: Palette.brand[600],
    transform: [{ scale: 0.94 }],
  },
});
