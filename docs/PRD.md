# NossaGrana — Product Requirements Document

**Versão:** v2.1 | **Data:** Março 2026

---

## 1. Visão Geral

**NossaGrana** é um PWA de gestão financeira familiar, self-hosted em Raspberry Pi, focado em simplicidade e colaboração em tempo real. O objetivo é substituir planilhas compartilhadas por uma experiência prática e visual.

### Objetivos

- Registrar entradas e saídas de dinheiro
- Categorizar todas as transações
- Acompanhar saldo e extrato durante o mês
- Gerar snapshots automáticos no fechamento mensal
- Visualizar gráficos e insights sobre gastos
- Gerenciar cartões de crédito com controle de faturas
- Configurar transações recorrentes e parceladas
- Definir orçamentos por categoria com alertas visuais

---

## 2. Usuários

### Modelo Multi-Tenant

O sistema suporta múltiplas famílias, cada uma com dados completamente isolados.

### Papéis

| Papel | Permissões |
|---|---|
| **Admin** | Criou a família. Pode excluir a família, aprovar solicitações e remover membros. |
| **Membro** | Acesso total a leitura e edição de todos os dados financeiros da família. |
| **System Admin** | Role especial no banco. Pode impersonar usuários e recuperar famílias excluídas. |

### Entrada na Família

1. **Código/Link de convite:** Admin gera código → novo usuário entra direto
2. **Solicitação:** Usuário busca a família → envia solicitação → Admin aprova ou rejeita

---

## 3. Modelo de Dados

### User
```
id, nome, email, senha (hash bcrypt/argon2), data_criacao
```

### Familia
```
id, nome, data_criacao
```

### UsuarioFamilia
```
usuario_id, familia_id, role (admin | membro), data_entrada
```

### MetodoPagamento
```
id, familia_id, nome, tipo (credito | debito | pix | dinheiro),
data_fechamento (só crédito - dia do mês),
data_vencimento (só crédito - dia do mês),
usuario_dono_id, ativo, criado_em
```

### Categoria
```
id, familia_id, nome, tipo (receita | despesa), ativo, criado_por, criado_em
```

**Categorias padrão:**
- Receitas: Salário, Bônus, Investimentos, Outros
- Despesas: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Assinaturas, Compras, Outros

### Transacao
```
id, familia_id, tipo (receita | despesa), valor, categoria_id, descricao, data,
mes_referencia (calculado automaticamente), metodo_pagamento_id (opcional),
usuario_registrou_id, recorrente, frequencia (mensal | semanal | quinzenal),
data_fim_recorrencia (opcional), parcelado, numero_parcelas, parcela_atual,
valor_total, valor_parcela, transacao_pai_id, criado_em, atualizado_em
```

**Regra de mês de referência:**
- Padrão: `mes_referencia` = mês da `data`
- Cartão de crédito: `mes_referencia` = mês da fatura, calculado com base na `data_fechamento`
  - Data da transação **após** o fechamento → próximo mês
  - Data da transação **antes** do fechamento → mês atual

### OrcamentoCategoria
```
id, familia_id, categoria_id, valor_limite,
vigencia_inicio (mês/ano), vigencia_fim (null = vigente),
criado_por, criado_em
```

Alteração de limite: registro atual recebe `vigencia_fim` e novo registro é criado. Histórico preservado.

### SnapshotMensal
```
id, familia_id, mes_referencia, total_receitas, total_despesas, saldo,
dados_categorias (JSON), dados_usuarios (JSON),
divergente (flag se dados foram alterados após snapshot), gerado_em
```

---

## 4. Funcionalidades

### 4.1 Dashboard
- Resumo: Receitas / Despesas / Saldo do mês
- Gráfico de despesas por categoria
- Evolução de gastos durante o mês
- Comparação com mês anterior
- Barras de progresso de orçamento (🟢 < 80% | 🟡 >= 80% | 🔴 >= 100%)
- Atualização em tempo real via WebSocket/SSE

### 4.2 Registro de Transação
- Ação de nova transação (`+`) sempre visível nas telas principais
  - Mobile: FAB flutuante
  - Desktop: botão fixo na barra superior
- Modal com: tipo, valor, categoria, descrição, data, método de pagamento
- Opções: recorrente (frequência + data fim), parcelado (nº de parcelas)
- Defaults: tipo=despesa, data=hoje

### 4.3 Extrato do Mês
- Lista cronológica de transações
- Filtros: por usuário, categoria, tipo, método de pagamento
- Parcelas: exibem "Parcela X/N" com link para transação original

### 4.4 Gestão de Categorias
- Listar, criar, editar e desativar (soft delete)
- Categorias padrão podem ser editadas mas não excluídas

