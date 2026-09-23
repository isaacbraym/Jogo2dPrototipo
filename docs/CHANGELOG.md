# Changelog

## 2026-09-23 — Lote 05: variações, retornos e entrevistas (Codex)

**Eventos (8 retornos):** `videoFirmaReaparece`, `colegasGreveLembram`, `amigoAjudaVolta`, `valentaoAdulto`, `colaNoDiploma`, `celularVolta`, `piramideContatoVolta`, `netoLembraConversa`.
**Eventos antigos ampliados (10):** `valentao`, `provaEscola`, `amigoPrecisa`, `loteriaAchada`, `acidenteRua`, `piramide`, `filaSUS`, `happyHourObrigatorio`, `primeiroCelular`, `recuperacao`; resultados agora variam por atributos/sorte e trazem reações coerentes.
**Escolhas novas:** 16 (duas em cada retorno); escolhas antigas também ganharam ramos sorteados.
**Entrevistas:** 20 novas mensagens de entrevistador/reprovação: oito resultados em `REJECT` e três perguntas genéricas com nove respostas.
**Flags novas (12):** `amigoAjudaPessoaId`, `amigoAjudaIdade`, `amigoAjudaValor`, `valentaoAdultoIdade`, `valentaoAdultoNome`, `colaNoDiplomaIdade`, `celularVirouNoiteIdade`, `piramideInvestidaIdade`, `piramideInvestidaValor`, `piramideInvestidaResultado`, `netoLembraConversaIdade`, `netoLembraConversaPessoaId`. `videoFirmaIdade`, `greveAderiuIdade` e `infracoes` reaproveitam estado já existente.
**Cadeias:** o empréstimo a um amigo pode voltar como ajuda; ceder o lanche reaparece na vida adulta; colar pode pedir avaliação complementar; jogar de madrugada retorna como lembrança; lucro/perda da pirâmide altera o retorno; conversar com o neto pode render uma visita futura.
**Ajuste financeiro:** `piramide` agora debita o aporte antes do sorteio e paga duas vezes o aporte no sucesso, evitando criar dinheiro indevido; a chance usa inteligência e karma.
**Backlog:** seção F concluída para dez eventos antigos escolhidos por terem resultados únicos em decisões importantes; oito retornos e vinte textos de entrevista adicionados.
**Verificação:** `npm run check:quick` ✅ · `npm run check` ✅ · `npm run build` ✅ · `npm run catalog` ✅. Avisos de cobertura: os retornos dependem das escolhas que gravam as flags; nesta rodada, o sorteio aleatório também não executou `herancaBriga` → “Dividir entre todos”.
**Verificação visual:** sem itens visuais novos neste lote.
**Pendências/pedidos de engine:** nenhum novo.

## 2026-09-23 — Lote 04: família, relações e velhice (Codex)

**Eventos (14: 12 situações e 2 retornos):** `ceiaNatal`, `tiaPerguntaNamoro`, `sograMoraJunto`, `irmaoPedeEmprestado`, `irmaoNaoDevolve`, `herancaBriga`, `velorioCoxinha`, `filhoAdolescenteRebelde`, `netoSoLigaNoPix`, `aprenderCelularComNeto`, `provaVidaInss`, `baileTerceiraIdade`, `testamentoGato`, `familiaContestaTestamento`.
**Eventos existentes ampliados (3):** `netos` cria e registra a pessoa neta; `traicao` agora inclui fingir que não viu e agressão verbal com as consequências de `aggress`; `reencontro` agora permite tentar reatar, com chance e resultado real.
**Escolhas:** 42 em eventos novos; `traicao` passou a quatro escolhas e `reencontro` a três.
**Cenas, movimentos, expressões, ambientes, objetos e interações novos:** 0; o lote usa `churrasco`, `funeral`, `interacao`, `brigaFamilia`, `encontro`, `reflexao` e `balada`.
**Flags novas (7):** `netoPessoaId`, `irmaoEmprestimoPessoaId`, `irmaoEmprestimoIdade`, `irmaoEmprestimoValor`, `testamentoGatoIdade`, `testamentoGatoValor`, `testamentoGatoPetId`.
**Cadeias:** empréstimo ao irmão volta para cobrança no ano seguinte; reservar bens ao gato volta em uma conversa com a família; o neto criado em `netos` serve às histórias de Pix e golpe de link.
**Backlog:** todas as seções D e E concluídas. O romance com ex e as reações à traição foram acrescentados a eventos que já existiam.
**Limitação registrada:** o motor não tem tipos de relação para tia, sogro/sogra e neto/neta. O conteúdo usa conhecidos/flags; a proposta para ampliar `Rel` foi registrada em `docs/PEDIDOS-ENGINE.md`.
**Verificação:** `npm run check:quick` ✅ · `npm run check` ✅ · `npm run build` ✅ · `npm run catalog` ✅. Avisos de cobertura: `vizinhoLembra`/`cobrancaInesperada` dependem de escolhas anteriores; `justaCausaFeedback` exige advertências; `estagiarioVirouChefe` e `indenizacaoTrabalhista` aguardam dois anos; `paisAchamBoletim` e `irmaoNaoDevolve` dependem das escolhas que gravam as flags; `filhoAdolescenteRebelde` exige filho adolescente; os eventos de neto dependem do nascimento registrado; o testamento exige gato e família.
**Verificação visual:** sem itens visuais novos; cenas existentes reaproveitadas.
**Pendências/pedidos de engine:** nova solicitação aberta para tipos de relação familiar.

