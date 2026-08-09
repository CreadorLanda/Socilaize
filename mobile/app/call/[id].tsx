import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  registerGlobals,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from '@livekit/react-native';
import { RoomEvent, Track } from 'livekit-client';
import type { TrackReference } from '@livekit/react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PeoplePicker, type PickablePerson } from '@/components/ui/people-picker';
import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { callToken, type CallGrant } from '@/data/api/calls';
import { addGroupMembers } from '@/data/api/groups';
import { listChats } from '@/data/api/messages';
import { callKeyFingerprint, callKeyFor } from '@/data/crypto/call-key';
import { appAlert } from '@/data/dialog-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

// WebRTC needs its globals installed before any of it is touched. Done at
// module load rather than inside the component: a re-render must not
// re-register, and the screen can be reached by deep link with nothing else
// mounted.
registerGlobals();

type Mode = 'voice' | 'video';

/**
 * A call.
 *
 * This screen used to simulate one — three setTimeouts walked it from
 * "calling" to "connected" and a face from `data/mock` sat in the middle. It
 * looked exactly like a working call and could not carry a second of audio.
 *
 * The real thing: the server signs a token saying this user may join the room
 * named after this chat, the SFU relays the media, and the streams are
 * encrypted with a key derived from the conversation's own E2EE session —
 * which the server never sees. See server/internal/modules/calls.
 */
export default function CallScreen() {
  const { id, mode, incoming } = useLocalSearchParams<{
    id: string;
    mode?: string;
    incoming?: string;
  }>();
  const callMode: Mode = mode === 'video' ? 'video' : 'voice';
  const { colors } = useTheme();

  const [grant, setGrant] = useState<CallGrant | null>(null);
  const [e2eeKey, setE2eeKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        // Fetched now, not cached: the token lives five minutes and holding
        // one is holding a key to the room.
        // `incoming=1` means we are answering; anything else means we are
        // placing the call and the other phones should ring.
        const g = await callToken(id, { ring: incoming !== '1', mode: callMode });
        if (cancelled) return;
        setGrant(g);

        // The media key is derived from the pairwise session, so both sides
        // arrive at the same bytes without anything being transmitted. A
        // group has no single pairwise session; those calls run without the
        // extra layer until the key is derived from the group's sender key.
        const chat = (await listChats()).find((c) => c.id === id);
        if (chat?.type !== 'group' && chat?.peer_user_id) {
          const key = await callKeyFor(id, chat.peer_user_id);
          if (!cancelled) setE2eeKey(key);
        }
      } catch {
        if (!cancelled) setFailure(t('call.failed_to_join'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, incoming, callMode]);

  // The audio session has to be running before the room connects, or the
  // first seconds arrive with nowhere to play.
  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  if (failure) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={[styles.status, { color: colors.text }]}>{failure}</Text>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={[styles.link, { color: colors.primary }]}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!grant) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.status, { color: colors.textSecondary }]}>
            {t('call.connecting')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={grant.url}
      token={grant.token}
      connect
      audio
      video={callMode === 'video'}
      options={{ adaptiveStream: true, dynacast: true }}
      {...(e2eeKey
        ? { e2ee: { keyProviderOptions: { sharedKey: e2eeKey } } as never }
        : {})}
      onError={() => setFailure(t('call.failed_to_join'))}
    >
      <CallStage chatId={id!} mode={callMode} e2eeKey={e2eeKey} />
    </LiveKitRoom>
  );
}

/**
 * Everything inside the room.
 *
 * Split out because the LiveKit hooks only work under the provider — the
 * outer component cannot see participants or tracks at all.
 */
