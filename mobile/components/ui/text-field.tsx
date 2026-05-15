import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  inputRef?: React.Ref<TextInput>;
};

export function TextField({
  label,
  hint,
  error,
  leftAdornment,
  rightAdornment,
  style,
  onFocus,
  onBlur,
  inputRef,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {leftAdornment ? <View style={styles.adornment}>{leftAdornment}</View> : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholderTextColor={Colors.light.textMuted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightAdornment ? <View style={styles.adornment}>{rightAdornment}</View> : null}
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.caption,
    color: Colors.light.textSecondary,
    marginLeft: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
  },
  fieldFocused: {
    borderColor: Colors.light.primary,
  },
  fieldError: {
    borderColor: Colors.light.danger,
  },
  input: {
    flex: 1,
    ...Typography.body,
    color: Colors.light.text,
    paddingVertical: Spacing.md,
  },
  adornment: {
    paddingHorizontal: Spacing.xs,
  },
  hint: {
    ...Typography.caption,
    color: Colors.light.textMuted,
    marginLeft: Spacing.xs,
  },
  error: {
    ...Typography.caption,
    color: Colors.light.danger,
    marginLeft: Spacing.xs,
  },
});
