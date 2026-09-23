# SPEC-02 — Cenas (situações) e direção

Contrato de `Situation` (`src/scenes/situations.ts`) e regras de encenação.

## 1. Contrato

```ts
{
  id: 'nomeDaCena',                              // único, camelCase
  env: 'escritorio' | ((c) => c.data?.env ?? 'sala'), // id de ambiente (CATALOGO) ou função
  run: async (d, c) => { ... },                  // roteiro
}
```
- Acrescente no **fim do array `S`** (antes de `export const SITUATIONS`).
- `c.player` = jogador; `c.others[i]` = pessoas passadas em `scene.others`; `c.data` = dados livres de `scene.data`.
- Helpers do arquivo: `P(d, c, x, opts)` adiciona o jogador; `O(d, membro, x, opts)` adiciona NPC; `other(c, i, seed)` pega
  `c.others[i]` ou gera NPC determinístico; `crowd(d, n, x0, x1, seed, motion, opts)` figurantes; `faceEach(a, b)`; `lieOn(a, altura)`;
  `physical(d, a, b, acao)` interação corporal pronta.
- Leia sempre `c.data?.x` com `?.` e tenha valor padrão — o harness roda cenas sem dados.

## 2. Espaço e câmera

- Coordenadas de mundo: x útil **180–1100** (centro 640), chão dos pés `GROUND = 632`. Parede/chão em y=560.
- Dois personagens conversando: ~200–300 px de distância. Abraço/soco: use `physical` (ele aproxima sozinho).
- Profundidade: `z` maior = mais na frente. Jogador `z: 1`, NPC principal `0.5`, figurantes `-0.5` a `-1`, objetos de fundo `-2`.
- Figurantes menores (`scale: 0.85`) e um pouco acima (`y: GROUND - 30`) parecem mais distantes.
- Câmera: `d.focus(x, y, zoom)` para close (zoom 1.2–1.6); sempre `d.resetCam()` depois. Não deixe ninguém fora do quadro.
- Quando um cartão está aberto, a UI levanta a câmera automaticamente (não compense no roteiro).

## 3. Ritmo

- Duração total alvo: **4–9 s** (o jogador vê dezenas de cenas por vida). Cenas-marco (casamento, funeral) até 12 s.
- Estrutura: **estabelecer** (caption + pose inicial, 0,5–1 s) → **ação** (fala/movimento/efeito) → **reação** (expressões, 1 s).
- `d.caption(título ≤ 24 car., subtítulo ≤ 40 car.)` no começo.
- Falas: `await d.say(ator, texto ≤ 45 car., duração?, 'fala'|'pensa'|'grito')`. No máximo 3–4 falas por cena.
- Não use `while(true)`. Laços de ambiente devem checar `d.sc.alive` (veja a cena `casa`).
- `await Promise.all([...])` para ações simultâneas (dois andando).

## 4. Atuação (o que torna a cena crível)

- Toda ação tem **reação**: quem apanha → `dor`/`olhoRoxo`/`caidoChao` + expressão `dor`; quem bate → `ofegante` + `serio`/`bravo`.
- Emoção = movimento + expressão + emote. Ex.: vergonha = `humilhado` + `envergonhado` + emote `suor`.
- Use `d.expr(ator, 'x', segundos)` para expressões temporárias; o movimento pode trazer uma expressão própria.
- Efeitos: `d.fx('impacto'|'poeira'|'lagrima'|'suor'|'estrela'...)`, `d.shake(n)`, `d.flash(cor)`, `d.sfx('hit'|'slap'|...)` (lista no CATALOGO).
- Coerência de contexto: roupa (`outfit`), ambiente e objetos batem com o lugar (caixa de mercado não usa terno).

## 5. Esqueleto de cena nova

```ts
// Reunião por vídeo que podia ter sido um e-mail.
{
  id: 'reuniaoZoom',
  env: 'escritorio',
  run: async (d, c) => {
    const p = P(d, c, 420, { facing: 1, motion: 'sentar', z: 1 });
    const chefe = O(d, other(c, 0, 777, undefined, 45), 860, { motion: 'apontarBronca' });
    d.prop('cadeira', 420, GROUND, { z: 0.7 });
    d.caption('Reunião de alinhamento', 'Duração prevista: 15 min. Real: 2 h', 2.6);
    await d.say(chefe, 'Você tá no mudo.', 1.6);
    d.expr(p, 'envergonhado', 2);
    d.emote(p, 'suor');
    await d.wait(1.2);
    d.loop(p, 'dormirEmPe');
    d.expr(p, 'cansado');
    await d.wait(1.4);
  },
},
```

## 6. Checklist

- [ ] Ambiente existe e combina com o lugar.
- [ ] Todos os movimentos/expressões/objetos/emotes existem no `CATALOGO.md` (o validador confere).
- [ ] Funciona sem `c.others` (usa `other(...)`) e sem `c.data`.
- [ ] Testada no harness: `?test&sit=<id>&age=<idade>&at=<seg>` em 2 idades diferentes.
- [ ] Ninguém sorri em cena de dor; ninguém fica sobreposto; nada fora do quadro.
