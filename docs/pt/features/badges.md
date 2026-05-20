# 🎖️ Badges e Verificação

> Documentação completa para badges de usuário, níveis de verificação e conquistas.

---

## Visão Geral

| Categoria | Tipo | Como Conseguir |
|----------|------|-----------|
| Verificação | Normal | Aplicação |
| Verificação | Criador | Solicitação + Revisão |
| Badge | Contribuidor | Atividade |
| Badge | Criador de Jogos | Criar jogos |
| Badge | Secreto | Eventos raros |
| Badge | Super Raro | Edições limitadas |

---

## 1. Níveis de Verificação

### 1.1 Verificação Normal ✅

**Requisitos:**
- Conta ativa (>30 dias)
- Telefone verificado
- Mínimo de seguidores: 100

**Badge:** ✅ Checkmark azul

**Custo:** Grátis

---

### 1.2 Verificação de Criador 🎮

**Requisitos:**
- Verificação normal
- Criador de conteúdo
- Comunidade ativa
- Revisão da aplicação

**Badge:** 🎮 Controle de jogo

**Custo:** Grátis (processo de revisão)

---

### 1.3 "Rei" (King) 👑

**Badge especial para usuários fundadores ou reconhecimento especial.**

**Requisitos:**
- Primeiro usuário
- Ou convite da equipe

**Badge:** 👑 Coroa

---

## 2. Badges Pagos

### 2.1 Assinatura Mensal ($5)

**Benefícios:**
- Badge premium
- Efeito de brilho no perfil
- Emoji customizado em comentários
- Acesso antecipado

**Badge:** ⭐ Estrela com texto "Pro"

**Custo:** $5/mês

---

### 2.2 Pagamento Único ($5)

**Benefício:** Badge premium permanente

**Badge:** 💎 Diamante

**Custo:** $5 (uma vez)

---

## 3. Badges por Atividade

### 3.1 Badge Contribuidor

**Ganho através de:**
- Ajudar usuários
- Reportar bugs
- Contribuir para crescimento

| Tipo | Requisito | Badge |
|------|-------------|-------|
| Helper | 50+ respostas úteis | 🌟 |
| Reporter | 10+ report de bugs | 🐛 |
| Supporter | 100+ indicações | 💪 |

---

### 3.2 Badge Criador de Jogos

**Requisitos:**
- Criar um mini-jogo
- Jogo aprovado pela equipe
- Jogo ativo com usuários

**Badge:** 🎲 Dado com estrela

---

### 3.3 Badges de Sequência

| Dias | Badge |
|------|-------|
| 7 | 🔥 7 dias |
| 30 | 🔥 30 dias |
| 100 | 🔥 100 dias |
| 365 | 🔥 1 ano |

---

## 4. Badges Secretos e Raros

### 4.1 Badges Secretos

**Como conseguir:** Conquistas escondidas

| Badge | Requisito |
|-------|-------------|
| 🎁 Primeiro presente | Enviar presente |
| 🎭 Primeira máscara | Usar máscara |
| 🌙 Coruja noturna | Usar app às 3am |

---

### 4.2 Badges Super Raros

**Edições limitadas:**

| Badge | Requisito |
|-------|-------------|
| 🏆 Fundador | Um dos primeiros 100 |
| 👑 Legacy | Somente convite |
| 🌟 Unicórnio | 1000+ indicações |
| 💎 Mãos de Diamante | Premium por 2+ anos |

---

## 5. API de Badges

```http
GET /api/users/:id/badges

Response:
{
  "main_badge": "verified",
  "sub_badges": ["contributor"],
  "available": ["game_creator"]
}
```

---

## 6. Loja de Badges

```http
GET /api/badges/shop
```

---

## 7. Aplicação de Verificação

```http
POST /api/verification/apply
{
  "type": "normal" | "creator",
  "bio": "Por que devo ser verificado"
}
```
