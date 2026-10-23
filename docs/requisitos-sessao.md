# Sessões, capacidade e controle de entrada

Atualizado em 20/10/2026. Complementa a [proposta original](proposta-original.md), cuja versão inicial permanece como referência histórica. Em capacidade, entrada e identidade, as decisões deste documento substituem as questões em aberto correspondentes da proposta.

## Decisões aprovadas

| ID | Requisito | Critério de aceitação |
| --- | --- | --- |
| RF-09 | O mestre informa obrigatoriamente o máximo de jogadores ao criar uma sessão. | Ausência, zero, valor negativo, fracionário ou não numérico impedem a criação. O valor deve ser um inteiro positivo seguro; o teto suportado pelo produto ainda será definido por testes. |
| RF-10 | O mestre não ocupa vaga de jogador; a sala pode funcionar sem preencher todas as vagas. | Uma sala de quatro jogadores admite mestre e até quatro participantes; pode iniciar sem jogadores e continuar com menos de quatro. |
| RF-11 | Entrada inicial exige código de convite válido, nome de exibição e aprovação do mestre. | Código inválido não cria solicitação válida; código válido apenas coloca o solicitante em espera, sem liberar dados da mesa. |
| RF-12 | O servidor controla a admissão e verifica capacidade ao aprovar. | Com uma vaga disponível e duas aprovações concorrentes, no máximo uma é admitida. Falhas não deixam vaga ou credencial parcialmente concedida. |
| RF-13 | A capacidade conta participantes aprovados, não sockets ou requisições. | Atualizar a página ou reconectar o mesmo participante não consome outra vaga. Pedidos pendentes não contam como participantes aprovados. |
| RF-14 | Cada participante aprovado recebe identidade própria e uma credencial de sessão emitida pelo servidor. | Informar nome, IP ou playerId de outro participante não concede acesso em seu nome. A identidade das ações vem da credencial validada. |
| RF-15 | Desconexões temporárias preservam identidade e vaga. | Enquanto a credencial e a sala forem válidas, reconectar recupera o mesmo participante. A aplicação não libera a vaga apenas porque um socket fechou. |
| RF-16 | O mestre pode rejeitar solicitações e remover participantes. | Remover revoga a credencial, encerra conexões do participante e libera a vaga. A credencial antiga não permite reconexão. |
| RF-17 | Toda ação compartilhada passa por autorização no servidor. | Estar autenticado não permite movimentar tokens ou ler fichas sem a permissão correspondente. |
| RF-18 | Encerrar a sala invalida seus acessos. | Credenciais da sala encerrada não dão acesso a uma nova sessão. Persistir uma campanha não implica manter credenciais válidas. |

## Fluxo de entrada

1. Mestre informa a capacidade e cria a sala.
2. Servidor gera um convite aleatório; mestre compartilha endereço e convite com o grupo.
3. Jogador apresenta convite e nome; servidor valida e registra uma solicitação pendente.
4. Mestre aprova ou rejeita a solicitação.
5. Ao aprovar, servidor confere a capacidade, registra o participante e emite a credencial, entregando-a somente ao cliente da solicitação aprovada.
6. A conexão de jogo é associada à identidade autenticada e recebe apenas dados permitidos.
7. Reconexões reutilizam a identidade enquanto o acesso permanecer válido.

O código de convite permite solicitar entrada; não comprova identidade pessoal. A aprovação inicial depende do reconhecimento pelo mestre. A credencial comprova a posse do acesso concedido, não a identidade física de quem está no computador.

## Direção técnica

- Manter sessões autenticadas no servidor, identificadas por tokens opacos aleatórios. Contas em nuvem e JWT não são necessários no escopo inicial.
- Para navegador, preferir cookie HttpOnly, com política SameSite e proteção de origem adequadas. Secure exige HTTPS; o HTTP de loopback atual não representa a configuração final de rede.
- Evitar credenciais de sessão em localStorage, URLs e logs. O armazenamento do cliente Obsidian ainda precisa de definição e validação.
- Validar autenticação e origem ao estabelecer WebSocket, e autorização em cada ação. A política do cliente Obsidian deve ser explicitamente compatível; não desativar verificações de origem para acomodá-lo.
- Limitar tamanho e frequência de mensagens, tentativas de convite, conexões e solicitações pendentes; definir expiração para pedidos pendentes. Capacidade de jogadores não substitui esses limites.
- Definir proteção de tráfego e modelo de confiança antes de disponibilizar credenciais e dados fora de loopback. VPN não substitui autenticação ou autorização.
- Manter domínio e casos de uso independentes de HTTP, WebSocket, Obsidian e componentes visuais. O limite deve ser validado no núcleo da aplicação, além da interface.

## Desempenho e experiência

O servidor embutido continua sendo a arquitetura escolhida. O protótipo HTTP validou o carregamento e a execução básica no Obsidian; capacidade multiplayer e desempenho visual ainda não foram medidos.

Os testes de desempenho deverão registrar hardware, versões do Obsidian/Electron, quantidade de participantes, tamanho dos mapas, tokens e frequência de mensagens. Medir latência de sincronização (incluindo percentis), uso de CPU/memória, responsividade do editor e da mesa, recuperação após reconexão e liberação de recursos ao encerrar.

Evitar operações síncronas longas no caminho da interface e callbacks de rede. Código async não torna cálculos pesados paralelos. Se medições indicarem necessidade, avaliar workers ou processos compatíveis com o ambiente de plugins do Obsidian, preservando uma instalação única. Essa compatibilidade ainda não foi validada.

Não há garantia de quantidade máxima de jogadores ou metas numéricas de desempenho nesta etapa. Esses valores serão definidos e verificados por cenários reproduzíveis, antes de anunciá-los como capacidade suportada.

## Pendências de detalhamento

- Teto de jogadores suportado e possibilidade de alterar a capacidade durante a sessão.
- Duração e renovação de credenciais; comportamento após reiniciar o Obsidian.
- Política para duas abas ou dispositivos usando a mesma identidade, sem consumir vagas extras.
- Recuperação de acesso quando o jogador perde a credencial.
- Vinculação segura entre solicitação pendente, aprovação e entrega de credencial.
- Rotação do convite, bloqueio de novas solicitações e parâmetros de limites/expiração.
- Transporte protegido por LAN/VPN e armazenamento do cliente Obsidian.
- Limites de mapas, tokens e metas de desempenho.

## Estado de implementação

Atualmente existem HTTP/WebSocket local, cliente de ping/pong, ciclo de vida, contratos e validação de mensagens. A criação local de sessão implementa a capacidade obrigatória de RF-09, com validação no domínio, identidade UUID, consulta, proteção contra duplicação e estado em memória. Não exige participantes para criar a configuração da sessão; a contagem de participantes de RF-10 permanece pendente.

Os testes automatizados cobrem capacidade, identidade, duplicação, imutabilidade da configuração, isolamento entre instâncias e recuperação após falha do gerador de identidade. O build verifica a integração com os tipos da API do Obsidian; o formulário ainda requer verificação manual no aplicativo (criar, cancelar, Enter, dados inválidos e fechamento ao desativar).

A sessão local ainda não coordena o servidor. Hospedagem vinculada à sala, admissão, credenciais e regras RF-11 a RF-18 continuam pendentes. Reativar o plugin descarta a sessão em memória; isso não substitui o futuro fluxo explícito de encerramento e revogação.

## Referências técnicas

- [Sessões — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [WebSocket — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Desempenho — Electron](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Event loop — Node.js](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)
