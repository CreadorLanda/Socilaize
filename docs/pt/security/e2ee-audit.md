# Auditoria do modelo E2EE

Estado: consolidado para revisão humana. Não constitui aprovação para produção.

O cliente móvel deriva localmente a sessão e envia envelopes `soc1.` para
mensagens direct e `soc1g.` para grupos. O backend apenas autoriza, persiste e
transporta ciphertext; WebSocket e push não recebem plaintext. A descriptografia
e a persistência do texto ocorrem no cliente.

O endpoint `/api/sessions/init`, `InitSession`, `GetSession`, `UpsertSession`,
`sessionRow` e `initSession()` foram removidos. O backend não deriva nem guarda
chaves de sessão E2EE. A tabela `sessions` é a tabela de refresh tokens da
autenticação e não pode ser removida; a migration `0040` remove apenas colunas
legadas de E2EE se existirem. O `down` é um no-op documentado: a sequência
normal `0001 -> ... -> 0039` nunca adicionou essas colunas, porque `0006`
tentou usar `CREATE TABLE IF NOT EXISTS` sobre a tabela de autenticação já
existente.

O código atual não implementa Signal Protocol, libsignal ou Double Ratchet.
Trata-se de uma construção própria baseada em X25519/TweetNaCl, com contador e
derivação simples de chaves de mensagem. Forward secrecy, post-compromise
security, mensagens fora de ordem, verificação criptográfica de identidade e
consistência multi-device continuam sem garantia equivalente ao Signal.

O endpoint de mensagens criadas pelo utilizador autoriza primeiro o
participante e só depois rejeita conteúdo que não seja um envelope E2EE
estruturalmente válido. Chats direct aceitam apenas `soc1.`; grupos aceitam
apenas `soc1g.` e `s` tem de corresponder ao UUID do remetente autenticado. O
servidor valida apenas a estrutura e não verifica MAC. Linhas de controlo criadas pelo
servidor, como avisos de mensagens efémeras e traces de chamadas, usam um
caminho separado e não devem ser tratadas como mensagens E2EE do utilizador.
Dados históricos, previews, media, link previews e notificações fora do fluxo
de mensagens ainda exigem revisão humana específica.
