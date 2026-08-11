import { expect, test } from 'bun:test';
import { GAMES } from '../data/games';
import { replayGame, sortedMemberIds, type GameMessagePayload } from '../data/game';

/**
 * Only games that actually work belong in the catalogue.
 *
 * There were seven. Six drew their state from local random calls, so every
 * phone rolled its own dice and picked its own question — two people "playing
 * together" saw different games and neither could tell. That is worse than
 * having one game.
 */
test('o catalogo tem apenas jogos sincronizados', () => {
  expect(GAMES).toHaveLength(1);
  expect(GAMES[0].id).toBe('truth_or_dare');
});

test('nada no catalogo depende de sorteio local', async () => {
  const src = await Bun.file('data/games.ts').text();
  for (const fake of ['pickTrivia', 'rollDice', 'pickWyr', 'pickNhie']) {
    expect(src, `${fake} ainda existe`).not.toContain(`export function ${fake}`);
  }
});

/**
 * The room is gone entirely, which is stronger than it not drawing a game.
 *
 * It never carried a byte of audio: a grid filled from bundled sample chats, a
 * 900 ms fake connect, and mute/camera buttons that toggled a colour. Voice and
 * video now open the call screen, and live opens a broadcast.
 */
test('a sala simulada nao voltou', async () => {
  expect(await Bun.file('app/hangout/[id].tsx').exists()).toBe(false);
});

test('nada aponta para a sala simulada', async () => {
  const linked: string[] = [];
  const glob = new Bun.Glob('{app,components}/**/*.tsx');
  for await (const file of glob.scan('.')) {
    if ((await Bun.file(file).text()).includes('/hangout/')) linked.push(file);
  }
  expect(linked).toEqual([]);
});

/**
 * The engine with two players.
 *
 * Truth or Dare was only ever reachable from a group, so the two-player case
 * had never run. A pair is the commonest chat there is.
 */
test('dois jogadores jogam, e ambos os telemoveis veem o mesmo jogo', () => {
  const ids = sortedMemberIds(['b-user', 'a-user']);
  const start: GameMessagePayload = {
    kind: 'game', game: 'truth-or-dare', action: 'start', seed: 'seed-xyz', maxRounds: 3,
  };

  const mine = replayGame([start], ids);
  // The same stream, replayed on the other phone, is the same game.
  const theirs = replayGame([start], sortedMemberIds(['a-user', 'b-user']));
  expect(theirs.currentPlayerId).toBe(mine.currentPlayerId!);

  expect(mine.active).toBe(true);
  expect(ids).toContain(mine.currentPlayerId!);

  // The turn moves to the other player rather than sticking.
  const after = replayGame(
    [
      start,
      { kind: 'game', game: 'truth-or-dare', action: 'choose', playerId: mine.currentPlayerId!, choice: 'truth' },
      { kind: 'game', game: 'truth-or-dare', action: 'challenge', playerId: mine.currentPlayerId!, text: 'Worst haircut?' },
      { kind: 'game', game: 'truth-or-dare', action: 'done', playerId: mine.currentPlayerId! },
    ],
    ids,
  );
  expect(after.round).toBe(2);
  expect(after.doneIds).toContain(mine.currentPlayerId!);
});
