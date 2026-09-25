# 08 · Tarefas prontas para o Codex

Fila de trabalho já especificada. Pegue **uma por vez**, na ordem de prioridade, num branch `codex/<tema>`.
Ao terminar: marque `[x]` aqui com o id criado e o hash do commit, e registre no `docs/CHANGELOG.md`.
Toda tarefa exige capturas antes/depois no chat (guia 07). ⚙️ = depende de um pedido de motor (não comece sem o Claude).

## Prioridade 1 — diálogos e vida na rua

- [ ] **T1 · 5 interações novas com passantes** (`INTERACOES_PASSANTE`, guia 05 §3): pedir informação, comentar o tempo
  (resposta muda com a hora), pedir um trocado, elogiar o look, pedir dica de lugar para comer.
  *Aceite*: cada uma com 3–5 respostas, consequência (social/diversão/dinheiro/felicidade), `c.hoje` limitando repetição,
  tom SPEC-06. Captura de pelo menos 2 balões.
- [ ] **T2 · Mais falas de ambiente**: +12 em `PAPO_AMBIENTE` (academia), +10 em `FALAS_CASA`, +6 em `puxaConversa()`
  (3 por faixa de familiaridade). *Aceite*: sem repetir piada existente; nada de marca real.

## Prioridade 2 — enriquecer os cômodos (guias 01, 02, 03)

- [ ] **T3 · Quarto completo**: criado-mudo com abajur (acende à noite: use `luz(hora)` via opção) ao lado da cabeceira,
  guarda-roupa (`guardaRoupa`, exemplo no guia 02) com a ação **"Escolher o look do dia"** (15 min, aparência +1,
  felicidade +1, `motion: 'maosNaCintura'`), prateleira com livros na parede (pintor `quarto`).
  *Aceite*: nada sobrepõe a cama/escrivaninha/cadeira; corredor livre; dia e noite.
- [ ] **T4 · Cozinha viva**: lixeira com pedal, escorredor de louça na bancada, fruteira, ímãs na geladeira (já tem 3 — faça
  variar a cor), panela no fogão com vapor quando alguém cozinha (use `opts.emUso`? ⚙️ se precisar de estado novo).
- [ ] **T5 · Banheiro**: cesto de roupa, toalheiro com toalha colorida, planta pequena, prateleira com xampus no box
  (desenho do box em `moveis.ts`). *Aceite*: o banho continua funcionando (roteiro do motor); a faixa jateada do vidro
  continua cobrindo do peito às coxas (regra de conteúdo — ver `docs/EXPLORAR.md`).
- [ ] **T6 · Sala**: ventilador de teto animado (no pintor `sala`, girando com `t`), vitrola/caixa de som com a ação
  **"Ouvir música"** (30 min, diversão +15, felicidade +1, `motion: 'dancar'` ou `sentar` no sofá), mais quadros.

## Prioridade 3 — academia e praça

- [ ] **T7 · Leg press** (novo móvel com partes + movimento novo `legPress` em `motions.ts`: sentado inclinado empurrando
  a plataforma; `assento` ~0,45). Ação 30 min: saúde +2, aparência +1, fitness +3, energia −18, fome −10, higiene −16,
  `cond: juntos(matriculado, cansado(20))`, `exclusivo`. *Aceite*: pés na plataforma, costas no encosto (captura perto).
- [ ] **T8 · Área de colchonetes**: 2 colchonetes (`vagas`) com a ação **"Abdominais"** (movimento novo `abdominal`,
  deitado com `plataforma` 0,03) e **"Alongar"** (movimento novo `alongar`, em pé).
- [ ] **T9 · Praça com vida**: carrinho de pipoca (objeto: "Comprar pipoca" R$ 6, fome +12, diversão +4), parquinho com
  balanço (só `idade < 13`: `cond` com `L.player.age`; adulto recebe o texto "Você está grande demais para isso. Tentou
  mesmo assim?"), pombos animados no chão (decoração com `t`).

## Prioridade 4 — texturas e noite

- [ ] **T10 · Pisos e paredes novos**: piso `tacos` (espinha de peixe) para a sala e parede `tijolinho` para a cozinha
  (novos tipos em `piso()`/pintores de `mundo.ts`). *Aceite*: juntas em perspectiva (guia 02 §4), sem pesar o desempenho
  (nada de milhares de `fillRect` por quadro: prefira linhas longas).
- [ ] **T11 · Noite na rua**: vitrines das lojas acesas à noite (`luz(hora).noite`), letreiro da padaria e da farmácia
  iluminado, luz quente saindo das janelas da casa para a calçada.

## Prioridade 5 — conteúdo que liga o dia a dia à vida

- [ ] **T12 · Eventos anuais que leem o Explorar** (`events.ts`, guia 06 §3): "Maratona do bairro" (se
  `L.explorar?.usos?.correrEsteira >= 15`), "Convite da galera da academia" (se tem contato que veio da academia —
  `L.explorar?.frequentadores?.academia` com `contato: true`), "Desafio do supino". *Aceite*: 2–4 escolhas com
  consequência, flags documentadas na SPEC-01.

## Depende do motor (não comece — o Claude faz ou libera)

- ⚙️ Interior da padaria/farmácia (tipo `predio` novo + corte da fachada).
- ⚙️ Ônibus chegando no ponto; convidar um contato para ir junto; trabalho/escola dentro do mundo.
- ⚙️ Horário de funcionamento para lugares novos; necessidades novas.
