# Arquitetura

Este documento descreve os limites vigentes do Obsidian VTT. Ele deve refletir o código atual; ideias ainda não implementadas aparecem explicitamente como futuras.

## Direção do produto

O plugin é uma mesa virtual simples, independente de sistema de RPG e integrada ao Obsidian. O mestre deve conseguir abrir uma campanha, colocar um mapa e peças e iniciar uma sessão sem antes modelar um mundo inteiro.

Não queremos construir uma engine de regras. Automação específica de sistemas, árvores profundas de entidades e configuração obrigatória antes de jogar ficam fora do núcleo. Ligações com notas do Obsidian devem ser opcionais e acrescentar contexto, não trabalho.

## Limites dos módulos

| Área | Responsabilidade | Não deve conhecer |
| --- | --- | --- |
| `domain` | Invariantes da sessão | Obsidian, DOM, HTTP, WebSocket |
| `application` | Casos de uso de hospedagem, acesso e campanha | Frameworks e detalhes de transporte |
| `infrastructure` | YAML, Vault e pacotes ZIP | Interface visual |
| `server` | Adaptadores HTTP/WebSocket e proteção de borda | Regras visuais |
| `ui` e `commands` | Interação do mestre e apresentação | Persistência e protocolo internos |
| `client` | Página do participante e cliente da API | Arquivos privados do Vault |
| `main.ts` | Composição, registro e encerramento | Regras de negócio novas |

Dependências de ambiente entram por construtores ou interfaces. Validação da interface melhora a experiência, mas invariantes pertencem ao núcleo e mensagens externas são verificadas em runtime.

## Sessão e acesso

Cada instância do plugin mantém seu próprio estado. `HostingService` coordena sessão, controle de acesso e servidor. `RoomAccess` administra convite, solicitações, credenciais, capacidade e reconexão. HTTP e WebSocket apenas traduzem o protocolo.

O fluxo atual é:

1. O mestre informa a capacidade e cria a sessão.
2. O participante envia nome e convite.
3. O mestre aprova ou rejeita a solicitação; somente a aprovação ocupa vaga.
4. Uma credencial opaca em cookie `HttpOnly` autentica HTTP e WebSocket.
5. Logout ou expiração não liberam a vaga; o mestre remove o participante.

Identidade não é credencial. Encerrar a sessão revoga acessos e encerra os recursos de rede. O servidor atual escuta somente em loopback e não expõe o Vault. O contrato detalhado está em [api-sessao.md](api-sessao.md).

## Campanhas e cenas

Uma campanha é um projeto persistido em `Campanhas/<nome>/`. Sua fonte de verdade atual é `campanha.yaml`:

```yaml
version: 1
id: identificador-opaco
name: Nome da campanha
scenes:
  - id: identificador-opaco
    name: Cena inicial
```

O repositório baseado no Vault valida versão e campos, detecta edição externa antes de salvar e cria as pastas padrão. Importação e exportação usam ZIP sem sobrescrever campanhas existentes; caminhos, quantidade de arquivos e tamanho são limitados. A exportação é backup do mestre e pode incluir notas privadas — não é o pacote enviado aos jogadores.

Hoje, cena possui somente identidade e nome. No modelo futuro, ela será uma composição leve de mapa e elementos colocados na mesa. Um elemento poderá opcionalmente apontar para uma entidade ou nota, mas o vínculo não será obrigatório. Mapas, tokens, permissões de recursos e sincronização ainda não estão implementados.

## Interface da mesa

`TableView` coordena a tela. Campanha, Participantes, Propriedades e Histórico são painéis independentes. `DockLayout` cuida da montagem visual, enquanto `dock-state` contém regras puras e testáveis de posição e visibilidade. Os painéis podem ser reorganizados dentro da aba, ocultados, restaurados e redimensionados.

Componentes de interface chamam serviços de aplicação. Eles não leem YAML nem administram sockets diretamente. Ajuda contextual fica atrás de ícones para evitar poluição visual.

## Ciclo de vida

Todo recurso criado precisa de encerramento correspondente, inclusive em falha parcial e em `onunload`. Isso vale para servidor, WebSocket, listeners, folhas de estilo e views. A composição em `main.ts` é o lugar para conectar e desmontar esses recursos, não uma camada de regras.

## Decisões vigentes

- YAML é o formato legível das campanhas; comentários e formatação não são preservados após edição pela interface.
- O produto permanece independente de regras de RPG; o mestre arbitra o sistema.
- Simplicidade de início é requisito: recursos avançados devem ser progressivos e opcionais.
- Arquivos privados só podem ser expostos por autorização explícita; o protótipo atual não compartilha nenhum arquivo.
- LAN/VPN exige transporte protegido e revisão de segurança antes de ser habilitado.
- Abstrações novas precisam representar uma responsabilidade concreta, não uma possibilidade hipotética.
