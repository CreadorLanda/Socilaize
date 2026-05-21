import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Dimensions, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette, Radii, Spacing, Typography } from '@/constants/theme';
import { useProfile } from '@/data/profile-store';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

type Surface = 'picker' | 'camera' | 'text' | 'voice' | 'interactive';
type StoryMode = 'video' | 'photo' | 'text' | 'voice' | 'question' | 'poll' | 'challenge' | 'collage';
type Privacy = 'contacts' | 'except' | 'close';

const STATUS_BG = '#11191D';
const CAMERA_BG = '#000000';
const STORY_BLUE = '#213842';
const ACCENTS = ['#213842', '#2D5BFF', '#10B981', '#FF6FB5', '#F59E0B', '#A78BFA'];
const TILE_GAP = 2;
const TILE_SIZE = (Dimensions.get('window').width - TILE_GAP * 2) / 3;

const CAMERA_MODES: StoryMode[] = ['video', 'photo', 'text', 'voice'];
const INTERACTIVE_MODES: StoryMode[] = ['question', 'poll', 'challenge'];
const PICKER_OPTIONS: StoryMode[] = ['text', 'collage', 'voice', 'photo', 'video', 'question', 'poll', 'challenge'];

const MODE_ICONS: Record<StoryMode, keyof typeof Ionicons.glyphMap> = {
  video: 'videocam',
  photo: 'camera',
  text: 'pencil',
  voice: 'mic',
  question: 'help-circle',
  poll: 'stats-chart',
  challenge: 'camera-reverse',
  collage: 'grid',
};

export default function CreateStoryScreen() {
  const profile = useProfile();
  const [surface, setSurface] = useState<Surface>('picker');
  const [mode, setMode] = useState<StoryMode>('photo');
  const [caption, setCaption] = useState('');
  const [accent, setAccent] = useState(STORY_BLUE);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<Privacy>('contacts');
  const [anonymous, setAnonymous] = useState(false);
  const [pollA, setPollA] = useState(t('stories.poll_yes'));
  const [pollB, setPollB] = useState(t('stories.poll_no'));

  const publish = () => {
    Alert.alert(t('stories.sent_notice'), undefined, [{ text: 'OK', onPress: () => router.back() }]);
  };

  const openCamera = (nextMode: StoryMode = 'photo') => {
    setMode(nextMode);
    setSurface('camera');
  };

  const openInteractive = (nextMode: StoryMode) => {
    setMode(nextMode);
    setSurface('interactive');
    setMediaUri(null);
  };

  const pickMedia = async (nextMode: StoryMode = mode) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: nextMode === 'video' ? ['videos'] : ['images'],
      allowsMultipleSelection: nextMode === 'collage',
      selectionLimit: nextMode === 'collage' ? 4 : 1,
      quality: 0.85,
      videoMaxDuration: 30,
    });
    const asset = result.canceled ? undefined : result.assets[0];

    if (asset) {
      setMediaUri(asset.uri);
      openCamera(nextMode === 'video' ? 'video' : 'photo');
    }
  };

  const cyclePrivacy = () =>
    setPrivacy((current) =>
      current === 'contacts' ? 'except' : current === 'except' ? 'close' : 'contacts',
    );

  const privacyLabel =
    privacy === 'contacts'
      ? t('stories.privacy_contacts')
      : privacy === 'except'
        ? t('stories.privacy_except')
        : t('stories.privacy_close');

  if (surface === 'voice') {
    return (
      <VoiceSurface
        profileUri={profile.avatarUri}
        onClose={() => setSurface('picker')}
        onPublish={publish}
      />
    );
  }

  if (surface === 'text') {
    return (
      <TextSurface
        accent={accent}
        caption={caption}
        setAccent={setAccent}
        setCaption={setCaption}
        onInteractive={openInteractive}
        onClose={() => setSurface('picker')}
        onPublish={publish}
      />
    );
  }

  if (surface === 'interactive') {
    return (
      <InteractiveSurface
        mode={mode}
        accent={accent}
        caption={caption}
        anonymous={anonymous}
        pollA={pollA}
        pollB={pollB}
        privacyLabel={privacyLabel}
        setAccent={setAccent}
        setAnonymous={setAnonymous}
        setCaption={setCaption}
        setMode={setMode}
        setPollA={setPollA}
        setPollB={setPollB}
        cyclePrivacy={cyclePrivacy}
        onClose={() => setSurface('picker')}
        onPublish={publish}
      />
    );
  }

  if (surface === 'camera') {
    return (
      <CameraSurface
        mode={mode}
        mediaUri={mediaUri}
        caption={caption}
        setCaption={setCaption}
        setMode={(nextMode) => {
          if (nextMode === 'text') setSurface('text');
          else if (nextMode === 'voice') setSurface('voice');
          else setMode(nextMode);
        }}
        onClose={() => setSurface('picker')}
        onPickMedia={pickMedia}
        onPublish={publish}
      />
    );
  }

  return (
    <SafeAreaView style={styles.pickerSafe} edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View style={styles.sheetHandle} />
      <View style={styles.pickerHeader}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closePlain}>
          <Ionicons name="close" size={28} color="#F4F7F8" />
        </Pressable>
        <Text style={styles.pickerTitle}>{t('stories.add_status')}</Text>
        <View style={styles.closePlain} />
      </View>

      <View style={styles.optionGrid}>
        {PICKER_OPTIONS.map((item) => (
          <ChoiceCard
            key={item}
            icon={MODE_ICONS[item]}
            label={item === 'collage' ? t('stories.layout_mode') : t(`stories.${item}_mode`)}
            onPress={() => {
              if (item === 'text') setSurface('text');
              else if (item === 'voice') setSurface('voice');
              else if (item === 'photo' || item === 'video') pickMedia(item);
              else openInteractive(item);
            }}
          />
        ))}
      </View>
    </SafeAreaView>
  );
}

