# Painel de QA do VIVA! (local, só desenvolvimento)

Ferramenta para **encontrar, executar, observar e ajustar** qualquer conteúdo do jogo — inclusive o raro ou difícil de
alcançar numa partida — usando a lógica, o renderizador e os roteiros **reais**. Inspirada na experiência do DevTools do
`habbo_teste` (catálogo navegável, detalhe por ID, prévia real, calibrador, alterações auditáveis), mas construída sobre a
arquitetura do VIVA!: sem banco, sem servidor próprio, sem assets externos.

## 1. Como abrir

```bash
npm run painel        # abre http://localhost:5199/painel.html (o jogo continua em http://localhost:5199/)
```
Ou, com `npm run dev` já rodando: **http://localhost:5199/painel.html**.

- Existe só no servidor de desenvolvimento. O `npm run build` empacota apenas `index.html` → o `dist/index.html` jogável e o
  GitHub Pages **não** contêm o painel (verificado: 0 ocorrências de código do painel no `dist`).
- A API de gravação (`/__painel/api/*`) é um plugin do Vite com `apply: 'serve'`; aceita só origem `localhost`/`127.0.0.1`,
  exige o cabeçalho `X-Painel: 1` nos POST e grava numa **lista fechada** de caminhos (seção 5).
- **Saves de jogadores nunca são tocados.** O painel roda na mesma origem do jogo, então instala uma guarda que bloqueia
  qualquer leitura/escrita/remoção de chaves `viva.*` no `localStorage` (a aba Qualidade mostra se alguma tentativa ocorreu).
  O painel usa apenas chaves `painel.*`. Toda execução usa uma **vida isolada** (cenário), nunca um save.

## 2. Abas

| aba | para quê |
|---|---|
| **Catálogo** | Busca por id/nome (sem acento), filtros por tipo, contagens, detalhe com id copiável, arquivo:linha, trecho do código, prévia **animada pelo renderizador real**, vínculos de entrada/saída e ocorrências literais. |
| **Esteira de eventos** | Executa evento/escolha/ação/interação/agressão/entrevista **sem esperar o sorteio**: elegibilidade com o motivo exato, pré-requisitos lidos do código, precursores, cenário editável, cadeia completa (abertura → escolhas → consequência → cena → next → followUp), diferenças antes/depois, exploração de sementes, todos os caminhos. |
| **Laboratório** | Cena, ambiente, movimento, ação corporal (2 bonecos), expressão, objeto de cena, objeto de mão e parâmetro visual — com reprodução determinística, linha do tempo, busca temporal, quadro a quadro, esqueleto, inspetor de pose, calibrador A/B, variações e pedidos para o Luna. |
| **Qualidade** | Referências quebradas, varredura de eventos (alcance + todas as escolhas + inconsistências), varredura de cenas (execução headless), itens sem uso (com critério honesto), keyframes fora dos limites, falhas capturadas, proteção de saves. |
| **Alterações** | `src/data/calibracao.json` atual, histórico com **reverter**, trilha de auditoria, cenários e propostas salvos. |

## 3. Arquitetura

```
painel.html                      entrada só de desenvolvimento
src/painel/
  main.ts                        casca, abas, rota por hash, captura de falhas, isolamento de áudio
  guarda.ts                      bloqueio de chaves "viva.*" (saves)
  det.ts                         acaso semeado, fluxos separados simulação × desenho, drenagem de microtarefas
  fontes.ts                      código-fonte como texto (import.meta.glob ?raw): arquivo:linha, trechos, literais
  catalogo.ts                    catálogo unificado a partir dos REGISTROS reais + vínculos (estrutural/estático/observado)
  observado.ts                   vínculos observados em execução (com contexto), guardados em "painel.observados"
  vida.ts                        cenários: vida isolada, validação, diff, motivos de indisponibilidade, pré-requisitos, precursores
  execucao.ts                    esteira: lógica real com semente e caminho de escolhas; exploração de sementes
  cenarios.ts                    cenário inicial para qualquer item executável
  lab.ts                         motor do laboratório (Scene/Director/SITUATIONS/physical reais, passo fixo, replay)
  calib.ts                       propostas, desfazer/refazer, variações, overrides A/B
  pedido.ts                      texto do "pedido para Luna"
  ui-*.ts, painel.css            interface
src/qa/                          módulos puros compartilhados (painel + validador + servidor)
  limites.ts                     limites seguros da SPEC-03 (pose e expressão)
  calibracao.ts                  formato, validação, normalização e diff da calibração
  fixtures.ts                    perfis de vida de teste (também usados por npm run check)
  referencias.ts                 varredura de referências literais (também usada por npm run check)
src/character/calibracao.ts      aplica src/data/calibracao.json sobre MOTIONS/EXPRESSIONS no runtime
src/data/calibracao.json         a calibração aprovada (dados; entra no jogo)
scripts/painel-api.ts            plugin do Vite (só dev): leitura/gravação da lista fechada + auditoria
qa/cenarios/  qa/propostas/      arquivos versionados de reprodução e de propostas
qa/auditoria.jsonl               trilha de alterações (versionada) · qa/historico/ cópias locais (ignoradas no git)
```

