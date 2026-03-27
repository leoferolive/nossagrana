# Templates de Transação — Design Spec

**Data:** 2026-03-27
**Status:** Aprovado

---

## Resumo

Sistema de templates de transações que funciona como um checklist mensal. Cada família pode ter seus próprios templates (nome + categoria + método de pagamento opcional) que aparecem numa tela dedicada "Lançamentos do Mês". O usuário seleciona o mês, preenche os valores dos templates aplicáveis e salva — criando transações reais em lote.

Templates de investimento podem ser vinculados a Cofrinhos, e ao aplicar, o valor é direcionado como aporte no cofrinho correspondente.

---

## Modelo de Dados

### Tabela `templates_transacao`

| Coluna                | Tipo                                           | Descrição                              |
| --------------------- | ---------------------------------------------- | -------------------------------------- |
| `id`                  | uuid (PK)                                      | Identificador                          |
| `familia_id`          | uuid (FK → familias, NOT NULL)                 | Isolamento multi-tenant                |
| `nome`                | text (NOT NULL)                                | Ex: "Luz", "Salário Leo"               |
| `tipo`                | pgEnum `transacao_tipo` (reusa enum existente) | Tipo da transação                      |
| `categoria_id`        | uuid (FK → categorias, nullable)               | Categoria associada (NULL se cofrinho) |
| `metodo_pagamento_id` | uuid (FK → metodos_pagamento)                  | Método de pagamento padrão (nullable)  |
| `cofrinho_id`         | uuid (FK → cofrinhos)                          | Cofrinho vinculado (nullable)          |
| `ordem`               | integer (default 0)                            | Ordenação na tela                      |
| `valor_padrao`        | numeric(14,2) (nullable)                       | Valor padrão pré-preenchido (opcional) |
| `ativo`               | boolean (default true)                         | Soft delete                            |
| `criado_por`          | uuid (FK → users, NOT NULL)                    | Quem criou                             |
| `criado_em`           | timestamp with tz (default now())              | Timestamp de criação                   |
| `atualizado_em`       | timestamp with tz (default now())              | Timestamp de última alteração          |

**Índices:**

- `idx_templates_transacao_familia_id` em `familia_id`
- Unique constraint: `(familia_id, nome, tipo)` — não duplicar templates com mesmo nome e tipo na mesma família

**Notas:**

- `valor_padrao` opcional — para despesas fixas (assinaturas, financiamento), pré-preenche o campo na tela. O usuário pode alterar.
- `categoria_id` é NULL quando o template tem `cofrinho_id`. Nesse caso, `CofrinhoService.aportar()` resolve a categoria "Cofrinho" (sistema) internamente.
- `categoria_id` é NOT NULL quando o template NÃO tem `cofrinho_id`.
- `tipo` reutiliza o pgEnum `transacao_tipo` já existente no schema.
- `ordem` permite organizar a lista (receitas primeiro, despesas agrupadas por categoria)

---

## Backend — Módulo `template-transacao`

### Estrutura

```
apps/api/src/modules/template-transacao/
├── template-transacao.types.ts
├── template-transacao.schema.ts
├── template-transacao.repository.ts
├── template-transacao.service.ts
├── template-transacao.routes.ts
├── template-transacao.repository.test.ts
└── template-transacao.service.test.ts
```

### Endpoints

| Método | Rota                             | Descrição                                     |
| ------ | -------------------------------- | --------------------------------------------- |
| GET    | `/templates-transacao`           | Listar templates da família (filtro por tipo) |
| POST   | `/templates-transacao`           | Criar template                                |
| PATCH  | `/templates-transacao/:id`       | Editar template                               |
| DELETE | `/templates-transacao/:id`       | Desativar template (soft delete)              |
| POST   | `/templates-transacao/aplicar`   | Aplicar templates → criar transações reais    |
| PATCH  | `/templates-transacao/reordenar` | Reordenar templates                           |

### GET `/templates-transacao`

