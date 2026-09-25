# Modo Explorar — o mundo contínuo do VIVA!

> Leia inteiro antes de mexer em `src/explorar/`. Regras de zona do `AGENTS.md` continuam valendo.

## 1. O que é

Até aqui o VIVA! era "clicar numa ação → a cena troca de ambiente → anima → ganha status". O **modo Explorar** é um
mundo **contínuo** estilo *The Sims*, em 2,5D:

- você **anda com o mouse/toque** (clique no chão; duplo clique corre) ou **teclado** (setas/WASD, Shift corre);
- a casa, a rua e a academia são **uma linha só**: sai do quarto, passa pelo banheiro, cozinha, sala, atravessa a porta
  e já está na calçada; mais adiante, a academia. Sem teleporte (o ônibus é o atalho, R$ 5);
- **objetos têm ações** (cama, escrivaninha, geladeira, fogão, sofá, TV, estante, esteiras, supino, halteres...);
- há **relógio** (o dia começa às 7h) e **necessidades** (Energia, Fome, Diversão, Social) que caem com o tempo;
- **gente de verdade**: frequentadores da academia que você **reencontra** (eles persistem no save e envelhecem com você),
  família em casa, pets, passantes na rua;
- interações acontecem **no próprio mundo**, usando o sistema de contato do motor (abraço, beijo, aperto de mão,
  toca-aqui — SPEC-07), sem trocar de cena.

Entrada: botão verde **VIVER O DIA** na tela da vida (a partir de 4 anos). Atalho de teste: `http://localhost:5199/#explorar`
(vida aleatória de 25 anos). No console: `window.__ex` é o controlador (posição, NPCs, estado).

## 2. Mapa do código

| Arquivo | O quê | Zona |
|---|---|---|
| `src/explorar/tipos.ts` | Tipos: trecho, zona, objeto (partes, vagas), ação (assento, plataforma, giro), frequentador, estado salvo (`L.explorar`) | 🔴 motor |
| `src/explorar/mundo.ts` | **Dados do mundo**: `TRECHOS` (fundos), `ZONAS` (onde se anda + passagens), `OBJETOS` (+ ações), `DECORACAO`, `FACHADAS`, `PINTORES`, `pintarRua`, céu/luz pela hora, `escalaProf`, `rota` | 🟡 conteúdo com cuidado |
| `src/explorar/moveis.ts` | **Biblioteca de móveis 2,5D** em escala real (`M` = 170 px/m, projeção oblíqua `OX`/`OY`, `caixa()`, `sombra()`): cama, escrivaninha, cadeiras, sofá, vaso, box, esteira, supino, rack de halteres, carro... | 🟢 pode acrescentar |
| `src/explorar/gente.ts` | **Relações no mundo**: níveis, frequentadores, interações de desconhecidos (`INTERACOES_ESTRANHO`), de contatos (`INTERACOES_CONTATO`), de passantes (`INTERACOES_PASSANTE`), falas de ambiente (`PAPO_AMBIENTE`, `FALAS_CASA`), filtro das interações clássicas e o mínimo de vínculo de cada uma | 🟡 conteúdo com cuidado |
| `src/explorar/controle.ts` | O **mundo vivo**: movimento, relógio, necessidades, uso de objetos, IA dos NPCs, interações, fim do dia | 🔴 motor |
| `src/ui/explorar.ts` | Tela: HUD, minimapa, menus, números flutuando, diário, resumo do dia | 🔴 UI |
| `src/scenes/scene.ts` | `Scene.mundo`: fundo por trechos + limites de câmera do mundo | 🔴 motor |

## 3. Como as coisas funcionam

### Mundo e profundidade (v2 — "casa de bonecas")
Uma rua contínua vista de frente, com **profundidade de verdade** (eixo y do mundo = distância da câmera):

```
 y   95 ─ 560   parede do fundo dos interiores / céu e prédios lá fora
 y  560 ─ 750   chão dos interiores (casa, academia) e da praça  ← zona 'casa' / 'academia' / 'praca'
 y  750          FACHADAS (casa, academia, lojas). Somem quando você entra (corte estilo The Sims)
 y  750 ─ 805   jardim + caminho de pedra até a porta             ← zonas 'portaCasa' / 'portaAcademia'
 y  805 ─ 892   CALÇADA contínua de ponta a ponta                  ← zona 'calcada' (passantes andam aqui)
 y  898 ─ 1000  rua com carros
 x   0 vizinho · 300–3600 casa (quarto, banheiro, cozinha, sala) · 3600–5900 praça (+ ponto de ônibus)
     5900–8900 academia (cardio | musculação) · 8900–11200 comércio (padaria, farmácia — fachadas)
```

