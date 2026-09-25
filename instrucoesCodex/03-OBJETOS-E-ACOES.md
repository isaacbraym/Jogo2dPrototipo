# 03 · Objetos com ações (modo Explorar)

Arquivo: **`src/explorar/mundo.ts`** → lista `OBJETOS` (🟡: acrescente no fim do bloco do lugar; não mude ids).
Tipos em `src/explorar/tipos.ts` (`ObjetoMundo`, `AcaoObjeto`). Leia antes: guias 01 e 02.

## 1. Exemplo completo (copie e adapte)

```ts
  // piano de parede na sala: tocar dá diversão; com prática, inteligência
  {
    id: 'piano', nome: 'Piano', desenho: 'piano', x: 3200, y: 616, w: 260, h: 260,
    partes: [{ desenho: 'banquinhoPiano', dx: 0, dy: 70 }, { desenho: 'piano' }],
    acoes: [
      {
        id: 'tocarPiano', label: 'Tocar piano', icon: '🎹', minutos: 40,
        motion: 'digitar', dx: 0, dy: 70, lado: 1, giro: 0.2, assento: 0.48,
        efeito: { stats: { inteligencia: 1, felicidade: 2 }, nec: { diversao: 18, energia: -4 } },
        texto: 'Tocou "Parabéns pra você" em três tons diferentes. Todos errados.',
      },
    ],
  },
```

## 2. Campos do objeto

| Campo | O quê |
|---|---|
| `id` | único, camelCase, sem acento. **Nunca renomeie.** |
| `nome` | aparece no menu e na dica do mouse |
| `desenho` | nome em `MOVEIS` (guia 02) — ou `partes` |
| `x`, `y` | **base da frente no chão**. `y` define profundidade e escala (fundo ~610–630, meio ~650–700, frente ~730) |
| `w`, `h` | caixa de clique (px na escala 1) — cubra o móvel inteiro |
| `partes` | `[{ desenho, dx?, dy?, opts?, frente? }]` — atrás de quem usa, ou por cima com `frente: true` |
| `exclusivo` | só uma pessoa por vez (esteira, bike, supino). Mostra "Ocupado por Fulano" |
| `vagas` | `[{ dx, dy?, lado? }]` — vários lugares no mesmo objeto (rack de halteres = 3). Use com `exclusivo` |
| `opts` | opções do desenho (`color`, `flip`...) |

## 3. Campos da ação

| Campo | O quê |
|---|---|
| `id`, `label`, `icon` | id único no objeto; texto e emoji do menu |
| `minutos` | tempo de jogo gasto (em avanço rápido: `minutos / 14` s reais, mín. 2,4 s) |
| `motion` | movimento de `MOTIONS` (`docs/CATALOGO.md`). Sentado: `sentar`, `sentarFeliz`, `digitar`, `estudar`, `comer`; deitado: `dormirCama`; academia: `esteira`, `pedalar`, `supino`, `rosca` |
| `dx`, `dy`, `lado` | onde a pessoa fica: `dx` em px **do desenho** (é escalado junto), `dy` em y do mundo (negativo = mais para o fundo, "dentro" do móvel), `lado` 1 = olha para a direita |
| **`assento`** | altura do assento em **metros** → o corpo senta exatamente ali (cada corpo tem uma perna; o controlador calcula) |
| **`plataforma`** | altura em metros da superfície onde fica **em pé ou deitado** (colchão 0,52; lona da esteira 0,22; banco do supino 0,54; base do box 0,08) |
| `giro` | 0 = de frente para a câmera (sofá), 0,72 = ¾ (padrão), > 1 = perfil |
| `segura` | objeto de mão (`HELD` em `src/render/props.ts`: `celular`, `livro`, `xicara`, `controle`, `haltere`...) |
| `efeito` | `{ stats?, nec?, fitness?, dinheiro? }` — ver §4 |
| `texto` | frase ao terminar (tom do guia 01 §5) |
| `cond` | `(L, est) => string \| null` — motivo do bloqueio ou `null` (ex.: `juntos(matriculado, cansado(20))`) |
| `especial` | ações tratadas pelo motor (`dormir`, `banho`, `xixi`...). **Não crie especiais novos** — peça ao Claude |

> ✅ `assento`/`plataforma` substituem o antigo `elev` (px fixo). Use sempre metros: é o que impede "sentar no ar".

## 4. Balanceamento de efeitos (valores de referência)

Por **uma** ação (o ganho cai com a repetição no ano: `× 1/(1 + usos × 0,1)`):

| Tipo de ação | stats | necessidades (`nec`) |
|---|---|---|
| lazer leve (TV, banco da praça) | felicidade +1…+2 | diversão +8…+25, energia +4…+6 |
| lazer ativo (videogame, PC) | felicidade +2…+3 | diversão +22…+30, energia −4…−5 |
| estudo/leitura | inteligência +2…+3 | diversão −8…+10, energia −10 |
| treino (30–40 min) | saúde +2…+3, aparência +1…+2, `fitness` +2…+3 | energia −14…−20, fome −8…−12, higiene −14…−22 |
| comer | saúde +1…+2 | fome +30…+55 |
| beber água | saúde +1 | energia +3, **bexiga −18** |
| custo | `dinheiro: −N` | — (o menu bloqueia sem dinheiro) |

Regras: toda ação muda **alguma coisa** (regra de ouro 4); ação boa demais sem custo = bug de design; treino suja
(higiene) e cansa (energia); nada recompensa agressão.

## 5. Como testar

1. `npm run dev` e abra direto na ação (sem andar):
   ```bash
   npm run capturar -- piano "/?usar=piano:tocarPiano&zoom=1.0&hora=16#explorar"
   ```
   No navegador, o mesmo pelo console: `__ex.testarUso('piano', 'tocarPiano')`.
2. Confira: o corpo senta/deita no lugar certo (nem afundado nem flutuando)? A parte da frente tapa só o que deve?
   O menu mostra a ação? O texto aparece no fim? Os números flutuam?
3. Teste com um NPC usando (objetos da academia/casa são usados pelos NPCs sozinhos — espere ou force `__ex.npcs`).
4. `npm run check`.

## 6. Onde NÃO mexer

- `src/explorar/controle.ts` (🔴): IA dos NPCs, rotas, roteiros do banheiro, câmera. Se o objeto precisar de um
  comportamento novo (ex.: "cozinhar deixa a panela suja até lavar"), escreva o pedido em `docs/PEDIDOS-ENGINE.md` com:
  objetivo, comportamento esperado, ids envolvidos e como testar.
