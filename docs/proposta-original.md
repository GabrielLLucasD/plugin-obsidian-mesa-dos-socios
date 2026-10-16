# Obsidian VTT — Contexto e especificação inicial do workspace

**Versão:** 0.1  
**Data:** 15/10/2026  
**Status:** concepção e levantamento inicial de requisitos

## 1. Visão do produto

Desenvolver um plugin **desktop** para Obsidian que transforme a aplicação em uma mesa virtual de RPG (VTT, Virtual Tabletop), inspirada em ferramentas como Roll20, mas integrada às notas e aos arquivos Markdown de uma campanha.

O mestre obrigatoriamente utiliza o Obsidian Desktop e hospeda a sessão no próprio computador. Os jogadores podem participar pelo Obsidian Desktop com o plugin ou por um navegador web, sem instalar o Obsidian.

A comunicação multiplayer deve funcionar por rede local ou VPN, incluindo Radmin VPN, sem depender de hospedagem em nuvem. O produto deve ser **independente de um sistema específico de RPG**, permitindo adaptações futuras.

## 2. Objetivos

- Permitir sessões multiplayer em tempo real com mapas, grids, tokens e rolagem de dados.
- Aproveitar as notas, fichas e materiais já existentes no Vault do mestre.
- Permitir aos jogadores do Obsidian interagir com suas próprias notas e fichas.
- Oferecer acesso por navegador para jogadores sem Obsidian.
- Simplificar instalação e uso: **um plugin autossuficiente**, sem exigir instalação manual de Java, Node.js ou servidor externo.
- Preservar privacidade das notas do mestre por meio de compartilhamento controlado.

## 3. Requisitos funcionais confirmados

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Jogadores podem entrar em uma sessão tanto pelo Obsidian Desktop quanto por navegador web. | Alta |
| RF-02 | Jogadores conectados pelo Obsidian podem interagir com suas próprias anotações e fichas, se desejarem. | Alta |
| RF-03 | O mestre é obrigatoriamente o host da sessão e precisa estar usando o Obsidian Desktop. | Alta |
| RF-04 | O plugin funciona exclusivamente no Obsidian Desktop; jogadores podem acessar pelo navegador, inclusive de dispositivos compatíveis. | Alta |
| RF-05 | O mestre controla a visualização dos mapas e grids e pode integrá-los aos arquivos existentes de sua campanha. | Alta |
| RF-06 | O mestre pode vincular fichas a tokens de personagens e abrir essas fichas facilmente. | Alta |
| RF-07 | O plugin oferece rolagem de dados. | Alta |
| RF-08 | O plugin é genérico, sem acoplamento obrigatório a um sistema de RPG, e pode ser adaptado a diferentes regras. | Alta |

### Interpretações que precisam de detalhamento

- **RF-02:** definir se as alterações nas fichas são somente locais, sincronizadas sob demanda ou sincronizadas automaticamente; determinar propriedade e permissões de edição.
- **RF-05:** detalhar camadas, grids, permissões de movimentação, ocultação de elementos e seleção de mapa ativo.
- **RF-06:** definir o formato de vínculo entre token e nota Markdown, e o que o jogador pode visualizar da ficha.
- **RF-07:** definir sintaxe de dados, rolagens públicas/privadas, histórico e modificadores.
- **RF-08:** separar recursos universais da mesa de eventuais extensões de regras.

## 4. Requisitos não funcionais e restrições

| ID | Requisito / restrição | Situação |
|---|---|---|
| RNF-01 | Não exigir instalação manual de runtime Java, Node.js ou servidor externo para uso comum. | Decidido |
| RNF-02 | O mestre inicia e encerra a sessão pela interface do Obsidian. | Decidido |
| RNF-03 | O plugin deve ser distribuído como uma instalação desktop única, com os componentes necessários empacotados. | Diretriz |
| RNF-04 | Os clientes não podem acessar indiscriminadamente o Vault do mestre; somente recursos autorizados. | Diretriz de segurança |
| RNF-05 | O estado da sessão deve ser mantido coerente entre os clientes, inclusive após desconexões temporárias. | Diretriz técnica |
| RNF-06 | O sistema não deve depender especificamente do Radmin; outras VPNs e LAN devem ser possíveis. | Decidido |
| RNF-07 | Ao encerrar o Obsidian do mestre ou desligar seu computador, a sessão hospedada deixa de estar disponível. | Consequência arquitetural |

## 5. Arquitetura escolhida