function ChoiceCard({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.choiceCard, pressed && { opacity: 0.76 }]}>
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

function CameraSurface({
  mode,
  mediaUri,
  caption,
  setCaption,
  setMode,
  onClose,
  onPickMedia,
  onPublish,
}: {
  mode: StoryMode;
  mediaUri: string | null;
  caption: string;
  setCaption: (caption: string) => void;
  setMode: (mode: StoryMode) => void;
  onClose: () => void;
  onPickMedia: (mode: StoryMode) => void;
  onPublish: () => void;
}) {
  return (
    <SafeAreaView style={styles.cameraSafe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      {mediaUri ? <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {mediaUri ? <View style={styles.mediaPreviewScrim} /> : null}
      <View style={styles.cameraTop}>
        <Pressable onPress={onClose} style={styles.roundDarkButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.roundDarkButton}>
          <Ionicons name={mediaUri ? 'color-palette-outline' : 'flash-off-outline'} size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {mediaUri ? (
        <View style={styles.mediaEditBottom}>
          <View style={styles.mediaCaptionPill}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={t('stories.media_caption_placeholder')}
              placeholderTextColor="rgba(255,255,255,0.62)"
              style={styles.captionInput}
            />
          </View>
          <BottomPublishBar onPublish={onPublish} />
        </View>
      ) : (
      <View style={styles.cameraBottom}>
        <View style={styles.shutterRow}>
          <Pressable onPress={() => onPickMedia(mode)} style={styles.sideCameraButton}>
            <Ionicons name="images-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.shutterButton}>
            <View style={styles.shutterInner} />
          </Pressable>
          <Pressable style={styles.sideCameraButton}>
            <Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.cameraModeRow}>
          {CAMERA_MODES.map((item) => {
            const active = mode === item;
            return (
              <Pressable key={item} onPress={() => setMode(item)} style={[styles.cameraMode, active && styles.cameraModeActive]}>
                <Text style={[styles.cameraModeText, active && styles.cameraModeTextActive]}>
                  {t(`stories.${item}_mode`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      )}
    </SafeAreaView>
  );
}

function TextSurface({
  accent,
  caption,
  setAccent,
  setCaption,
  onInteractive,
  onClose,
  onPublish,
}: {
  accent: string;
  caption: string;
  setAccent: (accent: string) => void;
  setCaption: (caption: string) => void;
  onInteractive: (mode: StoryMode) => void;
  onClose: () => void;
  onPublish: () => void;
}) {
  return (
    <SafeAreaView style={[styles.editorSafe, { backgroundColor: accent }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.editorTop}>
        <Pressable onPress={onClose} style={styles.roundDarkButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={() => setAccent(nextAccent(accent))} style={styles.roundDarkButton}>
          <Ionicons name="color-palette-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder={t('stories.caption_placeholder')}
        placeholderTextColor="rgba(255,255,255,0.46)"
        multiline
        maxLength={180}
        textAlign="center"
        style={styles.bigTextInput}
      />
      {caption.trim() ? <BottomPublishBar onPublish={onPublish} /> : <StoryOptionsDock onPick={onInteractive} />}
    </SafeAreaView>
  );
}

function VoiceSurface({
  profileUri,
  onClose,
  onPublish,
}: {
  profileUri: string;
  onClose: () => void;
  onPublish: () => void;
}) {
  return (
    <SafeAreaView style={[styles.editorSafe, { backgroundColor: STORY_BLUE }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.editorTop}>
        <Pressable onPress={onClose} style={styles.roundDarkButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.roundDarkButton}>
          <Ionicons name="color-palette-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.voiceCenter}>
        <View style={styles.voiceBubble}>
          <Image source={{ uri: profileUri }} style={styles.voiceAvatar} contentFit="cover" />
          <Ionicons name="mic" size={32} color="#FFFFFF" style={styles.voiceMiniMic} />
          <View style={styles.waveform}>
            {Array.from({ length: 26 }, (_, index) => (
              <View key={index} style={[styles.waveDot, index < 3 && styles.waveDotActive]} />
            ))}
          </View>
          <Text style={styles.voiceTime}>1:26</Text>
        </View>
      </View>
      <View style={styles.voiceCancel}>
        <Ionicons name="chevron-back" size={32} color="rgba(255,255,255,0.62)" />
        <Text style={styles.voiceCancelText}>{t('stories.slide_cancel')}</Text>
      </View>
      <Pressable onPress={onPublish} style={styles.bigMic}>
        <Ionicons name="mic" size={54} color="#061014" />
      </Pressable>
    </SafeAreaView>
  );
}

function InteractiveSurface({
  mode,
  accent,
  caption,
  anonymous,
  pollA,
  pollB,
  privacyLabel,
  setAccent,
  setAnonymous,
  setCaption,
  setMode,
  setPollA,
  setPollB,
  cyclePrivacy,
  onClose,
  onPublish,
}: {
  mode: StoryMode;
  accent: string;
  caption: string;
  anonymous: boolean;
  pollA: string;
  pollB: string;
  privacyLabel: string;
  setAccent: (accent: string) => void;
  setAnonymous: (value: boolean) => void;
  setCaption: (caption: string) => void;
  setMode: (mode: StoryMode) => void;
  setPollA: (value: string) => void;
  setPollB: (value: string) => void;
  cyclePrivacy: () => void;
  onClose: () => void;
  onPublish: () => void;
}) {
  const prompt = caption.trim() || interactivePlaceholder(mode);

  return (
    <SafeAreaView style={[styles.editorSafe, { backgroundColor: accent }]} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.editorTop}>
        <Pressable onPress={onClose} style={styles.roundDarkButton}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={() => setAccent(nextAccent(accent))} style={styles.roundDarkButton}>
          <Ionicons name="color-palette-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
      <View style={styles.interactiveCenter}>
        {mode === 'poll' ? (
          <View style={styles.pollSticker}>
            <Text style={styles.stickerEyebrow}>{t('stories.poll_mode')}</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={interactivePlaceholder(mode)}
              placeholderTextColor="rgba(17,24,39,0.42)"
              multiline
              style={styles.stickerTitleInput}
            />
            <PollField value={pollA} onChangeText={setPollA} />
            <PollField value={pollB} onChangeText={setPollB} />
          </View>
        ) : mode === 'collage' ? (
          <View style={styles.collageSticker}>
            {[0, 1, 2, 3].map((item) => (
              <View key={item} style={styles.collageSlot}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.questionSticker}>
            <Text style={styles.stickerEyebrow}>
              {mode === 'challenge'
                ? t('stories.challenge_mode')
                : anonymous
                  ? t('stories.anonymous_question')
                  : t('stories.question_mode')}
            </Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder={prompt}
              placeholderTextColor="rgba(17,24,39,0.42)"
              multiline
              style={styles.stickerTitleInput}
            />
            <View style={styles.answerBox}>
              <Text style={styles.answerText}>{t('stories.answer_placeholder')}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.interactiveComposer}>
        {caption.trim() ? (
          <View style={styles.quickTools}>
          <Pressable onPress={() => setAnonymous(!anonymous)} style={styles.darkChip}>
            <Ionicons name="person-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.darkChipText}>{anonymous ? t('stories.anonymous_on') : t('stories.anonymous_off')}</Text>
          </Pressable>
          <Pressable onPress={cyclePrivacy} style={styles.darkChip}>
            <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />
            <Text style={styles.darkChipText}>{privacyLabel}</Text>
          </Pressable>
          </View>
        ) : (
          <StoryOptionsDock active={mode} onPick={setMode} />
        )}
      </View>
      {caption.trim() ? <BottomPublishBar onPublish={onPublish} /> : null}
    </SafeAreaView>
  );
}

function PollField({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.pollField}>
      <TextInput value={value} onChangeText={onChangeText} style={styles.pollInput} maxLength={32} />
      <Ionicons name="checkmark-circle-outline" size={19} color={Palette.brand[500]} />
    </View>
  );
}

function StoryOptionsDock({ active, onPick }: { active?: StoryMode; onPick: (mode: StoryMode) => void }) {
  return (
    <View style={styles.optionsDock}>
      {['collage', ...INTERACTIVE_MODES].map((item) => (
        <Pressable
          key={item}
          onPress={() => onPick(item as StoryMode)}
          style={[styles.optionTool, active === item && styles.optionToolActive]}
        >
          <Ionicons name={MODE_ICONS[item as StoryMode]} size={17} color="#FFFFFF" />
          <Text style={styles.optionToolText}>
            {item === 'collage' ? t('stories.layout_mode') : t(`stories.${item}_mode`)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function BottomPublishBar({ onPublish }: { onPublish: () => void }) {
  const { colors } = useTheme();
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const [visibility, setVisibility] = useState<'contacts' | 'except' | 'close'>('contacts');
  const visibilityLabel =
    visibility === 'contacts'
      ? t('stories.privacy_contacts')
      : visibility === 'except'
        ? t('stories.privacy_except')
        : t('stories.privacy_close');

  return (
    <>
      <View style={styles.publishBar}>
      <Pressable onPress={() => setPrivacySheetOpen(true)} style={styles.publishPrivacy}>
        <Ionicons name="lock-closed-outline" size={16} color="rgba(255,255,255,0.76)" />
        <Text style={styles.publishPrivacyText}>{visibilityLabel}</Text>
        <Ionicons name="chevron-up" size={15} color="rgba(255,255,255,0.62)" />
      </Pressable>
      <Pressable onPress={onPublish} style={[styles.publishButton, { backgroundColor: colors.primary }]}>
        <Ionicons name="send" size={21} color={colors.onPrimary} />
      </Pressable>
      </View>
      <Modal transparent visible={privacySheetOpen} animationType="slide" onRequestClose={() => setPrivacySheetOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPrivacySheetOpen(false)}>
          <Pressable style={styles.privacySheet}>
            <View style={styles.sheetGrip} />
            <Text style={styles.privacySheetTitle}>{t('stories.status_privacy')}</Text>
            {(['contacts', 'except', 'close'] as const).map((item) => {
              const active = visibility === item;
              const label =
                item === 'contacts'
                  ? t('stories.privacy_contacts')
                  : item === 'except'
                    ? t('stories.privacy_except')
                    : t('stories.privacy_close');

              return (
                <Pressable
                  key={item}
                  onPress={() => {
                    setVisibility(item);
                    setPrivacySheetOpen(false);
                  }}
                  style={styles.privacyRow}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? colors.primary : 'rgba(255,255,255,0.62)'}
                  />
                  <Text style={styles.privacyRowText}>{label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function nextAccent(current: string) {
  const index = ACCENTS.indexOf(current);
  return ACCENTS[(index + 1) % ACCENTS.length];
}

function interactivePlaceholder(mode: StoryMode) {
  if (mode === 'poll') return t('stories.poll_placeholder');
  if (mode === 'challenge') return t('stories.challenge_placeholder');
  if (mode === 'collage') return t('stories.collage_placeholder');
  return t('stories.question_placeholder');
}

const styles = StyleSheet.create({
  pickerSafe: {
    flex: 1,
    backgroundColor: STATUS_BG,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.58)',
    marginTop: Spacing.sm,
  },
  pickerHeader: {
    height: 82,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closePlain: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '400',
    color: '#F4F7F8',
  },
  optionGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  choiceCard: {
    width: '47%',
    height: 96,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  choiceLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  interactiveRail: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  interactiveChip: {
    minHeight: 34,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  interactiveChipActive: {
    backgroundColor: 'rgba(45,91,255,0.78)',
  },
  interactiveChipText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  recentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  recentsTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.58)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
    paddingBottom: 120,
  },
  cameraTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: '#071014',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  cameraTileText: {
    fontSize: 17,
    lineHeight: 23,
    color: '#FFFFFF',
  },
  mediaTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    backgroundColor: '#263D46',
    overflow: 'hidden',
  },
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  videoMark: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  videoTime: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  folderFab: {
    position: 'absolute',
    right: Spacing.xxl,
    bottom: Spacing.xxl,
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#19262B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraSafe: {
    flex: 1,
    backgroundColor: CAMERA_BG,
  },
  cameraTop: {
    position: 'absolute',
    top: 54,
    left: Spacing.xl,
    right: Spacing.xl,
    zIndex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roundDarkButton: {
    width: 58,
    height: 58,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(17,25,29,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
  },
  grabber: {
    width: 24,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  thumbnailRail: {
    gap: TILE_GAP,
    paddingHorizontal: 0,
  },
  thumb: {
    width: 112,
    height: 112,
    backgroundColor: '#263D46',
    overflow: 'hidden',
  },
  textThumb: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  textThumbText: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.36)',
  },
  thumbVideo: {
    position: 'absolute',
    left: Spacing.sm,
    bottom: Spacing.sm,
  },
  shutterRow: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideCameraButton: {
    width: 62,
    height: 62,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(17,25,29,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    width: 88,
    height: 88,
    borderRadius: Radii.pill,
    borderWidth: 6,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: Radii.pill,
    backgroundColor: '#FFFFFF',
  },
  cameraModeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cameraMode: {
    minWidth: 72,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  cameraModeActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  cameraModeText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraModeTextActive: {
    color: '#FFFFFF',
  },
  editorSafe: {
    flex: 1,
  },
  editorTop: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bigTextInput: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    fontSize: 26,
    lineHeight: 34,
    color: '#FFFFFF',
    textAlignVertical: 'center',
  },
  publishBar: {
    minHeight: 74,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  publishPrivacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  publishPrivacyText: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.76)',
  },
  publishButton: {
    width: 50,
    height: 50,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  voiceBubble: {
    width: '100%',
    minHeight: 96,
    borderRadius: 24,
    backgroundColor: '#192930',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  voiceAvatar: {
    width: 64,
    height: 64,
    borderRadius: Radii.pill,
  },
  voiceMiniMic: {
    marginLeft: -16,
    marginTop: 28,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.lg,
  },
  waveDot: {
    width: 5,
    height: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  waveDotActive: {
    height: 16,
    backgroundColor: '#FFFFFF',
  },
  voiceTime: {
    fontSize: 24,
    lineHeight: 32,
    color: '#FFFFFF',
  },
  voiceCancel: {
    height: 104,
    backgroundColor: 'rgba(0,0,0,0.52)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  voiceCancelText: {
    fontSize: 24,
    lineHeight: 32,
    color: 'rgba(255,255,255,0.62)',
  },
  bigMic: {
    position: 'absolute',
    right: -20,
    bottom: 42,
    width: 132,
    height: 132,
    borderRadius: Radii.pill,
    backgroundColor: '#F3F5F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactiveCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  questionSticker: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  pollSticker: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  stickerEyebrow: {
    ...Typography.micro,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stickerTitle: {
    ...Typography.h3,
    color: '#111827',
  },
  answerBox: {
    minHeight: 50,
    borderRadius: Radii.lg,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    ...Typography.bodyStrong,
    color: Palette.brand[500],
  },
  pollField: {
    minHeight: 48,
    borderRadius: Radii.lg,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pollInput: {
    ...Typography.bodyStrong,
    flex: 1,
    color: '#111827',
  },
  collageSticker: {
    width: '100%',
    aspectRatio: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  collageSlot: {
    width: '48%',
    height: '48%',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interactiveComposer: {
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  quickTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  darkChip: {
    minHeight: 36,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  darkChipText: {
    ...Typography.micro,
    color: '#FFFFFF',
  },
  captionPill: {
    marginHorizontal: Spacing.xl,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  captionInput: {
    ...Typography.body,
    color: '#FFFFFF',
  },
  mediaPreviewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  mediaEditBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  mediaCaptionPill: {
    minHeight: 46,
    marginHorizontal: Spacing.lg,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(0,0,0,0.46)',
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
  optionsDock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  optionTool: {
    minHeight: 38,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  optionToolActive: {
    backgroundColor: 'rgba(45,91,255,0.78)',
  },
  optionToolText: {
    ...Typography.micro,
    color: '#FFFFFF',
  },
  stickerTitleInput: {
    ...Typography.h3,
    color: '#111827',
    paddingVertical: 0,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  privacySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#11191D',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sheetGrip: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: Radii.pill,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginBottom: Spacing.lg,
  },
  privacySheetTitle: {
    ...Typography.h3,
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  privacyRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  privacyRowText: {
    ...Typography.bodyStrong,
    color: '#FFFFFF',
  },
});