**Query params:** `?tipo=receita|despesa` (opcional)

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "nome": "Luz",
      "tipo": "despesa",
      "categoriaId": "uuid",
      "categoriaNome": "Moradia",
      "metodoPagamentoId": "uuid | null",
      "metodoPagamentoNome": "Cartão Leo | null",
      "cofrinhoId": "uuid | null",
      "cofrinhoNome": "Fundo de Emergência | null",
      "cofrinhoEmoji": "🛡️ | null",
      "valorPadrao": "110.00 | null",
      "ordem": 1,
      "ativo": true
    }
  ]
}
```

### POST `/templates-transacao`

**Body:**

```json
{
  "nome": "Luz",
  "tipo": "despesa",
  "categoriaId": "uuid",
  "metodoPagamentoId": "uuid | null",
  "cofrinhoId": "uuid | null",
  "valorPadrao": "110.00 | null",
  "ordem": 0
}
```

**Validações:**

- `nome` obrigatório, não vazio
- `tipo` deve ser 'receita' ou 'despesa'
- `categoriaId` deve ser categoria ativa da família
- `cofrinhoId` (se informado) deve ser cofrinho ativo da família
- Unique constraint: não permitir duplicata de `(familiaId, nome, tipo)`

### PATCH `/templates-transacao/:id`

**Body (todos opcionais):**

```json
{
  "nome": "string",
  "categoriaId": "uuid",
  "metodoPagamentoId": "uuid | null",
  "cofrinhoId": "uuid | null",
  "valorPadrao": "110.00 | null",
  "ordem": 0
}
```

**Validação:** Template deve pertencer à `familia_id` do usuário.

### DELETE `/templates-transacao/:id`

Soft delete — seta `ativo = false`. Template deve pertencer à família.

### POST `/templates-transacao/aplicar`

Endpoint principal. Recebe os valores preenchidos e cria transações reais.

**Body:**

```json
{
  "mesReferencia": "2026-03",
  "itens": [
    { "templateId": "uuid", "valor": 285.71 },
    { "templateId": "uuid", "valor": 110.0 },
    { "templateId": "uuid", "valor": 200.0 }
  ]
}
```

**Fluxo:**

1. Validar `mesReferencia` (formato `YYYY-MM`)
2. Filtrar itens com `valor > 0`
3. Buscar os templates pelos IDs (validar que pertencem à família)
4. **Abrir transação de banco (DB transaction)** — toda a operação é atômica; se qualquer item falhar, tudo faz rollback
5. Para cada item:
   - **Se template tem `cofrinhoId`:** chamar `CofrinhoService.aportar()` com o valor, descrição = nome do template. **Nota:** `CofrinhoService.aportar()` atualmente não aceita `mesReferencia` como parâmetro — será necessário estender o método para aceitar `mesReferencia` e `data` opcionais, permitindo lançamentos retroativos/futuros.
   - **Se template NÃO tem `cofrinhoId`:** criar transação normal via `TransacaoService` com:
     - `tipo` = template.tipo
     - `valor` = valor informado
     - `categoriaId` = template.categoriaId
     - `descricao` = template.nome
     - `data` = primeiro dia do mesReferencia
     - `mesReferencia` = mesReferencia informado
     - `metodoPagamentoId` = template.metodoPagamentoId (se houver)
     - `usuarioRegistrouId` = ID do usuário autenticado (extraído do token JWT)
6. Retornar resumo: `{ transacoesCriadas: number, aportesCriados: number }`

**Nota sobre `usuarioRegistrouId` / `registradoPor`:** Tanto `TransacaoService` quanto `CofrinhoService.aportar()` requerem o ID do usuário. Este vem do token JWT do usuário autenticado, disponível via `request.user` nas routes.

**Validações:**

- `valor` deve ser > 0 em cada item
- Template deve estar ativo
- Cofrinho (se vinculado) deve estar ativo

**Response:**

```json
{
  "data": {
    "transacoesCriadas": 15,
    "aportesCriados": 3,
    "total": 18
  }
}
```

### PATCH `/templates-transacao/reordenar`

**Body:**

```json
{
  "itens": [
    { "id": "uuid", "ordem": 0 },
    { "id": "uuid", "ordem": 1 }
  ]
}
```

**Validações:**

- Todos os IDs devem pertencer à família do usuário
- Sem IDs duplicados
- `ordem` deve ser inteiro não-negativo

**Erros comuns (todos os endpoints):**

- `400` — validação de input falhou
- `404` — template/cofrinho/categoria não encontrado
- `409` — cofrinho encerrado (ao aplicar template com cofrinho inativo)

---

## Frontend

### Navegação

- **Screen:** `'lancamentos'` adicionado ao tipo `Screen` em `App.tsx`
- **Sidebar:** Nova entrada "Lançamentos" no menu desktop
- **Dashboard:** Atalho/card de acesso rápido na dashboard

### Tela "Lançamentos do Mês" (`lancamentos-page.tsx`)

**Layout:**

```
┌─────────────────────────────────────┐
│  Lançamentos do Mês                 │
│  [◀ Fev 2026] [Mar 2026] [Abr ▶]   │
├─────────────────────────────────────┤
│                                     │
│  RECEITAS                           │
│  ┌─────────────────────┬──────────┐ │
│  │ Salário Leo         │ R$ _____ │ │
│  │ Salário Beta        │ R$ _____ │ │
│  │ ...                 │          │ │
│  └─────────────────────┴──────────┘ │
│                                     │
│  MORADIA                            │
│  ┌─────────────────────┬──────────┐ │
│  │ Luz                 │ R$ _____ │ │
│  │ Gás                 │ R$ _____ │ │
│  │ Internet            │ R$ _____ │ │
│  │ ...                 │          │ │
│  └─────────────────────┴──────────┘ │
│                                     │
│  COFRINHOS                          │
│  ┌─────────────────────┬──────────┐ │
│  │ 🛡️ Fundo Emergência │ R$ _____ │ │
│  │ ✈️ Viagens           │ R$ _____ │ │
│  │ ...                 │          │ │
│  └─────────────────────┴──────────┘ │
│                                     │
│  ┌─────────────────────────────────┐ │
│  │ Total Receitas:    R$ X.XXX,XX │ │
│  │ Total Despesas:    R$ X.XXX,XX │ │
│  │ Saldo:             R$ X.XXX,XX │ │
│  └─────────────────────────────────┘ │
│                                     │
│  [ Salvar Lançamentos ]             │
└─────────────────────────────────────┘
```

**Agrupamento:**

1. Receitas (tipo = 'receita')
2. Despesas agrupadas por categoria (Moradia, Saúde, Transporte, etc.)
3. Cofrinhos (templates com `cofrinhoId`) — seção separada com emoji

**Comportamento:**

- Seletor de mês no topo (navegação ◀ ▶)
- Campos de valor são inputs numéricos, iniciam vazios
- Totais atualizam em tempo real conforme o usuário digita
- Botão "Salvar" envia apenas itens com valor > 0
- Após salvar: toast de sucesso com "X transações e Y aportes criados"
- Se já existem transações do mês (criadas por templates ou não), exibir indicador visual

**Gestão de templates:**

- Botão "Gerenciar Templates" (ícone engrenagem) que abre modal/tela para CRUD de templates
- Permitir adicionar, editar, reordenar (drag & drop) e desativar templates

### Zustand Store (`template-transacao.store.ts`)

```typescript
interface TemplateTransacaoStore {
  templates: TemplateTransacao[];
  valores: Record<string, string>; // templateId -> valor preenchido (string para precisão decimal)
  mesReferencia: string;
  loading: boolean;
  salvando: boolean;

