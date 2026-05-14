# 💬 Messaging Core

> Documentação das funcionalidades de mensagens do Socialize.

---

## Visão Geral

O módulo de mensagens é o coração do Socialize. Suporta diversos tipos de comunicação em tempo real com criptografia E2E.

---

## 💬 Chat Direto (1:1)

### Enviar Mensagem

```typescript
// Enviar mensagem de texto
const message = await chatService.sendMessage({
  to: 'user_id',
  content: 'Olá! 👋',
  type: 'text'
});
```

### Tipos de Mensagem

| Tipo | Descrição | Limite |
|------|----------|--------|
| `text` | Texto simples | 10.000 caracteres |
| `image` | Imagem | 25MB |
| `video` | Vídeo | 100MB |
| `audio` | Áudio/Nota de voz | 25MB |
| `document` | Documento | 100MB |
| `location` | Localização | - |
| `contact` | Contato | - |

### Reações

Suporta reações com emojis:

```
❤️ 😂 😮 😢 😡 👍 👎 ❤️ 🔥 🎉 😍
```

Toque e segure em uma mensagem para reagir.

---

## 👥 Grupos

### Criar Grupo

1. Toque em "Nova Conversa"
2. Selecione "Novo Grupo"
3. Adicione participantes (mínimo 3)
4. Defina nome do grupo
5. (Opcional) Adicione foto
6. Toque em "Criar"

### Permissões de Grupo

| Função | Descrição |
|--------|----------|
| **Admin** | Gerencia membros, configurações |
| **Moderator** |.Remove mensagens, silencia |
| **Membro** | Participa normalmente |

### Limites

| Recurso | Limite |
|---------|--------|
| Membros | 1.000 |
| Administradores | 50 |
| Descrição | 500 caracteres |
| Nome do grupo | 100 caracteres |

### Configurações de Grupo

```typescript
interface GroupSettings {
  name: string;
  description?: string;
  avatar?: string;
  isPublic: boolean;
  allowMemberInvite: boolean;
  allowSendMessages: 'all' | 'admins' | 'custom';
  allowReact: boolean;
  allowEditMessages: boolean;
  maxForwardCount?: number;
}
```

---

## 📢 Canais

### Criar Canal

1. Vá para "Canais"
2. Toque em "+"
3. Escolha "Criar Canal"
4. Configure:
   - Nome
   - Descrição
   - Foto (opcional)
   - Público ou privado
5. Toque em "Criar"

### Tipos de Canal

| Tipo | Acesso |
|------|--------|
| **Público** | Qualquer um pode encontrar e entrar |
| **Privado** | Apenas com convite/link |

### Funcionalidades

- 📢 Anúncios (apenas admins)
- 💬 Discussão pública
- 📎 Arquivos
- 🔒 Canais privados
- 🔗 Links compartilháveis

---

## 🏘️ Comunidades

### O que são Comunidades?

Comunidades são grupos de grupos. Organize seus grupos por:

- Trabalho
- Família
- Amigos
- Interests

### Hierarquia

```
Comunidade
├── Grupo Principal
├── Grupo 1
├── Grupo 2
└── Grupo N
```

---

## ⏰ Mensagens Agendadas

### Agendar Mensagem

1. Escreva sua mensagem
2. Toque e segure no botão enviar
3. Selecione "Agendar"
4. Escolha data e hora
5. Confirme

### Gerenciar

Suas mensagens agendadas aparecem em:

- 💭 Rascunhos
- ⏰ Agendadas

### Limites

- Máximo 30 dias de antecedência
- Máximo 100 mensagens por агendar

---

## ✏️ Editar Mensagens

### Como Editar

1. Toque e segure na mensagem
2. Selecione "Editar"
3. Modifique o conteúdo
4. Envie

### Regras

- Apenas até 15 minutos após envio
- Original visível como "Editado"
- Histórico de edições disponível

---

## 🗑️ Excluir Mensagens

### Opções de Exclusão

| Opção | Efeito |
|-------|--------|
| **Para mim** | Remove apenas para você |
| **Para todos** | Remove para todos |
| **Agendada** | Cancela mensagem inúmer |

### Anti-Delete

Configure para manter mensagens mesmo quando o sender as exclua:

```typescript
// Configuração anti-delete
const settings = {
  antiDelete: {
    enabled: true,  // mantém mensagens
    duration: '30d',  // por 30 dias
    storage: 'local'  // ou 'cloud's
  }
};
```

---

## 🔖 Mensagens Fixadas

### Fixar no Chat

1. Toque e segure na mensagem
2. Selecione "Fixar no topo"
3. Confirme

### Limites

- Máximo 3 mensagens fixadas por chat
- Máximo 1 por pessoa

---

## 📊 Status de Mensagens

| Status | Ícone | Significado |
|--------|------|--------------|
| ⏳ | Enviando |，正在 enviando |
| ✅ | Enviado | Chegou ao servidor |
| 📖 | Visto | Recipient leu |
| ❌ | Erro | Falha no envio |

---

## 🔍 Busca

### Buscar em Conversa

1. Abra a conversa
2. Toque no nome do chat
3. selecione "Buscar"
4. Digite sua busca

### Filtros

| Filtro | Descrição |
|--------|-----------|
| 📝 | Apenas texto |
| 🖼️ | Apenas mídia |
| 📎 | Apenas arquivos |
| 👤 | Por autor |
| 📅 | Por data |

---

## 📎 Compartilhamento

### Compartilhar Mídia

| Tipo | Compression | Limite |
|------|--------------|--------|
| Imagem | Automática | 4MB (WhatsApp-like) |
| Vídeo | H.264 | 16MB |
| Áudio | Opus | 2MB |

### Forward (Encaminhar)

- Máximo 5 chats por forwarding
- Remove contexto original (configurável)

---

## 🎭 Stickers

### Usar Stickers

1. No campo de mensagem, toque no 😊
2. Selecione a aba "Stickers"
3. Escolha ou baixe packs

### Criar Pack

Em breve: Criador de stickers integrado!

---

## 📝 Notas de Voz

### Gravar

1. Toque e segure no 🎤
2. Grave sua mensagem
3. Libere para enviar

### Opções

- 🎤 Gravar
- ⏹️ Pausar
- ❌ Cancelar
- 🔄 Refazer

---

## 🌍 Tradução

### Como Traduzir

1. Toque e segure na mensagem
2. Selecione "Traduzir"
3. Escolha o idioma

---

## ⚡ Atalhos

| Atalho | Ação |
|--------|------|
| Digite `/help` | Ajuda |
| Digite `/pin` | Fixar mensagem |
| Digite `/poll` | Criar enquete |
| Digite `/remind` | Lembrete |

---

## Referências

- [API Reference](../tech/api.md)
- [Database Schema](../tech/database.md)