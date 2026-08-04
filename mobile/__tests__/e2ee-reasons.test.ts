import { expect, test } from 'bun:test';

/**
 * Every refusal reason must have text in every language.
 *
 * The dialog key is built by interpolation — `chat.e2ee_blocked_${reason}` —
 * so a reason without a string does not fail to compile. It shows the raw key
 * to the person whose message was not sent.
 */
async function reasons(): Promise<string[]> {
  const src = await Bun.file('data/crypto/session.ts').text();
  const block = src.slice(src.indexOf('readonly reason:'), src.indexOf("| 'failed',") + 12);
  return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const LOCALES = ['en', 'pt'];

test('cada razao tem texto nos dois idiomas', async () => {
  const missing: string[] = [];
  const all = await reasons();
  expect(all.length).toBeGreaterThan(3);

  for (const loc of LOCALES) {
    const l = await Bun.file(`i18n/locales/${loc}.ts`).text();
    for (const r of all) {
      if (!new RegExp(`\\be2ee_blocked_${r}:`).test(l)) missing.push(`${loc}.e2ee_blocked_${r}`);
    }
  }
  expect(missing).toEqual([]);
});

test('nao ha textos orfaos que nenhuma razao alcanca', async () => {
  const orphans: string[] = [];
  const all = await reasons();

  for (const loc of LOCALES) {
    const l = await Bun.file(`i18n/locales/${loc}.ts`).text();
    for (const m of l.matchAll(/e2ee_blocked_([a-z_]+):/g)) {
      if (m[1] !== 'title' && !all.includes(m[1])) orphans.push(`${loc}.e2ee_blocked_${m[1]}`);
    }
  }
  expect(orphans).toEqual([]);
});
