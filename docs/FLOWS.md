# NossaGrana — Fluxos da Aplicação

---

## Fluxo 1 — Primeiro Acesso / Onboarding

```mermaid
flowchart TD
    A[Abrir App] --> B{Tem conta?}
    B -->|Não| C[Tela de Cadastro]
    C --> D[Preenche nome, email, senha]
    D --> E{Tem convite?}
    E -->|Sim - código/link| F[Entra na Família direto]
    E -->|Não| G{O que deseja?}
    G -->|Criar família| H[Cria Família - nome]
    H --> I[Vira Admin]
    I --> J[Dashboard vazio]
    G -->|Buscar família| K[Busca família]
    K --> L[Envia solicitação]
    L --> M[Aguarda aprovação do Admin]
    M --> J
    F --> J
    B -->|Sim| N[Tela de Login]
    N --> O[Email + Senha]
    O --> J
```

---

## Fluxo 2 — Navegação Principal (Tabs/Menu)

```mermaid
flowchart TD
    A[App Aberto - Logado] --> B[Bottom Navigation]
    B --> C[🏠 Dashboard]
    B --> D[📋 Extrato]
    B --> E[📊 Relatórios]
    B --> F[⚙️ Configurações]

    C --> G["Botão + flutuante (FAB)"]
    D --> G
    E --> G
    F --> G
    G --> H[Modal Nova Transação]

    F --> F1[Categorias]
    F --> F2[Cartões / Pagamentos]
    F --> F3[Orçamento Mensal]
    F --> F4[Família - membros/convite]
    F --> F5[Histórico de Meses]
    F --> F6[Perfil / Conta]
```

---

## Fluxo 3 — Nova Transação (Modal)

```mermaid
flowchart TD
    A["Clica no botão +"] --> B[Abre Modal]
    B --> C[Seleciona tipo: Receita / Despesa]
    C --> D[Preenche valor]
    D --> E[Seleciona categoria]
    E --> F[Descrição - opcional]
    F --> G[Data - default: hoje]
    G --> H[Método de pagamento - opcional]
    H --> I{É cartão de crédito?}
    I -->|Sim| J[Mês referência calculado pela fatura]
    I -->|Não| K[Mês referência = mês da data]
    J --> L{Parcelado?}
    K --> L
    L -->|Sim| M[Informa número de parcelas]
    M --> N[Sistema calcula valor da parcela]
    N --> O{Recorrente?}
    L -->|Não| O
    O -->|Sim| P[Seleciona frequência + data fim opcional]
    P --> Q[Salvar]
    O -->|Não| Q
    Q --> R[Transação criada]
    R --> S[Dashboard atualiza via WebSocket]
    R --> T{Parcelado?}
    T -->|Sim| U[Sistema cria N parcelas futuras]
    T -->|Não| V[Fim]
    U --> V
```

---

## Fluxo 4 — Dashboard do Mês

```mermaid
flowchart TD
    A[Dashboard] --> B[Resumo: Receitas / Despesas / Saldo]
    A --> C[Gráfico: Despesas por Categoria]
    A --> D[Gráfico: Evolução de Gastos no Mês]
    A --> E[Comparação com Mês Anterior]
    A --> F[Orçamento: Barras de Progresso]

    F --> F1{Progresso}
    F1 -->|"< 80%"| F2[🟢 Normal]
    F1 -->|">= 80%"| F3[🟡 Alerta Amarelo]
    F1 -->|">= 100%"| F4[🔴 Alerta Vermelho]

    B --> G[Clica no resumo]
    G --> H[Vai pro Extrato filtrado]

    C --> I[Clica na categoria]
    I --> H
```

---

## Fluxo 5 — Extrato do Mês

```mermaid
flowchart TD
    A[Extrato] --> B[Lista cronológica de transações]
    A --> C[Filtros]
    C --> C1[Por usuário]
    C --> C2[Por categoria]
    C --> C3[Por tipo - receita/despesa]
    C --> C4[Por método de pagamento]

    B --> D[Clica numa transação]
    D --> E[Detalhe da transação]
    E --> F[Editar]
    E --> G[Excluir]

    F --> H{Mês tem snapshot?}
    H -->|Sim| I[Edita normalmente - marca divergência]
    H -->|Não| J[Edita normalmente]

    E --> K{É parcela?}
    K -->|Sim| L[Mostra 'Parcela X/N' + link pra transação original]
    K -->|Não| M[Detalhe normal]
```

---

## Fluxo 6 — Gestão de Família (Admin)

```mermaid
flowchart TD
    A[Configurações > Família] --> B[Ver membros]
    A --> C[Gerar código/link de convite]
    A --> D[Ver solicitações pendentes]

    D --> E[Solicitação de entrada]
    E --> F{Ação do Admin}
    F -->|Aprovar| G[Usuário vira membro]
    F -->|Rejeitar| H[Solicitação recusada]

    B --> I[Clica num membro]
    I --> J{É admin?}
    J -->|Sim - outro membro| K[Opção: Remover membro]
    J -->|É o próprio admin| L[Sem ação]
```

---

## Fluxo 7 — Histórico de Meses

```mermaid
flowchart TD
    A[Histórico de Meses] --> B[Gráfico de tendência no topo]
    B --> B1[Evolução: Receita x Despesa x Saldo]

    A --> C[Lista de meses]
    C --> D[Cada mês mostra: Receita / Despesa / Saldo]

    D --> E{Tem divergência?}
    E -->|Sim| F[⚠️ Indicador de divergência]
    E -->|Não| G[✅ Snapshot íntegro]

    D --> H[Clica no mês]
    H --> I[Detalhe do mês]
    I --> I1[Relatório completo]
    I --> I2[Distribuição por categoria]
    I --> I3[Gastos por usuário]
    I --> I4[Insights / Tendências]
    I --> I5[Comparação snapshot vs dados atuais - se divergente]
```
