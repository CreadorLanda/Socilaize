import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primary-button';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
import { Radii, Spacing, Typography } from '@/constants/theme';
import { ApiError } from '@/data/api/client';
import { waLink, waStatus, type LinkResponse } from '@/data/api/whatsapp';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { useRegistration } from '@/store/registration';

/**
 * Step 6/6 — optional WhatsApp link.
 *
 * Three UI states:
 *   - idle     → phone input (same as registration by default) + Link / Skip
 *   - pending  → display pairing code, poll /status, surface countdown
 *   - linked   → success card → Continue to /(tabs)
 */
type Step = 'idle' | 'pending' | 'linked';

export default function WhatsappStepScreen() {
  const { data, reset } = useRegistration();
  const { colors } = useTheme();

  const [view, setView] = useState<Step>('idle');
  const [useDifferent, setUseDifferent] = useState(false);
  const [phone, setPhone] = useState(data.phoneNumber);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const e164 = useMemo(
    () => (useDifferent ? phone : `${data.countryCode}${data.phoneNumber}`),
    [useDifferent, phone, data.countryCode, data.phoneNumber],
  );
  const displayPhone = useMemo(
    () => (useDifferent ? phone || '+…' : `${data.countryCode} ${data.phoneNumber}`),
    [useDifferent, phone, data.countryCode, data.phoneNumber],
  );

  // Countdown — refreshes every second while there's an expiry.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Poll /status while pending. Stop on success / expiry / unmount.
  useEffect(() => {
    if (view !== 'pending') return;
    const poll = async () => {
      try {
        const res = await waStatus();
        if (res.status === 'linked') {
          stopPolling();
          setView('linked');
        } else if (res.status === 'failed') {
          stopPolling();
          setError(res.last_error || t('auth.whatsapp.error_failed'));
          setView('idle');
        }
      } catch {
        // Keep polling — transient network errors shouldn't kill the flow.
      }
    };
    pollRef.current = setInterval(poll, 2500);
    return stopPolling;
  }, [view]);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const handleLink = async () => {
    if (!e164.startsWith('+') || e164.length < 9) {
      setError(t('auth.whatsapp.error_invalid_phone'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res: LinkResponse = await waLink(e164);
      setCode(res.pairing_code);
      setExpiresAt(new Date(res.pairing_expires_at).getTime());
      setView('pending');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'phone_not_on_whatsapp') {
          setError(t('auth.whatsapp.error_not_on_whatsapp'));
        } else if (err.code === 'pairing_rate_limited') {
          setError(t('auth.whatsapp.error_rate_limited'));
        } else {
          setError(err.message || t('auth.whatsapp.error_failed'));
        }
      } else {
        setError(t('auth.whatsapp.error_failed'));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    reset();
    router.replace('/(tabs)');
  };

  const handleContinue = () => {
    reset();
    router.replace('/(tabs)');
  };

  const handleCopy = async () => {
    if (code) await Clipboard.setStringAsync(code);
  };

  const handleStartOver = () => {
    setView('idle');
    setCode(null);
    setExpiresAt(null);
    setError(null);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <StepHeader
          step={6}
          total={6}
          title={t('auth.whatsapp.title')}
          subtitle={t('auth.whatsapp.subtitle')}
        />

        <View style={styles.body}>
          {view === 'idle' ? (
            <>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.row}>
                  <View style={[styles.iconBubble, { backgroundColor: '#25D36633' }]}>
                    <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>
                      {t('auth.whatsapp.use_same')}
                    </Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                      {`${data.countryCode} ${data.phoneNumber}`}
                    </Text>
                  </View>
                  <Switch
                    value={!useDifferent}
                    onValueChange={(v) => setUseDifferent(!v)}
                    trackColor={{ false: colors.divider, true: colors.primary }}
                    thumbColor={!useDifferent ? colors.primary : colors.surface}
                    ios_backgroundColor={colors.divider}
                  />
                </View>

                {useDifferent ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <TextField
                      label={t('auth.whatsapp.other_label')}
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="+244912345678"
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.notice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  {t('auth.whatsapp.info')}
                </Text>
              </View>

              {error ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              ) : null}
            </>
          ) : null}

          {view === 'pending' && code ? (
            <View
              style={[
                styles.card,
                styles.codeCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
                {t('auth.whatsapp.code_label', { phone: displayPhone })}
              </Text>

              <Pressable onPress={handleCopy} hitSlop={8}>
                <Text style={[styles.codeText, { color: colors.text }]} selectable>
                  {code}
                </Text>
                <Text style={[styles.copyHint, { color: colors.primary }]}>
                  {t('auth.whatsapp.copy_hint')}
                </Text>
              </Pressable>

              {secondsLeft > 0 ? (
                <Text style={[styles.timer, { color: colors.textMuted }]}>
                  {t('auth.whatsapp.expires_in', { seconds: secondsLeft })}
                </Text>
              ) : (
                <Text style={[styles.timer, { color: colors.danger }]}>
                  {t('auth.whatsapp.expired')}
                </Text>
              )}

              <View style={[styles.divider, { backgroundColor: colors.divider }]} />

              <Text style={[styles.stepsTitle, { color: colors.text }]}>
                {t('auth.whatsapp.steps_title')}
              </Text>
              <Steps colors={colors} />
            </View>
          ) : null}

          {view === 'linked' ? (
            <View
              style={[
                styles.card,
                styles.successCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.successIcon, { backgroundColor: '#25D36622' }]}>
                <Ionicons name="checkmark-circle" size={42} color="#25D366" />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>
                {t('auth.whatsapp.success_title')}
              </Text>
              <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                {t('auth.whatsapp.success_subtitle', { phone: displayPhone })}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <View style={styles.footer}>
          {view === 'idle' ? (
            <>
              <PrimaryButton
                label={busy ? t('auth.whatsapp.linking') : t('auth.whatsapp.link_cta')}
                onPress={handleLink}
                disabled={busy}
              />
              <Pressable onPress={handleSkip} style={styles.skipButton} hitSlop={8}>
                <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                  {t('auth.whatsapp.skip')}
                </Text>
              </Pressable>
            </>
          ) : null}

          {view === 'pending' ? (
            <Pressable onPress={handleStartOver} style={styles.skipButton} hitSlop={8}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>
                {t('auth.whatsapp.try_other_number')}
              </Text>
            </Pressable>
          ) : null}

          {view === 'linked' ? (
            <PrimaryButton label={t('auth.whatsapp.continue_cta')} onPress={handleContinue} />
          ) : null}
        </View>
      </KeyboardStickyView>
    </SafeAreaView>
  );
}

function Steps({
  colors,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const lines = [
    t('auth.whatsapp.step1'),
    t('auth.whatsapp.step2'),
    t('auth.whatsapp.step3'),
    t('auth.whatsapp.step4'),
  ];
  return (
    <View style={{ gap: Spacing.sm }}>
      {lines.map((line, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={[styles.stepNumber, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.stepNumberText, { color: colors.primary }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.stepText, { color: colors.textSecondary }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: Spacing.xl },
  body: { paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  card: {
    borderRadius: Radii.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { ...Typography.bodyStrong },
  rowSubtitle: { ...Typography.caption, marginTop: 2 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  noticeText: { ...Typography.caption, flex: 1 },
  errorText: { ...Typography.caption, paddingHorizontal: Spacing.sm },

  codeCard: {
    alignItems: 'center',
  },
  codeLabel: {
    ...Typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  codeText: {
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  copyHint: {
    ...Typography.micro,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  timer: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  divider: {
    height: 1,
    width: '100%',
    marginVertical: Spacing.md,
  },
  stepsTitle: {
    ...Typography.bodyStrong,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...Typography.micro, fontWeight: '700' },
  stepText: { ...Typography.caption, flex: 1 },

  successCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successTitle: { ...Typography.h2, textAlign: 'center' },
  successSubtitle: { ...Typography.body, textAlign: 'center', marginTop: Spacing.xs },

  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  skipButton: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  skipText: { ...Typography.bodyStrong },
});
