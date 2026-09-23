---
name: viva-criar-evento
description: Criar eventos anuais aleatórios do VIVA! (LifeEvent com escolhas e consequências encadeadas, flags e humor ácido). Use ao adicionar ou variar eventos em src/game/events.ts.
---

# Criar evento anual (VIVA!)

Spec de referência: `docs/specs/SPEC-01-eventos-e-consequencias.md` · Tom: `docs/specs/SPEC-06-humor-e-tom.md`

## Passos

1. **Escolha o tema e a faixa etária.** Confira em `docs/CATALOGO.md` se já existe algo parecido (não duplique; *varie*).
2. **Desenhe a árvore de consequências antes de codar** (em comentário ou no CHANGELOG):
   ```
   evento: pixErrado (25–70, peso 7)
     A "Pedir de volta educadamente" → 50%: devolvem (+karma) | 50%: bloqueiam (−R$, −felicidade)
     B "Expor no grupo do bairro"    → +fama local, −vínculo com vizinhos; flag pixExposto
     C "Deixar pra lá"               → −R$, +felicidade leve ("paz não tem preço, mas custou R$ 480")
     atrasado: flag pixExposto → evento vizinhoVinganca (aos +1..3 anos)
   ```
3. **Escreva o evento** no fim do array `EVENTS` em `src/game/events.ts`, usando os helpers já importados:
   `O(texto, tom, extra)`, `stat`, `bond`, `addLog`, `rng`, `pickRandom`, `parents`, `partner`, `friends`, `children`, `byRel`, `money`, `he`.
4. Cada escolha:
   - muda algo real (stat/bond/dinheiro/karma/flag/relação);
   - tem cena quando há ação visível (`scene: { id, others: [pessoa], data }` — ids no CATALOGO);
   - usa `react` para a reação do NPC/jogador depois da cena (ninguém sorri depois de sofrer);
   - usa `next` para consequência em cadeia e `mood` quando pesa;
   - tem sorteio quando é arriscada (`rng.chance(0.3 + L.stats.x / 200)`).
5. **Consequência atrasada**: grave `L.flags.<nome> = L.player.age` e crie o evento de retorno com
   `cond: (L) => L.flags.<nome> !== undefined && L.player.age - (L.flags.<nome> as number) >= 1`. Depois do retorno, limpe
   (`delete L.flags.<nome>`) ou marque `once`.
6. Registre flags novas na tabela da SPEC-01.
7. Rode `npm run check:quick`. Leia os **avisos de cobertura**: se o seu evento "nenhum perfil alcançou", a `cond` está
   restritiva demais ou depende de algo que os perfis de teste não têm — ajuste ou explique no CHANGELOG.

## Armadilhas
- `setup`/`cond`/`text` não podem alterar estado.
- `c.person!` só é seguro se `setup` garantiu a pessoa (retorne `null` se não houver).
- Não use peso ≥ 100 (obrigatório) nem `Math.random`.
- Texto de resultado com interpolação: teste mentalmente com nome curto e longo; nada de `undefined`.
- Variações: para o mesmo tema, crie 2–3 desfechos por escolha com `rng.pick([...])` de frases — aumenta rejogabilidade.
