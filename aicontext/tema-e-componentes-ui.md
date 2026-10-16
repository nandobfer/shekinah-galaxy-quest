# Tema e componentes UI

## Origem e limites

O administrativo copia o tema e a aparência de `~/code/opex`, por solicitação explícita. Os arquivos são cópias locais: não há import, symlink ou alteração no repositório de referência. A autenticação continua sendo a do Shekinah (API NestJS, Auth.js, Mongoose); nada de dono único, portal de clientes ou credenciais de ambiente do Opex.

## Tema

- Tema escuro fixo; `<html class="dark">`, `color-scheme: dark`, primária `#8000FF` e texto branco. Mesmos tokens HSL de fundo, card, popover, texto, estados, bordas, sidebar, raios e gráficos do Opex em `packages/design-tokens/theme.css`.
- O adapter em `apps/admin/src/styles.css` usa `@theme inline` com `hsl(var(--token))`, variante dark por classe, cores semânticas, utilitário container, animações de accordion, seleção e scrollbar da referência.
- `muted` é fundo, **não cor de texto**. Use `text-muted-foreground`. Não misture os antigos valores hex dos tokens com os novos canais HSL.
- Fonte Inter Variable Latin por `@fontsource-variable/inter`, servida localmente pelo Vite, sem `next/font`, Google Fonts remoto ou conexão externa do navegador.
- Sonner usa o wrapper `components/ui/toast.tsx`, `richColors`, `theme="dark"` e `position="top-right"`.
- `components.json`: new-york, neutral, variáveis CSS, `rsc: false`, aliases `@/` e CSS local. Não regenere os componentes via CLI sem revisar diferenças: as customizações do Opex fazem parte da aparência requerida.

## Login

`features/auth/login-page.tsx` reproduz viewport centralizada, `max-w-sm`, gradiente radial, camadas `isolate`/z-index, títulos e card translúcido do Opex. Apenas nome/subtítulo e o rótulo E-mail diferem por identidade/contrato. O formulário mantém React Hook Form, Zod, TanStack Query, mensagens pt-BR, senha revelável e bloqueio durante envio. Erros aparecem no campo e em toast; rótulos são associados aos campos/mensagens para acessibilidade.

`login-particle-background.tsx` monta uma galáxia espiral de partículas no fundo: 480 estrelas distribuídas em braços ao redor de um núcleo denso, sem ligações entre si, em um disco com raio de 54% do menor lado do viewport, com rotação lenta da camada e cintilação por opacidade. O raio passa de metade da dimensão curta de propósito: a galáxia preenche o quadro e apenas a faixa periférica (a mais apagada) é recortada pelas bordas da tela. As posições são calculadas por `login-galaxy.ts` (puro e determinístico, com semente fixa) e entregues ao tsParticles como partículas manuais, pois o bundle "slim" não produz braços espirais por configuração. A paleta vem dos tokens do tema (`--foreground`, `--ring`, `--primary`) lidos do DOM — nada hardcoded —, o carregamento é lazy e as posições se recalculam quando o viewport muda. Com movimento reduzido a galáxia fica estática (sem rotação nem cintilação); a camada não captura ponteiros e a ausência/falha do canvas não deve bloquear o formulário. É a única exceção ao uso de Framer Motion para animações de UI.

## Biblioteca copiada

- `components/ui/`: primitivas shadcn/Radix; campos e formulários; botões/ações; cards, feedback, menus e sobreposições; tabs/tabelas; calendário/data/hora; seletores/autocomplete/chips; Markdown e Chart/recharts.
- `components/list/`: CadastroHeader, cards e skeleton de tabela/filtros, ListFilters, FilterGroup, chips, multiseleção, StatusPill, TableAction e TabFooter.
- `components/feedback/`: EmptyState, ErrorState e InDevelopment.
- `components/motion/`: MotionProvider, AnimatedNumber e presets/transições de abas e diálogos. O provider aplica `reducedMotion="user"`.
- `components/wizard/WizardStepper.tsx`: indicador de etapas reutilizável, sem fluxo de domínio.
- `hooks/`: useDialogPresence, useCreateDialogAction, useClickOutside e useMediaQuery. Utilitários puros `lib/text.ts` e `lib/format.ts` atendem os campos copiados.