**Decisão principal:** utilizar um **plugin Obsidian autossuficiente** escrito em TypeScript, com servidor HTTP/WebSocket embutido no ambiente desktop do Obsidian. Não será necessário um backend Java/Spring Boot separado.

### Componentes lógicos

1. **Plugin Obsidian:** integração com Vault, comandos, menus, interface do mestre e cliente desktop.
2. **Servidor embutido:** hospedado pelo plugin do mestre, disponibiliza recursos web autorizados, autentica participantes e sincroniza estado/eventos via WebSocket.
3. **Cliente de mesa virtual compartilhado:** interface web para mapas, tokens e controles, reaproveitada dentro do Obsidian e no navegador.
4. **Módulo compartilhado:** contratos, modelos, mensagens e validações comuns.

### Stack proposta (não inteiramente fechada)

- **TypeScript:** linguagem principal do plugin e do servidor embutido.
- **JavaScript:** artefato compilado carregado pelo Obsidian.
- **Obsidian API:** acesso a notas, arquivos, comandos e views personalizadas.
- **React:** proposta para interface compartilhada entre plugin e navegador; opcional, não exigência da API.
- **HTTP + WebSocket:** entrega do cliente web e comunicação em tempo real.
- **Biblioteca de renderização de mapas:** a escolher (ex.: PixiJS ou Konva).
- **Radmin VPN ou LAN:** meio de conectividade, sem integração obrigatória com API do Radmin.
- **Markdown e JSON:** candidatos para fichas, metadados, configurações e estado persistido.

**Observação técnica:** o Obsidian Desktop é baseado em Electron. A viabilidade de utilizar APIs de rede do Node.js no plugin deve ser validada com um protótipo e testes de compatibilidade com versões suportadas do Obsidian. A execução de servidor local não deve bloquear a interface.

### Organização sugerida do repositório

```text
obsidian-vtt/
├── packages/
│   ├── plugin/       # Integração Obsidian e ciclo de vida da sessão
│   ├── server/       # HTTP, WebSocket, permissões e estado da sessão
│   ├── client/       # Interface de mesa compartilhada
│   └── shared/       # Tipos, eventos, contratos e validações
└── ...
```

Essa divisão é **lógica e de desenvolvimento**. O objetivo é distribuir um único plugin instalável, não exigir quatro instalações independentes.

## 6. Fluxos de uso previstos

### 6.1 Mestre hospeda uma sessão

1. Abre o Obsidian Desktop com o plugin instalado.
2. Seleciona a campanha e inicia uma sessão pela interface do plugin.
3. O plugin inicia o servidor HTTP/WebSocket local e disponibiliza o endereço acessível na rede escolhida.
4. O mestre escolhe o mapa, configura o grid, posiciona tokens e controla a visualização.
5. Compartilha endereço e credenciais/código de acesso com os jogadores (mecanismo exato a definir).
6. Ao encerrar a sessão, o servidor embutido é desligado.

### 6.2 Jogador entra pelo Obsidian

1. Instala o plugin no Obsidian Desktop.
2. Informa endereço e credenciais da sessão.
3. Visualiza a mesa e interage com os recursos permitidos.
4. Pode abrir e trabalhar com suas notas/fichas locais; a forma de sincronização ainda será definida.

### 6.3 Jogador entra pelo navegador

1. Acessa o endereço HTTP disponibilizado pelo mestre, estando na rede que alcança o host.
2. Recebe a interface web servida pelo plugin do mestre.
3. Participa da mesa sem instalar Obsidian ou runtime adicional.
4. Visualiza apenas os dados que o servidor autorizar.

### 6.4 Movimentação de token

1. Cliente solicita movimentação do token.
2. Servidor do mestre valida a identidade, a permissão e a ação.
3. Servidor atualiza o estado autoritativo da sessão.
4. Servidor publica a alteração para os clientes conectados.
5. Clientes atualizam a renderização do mapa.

## 7. Princípios de segurança e consistência

- O servidor do mestre é a fonte autoritativa do estado compartilhado da sessão.
- O cliente não decide sozinho quais notas, fichas ou recursos privados pode ler.
- Nunca servir o diretório completo do Vault como pasta pública HTTP.
- Usar uma lista explícita de recursos autorizados para compartilhamento.
- Separar dados privados do mestre de dados visíveis aos jogadores.
- Exigir autenticação/autorização para ações e recursos; VPN não substitui permissões da aplicação.
- Tratar entrada recebida pela rede e Markdown compartilhado como conteúdo não confiável.
- Planejar snapshots/ressincronização após reconexão e persistência segura do estado.
- Avaliar a proteção do tráfego e o modelo de confiança da rede antes de uso fora de uma LAN/VPN privada.

