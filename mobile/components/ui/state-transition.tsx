import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

const DURATION = 240;
const RISE = 10;

/**
 * Glides content into place whenever `transitionKey` changes — the in-screen
 * counterpart to the tab transition (edit/view, tab content, search results).
 *
 * Like TabScene, it slides without fading opacity. A fade from 0 leaves a
 * blank frame; here the content is always fully opaque, so a state swap reads
 * as a continuous move, never a flash.
 *
 * `transitionKey` is a plain prop, not a React `key`, so children are not
 * remounted — lists keep their scroll position, only the glide replays.
 */
export function StateTransition({
  transitionKey,
  children,
  style,
}: {
  transitionKey: string | number | boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    offset.setValue(RISE);
    Animated.timing(offset, {
      toValue: 0,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [transitionKey, offset]);

  return (
    <Animated.View style={[style, { transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}