## 2026-09-23 — Lote 03: infância e escola (Codex)

**Eventos (8: 7 situações e 1 retorno):** `festaJuninaEscola`, `boletimEscondido`, `paisAchamBoletim`, `feiraCienciasEscolar`, `excursaoEscolar`, `trabalhoGrupoSozinho`, `primeiroCelular`, `cachorroComeuDever`.
**Escolhas (24):** três por evento; o trabalho de grupo e as avaliações escolares variam com inteligência e sorte.
**Cenas, movimentos, expressões, ambientes, objetos e interações novos:** 0; reutiliza `aula`, `viagem`, `brigaFamilia`, `detencao` e `telefonema`.
**Flags novas (1):** `boletimEscondidoIdade`, consumida quando os pais encontram o boletim no ano seguinte. `infracoes` reaproveita o contador escolar existente.
**Cadeias:** esconder o boletim pode voltar como descoberta e castigo; feira de ciências e mentira sobre o dever podem gerar detenção e contato com os pais.
**Backlog:** oito itens da seção C concluídos. O bullying já tinha cobertura em `provocacaoEscola` e `valentao`; o lote os registra sem duplicar eventos.
**Verificação:** `npm run check:quick` ✅ · `npm run check` ✅ · `npm run build` ✅ · `npm run catalog` ✅. Avisos de cobertura já documentados no Lote 02 permanecem; o aviso novo, `paisAchamBoletim`, depende da escolha de esconder o boletim, de um ano e da existência de pais vivos.
**Verificação visual:** sem itens visuais novos; cenas existentes reaproveitadas.
**Pendências/pedidos de engine:** nenhum pedido de engine.

## 2026-09-23 — Lote 02: trabalho e relações da firma (Codex)

**Eventos (13: 10 situações e 3 retornos):** `feedbackSanduiche`, `justaCausaFeedback`, `estagiarioBrilhante`, `estagiarioVirouChefe`, `colegaRoubaCredito`, `happyHourObrigatorio`, `reuniaoQueEmailResolvia`, `assedioMoralChefe`, `indenizacaoTrabalhista`, `layoffSomosFamilia`, `greveParalisacao`, `homeOfficeComFamilia`, `amigoOcultoFirma`.
**Escolhas (40):** três por evento; `estagiarioBrilhante` tem uma quarta escolha de sabotagem, com risco de advertência e consequência no retorno.
**Cenas, movimentos, expressões, ambientes, objetos e interações novos:** 0; o lote reutiliza `reuniao`, `diretoria`, `demissao`, `trabalho`, `festaFirma` e `interacao`.
**Flags novas (12):** `feedbackTrabalho`, `feedbackTrabalhoJob`, `estagiarioPessoaId`, `estagiarioIdade`, `estagiarioEscolha`, `estagiarioEmprego`, `videoFirmaIdade`, `videoFirmaJob`, `assedioMoralIdade`, `assedioMoralValor`, `greveAderiuIdade`, `greveEmpregoId`. `advertencias` reaproveita o contador do motor.
**Cadeias:** advertência do feedback mais uma advertência pode abrir a reunião de justa causa; a mentoria ou disputa com o estagiário retorna quando ele assume liderança; denúncia acolhida pelo RH volta como acordo trabalhista após dois anos.
**Backlog:** nove de dez itens da seção B concluídos. `reuniaoQueEmailResolvia` usa `reuniao` até a cena dedicada `reuniaoZoom` do lote G.
**Verificação:** `npm run check:quick` ✅ · `npm run check` ✅ · `npm run build` ✅ · `npm run catalog` ✅. Os avisos de cobertura são esperados: `justaCausaFeedback` exige advertências acumuladas; `estagiarioVirouChefe` e `indenizacaoTrabalhista` exigem escolhas passadas e dois anos de espera. Os retornos do Lote 01 também dependem de escolhas prévias.
**Verificação visual:** sem itens visuais novos; cenas e movimentos existentes reaproveitados.
**Pendências/pedidos de engine:** nenhum pedido novo. A cena `reuniaoZoom` ficou para o lote G.

## 2026-09-23 — Lote 01: vida adulta e boletos (Codex)