- **Zonas** (`ZONAS`): retângulos onde se anda. Zonas que se sobrepõem se ligam (a sobreposição é a porta). `rota()` faz
  uma busca em largura entre zonas e devolve os pontos do caminho: do quarto até a praça o personagem sai pela porta, desce
  o caminho do jardim, anda na calçada e entra na praça. `minIdade` por zona (rua ≥ 8, academia ≥ 14).
- **Escala da profundidade** (`escalaProf(y)` = 0,8 no fundo → ~1,25 na rua) vale para gente **e** objetos (os móveis
  recebem a escala do seu `y`). Ordem de desenho: tudo com `z = 0`, ordenado por `y` (ou por `PlacedProp.ordem`).
- **Fachadas** (`FACHADAS`) são props na linha `y = 750`. A do prédio onde você está vai a 6 % de opacidade (e as coisas
  entre a câmera e o prédio — muro, postes, gente na calçada — ficam translúcidas). Clicar na fachada leva até a porta.
- **Câmera**: segue em x **e** em y (dentro: do teto ao jardim; fora: fachada e calçada). **Zoom** pela roda do mouse
  ou pelos botões **+ / −** (0,5 a 1,4) — afastar mostra vários cômodos e a rua de uma vez.
- Em interação direta os dois vão para a mesma linha de chão (SPEC-07 §11).

### Móveis em escala e "gente dentro do móvel"
- Personagens são estilizados (cabeça grande): um adulto tem ~350 px de altura, mas as **pernas** medem como gente real
  (~0,9 m). Por isso **alturas** seguem o metro (`M` = 170 px: assento 0,47 m, mesa 0,76 m, colchão 0,52 m) e
  **comprimentos** de coisas onde o corpo inteiro deita/senta são maiores (cama 2,6 m, sofá 2,5 m, banco 2,3 m, esteira 2,3 m,
  supino 1,8 m).
- **`assento`** (m): o controlador calcula a elevação para a pelve de *cada* corpo cair no assento (`alturaPelve`) — nada
  de sentar no ar. **`plataforma`** (m): altura da superfície onde a pessoa fica em pé/deitada (colchão, lona da esteira,
  banco do supino). **`giro`**: 0 = de frente para a câmera (sofá), 0,72 = ¾ (padrão).
- **`partes`**: um móvel desenhado em pedaços. Sem `frente` = atrás de quem usa; `frente: true` = por cima (a mesa na frente
  de quem senta, o edredom cobrindo quem dorme, o painel/corrimão da esteira na frente de quem corre).
- **`vagas`**: vários lugares no mesmo objeto (rack de halteres = 3 pessoas ao mesmo tempo). Objetos `exclusivo` sem vagas
  continuam "Ocupado por Fulano".

### Tempo e necessidades
- Andando: `MIN_POR_SEG` = 1,5 min de jogo por segundo. Usando um objeto: **avanço rápido** (`minutos / AVANCO` segundos,
  mínimo 2,4 s) com barra de progresso.
- Queda por hora (`QUEDA_HORA`): energia 3,2 · fome 5 · diversão 3 · social 2,4. Fome < 12 tira saúde; social < 10 tira
  felicidade. Energia < 10 deixa o passo lento e bloqueia treinos.
- O dia termina ao **dormir** (energia cheia), ao clicar em **Encerrar o dia** ou às **2h** (apagou de sono). Aparece o
  resumo (stats, dinheiro, forma física, quem conheceu, contatos novos).

### Retorno decrescente (anti-farm)
- Cada ação conta usos **no ano de vida** (`L.explorar.usos`). Ganho × `1/(1 + usos × 0,1)`. Ao fazer aniversário (+1 ANO),
  zera.

### Academia
- Aberta das 6h às 23h. Precisa de **matrícula** na recepção (R$ 120, vale o ano de vida atual). A partir de 14 anos.
- Equipamentos de uso único (esteira, bike, supino) são **exclusivos**: se alguém está usando, aparece "Ocupado por
  Fulano". O **rack de halteres tem 3 vagas**: dá para treinar do lado de quem já está lá.
- Supino: deitado no banco com a barra entre as mãos (a barra é desenhada pelo controlador); bike: `pedalar` no selim.

### Gente
| Papel | Quem | De onde vem |
|---|---|---|
| Frequentador | 7 pessoas fixas da academia (5 aparecem por dia, pela `assiduidade`) | `L.explorar.frequentadores.academia` |
| Morador do bairro | cerca de 10 pessoas persistentes da rua; parte aparece por dia, senta nos bancos, olha o chafariz ou passeia pela praça/calçada | `L.explorar.frequentadores.rua` |
| Família | quem mora com você (menor de 18: pais e irmãos; adulto: cônjuge e filhos) | `L.people` |
| Pet | seus pets vivos | `L.pets` |
| Passante | gente anônima de passagem **na calçada**, de ponta a ponta da rua (nunca entra nas casas; não fica salva). Continua existindo, mas em menor quantidade que antes | gerado na hora |

