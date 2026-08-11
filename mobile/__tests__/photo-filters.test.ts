import { expect, test } from 'bun:test';

import { FILTERS, filterById, IDENTITY_MATRIX } from '../data/photo-filters';

/**
 * The matrices are the contract between three places — the viewfinder, the
 * thumbnail strip and the bake that writes the file. If they can be malformed,
 * the filter you picked is not the filter you get.
 */
test('toda a matriz e 4x5', () => {
  for (const f of FILTERS) {
    if (f.matrix === null) continue;
    expect(f.matrix, `${f.id} nao tem 20 valores`).toHaveLength(20);
  }
});

test('nenhum filtro mexe na transparencia', () => {
  // The alpha row must be (0,0,0,1,0). A filter that changes transparency is
  // not a filter, it is a bug that looks like one.
  for (const f of FILTERS) {
    if (f.matrix === null) continue;
    expect(f.matrix.slice(15), `${f.id} mexe no alfa`).toEqual([0, 0, 0, 1, 0]);
  }
});

test('o branco continua branco e o preto continua preto onde deve', () => {
  // A neutral filter must not blow out white or crush black off the end.
  // Sampled rather than reasoned about: each channel of pure white and pure
  // black, run through the matrix.
  const apply = (m: number[], rgb: [number, number, number]) =>
    [0, 1, 2].map((row) => {
      const o = row * 5;
      return m[o] * rgb[0] + m[o + 1] * rgb[1] + m[o + 2] * rgb[2] + m[o + 4];
    });

  for (const f of FILTERS) {
    if (f.matrix === null) continue;
    for (const out of apply(f.matrix, [1, 1, 1])) {
      expect(out, `${f.id}: branco vai parar a ${out}`).toBeLessThanOrEqual(1.35);
    }
    for (const out of apply(f.matrix, [0, 0, 0])) {
      expect(out, `${f.id}: preto vai parar a ${out}`).toBeGreaterThanOrEqual(-0.2);
      expect(out).toBeLessThanOrEqual(0.2);
    }
  }
});

test('os monocromaticos dao mesmo cinzento', () => {
  // Equal output on all three rows for any input, which is what "grey" means.
  for (const id of ['mono', 'noir'] as const) {
    const m = filterById(id).matrix!;
    const rows = [0, 5, 10].map((o) => m.slice(o, o + 3).join(','));
    expect(new Set(rows).size, `${id} nao produz cinzento neutro`).toBe(1);
  }
});

test('o peso do verde domina, como no olho', () => {
  // An even third each makes a grey too dark where the picture was green.
  const m = filterById('mono').matrix!;
  expect(m[1]).toBeGreaterThan(m[0]);
  expect(m[0]).toBeGreaterThan(m[2]);
});

test('none nao traz matriz, para se poder saltar o passo todo', () => {
  expect(filterById('none').matrix).toBeNull();
  expect(IDENTITY_MATRIX).toHaveLength(20);
});

test('nenhum id repetido', () => {
  expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
});

test('um id desconhecido cai no none em vez de rebentar', () => {
  expect(filterById('nao-existe' as never).id).toBe('none');
});
