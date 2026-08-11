import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';

const DURATION = 340;
const WIDTH = Dimensions.get('window').width;

/**
 * Turns between two pieces of content on an axis, like a cube.
 *
 * This was a flat translateX: both layers slid sideways at full brightness and
 * full size, which reads as two pictures shoved past each other rather than one
 * thing becoming another. The whole story screen was inside it, chrome
 * included, so the progress bar and the avatar slid off with the photo.
 *
 * A cube instead. Each layer rotates about the screen's vertical edge, so the
 * outgoing face turns away and the incoming one turns towards you. The pieces
 * that make it read as depth rather than as a spin:
 *
 *   perspective   without it a rotateY is an affine squash, not a turn
 *   translateX    half a screen, so the faces meet at the edge
 *   scale         the turning face recedes; a flat cube looks like a fold
 *   dim           the face angled away catches less light
 *
 * The switch is set up in a layout effect — after render, before paint — so
 * the incoming content is never shown in place for a frame before the turn
 * begins. That stray frame is the flash you cannot quite see but do notice.
 */
export function SlideSwap({ index, children }: { index: number; children: ReactNode }) {
  const anim = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(index);
  const prevChildren = useRef<ReactNode>(children);
  const [exiting, setExiting] = useState<{ node: ReactNode; direction: number } | null>(null);

  useLayoutEffect(() => {
    if (index === prevIndex.current) return;
    const direction = index > prevIndex.current ? 1 : -1;
    prevIndex.current = index;
    setExiting({ node: prevChildren.current, direction });
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: DURATION,
      // Out-cubic rather than a spring: a turn that overshoots reads as the
      // story bouncing back, and someone tapping quickly through a set would
      // be fighting it.
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

  // Incoming: from a quarter turn away, at the far edge, to square on.
  const enterStyle = {
    transform: [
      { perspective: WIDTH * 2 },
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [direction * WIDTH * 0.5, 0],
        }),
      },
      {
        rotateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [`${direction * 60}deg`, '0deg'],
        }),
      },
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
      },
    ],
  };

  // Outgoing: the mirror of it, turning away.
  const exitStyle = {
    transform: [
      { perspective: WIDTH * 2 },
      {
        translateX: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -direction * WIDTH * 0.5],
        }),
      },
      {
        rotateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${-direction * 60}deg`],
        }),
      },
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
      },
    ],
  };

  // The shade over the face angled away. Drawn as a sibling rather than by
  // animating opacity on the layer itself: fading the content would show the
  // black container through it, and a story turning translucent is a different
  // effect from one turning away from the light.
  const exitShade = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const enterShade = anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });

  return (
    <View style={styles.container}>
      {exiting ? (
        <Animated.View style={[StyleSheet.absoluteFill, exitStyle]} pointerEvents="none">
          {exiting.node}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.shade, { opacity: exitShade }]}
            pointerEvents="none"
          />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, enterStyle]}>
        {children}
        {exiting ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.shade, { opacity: enterShade }]}
            pointerEvents="none"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    // The faces turn out of the plane, so anything behind them is the ground
    // they turn against. Black, or the app background bleeds through the gap
    // at the meeting edge.
    backgroundColor: '#000',
  },
  shade: { backgroundColor: '#000' },
});