A IA dos NPCs da academia continua usando equipamentos livres, bebendo água, indo ao espelho e conversando. Moradores
do bairro têm rotina própria de praça/calçada; ao serem abordados durante uma caminhada, param para conversar e depois
retomam o destino. Frequentadores da academia e moradores podem **puxar conversa com você** por iniciativa própria.

### Caminho da amizade
```
Desconhecido(a) ─(fam 15)→ Rosto conhecido ─(fam 35)→ Colega de academia ─(pedir o contato)→ Contato ─(vínculo 55)→ Amigo(a) ─(80)→ Melhor amigo(a)
```
- Na rua, a mesma faixa de familiaridade usa o nome **Conhecido(a) do bairro** no nível 2; a lógica 15/35 e o caminho até
  virar contato permanecem os mesmos.
- Antes do contato: **familiaridade** (`Frequentador.fam`, 0–100). Interações: cumprimentar, se apresentar (aprende o nome),
  puxar papo sobre o treino, elogiar, pedir dica, piada, toca aqui. Personalidade importa (`tímido`, `rabugento`,
  `engraçado`, `gentil`...). Repetir o mesmo gesto no dia pode **piorar** (elogio duas vezes vira esquisito).
- **Pedir o contato** (familiaridade ≥ 35 e nome conhecido): chance por familiaridade, aparência, felicidade e
  personalidade. Se aceitar, a pessoa entra em **`L.people`** (aparece na aba **Relações** com o grau "Conhecido(a)"). Se
  recusar, só dá para tentar de novo em outro dia.
- Depois do contato: vínculo e memória normais (`bond`, `memo`, SPEC de relacionamentos). O menu mistura interações novas do
  mundo (treinar juntos) com as **clássicas** (conversar, elogiar, abraçar, dançar, presente, paquerar, encontro, beijar...),
  que **vão destravando com o vínculo** (`VINCULO_MINIMO`). Com vínculo 55 o contato vira **amigo(a)** automaticamente.
- Interações clássicas usam o mesmo `run` da aba Relações (com recusa por mágoa/medo) e a animação acontece no mundo.

### Banheiro (público adulto, estilizado)
- **Chuveiro** (`roteiroBanho`): entra no box → tira a roupa (adultos) → abre a água (vapor, som) → lava o cabelo (espuma) →
  ensaboa o corpo → enxágua → fecha → seca com a toalha → se veste. ~21 s reais, 20 min de jogo. Higiene vai a 100.
- **Vaso** (`roteiroVaso`): **nº 1** — homem em pé (levanta a tampa, jato, sacudida; às vezes esquece a tampa levantada);
  mulher sentada (abaixa a roupa de baixo, papel). **nº 2** — sentado(a), "três minutinhos no zap", força (suor, rosto
  vermelho), alívio, papel duas vezes. Sempre dá descarga (água girando). Bexiga vai a 100.
- **Pia**: lavar as mãos. Quem usa o vaso e não lava fica com `maosSujas`: no aperto de mão/toca aqui as pessoas reparam.
- **Necessidades novas**: Higiene (cai 2,2/h; treino suja) e Bexiga (cai 7/h; beber água enche). Bexiga zerada = acidente
  (higiene 5, felicidade −4, quem está perto ri e perde familiaridade). Higiene < 18 = cheiro visível e as pessoas comentam.

**Regras de conteúdo (obrigatórias para qualquer agente):**
1. **Sem detalhes íntimos, nunca.** O traje `nu` (`TOP_SPECS.nu` + `bottom 'nu'`) é pele lisa estilo boneco. Não desenhe
   genitais, mamilos ou detalhes sexuais. O vidro do box tem faixa jateada que acompanha o corpo (peito às coxas).
2. **Nudez só com adultos** (`IDADE_NUDEZ` = 18 em `controle.ts`). Menores: cortina opaca no box e a roupa **nunca** muda
   (a função `roupa()` não faz nada para menores). No vaso, menores continuam vestidos.
3. **Nada sexual** nesses roteiros. Banheiro é humor de situação (celular no vaso, xampu no olho), não conteúdo erótico.
4. **Todo roteiro termina vestido**: `rodarRoteiro` devolve a roupa guardada no `finally`, mesmo se algo falhar.

## 4. Como ampliar (receitas)

