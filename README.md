# Obsidian VTT

Mesa virtual de RPG para o **Obsidian Desktop**, integrada às notas, fichas e arquivos de uma campanha.

O projeto propõe que o mestre hospede a sessão no próprio Obsidian, enquanto os jogadores participam pelo plugin ou por um navegador. A comunicação será feita por rede local ou VPN, sem depender de hospedagem em nuvem e sem acoplamento a um sistema específico de RPG.

> Em desenvolvimento inicial. O protótipo atual oferece um servidor HTTP local; os recursos de mesa e multiplayer ainda estão planejados.

## Objetivos

- Oferecer mapas, grids, tokens e rolagem de dados em sessões multiplayer.
- Integrar tokens e fichas às notas Markdown da campanha.
- Permitir a participação de jogadores pelo Obsidian Desktop e pelo navegador.
- Hospedar a sessão no computador do mestre, com suporte a LAN e VPN.
- Compartilhar apenas recursos autorizados, preservando os arquivos privados do mestre.
- Distribuir um plugin autossuficiente, sem exigir instalação de um servidor ou runtime adicional pelos jogadores e pelo mestre.
- Manter uma arquitetura modular, extensível e independente de regras específicas de RPG.

## Especificação

A [proposta original](docs/proposta-original.md) reúne a visão do produto, requisitos, restrições, fluxos previstos e questões em aberto. Ela serve como referência para a evolução do projeto; tecnologias opcionais e funcionalidades futuras ainda estão sujeitas a definição.

## Estado atual

- Plugin exclusivo para Obsidian Desktop.
- Comandos para iniciar e parar um servidor HTTP embutido.
- Página de verificação em `http://127.0.0.1:3210`.
- Encerramento do servidor ao desativar o plugin.
- Tratamento de porta ocupada e de chamadas repetidas de início e parada.
- Testes automatizados do servidor.

O servidor aceita conexões apenas do próprio computador e entrega uma página fixa. Não há compartilhamento de arquivos do vault, autenticação de participantes ou conexão multiplayer nesta versão.

## Arquitetura

A direção arquitetural é separar regras de domínio, casos de uso, apresentação e integrações. As dependências serão conectadas explicitamente no ponto de entrada do plugin, mantendo as regras da mesa independentes do Obsidian, da interface e do transporte de rede.

A implementação atual contém:

```text
src/
├── main.ts                       # Composição e ciclo de vida do plugin
├── commands/
│   └── server-commands.ts        # Registro do comando de iniciar o servidor
└── server/
    └── local-server.ts          # Servidor HTTP e gerenciamento das conexões
tests/
└── local-server.test.mjs         # Testes do servidor
docs/
└── proposta-original.md         # Especificação inicial
sandbox-vault/                   # Vault de desenvolvimento
```

A extração dos comandos está em andamento: o comando de parada ainda está em `main.ts`. Módulos de domínio e aplicação serão introduzidos à medida que os casos de uso da mesa forem implementados.

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
| `npm test` | Executar os testes do servidor HTTP |

Após recompilar, desative e ative o plugin para carregar a nova versão. O modo `dev` não executa a verificação de tipos. Ao alterar o manifesto, reinicie o build de desenvolvimento e reabra o Obsidian.

No PowerShell, use `npm.cmd` no lugar de `npm` caso a política de execução bloqueie scripts.

## Próximas etapas

- Concluir a separação dos comandos e do ciclo de vida.
- Validar comunicação via WebSocket entre Obsidian e navegador.
- Implementar criação de sessões, identidades e permissões.
- Validar acesso por LAN/VPN e reconexão de participantes.
- Construir mapas, grids, tokens sincronizados e rolagens de dados.
- Integrar fichas e recursos autorizados do vault à sessão.

## Referências

- [Documentação de desenvolvimento do Obsidian](https://docs.obsidian.md/)
- [Plugin de exemplo oficial](https://github.com/obsidianmd/obsidian-sample-plugin)
