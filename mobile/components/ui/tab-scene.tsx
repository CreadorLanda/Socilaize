import { useFocusEffect } from '@react-navigation/native';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/**
 * Settles a tab's content with a short upward glide on focus.
 *
 * It deliberately does NOT fade opacity: a fade from 0 leaves a blank frame
 * (the "spasm"). Content stays fully opaque the whole time and only slides,
 * the way a native pager moves — no blank, ever.
 */
export function TabScene({ children }: { children: ReactNode }) {
  const offset = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      offset.setValue(10);
      Animated.timing(offset, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [offset]),
  );

  return (
    <Animated.View style={[styles.scene, { transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
  },
});