### 4.5 Gestão de Métodos de Pagamento
- Cadastrar, editar e desativar
- Visualizar fatura do cartão por mês

### 4.6 Orçamento Mensal
- Tabela editável: categoria × limite vigente
- Barras de progresso com % utilizado
- Histórico de alterações de limite

### 4.7 Relatórios e Insights
- Distribuição de gastos por categoria
- Gastos por usuário
- Tendências e comparação com mês anterior
- Insights automáticos (ex: "Você gastou 25% mais com lazer que no mês passado.")

### 4.8 Histórico de Meses
- Gráfico de tendência (receita / despesa / saldo ao longo dos meses)
- Lista de meses com resumo
- Indicador de divergência quando snapshot difere dos dados atuais

### 4.9 Gestão de Família (Admin)
- Ver membros, gerar convite, ver solicitações pendentes
- Aprovar/rejeitar solicitações, remover membros, excluir família

### 4.10 Snapshot Mensal (Sistema)
- Job agendado no último dia de cada mês
- Transações podem ser editadas livremente a qualquer momento
- Edição pós-snapshot: flag `divergente = true` é ativado
- Snapshot original sempre preservado

### 4.11 Guia In-App
- **First-time tour:** exibido uma vez por tela, pode ser pulado
- **Tooltips contextuais:** ícones "?" em campos que geram dúvida
- **Empty states educativos:** mensagem + CTA quando sem dados
- **FAQ:** em Configurações > Ajuda, organizado por tema

> **Regra:** Toda nova funcionalidade deve incluir tour, tooltips, empty state e entrada no FAQ. Isso faz parte do Definition of Done.

---

## 5. Requisitos Não Funcionais

| Categoria | Requisito |
|---|---|
| Performance | Carregamento < 2s |
| Segurança | JWT + refresh token, bcrypt/argon2, HTTPS via Cloudflare Tunnel |
| Banco | PostgreSQL acessível somente via localhost / rede interna |
| Usabilidade | Registro de transação em < 5 segundos |
| Responsividade | Celular, tablet e desktop |
| PWA | Instalável como app no celular |
| Tempo real | WebSocket/SSE para sincronização entre membros da família |

### 5.1 Diretrizes Visuais (MVP)

- **Tema padrão:** dark (como nos wireframes desktop/mobile), mantendo contraste AA para texto e controles.
- **Cores semânticas obrigatórias:**
  - `success` (receitas / status positivo)
  - `danger` (despesas / erro / estouro)
  - `warning` (alerta de orçamento >= 80%)
  - `info` (saldo / destaque informativo)
  - `muted` (texto secundário e bordas)
- **Tokens de UI:** cores, espaçamentos, raio, tipografia e sombras devem ser centralizados em tokens (Tailwind theme/CSS variables), evitando valores hardcoded espalhados.
- **Iconografia:** usar biblioteca única de ícones (consistente em web e mobile), com mapeamento semântico por domínio (transação, orçamento, família, ajuda, status).
- **Estados visuais mínimos por componente:** default, hover/focus, ativo, desabilitado e erro.
- **Acessibilidade visual:** foco visível para navegação por teclado, contraste mínimo e não depender apenas de cor para indicar estado (ex: incluir label/ícone em orçamento e divergência).

---

## 6. Telas Principais

1. Login
2. Cadastro / Entrada na Família (criar família, entrar por convite, buscar e solicitar)
3. Dashboard financeiro
4. Modal Nova Transação (FAB)
5. Extrato do mês
6. Categorias
7. Cartões / Métodos de Pagamento
8. Orçamento mensal
9. Relatórios e Insights
10. Histórico de meses
11. Configurações (hub mobile)
12. Configurações da Família (admin)
13. Perfil / Conta
14. Ajuda / FAQ

---

## 7. MVP — Escopo Incluído

- Login / cadastro de usuários
- Criação e gestão de família (convite + solicitação)
- Transações: simples, recorrentes e parceladas
- Cadastro de cartões / métodos de pagamento
- Mês de referência automático (com regra de fatura para crédito)
- Categorias (padrão + customizáveis)
- Orçamento por categoria (versionado com alertas visuais)
- Dashboard com resumo + gráficos
- Extrato mensal com filtros
- Snapshot automático mensal + flag de divergência
- Relatórios e insights
- Histórico de meses
- PWA instalável
- Tempo real via WebSocket/SSE
- Guia in-app completo

## 7.1 Fora do MVP (Futuro)

- Importação de extrato bancário (CSV/OFX)
- App mobile nativo
- IA para insights avançados
- Metas financeiras, projeção de saldo, planejamento anual
- Alertas por push/email
