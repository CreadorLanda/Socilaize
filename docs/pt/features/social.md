# 🌟 Recursos Sociais

> Documentação completa dos recursos sociais do Socialize.

---

## 1. Stories

> Posts temporários que expiram após um tempo definido.

### Visão Geral

| Recurso | Descrição |
|---------|-------------|
| Duração | Padrão 24h, configurável até 3 dias (72h) |
| Tipos de Mídia | Texto, Imagem, Vídeo |
| Visibilidade | Apenas contatos, Público, Personalizado |
| Auto-Corte | Vídeos > 2 minutos são Cortados |

---

### 1.1 Criando Stories

**Criando via App:**

1. Toque na foto do seu perfil (circular, topo)
2. Selecione "Adicionar ao Story"
3. Escolha o tipo:
   - 📷 **Câmera** - Tire foto/vídeo
   - 🖼️ **Galeria** - Selecione da galeria
   - ✏️ **Texto** - Crie story de texto
4. Adicione efeitos (texto, stickers, etc.)
5. Defina duração (opcional)
6. Defina visibilidade (opcional)
7. Toque em "Compartilhar"

---

### 1.2 Duração do Story

| Configuração | Segundos | Horas |
|---------|---------|-------|
| **Padrão** | 86.400 | 24h |
| 1 hora | 3.600 | 1h |
| 6 horas | 21.600 | 6h |
| 12 horas | 43.200 | 12h |
| **24 horas** | 86.400 | 24h |
| **2 dias** | 172.800 | 48h |
| **3 dias** | 259.200 | 72h |

---

### 1.3 Visibilidade do Story

| Tipo | Quem Pode Ver |
|------|-------------|
| **Contatos** | Apenas contatos salvos |
| **Público** | Qualquer pessoa, mesmo não contatos |
| **Personalizado** | Selecione usuários específicos |

**Stories Públicos:**

```
Opções de Visibilidade:
├── 🔒 Apenas Contatos   (padrão)
├── 🌐 Público         (qualquer um pode ver)
└── 👥 Personalizado  [Selecionar usuários]
```

**Ver Stories Públicos:**

```http
GET /api/stories/public
GET /api/stories/public?user_id=xxx
```

---

### 1.4 Auto-Corte de Vídeos

> Vídeos com mais de 2 minutos são automaticamente cortados.

**Como Funciona:**

```
Vídeo Original: 5 minutos (300s)
         ↓
Auto-Corte: Primeiros 2 minutos (120s)
         ↓
Story: Vídeo de 2 minutos
```

**Configuração:**

```typescript
interface AutoCropSettings {
  enabled: boolean;       // padrão: true
  max_duration: number;    // padrão: 120 (2 min)
  trim_start: boolean;     // manter começo
}
```

---

### 1.5 Reações nos Stories

Reaja com múltiplos emojis do teclado.

**Emojis Suportados:**

```
Padrão:    ❤️ 😂 😮 😢 😡 👍 👎 🔥 🎉 😍 👏
Extend:    🙌 💪 🙏 😇 ❤️‍🔥 💯 ⭐ 🌟 ✨ 🆕 😁 😎 🥳 😍
Personalizado: [seus emojis personalizados]
```

**Reagindo ( Único):**

```http
POST /api/stories/:id/reactions
{
  "reaction": "🔥"
}
```

**Reagindo ( Múltiplos):**

```http
POST /api/stories/:id/reactions
{
  "reactions": ["🔥", "❤️", "🎉"]  // array para múltiplos
}
```

**Do Teclado:**

1. Toque e segure o story
2. Barra de reação aparece
3. Toque em múltiplos emojis para reagir de uma vez

---

### 1.6 Comentários nos Stories

> Comentar nos stories (quando ativado).

**Ativando Comentários:**

```json
{
  "content": "Meu story",
  "allow_comments": true
}
```

**Comentando:**

```http
POST /api/stories/:id/comments
{
  "text": "Incrível! 🔥"
}
```

---

### 1.7 Visualizador de Stories

**Ver Stories:**

```http
GET /api/stories
// Retorna: seus stories + stories de contatos

GET /api/stories/public
// Retorna: stories públicos de qualquer pessoa

GET /api/users/:id/stories
// Retorna: stories de usuário específico
```

---

### 1.8 Análise do Story

**Para Criadores:**

```http
GET /api/stories/:id/insights
```

**Retorna:**

```json
{
  "views": 150,
  "unique_viewers": 120,
  "reactions": {"❤️": 5, "🔥": 3},
  "comments": 2,
  "shares": 10,
  "completion_rate": 0.85,
  "avg_watch_time": "12s"
}
```

---

## 2. Perfis Multi-Identidade

### Criando Perfis

```http
POST /api/profiles
{
  "name": "Perfil Trabalho",
  "bio": "Desenvolvedor na Empresa"
}
```

---

## 3. Status de Música

### Exibir Música Atual

```json
{
  "music_status": {
    "song": "Bohemian Rhapsody",
    "artist": "Queen"
  }
}
```

---

## 4. Mini Apps

### Apps Populares

| App | Descrição |
|-----|-------------|
| 🧮 Calculadora | Cálculos rápidos |
| 📅 Calendário | Eventos e lembretes |
| 📝 Enquetes | Criar enquetes |
| ⏱️ Timer | Cronômetro |
| 💱 Moeda | Conversor de moeda |
| 🎲 Dados | Jogar dados |

---

## 5. Configurações de Privacidade do Story

```typescript
interface StoryPrivacy {
  allow_replies: 'none' | 'contacts' | 'everyone';
  allow_reactions: boolean;
  allow_screenshots: boolean;
}
```
