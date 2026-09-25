# 04 · Lugares (modo Explorar) e ambientes (cenas)

Há **dois** tipos de "cenário" no jogo — não confunda:

| | Modo Explorar | Cenas animadas |
|---|---|---|
| O que é | o mundo contínuo onde se anda (casa, rua, praça, academia) | as cenas curtas dos eventos (festa, hospital, praia...) |
| Arquivo | `src/explorar/mundo.ts` (🟡) + `moveis.ts` (🟢) | `src/scenes/environments.ts` (🟢) |
| Receita | este guia §1–§4 | `.agents/skills/viva-criar-ambiente/` + este guia §5 |

## 1. Como o mundo está montado

```
 y   95 ─ 560   parede do fundo (interiores) / céu e prédios (exterior)
 y  560 ─ 750   chão dos interiores e da praça
 y  750          FACHADAS  (somem quando você entra no prédio)
 y  750 ─ 805   jardim e caminho até a porta
 y  805 ─ 892   CALÇADA contínua (passantes)
 y  898 ─ 1000  rua (carros)
 x   0 vizinho · 300–3600 casa · 3600–5900 praça · 5900–8900 academia · 8900–11200 comércio
```

Cada lugar é feito de 4 peças em `mundo.ts`:

| Peça | Lista | Faz o quê |
|---|---|---|
| Trecho | `TRECHOS` | faixa de x com **nome** (HUD/minimapa) e **pintor** (parede + chão). `interno` = tem teto |
| Zona | `ZONAS` | retângulo onde se **anda**. Zonas que se encostam/sobrepõem viram passagem (porta) |
| Fachada | `FACHADAS` | a frente do prédio na linha `y = 750`; com `predio` ela some quando você está dentro |
| Rua/jardim | `pintarRua` | jardins na frente dos prédios, caminho até a porta, calçada, rua e faixa de pedestres |

Objetos (`OBJETOS`) e decoração (`DECORACAO`) completam o lugar (guias 02 e 03).

## 2. Receita: dar interior a uma loja do comércio (ex.: padaria)

1. **Trecho**: acrescente `{ id: 'padaria', nome: 'Padaria Pão Nosso', lugar: 'rua', x0: 9000, x1: 9950, pintor: 'padaria', interno: true, minIdade: 8 }`
   e ajuste o trecho `lojas` para não cobrir esse x (hoje `lojas` vai de 8900 a 11200 — divida em pedaços, **mantendo
   o id `lojas`** em um deles).
2. **Pintor** em `PINTORES.padaria`: `parede(...)` com cor quente, `piso(..., 'ceramica', ...)`, prateleiras de pão na
   parede, `luminariaTeto`, `batente` na divisa. Copie o `cozinha` e adapte.
3. **Zona** do interior: `{ id: 'padaria', x0: 9030, x1: 9920, y0: 608, y1: 742, minIdade: 8 }` e **a porta**:
   `{ id: 'portaPadaria', x0: <porta − 38>, x1: <porta + 38>, y0: 734, y1: 820, minIdade: 8 }` (ela encosta no interior e na calçada).
4. **Fachada**: a da padaria já existe em `FACHADAS` (`id: 'padaria'`) com a placa "EM BREVE" — troque a porta por uma
   porta de verdade na posição da zona da porta e ponha `predio` (⚠️ `predio` hoje aceita `'casa' | 'academia'`: para um
   prédio novo **peça ao Claude** a ampliação do tipo e do corte da fachada).
5. **Jardim/entrada** em `pintarRua` (caminho de pedra até a porta, como nas portas da casa e da academia).
6. **Objetos**: balcão (comprar pão = fome +20, dinheiro −6), vitrine de doces, mesinhas com cadeira (sentar e comer).
7. Teste o caminho: da calçada, clique dentro da padaria — o personagem deve entrar **pela porta**.

## 3. Receita: enriquecer um cômodo que já existe

1. Capture o cômodo atual (antes): `npm run capturar -- sala-antes "/?ex=3000,712&zoom=0.8&hora=15#explorar"`.
2. Liste o que falta pelas 4 camadas do guia 01 §4 (parede, chão, móveis com função, decoração).
3. Acrescente decoração em `DECORACAO` e detalhes no pintor (quadros, prateleiras, relógio, tomadas, rodapé, cortinas).
4. Mantenha o **corredor livre** (y ~700–740) e não tape objetos clicáveis.
5. Capture depois (mesma URL) e mostre as duas no chat.

## 4. Regras do mundo

- O mundo cresce para a **direita** (acrescente depois de 11 200) ou por dentro de faixas existentes. Não mude x de
  lugares antigos sem necessidade (saves guardam a posição; o jogo recoloca no ponto andável mais próximo, mas evite).
- Idade mínima por zona: rua 8, academia 14. Um lugar "adulto" (bar, balada) usa `minIdade: 18`.
- Postes/árvores/placas na **calçada** ficam translúcidos quando o jogador está dentro do prédio atrás deles — não
  precisa fazer nada, é automático para decoração com `y > 750` na frente de um `predio`.
- Horário de funcionamento é motor (hoje só a academia, 6h–23h). Peça ao Claude se o seu lugar precisar.

## 5. Ambientes das cenas animadas (`src/scenes/environments.ts`)

Siga `.agents/skills/viva-criar-ambiente/` e mais estes pontos do padrão novo:
- Mesmo estilo dos móveis do Explorar: frente + topo + lateral, sombra de contato, paleta do guia 01. Você pode
  **importar** `caixa`, `sombra`, `M`, `OX`, `OY` de `src/explorar/moveis.ts` para desenhar volumes em camadas estáticas.
- Profundidade em camadas (`depth`): céu/fundo longe, meio, chão, frente — com pelo menos um elemento em primeiro plano
  (planta, poste, mesa) para dar a sensação de 2,5D.
- Capture com o harness de cenas: `npm run capturar -- galeria "/?test&env=<idAmbiente>&n=3&m=parado"`.
