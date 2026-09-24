# Changelog

## 2026-09-24 — Relacionamentos com memória, namoro/casamento/divórcio, ações por idade e idade inicial (Claude) · branch `claude/relacionamentos`
- **Memória de relacionamento** (`src/game/relacoes.ts`, pedido de engine atendido): cada pessoa guarda mágoa, medo, gratidão,
  confiança, agressões, desculpas e promessas quebradas + últimos fatos. Gestos positivos (campo novo `Interaction.gesto`)
  podem ser recusados e rendem menos com mágoa/repetição; **consolo é recusado por quem você machucou**; medo recusa contato;
  corte de contato após agressões graves; teto de vínculo; o tempo cura devagar (anual). Agressões gravam na memória e a
  mágoa aumenta o revide. Save compatível (`Person.memo` opcional).
- **Amor:** interações novas `paquerar`, `encontro`, `dr`, `pedirCasamento`, `casar` (evento encadeado "O grande dia"),
  `divorcio`, `reatar`; `terminar` reescrita. Eventos novos `parceiroTermina`, `conjugePedeDivorcio`, `exQuerVoltar`, `bodas`.
  `pedidoParceiro` e `traicao` passam a usar memória/`encerrarRelacao`. Divórcio com advogado, partilha, casa e **pensão
  alimentícia** anual. Término automático do fim do ano usa as mesmas regras. Mapa completo em `docs/RELACIONAMENTOS.md`.
- **Ações do palco por idade:** só aparecem as que a idade permite (bebê: rir e chorar); ao liberar novas, aparece um aviso
  simples "Novas ações liberadas!". Sai o toast "Você ainda é um bebê!".
- **Nova vida pergunta a idade:** ao clicar em "Começar vida" abre um seletor (nascer, 6, 14, 18, 25, 40, 65 ou livre).
  `newLife` agora prepara idades intermediárias (escola e turma para 6–17, dinheiro/CNH para adultos, pais idosos podem já ter
  falecido).
- **Correção:** amizade que esfriava virava "colega de escola"; agora vira "conhecido(a)".
- **Validador:** perfis de teste novos `casamentoEmCrise` e `noivoComEx`. Flags novas `acoesPalcoVistas`, `pensaoDesde` (SPEC-01).

## 2026-09-24 — V4 do chute promovida para a cena oficial (Codex)
- Aplicada a trajetória escolhida ao ramo `kind === 'chute'` da cena `agressao`: impacto sincronizado, reação com salto, queda ajoelhada para a frente e pose no chão.
- A vítima se levanta da pose frontal antes de revidar ou voltar à discussão. Preservado o caminho de esquiva e os demais tipos de agressão.
- Removidas as cenas comparativas `agressaoChuteV1`–`agressaoChuteV4` e as animações de teste não escolhidas. Mantidos os IDs da V4 (`impactoChuteQA4`, `caidoChuteQA4`) e adicionada `levantarChuteFrenteQA4` para a retomada da vítima.
- Permanecem abertos em `docs/PEDIDOS-ENGINE.md` o desenho por camadas de partes do corpo e o apoio calculado no chão.
- **Verificação:** `npm run catalog`, `npm run check` e `npm run build`; verificação visual pendente.

## 2026-09-24 — Quatro novas trajetórias de QA para o chute (Codex)
- Substituídos os testes anteriores de `agressaoChuteV1`–`agressaoChuteV3` por quatro sequências completas e distintas; incluída `agressaoChuteV4`. Todas sincronizam o impacto com o chute, mostram o salto/reação, a queda de joelhos e terminam de bruços.
- Criados movimentos específicos `impactoChuteQA1`–`impactoChuteQA4` e poses finais `caidoChuteQA1`–`caidoChuteQA4`. A pose final desloca o eixo do corpo para baixo para aproximar tronco e cabeça da linha do chão; validar visualmente no painel, pois não há contato de chão calculado para poses rotacionadas.
- Registradas duas necessidades do motor em `docs/PEDIDOS-ENGINE.md`: ordenação de desenho por partes para inserir o pé entre as pernas da vítima e âncora de contato com o chão para corpos caídos.
- Os IDs `agressaoChuteV1`–`V3` foram mantidos para preservar os links do painel, mas suas animações de teste anteriores foram substituídas. Não alterada a agressão normal `chute`.
- **Verificação:** `npm run catalog`, `npm run check` e `npm run build`; prévia visual pendente. O ordenamento por partes e a colisão/âncora física aguardam o trabalho de engine descrito acima.

