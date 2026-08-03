import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/**
 * In-app dialogs.
 *
 * The native Alert is the wrong tool here for three separate reasons: it
 * ignores the app's theme entirely, it cannot take a text field on Android
 * (Alert.prompt is iOS-only), and it cannot show a secure entry. Anything
 * that needs to *ask* rather than *tell* has to live in the app.
 */

export type DialogAction = {
  label: string;
  onPress?: () => void;
  /** Renders in the destructive colour and is never the default. */
  destructive?: boolean;
  /** Dimmed, right-aligned; the way out. */
  cancel?: boolean;
};

export function Dialog({
  visible,
  icon,
  title,
  body,
  actions,
  onDismiss,
  children,
}: {
  visible: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actions: DialogAction[];
  onDismiss: () => void;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      {/* Tapping the scrim dismisses, but the card swallows the press so a
          tap inside it never closes the dialog by accident. */}
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.center}
        >
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {}}
          >
            {icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={icon} size={22} color={colors.primary} />
              </View>
            ) : null}

            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {body ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>{body}</Text>
            ) : null}

            {children}

            <View style={styles.actions}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  style={({ pressed }) => [
                    styles.action,
                    {
                      backgroundColor: a.cancel
                        ? 'transparent'
                        : a.destructive
                          ? colors.danger
                          : colors.primary,
                      borderColor: a.cancel ? colors.border : 'transparent',
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.actionText,
                      { color: a.cancel ? colors.textSecondary : colors.onPrimary },
                    ]}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

/**
 * Asks for a passcode, keeping the dialog open on a wrong one.
 *
 * `onSubmit` returns whether the code was accepted, so the caller decides
 * what "correct" means without this component learning anything about locks.
 */
export function CodePrompt({
  visible,
  title,
  body,
  minLength = 4,
  onSubmit,
  onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  minLength?: number;
  onSubmit: (code: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // A reopened prompt must never show the previous attempt.
  useEffect(() => {
    if (visible) {
      setCode('');
      setError(false);
    }
  }, [visible]);

  const submit = async () => {
    if (code.length < minLength || busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit(code);
      if (!ok) {
        setError(true);
        setCode('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      visible={visible}
      icon="lock-closed-outline"
      title={title}
      body={body}
      onDismiss={onCancel}
      actions={[
        { label: t('common.cancel'), cancel: true, onPress: onCancel },
        { label: t('common.confirm'), onPress: () => void submit() },
      ]}
    >
      <TextInput
        value={code}
        onChangeText={(v) => {
          setCode(v);
          setError(false);
        }}
        secureTextEntry
        keyboardType="number-pad"
        autoFocus
        onSubmitEditing={() => void submit()}
        placeholder={t('chat_info.lock_code_placeholder')}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceMuted,
            color: colors.text,
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
        accessibilityLabel={title}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>
          {t('chat_info.lock_wrong_code')}
        </Text>
      ) : null}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { ...Typography.h3, textAlign: 'center' },
  body: { ...Typography.body, textAlign: 'center' },
  input: {
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: Spacing.xs,
  },
  error: { ...Typography.caption, textAlign: 'center' },
  textArea: {
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  action: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  actionText: { ...Typography.bodyStrong },
});

/**
 * Asks for a line of text, pre-filled with what is already there.
 *
 * Separate from CodePrompt because the two want opposite things: a passcode
 * field starts empty and hides what you type, an edit field starts with the
 * current value and shows it. Folding them into one component meant a pile
 * of flags at every call site.
 *
 * `onSubmit` returns whether the dialog may close, so a caller that rejects
 * the input can keep it open without this component knowing why.
 */
export function TextPrompt({
  visible,
  title,
  body,
  initialValue = '',
  placeholder,
  confirmLabel,
  secondaryLabel,
  onSecondary,
  onSubmit,
  onCancel,
  multiline = true,
}: {
  visible: boolean;
  title: string;
  body?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Optional destructive action shown beside cancel — delete, usually. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel: () => void;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(initialValue);
  const [busy, setBusy] = useState(false);

  // Reload from the source each time it opens: reusing the last edit would
  // put someone else's text in the field.
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(text);
    } finally {
      setBusy(false);
    }
  };

  const actions: DialogAction[] = [{ label: t('common.cancel'), cancel: true, onPress: onCancel }];
  if (secondaryLabel && onSecondary) {
    actions.push({ label: secondaryLabel, destructive: true, onPress: onSecondary });
  }
  actions.push({ label: confirmLabel ?? t('common.confirm'), onPress: () => void submit() });

  return (
    <Dialog visible={visible} title={title} body={body} onDismiss={onCancel} actions={actions}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline={multiline}
        autoFocus
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.textArea,
          multiline && { minHeight: 96 },
          { backgroundColor: colors.surfaceMuted, color: colors.text, borderColor: colors.border },
        ]}
        accessibilityLabel={title}
      />
    </Dialog>
  );
}
