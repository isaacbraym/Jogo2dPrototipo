# 01 · Padrão de qualidade — a régua de tudo

O VIVA! é **100 % desenhado por código** (Canvas 2D, zero imagens). O charme vem de: formas simples e limpas, cores
saturadas mas harmônicas, **profundidade 2,5D coerente**, escala que faz sentido e muitos pequenos detalhes vivos
(luz que muda com a hora, água girando na descarga, lona da esteira correndo). Se o seu trabalho não parecer que
**sempre esteve lá**, ainda não terminou.

## 1. Escala (a regra que mais quebra)

`M = 170` px por metro (em `src/explorar/moveis.ts`). Os personagens são **estilizados**: cabeça grande, adulto com
~350 px de altura, mas **pernas de proporção real** (quadril a ~0,9 m, joelho a ~0,5 m). Por isso:

- **Alturas** seguem o metro de verdade (é onde as pernas encostam):

  | Coisa | Altura real | Em px (`× M`) |
  |---|---|---|
  | assento de cadeira/sofá/banco/vaso | 0,42–0,48 m | 71–82 |
  | selim da bike ergométrica | 0,66 m | 112 |
  | colchão (topo) | 0,52 m | 88 |
  | mesa, escrivaninha, bancada | 0,76–0,90 m | 129–153 |
  | pia | 0,85 m | 145 |
  | porta | 2,1 m (fachada: ~460 px) | — |
  | pé-direito interno | teto em `y = 95`, chão do fundo em `y = 560` | — |

- **Comprimentos** de coisas onde o corpo inteiro deita ou senta são **maiores que o real** (o corpo estilizado é
  comprido): cama **2,6 m**, sofá **2,5 m**, banco da praça **2,3 m**, esteira **2,3 m**, supino **1,8 m**. Uma pessoa
  deitada precisa caber inteira, com folga na cabeça e nos pés.
- Objetos pequenos (caneca, livro, controle) seguem a mão do personagem, não o metro — veja `HELD` em `src/render/props.ts`.

> ❌ Erros que o usuário já apontou e **não podem voltar**: personagem sentado "no invisível" (mesa/computador sem cadeira),
> cama pequena para o corpo, banco da praça pequeno, gente correndo "por cima" da esteira, objetos chapados sem profundidade.

## 2. Profundidade 2,5D

- **Eixo y do mundo = distância da câmera.** Maior `y` = mais perto = desenhado depois e maior (`escalaProf(y)`:
  0,8 no fundo → ~1,25 na rua). Isso vale para gente **e** objetos (o controlador aplica a escala sozinho).
- **Projeção oblíqua leve** para todo volume: a profundidade vai para **cima e para a direita**
  (`OX = 0,24`, `OY = −0,52` por px de profundidade). Todo móvel mostra **frente + topo + lateral direita**.
  Use `caixa(ctx, x, yBase, largura, altura, profundidade, cores)` — ela já faz as três faces e o contorno.
- Coisas encostadas na parede do fundo ficam com `y` baixo (~610–630); coisas no meio do cômodo, `y` ~650–700; tapetes
  e itens bem na frente, `y` ~730–740.
- **Gente dentro de móvel** (sentada, deitada, correndo na esteira) = o móvel em **partes**: a de trás desenhada antes da
  pessoa e a da frente depois (mesa, edredom, painel da esteira). Veja o guia 02.

## 3. Estilo de desenho

- **Contorno**: 1,6 px na cor da face escurecida (`shade(cor, −0.5)`). `caixa()` já faz. Nada de preto puro.
- **Faces**: topo mais claro (`shade(cor, +0.14)`), lateral mais escura (`shade(cor, −0.2)`). Uma única luz vinda da
  esquerda-alto.
- **Sombra de contato** sob tudo que toca o chão: `sombra(ctx, x, largura, profundidade, alpha)` (elipse suave, 0,14–0,28).
- **Paleta base** (repita estas antes de inventar): amarelo `#f2c14e`, vermelho `#e63956`, azul `#3d7bd9`, verde
  `#58b368`, roxo `#7c5cff`, laranja `#e8845a`, rosa `#e87a90`, creme `#f4efe6`, madeira `#8a5a3a`/`#6b4a2a`,
  grafite `#2b2d3a`/`#3a3d4f`, cinza `#9aa0b0`, metal `#c9d2d4`. Mais escuro/claro: `shade(cor, ±k)` (`src/core/color`).
- **Detalhe com propósito**: 2–4 detalhes por móvel (puxadores, costura, tela acesa, estampa). Não encha de ruído.
- **Vida**: algo que se mexe com `t` quando fizer sentido (tela da TV, lona da esteira, chafariz, ventilador). Nada que
  pisque rápido demais (máx. ~2 Hz).
- **Luz pela hora**: use `luz(hora)` (`noite`, `entardecer`) para acender janelas, postes, faróis e abajures.

## 4. Composição de um ambiente

Cada cômodo/lugar tem **4 camadas**, e todas precisam de algo:

1. **Parede do fundo** (pintor): cor + textura (listras, azulejo, tijolo), rodapé, meia-parede, 1–2 quadros ou janela,
   luminária de teto. Ver `parede()`, `janela()`, `quadro()`, `luminariaTeto()` em `mundo.ts`.
2. **Chão** (pintor): piso com junta em perspectiva — `piso(ctx, x0, x1, 'madeira' | 'ceramica' | 'azulejo' | 'borracha' | 'calcada' | 'grama' | 'pedra', cor1, cor2)`.
3. **Móveis com função** (OBJETOS): 2 a 4 por cômodo, cada um com ação útil.
4. **Decoração sem ação** (DECORACAO): tapete, planta, abajur, lixeira... 2–4 por cômodo.

Densidade de referência: um móvel grande a cada ~300–400 px de x, sem sobreposição que esconda o uso (a cadeira não pode
ficar atrás do edredom da cama — já aconteceu). Deixe **corredor livre** no `y` ~700–740 para as pessoas andarem.

## 5. Texto e tom

- Português do Brasil, frases curtas, humor ácido e carinhoso. Exemplos do tom certo: "Cinco quilômetros. Ou quatro.
  O visor está mentindo?", "Ninguém atende orelhão desde 2004.", "Devolva os halteres. Por favor. Estamos implorando."
- Placas e letreiros podem ter piada; nomes de lojas são inventados (nada de marcas reais).
- Jogador em gênero neutro `(a)`; NPC com `he(p, 'ele', 'ela')`.

## 6. Checklist de qualidade (passe item por item antes de entregar)

- [ ] Escala: comparei com um personagem adulto na captura (senta no assento, deita inteiro, alcança a mesa).
- [ ] Profundidade: frente + topo + lateral; sombra no chão; partes na frente/atrás certas quando alguém usa.
- [ ] Cores da paleta, contorno suave, luz da esquerda. Nada de preto puro/branco puro em áreas grandes.
- [ ] Funciona de dia **e** de noite (capture `hora=21`).
- [ ] Funciona com a câmera perto (`zoom=1.2`) **e** longe (`zoom=0.55`).
- [ ] Nada sobrepõe algo que o jogador precisa ver/clicar.
- [ ] Texto revisado (acentos, `(a)`, tom).
- [ ] `npm run check` passou; captura antes/depois no chat.