## 2026-09-24 — Revisão das variantes da agressão `chute` (Codex)
- Aplicado o feedback do teste: nas cenas `agressaoChuteV1`, `agressaoChuteV2` e `agressaoChuteV3`, a vítima fica no plano visual da frente e levanta a perna próxima no quadro sincronizado com o evento `hit` do chute.
- A reação agora inclui salto pelo impacto, proteção do baixo ventre ajoelhada e queda para a frente; adicionados os movimentos `receberChuteBaixo`, `cairParaFrente` e `caidoParaFrente`.
- **Verificação:** `npm run check` ✅ · `npm run build` ✅. Avisos de cobertura: as três cenas comparativas só rodam pelo Laboratório; `herancaBriga` tem um caminho que os perfis automáticos não exercem. Verificação visual pendente: Computer Use não conseguiu identificar com confiança a URL ativa do Chrome.

## 2026-09-23 — Variações de QA para agressão `chute` (Codex)
- Pedido do painel: agressão `chute` → cenas de comparação `agressaoChuteV1`, `agressaoChuteV2` e `agressaoChuteV3`.
- As três mostram o impacto na região baixa, reação de surpresa, ajoelhamento por dor e queda, com ritmos/recuos de câmera e corpo diferentes. A pose ajoelhada usa o movimento `protegerBaixoVentre`.
- As variantes forçam o acerto para reproduzir o caso no QA sem depender do sorteio de esquiva.
- Mantidos intactos `AGGRO.chute` e a cena normal `agressao`; as variantes são abertas diretamente no Laboratório para escolha antes de qualquer promoção.
- Atualizado o catálogo. **Verificação:** `npm run check` e `npm run build`; cenas comparativas não chamadas pela partida normal podem aparecer como não alcançadas.

## 2026-09-23 — Cena `medico` finalizada com a V2 validada (Codex)
- Promovida a implementação de `medicoV2` para a cena oficial `medico`, preservando o ID usado pelo jogo.
- Removidas `medicoV1`, `medicoV2` e `medicoV3` do catálogo de conteúdo após a escolha da V2; mantidos os ajustes aprovados de exame, expressão da paciente e lágrimas com gravidade vertical.
- **Verificação:** `npm run catalog`, `npm run check` e `npm run build`.

## 2026-09-23 — Propostas de QA para a cena `medico` (Codex)
- Mantida a cena original `medico` sem alterações; adicionadas três alternativas comparáveis: `medicoV1` (consulta acolhedora), `medicoV2` (exame e contato visual) e `medicoV3` (explicação do cuidado).
- As três variantes retiram o objeto `cobertor`, mantêm a paciente deitada sem o marcador facial de suor e emitem gotas a partir da região dos olhos com gravidade vertical.
- Atualizado `docs/CATALOGO.md` para expor os novos IDs no painel de QA. São variantes de comparação, não chamadas pela partida normal.
- **Verificação:** `npm run check` ✅; `npm run catalog` ✅; `npm run build` ✅. Prévia A de `medicoV1`, `medicoV2` e `medicoV3` aberta no Laboratório. O validador lista as três como cenas sem uso detectado na partida normal, esperado porque são abertas diretamente pelo painel.

## 2026-09-23 — Painel de QA: trava de gravação (Claude) · branch `claude/painel-qa`
- O painel abre **travado** ("🔒 Travado · só testes"): ajustes são só prévia e nada é gravado no projeto. O servidor
  recusa (423) salvar cenário/proposta, aplicar e reverter enquanto travado; destravar exige confirmação explícita
  ("Sim, desejo destravar…"); aplicar exige ainda marcar "Sim, desejo aplicar esta alteração no jogo". Aplicar/reverter
  trava de novo automaticamente; reiniciar o servidor também. `Painel.bat` abre o painel com duplo clique.
