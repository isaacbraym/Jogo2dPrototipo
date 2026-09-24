# SPEC-07 — Contato entre personagens (abraço, beijo e o que vier)

Como dois personagens se tocam sem "um atravessar o outro". Vale para qualquer animação em que **dois corpos se encostam**:
abraço, beijo, dança a dois, carregar alguém, consolar com a mão no ombro, briga agarrada.

Código (zona vermelha — motor): `src/scenes/contato.ts` (controlador), `src/scenes/scene.ts` (camadas por parte),
`src/character/character.ts` (`camada`), `src/character/head.ts` (perfil), `src/character/hair.ts` (cabelo em perfil).
Quem cria conteúdo **usa** isto por `physical(d, a, b, 'abracar' | 'beijar')` em `src/scenes/situations.ts`.

---

## 1. O problema que isto resolve

Antes, abraço e beijo eram dois bonecos inteiros colocados a uma distância fixa: um era desenhado **por cima** do outro,
a cabeça cobria a cabeça do parceiro e o braço virava uma barra reta que não envolvia nada. Um animador resolveria com
três coisas, e é o que o motor faz agora:

1. **Pontos de contato reais** — o controlador lê o esqueleto a cada quadro (peito, costas, boca, ombro, altura da cabeça)
   e move os corpos até o ponto de contato se encontrar (peito com peito, lábio com lábio).
2. **Camadas por parte** — cada personagem em contato é desenhado em 3 fatias: braço distante (`tras`), corpo+cabeça
   (`corpo`) e braço próximo (`frente`). A cena intercala as fatias dos dois: o braço de quem está atrás passa **por trás**
   do corpo da frente e a **mão reaparece** nas costas dele (`maoN`). É isso que faz o abraço "entrelaçar".
3. **Perfil de verdade** — com `turn > 1` a cabeça passa continuamente de ¾ para **perfil**: nariz, lábios e queixo viram a
   silhueta, o olho distante some atrás do nariz, a orelha vai para o meio da cabeça e o cabelo recua (recorte pela linha
   do cabelo). Sem isso, beijo é impossível: em ¾ a boca fica dentro do rosto e uma cabeça cobre a outra.

## 2. Tempo (o que deixa fluido)

O contato tem um `peso` 0 → 1 (entrada ~0,8–1,0 s, saída ~0,7 s) dividido em camadas, como animação profissional:

| fase | peso | o que acontece |
|---|---|---|
| antecipação | 0 → 0,6 | corpos giram (¾ → perfil no beijo), as mãos saem em **arco** (sobem e descem no alvo — nunca em linha reta); a mão distante atrasa um pouco |
| contato | 0,3 → 1 | os corpos se aproximam até encostar; postura de altura (inclinar, ponta dos pés, joelhos) |
| sustentação | 1 | nada congela: balanço lateral lento, respiração, afago da mão, "pressão" do beijo fora de fase entre os dois, **apertão** do abraço (~1 s depois de encostar, meio segundo) |
| saída | 1 → 0 | ordem inversa: primeiro o rosto se afasta, as mãos soltam por último |

No roteiro (`physical`), a expressão acompanha o tempo: `aconchego` (olhar derretido) na aproximação, `beijo` só quando os
lábios estão encostando, `aconchego` ao afastar e `apaixonado` depois.

## 3. Regras do abraço

- **Quem é mais baixo fica na frente** (desenhado por cima), com a bochecha no peito/ombro de quem está atrás.
- **Os dois rostos precisam aparecer.** Critério: o topo da cabeça da frente (com folga para cabelo volumoso) fica abaixo
  da boca de quem está atrás. O motor desce quem está na frente (joelhos + lombar) e sobe quem está atrás (ponta dos pés)
  até cumprir isso — controle integral, não para no meio.
- A cabeça da frente **não soma** toda a curvatura da coluna: fica só levemente deitada (~0,3 rad). Rosto deitado de lado lê
  como "torto".
- Em 2D as cabeças **não se cruzam em x** (exigiria um corpo atravessar o outro): a separação dos rostos é vertical.
- Mãos de quem está na frente: cintura/costas baixas do outro, **nunca acima do próprio ombro** (o braço cruzaria o rosto).
- Mãos de quem está atrás: costas altas do outro; o braço passa por trás e a mão reaparece.
- Diferença de altura > 30% (adulto × criança): o mais alto agacha (`agachar`) antes de abraçar.
- **Quem está na frente desce dobrando os joelhos** (`ajuste.joelhos`, até `ABRACO_JOELHOS_MAX` = 1,25 rad, pés plantados);
  o que faltar vira inclinação do tronco (a cabeça se endireita). **Nunca** com `y` positivo: isso afundava os pés abaixo
  do chão do outro. Quem está atrás sobe com `ajuste.pontas` (ponta dos pés exata), até 15 px.

## 4. Regras do beijo

- **Altura:** a boca encontra a boca em qualquer diferença de altura por **rastreio em malha fechada** — ver
  `docs/specs/SPEC-08-rastreio-de-altura-no-beijo.md` (algoritmo, parâmetros `RASTREIO_BEIJO`, testes e diagnóstico).
