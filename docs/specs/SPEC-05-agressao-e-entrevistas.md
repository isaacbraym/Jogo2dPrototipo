# SPEC-05 — Sistemas de agressão e de entrevistas

## 1. Agressão — `src/game/aggression.ts` (zona amarela)

`aggress(L, p, kind) → Outcome` (com cadeia `next`). As interações `agg_<tipo>` são geradas automaticamente a partir de `AGGRO`
(grupo "Agressão" na aba Relações).

### Fluxo
1. **Contexto** (`contextOf`): `trabalho` (chefe/colegaTrab), `escola` (colega/professor, < 18), `familia`, `casal`, `rua`.
2. **Sorteios**: esquiva (sev ≥ 3; favorece vítimas jovens e agressor sem condicionamento) → ferimento da vítima
   (sev ≥ 4; frágeis > 70 ou < 8 anos se machucam mais) → revide (depende de traços `rabugento/mandão/ciumento/aventureiro`
   vs `tímido/gentil`, severidade, esquiva; criança contra pai/mãe e vítimas frágeis não revidam) → roubo (sucesso/flagrante).
3. **Efeitos imediatos**: vínculo −(sev×9+3..10), karma −sev×3, dinheiro (roubo), saúde/aparência do agressor se houve revide.
4. **Cena** `agressao` com `data {kind, env, retaliate, injured, dodged, caught, ctx}` + `mood` ferido/tenso.
5. **Consequências encadeadas** (`next`):
   - surra com saúde < 25 → pronto-socorro (−R$ 1.200);
   - **escola**: `infracoes` += 1 (sev ≥ 2) ou 0,5 → < 3 detenção · ≥ 3 suspensão · ≥ 5 **expulsão** (troca de escola, nota −25);
     infrações decaem 1 por ano;
   - **trabalho**: advertência (`advertencias`); agredir o chefe → 55–90% de justa causa; colega → 2ª advertência ou sev ≥ 3 (60%)
     = justa causa com segurança escoltando até a porta;
   - **família**: todos os parentes perdem vínculo; criança agressora → castigo;
   - **casal** (sev ≥ 3): término imediato (vira `ex`);
   - **adulto** (sev ≥ 3 ou flagrante de roubo): chance de B.O. + multa + ficha; com ferimento e ficha ≥ 3 (ou 25%) → julgamento,
     prisão de 1–3 anos e perda do emprego.

### Como adicionar um tipo novo de agressão
1. Acrescente o id no tipo `AggroKind` e em `AGGRO` (`sev` 1–5, `label`, `icon`).
2. Acrescente a frase em `verb` dentro de `aggress` (o TypeScript obriga).
3. Acrescente o `case '<tipo>'` na cena `agressao` em `situations.ts` (ação + reação da vítima + reação do agressor).
4. `npm run check` — a interação `agg_<tipo>` aparece sozinha.

Regras: agressão **nunca** dá ganho líquido sem risco; a vítima sempre reage (dor, choque, choro, raiva); o agressor nunca sorri
depois (no máximo deboche `desprezo` em provocações leves de sev 1).

## 2. Entrevistas — `src/game/interviews.ts` (zona verde para conteúdo)

`startInterview(L, carreira) → PendingEvent` monta a cadeia:

```
Roupa (terno / arrumadinho / como acordou)  ──►  pergunta da vaga ──► 2 perguntas genéricas sorteadas ──► teste prático ──► resultado
   nota: DRESS_REPLY(formal, escolha)             opt.score (−3..+3)                                     +3 acerto / −2 erro
```
Probabilidade final: `1 / (1 + e^-(pontos + bônusAtributos − 3))`, limitada a 3%–95%.
Bônus = (inteligência − exigida)/30 + (aparência − exigida)/40 − ficha×1,2 + sorte ±1,5.
Taxa com respostas aleatórias deve ficar entre **15% e 60%** (o validador avisa fora de 5–85%).

### Configuração por carreira (`INTERVIEWS[id]`)
| campo | regra |
|---|---|
| `local` | "no Supermercado Bom Preço" — nome fictício, com preposição |
| `env` | ambiente onde a vaga existe de verdade (mercado, boteco, cozinha, hospital...) |
| `formal` | 0 informal · 1 arrumadinho · 2 social. **Músico de bar/caixa = 0; advogado = 2.** |
| `interviewer` | cargo de quem entrevista ("Dono do boteco") |
| `npcOutfit`, `standing` | roupa do entrevistador; `standing: true` para balcão |
| `questions` | 1+ perguntas específicas da vaga |
| `test()` | gera o teste prático (pode sortear números) com `opts[{label, ok}]`, `okReply`, `badReply`, `statCheck?` |

Pergunta: `{ text, opts: [{ label ≤ 40, icon, score −3..+3, reply ≤ 90 (fala ácida do entrevistador), expr }] }`.
Cada pergunta deve ter: uma resposta "certa sem graça" (+2), uma "engraçada que também funciona" (+1..+3) e uma "desastre" (−2..−3).

## 3. Checklist
- [ ] `npm run check` sem erros e taxa de contratação dentro da faixa.
- [ ] Ambiente e roupa condizentes com a vaga.
- [ ] Humor ácido sobre o **mercado de trabalho** (salário, RH, "vestir a camisa"), nunca sobre o candidato ser de algum grupo.
