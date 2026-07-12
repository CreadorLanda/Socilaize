const dicebear = (style: string, seed: string, bg: string) =>
  `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&backgroundColor=${bg.replace('#', '')}&size=200`;

const robohash = (seed: string, set: 'set1' | 'set2' | 'set3' | 'set4' | 'set5') =>
  `https://robohash.org/${encodeURIComponent(seed)}.png?set=${set}&size=200x200`;

export type ChatPreview = {
  id: string;
  name: string;
  username: string;
  avatarUri: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  online: boolean;
  pinned?: boolean;
  isGroup?: boolean;
  memberCount?: number;
  /** True for the Dandara AI assistant chat. */
  isAI?: boolean;
  /** Where this chat lives — 'whatsapp' for bridged chats. */
  source?: 'native' | 'whatsapp';
  /** WhatsApp JID for bridged chats (only meaningful when source='whatsapp'). */
  bridgeJid?: string;
  /** Pending friend request chat */
  isPending?: boolean;
};

/** The Dandara AI assistant — her own chat plus an in-chat helper. */
export const DANDARA = {
  id: 'dandara',
  name: 'Dandara',
  avatarUri: robohash('Dandara Assistant', 'set1'),
} as const;

export const CHATS: ChatPreview[] = [
  {
    id: 'dandara',
    name: 'Dandara',
    username: '@dandara',
    avatarUri: DANDARA.avatarUri,
    lastMessage: 'Pergunta-me o que quiseres — estou aqui para ajudar.',
    timestamp: '09:50',
    unreadCount: 0,
    online: true,
    pinned: true,
    isAI: true,
  },
  {
    id: 'c1',
    name: 'ninani.eth',
    username: '@ninani',
    avatarUri: dicebear('avataaars', 'ninani', 'FFD93D'),
    lastMessage: 'Just sent the contract address — let me know if you can sign it tonight.',
    timestamp: '09:42',
    unreadCount: 2,
    online: true,
    pinned: true,
  },
  {
    id: 'c2',
    name: 'Samuel Garu',
    username: '@samgaru',
    avatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80'),
    lastMessage: 'Yeah let’s do Sat afternoon, I’ll book the studio.',
    timestamp: '09:31',
    unreadCount: 0,
    online: true,
  },
  {
    id: 'c3',
    name: 'Dr7e7t8696c7bb4...',
    username: '@dr7e7t',
    avatarUri: robohash('Dr7e7t8696c7bb4', 'set1'),
    lastMessage: 'Mango_Apes #4839 just sold for 12.4 ETH 🚀',
    timestamp: '09:14',
    unreadCount: 5,
    online: false,
  },
  {
    id: 'c4',
    name: 'Anthony (Web3.io)',
    username: '@anthony',
    avatarUri: dicebear('adventurer', 'Anthony', 'A78BFA'),
    lastMessage: 'voice message · 0:24',
    timestamp: 'Yesterday',
    unreadCount: 0,
    online: false,
  },
  {
    id: 'c5',
    name: 'k&8.eth',
    username: '@k8eth',
    avatarUri: dicebear('lorelei', 'k8eth', 'FF6FB5'),
    lastMessage: 'Pulled up to your studio, buzz me',
    timestamp: 'Yesterday',
    unreadCount: 0,
    online: false,
  },
  {
    id: 'c6',
    name: 'Margareth Joanne C.',
    username: '@margcaramel',
    avatarUri: dicebear('micah', 'Margareth Joanne', '22D3EE'),
    lastMessage: 'MARG_CARAMEL_ART #2839 — minted 💎',
    timestamp: 'Yesterday',
    unreadCount: 0,
    online: false,
  },
  {
    id: 'c7',
    name: 'Joe Felix',
    username: '@joefelix',
    avatarUri: dicebear('pixel-art', 'Joe Felix', '6F8BFF'),
    lastMessage: 'Aloha y’all',
    timestamp: 'Mon',
    unreadCount: 0,
    online: false,
  },
  {
    id: 'g1',
    name: 'Web3 Builders',
    username: '@web3builders',
    avatarUri: dicebear('shapes', 'Web3 Builders', '6F8BFF'),
    lastMessage: 'Welcome aboard — scroll up to catch the thread.',
    timestamp: '08:55',
    unreadCount: 3,
    online: false,
    isGroup: true,
    memberCount: 6,
  },
  // ── WhatsApp bridge examples (source='whatsapp') ─────────────────────────
  {
    id: 'wa1',
    name: 'Maria Costa',
    username: '+351 912 000 111',
    avatarUri: dicebear('avataaars', 'Maria Costa', '25D366'),
    lastMessage: 'Já estou a caminho 🚗',
    timestamp: '11:24',
    unreadCount: 2,
    online: true,
    source: 'whatsapp',
    bridgeJid: '351912000111@s.whatsapp.net',
  },
  {
    id: 'wag1',
    name: 'Família',
    username: 'WhatsApp Group',
    avatarUri: dicebear('initials', 'Família', '25D366'),
    lastMessage: '@alex anda cá ver isto',
    timestamp: '10:51',
    unreadCount: 5,
    online: false,
    isGroup: true,
    memberCount: 8,
    source: 'whatsapp',
    bridgeJid: '120363025@g.us',
  },
];

