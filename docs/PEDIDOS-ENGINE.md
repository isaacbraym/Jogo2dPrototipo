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

### [ABERTO] Tipos de relação para família ampliada
- **Quem pediu / quando:** Codex, 2026-09-23
- **Problema:** `Rel` não inclui tia, sogro/sogra nem neto/neta. Os novos eventos identificam algumas pessoas por flags, mas a lista de relações as mostra como conhecidas e não pode consultá-las como parentes.
- **Proposta:** adicionar `tia`, `sogro`, `sogra`, `neto` e `neta` a `Rel` e `REL_LABEL`, com persistência e migração de saves.
- **Conteúdo que depende disso:** `tiaPerguntaNamoro`, `sograMoraJunto`, `netoSoLigaNoPix`, `aprenderCelularComNeto`, e o registro persistente do evento `netos`.

### [ABERTO] Reputação separada por contexto
- **Quem pediu / quando:** Backlog H, Codex, 2026-09-23
- **Problema:** karma não representa como a pessoa é vista no bairro e no trabalho; usar a mesma escala mistura situações diferentes.
- **Proposta:** persistir reputação de bairro e de trabalho, com limites e helpers próprios para ajustar/consultar valores.
- **Conteúdo que depende disso:** retorno de favores e conflitos de vizinhança, confiança de colegas e reações a escolhas profissionais.

### [ABERTO] Condições crônicas de saúde
- **Quem pediu / quando:** Backlog H, Codex, 2026-09-23
- **Problema:** o estado de saúde atual não guarda diagnósticos duradouros com efeitos anuais e tratamento.
- **Proposta:** adicionar condições persistentes com diagnóstico, progressão/controle anual, custos de tratamento e migração de saves.
- **Conteúdo que depende disso:** pressão alta, diabetes, acompanhamento médico e a ideia de cirurgia negada pelo plano de saúde.

### [ABERTO] Notícias de mundo com efeito anual
- **Quem pediu / quando:** Backlog H, Codex, 2026-09-23
- **Problema:** eventos do mundo não alteram de forma compartilhada a economia, a saúde ou a vida dos personagens.
- **Proposta:** modelar modificadores anuais comuns, determinísticos por ano e persistidos no save, para eventos genéricos sem referência a pessoas ou marcas reais.
- **Conteúdo que depende disso:** crise econômica genérica e outros acontecimentos coletivos que influenciam escolhas e resultados de todos.
