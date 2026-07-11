import { useSyncExternalStore } from 'react';

import { Colors } from '@/constants/theme';

/**
 * Theme marketplace + GB-style creator.
 *
 * Layers (bottom → top):
 *   1. Base Colors (light/dark)
 *   2. Active pack tokens / chat / layout
 *   3. Personal overrides (always-on tweaks for the user)
 */

export type ThemeMode = 'light' | 'dark';

/** App-wide semantic colors a pack can override. */
export type ThemeTokens = {
  primary: string;
  onPrimary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
};

/** Chat-thread chrome — classic GBWhatsApp-style knobs. */
export type ChatChrome = {
  /** Thread background (wallpaper solid). Empty = use surfaceMuted. */
  wallpaper: string;
  /** Local/remote image URI for photo wallpaper. */
  wallpaperImage: string;
  bubbleMine: string;
  bubbleTheirs: string;
  textMine: string;
  textTheirs: string;
  metaMine: string;
  metaTheirs: string;
  datePillBg: string;
  datePillText: string;
  composerBg: string;
  inputBg: string;
  linkMine: string;
  linkTheirs: string;
  headerBg: string;
  headerFg: string;
  sendBtnBg: string;
  replyBarBg: string;
  replyBarAccent: string;
  selectionBg: string;
  typingDot: string;
  systemBg: string;
  systemText: string;
  unreadBadge: string;
};

export type BubbleShape = 'rounded' | 'tail' | 'square' | 'pill';
export type BubbleSide = 'right' | 'left';
export type HeaderStyle = 'brand' | 'minimal' | 'colored';
export type TabBarPosition = 'top' | 'bottom';
export type AvatarPosition = 'left' | 'right' | 'hidden';
export type MessageDensity = 'compact' | 'cozy' | 'roomy';
export type ComposerStyle = 'rounded' | 'flat' | 'floating';
export type CheckPosition = 'left' | 'right';
export type DatePillStyle = 'pill' | 'text' | 'hidden';
export type ReplyStyle = 'quote' | 'bar' | 'minimal';
export type SendButtonStyle = 'circle' | 'pill' | 'icon';
export type SystemMsgStyle = 'pill' | 'plain' | 'banner';
export type UnreadBadgeStyle = 'dot' | 'count' | 'none';

/** Positions, shapes & ~40 GB-style knobs. */
export type ThemeLayout = {
  /** Which side YOUR messages sit on (swap = WA-GB classic). */
  myBubbleSide: BubbleSide;
  bubbleShape: BubbleShape;
  /** Corner radius 4–28 when shape is rounded/tail. */
  bubbleRadius: number;
  showTails: boolean;
  /** Message text scale 0.85–1.35 */
  fontScale: number;
  density: MessageDensity;
  avatarPosition: AvatarPosition;
  selectionCheckSide: CheckPosition;
  headerStyle: HeaderStyle;
  tabBarPosition: TabBarPosition;
  composerStyle: ComposerStyle;
  /** Pattern overlay on wallpaper */
  wallpaperPattern: boolean;
  /** Max bubble width 60–92 (% of row) */
  bubbleMaxWidth: number;
  // ── Extra personalization knobs ──────────────────────────────────────────
  bubblePaddingH: number;
  bubblePaddingV: number;
  emojiScale: number;
  letterSpacing: number;
  lineHeightExtra: number;
  bubbleShadow: boolean;
  bubbleShadowStrength: number;
  timestampInside: boolean;
  datePillStyle: DatePillStyle;
  replyStyle: ReplyStyle;
  sendButtonStyle: SendButtonStyle;
  attachSide: CheckPosition;
  inputRadius: number;
  listAvatarSize: number;
  showOnlineDot: boolean;
  showHeaderBorder: boolean;
  /** 0–80 darken overlay on photo wallpaper */
  wallpaperDim: number;
  wallpaperBlur: boolean;
  reactionScale: number;
  swipeReply: boolean;
  selectionHighlight: boolean;
  systemMsgStyle: SystemMsgStyle;
  chatHeaderCompact: boolean;
  fullWidthBubbles: boolean;
  groupSenderBold: boolean;
  metaSize: number;
  enterSends: boolean;
  hapticsOnReact: boolean;
  squircleCorners: boolean;
  linkUnderline: boolean;
  unreadBadgeStyle: UnreadBadgeStyle;
  showTypingDots: boolean;
  boldOutgoing: boolean;
  dimIncoming: boolean;
  largeTimestamps: boolean;
  centerDatePills: boolean;
  gapAfterGroup: number;
};

export type ThemeCategory =
  | 'all'
  | 'official'
  | 'neon'
  | 'pastel'
  | 'minimal'
  | 'nature'
  | 'midnight'
  | 'mine';

export type ThemePack = {
  id: string;
  name: string;
  author: string;
  description: string;
  category: Exclude<ThemeCategory, 'all' | 'mine'>;
  downloads: number;
  likes: number;
  price: 0 | number;
  swatches: string[];
  tokens: {
    light?: Partial<ThemeTokens>;
    dark?: Partial<ThemeTokens>;
  };
  /** Per-scheme chat chrome overrides. */
  chat?: {
    light?: Partial<ChatChrome>;
    dark?: Partial<ChatChrome>;
  };
  layout?: Partial<ThemeLayout>;
  /** Advanced CSS vars (parsed on apply / edit). */
  customCss?: string;
  /** Last AI prompt used to generate this pack. */
  aiPrompt?: string;
  isOfficial?: boolean;
  isOwned?: boolean;
  /** Forked from another pack id. */
  forkedFrom?: string;
};

export type SchemePreference = 'system' | 'light' | 'dark';

export type CreateThemeInput = {
  name: string;
  description?: string;
  category: ThemePack['category'];
  mode: ThemeMode | 'both';
  primary: string;
  background: string;
  surface: string;
  text: string;
  secondary?: string;
  chat?: Partial<ChatChrome>;
  layout?: Partial<ThemeLayout>;
  customCss?: string;
  aiPrompt?: string;
  /** Update existing owned pack instead of creating. */
  editId?: string;
  /** Fork source id (becomes forkedFrom). */
  forkFromId?: string;
};

// ── Defaults ────────────────────────────────────────────────────────────────

const baseLight = Colors.light as unknown as ThemeTokens;
const baseDark = Colors.dark as unknown as ThemeTokens;

