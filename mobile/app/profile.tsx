import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Dimensions, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { StateTransition } from '@/components/ui/state-transition';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { updateProfile, useProfile } from '@/data/profile-store';
import { PROFILE_MEDIA, PROFILE_NOTES, STORIES, type UserProfile } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Tab = 'media' | 'stories' | 'notes';

const GRID_GAP = 2;
const TILE = (Dimensions.get('window').width - GRID_GAP * 2) / 3;

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [tab, setTab] = useState<Tab>('media');

  const enterEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const save = () => {
    updateProfile({
      name: draft.name.trim() || profile.name,
      username: draft.username,
      bio: draft.bio.trim(),
      location: draft.location.trim(),
      avatarUri: draft.avatarUri,
    });
    setEditing(false);
  };

  const shareProfile = () => {
    Share.share({ message: t('profile.share_message', { link: profile.link }) });
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset) setDraft((d) => ({ ...d, avatarUri: asset.uri }));
  };

  const usernameValue = (editing ? draft.username : profile.username).replace(/^@/, '');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        {editing ? (
          <Pressable onPress={() => setEditing(false)} hitSlop={10}>
            <Text style={[styles.headerAction, { color: colors.textSecondary }]}>
              {t('profile.cancel')}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityLabel={t('auth.back')}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {editing ? t('profile.edit_title') : t('profile.title')}
        </Text>
        {editing ? (
          <Pressable onPress={save} hitSlop={10}>
            <Text style={[styles.headerAction, { color: colors.primary }]}>{t('profile.save')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <StateTransition transitionKey={editing}>
        {editing ? (
          <View style={styles.editBody}>
            <View style={styles.editAvatarRow}>
              <Pressable onPress={pickAvatar} accessibilityLabel={t('profile.change_photo')}>
                <Image
                  source={{ uri: draft.avatarUri }}
                  style={[styles.editAvatar, { backgroundColor: colors.surfaceMuted }]}
                  contentFit="cover"
                />
                <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                  <Ionicons name="camera" size={15} color={colors.onPrimary} />
                </View>
              </Pressable>
              <Pressable onPress={pickAvatar} hitSlop={8}>
                <Text style={[styles.changePhoto, { color: colors.primary }]}>
                  {t('profile.change_photo')}
                </Text>
              </Pressable>
            </View>

            <TextField
              label={t('profile.name_label')}
              value={draft.name}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              maxLength={40}
            />
            <TextField
              label={t('profile.username_label')}
              value={usernameValue}
              onChangeText={(v) =>
                setDraft((d) => ({
                  ...d,
                  username: `@${v.toLowerCase().replace(/[^a-z0-9_]/g, '')}`,
                }))
              }
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              leftAdornment={<Text style={[styles.atSign, { color: colors.textSecondary }]}>@</Text>}
            />
            <TextField
              label={t('profile.bio_label')}
              value={draft.bio}
              onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))}
              placeholder={t('profile.bio_placeholder')}
              multiline
              maxLength={160}
              style={styles.bioInput}
            />
            <TextField
              label={t('profile.location_label')}
              value={draft.location}
              onChangeText={(v) => setDraft((d) => ({ ...d, location: v }))}
              placeholder={t('profile.location_placeholder')}
              maxLength={60}
            />
          </View>
        ) : (
          <>
            <View style={styles.identity}>
              <Image
                source={{ uri: profile.avatarUri }}
                style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}
                contentFit="cover"
              />
              <View style={styles.identityText}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={[styles.username, { color: colors.primary }]} numberOfLines={1}>
                  {profile.username}
                </Text>
                {profile.location ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                      {profile.location}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {profile.bio ? (
              <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text>
            ) : null}

            <View style={[styles.stats, { borderColor: colors.divider }]}>
              <Stat value={profile.stats.chats} label={t('profile.stat_chats')} />
              <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
              <Stat value={profile.stats.stories} label={t('profile.stat_stories')} />
              <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
              <Stat value={profile.stats.contacts} label={t('profile.stat_contacts')} />
            </View>

            <View style={styles.actions}>
              <View style={styles.editButton}>
                <PrimaryButton label={t('profile.edit')} onPress={enterEdit} />
              </View>
              <Pressable
                onPress={shareProfile}
                style={({ pressed }) => [
                  styles.shareButton,
                  { borderColor: colors.border },
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('profile.share')}
              >
                <Ionicons name="share-outline" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.tabs, { borderBottomColor: colors.divider }]}>
              {(['media', 'stories', 'notes'] as const).map((key) => {
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={styles.tab}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: active ? colors.text : colors.textSecondary },
                      ]}
                    >
                      {t(`profile.tab_${key}`)}
                    </Text>
                    <View
                      style={[
                        styles.tabIndicator,
                        { backgroundColor: active ? colors.primary : 'transparent' },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <StateTransition transitionKey={tab}>
              <TabContent tab={tab} />
            </StateTransition>
          </>
        )}
        </StateTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function TabContent({ tab }: { tab: Tab }) {
  const { colors } = useTheme();

  if (tab === 'notes') {
    return (
      <View style={styles.notes}>
        {PROFILE_NOTES.map((note) => (
          <View
            key={note.id}
            style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.noteText, { color: colors.text }]}>{note.text}</Text>
            <Text style={[styles.noteTime, { color: colors.textMuted }]}>{note.timestamp}</Text>
          </View>
        ))}
      </View>
    );
  }

  const tiles = tab === 'media' ? PROFILE_MEDIA : STORIES.map((s) => s.coverUri);
  return (
    <View style={styles.grid}>
      {tiles.map((uri, i) => (
        <Image
          key={i}
          source={{ uri }}
          style={[styles.tile, { backgroundColor: colors.surfaceMuted }]}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 54,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3 },
  headerAction: { ...Typography.bodyStrong, paddingHorizontal: Spacing.xs },

  scroll: { paddingBottom: Spacing.xxxl },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radii.pill,
  },
  identityText: { flex: 1, gap: 3 },
  name: { ...Typography.h2, fontSize: 21 },
  username: { ...Typography.body, fontWeight: '600' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  location: { ...Typography.caption, flex: 1 },

  bio: {
    ...Typography.body,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  stats: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...Typography.h3, fontSize: 19 },
  statLabel: {
    ...Typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: { width: StyleSheet.hairlineWidth, marginVertical: 2 },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  editButton: { flex: 1 },
  shareButton: {
    width: 56,
    height: 56,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xl,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  tabText: { ...Typography.bodyStrong, fontSize: 14 },
  tabIndicator: {
    height: 2.5,
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    width: TILE,
    height: TILE,
  },

  notes: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  note: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  noteText: { ...Typography.body, lineHeight: 21 },
  noteTime: { ...Typography.micro },

  editBody: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  editAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  editAvatar: {
    width: 76,
    height: 76,
    borderRadius: Radii.pill,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: Radii.pill,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { ...Typography.bodyStrong },
  atSign: { ...Typography.body, fontWeight: '600' },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
