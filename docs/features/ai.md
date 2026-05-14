# 🤖 Inteligência Artificial - Dandara AI

> Documentação das funcionalidades de IA do Socialize.

---

## Visão Geral

Dandara AI é o assistente de IA integrado do Socialize. Desenvolvida internamente, oferece assistance inteligente sem dependência de serviços externos.

---

## 🌟 Dandara AI

### O que é?

Suite de agentes de IA com:
- Assistente em chats
- Respostas inteligentes
- Tradução em tempo real
- Sumarização
- Geração de conteúdo

### Ativar

1. Configurações → IA
2. Dandara AI
3. Ativar

### Configurações

```typescript
interface DandaraAISettings {
  enabled: boolean;
  language: string;
  personality: 'default' | 'friendly' | 'professional' | 'custom';
  autoReply: boolean;
  smartSuggestions: boolean;
}
```

---

## 💬 Assistente em Chats

### Como Usar

Em qualquer conversa:

1. Digite `/ai` ou toque no 🤖
2. Faça sua pergunta
3. Dandara responde

### Exemplo

```
Você: /ai resumo das últimas mensagens
Dandara: Aqui está o resumo...
```

### Comandos

| Comando | Descrição |
|---------|-----------|
| `/ai [pergunta]` | Pergunta direta |
| `/ai resumir` | Resume conversa |
| `/ai traduzir [texto]` | Traduz texto |
| `/ai escrever [tema]` | Gera texto |

---

## 💡 Smart Replies

### Como Funciona

Based nas mensagens recebidas, Dandara sugere respostasquick:

```
💡 "Tudo bem?" → "Estou bem, thanks!"
💡 "Vem pro rolê?" → "Não posso, preciso..."
```

### Ativar/Desativar

1. Configurações → IA → Smart Replies
2. Ativar

### Configurações

```typescript
interface SmartReplySettings {
  enabled: boolean;
  frequency: 'few' | 'some' | 'many';
  personalization: boolean;
  respectContext: boolean;
}
```

---

## 🌍 Tradução em Tempo Real

### Como Usar

1. Toque e segure na mensagem
2. Selecione "Traduzir"
3. Escolha idioma

### Idiomas Suportados

80+ idiomas, incluindo:
- Português (BR)
- English
- Español
- Français
- Deutsch
- 中文
- 日本語
- 한국어
- Muitos mais

### Tradução Automática

```typescript
interface AutoTranslateSettings {
  enabled: boolean;
  preferredLanguage: string;
  showOriginal: boolean;
}
```

---

## 📝 Sumarização

### Resumir Conversa

1. Abra a conversa
2. Toque no nome → Sumarizar
3. Escolha duração

### Exemplo

```
📝 Resumo dos últimos 7 dias:
- 23 mensagens recebidas
- 3 arquivos compartilhados
- Assunto principal: Planejamento de evento
```

---

## 🎙️ Voice-to-Text (VTT)

### Usando VTT

1. Toque no 🎤
2. Fale sua mensagem
3. Solte para enviar

### Idiomas

Detecção automática de idioma.

### Configurações

```typescript
interface VTTSettings {
  enabled: boolean;
  language: 'auto' | string;
  autoPunctuation: boolean;
  filterProfanity: boolean;
}
```

---

## ✍️ Geração de Mensagens

### Criar Mensagem

1. Toque no ✨
2. Descreva o que precisa
3. Dandara gera opções

### Tipos

- birthday wishes
- Congratulations
- Mensagens profissionais
- Poemas
- Códigos

### Personalização

```typescript
interface MessageGenSettings {
  enabled: boolean;
  tone: 'formal' | 'casual' | 'funny' | 'custom';
  includeEmojis: boolean;
  maxLength: number;
}
```

---

## 🛡️ Moderação IA

### Como Funciona

Detecta e filtra conteúdo:
- Spam
- Conteúdo impróprio
- Links suspeitos
- Phishing

### Configurações

```typescript
interface ModerationSettings {
  enabled: boolean;
  blockLevel: 'none' | 'soft' | 'strict';
  customWordList: string[];
  reportsEnabled: boolean;
}
```

---

## 🎭 Personalidade

### Perfis

| Perfil | Descrição |
|-------|-----------|
| **Default** | Balanceado e útil |
| **Friendly** | Mais pessoal e descontraído |
| **Professional** | Focado e direto |
| **Custom** | Crie seu próprio |

### Configurar Personalidade

```typescript
interface CustomPersonality {
  name: string;
  tone: number; // 0-100
  humor: number; // 0-100
  formality: number; // 0-100
  examples: string[];
}
```

---

## 🔒 Privacidade da IA

### Processamento

| Dado | Onde é processado |
|-----|----------------|
| Mensagens | Local ou cloud (você escolhe) |
| Voz | Local (on-device) |
| Preferências | Local only |

### Dados Compartilhados

- NUNCA compartilhamos suas mensagens
- NUNCA treinamos modelos com seus dados
- Você pode solicitar exclusão

---

## 🧠 Modelos

### Tipos de Modelo

- **Local** (on-device): Rápido, privado
- **Cloud**: Mais capable, opção de uso
- **Hybrid**: Melhor de ambos

### Especificações

```typescript
interface AIModelSettings {
  primaryModel: 'local' | 'cloud' | 'hybrid';
  localModelSize: 'small' | 'medium' | 'large';
  cloudTier: 'standard' | 'premium';
}
```

---

## 📊 Analytics IA

### Dashboard

Acesse em:
- Configurações → IA → Dashboard

Ver:
- Uso de IA
- Respostas geradas
- Tempo economizado

---

## 🔧 Configurações Avançadas

### API Dandara

Para desenvolvedores:

```bash
# Configurar API
DANDARA_API_KEY=your_api_key
DANDARA_ENDPOINT=https://api.dandara.ai
```

### Endpoints

| Endpoint | Descrição |
|----------|----------|
| `/chat` | Chat completion |
| `/translate` | Tradução |
| `/summarize` | Sumarização |
| `/voice` | Voice processing |

---

## 📚 Referências

- [Dandara AI Repo](https://github.com/SkylineTech-One/DandaraAI)
- [API Reference](../tech/api.md)