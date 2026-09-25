# 06 · Eventos, cenas e regras novas

O jogo tem duas camadas que conversam:
- **A vida por anos** (botão *+1 ANO*): eventos aleatórios com escolhas, carreiras, entrevistas, relações.
- **O dia a dia** (modo Explorar, botão *VIVER O DIA*): o mundo contínuo. Os stats ganhos lá valem na vida.

## 1. Onde mora cada coisa

| Quero criar... | Arquivo | Receita (leia!) | Contrato |
|---|---|---|---|
| Evento anual com escolhas | `src/game/events.ts` → `EVENTS` | `.agents/skills/viva-criar-evento/` | `docs/specs/SPEC-01` |
| Cena animada (o que aparece ao escolher) | `src/scenes/situations.ts` → array `S` + `case` em `physical()` | `.agents/skills/viva-criar-cena/` | `SPEC-02` |
| Movimento/pose | `src/character/motions.ts` (bloco `Object.assign(MOTIONS, {...})` novo no fim) | `.agents/skills/viva-criar-animacao/` | `SPEC-03` |
| Contato entre dois (abraço, beijo, mão) | `situations.ts` usando `golpear`/`maoAte`/`Contato` | — | `SPEC-07`, `SPEC-08` (leia inteiros) |
| Expressão facial | `src/character/expressions.ts` | `viva-criar-animacao` | `SPEC-03` |
| Ambiente de cena | `src/scenes/environments.ts` | `viva-criar-ambiente` | `SPEC-04` |
| Interação da aba Relações | `src/game/activities.ts` → `INTERACTIONS` | `viva-criar-interacao` | `docs/RELACIONAMENTOS.md` |
| Pergunta de entrevista | `src/game/interviews.ts` | — | `SPEC-05` |
| Humor | qualquer texto | `viva-humor-acido` | `SPEC-06` |

## 2. Evento — o mínimo de qualidade

- **2 a 4 escolhas**, cada uma com consequência diferente e **real** (não "texto diferente, mesmo efeito").
- Pelo menos uma escolha com **custo** e uma com **risco** (resultado por chance, `rng.chance`).
- Use **flags** para lembrar decisões e disparar um evento futuro (a melhor parte do jogo é "aquilo voltou").
  Toda flag nova é documentada na tabela da `SPEC-01`.
- Cena: se existe uma cena que serve (`docs/CATALOGO.md`), reuse com `data` diferente antes de criar outra.
- Texto: título curto, descrição com a piada, resultados que fecham a piada.

## 3. Conectar o dia a dia (Explorar) com a vida (anos)

Coisas que **conteúdo** pode fazer sem motor:
- Eventos anuais que leem o que você fez no Explorar: `L.explorar?.usos` (ex.: `usos.correrEsteira > 20` → evento
  "maratona do bairro"), `L.explorar?.matriculaAte`, `L.fitness`, contatos feitos na academia (pessoas em `L.people`).
- Objetos com ações novas (guia 03) e diálogos (guia 05).

Coisas que são **motor** (peça ao Claude em `docs/PEDIDOS-ENGINE.md`):
- Necessidade nova (ex.: "Sede"), horário de funcionamento de um lugar, NPC fixo novo num lugar (frequentadores),
  roteiro com várias etapas (como o banho), convidar alguém para ir junto, trabalho/escola dentro do mundo.

## 4. Regras novas (balanceamento, sistemas pequenos)

"Regra" aqui = um número ou condição que muda o jogo (ex.: "treinar com fome rende menos", "banho frio de manhã dá
+energia"). Como propor e implementar:

1. **Escreva a regra em uma frase** + o porquê (que comportamento do jogador ela incentiva).
2. Se couber em **dados de conteúdo** (efeitos de uma ação, `cond`, uma interação, um evento), implemente você mesmo
   (zonas 🟢/🟡) e registre a mudança de número no `docs/CHANGELOG.md` com a justificativa (zona amarela exige).
3. Se precisar de código do motor (🔴), abra um pedido em `docs/PEDIDOS-ENGINE.md`:
   ```md
   ### [PEDIDO] Treinar com fome rende menos
   - Por quê: hoje dá para treinar o dia inteiro sem comer.
   - Regra: se `nec.fome < 20`, ganhos de treino × 0,5 e aviso "Sem gasolina...".
   - Onde deve valer: ações da academia (ids `correrEsteira`, `supino`, `rosca`, `pedalar`).
   - Como testar: `__ex.est.nec.fome = 10; __ex.testarUso('supino1')` → ganho menor + aviso.
   ```
4. Nunca mude `QUEDA_HORA`, `CANSACO_ANO`, `MIN_POR_SEG`, `AVANCO` ou `IDADE_NUDEZ` (estão no motor).

## 5. Checklist antes de entregar conteúdo novo

- [ ] Ids novos únicos (confira `docs/CATALOGO.md`), camelCase, sem acento.
- [ ] Cada escolha/ação/interação tem consequência real.
- [ ] Flags novas na tabela da SPEC-01.
- [ ] `npm run check` sem erros; `npm run catalog` rodado.
- [ ] CHANGELOG com data, agente e ids criados. Itens do BACKLOG marcados `[x]` com o id.
- [ ] Capturas das cenas/objetos novos no chat.