function CallStage({
  chatId,
  mode,
  e2eeKey,
}: {
  chatId: string;
  mode: Mode;
  e2eeKey: string | null;
}) {
  const { colors } = useTheme();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const [seconds, setSeconds] = useState(0);
  const [connected, setConnected] = useState(false);
  const [adding, setAdding] = useState(false);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const onConnected = () => {
      setConnected(true);
      startedAt.current = Date.now();
    };
    room.on(RoomEvent.Connected, onConnected);
    if (room.state === 'connected') onConnected();
    return () => {
      room.off(RoomEvent.Connected, onConnected);
    };
  }, [room]);

  // Timed from the wall clock, not by counting ticks. An interval that misses
  // a beat while the app is backgrounded would drift, and a call timer that
  // disagrees with the phone's is a small thing people notice.
  useEffect(() => {
    if (!connected) return;
    const tick = setInterval(() => {
      if (startedAt.current) setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [connected]);

  const hangUp = () => {
    void room.disconnect();
    router.back();
  };

  const others = participants.filter((p) => p.identity !== localParticipant.identity);
  // useTracks hands back placeholders for participants who have not published
  // yet — they have no publication at all. VideoTrack needs a real one, so the
  // narrowing is a type guard rather than a filter: a placeholder rendered as
  // a video is a blank tile with nothing behind it.
  const cameraTracks = tracks.filter(
    (tr): tr is TrackReference =>
      tr.publication != null &&
      tr.publication.kind === Track.Kind.Video &&
      !tr.publication.isMuted,
  );

  const inviteMore = async (people: PickablePerson[]) => {
    if (people.length === 0) return;
    try {
      // The room is the chat. Adding someone to the call means adding them to
      // the conversation — there is no separate guest list, and inventing one
      // would let people into a room whose messages they cannot read.
      await addGroupMembers(chatId, people.map((p) => p.id));
    } catch {
      appAlert(t('chats.action_failed_title'), t('call.invite_failed'));
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: '#0B0C10' }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.peerName} numberOfLines={1}>
          {others.length === 0
            ? t('call.waiting_for_others')
            : others.length === 1
              ? others[0].name || others[0].identity
              : t('call.participants', { count: others.length + 1 })}
        </Text>
        <Text style={styles.timer}>
          {connected ? formatDuration(seconds) : t('call.connecting')}
        </Text>
        {/*
          Shown, not assumed. The fingerprint is derived from the same key on
          both phones, so two people reading the same four bytes to each other
          is a check the server cannot fake.
        */}
        {e2eeKey ? (
          <View style={styles.e2eeBadge}>
            <Ionicons name="lock-closed" size={11} color={Palette.brand[300]} />
            <Text style={styles.e2eeText}>{callKeyFingerprint(e2eeKey)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.stage}>
        {mode === 'video' && cameraTracks.length > 0 ? (
          <View style={styles.grid}>
            {cameraTracks.map((tr) => (
              <View key={tr.participant.identity + tr.source} style={styles.tile}>
                <VideoTrack trackRef={tr} style={styles.video} objectFit="cover" />
                <Text style={styles.tileName} numberOfLines={1}>
                  {tr.participant.name || tr.participant.identity}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.center}>
            <View style={[styles.avatarBig, { borderColor: colors.border }]}>
              <Ionicons name="person" size={54} color={colors.textMuted} />
            </View>
            <Text style={styles.status}>
              {connected ? t('call.audio_only') : t('call.connecting')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <CircleButton
          icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
          active={!isMicrophoneEnabled}
          label={t('call.mute')}
          onPress={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <CircleButton
          icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
          active={!isCameraEnabled}
          label={t('call.camera')}
          onPress={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <CircleButton
          icon="person-add"
          label={t('call.add_people')}
          onPress={() => setAdding(true)}
        />
        <CircleButton icon="call" label={t('call.hang_up')} danger onPress={hangUp} />
      </View>

      <PeoplePicker
        visible={adding}
        title={t('call.add_people')}
        confirmLabel={t('common.done')}
        excludeIds={participants.map((p) => p.identity)}
        onClose={() => setAdding(false)}
        onConfirm={(people) => void inviteMore(people)}
      />
    </SafeAreaView>
  );
}

function CircleButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.circle,
        danger && styles.circleDanger,
        active && styles.circleActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={danger || active ? '#FFFFFF' : '#0B0C10'}
        style={danger ? { transform: [{ rotate: '135deg' }] } : undefined}
      />
    </Pressable>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  header: { alignItems: 'center', paddingTop: Spacing.lg, gap: 2 },
  peerName: { ...Typography.h2, color: '#FFFFFF' },
  timer: { ...Typography.caption, color: 'rgba(255,255,255,0.6)' },
  e2eeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  e2eeText: { ...Typography.micro, color: Palette.brand[300], letterSpacing: 1 },
  stage: { flex: 1, padding: Spacing.md },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 180,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    backgroundColor: '#15161C',
  },
  video: { flex: 1 },
  tileName: {
    ...Typography.micro,
    color: '#FFFFFF',
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
  },
  avatarBig: {
    width: 128,
    height: 128,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15161C',
  },
  status: { ...Typography.body, color: 'rgba(255,255,255,0.7)' },
  link: { ...Typography.bodyStrong },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  circleActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  circleDanger: { backgroundColor: '#EF4444' },
});
