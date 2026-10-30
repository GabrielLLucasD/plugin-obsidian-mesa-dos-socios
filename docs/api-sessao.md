# API de sessão e autenticação

Contrato implementado em 27/10/2026 para o frontend. Base de referência: `http://127.0.0.1:3210`. O host é o Obsidian Desktop. Este contrato funciona somente em loopback nesta versão; não representa uma implantação HTTPS/LAN/VPN pronta.

## Fluxo do jogador

1. Consultar `GET /api/me`. Se retornar 200, reutilizar o acesso e conectar `/ws`.
2. Sem acesso (401), consultar `GET /api/join-request` para recuperar um pedido pendente após atualizar a página. Se não existir (410), mostrar nome e convite.
3. Enviar `POST /api/join-requests` com `{ "displayName": "Ana", "invite": "convite recebido do mestre" }`.
4. Consultar `GET /api/join-request` a cada dois segundos. Estados: `pending`, `approved`, `rejected`.
5. Em `approved`, enviar `POST /api/claim` com `{}`. O servidor entrega a credencial exclusivamente por cookie HttpOnly; o JSON devolve a identidade autenticada.
6. Abrir `ws://127.0.0.1:3210/ws`. O navegador envia o cookie automaticamente.
7. Após desconexão, consultar `/api/me` antes de reconectar. 401 exige nova autorização; não criar outro participante automaticamente.

O módulo [session-api.ts](../src/client/session-api.ts) implementa as chamadas e valida as respostas. Use `credentials: "same-origin"`. O frontend deve ser servido pela mesma origem; não habilitamos CORS para um servidor de desenvolvimento externo. O bundle atual é compilado pelo esbuild e entregue pelo plugin.

## Endpoints

| Método e caminho | Entrada | Sucesso | Autorização |
| --- | --- | --- | --- |
| GET `/api/session` | — | 200 `RoomView` | Pública: somente capacidade e identificação da sala |
| POST `/api/join-requests` | `{displayName, invite}` | 202 `JoinRequestView` + cookie de pedido | Convite válido; entradas habilitadas |
| GET `/api/join-request` | — | 200 `JoinRequestView` | Cookie secreto do próprio pedido |
| POST `/api/claim` | `{}` | 200 `MeView` + cookie de acesso | Pedido aprovado ou acesso já válido |
| GET `/api/me` | — | 200 `MeView` | Credencial válida de participante |
| POST `/api/logout` | `{}` | 200 `{ok:true}` + limpeza de cookies | Credencial válida de participante |

Todos os POST exigem `Content-Type: application/json`, `Origin` exatamente igual à origem da sala e corpo de no máximo 4096 bytes. Campos extras são recusados nos pedidos; claim/logout exigem objeto vazio. Toda requisição HTTP exige Host correspondente ao endereço servido. Não enviar credenciais em URLs, nomes, IDs ou corpos JSON.

### Formatos

Os tipos e guardas estão em [access-contracts.ts](../src/shared/access-contracts.ts). Tempos são timestamps Unix em milissegundos.

```ts
type RoomView = {
  id: string;
  maxPlayers: number;
  approvedPlayers: number;
  acceptingRequests: boolean;
};

type JoinRequestView = {
  id: string;
  displayName: string;
  status: "pending" | "approved" | "rejected";
  expiresAt: number;
};

type MeView = {
  player: { id: string; displayName: string };
  room: RoomView;
  expiresAt: number;
};
```

Nome: 1 a 40 caracteres depois de remover espaços externos, sem caracteres de controle. Nomes podem se repetir; são apresentação, não identidade. A API pública não expõe a lista de participantes, convites, tickets, hashes ou credenciais.

### Erros

```json
{"error":{"code":"UNAUTHENTICATED","message":"Acesso inválido ou expirado."}}
```

