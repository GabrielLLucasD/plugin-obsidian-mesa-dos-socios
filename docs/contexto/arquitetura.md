# Arquitetura atual

Conferida com as fontes em 20/10/2026. A [proposta original](../proposta-original.md) descreve a visão completa; este documento descreve os limites implementados.

## Responsabilidades

| Área | Responsabilidade atual | Limite a preservar |
| --- | --- | --- |
| `src/main.ts` | Compor serviços, registrar comandos e encerrar o servidor | Não concentrar regras da mesa |
| `src/domain/` | Configuração imutável e capacidade válida de sessão | Sem Obsidian, DOM, rede ou dependências de ambiente |
| `src/application/` | Criar e consultar uma sessão por instância de serviço | Depende do domínio; recebe geração de identidade por função |
| `src/commands/` | Adaptar comandos do Obsidian, notificações e ciclo de vida de modal | Delegar operações ao serviço/servidor |
| `src/ui/` | Formulário de criação, erros e interação | Recebe callback; não mantém a sessão de negócio |
| `src/server/` | HTTP, upgrade WebSocket, conexões e encerramento | Não expor arquivos do vault; protocolo validado na entrada |
| `src/shared/protocol.ts` | Tipos, guardas e parser de mensagens | Compatível com cliente e servidor; sem Obsidian ou APIs exclusivas de Node |
| `src/client/` | Página e cliente web de ping/pong | Executa no navegador; sem acesso direto ao vault ou APIs de Node |
| `build/` | Empacotar o cliente web para inclusão no servidor | Código de desenvolvimento, não lógica de domínio |

## Fluxos existentes

Criação local: comando → modal → callback → `SessionService.create` → `Session`. O serviço valida capacidade antes de gerar identidade e só publica a sessão depois da construção bem-sucedida. `main.ts` injeta `randomUUID`; o domínio não exige que todo identificador tenha formato UUID.

Rede: comando de iniciar → `LocalServer.start` → HTTP em loopback → página e script empacotados → WebSocket `/ws` → parser do protocolo → pong. A origem do upgrade precisa corresponder à origem permitida. Isso não constitui autenticação de jogadores.

Encerramento: `onunload` marca o plugin como inativo e solicita parada do servidor; o registro de comandos fecha o modal. A parada remove o listener de upgrade e encerra conexões WebSocket e HTTP. Mudanças devem preservar os casos de início/parada repetidos e desativação durante a abertura.

## Fronteiras ainda em construção

A sessão em memória e o servidor ainda são fluxos separados. Criar sessão não inicia hospedagem; parar servidor não é um fluxo de encerramento/revogação de sala. Não há participantes autenticados, persistência de campanha, mapas ou tokens implementados.

Ao integrar esses fluxos, mantenha a coordenação do caso de uso separada do detalhe de HTTP/WebSocket. Defina contratos de integração conforme a necessidade real. A arquitetura atual não requer container de injeção, barramento de eventos ou interfaces para toda classe.

Requisitos e pendências de admissão estão em [requisitos de sessão](../requisitos-sessao.md). As fronteiras descritas aqui são verificadas por inspeção; não existe regra de lint que impeça imports entre camadas.
