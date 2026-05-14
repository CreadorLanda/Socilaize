# 📱 React Native Mobile

> Documentação da stack mobile React Native do Socialize.

---

## Visão Geral

O app mobile é desenvolvido com React Native + Expo, focado em performance e experiência do usuário.

---

## 🛠️ Stack

| Componente | Library | Uso |
|------------|---------|-----|
| **Framework** | Expo SDK 52 | Desenvolvimento |
| **Linguagem** | TypeScript | Tipagem |
| **Navigation** | React Navigation 6 | Navegação |
| **State** | Zustand / Jotai | Estado global |
| **UI** | Tamagui | Componentes |
| **Animations** | Reanimated 3 | Animações |
| **HTTP** | Axios | Requisições |
| **Storage** | MMKV | Armazenamento local |
| **Images** | expo-image | Otimização |

---

## 🗂️ Estrutura de Diretórios

```
apps/mobile/
├── src/
│   ├── components/      # Componentes reutilizáveis
│   ├── screens/       # Telas
│   ├── navigation/    # Navegação
│   ├── hooks/        # Hooks customizados
│   ├── services/    # Serviços de API
│   ├── stores/      # Zustand stores
│   ├── theme/       # Temas
│   ├── utils/       # Utilitários
│   ├── types/        # Tipos TypeScript
│   └── assets/       # Assets
├── app.json
├── package.json
├── tsconfig.json
└── babel.config.js
```

---

## 📱 Component Pattern

```tsx
// components/Button.tsx
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

## 🧭 Navigation

```tsx
// navigation/AppNavigator.tsx
export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 💾 State Management

```tsx
// stores/chatStore.ts
interface ChatState {
  chats: Chat[];
  messages: Record<string, Message[]>;
  
  sendMessage: (chatId: string, content: string) => void;
  loadMessages: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  
  sendMessage: async (chatId, content) => {
    // Enviar mensagem
  },
  
  loadMessages: async (chatId) => {
    // Carregar mensagens
  },
}));
```

---

## 🎨 Theming

```tsx
// theme/index.ts
export const theme = createTheme({
  colors: {
    primary: '#007AFF',
    secondary: '#5856D6',
    background: '#FFFFFF',
    surface: '#F2F2F7',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
  },
});
```

---

## 🎬 Animações

```tsx
// animations/useFadeIn.ts
export function useFadeIn() {
  const opacity = useSharedValue(0);
  
  useAnimatedStyle(() => ({
    opacity: withTiming(opacity.value, { duration: 300 }),
  }));
  
  return { opacity };
}
```

---

## 📡 API Client

```ts
// services/api.ts
const client = axios.create({
  baseURL: Config.API_URL,
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  const token = getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const chatAPI = {
  getMessages: (chatId: string) => client.get(`/chats/${chatId}/messages`),
  sendMessage: (chatId: string, data: MessageData) => 
    client.post(`/chats/${chatId}/messages`, data),
};
```

---

## 💾 Armazenamento Local

```ts
// utils/storage.ts
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV({ id: 'socialize' });

// Usage
storage.set('user_token', token);
const token = storage.getString('user_token');
```

---

## 🧪 Testing

```tsx
// components/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';

test(' Button renders correctly', () => {
  const { getByText } = render(
    <Button title="Click me" onPress={() => {}} />
  );
  
  expect(getByText('Click me')).toBeTruthy();
});
```

---

## 🚀 Build

```bash
# Development
npm run start

# Build Android
eas build -p android --profile development

# Build iOS
eas build -p ios --profile development

# Build Production
eas build -p android --profile production
```

---

## 📚 Referências

- [Arquitetura](./architecture.md)
- [Customization](../features/customization.md)