export type MediaAttachment = {
  type: 'image' | 'video' | 'audio';
  uri: string;
  durationSec?: number;
};

/** Rich attachments composed from the chat attachment menu. */
export type MessageAttachment =
  | { kind: 'document'; name: string; ext: string; sizeLabel: string }
  | {
      kind: 'location';
      place: string;
      address: string;
      /** Live (continuously updated) location — shows a pulsing dot and expiry countdown. */
      live?: boolean;
      /** ISO timestamp when the live share expires (only meaningful when live=true). */
      expiresAt?: string;
    }
  | { kind: 'contact'; name: string; detail: string; avatarUri?: string }
  | {
      kind: 'sticker';
      uri: string;
      animated?: boolean;
      width?: number;
      height?: number;
    }
  | {
      kind: 'poll';
      question: string;
      multi: boolean;
      options: { id: string; text: string; votes: number; voted?: boolean }[];
    }
  | {
      kind: 'event';
      title: string;
      day: number;
      month: string;
      weekday: string;
      time: string;
      location?: string;
    }
  | { kind: 'game'; name: string; tagline: string; color: string; icon: string };

export type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  media?: MediaAttachment;
  /** Display name of the sender — shown in group threads for incoming messages. */
  senderName?: string;
  senderAvatarUri?: string;
  /** True for messages sent before the current user joined the group. */
  historical?: boolean;
  /** Renders as a centered system notice (e.g. the "you joined" divider) instead of a bubble. */
  system?: boolean;
  replyTo?: { id: string; text: string; fromMe: boolean; senderName?: string; icon?: string };
  attachment?: MessageAttachment;
  /** True for messages authored by the Dandara AI assistant. */
  isAI?: boolean;
  /** True if the message text has been edited after sending. */
  edited?: boolean;
  /** When set, the message is rendered as a "this message was deleted" placeholder. */
  deletedAt?: string;
  /** When true, the message content is consumed on first view (WhatsApp view-once). */
  viewOnce?: boolean;
  /** True once a view-once message has been opened locally. */
  viewed?: boolean;
  /** Disappearing message — ISO timestamp when it should self-delete. */
  expiresAt?: string;
  /** Usernames mentioned in the text (without @). Used for inline highlighting. */
  mentions?: string[];
  /** Origin of the message — 'whatsapp' for messages received via the bridge. */
  source?: 'native' | 'whatsapp';
  /** True for messages that were forwarded from somewhere else. */
  forwarded?: boolean;
};

export type GroupMember = {
  id: string;
  name: string;
  username: string;
  avatarUri: string;
  role: 'admin' | 'member';
};

/** Number of past messages a new member can see. `Infinity` means all. */
export const HISTORY_LIMITS = [25, 50, 100, Infinity] as const;

export type GroupInfo = {
  id: string;
  name: string;
  avatarUri: string;
  description: string;
  members: GroupMember[];
  /** Admin toggle — when off, new members only see messages sent after they joined. */
  historyEnabled: boolean;
  /** Whether new members can reply to historical messages or only read them. */
  historyMode: 'view-only' | 'full';
  /** How many past messages new members can see (see HISTORY_LIMITS). */
  historyLimit: number;
};

