# Padrões e antipadrões

Orientações extraídas do código atual e dos [requisitos de sessão](../requisitos-sessao.md). Antipadrões abaixo descrevem riscos a evitar, não um histórico de erros já ocorridos.

## Validar no lugar que garante a regra

- **Usar:** interface explica o erro; domínio valida a capacidade mesmo quando chamado sem formulário.
- **Evitar:** confiar apenas em `min`, `required` ou no tipo TypeScript.
- **Motivo:** outros chamadores e valores recebidos em runtime podem contornar a interface.
- **Referências:** [Session](../../src/domain/session.ts), [modal](../../src/ui/create-session-modal.ts), [testes](../../tests/session.test.mjs).

## Injetar o que depende do ambiente

- **Usar:** geração de identidade recebida por função; composição com `randomUUID` no plugin.
- **Evitar:** importar Obsidian ou gerar identidades por uma dependência global dentro do serviço.
- **Motivo:** mantém o caso de uso independente e permite verificar falhas de geração com testes determinísticos.
- **Referências:** [serviço](../../src/application/session-service.ts), [composição](../../src/main.ts).

## Publicar estado somente após sucesso

- **Usar:** validar, construir e então atribuir a sessão; estado por instância.
- **Evitar:** reservar a sessão antes de uma operação que pode falhar ou usar uma variável global compartilhada entre instâncias.
- **Motivo:** uma falha não deve deixar estado parcial nem impedir uma nova tentativa válida.
- **Referência:** [testes de falha, duplicação e isolamento](../../tests/session.test.mjs).

## Tratar mensagens como dados não confiáveis

- **Usar:** parse para `unknown`, validação em runtime e resultado explícito para mensagens inválidas.
- **Evitar:** `JSON.parse(text) as ClientMessage` como suposta validação ou tratar `requestId` como identidade autenticada.
- **Motivo:** tipos estáticos não validam bytes recebidos e correlação de mensagens não comprova identidade.
- **Referências:** [protocolo](../../src/shared/protocol.ts), [transporte](../../src/server/websocket-server.ts), [testes](../../tests/protocol.test.mjs).

## Dar a cada recurso um encerramento

- **Usar:** callbacks de limpeza para listeners, fechamento do modal e parada que coordena HTTP/WebSocket.
- **Evitar:** registrar handlers sem removê-los ou assumir que o plugin só será desativado quando estiver ocioso.
- **Motivo:** reativação e falhas não devem acumular conexões, eventos ou interfaces órfãs.
- **Referências:** [comandos](../../src/commands/session-commands.ts), [modal](../../src/ui/create-session-modal.ts), [servidor](../../src/server/local-server.ts).

## Manter compartilhamento e acesso explícitos

- **Usar agora:** servir somente os recursos fixos do protótipo, em loopback.
- **Exigir na evolução:** admissão, credenciais e autorização conforme os requisitos aprovados, antes de compartilhar recursos da mesa.
- **Evitar:** servir uma pasta do vault diretamente, confiar no nome/IP/UUID como autenticação ou contar sockets como jogadores.
- **Motivo:** privacidade do mestre e identidade persistente durante reconexões são requisitos do produto.
- **Referências:** [requisitos RF-11 a RF-18](../requisitos-sessao.md), [rotas atuais](../../src/server/local-server.ts).

## Evoluir com responsabilidades concretas

- **Usar:** módulos coesos, funções tipadas e componentes nativos do Obsidian onde já atendem ao caso.
- **Evitar:** introduzir frameworks, padrões ou limites rígidos de linhas sem um problema demonstrado.
- **Motivo:** a implementação ainda é pequena; novas estruturas precisam reduzir complexidade ou atender uma necessidade identificada.
- **Referências:** [arquitetura](arquitetura.md), [formulário atual](../../src/ui/create-session-modal.ts).
