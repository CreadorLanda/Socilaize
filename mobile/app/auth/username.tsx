import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { t } from '@/i18n';
import { useRegistration } from '@/store/registration';

const RESERVED = ['admin', 'socialize', 'support', 'official', 'me', 'you'];

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function UsernameScreen() {
  const { data, set } = useRegistration();
  const [username, setUsername] = useState(data.username);
  const [discoverable, setDiscoverable] = useState(data.isDiscoverable);
  const [status, setStatus] = useState<Availability>('idle');

  const validate = (v: string): Availability => {
    if (!v) return 'idle';
    if (!/^[a-z0-9_]{3,20}$/.test(v)) return 'invalid';
    if (RESERVED.includes(v)) return 'taken';
    return 'available';
  };

  useEffect(() => {
    if (!username) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const id = setTimeout(() => setStatus(validate(username)), 400);
    return () => clearTimeout(id);
  }, [username]);

  const error = useMemo(() => {
    if (status === 'invalid') return t('auth.username.error_invalid');
    if (status === 'taken') return t('auth.username.error_taken');
    return undefined;
  }, [status]);

  const isValid = status === 'available';

  const handleContinue = () => {
    set('username', username);
    set('isDiscoverable', discoverable);
    router.push('/auth/permissions');
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
          step={4}
          total={5}
          title={t('auth.username.title')}
          subtitle={t('auth.username.subtitle')}
        />

        <View style={styles.body}>
          <TextField
            label={t('auth.username.label')}
            value={username}
            onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder={t('auth.username.placeholder')}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            leftAdornment={<Text style={styles.atSign}>@</Text>}
            rightAdornment={<AvailabilityBadge status={status} />}
            error={error}
            hint={
              status === 'available'
                ? t('auth.username.hint_available', { username })
                : t('auth.username.hint_default')
            }
          />

          <View style={[styles.privacyCard, !discoverable && styles.privacyCardOff]}>
            <View style={styles.privacyHeader}>
              <View style={styles.privacyLabelRow}>
                <Ionicons
                  name={discoverable ? 'globe-outline' : 'lock-closed-outline'}
                  size={14}
                  color={discoverable ? Colors.light.primary : Colors.light.textMuted}
                />
                <Text
                  style={[
                    styles.privacyLabel,
                    !discoverable && styles.privacyLabelOff,
                  ]}
                >
                  {t(
                    discoverable
                      ? 'auth.username.visibility_public'
                      : 'auth.username.visibility_private',
                  )}
                </Text>
              </View>
              <Text style={styles.privacyCaption}>
                {t('auth.username.your_link')}
              </Text>
            </View>

            <View style={styles.urlPreview}>
              <Text
                style={[styles.urlScheme, !discoverable && styles.urlSchemeOff]}
                numberOfLines={1}
              >
                socialize.app/
              </Text>
              <Text
                style={[styles.urlHandle, !discoverable && styles.urlHandleOff]}
                numberOfLines={1}
              >
                @{username || t('auth.username.placeholder')}
              </Text>
            </View>

            <View style={styles.toggleDivider} />

            <Pressable
              onPress={() => setDiscoverable((v) => !v)}
              style={styles.toggleRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: discoverable }}
              hitSlop={4}
            >
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>{t('auth.username.toggle_title')}</Text>
                <Text style={styles.toggleSubtitle}>
                  {discoverable
                    ? t('auth.username.toggle_on')
                    : t('auth.username.toggle_off')}
                </Text>
              </View>
              <Switch
                value={discoverable}
                onValueChange={setDiscoverable}
                trackColor={{ false: Palette.neutral[300], true: Palette.brand[400] }}
                thumbColor={discoverable ? Colors.light.primary : Palette.neutral[0]}
                ios_backgroundColor={Palette.neutral[300]}
              />
            </Pressable>
          </View>
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

function AvailabilityBadge({ status }: { status: Availability }) {
  if (status === 'checking') {
    return <Ionicons name="ellipsis-horizontal" size={18} color={Palette.neutral[400]} />;
  }
  if (status === 'available') {
    return <Ionicons name="checkmark-circle" size={20} color={Colors.light.success} />;
  }
  if (status === 'taken' || status === 'invalid') {
    return <Ionicons name="close-circle" size={20} color={Colors.light.danger} />;
  }
  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.light.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xl },
  body: { paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  atSign: { ...Typography.body, color: Colors.light.textSecondary },

  privacyCard: {
    backgroundColor: Palette.brand[50],
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Palette.brand[100],
    gap: Spacing.md,
  },
  privacyCardOff: {
    backgroundColor: Palette.neutral[50],
    borderColor: Palette.neutral[200],
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  privacyLabel: {
    ...Typography.micro,
    color: Colors.light.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  privacyLabelOff: {
    color: Colors.light.textMuted,
  },
  privacyCaption: {
    ...Typography.micro,
    color: Colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urlPreview: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  urlScheme: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  urlSchemeOff: {
    color: Colors.light.textMuted,
    textDecorationLine: 'line-through',
  },
  urlHandle: {
    ...Typography.h2,
    color: Palette.brand[700],
    fontWeight: '700',
  },
  urlHandleOff: {
    color: Colors.light.textMuted,
    textDecorationLine: 'line-through',
  },
  toggleDivider: {
    height: 1,
    backgroundColor: Palette.brand[100],
    marginVertical: Spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  toggleText: { flex: 1 },
  toggleTitle: { ...Typography.bodyStrong, color: Colors.light.text },
  toggleSubtitle: { ...Typography.caption, color: Colors.light.textSecondary, marginTop: 2 },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
});
