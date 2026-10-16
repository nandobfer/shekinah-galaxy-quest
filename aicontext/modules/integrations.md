# Integrações e verificação de status

## Implementado

Catálogo público/validação/DTOs em `packages/contracts/src/integrations.ts`; cliente HTTP em `packages/api-client`; hooks/telas em `apps/admin/src/features/integrations`; módulo NestJS em `apps/api/src/modules/integrations`.

Porta a anatomia da listagem e cards de configuração do Opex, sem importar Next, dono único, credenciais ou regras daquele app. Lista seis raízes: Pusher, API interna, Crons, Provedores de IA, SMTP e Storage S3. IA tem somente configuração dos filhos OpenCode, Gemini e JEV, com rotas `/integracoes/ia` e `/integracoes/ia/<provedor>`. Não há agentes, prompts, geração ou configuração de modelos por tarefa.

### Configuração e segurança

- MongoDB: `integrations` (id único, versão para concorrência, valores públicos, segredos, saúde e auditoria dos últimos 200 eventos por integração); `integration_debug_logs` (TTL 48h, consulta limitada aos últimos 100); `cron_states` (uma rotina registrada, índice único).
- As configurações e credenciais ficam no banco, editadas na UI; não há fallback/migração automática de credenciais de ambiente. Somente a chave de infraestrutura `INTEGRATIONS_ENCRYPTION_KEY` vai no `.env` (base64 canônico de 32 bytes, `openssl rand -base64 32`). Não usar AUTH_SECRET como chave. Guardar backup; trocar/perder a chave torna segredos ilegíveis e exige restaurar chave ou substituir credenciais.
- Sem chave a API inicia normalmente, mas gravação/substituição de segredos retorna 409. Remoção continua permitida. Campos privados usam AES-256-GCM com IV aleatório e AAD `integração:campo`; DTO retorna apenas configured/unreadable. Não há leitura/revelação de segredo.
- PATCH estrito com versão, ambiente, debug, valores públicos e ações de segredo `{ action: set, value }` / `{ action: clear }`; ausente mantém segredo. Rejeita campos desconhecidos e valores inválidos. Configuração pode ser salva incompleta; testes a classificam como não configurada, não indisponível.
- Controle de versão atômico evita sobrescrever outra edição; atualizar configuração invalida saúde. Resultado de teste antigo não substitui status de uma configuração nova.
- Guard global exige administrador ativo em leituras e escritas. Mutações exigem Origin exata e `X-Shekinah-Request: 1` (sem CORS permissivo). OpenAPI passou a exigir sessão administrativa. Health básico continua público.
- Auditoria é inserida atomicamente junto à configuração/status, com ator, horário, ação e nomes de campos; nunca valores. Pino registra metadados de alteração/rotina. Debug é opt-in e persiste apenas diagnóstico final sanitizado, sem respostas remotas, URLs assinadas ou exceções de SDK.
- Endereços customizados são deliberadamente conexões administrativas a serviços internos (inclusive redes Docker). Exigem HTTP(S) sem credenciais, caminho, query ou fragmento; restrinja acesso administrativo e egress da API. Probes HTTP não seguem redirecionamentos. Não é um proxy público.

### Verificadores

- Pusher: cluster ou host próprio, GET autenticado `/channels`, timeout do SDK.
- API interna: executa dentro do próprio Nest, verifica ping MongoDB e o contrato OpenAPI realmente publicado, sem contornar sessão com self-HTTP. Link para `/api/v1/openapi.json`; sem emissão de tokens de sistema.
- Crons: informa se o agendador está habilitado; estado/última/próxima execução são apresentados no card da rotina. Não cria bearer/rota pública para disparar jobs.
- IA: OpenCode usa GET `/api/info` com Basic (usuário opencode); Gemini lista modelos com x-goog-api-key; JEV lista modelos com bearer. Hub verifica filhos configurados. Nenhuma geração ou consulta de agentes.
- SMTP: Nodemailer verify (conexão/TLS/autenticação), sem enviar e-mail; TLS direto na 465 e STARTTLS obrigatório nas demais. Não comprova aceitação do remetente.
- S3: HeadBucket com SDK AWS, endpoint/region/bucket/credenciais, forcePathStyle, sem upload, criação de bucket ou alteração de ACL/políticas. Nenhuma URL pública de arquivo é gerada nesta entrega.
- Limite por probe: 10s; erros genéricos seguros. API não devolve corpos de respostas externas nem mensagens arbitrárias de exceções.

### Crons: Verificação de status das integrações

