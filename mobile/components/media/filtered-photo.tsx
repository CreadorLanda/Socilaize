import {
  Canvas,
  ColorMatrix,
  Image as SkiaImage,
  useImage,
} from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import { filterById, type FilterId } from '@/data/photo-filters';

/**
 * A photo with its filter, drawn as it will be saved.
 *
 * Skia rather than a tinted overlay, because the same matrix runs here and in
 * the bake — a tint would match on screen and vanish in the file, which is the
 * gap the old do-nothing filters button never opened.
 *
 * Falls back to a plain <Image> while the decode is in flight, or if Skia
 * cannot read the file at all. A photo shown unfiltered for a moment is a
 * smaller failure than an empty rectangle where the photo was.
 */
export function FilteredPhoto({
  uri,
  filter,
  style,
}: {
  uri: string;
  filter: FilterId;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const image = useImage(uri);
  const matrix = filterById(filter).matrix;

  // Nothing to apply: skip Skia entirely rather than pay a decode and a
  // full-surface multiply by the identity.
  if (!matrix) {
    // Wrapped rather than passing `style` straight to <Image>: the caller's
    // style is a ViewStyle and expo-image wants an ImageStyle, and the two
    // disagree about `overflow`.
    return (
      <View style={style}>
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      </View>
    );
  }

  return (
    <View
      style={style}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {image && size ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <SkiaImage image={image} x={0} y={0} width={size.w} height={size.h} fit="cover">
            <ColorMatrix matrix={matrix} />
          </SkiaImage>
        </Canvas>
      ) : (
        <Image source={{ uri }} style={styles.fill} contentFit="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
});
