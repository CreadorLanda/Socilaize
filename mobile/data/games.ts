/**
 * Houseparty-style mini-games catalog.
 * Used in hangout rooms (1:1 + groups) and channel game posts.
 */

export type GameId =
  | 'trivia'
  | 'dice'
  | 'would_you_rather'
  | 'quick_draw'
  | 'emoji_race'
  | 'never_have_i'
  | 'two_truths';

export type GameDef = {
  id: GameId;
  icon: string;
  /** i18n key suffix under hangout.game_* */
  nameKey: string;
  hintKey: string;
  color: string;
  /** Max players for the round UI (display only for now). */
  maxPlayers: number;
};

export const GAMES: GameDef[] = [
  {
    id: 'trivia',
    icon: 'help-circle',
    nameKey: 'game_trivia',
    hintKey: 'game_trivia_hint',
    color: '#8B5CF6',
    maxPlayers: 8,
  },
  {
    id: 'dice',
    icon: 'dice',
    nameKey: 'game_dice',
    hintKey: 'game_dice_hint',
    color: '#0EA5E9',
    maxPlayers: 8,
  },
  {
    id: 'would_you_rather',
    icon: 'git-compare',
    nameKey: 'game_wyr',
    hintKey: 'game_wyr_hint',
    color: '#EC4899',
    maxPlayers: 12,
  },
  {
    id: 'quick_draw',
    icon: 'brush',
    nameKey: 'game_draw',
    hintKey: 'game_draw_hint',
    color: '#F59E0B',
    maxPlayers: 6,
  },
  {
    id: 'emoji_race',
    icon: 'flash',
    nameKey: 'game_emoji',
    hintKey: 'game_emoji_hint',
    color: '#10B981',
    maxPlayers: 8,
  },
  {
    id: 'never_have_i',
    icon: 'hand-left',
    nameKey: 'game_nhie',
    hintKey: 'game_nhie_hint',
    color: '#EF4444',
    maxPlayers: 12,
  },
  {
    id: 'two_truths',
    icon: 'chatbubbles',
    nameKey: 'game_truths',
    hintKey: 'game_truths_hint',
    color: '#6366F1',
    maxPlayers: 8,
  },
];

export const TRIVIA_PROMPTS = [
  { q: 'What does HTTP stand for?', a: 'HyperText Transfer Protocol' },
  { q: 'Year the first iPhone launched?', a: '2007' },
  { q: 'Capital of Angola?', a: 'Luanda' },
  { q: '2 + 2 × 2 = ?', a: '6' },
  { q: 'Primary color of Socialize brand?', a: 'Royal blue' },
];

export const WYR_PROMPTS = [
  ['Ship tonight', 'Sleep 8 hours'],
  ['Dark mode forever', 'Light mode forever'],
  ['No coffee for a week', 'No memes for a week'],
  ['Only voice notes', 'Only text'],
  ['Join every call', 'Mute forever'],
];

export const NHIE_PROMPTS = [
  'Never have I ever deployed on a Friday…',
  'Never have I ever ghosted a group chat…',
  'Never have I ever used light mode on purpose…',
  'Never have I ever sent a voice note longer than 2 minutes…',
];

export function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

export function pickTrivia() {
  return TRIVIA_PROMPTS[Math.floor(Math.random() * TRIVIA_PROMPTS.length)];
}

export function pickWyr(): [string, string] {
  return WYR_PROMPTS[Math.floor(Math.random() * WYR_PROMPTS.length)] as [string, string];
}

export function pickNhie() {
  return NHIE_PROMPTS[Math.floor(Math.random() * NHIE_PROMPTS.length)];
}
