# Shekinah Galaxy Quest

Monorepo pnpm com backend NestJS/MongoDB e administrativo React/Vite.
Nesta primeira versão: login administrativo integrado a Auth.js e cadastro de administradores por CLI. Mobile e funcionalidades de negócio ainda não estão implementados.

## Começar

1. Instale Node.js >=22.12 e pnpm 11.4.0; execute `pnpm install`.
2. Copie `.env.example` para `.env`; configure um MongoDB dedicado, APP_ORIGIN e AUTH_SECRET (`openssl rand -base64 48`).
3. Execute `pnpm exec tsx scripts/create-admin.ts` em terminal interativo.
4. Inicie a API com `pnpm dev:api` e o admin com `pnpm dev:admin`.
5. Acesse `http://localhost:5180` (ou a origem configurada).

Não há conta ou senha padrão. Credenciais não são armazenadas no navegador.

Consulte [ambiente e Docker Compose](aicontext/ambiente-local.md), [autenticação](aicontext/modules/auth.md), [stack](aicontext/stack-e-arquitetura.md) e [regras para agentes](AGENTS.md).