| HTTP | Códigos | Tratamento esperado |
| --- | --- | --- |
| 400 | INVALID_REQUEST, INVALID_NAME | Corrigir entrada |
| 401 | UNAUTHENTICATED | Não reconectar ao jogo sem recuperar acesso |
| 403 | INVALID_INVITE, ENTRY_CLOSED, NOT_APPROVED, FORBIDDEN | Mostrar motivo; não repetir automaticamente aprovação/convite |
| 404 | NOT_FOUND | Caminho inexistente; não existe API administrativa pública |
| 409 | ROOM_FULL, REQUEST_NOT_PENDING | Conflito de estado/capacidade |
| 410 | ROOM_CLOSED, REQUEST_EXPIRED | Sala ou solicitação não está mais disponível |
| 413 | BODY_TOO_LARGE | Reduzir corpo |
| 415 | UNSUPPORTED_MEDIA_TYPE | Enviar JSON |
| 429 | TOO_MANY_REQUESTS | Respeitar Retry-After (60 segundos) |
| 500 | INTERNAL_ERROR | Mostrar falha genérica; não presumir sucesso |

Falhas HTTP anteriores à API (por exemplo Host inválido), erros de handshake WebSocket e conexão encerrada podem não ter envelope JSON. O cliente não deve depender de obter 410 depois que o servidor já fechou a porta.

## Credenciais e reconexão

- O convite tem oito caracteres aleatórios no formato `ABCD-2345`, sem I, O, 0 ou 1. Aceita letras minúsculas e ignora espaços e hífens. Ele permite apenas solicitar aprovação, com limite de tentativas. Ticket de pedido e credencial continuam com 32 bytes aleatórios em base64url; têm finalidades distintas. UUID de sala ou participante nunca autentica.
- Cookies: `vtt_<porta>_request` e `vtt_<porta>_session`; `HttpOnly; SameSite=Strict; Path=/`, sem Domain. O navegador não deve ler nem copiar esses cookies para localStorage.
- Os nomes distinguem instâncias em portas diferentes, mas cookies não são isolados por porta pelo navegador. Este protótipo não estabelece uma fronteira de segurança contra processos maliciosos no próprio computador.
- `Secure` não é usado neste HTTP de loopback. HTTPS/WSS, distribuição de confiança/certificados e endereço LAN/VPN ainda são trabalho obrigatório antes de implantação remota.
- Pedido expira em 10 minutos a partir da criação, inclusive após aprovação. Se não houver claim dentro desse prazo, o mestre precisa remover a vaga aprovada antes de autorizar uma nova solicitação.
- Credencial expira 8 horas após emissão, sem renovação automática. Um claim com cookie de acesso válido é idempotente e não estende sua duração.
- Se a resposta do claim se perder antes de o cookie chegar, o ticket aprovado pode repetir o claim enquanto válido. O novo token substitui e revoga o anterior; não há múltiplas credenciais válidas por participante.
- Até quatro sockets podem compartilhar a mesma identidade (abas do mesmo perfil), consumindo uma única vaga. Perfis/dispositivos diferentes precisam de aprovação própria. Não há migração de identidade entre dispositivos nesta versão.
- Desconexão, expiração e logout preservam a vaga. Logout revoga todas as conexões da identidade e impede reaproveitar seu ticket. O mestre remove o participante para liberar a vaga; isso também é o procedimento de recuperação de acesso perdido.
- Encerrar a sala/reiniciar o plugin descarta todos os pedidos e acessos. Uma nova sala não aceita cookies antigos.

## WebSocket autenticado

`/ws` usa a mesma porta HTTP. Exige origem e Host corretos, além do cookie de sessão válido. Origem não substitui autenticação. A identidade é extraída da credencial no servidor; mensagens não podem escolher um playerId nem papel de mestre.

Mensagem atual:

```json
{"type":"ping","requestId":"123"}
```

Resposta:

```json
{"type":"pong","requestId":"123"}
```

