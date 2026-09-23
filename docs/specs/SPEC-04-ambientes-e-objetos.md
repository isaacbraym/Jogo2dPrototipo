# SPEC-04 — Ambientes (Env) e objetos (props)

## 1. Ambiente — `src/scenes/environments.ts`

```ts
// Lotérica lotada no dia de pagamento.
const loterica: Env = {
  id: 'loterica', name: 'Lotérica', mood: 'tense',          // mood: calm | happy | sad | tense (trilha)
  layers: [
    { depth: 0.3, static: (ctx) => { /* fundo distante com parallax */ } },   // opcional
    {
      depth: 1,                                              // plano dos personagens
      static: (ctx) => { wall(ctx, '#e9e4d4', 'azulejo'); floor(ctx, 'piso', '#d8d8d0'); /* balcões, cartazes */ },
      anim: (ctx, t) => { /* luz piscando, ventilador girando: barato! */ },
    },
    { depth: 1.15, front: true, static: (ctx) => { /* primeiro plano opcional (planta, grade) */ } },
  ],
  ambient: (p, dt, t, view) => { /* partículas contínuas: chuva, poeira... opcional */ },
  tint: { col: '#ffcf8a', a: 0.06 },                          // opcional
  vignette: 0.25,                                              // opcional
};
```
Depois registre o id no objeto `ENVS` no fim do arquivo.

### Regras
- Desenhe de `X0` (−420) até `X0 + WW` (1700) na largura para não aparecer borda com o parallax/zoom.
- Parede até `FLOOR` (560), chão de 560 para baixo. Personagens pisam em `GROUND` (632).
- `static` roda **uma vez** (cacheado): pode ter detalhe. `anim` roda **todo quadro**: no máximo ~20 formas simples.
- Deixe a faixa x 250–1030, y 250–630 relativamente limpa: é onde os personagens atuam (nada de alto contraste atrás dos rostos).
- Paleta: cores dessaturadas no fundo, mais saturadas perto. Contorno escuro colorido (não preto puro), como o resto do jogo.
- Texto no cenário (placas, cartazes) = humor de ambiente: "LEVE 3 PAGUE 3", "NÃO ACEITAMOS FIADO — NEM DO PADRE".
  **Marcas fictícias** sempre.

### Helpers de `render/bg.ts`
`sky(ctx, 'dia'|'tarde'|'noite'|'nublado'|'amanhecer')`, `sun`, `moon`, `clouds(ctx, t, seed, n, y0, y1)`, `hills`, `mountains`,
`skyline(ctx, y, cor, seed, luzes)`, `treeRow`, `pines`,
`wall(ctx, cor, 'liso'|'listras'|'bolinhas'|'losangos'|'tijolos'|'azulejo'|'painel'|'estrelas'|'concreto'|'madeira', cor2?)`,
`floor(ctx, 'madeira'|'piso'|'carpete'|'grama'|'areia'|'calcada'|'concreto'|'borracha'|'palco'|'terra'|'xadrez', cor)`,
`windowFrame(ctx, x, y, w, h, céu, t, {city, curtains, frame})`, `lightShaft`, `frameArt`, `clock`, `shelf`, `glow`, `lampPendant`.
De `render/props.ts`: `box(ctx, x, y, w, h, raio, cor, {line, top, lw})` e qualquer objeto via `P('mesa', ctx, x, y)` dentro do arquivo.

## 2. Objeto de cena — `PROPS` em `src/render/props.ts`

```ts
// Orelhão quebrado (rua).
orelhao: (ctx, t, o) => {
  // origem (0,0) = ponto no chão, centro do objeto. Desenhe para CIMA (y negativo).
  ctx.save();
  if (o.flip) ctx.scale(-1, 1);
  box(ctx, -4, -150, 8, 150, 2, '#8a8f98');
  // ...
  ctx.restore();
},
```
- `PropOpts`: `color`, `color2`, `state` (0..1: aceso/aberto), `flip`, `variant`. Escala/rotação/transparência ficam na cena:
  `d.prop(id, x, y, { scale, z, alpha, front, opts })` — o motor aplica `translate/rotate/scale` antes de chamar o desenho.
- Sempre `ctx.save()`/`ctx.restore()` se mudar transformações ou estilos.
- Usado na cena com `d.prop('orelhao', x, GROUND, { z: -1, opts: { color: '#2f6fd9' } })`.
- Animação interna só com `t` (segundos). Nada de estado global.

## 3. Objeto de mão — `HELD` em `src/render/props.ts`

```ts
marmita: { follow: true, off: { x: 0, y: 4 }, draw: (ctx, t, near) => { box(ctx, -12, -8, 24, 16, 4, '#c0c4cc'); } },
```
- `follow: true` gira junto com a mão (ferramentas); `false` fica de pé (copos, xícaras).
- Origem = palma da mão. Tamanho coerente com a mão (~20–40 px).
- Use no movimento (`propN: 'marmita'`) ou na cena (`ator.propN = 'marmita'`).

## 4. Checklist
- [ ] Registrado (`ENVS` / `PROPS` / `HELD`), id único.
- [ ] Harness: `?test&env=<id>&n=3` — personagens legíveis na frente do fundo, sem borda aparecendo.
- [ ] Sem queda de desempenho perceptível (anim leve).
- [ ] Marcas e nomes fictícios.
