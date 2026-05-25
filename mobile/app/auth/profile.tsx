import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
import { Palette, Radii, Spacing } from '@/constants/theme';
import { patchMe } from '@/data/api/users';
import { setUser } from '@/data/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useRegistration } from '@/store/registration';

const alex = require('@/assets/images/alex.png');

export default function ProfileScreen() {
  const { data, set } = useRegistration();
  const [name, setName] = useState(data.displayName);
  const [avatar, setAvatar] = useState<string | null>(data.avatarUri);
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();

  const isValid = useMemo(() => name.trim().length >= 2, [name]);

  const handlePickAvatar = () => {
    setAvatar((curr) => (curr ? null : 'local:alex'));
  };

  const handleContinue = async () => {
    const display = name.trim();
    set('displayName', display);
    set('avatarUri', avatar);
    setBusy(true);
    try {
      // Send the chosen display name to the server. Avatar URI stays local
      // for now — real upload lands with the media module.
      const updated = await patchMe({ display_name: display });
      await setUser(updated);
    } catch {
      // Non-fatal — the user can edit later from Settings. Move on.
    } finally {
      setBusy(false);
    }
    router.push('/auth/username');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <StepHeader
          step={3}
          total={5}
          title={t('auth.profile.title')}
          subtitle={t('auth.profile.subtitle')}
        />

        <View style={styles.body}>
          <Pressable onPress={handlePickAvatar} style={styles.avatarWrap} accessibilityRole="button">
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.surface },
              ]}
            >
              {avatar ? (
                <Image source={alex} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={48} color={colors.textMuted} />
              )}
            </View>
            <View
              style={[
                styles.avatarEdit,
                { backgroundColor: colors.primary, borderColor: colors.background },
              ]}
            >
              <Ionicons name="camera" size={16} color={colors.onPrimary} />
            </View>
          </Pressable>

          <TextField
            label={t('auth.profile.label')}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.profile.placeholder')}
            autoCapitalize="words"
            maxLength={40}
            hint={t('auth.profile.hint')}
          />
        </View>
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={styles.footer}>
          <PrimaryButton
            label={busy ? t('auth.saving') : t('auth.continue')}
            onPress={handleContinue}
            disabled={!isValid || busy}
          />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 112;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xl },
  body: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
    alignItems: 'stretch',
  },
  avatarWrap: {
    alignSelf: 'center',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    shadowColor: Palette.brand[900],
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
});
