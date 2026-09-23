# Backlog de conteúdo

Ideias esperando implementação. Marque `[x]` e o id criado quando terminar (ex.: `[x] ... → pixErrado`).
**P1** = mais impacto para o jogo parecer vivo · **P2** = bom · **P3** = quando der.
Itens marcados **[ENGINE]** precisam de mudança no motor → não implemente; copie para `docs/PEDIDOS-ENGINE.md`.

## A. Eventos aleatórios — vida adulta (P1)
- [x] Pix para o número errado (devolvem / bloqueiam / expor no grupo do bairro → vingança do vizinho depois) → `pixNumeroErrado`, `vizinhoLembra`
- [x] Golpe do falso parente pedindo dinheiro (variação do `golpeZap` com avó como alvo, não o jogador) → `golpeFalsoParente`
- [x] Conta de luz absurda no verão (ouvidoria = 180 dias úteis; "gato" com risco de multa/curto) → `contaLuzVerão`
- [x] Enchente na rua (salvar móveis / filmar pro story / ajudar vizinhos → karma + gripe; cena dedicada fica para G) → `enchenteNaRua`
- [x] Apagão no dia da entrega do trabalho (desculpa aceita? chefe desconfia → advertência) → `apagaoNaEntrega`
- [x] Nome sujo no cadastro de crédito (negociar / ignorar / feirão "limpa nome") → `nomeSujo`, `cobrancaInesperada`
- [x] Vizinho de cima com furadeira domingo 7h (reclamar / revidar com som alto / chamar síndico → condomínio briga) → `furadeiraDomingo`, `vizinhoLembra`
- [ ] Aposta online viciante (ganha pouco no começo, perde muito depois; flag de vício → eventos de recaída)
- [x] Curso de "mentalidade milionária" de coach (pagar R$ 1.997 / desistir / virar coach também) → `cursoMilionario`, `cobrancaInesperada`
- [ ] Reunião de condomínio (virar síndico → poder + inimigos)
- [ ] Carro guinchado / multa / flanelinha (pagar / discutir / "cuidar do carro" de novo)
- [ ] Assalto no ônibus (entregar celular / resistir → risco alto / esconder celular falso)
- [ ] Black Friday (compra parcelada → dívida nos anos seguintes)
- [ ] Mudança de apartamento com amigos "que têm carro" (vínculo sobe ou desce; sofá entalado na escada)
- [ ] Plano de saúde nega cirurgia (processar / pagar / SUS → fila → consequência de saúde)
- [ ] Ser chamado de "senhor(a)" pela primeira vez (crise dos 30/40 → academia, carro esportivo, tatuagem)

## B. Trabalho (P1)
- [x] Feedback sanduíche do chefe (flag de desempenho → promoção/demissão futura) → `feedbackSanduiche`, `justaCausaFeedback`
- [x] Estagiário mais competente que você (ensinar / sabotar → ele vira seu chefe anos depois) → `estagiarioBrilhante`, `estagiarioVirouChefe`
- [x] Colega leva crédito pelo seu trabalho (confrontar / denunciar ao RH com consequências) → `colegaRoubaCredito`
- [x] Happy hour obrigatório (convívio opcional só no convite) → `happyHourObrigatorio`
- [ ] Reunião que podia ser e-mail (evento criado; cena dedicada `reuniaoZoom` pendente no lote G) → `reuniaoQueEmailResolvia`
- [x] Assédio moral do chefe (denunciar → risco / processo trabalhista anos depois → indenização) → `assedioMoralChefe`, `indenizacaoTrabalhista`
- [x] Layoff "somos uma família" (demissão em massa; acerto; caixa de pertences) → `layoffSomosFamilia`
- [x] Greve / paralisação (aderir ou continuar trabalhando → efeitos sobre equipe e desempenho) → `greveParalisacao`
- [x] Home office com família em casa (cachorro, filho, microfone aberto) → `homeOfficeComFamilia`
- [x] Amigo oculto da firma (presente e vínculo) → `amigoOcultoFirma`

