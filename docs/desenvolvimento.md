# Desenvolvimento

## Ambiente

- Node.js 24 e npm
- Obsidian Desktop 1.14.4 ou superior
- Nenhum Docker ou serviço externo no protótipo atual

Instale as dependências uma vez:

```sh
npm ci
```

No PowerShell, use `npm.cmd` caso a política de execução bloqueie `npm.ps1`.

## Comandos

| Comando | Resultado |
| --- | --- |
| `npm run dev` | Observa fontes e recompila o plugin |
| `npm run check` | Verifica os tipos sem gerar arquivos |
| `npm test` | Executa os testes automatizados |
| `npm run build` | Verifica os tipos e gera o bundle |

O build escreve `main.js`, `manifest.json` e `styles.css` em `sandbox-vault/.obsidian/plugins/obsidian-vtt/`. Edite sempre os arquivos-fonte; o bundle do sandbox é gerado.

## Validação automatizada

Antes de concluir mudança de código, execute:

```sh
npm run build
npm test
```

Os testes cobrem:

- domínio de sessão, admissão, credenciais e expiração;
- coordenação da hospedagem e ciclo de vida;
- rotas HTTP, cookies e WebSocket reais em loopback;
- campanhas, persistência concorrente e transferência ZIP;
- regras puras do layout dos painéis;
- comandos e tratamento das falhas esperadas.

Use `git diff --check` para detectar espaços inválidos. Testes automatizados não substituem inspeção visual no Obsidian.

## Roteiro manual

Abra `sandbox-vault` como cofre e habilite **VTT de laboratório** em **Configurações → Plugins da comunidade**. Após recompilar, recarregue ou desative e ative o plugin.

### Sessão

1. Abra **Mesa** pela paleta ou pelo ícone lateral.
2. Crie uma sessão informando a capacidade.
3. Em **Convidar e gerenciar**, copie endereço e convite.
4. No navegador, solicite entrada; no Obsidian, aprove a solicitação.
5. Verifique reconexão, logout, remoção e encerramento da sessão.

### Campanha

1. Crie uma campanha e cenas; renomeie e remova uma delas.
2. Reabra o `campanha.yaml` pelo seletor.
3. Exporte o ZIP, importe como outra campanha e compare os arquivos.
4. Verifique que uma pasta existente não é sobrescrita.

### Mesa

1. Mova, oculte e restaure cada painel.
2. Redimensione as laterais e a área inferior.
3. Feche e reabra a mesa para conferir a persistência do layout.
4. Confira o comportamento em uma aba estreita.

Registre separadamente o que foi validado por comando e o que foi observado visualmente.

## Manutenção do contexto

Atualize o README para mudanças de produto, este arquivo para comandos e verificação, [arquitetura.md](arquitetura.md) para limites duradouros e [api-sessao.md](api-sessao.md) para alterações do protocolo. Evite criar diários, planos já concluídos ou documentos que apenas repetem essas fontes.
