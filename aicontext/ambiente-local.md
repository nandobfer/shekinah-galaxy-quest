# Ambiente e bootstrap

## Preparação

- Node.js >=22.12 e pnpm 11.4.0. Dependências ficam no lockfile único da raiz.
- `pnpm install`.
- Copie `.env.example` para `.env`, ajuste MONGODB_URI e APP_ORIGIN e gere AUTH_SECRET com `openssl rand -base64 48`. Não publique o resultado.
- O MongoDB deve estar disponível e a URI deve incluir um banco dedicado. Este bootstrap **não** altera, inicia ou provisiona o MongoDB compartilhado; não há usuário administrador inicial.
- Foi detectado MongoDB local na porta 27017, mas sua autenticação/topologia não é presumida. Nenhuma credencial anterior foi reutilizada. Serviços antigos com nome Shekinah não são gerenciados por este Compose.

## Desenvolvimento

- API: `pnpm dev:api` (porta configurável, padrão 3010).
- Admin: `pnpm dev:admin` (padrão 5180, strictPort). Acesse a origem exata configurada em APP_ORIGIN.
- O proxy Vite encaminha `/api` para API_PROXY_TARGET. Nenhuma variável pública contém segredos.
- Criar administrador: `pnpm exec tsx scripts/create-admin.ts`, na raiz, com terminal interativo. O script grava somente quando executado pelo operador.

## Docker Compose

- Desenvolvimento containerizado: `docker compose -f docker-compose.dev.yml up --build` **somente com autorização para build/iniciar serviços**.
- Produção: `docker compose up -d --build`, também sujeito à autorização. API usa runtime tsx, sem compilação Nest no startup; admin é estático servido por Nginx, que encaminha `/api` ao backend.
- Configure MONGODB_URI para host acessível na rede Docker externa MONGODB_NETWORK (padrão `mongodb-network`). `127.0.0.1` dentro do contêiner não aponta ao MongoDB do host.
- Produção exige APP_ORIGIN HTTPS e terminação TLS externa aprovada. A porta web é publicada somente em loopback por padrão. Não exponha o bootstrap diretamente por HTTP em produção.
- Imagens versionadas por APP_VERSION. O Compose usa projetos `shekinah-bootstrap` / `shekinah-bootstrap-dev`, sem assumir controle dos contêineres antigos.
- Não existem serviços Pusher/S3/mobile ou banco gerenciado neste Compose; só os serviços implementados. Não há backup/snapshot configurado ou promessa de recuperação.

## Validação sem build

- `pnpm typecheck` e `pnpm lint`.
- Testes focados: `pnpm exec vitest run apps/api/src/__tests__/auth.integration.test.ts` (API), `pnpm exec vitest run apps/admin/src/features/auth/__tests__/login-page.test.tsx` (login) e demais caminhos explícitos pertinentes. A configuração raiz reúne projetos `api`, `admin`, `contracts` e `api-client`. Nunca `pnpm test` sem filtro durante desenvolvimento autônomo.
- A integração de auth usa `mongodb-memory-server-core` (processo MongoDB temporário, não mock), banco efêmero e limpeza ao final; pode baixar o binário do MongoDB na primeira execução. Não lê MONGODB_URI real e não precisa escrever no MongoDB compartilhado.
- Builds e suíte completa não são verificação automática. Os testes não cadastram administradores reais.
- A cobertura inicial também verifica expiração JWE, cliente HTTP sem retry, rotas web, recuperação de indisponibilidade e recusa de execução não interativa do CLI. MongoDB 8.0.18 é usado no harness efêmero para reprodutibilidade.
- Um teste de runtime inicia o entrypoint NestJS com tsx em processo temporário/porta efêmera e verifica health/guard, encerrando-o ao final. O tsconfig raiz inclui o backend para que tsx também reconheça os decorators ao importar serviços pelo script CLI; a injeção Nest usa tokens explícitos, sem depender de emitDecoratorMetadata do esbuild.
