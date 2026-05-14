# 📝 Style Guide

> Guia de estilo de código do Socialize.

---

## 🌟 Princípios

| Princípio | Descrição |
|----------|----------|
| **Clareza** | Código deve ser fácil de entender |
| **Simplicidade** | Evite complexidade desnecessária |
| **Consistência** | Siga convenções estabelecidas |
| **Performance** | Otimize quando necessário |

---

## 💻 TypeScript

### Nomenclatura

```typescript
// Variáveis e funções: camelCase
const userName = 'João';
function getUser() {}

// Classes e interfaces: PascalCase
class UserService {}
interface UserProps {}

// Constantes: SCREAMING_SCREAMING
const MAX_RETRY_COUNT = 3;

// Arquivos: kebab-case
// user-service.ts
```

### Tipos

```typescript
// Use type para objetos simples
type User = {
  id: string;
  name: string;
};

// Use interface para objetos extensíveis
interface MessageProps {
  content: string;
  sender: User;
}
```

### Estrutura de Arquivo

```typescript
// 1. Imports
import { useState } from 'react';
import type { User } from './types';

// 2. Tipos
interface Props {}

// 3. Componente
export function Component({}: Props) {
  // 4. Hooks
  const [state, setState] = useState('');
  
  // 5. Handlers
  const handleClick = () => {};
  
  // 6. Render
  return <div />;
}
```

---

## 🔷 Go

### Nomenclatura

```go
// Variáveis e funções: camelCase
userName := "João"
func getUser() {}

// Structs: PascalCase
type UserService struct {}

// Constantes: PascalCase
const MaxRetryCount = 3
```

### Estrutura de Arquivo

```go
package main

// 1. Imports
import (
  "fmt"
)

// 2. Constantes
const MaxRetryCount = 3

// 3. Types
type User struct {
  ID   string
  Name string
}

// 4. Funções
func NewUserService() *UserService {
  return &UserService{}
}
```

### Error Handling

```go
func getUser(id string) (*User, error) {
  user, err := findUser(id)
  if err != nil {
    return nil, fmt.Errorf("find user: %w", err)
  }
  return user, nil
}
```

---

## 🎨 React Native

### Componentes

```tsx
// Componentes funcionais
export function Button({ title, onPress }: ButtonProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}

// Estrilização
const styles = StyleSheet.create({
  button: {
    padding: 16,
    backgroundColor: '#007AFF',
  },
});
```

### Hooks

```tsx
// Custom hooks
export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);
  
  return user;
}
```

---

## 📏 General

### Limites de Linha

```
 máximo: 100 caracteres
 preferível: 80 caracteres
```

### Comentários

```typescript
// Função que calcula total
// Returns: total em centavos
function calculateTotal(items: Item[]): number;
```

###命名

```
✅ userId
❌ user_id
❌ userID (variável)
```

---

## ✅ Linting

```bash
# Execute linting antes de commitar
npm run lint
# ou
go vet ./...
```

---

## 🧪 Formatting

```bash
# TypeScript
npm run format

# Go
gofmt -w .
```

---

## 📚 Referências

- [ESLint Config](./.eslintrc.js)
- [Go Format](https://golang.org/cmd/gofmt/)