export const MESSAGES: Record<string, Message[]> = {
  dandara: [
    {
      id: 'm1',
      text: 'Olá! Sou a Dandara, a tua assistente. Posso escrever, resumir, dar ideias ou responder a perguntas — aqui ou em qualquer conversa, é só mencionares @Dandara. O que precisas?',
      fromMe: false,
      timestamp: '09:50',
      isAI: true,
      senderName: 'Dandara',
      senderAvatarUri: DANDARA.avatarUri,
    },
  ],
  c1: [
    { id: 'm1', text: 'Yo, just got your DM', fromMe: false, timestamp: '09:38' },
    { id: 'm2', text: 'Hey! Yeah, you free to sign tonight?', fromMe: true, timestamp: '09:39', status: 'read' },
    { id: 'm3', text: 'I think so, depends what time', fromMe: false, timestamp: '09:40' },
    { id: 'm4', text: 'Around 9pm UTC works for me', fromMe: true, timestamp: '09:41', status: 'read' },
    {
      id: 'm5',
      text: 'Just sent the contract address — let me know if you can sign it tonight.',
      fromMe: false,
      timestamp: '09:42',
    },
    {
      id: 'm6',
      text: 'btw, this thread is gold — read it before tonight 👇\nhttps://example.com/web3-onboarding',
      fromMe: false,
      timestamp: '09:44',
      forwarded: true,
    },
  ],
  c2: [
    { id: 'm1', text: 'Studio Sat afternoon?', fromMe: true, timestamp: '09:28', status: 'read' },
    { id: 'm2', text: 'Yeah let’s do Sat afternoon, I’ll book the studio.', fromMe: false, timestamp: '09:31' },
  ],
  c3: [
    { id: 'm1', text: 'gm', fromMe: true, timestamp: '09:10', status: 'delivered' },
    { id: 'm2', text: 'Mango_Apes #4839 just sold for 12.4 ETH 🚀', fromMe: false, timestamp: '09:14' },
  ],
  g1: [
    { id: 'm1', text: 'gm builders ☀️', fromMe: false, timestamp: 'Mon 08:01', historical: true, senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
    { id: 'm2', text: 'Agenda for today: testnet deploy + grant review', fromMe: false, timestamp: 'Mon 08:03', historical: true, senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
    { id: 'm3', text: 'I can take the deploy if nobody else wants it', fromMe: false, timestamp: 'Mon 08:07', historical: true, senderName: 'Samuel Garu', senderAvatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80') },
    { id: 'm4', text: 'go for it Sam 🙌', fromMe: false, timestamp: 'Mon 08:08', historical: true, senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
    { id: 'm5', text: 'gas is wild this morning btw', fromMe: false, timestamp: 'Mon 08:15', historical: true, senderName: 'Dr7e7t', senderAvatarUri: robohash('Dr7e7t8696c7bb4', 'set1') },
    { id: 'm6', text: 'yeah saw 80 gwei earlier', fromMe: false, timestamp: 'Mon 08:16', historical: true, senderName: 'Anthony', senderAvatarUri: dicebear('adventurer', 'Anthony', 'A78BFA') },
    { id: 'm7', text: 'lets wait till it cools down before deploying', fromMe: false, timestamp: 'Mon 08:17', historical: true, senderName: 'Samuel Garu', senderAvatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80') },
    { id: 'm8', text: 'grant review doc is ready for eyes 👀', fromMe: false, timestamp: 'Yesterday 19:40', historical: true, senderName: 'k&8.eth', senderAvatarUri: dicebear('lorelei', 'k8eth', 'FF6FB5') },
    { id: 'm9', text: 'looks solid, left two comments', fromMe: false, timestamp: 'Yesterday 21:02', historical: true, senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
    { id: 'm10', text: 'deploy went through ✅ 0x9f3a…c7', fromMe: false, timestamp: 'Yesterday 22:18', historical: true, senderName: 'Samuel Garu', senderAvatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80') },
    { id: 'm11', text: 'huge, nice work', fromMe: false, timestamp: 'Yesterday 22:20', historical: true, senderName: 'Anthony', senderAvatarUri: dicebear('adventurer', 'Anthony', 'A78BFA') },
    { id: 'm12', text: 'adding a couple of new builders to the group today', fromMe: false, timestamp: '08:50', historical: true, senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
    { id: 'm13', text: 'You joined the group', fromMe: false, timestamp: '08:54', system: true },
    { id: 'm14', text: 'Welcome aboard — scroll up to catch the thread.', fromMe: false, timestamp: '08:55', senderName: 'ninani.eth', senderAvatarUri: dicebear('avataaars', 'ninani', 'FFD93D') },
  ],

  // ── WhatsApp 1:1 (bridged) ─────────────────────────────────────────────
  wa1: [
    {
      id: 'wm1',
      text: 'Olá! Estamos a marcar para sábado?',
      fromMe: false,
      timestamp: '10:30',
      source: 'whatsapp',
      senderName: 'Maria Costa',
    },
    {
      id: 'wm2',
      text: 'Sim, combinado! Onde nos encontramos?',
      fromMe: true,
      timestamp: '10:32',
      status: 'read',
      source: 'whatsapp',
      edited: true,
    },
    {
      id: 'wm3',
      text: '',
      fromMe: false,
      timestamp: '10:35',
      source: 'whatsapp',
      senderName: 'Maria Costa',
      attachment: {
        kind: 'sticker',
        uri: dicebear('shapes', 'sticker-wave', 'transparent'),
        width: 160,
        height: 160,
      },
    },
    {
      id: 'wm4',
      text: 'Mensagem apagada',
      fromMe: false,
      timestamp: '10:40',
      source: 'whatsapp',
      senderName: 'Maria Costa',
      deletedAt: '2026-05-24T10:42:00Z',
    },
    {
      id: 'wm5',
      text: 'Vê esta foto, só por um instante',
      fromMe: false,
      timestamp: '10:45',
      source: 'whatsapp',
      senderName: 'Maria Costa',
      viewOnce: true,
      media: { type: 'image', uri: dicebear('shapes', 'view-once-photo', 'FF6F61') },
    },
    {
      id: 'wm6',
      text: 'Combinado, esta mensagem desaparece em 24h',
      fromMe: true,
      timestamp: '10:50',
      status: 'read',
      source: 'whatsapp',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'wm7',
      text: '',
      fromMe: false,
      timestamp: '11:20',
      source: 'whatsapp',
      senderName: 'Maria Costa',
      attachment: {
        kind: 'location',
        place: 'A minha localização',
        address: 'Avenida da Liberdade, Lisboa',
        live: true,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: 'wm8',
      text: 'Já estou a caminho 🚗',
      fromMe: false,
      timestamp: '11:24',
      source: 'whatsapp',
      senderName: 'Maria Costa',
    },
    {
      id: 'wm9',
      text: 'Olha o que o pai partilhou no grupo — vale a pena ler.',
      fromMe: false,
      timestamp: '11:26',
      source: 'whatsapp',
      senderName: 'Maria Costa',
      forwarded: true,
    },
  ],

  // ── WhatsApp group (bridged) ───────────────────────────────────────────
  wag1: [
    {
      id: 'gm1',
      text: 'Bom dia família ☀️',
      fromMe: false,
      timestamp: '08:14',
      source: 'whatsapp',
      senderName: 'Mãe',
      senderAvatarUri: dicebear('avataaars', 'Mae', 'F472B6'),
    },
    {
      id: 'gm2',
      text: '@alex anda cá ver isto',
      fromMe: false,
      timestamp: '10:51',
      source: 'whatsapp',
      senderName: 'Tio Zé',
      senderAvatarUri: dicebear('avataaars', 'Tio Ze', '60A5FA'),
      mentions: ['alex'],
    },
    {
      id: 'gm3',
      text: '',
      fromMe: false,
      timestamp: '10:52',
      source: 'whatsapp',
      senderName: 'Tio Zé',
      senderAvatarUri: dicebear('avataaars', 'Tio Ze', '60A5FA'),
      attachment: {
        kind: 'sticker',
        uri: dicebear('shapes', 'sticker-thumbsup', 'transparent'),
        width: 160,
        height: 160,
      },
    },
    {
      id: 'gm4',
      text: 'Aviso do condomínio: amanhã há corte de água das 9h às 12h.',
      fromMe: false,
      timestamp: '10:55',
      source: 'whatsapp',
      senderName: 'Mãe',
      senderAvatarUri: dicebear('avataaars', 'Mae', 'F472B6'),
      forwarded: true,
    },
  ],
};

export const GROUPS: Record<string, GroupInfo> = {
  g1: {
    id: 'g1',
    name: 'Web3 Builders',
    avatarUri: dicebear('shapes', 'Web3 Builders', '6F8BFF'),
    description: 'Shipping open protocols together.',
    historyEnabled: true,
    historyMode: 'view-only',
    historyLimit: 10,
    members: [
      { id: 'u1', name: 'ninani.eth', username: '@ninani', avatarUri: dicebear('avataaars', 'ninani', 'FFD93D'), role: 'admin' },
      { id: 'u2', name: 'Samuel Garu', username: '@samgaru', avatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80'), role: 'admin' },
      { id: 'u3', name: 'Dr7e7t', username: '@dr7e7t', avatarUri: robohash('Dr7e7t8696c7bb4', 'set1'), role: 'member' },
      { id: 'u4', name: 'Anthony', username: '@anthony', avatarUri: dicebear('adventurer', 'Anthony', 'A78BFA'), role: 'member' },
      { id: 'u5', name: 'k&8.eth', username: '@k8eth', avatarUri: dicebear('lorelei', 'k8eth', 'FF6FB5'), role: 'member' },
      { id: 'u6', name: 'You', username: '@you', avatarUri: dicebear('avataaars', 'you', 'EEF2FF'), role: 'member' },
    ],
  },
};

/** Who can see this story. */
export type StoryVisibility = 'public' | 'contacts' | 'close';

export type StoryKind = 'image' | 'video' | 'text' | 'audio' | 'poll' | 'question';

export type StoryComment = {
  id: string;
  author: string;
  avatarUri: string;
  text: string;
  postedAt: string;
  isAnonymous?: boolean;
  /** Nested replies on the public comment thread. */
  replies?: StoryComment[];
};

export type Story = {
  id: string;
  user: string;
  username: string;
  avatarUri: string;
  coverUri: string;
  kind: StoryKind;
  caption: string;
  postedAt: string;
  expiresIn: string;
  durationSec: number;
  accent: string;
  viewers: number;
  replies: number;
  isViewed: boolean;
  isOwn?: boolean;
  /** Audience: everyone, contacts only, or close friends. */
  visibility?: StoryVisibility;
  /** Author posted without revealing identity. */
  isAnonymous?: boolean;
  allowComments?: boolean;
  /** Viewers may reply as anonymous on the public thread. */
  allowAnonymousReplies?: boolean;
  comments?: StoryComment[];
  /** Optional audio duration for voice stories (seconds). */
  audioSec?: number;
  /** Live broadcast story — no auto-advance, live chat. */
  isLive?: boolean;
  liveViewers?: number;
  /**
   * Client-only upload lifecycle for background publish (WhatsApp-style).
   * Absent / undefined once the server has accepted the story.
   */
  uploadStatus?: 'uploading' | 'failed';
};

/** Placeholder covers for channel mock seed only (stories use the API). */
const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/1400`;

export type UserProfile = {
  name: string;
  username: string;
  avatarUri: string;
  bio: string;
  location: string;
  link: string;
  stats: { chats: number; stories: number; contacts: number };
};

export const CURRENT_USER: UserProfile = {
  name: 'Alex Landa',
  username: '@alexlanda',
  avatarUri: dicebear('avataaars', 'you', 'EEF2FF'),
  bio: 'Building communication tools for everyone. Open-source advocate, coffee-driven, shipping in public.',
  location: 'Luanda, Angola',
  link: 'socialize.app/@alexlanda',
  stats: { chats: 48, stories: 6, contacts: 213 },
};

/** Thumbnails for the profile "Media" tab. */
export const PROFILE_MEDIA: string[] = Array.from({ length: 9 }, (_, i) =>
  dicebear('shapes', `media-${i}`, ['EEF2FF', 'FFD93D', 'A78BFA', '4ADE80', 'FF6FB5', '22D3EE'][i % 6]),
);

export type ProfileNote = { id: string; text: string; timestamp: string };

export const PROFILE_NOTES: ProfileNote[] = [
  { id: 'n1', text: 'Shipped the group history feature today 🚀', timestamp: '2h' },
  { id: 'n2', text: 'Looking for testnet feedback — DMs open.', timestamp: 'Yesterday' },
  { id: 'n3', text: 'gm to everyone building in public ☀️', timestamp: 'Mon' },
];

export type CallRecord = {
  id: string;
  chatId: string;
  name: string;
  avatarUri: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: string;
};

export const CALLS: CallRecord[] = [
  { id: 'call1', chatId: 'c1', name: 'ninani.eth', avatarUri: dicebear('avataaars', 'ninani', 'FFD93D'), type: 'video', direction: 'incoming', timestamp: 'Today, 09:42' },
  { id: 'call2', chatId: 'c2', name: 'Samuel Garu', avatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80'), type: 'voice', direction: 'outgoing', timestamp: 'Today, 08:15' },
  { id: 'call3', chatId: 'c4', name: 'Anthony', avatarUri: dicebear('adventurer', 'Anthony', 'A78BFA'), type: 'voice', direction: 'missed', timestamp: 'Today, 07:50' },
  { id: 'call4', chatId: 'c5', name: 'k&8.eth', avatarUri: dicebear('lorelei', 'k8eth', 'FF6FB5'), type: 'video', direction: 'missed', timestamp: 'Yesterday, 22:03' },
  { id: 'call5', chatId: 'c6', name: 'Margareth Joanne C.', avatarUri: dicebear('micah', 'Margareth Joanne', '22D3EE'), type: 'voice', direction: 'incoming', timestamp: 'Yesterday, 18:30' },
  { id: 'call6', chatId: 'c7', name: 'Joe Felix', avatarUri: dicebear('pixel-art', 'Joe Felix', '6F8BFF'), type: 'video', direction: 'outgoing', timestamp: 'Yesterday, 14:11' },
  { id: 'call7', chatId: 'c3', name: 'Dr7e7t', avatarUri: robohash('Dr7e7t8696c7bb4', 'set1'), type: 'voice', direction: 'missed', timestamp: 'Mon, 20:47' },
  { id: 'call8', chatId: 'c2', name: 'Samuel Garu', avatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80'), type: 'voice', direction: 'incoming', timestamp: 'Mon, 11:25' },
];

/** Discover — broadcast channels. Categories drive the filter chips. */
export const CHANNEL_CATEGORIES = ['all', 'crypto', 'nft', 'tech', 'gaming', 'news'] as const;
export type ChannelCategory = (typeof CHANNEL_CATEGORIES)[number];

export type ChannelPostType = 'text' | 'image' | 'video' | 'game' | 'live' | 'voice';

export type ChannelGameKind = 'trivia' | 'dice' | 'would_you_rather' | 'quick_draw' | 'emoji_race';

export type ChannelPost = {
  id: string;
  text: string;
  mediaUri?: string;
  timestamp: string;
  views: number;
  reactions?: ChannelReaction[];
  myReaction?: string | null;
  comments?: ChannelComment[];
  /** Post kind — defaults to text/image based on mediaUri when omitted. */
  type?: ChannelPostType;
  gameKind?: ChannelGameKind;
  /** Live / voice hangout is currently active. */
  isLive?: boolean;
  liveViewers?: number;
};

export type ChannelReaction = {
  emoji: string;
  count: number;
};

export type ChannelComment = {
  id: string;
  text: string;
  timestamp: string;
  anonymous: boolean;
  authorName?: string;
  pending?: boolean;
  likes?: number;
  liked?: boolean;
  replies?: ChannelComment[];
};

export type Channel = {
  id: string;
  name: string;
  handle: string;
  avatarUri: string;
  coverUri: string;
  description: string;
  category: Exclude<ChannelCategory, 'all'>;
  members: number;
  verified: boolean;
  rules?: string[];
  posts: ChannelPost[];
};

export const CHANNELS: Channel[] = [
  {
    id: 'ch1',
    name: 'Socialize',
    handle: '@socialize',
    avatarUri: dicebear('shapes', 'Socialize HQ', '2D5BFF'),
    coverUri: cover('socialize-cover'),
    description: 'Official updates, releases, and announcements from the Socialize team.',
    category: 'news',
    members: 48200,
    verified: true,
    posts: [
      {
        id: 'p1',
        text: 'Group chat history is now live — new members can catch up on past messages. Admins control how far back it goes.',
        timestamp: '2h',
        views: 41200,
        reactions: [
          { emoji: '❤️', count: 1200 },
          { emoji: '🔥', count: 430 },
          { emoji: '👏', count: 260 },
        ],
        myReaction: '❤️',
        comments: [
          {
            id: 'c1',
            text: 'Finally, this makes onboarding so much better.',
            timestamp: '1h',
            anonymous: false,
            authorName: 'Maya',
            likes: 12,
            replies: [
              {
                id: 'c1r1',
                text: 'Agreed — the new flow feels so much smoother.',
                timestamp: '48m',
                anonymous: false,
                authorName: 'Leo',
                likes: 3,
              },
              {
                id: 'c1r2',
                text: 'Took me 30 seconds to get set up.',
                timestamp: '20m',
                anonymous: true,
                likes: 1,
              },
            ],
          },
          {
            id: 'c2',
            text: 'Huge improvement for community groups.',
            timestamp: '52m',
            anonymous: true,
            likes: 5,
          },
        ],
      },
      {
        id: 'p2',
        text: 'Dark mode got a full refresh: calmer charcoal surfaces, the royal blue finally pops.',
        mediaUri: cover('ch1-dark'),
        timestamp: 'Yesterday',
        views: 38800,
        reactions: [
          { emoji: '😍', count: 980 },
          { emoji: '✨', count: 420 },
        ],
      },
      { id: 'p3', text: 'Stories now slide between users instead of reloading. Smoother, faster, no flash.', timestamp: 'Mon', views: 35100 },
    ],
  },
  {
    id: 'ch2',
    name: 'Web3 Daily',
    handle: '@web3daily',
    avatarUri: dicebear('icons', 'Web3 Daily', '6F8BFF'),
    coverUri: cover('web3daily-cover'),
    description: 'Markets, protocols, and the onchain economy — one concise briefing a day.',
    category: 'crypto',
    members: 31100,
    verified: true,
    posts: [
      { id: 'p1', text: 'Gas is back under 12 gwei. Good window if you have been sitting on transactions.', timestamp: '40m', views: 21400 },
      { id: 'p2', text: 'Weekly briefing: L2 volume hit a new high, stablecoin supply flat, three notable governance votes closing Friday.', timestamp: '6h', views: 27900 },
      { id: 'p3', text: 'Reminder: never sign a transaction you cannot read. Bookmark the official site.', timestamp: 'Yesterday', views: 30200 },
    ],
  },
  {
    id: 'ch3',
    name: 'NFT Radar',
    handle: '@nftradar',
    avatarUri: dicebear('icons', 'NFT Radar', 'FF6FB5'),
    coverUri: cover('nftradar-cover'),
    description: 'Mints, drops, and floor moves worth your attention. Curated, not hyped.',
    category: 'nft',
    members: 22400,
    verified: true,
    posts: [
      { id: 'p1', text: 'Mango_Apes floor up 18% this week. Volume is real, not wash.', mediaUri: cover('ch3-apes'), timestamp: '1h', views: 18600 },
      { id: 'p2', text: 'Mint calendar for the week is pinned. Three drops we are actually watching.', timestamp: 'Yesterday', views: 16100 },
      { id: 'p3', text: 'Generative art is having a moment again. More on that tomorrow.', timestamp: 'Mon', views: 14800 },
    ],
  },
  {
    id: 'ch4',
    name: 'Dev Corner',
    handle: '@devcorner',
    avatarUri: dicebear('icons', 'Dev Corner', '22D3EE'),
    coverUri: cover('devcorner-cover'),
    description: 'Engineering notes, tooling, and shipping culture for builders.',
    category: 'tech',
    members: 15800,
    verified: false,
    posts: [
      { id: 'p1', text: 'A layout effect runs before paint. That single fact fixes most "flash of wrong content" bugs.', timestamp: '3h', views: 9400 },
      { id: 'p2', text: 'Prefetch the next thing while the user looks at the current thing. Cheap, huge perceived speed win.', timestamp: 'Yesterday', views: 11200 },
      { id: 'p3', text: 'Reminder: a fade from opacity 0 always has a blank frame. Slide instead.', timestamp: 'Tue', views: 12750 },
    ],
  },
  {
    id: 'ch5',
    name: 'Pixel Arena',
    handle: '@pixelarena',
    avatarUri: dicebear('icons', 'Pixel Arena', '4ADE80'),
    coverUri: cover('pixelarena-cover'),
    description: 'Indie games, onchain gaming, and the occasional late-night speedrun.',
    category: 'gaming',
    members: 19600,
    verified: false,
    posts: [
      { id: 'p1', text: 'New indie roguelike dropped and it is dangerously good. Review thread soon.', mediaUri: cover('ch5-game'), timestamp: '5h', views: 13300 },
      { id: 'p2', text: 'Community tournament this weekend. Bracket sign-ups are open.', timestamp: 'Yesterday', views: 10900 },
      { id: 'p3', text: 'Hot take: input latency matters more than resolution. Fight me in the replies.', timestamp: 'Mon', views: 15400 },
    ],
  },
  {
    id: 'ch6',
    name: 'Builder Mindset',
    handle: '@buildermindset',
    avatarUri: dicebear('icons', 'Builder Mindset', 'A78BFA'),
    coverUri: cover('buildermindset-cover'),
    description: 'Short essays on focus, craft, and shipping in public.',
    category: 'tech',
    members: 27300,
    verified: true,
    posts: [
      { id: 'p1', text: 'The work that compounds is rarely the work that feels urgent. Protect the quiet hours.', timestamp: '2h', views: 22100 },
      { id: 'p2', text: 'Ship the smallest version that is honest. Then listen.', timestamp: 'Yesterday', views: 24500 },
      { id: 'p3', text: 'You do not need more ideas. You need to finish one.', timestamp: 'Sun', views: 28900 },
    ],
  },
  {
    id: 'ch7',
    name: 'Onchain Alpha',
    handle: '@onchainalpha',
    avatarUri: dicebear('icons', 'Onchain Alpha', 'FFD93D'),
    coverUri: cover('onchainalpha-cover'),
    description: 'Research threads and early signals. Not financial advice.',
    category: 'crypto',
    members: 12900,
    verified: false,
    posts: [
      { id: 'p1', text: 'Wallet clustering suggests early accumulation in a few infra tokens. Thread below.', timestamp: '90m', views: 8700 },
      { id: 'p2', text: 'Do your own research. This channel is a starting point, not a destination.', timestamp: 'Yesterday', views: 9900 },
      { id: 'p3', text: 'Three protocols quietly shipped major upgrades this week. Most people missed it.', timestamp: 'Tue', views: 11300 },
    ],
  },
  {
    id: 'ch8',
    name: 'Frame & Form',
    handle: '@frameandform',
    avatarUri: dicebear('icons', 'Frame and Form', 'EEF2FF'),
    coverUri: cover('frameandform-cover'),
    description: 'Generative art, design systems, and the craft behind the pixels.',
    category: 'nft',
    members: 8700,
    verified: false,
    posts: [
      { id: 'p1', text: 'A design system is a memory. It remembers the right decision so you do not redo it.', timestamp: '4h', views: 6100 },
      { id: 'p2', text: 'New generative series explores low-chroma palettes. Preview attached.', mediaUri: cover('ch8-series'), timestamp: 'Yesterday', views: 7400 },
      { id: 'p3', text: 'Constraint is not the enemy of creativity. It is the shape of it.', timestamp: 'Mon', views: 8050 },
    ],
  },
];
