# Contexto de trabalho — Obsidian VTT

Plugin de mesa virtual para Obsidian Desktop, com servidor embutido e futuro acesso de jogadores por navegador ou plugin. O produto é independente de sistema de RPG e deve preservar os arquivos privados do mestre.

## Como encontrar contexto

- [README](README.md): visão, escopo do produto, estado atual e limites de simplicidade.
- [Arquitetura](docs/arquitetura.md): módulos, dependências e decisões vigentes.
- [Desenvolvimento](docs/desenvolvimento.md): comandos, testes e roteiro manual.
- [API de sessão](docs/api-sessao.md): admissão, identidade, cookies, HTTP e WebSocket.

## Regras essenciais

- Preserve a independência de domínio e aplicação em relação a Obsidian, DOM, HTTP e WebSocket. Conecte dependências de ambiente na composição do plugin.
- Valide invariantes no núcleo; a validação da interface é complementar. Mensagens externas precisam de validação em runtime.
- Mantenha o estado de sessão por instância. Identidade de sessão não é credencial de acesso.
- O protótipo usa loopback e não compartilha o vault. Admissão e autenticação locais estão implementadas; consulte o contrato em docs/api-sessao.md. Acesso LAN/VPN protegido e permissões dos recursos da mesa continuam pendentes.
- Ao criar recursos, defina também seu encerramento, inclusive em falhas e durante a desativação do plugin.
- Reutilize as soluções existentes quando adequadas. Introduza abstrações para responsabilidades concretas, com motivo explícito.
- Preserve alterações locais alheias à tarefa. Edite fontes, não bundles gerados no sandbox.

## Validação e manutenção

- Para mudanças de código, execute a verificação de tipos e testes pertinentes; valide o build quando afetar integração ou empacotamento. Comandos em [desenvolvimento](docs/desenvolvimento.md).
- Em mudanças apenas documentais, confira links locais, caminhos, comandos e coerência com o código; não é necessário executar o plugin.
- Atualize o documento vivo do assunto junto com mudanças de comportamento ou limites arquiteturais. Não crie diários de implementação ou documentos históricos para decisões já incorporadas.
- Se código e especificação divergirem, identifique a divergência: código descreve o comportamento atual; requisitos aprovados descrevem o esperado. Não altere requisitos silenciosamente para justificar um bug.
- Ao concluir, informe o que mudou, o que foi verificado e o que continua pendente. Não trate teste automatizado como validação visual no Obsidian.