**Fonte de verdade.** O catálogo não tem lista manual de ids: lê `EVENTS`, `ACTIONS`, `INTERACTIONS`, `AGGRO`,
`INTERVIEWS`, `CAREERS`, `SITUATIONS`, `ENVS`, `MOTIONS`, `EXPRESSIONS`, `PROPS`, `HELD`, as listas de aparência, os tipos
`EmoteKind`/`PKind` e o protótipo do `sfx`. Conteúdo novo aparece sozinho.

**Níveis de vínculo** (sempre rotulados na interface):
- *confirmado · registro* — lido de um campo (ex.: `MOTIONS.chute.expr`, `INTERVIEWS.caixa.env`, `agg_chute` → `AGGRO.chute`).
- *observado · execução* — visto ao executar no painel, **com o contexto** (semente, caminho, dados da cena).
- *inferido · código* — achado no texto do código (regex ou literal dentro do bloco). Pode ter falso positivo; confirme executando.

### 3.1 Mudanças mínimas no motor (zona vermelha, autorizadas para esta ferramenta)
| arquivo | mudança | por quê |
|---|---|---|
| `core/rng.ts` | `reseed()`, `estado()` | reiniciar/salvar o acaso global para replays |
| `game/state.ts` | `resetIds()` | ids de pessoas deixam de depender do relógio no painel |
| `character/actor.ts` | `resetActorIds()`; importa `./calibracao` | id do ator alimenta sementes de movimento/olhar; aplica a calibração uma vez |
| `character/motions.ts` | `keyframes()` exportada e expõe `fn.kf` | ler/editar keyframes sem regex no código |
| `game/life.ts` | `eligible` exportada; `registrarResultado()` | o painel usa a MESMA regra de elegibilidade e de efeitos de apresentação que o jogo |
| `ui/game.ts` | chama `registrarResultado()` | fonte única (comportamento idêntico ao anterior) |
| `scenes/environments.ts` | acumulador de partículas por cena | antes era global e vazava entre cenas (quebrava replays) |
| `render/props.ts` | `HELD` exportado | catálogo/validador |
Nada disso muda o formato do save nem o comportamento do jogo.

## 4. Determinismo e busca temporal

- **Esteira:** execução = função pura de (cenário, semente, caminho). Cada clique reexecuta do zero dentro de `comSemente`
  (rng global, `Math.random` e contador de ids semeados). "Repetir e comparar" executa duas vezes e compara o hash do estado
  observável (sem datas).
- **Laboratório:** a cena é montada como no `Stage.play` (ambiente resolvido pelo elenco, fade de entrada, `Director` + `run`),
  mas avança em **passos fixos de 1/60 s**. Depois de cada `Scene.update` o painel **drena as microtarefas** (continuações
  `async` do roteiro) e faz um **desenho de simulação** num contexto nulo com viewport lógico fixo 1280×720 — porque o jogo
  calcula `Actor.frame` e `Scene.view` no desenho e os roteiros os leem. Buscar um instante = reexecutar do zero até ele;
  por isso timers, tweens e o roteiro acompanham de verdade (não se altera só `Scene.t`).
- Fontes de não determinismo tratadas: rng global; `Math.random` (partículas, tremor, ambientes); contador de ids de pessoas;
  contador de atores; acumulador global de partículas de ambiente (corrigido no motor); **cache de camadas estáticas** e
  **buffers de ruído do áudio**, que consomem `Math.random` só na primeira vez (o painel usa acaso descartável no desenho e
  isola o áudio); tremor de câmera no desenho (semeado pelo quadro, então A e B tremem igual).
- Botão **Verificar determinismo** (laboratório): toca quadro a quadro com desenho na tela até t, busca t por reexecução
  duas vezes e compara os três instantâneos. Validado em **todas as 73 cenas** (t = 2,5 s e 6 s) e em movimentos de ação.
- Limitação honesta: a igualdade vale para a mesma versão do código, mesma semente e mesmos dados de cena. O `Stage` do jogo
  continua em tempo real (dt variável) — o jogo não é determinístico, só o painel.

