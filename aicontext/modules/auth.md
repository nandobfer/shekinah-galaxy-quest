# Autenticação administrativa

## Implementado

- API NestJS com Auth.js Core, Credentials e sessão JWE em cookie; sem Next.js e sem bearer JWT convencional.
- Usuários persistidos com Mongoose: nome, e-mail normalizado com índice único, hash Argon2id, papel `admin`, status ativo, versão de sessão e timestamps.
- Login `/login` no React/Vite; rota `/` protegida contém somente saudação e logout, não dashboard.
- A tela de login reproduz a composição do Opex (card central translúcido, fundo radial, tema roxo e fonte Inter), com identidade Shekinah e e-mail/senha. O fundo de partículas virou uma galáxia espiral (braços ao redor de um núcleo, sem ligações, rotação lenta), conforme a tarefa SGQ-1. `login-page.tsx` separa layout/carregamento lazy do canvas de `login-form.tsx`, que mantém contratos, mutation e sessão atuais. Não há username ou autenticação por credenciais de ambiente do Opex.
- Não há cadastro público, senha padrão, administrador automático, recuperação de senha ou autenticação mobile nesta entrega.

## Protocolo e autorização

- Base Auth.js: `/api/v1/auth`; login usa `GET /csrf` e `POST /callback/credentials`, logout usa `POST /signout`. Preserve o protocolo oficial, incluindo token CSRF e cookies múltiplos.
- `GET /api/v1/me` exige sessão administrativa; retorna `{ user: { id, name, email, role }, expires }`. `GET /api/v1/openapi.json` documenta endpoints REST próprios; endpoints Auth.js seguem a documentação oficial.
- O bridge reconstrói a URL pela `APP_ORIGIN` configurada, não pelo Host recebido. Requisições POST exigem Origin exata; cookies usam HttpOnly/SameSite do Auth.js, Secure em produção.
- O callback JWT consulta o usuário atual no MongoDB. Usuário inativo, papel inválido ou versão diferente invalida a sessão, inclusive em `/me`.
- O guard é global no AppModule: novas rotas REST são protegidas por padrão; somente health/OpenAPI têm exceção pública explícita. O bridge Auth.js atende seu próprio protocolo antes do roteamento Nest.
- `/me` propaga a renovação/limpeza dos cookies do Auth.js e usa Cache-Control no-store. A sessão expira por inatividade conforme SESSION_MAX_AGE_SECONDS, sem guardar tokens no JavaScript do cliente.
- Logout incrementa a versão de sessão: **encerra todas as sessões daquele administrador**, além de limpar o cookie atual. Essa decisão favorece revogação efetiva neste bootstrap.
- Mutações de autenticação (exceto logout) têm limite por IP, em memória e por processo; variantes do caminho não escapam da contagem. Não há confiança automática em X-Forwarded-For. Com múltiplas réplicas ou proxy com IPs compartilhados, revisar explicitamente o armazenamento do limite e a política de proxies.
- Não existe CORS permissivo: navegador e API usam a mesma origem por proxy. Mudanças de origem/portas exigem ajustar APP_ORIGIN.
- Senhas não são aparadas/normalizadas; e-mails são. Erro genérico não diferencia e-mail inexistente, inatividade ou senha errada. Verificação dummy reduz diferença de custo entre contas existentes e inexistentes.
- Auditoria estruturada registra criação pelo operador CLI, login e logout com IDs, nunca senha/hash/cookie. O histórico durável de auditoria é evolução futura; nesta entrega os eventos são logs Pino.
- Queries não repetem falhas automaticamente; login/logout não têm retry. `401` limpa o cache protegido. Sessão é revalidada no foco e periodicamente; API continua sendo a autoridade em todas as requisições.

## Cadastro por operador

Execute na raiz: `pnpm exec tsx scripts/create-admin.ts`.

O script lê `.env`, exige terminal interativo e solicita nome/e-mail/senha/confirmação, com senha mascarada. A senha precisa ter de 12 a 128 caracteres. Não aceite senha em argumento ou pipe. Não há senha temporária conhecida: o operador escolhe uma senha forte e o cadastro já é ativo, conforme o fluxo CLI aprovado para esta entrega.

Antes da conexão, reutiliza `resolveScriptMongoUri` (`scripts/helpers/mongodb-uri.ts`) para substituir o hostname único `mongodb` por `127.0.0.1` na URI local. Não é necessário sobrescrever MONGODB_URI no comando quando o `.env` contém o nome desse contêiner; a porta precisa estar publicada no host com o mesmo número. O `.env` e a URI utilizada pela API não são alterados. URIs externas, SRV e replica sets permanecem intactas.

Usa o mesmo serviço/hash da API, aguarda o índice único antes da inserção e fecha a conexão em sucesso/falha. E-mail duplicado não altera conta, papel ou senha. Não execute este script automaticamente no startup nem crie contas durante testes no banco real.

## Testes e limites

Testes de integração usam MongoDB efêmero exclusivo e o Auth.js real (CSRF, cookies, sessão e logout). Testes de UI usam React Testing Library e cliente mockado; não substituem a integração backend.
Sem promessa de homologação mobile, desempenho de produção ou build: dependem de etapas próprias.
