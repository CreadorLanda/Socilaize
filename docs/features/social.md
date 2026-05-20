# 🌟 Social Features

> Complete documentation for Socialize social features.

---

## 1. Stories

> Temporary posts that expire after a set duration.

### Overview

| Feature | Description |
|---------|-------------|
| Duration | Default 24h, configurable up to 3 days (72h) |
| Media Types | Text, Image, Video |
| Visibility | Contacts only, Public, Custom |
| Auto-Crop | Videos > 2 minutes are trimmed |

---

### 1.1 Creating Stories

**Creating via App:**

1. Tap your profile picture (circular, top)
2. Select "Add to Story"
3. Choose content type:
   - 📷 **Camera** - Take photo/video
   - 🖼️ **Gallery** - Select from gallery
   - ✏️ **Text** - Create text story
4. Add effects (text, stickers, etc.)
5. Set duration (optional)
6. Set visibility (optional)
7. Tap "Share"

**Creating via API:**

```http
POST /api/stories
Authorization: Bearer <token>
Content-Type: multipart/form-data

// OR with text
{
  "content": "Check out our new feature!",
  "content_type": "text",
  "duration": 86400,  // seconds (24h default, max 72h = 259200)
  "visibility": "contacts" | "public" | "custom"
}
```

---

### 1.2 Story Duration

| Setting | Seconds | Hours |
|---------|---------|-------|
| **Default** | 86,400 | 24h |
| 1 hour | 3,600 | 1h |
| 6 hours | 21,600 | 6h |
| 12 hours | 43,200 | 12h |
| **24 hours** | 86,400 | 24h |
| **2 days** | 172,800 | 48h |
| **3 days** | 259,200 | 72h |

**Configuration:**

```typescript
interface StorySettings {
  default_duration: number;  // seconds
  max_duration: number;        // 259200 (3 days)
  allow_public: boolean;      // public stories
  auto_crop_videos: boolean; // trim videos > 2min
}

// Set duration when creating
{
  "content": "my-video.mp4",
  "duration": 172800  // 48 hours
}
```

---

### 1.3 Story Visibility

| Type | Who Can See |
|------|-------------|
| **Contacts** | Only saved contacts |
| **Public** | Anyone, even non-contacts |
| **Custom** | Select specific users/groups |

**Public Stories:**

```
Story Visibility Options:
├── 🔒 Contacts Only    (default)
├── 🌐 Public          (anyone can view)
└── 👥 Custom         [Select users]
```

**Public Story Features:**

```typescript
interface PublicStory {
  id: string;
  content_url: string;
  visibility: "public";
  view_count: number;
  allow_comments: boolean;
  allow_reactions: boolean;
}
```

**Viewing Public Stories:**

```http
GET /api/stories/public
GET /api/stories/public?user_id=xxx
GET /api/stories/public?limit=20&offset=0
```

---

### 1.4 Auto-Crop Videos

> Videos longer than 2 minutes are automatically trimmed.

**How It Works:**

```
Original Video: 5 minutes (300s)
         ↓
Auto-Crop: First 2 minutes (120s)
         ↓
Story: 2 minute video
```

**Configuration:**

```typescript
interface AutoCropSettings {
  enabled: boolean;       // default: true
  max_duration: number;    // default: 120 (2 min)
  trim_start: boolean;     // keep beginning (vs end)
  trim_at: number;        // timestamp to trim at
}
```

**Manual Override:**

```json
{
  "content": "long-video.mp4",
  "auto_crop": false,  // disable auto-crop
  "duration": 180000   // 50 minutes (custom trim)
}
```

---

### 1.5 Story Reactions

React with multiple emojis from keyboard.

**Supported Reactions:**

```
Standard:    ❤️ 😂 😮 😢 😡 👍 👎 🔥 🎉 😍 👏
Extended:    🙌 💪 🙏 😇 ❤️‍🔥 💯 ⭐ 🌟 ✨ 🆕 😁 😎 🥳 😍
Custom:     [your custom emojis]
```

**Reacting (Single):**

```http
POST /api/stories/:id/reactions
{
  "reaction": "🔥"
}
```

**Reacting (Multiple):**

