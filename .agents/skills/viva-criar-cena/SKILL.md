---
name: viva-criar-cena
description: Criar situações animadas (cenas roteirizadas com Director) no VIVA! — atores, falas, câmera, efeitos e reações coerentes. Use ao adicionar cenas em src/scenes/situations.ts ou novas ações em physical().
---

# Criar cena / situação (VIVA!)

Spec: `docs/specs/SPEC-02-cenas-e-direcao.md` · Nomes disponíveis: `docs/CATALOGO.md`

## Passos

1. **Roteiro em 3 tempos** (escreva em comentário acima da cena, 1 linha): estabelecer → ação → reação.
2. **Escolha o ambiente** que existe de verdade para aquilo (lista no CATALOGO). Se nenhum servir, use a skill
   `viva-criar-ambiente` primeiro. Para cenas que acontecem em vários lugares: `env: (c) => c.data?.env ?? 'sala'`.
3. **Monte no fim do array `S`** em `src/scenes/situations.ts`:
   ```ts
   // Vizinho ligando a furadeira domingo às 7h.
   {
     id: 'furadeiraDomingo',
     env: 'sala',
     run: async (d, c) => {
       const p = P(d, c, 460, { facing: 1, motion: 'deitado', z: 1 });   // jogador
       d.caption('Domingo, 7h02', 'O vizinho acordou inspirado', 2.4);
       d.shake(4); d.sfx('engine');
       await d.wait(0.8);
       d.loop(p, 'furia'); d.expr(p, 'furioso'); d.emote(p, 'raiva');
       await d.say(p, 'É DOMINGO, CRIATURA!', 1.6, 'grito');
       d.shake(6);
       await d.wait(1);
     },
   },
   ```
4. **Reações**: toda ação com impacto precisa de reação do outro lado (`dor`, `chocado`, `chorando`, `humilhado`...).
   Quem agride termina `ofegante`/`serio`/`bravo` — nunca `feliz`.
5. **Pessoas**: use `other(c, 0, seedFixa, sexo?, idade?)` para o NPC principal (funciona sem `others`), `crowd(...)` para figurantes.
6. **Ação física reutilizável?** Se a interação corporal pode servir para várias cenas, crie um `case` novo em `physical()`
   (antes do bloco `// === situações`) e use via cena `interacao` com `data.action`.
7. **Ligue a cena** a um evento/ação/interação (`scene: { id: 'furadeiraDomingo' }`) — cena solta não aparece no jogo.
8. **Teste visual** (com `npm run dev`): `http://localhost:5199/?test&sit=furadeiraDomingo&age=30&at=3`
   (mude `at` para congelar em momentos diferentes; teste idade 10 e 70 também). Sem navegador? Rode `npm run check:quick`
   e descreva no CHANGELOG que a verificação visual ficou pendente.

## Armadilhas
- Coordenadas fora de 180–1100 cortam personagens. Dois atores no mesmo x se sobrepõem.
- Laços de fundo precisam checar `d.sc.alive`.
- `c.data?.x` sempre com valor padrão.
- Duração alvo 4–9 s. Mais que isso cansa (o jogador vê centenas de cenas).
