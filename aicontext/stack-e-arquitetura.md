# Stack e arquitetura

## 1. Escopo e estado

Arquitetura-alvo do monorepo, adaptada dos guias e manifests de `~/code/dndicas` e `~/code/opex`.
Este catálogo não significa que as dependências já estão instaladas. Instale-as conforme a necessidade, sem antecipar funcionalidades.
Versões exatas devem ser definidas conforme compatibilidade e documentação atual; não copie lockfiles das referências.

```text
apps/
  api/             # NestJS: REST, domínio, autorização e persistência
  admin/           # React + Vite: administrativo web
  mobile/          # React Native + Expo: aplicativo nativo
packages/
  contracts/       # Schemas Zod, tipos e contratos de eventos
  api-client/      # Transporte HTTP compartilhado, sem dependência de UI
  design-tokens/   # Identidade visual independente de DOM/React Native
  config/          # Configurações compartilhadas quando úteis
```

## 2. Base compartilhada e backend

| Responsabilidade | Tecnologia/padrão |
|---|---|
| Workspace e linguagem | pnpm workspaces, lockfile único, TypeScript strict |
| Backend | NestJS, monólito modular em `apps/api/src/modules` |
| Banco e ODM | MongoDB + Mongoose, integrado pelo `@nestjs/mongoose`; schemas validados e índices explícitos |
| Contratos e validação | Zod; schemas públicos em `packages/contracts` |
| API | REST `/api/v1` + OpenAPI atualizado com os contratos |
| HTTP nos clientes | Axios centralizado em `packages/api-client` |
| Estado remoto | TanStack Query (`@tanstack/react-query`) em hooks por feature |
| Formulários | React Hook Form + `@hookform/resolvers` + Zod; campos/adapters próprios de cada plataforma |
| Datas | date-fns, locale pt-BR; transporte ISO 8601, instantes em UTC |
| Busca local | fuse.js quando houver busca tolerante a erros; não substitui pesquisa/paginação no servidor |
| Autenticação | Auth.js centralizada na API; não copiar o login de dono único do Opex nem Clerk |
| Tempo real | Pusher Channels; somente servidor publica, canais privados autorizados |
| Arquivos | Storage privado compatível com S3, por adapter central da API |
| Logging | Pino no servidor, com redação de segredos e dados sensíveis |
| Qualidade | ESLint, TypeScript sem emissão e testes focados |
| Operação | Docker Compose, respeitando os limites de autorização do `AGENTS.md` |

### Limites e segurança

- Controllers cuidam do transporte; serviços/casos de uso concentram regras e transações; providers/adapters centralizam banco, sessão, logger, auditoria, Pusher e S3.
- `contracts` não importa NestJS, Mongoose, APIs exclusivas de Node ou SDKs de servidor. Validação de formulário não substitui validação/autorização da API.
- Mudanças de dados/índices exigem scripts revisados e execução autorizada. Unicidade é protegida por índice no MongoDB, não só por consultas prévias. Transações multidocumento futuras exigem replica set e testes específicos.
- O cliente HTTP recebe configuração de URL e sessão apropriada à plataforma; componentes não instanciam clientes avulsos. Evite duplicar `/api/v1` na baseURL e nos caminhos.
- Queries tratam timeout, cancelamento e sessão expirada. Mutações não têm retry automático sem idempotência. Estado remoto não deve ser duplicado em stores locais sem necessidade.
- Eventos usam contratos versionados e payload mínimo; clientes invalidam/atualizam Query e reconciliam por REST após reconexão. Remova listeners no logout/desmontagem.
- Sessão web não persiste tokens sensíveis em localStorage; armazenamento mobile deve ser seguro. Estratégia de sessão e integração Auth.js/Expo exigem validação própria; não presuma JWT bearer convencional.

## 3. Administrativo web — React + Vite

Mesma stack de UI das referências, **sem Next.js** e sem backend paralelo no administrativo.

| Responsabilidade | Tecnologia/padrão |
|---|---|
| Aplicação | React + React DOM + Vite, TypeScript strict |
| Estilos | Tailwind CSS 4 |
| Componentes acessíveis | shadcn/ui + Radix UI; composição e wrappers locais |
| Classes e variantes | `clsx` + `tailwind-merge` no helper `cn()`; `class-variance-authority` |
| Dados e formulários | TanStack Query, Axios, React Hook Form e Zod conforme seção 2 |
| Animações | Framer Motion (`framer-motion`) |
| Drag-and-drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) |
| Virtualização | TanStack Virtual (`@tanstack/react-virtual`) |
| Toasts | sonner |
| Ícones | lucide-react |
| Calendário/seletor de datas | react-day-picker, integrado aos componentes shadcn/ui |
| Gráficos | recharts pelo componente Chart do shadcn/ui |
| Markdown | react-markdown + remark-gfm; sem HTML arbitrário não sanitizado |
| Tempo real | pusher-js; autorização no backend |
| Testes | Vitest + React Testing Library; jsdom para componentes DOM |