- Verificado: aplicar/salvar travado → recusado; "Continuar só testando" mantém a proposta em B sem gravar;
  destravar/travar pelo cadeado sem nenhuma escrita em arquivo.

## 2026-09-23 — Painel de QA local (Claude) · branch `claude/painel-qa`
- **Novo:** `npm run painel` → http://localhost:5199/painel.html (só desenvolvimento; ausente do `dist`). Abas Catálogo,
  Esteira de eventos, Laboratório, Qualidade e Alterações. Documentação completa em `docs/PAINEL-QA.md`.
- **Catálogo unificado** a partir dos registros reais (1076 itens: eventos, escolhas, ações, interações, agressões,
  entrevistas, cenas, ações corporais, ambientes, movimentos, expressões, objetos, objetos de mão, parâmetros visuais, flags,
  conquistas, emotes, partículas, sons), com arquivo:linha, trecho, prévia pelo renderizador real e vínculos
  confirmados / inferidos / observados (com contexto).
- **Esteira:** execução da lógica real com semente e caminho de escolhas; motivo exato de indisponibilidade; pré-requisitos
  lidos do código e precursores (eventos que escrevem as flags); cenário isolado editável e validado; execuções forçadas
  identificadas; todos os caminhos; exploração de sementes; diff antes/depois; cenários em `qa/cenarios/`.
- **Laboratório:** replay determinístico com passo fixo (busca temporal por reexecução), linha do tempo do Director com ids de
  trecho estáveis (`act:chute#1`), inspetor de cena/atores/pose por campo, esqueleto sobreposto, bonecos genéricos,
  verificação de determinismo (73/73 cenas: tocado = buscado = repetido).
- **Calibrador:** keyframes (instante, duração, campos da pose) e expressões dentro dos limites da SPEC-03; A/B (aplicado ou
  código × proposta), desfazer/refazer, variações nomeadas, propostas em `qa/propostas/`, aplicação com diff + motivo +
  cópia em `qa/historico/` + `qa/auditoria.jsonl`, reversão. Camada de dados `src/data/calibracao.json` aplicada por
  `src/character/calibracao.ts`. Movimentos procedurais: só prévia exploratória + pedido de código.
- **Pedido para Luna:** texto estruturado (tipo/id, cadeia, arquivo:linha, semente, cenário, instante/trecho, valores,
  observação, melhoria, nº de variações). Skill nova `.agents/skills/viva-painel-qa`.
- **Qualidade:** referências quebradas, varredura de eventos (alcance, precursores, todas as escolhas, inconsistências),
  varredura de cenas headless, itens sem referência com status honesto, keyframes fora dos limites, falhas capturadas,
  proteção de saves (bloqueio de `viva.*`).
- **Validador:** `npm run check` agora também valida `src/data/calibracao.json`, `qa/propostas/*.json` e `qa/cenarios/*.json`.
- **Motor (mudanças mínimas, justificadas em `docs/PAINEL-QA.md` §3.1):** `rng.reseed/estado`, `resetIds`, `resetActorIds`,
  `keyframes()` exportada com `fn.kf`, `eligible` exportada, `registrarResultado()` (fonte única usada por `ui/game.ts`),
  acumulador de partículas de ambiente por cena (antes global), `HELD` exportado. Save e comportamento do jogo inalterados.
- **Achados do painel** (em `docs/BACKLOG.md` §I): `feiraCiencias` ignora `data.demonstrou/falhou`; agressão no trabalho do
  caixa acontece em `ruaDia`.
- **Verificação:** `npm run check` ✅, `npm run build` ✅ (0 código do painel no `dist`), casos de aceitação de
  `docs/PAINEL-QA.md` §7 executados no navegador; a proposta de teste do chute foi aplicada e revertida (ver `qa/auditoria.jsonl`).

## 2026-09-23 — Lote 06: cenas, animações e ambientes (Codex)

