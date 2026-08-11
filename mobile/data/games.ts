/**
 * Games that can be played in a room.
 *
 * There used to be seven. Six of them were not games: trivia, dice,
 * would-you-rather, quick draw, emoji race and never-have-I all drew their
 * state from local random calls — `pickTrivia()`, `rollDice()` — so every
 * phone rolled its own dice and showed its own question. Two people "playing
 * together" saw different things and neither could tell.
 *
 * One is left, and it is the one that works: Truth or Dare replays a
 * deterministic event stream carried on the encrypted message channel, so
 * every device derives the same state from the same events. See data/game.ts.
 */

export type GameId = 'truth_or_dare';

export type GameDef = {
  id: GameId;
  icon: string;
  /** i18n key suffix under hangout.game_* */
  nameKey: string;
  hintKey: string;
  color: string;
  maxPlayers: number;
};

export const GAMES: GameDef[] = [
  {
    id: 'truth_or_dare',
    icon: 'dice',
    nameKey: 'game_tod',
    hintKey: 'game_tod_hint',
    color: '#4F46E5',
    // The wheel picks one person per round; more than a dozen and most people
    // are watching rather than playing.
    maxPlayers: 12,
  },
];
