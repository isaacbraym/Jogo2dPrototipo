# SPEC-01 — Eventos, escolhas e consequências

Contrato de `LifeEvent`, `Choice`, `Action`, `Interaction` e `Outcome` (`src/game/types.ts`) e as regras de design
que fazem a vida parecer viva, injusta e engraçada.

## 1. Contratos

### LifeEvent (evento anual aleatório) — `src/game/events.ts`, array `EVENTS`
| campo | obrigatório | regra |
|---|---|---|
| `id` | sim | camelCase único, sem acento. Nunca renomear. |
| `min`, `max` | sim | faixa de idade (inclusive). |
| `weight` | sim | número ou `(L) => number`. 0 = não sorteia. **≥100 = obrigatório (reservado a marcos; não use).** |
| `once` | não | acontece uma vez por vida (gera flag `ev_<id>`). |
| `cond` | não | `(L) => boolean`. Pré-condição barata e sem efeitos colaterais. |
| `icon`, `title` | sim | emoji + título curto (≤ 32 caracteres). `title` pode ser função. |
| `setup` | não | `(L) => EvCtx \| null`. Escolhe pessoa/valor do evento. `null` cancela. **Sem efeitos colaterais.** |
| `text` | sim | `(L, ctx) => string` (≤ 240 caracteres). |
| `scene` | não | `(L, ctx) => SceneReq` — cena de abertura antes do cartão. |
| `choices` | um dos dois | 2–4 escolhas. |
| `auto` | um dos dois | evento sem escolha (use pouco). |

### Choice
`{ label (≤ 40 car.), icon, hint?, cond?(L,ctx), run(L,ctx) => Outcome }`. Escolha com `cond` falso aparece desabilitada —
útil para "Pagar R$ 5.000" sem dinheiro (frustração visível).

### Outcome (o resultado)
| campo | uso |
|---|---|
| `text`, `tone` | texto do cartão; tom `bom`/`ruim`/`neutro`/`especial` (define som e cor). |
| `title`, `icon` | opcional; cartão usa padrão pelo tom. |
| `scene` | `{ id, others?: Person[], data? }` — cena que toca antes do cartão (id em `CATALOGO.md`). |
| `log` | texto do diário; `false` = não registrar (use quando você mesmo chamou `addLog`). |
| `react` | `{ npc?, player? }` com `expr`, `say` (≤ 45 car.), `emote`, `motion` — aplicado **depois** da cena, por cima do último quadro. Use para a cara de quem apanhou, o deboche de quem venceu etc. |
| `mood` | `tenso`/`triste`/`ferido`/`feliz` — humor da próxima cena em casa. |
| `next` | outra `Outcome` mostrada em seguida (com cena própria). **É assim que se encadeiam consequências.** |
| `followUp` | um `PendingEvent` (nova decisão) depois do resultado. |
| `skipCard` | não mostra o cartão (use em cadeias onde o próximo cartão já conta a história). |

### Action (aba Atividades) e Interaction (aba Relações) — `src/game/activities.ts`
- `Action`: `{ id, label, icon, desc, group, minAge, maxAge?, cost?, cond?, run(L) => Outcome | PendingEvent }`.
- `Interaction`: `{ id, label, icon, group?, cond(L, p), run(L, p) => Outcome }`. Grupo `'Agressão'` agrupa as agressivas.
- Para cenas de interação use o helper `sc(L, p, acao)` → cena `interacao` com `data.action` (ações de `physical()` no catálogo)
  e ambiente coerente com a relação.

## 2. Balanceamento (números de referência)

| intensidade | stat (`stat`) | vínculo (`bond`) | dinheiro |
|---|---|---|---|
| leve | ±1 a ±4 | ±2 a ±5 | até 2% do salário anual |
| média | ±5 a ±9 | ±6 a ±12 | 2–10% |
| forte | ±10 a ±20 | ±13 a ±30 | 10–50% |
| catástrofe (raro) | ±25+ | rompe relação / morte | falência |

Pesos: comum 8–15 · incomum 3–7 · raro 1–2. Um evento de peso 10 aparece "de vez em quando" numa faixa etária larga.
Use `rng.chance(p)` com `p` influenciado por stats (`0.3 + L.stats.inteligencia / 200`) — sorte **e** mérito.

## 3. Regras de design de consequência

