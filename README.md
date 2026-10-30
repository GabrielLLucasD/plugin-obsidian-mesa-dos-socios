# Obsidian VTT

Mesa virtual de RPG integrada ao **Obsidian Desktop**. O mestre organiza a campanha no próprio cofre, hospeda a sessão localmente e, no futuro, compartilha somente os recursos autorizados com jogadores no navegador ou no plugin.

O objetivo é simples: abrir uma campanha, colocar um mapa e peças e começar a jogar. O projeto é independente de sistema e não pretende virar uma engine de regras que obrigue o mestre a modelar todo o mundo antes da primeira sessão.

> Em desenvolvimento. Campanhas, cenas básicas, layout da mesa e admissão autenticada estão implementados. Mapas, tokens e acesso LAN/VPN ainda não estão.

## O que existe hoje

- Mesa do mestre com painéis independentes de Campanha, Participantes, Propriedades e Histórico.
- Painéis reorganizáveis, ocultáveis e redimensionáveis, com layout persistido no workspace.
- Campanhas em YAML, cadastro básico de cenas e importação/exportação por ZIP.
- Servidor embutido em loopback com capacidade definida pelo mestre.
- Convite, solicitação de entrada, aprovação, rejeição e remoção de participantes.
- Credenciais opacas em cookie `HttpOnly`, reconexão e autenticação de WebSocket.
- Página de participante para entrada, espera, saída e teste de conexão.
- Limites de requisição/conexão, validação em runtime e testes automatizados.

O servidor atende somente ao próprio computador em `http://127.0.0.1:3210` e não compartilha arquivos do cofre. Todo estado da sessão permanece em memória.

## Limites do produto

- O mestre continua responsável pelas regras do RPG.
- Recursos avançados devem ser opcionais e aparecer progressivamente.
- Uma cena começará leve: mapa e elementos posicionados. Vínculos com personagens, itens ou notas poderão ser adicionados quando forem úteis.
- Arquivos privados nunca devem ser expostos implicitamente.
- Acesso pela rede só será habilitado com transporte protegido e permissões de recursos.

## Usando o projeto

### Requisitos

- Node.js 24 e npm
- Obsidian Desktop 1.14.4 ou superior

Docker e serviços externos não são necessários atualmente.

### Instalação e build

```sh
npm ci
npm run build
```

O build gera o plugin em:

```text
sandbox-vault/.obsidian/plugins/obsidian-vtt/
```

Abra `sandbox-vault` como cofre no Obsidian e habilite **VTT de laboratório** em **Configurações → Plugins da comunidade**. Abra **Mesa** pela paleta de comandos ou pelo ícone lateral.

No PowerShell, use `npm.cmd` no lugar de `npm` caso a política de execução bloqueie scripts.

## Campanhas

**Nova campanha** cria `Campanhas/<nome>/campanha.yaml` e as pastas padrão. A campanha armazena identidade, nome e a lista de cenas; cenas ainda não possuem mapas ou tokens.

A interface pode criar, renomear e remover cenas. Remover uma cena elimina somente seu cadastro, sem apagar arquivos externos. O YAML é reserializado nas edições, portanto comentários e formatação manual não são preservados. Campos desconhecidos são rejeitados para evitar perda silenciosa de dados.

Importar e exportar usam ZIP. A exportação é um backup completo do mestre e pode conter notas privadas; ela não deve ser entregue diretamente aos jogadores. A importação valida conteúdo e caminhos e nunca sobrescreve uma campanha existente.

## Sessões

Ao criar uma sessão, o mestre informa a quantidade máxima de jogadores. O convite permite solicitar entrada, mas somente a aprovação do mestre cria a identidade e ocupa a vaga. Logout e expiração não liberam a vaga; o mestre precisa remover o participante.

Em **Convidar e gerenciar**, o mestre copia endereço e convite, acompanha solicitações, aprova ou rejeita entradas, gira o convite e bloqueia novas solicitações. Encerrar a sessão revoga acessos e fecha o servidor.

## Documentação viva

- [Arquitetura](docs/arquitetura.md): limites dos módulos e decisões vigentes.
- [Desenvolvimento](docs/desenvolvimento.md): comandos, testes e roteiro manual.
- [API de sessão](docs/api-sessao.md): contrato HTTP/WebSocket, identidade e admissão.

Esses documentos substituem propostas, planos e diários antigos. Quando o comportamento mudar, atualize a fonte viva correspondente.

## Próximas entregas

1. Definir a estrutura mínima de uma cena sem transformar o plugin em engine.
2. Exibir mapa e grid na área central da mesa.
3. Criar elementos/tokens posicionáveis e suas permissões.
4. Sincronizar o estado autorizado com a visão do participante.
5. Projetar e validar acesso LAN/VPN protegido.

## Referências

- [Documentação de desenvolvimento do Obsidian](https://docs.obsidian.md/)
- [Plugin de exemplo oficial](https://github.com/obsidianmd/obsidian-sample-plugin)
