# Contexto de trabalho — Obsidian VTT

Plugin de mesa virtual para Obsidian Desktop, com servidor embutido e futuro acesso de jogadores por navegador ou plugin. O produto é independente de sistema de RPG e deve preservar os arquivos privados do mestre.

## Como encontrar contexto

- Consulte [o índice de contexto](docs/contexto/README.md) e leia os documentos relacionados à tarefa antes de alterar código. Não é necessário carregar toda a documentação.
- Para limites entre módulos, leia [arquitetura](docs/contexto/arquitetura.md); para formas de implementar, [padrões e antipadrões](docs/contexto/padroes.md).
- Para comandos e evidências de validação, leia [desenvolvimento](docs/contexto/desenvolvimento.md).
- Para capacidade, admissão, identidade e reconexão, leia [requisitos de sessão](docs/requisitos-sessao.md), distinguindo decisões aprovadas de implementação atual.

## Regras essenciais

- Preserve a independência de domínio e aplicação em relação a Obsidian, DOM, HTTP e WebSocket. Conecte dependências de ambiente na composição do plugin.
- Valide invariantes no núcleo; a validação da interface é complementar. Mensagens externas precisam de validação em runtime.
- Mantenha o estado de sessão por instância. Identidade de sessão não é credencial de acesso.
- O protótipo usa loopback e não compartilha o vault. Acesso LAN/VPN, autenticação e admissão são trabalho futuro; não os apresente como prontos.
- Ao criar recursos, defina também seu encerramento, inclusive em falhas e durante a desativação do plugin.
- Reutilize as soluções existentes quando adequadas. Introduza abstrações para responsabilidades concretas, com motivo explícito.
- Preserve alterações locais alheias à tarefa. Edite fontes, não bundles gerados no sandbox.

## Validação e manutenção

- Para mudanças de código, execute a verificação de tipos e testes pertinentes; valide o build quando afetar integração ou empacotamento. Comandos em [desenvolvimento](docs/contexto/desenvolvimento.md).
- Em mudanças apenas documentais, confira links locais, caminhos, comandos e coerência com o código; não é necessário executar o plugin.
- Atualize a documentação afetada junto com mudanças de comportamento ou limites arquiteturais. Registre decisões duradouras em [decisões](docs/decisoes/README.md), sem transformar hipóteses em decisões aprovadas.
- Se código e especificação divergirem, identifique a divergência: código descreve o comportamento atual; requisitos aprovados descrevem o esperado. Não altere requisitos silenciosamente para justificar um bug.
- Ao concluir, informe o que mudou, o que foi verificado e o que continua pendente. Não trate teste automatizado como validação visual no Obsidian.
