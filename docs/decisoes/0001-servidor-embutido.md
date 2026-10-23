# 0001 — Servidor HTTP/WebSocket embutido no plugin

**Registro:** 20/10/2026.  
**Situação:** decisão existente, registrada retrospectivamente.  
**Fonte:** [proposta original de 15/10/2026, seção 5](../proposta-original.md).

## Contexto

O mestre usa Obsidian Desktop, os jogadores devem poder acessar por navegador ou plugin e o uso comum não deve exigir instalação separada de runtime ou servidor. A distribuição deve funcionar sem hospedagem em nuvem.

## Decisão

Usar TypeScript com servidor HTTP/WebSocket embutido no plugin do mestre. Manter a integração com o Obsidian separada das regras de domínio e dos casos de uso.

## Alternativa documentada

A proposta original descarta um backend Java/Spring Boot separado. Este registro não pressupõe avaliação prévia de outras alternativas.

## Consequências

- Uma instalação do plugin entrega a hospedagem; Node.js é ferramenta de desenvolvimento, não instalação adicional exigida do usuário final.
- A disponibilidade da mesa depende do Obsidian e do computador do mestre.
- Encerramento de recursos e impacto na responsividade do Obsidian fazem parte da implementação.
- Compartilhamento de recursos exige controle de acesso; servidor embutido não implica acesso irrestrito ao vault.

## Estado verificado no registro

[LocalServer](../../src/server/local-server.ts) e [WebSocket](../../src/server/websocket-server.ts) implementam o protótipo em loopback, com ping/pong. LAN/VPN, admissão, autenticação e capacidade multiplayer ainda dependem da evolução descrita em [requisitos de sessão](../requisitos-sessao.md).
