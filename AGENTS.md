# AGENTS.md — VIVA! (simulador de vida 2D)

Guia obrigatório para **qualquer agente** (GPT/Luna, Codex, Claude, Gemini...) que trabalhe neste projeto.
Leia este arquivo inteiro antes de editar. Ele tem prioridade sobre `C:\PROJETOS\AGENTS.md`.

## 1. Identidade do projeto

| | |
|---|---|
| Nome | **VIVA! — Uma vida, mil escolhas** |
| Pasta local | `C:\PROJETOS\Prototipo_Game2d` |
| Repositório | **https://github.com/isaacbraym/Jogo2dPrototipo** (branch `main`) |
| Jogo online | **https://isaacbraym.github.io/Jogo2dPrototipo/** |
| Deploy | Automático: todo push em `main` roda `.github/workflows/pages.yml` (validador rápido → build Vite → GitHub Pages, ~1 min). Se o validador falhar, o site **não** é atualizado. |
| CI de branches | `.github/workflows/check.yml` roda `npm run check` + build em qualquer branch ≠ main (ex.: `luna/*`) e em pull requests. |
| Stack | TypeScript + Vite 8 + Canvas 2D próprio. Zero assets: tudo é desenhado por código. |
| Idioma | Código, comentários, textos e docs em **português do Brasil**. |

## 2. Comandos

```bash
npm install          # uma vez
npm run dev          # http://localhost:5199 (hot reload)
npm run check        # OBRIGATÓRIO antes de todo commit: typecheck + validador de conteúdo
npm run check:quick  # validador rápido (durante o trabalho)
npm run catalog      # regenera docs/CATALOGO.md (rode após adicionar conteúdo)
npm run build        # gera dist/index.html (arquivo único, abre via file://)
npm run painel       # Painel de QA local: http://localhost:5199/painel.html (catálogo, esteira, laboratório, calibrador)
```

**Painel de QA** (`docs/PAINEL-QA.md`): encontre qualquer id, execute eventos/interações sem sorteio (com semente), veja cenas
e movimentos quadro a quadro com esqueleto, compare A/B e gere "pedidos para Luna". Agentes de conteúdo entregam ajustes
numéricos de movimento/expressão como **propostas** em `qa/propostas/` (formato `viva-proposta`) e casos de reprodução em
`qa/cenarios/` — nunca editando `src/data/calibracao.json` à mão (quem aplica é o usuário, pelo painel).

Harness visual (com `npm run dev` rodando):
- Cena: `http://localhost:5199/?test&sit=<idCena>&age=30&at=4&data=<json-url-encoded>` (congela no segundo `at`)
- Galeria/movimento: `http://localhost:5199/?test&env=<idAmbiente>&n=3&m=<movimento>&expr=<expressao>`
- Jogo rápido com personagem aleatório de 25 anos: `http://localhost:5199/#demo`

## 3. Mapa da documentação

| Documento | Para quê |
|---|---|
| `docs/ARQUITETURA.md` | Como o jogo funciona por dentro (fluxo do ano, cenas, renderização, rig). |
| `docs/CATALOGO.md` | **Gerado.** Lista oficial de tudo que existe (eventos, cenas, movimentos, expressões, ambientes, objetos, flags). Consulte antes de criar nomes. |
| `docs/specs/` | Contratos e regras de cada tipo de conteúdo (o que é válido, limites, balanceamento, tom). |
| `.agents/skills/` | Receitas passo a passo para tarefas recorrentes (criar evento, cena, animação, ambiente, interação, humor, verificação). |
| `docs/CHANGELOG.md` | Histórico de mudanças. **Todo lote de trabalho adiciona uma entrada.** |
| `docs/BACKLOG.md` | Ideias priorizadas de conteúdo esperando alguém implementar. |
| `docs/PEDIDOS-ENGINE.md` | Fila de pedidos de mudanças no motor (zona vermelha) para o agente de lógica. |
| `docs/DELEGACAO-LUNA.md` | Divisão de trabalho entre agentes e o prompt de delegação. |
| `docs/RELACIONAMENTOS.md` | Mapa do sistema de relacionamentos (memória, namoro, casamento, divórcio): feito × falta × analisar, e regras para conteúdo. |
| `docs/PAINEL-QA.md` | Painel de QA: uso, formatos de cenário/proposta/calibração, limites de edição, procedimento "localizar pelo ID". |

## 4. Zonas de edição

