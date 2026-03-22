# Security

## Isolamento Multi-Tenant

**Regra #1**: Toda query que acessa dados financeiros DEVE filtrar por `familia_id`.

- No repository: incluir `where: eq(table.familiaId, familiaId)` em toda query
- No service: receber `familiaId` do token JWT e repassar ao repository
- Nos testes: criar dados de duas famílias e validar que família A não vê dados da família B

## Autenticação JWT

- Rotas protegidas via plugin Fastify de JWT
- Access token: 15 minutos de validade
- Refresh token: 7 dias de validade
- Nunca expor secrets no código — usar variáveis de ambiente
- Validar token em toda rota que não seja pública (`/auth/login`, `/auth/register`, `/health`)

## Proteção de Secrets

- **Nunca** commitar arquivos `.env` reais
- **Nunca** logar secrets, tokens ou senhas
- Usar `.env.example` como referência (sem valores sensíveis)
- Hash de senha com `bcrypt` — nunca armazenar texto plano

## Validação de Input

- Toda rota DEVE ter schema Zod para validação de input
- Validar no boundary (route handler), não no service
- Rejeitar payloads malformados antes de tocar a lógica de negócio

## OWASP Top 10

- Sem SQL raw desnecessário (usar Drizzle ORM)
- CORS configurado para origens específicas (não usar `*` em produção)
- Rate limiting em rotas de autenticação
- Sem exposição do banco PostgreSQL fora da rede interna
