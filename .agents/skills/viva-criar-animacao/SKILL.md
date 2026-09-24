---
name: viva-criar-animacao
description: Criar movimentos (Motion) e expressões faciais novos para os personagens do VIVA! usando os ossos existentes (coluna em 2 segmentos, pescoço, ombros, punhos, quadril). Use ao adicionar animações em src/character/motions.ts ou expressions.ts.
---

# Criar animação / expressão (VIVA!)

Spec: `docs/specs/SPEC-03-animacao-rig-expressoes.md` (tabela de ossos e faixas seguras)

## Passos

1. Confira no CATALOGO se já existe algo parecido (ex.: `dor`, `humilhado`, `ofegante`). Prefira **compor** a duplicar.
2. Decida: **loop** (estado: sentar triste, torcer) ou **ação** (`loop: false`, `dur`: golpe, tropeço).
3. Crie um bloco novo no **fim** de `src/character/motions.ts`:
   ```ts
   // ---- lote Luna 01: vida de escritório
   Object.assign(MOTIONS, {
     // Espreguiçar na cadeira depois de 3h de planilha.
     espreguicar: {
       loop: false, dur: 1.6,
       fn: keyframes([
         [0,   { chest: 0.1, armN: L(0.2, 0.4), armF: L(0.1, 0.4) }],
         [0.6, { chest: -0.3, lean: -0.1, head: -0.25, shrugN: 0.5, shrugF: 0.5, armN: L(2.9, 0.3), armF: L(3.0, 0.3), handN: 'aberta' }, Ease.outQuad],
         [1.1, { chest: -0.32, lean: -0.12, head: -0.3, shrugN: 0.55, shrugF: 0.55, armN: L(3.0, 0.2), armF: L(3.05, 0.2) }],
         [1.6, { chest: 0.05, armN: L(0.1, 0.3), armF: L(-0.05, 0.3) }, Ease.inOutSine],
       ]),
       expr: 'cansado',
     },
   } as Record<string, Motion>);
   ```
4. **Princípios**: antecipação → ação → acompanhamento; o tronco (`chest`, `lean`, `hipTilt`) lidera, braços seguem;
   `neck` e `head` com atraso; loops com `breathe(p, t)`; ação termina perto da pose de descanso.
5. **Expressão nova** (se precisar) em `EXPRESSIONS` (`expressions.ts`) com `E({...})`. Sofrimento nunca com `smile > 0`.
6. **Verifique**:
   - `npm run check:quick` (pose finita em toda a duração; expressão/objeto de mão existentes).
   - Visual: `http://localhost:5199/?test&env=sala&n=3&ages=8,30,75&m=espreguicar&def=1` — criança, adulto e idoso.
7. Use o movimento em alguma cena/interação (senão ele não aparece no jogo) e liste no CHANGELOG.

## Dois personagens se tocando
Abraço, beijo, tapa, soco, empurrão, aperto de mão, toca-aqui, presente, consolar e massagem **não** são movimentos soltos:
use `physical(...)`, `golpear(...)` ou `maoAte(...)` e leia `docs/specs/SPEC-07-contato-entre-personagens.md` (§8 e §10 têm
as regras: braço F × N, distâncias pela largura dos corpos, reação no impacto, antecipação → ação → acompanhamento).
Nunca "encoste" atores com offsets fixos ou `moveActor`; braço apontado no ar na direção do outro é bug. Contato novo
(dança a dois, colo) é pedido de engine. Poses deitadas (`grounded: false` + rotação) são apoiadas no chão pelo motor.

## Armadilhas
- `b` (cotovelo/joelho) negativo quebra a articulação.
- Sentado precisa de `sit(p)` e, na cena, de uma `cadeira`/`banco` embaixo.
- Deitado/caído: `grounded: false` + `rot ±1.52` + `y ≈ 46`.
- Não edite `rig.ts`/`character.ts`/`actor.ts`. Precisa de osso novo? Peça em `docs/PEDIDOS-ENGINE.md`.
