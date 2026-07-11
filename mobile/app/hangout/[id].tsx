import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
// StyleSheet used throughout
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radii, Spacing, Typography } from '@/constants/theme';
import {
  GAMES,
  pickNhie,
  pickTrivia,
  pickWyr,
  rollDice,
  type GameId,
} from '@/data/games';
import { CHATS } from '@/data/mock';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Mode = 'voice' | 'video' | 'live';
type Phase = 'lobby' | 'in_room';

const { width: W } = Dimensions.get('window');

/** Mock roommates for the hangout grid. */
function roomPeers(chatId: string, name: string, avatar: string) {
  const extras = CHATS.filter((c) => c.id !== chatId && !c.isAI).slice(0, 3);
  return [
    { id: 'me', name: t('hangout.you'), avatarUri: avatar, isMe: true, speaking: true },
    { id: chatId, name, avatarUri: avatar, isMe: false, speaking: false },
    ...extras.map((c, i) => ({
      id: c.id,
      name: c.name,
      avatarUri: c.avatarUri,
      isMe: false,
      speaking: i === 0,
    })),
  ];
}

export default function HangoutScreen() {
  const { id, mode: modeParam, game: gameParam } = useLocalSearchParams<{
    id: string;
    mode?: string;
    game?: string;
  }>();
  const chat = useMemo(() => CHATS.find((c) => c.id === id), [id]);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const initialMode: Mode =
    modeParam === 'video' ? 'video' : modeParam === 'live' ? 'live' : 'voice';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(mode === 'voice');
  const [activeGame, setActiveGame] = useState<GameId | null>(
    (gameParam as GameId) || null,
  );
  const [gamePanel, setGamePanel] = useState(!!gameParam);
  const [roundKey, setRoundKey] = useState(0);

  // Game round state
  const [dice, setDice] = useState<[number, number]>([3, 4]);
  const [trivia, setTrivia] = useState(pickTrivia());
  const [wyr, setWyr] = useState(pickWyr());
  const [nhie, setNhie] = useState(pickNhie());
  const [wyrPick, setWyrPick] = useState<0 | 1 | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const peers = useMemo(
    () =>
      chat
        ? roomPeers(chat.id, chat.name, chat.avatarUri)
        : [],
    [chat],
  );

  useEffect(() => {
    if (phase === 'lobby') {
      const t = setTimeout(() => setPhase('in_room'), 900);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (!chat) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={{ color: '#fff' }}>{t('chat.not_found')}</Text>
      </SafeAreaView>
    );
  }

  const startGame = (gid: GameId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveGame(gid);
    setGamePanel(true);
    setRoundKey((k) => k + 1);
    setShowAnswer(false);
    setWyrPick(null);
    if (gid === 'dice') setDice(rollDice());
    if (gid === 'trivia') setTrivia(pickTrivia());
    if (gid === 'would_you_rather') setWyr(pickWyr());
    if (gid === 'never_have_i') setNhie(pickNhie());
  };

  const nextRound = () => {
    if (!activeGame) return;
    startGame(activeGame);
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
  };

  const isLive = mode === 'live';
  const isVideo = mode === 'video' && !camOff;

  return (
    <View style={[styles.root, isLive && styles.rootLive]}>
      <StatusBar style="light" />

      {/* Ambient bg */}
      {isVideo || isLive ? (
        <Image
          source={{ uri: chat.avatarUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={isLive ? 18 : 8}
        />
      ) : (
        <View style={styles.voiceBg} />
      )}
      <View style={styles.scrim} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={leave} style={styles.roundBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </Pressable>
          <View style={styles.topCenter}>
            {isLive ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>{t('hangout.live')}</Text>
              </View>
            ) : (
              <View style={styles.roomPill}>
                <Ionicons name="home" size={12} color="#FFF" />
                <Text style={styles.roomPillText}>{t('hangout.room')}</Text>
              </View>
            )}
            <Text style={styles.roomTitle} numberOfLines={1}>
              {chat.name}
            </Text>
            <Text style={styles.roomMeta}>
              {phase === 'lobby'
                ? t('hangout.joining')
                : t('hangout.people', { count: peers.length })}
            </Text>
          </View>
          <Pressable
            onPress={() => setGamePanel((v) => !v)}
            style={[styles.roundBtn, gamePanel && styles.roundBtnActive]}
          >
            <Ionicons name="game-controller" size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* Peer grid */}
        <View style={styles.grid}>
          {peers.map((p, i) => (
            <Animated.View
              key={p.id}
              entering={ZoomIn.delay(i * 60).springify()}
              style={[
                styles.peerTile,
                {
                  width: peers.length <= 2 ? W - 48 : (W - 56) / 2,
                  height: peers.length <= 2 ? 220 : 150,
                },
                p.speaking && styles.peerSpeaking,
              ]}
            >
              <Image source={{ uri: p.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.peerScrim} />
              {p.speaking ? (
                <View style={styles.speakBars}>
                  <View style={[styles.bar, { height: 8 }]} />
                  <View style={[styles.bar, { height: 14 }]} />
                  <View style={[styles.bar, { height: 10 }]} />
                </View>
              ) : null}
              <View style={styles.peerLabel}>
                <Text style={styles.peerName} numberOfLines={1}>
                  {p.isMe ? t('hangout.you') : p.name}
                </Text>
                {p.isMe && muted ? (
                  <Ionicons name="mic-off" size={12} color="#FCA5A5" />
                ) : null}
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Active game board */}
        {activeGame && gamePanel ? (
          <Animated.View entering={FadeInDown.springify()} style={styles.gameBoard}>
            <View style={styles.gameBoardHead}>
              <Text style={styles.gameBoardTitle}>
                {t(`hangout.${GAMES.find((g) => g.id === activeGame)?.nameKey}`)}
              </Text>
              <Pressable onPress={() => setActiveGame(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
            <GameRound
              key={roundKey}
              game={activeGame}
              dice={dice}
              trivia={trivia}
              wyr={wyr}
              nhie={nhie}
              wyrPick={wyrPick}
              showAnswer={showAnswer}
              onWyr={(i) => setWyrPick(i)}
              onReveal={() => setShowAnswer(true)}
              onRoll={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setDice(rollDice());
              }}
            />
            <Pressable onPress={nextRound} style={styles.nextRound}>
              <Text style={styles.nextRoundText}>{t('hangout.next_round')}</Text>
              <Ionicons name="refresh" size={16} color="#FFF" />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Games tray */}
        {gamePanel && !activeGame ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.gamesTray}>
            <Text style={styles.gamesTrayTitle}>{t('hangout.pick_game')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gamesRow}
            >
              {GAMES.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => startGame(g.id)}
                  style={[styles.gameCard, { borderColor: g.color }]}
                >
                  <View style={[styles.gameIcon, { backgroundColor: g.color }]}>
                    <Ionicons
                      name={g.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color="#FFF"
                    />
                  </View>
                  <Text style={styles.gameName} numberOfLines={1}>
                    {t(`hangout.${g.nameKey}`)}
                  </Text>
                  <Text style={styles.gameHint} numberOfLines={2}>
                    {t(`hangout.${g.hintKey}`)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}
      </SafeAreaView>

      {/* Bottom controls — Houseparty / TikTok hybrid */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.modeRow}>
          {(
            [
              ['voice', 'mic', t('hangout.mode_voice')],
              ['video', 'videocam', t('hangout.mode_video')],
              ['live', 'radio', t('hangout.mode_live')],
            ] as const
          ).map(([m, icon, label]) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  setMode(m);
                  if (m === 'voice') setCamOff(true);
                  if (m === 'video') setCamOff(false);
                }}
                style={[styles.modeChip, active && styles.modeChipOn]}
              >
                <Ionicons name={icon} size={14} color="#FFF" />
                <Text style={styles.modeChipText}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.ctrlRow}>
          <Ctrl
            icon={muted ? 'mic-off' : 'mic'}
            label={muted ? t('hangout.unmute') : t('hangout.mute')}
            danger={muted}
            onPress={() => setMuted((v) => !v)}
          />
          <Ctrl
            icon={camOff ? 'videocam-off' : 'videocam'}
            label={camOff ? t('hangout.cam_on') : t('hangout.cam_off')}
            onPress={() => {
              setCamOff((v) => !v);
              if (mode === 'voice') setMode('video');
            }}
          />
          <Ctrl
            icon="game-controller"
            label={t('hangout.games')}
            active={gamePanel}
            onPress={() => setGamePanel((v) => !v)}
          />
          <Ctrl
            icon="hand-left"
            label={t('hangout.react')}
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
          <Pressable onPress={leave} style={styles.endBtn}>
            <Ionicons name="call" size={22} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Ctrl({
  icon,
  label,
  onPress,
  danger,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ctrl}>
      <View
        style={[
          styles.ctrlCircle,
          danger && { backgroundColor: 'rgba(239,68,68,0.85)' },
          active && { backgroundColor: 'rgba(45,91,255,0.9)' },
        ]}
      >
        <Ionicons name={icon} size={20} color="#FFF" />
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );
}

function GameRound({
  game,
  dice,
  trivia,
  wyr,
  nhie,
  wyrPick,
  showAnswer,
  onWyr,
  onReveal,
  onRoll,
}: {
  game: GameId;
  dice: [number, number];
  trivia: { q: string; a: string };
  wyr: [string, string];
  nhie: string;
  wyrPick: 0 | 1 | null;
  showAnswer: boolean;
  onWyr: (i: 0 | 1) => void;
  onReveal: () => void;
  onRoll: () => void;
}) {
  if (game === 'dice') {
    return (
      <View style={styles.roundBody}>
        <View style={styles.diceRow}>
          <DiceFace n={dice[0]} />
          <DiceFace n={dice[1]} />
        </View>
        <Text style={styles.roundResult}>
          {t('hangout.dice_total', { n: dice[0] + dice[1] })}
        </Text>
        <Pressable onPress={onRoll} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>{t('hangout.roll_again')}</Text>
        </Pressable>
      </View>
    );
  }

  if (game === 'trivia') {
    return (
      <View style={styles.roundBody}>
        <Text style={styles.prompt}>{trivia.q}</Text>
        {showAnswer ? (
          <Text style={styles.answer}>{trivia.a}</Text>
        ) : (
          <Pressable onPress={onReveal} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('hangout.reveal')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (game === 'would_you_rather') {
    return (
      <View style={styles.roundBody}>
        <Text style={styles.promptSm}>{t('hangout.wyr_prompt')}</Text>
        <View style={styles.wyrRow}>
          {([0, 1] as const).map((i) => (
            <Pressable
              key={i}
              onPress={() => onWyr(i)}
              style={[
                styles.wyrCard,
                wyrPick === i && styles.wyrCardOn,
              ]}
            >
              <Text style={styles.wyrText}>{wyr[i]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (game === 'never_have_i') {
    return (
      <View style={styles.roundBody}>
        <Text style={styles.prompt}>{nhie}</Text>
        <View style={styles.wyrRow}>
          <Pressable style={styles.wyrCard} onPress={() => Haptics.selectionAsync()}>
            <Text style={styles.wyrText}>{t('hangout.i_have')}</Text>
          </Pressable>
          <Pressable style={styles.wyrCard} onPress={() => Haptics.selectionAsync()}>
            <Text style={styles.wyrText}>{t('hangout.never')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Generic placeholder for draw / emoji race / two truths
  return (
    <View style={styles.roundBody}>
      <Text style={styles.prompt}>{t('hangout.game_ready')}</Text>
      <Text style={styles.promptSm}>{t('hangout.game_ready_hint')}</Text>
    </View>
  );
}

function DiceFace({ n }: { n: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(
      withSpring(1.15, { damping: 8 }),
      withSpring(1, { damping: 12 }),
    );
  }, [n, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.dice, style]}>
      <Text style={styles.diceN}>{n}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0C10' },
  rootLive: { backgroundColor: '#1a0a0c' },
  voiceBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#12141C' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  fallback: { flex: 1, backgroundColor: '#0B0C10', alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnActive: { backgroundColor: 'rgba(45,91,255,0.85)' },
  topCenter: { flex: 1, alignItems: 'center', gap: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: '#EF4444',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { ...Typography.micro, color: '#FFF', fontWeight: '800', letterSpacing: 0.8 },
  roomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  roomPillText: { ...Typography.micro, color: '#FFF', fontWeight: '700' },
  roomTitle: { ...Typography.bodyStrong, color: '#FFF' },
  roomMeta: { ...Typography.micro, color: 'rgba(255,255,255,0.65)' },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.lg,
    alignContent: 'center',
    justifyContent: 'center',
  },
  peerTile: {
    borderRadius: Radii.xl,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  peerSpeaking: { borderColor: '#4ADE80' },
  peerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  speakBars: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 16,
  },
  bar: { width: 3, borderRadius: 2, backgroundColor: '#4ADE80' },
  peerLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  peerName: { ...Typography.caption, color: '#FFF', fontWeight: '700', flex: 1 },
  gameBoard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.xl,
    backgroundColor: 'rgba(0,0,0,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: Spacing.sm,
  },
  gameBoardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameBoardTitle: { ...Typography.bodyStrong, color: '#FFF' },
  roundBody: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  diceRow: { flexDirection: 'row', gap: Spacing.md },
  dice: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diceN: { fontSize: 28, fontWeight: '800', color: '#111' },
  roundResult: { ...Typography.h3, color: '#FFF' },
  prompt: { ...Typography.h3, color: '#FFF', textAlign: 'center', fontSize: 18 },
  promptSm: { ...Typography.caption, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  answer: { ...Typography.bodyStrong, color: '#4ADE80', textAlign: 'center' },
  secondaryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  secondaryBtnText: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
  wyrRow: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  wyrCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  wyrCardOn: { borderColor: '#6F8BFF', backgroundColor: 'rgba(45,91,255,0.35)' },
  wyrText: { ...Typography.caption, color: '#FFF', fontWeight: '700', textAlign: 'center' },
  nextRound: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  nextRoundText: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  gamesTray: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  gamesTrayTitle: {
    ...Typography.micro,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  gamesRow: { gap: Spacing.sm },
  gameCard: {
    width: 120,
    padding: Spacing.sm,
    borderRadius: Radii.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1.5,
    gap: 6,
  },
  gameIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameName: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
  gameHint: { ...Typography.micro, color: 'rgba(255,255,255,0.55)', lineHeight: 14 },
  controls: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingTop: Spacing.sm,
  },
  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modeChipOn: { backgroundColor: 'rgba(45,91,255,0.85)' },
  modeChipText: { ...Typography.micro, color: '#FFF', fontWeight: '700' },
  ctrlRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  ctrl: { alignItems: 'center', gap: 4, width: 58 },
  ctrlCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlLabel: { ...Typography.micro, color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  endBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
});
