# Arquitetura do VIVA!

Visão de como o jogo funciona por dentro. Para *o que existe*, veja `CATALOGO.md`; para *regras de conteúdo*, veja `specs/`.

## 1. Camadas

```
src/
  core/        math (lerp, clamp, Ease), rng (RNG determinístico + rng global), color, audio (WebAudio sintetizado)
  character/   aparência (60+ parâmetros), rig/esqueleto, movimentos, expressões, desenho do corpo/cabeça/cabelo, Actor
  render/      primitivas vetoriais (draw), cenário (bg), objetos (props), partículas
  scenes/      ambientes (Env), Scene/Camera/Director, situações roteirizadas (SITUATIONS), Stage (loop rAF)
  game/        estado da vida (Life), eventos, ações/interações, carreiras, entrevistas, agressão, motor anual, save
  ui/          título, editor de personagem, tela de jogo (cartões, abas, HUD), retratos
scripts/       ferramentas Node: check-content (validador) e catalog (gera docs/CATALOGO.md)
```

Regra de dependência: `game/` **não desenha nada**; ele só devolve dados (`Outcome`, `SceneReq`).
`ui/game.ts` pega esses dados e manda o `Stage` tocar a cena correspondente. Por isso o validador consegue rodar toda a lógica em Node.

## 2. O ciclo de um ano

```
[+1 ANO] ──► ageUp(L)  (game/life.ts)
              ├─ envelhece todos, salário, saúde, mortes de NPC, prisão, aposentadoria
              ├─ pickEvents(L): eventos com peso >= 100 são obrigatórios; senão sorteia 0–2 por peso
              └─ YearResult { scene (casa/aniversário), notes, events[] }
                     │
ui/game.ts ──► toca a cena do ano ──► para cada evento: presentEvent(pe)
                                         ├─ ev.scene?() toca a cena de "abertura" (opcional)
                                         ├─ cartão com texto + escolhas (cond falsa = escolha desabilitada)
                                         └─ outcomeFromEvent → presentOutcome(o)
                                                ├─ addLog (diário), L.flags.moodNext = o.mood
                                                ├─ toca o.scene (se houver)
                                                ├─ applyReact(o.react): balão/expressão/movimento DEPOIS da cena
                                                ├─ cartão de resultado (a menos que o.skipCard)
                                                ├─ o.next      → outra consequência encadeada (com cena própria)
                                                └─ o.followUp  → outro evento com escolhas (cadeias, entrevistas)
```

Ações (aba Atividades) e interações (aba Relações) retornam `Outcome` (ou `PendingEvent`) e passam pelo mesmo `presentOutcome`.
A próxima cena "em casa" usa `L.flags.moodNext` (tenso/triste/ferido/feliz) para escolher animações ociosas coerentes — é assim que um soco não termina com todo mundo sorrindo.

## 3. Estado (`game/state.ts`) — zona vermelha

`Life` é serializado em JSON no `localStorage` (`game/storage.ts`). Campos principais:
`player` (Person), `stats` (felicidade/saude/inteligencia/aparencia, 0–100), `money`, `karma`, `fitness`, `fame`,
`people[]` (Person com `rel`, `bond` 0–100, `traits`, `alive`), `pets[]`, `log[]`, `edu`, `job`, `crime {ficha, preso, pena}`,
`flags` (chave → number|boolean|string: **o lugar para memória de consequências**), `assets`.

Relações (`Rel`): mae, pai, irmao, irma, amigo, amiga, namorado, namorada, conjuge, ex, filho, filha, colega (escola), avo, avoM,
chefe, colegaTrab, professor, conhecido. `hireStaff` cria chefe + 2 colegas ao conseguir emprego; `leaveJobPeople` os rebaixa
para `conhecido`; `enrollSchool` cria turma nova (2 colegas + professor).

Helpers obrigatórios: `stat(L,k,d)` e `bond(p,d)` já limitam 0–100; `addLog(L, texto, tom, ícone)`; `he(p,'ele','ela')`;
`byRel`, `partner`, `spouse`, `parents`, `children`, `friends`, `pickRandom`, `money(n)` (formata R$).

## 4. Cenas (`scenes/`)

- **Env** (ambiente): lista de `Layer {depth, static?, anim?, front?}`. `static` é desenhado uma vez e cacheado; `anim` todo quadro.
  Mundo lógico: largura útil ~1280 (de `X0=-420` a `X0+WW=1700` para parallax), chão dos pés em `GROUND = 632`,
  junção parede/chão em `FLOOR = 560`.
