import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ensureLocal, mediaIdFromURL, useCacheState } from '@/data/media-cache';

/**
 * Video playback inside the story viewer.
 *
 * A video story used to render its cover with a play badge on top, and the
 * badge did nothing — it advertised a player that did not exist. The cover
 * is still shown underneath while the file downloads, so the frame is never
 * blank, but the badge is gone: nothing here is tappable, because a story
 * plays on its own.
 *
 * Muted by default, like every other feed: sound that starts without being
 * asked for is the fastest way to make someone close an app.
 */
export function StoryVideo({
  url,
  active,
  paused,
  style,
  onReady,
}: {
  url: string;
  /** This story is the one on screen. */
  active: boolean;
  /** Held by a long press or an open sheet. */
  paused: boolean;
  style?: StyleProp<ViewStyle>;
  /** Fired once the file is local and playback can start. */
  onReady?: () => void;
}) {
  // Server bytes are authenticated, so nothing can be handed to VideoView as
  // a URL — it has to be resolved to a local file first.
  const mediaId = mediaIdFromURL(url);
  const cache = useCacheState(mediaId ?? undefined);
  const localUri = cache.status === 'ready' ? cache.uri : null;

  useEffect(() => {
    if (mediaId) void ensureLocal(mediaId);
  }, [mediaId]);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!localUri) return;
    onReady?.();
    if (active && !paused) player.play();
    else player.pause();
  }, [localUri, active, paused, player, onReady]);

  // Rewind when the story leaves the screen, so coming back to it starts at
  // the beginning rather than wherever it happened to stop.
  useEffect(() => {
    if (!active && localUri) {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, localUri, player]);

  if (!localUri) return null;

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
}
