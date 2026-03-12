
# NossaGrana — Casos de Uso

**Versão 1.0 • Março 2026**

---

## Atores

| Ator | Descrição |
|---|---|
| **Usuário não autenticado** | Pessoa sem conta ou sem login ativo |
| **Membro** | Usuário autenticado e associado a uma família. Acesso total de leitura e edição |
| **Admin da Família** | Membro criador da família. Herda permissões de Membro + gerencia membros e convites |
| **System Admin** | Role especial no banco. Pode impersonar usuários e recuperar famílias excluídas |
| **Sistema** | Processos automatizados (jobs agendados, WebSocket, cálculos automáticos) |

---

## Sumário

| ID | Nome | Ator |
|---|---|---|
| UC01 | Cadastrar conta | Usuário não autenticado |
| UC02 | Fazer login | Usuário não autenticado |
| UC03 | Entrar em família via convite | Usuário não autenticado / Membro |
| UC04 | Solicitar entrada em família | Usuário não autenticado / Membro |
| UC05 | Criar família | Usuário autenticado sem família |
| UC06 | Registrar transação | Membro |
| UC07 | Registrar transação parcelada | Membro |
| UC08 | Registrar transação recorrente | Membro |
| UC09 | Editar transação | Membro |
| UC10 | Excluir transação | Membro |
| UC11 | Antecipar parcelas | Membro |
| UC12 | Visualizar dashboard | Membro |
| UC13 | Visualizar extrato | Membro |
| UC14 | Visualizar relatórios | Membro |
| UC15 | Visualizar histórico de meses | Membro |
| UC16 | Visualizar fatura do cartão | Membro |
| UC17 | Gerenciar categorias | Membro |
| UC18 | Gerenciar métodos de pagamento | Membro |
| UC19 | Configurar orçamento por categoria | Membro |
| UC20 | Alternar família ativa | Membro (múltiplas famílias) |
| UC21 | Gerar código/link de convite | Admin |
| UC22 | Aprovar solicitação de entrada | Admin |
| UC23 | Remover membro da família | Admin |
| UC24 | Excluir família | Admin |
| UC25 | Recuperar família excluída | System Admin |
| UC26 | Impersonar usuário | System Admin |
| UC27 | Gerar snapshot mensal | Sistema |
| UC28 | Marcar snapshot como divergente | Sistema |
| UC29 | Gerar parcelas futuras | Sistema |
| UC30 | Gerar recorrências futuras | Sistema |
| UC31 | Calcular mês de referência | Sistema |
| UC32 | Sincronizar dashboard em tempo real | Sistema |

---

## Detalhamento

### UC01 — Cadastrar Conta
**Ator:** Usuário não autenticado

**Fluxo principal:**
1. Acessa a tela de cadastro
2. Informa nome, email e senha
3. Sistema valida os dados e cria a conta
4. Sistema verifica se usuário possui convite pendente
5. Se sim: entra direto na família convidada
6. Se não: redireciona para onboarding de família (UC05 ou UC03)

**Regras de negócio:**
- Email deve ser único no sistema
- Senha armazenada com bcrypt/argon2

**Exceções:** Email já cadastrado → mensagem de erro

---

### UC02 — Fazer Login
**Ator:** Usuário não autenticado

**Fluxo principal:**
1. Informa email e senha
2. Sistema valida credenciais e emite JWT + refresh token
3. Se uma família: redireciona para dashboard
4. Se múltiplas famílias: exibe seletor de família (UC20)
5. Se sem família: redireciona para onboarding

**Regras de negócio:**
- JWT com expiração curta; refresh token com expiração longa
- Sessão vinculada à família ativa selecionada

**Exceções:** Credenciais inválidas → mensagem de erro sem especificar qual campo

---

### UC03 — Entrar em Família via Convite
**Ator:** Usuário não autenticado / Membro

**Fluxo principal:**
1. Recebe código ou link de convite
2. Informa o código no app (no cadastro ou após login)
3. Sistema valida o código e associa o usuário à família
4. Usuário passa a ter acesso completo aos dados da família

**Regras de negócio:**
- Convite adiciona o usuário à família; não substitui famílias existentes
- Usuário pode pertencer a múltiplas famílias simultaneamente
- Usuário já logado pode usar convite para entrar em nova família

**Exceções:** Código inválido ou expirado → mensagem de erro

---

### UC04 — Solicitar Entrada em Família
**Ator:** Usuário não autenticado / Membro

**Fluxo principal:**
1. Busca a família pelo nome
2. Seleciona a família desejada
3. Envia solicitação de entrada
4. Aguarda aprovação do Admin (UC22)