## 5. Calibração (o que é editável de verdade)

**Persistível** (vira `src/data/calibracao.json`, aplicado no runtime do jogo):
- **Movimentos feitos com `keyframes([...])`**: instante de cada keyframe, duração (`dur`) e os campos numéricos da pose
  listados em `src/qa/limites.ts` (quadril, tronco, pescoço, cabeça, ombros, braços/cotovelos, punhos, pernas/joelhos, pés,
  squash) — sempre dentro dos **limites seguros da SPEC-03** e com instantes crescentes.
- **Expressões**: campos contínuos (`browIn`, `lidTop`, `smile`, `open`, `pupil`...). Sofrimento nunca com `smile > 0`.

**Só exploratório** (prévia na sessão; o "pedido para Luna" leva os valores):
- Movimentos **procedurais** (fórmulas com seno etc.): deslocamentos somados à pose em B.
- Posição x dos atores, zoom/deslocamento da câmera (só no desenho).
- Marcadores de expressão (lágrimas, suor...), tempos de roteiro, falas e posições nas cenas → exigem código.

**Fluxo seguro:** editar em B (A = aplicado ou A = código) → desfazer/refazer → guardar variações nomeadas → salvar em
`qa/propostas` / exportar JSON → **Aplicar**: o servidor valida estrutura + limites + registros reais, mostra o **diff**,
exige **motivo**, guarda cópia em `qa/historico/`, grava o arquivo normalizado e registra em `qa/auditoria.jsonl`.
Reverter: aba Alterações. Sem `eval`, sem substituição textual em código: o único arquivo de jogo que o painel escreve é o
JSON de calibração. `npm run check` recusa calibração, proposta ou cenário inválido.

### 5.1 Formato `src/data/calibracao.json`
```json
{
  "formato": "viva-calibracao",
  "versao": 1,
  "movimentos": {
    "chute": { "dur": 0.8, "keyframes": { "2": { "t": 0.32, "pose": { "legN.a": 1.6, "lean": -0.3 } } }, "nota": "opcional" }
  },
  "expressoes": { "dor": { "browIn": 0.8 } }
}
```
Índice de keyframe = posição no array `keyframes([...])` do código (kf0, kf1...). Campos ausentes herdam do código.

### 5.2 Formato de proposta (`qa/propostas/<nome>.json`)
```json
{
  "formato": "viva-proposta", "versao": 1, "titulo": "Chute com mais peso", "alvo": "movimento:chute",
  "autor": "luna", "criado": "2026-09-24T12:00:00Z",
  "variacoes": [
    { "nome": "V1 mais alto", "nota": "…", "calibracao": { "formato": "viva-calibracao", "versao": 1, "movimentos": { "chute": { "keyframes": { "2": { "pose": { "legN.a": 1.62 } } } } }, "expressoes": {} } },
    { "nome": "V2 com quadril", "calibracao": { "formato": "viva-calibracao", "versao": 1, "movimentos": { "chute": { "keyframes": { "2": { "pose": { "legN.a": 1.6, "lean": -0.32 } } } } }, "expressoes": {} } }
  ]
}
```
Cada variação contém só as entradas que ela troca (substituem as do arquivo aplicado). Opcional: `"remover": ["movimento:chute"]`
para voltar um id aos valores do código. Exemplo real: `qa/propostas/exemplo-chute-mais-alto.json`.

### 5.3 Formato de cenário (`qa/cenarios/<nome>.json`)
```json
{
  "formato": "viva-cenario", "versao": 1, "titulo": "…",
  "alvo": { "tipo": "evento|interacao|agressao|acao|entrevista", "id": "…", "pessoaId": "(interações)" },
  "semente": 23, "forcar": { "idade": false, "unica": false, "condicao": false, "escolhaDesabilitada": false },
  "caminho": [0, 2], "vida": { "...": "Life completo e válido (validarVida)" },
  "origem": "como a vida foi montada (perfil, precursores…)", "nota": "…", "criado": "ISO"
}
```
Exemplos reais: `qa/cenarios/estagiario-virou-chefe-mentoria.json`, `qa/cenarios/agg-chute-trabalho.json`.
Execuções com itens em `forcar` aparecem como **"FORÇADA com condição ignorada"** e nunca como caminho alcançável.

## 6. Colaboração por ID com o Luna

