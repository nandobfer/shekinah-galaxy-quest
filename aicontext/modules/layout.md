# Layout administrativo e navegação

## Implementado

- Casca visual portada de `~/code/opex/src/features/layout`: barra desktop de 68px, drawer mobile de 240px abaixo de 1024px, tokens/estados/animações do Opex. Marca Shekinah com ícone genérico Sparkles; não usa a marca Opex.
- Exatamente dois itens: **Início** (`/`, match exato) e **Integrações** (`/integracoes`, inclui detalhes). React Router substitui Next; data router habilita bloqueio de navegação de formulários sujos.
- Nome do administrador vem da sessão real. Rodapé tem iniciais, versão global do package raiz e logout atual (revoga todas as sessões). Desktop usa popover; mobile apresenta ação inline.
- Login fica fora da casca. A sessão protege todas as páginas e continua revalidada por foco/intervalo; falha de conexão tem retry e 401 limpa dados protegidos.
- Drawer fecha por Escape/fundo/link/botão, mantém foco no diálogo, devolve foco ao acionador ao cancelar e torna o conteúdo inerte. Navegar foca o conteúdo; há link de pular navegação e movimento reduzido.
- Início apresenta saudação e atalho para Integrações, sem indicadores fictícios.

## Limites

Sem sidebar expansível no desktop (o próprio Opex usa rail fixo), menus de negócio, contadores, logo definitivo ou dependência Next.js. Ações do formulário e sobreposições reutilizam shadcn/Radix já portados.
