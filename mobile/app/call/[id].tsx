import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { CHATS } from '@/data/mock';
import { t } from '@/i18n';

type Phase = 'calling' | 'ringing' | 'connected';
type Mode = 'voice' | 'video';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CallScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const callMode: Mode = mode === 'video' ? 'video' : 'voice';
  const chat = useMemo(() => CHATS.find((c) => c.id === id), [id]);

  const [phase, setPhase] = useState<Phase>('calling');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(callMode === 'video');
  const [videoOn, setVideoOn] = useState(callMode === 'video');

  useEffect(() => {
    const toRinging = setTimeout(() => setPhase('ringing'), 1800);
    const toConnected = setTimeout(() => setPhase('connected'), 4200);
    return () => {
      clearTimeout(toRinging);
      clearTimeout(toConnected);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'connected') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const endCall = () => {
    if (router.canGoBack()) router.back();
  };

  if (!chat) {
    return (
      <SafeAreaView style={styles.fallbackWrap}>
        <Text style={styles.fallback}>{t('chat.not_found')}</Text>
      </SafeAreaView>
    );
  }

  const statusText =
    phase === 'calling'
      ? t('call.calling')
      : phase === 'ringing'
        ? t('call.ringing')
        : formatDuration(seconds);

  const isVideo = callMode === 'video' && videoOn;

  return (
    <View style={[styles.root, isVideo ? styles.rootVideo : styles.rootVoice]}>
      <StatusBar style="light" />

      {isVideo ? (
        <Image
          source={{ uri: chat.avatarUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={phase === 'connected' ? 0 : 30}
        />
      ) : null}
      {isVideo ? <View style={styles.videoTint} /> : null}

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topInfo}>
          <View style={styles.modeBadge}>
            <Ionicons
              name={callMode === 'video' ? 'videocam' : 'call'}
              size={13}
              color="#FFFFFF"
            />
            <Text style={styles.modeBadgeText}>
              {t(callMode === 'video' ? 'call.video_call' : 'call.voice_call')}
            </Text>
          </View>
          <Text style={styles.encrypted}>
            <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.7)" />{' '}
            {t('call.encrypted')}
          </Text>
        </View>

        <View style={styles.center}>
          {!isVideo ? (
            <View style={styles.avatarHalo}>
              <Image source={{ uri: chat.avatarUri }} style={styles.avatar} contentFit="cover" />
            </View>
          ) : null}
          <Text style={styles.name}>{chat.name}</Text>
          <Text style={styles.status}>{statusText}</Text>
        </View>

        {isVideo && phase === 'connected' ? (
          <View style={styles.selfView}>
            <Ionicons name="person" size={32} color="rgba(255,255,255,0.5)" />
          </View>
        ) : null}

        <View style={styles.controls}>
          <View style={styles.controlRow}>
            <CallButton
              icon={muted ? 'mic-off' : 'mic'}
              label={t('call.mute')}
              active={muted}
              onPress={() => setMuted((v) => !v)}
            />
            {callMode === 'video' ? (
              <CallButton
                icon={videoOn ? 'videocam' : 'videocam-off'}
                label={t('call.camera')}
                active={!videoOn}
                onPress={() => setVideoOn((v) => !v)}
              />
            ) : (
              <CallButton
                icon="videocam"
                label={t('call.camera')}
                onPress={() => setVideoOn(true)}
              />
            )}
            <CallButton
              icon={speaker ? 'volume-high' : 'volume-medium'}
              label={t('call.speaker')}
              active={speaker}
              onPress={() => setSpeaker((v) => !v)}
            />
          </View>

          <Pressable
            onPress={endCall}
            style={({ pressed }) => [styles.endButton, pressed && styles.endButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('call.end')}
          >
            <Ionicons name="call" size={30} color="#FFFFFF" style={styles.endIcon} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function CallButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.callButtonWrap} onPress={onPress} accessibilityRole="button">
      <View style={[styles.callButton, active && styles.callButtonActive]}>
        <Ionicons name={icon} size={24} color={active ? Colors.light.text : '#FFFFFF'} />
      </View>
      <Text style={styles.callButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootVoice: { backgroundColor: Palette.brand[700] },
  rootVideo: { backgroundColor: '#0B1020' },
  videoTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,16,32,0.35)' },
  safe: { flex: 1, justifyContent: 'space-between' },

  fallbackWrap: { flex: 1, backgroundColor: Palette.brand[700], justifyContent: 'center' },
  fallback: { ...Typography.body, color: '#FFFFFF', textAlign: 'center' },

  topInfo: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  modeBadgeText: {
    ...Typography.micro,
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  encrypted: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },

  center: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarHalo: {
    width: 156,
    height: 156,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: Radii.pill,
    backgroundColor: Palette.neutral[200],
  },
  name: {
    ...Typography.h1,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  status: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },

  selfView: {
    position: 'absolute',
    top: 96,
    right: Spacing.lg,
    width: 96,
    height: 132,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  controls: {
    gap: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  callButtonWrap: {
    alignItems: 'center',
    gap: 6,
  },
  callButton: {
    width: 60,
    height: 60,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  callButtonLabel: {
    ...Typography.micro,
    color: 'rgba(255,255,255,0.85)',
  },
  endButton: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: Radii.pill,
    backgroundColor: Colors.light.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  endIcon: {
    transform: [{ rotate: '135deg' }],
  },
});
