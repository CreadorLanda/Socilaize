# Yo 💬

> An open-source messenger, encrypted on the device.

![Yo](./assets/banner.png)

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)
[![Commercial licence](https://img.shields.io/badge/Commercial-available-green.svg)](./LICENSING.md)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-red)](https://github.com/CreadorLanda/Socilaize)
[![Go](https://img.shields.io/badge/Go-1.26-blue)](https://go.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo%20SDK%2054-blue)](https://reactnative.dev/)

---

## What it is

A messenger where messages are encrypted on your device and the server stores
ciphertext it cannot read. Groups, channels, stories, voice and video calls,
stickers, and a game to play in a group chat.

It is **alpha**. Android works end to end. iOS does not have push yet
([#116](https://github.com/CreadorLanda/Socilaize/issues/116)). Some screens are
built on top of nothing real, and those are labelled
[`mock`](https://github.com/CreadorLanda/Socilaize/labels/mock) in the issues
rather than described as finished here.

---

## Quick start

Requires [Bun](https://bun.sh), [Go 1.26+](https://go.dev), and Docker.

```bash
git clone https://github.com/CreadorLanda/Socilaize.git
cd Socilaize

# Server: Postgres, Redis and LiveKit
cd server/deploy/docker && docker compose up -d
cd ../.. && migrate -path migrations -database "$POSTGRES_URL" up
go run ./cmd/api

# Mobile
cd ../mobile
bun install
bunx expo start
```

The app needs a development build, not Expo Go — it uses native modules
(SQLCipher, WebRTC, VisionCamera, Skia) that Expo Go does not carry.

---

## Structure

```
Socilaize/
├── mobile/     React Native + Expo app
├── server/     Go API, WebSocket hub, push worker
├── docs/       Architecture, security, design system
├── scripts/
└── assets/
```

---

## Stack

| Layer | What |
|---|---|
| Mobile | React Native, Expo SDK 54, TypeScript, Reanimated, Skia |
| Server | Go, Gin |
| Storage | PostgreSQL, Redis |
| Local storage | SQLite via SQLCipher |
| Real time | WebSockets |
| Calls | WebRTC via LiveKit |
| Push | FCM |

---

## Security

Messages are encrypted on the device with X25519 / TweetNaCl. The server holds
ciphertext and cannot read it. Push notifications carry no readable content —
the device decrypts and builds the notification locally.

There is **no analytics, no telemetry, and no third-party tracking** anywhere in
the app. That is a rule, not a current state:
[CONTRIBUTING.md](./CONTRIBUTING.md#security-rules) rejects any pull request
that adds one.

**Stated plainly**, because a messenger that oversells its security is worse
than one that admits its limits:

- The crypto is a **custom construction**, not the Signal Protocol. No Double
  Ratchet. **No independent audit.**
- Media, link previews and message metadata sit outside the encryption scheme.
- Forward secrecy is not meaningfully implemented yet.

See [SECURITY.md](./SECURITY.md) to report something.

---

## What works today

**Messaging** — direct and group chats, channels, replies, reactions, editing,
scheduling, disappearing messages, view-once, polls, forwarding, archive, pin,
mute, search, blocking.

**Media** — photos, video, voice notes, documents, location, stickers
(including `.wastickers` import), an editor with crop, draw and text, and
filters that are baked into the file rather than shown over it.

**Stories** — photo, video, text and audio, with polls and questions,
close-friends and custom audiences, anonymous posting, viewers and replies.

**Calls** — one to one and group, audio and video, adding people to a call
without turning the chat into a group, live broadcasts.

**Games** — Truth or Dare, playable in a group.

**Privacy** — per-chat lock with a code, last-seen and photo visibility,
read receipts, directional blocking, account deletion that actually deletes.

---

## Roadmap

| Phase | Focus | State |
|---|---|---|
| 1 | Messaging core, auth, real-time, E2EE | done |
| 2 | Calls, stories, channels, lives, games | done |
| 3 | Offline outbox, themes that persist, iOS | in progress |
| 4 | Communities, badges, AI, mini apps | planned |

Everything planned is an [issue](https://github.com/CreadorLanda/Socilaize/issues).
What blocks a first release is labelled
[`mvp`](https://github.com/CreadorLanda/Socilaize/labels/mvp).

---

## Contributing

Pull requests go to **`dev`**, never to `main`. Read
[CONTRIBUTING.md](./CONTRIBUTING.md) first — it covers the branch flow, the CLA
you agree to by opening a pull request, and the security rules that get code
rejected.

Start with a [`good first issue`](https://github.com/CreadorLanda/Socilaize/labels/good%20first%20issue).
They are picked so the answer already exists somewhere in the codebase.

---

## Licence

Dual-licensed. **[AGPL-3.0](./LICENSE)** for everyone, and a **commercial
licence** for anyone who wants to keep their source closed.

The AGPL does not stop you selling Yo or building a business on it. What it
asks is that the source stays open — including when you run a modified version
as a network service, which is why this is AGPL and not GPL.

If you want to ship something closed, or take parts of Yo into a proprietary
codebase, you need the commercial licence. See
[LICENSING.md](./LICENSING.md) for how to ask.

---

## Philosophy

Messengers got restrictive. Yo exists to give people freedom, control and
customisation — without lying to them about what it protects.

---

<p align="center">
  <strong>Yo</strong><br>
  <em>More than messaging.</em>
</p>