```http
POST /api/stories/:id/reactions
{
  "reactions": ["🔥", "❤️", "🎉"]  // array for multiple
}
```

**Response:**

```json
{
  "reactions": {
    "🔥": 5,
    "❤️": 12,
    "🎉": 3
  },
  "user_reactions": ["🔥", "❤️"]
}
```

**From Keyboard:**

1. Long-press story
2. Reaction bar appears
3. Tap multiple emojis to react with all at once
4. Or use custom emoji picker

---

### 1.6 Story Comments

> Comment on stories (when enabled).

**Enabling Comments:**

```json
// When creating story
{
  "content": "My story",
  "allow_comments": true
}

// OR after creating
PUT /api/stories/:id
{
  "allow_comments": true
}
```

**Commenting:**

```http
POST /api/stories/:id/comments
{
  "text": "This is amazing! 🔥"
}
```

**Viewing Comments:**

```http
GET /api/stories/:id/comments
```

**Comment Options:**

| Setting | Description |
|---------|-------------|
| `allow_comments` | Enable/disable comments |
| `comment_limit` | Max comments per story |
| `filter_spam` | Auto-filter spam |

---

### 1.7 Story Viewer

**View Stories:**

```http
GET /api/stories
// Returns: own stories + contacts' stories

GET /api/stories/public
// Returns: public stories from anyone

GET /api/users/:id/stories
// Returns: specific user's stories
```

**Story Response:**

```json
{
  "stories": [
    {
      "id": "story_uuid",
      "user_id": "user_uuid",
      "content_url": "https://cdn.socialize.app/stories/...",
      "content_type": "video",
      "thumbnail_url": "https://cdn.socialize.app/thumbs/...",
      "duration": "15s",
      "visible_until": "2026-05-15T12:00:00Z",
      "visibility": "contacts",
      "view_count": 150,
      "reactions": {"❤️": 5, "🔥": 3},
      "comments": 2,
      "created_at": "2026-05-14T12:00:00Z"
    }
  ]
}
```

---

### 1.8 Story Analytics

**For Creators:**

```http
GET /api/stories/:id/insights
```

**Response:**

```json
{
  "story_id": "uuid",
  "views": 150,
  "unique_viewers": 120,
  "reactions": {
    "❤️": 5,
    "🔥": 3
  },
  "comments": 2,
  "shares": 10,
  "completion_rate": 0.85,  // 85% watched fully
  "avg_watch_time": "12s"
}
```

---

## 2. Multi-Identity Profiles

### Creating Profiles

```http
POST /api/profiles
{
  "name": "Work Profile",
  "bio": "Developer at Company",
  "avatar_url": "...",
  "visibility": "custom",
  "allowed_contacts": ["user_id_1", "user_id_2"]
}
```

### Switching Profiles

```
Profile Switcher (swipe left on camera):
├── 👤 Main Profile
├── 💼 Work Profile
├── 🎮 Gaming Profile
└── ➕ Create New
```

---

## 3. Music Status

### Display Current Song

```json
{
  "music_status": {
    "song": "Bohemian Rhapsody",
    "artist": "Queen",
    "album": "A Night at the Opera",
    "spotify_url": "..."
  }
}
```

---

## 4. Mini Apps

### Running Mini Apps

```http
GET /api/mini-apps
// Returns available mini apps
```

### Popular Mini Apps

| App | Description |
|-----|-------------|
| 🧮 Calculator | Quick calculations |
| 📅 Calendar | Events and reminders |
| 📝 Polls | Create polls |
| ⏱️ Timer | Countdown timer |
| 💱 Currency | Currency converter |
| 🎲 Dice | Roll dice |
| 🎯 Truth or Dare | Party game |

---

## 5. Story View Counts

| Metric | Description |
|--------|-------------|
| Views | Total story views |
| Unique Viewers | Different users who viewed |
| Recipients | Users who got story in DM |
| Forwarded | Times story was forwarded |

---

## 6. Story Privacy Settings

```typescript
interface StoryPrivacy {
  allow_replies: 'none' | 'contacts' | 'everyone';
  allow_reactions: boolean;
  allow_screenshots: boolean;
  auto_delete_views: boolean;
  hide_story_from: string[];  // user IDs to hide from
}
```