  fetchTemplates: () => Promise<void>;
  setValor: (templateId: string, valor: string) => void;
  setMesReferencia: (mes: string) => void;
  aplicar: () => Promise<AplicarResult>;
}
```

### Componentes

| Componente                      | Descrição                                                   |
| ------------------------------- | ----------------------------------------------------------- |
| `lancamentos-page.tsx`          | Página principal com seletor de mês e lista                 |
| `template-grupo.tsx`            | Grupo de templates por categoria (header + lista de inputs) |
| `template-valor-input.tsx`      | Linha com nome do template + input de valor                 |
| `lancamentos-resumo.tsx`        | Card de totais (receitas, despesas, saldo)                  |
| `templates-gerenciar-modal.tsx` | Modal para CRUD de templates                                |

---

## Seed dos Templates (Planilha 2025)

Script em `apps/api/src/scripts/seed-templates.ts` que recebe `familiaId` e cria os templates.

### Mapeamento Planilha → Categorias do Sistema

**Receitas (tipo = 'receita'):**

| #   | Nome            | Categoria |
| --- | --------------- | --------- |
| 1   | Salário Leo     | Salário   |
| 2   | Salário Beta    | Salário   |
| 3   | 13º Leo         | Outros    |
| 4   | 13º Beta        | Outros    |
| 5   | Férias Leo      | Outros    |
| 6   | Férias Beta     | Outros    |
| 7   | Outros Receitas | Outros    |

**Despesas — Moradia:**

| #   | Nome                     | Categoria   |
| --- | ------------------------ | ----------- |
| 8   | Luz                      | Moradia     |
| 9   | Gás                      | Moradia     |
| 10  | Internet                 | Moradia     |
| 11  | YouTube Premium          | Assinaturas |
| 12  | Supermercado/Alimentação | Alimentação |
| 13  | Casa                     | Moradia     |
| 14  | IPTU                     | Moradia     |
| 15  | Seguro Residencial       | Moradia     |
| 16  | Condomínio               | Moradia     |
| 17  | Financiamento Imóvel     | Moradia     |

**Despesas — Saúde:**

| #   | Nome               | Categoria |
| --- | ------------------ | --------- |
| 18  | Seguro de Vida Leo | Saúde     |
| 19  | Consulta/Exames    | Saúde     |
| 20  | Vacina             | Saúde     |
| 21  | Plano Dental       | Saúde     |
| 22  | Medicamentos       | Saúde     |

**Despesas — Transporte:**

| #   | Nome                | Categoria  |
| --- | ------------------- | ---------- |
| 23  | Financiamento Carro | Transporte |
| 24  | Seguro Auto         | Transporte |
| 25  | Combustível         | Transporte |
| 26  | Revisão             | Transporte |
| 27  | IPVA                | Transporte |
| 28  | Veloe               | Transporte |
| 29  | Uber                | Transporte |
| 30  | Lavagem             | Transporte |
| 31  | Estacionamento      | Transporte |

**Despesas — Investimentos (vinculados a Cofrinhos):**

| #   | Nome                | Cofrinho vinculado             |
| --- | ------------------- | ------------------------------ |
| 32  | Fundo de Emergência | Cofrinho "Fundo de Emergência" |
| 33  | Aposentadoria       | Cofrinho "Aposentadoria"       |
| 34  | Viagens             | Cofrinho "Viagens"             |
| 35  | Carro               | Cofrinho "Carro"               |
| 36  | Flor                | Cofrinho "Flor"                |
| 37  | AP                  | Cofrinho "AP"                  |
| 38  | Poliana             | Cofrinho "Poliana"             |

**Nota:** O script de seed deve criar os cofrinhos se não existirem, antes de vincular aos templates.

**Despesas — Pessoais:**

| #   | Nome            | Categoria   |
| --- | --------------- | ----------- |
| 39  | Celular Beta    | Assinaturas |
| 40  | Celular Leo     | Assinaturas |
| 41  | Mensal Leo      | Compras     |
| 42  | Mensal Beta     | Compras     |
| 43  | Mensal Poli     | Compras     |
| 44  | Passeios        | Lazer       |
| 45  | Plano Livelo    | Assinaturas |
| 46  | ABACUS          | Assinaturas |
| 47  | Clube Smiles    | Assinaturas |
| 48  | Academia        | Saúde       |
| 49  | Natação Poli    | Educação    |
| 50  | Creche          | Educação    |
| 51  | Outros Despesas | Outros      |

**Total: 51 templates** (7 receitas + 44 despesas, sendo 7 vinculados a cofrinhos)

---

## Considerações

### Proteção contra duplicação

O endpoint `aplicar` não impede o usuário de aplicar templates mais de uma vez no mesmo mês. Isso é intencional — o usuário pode querer lançar despesas extras. A tela pode exibir um aviso "Você já lançou templates neste mês" como informação, mas não bloqueia.

### Isolamento multi-tenant

Todas as queries filtram por `familia_id`. Templates, categorias, cofrinhos e transações são isolados por família.

### Performance

A listagem de templates é uma query simples com JOINs para categoria, método de pagamento e cofrinho. Não há preocupação de performance — uma família terá no máximo ~100 templates.

### Testes

- **Backend:** InMemoryTemplateTransacaoRepository para testes unitários do service
- **Isolamento:** Testar que família A não vê templates de família B
- **Integração com Cofrinho:** Testar que aplicar template com cofrinhoId chama CofrinhoService.aportar()
- **Frontend:** Testar estados (loading, vazio, preenchido, salvando, sucesso, erro)