Componentes de formulário ocupam a largura disponível; use Field, FORM_GRID e FormFooter em vez de estilos locais divergentes. Campos especializados precisam de labels acessíveis no consumidor. Componentes copiados não criam rotas, sidebar, cadastros, filtros reais ou dashboard automaticamente.

## Adaptações deliberadas

- Links internos de TooltipIconButton usam React Router; login usa React.lazy/Suspense, não `next/dynamic`. Não há `next/*`, Server Components ou Server Actions nos componentes portados.
- Textarea preserva a aparência nativa do Opex sem a integração Vim/CodeMirror. Markdown preserva GFM e classes visuais, sem interpretar referências de anexos/autenticação do Opex; imagens são Markdown padrão e HTML bruto não é habilitado. MarkdownField só usa uploads se o consumidor fornecer um adapter explícito; nenhum backend de arquivos é criado.
- Não foram copiados shell, navegação de negócio, agent-questions, editor-mode, Vim, terminal, atalhos globais ou SDKs OpenCode/IA.
- As dependências web ficam no workspace admin; elas não devem entrar no mobile. O script install do tsParticles é explicitamente desabilitado no pnpm (os artefatos já são distribuídos prontos). O plugin `@tsparticles/plugin-manual-particles` foi acrescentado para posicionar as estrelas da galáxia e acompanha a mesma versão do engine; ele não substitui o bundle "slim".

## Validação

Testes focados em `__tests__/` devem cobrir o login e rotas existentes, campos/validação/ref/disabled, interações dos componentes copiados, tokens e opções do canvas, geração determinística da galáxia, movimento reduzido e ausência de dependências Next/Opex. Canvas e layout precisam também de validação visual no navegador; jsdom não comprova igualdade visual. Comparar desktop/mobile com a mesma fonte carregada e tolerar apenas textos de identidade e a disposição das estrelas.

Nesta entrega foram validados 33 testes focados, typecheck sem emissão, ESLint e auditoria de dependências de produção. A comparação em Chromium com o login do Opex em execução passou em 1440×900 e 375×812: tokens, fundos, tipografia em tamanho, raios, padding e dimensões dos campos/botões/card coincidem; sem overflow horizontal ou erros JavaScript. As capturas desktop/mobile foram também revisadas visualmente. O teste de navegador usou API mockada (nenhuma credencial real), movimento reduzido e servidor Vite efêmero em loopback, encerrado ao concluir; não substitui homologação do backend ou build de produção.

Instalar dependências no host não atualiza a imagem Docker existente. No Compose dev apenas `src` e `packages` são montados: `index.html`, manifests e dependências novas exigem reconstruir/recriar o admin. Rebuild/recriação dos serviços dependem de autorização separada; não declarar o ambiente publicado atualizado só porque os fontes mudaram.

Na tarefa SGQ-1 (galáxia espiral no login) foram executados, sem build: 20 testes focados de `features/auth` e os 44 testes do projeto admin, `tsc --noEmit` do admin e ESLint dos arquivos afetados. A revisão seguinte da mesma tarefa aumentou a cena de 320 para 480 estrelas e o raio do disco de 47% para 54% do menor lado do viewport, preservando tamanho individual, paleta, braços e acessibilidade; as asserções de posição passaram a medir o desvio em relação ao centro, porque a periferia recortada pode ultrapassar a faixa 0–100. A aparência da galáxia (espiral, rotação lenta, densidade do núcleo, recorte da periferia) não foi validada em navegador nesta entrega: depende de revisão visual em desktop e mobile, com e sem movimento reduzido, e de conferência de desempenho do canvas com o novo total de estrelas.
