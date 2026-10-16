# Contexto para desenvolvimento — Shekinah Galaxy Quest

## Ordem de consulta

Leia o `AGENTS.md` raiz antes dos guias pertinentes à tarefa.

| Guia | Quando consultar |
|---|---|
| [Stack e arquitetura](./stack-e-arquitetura.md) | Workspaces, tecnologias, API, admin, mobile, UI e testes |
| [Autenticação](./modules/auth.md) | Login administrativo, sessão, segurança e script de criação |
| [Layout administrativo](./modules/layout.md) | Sidebar, Início, navegação protegida e acessibilidade |
| [Integrações e crons](./modules/integrations.md) | Configuração, segredos, verificadores e rotina periódica de status |
| [Tema e componentes UI](./tema-e-componentes-ui.md) | Tema Opex, tokens, login, componentes reutilizáveis e adaptações para Vite |
| [Ambiente e bootstrap](./ambiente-local.md) | Instalação, execução, MongoDB, Compose e validação |

## Estado e manutenção

- API, login, layout administrativo e configuração/verificação das integrações estão implementados. Mobile, eventos Pusher de negócio, consumo de IA, envio de e-mail e operações de arquivo S3 continuam planejados. Consulte o guia de cada módulo para o estado atual.
- Decisões específicas de domínio vêm da especificação vigente, não dos projetos de referência.
- Ao implementar um módulo, documente comportamento, entradas/saídas, autorização, contratos e decisões em `modules/<modulo>.md` e adicione-o a este índice.
- Atualize apenas o contexto afetado. Diferencie implementado, planejado e pendente; não copie código ou segredos para os guias.
