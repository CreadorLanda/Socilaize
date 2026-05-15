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
};

export const CHATS: ChatPreview[] = [
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
];

export type MediaAttachment = {
  type: 'image' | 'video';
  uri: string;
  durationSec?: number;
};

export type Message = {
  id: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
  media?: MediaAttachment;
};

export const MESSAGES: Record<string, Message[]> = {
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
  ],
  c2: [
    { id: 'm1', text: 'Studio Sat afternoon?', fromMe: true, timestamp: '09:28', status: 'read' },
    { id: 'm2', text: 'Yeah let’s do Sat afternoon, I’ll book the studio.', fromMe: false, timestamp: '09:31' },
  ],
  c3: [
    { id: 'm1', text: 'gm', fromMe: true, timestamp: '09:10', status: 'delivered' },
    { id: 'm2', text: 'Mango_Apes #4839 just sold for 12.4 ETH 🚀', fromMe: false, timestamp: '09:14' },
  ],
};

export type Story = {
  id: string;
  user: string;
  username: string;
  avatarUri: string;
  coverUri: string;
  isViewed: boolean;
  isOwn?: boolean;
};

export const STORIES: Story[] = [
  {
    id: 's0',
    user: 'You',
    username: '@you',
    avatarUri: dicebear('avataaars', 'you', 'EEF2FF'),
    coverUri: dicebear('shapes', 'you-cover', 'EEF2FF'),
    isViewed: false,
    isOwn: true,
  },
  {
    id: 's1',
    user: 'ninani.eth',
    username: '@ninani',
    avatarUri: dicebear('avataaars', 'ninani', 'FFD93D'),
    coverUri: dicebear('shapes', 'ninani-cover', 'FFD93D'),
    isViewed: false,
  },
  {
    id: 's2',
    user: 'Samuel Garu',
    username: '@samgaru',
    avatarUri: dicebear('big-smile', 'Samuel Garu', '4ADE80'),
    coverUri: dicebear('shapes', 'samuel-cover', '4ADE80'),
    isViewed: false,
  },
  {
    id: 's3',
    user: 'Anthony',
    username: '@anthony',
    avatarUri: dicebear('adventurer', 'Anthony', 'A78BFA'),
    coverUri: dicebear('shapes', 'anthony-cover', 'A78BFA'),
    isViewed: true,
  },
  {
    id: 's4',
    user: 'k&8.eth',
    username: '@k8eth',
    avatarUri: dicebear('lorelei', 'k8eth', 'FF6FB5'),
    coverUri: dicebear('shapes', 'k8eth-cover', 'FF6FB5'),
    isViewed: true,
  },
  {
    id: 's5',
    user: 'Joe Felix',
    username: '@joefelix',
    avatarUri: dicebear('pixel-art', 'Joe Felix', '6F8BFF'),
    coverUri: dicebear('shapes', 'joefelix-cover', '6F8BFF'),
    isViewed: true,
  },
];