**Regras de negócio:** Solicitação fica pendente até o Admin aprovar ou rejeitar

**Exceções:** Família não encontrada → mensagem adequada

---

### UC05 — Criar Família
**Ator:** Usuário autenticado sem família

**Fluxo principal:**
1. Informa o nome da família
2. Sistema cria a família e associa o usuário como Admin
3. Redireciona para o dashboard vazio

**Regras de negócio:**
- O criador é automaticamente o Admin
- Um usuário pode criar ou participar de múltiplas famílias

---

### UC06 — Registrar Transação
**Ator:** Membro

**Fluxo principal:**
1. Clica no botão flutuante "+"
2. Informa tipo (receita/despesa), valor, categoria
3. Informa descrição (opcional), data (default: hoje), método de pagamento (opcional)
4. Salva a transação
5. Dashboard atualiza via WebSocket para todos os membros da família ativa

**Regras de negócio:**
- Mês de referência calculado automaticamente (UC31)
- Transação associada ao usuário que registrou

---

### UC07 — Registrar Transação Parcelada
**Ator:** Membro

**Fluxo principal:**
1. Segue fluxo de UC06
2. Marca opção "Parcelado" e informa número de parcelas
3. Sistema calcula valor de cada parcela (valor total / nº parcelas)
4. Salva transação e dispara geração automática das parcelas (UC29)

**Regras de negócio:**
- Cada parcela referencia a transação original via `transacao_pai_id`
- Mês de referência de cada parcela calculado com base na data de fechamento do cartão (UC31)
- Parcela só pode ser editada se o mês de referência ainda não fechou
- Parcela não pode ser excluída individualmente se o mês já fechou

---

### UC08 — Registrar Transação Recorrente
**Ator:** Membro

**Fluxo principal:**
1. Segue fluxo de UC06
2. Marca "Recorrente", seleciona frequência (mensal/semanal/quinzenal)
3. Informa data fim (opcional; null = sem prazo)
4. Salva transação e dispara geração automática das recorrências (UC30)

**Regras de negócio:**
- Frequências disponíveis: mensal, semanal, quinzenal
- Usuário pode cancelar a recorrência a qualquer momento

---

### UC09 — Editar Transação
**Ator:** Membro

**Fluxo principal:**
1. Seleciona transação no extrato
2. Edita os campos desejados
3. Para transação recorrente: sistema pergunta se é "Só esta ocorrência" ou "Esta e as futuras"
4. Salva alterações
5. Se o mês já tiver snapshot, flag `divergente` é ativado (UC28)

**Regras de negócio:**
- Transação parcelada: só pode ser editada se o mês de referência ainda não fechou
- Transação recorrente: edição pode ser individual ou propagar para futuras

**Exceções:** Mês fechado (parcelado) → edição bloqueada

---

### UC10 — Excluir Transação
**Ator:** Membro

**Fluxo principal:**
1. Seleciona transação no extrato
2. Confirma exclusão
3. Para transação recorrente: remove esta e todas as futuras
4. Sistema valida se a exclusão é permitida

**Regras de negócio:**
- Bloqueada se o mês de referência já fechou (parcelado ou recorrente)
- Exceção: transação antecipada pode ser excluída em mês aberto
- Recorrente: não é possível remover apenas uma ocorrência passada

**Exceções:** Mês fechado → exclusão bloqueada com mensagem explicativa

---

### UC11 — Antecipar Parcelas
**Ator:** Membro

**Fluxo principal:**
1. Seleciona transação parcelada no extrato
2. Acessa opção "Antecipar parcelas"
3. Informa quantas parcelas deseja antecipar
4. Sistema calcula valor total das parcelas selecionadas
5. Sistema cria nova transação no mês atual com o valor total antecipado
6. Parcelas correspondentes são excluídas; restantes continuam normalmente

**Regras de negócio:**
- Só permitida em mês ainda aberto
- Se antecipar todas: nenhuma parcela futura permanece
- Se antecipar parcialmente: parcelas restantes continuam com numeração original

---

### UC12 — Visualizar Dashboard
**Ator:** Membro

**Fluxo principal:**
1. Acessa a tela principal
2. Visualiza resumo: receitas, despesas e saldo do mês
3. Visualiza gráfico de despesas por categoria
4. Visualiza evolução de gastos no mês
5. Visualiza barras de orçamento por categoria com alertas visuais
6. Dashboard atualiza automaticamente via WebSocket