## 8. Escopo de desenvolvimento proposto

Estas fases são **propostas**, não compromissos de entrega já aprovados.

### Fase 0 — Prova de viabilidade

- Criar plugin desktop mínimo.
- Iniciar/parar um servidor HTTP/WebSocket a partir do plugin.
- Servir uma página web simples a outro dispositivo na VPN/LAN.
- Conectar simultaneamente um cliente Obsidian e um navegador.
- Validar ciclo de vida, portas, firewall, empacotamento e compatibilidade.

### Fase 1 — MVP multiplayer

- Criar/entrar/encerrar sessão.
- Carregar um mapa.
- Exibir e configurar grid básico.
- Criar e movimentar tokens com sincronização em tempo real.
- Diferenciar mestre e jogador.
- Implementar rolagem de dados básica.
- Controlar visibilidade mínima dos recursos.

### Fase 2 — Integração com a campanha

- Vincular tokens a notas Markdown/fichas.
- Abrir fichas pelo token.
- Definir compartilhamento seguro de fichas.
- Implementar edição/sincronização de fichas conforme modelo a decidir.
- Melhorar permissões, persistência e reconexão.

### Fase 3 — Recursos avançados (candidatos)

- Fog of War e revelação de áreas.
- Camadas e múltiplos mapas.
- Medição de distâncias e efeitos visuais.
- Iniciativa e histórico de rolagens.
- Extensões ou perfis de sistemas de RPG.

## 9. Decisões já tomadas

1. Mestre usa obrigatoriamente Obsidian Desktop e é sempre o host.
2. Jogadores podem utilizar Obsidian Desktop ou navegador.
3. O plugin não será desenvolvido para o Obsidian Mobile.
4. O servidor multiplayer será **embutido no plugin**; não haverá instalação manual de Java/Spring Boot/Node.js para o usuário final.
5. O projeto utilizará TypeScript como linguagem principal de implementação do plugin.
6. O Radmin VPN é uma opção de rede, não dependência rígida.
7. O sistema será genérico em relação às regras de RPG.
8. A integração com arquivos existentes da campanha é parte central do produto.

## 10. Questões abertas para próximas conversas

- Como autenticar jogadores e administrar identidades/permissões?
- Como permitir que jogadores Obsidian editem suas próprias notas sem expor outros arquivos?
- Onde fica a versão canônica de uma ficha compartilhada e como resolver conflitos de edição?
- Como funcionará o acesso web de jogadores que não estejam na mesma VPN?
- Quais formatos de mapa, escala e grid serão suportados inicialmente?
- Como mapear fichas Markdown heterogêneas a tokens sem acoplamento a um sistema?
- Que sintaxe de dados e modificadores será adotada?
- O que persistir entre sessões e onde armazenar esses dados?
- Como distribuir e atualizar o plugin, incluindo dependências empacotadas?
- Quais limites de desempenho, quantidade de jogadores e tamanho de mapas devem ser testados?
- Como lidar com firewall, seleção de interface de rede e conflito de portas?

## 11. Contexto para continuidade do workspace

Este projeto nasceu da ideia de criar um Roll20 integrado ao Obsidian, utilizando Radmin VPN para aproveitar a conexão direta entre os jogadores. Após discussão, foi definido que o mestre sempre será o host e deverá estar no Obsidian Desktop. Os jogadores poderão entrar tanto pelo Obsidian quanto pelo navegador. Jogadores Obsidian poderão trabalhar com suas próprias anotações e fichas. O mestre deverá controlar mapas e grids, associar fichas a tokens e aproveitar os arquivos já existentes da campanha. Haverá rolagem de dados e a ferramenta não dependerá de um sistema específico de RPG.

Foi considerada inicialmente a possibilidade de backend Java/Spring Boot, mas essa ideia foi abandonada como arquitetura inicial para não exigir um ambiente Java nos computadores dos usuários. A direção escolhida é um plugin autossuficiente em TypeScript, com servidor HTTP/WebSocket integrado e cliente web compartilhado. React é uma opção para a interface, não uma exigência do Obsidian.

**Orientação para a próxima etapa:** continuar o levantamento de requisitos e validar primeiro a viabilidade técnica do servidor embutido, sem assumir que decisões ainda abertas já estão fechadas. Priorizar simplicidade de instalação, segurança dos arquivos do mestre, interoperabilidade Obsidian/web e independência de sistema de RPG.
