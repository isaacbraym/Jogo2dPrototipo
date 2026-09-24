# SPEC-03 — Animação: movimentos (Motion) e expressões (Face)

O esqueleto é **zona vermelha** (`rig.ts`, `character.ts`, `actor.ts`); criar movimentos e expressões novos é **zona verde**.

## 1. Ossos da Pose (ângulos em radianos)

| campo | o que faz | faixa segura |
|---|---|---|
| `x`, `y` | desloca a pelve (px). `y` + = abaixa | x ±20 · y −30..60 |
| `rot` | gira o corpo todo em torno da pelve (deitar/cair) | −1,6..1,6 |
| `hipTilt` | inclinação lateral do quadril (rebolado, peso numa perna) | −0,6..0,6 |
| `lean` | inclina a lombar (+ = para frente) | −0,5..0,8 |
| `chest` | curva o peito sobre o abdômen (+ = encurva, − = estufa) | −0,4..0,5 |
| `breath` | expansão do tórax | 0..1,5 |
| `neck` | pescoço (independente da cabeça) | −0,4..0,4 |
| `head` | cabeça (+ = olha para baixo/frente) | −0,5..0,5 |
| `shrugN`, `shrugF` | sobe (+) / desce (−) o ombro | −0,3..0,6 |
| `armN/armF.a` | ângulo do braço a partir da vertical (+ = para frente, π = para cima) | −1,2..3,2 |
| `armN/armF.b` | dobra do cotovelo (sempre ≥ 0) | 0..2,6 |
| `wristN/wristF` | gira a mão | −1..1 |
| `legN/legF.a` | coxa (+ = para frente) | −0,8..1,7 |
| `legN/legF.b` | dobra do joelho (≥ 0) | 0..2,4 |
| `footN/footF` | ponta do pé | −0,4..0,5 |
| `handN/handF` | `aberta` `punho` `aponta` `segura` `acena` `joinha` | — |
| `sx`, `sy` | squash & stretch (use em impacto/pulo) | 0,85..1,15 |

**N** = lado próximo da câmera (desenhado na frente). **F** = lado distante. O personagem olha para `facing` (1 direita, −1 esquerda);
os ângulos são sempre "para frente do personagem", então o mesmo movimento funciona virado para os dois lados.

## 2. Contrato Motion

```ts
nomeMovimento: {
  loop: true,                 // estado contínuo (parado, dançar)  | false = ação com duração
  dur: 0.9,                   // obrigatório se loop=false
  grounded: false,            // opcional: desliga o ajuste que mantém o pé no chão (deitado, caído, pulando)
  expr: 'dor',                // opcional: expressão automática
  propN: 'celular',           // opcional: objeto na mão próxima (HELD, ver CATALOGO)
  fn: (t) => Pose,            // t em segundos desde o início
}
```

Adicione em um **novo bloco no fim de `motions.ts`**:
```ts
// ---- lote Luna 01: <tema>
Object.assign(MOTIONS, {
  ...
} as Record<string, Motion>);
```

Ferramentas no arquivo: `P({...})` (pose parcial sobre a de descanso), `L(a, b)` (membro), `breathe(p, t, k)` (vida ociosa),
`keyframes([[t, poseParcial, Ease.x], ...])`, `sit(p)` (pernas sentadas), `S`/`C` = seno/cosseno, `Ease.*`
(`inOutQuad`, `outQuad`, `outBack`, `outElastic`, `inOutSine`...).

## 3. Receitas

- **Estado ocioso vivo**: pose base + `breathe(p, t)` + pequenos senos de frequências diferentes (0,3–2 Hz) em `head`, `neck`, `wrist*`.
- **Ação com impacto** (soco, tapa): antecipação (recua 20–30% do tempo) → golpe rápido (`Ease.outQuad`, 10–15%) →
  segura → volta. Gire `chest` e `lean` junto com o braço: o golpe nasce do tronco.
- **Emoção no corpo**: tristeza = `chest` + , `head` +, ombros −; raiva = `chest` −, ombros +, punhos; vergonha = `neck` +, `head` +,
  braço cobrindo o rosto; alegria = `chest` −, braços abertos, pequenos pulinhos em `y`.
- **Tremor** (dor, frio, medo): `S(t * 20..25) * 0.01..0.02` em `lean`/`x`.
- **Caído**: `rot: ±1.52`, `y: ~46`, `grounded: false`.

## 4. Expressões (`expressions.ts`)

`Face` contínua: `browIn` (+ preocupado, − raiva), `browUp`, `lidTop` (0 aberto..1 fechado), `lidBot`, `smile` (−1..1), `open`,
`wide`, `teeth`, `tongue`, `pupil` (escala), `asym` (sorriso de canto), `pucker` (bico) + marcadores `happyEyes`, `tears`, `blush`,
`sweat`, `heartEyes`, `anger`, `dizzy`, `sparkle`.

```ts
sarcastico: E({ asym: 0.7, smile: 0.2, lidTop: 0.35, browUp: 0.25, browIn: -0.1 }),
```
Regra: expressões de sofrimento **nunca** têm `smile > 0`. O neutro já tem `smile: 0.04`.

## 5. Calibração fina (sem editar código)

Movimentos feitos com `keyframes([...])` e expressões podem ser ajustados **por dados** pelo Painel de QA
(`docs/PAINEL-QA.md`): instante dos keyframes, `dur`, campos da tabela acima e campos contínuos da Face, sempre dentro dos
limites desta spec. O resultado aprovado fica em `src/data/calibracao.json` e é aplicado no runtime por
`src/character/calibracao.ts`. Agentes de conteúdo propõem variações em `qa/propostas/` (formato `viva-proposta`).
Movimentos procedurais (fórmulas) só aceitam ajuste por código.

## 6. Checklist

- [ ] `npm run check:quick` (confere que a pose é finita do início ao fim).
- [ ] Ver no harness: `?test&env=sala&n=3&m=<movimento>&def=1` (três personagens: criança/adulto/idoso com `ages=8,30,75`).
- [ ] Braços não atravessam a cabeça; pés não afundam (se afundarem, use `grounded: false` ou ajuste `y`).
- [ ] Movimento de ação volta a uma pose neutra no fim (senão "pula" ao trocar de animação).