## C. Infância e escola (P1)
- [x] Festa junina (quadrilha, pescaria e barraca) → `festaJuninaEscola`
- [x] Recuperação em várias matérias; boletim escondido dos pais (descobrem → castigo) → `boletimEscondido`, `paisAchamBoletim`
- [x] Feira de ciências (vulcão transborda → detenção ou prêmio) → `feiraCienciasEscolar`
- [x] Excursão escolar (se perder no museu / enjoo no ônibus) → `excursaoEscolar`
- [x] Bullying: ser a vítima (contar / aguentar / revidar → sistema de agressão) → `provocacaoEscola`, `valentao` (já existentes)
- [x] Trabalho em grupo em que só você faz tudo (nota boa, vínculo com colegas cai) → `trabalhoGrupoSozinho`
- [x] Primeiro celular (jogo até tarde → nota cai) → `primeiroCelular`
- [x] Mentira de que o cachorro comeu o dever (professor pede foto do cachorro) → `cachorroComeuDever`

## D. Família e relacionamentos (P1/P2)
- [ ] Ceia de Natal com briga genérica de política (cena no `sala`, parentes gritando; vínculos mudam)
- [ ] Tia perguntando "e o namoro?" em todo evento (aos 25+ solteiro)
- [ ] Sogra/sogro morando junto (após casamento)
- [ ] Irmão pede dinheiro emprestado (e nunca devolve → flag → cobrança em evento futuro)
- [ ] Herança: briga pelo espólio após morte dos pais (dividir / brigar na justiça / abrir mão)
- [ ] Velório com coxinha e parente que só aparece no enterro
- [ ] Traição descoberta pelo celular (confrontar / fingir / vingança → agressão com consequências)
- [ ] Filho adolescente rebelde (castigo / conversar / comprar o que ele quer)
- [ ] Netos que só ligam no Pix
- [ ] Reencontro com ex no mercado (voltar / fugir / fingir que não viu)

## E. Velhice (P2)
- [ ] Aprender a usar o celular com o neto (golpe do link → perde dinheiro)
- [ ] Fila do INSS / prova de vida
- [ ] Hidroginástica / baile da terceira idade (romance na terceira idade)
- [ ] Escrever o testamento (deixar tudo pro gato → família revoltada)

## F. Variações de consequência em eventos existentes (P1 — ajuste seguro)
- [ ] Para cada evento com 1 só desfecho por escolha, criar 2–3 desfechos sorteados (`rng.chance`/`rng.pick`) influenciados por stats.
- [ ] Acrescentar `react` (reação do NPC) e `mood` nos eventos antigos que ainda não têm.
- [ ] Criar 8 "retornos" (eventos que leem flags de escolhas passadas): ex. quem colou na prova (`infracoes`) é pego anos depois no
      diploma; quem ajudou `amigoPrecisa` é ajudado de volta; quem entregou o lanche ao valentão reencontra o valentão adulto.
- [ ] Frases de reprovação e respostas de entrevistador novas (`REJECT`, `GENERIC`) — 20 novas.

## G. Cenas, animações e ambientes (P2)
- [ ] Ambientes: `loterica`, `rodoviaria`, `feiraLivre`, `pontoOnibus`, `upa`, `cartorio`, `salaoBeleza`, `lanHouse`, `quadraVarzea`, `postoGasolina`
- [ ] Movimentos: `espreguicar`, `bocejar`, `digitarFurioso`, `carregarCaixa`, `limparSuor`, `abanar` (calor), `dancarQuadrilha`,
      `tropecarEscada`, `escorregar`, `desmaiar`, `ajoelharImplorar`, `contarDinheiro`, `selfie`, `gravarStory`
- [ ] Expressões: `sarcastico`, `desconfiado`, `aliviado`, `enjoado`, `derrotado`
- [ ] Objetos: `orelhao`, `carrinhoMercado`, `ventilador`, `marmita` (mão), `bilheteLoteria` (mão), `sacola` (mão), `guardaChuvaQuebrado` (mão)
- [ ] Cenas: `reuniaoZoom`, `furadeiraDomingo`, `ceiaNatal`, `festaJunina`, `feiraCiencias`, `enchente`, `assaltoOnibus`, `velorioCoxinha`, `bingoIdosos`

## H. Sistemas (precisam do motor) **[ENGINE]**
- [ ] Memória de NPC: rancor/gratidão por pessoa (hoje só `bond`) → NPC lembra de agressões e favores.
- [ ] Vícios (aposta, álcool, cigarro) como estado persistente com recaídas.
- [ ] Reputação no bairro/trabalho separada do karma.
- [ ] Condições de saúde crônicas (pressão alta, diabetes) com eventos próprios.
- [ ] Eventos de "notícia do mundo" (crise econômica, pandemia genérica) que afetam todos os NPCs.