- Os dois em **perfil** (`turn` 1,42). Contato é **frente do lábio com frente do lábio** (`frenteBocaX` em `head.ts`).
- Corpos quase eretos e próximos; quem desce é pescoço/cabeça (não a lombar — lombar afasta os quadris e estica os braços).
- Cabeças em ângulos opostos: o mais alto baixa o queixo, o mais baixo ergue (e fica na ponta dos pés). O nariz de um cruza
  a bochecha do outro — normal.
- Mão próxima de quem está na frente vai ao **rosto** do outro (maxilar, entre a boca e a orelha: não cobre olhos nem boca).
  Se o rosto estiver longe demais do ombro (o braço viraria uma barra horizontal), a mão desce para a **cintura** — mistura
  contínua pela distância. A mão distante vai à cintura por trás.
- Quem está atrás: braço próximo envolve a cintura (mão reaparece nas costas), o distante sobe às costas.

## 5. Parâmetros (para quem ajusta)

| onde | parâmetro | padrão | efeito |
|---|---|---|---|
| `new Contato(a, b, tipo, o)` | `o.aperto` | 0,6 | quanto os corpos se sobrepõem no abraço (0 = encostado, 1 = esmagado) |
| | `o.turn` | abraço 0,98 (frente 0,8) · beijo 1,42 | giro de corpo/cabeça durante o contato |
| `contato.soltar()` | — | — | inicia a saída; o controlador se desliga sozinho ao terminar |
| `Actor.ajuste` | `x y lean chest neck head hipTilt breath shrugN/F footN/F` | — | ajuste aditivo sobre o movimento-base (o controlador escreve aqui) |
| `Actor.enlace` | outro ator | — | liga as camadas por parte entre os dois |
| `turn` | 0 … 1,45 | 0,72 | 0 frontal · 0,72 ¾ · **≥ 1,45 perfil completo** (mistura contínua a partir de 1) |

## 6. Como usar em conteúdo (Luna e outros)

- Abraço/beijo em qualquer cena: **sempre** `await physical(d, a, b, 'abracar' | 'beijar')`. Não reposicione os atores à mão
  nem use `moveActor` para "encostar" — o controlador faz isso lendo o esqueleto.
- Depois de `physical`, os atores voltam ao `turn`/`z` originais; use `d.loop(...)` para a pose seguinte.
- Personagem de perfil em cena comum (conversa lado a lado, fila, olhar para longe): pode usar `turn` entre 1,0 e 1,45 no
  `d.add(..., { turn })`. Acima de 1,45 não há ganho.
- Contato novo (dança a dois, carregar no colo, mão no ombro): **peça em `docs/PEDIDOS-ENGINE.md`** um `TipoContato` novo,
  descrevendo pontos de contato, quem fica na frente e as mãos. Não imite contato com offsets fixos.

## 7. Checklist de QA de contato (obrigatório ao mexer nisto)

Capture quadros com `window.frozen` (o harness roda em tempo real; espere congelar antes da captura):

```
http://localhost:5199/?test&sit=interacao&age=28&oage=30&sex=f&at=3.0&data={"action":"abracar","env":"parque"}
```

Para cada tipo (abraço e beijo), verifique **4 pares**: alturas parecidas · alto atrás/baixo na frente · adulto × criança
(só abraço) · idosos. E **3 momentos**: aproximação (~1,5 s), sustentação (~3 s), saída (~5 s).

- [ ] Os dois rostos visíveis (olhos e boca de ambos, exceto quem enterra o rosto no ombro de propósito).
- [ ] Nenhum braço reto horizontal "de barra"; cotovelos dobrados.
- [ ] O braço de quem está atrás some atrás do corpo da frente e a mão reaparece.
- [ ] Nenhuma mão cobrindo olhos/boca de ninguém (nem a própria).
- [ ] No beijo, os lábios se encontram na silhueta (não dentro do rosto do outro).
- [ ] Nada congelado na sustentação (balanço/respiração/afago visíveis entre dois quadros).

---

## 8. Contato de mão (tapa, soco, empurrão, aperto de mão, toca-aqui, presente, consolar, massagem)

Mesma ideia do abraço: **a mão vai até um ponto real do outro corpo**, não "para a frente no ar".

- `Trajeto` (`scenes/contato.ts`): a mão (N ou F) passa por **chaves** `{ t, p, forma, ease }`. `p` é um ponto vivo — uma função
  que lê o esqueleto do outro a cada quadro (`marcos(b).rosto`, `.queixo`, `.peitoFrente`, `.ombro`, `.ombroF`, `.costasAlto`)
  — ou `null` (repouso: onde o movimento-base deixaria a mão). `mexe(t)` soma sacudida/afago; `eventos` disparam no instante exato.
- `Impacto`: reação com mola (cabeça vira / tronco recua e volta) em `Actor.impulso`, no quadro do contato.
- `golpear(d, a, b, 'tapa' | 'soco' | 'empurrar', { forca, aoImpacto })` em `situations.ts`: aproxima o passo certo, toca o
  corpo do golpe (`tapaCorpo`, `socoCorpo`, `empurrarCorpo` — só corpo, sem braço), leva a mão ao alvo e, **no contato**, solta
  efeito, som, tremor de câmera e a reação. Usado por `physical` e pela cena `agressao`.
