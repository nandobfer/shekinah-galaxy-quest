# AGENTS.md

Guia normativo para agentes que trabalham no **Shekinah Galaxy Quest**.
Monorepo pnpm: API NestJS, mobile React Native + Expo e administrativo React + Vite.

## 1. Ordem obrigatória de leitura

Antes de implementar:

1. `aicontext/README.md` — índice e estado da documentação.
2. `aicontext/stack-e-arquitetura.md` — tecnologias, limites dos workspaces e padrões por plataforma.
3. Especificação, plano e guias de módulo pertinentes à tarefa, quando existentes.
4. Guias `AGENTS.md` locais aos diretórios afetados, quando existentes.

Não apresente estrutura planejada como código existente. Confirme decisões bloqueantes antes de implementar.

## 2. Regras essenciais

- Use TypeScript strict; evite `any` e justifique explicitamente qualquer `@ts-ignore`.
- A API é a única autoridade de negócio, autorização, progresso e economia. Controllers delegam a serviços/casos de uso.
- Aplicações dependem de pacotes compartilhados, nunca umas das outras. Use exports públicos dos workspaces.
- Contratos públicos usam Zod em `packages/contracts`; não exponha documentos Mongoose nem dependências server-only aos clientes.
- Persistência usa MongoDB + Mongoose. Preserve índices e validação; transações multidocumento exigem replica set. Não introduza PostgreSQL/TypeORM.
- Consumo HTTP passa pelo cliente centralizado e hooks TanStack Query. Alterações de API atualizam contratos, OpenAPI e consumidores, considerando versões mobile já distribuídas.
- Autenticação e autorização são verificadas no servidor, inclusive em leituras. Segredos nunca vão para clientes ou logs; anexos são privados por padrão.
- Preserve auditoria, integridade transacional e idempotência nas operações críticas. Eventos só saem do servidor após persistência, nunca dentro da transação.
- Não fixe parâmetros configuráveis do domínio no código ou neste guia. Consulte a especificação/configuração administrativa vigente.
- Textos para o usuário são em pt-BR. Toda tela trata loading, vazio, erro recuperável, falta de acesso e indisponibilidade de conexão.
- Use tokens visuais e componentes reutilizáveis; mantenha regras complexas fora da renderização. Respeite acessibilidade e movimento reduzido.
- Não adicione biblioteca que duplique outra da stack. Instale somente o necessário à tarefa, no workspace correto.
- `~/code/dndicas` e `~/code/opex` são referências somente para leitura; nunca os modifique nem os transforme em dependências deste monorepo.

## 3. Autorização e operação

- **Builds apenas mediante solicitação ou autorização explícita**, incluindo Nest/Vite, Docker, Expo/EAS e compilação nativa. Nunca publique/distribua automaticamente.
- **Suíte completa de testes somente por solicitação explícita.** Validação autônoma: typecheck sem emissão, lint e testes selecionados por arquivos/casos afetados. Não contorne limites por scripts indiretos.
- Commits, pushes, deploys, migrações destrutivas e alterações em ambientes externos exigem autorização. Gerar uma migração não autoriza executá-la.
- Não inicie serviços persistentes nem altere infraestrutura compartilhada sem autorização. Preserve trabalho existente do usuário.
- Deploy é orquestrado por Docker Compose com configuração e imagens versionadas. Expo/Metro e build Android usam Compose; compilação nativa iOS exige macOS/Xcode e é a exceção. Distribuição às lojas segue o canal oficial autorizado.
- Use exclusivamente pnpm e um lockfile na raiz. Não compartilhe `node_modules` por symlink entre worktrees.
- Quando existir `package.json` raiz, cada commit autorizado incrementa a versão global com SemVer no mesmo commit, sem bump indiscriminado dos workspaces. Não crie manifests apenas para versionar documentação.

## 4. Fluxo obrigatório: implementar → documentar → testar

1. **Classificar e implementar:** feature, fix, refactor ou docs; ler contexto, delimitar escopo, consumidores e decisões pendentes.
2. **Documentar:** atualizar o guia pertinente em `aicontext/`; módulos novos recebem `aicontext/modules/<modulo>.md` e entrada no índice. Separar implementado, planejado e pendente. Fix interno sem mudança observável pode dispensar texto redundante, com justificativa.
3. **Testar:** feature cobre caminho feliz, borda e autorização aplicável; fix exige regressão; refactor preserva comportamento. Use Vitest para API, contratos, lógica pura e admin; React Testing Library no admin. Testes nativos usam harness compatível com React Native, não jsdom forçado.

Testes ficam em `__tests__/`, como `*.test.ts`/`*.test.tsx`, com descoberta que alcance subpastas. Mocke integrações externas nos testes unitários; garantias de persistência e unicidade exigem MongoDB isolado, não o banco real nem apenas mocks.
Tarefas exclusivamente documentais exigem revisão de coerência e referências, não testes artificiais ou instalação da stack.

## 5. Antes de encerrar

- Confirme tipos, contratos, autorização, privacidade, auditoria e estados de UI aplicáveis.
- Informe documentação e testes alterados, validações realmente executadas e limitações.
- Justifique etapas bloqueadas ou não aplicáveis; não declare testes/builds que não executou.
- Mantenha este guia curto: detalhes técnicos e de domínio pertencem a `aicontext/`.