1. **Nenhuma escolha neutra.** Toda escolha muda ao menos uma coisa (stat, vínculo, dinheiro, karma, flag, ficha, relação).
2. **Trade-off:** a escolha "certa" custa algo (tempo, dinheiro, orgulho); a "divertida" tem risco.
3. **Risco com sorteio:** as escolhas arriscadas têm dois ou mais desfechos (`rng.chance`) — um bom e um desastroso.
4. **Consequência atrasada (karma bumerangue):** grave uma flag (`L.flags.mentiuPraChefe = L.player.age`) e crie um evento
   futuro com `cond` que lê essa flag. É o que dá sensação de mundo que lembra.
5. **Cadeia:** consequências graves usam `next` (ex.: soco → revide → pronto-socorro → demissão).
6. **Pessoas reagem:** use `react` para NPC e jogador terem cara/fala coerentes depois da cena. Ninguém sorri depois de apanhar.
7. **Humor da casa:** eventos pesados definem `mood`.
8. **Frustração faz parte:** nem todo esforço dá certo. Mas o fracasso deve ser engraçado ou dar lição (texto ácido), nunca só punitivo.
9. **Idade importa:** crianças não têm polícia/demissão; adolescentes têm escola/pais; adultos têm trabalho/justiça/boletos; idosos têm saúde/herança/netos.
10. **Sem efeitos em `cond`/`setup`/`text`.** Só em `run`/`auto`.

## 4. Flags (`L.flags`) — memória de consequências

Valores: number, boolean ou string (JSON). Nomes camelCase. Guarde a **idade** quando o tempo importar.

| flag | significado | quem escreve |
|---|---|---|
| `advertencias` | advertências no emprego atual (zera ao trocar) | aggression, state.hireStaff |
| `infracoes` | infrações escolares (decai 1/ano) | aggression, events, life |
| `expulsoes` | nº de expulsões escolares | aggression |
| `anosFacul` | anos cursados na faculdade | events, life |
| `aposentadoria` | já se aposentou | events, life |
| `arte`, `musica`, `medalha` | talentos descobertos | events |
| `avisoDivida` | idade do último aviso de dívida | life |
| `moodNext` | humor da próxima cena em casa | ui/game |
| `neto` | já teve neto | events |
| `netoPessoaId` | id do neto criado no evento de nascimento; atualmente salvo como conhecido | events; netoSoLigaNoPix; aprenderCelularComNeto |
| `pixExposto` | idade em que o caso do Pix foi exposto no grupo do bairro | events; vizinhoLembra |
| `pixVizinhoId` | id da pessoa que recebeu o Pix exposto | events; vizinhoLembra |
| `furadeiraRevidada` | idade em que o jogador retaliou com som alto | events; vizinhoLembra |
| `furadeiraVizinhoId` | id do vizinho da furadeira | events; vizinhoLembra |
| `contaLuzPendente` | idade do protocolo/conta de luz pendente | events; apagaoNaEntrega; cobrancaInesperada |
| `nomeSujo` | idade em que a pendência de crédito ficou aberta | events; cobrancaInesperada |
| `cursoCoachComprado` | idade da compra/afiliado do curso | events; cobrancaInesperada |
| `feedbackTrabalho` | idade em que uma contestação de feedback gerou advertência | events; justaCausaFeedback |
| `feedbackTrabalhoJob` | id do emprego onde a advertência foi registrada | events; justaCausaFeedback |
| `estagiarioPessoaId` | id da pessoa estagiária que virou líder depois | events; estagiarioVirouChefe |
| `estagiarioIdade` | idade do evento com a pessoa estagiária | events; estagiarioVirouChefe |
| `estagiarioEscolha` | tipo de relação criada com a pessoa estagiária | events; estagiarioVirouChefe |
| `estagiarioEmprego` | id do emprego no evento com a pessoa estagiária | events; estagiarioVirouChefe |
| `videoFirmaIdade` | idade em que um vídeo constrangedor surgiu no happy hour | events |
| `videoFirmaJob` | id do emprego no happy hour | events |
| `assedioMoralIdade` | idade da denúncia de assédio moral acolhida pelo RH | events; indenizacaoTrabalhista |
| `assedioMoralValor` | base salarial registrada para acordo trabalhista futuro | events; indenizacaoTrabalhista |
| `greveAderiuIdade` | idade em que o jogador aderiu à paralisação | events |
| `greveEmpregoId` | id do emprego na paralisação | events |
| `boletimEscondidoIdade` | idade em que o boletim escolar foi escondido | events; paisAchamBoletim |
| `irmaoEmprestimoPessoaId` | id do irmão que recebeu o empréstimo pendente | events; irmaoNaoDevolve |
| `irmaoEmprestimoIdade` | idade em que o empréstimo ao irmão foi feito | events; irmaoNaoDevolve |
| `irmaoEmprestimoValor` | valor do empréstimo ao irmão | events; irmaoNaoDevolve |
| `acoesPalcoVistas` | quantas ações do palco (acenar, dançar…) o jogador já viu liberadas; controla o aviso "Novas ações liberadas" | ui/game |
| `pensaoDesde` | idade em que começou a pagar pensão alimentícia (divórcio com filhos menores) | game/relacoes |
| `testamentoGatoIdade` | idade em que parte dos bens foi reservada ao gato | events; familiaContestaTestamento |
| `testamentoGatoValor` | valor reservado para os cuidados do gato | events; familiaContestaTestamento |
| `testamentoGatoPetId` | id do gato citado no testamento | events; familiaContestaTestamento |
| `amigoAjudaPessoaId` | id da pessoa a quem foi emprestado dinheiro em `amigoPrecisa` | events; amigoAjudaVolta |
| `amigoAjudaIdade` | idade do empréstimo ao amigo que ainda não foi devolvido | events; amigoAjudaVolta |
| `amigoAjudaValor` | valor emprestado ao amigo que ainda não foi devolvido | events; amigoAjudaVolta |
| `valentaoAdultoIdade` | idade em que o lanche foi entregue ao valentão | events; valentaoAdulto |
| `valentaoAdultoNome` | nome do valentão da escola que reaparece adulto | events; valentaoAdulto |
| `colaNoDiplomaIdade` | idade da cola bem-sucedida que pode ser revista depois | events; colaNoDiploma |
| `celularVirouNoiteIdade` | idade em que o primeiro celular virou a noite nos jogos | events; celularVolta |
| `piramideInvestidaIdade` | idade do investimento na pirâmide ainda sem retorno | events; piramideContatoVolta |
| `piramideInvestidaValor` | valor aplicado na oportunidade de pirâmide | events; piramideContatoVolta |
| `piramideInvestidaResultado` | resultado do investimento (`lucro` ou `perda`) | events; piramideContatoVolta |
| `netoLembraConversaIdade` | idade da conversa com o neto sem pedido de dinheiro | events; netoLembraConversa |
| `netoLembraConversaPessoaId` | id do neto com quem o jogador escolheu conversar | events; netoLembraConversa |
| `ev_<id>` | evento `once` já ocorreu | life.pickEvents |

