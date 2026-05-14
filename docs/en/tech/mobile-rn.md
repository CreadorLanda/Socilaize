# 📱 React Native Mobile

> Documentation for Socialize React Native mobile app.

---

## Overview

Mobile app is developed with React Native + Expo, focused on performance and user experience.

---

## Stack

| Component | Library | Use |
|------------|---------|-----|
| **Framework** | Expo SDK 52 | Development |
| **Language** | TypeScript | Typing |
| **Navigation** | React Navigation 6 | Navigation |
| **State** | Zustand / Jotai | Global state |
| **UI** | Tamagui | Components |
| **Animations** | Reanimated 3 | Animations |
| **HTTP** | Axios | Requests |
| **Storage** | MMKV | Local storage |
| **Images** | expo-image | Image optimization |

---

## Directory Structure

```
apps/mobile/
├── src/
│   ├── components/      # Reusable components
│   ├── screens/       # Screens
│   ├── navigation/    # Navigation
│   ├── hooks/        # Custom hooks
│   ├── services/    # API services
│   ├── stores/      # Zustand stores
│   ├── theme/       # Themes
│   ├── utils/       # Utilities
│   └── assets/       # Assets
├── app.json
└── package.json
```

---

## Component Pattern

```tsx
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ title, onPress, variant = 'primary' }: ButtonProps) {
  return (
    <TouchableOpacity 
      style={[styles.button, styles[variant]]}
      onPress={onPress}
    >
      <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
  );
}
```

---

## State Management

```tsx
interface ChatState {
  chats: Chat[];
  sendMessage: (chatId: string, content: string) => void;
  loadMessages: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  sendMessage: async (chatId, content) => {
    // Send message
  },
}));
```

---

## Build

```bash
# Development
npm run start

# Build Android
eas build -p android --profile development

# Build iOS
eas build -p ios --profile development

# Production
eas build -p android --profile production
```

---

## References

- [Architecture](./architecture.md)
- [Customization](../features/customization.md)