O acesso é revalidado por mensagem e a cada segundo. Revogação explícita notifica o transporte e termina os sockets imediatamente; expiração o faz em até um segundo quando o event loop estiver disponível. Rejeições de upgrade usam 401, 403 ou 429. Mensagem binária fecha com 1003; JSON/formato inválido ou excesso de frequência fecha com 1008; excesso de tamanho usa 1009. Revogação e parada podem aparecer no navegador como fechamento anormal 1006, pois o servidor termina o socket; consulte `/api/me` para distinguir acesso inválido de perda temporária de rede.

Somente ping está disponível. Autorizações por token, mapa e ficha precisam ser implementadas junto com esses recursos; autenticar a conexão não concede acesso indiscriminado ao futuro estado da mesa.

## Operações do mestre

Disponíveis somente no plugin, por [RoomAccess](../src/application/room-access.ts):

- `listRequests()`, `approve(requestId)`, `reject(requestId)`;
- `listPlayers()`, `removePlayer(playerId)`;
- `invite`, `rotateInvite()`, `setAccepting(boolean)`.

`HostingService.create(maxPlayers)` coordena sala e abertura do servidor; `stop()` revoga os acessos e fecha a rede. O modal **Gerenciar sessão e entradas** usa esses métodos diretamente. Endereço e convite aparecem em campos somente leitura, selecionáveis e com botão Copiar; se a cópia automática falhar, o campo fica selecionado para Ctrl+C. Um frontend futuro dentro do Obsidian deve receber callbacks do adaptador, não abrir endpoints administrativos no servidor de jogadores.

Bloquear entradas impede novos pedidos, mas permite decidir pedidos já recebidos e recuperar acessos já aprovados. Girar o convite impede novos pedidos com o código anterior; não rejeita automaticamente os pendentes nem expulsa participantes existentes.

## Limites operacionais iniciais

| Recurso | Limite |
| --- | --- |
| Solicitações retidas, incluindo decididas até expirar | 64 por sala |
| Tentativas de convite | 20/minuto por endereço de rede |
| Requisições da API | 600/minuto por endereço de rede |
| Tentativas de handshake WebSocket | 120/minuto por endereço de rede |
| Conexões HTTP | 128 |
| WebSockets simultâneos | 64 totais e 4 por identidade |
| Mensagem WebSocket / corpo JSON | 4096 bytes |
| Mensagens por socket | 60 a cada 10 segundos |
| Fila de saída por socket | 64 KiB antes de rejeitar nova mensagem |

São políticas iniciais de defesa, não garantias de desempenho ou um teto comercial aprovado de jogadores. Os limites por endereço compartilham a cota entre abas e clientes da mesma origem de rede. As tabelas de rate limit têm tamanho limitado. O HTTP usa timeout de cabeçalhos de 10 segundos e de requisição de 15 segundos.

## Cliente Obsidian futuro

O contrato permite que um adaptador desktop mantenha os cookies em memória e envie a origem exata ao HTTP/WebSocket. A interface de jogador dentro do plugin e armazenamento seguro entre reinícios ainda não existem. Não colocar tokens nas notas, no vault ou nas configurações comuns para simular persistência. A interface atual no Obsidian é de mestre; a interface de jogador entregue é a página web.

## Validação

Testes: [admissão](../tests/access.test.mjs), [hospedagem](../tests/hosting.test.mjs), [HTTP/WebSocket](../tests/local-server.test.mjs). Os testes de transporte usam conexões reais com cookies simulados; não substituem a validação visual no Obsidian ou no navegador.

Roteiro manual: criar sala, copiar endereço/convite, solicitar entrada na página, atualizar a lista do mestre, aprovar, confirmar ping, atualizar a página para recuperar identidade, remover jogador e confirmar perda de acesso, encerrar a sala e confirmar liberação da porta. Em outro perfil de navegador, verificar sala cheia e rejeição. A edição visual e a validação manual desse roteiro continuam necessárias.