**Ao criar uma flag nova, acrescente uma linha nesta tabela** (e rode `npm run catalog`).

## 5. Exemplo completo (padrão ouro)

```ts
{
  id: 'grupoFamilia', min: 25, max: 80, weight: 8, icon: '📱', title: 'Grupo da família',
  cond: (L) => parents(L).length > 0,
  setup: (L) => ({ person: pickRandom(parents(L)) }),
  text: (_L, c) => `${c.person!.first} mandou no grupo da família um áudio de 7 minutos dizendo que vacina tem chip. Todos esperam sua reação.`,
  choices: [
    { label: 'Mandar um artigo científico', icon: '🧪', run: (L, c) => {
      bond(c.person!, -8); stat(L, 'felicidade', -3);
      L.flags.brigaGrupo = L.player.age; // consequência atrasada: ceia de Natal tensa
      return O(`${c.person!.first} respondeu com 14 figurinhas de "bom dia" e te removeu do grupo. Ciência 1 × 0 Família.`, 'ruim', {
        react: { npc: { expr: 'bravo', say: 'Estudou demais, ficou burro!' } }, mood: 'tenso',
      });
    } },
    { label: 'Reagir com 🙏 e silenciar', icon: '🙏', run: (L) => { stat(L, 'felicidade', 2); return O('Paz familiar mantida à base de omissão. Como manda a tradição.', 'neutro'); } },
    { label: 'Mandar um áudio de 8 minutos', icon: '🎙️', run: (L, c) => {
      if (rng.chance(0.3)) { bond(c.person!, 6); return O('Seu áudio viralizou nos grupos de tios. Você virou referência. Não sabe se isso é bom.', 'especial'); }
      stat(L, 'felicidade', -5); return O('Ninguém ouviu. Mas todos mandaram "kkkk".', 'neutro');
    } },
  ],
},
```
