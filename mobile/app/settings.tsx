import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { clearSession } from '@/data/auth-store';
import { useProfile } from '@/data/profile-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Visibility = 'everyone' | 'contacts' | 'nobody';
type ThemeChoice = 'system' | 'light' | 'dark';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const profile = useProfile();

  // UI state — local only; persistence is out of scope for this screen.
  const [lastSeen, setLastSeen] = useState<Visibility>('everyone');
  const [profilePhoto, setProfilePhoto] = useState<Visibility>('everyone');
  const [readReceipts, setReadReceipts] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifGroups, setNotifGroups] = useState(true);
  const [notifCalls, setNotifCalls] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>('system');

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

  const confirmClearCache = () =>
    Alert.alert(t('settings.clear_cache'), t('settings.clear_cache_confirm', { size: '248 MB' }), [
      { text: t('settings.cancel'), style: 'cancel' },
      { text: t('settings.clear'), style: 'destructive' },
    ]);

  const confirmLogout = () =>
    Alert.alert(t('settings.logout_title'), t('settings.logout_body'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout_confirm'),
        style: 'destructive',
        onPress: async () => {
          await clearSession();
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
          <Row icon="call-outline" label={t('settings.phone')} value="+244 912 345 678" />
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
                onValueChange={setNotifMessages}
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
                onValueChange={setNotifGroups}
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
                onValueChange={setNotifCalls}
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
            last
            below={
              <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>
                {(['system', 'light', 'dark'] as const).map((choice) => {
                  const active = theme === choice;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => setTheme(choice)}
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
        </Group>

        <Group title={t('settings.section_storage')}>
          <Row
            icon="server-outline"
            label={t('settings.storage_usage')}
            below={
              <View style={styles.storage}>
                <View style={[styles.storageTrack, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.storageFill, { backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.storageLabel, { color: colors.textSecondary }]}>
                  {t('settings.storage_used', { used: '1.2 GB', total: '4 GB' })}
                </Text>
              </View>
            }
          />
          <Row
            icon="trash-bin-outline"
            label={t('settings.clear_cache')}
            value="248 MB"
            onPress={confirmClearCache}
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

  storage: { gap: Spacing.sm },
  storageTrack: {
    height: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  storageFill: {
    height: '100%',
    width: '30%',
    borderRadius: Radii.pill,
  },
  storageLabel: { ...Typography.caption },
});
