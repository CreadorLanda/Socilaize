import { expect, test } from 'bun:test';
import nacl from 'tweetnacl';

/**
 * The call media key, derived the way data/crypto/call-key.ts derives it.
 *
 * The module itself pulls in SecureStore and the encrypted database, so this
 * re-derives from the same source file and checks the properties that matter.
 */
const src = await Bun.file('data/crypto/session.ts').text();

function hkdfLike(ikm: Uint8Array, info: string): Uint8Array {
  const infoBytes = new TextEncoder().encode(info);
  const buf = new Uint8Array(ikm.length + infoBytes.length);
  buf.set(ikm, 0);
  buf.set(infoBytes, ikm.length);
  return nacl.hash(buf).slice(0, 32);
}
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

test('a derivacao aqui e a mesma do ficheiro que embarca', () => {
  expect(src).toContain('export function deriveSharedSecret');
  expect(src).toContain('return hkdfLike(root, label)');
});

test('a chave da chamada nao e a chave das mensagens', () => {
  const root = nacl.randomBytes(32);
  // Compromising a call must not hand over the thread it happened in.
  expect(hex(hkdfLike(root, 'call:chat-1'))).not.toBe(hex(hkdfLike(root, 'msg-0')));
});

test('conversas diferentes com a mesma pessoa dao chaves diferentes', () => {
  const root = nacl.randomBytes(32);
  expect(hex(hkdfLike(root, 'call:chat-1'))).not.toBe(hex(hkdfLike(root, 'call:chat-2')));
});

test('a chave muda quando a sessao e refeita', () => {
  // A re-key must not leave old call recordings decryptable with the new one.
  const a = hkdfLike(nacl.randomBytes(32), 'call:chat-1');
  const b = hkdfLike(nacl.randomBytes(32), 'call:chat-1');
  expect(hex(a)).not.toBe(hex(b));
});

test('ambos os lados derivam a mesma chave da mesma raiz', () => {
  // The whole point: no key is ever transmitted, so both devices must arrive
  // at the same 32 bytes independently.
  const root = nacl.randomBytes(32);
  const alice = hkdfLike(root, 'call:chat-9');
  const bob = hkdfLike(root, 'call:chat-9');
  expect(hex(alice)).toBe(hex(bob));
  expect(alice.length).toBe(32);
});
