import { beforeEach, expect, test } from 'bun:test';

import {
  dismissIncoming,
  getIncomingCall,
  handleCallEvent,
  RING_TIMEOUT_MS,
  ringIncoming,
} from '../data/incoming-call';

/**
 * The store that decides whether a phone rings.
 *
 * Tested through its own module rather than through a screen: the properties
 * that matter are about time and duplicates, not about pixels.
 */

beforeEach(() => dismissIncoming());

test('ignora eventos que nao sao chamadas', () => {
  expect(handleCallEvent('message.new', { chat_id: 'c1' })).toBe(false);
  expect(handleCallEvent('receipt', {})).toBe(false);
});

test('ignora um evento de chamada sem os dados minimos', () => {
  // Sem chat_id nao ha para onde atender; sem caller_id nao ha quem mostrar.
  expect(handleCallEvent('call.incoming', { chat_id: 'c1' })).toBe(false);
  expect(handleCallEvent('call.incoming', { caller_id: 'u1' })).toBe(false);
  expect(handleCallEvent('call.incoming', null)).toBe(false);
  expect(getIncomingCall()).toBeNull();
});

test('aceita um evento completo', () => {
  expect(
    handleCallEvent('call.incoming', {
      chat_id: 'c1', caller_id: 'u1', caller_name: 'Ana', mode: 'video',
    }),
  ).toBe(true);
  expect(getIncomingCall()).toMatchObject({
    chatId: 'c1', callerId: 'u1', callerName: 'Ana', mode: 'video',
  });
});

test('um segundo toque para a mesma conversa nao substitui o primeiro', () => {
  ringIncoming({ chatId: 'c9', callerId: 'u1', callerName: 'Ana', mode: 'voice' });
  // Quem liga pode repetir, e os dois ouvintes de websocket podem ambos ver
  // o mesmo evento. Substituir reiniciaria o temporizador de toque.
  ringIncoming({ chatId: 'c9', callerId: 'u1', callerName: 'Ana', mode: 'video' });
  expect(getIncomingCall()?.mode).toBe('voice');
});

test('o modo cai para voz quando vem em branco', () => {
  handleCallEvent('call.incoming', { chat_id: 'c2', caller_id: 'u2' });
  expect(getIncomingCall()?.mode).toBe('voice');

  dismissIncoming();
  handleCallEvent('call.incoming', { chat_id: 'c3', caller_id: 'u3', mode: 'lixo' });
  expect(getIncomingCall()?.mode).toBe('voice');
});

/**
 * The ring outlived the call.
 *
 * Nothing ever told the server a call had ended, so nothing ever told the
 * other phone either. It rang for the full 45 seconds after the caller gave
 * up, and answering landed in an empty room.
 */
test('call.ended para o toque da mesma conversa', () => {
  ringIncoming({ chatId: 'chat-1', callerId: 'u1', callerName: 'Alice', mode: 'voice' });
  expect(getIncomingCall()).not.toBeNull();

  expect(handleCallEvent('call.ended', { chat_id: 'chat-1' })).toBe(true);
  expect(getIncomingCall()).toBeNull();
});

test('call.ended de outra conversa nao para este toque', () => {
  ringIncoming({ chatId: 'chat-1', callerId: 'u1', callerName: 'Alice', mode: 'voice' });
  handleCallEvent('call.ended', { chat_id: 'chat-2' });
  expect(getIncomingCall()?.chatId).toBe('chat-1');
});

test('call.ended sem chat_id nao rebenta nem para o toque errado', () => {
  ringIncoming({ chatId: 'chat-1', callerId: 'u1', callerName: 'Alice', mode: 'voice' });
  expect(handleCallEvent('call.ended', null)).toBe(true);
  expect(handleCallEvent('call.ended', {})).toBe(true);
  expect(getIncomingCall()?.chatId).toBe('chat-1');
});

/**
 * One number, one decision. The caller gives up at the same moment the callee
 * stops ringing; two constants could drift apart and leave one side waiting
 * for a call the other had already abandoned.
 */
test('o tempo de toque e exportado para os dois lados usarem o mesmo', () => {
  expect(RING_TIMEOUT_MS).toBe(45_000);
});
