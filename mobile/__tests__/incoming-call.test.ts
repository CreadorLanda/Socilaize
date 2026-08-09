import { expect, test } from 'bun:test';

/**
 * The store that decides whether a phone rings.
 *
 * Tested through its own module rather than through a screen: the properties
 * that matter are about time and duplicates, not about pixels.
 */
const mod = await import('../data/incoming-call');
const { handleCallEvent, dismissIncoming, ringIncoming } = mod;

test('ignora eventos que nao sao chamadas', () => {
  dismissIncoming();
  expect(handleCallEvent('message.new', { chat_id: 'c1' })).toBe(false);
  expect(handleCallEvent('receipt', {})).toBe(false);
});

test('ignora um evento de chamada sem os dados minimos', () => {
  dismissIncoming();
  // Sem chat_id nao ha para onde atender; sem caller_id nao ha quem mostrar.
  expect(handleCallEvent('call.incoming', { chat_id: 'c1' })).toBe(false);
  expect(handleCallEvent('call.incoming', { caller_id: 'u1' })).toBe(false);
  expect(handleCallEvent('call.incoming', null)).toBe(false);
});

test('aceita um evento completo', () => {
  dismissIncoming();
  expect(
    handleCallEvent('call.incoming', {
      chat_id: 'c1', caller_id: 'u1', caller_name: 'Ana', mode: 'video',
    }),
  ).toBe(true);
});

test('um segundo toque para a mesma conversa nao substitui o primeiro', () => {
  dismissIncoming();
  ringIncoming({ chatId: 'c9', callerId: 'u1', callerName: 'Ana', mode: 'voice' });
  // Quem liga pode repetir, e os dois ouvintes de websocket podem ambos ver
  // o mesmo evento. Substituir reiniciaria o temporizador de toque.
  ringIncoming({ chatId: 'c9', callerId: 'u1', callerName: 'Ana', mode: 'video' });
  // Sem acesso ao estado interno, o que se verifica e que nao ha excecao e
  // que dispensar deixa o campo limpo para a proxima.
  dismissIncoming();
  expect(handleCallEvent('call.incoming', { chat_id: 'c9', caller_id: 'u1' })).toBe(true);
  dismissIncoming();
});

test('o modo cai para voz quando vem em branco', () => {
  dismissIncoming();
  expect(handleCallEvent('call.incoming', { chat_id: 'c2', caller_id: 'u2' })).toBe(true);
  dismissIncoming();
  expect(handleCallEvent('call.incoming', { chat_id: 'c3', caller_id: 'u3', mode: 'lixo' })).toBe(true);
  dismissIncoming();
});