export const DEFAULT_LAYOUT: ThemeLayout = {
  myBubbleSide: 'right',
  bubbleShape: 'tail',
  bubbleRadius: 16,
  showTails: true,
  fontScale: 1,
  density: 'cozy',
  avatarPosition: 'left',
  selectionCheckSide: 'left',
  headerStyle: 'brand',
  tabBarPosition: 'top',
  composerStyle: 'rounded',
  wallpaperPattern: false,
  bubbleMaxWidth: 82,
  bubblePaddingH: 11,
  bubblePaddingV: 7,
  emojiScale: 1,
  letterSpacing: 0,
  lineHeightExtra: 0,
  bubbleShadow: true,
  bubbleShadowStrength: 0.35,
  timestampInside: true,
  datePillStyle: 'pill',
  replyStyle: 'quote',
  sendButtonStyle: 'circle',
  attachSide: 'left',
  inputRadius: 22,
  listAvatarSize: 48,
  showOnlineDot: true,
  showHeaderBorder: true,
  wallpaperDim: 35,
  wallpaperBlur: false,
  reactionScale: 1,
  swipeReply: true,
  selectionHighlight: true,
  systemMsgStyle: 'pill',
  chatHeaderCompact: false,
  fullWidthBubbles: false,
  groupSenderBold: true,
  metaSize: 11,
  enterSends: true,
  hapticsOnReact: true,
  squircleCorners: false,
  linkUnderline: true,
  unreadBadgeStyle: 'count',
  showTypingDots: true,
  boldOutgoing: false,
  dimIncoming: false,
  largeTimestamps: false,
  centerDatePills: true,
  gapAfterGroup: 8,
};

export function defaultChatChrome(scheme: ThemeMode, primary: string): ChatChrome {
  if (scheme === 'dark') {
    return {
      wallpaper: '#131419',
      wallpaperImage: '',
      bubbleMine: primary,
      bubbleTheirs: '#191A21',
      textMine: '#FFFFFF',
      textTheirs: '#ECEDF2',
      metaMine: 'rgba(255,255,255,0.72)',
      metaTheirs: '#6C6E7A',
      datePillBg: '#191A21',
      datePillText: '#9A9CA8',
      composerBg: '#131419',
      inputBg: '#191A21',
      linkMine: '#BFDBFE',
      linkTheirs: primary,
      headerBg: '#191A21',
      headerFg: '#ECEDF2',
      sendBtnBg: primary,
      replyBarBg: '#23242D',
      replyBarAccent: primary,
      selectionBg: `${primary}22`,
      typingDot: '#6C6E7A',
      systemBg: '#191A21',
      systemText: '#9A9CA8',
      unreadBadge: primary,
    };
  }
  return {
    wallpaper: '#EEF1F6',
    wallpaperImage: '',
    bubbleMine: primary,
    bubbleTheirs: '#FFFFFF',
    textMine: '#FFFFFF',
    textTheirs: '#111827',
    metaMine: 'rgba(255,255,255,0.78)',
    metaTheirs: '#9AA3B2',
    datePillBg: '#FFFFFF',
    datePillText: '#6B7280',
    composerBg: '#EEF1F6',
    inputBg: '#FFFFFF',
    linkMine: '#DBEAFE',
    linkTheirs: primary,
    headerBg: primary,
    headerFg: '#FFFFFF',
    sendBtnBg: primary,
    replyBarBg: '#F0F4FF',
    replyBarAccent: primary,
    selectionBg: `${primary}18`,
    typingDot: '#9AA3B2',
    systemBg: '#FFFFFF',
    systemText: '#6B7280',
    unreadBadge: primary,
  };
}

function densityGap(d: MessageDensity): number {
  if (d === 'compact') return 2;
  if (d === 'roomy') return 10;
  return 6;
}

export function layoutMetrics(layout: ThemeLayout) {
  const baseFont = Math.round(15 * layout.fontScale);
  return {
    rowGap: densityGap(layout.density) + Math.max(0, layout.gapAfterGroup - 8) * 0.25,
    groupedGap: layout.density === 'compact' ? 1 : 2,
    fontSize: baseFont,
    lineHeight: Math.round(20 * layout.fontScale) + layout.lineHeightExtra,
    maxWidthPct: layout.fullWidthBubbles ? 94 : layout.bubbleMaxWidth,
    bubblePaddingH: layout.bubblePaddingH,
    bubblePaddingV: layout.bubblePaddingV,
    letterSpacing: layout.letterSpacing,
    metaSize: layout.largeTimestamps ? layout.metaSize + 2 : layout.metaSize,
    emojiScale: layout.emojiScale,
    reactionScale: layout.reactionScale,
    shadowOpacity: layout.bubbleShadow ? 0.04 + layout.bubbleShadowStrength * 0.12 : 0,
    inputRadius: layout.inputRadius,
  };
}

/** Border radii for a bubble given shape + mine + last-in-group. */
export function bubbleRadii(
  layout: ThemeLayout,
  mine: boolean,
  isLast: boolean,
  mySide: BubbleSide,
): {
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
} {
  const r = layout.bubbleRadius;
  if (layout.bubbleShape === 'square') {
    return {
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
    };
  }
  if (layout.bubbleShape === 'pill') {
    const p = Math.max(r, 22);
    return {
      borderTopLeftRadius: p,
      borderTopRightRadius: p,
      borderBottomLeftRadius: p,
      borderBottomRightRadius: p,
    };
  }
  // rounded / tail
  const tail = layout.showTails && layout.bubbleShape === 'tail' && isLast ? 4 : r;
  // Tail sits on the outer edge of the bubble relative to alignment.
  const mineOnRight = mySide === 'right';
  if (mine) {
    return {
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: mineOnRight ? r : tail,
      borderBottomRightRadius: mineOnRight ? tail : r,
    };
  }
  // theirs — opposite outer corner
  return {
    borderTopLeftRadius: r,
    borderTopRightRadius: r,
    borderBottomLeftRadius: mineOnRight ? tail : r,
    borderBottomRightRadius: mineOnRight ? r : tail,
  };
}

// ── Pack helpers ────────────────────────────────────────────────────────────

function pack(
  partial: Omit<ThemePack, 'swatches'> & { swatches?: string[] },
): ThemePack {
  const primary =
    partial.tokens.light?.primary ??
    partial.tokens.dark?.primary ??
    Colors.light.primary;
  const bg =
    partial.tokens.light?.background ??
    partial.tokens.dark?.background ??
    Colors.light.background;
  const surface =
    partial.tokens.light?.surface ??
    partial.tokens.dark?.surface ??
    Colors.light.surface;
  const text =
    partial.tokens.light?.text ??
    partial.tokens.dark?.text ??
    Colors.light.text;
  return {
    ...partial,
    layout: { ...DEFAULT_LAYOUT, ...partial.layout },
    swatches: partial.swatches ?? [primary, bg, surface, text],
  };
}

