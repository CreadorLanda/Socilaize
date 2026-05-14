# 🧪 Testing

> Guia de testes do Socialize.

---

## 🎯 Estratégia de Testes

| Tipo | Propósito | Cobertura | Quando |
|------|-----------|-----------|---------|
| **Unit** | Lógica isolada | Alta | A cada PR |
| **Integration** | Módulos juntos | Média | A cada PR |
| **E2E** | Fluxos inteiros | Baixa | A cada release |
| **Performance** | Carga/stress | N/A | Semanal |

---

## 🧪 Testes Unitários

### Estrutura

```
├── service/
│   ├── user.go
│   └── user_test.go    # testes unitários
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx
```

### Exemplos

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

## 🔗 Testes de Integração

### Estrutura

```
tests/
├── integration/
│   ├── auth_test.go
│   └── chat_test.go
├── e2e/
└── fixtures/
```

### Exemplos

#### Go

```go
func TestLoginIntegration(t *testing.T) {
    // Setup
    app := testApp.Setup()
    defer app.Teardown()
    
    // Test
    resp := app.POST("/auth/login").
        JSON(Map{"phone": "+5511999999999", "password": "test"})
    
    resp.Code(200)
    resp.JSON().Path("token").NotEmpty()
}
```

#### E2E ( Detox)

```typescript
describe('Login Flow', () => {
  it('should login successfully', async () => {
    await device.launchApp();
    
    await element(by.id('phone')).typeText('+5511999999999');
    await element(by.id('password')).typeText('password');
    await element(by.text('Entrar')).tap();
    
    await expect(element(by.text('Conversas'))).toBeVisible();
  });
});
```

---

## 📊 Cobertura

### Targets

| Tipo | Mínimo |
|------|--------|
| **Backend** | 70% |
| **Frontend** | 60% |
| **Critical** | 90% |

### Relatório

```bash
# Gerar relatório
make coverage

# Ver no browser
make coverage-html
```

---

## ⚙️ CI/CD

### GitHub Actions

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    
    - name: Test
      run: make test
    
    - name: Coverage
      run: make coverage
    
    - name: Upload Coverage
      uses: codecov/codecov-action@v3
```

---

## 🔄 Executando Testes

### Local

```bash
# Todos os testes
make test

# Unitários apenas
npm run test:unit
go test ./...

# Integração
make test:integration

# E2E (requer ambiente)
make test:e2e
```

### Debug

```bash
# Verbose
npm test -- --verbose

# Watch mode
npm run test:watch

# Coverage durante teste
npm run test:coverage
```

---

## 💊 Mocks

### Biblioteca

```go
// go/testify/mock
type MockUserService struct {
    mock.Mock
}

func (m *MockUserService) GetUser(id string) (*User, error) {
    args := m.Called(id)
    return args.Get(0).(*User), args.Error(1)
}
```

```typescript
// jest mocks
jest.mock('./api', () => ({
  login: jest.fn(),
}));
```

---

## 🐛 Coverage de Bugs

```go
// Ao reportar bug, adicione teste
func Test_Bug123_LoginBlankPassword(t *testing.T) {
    // Test que reproduz o bug
    _, err := auth.Login("", "")
    assert.ErrorIs(t, err, ErrInvalidPassword)
}
```

---

## 📚 Referências

- [testing-go](https://github.com/stretchr/testify)
- [Jest](https://jestjs.io/)
- [Detox](https://wix.github.io/detox/)