- `maoAte(d, ator, 'N'|'F', chaves)` e `aproximarAlcance(d, a, b, alvo, frac, 'N'|'F', folga)` para interações novas.

**Qual braço usar (em ¾):** o ombro **F** fica do lado para onde a pessoa olha; o **N** fica atrás. Para alcançar o outro sem o
braço cruzar o próprio rosto use **F** (tapa, jab, toca-aqui, consolar). **N** serve para gestos na altura da cintura (aperto de
mão) ou com as duas mãos (empurrão, massagem). Quem golpeia fica na frente em profundidade (`z`); quem consola fica **atrás**
(o braço passa por trás de quem chora e a mão reaparece nas costas — o rosto de quem chora continua visível).

**Distâncias:** nunca use distância fixa. Aproximação por `(a.d.chestW + b.d.chestW) × fator` (golpes 0,8–1,0; aperto de mão e
presente 0,95; consolar 0,9) e depois `aproximarAlcance`, que nunca deixa os peitos a menos de `folga`.

**Reação no impacto, não depois:** quem apanha começa a reagir no quadro do contato (`aoImpacto`), não quando o golpe termina.

## 9. Corpo caído encosta no chão

Movimentos com `grounded: false` e rotação grande (`|rot| > 0,45`) são apoiados automaticamente: o motor calcula o ponto mais
baixo do corpo (quadril, costas, cabeça, joelhos, calcanhares, cada um com sua espessura) e ajusta `y` para ele tocar o chão —
em qualquer idade. O `y` escrito no movimento vira só um ponto de partida; não é preciso calibrar a altura na mão.

## 10. Regras de animação para conteúdo (Luna 6 e outros)

1. **Contato é do motor.** Se dois corpos se tocam, use `physical`, `golpear`, `maoAte` ou peça um tipo novo em
   `PEDIDOS-ENGINE.md`. Braço apontado "no ar" na direção do outro é bug.
2. **Antecipação → ação → acompanhamento → repouso**, sempre. Antecipação ≈ 0,2–0,3 s (sai em `recolhe`), ação ≈ 0,08–0,12 s
   (chega em `golpe`), acompanhamento ≈ 0,1–0,15 s passando do alvo, repouso ≈ 0,3–0,4 s.
3. **O tronco lidera**, o braço segue: nos `*Corpo` o peso vai para trás na antecipação e para a frente no impacto; inclinação
   máxima ~0,2 (mais que isso o personagem "mergulha").
4. **Nada congela:** poses sustentadas têm respiração, balanço ou afago (`mexe`).
5. **Rosto sempre legível:** mão, braço ou cabeça do outro nunca cobrem olhos e boca de ninguém sem intenção.
6. **Perfil (`turn` 1–1,45)** para beijo e cochicho; **¾ (0,72)** para o resto. Penteados precisam funcionar nos dois (o motor
   recorta o cabelo em perfil; mechas do lado de lá ficam atrás do rosto).
7. **QA obrigatório:** capture o instante do contato com `&hit=0.02` (congela logo após o primeiro evento de um `Trajeto`) e o
   meio/fim com `&at=`. Espere ~1 s depois de congelar antes da captura (o painel repinta com atraso). Penteados:
   `?test&env=parque&n=4&turn=0.9&hair=trancas,longo,...&span=560&zoom=1.6` em `turn` 0,72, 0,9 e 1,45.

## 11. Mesmo nível de chão em interações diretas (2,5D)

Cada ator tem a sua **faixa de chão** (`actor.y`): fora de interação, personagens andam em profundidades diferentes (2,5D)
e isso deve continuar livre. Mas numa **interação direta** (abraço, beijo, aperto de mão, tapa, empurrão, presente...) os
pés dos dois precisam estar no **mesmo nível** — senão um parece flutuar ou estar em outro plano.

- `physical()` (e a cena `agressao`): enquanto os dois se aproximam (`close`), deslizam em 0,5 s para a **linha média**
  entre as duas faixas. Depois continuam nela (estão juntos).
- `Contato` (abraço/beijo): garante o mesmo nível durante o contato — os dois vão para a linha média junto com a
  aproximação (`wM`) e, ao soltar, voltam suavemente para as faixas de origem. Se `physical` já nivelou, não faz nada.
- Descer/subir o corpo **nunca** muda a faixa: use `ajuste.joelhos` (dobrar pernas, pés plantados) e `ajuste.pontas`
  (ponta dos pés). `y` positivo em pé afunda os pés; `y` negativo solto faz flutuar.
- Teste: `&dy=<px>` nas cenas de teste põe o 2º personagem em outra faixa. Ex.:
  `?test&sit=interacao&sex=f&dy=45&at=3.0&data={"action":"abracar","env":"parque"}` → ao congelar, `actors[0].y` e
  `actors[1].y` devem ser iguais (linha média) e os pés dos dois na mesma altura na captura.