- **Situation**: `{ id, env, run(d: Director, c: Cast) }`. `Cast` = `player`, `others[]` (NPCs vindos de `scene.others`) e `data`.
  O `run` é um roteiro `async` que adiciona atores/objetos e encadeia `await d.walk/say/wait/act`.
- **Director** (API do roteirista): `add, walk, act, loop, say, expr, emote, look, face, prop, moveProp, fadeProp, moveActor,
  fadeActor, fx, burst, confetti, hearts, shake, flash, focus, resetCam, caption, fadeOut, fadeIn, sfx, wait`.
- **Stage**: loop `requestAnimationFrame` com watchdog; `stage.play(id, cast)` troca de cena com transição.
- `physical(d, a, b, action)` em `situations.ts`: biblioteca de interações corporais reutilizáveis (abraço, soco, tapa...).

## 5. Personagem (`character/`) — zona vermelha

- **Esqueleto (Pose)**: pelve (`x`, `y`, `rot`, `hipTilt`), coluna em 2 segmentos (`lean` lombar + `chest` peito), `breath`,
  `neck`, `head`, ombros (`shrugN/F`), braços e pernas de 2 ossos (`Limb {a, b}`), pés (`footN/F`), punhos (`wristN/F`),
  mãos (`handN/F`: aberta, punho, aponta, segura, acena, joinha), squash & stretch (`sx`, `sy`).
  Sufixo **N** = membro próximo da câmera (desenhado na frente), **F** = distante.
- **Motion**: `{ loop, dur?, fn(t) → Pose, expr?, propN?, propF?, grounded? }`. Keyframes com easing via `keyframes([[t, poseParcial, ease]])`.
  `breathe(p, t)` adiciona respiração/micro-movimento. O Actor faz crossfade entre movimentos, IK de 2 ossos e contato com o chão.
- **Face**: parâmetros contínuos (sobrancelhas, pálpebras, sorriso, boca, dentes, língua, pupila) + marcadores (lágrimas, suor,
  rubor, olhos de coração, raiva, tontura, brilho). Expressões são interpoladas.
- **Aparência**: 60+ parâmetros; `inherit` mistura genes dos pais; envelhecimento automático por idade.

## 6. Sistemas de jogo notáveis

- **Agressão** (`game/aggression.ts`): `aggress(L, p, kind)` calcula esquiva, revide, ferimento e o contexto
  (trabalho/escola/família/casal/rua) e encadeia consequências com `next`. Ver `specs/SPEC-05`.
- **Entrevistas** (`game/interviews.ts`): cada carreira tem entrevista no ambiente certo; roupa → perguntas → teste →
  probabilidade logística de contratação. Ver `specs/SPEC-05`.
- **Motor anual** (`game/life.ts`): salário, desempenho, promoções, doenças, mortes, prisão, decaimento de infrações.

## 7. Validação

`npm run check` = `tsc` + `scripts/check-content.ts`, que:
confere ids únicos; toda referência literal (cena, ambiente, movimento, expressão, objeto, emote, partícula, som);
executa **todo evento e toda escolha** em 10 perfis de vida; roda todas as ações/interações/agressões;
simula entrevistas de todas as carreiras; e simula 60 vidas completas. Qualquer texto com `undefined`/`NaN`, stat fora de 0–100
ou exceção vira erro.

## 8. Painel de QA e calibração

`painel.html` + `src/painel/` (só desenvolvimento) reaproveitam lógica, Scene/Director/atores e roteiros reais para
catálogo, esteira de eventos com semente, laboratório com busca temporal determinística e calibrador A/B. A calibração
aprovada é um arquivo de dados (`src/data/calibracao.json`) aplicado sobre `MOTIONS`/`EXPRESSIONS` por
`src/character/calibracao.ts`. Ganchos no motor para reprodução: `rng.reseed/estado`, `resetIds`, `resetActorIds`,
`keyframes().kf`, `eligible`, `registrarResultado`. Detalhes em `docs/PAINEL-QA.md`.

## 9. Build e deploy

- `npm run build` → `dist/index.html` único (vite-plugin-singlefile), funciona via `file://` (`Jogar.bat`).
- Push em `main` → GitHub Actions (`.github/workflows/pages.yml`: `check:quick` + build) → https://isaacbraym.github.io/Jogo2dPrototipo/
- Push em outros branches / PR → `.github/workflows/check.yml` (`npm run check` completo + build), sem publicar.
