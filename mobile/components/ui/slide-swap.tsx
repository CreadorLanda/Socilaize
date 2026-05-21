import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const DURATION = 260;
const WIDTH = Dimensions.get('window').width;

/**
 * Swaps content with a full directional slide — the outgoing item slides off
 * one edge while the incoming item slides in from the other, both on screen at
 * once. No fade, no blank, no jump.
 *
 * The switch is set up in a layout effect (before paint), so the incoming
 * content is never shown in place for a frame before the slide begins — that
 * stray frame is the "other screen flashing" glitch.
 *
 * Direction is derived from `index`: a higher index slides forward (new from
 * the right), a lower index slides back (new from the left).
 */
export function SlideSwap({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(index);
  const prevChildren = useRef<ReactNode>(children);
  const [exiting, setExiting] = useState<{ node: ReactNode; direction: number } | null>(null);

  // Layout effect: runs after render but before paint, so the very first
  // painted frame already has the incoming layer parked off-screen.
  useLayoutEffect(() => {
    if (index === prevIndex.current) return;
    const direction = index > prevIndex.current ? 1 : -1;
    prevIndex.current = index;
    setExiting({ node: prevChildren.current, direction });
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setExiting(null);
    });
  }, [index, anim]);

  // Passive, so it runs after the layout effect above — a switch still reads
  // the previous children; this only refreshes the snapshot for the next one.
  useEffect(() => {
    prevChildren.current = children;
  });

  const direction = exiting?.direction ?? 1;
  const enterX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [direction * WIDTH, 0],
  });
  const exitX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -direction * WIDTH],
  });

  return (
    <View style={styles.container}>
      {exiting ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: exitX }] }]}
          pointerEvents="none"
        >
          {exiting.node}
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: enterX }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});
