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
import { Colors, Palette, Radii, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useRegistration } from '@/store/registration';

const alex = require('@/assets/images/alex.png');

export default function ProfileScreen() {
  const { data, set } = useRegistration();
  const [name, setName] = useState(data.displayName);
  const [avatar, setAvatar] = useState<string | null>(data.avatarUri);

  const isValid = useMemo(() => name.trim().length >= 2, [name]);

  const handlePickAvatar = () => {
    setAvatar((curr) => (curr ? null : 'local:alex'));
  };

  const handleContinue = () => {
    set('displayName', name.trim());
    set('avatarUri', avatar);
    router.push('/auth/username');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
            <View style={styles.avatar}>
              {avatar ? (
                <Image source={alex} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={48} color={Palette.neutral[400]} />
              )}
            </View>
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={16} color={Colors.light.onPrimary} />
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
          <PrimaryButton label={t('auth.continue')} onPress={handleContinue} disabled={!isValid} />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 112;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
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
    backgroundColor: Palette.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Colors.light.surface,
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
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.light.background,
  },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
});
