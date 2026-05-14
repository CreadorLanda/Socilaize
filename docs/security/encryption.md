# 🔐 Criptografia E2E

> Documentação da especificação de criptografia de ponta-a-ponta do Socialize.

---

## Visão Geral

O Socialize implementa criptografia E2E usando o Protocolo Signal para garantir que apenas remetente e destinatário possam ler as mensagens.

---

## 🔑 Princípios Fundamentais

| Princípio | Descrição |
|----------|----------|
| **E2E Only** | Apenas remetente/destinatário descriptografam |
| **Forward Secrecy** | Chaves antigas não descriptografam novas mensagens |
| **Post-Compromise** | Comprometimento não revela mensagens antigas |
| **Verifiable** | Usuários podem verificar chaves |

---

## 🔐 Arquitetura de Chaves

### Par de Chaves

Cada usuário possui:

```
┌─────────────────────┐
│  Identity Key      │  Long-term key pair
│  (Curve25519)      │  用于 verify identity
├─────────────────────┤
│  Signed Pre-Key    │  One-time key (rotated)
├─────────────────────┤
│  Pre-Keys          │  One-time keys pool
└─────────────────────┘
```

### Armazenamento de Chaves

```typescript
interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyId: string;
}

interface UserKeys {
  identityKey: KeyPair;
  signedPreKey: KeyPair;
  preKeys: KeyPair[];
}
```

---

## 🤝key Exchange (X3DH)

### Protocolo X3DH (Extended Triple Diffie-Hellman)

```typescript
// key_exchange.ts
interface X3DHKeyAgreement {
  // 1. Alice gera efemera key
  const ephemeralKey = generateKeyPair();
  
  // 2. Combina chaves
  const dh1 = computeDH(IKa, SPKb);
  const dh2 = computeDH(EKa, IKb);
  const dh3 = computeDH(EKa, SPKb);
  const dh4 = computeDH(EKa, OPKb); // if used
  
  // 3. Deriva master secret
  const masterSecret = KDF(dh1 || dh2 || dh3 || dh4);
}
```

### Fluxo

```
Alice                                Bob
  │                                    │
  │──── ─── IK_A, SPK_A, {PK_1..n}──────▶│
  │                                    │
  │                           Gera chaves│
  │                                    ▼
  │◀── IK_B, SPK_B, PK_B, signed── ──── │
  │                                    │
  │  Compute DH                        │
  │  Derive session key                 │
  ▼                                    ▼
```

---

## 💬 Double Ratchet

### Algoritmo

Após X3DH, usamos Double Ratchet para cada conversa:

```typescript
// double_ratchet.ts
interface SessionState {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingRatchetKey: KeyPair;
  receivingRatchetKey: Uint8Array;
  messageNumber: number;
  previousChainLength: number;
}

// Ratchet forward (enviar)
function ratchetSend(message: string) {
  // 1. Deriva message key
  const messageKey = KDF(chainKey);
  chainKey = KDF(chainKey);
  
  // 2. Criptografa
  return encrypt(message, messageKey);
}

// Ratchet forward (receber)
function ratchetReceive(ciphertext: Uint8Array) {
  // 1. Deriva message key
  const messageKey = KDF(chainKey);
  chainKey = KDF(chainKey);
  
  // 2. Descriptografa
  return decrypt(ciphertext, messageKey);
}
```

### Fluxo de Mensagens

```
Message 1: RatchetSend ──▶ DecryptMessage1
     │                    │
     │                    ▼
     │              RootKey = KDF(RootKey, DH)
     │                    ▼
Message 2: RatchetSend ──▶ DecryptMessage2
     │                    │
     │                    ▼
     │              RootKey = KDF(RootKey, DH)
     ▼                    ▼
Message N: ──────────▶ DecryptMessageN
```

---

## 🔒 Criptografia de Mensagens

### Formato de Mensagem

```protobuf
message CiphertextMessage {
  uint32 version = 1;
  bytes sender_ratchet_key = 2;
  uint32 previous_chain_length = 3;
  uint32 message_number = 4;
  bytes ciphertext = 5;
  bytes nonce = 6;
}
```

### Encrypt/Decrypt

```go
// encrypt.go
func Encrypt(plaintext []byte, key *MessageKey) ([]byte, error) {
    nonce, err := randomBytes(24)
    if err != nil {
        return nil, err
    }
    
    aead, err := aes.NewGCM(key)
    if err != nil {
        return nil, err
    }
    
    ciphertext := aead.Seal(nil, nonce, plaintext, nil)
    return append(nonce, ciphertext...), nil
}
```

---

## 🔑 Gerenciamento de Chaves

### Gerar Keys

```go
// keygen.go
func GenerateIdentityKeyPair() (*KeyPair, error) {
    privateKey := make([]byte, 32)
    _, err := rand.Read(privateKey)
    if err != nil {
        return nil, err
    }
    
    publicKey, err := curve25519.X25519(privateKey, curve25519.Basepoint)
    if err != nil {
        return nil, err
    }
    
    return &KeyPair{
        Public:  publicKey,
        Private: privateKey,
    }, nil
}
```

### Armazenamento Seguro

```typescript
// key_storage.ts
// Armazenar no Secure Enclave / Keystore

interface SecureKeyStorage {
  storeKey(keyId: string, key: KeyPair): Promise<void>;
  getKey(keyId: string): Promise<KeyPair>;
  deleteKey(keyId: string): Promise<void>;
}
```

---

## ✅ Verificação de Chaves

### QR Code Verification

```typescript
// verify.ts
interface QRVerification {
  // Seu QR (para outro escanear)
  const qrData = {
    identityKey: user.identityKey,
    fingerprint: hash(user.identityKey),
  };
  
  // Escanear QR de outro
  const verify = async (qrData: QRData) => {
    if (qrData.identityKey === contact.identityKey) {
      return 'VERIFIED';
    } else {
      return 'FAILED';
    }
  };
}
```

### Fingerprint

```
🔐 AB12 CD34 EF56 GH78 IJ90 KL12
    MN34 OP56 QR78 ST90 UV12 WX34
```

---

## ⚠️ Forward Secrecy

### O que é?

Cada mensagem usa uma chave única que é descartada após uso.

```typescript
// forward_secrecy.ts
// Não armazenar message keys permanentemente
function cleanup(messageKey: Uint8Array) {
  // Sobrescrever na memória
  for (let i = 0; i < messageKey.length; i++) {
    messageKey[i] = 0;
  }
}
```

---

## 📝 Referências

- [Protocolo Signal](https://signal.org/docs/)
- [Specs](https://github.com/signalapp/libsignal-protocol)
- [Política de Privacidade](./privacy-policy.md)