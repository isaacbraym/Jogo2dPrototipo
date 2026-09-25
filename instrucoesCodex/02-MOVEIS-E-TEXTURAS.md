# 02 · Móveis e texturas (modo Explorar)

Arquivo: **`src/explorar/moveis.ts`** (🟢 pode acrescentar). Leia antes: guia 01 (escala e profundidade).

## 1. Anatomia de um móvel

```ts
/** Guarda-roupa de duas portas (encostado na parede do fundo). */
function guardaRoupa(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);                                   // opts.flip espelha (móvel virado para o outro lado)
  const W = 1.2 * M, H = 2.0 * M, D = 0.58 * M;   // SEMPRE em metros × M
  const cor = (o.color as string) ?? '#e9e1d2';   // cor configurável por opts
  sombra(ctx, 0, W, D);                           // sombra de contato primeiro
  caixa(ctx, -W / 2, 0, W, H, D, { frente: cor }); // corpo: frente + topo + lateral + contorno
  // detalhes (2–4): fresta entre as portas, puxadores, rodapé
  ctx.strokeStyle = shade(cor, -0.35); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -H + 8); ctx.lineTo(0, -8); ctx.stroke();
  ctx.fillStyle = '#c9d2d4';
  ctx.fillRect(-14, -H * 0.55, 6, 34); ctx.fillRect(8, -H * 0.55, 6, 34);
  ctx.fillStyle = shade(cor, -0.25); ctx.fillRect(-W / 2, -0.08 * M, W, 0.08 * M);
}
```

Regras:
- **Origem (0, 0) = centro da borda de baixo da FRENTE**, onde o móvel toca o chão. y negativo = para cima.
- A profundidade é desenhada **para cima e para a direita** automaticamente pela `caixa()`. Para posicionar algo "no
  fundo do tampo", some `d * OX` em x e `d * OY` em y (ex.: o monitor da escrivaninha:
  `mx = -0.05 * M + D * OX * 0.7`, `my = -H + D * OY * 0.7`).
- Assinatura: `(ctx, o, t)` — `o` são as opções (`color`, `flip`, `emUso`, `noite`, `hora`...), `t` o tempo em segundos
  (para animar).
- Registre no objeto `MOVEIS` no fim do arquivo (acrescente o nome na lista).

### `caixa(ctx, x, yBase, largura, altura, profundidade, faces)`
- `x` = borda esquerda da frente; `yBase` = base da frente (0 = chão; `-S` = em cima de algo com altura S).
- `faces = { frente, topo?, lado?, linha? }` — só `frente` é obrigatória (topo = mais claro, lado = mais escuro,
  linha = contorno, calculados sozinhos).
- Empilhe caixas para formas compostas: estrado + colchão (cama), base + tampo (mesa), assento + encosto (cadeira).

### Formas que não são caixas
- Elipses para coisas redondas **deitadas** (bacia do vaso, tampo de mesa redonda, chafariz): achate em y
  (`ellipse(x, y, rx, rx * 0.45, ...)`) — é assim que o círculo aparece em perspectiva.
- Hastes (pés de cadeira, postes): `perna(ctx, x, yBase, altura, cor, largura)`.
- Planta, árvore, gente, tecido: curvas (`quadraticCurveTo`) com 2 tons (luz/sombra).

## 2. Móvel com gente "dentro": partes

Quando alguém usa o móvel **por dentro** (sentado à mesa, deitado na cama, correndo na esteira), o desenho vira
duas funções:

| Parte | Desenhada | Exemplos existentes |
|---|---|---|
| de trás (padrão) | antes da pessoa | `cama`, `cadeira`, `cadeiraEscritorio`, `sofa`, `esteira` |
| da frente (`frente: true`) | depois da pessoa | `camaCobertor`, `escrivaninha`, `mesaJantar`, `sofaBraco`, `esteiraFrente` |

No `OBJETOS` (guia 03) isso vira `partes: [{ desenho: 'esteira' }, { desenho: 'esteiraFrente', frente: true }]`.
Pergunte-se: **"o que tapa o corpo de quem está usando?"** — isso vai na parte da frente (mesa tapa as pernas, edredom
tapa o corpo, painel e corrimão da esteira tapam um pouco quem corre).

## 3. Estados e animação

- `o.emUso` fica `true` enquanto alguém usa um objeto exclusivo (o supino esconde a barra do suporte porque ela está
  nas mãos de quem treina).
- Anime com `t`: `((i * 44 - t * 160) % comprimento)` para listras correndo (lona da esteira), `Math.sin(t * k)` para
  balanço, `Math.floor(t * 2) % 2` para piscar devagar.
- Noite: decoração com `acende: true` recebe `opts.state = 1` à noite (poste); o carro recebe `noite`; as fachadas
  recebem `hora`. Nos pintores de `mundo.ts`, use `luz(hora).noite` (0 de dia → 1 de noite).

## 4. Texturas (fundos em `src/explorar/mundo.ts`, 🟡)

| Textura | Como | Onde já existe |
|---|---|---|
| Piso de madeira | `piso(ctx, x0, x1, 'madeira', claro, escuro)` — tábuas que alargam para a frente | quarto, sala |
| Cerâmica / azulejo / calçada / pedra | `piso(..., 'ceramica' \| 'azulejo' \| 'calcada' \| 'pedra', ...)` — juntas em perspectiva | cozinha, banheiro, rua, praça |
| Borracha de academia | `piso(..., 'borracha', ...)` — granulado + placas | academia |
| Grama | `piso(..., 'grama', ...)` — tufos | jardins, praça |
| Papel de parede listrado | `parede(ctx, x0, x1, cor, corDaListra)` | quarto, sala |
| Azulejo de parede | grade de linhas finas `rgba(80,140,160,0.25)` a cada 40 px | banheiro |
| Tijolo/pedra de fachada | `strokeRect` em fileiras alternadas (meio bloco de deslocamento) | barrado da casa |
| Tecido com estampa | bolinhas/listras em `rgba(255,255,255,0.18)` sobre a cor | edredom |

Para uma **textura nova de piso**, acrescente um `tipo` em `piso()` seguindo os que existem (sempre com as juntas em
perspectiva: linhas "verticais" inclinadas `x → x − altura × 0,45`, linhas horizontais cada vez mais espaçadas para a frente).

## 5. Como testar um móvel novo

1. Coloque-o como decoração em `DECORACAO` (`{ desenho: 'guardaRoupa', x: 1000, y: 614 }`) ou como objeto (guia 03).
2. Capture perto e longe, de dia e de noite:
   ```bash
   npm run capturar -- guarda-roupa "/?ex=1000,712&zoom=1.1&hora=10#explorar"
   ```
   ```bash
   npm run capturar -- guarda-roupa-longe "/?ex=1000,712&zoom=0.55&hora=21#explorar"
   ```
3. Compare com um personagem na mesma imagem: o móvel está do tamanho certo? (guia 01 §1)

## 6. Erros comuns

- Medidas em px soltos (`w = 120`) em vez de `× M` → escala quebra quando alguém mudar `M`.
- Esquecer `flip(ctx, o)` no começo → `opts.flip` não funciona.
- Desenhar a profundidade para a esquerda ou para baixo → briga com todos os outros móveis.
- Tampo/assento sem espessura → "chapado". Use `caixa()` com altura ≥ 0,04 M.
- Parte da frente grande demais (tapa o rosto de quem usa). A parte da frente cobre pernas/tronco, nunca a cabeça.
