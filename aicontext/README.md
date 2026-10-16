# Contexto para desenvolvimento — Shekinah Galaxy Quest

## Ordem de consulta

Leia o `AGENTS.md` raiz antes dos guias pertinentes à tarefa.

| Guia | Quando consultar |
|---|---|
| [Stack e arquitetura](./stack-e-arquitetura.md) | Workspaces, tecnologias, API, admin, mobile, UI e testes |
| [Autenticação](./modules/auth.md) | Login administrativo, sessão, segurança e script de criação |
| [Ambiente e bootstrap](./ambiente-local.md) | Instalação, execução, MongoDB, Compose e validação |

## Estado e manutenção

- API, login administrativo e pacotes de apoio estão implementados; mobile, Pusher, S3 e funcionalidades de negócio continuam planejados. Consulte o guia de cada módulo para o estado atual.
- Decisões específicas de domínio vêm da especificação vigente, não dos projetos de referência.
- Ao implementar um módulo, documente comportamento, entradas/saídas, autorização, contratos e decisões em `modules/<modulo>.md` e adicione-o a este índice.
- Atualize apenas o contexto afetado. Diferencie implementado, planejado e pendente; não copie código ou segredos para os guias.
