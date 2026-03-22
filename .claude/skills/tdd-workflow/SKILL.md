---
name: tdd-workflow
description: Ciclo Red-Green-Refactor genérico para qualquer feature do NossaGrana
autoApply: false
---

# TDD Workflow

Guia o ciclo completo de Test-Driven Development para qualquer feature.

## Princípios

- **Nunca** escrever código de produção sem um teste falhando
- **Mínimo** código para passar o teste — sem antecipação
- **Refatorar** apenas com testes verdes

## Ciclo

### Fase 1: RED — Teste que falha

1. Identificar o comportamento a implementar
2. Escrever um teste que expressa esse comportamento
3. Rodar o teste — confirmar que **falha** pelo motivo esperado

```bash
# Backend
pnpm --filter api test -- [arquivo.test.ts]

# Frontend
pnpm --filter web test -- [arquivo.test.tsx]
```

**Se o teste já passa**: o comportamento já existe. Escrever teste mais específico ou próximo comportamento.

### Fase 2: GREEN — Implementação mínima

1. Escrever o mínimo código para o teste passar
2. Rodar o teste — confirmar que **passa**
3. Rodar todos os testes do módulo — confirmar que nada quebrou

**Resistir à tentação de**:

- Adicionar features extras
- Otimizar performance
- Refatorar durante esta fase

### Fase 3: REFACTOR — Melhorar com segurança

1. Identificar code smells: duplicação, nomes ruins, funções longas
2. Fazer UMA mudança de refatoração
3. Rodar testes — confirmar que ainda passam
4. Repetir até satisfeito

### Próximo ciclo

Voltar para RED com o próximo comportamento.

## Checklist por Feature

### Backend (Módulo)

- [ ] RED: teste de criação
- [ ] GREEN: implementar criação
- [ ] RED: teste de listagem com filtro familia_id
- [ ] GREEN: implementar listagem
- [ ] RED: teste de isolamento multi-tenant
- [ ] GREEN: implementar filtro
- [ ] RED: teste de atualização
- [ ] GREEN: implementar atualização
- [ ] RED: teste de remoção
- [ ] GREEN: implementar remoção
- [ ] REFACTOR: revisar código completo

### Frontend (Página/Componente)

- [ ] RED: teste de renderização
- [ ] GREEN: implementar estrutura
- [ ] RED: teste de loading
- [ ] GREEN: implementar loading state
- [ ] RED: teste com dados
- [ ] GREEN: implementar exibição
- [ ] RED: teste de erro
- [ ] GREEN: implementar error state
- [ ] RED: teste de interação
- [ ] GREEN: implementar handlers
- [ ] REFACTOR: revisar código completo

## Validação Final

```bash
# Rodar todos os testes
pnpm test

# Verificar cobertura (meta: 80%)
pnpm test:coverage

# CI simulation
pnpm lint:fast && pnpm type-check && pnpm build && pnpm test
```
