# 📱 Stories (Estados)

> Documentação completa para Stories estilo Instagram com filtros e áudio.

---

## Visão Geral

| Recurso | Status | Descrição |
|---------|--------|-------------|
| Stories de Foto | ✅ | Foto com filtros |
| Stories de Vídeo | ✅ | Vídeos com auto-play |
| Stories de Áudio | 🎵 | Voz/nota como story |
| Animações | ✨ | Animações auto-play |
| "Ouvindo Agora" | 🎵 | Música tocando |
| Filtros | 🎨 | Filtros de imagem |

---

## 1. Tipos de Story

### 1.1 Stories de Foto

**Com Filtros:**
- Tirar foto → Aplicar filtro → Compartilhar

**Filtros Disponíveis:**

| Filtro | Efeito |
|--------|-------|
| Normal | Sem efeito |
| Clarendon | Pretos realçados |
| Gingham | Quente, brillante |
| Moon | Cinzento, frio |
| Lark | Pretos saturados |
| Reyes | Vintage, brilho |
| Juno | Sombras verdes |
| Slumber | Desaturado, quente |
| Crema | Vintage, quente |
| Ludwig | Vazamento de luz |
| Aden | Tons rosas |

### 1.2 Stories de Vídeo

- Auto-play com som
- Toque para pausar
- Deslizar para pular

### 1.3 Stories de Áudio/Voz

| Tipo | Descrição | Duração |
|------|-------------|----------|
| Nota de Voz | Gravar voz | 30s máx |
| Música | Música tocando | Música inteira |
| Arquivo | Importar áudio | 60s máx |

---

## 2. "Ouvindo Agora" (Estilo MSN)

### Status de Música

```json
{
  "story_type": "music",
  "media": {
    "song": "Título da Música",
    "artist": "Artista",
    "album": "Álbum",
    "album_art": "url",
    "duration": "3:45",
    "source": "spotify" | "apple" | "local"
  }
}
```

### Exibição

- Capa do álbum como fundo
- Info da música sobreposta
- Deslizar para próxima música

Fontes Suportadas: Spotify, Apple Music, Deezer, Arquivos Locais

---

## 3. Criação de Story

### Câmera Full Screen

```
📱 Câmera Full Screen
├── [Flash] [Inverter] [Timer] [Velocidade]
├──
├──    [    ] (visor)
├──
├── [Galeria] [Stickers] [Texto]
├──
└── [Capturar]
```

### Captura Rápida

- Toque: Tirar foto
- Segurar: Gravar vídeo
- Velocidade: 0.3x, 0.5x

### Edição

| Recurso | Descrição |
|--------|-------------|
| Texto | Adicionar texto |
| Stickers | Adicionar stickers |
| Desenhar | Desenhar no story |
| Filtros | Aplicar filtros |
| Cortar | Redimensionar |
| Aparar | Aparar vídeo |

---

## 4. Stories de Animação

### Auto-Play de Animações

| Tipo | Descrição |
|------|-------------|
| Auto | Animação toca automaticamente |
| Loop | Loop contínuo |

---

## 5. Recursos do Story

### Visualização

- Deslizar: Próximo/Anterior
- Toque Esquerda: Anterior
- Toque Direita: Próximo
- Segurar: Pausar
- Toque Duplo: Like/Reagir
- Segurar Longo: Mensagem privada

---

## 6. Destaques (Highlights)

### Criando Destaques

- Salvar stories para destaque
- Editar capa
- Organizar ordem

---

## 7. API

```http
POST /api/stories/photo
{
  "photo": "file",
  "filter": "clarendon"
}

POST /api/stories/video
{
  "video": "file"
}

POST /api/stories/music
{
  "media": "spotify_track_id"
}
```

---

## 8. Ações Rápidas

| Ação | Como |
|--------|-----|
| Like | Toque duplo |
| Responder | Deslizar para cima |
| Compartilhar | Enviar para chat |
| Salvar | Clicar bookmark |
