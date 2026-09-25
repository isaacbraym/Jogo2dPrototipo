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
| `src/explorar/tipos.ts` | Tipos: trecho, objeto, ação, frequentador, estado salvo (`L.explorar`) | 🔴 motor |
| `src/explorar/mundo.ts` | **Dados do mundo**: `TRECHOS` (ordem e tamanho dos lugares), `OBJETOS` (+ ações), `DECORACAO`, `PINTORES` (fundos), `DESENHOS` (objetos sem prop pronta), céu/luz pela hora | 🟡 conteúdo com cuidado |
| `src/explorar/gente.ts` | **Relações no mundo**: níveis, frequentadores, interações de desconhecidos (`INTERACOES_ESTRANHO`), de contatos (`INTERACOES_CONTATO`), filtro das interações clássicas e o mínimo de vínculo de cada uma | 🟡 conteúdo com cuidado |
| `src/explorar/controle.ts` | O **mundo vivo**: movimento, relógio, necessidades, uso de objetos, IA dos NPCs, interações, fim do dia | 🔴 motor |
| `src/ui/explorar.ts` | Tela: HUD, minimapa, menus, números flutuando, diário, resumo do dia | 🔴 UI |
| `src/scenes/scene.ts` | `Scene.mundo`: fundo por trechos + limites de câmera do mundo | 🔴 motor |

## 3. Como as coisas funcionam

### Mundo e profundidade
- Eixo x: `MUNDO_X0` → `MUNDO_X1` (hoje 0 → 10 800 px). Cada trecho desenha só a sua faixa (`PINTORES[pintor]`).
- Chão onde se anda: `y` entre `CHAO_FUNDO` (598) e `CHAO_FRENTE` (702). Quanto maior o `y`, mais perto da câmera:
  a escala cresce (0,9 → 1,08) e o desenho fica na frente (tudo no mundo tem `z = 0` e é ordenado por `y`).
- Em interação direta os dois vão para a mesma linha de chão (SPEC-07 §11).

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
- Equipamentos são **exclusivos**: se alguém está usando, aparece "Ocupado por Fulano".

### Gente
| Papel | Quem | De onde vem |
|---|---|---|
| Frequentador | 7 pessoas fixas da academia (5 aparecem por dia, pela `assiduidade`) | `L.explorar.frequentadores.academia` |
| Família | quem mora com você (menor de 18: pais e irmãos; adulto: cônjuge e filhos) | `L.people` |
| Pet | seus pets vivos | `L.pets` |
| Passante | gente de passagem na rua (não fica salva) | gerado na hora |

A IA dos NPCs: usar um equipamento livre (preferem o favorito), beber água, ir ao espelho, conversar entre si (balões
`PAPO_AMBIENTE`), passear. De vez em quando um frequentador **vem puxar conversa com você**.

### Caminho da amizade
```
Desconhecido(a) ─(fam 15)→ Rosto conhecido ─(fam 35)→ Colega de academia ─(pedir o contato)→ Contato ─(vínculo 55)→ Amigo(a) ─(80)→ Melhor amigo(a)
```
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

## 4. Como ampliar (receitas)

### Um objeto novo com ações (ex.: esteira nova, piano na sala)
1. Em `OBJETOS` (`mundo.ts`), acrescente no fim: `id` único, `nome`, `prop` (de `PROPS`) **ou** `desenho` (em `DESENHOS`),
   `x`/`y` (base no chão), caixa de clique `w`/`h`, `exclusivo` se só um usa por vez.
2. Cada ação: `label`, `icon`, `minutos`, `motion` (de `MOTIONS`), onde ficar (`dx`, `dy`, `lado`, `elev` para sentar/deitar),
   `segura` (objeto de mão), `efeito` (`stats`, `nec`, `fitness`, `dinheiro`), `texto` (frase ao terminar) e `cond`
   (retorna o motivo do bloqueio ou `null`).
3. Rode `npm run dev`, abra `/#explorar`, vá até o objeto (no console: `__ex.eu.x = <x>`) e teste.

### Um lugar novo (ex.: praça, mercado)
1. Acrescente os trechos em `TRECHOS` **no fim** (o mundo cresce para a direita) com `lugar`, `pintor`, `minIdade`.
2. Escreva o pintor em `PINTORES` (use `ceu`, `predios`, `calcada`, `parede`, `piso`, `janela`, `batente`, `quadro`).
3. Coloque objetos e decoração. Se o lugar tiver gente fixa, gere os frequentadores em `garantirFrequentadores` (hoje só a
   academia) e a presença em `popularAcademia` (crie um `popular<Lugar>` análogo) — isso é motor: peça em
   `PEDIDOS-ENGINE.md` se você for agente de conteúdo.

### Uma interação nova com desconhecidos/contatos
Em `gente.ts`, acrescente em `INTERACOES_ESTRANHO` ou `INTERACOES_CONTATO`: `pode(c)` (quando aparece; use `c.hoje` para
limitar por dia) e `run(c)` devolvendo `Resultado` (`eu`, `ela` = falas; `fisico` = ação de `physical`; `reacaoNpc`,
`expr`; `social`/`diversao`; mude a familiaridade com `mudarFam`). Toda interação precisa ter consequência (regra de ouro 4).

## 5. Save

`L.explorar` (opcional; vidas antigas carregam normalmente):
`dias`, `diasNoAno`, `anoRef`, `hora`, `nec`, `usos`, `frequentadores` (por lugar), `matriculaAte`, `x`.
Frequentadores que viraram contato continuam na lista (com `contato: true`), mas a pessoa "de verdade" é a de `L.people`.

## 6. QA

- `/#explorar` (vida de 25 anos) ou botão **VIVER O DIA** numa vida existente.
- Console: `__ex.eu.x = 8300` (academia), `__ex.est.hora = 21*60; __ex.avancar(0)` (noite), `__ex.npcs` (quem está e o que faz).
- Verificar: clique em objeto abre menu; ação mostra barra e números; NPCs trocam de aparelho; pedir contato leva a pessoa à
  aba Relações; abraço/beijo acontecem no mundo; fim do dia mostra resumo e volta à vida.

## 7. Próximos passos (ideias)

- Mais lugares: praça, mercado, escola/faculdade, trabalho (bater ponto!), balada à noite.
- Convidar um contato para ir junto (NPC seguindo você), visitas em casa, telefone para marcar encontros.
- Rotina dos NPCs por horário (quem treina de manhã × à noite), clima (chuva), eventos aleatórios no mundo.
- Trabalho e escola "de verdade" no mundo, usando o relógio.
