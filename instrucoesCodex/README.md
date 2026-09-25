# instrucoesCodex — manual de trabalho para o Codex (e qualquer agente de conteúdo)

Você vai **ampliar e polir** o VIVA! a partir do nível de qualidade que já existe: cenas, eventos, diálogos, móveis,
texturas, lugares do modo Explorar e regras novas de conteúdo. O motor (esqueleto, câmera, save, IA dos NPCs) fica com o
Claude — quando precisar mudar o motor, **peça** em `docs/PEDIDOS-ENGINE.md`.

Leia nesta ordem antes da primeira tarefa:

| # | Arquivo | Para quê |
|---|---|---|
| 0 | `AGENTS.md` (raiz) | Regras do projeto, zonas de edição 🟢🟡🔴, comandos. **Obrigatório.** |
| 1 | [01-PADRAO-DE-QUALIDADE.md](01-PADRAO-DE-QUALIDADE.md) | O que é "bonito e certo" aqui: escala, profundidade 2,5D, cores, luz, tom. A régua de tudo. |
| 2 | [02-MOVEIS-E-TEXTURAS.md](02-MOVEIS-E-TEXTURAS.md) | Desenhar móveis/objetos 2,5D com `caixa()`, texturas de piso e parede, partes na frente/atrás. |
| 3 | [03-OBJETOS-E-ACOES.md](03-OBJETOS-E-ACOES.md) | Pôr um objeto no mundo com ações (sentar, deitar, treinar), efeitos e balanceamento. |
| 4 | [04-LUGARES-E-AMBIENTES.md](04-LUGARES-E-AMBIENTES.md) | Cômodos, fachadas, calçada, lugares novos do Explorar e ambientes das cenas. |
| 5 | [05-DIALOGOS-E-INTERACOES.md](05-DIALOGOS-E-INTERACOES.md) | Falas, interações com desconhecidos/contatos/passantes, humor e consequências. |
| 6 | [06-EVENTOS-CENAS-E-REGRAS.md](06-EVENTOS-CENAS-E-REGRAS.md) | Eventos anuais, cenas animadas, flags e regras novas (onde mora cada coisa). |
| 7 | [07-VERIFICAR-E-MOSTRAR-A-TELA.md](07-VERIFICAR-E-MOSTRAR-A-TELA.md) | Como testar, capturar a tela e **mostrar no chat**; checklist de entrega. |
| 8 | [08-TAREFAS-PRONTAS.md](08-TAREFAS-PRONTAS.md) | Fila de tarefas já especificadas, com critério de aceite. Comece por aqui se não recebeu tarefa. |

## O fluxo de toda tarefa (sempre igual)

1. `git checkout -b codex/<tema>` (nunca trabalhe em `main`; **nunca** faça push em `main`).
2. `npm install` (uma vez) e `npm run dev` (deixe rodando — http://localhost:5199).
3. Leia o guia da área (tabela acima) e **procure um exemplo parecido que já existe** — copie o padrão dele.
4. Implemente em passos pequenos. A cada passo visual: **capture a tela e mostre no chat** (guia 07).
5. `npm run check` sem erros → `npm run catalog` se criou conteúdo → entrada no `docs/CHANGELOG.md`.
6. Um commit por lote temático, mensagem em português: `feat(explorar): guarda-roupa e criado-mudo no quarto`.
7. Na resposta final: o que fez, os ids criados, as capturas (antes/depois) e o que ficou pendente.

## As 10 regras que mais importam

1. **Nunca renomeie nem apague ids** (eventos, cenas, movimentos, objetos, flags). Só acrescente.
2. **Zona vermelha não se edita** (`AGENTS.md` §4). Se a tarefa exigir, pare e escreva o pedido em `docs/PEDIDOS-ENGINE.md`.
3. **Escala real**: alturas em metros × `M` (170 px). Veja a tabela de medidas no guia 01. Nada de sentar no ar.
4. **Profundidade**: todo objeto tem frente + topo + lateral (projeção oblíqua `OX`/`OY`). Nada "chapado".
5. **Toda escolha tem consequência** (stat, vínculo, dinheiro, flag, necessidade, cena, evento futuro).
6. **Português do Brasil**, gênero neutro com `(a)` para o jogador, `he(p, 'ele', 'ela')` para NPC.
7. **Humor ácido dentro dos limites** (`docs/specs/SPEC-06-humor-e-tom.md`): nada de ofensa a grupos, pessoas/marcas reais,
   nada sexual com menores. Banheiro/nudez: regras do `docs/EXPLORAR.md` §Banheiro (obrigatórias).
8. **Use os helpers**: `rng.*` (nunca `Math.random` em lógica de jogo), `stat`, `bond`, `addLog`.
9. **Mostre a tela**: nenhuma entrega visual sem captura antes/depois no chat.
10. **Na dúvida, copie o que já existe e está bom.** Não invente um estilo novo.

## Onde está o quê (atalho)

| Quero... | Arquivo | Zona |
|---|---|---|
| desenhar um móvel/objeto do modo Explorar | `src/explorar/moveis.ts` | 🟢 |
| pôr um objeto com ações no mundo, mudar lugar das coisas, fachada, piso, parede | `src/explorar/mundo.ts` | 🟡 |
| diálogos e interações no mundo (desconhecidos, contatos, passantes) | `src/explorar/gente.ts` | 🟡 |
| evento do ano | `src/game/events.ts` | 🟢 |
| cena animada | `src/scenes/situations.ts` | 🟢 |
| movimento (pose animada) | `src/character/motions.ts` (bloco novo no fim) | 🟢 |
| expressão facial | `src/character/expressions.ts` | 🟢 |
| ambiente de cena (fundo) | `src/scenes/environments.ts` | 🟢 |
| objeto de cenário/mão das cenas | `src/render/props.ts` | 🟢 |
| motor do Explorar (IA, câmera, rotas, roteiros do banheiro) | `src/explorar/controle.ts` | 🔴 peça ao Claude |

As receitas antigas continuam valendo: `.agents/skills/viva-criar-*` (evento, cena, animação, ambiente, interação,
humor, verificação). Estes guias somam o **modo Explorar** e o **padrão de qualidade** novo.