> Receitas passo a passo, padrão de qualidade e checklist para outros agentes: **`instrucoesCodex/`**.

### Um móvel novo (desenho)
1. Em `moveis.ts`, escreva `function nome(ctx, o, t)` com origem no **centro da borda de baixo da frente** e medidas em
   metros × `M`. Use `caixa(ctx, x, yBase, largura, altura, profundidade, { frente, topo?, lado? })` para volumes e
   `sombra()` no chão. Registre em `MOVEIS`. Se alguém usa o móvel "por dentro", divida em partes (ex.: `esteira` +
   `esteiraFrente`).

### Um objeto novo com ações (ex.: piano na sala)
1. Em `OBJETOS` (`mundo.ts`), acrescente: `id` único, `nome`, `desenho` (de `MOVEIS`) ou `partes`, `x`/`y` (base da frente
   no chão; o `y` define a profundidade e a escala), caixa de clique `w`/`h`, `exclusivo` / `vagas`.
2. Cada ação: `label`, `icon`, `minutos`, `motion` (de `MOTIONS`), onde ficar (`dx` em px do desenho, `dy` em y do mundo,
   `lado`), **`assento`** ou **`plataforma`** (m) e `giro`, `segura` (objeto de mão), `efeito`, `texto` e `cond`.
3. Teste sem andar: no console `__ex.testarUso('<idObjeto>', '<idAcao>')` (teleporta e começa a ação na hora).

### Um lugar novo (ex.: mercado)
1. Trecho em `TRECHOS` (fundo e nome), zona(s) em `ZONAS` (lembre da **porta**: uma zona pequena que encosta no interior
   e na calçada), fachada em `FACHADAS` (com `predio` se for possível entrar) e o jardim em `pintarRua`.
2. Pintor em `PINTORES` (use `parede`, `piso`, `janela`, `batente`, `quadro`, `luminariaTeto`, `predios`, `ceu`).
3. Objetos e decoração. Gente fixa (frequentadores) é motor: peça em `PEDIDOS-ENGINE.md` se você for agente de conteúdo.

### Uma interação nova com desconhecidos/contatos
Em `gente.ts`, acrescente em `INTERACOES_ESTRANHO` ou `INTERACOES_CONTATO`: `pode(c)` (quando aparece; use `c.hoje` para
limitar por dia) e `run(c)` devolvendo `Resultado` (`eu`, `ela` = falas; `fisico` = ação de `physical`; `reacaoNpc`,
`expr`; `social`/`diversao`; mude a familiaridade com `mudarFam`). Toda interação precisa ter consequência (regra de ouro 4).

## 5. Save

`L.explorar` (opcional; vidas antigas carregam normalmente):
`dias`, `diasNoAno`, `anoRef`, `hora`, `nec`, `usos`, `frequentadores` (por lugar), `matriculaAte`, `x`, `y`.
Posições salvas por versões antigas caem no ponto andável mais próximo (`pontoAndavel`).
Frequentadores que viraram contato continuam na lista (com `contato: true`), mas a pessoa "de verdade" é a de `L.people`.

## 6. QA

- `/#explorar` (vida de 25 anos) ou botão **VIVER O DIA** numa vida existente.
- Por URL (capturas headless): `/?ex=x,y&zoom=0.6&hora=21&usar=obj:acao&idade=30#explorar` — roteiro pronto:
  `npm run capturar -- --roteiro qa/roteiros/explorar.json` (11 telas: casa de longe, cama, escrivaninha, mesa, sofá,
  fachada, praça, esteira, supino, halteres, rua à noite).
- Console: `__ex.eu.x = 8300; __ex.eu.y = 720` (academia), `__ex.eu.y = 850` (calçada), `__ex.zoom = 0.55` (câmera
  longe), `__ex.est.hora = 21*60; __ex.avancar(0)` (noite), `__ex.testarUso('supino1')`, `__ex.npcs`, `__ex.carros`.
- Verificar: clique em objeto abre menu; ação mostra barra e números; NPCs trocam de aparelho; pedir contato leva a pessoa à
  aba Relações; abraço/beijo acontecem no mundo; fim do dia mostra resumo e volta à vida.

## 7. Próximos passos (ideias)

- Mais lugares: mercado, padaria e farmácia com interior, escola/faculdade, trabalho (bater ponto!), balada à noite.
- Diálogos de rua mais ricos (hoje: cumprimentar e perguntar as horas).
- Convidar um contato para ir junto (NPC seguindo você), visitas em casa, telefone para marcar encontros.
- Rotina dos NPCs por horário (quem treina de manhã × à noite), clima (chuva), eventos aleatórios no mundo.
- Trabalho e escola "de verdade" no mundo, usando o relógio.
