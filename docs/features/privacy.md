# 🔒 Privacy

> Complete documentation for Socialize privacy features.

---

## 1. Ghost Mode

> Complete invisibility - others cannot see you're online, typing, or read messages.

### Ghost Levels

| Level | Online Status | Typing Status | Last Seen | Recording |
|-------|-------------|-------------|----------|-----------|
| **🔵 Light** | Hidden | Visible | Hidden | Visible |
| **🟡 Medium** | Hidden | Hidden | Hidden | Visible |
| **🔴 Full** | Hidden | Hidden | Hidden | Hidden |

### Visual Representation

```
Normal Mode:     👤 Online   💬 typing...   Visto às 14:30
Light Mode:     👤 Last seen recently    Visto às 14:30  
Medium Mode:    👤 Last seen recently
Full Mode:     👤 
```

### How to Activate

**Quick Method:**
1. Swipe down from top → Quick Settings
2. Tap 👻 ghost icon
3. Select ghost level

**Settings Method:**
1. Settings → Privacy → Ghost Mode
2. Activate → Choose level

---

## 2. App Lock

### Lock Methods

| Method | Description | Setup |
|--------|-------------|-------|
| **PIN** | 4-6 digit code | Create PIN |
| **Pattern** | Draw pattern | Draw pattern |
| **Fingerprint** | Use fingerprint | Enroll fingerprint |
| **Face ID** | Use face recognition | Scan face |

### Configuration

```typescript
interface AppLockConfig {
  enabled: boolean;
  method: 'pin' | 'pattern' | 'fingerprint' | 'faceid';
  auto_lock_timeout: number;  // seconds
  lock_on_background: boolean;
}
```

### Auto-Lock Options

| Setting | Behavior |
|---------|----------|
| Immediately | Lock when app leaves foreground |
| 30 seconds | Lock after 30s in background |
| 1 minute | Lock after 1min in background |
| 5 minutes | Lock after 5min in background |
| Never | Only manual lock |

---

## 3. Chat Lock

### Lock a Chat

1. Open conversation
2. Tap conversation name
3. Tap lock icon 🔒
4. Confirm

### Chat Lock Options

| Option | Description |
|--------|-------------|
| **Every time** | Requires auth on every open |
| **When opened** | Once per session |
| **Fingerprint** | Requires fingerprint each time |

### Locked Chat Indicators

```
Normal chat:    💬 Company Team
Locked chat:   🔒 Company Team 👁️
```

---

## 4. Anti-Delete Messages

### What It Does

When enabled, messages are preserved even when the sender tries to delete them.

```
Sender sends:    "Hello!"
Sender deletes:  "This message was deleted"

With Anti-Delete:
Sender sends:    "Hello!"
Sender deletes:  "Hello!" (still visible)
```

### Configuration

```typescript
interface AntiDeleteConfig {
  enabled: boolean;
  duration: 'forever' | '30d' | '90d' | '1y';
  storage: 'local' | 'cloud';
}
```

### Storage Options

| Storage | Pros | Cons |
|--------|------|------|
| **Local** | Free, private | Not synced across devices |
| **Cloud** | Synced | Uses storage quota |

---

## 5. Last Seen Control

### Privacy Options

| Option | Who Can See |
|--------|------------|
| **Everyone** | All Socialize users |
| **My contacts** | Only saved contacts |
| **Nobody** | Completely hidden |
| **Custom** | Select specific contacts |

### Configuration Screen

```
Last Seen
├── 👥 Everyone         (o)
├── 📱 My contacts      ( )
├── 🚫 Nobody          ( )
└── ✏️ Custom         [Manage]
```

---

## 6. Biometric Authentication

### Supported Biometrics

| Platform | Methods |
|----------|---------|
| **iOS** | Face ID, Touch ID |
| **Android** | Fingerprint, Face Unlock, Iris |
| **Web** | WebAuthn, Windows Hello |

### Security Features

- Stored locally, never sent to server
- Uses secure enclave when available
- Requires device passcode as backup

---

## 7. End-to-End Encryption (E2E)

### How It Works

```
Alice sends message: "Hi Bob!"
         ↓
Client encrypts with Bob's public key
         ↓
Server receives: [encrypted blob]
         ↓
Bob receives:  "Hi Bob!" (decrypted with private key)
```

### Security Properties

| Property | Description |
|----------|-------------|
| **E2E Only** | Only sender/recipient can decrypt |
| **Forward Secrecy** | Old keys don't decrypt new messages |
| **Post-Compromise** | Future key compromise doesn't reveal past |
| **Verifiable** | Users can verify keys |

### Verify Encryption

1. Open conversation
2. Tap name → Encryption
3. Compare QR codes (in-person)
4. Or share verification link

---

## 8. Privacy Dashboard

### View Your Privacy

1. Settings → Privacy → Privacy Dashboard
2. See:
   - Devices logged in
   - Data shared
   - Login history
   - Active sessions

### Privacy Score

```
Privacy Score: ████████░░ 80/100

✓ E2E encryption enabled
✓ Ghost mode available
✓ App lock enabled
✓ No unknown devices
```

---

## 9. Data Export

### Export Your Data

1. Settings → Privacy → Download my data
2. Choose format:
   - JSON (structured)
   - HTML (readable)
   - PDF (printable)
3. Select data types:
   - Messages
   - Media
   - Contacts
   - Settings

---

## 10. Delete Account

### Delete Account

1. Settings → Privacy → Delete Account
2. Read warning
3. Confirm with password
4. 30-day grace period
5. All data permanently deleted

### What Happens

| Data | Deleted |
|------|---------|
| Messages | ✅ Permanent |
| Media | ✅ Permanent |
| Profile | ✅ Permanent |
| Username | ✅ Released for reuse |

