# 📝 Style Guide

> Code style guide for Socialize.

---

## Principles

| Principle | Description |
|----------|-------------|
| **Clarity** | Code must be easy to understand |
| **Simplicity** | Avoid unnecessary complexity |
| **Consistency** | Follow established conventions |
| **Performance** | Optimize when necessary |

---

## TypeScript

### Naming

```typescript
// Variables and functions: camelCase
const userName = 'John';
function getUser() {}

// Classes and interfaces: PascalCase
class UserService {}
interface UserProps {}

// Constants: SCREAMING_SCREAMING
const MAX_RETRY_COUNT = 3;
```

### File Structure

```typescript
// 1. Imports
import { useState } from 'react';

// 2. Types
interface Props {}

// 3. Component
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

## Go

### Naming

```go
// Variables and functions: camelCase
userName := "John"
func getUser() {}

// Structs: PascalCase
type UserService struct {}

// Constants: PascalCase
const MaxRetryCount = 3
```

---

## React Native

### Components

```tsx
export function Button({ title, onPress }: ButtonProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}
```

---

## References

- [ESLint Config](./.eslintrc.js)
- [Go Format](https://golang.org/cmd/gofmt/)