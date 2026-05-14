# 🎨 Customização

> Documentação das funcionalidades de customização do Socialize.

---

## Visão Geral

O Socialize é altamente customizável. Cada aspecto da interface pode ser ajustado às suas preferências.

---

## 🎭 Temas

### Tipos de Tema

| Tema | Descrição |
|------|----------|
| **Claro** | Fundo branco, texto escuro |
| **Escuro** | Fundo escuro, texto claro |
| **AMOLED** | Preto puro, economia de bateria |
| **Dinâmico** | Cor based no wallpaper |
| **Custom** | Crie seu próprio |

### Trocar Tema

1. Configurações → Aparência
2. Tema
3. Selecione

### Temas Integrados

```
🌸 Floral
🌙 Noturno  
🌊 Ocean
🔥 Ember
🌿 Forest
🖤 Monochrome
🌈 Rainbow
🎆 Neon
```

---

## 🔆 Dynamic Themes

### Configuração

```typescript
interface DynamicTheme {
  type: 'solid' | 'gradient' | 'animated';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  wallpaper?: string;
  animation?: 'none' | 'subtle' | 'dynamic';
}
```

### Efeitos

- Gradiente baseado no wallpaper
- Cores que se adaptam ao tempo
- Animações sutis

---

## 🖤 Modo AMOLED

### Características

- Fundo #000000 (preto puro)
- Economia significativa de bateria em telas OLED
- Contraste máximo

### Ativar

1. Configurações → Aparência
2. tema → AMOLED

---

## 🌊 Efeitos Visuais

### Glassmorphism

Efeito de vidro fosco translúcido:

```typescript
interface GlassEffect {
  enabled: boolean;
  blur: number; // 0-100
  opacity: number; // 0-100
  saturation: number; // 0-200
}
```

### Neon Effects

Bordas e elementos com brilho neon:

```typescript
interface NeonEffect {
  enabled: boolean;
  color: string;
  intensity: 'low' | 'medium' | 'high';
  animation: boolean;
}
```

### Animation de Fundo

- Chuva de partículas
- Ondas
- Matrix
- Personalizável

---

## 🔤 Fontes

### Fontes do Sistema

Use fontes próprias:
- Nato
- Roboto
- OpenSans
- Poppins
- Montserrat
- Many more!

### Fontes Custom

1. Baixe fonte (.ttf or .otf)
2. Configurações → Aparência → Fontes
3. "Adicionar Fonte Própria"
4. Selecione arquivo

### Configurações

```typescript
interface FontSettings {
  chatFont: string;
  size: number;
  weight: 'normal' | 'medium' | 'bold';
  lineHeight: number;
}
```

---

## 🖼️ Ícones

### Ícones do App

| Pack | Estilo |
|------|--------|
| Padrão | Socialize original |
|filled | Preenchido |
|.outline | Contorno |
| minimal | Mínimo |
| Color | Colorido |

### Ícones Personalizados

1. Use ícones .ico ou .png
2. Requer 8 tamanhos: 16, 24, 32, 48, 64, 128, 256, 512

---

## 💬 Estilos de Bolhas

### Tipos de Balão

| Estilo | Descrição |
|--------|----------|
| **WhatsApp** | Clássico arredondado |
| **Telegram** | Quadrado com cantos suaves |
| **Messenger** | Redondo com imagem |
| **Discord** | Compacto |
| **Custom** | Crie seu próprio |

### Customização

```typescript
interface BubbleStyle {
  borderRadius: number;
  includeTail: boolean;
  tailPosition: 'left' | 'right' | 'both';
  gradient: boolean;
  colors: {
    sent: string;
    received: string;
  };
}
```

### Cores por Chat

Configure cores diferentes para cada conversa!

---

## 🖼️ Wallpapers

### Wallpapers Integrados

- Natureza
- Abstract
- Cidades
- Minimal
- Custom

### Setor Próprio Wallpaper

1. Configurações → Aparência → Wallpaper
2. Selecione imagem
3. Ajuste-fit: Center, Fill, Tile

---

## 🎞️ Animações de UI

### Tipos de Animação

| Animação | Descrição |
|----------|-----------|
| **Nenhuma** | Desativar tudo |
| **Padrão** | Socialize original |
| **Suave** | Transições suaves |
| **Energética** | Animações completas |

### Configurações

```typescript
interface AnimationSettings {
  transitions: 'none' | 'default' | 'smooth' | 'energetic';
  haptic: boolean;
  motionReduced: boolean;
}
```

---

## 🌑 Modo Escuro

### Schedules

- Manual
- Por tempo (ex: 20:00 - 08:00)
- Por nascer/pôr do sol

### Configurações por Modo

```typescript
interface AppearanceSettings {
  theme: {
    light: 'light' | 'custom';
    dark: 'dark' | 'amoled' | 'custom';
    schedule: 'manual' | 'time' | 'sun';
  };
  automaticSwitch: boolean;
}
```

---

## 📏 Layout

### Posição da Tab Bar

- Bottom (padrão)
- Top
- Esquerda (tablet)

### Tamanho de элементов

- Pequeno
- Médio (padrão)
- Grande

---

## 👤 Customização de Perfil

### Tema de Perfil

Cada联系人 pode ter:
- Cor de destaque
- Foto自定义
- Ringtonecustom

---

## 🎨 Theme Builder

Em breve: Theme Builder integrado!

Crie seus próprios temas sem código.

---

## 📱 Configurações Mobile-Especificas

### Notches

- Esconder notch
- Cor do notch
- Iluminação de borde

### Home Indicator

- Cor personalizada
- Ocultar

---

## Referências

- [Theme Store](./theme-store.md)
- [Technical Spec](../tech/themes.md)