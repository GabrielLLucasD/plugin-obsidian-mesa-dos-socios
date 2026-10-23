# Obsidian VTT

Mesa virtual de RPG para o **Obsidian Desktop**, integrada às notas, fichas e arquivos de uma campanha.

O projeto propõe que o mestre hospede a sessão no próprio Obsidian, enquanto os jogadores participam pelo plugin ou por um navegador. A comunicação será feita por rede local ou VPN, sem depender de hospedagem em nuvem e sem acoplamento a um sistema específico de RPG.

> Em desenvolvimento inicial. O protótipo oferece HTTP/WebSocket local com ping/pong e criação de sessão em memória pelo Obsidian. Admissão de jogadores e recursos da mesa ainda estão planejados.

## Objetivos

- Oferecer mapas, grids, tokens e rolagem de dados em sessões multiplayer.
- Integrar tokens e fichas às notas Markdown da campanha.
- Permitir a participação de jogadores pelo Obsidian Desktop e pelo navegador.
- Hospedar a sessão no computador do mestre, com suporte a LAN e VPN.
- Exigir capacidade de jogadores definida pelo mestre e controlar entrada por convite e aprovação, com identidade, reconexão e revogação de acesso.
- Compartilhar apenas recursos autorizados, preservando os arquivos privados do mestre.
- Distribuir um plugin autossuficiente, sem exigir instalação de um servidor ou runtime adicional pelos jogadores e pelo mestre.
- Manter uma arquitetura modular, extensível e independente de regras específicas de RPG.

## Especificação

A [proposta original](docs/proposta-original.md) reúne a visão do produto, requisitos, restrições, fluxos previstos e questões em aberto. Ela serve como referência para a evolução do projeto; tecnologias opcionais e funcionalidades futuras ainda estão sujeitas a definição.

Os [requisitos de sessão e controle de entrada](docs/requisitos-sessao.md) registram as decisões posteriores sobre capacidade, convite, aprovação, identidade e reconexão. A capacidade obrigatória está implementada na criação local; admissão e autenticação ainda estão pendentes.

## Estado atual

- Plugin exclusivo para Obsidian Desktop.
- Comandos para iniciar e parar um servidor HTTP embutido.
- Página de verificação em `http://127.0.0.1:3210`.
- Encerramento do servidor ao desativar o plugin.
- Tratamento de porta ocupada e de chamadas repetidas de início e parada.
- Testes automatizados do servidor.
- Contratos ping/pong, validação e interpretação de mensagens JSON, com testes do protocolo.

O servidor aceita conexões apenas do próprio computador, com página de ping/pong por WebSocket. Não há compartilhamento de arquivos do vault, autenticação de participantes ou sessão multiplayer nesta versão.

### Sessão local

O comando **Criar sessão** abre um formulário com capacidade obrigatória. Valores vazios, não positivos, fracionários ou fora da faixa de inteiros seguros são recusados. Cancelar ou fechar a janela não cria uma sessão. O botão de criação e a tecla Enter confirmam o formulário.

**Consultar sessão** mostra a identidade UUID e a capacidade. Uma segunda criação é recusada. A sessão permanece apenas em memória e é descartada ao desativar o plugin; criar uma sessão ainda não inicia o servidor nem altera os clientes conectados. Para reiniciar essa configuração local, reative o plugin. O encerramento explícito será integrado à hospedagem em uma próxima etapa.

## Arquitetura

O [mapa de contexto](docs/contexto/README.md) orienta a leitura de arquitetura, padrões, decisões e validação por tipo de tarefa. As instruções essenciais para agentes ficam em [AGENTS.md](AGENTS.md).

A direção arquitetural é separar regras de domínio, casos de uso, apresentação e integrações. As dependências serão conectadas explicitamente no ponto de entrada do plugin, mantendo as regras da mesa independentes do Obsidian, da interface e do transporte de rede.

A implementação atual contém:

```text
src/
├── main.ts                       # Composição e ciclo de vida do plugin
├── domain/
│   └── session.ts                # Configuração válida e imutável da sessão
├── application/
│   └── session-service.ts        # Criação e consulta em memória
├── ui/
│   └── create-session-modal.ts   # Formulário do Obsidian
├── commands/
│   ├── session-commands.ts       # Criar e consultar sessão
│   └── server-commands.ts        # Comandos de iniciar e parar o servidor
├── server/
│   └── local-server.ts          # Servidor HTTP e gerenciamento das conexões
└── shared/
    └── protocol.ts             # Contratos, validação e parser de mensagens
tests/
├── local-server.test.mjs         # Testes do servidor
├── protocol.test.mjs             # Testes do protocolo
└── session.test.mjs              # Invariantes e criação de sessão
docs/
├── proposta-original.md         # Especificação inicial
└── requisitos-sessao.md          # Capacidade, entrada e identidade
sandbox-vault/                   # Vault de desenvolvimento
```

Domínio e aplicação não dependem do Obsidian, HTTP ou WebSocket. A `main.ts` injeta o gerador de UUID no serviço e entrega o serviço aos comandos. A janela recebe uma função de criação; o serviço mantém uma sessão por instância, sem estado global. O transporte permanece separado dessa configuração local até a integração da hospedagem e admissão.

## Desenvolvimento

### Requisitos

- Node.js 24 e npm.
- Obsidian Desktop 1.14.4 ou superior, conforme o manifesto. A versão de referência para validação é a 1.14.4.

Node.js é necessário para desenvolver e compilar o projeto. Docker e serviços externos não são necessários para o protótipo atual.

### Instalação e build

```sh
npm ci
npm run build
```

O build verifica os tipos e gera `main.js` e `manifest.json` em:

```text
sandbox-vault/.obsidian/plugins/obsidian-vtt/
```

Abra `sandbox-vault` como cofre no Obsidian e ative **VTT de laboratório** em **Configurações → Plugins da comunidade**.

Na paleta de comandos, execute **Iniciar Servidor RPG** e acesse `http://127.0.0.1:3210` no navegador. Use **Parar servidor local** para encerrar. Se a porta estiver ocupada, encerre a outra instância que a utiliza antes de tentar novamente.

### Comandos disponíveis

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Recompilar automaticamente ao alterar o código |
| `npm run check` | Verificar os tipos TypeScript |
| `npm run build` | Verificar os tipos e gerar o plugin |
| `npm test` | Executar testes de HTTP/WebSocket, protocolo e sessões |

Após recompilar, desative e ative o plugin para carregar a nova versão. O modo `dev` não executa a verificação de tipos. Ao alterar o manifesto, reinicie o build de desenvolvimento e reabra o Obsidian.

No PowerShell, use `npm.cmd` no lugar de `npm` caso a política de execução bloqueie scripts.

## Próximas etapas

- Integrar criação e encerramento da sessão à hospedagem do servidor.
- Implementar convite, aprovação, identidades de jogadores e permissões de sessão.
- Validar acesso por LAN/VPN e reconexão de participantes.
- Construir mapas, grids, tokens sincronizados e rolagens de dados.
- Integrar fichas e recursos autorizados do vault à sessão.

## Referências

- [Documentação de desenvolvimento do Obsidian](https://docs.obsidian.md/)
- [Plugin de exemplo oficial](https://github.com/obsidianmd/obsidian-sample-plugin)
