---
name: viva-criar-ambiente
description: Criar ambientes (cenários vetoriais com camadas e parallax) e objetos de cena/de mão no VIVA!. Use ao adicionar Env em src/scenes/environments.ts ou PROPS/HELD em src/render/props.ts.
---

# Criar ambiente ou objeto (VIVA!)

Spec: `docs/specs/SPEC-04-ambientes-e-objetos.md`

## Ambiente
1. Pense no lugar **brasileiro e específico**: lotérica, rodoviária, feira livre, posto de gasolina, salão de beleza, igreja genérica,
   repartição pública, academia de bairro, lan house, quadra de várzea, ponto de ônibus, UPA, cartório.
2. Copie a estrutura de um ambiente parecido (ex.: `mercado`, `boteco`, `cafeteria`) e crie `const lugar: Env = {...}` antes do `ENVS`.
3. Camada `depth: 1` com `static` (parede com `wall`, chão com `floor`, móveis com `box`/`P('prop', ...)`) e, se quiser, `anim` leve.
4. Cartazes e placas com humor ("SENHA 23 — ATENDENDO A 4", "FIADO SÓ AMANHÃ") e **nomes fictícios**.
5. Registre em `ENVS` (fim do arquivo).
6. Visual: `http://localhost:5199/?test&env=<id>&n=3&ages=10,30,70` — rostos legíveis, sem borda aparecendo ao lado.
7. Use o ambiente em pelo menos uma cena ou entrevista.

## Objeto de cena (`PROPS`) e de mão (`HELD`)
1. Origem (0,0) no chão/centro (cena) ou na palma (mão). Desenhe para cima (y negativo).
2. `ctx.save()`/`ctx.restore()` ao mudar transformações. Suporte `o.flip` e `o.color` quando fizer sentido.
3. Registre com id único; use na cena com `d.prop('id', x, GROUND, { z, opts })` ou no movimento (`propN: 'id'`).

## Armadilhas
- Nada de imagens externas, fontes novas ou bibliotecas: tudo é Canvas 2D.
- `anim` pesado derruba o FPS no celular: poucas formas por quadro.
- Não mexa em `render/bg.ts`/`draw.ts` (zona vermelha) — use os helpers como estão.
