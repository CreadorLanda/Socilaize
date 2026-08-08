import { expect, test } from 'bun:test';
import { nextPlayer, pickPlayer, replayGame, type GameMessagePayload } from '@/data/game';

const MEMBERS = ['u-alice', 'u-bob', 'u-carol'].sort();
const START: GameMessagePayload = {
  kind: 'game', game: 'truth-or-dare', action: 'start', seed: 'seed-abc', maxRounds: 5,
};
const done = (playerId: string): GameMessagePayload => ({
  kind: 'game', game: 'truth-or-dare', action: 'done', playerId,
});

/**
 * The room only shows the "done" button to whoever's turn it is, so a real
 * session emits exactly one done per round. The engine used to wait for one
 * from every member, which no session could produce: the first player
 * finished and the game stopped there.
 */
test('a ronda avanca com o done de quem esta na vez', () => {
  const p1 = MEMBERS[pickPlayer(START.seed, 1, MEMBERS)];
  const s = replayGame([START, done(p1)], MEMBERS);

  expect(s.round).toBe(2);
  expect(s.currentPlayerId).not.toBe(p1);
  expect(s.currentPlayerId).not.toBeNull();
});

test('um jogo inteiro percorre as cinco rondas ate ao vencedor', () => {
  const events: GameMessagePayload[] = [START];
  let s = replayGame(events, MEMBERS);
  const seen: string[] = [];

  for (let i = 0; i < 5; i++) {
    expect(s.ended).toBe(false);
    expect(s.currentPlayerId).not.toBeNull();
    seen.push(s.currentPlayerId!);
    events.push(done(s.currentPlayerId!));
    s = replayGame(events, MEMBERS);
  }

  expect(s.ended).toBe(true);
  expect(s.winnerId).not.toBeNull();
  // Nobody goes twice in a row — a wheel that repeats reads as broken.
  for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
});

test('tocar duas vezes no botao nao da dois pontos', () => {
  const p1 = MEMBERS[pickPlayer(START.seed, 1, MEMBERS)];
  const s = replayGame([START, done(p1), done(p1), done(p1)], MEMBERS);
  expect(s.scoreboard[p1]).toBe(1);
  expect(s.round).toBe(2);
});

test('um done de quem nao esta na vez e ignorado', () => {
  const p1 = MEMBERS[pickPlayer(START.seed, 1, MEMBERS)];
  const outro = MEMBERS.find((m) => m !== p1)!;
  const s = replayGame([START, done(outro)], MEMBERS);
  expect(s.round).toBe(1);
  expect(s.currentPlayerId).toBe(p1);
  expect(s.scoreboard[outro]).toBeUndefined();
});

test('quem volta a ser sorteado mais tarde pontua de novo', () => {
  // Two members, so the wheel alternates and comes back round.
  const two = ['u-a', 'u-b'];
  const events: GameMessagePayload[] = [START];
  let s = replayGame(events, two);
  for (let i = 0; i < 4; i++) {
    events.push(done(s.currentPlayerId!));
    s = replayGame(events, two);
  }
  const total = Object.values(s.scoreboard).reduce((a, b) => a + b, 0);
  expect(total).toBe(4);
});

test('nextPlayer nunca repete o anterior quando ha alternativa', () => {
  for (let r = 1; r < 40; r++) {
    const prev = MEMBERS[pickPlayer(START.seed, r, MEMBERS)];
    const idx = nextPlayer(START.seed, r, MEMBERS, prev);
    expect(MEMBERS[idx]).not.toBe(prev);
  }
  // With one member there is no alternative, and it must not loop forever.
  expect(nextPlayer(START.seed, 1, ['solo'], 'solo')).toBe(0);
});
