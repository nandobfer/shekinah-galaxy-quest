# Permissionamento — Perfix

## Implementado

- Biblioteca pública independente: `https://github.com/nandobfer/Perfix`, pacote `@nandobfer/perfix`, tag `v0.1.0` (baseada na v0.4.0 do sipal-permissions). Dependência Git fixada por tag/commit no lockfile, com `dist/` distribuído; não depende de clone local, Clerk ou registry privado.
- Núcleo e hooks React vêm do Perfix; catálogo específico em `packages/contracts/src/permissions.ts`. Nenhum escopo customizado: entradas aceitam apenas `escopos: []`, sem empresas/filiais.
- API em `apps/api/src/modules/permissions`: perfis em `roles`, ordem/versionamento em `role_hierarchy`, auditoria durável em `access_audit`. Usuários têm IDs em `roles` e `accessVersion`. O campo legado `role: 'admin'` mantém compatibilidade, **não concede permissões**.
- Cada requisição autenticada resolve perfis ativos no MongoDB. Sem fallback para contas antigas nem permissões confiadas ao JWT/navegador. Revogar/desativar perfil afeta a próxima requisição; desativar usuário também revoga sessões.
- Administrador tem coringa `*`; somente o operador cria o primeiro vínculo. Perfil reservado não pode ser removido/desativado nem perder o coringa; permite editar nome, descrição e cor. Demais perfis nunca recebem `*` pela API.
- Usuários: listagem, filtros, edição de nome/status/perfis, exclusão protegida e resumo de permissões. **Sem cadastro pela UI, POST /users ou convites.** Email somente leitura.
- Perfis: tabela com filtros/arraste, páginas de criação/edição, árvore de permissões, cores, abas Geral/Permissões/Membros/Log de Auditoria. Código portado do `crm-marketing-campanhas`, adaptado para React Router/HTTP e sem controles de escopo. A aba Log mantém metadados de criação/edição da referência, não um visualizador completo de `access_audit`.

## Catálogo e segurança

- `users.view/edit`, `roles.view/edit`; para cada integração, `integrations.<id>.view/edit/explore` (testes/debug). Crons tem `integrations.crons.run`: autoriza a rotina global de verificações, não apenas o verificador de Crons.
- Menus, rotas, campos e ações usam o catálogo compartilhado. Início/própria sessão exigem autenticação. Provedor IA autorizado sem acesso à página agregadora aparece diretamente na listagem.
- Listagens são filtradas no servidor. Leitura, salvamento, teste, logs, OpenAPI e execução manual têm verificações próprias. Teste agregado de IA exige `.explore` em todos os provedores. Scheduler é interno, independente de sessão.
- Hierarquia/concessão usam Perfix: definir permissões exige possuí-las; atribuir perfis existentes respeita hierarquia e piso de chaves sensíveis (não exige possuir cada chave de leitura do perfil). Sem alterar os próprios perfis, autodesativar ou autoexcluir. Perfis com membros não podem ser excluídos. Último administrador ativo é preservado.
- O formulário envia alterações do perfil e de membros num único PATCH transacional: falha em atribuição desfaz também a edição do perfil, sem gravação parcial. O endpoint independente de membros permanece disponível com controle de versão.
- A aparência segue os componentes do CRM, com o tema do Shekinah. Em telas estreitas, as abas de perfil têm rolagem horizontal para não sobrepor “Permissões”, “Membros” e “Log de Auditoria”; desktop preserva a grade original. Abas têm associação ARIA e navegação por setas/Home/End. Rascunhos exigem confirmação para descarte.
- Mutações de autoridade exigem **replica set** (ou mongos), transação e versão explícita. Documento-fence serializa mutações e a autorização é resolvida novamente dentro de cada tentativa. Standalone retorna 503 antes da alteração; versão antiga, 409. Não converter infraestrutura automaticamente.
- Auditoria registra ator real, ação/destino, antes/depois e simulação, nunca senhas/hashes/cookies/segredos. Mutações exigem sessão, Origin exata e `X-Shekinah-Request: 1`.

## Visualizar como

- Seletor/faixa portados do CRM: perfil ou usuário, sem empresa/filial. Apenas administrador **real** (`*`) pode simular. Selecionar Administrador sai da simulação.
- `x-perfix-view-as` é validado pelo Perfix; `none` consulta opções/audita com o acesso real, sem elevar usuários comuns. API revalida alvo/status a cada requisição e rejeita payload inválido sem fallback permissivo.
- Estado por aba no `sessionStorage`, sem tokens/cookies de autenticação. Troca/saída cancela queries, limpa cache protegido e navega para Início; sessão é recarregada. Logout/expiração remove simulação. Alvo indisponível ou perda do coringa interrompe com aviso.
- Identidade Auth.js e autor das ações continuam sendo o administrador real, com marcador separado.

## Transição operacional — não automática

1. Confirmar backup, URI e replica set.
2. `pnpm exec tsx scripts/migrate-access.ts`: informa quantidade elegível, sem atribuir perfis.
3. Com autorização explícita, `pnpm exec tsx scripts/migrate-access.ts --apply`: vincula administradores legados sem `accessVersion` e sem atribuições ao Administrador. Contas inativas não são reativadas. Idempotente, transacional e auditada como `operator-cli`. Contas já editadas pelo novo módulo ficam fora mesmo com perfis vazios, evitando restaurar privilégio removido intencionalmente.
4. `scripts/create-admin.ts` cria novas contas operacionais já vinculadas ao Administrador, sem modificar duplicadas ou atribuir contas antigas no startup.

Standalone é detectado antes de qualquer escrita: a simulação avisa que `--apply` exigirá replica set e a execução com `--apply` falha com o motivo real (`--replSet` + `rs.initiate()`), sem gravação parcial. A mesma checagem de topologia é compartilhada com `AccessService` em `access-topology.ts`.

Scripts reutilizam `scripts/helpers/mongodb-uri.ts`, não imprimem credenciais e fecham conexões. Atualizar código não autoriza executar migração no banco real.

## Validação

Persistência/concorrência: MongoDB efêmero com replica set e integrações externas mockadas. UI: Vitest/RTL e comparação com componentes reais do CRM em desktop/mobile. Typecheck/lint/testes selecionados não autorizam build do Shekinah nem restart de contêineres.
