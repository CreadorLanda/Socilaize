import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { clearSession } from '@/data/auth-store';

import {
  getNotifPrefs,
  patchNotifPrefs,
} from '@/data/api/notifications';
import { registerPushWithServer } from '@/data/push';
import { useProfile } from '@/data/profile-store';
import {
  getActivePack,
  setSchemePreference,
  type SchemePreference,
  useActiveThemeId,
} from '@/data/theme-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Visibility = 'everyone' | 'contacts' | 'nobody';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { colors, isDark, schemePreference } = useTheme();
  const profile = useProfile();
  // Subscribe so the marketplace row refreshes when a pack is applied.
  useActiveThemeId();
  const activePack = getActivePack();

  // UI state — local only; persistence is out of scope for this screen.
  const [lastSeen, setLastSeen] = useState<Visibility>('everyone');
  const [profilePhoto, setProfilePhoto] = useState<Visibility>('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifGroups, setNotifGroups] = useState(true);
  const [notifCalls, setNotifCalls] = useState(false);
  const [notifStories, setNotifStories] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Load notification prefs + register Expo/FCM push token with the API.
  useEffect(() => {
    let cancelled = false;
    getNotifPrefs()
      .then((p) => {
        if (cancelled) return;
        setNotifMessages(p.messages);
        setNotifGroups(p.groups);
        setNotifCalls(p.calls);
        setNotifStories(p.stories);
        setPrefsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setPrefsLoaded(true);
      });
    registerPushWithServer().catch(() => {
      /* permission denied / simulator / offline */
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveNotif = useCallback(
    (patch: {
      messages?: boolean;
      groups?: boolean;
      calls?: boolean;
      stories?: boolean;
    }) => {
      if (patch.messages != null) setNotifMessages(patch.messages);
      if (patch.groups != null) setNotifGroups(patch.groups);
      if (patch.calls != null) setNotifCalls(patch.calls);
      if (patch.stories != null) setNotifStories(patch.stories);
      if (!prefsLoaded) return;
      patchNotifPrefs(patch).catch(() => {
        /* keep optimistic */
      });
    },
    [prefsLoaded],
  );

  const visibilityLabel = (v: Visibility) =>
    v === 'everyone'
      ? t('settings.visibility_everyone')
      : v === 'contacts'
        ? t('settings.visibility_contacts')
        : t('settings.visibility_nobody');

  const pickVisibility = (title: string, current: Visibility, set: (v: Visibility) => void) => {
    const opt = (v: Visibility) => ({
      text: visibilityLabel(v) + (v === current ? '  ✓' : ''),
      onPress: () => set(v),
    });
    Alert.alert(title, undefined, [
      opt('everyone'),
      opt('contacts'),
      opt('nobody'),
      { text: t('settings.cancel'), style: 'cancel' },
    ]);
  };

  const confirmDelete = () =>
    Alert.alert(t('settings.delete_confirm_title'), t('settings.delete_confirm_body'), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.delete'), style: 'destructive' },
    ]);

  const confirmLogout = () =>
    Alert.alert(t('settings.logout_title'), t('settings.logout_body'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout_confirm'),
        style: 'destructive',
        onPress: () => {
          // Fire-and-forget: never let a stuck network keep the user on
          // this screen. Navigate first; the SecureStore wipe and the
          // server revocation race their own deadlines in the background.
          clearSession().catch(() => {
            /* swallowed — local SecureStore wipe is best-effort */
          });
          // replace, not push — the user shouldn't be able to swipe back
          // into a screen that still thinks it's authenticated.
          router.replace('/onboarding');
        },
      },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityLabel={t('auth.back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [
            styles.profileCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.title')}
        >
          <Image
            source={{ uri: profile.avatarUri }}
            style={[styles.profileAvatar, { backgroundColor: colors.surfaceMuted }]}
            contentFit="cover"
          />
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={[styles.profileUsername, { color: colors.textSecondary }]} numberOfLines={1}>
              {profile.username}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        <Group title={t('settings.section_account')}>
          <Row icon="call-outline" label={t('settings.phone')} value={t('settings.phone_hidden')} />
          <Row
            icon="mail-outline"
            label={t('settings.email')}
            value={t('settings.email_empty')}
            onPress={() => {}}
          />
          <Row icon="trash-outline" label={t('settings.delete_account')} danger onPress={confirmDelete} last />
        </Group>

        <Group title={t('settings.section_privacy')}>
          <Row
            icon="eye-outline"
            label={t('settings.last_seen')}
            value={visibilityLabel(lastSeen)}
            onPress={() => pickVisibility(t('settings.last_seen'), lastSeen, setLastSeen)}
          />
          <Row
            icon="image-outline"
            label={t('settings.profile_photo')}
            value={visibilityLabel(profilePhoto)}
            onPress={() => pickVisibility(t('settings.profile_photo'), profilePhoto, setProfilePhoto)}
          />
          <Row
            icon="checkmark-done-outline"
            label={t('settings.read_receipts')}
            control={
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
            last
          />
        </Group>

        <Group title={t('settings.section_notifications')}>
          <Row
            icon="chatbubble-outline"
            label={t('settings.notif_messages')}
            control={
              <Switch
                value={notifMessages}
                onValueChange={(v) => saveNotif({ messages: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            icon="people-outline"
            label={t('settings.notif_groups')}
            control={
              <Switch
                value={notifGroups}
                onValueChange={(v) => saveNotif({ groups: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            icon="call-outline"
            label={t('settings.notif_calls')}
            control={
              <Switch
                value={notifCalls}
                onValueChange={(v) => saveNotif({ calls: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Row
            icon="images-outline"
            label={t('settings.notif_stories')}
            control={
              <Switch
                value={notifStories}
                onValueChange={(v) => saveNotif({ stories: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
            last
          />
        </Group>

        <Group title={t('settings.section_appearance')}>
          <Row
            icon="contrast-outline"
            label={t('settings.theme')}
            below={
              <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
                {(['system', 'light', 'dark'] as SchemePreference[]).map((choice) => {
                  const active = schemePreference === choice;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => setSchemePreference(choice)}
                      style={[
                        styles.segmentItem,
                        active && {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          { color: active ? colors.text : colors.textSecondary },
                        ]}
                      >
                        {t(`settings.theme_${choice}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            }
          />
          <Row
            icon="color-palette-outline"
            label={t('settings.theme_marketplace')}
            value={activePack?.name ?? t('settings.theme_default')}
            onPress={() => router.push('/themes')}
          />
          <Row
            icon="brush-outline"
            label={t('settings.theme_customize')}
            value={t('settings.theme_customize_hint')}
            onPress={() => {
              const id = activePack?.id;
              if (id && activePack?.isOwned) {
                router.push({ pathname: '/themes/create', params: { edit: id } });
              } else if (id) {
                router.push({ pathname: '/themes/create', params: { fork: id } });
              } else {
                router.push('/themes/create');
              }
            }}
            last
          />
        </Group>

        <Group title={t('settings.section_help')}>
          <Row icon="help-circle-outline" label={t('settings.help_faq')} onPress={() => {}} />
          <Row icon="chatbox-ellipses-outline" label={t('settings.help_contact')} onPress={() => {}} last />
        </Group>

        <Group title={t('settings.section_about')}>
          <Row icon="information-circle-outline" label={t('settings.about_version')} value={APP_VERSION} />
          <Row
            icon="document-text-outline"
            label={t('settings.about_terms')}
            onPress={() => Linking.openURL('https://socialize.app/terms')}
            last
          />
        </Group>

        <Group title={t('settings.section_session')}>
          <Row
            icon="log-out-outline"
            label={t('settings.logout')}
            danger
            onPress={confirmLogout}
            last
          />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  danger,
  onPress,
  control,
  below,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  danger?: boolean;
  onPress?: () => void;
  control?: ReactNode;
  below?: ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.rowWrap,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
        pressed && onPress ? { backgroundColor: colors.surfaceMuted } : null,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.row}>
        <Ionicons name={icon} size={21} color={danger ? colors.danger : colors.textSecondary} />
        <Text style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {control ?? (onPress && !danger ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null)}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.h3 },

  body: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.xl,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.xl,
    borderWidth: 1,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
  },
  profileText: { flex: 1, gap: 2 },
  profileName: { ...Typography.h3, fontSize: 17 },
  profileUsername: { ...Typography.caption },

  group: { gap: Spacing.sm },
  groupTitle: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: Spacing.md,
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  rowWrap: {
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingVertical: 10,
  },
  rowLabel: { ...Typography.body, flex: 1 },
  rowValue: { ...Typography.body, maxWidth: 170, textAlign: 'right' },
  below: {
    paddingLeft: 21 + Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: 2,
  },

  segment: {
    flexDirection: 'row',
    borderRadius: Radii.md,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  segmentText: { ...Typography.caption, fontWeight: '600' },


});
