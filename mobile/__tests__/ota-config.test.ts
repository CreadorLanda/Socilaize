import { expect, test } from 'bun:test';

/**
 * OTA is configured at build time and fails silently when it is not.
 *
 * The url was lost once already — removed while stripping the old account's
 * identity, and `eas init` did not put it back. The APK built in between
 * cannot check for updates at all, and nothing about it looks wrong: it just
 * never updates.
 */
const app = JSON.parse(await Bun.file('app.json').text()).expo;

test('a app sabe onde procurar atualizacoes', () => {
  expect(app.updates?.url).toBeString();
  expect(app.updates.url).toStartWith('https://u.expo.dev/');
});

test('o url aponta para este projeto, nao para outro', () => {
  const projectId = app.extra?.eas?.projectId;
  expect(projectId).toBeString();
  // Um url a apontar para o projeto errado busca atualizações de outra app.
  expect(app.updates.url).toBe(`https://u.expo.dev/${projectId}`);
});

test('o canal de cada perfil esta definido', async () => {
  const eas = JSON.parse(await Bun.file('eas.json').text());
  for (const [name, profile] of Object.entries<Record<string, unknown>>(eas.build)) {
    // Sem canal, um build não sabe que ramo de atualizações seguir.
    expect(profile.channel, `perfil ${name} sem canal`).toBeString();
  }
});

test('runtimeVersion existe — sem ele nenhuma atualizacao e considerada compativel', () => {
  expect(app.runtimeVersion).toBeDefined();
});
