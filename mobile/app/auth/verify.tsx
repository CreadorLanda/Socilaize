import { Platform as RNPlatform } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { StepHeader } from '@/components/ui/step-header';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { authStart, authVerify, type Platform } from '@/data/api/auth';
import { ApiError } from '@/data/api/client';
import { setSession } from '@/data/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useRegistration } from '@/store/registration';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

function devicePlatform(): Platform {
  if (RNPlatform.OS === 'ios') return 'ios';
  if (RNPlatform.OS === 'android') return 'android';
  if (RNPlatform.OS === 'web') return 'web';
  return 'desktop';
}

export default function VerifyScreen() {
  const { data, set } = useRegistration();
  const [digits, setDigits] = useState<string[]>(() => {
    // If /auth/start returned a dev_code, pre-fill so the user can just confirm.
    if (data.otp && data.otp.length === OTP_LENGTH && /^\d+$/.test(data.otp)) {
      return data.otp.split('');
    }
    return Array(OTP_LENGTH).fill('');
  });
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Array<TextInput | null>>([]);
  const { colors } = useTheme();
  const e164 = `${data.countryCode}${data.phoneNumber}`;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleChange = (value: string, index: number) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    setDigits((d) => {
      const next = [...d];
      next[index] = clean;
      return next;
    });
    if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const code = digits.join('');
  const isValid = code.length === OTP_LENGTH;

  const handleContinue = async () => {
    set('otp', code);
    setError(null);
    setBusy(true);
    try {
      const res = await authVerify({
        phone: e164,
        code,
        device: 'mobile',
        platform: devicePlatform(),
      });
      await setSession(res.user, res.tokens);
      // Returning users land straight in the app. The backend marks a fresh
      // account with an empty display_name + a `u<hash>` placeholder username
      // — so a non-empty display_name is a reliable "already onboarded" flag.
      if (res.user.display_name.trim().length > 0) {
        router.replace('/(tabs)');
        return;
      }
      // Seed the registration store so the profile/username steps can prefill.
      set('username', res.user.username);
      set('displayName', res.user.display_name);
      router.push('/auth/profile');
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'invalid_code' || err.code === 'code_expired')) {
        setError(t('auth.verify.invalid'));
      } else {
        setError(t('auth.verify.failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await authStart(e164);
      if (res.dev_code) set('otp', res.dev_code);
    } catch {
      /* silent — the timer reset still gives feedback */
    }
    setSecondsLeft(RESEND_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(''));
    inputs.current[0]?.focus();
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
          step={2}
          total={5}
          title={t('auth.verify.title')}
          subtitle={t('auth.verify.subtitle', {
            phone: `${data.countryCode} ${data.phoneNumber}`,
          })}
        />

        <View style={styles.body}>
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                value={d}
                onChangeText={(v) => handleChange(v, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                style={[
                  styles.otpCell,
                  { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text },
                  !!d && { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
                ]}
                selectTextOnFocus
              />
            ))}
          </View>

          {secondsLeft > 0 ? (
            <Text style={[styles.timer, { color: colors.textMuted }]}>
              {t('auth.verify.resend_in', { seconds: secondsLeft })}
            </Text>
          ) : (
            <Pressable onPress={handleResend} hitSlop={8}>
              <Text style={[styles.resend, { color: colors.primary }]}>
                {t('auth.verify.resend')}
              </Text>
            </Pressable>
          )}

          {error ? <Text style={[styles.timer, { color: colors.danger }]}>{error}</Text> : null}
        </View>
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={styles.footer}>
          <PrimaryButton
            label={busy ? t('auth.verifying') : t('auth.verify.cta')}
            onPress={handleContinue}
            disabled={!isValid || busy}
          />
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
    alignItems: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  otpCell: {
    width: 48,
    height: 56,
    borderRadius: Radii.lg,
    borderWidth: 1,
    textAlign: 'center',
    ...Typography.h2,
  },
  timer: { ...Typography.caption },
  resend: { ...Typography.bodyStrong },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
});
