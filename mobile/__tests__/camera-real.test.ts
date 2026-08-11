import { expect, test } from 'bun:test';

/**
 * The camera was a drawing.
 *
 * `cameraFeed` was a dark rectangle with a grain overlay and an icon in the
 * middle; pressing the shutter handed off to the system camera app. So nothing
 * you saw before pressing came from a lens, and flipping the lens did nothing
 * at all for video — launchCameraAsync was called without cameraType on that
 * path.
 */
const screen = await Bun.file('app/story/create.tsx').text();

test('o visor mostra a camara, nao um retangulo', () => {
  expect(screen).toContain('<CameraView');
  expect(screen).toContain('facing={frontCamera');
});

test('a captura vem da camara, nao da app do sistema', () => {
  // The library picker stays — choosing an existing photo is a real thing.
  // What must not come back is capture-by-handoff. Matched as a call rather
  // than as a word, so the comment explaining the old behaviour can stay.
  expect(screen).not.toContain('ImagePicker.launchCameraAsync(');
  expect(screen).toContain('cameraRef.current');
  expect(screen).toContain('takePictureAsync');
  expect(screen).toContain('recordAsync');
});

test('virar a lente vale tambem para video', () => {
  // One `facing` prop drives both modes, so the two cannot disagree the way
  // two separate call sites did.
  const facings = screen.match(/facing=\{/g) ?? [];
  expect(facings).toHaveLength(1);
});

test('o flash deixou de ser um icone que so muda de forma', () => {
  expect(screen).toContain('flash={flash');
});

test('as duracoes dos modos sao nomeadas uma vez', () => {
  // They appeared twice each — once to cap the recording, once to drive the
  // progress ring — and two literals that must agree is one that will not.
  expect(screen).toContain('const BOOMERANG_SECONDS');
  expect(screen).toContain('const HANDSFREE_SECONDS');
  expect(screen).not.toMatch(/videoMaxDuration:.*\?\s*3\s*:\s*15/);
});

test('a camara e declarada nas permissoes da build', async () => {
  const app = JSON.parse(await Bun.file('app.json').text());
  const plugins: unknown[] = app.expo.plugins;
  const cam = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-camera');
  expect(cam, 'expo-camera nao esta nos plugins — a build nativa nao o inclui').toBeDefined();
});

/**
 * The transition turned the whole screen, chrome and all.
 */
test('so a media roda; o cromado fica quieto', async () => {
  const viewer = await Bun.file('app/story/[id].tsx').text();
  const open = viewer.indexOf('<SlideSwap');
  const close = viewer.indexOf('</SlideSwap>');
  expect(open).toBeGreaterThan(-1);
  const inside = viewer.slice(open, close);
  expect(inside).not.toContain('styles.progressRow');
  expect(inside).not.toContain('styles.header');
});

test('da para passar de story com o dedo', async () => {
  const viewer = await Bun.file('app/story/[id].tsx').text();
  expect(viewer).toContain('Gesture.Pan()');
  // The hold-to-pause must survive: a swipe that ate it would cost a feature
  // to add one.
  expect(viewer).toContain('Gesture.LongPress()');
  expect(viewer).toContain('Gesture.Race(');
});
