# 📱 Stories (Estados)

> Complete documentation for Instagram-like Stories with filters and audio.

---

## Overview

| Feature | Status | Description |
|---------|--------|-------------|
| Photo Stories | ✅ | Photo with filters |
| Video Stories | ✅ | Auto-play videos |
| Audio Stories | 🎵 | Voice/note as story |
| Animations | ✨ | Auto-play animations |
| "Listening" | 🎵 | Currently playing song |
| Filters | 🎨 | Image filters |

---

## 1. Story Types

### 1.1 Photo Stories

**With Filters:**
- Take photo → Apply filter → Share

**Filters Available:**

| Filter | Effect |
|--------|-------|
| Normal | No effect |
| Clarendon | Boosted darks, brightens |
| Gingham | Warm, bright |
| Moon | Grey, cool |
| Lark | Oversaturated darks |
| Reyes | Vintage, bright |
| Juno | Green shadows |
| Slumber | Desaturated, warm |
| Crema | Vintage, warm |
| Ludwig | Slight light leak |
| Aden | Pink tones |

### 1.2 Video Stories

- Auto-play with sound
- Tap to pause
- Swipe to skip

### 1.3 Audio/Voice Stories

| Type | Description | Duration |
|------|-------------|----------|
| Voice Note | Record voice | 30s max |
| Music | Playing song | Full song |
| Audio File | Import audio | 60s max |

---

## 2. "Now Listening" (MSN Style)

### Music Status

Show what you're listening to:

```json
{
  "story_type": "music",
  "media": {
    "song": "Song Title",
    "artist": "Artist Name",
    "album": "Album Name",
    "album_art": "url",
    "duration": "3:45",
    "source": "spotify" | "apple" | "local"
  }
}
```

### Display

- Album art as background
- Song info overlay
- Swipe for next song

### Synced Music

| Source | Supported |
|--------|-----------|
| Spotify | ✅ |
| Apple Music | ✅ |
| Deezer | ✅ |
| Local Files | ✅ |

---

## 3. Story Creation

### Full Screen Camera

```
📱 Full Screen Camera
├── [Flash] [Flip] [Timer] [Speed]
├──
├──    [    ] (viewfinder)
├──
├── [Gallery] [Stickers] [Text]
├──
└── [Capture]
```

### Quick Capture

- Tap: Take photo
- Hold: Record video
- Speed: 0.3x, 0.5x

### Editing

| Feature | Description |
|--------|-------------|
| Text | Add text overlay |
| Stickers | Add stickers |
| Draw | Draw on story |
| Filters | Apply filters |
| Crop | Resize |
| Trim | Trim video |

---

## 4. Animation Stories

### Auto-Play Animations

| Type | Description |
|------|-------------|
| Auto | Animation plays automatically |
| Loop | Seamless loop |

### Animation Sources

- Built-in animations
- Import from GIF
- Use video

### Technical

```
Animation: MP4/WebM
Duration: 3-15 seconds
Auto-play: Yes
Sound: Optional
```

---

## 5. Story Features

### Viewing

```
Swipe: Next/Previous story
Tap Left: Previous
Tap Right: Next
Hold: Pause
Double Tap: Like/React
Long Press: Message privately
```

### Reactions

| Gesture | Reaction |
|--------|----------|
| Double Tap | ❤️ |
| Long Press | Reaction picker |

### Sharing

- Share to chat
- Forward to story
- Save to gallery

---

## 6. Story Analytics

### For Creators

```json
{
  "story_id": "uuid",
  "views": 150,
  "unique_viewers": 120,
  "replies": 5,
  "shares": 10,
  "saves": 3,
  "links_clicks": 2
}
```

---

## 7. Story Settings

### Privacy

| Setting | Description |
|--------|-------------|
| Public | Everyone can view |
| Contacts | Only contacts |
| Close Friends | Close friends only |
| Custom | Selected users |

### Duration

| Setting | Hours |
|--------|-------|
| Default | 24h |
| 6 hours | 6h |
| 12 hours | 12h |
| 3 days | 72h |

---

## 8. Highlights

### Creating Highlights

- Save stories to highlights
- Edit cover
- Arrange order

### Highlight Types

| Highlight | Cover |
|-----------|-------|
| Travel | Photo from story |
| Food | Food story |
| Friends | Group photo |
| Custom | Custom image |

---

## 9. API

```http
POST /api/stories/photo
Content-Type: multipart/form-data
{
  "photo": "file",
  "filter": "clarendon",
  "text": "optional caption"
}

POST /api/stories/video
{
  "video": "file",
  "duration": "video length"
}

POST /api/stories/music
{
  "media": "spotify_track_id"
}

GET /api/stories/public
GET /api/stories/contacts
```

---

## 10. Quick Actions

### Story Actions

| Action | How |
|--------|-----|
| Like | Double tap |
| Reply | Swipe up |
| Send | Share to chat |
| Save | Click bookmark |

### Creator Actions

| Action | How |
|--------|-----|
| Add | + button |
| Text | Aa button |
| Sticker | 😎 button |
| Filter | Swipe |
| Draw | ✏️ button |