### Organização e experiência

- `src/app`: composição, providers e roteamento; `src/features`: telas, hooks e fluxos por módulo; `src/components/ui`: componentes genéricos; `src/lib`: utilitários/integrações de cliente.
- Roteamento web implementado com React Router; TanStack Query cuida apenas do estado remoto.
- Não use App Router, Server Components, Server Actions, `next/*`, `next-themes` ou handlers de API do Next.js. Chamadas de negócio vão para NestJS.
- Cores, espaçamentos e identidade vêm de tokens; não herde automaticamente a primária roxa ou o tema escuro fixo do Opex. Implementação web dos tokens pode usar variáveis CSS.
- Reutilize shadcn/Radix antes de criar componentes equivalentes. Padrões Glass podem ser adaptados das referências quando combinarem com a identidade aprovada, não impostos como requisito.
- Componentes têm responsabilidade única; extraia hooks/serviços e decomponha componentes grandes. Listagens tratam filtros, paginação, estados vazios e ações críticas com confirmação.
- Use virtualização em listas extensas quando necessária ao desempenho; filtros compartilháveis ficam na URL. Preferências locais persistentes devem usar chave versionada e validação Zod, nunca armazenar segredos.
- Formulários reutilizam schemas de entrada dos contratos quando aplicável, exibem erros pt-BR e bloqueiam submissão duplicada; campos usam toda a largura da célula e campo isolado pode ocupar a linha inteira.
- Feedback de ação usa sonner; ícones usam Lucide; gráficos usam tokens de série e tooltip consistente.

### Animações

- Use Framer Motion para entrada/saída, mudança de abas/etapas, reordenação, feedback e contadores quando adequado; `AnimatePresence` para transições com saída.
- Hover/foco triviais podem usar Tailwind. Não adicione outra biblioteca de animação para resolver o mesmo problema.
- Gráficos podem usar a animação interna do recharts; respeite movimento reduzido também nesses casos.
- Animações são curtas, não bloqueiam interação e respeitam `prefers-reduced-motion`. Use `layout`/`layoutId` com parcimônia, sobretudo com portais/listas extensas.
- Resposta otimista exige rollback e tratamento de falha; saldo, aprovação e recompensa não são confirmados antes da API.

## 4. Mobile — React Native + Expo

- Use React Native + Expo e Skia para as cenas planejadas do aplicativo. A versão do React acompanha a compatibilidade do Expo/React Native, não a versão do admin por imposição.
- Compartilhe contratos, cliente HTTP, tokens e lógica pura; mantenha UI, navegação e integrações nativas adequadas à plataforma.
- **Não use shadcn/Radix, classes Tailwind web, Framer Motion DOM, sonner, lucide-react, recharts, react-day-picker, dnd-kit ou TanStack Virtual como se fossem componentes nativos.** Equivalentes nativos exigem escolha e validação documentadas antes do uso.
- TanStack Query, Zod, React Hook Form, date-fns e lógica de busca podem ser reaproveitados quando compatíveis; formulários usam adapters para campos nativos.
- Biblioteca de UI/estilização nativa, navegação, animações e SDK Pusher nativo devem ter decisões específicas, incluindo compatibilidade com Expo e necessidade de development build. Não introduza NativeWind ou outra biblioteca apenas por analogia ao Tailwind web.
- Skia renderiza cenas, não substitui a UI acessível. Garanta semântica/alternativas para elementos interativos, desempenho em aparelhos modestos e suspensão de trabalho gráfico em background.
- Trate retorno ao foreground, reconexão, teclado, áreas seguras e armazenamento seguro da sessão. Pusher não substitui notificações push.
- Vitest cobre lógica pura compartilhável. UI nativa usa React Native Testing Library e runner/preset compatível com Expo/React Native, com decisão documentada; não force jsdom nem replique testes de domínio.

## 5. O que não herdar automaticamente

- PostgreSQL/TypeORM, Clerk, PM2, autenticação de dono único, multiempresa, regras de negócio e infraestrutura das referências não fazem parte desta adaptação. MongoDB/Mongoose foram aprovados explicitamente para este projeto.
- Tiptap, CodeMirror/Vim, xterm, tsParticles, bibliotecas de dados 3D/Owlbear, IA e SDKs específicos de integrações pertencem a funcionalidades das referências, não à base obrigatória deste app. Só adotar mediante necessidade e escopo aprovados.
- Não copie regras de `src/core` imutável quando esse core não existe aqui. Preserve contratos públicos e prefira composição sem criar proibições artificiais de manutenção.
- Não copie portas, redes, credenciais ou arquivos reais de ambiente. Configure cada ambiente explicitamente; variáveis públicas do Vite/mobile nunca contêm segredos.