**Eventos (10: 8 situações e 2 retornos):** `pixNumeroErrado`, `golpeFalsoParente`, `contaLuzVerão`, `enchenteNaRua`, `apagaoNaEntrega`, `nomeSujo`, `furadeiraDomingo`, `cursoMilionario`, `vizinhoLembra`, `cobrancaInesperada`.
**Escolhas (31):** três por evento, exceto `contaLuzVerão` (quatro); apostas arriscadas variam por sorte e atributos.
**Cenas, movimentos, expressões, ambientes, objetos e interações novos:** 0. O lote reutiliza `reflexao`, `telefonema` e `interacao`.
**Flags novas (7):** `pixExposto` e `pixVizinhoId`; `furadeiraRevidada` e `furadeiraVizinhoId`; `contaLuzPendente`; `nomeSujo`; `cursoCoachComprado`. Os retornos limpam cada pendência quando resolvida. `advertencias` já existia e agora recebe a consequência do apagão no trabalho.
**Cadeias:** expor o Pix ou revidar com som pode voltar em `vizinhoLembra`; a conta de luz pendente, dívida de crédito e compra do curso voltam em `cobrancaInesperada`; a conta atrasada aumenta o peso de `apagaoNaEntrega`.
**Backlog:** oito itens da seção A concluídos. Aposta online viciante continua pendente; a cena dedicada da enchente fica para o lote G.
**Verificação:** `npm run check` ✅ (um aviso de cobertura esperado: os dois retornos dependem de flags geradas por escolhas e não são alcançados nos perfis limpos do validador); `npm run build` ✅; `npm run catalog` ✅ (59 eventos).
**Verificação visual:** harness conferido em `reflexao` (chuva), `telefonema` e `interacao` no subúrbio; personagens e cenários renderizados. Não foram criados itens visuais novos.
**Pendências/pedidos de engine:** nenhum pedido de engine.

Entradas mais novas no topo. Cada lote registra: data, agente, o que foi criado (com ids), flags novas, consequências,
verificação e pendências. Modelo em `.agents/skills/viva-verificar-e-entregar/SKILL.md`.

## 2026-09-23 — Documentação, validador e preparação para delegação (Claude)
- **Ferramentas:** `npm run check` (typecheck + `scripts/check-content.ts`: ids únicos, referências literais, pose/expressão
  finitas, todos os eventos × 10 perfis de vida × todas as escolhas, ações, interações, agressões, entrevistas de todas as
  carreiras e 60 vidas simuladas), `npm run check:quick`, `npm run catalog` (gera `docs/CATALOGO.md`).
- **Docs:** `AGENTS.md`, `CLAUDE.md`, `docs/ARQUITETURA.md`, `docs/specs/SPEC-01..06`, `docs/BACKLOG.md`,
  `docs/PEDIDOS-ENGINE.md`, `docs/DELEGACAO-LUNA.md`; 7 skills em `.agents/skills/`.
- **Código:** `HELD` exportado de `render/props.ts` (para o validador); `tsx` e `@types/node` como devDependencies.
- **CI:** `pages.yml` roda o validador rápido antes de publicar; novo `check.yml` valida branches (ex.: `luna/*`) e PRs.

## 2026-09-23 — Expansão: realismo, consequências e agressões (Claude)
- Agressões com consequência estilo BitLife (10 tipos): esquiva, revide, ferimento, advertência/justa causa, detenção →
  suspensão → expulsão, castigo, término, B.O., julgamento e prisão (`game/aggression.ts`).
- Entrevistas realistas por vaga (`game/interviews.ts`): ambiente certo, roupa, perguntas ácidas, teste prático, probabilidade.
- Rig: coluna em 2 segmentos, respiração, ombros, punhos, inclinação de quadril. 25+ movimentos, 6 expressões.
- Novos ambientes: `mercado`, `boteco`, `cafeteria`, `delegaciaInterna`, `diretoria`.
- Novas cenas: `agressao`, `detencao`, `diretoria`, `demissaoSeguranca`, `boletim`, `entrevista2`, `churrasco`, `transito`,
  `filaHospital`, `festaFirma`, `reuniao`. Novos eventos: `churrasco`, `golpeZap`, `piramide`, `transito`, `filaSUS`,
  `festaFirma`, `chefeHumilha`, `provocacaoEscola`, `recuperacao`, `vizinho`.
- `react` e `mood` nos resultados: fim do "sorriso depois do soco". Editor mobile com close na parte editada.
- Correções: teste prático da entrevista não entrega a resposta; fila do hospital com cadeiras; condenação tira o emprego.

## 2026-09-23 — Protótipo inicial (Claude)
- Editor de personagem modular, 34 ambientes, 50+ situações, motor de vida anual, carreiras, relações, conquistas,
  save/load, trilha sintetizada, `Jogar.bat`, deploy no GitHub Pages.