**Regras de negócio:**
- Alertas: amarelo >= 80%, vermelho >= 100%
- Dados em tempo real; não dependem do snapshot mensal
- WebSocket ativo apenas para a família atualmente selecionada

---

### UC13 — Visualizar Extrato
**Ator:** Membro

**Fluxo principal:**
1. Acessa a tela de extrato
2. Visualiza lista de transações ordenadas por data
3. Aplica filtros: por usuário, categoria, tipo ou método de pagamento
4. Clica em transação para ver detalhes
5. Pode editar (UC09) ou excluir (UC10) a partir do detalhe

**Regras de negócio:**
- Parcelas exibem "Parcela X/N" com link para transação original
- Transações recorrentes exibem badge "Recorrente"

---

### UC14 — Visualizar Relatórios
**Ator:** Membro

**Fluxo principal:**
1. Acessa a tela de relatórios
2. Visualiza distribuição de gastos por categoria (gráfico)
3. Visualiza gastos por membro da família
4. Visualiza evolução mensal (comparação com meses anteriores)
5. Visualiza tendências e insights automáticos

---

### UC15 — Visualizar Histórico de Meses
**Ator:** Membro

**Fluxo principal:**
1. Acessa a tela de histórico
2. Visualiza gráfico de tendência (receita × despesa × saldo)
3. Visualiza lista de meses com receita, despesa e saldo
4. Meses com divergência exibem indicador visual
5. Clica no mês para ver relatório detalhado

**Regras de negócio:** Snapshots divergentes exibem comparação entre snapshot original e dados atuais

---

### UC16 — Visualizar Fatura do Cartão
**Ator:** Membro

**Fluxo principal:**
1. Acessa a tela de fatura (via Cartões)
2. Seleciona o cartão e o mês de referência
3. Visualiza todas as transações daquela fatura
4. Visualiza total da fatura

**Regras de negócio:** Mês de referência calculado com base na data de fechamento do cartão (UC31)

---

### UC17 — Gerenciar Categorias
**Ator:** Membro

**Fluxo principal:**
1. Acessa Configurações > Categorias
2. Visualiza categorias ativas (padrão e customizadas)
3. Cria nova categoria informando nome e tipo (receita/despesa)
4. Edita nome de categoria existente
5. Desativa categoria (soft delete)

**Regras de negócio:**
- Categorias padrão podem ser editadas mas não excluídas
- Categorias desativadas não aparecem no seletor de novas transações
- Transações antigas mantêm a categoria mesmo após desativação

---

### UC18 — Gerenciar Métodos de Pagamento
**Ator:** Membro

**Fluxo principal:**
1. Acessa Configurações > Cartões
2. Visualiza métodos ativos
3. Cadastra novo método: nome, tipo, datas de fechamento/vencimento (crédito), dono
4. Edita dados do método
5. Desativa método (soft delete)

**Regras de negócio:**
- Tipos: crédito, débito, pix, dinheiro
- Datas de fechamento e vencimento apenas para cartão de crédito
- Método desativado não aparece em novas transações

---

### UC19 — Configurar Orçamento por Categoria
**Ator:** Membro

**Fluxo principal:**
1. Acessa Configurações > Orçamento
2. Visualiza categorias com limite vigente e % utilizado
3. Define ou altera limite de uma categoria
4. Sistema registra data de vigência do novo limite

**Regras de negócio:**
- Orçamento vale a partir do mês de cadastro
- Alteração cria novo registro de vigência; histórico preservado
- Relatórios usam o limite vigente no mês de referência

---

### UC20 — Alternar Família Ativa
**Ator:** Membro (com múltiplas famílias)

**Fluxo principal:**
1. No login: se múltiplas famílias, exibe seletor
2. Dentro do app: acessa seletor de família no menu
3. Seleciona a família desejada
4. Dashboard, extrato e todos os dados passam a refletir a família selecionada

**Regras de negócio:**
- WebSocket ativo apenas para a família selecionada no momento
- Dados de cada família são completamente isolados

---

### UC21 — Gerar Código/Link de Convite
**Ator:** Admin da Família

**Fluxo principal:**
1. Acessa Configurações > Família
2. Clica em "Gerar convite"
3. Sistema gera código único
4. Admin copia e compartilha o código ou link

**Regras de negócio:** Código é único por família; novo usuário usa em UC03

---

### UC22 — Aprovar Solicitação de Entrada
**Ator:** Admin da Família

**Fluxo principal:**
1. Visualiza solicitações pendentes em Configurações > Família
2. Seleciona solicitação
3. Aprova: usuário é associado à família como Membro
4. Rejeita: solicitação é descartada

