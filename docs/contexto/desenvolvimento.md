# Desenvolvimento e evidências

Comandos definidos em [package.json](../../package.json). Instalação e uso do sandbox estão no [README](../../README.md).

## Verificações por alteração

| Alteração | Verificação |
| --- | --- |
| Documentação | Conferir links, caminhos e afirmações nas fontes; sem necessidade de build |
| Domínio/aplicação | `npm run check` e `node --test tests/session.test.mjs` |
| Protocolo | `npm run check` e `node --test tests/protocol.test.mjs`; testes de servidor se mudar o contrato de transporte |
| Servidor, cliente ou ciclo de vida | `npm run check` e `npm test`; `npm run build` se afetar integração/empacotamento |
| Interface/comandos do plugin | `npm run build`, testes do comportamento afetado e verificação manual no Obsidian |

`npm run build` já executa a verificação de tipos. Não é necessário repetir `check` quando o mesmo código acabou de passar pelo build. No PowerShell, use `npm.cmd` se a política bloquear `npm.ps1`. Os testes usam o runner nativo de Node; a referência de desenvolvimento é Node.js 24.

## O que os testes mostram

- [Sessão](../../tests/session.test.mjs): invariantes, duplicação, identidade injetada, falhas, imutabilidade e isolamento; importa TypeScript diretamente.
- [Protocolo](../../tests/protocol.test.mjs): validação e interpretação das mensagens.
- [Servidor](../../tests/local-server.test.mjs): compila o servidor isolado com esbuild e usa HTTP/WebSocket reais, sem abrir o Obsidian.

Novos testes devem verificar comportamento observável e falhas relevantes. Não apresentar testes de servidor como prova de funcionamento visual ou de capacidade multiplayer.

## Verificação manual da criação de sessão

No sandbox com o plugin recompilado e reativado, verificar: abrir formulário, rejeitar vazio/zero/negativo/fracionário, criar com capacidade válida por botão ou Enter, consultar sessão, recusar segunda criação, cancelar sem criar e fechar o modal ao desativar o plugin. A sessão em memória é descartada na reativação.

Registrar quais cenários foram realmente executados. Se o Obsidian não estiver disponível, informar a pendência em vez de afirmar validação visual.

## Empacotamento

[esbuild.config.mjs](../../esbuild.config.mjs) gera o plugin em `sandbox-vault/.obsidian/plugins/obsidian-vtt/`. [client-assets.mjs](../../build/client-assets.mjs) compila o cliente para navegador e o inclui como texto no bundle do servidor. Edite as fontes, não os arquivos gerados.

O modo `dev` recompila, mas não verifica tipos nem recarrega automaticamente o plugin. Reative o plugin depois do build; alterações no manifesto exigem reiniciar o build de desenvolvimento e reabrir o Obsidian.
