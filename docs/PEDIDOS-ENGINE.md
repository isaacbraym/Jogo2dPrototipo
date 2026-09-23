# Pedidos de engine (zona vermelha)

Fila de pedidos dos agentes de conteúdo para o agente de lógica (Claude). **Não implemente estes itens se você for agente de conteúdo.**
Formato:

```md
### [ABERTO] Título curto
- **Quem pediu / quando:** Luna, 2026-09-24
- **Problema:** o que não dá para fazer com o motor atual.
- **Proposta:** o que precisaria existir (campo, função, parâmetro).
- **Conteúdo que depende disso:** ids/ideias bloqueadas.
```
Quando atendido: troque `[ABERTO]` por `[FEITO 2026-xx-xx]` e cite o commit.

---

### [ABERTO] Balão de fala escondido atrás do HUD com cartão aberto
- **Quem pediu / quando:** Claude, 2026-09-23 (notado em teste)
- **Problema:** com o cartão aberto a câmera sobe e o balão de quem está falando pode ficar sob a barra superior.
- **Proposta:** limitar o y do balão à área visível (abaixo do HUD) em `actor.ts`/`scene.ts`.

### [ABERTO] Memória de NPC (rancor/gratidão)
- **Quem pediu / quando:** Claude, 2026-09-23 (backlog H)
- **Proposta:** `Person.memo?: Record<string, number>` com helpers `remember(p, chave, valor)` / `recall(p, chave)`, migração de save.
- **Conteúdo que depende disso:** retornos de agressão, favores, vinganças personalizadas.

### [ABERTO] Vícios persistentes
- **Proposta:** `L.addictions: { tipo, nivel, desde }[]` + efeitos anuais em `ageUp` + eventos de recaída.