---

### UC23 — Remover Membro da Família
**Ator:** Admin da Família

**Fluxo principal:**
1. Acessa Configurações > Família > Membros
2. Seleciona o membro a remover
3. Confirma remoção
4. Membro perde acesso imediatamente

**Regras de negócio:**
- Admin não pode remover a si mesmo
- Transações registradas pelo membro removido são preservadas

---

### UC24 — Excluir Família
**Ator:** Admin da Família

**Fluxo principal:**
1. Admin acessa configurações da família
2. Confirma exclusão
3. Sistema realiza soft delete da família
4. Todos os membros perdem acesso imediatamente

**Regras de negócio:**
- Exclusão é lógica: dados preservados no banco
- Recuperação somente por System Admin (UC25)

---

### UC25 — Recuperar Família Excluída
**Ator:** System Admin

**Fluxo principal:**
1. Acessa interface administrativa
2. Busca família pelo nome ou ID
3. Seleciona família com status excluído
4. Confirma recuperação
5. Família volta ao estado ativo; membros originais recuperam acesso

**Regras de negócio:** Operação exclusiva do System Admin; sem prazo para recuperação

---

### UC26 — Impersonar Usuário
**Ator:** System Admin

**Fluxo principal:**
1. Acessa interface administrativa
2. Busca usuário pelo email ou ID
3. Inicia impersonação
4. Sistema cria sessão autenticada como o usuário selecionado
5. System Admin visualiza e age como se fosse aquele usuário

**Regras de negócio:**
- Disponível apenas via interface administrativa
- Não altera dados do usuário impersonado

---

### UC27 — Gerar Snapshot Mensal
**Ator:** Sistema

**Fluxo principal:**
1. Job executa no último dia do mês
2. Calcula total de receitas, despesas e saldo do mês
3. Gera breakdown por categoria e por usuário
4. Persiste snapshot com `divergente = false`

**Regras de negócio:**
- Executado sempre no último dia do mês, independente do número de dias
- Snapshot original preservado mesmo após edições posteriores

**Exceções:** Servidor offline → job executado assim que o sistema voltar (retry)

---

### UC28 — Marcar Snapshot como Divergente
**Ator:** Sistema

**Fluxo principal:**
1. Usuário edita ou exclui transação de mês que já possui snapshot
2. Sistema identifica que o mês tem snapshot
3. Atualiza `divergente = true` no snapshot correspondente
4. Histórico exibe indicador visual de divergência

**Regras de negócio:**
- Snapshot original não é recalculado; divergência apenas sinaliza a alteração
- Tela de histórico permite comparar snapshot original vs dados atuais

---

### UC29 — Gerar Parcelas Futuras
**Ator:** Sistema

**Fluxo principal:**
1. Após UC07 ser salvo
2. Calcula mês de referência de cada parcela com base na data de fechamento do cartão
3. Cria N transações com `transacao_pai_id` referenciando a transação original
4. Cada parcela exibe numeração "Parcela X/N"

**Regras de negócio:**
- Valor de cada parcela = valor total / número de parcelas
- Mês de referência segue regra de fatura do cartão (UC31)

---

### UC30 — Gerar Recorrências Futuras
**Ator:** Sistema

**Fluxo principal:**
1. Após UC08 ser salvo
2. Sistema gera lançamentos conforme frequência (mensal/semanal/quinzenal)
3. Gera até a data fim (se definida) ou indefinidamente

**Regras de negócio:**
- Lançamentos gerados podem ser editados individualmente ou a partir de uma data (UC09)
- Cancelamento da recorrência remove lançamentos futuros não processados

---

### UC31 — Calcular Mês de Referência
**Ator:** Sistema

**Fluxo principal:**
1. Recebe data da transação e método de pagamento
2. Se método for cartão de crédito: verifica data de fechamento do cartão
3. Data da transação **após** o fechamento → mês de referência = próximo mês
4. Data da transação **antes** do fechamento → mês de referência = mês atual
5. Se método não for crédito → mês de referência = mês da data da transação

**Regras de negócio:** Regra aplicada automaticamente em UC06, UC07, UC08 e UC29

---

### UC32 — Sincronizar Dashboard em Tempo Real
**Ator:** Sistema

**Fluxo principal:**
1. Membro salva transação
2. Sistema emite evento WebSocket para todos os membros conectados na mesma família ativa
3. Dashboard dos demais membros atualiza automaticamente

**Regras de negócio:**
- Notificações apenas para a família ativa de cada usuário no momento
- Usuários conectados em outras famílias não recebem a notificação
