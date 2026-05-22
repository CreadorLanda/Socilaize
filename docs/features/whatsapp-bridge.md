# 🌉 WhatsApp Bridge

> Integration with WhatsApp via Evolution API / mautrix.

---

## Overview

| Feature | Description |
|---------|-------------|
| **Connection** | Link WhatsApp to Socialize |
| **Messaging** | Send/receive WhatsApp messages |
| **Sync** | Contact synchronization |
| **Media** | Image, video, audio transfer |

---

## Architecture

```
Socialize User ←→ Socialize API ←→ Evolution API ←→ WhatsApp
```

---

## Features

### 1. WhatsApp Connection

- QR code pairing
- Session management
- Multiple devices support

### 2. Message Bridge

| Direction | Description |
|----------|-------------|
| WA → Socialize | Receive WhatsApp messages in app |
| Socialize → WA | Send from app to WhatsApp |

### 3. Contact Sync

- Import WhatsApp contacts
- Link to Socialize users

### 4. Media Handling

- Automatic download
- Forward to chat
- Quality preservation

---

## API Endpoints

```go
// Connection
POST   /api/whatsapp/connect      // Start pairing
GET    /api/whatsapp/status       // Check connection
DELETE /api/whatsapp/disconnect  // Logout

// Messaging  
POST   /api/whatsapp/send        // Send to WhatsApp
GET    /api/whatsapp/chats       // List WhatsApp chats
GET    /api/whatsapp/messages    // Get messages

// Settings
PUT    /api/whatsapp/settings   // Configure bridge
```

---

## Use Cases

1. **Use WhatsApp from Socialize**
   - Single app for all messaging
   
2. **Migration**
   - Move from WhatsApp to Socialize

3. **Backup**
   - Keep WhatsApp accessible
