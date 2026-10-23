# Mapa de contexto

Esta documentação permite encontrar as regras, decisões e evidências necessárias a cada tarefa. O ponto de entrada para agentes é o [AGENTS.md](../../AGENTS.md). Os outros arquivos são referências consultadas conforme o assunto; criar um Markdown não faz com que seu conteúdo seja carregado automaticamente.

## Roteamento por tarefa

| Ao trabalhar em… | Ler | Inspecionar |
| --- | --- | --- |
| Escopo e situação do produto | [README](../../README.md), [proposta original](../proposta-original.md) | `manifest.json`, `package.json` |
| Organização e dependências | [Arquitetura](arquitetura.md), [decisões](../decisoes/README.md) | `src/main.ts` e módulos envolvidos |
| Sessão, capacidade, entrada ou identidade | [Requisitos de sessão](../requisitos-sessao.md), [padrões](padroes.md) | `src/domain/session.ts`, `src/application/session-service.ts`, `tests/session.test.mjs` |
| HTTP, WebSocket ou mensagens | [Arquitetura](arquitetura.md), [padrões](padroes.md); requisitos de sessão se houver admissão | `src/server/`, `src/shared/protocol.ts`, testes de servidor e protocolo |
| Interface e comandos | [Padrões](padroes.md), [desenvolvimento](desenvolvimento.md) | `src/ui/`, `src/commands/`, `src/client/` |
| Testes ou empacotamento | [Desenvolvimento](desenvolvimento.md) | `tests/`, `build/`, `esbuild.config.mjs`, `package.json` |

## Papel de cada documento

- **README do projeto:** entrada para pessoas, instalação, estado e próximos passos.
- **Requisitos:** comportamento esperado e critérios de aceitação; indicar separadamente o que já está implementado.
- **Arquitetura:** responsabilidades, dependências e fluxos atuais.
- **Padrões:** orientação prática, alternativa a evitar, motivo e referência verificável.
- **Decisões:** escolhas duradouras, contexto e consequências.
- **AGENTS.md:** instruções essenciais e indicação de onde buscar detalhes.

## Como manter útil

1. Mantenha cada regra detalhada em um lugar e use links nos demais.
2. Atualize o documento do assunto quando uma alteração mudar seu contrato. Não registre cada edição ou conversa como memória permanente.
3. Separe explicitamente implementação atual, requisito aprovado e proposta em avaliação.
4. Registre aprendizados quando evitarem uma falha recorrente ou explicarem uma restrição difícil de deduzir. Inclua evidência ou teste; não invente histórico de bugs.
5. Crie documentos por subsistema quando houver conteúdo próprio suficiente. Mapas, tokens e iluminação ainda não precisam de manuais de implementação.
6. Regras verificáveis mecanicamente podem evoluir para testes ou lint. Hoje não há verificação automática das fronteiras entre camadas; a documentação não substitui essa proteção.

Exemplo de tarefa: “Alterar criação de sessão” leva aos requisitos, domínio, serviço e testes de sessão. Só exige consultar transporte quando a alteração também integrar hospedagem.