**Eventos novos:** 0. O lote ligou conteúdo existente às cenas; ampliou `assalto` para quatro escolhas com custo/risco e deu uma quarta escolha a `baileTerceiraIdade`.
**Escolhas novas:** 2 — jogar bingo por R$ 20, com chance de prêmio de R$ 100 e mudanças de vínculo/humor; oferecer o celular velho sem chip no assalto, com chance de enganar e risco de perder também o aparelho principal.
**Cenas (9):** `reuniaoZoom`, `furadeiraDomingo`, `ceiaNatal`, `festaJunina`, `feiraCiencias`, `enchente`, `assaltoOnibus`, `velorioCoxinha`, `bingoIdosos`.
**Movimentos (14):** `espreguicar`, `bocejar`, `digitarFurioso`, `carregarCaixa`, `limparSuor`, `abanar`, `dancarQuadrilha`, `tropecarEscada`, `escorregar`, `desmaiar`, `ajoelharImplorar`, `contarDinheiro`, `selfie`, `gravarStory`.
**Expressões (5):** `sarcastico`, `desconfiado`, `aliviado`, `enjoado`, `derrotado`.
**Ambientes (10):** `loterica`, `rodoviaria`, `feiraLivre`, `pontoOnibus`, `upa`, `cartorio`, `salaoBeleza`, `lanHouse`, `quadraVarzea`, `postoGasolina`.
**Objetos (8):** cenário `orelhao`, `carrinhoMercado`, `ventilador`, `vulcaoEscolar`; de mão `marmita`, `bilheteLoteria`, `sacola`, `guardaChuvaQuebrado`.
**Ligações e cadeias:** `reuniaoQueEmailResolvia`, `furadeiraDomingo`, `ceiaNatal`, `festaJuninaEscola`, `feiraCienciasEscolar`, `enchenteNaRua`, `assalto`, `velorioCoxinha` e a nova escolha de `baileTerceiraIdade` usam as cenas correspondentes. `loteria` agora usa `loterica` e o bilhete de mão. No assalto, avisar o motorista pode falhar com perda de saúde/celular; correr traz risco de queda/celular; entregar perde o aparelho; o celular velho sem chip pode enganar o assaltante ou resultar na perda do principal. O bingo cobra a entrada e pode pagar prêmio; a derrota também altera humor/vínculo.
**Flags novas:** nenhuma. Nenhuma necessidade de motor surgiu do conteúdo do lote.
**Backlog:** seção G concluída; também fechados o assalto no ônibus da seção A e a cena pendente de `reuniaoQueEmailResolvia` na seção B. `vulcaoEscolar` foi incluído como objeto de cenário para a feira. Os itens de A ainda abertos são aposta online, reunião de condomínio, guincho/multa, Black Friday, mudança com amigos, plano que nega cirurgia e ser chamado(a) de senhor(a).
**Verificação automática:** `npm run catalog` ✅ · `npm run check` ✅ · `npm run build` ✅. Houve um aviso de cobertura para 20 eventos que exigem estados acumulados/flags, relações ou espera por anos: `vizinhoLembra`, `cobrancaInesperada`, `justaCausaFeedback`, `estagiarioVirouChefe`, `indenizacaoTrabalhista`, `paisAchamBoletim`, `irmaoNaoDevolve`, `filhoAdolescenteRebelde`, `netoSoLigaNoPix`, `aprenderCelularComNeto`, `testamentoGato`, `familiaContestaTestamento`, `videoFirmaReaparece`, `colegasGreveLembram`, `amigoAjudaVolta`, `valentaoAdulto`, `colaNoDiploma`, `celularVolta`, `piramideContatoVolta`, `netoLembraConversa`. As duas escolhas sorteadas de `herancaBriga` foram cobertas nesta execução. O validador também não detecta uso estático das cenas preexistentes `beijoPraia` e `abordagem`, disponíveis via UI/dados dinâmicos.
**Verificação visual:** as nove cenas conferidas em dois instantes e duas idades; dez ambientes, 14 movimentos, cinco expressões e objetos novos vistos no harness. Os dois desfechos do celular falso também foram conferidos. A caixa de `carregarCaixa` foi ajustada para aparecer nas mãos.
**Pendências/pedidos de engine:** o lote não exigiu alteração no motor. Os pedidos H de reputação, saúde crônica e notícias de mundo foram acrescentados à fila; os itens de A e H seguem aguardando os próximos lotes/o agente de motor em `docs/PEDIDOS-ENGINE.md`.

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
