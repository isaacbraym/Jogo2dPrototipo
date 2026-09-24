# SPEC-08 — Rastreio de altura no beijo (boca encontra boca em qualquer altura)

> **Para quem vai mexer nisto (Codex e outros agentes): leia este arquivo INTEIRO antes de editar.**
> Tudo o que você precisa ajustar está em UMA tabela de números (`RASTREIO_BEIJO`). Na maioria dos casos você **não**
> precisa escrever lógica nova — só mudar números e verificar com o roteiro da seção 6.

Pré-requisito: `docs/specs/SPEC-07-contato-entre-personagens.md` (como o beijo/abraço funcionam em geral).

---

## 1. O problema

Personagens têm alturas diferentes (`ap.height` 0..1 muda a altura em ±10%, e sexo/idade mudam mais). Se o beijo só
encosta os corpos, a boca do mais alto cai no **olho, na testa ou no nariz** do mais baixo. Um palpite fixo ("se for mais
alto, incline 0,3 rad") também erra, porque cada corpo tem cabeça, pescoço e pernas de tamanhos diferentes.

## 2. A solução em uma frase

A cada quadro o motor **mede a altura das duas bocas**, calcula quanto falta para elas ficarem na mesma altura e
**acumula** essa correção (controle em malha fechada). A correção em pixels é convertida em movimento das articulações
**em estágios, na ordem em que um corpo de verdade faz**:

| Quem | 1º | 2º | 3º | 4º | 5º |
|---|---|---|---|---|---|
| **Mais alto (desce)** | baixa a cabeça (`head`) | dobra o pescoço (`neck`) | encurva o peito (`chest`) | inclina a lombar (`lean`) | dobra os joelhos (`joelhos`) |
| **Mais baixo (sobe)** | ergue o queixo (`head` −) | ergue o pescoço (`neck` −) | fica na ponta dos pés (`pontas`) | arqueia as costas (`chest` −) | — |

O estágio seguinte **só começa quando o anterior chegou ao limite**. Por isso:
- diferença pequena → só as cabeças inclinam;
- média → pescoço e ponta dos pés entram;
- grande → o mais alto se encurva e dobra levemente os joelhos, e o mais baixo sobe bem na ponta dos pés.

Diferença de altura resolvida: **55% pelo mais alto, 45% pelo mais baixo**. Se um chegar ao limite, o outro completa.

## 3. Onde está o código (zona vermelha — motor)

| O quê | Arquivo | Nome |
|---|---|---|
| Tabela de parâmetros (**é aqui que se ajusta**) | `src/scenes/contato.ts` | `RASTREIO_BEIJO` |
| Converte px em ângulos, estágio por estágio | `src/scenes/contato.ts` | `distribuirAltura()`, `capacidade()`, `pxDoEstagio()` |
| O laço de controle (medir, acumular, aplicar) | `src/scenes/contato.ts` | `Contato.update()`, bloco do `else` do beijo |
| Papéis fixos (quem é alto/baixo) e palpite inicial | `src/scenes/contato.ts` | `constructor` do `Contato` (`this.alta`, `this.baixa`, `this.altC`) |
| Dobrar joelhos mantendo os pés no chão | `src/character/actor.ts` | campo `ajuste.joelhos` (aplicado **antes** do apoio no chão) |
| Posição da boca usada na medição | `src/scenes/contato.ts` + `src/character/head.ts` | `marcos().boca`, `frenteBocaX()` |
| Números de diagnóstico ao vivo | `src/scenes/contato.ts` | `contato.diagnostico` (`erro`, `c`, `alta`, `baixa`) |

## 4. O algoritmo, passo a passo (o que acontece a cada quadro)

1. **Papéis (só uma vez, no início):** mede a boca de cada um em pé. A boca mais alta é `alta`; a outra é `baixa`.
   *Nunca* recalcule isso por quadro: quando a compensação iguala as bocas, os papéis trocariam e a pose tremeria.
2. **Palpite inicial:** `altC = diferença em pé × preAlimentacao` (0,75). Começa perto, sem passar da boca.
3. **Postura entra com a aproximação:** o peso `wM` (aproximação) aplica a postura de altura *enquanto* eles chegam — a
   cabeça já inclina antes de os lábios encostarem, como gente de verdade.
4. **Medir:** `erro = boca_baixa.y − boca_alta.y` (em px de tela; `y` cresce para baixo). `erro > 0` = a boca do mais
   alto ainda está acima.
5. **Acumular (integrador):** só quando a postura já está aplicada (`wM > integraAPartirDe`):
   `altC += erro × min(1, dt × ganho)`. Limitado a `[−6, capacidade_alta + capacidade_baixa]`.
6. **Dividir:** `usoAlta = min(altC × parteDoMaisAlto, capAlta)`, `usoBaixa = min(altC − usoAlta, capBaixa)`, e o que
   sobrar volta para o alto.
7. **Estágios:** `distribuirAltura(ator, 'desce' | 'sobe', px)` enche os estágios na ordem da tabela e devolve os
   ângulos (`head`, `neck`, `chest`, `lean`, `joelhos`) e os px de ponta dos pés (`pontas`).
8. **Aplicar:** soma as inclinações de base (narizes se cruzando) + a "pressão" do beijo e escreve em `Actor.ajuste`
   (suavizado em `aplicar()`). Ponta dos pés = `y` negativo + giro dos pés (`footN/F = pontas × peRadPorPx`).
   Joelhos = `ajuste.joelhos`: a coxa vai `joelhos/2` para a frente e a canela dobra `joelhos`; o apoio no chão desce
   o quadril sozinho, então **os pés continuam plantados**.

## 5. Parâmetros (`RASTREIO_BEIJO`) — o que cada um faz e a faixa segura

| Parâmetro | Padrão | Faixa segura | Aumentar faz | Diminuir faz |
|---|---|---|---|---|
| `parteDoMaisAlto` | 0,55 | 0,4 – 0,7 | o alto se curva mais, o baixo sobe menos | o baixo fica mais na ponta dos pés |
| `ganho` | 4 | 2 – 6 | acha a boca mais rápido; acima de 6 pode tremer | mais lento e mais estável |
| `integraAPartirDe` | 0,97 | 0,9 – 0,99 | menos excesso na chegada | começa a corrigir mais cedo (risco de passar da boca) |
| `preAlimentacao` | 0,75 | 0,5 – 0,9 | chega mais perto logo de cara (risco de passar) | chega mais curto e o integrador completa |
| `base.cabecaMaisAlto` | 0,06 | 0 – 0,12 | narizes cruzam mais | cabeças mais retas |
| `base.cabecaMaisBaixo` | −0,1 | −0,2 – 0 | (mais negativo) queixo mais erguido | menos erguido |
| `base.lombar` | 0,02 | 0 – 0,05 | corpos mais inclinados um para o outro | mais eretos |
| `desce[i].max` | ver código | cabeça ≤ 0,25; pescoço ≤ 0,2; peito ≤ 0,15; lombar ≤ 0,12; joelhos ≤ 1,0 | aquele estágio faz mais antes do próximo entrar | o próximo estágio entra mais cedo |
| `sobe[i].max` | ver código | cabeça ≤ 0,25; pescoço ≤ 0,15; pontas ≤ 0,09 (fração da perna); peito ≤ 0,08 | idem | idem |
| `desce/sobe[i].eficiencia` | ver código | 0,3 – 1,0 | (estimativa de px por rad × largura da cabeça) — **não precisa ser exata** | — |
| `peRadPorPx` | 0,045 | 0,03 – 0,06 | calcanhar sobe mais por px de ponta dos pés | menos |

**Regras de ouro para ajustar:**
- Mude **um número por vez** e verifique com a seção 6.
- A **ordem** dos estágios nas listas `desce` e `sobe` é o "jeito" do corpo. Não reordene sem motivo visual claro.
- Rosto inclinado demais → **diminua** `max` de `head`/`neck` (os próximos estágios assumem).
- Corpo curvado demais → diminua `max` de `chest`/`lean` (joelhos/pontas assumem).
- Nunca passe das faixas seguras: ângulos acima delas quebram a silhueta (pescoço "de borracha", pé virado).
- `eficiencia` imprecisa **não** causa erro de posição (a malha fechada corrige); só muda a velocidade de convergência.

## 6. Como verificar (obrigatório a cada mudança)

Com `npm run dev` rodando:

**6.1 Capturas (3 casais × 3 momentos).** `&alt=<jogador>,<outro>` fixa as alturas (0 = mais baixo, 1 = mais alto):

| Caso | URL (troque `at` por 2.2, 3.6 e 5.3) |
|---|---|
| mulher baixa × homem alto | `http://localhost:5199/?test&sit=interacao&age=28&oage=30&sex=f&alt=0,1&at=3.6&data=%7B%22action%22%3A%22beijar%22%2C%22env%22%3A%22parque%22%7D` |
| mulher alta × homem baixo | igual, com `alt=1,0` |
| alturas iguais | `sex=m&alt=0.5,0.5` |

O harness roda em tempo real: espere `window.frozen === true` e **mais ~1 s** antes de capturar (senão a imagem é de um
quadro antigo). Para ver as pernas, afaste a câmera depois de congelar:

```js
const sc = window.stage.scene; const cx = (sc.actors[0].x + sc.actors[1].x) / 2;
Object.assign(sc.cam, { x: cx, tx: cx, y: 430, ty: 430, zoom: 1.6, tzoom: 1.6 }); window.stage.resize();
```

**6.2 Traço numérico (o teste de verdade).** Abra a URL **sem** `&at=` e rode no console:

```js
const out = [];
for (let i = 0; i < 70; i++) {
  await new Promise((r) => setTimeout(r, 100));
  const sc = window.stage.scene;
  const c = sc.contatos.find((x) => x.diagnostico !== undefined);
  if (c && c.diagnostico) out.push(sc.t.toFixed(1) + ':' + c.peso.toFixed(2) + '/' + c.diagnostico.erro.toFixed(1));
}
out.join('  ');
```

Cada item é `tempo:peso/erro`. O `diagnostico` também traz `alta` e `baixa` (quanto cada estágio está usando).

**6.3 Critérios de aceite (números):**
- [ ] Durante o beijo (`peso` = 1,00), `|erro| ≤ 2 px`. A oscilação lenta de ±1,5 px é a "pressão" do beijo (período ~2,9 s) e é esperada.
- [ ] Excesso na chegada (valor mais negativo antes de estabilizar) **≥ −5 px**.
- [ ] `peso` fica **exatamente 1,00** enquanto dura (se oscilar 0,95–1,00, há tremor).
- [ ] Visual: lábio encosta em lábio (nunca olho, nariz, testa ou queixo); pés no chão; ponta dos pés com calcanhar erguido.
- [ ] Alturas iguais: `alta` e `baixa` do diagnóstico vazios/zerados (só as inclinações de base).
- [ ] `npm run check` termina com "✅ Tudo certo."

**Valores de referência medidos (24/09/2026):**

| Caso | Alturas | O mais alto usa | O mais baixo usa | Erro final |
|---|---|---|---|---|
| mulher baixa × homem alto | 334 × 374 | cabeça 0,18 · pescoço 0,14 · peito 0,09 | queixo 0,2 · pescoço 0,12 · pontas 2 px | < 1 px |
| mulher alta × homem baixo | 383 × 327 | cabeça 0,18 · pescoço 0,14 · peito 0,12 · lombar 0,08 · joelhos 0,41 | queixo 0,2 · pescoço 0,12 · peito 0,06 · pontas 10 px | < 1 px |
| iguais | 354 × 354 | — | — | < 1 px |

## 7. Diagnóstico: sintoma → causa → o que mexer

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Boca bate no nariz/testa do mais baixo | capacidade esgotada (`c` no teto) | aumente um pouco `max` de `joelhos` (alto) ou `pontas` (baixo) |
| Boca "passa" e depois sobe (excesso > 5 px) | integrador cedo demais ou palpite alto | aumente `integraAPartirDe` ou diminua `preAlimentacao` |
| Cabeças tremem durante o beijo | `ganho` alto | diminua `ganho` (mínimo 2) |
| Demora a acertar a altura | `ganho` baixo | aumente `ganho` (máximo 6) |
| Rosto do mais alto inclinado demais | `head`/`neck` com `max` alto | diminua esses `max` |
| Mais alto parece "corcunda" | `chest`/`lean` com `max` alto | diminua esses `max`; joelhos assumem |
| Pés afundando no chão | alguém usou `y` positivo para descer | use **`joelhos`**, nunca `y` positivo, para abaixar |
| Pé do mais baixo virado para cima | `peRadPorPx` com sinal/valor errado | valor entre 0,03 e 0,06, positivo |
| Pose treme de leve em todo contato | `peso` oscilando | confira o bloco que move `peso` em direção a `alvo` (não pode descer quando `peso == alvo`) |

## 8. O que NÃO fazer

- Não recalcule `alta`/`baixa` por quadro.
- Não troque o controle integral por uma fórmula fixa ("diferença × 0,3"): é exatamente o que errava.
- Não use `y` positivo para abaixar alguém em pé (afunda os pés) — use `joelhos`.
- Não mude a posição da boca em `marcos()` para "acertar" um caso: ela precisa bater com o desenho de `head.ts`.
- Não edite `head.ts`, `character.ts` ou o formato do save para esta tarefa.

## 9. Estender para outros contatos (quando pedirem)

O mesmo padrão serve para qualquer "ponto de um encontra ponto do outro" em altura:
- **beijo na testa / na bochecha:** trocar o alvo vertical (boca do alto → testa do baixo) e manter os estágios;
- **cochichar no ouvido:** boca de um → orelha do outro;
- **abraço:** já usa um integrador parecido (`falta`) com o critério "topo da cabeça da frente abaixo da boca de trás".

Receita: (1) defina os dois pontos em `marcos()`; (2) meça o `erro` vertical entre eles; (3) acumule com ganho e limite;
(4) distribua com `distribuirAltura` (ou uma tabela de estágios própria); (5) exponha `diagnostico`; (6) documente aqui
com a mesma tabela de referência.
