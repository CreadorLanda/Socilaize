import { expect, test } from 'bun:test';

/**
 * The release build skips a lint task that fails inside a dependency.
 *
 * `lintVitalAnalyzeRelease` failed in `livekit_react-native-webrtc` — someone
 * else's module, with nothing in this project to fix — twenty-three minutes
 * into the build. The exclusion is easy to lose in a merge, and losing it costs
 * another twenty-three minutes to rediscover.
 */
const eas = JSON.parse(await Bun.file('eas.json').text());

test('os perfis de lancamento saltam o lint que falha numa dependencia', () => {
  for (const name of ['preview', 'production']) {
    const cmd = eas.build[name]?.android?.gradleCommand ?? '';
    expect(cmd, `perfil ${name}`).toContain('-x lintVitalAnalyzeRelease');
    expect(cmd, `perfil ${name}`).toContain('-x lintVitalRelease');
  }
});

test('cada perfil compila o formato que diz compilar', () => {
  // apk instala-se directamente; aab e para a Play Store e nao se instala.
  expect(eas.build.preview.android.buildType).toBe('apk');
  expect(eas.build.preview.android.gradleCommand).toContain('assembleRelease');
  expect(eas.build.production.android.gradleCommand).toContain('bundleRelease');
});

test('os perfis de lancamento apontam para producao', () => {
  for (const name of ['preview', 'production']) {
    expect(eas.build[name].env.EXPO_PUBLIC_API_URL).toBe('https://yo.alexandrelanda.com');
  }
});