**Gerar o pedido:** em qualquer item do catálogo, passo da esteira ou instante do laboratório → **"Copiar pedido para Luna"**.
O texto traz tipo e id, cadeia de referências (ex.: `interacao agg_chute → raiz → cena agressao → trecho act:chute#1 → ator P
→ movimento chute → kf2 (t=0.32s)`), arquivo:linha, semente, cenário, instante/trecho, valores atuais, observação, melhoria e
número de variações, além de dizer se o ajuste cabe no calibrador (proposta JSON) ou exige código.

**Ids de trecho** (estáveis, sem renomear nada): `<operação>:<argumento>#<ocorrência>` gerados pelo Director instrumentado —
`act:chute#1` (1º `d.act(…, 'chute')` da cena), `fala:Seu verme!#1`, `legenda:Feira de ciências…#1`, `evento:hit@chute#1`
(evento de movimento). Keyframes: `kf<i>` na ordem do array. Campos da pose: caminhos da tabela da SPEC-03 (`legN.a`).

**Procedimento do Luna — localizar pelo ID e entregar a variante escolhida:**
1. `docs/CATALOGO.md` ou o painel (Catálogo → buscar o id) dão o **arquivo:linha**. Sem painel:
   - evento/ação/interação: `id: '<id>'` em `src/game/events.ts` / `activities.ts`;
   - cena: `    id: '<id>',` em `src/scenes/situations.ts`; ação corporal: `case '<id>':` em `physical()`;
   - movimento: `  <id>: {` em `src/character/motions.ts` (e `MOTIONS.<id>.fn =` se houver substituição);
   - expressão: `  <id>: E(` em `expressions.ts`; ambiente: `const <id>: Env`; objeto: `  <id>: (` em `PROPS` / `HELD`.
2. **Se o pedido diz "escopo do calibrador"**: NÃO edite código nem `src/data/calibracao.json`. Entregue
   `qa/propostas/<nome>.json` com as N variações (formato 5.2), rode `npm run check`, registre no CHANGELOG. O usuário
   compara em A/B e aplica pelo painel.
3. **Se o pedido diz "exige mudança de código"**: edite **somente** o bloco do id indicado (do `{` do item até o `},`
   correspondente). Para entregar variações comparáveis, crie cópias com sufixo (`chuteV1`, `chuteV2`, cena `agressaoV1`…)
   no fim do registro, sem tocar no original; o usuário abre cada uma no laboratório. Depois da escolha, substitua o
   **conteúdo** do bloco original pelo da variante escolhida, **mantendo o id original**, e apague as cópias `V*`.
4. Nunca renomeie ids, nunca altere outros blocos, rode `npm run check`, documente no CHANGELOG com o id e a cadeia do pedido.

## 7. Casos de aceitação (executados)

| caso | resultado |
|---|---|
| `estagiarioVirouChefe` | Indisponível na vida base com motivo exato (`cond(L) = FALSO`; o código consulta `flags.estagiarioIdade`, `estagiarioPessoaId`… ausentes). Precursor detectado (`estagiarioBrilhante` escreve as flags); "Rodar precursor" + 2 anos → elegível; 3 escolhas percorridas com cenas e diffs; hash idêntico na repetição. Salvo em `qa/cenarios/estagiario-virou-chefe-mentoria.json`. |
| `agg_chute` | Vínculos: `interacao:agg_chute → agressao:chute` (confirmado), `→ cena:agressao` (observado com `data.kind=chute`), `cena:agressao → movimento:chute` (inferido pelo literal no ternário e **observado** no trecho `act:chute#1`). Explorar sementes 1–60 achou esquiva (23), acerto (1) e revide (5). |
| Pausar no impacto | Cena `agressao`, semente 23, t = 1,12 s: trecho `act:chute#1`, evento `hit@chute`, kf2 selecionado, campos da pose por grupo; `legN.a` alterado → A × B lado a lado; variação salva em `qa/propostas`, reaberta, comparada, aplicada com diff/motivo e **revertida** (auditoria registra as duas). Pedido para Luna gerado com a cadeia completa. |
| Ambiente/objeto por ID | `loterica`, `celular` (mão) e demais desenhados pelo renderizador real na prévia do catálogo e no laboratório. |
| Mesma semente | Esteira: hash igual. Laboratório: tocado = buscado = repetido em 73/73 cenas. |

## 8. Achados reais do painel (encaminhados)
- Cena `feiraCiencias` recebe `data.demonstrou/falhou`, mas o roteiro não lê: o resultado "deu certo" mostra a animação do
  desastre. → conteúdo (Luna).
- Agressão no trabalho usa o ambiente da carreira (`caixa` → `ruaDia`, enquanto a entrevista é no `mercado`), e a demissão
  escoltada usa `escritorio`. → conteúdo/balanceamento (`careers.ts` é zona amarela).
