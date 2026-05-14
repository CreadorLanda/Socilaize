# 💬 Messaging Core

> Documentation for Socialize messaging features.

---

## Direct Chat (1:1)

### Send Message

```typescript
// Send text message
const message = await chatService.sendMessage({
  to: 'user_id',
  content: 'Hello! 👋',
  type: 'text'
});
```

### Message Types

| Type | Description | Limit |
|------|-------------|-------|
| `text` | Plain text | 10,000 characters |
| `image` | Image | 25MB |
| `video` | Video | 100MB |
| `audio` | Audio/Voice note | 25MB |
| `document` | Document | 100MB |
| `location` | Location | - |
| `contact` | Contact | - |

### Reactions

Support reactions with emojis:

```
❤️ 😂 😮 😢 😡 👍 👎 🔥 🎉 😍
```

Long-press on a message to react.

---

## 👥 Groups

### Create Group

1. Tap "New Chat"
2. Select "New Group"
3. Add participants (minimum 3)
4. Set group name
5. (Optional) Add photo
6. Tap "Create"

### Group Permissions

| Role | Description |
|------|-------------|
| **Admin** | Manage members, settings |
| **Moderator** | Remove messages, silence |
| **Member** | Participate normally |

### Limits

| Resource | Limit |
|----------|-------|
| Members | 1,000 |
| Admins | 50 |
| Description | 500 characters |
| Group name | 100 characters |

---

## 📢 Channels

### Create Channel

1. Go to "Channels"
2. Tap "+"
3. Choose "Create Channel"
4. Configure:
   - Name
   - Description
   - Photo (optional)
   - Public or private
5. Tap "Create"

### Channel Types

| Type | Access |
|------|--------|
| **Public** | Anyone can find and join |
| **Private** | Only with invite/link |

---

## ⏰ Scheduled Messages

### Schedule Message

1. Write your message
2. Long-press the send button
3. Select "Schedule"
4. Choose date and time
5. Confirm

### Manage

Your scheduled messages appear in:
- 💭 Drafts
- ⏰ Scheduled

---

## ✏️ Edit Messages

### How to Edit

1. Long-press the message
2. Select "Edit"
3. Modify content
4. Send

### Rules

- Up to 15 minutes after sending
- Original shown as "Edited"
- Edit history available

---

## 🗑️ Delete Messages

### Delete Options

| Option | Effect |
|--------|-------|
| **For me** | Remove only for you |
| **For everyone** | Remove for all |
| **Scheduled** | Cancel scheduled message |

### Anti-Delete

Configure to keep messages even when sender tries to delete them:

```typescript
// Anti-delete configuration
const settings = {
  antiDelete: {
    enabled: true,  // keep messages
    duration: '30d',  // for 30 days
    storage: 'local'  // or 'cloud'
  }
};
```

---

## Status

| Status | Icon | Meaning |
|--------|------|--------|
| ⏳ | Sending | Being sent |
| ✅ | Sent | Reached server |
| 📖 | Seen | Recipient read |
| ❌ | Error | Send failed |

---

## 📝 Voice Notes

### Record

1. Long-press 🎤
2. Record your message
3. Release to send

### Options

- 🎤 Record
- ⏹️ Pause
- ❌ Cancel
- 🔄 Redo

---

## References

- [API Reference](../tech/api.md)
- [Database Schema](../tech/database.md)