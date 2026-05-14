# 🧪 Testing

> Socialize testing guide.

---

## Testing Strategy

| Type | Purpose | Coverage | When |
|------|-----------|---------|---------|
| **Unit** | Isolated logic | High | Every PR |
| **Integration** | Modules together | Medium | Every PR |
| **E2E** | Complete flows | Low | Every release |
| **Performance** | Load/stress | N/A | Weekly |

---

## Unit Tests

### Structure

```
├── service/
│   ├── user.go
│   └── user_test.go
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
```

### Examples

#### Go

```go
func TestCalculateTotal(t *testing.T) {
    tests := []struct {
        name     string
        items    []Item
        expected int
    }{
        {"empty", []Item{}, 0},
        {"single", []Item{{Price: 100}}, 100},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := CalculateTotal(tt.items)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

#### TypeScript

```typescript
describe('useAuth', () => {
  it('should return user on success', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login('user@test.com', 'password');
    });
    
    expect(result.current.user).toBeTruthy();
  });
});
```

---

## Running Tests

### Local

```bash
# All tests
make test

# Unit tests only
npm run test:unit
go test ./...

# Integration
make test:integration

# E2E (requires environment)
make test:e2e
```

---

## Coverage

### Targets

| Type | Minimum |
|------|---------|
| **Backend** | 70% |
| **Frontend** | 60% |
| **Critical** | 90% |

---

## References

- [testing-go](https://github.com/stretchr/testify)
- [Jest](https://jestjs.io/)
- [Detox](https://wix.github.io/detox/)