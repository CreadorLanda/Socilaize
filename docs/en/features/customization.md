# 🎨 Customization

> Documentation for Socialize customization features.

---

## 🎭 Themes

### Theme Types

| Theme | Description |
|-------|------------|
| **Light** | White background, dark text |
| **Dark** | Dark background, light text |
| **AMOLED** | Pure black, battery saving |
| **Dynamic** | Color based on wallpaper |
| **Custom** | Create your own |

### Change Theme

1. Settings → Appearance
2. Theme
3. Select

---

## 🖤 AMOLED Mode

### Features

- Background #000000 (pure black)
- Significant battery savings on OLED screens
- Maximum contrast

### Activate

1. Settings → Appearance
2. Theme → AMOLED

---

## 🌊 Visual Effects

### Glassmorphism

Translucent frosted glass effect:

```typescript
interface GlassEffect {
  enabled: boolean;
  blur: number; // 0-100
  opacity: number; // 0-100
}
```

---

## 🔤 Fonts

### System Fonts

Use built-in fonts:
- Noto
- Roboto
- OpenSans
- Poppins
- Montserrat

---

## 💬 Bubble Styles

### Balloon Types

| Style | Description |
|-------|------------|
| **WhatsApp** | Classic rounded |
| **Telegram** | Square with soft corners |
| **Messenger** | Round with image |
| **Discord** | Compact |
| **Custom** | Create your own |

---

## 🖼️ Wallpapers

### Included Wallpapers

- Nature
- Abstract
- Cities
- Minimal
- Custom

---

## References

- [Technical Spec](../tech/themes.md)