const MARKETPLACE: ThemePack[] = [
  pack({
    id: 'official-default',
    name: 'Socialize Blue',
    author: 'Socialize',
    description: 'The default royal blue — calm, clear, on-brand.',
    category: 'official',
    downloads: 128400,
    likes: 9420,
    price: 0,
    isOfficial: true,
    tokens: {},
    layout: { ...DEFAULT_LAYOUT },
  }),
  pack({
    id: 'midnight-ink',
    name: 'Midnight Ink',
    author: 'Studio Noir',
    description: 'Deep charcoal with electric indigo — roomy bubbles.',
    category: 'midnight',
    downloads: 48200,
    likes: 5102,
    price: 0,
    tokens: {
      dark: {
        primary: '#818CF8',
        tint: '#818CF8',
        tabIconSelected: '#818CF8',
        background: '#07080C',
        surface: '#12141C',
        surfaceElevated: '#1A1D28',
        surfaceMuted: '#0C0E14',
        text: '#F1F2F6',
        textSecondary: '#9CA0B0',
        textMuted: '#6B6F80',
        border: '#262A38',
        divider: '#1A1D28',
        onPrimary: '#0B0C10',
      },
      light: {
        primary: '#4F46E5',
        tint: '#4F46E5',
        tabIconSelected: '#4F46E5',
        background: '#F4F5FB',
        surface: '#FFFFFF',
        surfaceElevated: '#FFFFFF',
        surfaceMuted: '#E8EAF5',
        text: '#111827',
        textSecondary: '#5B6178',
        border: '#D8DCEB',
      },
    },
    chat: {
      dark: {
        wallpaper: '#0C0E14',
        bubbleMine: '#818CF8',
        bubbleTheirs: '#1A1D28',
        textMine: '#0B0C10',
        textTheirs: '#F1F2F6',
      },
    },
    layout: { density: 'roomy', bubbleRadius: 18, bubbleMaxWidth: 78 },
  }),
  pack({
    id: 'coral-dawn',
    name: 'Coral Dawn',
    author: 'Lumen Lab',
    description: 'Warm coral primary on soft cream surfaces.',
    category: 'pastel',
    downloads: 33100,
    likes: 4201,
    price: 0,
    tokens: {
      light: {
        primary: '#F97366',
        tint: '#F97366',
        tabIconSelected: '#F97366',
        background: '#FFF8F5',
        surface: '#FFFFFF',
        surfaceMuted: '#FFEDE8',
        surfaceElevated: '#FFFFFF',
        text: '#1C1412',
        textSecondary: '#7A5F58',
        textMuted: '#B39A93',
        border: '#F0D9D2',
        divider: '#F7E8E3',
        onPrimary: '#FFFFFF',
      },
      dark: {
        primary: '#FB8A7E',
        tint: '#FB8A7E',
        tabIconSelected: '#FB8A7E',
        background: '#140E0D',
        surface: '#1F1614',
        surfaceElevated: '#2A1E1B',
        surfaceMuted: '#181210',
        text: '#F8EFEC',
        textSecondary: '#C4A8A0',
        border: '#3A2A26',
        onPrimary: '#1A0F0D',
      },
    },
    layout: { bubbleShape: 'pill', showTails: false, bubbleRadius: 22 },
  }),
  pack({
    id: 'neon-lime',
    name: 'Neon Lime',
    author: 'Arcade Room',
    description: 'Black canvas, acid lime — compact, left-hand mode.',
    category: 'neon',
    downloads: 27500,
    likes: 3800,
    price: 0,
    tokens: {
      dark: {
        primary: '#A3E635',
        tint: '#A3E635',
        tabIconSelected: '#A3E635',
        background: '#050605',
        surface: '#0F120E',
        surfaceElevated: '#171B15',
        surfaceMuted: '#0A0C09',
        text: '#F4FFE8',
        textSecondary: '#A8B896',
        textMuted: '#6E7A60',
        border: '#243020',
        divider: '#171B15',
        onPrimary: '#0A1205',
        success: '#A3E635',
      },
      light: {
        primary: '#65A30D',
        tint: '#65A30D',
        tabIconSelected: '#65A30D',
        background: '#F7FCEF',
        surface: '#FFFFFF',
        surfaceMuted: '#EAF5D8',
        text: '#14200A',
        textSecondary: '#4B5D32',
        border: '#D4E5B5',
        onPrimary: '#FFFFFF',
      },
    },
    chat: {
      dark: {
        wallpaper: '#050605',
        bubbleMine: '#A3E635',
        bubbleTheirs: '#171B15',
        textMine: '#0A1205',
        textTheirs: '#F4FFE8',
      },
    },
    layout: {
      myBubbleSide: 'left',
      density: 'compact',
      bubbleShape: 'square',
      showTails: false,
      bubbleRadius: 8,
      wallpaperPattern: true,
    },
  }),
  pack({
    id: 'ocean-glass',
    name: 'Ocean Glass',
    author: 'North Tide',
    description: 'Teal waters and frosted glass surfaces.',
    category: 'nature',
    downloads: 19800,
    likes: 2400,
    price: 0,
    tokens: {
      light: {
        primary: '#0D9488',
        tint: '#0D9488',
        tabIconSelected: '#0D9488',
        background: '#F0FDFA',
        surface: '#FFFFFF',
        surfaceMuted: '#CCFBF1',
        text: '#042F2E',
        textSecondary: '#0F766E',
        border: '#99F6E4',
        onPrimary: '#FFFFFF',
      },
      dark: {
        primary: '#2DD4BF',
        tint: '#2DD4BF',
        tabIconSelected: '#2DD4BF',
        background: '#042F2E',
        surface: '#0B3D3B',
        surfaceElevated: '#115E59',
        surfaceMuted: '#063836',
        text: '#F0FDFA',
        textSecondary: '#99F6E4',
        border: '#134E4A',
        onPrimary: '#042F2E',
      },
    },
    layout: { bubbleRadius: 14, fontScale: 1.05, bubbleMaxWidth: 86 },
  }),
  pack({
    id: 'paper-minimal',
    name: 'Paper Minimal',
    author: 'Grid & Ink',
    description: 'Almost monochrome. Square bubbles, no tails.',
    category: 'minimal',
    downloads: 41200,
    likes: 6100,
    price: 0,
    tokens: {
      light: {
        primary: '#171717',
        tint: '#171717',
        tabIconSelected: '#171717',
        background: '#FAFAFA',
        surface: '#FFFFFF',
        surfaceMuted: '#F0F0F0',
        text: '#0A0A0A',
        textSecondary: '#525252',
        textMuted: '#A3A3A3',
        border: '#E5E5E5',
        divider: '#F0F0F0',
        onPrimary: '#FFFFFF',
      },
      dark: {
        primary: '#FAFAFA',
        tint: '#FAFAFA',
        tabIconSelected: '#FAFAFA',
        background: '#0A0A0A',
        surface: '#141414',
        surfaceElevated: '#1F1F1F',
        surfaceMuted: '#111111',
        text: '#FAFAFA',
        textSecondary: '#A3A3A3',
        border: '#262626',
        onPrimary: '#0A0A0A',
      },
    },
    layout: {
      bubbleShape: 'square',
      showTails: false,
      bubbleRadius: 6,
      density: 'compact',
      headerStyle: 'minimal',
    },
  }),
  pack({
    id: 'sunset-blvd',
    name: 'Sunset Blvd',
    author: 'Violet Hour',
    description: 'Magenta dusk — large type, floating composer.',
    category: 'neon',
    downloads: 15600,
    likes: 1980,
    price: 0,
    tokens: {
      dark: {
        primary: '#E879F9',
        tint: '#E879F9',
        tabIconSelected: '#E879F9',
        background: '#120814',
        surface: '#1C0F20',
        surfaceElevated: '#2A1530',
        surfaceMuted: '#160A18',
        text: '#FDF4FF',
        textSecondary: '#D8B4E2',
        border: '#3B2044',
        onPrimary: '#1A0A1C',
      },
      light: {
        primary: '#C026D3',
        tint: '#C026D3',
        tabIconSelected: '#C026D3',
        background: '#FDF4FF',
        surface: '#FFFFFF',
        surfaceMuted: '#FAE8FF',
        text: '#3B0764',
        textSecondary: '#86198F',
        border: '#F0ABFC',
        onPrimary: '#FFFFFF',
      },
    },
    layout: {
      fontScale: 1.12,
      composerStyle: 'floating',
      bubbleShape: 'pill',
      showTails: false,
      wallpaperPattern: true,
    },
  }),
  pack({
    id: 'forest-cabin',
    name: 'Forest Cabin',
    author: 'Moss & Pine',
    description: 'Earthy greens — avatars on the right, checks right.',
    category: 'nature',
    downloads: 22100,
    likes: 2900,
    price: 0,
    tokens: {
      light: {
        primary: '#3F6212',
        tint: '#3F6212',
        tabIconSelected: '#3F6212',
        background: '#F7F6F1',
        surface: '#FFFEF9',
        surfaceMuted: '#E8E6DB',
        text: '#1A1F12',
        textSecondary: '#4B5638',
        border: '#D4D0C0',
        onPrimary: '#FFFFFF',
      },
      dark: {
        primary: '#A3B18A',
        tint: '#A3B18A',
        tabIconSelected: '#A3B18A',
        background: '#12150F',
        surface: '#1A1F16',
        surfaceElevated: '#242A1E',
        surfaceMuted: '#151910',
        text: '#ECEDE6',
        textSecondary: '#A8B09A',
        border: '#2E3528',
        onPrimary: '#12150F',
      },
    },
    layout: {
      avatarPosition: 'right',
      selectionCheckSide: 'right',
      bubbleRadius: 12,
    },
  }),
];