- ID estável `integrations-health-check`, rótulo **Verificação de status das integrações**, intervalo padrão 5 minutos (editável 1–1440). Agendador e rotina começam desativados; subir a API não testa serviços externos.
- Tick interno de 15s no processo Nest persistente, sem Redis/filas/workers externos. Bootstrap de testes não instala timer. Encerramento limpa timer e aguarda verificações em andamento.
- Lease MongoDB atômico de 120s com dono UUID por execução, compartilhado entre execução manual e periódica. Índice único impede duplicar estado; apenas o dono finaliza. Verificadores limitados a 10s rodam em paralelo, dentro do lease; crash libera por expiração.
- Próxima execução avança ao reivindicar; mudança da versão da configuração recalcula agendamento e religar não dispara backlog imediatamente. Desligar não cancela a execução já iniciada.
- Rotina verifica Pusher, API interna, IA (e filhos), SMTP e S3. Exclui Crons para não verificar a si mesma; falhas são isoladas, não configuradas são ignoradas. Resultado agregado fica no estado, diagnósticos nas respectivas integrações quando debug está ativo.
- **Executar agora** funciona mesmo com agendador desligado, usa somente configuração salva e é protegido por sessão/origem/lease. UI exige salvar/desfazer o rascunho antes de executar.

### HTTP e interface

Base `/api/v1`: GET `integrations`, GET/PATCH `integrations/:id`, POST `integrations/:id/test`, GET `integrations/:id/logs`, POST `integrations/crons/jobs/integrations-health-check/run`. Schemas de entrada/resposta documentados no OpenAPI, incluindo erros de validação, origem, sessão, versão e sobreposição.

Consumo por cliente centralizado + hooks TanStack Query; mutations sem retry automático. Lista/detalhe revalidam a cada 15s, logs abertos a cada 5s, sem necessidade de configurar Pusher para usar o módulo. Formulário React Hook Form/Zod preserva rascunho durante polling, pede confirmação para abandonar edição e alerta em conflito de versão. Segredos podem ser definidos/substituídos/limpos/desfeitos; valores salvos jamais preenchem inputs.

### Fidelidade visual ao Opex

- O detalhe usa toda a largura disponível, sem `max-w-*`. A grade tem uma coluna sem debug; apenas com debug salvo ativo divide em duas colunas iguais em `xl`, com formulário à esquerda e logs à direita. O padding horizontal é o do AppShell, sem margem extra do editor.
- `DetailHeader`, `GeneralCard`, `DetailActions`, `IconAction`, controles públicos/privados e abas são ports dos componentes equivalentes em `~/code/opex`. Grade `FORM_GRID_WIDE`: duas colunas em `sm`, último campo ímpar ocupa a linha inteira. Não substituir componentes da referência por controles genéricos: a conexão Pusher é um radiogroup segmentado Cluster/Host, não Select.
- Campos privados mostram estado e máscara dentro do campo com ações somente-ícone (lápis, limpar, desfazer), tooltip e input de substituição. Não há botões textuais “Definir Secret”. Labels obrigatórios, placeholders, unidades e helpers vêm do catálogo compartilhado. O backend continua somente-escrita, sem fallback de credenciais em env.
- A lista usa os mesmos badges de ambiente e ações de ícone da referência. No detalhe não há botões textuais extras de teste/debug no cabeçalho: o teste fica nas ações da listagem e no painel de logs quando habilitado. Abrir o modal de teste pela ação explícita inicia a verificação; “Testar novamente” repete. Montar uma página não dispara testes.
- IA: um único h1, aba **Provedores**, card **Provedores**, card **Geral** e ações. Filhos: aba **Configuração**, **Geral**, **Campos privados**, **Campos públicos** (se houver) e ações. Não reutilizar a listagem completa dentro do hub nem adicionar abas de modelos/consumo/features.
- Crons: abas **Geral** e **Rotinas**; a primeira contém Geral/agendador e a segunda contém busca, rotina recolhível, ativação, execução manual com confirmação e editor de intervalo. Mantém a única rotina registrada e os limites 1–1440 minutos, sem criar rotinas HTTP ou tipos de agenda não suportados pelo NestJS.
- Diferenças intencionais de domínio/segurança: API interna usa sessão e OpenAPI gerenciado (não tokens de sistemas nem explorador de chamadas); crons não têm secret/URL HTTP; debug mostra diagnósticos sanitizados via polling, não stream/xterm. Textos não devem prometer essas funções ausentes. Identidade SMTP usa Shekinah. URL pública Pusher aceita a lista HTTP(S)/WS(S) com caminho de proxy da referência, mas sem credenciais/query/hash; endereços usados pelos probes continuam origens HTTP(S) estritas.

## Limites e evolução

Não implementa ainda publicação de eventos/canais Pusher de negócio, envio transacional de e-mail, upload/assinatura S3, consumo de IA, tokens de API de sistemas ou outras rotinas. Debug é diagnóstico final com polling, não terminal/xterm ou stream NDJSON do Opex. Auditoria retém últimos 200 eventos por integração, não é trilha de compliance ilimitada. Endpoints de teste não devem ser expostos sem guard ou usados como health público.

Testes usam MongoDB efêmero e adapters externos mockados; nunca execute probes contra credenciais reais durante validação automática. Rebuild das imagens com novas dependências somente mediante autorização.
