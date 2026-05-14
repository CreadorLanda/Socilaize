# 🔐 E2E Encryption

> Documentation for Socialize end-to-end encryption specification.

---

## Overview

Socialize implements E2E encryption using the Signal protocol to ensure only sender and recipient can read messages.

---

## Key Principles

| Principle | Description |
|----------|-------------|
| **E2E Only** | Only sender/recipient can decrypt |
| **Forward Secrecy** | Old keys don't decrypt new messages |
| **Post-Compromise** | Compromise doesn't reveal old messages |
| **Verifiable** | Users can verify keys |

---

## Key Architecture

Each user has:

```
┌─────────────────────┐
│  Identity Key      │  Long-term key pair
│  (Curve25519)      │  Verifies identity
├─────────────────────┤
│  Signed Pre-Key    │  One-time key (rotated)
├─────────────────────┤
│  Pre-Keys          │  One-time keys pool
└─────────────────────┘
```

---

## Key Exchange (X3DH)

### Protocol Flow

```
Alice                                Bob
  │                                    │
  │──── IK_A, SPK_A, {PK_1..n}──────▶│
  │                                    │
  ▼                               ▼
Generate keys                    Store keys
  │                                    │
  │◀── IK_B, SPK_B, PK_B, signed ──── │
  │                                    │
  ▼                               ▼
Compute DH                     Compute DH
Derive shared secret          Derive shared secret
```

---

## Double Ratchet

After X3DH, we use Double Ratchet for each conversation:

```typescript
interface SessionState {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
}
```

---

## References

- [Signal Protocol](https://signal.org/docs/)
- [Privacy Policy](./privacy-policy.md)