**🟢 Verde — pode adicionar livremente (sempre *acrescentando* no fim das listas):**
- `src/game/events.ts` → novos itens em `EVENTS`
- `src/game/activities.ts` → novos itens em `ACTIONS` / `INTERACTIONS`
- `src/game/interviews.ts` → novas perguntas (`GENERIC`, `questions`), testes, frases de reprovação
- `src/game/names.ts`, `src/game/achievements.ts` → novas entradas
- `src/scenes/situations.ts` → novas situações no array `S` e novos `case` em `physical()`
- `src/character/motions.ts` → novos movimentos num bloco `Object.assign(MOTIONS, {...})` no fim do arquivo
- `src/character/expressions.ts` → novas entradas em `EXPRESSIONS`
- `src/scenes/environments.ts` → novo `const x: Env` + registrar em `ENVS`
- `src/render/props.ts` → novas entradas em `PROPS` (cenário) e `HELD` (objetos de mão)
- `docs/**` (exceto `CATALOGO.md`, que é gerado)
- `qa/propostas/*.json` (propostas de calibração) e `qa/cenarios/*.json` (casos de reprodução) — o `npm run check` valida

**🟡 Amarela — pode alterar com cuidado e justificar no CHANGELOG:**
- Textos e números de balanceamento de conteúdo já existente.
- `src/game/aggression.ts` (novos tipos em `AGGRO` exigem também um `case` na cena `agressao`).
- `src/game/careers.ts` → nova carreira só junto com a entrevista dela em `INTERVIEWS` (o validador exige).
- Novas chaves em `L.flags` (documente em `docs/specs/SPEC-01-eventos-e-consequencias.md`).

**🔴 Vermelha — NÃO editar. Se precisar, registre em `docs/PEDIDOS-ENGINE.md`:**
- `src/character/{rig,character,body,head,hair,actor,appearance,rc,palette}.ts` (esqueleto, desenho, IK)
- `src/scenes/{scene,stage}.ts`, `src/render/{draw,bg,particles}.ts` (motor de cena/câmera/render)
- `src/game/{state,types,life,storage,relacoes}.ts` (formato do save, motor anual, tipos, memória de relacionamento)
- `src/ui/**`, `src/main.ts`, `src/test.ts`, `index.html`
- `package.json`, `tsconfig.json`, `vite.config.ts`, `.github/**`, `scripts/**`
- Painel de QA: `painel.html`, `src/painel/**`, `src/qa/**`, `src/character/calibracao.ts`
- `src/data/calibracao.json` e `qa/auditoria.jsonl` — só o painel escreve (validado, com diff, motivo e auditoria)

Mudar a zona vermelha pode quebrar saves de jogadores ou o desenho de todos os personagens.

## 5. Regras de ouro

1. **Nunca renomeie nem apague** ids existentes (eventos, cenas, movimentos, expressões, ambientes, flags). Saves e outros conteúdos dependem deles.
2. **Ids novos** em camelCase, sem acento, únicos (confira em `docs/CATALOGO.md`).
3. Use sempre os helpers: `stat(L, k, d)`, `bond(p, d)`, `addLog(...)`, `rng.*` (nunca `Math.random` em conteúdo de jogo).
4. Toda escolha precisa ter **consequência real** (stat, vínculo, dinheiro, flag, cena ou evento futuro). Escolha que não muda nada é bug de design.
5. Texto do jogador usa gênero neutro com `(a)`: "Você foi demitido(a)". Para NPC use `he(p, 'ele', 'ela')`.
6. Humor: ácido, humor negro brasileiro — **dentro dos limites** de `docs/specs/SPEC-06-humor-e-tom.md` (sem ofensa a grupos, nada sexual com menores, nada de pessoas/marcas reais).
7. Violência tem consequência. O jogo nunca recompensa agressão sem custo.
8. `npm run check` precisa passar **sem erros** antes de cada commit. Avisos de cobertura podem ser aceitos se explicados.
9. Um commit por lote temático, mensagem em português: `feat(conteudo): 6 eventos de trabalho + cena reuniaoZoom`.
10. **Não faça push em `main` e não mude o GitHub** sem autorização explícita do usuário. Trabalhe num branch `luna/<tema>`.

## 6. Documentação obrigatória a cada lote

- [ ] Entrada nova em `docs/CHANGELOG.md` (data, autor/agente, lista do que foi criado com ids).
- [ ] `npm run catalog` executado (atualiza `docs/CATALOGO.md`).
- [ ] Flags novas descritas na tabela de flags da SPEC-01.
- [ ] Itens do `docs/BACKLOG.md` implementados marcados como feitos (`[x]`) com o id criado.
- [ ] Pedidos de engine (se houver) em `docs/PEDIDOS-ENGINE.md`.
- [ ] Comentário curto (1 linha) acima de cada situação/movimento/ambiente novo dizendo o que é.
