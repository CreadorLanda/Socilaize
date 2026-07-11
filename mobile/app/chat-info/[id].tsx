import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useGroup } from '@/data/group-store';
import { CHATS, MESSAGES, type ChatPreview, type Message } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

const MAX_MEDIA_PREVIEW = 6;

export default function ChatInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chat = useMemo(() => CHATS.find((c) => c.id === id), [id]);
  const { colors, isDark } = useTheme();
  const group = useGroup(chat?.isGroup ? id : undefined);

  // Local-only toggles. Real wiring lives on the server side.
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [fileVisible, setFileVisible] = useState(true);

  if (!chat) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={[styles.fallback, { color: colors.text }]}>{t('chat.not_found')}</Text>
      </SafeAreaView>
    );
  }

  const isGroup = !!chat.isGroup;
  const isWA = chat.source === 'whatsapp';
  const memberCount = group?.members.length ?? chat.memberCount ?? 0;
  const mediaItems = (MESSAGES[chat.id] ?? [])
    .filter((m) => m.media?.uri || m.attachment?.kind === 'sticker')
    .slice(-MAX_MEDIA_PREVIEW)
    .reverse();
  const commonGroups = !isGroup ? CHATS.filter((c) => c.isGroup).slice(0, 3) : [];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <View style={styles.identity}>
          <Image
            source={{ uri: chat.avatarUri }}
            style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
          />
          <View style={styles.identityNameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {chat.name}
            </Text>
            {isWA ? <Ionicons name="logo-whatsapp" size={18} color="#25D366" /> : null}
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {isGroup
              ? t('chat_info.group_subtitle', { count: memberCount })
              : chat.username}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <ActionButton
            icon="chatbox-outline"
            label={t('chat_info.message')}
            onPress={() => router.replace(`/chat/${chat.id}`)}
          />
          <ActionButton
            icon="home"
            label={t('hangout.open_short')}
            onPress={() => router.push(`/hangout/${chat.id}?mode=voice`)}
          />
          {!isGroup ? (
            <>
              <ActionButton
                icon="call-outline"
                label={t('call.voice_call')}
                onPress={() => router.push(`/call/${chat.id}?mode=voice`)}
              />
              <ActionButton
                icon="videocam-outline"
                label={t('call.video_call')}
                onPress={() => router.push(`/call/${chat.id}?mode=video`)}
              />
            </>
          ) : (
            <>
              <ActionButton
                icon="videocam-outline"
                label={t('call.video_call')}
                onPress={() => router.push(`/hangout/${chat.id}?mode=video`)}
              />
              <ActionButton icon="person-add-outline" label={t('chat_info.add')} />
            </>
          )}
        </View>

        {/* Houseparty-style hangout entry */}
        <Section colors={colors}>
          <Row
            icon="home-outline"
            label={t('hangout.open')}
            subtitle={t('hangout.open_hint')}
            colors={colors}
            onPress={() => router.push(`/hangout/${chat.id}?mode=voice`)}
          />
          <Divider colors={colors} />
          <Row
            icon="game-controller-outline"
            label={t('hangout.games')}
            subtitle={t('hangout.games_hint')}
            colors={colors}
            onPress={() => router.push(`/hangout/${chat.id}?mode=voice&game=trivia`)}
          />
          <Divider colors={colors} />
          <Row
            icon="radio-outline"
            label={t('hangout.mode_live')}
            subtitle={t('hangout.live_hint')}
            colors={colors}
            onPress={() => router.push(`/hangout/${chat.id}?mode=live`)}
          />
        </Section>

        {/* 1:1 add to lists / notes */}
        {!isGroup ? (
          <Section colors={colors}>
            <Row icon="list-outline" label={t('chat_info.add_to_lists')} colors={colors} />
            <Divider colors={colors} />
            <Row icon="reader-outline" label={t('chat_info.add_notes')} colors={colors} />
          </Section>
        ) : null}

        {/* Media preview */}
        <SectionTitle colors={colors}>{t('chat_info.files_links_documents')}</SectionTitle>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {mediaItems.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
              {mediaItems.map((m) => (
                <MediaTile key={m.id} msg={m} colors={colors} />
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('chat_info.no_files')}
            </Text>
          )}
        </View>

        <Section colors={colors}>
          <Row
            icon="folder-outline"
            label={t('chat_info.manage_storage')}
            subtitle={estimateStorage(MESSAGES[chat.id])}
            colors={colors}
          />
          <Divider colors={colors} />
          <RowToggle
            icon="notifications-outline"
            label={t('chat_info.notifications')}
            value={!muted}
            onValueChange={(v) => setMuted(!v)}
            colors={colors}
          />
          <Divider colors={colors} />
          <RowToggle
            icon="images-outline"
            label={t('chat_info.file_visibility')}
            value={fileVisible}
            onValueChange={setFileVisible}
            colors={colors}
          />
        </Section>

        {/* Encryption */}
        <Section colors={colors}>
          <Row
            icon={isWA ? 'logo-whatsapp' : 'lock-closed-outline'}
            iconColor={isWA ? '#25D366' : undefined}
            label={t('chat_info.encryption_title')}
            subtitle={isWA ? t('chat_info.encryption_wa_hint') : t('chat_info.encryption_hint')}
            colors={colors}
          />
          <Divider colors={colors} />
          <Row
            icon="timer-outline"
            label={t('chat_info.disappearing')}
            value={t('chat_info.off')}
            colors={colors}
          />
          <Divider colors={colors} />
          <RowToggle
            icon="lock-closed"
            label={t('chat_info.lock_chat')}
            subtitle={t('chat_info.lock_chat_hint')}
            value={locked}
            onValueChange={setLocked}
            colors={colors}
          />
          <Divider colors={colors} />
          <Row
            icon="shield-checkmark-outline"
            label={t('chat_info.advanced_privacy')}
            value={t('chat_info.off')}
            colors={colors}
          />
        </Section>

        {/* 1:1 — common groups */}
        {!isGroup && commonGroups.length > 0 ? (
          <>
            <SectionTitle colors={colors}>
              {t('chat_info.common_groups_count', { count: commonGroups.length })}
            </SectionTitle>
            <Section colors={colors}>
              <Row
                icon="people-circle-outline"
                label={t('chat_info.create_group_with', { name: chat.name })}
                colors={colors}
              />
              <Divider colors={colors} />
              <Row
                icon="people-outline"
                label={t('chat_info.add_to_groups')}
                subtitle={t('chat_info.add_to_groups_hint')}
                colors={colors}
              />
              {commonGroups.map((g) => (
                <View key={g.id}>
                  <Divider colors={colors} />
                  <Pressable
                    onPress={() => router.push(`/chat/${g.id}`)}
                    style={({ pressed }) => [
                      styles.row,
                      pressed && { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <Image
                      source={{ uri: g.avatarUri }}
                      style={[styles.rowAvatar, { backgroundColor: colors.surfaceMuted }]}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                        {g.name}
                      </Text>
                      <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                        {t('chat_info.members_count', { count: g.memberCount ?? 0 })}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </Section>
          </>
        ) : null}

        {/* Members (groups only) */}
        {isGroup ? (
          <>
            <SectionTitle colors={colors}>
              {t('chat_info.members_count', { count: memberCount })}
            </SectionTitle>
            <Section colors={colors}>
              <Row icon="person-add-outline" label={t('chat_info.add_members')} colors={colors} />
              <Divider colors={colors} />
              <Row
                icon="bookmark-outline"
                label={t('chat_info.add_to_contacts')}
                colors={colors}
              />
              {(group?.members ?? []).slice(0, 8).map((m) => (
                <View key={m.id}>
                  <Divider colors={colors} />
                  <View style={styles.row}>
                    <Image
                      source={{ uri: m.avatarUri }}
                      style={[styles.rowAvatar, { backgroundColor: colors.surfaceMuted }]}
                      contentFit="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      {m.username ? (
                        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
                          {m.username}
                        </Text>
                      ) : null}
                    </View>
                    {m.role === 'admin' ? (
                      <View style={[styles.adminPill, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={[styles.adminPillText, { color: colors.textSecondary }]}>
                          {t('chat_info.admin')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Section>
          </>
        ) : null}

        {/* Favourites + Clear */}
        <Section colors={colors}>
          <RowToggle
            icon="heart-outline"
            label={t('chat_info.add_to_favorites')}
            value={favorite}
            onValueChange={setFavorite}
            colors={colors}
          />
          <Divider colors={colors} />
          <Row
            icon="trash-outline"
            label={t('chat_info.clear_chat')}
            colors={colors}
            destructive
          />
        </Section>

        {/* Destructive actions */}
        <Section colors={colors}>
          {isGroup ? (
            <Row icon="exit-outline" label={t('chat_info.leave_group')} colors={colors} destructive />
          ) : (
            <>
              <Row
                icon="ban-outline"
                label={t('chat_info.block', { name: chat.name })}
                colors={colors}
                destructive
              />
              <Divider colors={colors} />
              <Row
                icon="thumbs-down-outline"
                label={t('chat_info.report', { name: chat.name })}
                colors={colors}
                destructive
              />
            </>
          )}
        </Section>

        <View style={{ height: Spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Small reusable cells ─────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>['colors'];

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children, colors }: { children: React.ReactNode; colors: Colors }) {
  return <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{children}</Text>;
}

function Section({ children, colors }: { children: React.ReactNode; colors: Colors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

function Divider({ colors }: { colors: Colors }) {
  return <View style={[styles.divider, { backgroundColor: colors.divider }]} />;
}

function Row({
  icon,
  iconColor,
  label,
  subtitle,
  value,
  destructive,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  subtitle?: string;
  value?: string;
  destructive?: boolean;
  colors: Colors;
  onPress?: () => void;
}) {
  const textColor = destructive ? colors.danger : colors.text;
  const content = (
    <>
      <Ionicons name={icon} size={20} color={iconColor ?? textColor} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: textColor }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

function RowToggle({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: Colors;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.text} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function MediaTile({ msg, colors }: { msg: Message; colors: Colors }) {
  const uri =
    (msg.attachment?.kind === 'sticker' ? msg.attachment.uri : undefined) ?? msg.media?.uri;
  if (!uri) return null;
  return (
    <View style={[styles.mediaTile, { backgroundColor: colors.surfaceMuted }]}>
      <Image source={{ uri }} style={styles.mediaImg} contentFit="cover" />
    </View>
  );
}

// Rough storage estimate from message count — for the demo only.
function estimateStorage(messages?: Message[]): string {
  const n = messages?.length ?? 0;
  if (n === 0) return '0 KB';
  const kb = Math.max(50, n * 28);
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fallback: { ...Typography.body, padding: Spacing.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  identity: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  avatar: { width: 132, height: 132, borderRadius: Radii.pill },
  identityNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  name: { ...Typography.h2, fontSize: 22, textAlign: 'center' },
  subtitle: { ...Typography.body, textAlign: 'center' },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  actionLabel: { ...Typography.micro, fontWeight: '700' },

  sectionTitle: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginLeft: Spacing.sm,
  },

  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.lg + 24 + Spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    minHeight: 56,
  },
  rowAvatar: { width: 36, height: 36, borderRadius: Radii.pill },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...Typography.body, fontSize: 15 },
  rowSub: { ...Typography.caption, lineHeight: 18 },
  rowValue: { ...Typography.caption },

  adminPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  adminPillText: { ...Typography.micro, fontWeight: '700' },

  mediaRow: { gap: Spacing.sm, padding: Spacing.sm },
  mediaTile: {
    width: 92,
    height: 92,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  mediaImg: { width: '100%', height: '100%' },
  emptyText: { ...Typography.caption, padding: Spacing.md },
});
