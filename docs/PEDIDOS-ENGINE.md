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

### [FEITO 2026-09-24] Memória de NPC (rancor/gratidão)
- **Atendido:** `Person.memo` (rancor, medo, gratidão, confiança, agressões, desculpas, promessas quebradas, fatos) em `src/game/relacoes.ts`, com `lembrar`, `mem`, `reacao`, `chanceDesculpas`, `encerrarRelacao`; decaimento anual; opcional no save. Documentado em `docs/RELACIONAMENTOS.md`.
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

### [ABERTO] Profundidade de desenho entre partes de personagens
- **Quem pediu / quando:** Codex, a partir do teste de QA, 2026-09-24
- **Problema:** `scene.ts` ordena atores inteiros por `z`/`y`; `character.ts` desenha todas as partes internas em uma ordem fixa. Não é possível desenhar o pé/perna do agressor entre a perna distante e a perna próxima da vítima, como o impacto do chute exige.
- **Proposta:** permitir ordem de desenho por partes com pontos de camada controlados pela cena/pose (ao menos perna distante, tronco/cabeça, perna próxima e membros do agressor), mantendo ordenação determinística, sombras e objetos existentes. Expor no painel um identificador/campo de camada por parte para inspeção e comparação.
- **Conteúdo que depende disso:** ramo `kind === 'chute'` da cena oficial `agressao`.

### [ABERTO] Contato do corpo caído com o chão
- **Quem pediu / quando:** Codex, a partir do teste de QA, 2026-09-24
- **Problema:** movimentos com `grounded: false` e rotação do corpo não têm ancoragem automática do ponto de contato; valores fixos de `y` podem deixar cabeça/tronco suspensos ou afundados conforme idade e proporções do personagem.
- **Proposta:** adicionar âncora de contato no chão para poses rotacionadas, calculada a partir dos pontos inferiores do corpo/rig e das dimensões do ator, permitindo manter o corpo apoiado durante animação e loop final sem deslocamentos bruscos.
- **Conteúdo que depende disso:** movimentos `impactoChuteQA4` e `caidoChuteQA4` usados pela cena oficial `agressao`.