// ── State ───────────────────────────────────────────────────────────────────

let catalog: ThemePack[] = MARKETPLACE;
let installed = new Set<string>(['official-default']);
let liked = new Set<string>();
let activeThemeId = 'official-default';
let schemePref: SchemePreference = 'system';
/** Always-on personal tweaks (GB “customize current theme”). */
let personalLayout: Partial<ThemeLayout> = {};
let personalChat: { light?: Partial<ChatChrome>; dark?: Partial<ChatChrome> } = {};
/** Bumps on every store mutation so hooks re-render even when object identity is stable. */
let storeRev = 0;
const listeners = new Set<() => void>();

function emit() {
  storeRev += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Selectors ───────────────────────────────────────────────────────────────

export function useThemeCatalog(): ThemePack[] {
  return useSyncExternalStore(subscribe, () => catalog);
}

export function useInstalledThemeIds(): Set<string> {
  return useSyncExternalStore(subscribe, () => installed);
}

export function useActiveThemeId(): string {
  return useSyncExternalStore(subscribe, () => activeThemeId);
}

export function useLikedThemeIds(): Set<string> {
  return useSyncExternalStore(subscribe, () => liked);
}

export function useSchemePreference(): SchemePreference {
  return useSyncExternalStore(subscribe, () => schemePref);
}

export function usePersonalLayout(): Partial<ThemeLayout> {
  return useSyncExternalStore(subscribe, () => personalLayout);
}

/** Subscribe to any theme-store change (packs, chrome, personal overrides). */
export function useThemeStoreRev(): number {
  return useSyncExternalStore(subscribe, () => storeRev);
}

export function getActivePack(): ThemePack | undefined {
  return catalog.find((p) => p.id === activeThemeId);
}

export function getPackById(id: string): ThemePack | undefined {
  return catalog.find((p) => p.id === id);
}

export function getResolvedColors(scheme: ThemeMode): ThemeTokens {
  const base = scheme === 'dark' ? baseDark : baseLight;
  const packActive = getActivePack();
  if (!packActive) return { ...base };
  const override = packActive.tokens[scheme] ?? {};
  const cssTokens = packActive.customCss ? parseThemeCss(packActive.customCss).tokens : {};
  const merged = { ...base, ...override, ...cssTokens };
  if ((override.primary || cssTokens.primary) && !merged.tint) {
    merged.tint = merged.primary;
  }
  if ((override.primary || cssTokens.primary) && !override.tabIconSelected && !cssTokens.tabIconSelected) {
    merged.tabIconSelected = merged.primary;
  }
  return merged;
}

export function getResolvedChat(scheme: ThemeMode): ChatChrome {
  const colors = getResolvedColors(scheme);
  const base = defaultChatChrome(scheme, colors.primary);
  // Prefer token surfaces when pack doesn't set chrome.
  const fromTokens: Partial<ChatChrome> = {
    wallpaper: colors.surfaceMuted,
    bubbleMine: colors.primary,
    bubbleTheirs: colors.surface,
    textMine: colors.onPrimary,
    textTheirs: colors.text,
    metaMine: scheme === 'dark' ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.78)',
    metaTheirs: colors.textMuted,
    datePillBg: colors.surface,
    datePillText: colors.textSecondary,
    composerBg: colors.surfaceMuted,
    inputBg: colors.surface,
    linkMine: colors.onPrimary,
    linkTheirs: colors.primary,
    headerBg: scheme === 'dark' ? colors.surface : colors.primary,
    headerFg: scheme === 'dark' ? colors.text : colors.onPrimary,
    sendBtnBg: colors.primary,
    replyBarBg: colors.surfaceMuted,
    replyBarAccent: colors.primary,
    selectionBg: `${colors.primary}18`,
    typingDot: colors.textMuted,
    systemBg: colors.surface,
    systemText: colors.textSecondary,
    unreadBadge: colors.primary,
  };
  const packActive = getActivePack();
  const packChat = packActive?.chat?.[scheme] ?? {};
  const personal = personalChat[scheme] ?? {};
  // CSS overrides win over pack (but personal still on top).
  const cssLayer: ParsedThemeCss = packActive?.customCss
    ? parseThemeCss(packActive.customCss)
    : { tokens: {}, chat: {}, layout: {} };
  return {
    ...base,
    ...fromTokens,
    ...packChat,
    ...cssLayer.chat,
    ...personal,
  };
}

export function getResolvedLayout(): ThemeLayout {
  const packActive = getActivePack();
  const cssLayer: ParsedThemeCss = packActive?.customCss
    ? parseThemeCss(packActive.customCss)
    : { tokens: {}, chat: {}, layout: {} };
  return {
    ...DEFAULT_LAYOUT,
    ...packActive?.layout,
    ...cssLayer.layout,
    ...personalLayout,
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

export function setSchemePreference(pref: SchemePreference) {
  schemePref = pref;
  emit();
}

export function setPersonalLayout(patch: Partial<ThemeLayout>) {
  personalLayout = { ...personalLayout, ...patch };
  emit();
}

export function setPersonalChat(scheme: ThemeMode, patch: Partial<ChatChrome>) {
  personalChat = {
    ...personalChat,
    [scheme]: { ...personalChat[scheme], ...patch },
  };
  emit();
}

export function clearPersonalOverrides() {
  personalLayout = {};
  personalChat = {};
  emit();
}

export function installTheme(id: string) {
  installed = new Set(installed).add(id);
  emit();
}

export function uninstallTheme(id: string) {
  if (id === 'official-default') return;
  const next = new Set(installed);
  next.delete(id);
  installed = next;
  if (activeThemeId === id) activeThemeId = 'official-default';
  emit();
}

export function applyTheme(id: string) {
  if (!installed.has(id) && !catalog.find((p) => p.id === id)?.isOwned) {
    installTheme(id);
  }
  installed = new Set(installed).add(id);
  activeThemeId = id;
  emit();
}

export function toggleLikeTheme(id: string) {
  const next = new Set(liked);
  const p = catalog.find((c) => c.id === id);
  if (next.has(id)) {
    next.delete(id);
    if (p) p.likes = Math.max(0, p.likes - 1);
  } else {
    next.add(id);
    if (p) p.likes += 1;
  }
  liked = next;
  catalog = [...catalog];
  emit();
}

function deriveTokens(
  mode: ThemeMode,
  primary: string,
  background: string,
  surface: string,
  text: string,
  secondary?: string,
): Partial<ThemeTokens> {
  const isDark = mode === 'dark';
  return {
    primary,
    tint: primary,
    tabIconSelected: primary,
    onPrimary: isDark ? background : '#FFFFFF',
    background,
    surface,
    surfaceElevated: surface,
    surfaceMuted:
      secondary ??
      (isDark ? blend(background, '#FFFFFF', 0.06) : blend(background, '#000000', 0.04)),
    text,
    textSecondary: isDark ? blend(text, background, 0.35) : blend(text, background, 0.4),
    textMuted: isDark ? blend(text, background, 0.55) : blend(text, background, 0.55),
    border: isDark ? blend(background, '#FFFFFF', 0.12) : blend(background, '#000000', 0.1),
    divider: isDark ? blend(background, '#FFFFFF', 0.08) : blend(background, '#000000', 0.06),
    icon: isDark ? blend(text, background, 0.35) : blend(text, background, 0.4),
    tabIconDefault: isDark ? blend(text, background, 0.5) : blend(text, background, 0.5),
  };
}

function blend(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  if (!pa || !pb) return a;
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function buildTokens(input: CreateThemeInput) {
  const light =
    input.mode === 'dark'
      ? deriveTokens('light', input.primary, '#F7F9FC', '#FFFFFF', '#111827')
      : deriveTokens(
          'light',
          input.primary,
          input.background,
          input.surface,
          input.text,
          input.secondary,
        );
  const dark =
    input.mode === 'light'
      ? deriveTokens(
          'dark',
          input.primary,
          blend(input.background, '#000000', 0.85),
          blend(input.surface, '#000000', 0.75),
          blend(input.text, '#FFFFFF', 0.9),
        )
      : deriveTokens(
          'dark',
          input.primary,
          input.mode === 'both' ? blend(input.background, '#000000', 0.85) : input.background,
          input.mode === 'both' ? blend(input.surface, '#000000', 0.75) : input.surface,
          input.mode === 'both' ? blend(input.text, '#FFFFFF', 0.9) : input.text,
          input.secondary,
        );

  if (input.mode === 'dark') {
    return {
      dark: deriveTokens(
        'dark',
        input.primary,
        input.background,
        input.surface,
        input.text,
        input.secondary,
      ),
      light,
    };
  }
  return { light, dark };
}

function buildChatFromInput(
  input: CreateThemeInput,
  tokens: { light?: Partial<ThemeTokens>; dark?: Partial<ThemeTokens> },
): ThemePack['chat'] {
  const chat = input.chat ?? {};
  const lightPrimary = tokens.light?.primary ?? input.primary;
  const darkPrimary = tokens.dark?.primary ?? input.primary;
  return {
    light: {
      ...defaultChatChrome('light', lightPrimary),
      bubbleMine: chat.bubbleMine ?? lightPrimary,
      bubbleTheirs: chat.bubbleTheirs,
      wallpaper: chat.wallpaper,
      textMine: chat.textMine,
      textTheirs: chat.textTheirs,
      ...chat,
    },
    dark: {
      ...defaultChatChrome('dark', darkPrimary),
      bubbleMine: chat.bubbleMine ?? darkPrimary,
      bubbleTheirs: chat.bubbleTheirs,
      wallpaper: chat.wallpaper,
      textMine: chat.textMine,
      textTheirs: chat.textTheirs,
      ...chat,
    },
  };
}

/** Create a new owned pack, or update an existing owned one. */
export function createThemePack(input: CreateThemeInput): ThemePack {
  const tokens = buildTokens(input);
  const chat = buildChatFromInput(input, tokens);
  const layout: ThemeLayout = { ...DEFAULT_LAYOUT, ...input.layout };

  // CSS layer merges into layout/chat if provided.
  const cssParsed: ParsedThemeCss = input.customCss
    ? parseThemeCss(input.customCss)
    : { tokens: {}, chat: {}, layout: {} };
  const finalLayout: ThemeLayout = {
    ...layout,
    ...cssParsed.layout,
  };
  const finalChat: ThemePack['chat'] = {
    light: { ...chat?.light, ...cssParsed.chat },
    dark: { ...chat?.dark, ...cssParsed.chat },
  };

  if (input.editId) {
    const existing = catalog.find((c) => c.id === input.editId);
    if (existing?.isOwned) {
      existing.name = input.name.trim().slice(0, 40) || existing.name;
      existing.description = input.description?.trim() || existing.description;
      existing.category = input.category;
      existing.tokens = {
        light: { ...tokens.light, ...cssParsed.tokens },
        dark: { ...tokens.dark, ...cssParsed.tokens },
      };
      existing.chat = finalChat;
      existing.layout = finalLayout;
      existing.customCss = input.customCss;
      existing.aiPrompt = input.aiPrompt;
      existing.swatches = [
        input.primary,
        input.background,
        input.surface,
        input.text,
      ];
      catalog = [...catalog];
      activeThemeId = existing.id;
      installed = new Set(installed).add(existing.id);
      emit();
      return existing;
    }
  }

  const id = `theme_${Date.now().toString(36)}`;
  const theme = pack({
    id,
    name: input.name.trim().slice(0, 40) || 'My theme',
    author: 'You',
    description: input.description?.trim() || 'Custom theme from the creator.',
    category: input.category,
    downloads: input.forkFromId ? 0 : 1,
    likes: 0,
    price: 0,
    isOwned: true,
    forkedFrom: input.forkFromId,
    tokens: {
      light: { ...tokens.light, ...cssParsed.tokens },
      dark: { ...tokens.dark, ...cssParsed.tokens },
    },
    chat: finalChat,
    layout: finalLayout,
    customCss: input.customCss,
    aiPrompt: input.aiPrompt,
    swatches: [input.primary, input.background, input.surface, input.text],
  });

  catalog = [theme, ...catalog];
  installed = new Set(installed).add(id);
  activeThemeId = id;
  emit();
  return theme;
}

/** Duplicate any pack into an owned editable copy. */
export function forkTheme(id: string, nameSuffix = ' (edit)'): ThemePack | null {
  const source = catalog.find((c) => c.id === id);
  if (!source) return null;
  const newId = `theme_${Date.now().toString(36)}`;
  const forked = pack({
    id: newId,
    name: `${source.name}${nameSuffix}`.slice(0, 40),
    author: 'You',
    description: source.description,
    category: source.category,
    downloads: 0,
    likes: 0,
    price: 0,
    isOwned: true,
    forkedFrom: source.id,
    tokens: {
      light: source.tokens.light ? { ...source.tokens.light } : undefined,
      dark: source.tokens.dark ? { ...source.tokens.dark } : undefined,
    },
    chat: source.chat
      ? {
          light: source.chat.light ? { ...source.chat.light } : undefined,
          dark: source.chat.dark ? { ...source.chat.dark } : undefined,
        }
      : undefined,
    layout: { ...DEFAULT_LAYOUT, ...source.layout },
    swatches: [...source.swatches],
  });
  catalog = [forked, ...catalog];
  installed = new Set(installed).add(newId);
  activeThemeId = newId;
  emit();
  return forked;
}

/** Patch layout/chat on an owned pack in place (live editor). */
export function updateOwnedTheme(
  id: string,
  patch: {
    name?: string;
    description?: string;
    category?: ThemePack['category'];
    tokens?: ThemePack['tokens'];
    chat?: ThemePack['chat'];
    layout?: Partial<ThemeLayout>;
    swatches?: string[];
  },
) {
  const p = catalog.find((c) => c.id === id);
  if (!p?.isOwned) return;
  if (patch.name) p.name = patch.name.slice(0, 40);
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.category) p.category = patch.category;
  if (patch.tokens) p.tokens = patch.tokens;
  if (patch.chat) p.chat = patch.chat;
  if (patch.layout) p.layout = { ...DEFAULT_LAYOUT, ...p.layout, ...patch.layout };
  if (patch.swatches) p.swatches = patch.swatches;
  catalog = [...catalog];
  emit();
}

export function publishThemeToMarketplace(id: string) {
  const p = catalog.find((c) => c.id === id);
  if (!p || !p.isOwned) return;
  p.downloads = Math.max(p.downloads, 1);
  catalog = [...catalog];
  emit();
}

export function deleteOwnedTheme(id: string) {
  const p = catalog.find((c) => c.id === id);
  if (!p?.isOwned) return;
  catalog = catalog.filter((c) => c.id !== id);
  const next = new Set(installed);
  next.delete(id);
  installed = next;
  if (activeThemeId === id) activeThemeId = 'official-default';
  emit();
}

export const THEME_CATEGORIES: ThemeCategory[] = [
  'all',
  'official',
  'neon',
  'pastel',
  'minimal',
  'nature',
  'midnight',
  'mine',
];

export const BUBBLE_SHAPES: BubbleShape[] = ['tail', 'rounded', 'pill', 'square'];
export const DENSITIES: MessageDensity[] = ['compact', 'cozy', 'roomy'];
export const HEADER_STYLES: HeaderStyle[] = ['brand', 'minimal', 'colored'];
export const COMPOSER_STYLES: ComposerStyle[] = ['rounded', 'flat', 'floating'];
export const DATE_PILL_STYLES: DatePillStyle[] = ['pill', 'text', 'hidden'];
export const REPLY_STYLES: ReplyStyle[] = ['quote', 'bar', 'minimal'];
export const SEND_STYLES: SendButtonStyle[] = ['circle', 'pill', 'icon'];
export const SYSTEM_STYLES: SystemMsgStyle[] = ['pill', 'plain', 'banner'];

export const CSS_THEME_TEMPLATE = `/* Socialize theme CSS — custom properties */
:root {
  --primary: #2D5BFF;
  --background: #0E0F13;
  --surface: #191A21;
  --text: #ECEDF2;
  --wallpaper: #131419;
  --bubble-mine: #2D5BFF;
  --bubble-theirs: #191A21;
  --text-mine: #FFFFFF;
  --text-theirs: #ECEDF2;
  --my-side: right;          /* left | right */
  --bubble-shape: tail;      /* tail | rounded | pill | square */
  --bubble-radius: 16;
  --font-scale: 1;
  --density: cozy;           /* compact | cozy | roomy */
  --bubble-max-width: 82;
  --wallpaper-dim: 35;
  --bubble-padding-h: 11;
  --bubble-padding-v: 7;
  --emoji-scale: 1;
  --letter-spacing: 0;
  --show-tails: true;
  --bubble-shadow: true;
  --wallpaper-pattern: false;
  --send-button: circle;     /* circle | pill | icon */
  --composer: rounded;       /* rounded | flat | floating */
}
`;

export type ParsedThemeCss = {
  tokens: Partial<ThemeTokens>;
  chat: Partial<ChatChrome>;
  layout: Partial<ThemeLayout>;
};

/** Parse a CSS custom-properties block into theme layers. */
export function parseThemeCss(css: string): ParsedThemeCss {
  const tokens: Partial<ThemeTokens> = {};
  const chat: Partial<ChatChrome> = {};
  const layout: Partial<ThemeLayout> = {};
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const key = m[1].toLowerCase();
    const raw = m[2].trim().replace(/^['"]|['"]$/g, '');
    const num = Number(raw);
    const bool = raw === 'true' ? true : raw === 'false' ? false : undefined;

    switch (key) {
      case 'primary':
        tokens.primary = raw;
        tokens.tint = raw;
        tokens.tabIconSelected = raw;
        break;
      case 'background':
        tokens.background = raw;
        break;
      case 'surface':
        tokens.surface = raw;
        break;
      case 'surface-muted':
        tokens.surfaceMuted = raw;
        break;
      case 'text':
        tokens.text = raw;
        break;
      case 'text-secondary':
        tokens.textSecondary = raw;
        break;
      case 'on-primary':
        tokens.onPrimary = raw;
        break;
      case 'border':
        tokens.border = raw;
        break;
      case 'wallpaper':
        chat.wallpaper = raw;
        break;
      case 'wallpaper-image':
        chat.wallpaperImage = raw;
        break;
      case 'bubble-mine':
        chat.bubbleMine = raw;
        break;
      case 'bubble-theirs':
        chat.bubbleTheirs = raw;
        break;
      case 'text-mine':
        chat.textMine = raw;
        break;
      case 'text-theirs':
        chat.textTheirs = raw;
        break;
      case 'composer-bg':
        chat.composerBg = raw;
        break;
      case 'input-bg':
        chat.inputBg = raw;
        break;
      case 'send-btn':
        chat.sendBtnBg = raw;
        break;
      case 'my-side':
        if (raw === 'left' || raw === 'right') layout.myBubbleSide = raw;
        break;
      case 'bubble-shape':
        if (['tail', 'rounded', 'pill', 'square'].includes(raw)) {
          layout.bubbleShape = raw as BubbleShape;
        }
        break;
      case 'bubble-radius':
        if (!Number.isNaN(num)) layout.bubbleRadius = clamp(num, 4, 28);
        break;
      case 'font-scale':
        if (!Number.isNaN(num)) layout.fontScale = clamp(num, 0.85, 1.35);
        break;
      case 'density':
        if (['compact', 'cozy', 'roomy'].includes(raw)) {
          layout.density = raw as MessageDensity;
        }
        break;
      case 'bubble-max-width':
        if (!Number.isNaN(num)) layout.bubbleMaxWidth = clamp(num, 60, 94);
        break;
      case 'wallpaper-dim':
        if (!Number.isNaN(num)) layout.wallpaperDim = clamp(num, 0, 80);
        break;
      case 'bubble-padding-h':
        if (!Number.isNaN(num)) layout.bubblePaddingH = clamp(num, 6, 22);
        break;
      case 'bubble-padding-v':
        if (!Number.isNaN(num)) layout.bubblePaddingV = clamp(num, 4, 18);
        break;
      case 'emoji-scale':
        if (!Number.isNaN(num)) layout.emojiScale = clamp(num, 0.8, 1.6);
        break;
      case 'letter-spacing':
        if (!Number.isNaN(num)) layout.letterSpacing = clamp(num, -0.5, 1.5);
        break;
      case 'show-tails':
        if (bool !== undefined) layout.showTails = bool;
        break;
      case 'bubble-shadow':
        if (bool !== undefined) layout.bubbleShadow = bool;
        break;
      case 'wallpaper-pattern':
        if (bool !== undefined) layout.wallpaperPattern = bool;
        break;
      case 'full-width':
        if (bool !== undefined) layout.fullWidthBubbles = bool;
        break;
      case 'send-button':
        if (['circle', 'pill', 'icon'].includes(raw)) {
          layout.sendButtonStyle = raw as SendButtonStyle;
        }
        break;
      case 'composer':
        if (['rounded', 'flat', 'floating'].includes(raw)) {
          layout.composerStyle = raw as ComposerStyle;
        }
        break;
      case 'header-style':
        if (['brand', 'minimal', 'colored'].includes(raw)) {
          layout.headerStyle = raw as HeaderStyle;
        }
        break;
      default:
        break;
    }
  }
  return { tokens, chat, layout };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type AiThemeDraft = {
  name: string;
  description: string;
  category: ThemePack['category'];
  primary: string;
  background: string;
  surface: string;
  text: string;
  mode: ThemeMode | 'both';
  chat: Partial<ChatChrome>;
  layout: Partial<ThemeLayout>;
  customCss: string;
};

/**
 * Client-side "AI" theme generator — maps natural language to a full draft.
 * (Offline heuristic until a real model is wired on the backend.)
 */
export function generateThemeFromAiPrompt(prompt: string): AiThemeDraft {
  const p = prompt.toLowerCase();
  const dark =
    /\b(dark|noite|night|black|preto|midnight|cyber|néon|neon)\b/.test(p) &&
    !/\b(light|claro|day|dia)\b/.test(p);
  const light = /\b(light|claro|pastel|cream|soft|dia)\b/.test(p);

  let primary = '#2D5BFF';
  let background = dark ? '#0E0F13' : '#F7F9FC';
  let surface = dark ? '#191A21' : '#FFFFFF';
  let text = dark ? '#ECEDF2' : '#111827';
  let category: ThemePack['category'] = 'minimal';
  let name = 'AI Theme';
  const layout: Partial<ThemeLayout> = { ...DEFAULT_LAYOUT };
  const chat: Partial<ChatChrome> = {};

  if (/\b(neon|néon|cyber|synth|vapor)\b/.test(p)) {
    primary = '#A3E635';
    background = '#050605';
    surface = '#0F120E';
    text = '#F4FFE8';
    category = 'neon';
    name = 'Neon Pulse';
    layout.bubbleShape = 'square';
    layout.showTails = false;
    layout.wallpaperPattern = true;
    layout.bubbleShadow = true;
    layout.bubbleShadowStrength = 0.8;
  } else if (/\b(pastel|soft|blush|peach|coral)\b/.test(p)) {
    primary = '#F97366';
    background = '#FFF8F5';
    surface = '#FFFFFF';
    text = '#1C1412';
    category = 'pastel';
    name = 'Soft Pastel';
    layout.bubbleShape = 'pill';
    layout.showTails = false;
    layout.fontScale = 1.05;
  } else if (/\b(ocean|sea|teal|água|agua|wave)\b/.test(p)) {
    primary = '#0D9488';
    background = '#F0FDFA';
    surface = '#FFFFFF';
    text = '#042F2E';
    category = 'nature';
    name = 'Ocean Drift';
    layout.bubbleRadius = 14;
    layout.composerStyle = 'floating';
  } else if (/\b(forest|green|moss|nature|floresta)\b/.test(p)) {
    primary = '#3F6212';
    background = '#F7F6F1';
    surface = '#FFFEF9';
    text = '#1A1F12';
    category = 'nature';
    name = 'Forest Cabin';
    layout.avatarPosition = 'right';
  } else if (/\b(midnight|ink|noir|preto|black)\b/.test(p)) {
    primary = '#818CF8';
    background = '#07080C';
    surface = '#12141C';
    text = '#F1F2F6';
    category = 'midnight';
    name = 'Midnight Ink';
    layout.density = 'roomy';
    layout.bubbleRadius = 18;
  } else if (/\b(minimal|paper|mono|clean|limpo)\b/.test(p)) {
    primary = '#171717';
    background = '#FAFAFA';
    surface = '#FFFFFF';
    text = '#0A0A0A';
    category = 'minimal';
    name = 'Paper Minimal';
    layout.bubbleShape = 'square';
    layout.showTails = false;
    layout.headerStyle = 'minimal';
    layout.density = 'compact';
  } else if (/\b(pink|magenta|sunset|rosa|roxo|purple|violet)\b/.test(p)) {
    primary = '#E879F9';
    background = '#120814';
    surface = '#1C0F20';
    text = '#FDF4FF';
    category = 'neon';
    name = 'Sunset Blvd';
    layout.fontScale = 1.12;
    layout.bubbleShape = 'pill';
    layout.composerStyle = 'floating';
  }

  if (/\b(left|esquerda|canhoto|left-hand)\b/.test(p)) {
    layout.myBubbleSide = 'left';
  }
  if (/\b(right|direita)\b/.test(p)) layout.myBubbleSide = 'right';
  if (/\b(compact|denso|tight)\b/.test(p)) layout.density = 'compact';
  if (/\b(roomy|espaçoso|espacoso|large gap)\b/.test(p)) layout.density = 'roomy';
  if (/\b(big text|texto grande|large text|huge)\b/.test(p)) layout.fontScale = 1.25;
  if (/\b(small text|texto pequeno|tiny)\b/.test(p)) layout.fontScale = 0.9;
  if (/\b(no tail|sem cauda|square)\b/.test(p)) {
    layout.showTails = false;
    layout.bubbleShape = 'square';
  }
  if (/\b(pill|pílula|pilula)\b/.test(p)) {
    layout.bubbleShape = 'pill';
    layout.showTails = false;
  }
  if (/\b(full.?width|largura total)\b/.test(p)) layout.fullWidthBubbles = true;
  if (/\b(shadow|sombra)\b/.test(p)) {
    layout.bubbleShadow = true;
    layout.bubbleShadowStrength = 0.7;
  }
  if (/\b(no shadow|sem sombra)\b/.test(p)) layout.bubbleShadow = false;
  if (/\b(floating composer|compositor flutuante)\b/.test(p)) {
    layout.composerStyle = 'floating';
  }
  if (/\b(bold|negrito)\b/.test(p)) layout.boldOutgoing = true;
  if (/\b(dim|apagado)\b/.test(p)) layout.dimIncoming = true;

  chat.bubbleMine = primary;
  chat.bubbleTheirs = surface;
  chat.wallpaper = dark || (!light && background.startsWith('#0')) ? background : background;
  chat.textMine = dark || primary === '#A3E635' || primary === '#FAFAFA' || primary === '#E879F9' || primary === '#818CF8'
    ? (primary === '#A3E635' || primary === '#FAFAFA' ? background : '#FFFFFF')
    : '#FFFFFF';
  chat.textTheirs = text;
  chat.sendBtnBg = primary;

  const mode: ThemeMode | 'both' = dark && !light ? 'dark' : light && !dark ? 'light' : 'both';

  const customCss = `/* AI generated from: ${prompt.slice(0, 80)} */
:root {
  --primary: ${primary};
  --background: ${background};
  --surface: ${surface};
  --text: ${text};
  --wallpaper: ${chat.wallpaper};
  --bubble-mine: ${chat.bubbleMine};
  --bubble-theirs: ${chat.bubbleTheirs};
  --text-mine: ${chat.textMine};
  --text-theirs: ${chat.textTheirs};
  --my-side: ${layout.myBubbleSide ?? 'right'};
  --bubble-shape: ${layout.bubbleShape ?? 'tail'};
  --bubble-radius: ${layout.bubbleRadius ?? 16};
  --font-scale: ${layout.fontScale ?? 1};
  --density: ${layout.density ?? 'cozy'};
  --show-tails: ${layout.showTails ?? true};
  --bubble-shadow: ${layout.bubbleShadow ?? true};
  --composer: ${layout.composerStyle ?? 'rounded'};
}
`;

  return {
    name,
    description: prompt.trim().slice(0, 120) || 'Generated theme',
    category,
    primary,
    background,
    surface,
    text,
    mode,
    chat,
    layout,
    customCss,
  };
}
