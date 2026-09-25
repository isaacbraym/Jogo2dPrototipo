# Prompt para o Codex — caça a bugs visuais + vida social na rua

> Cole o bloco abaixo no Codex (ou diga: "leia e execute `instrucoesCodex/PROMPT-BUGS-VISUAIS-E-RUA.md`").

```text
Você vai trabalhar no jogo VIVA! em C:\PROJETOS\Prototipo_Game2d (TypeScript + Vite + Canvas 2D, tudo em pt-BR).
Missão em 3 partes: (A) caçar e corrigir bugs visuais, (B) deixar a rua tão social quanto a academia,
(C) publicar no GitHub e abrir o jogo no localhost para o usuário testar.

═══ 0. ANTES DE TUDO (obrigatório, nesta ordem) ═══
1. Leia inteiros: AGENTS.md, instrucoesCodex/README.md, instrucoesCodex/01-PADRAO-DE-QUALIDADE.md,
   instrucoesCodex/05-DIALOGOS-E-INTERACOES.md, instrucoesCodex/07-VERIFICAR-E-MOSTRAR-A-TELA.md, docs/EXPLORAR.md.
2. git checkout main && git pull --ff-only && git checkout -b codex/bugs-visuais-e-rua
3. npm install (se preciso) e deixe `npm run dev` rodando em segundo plano (http://localhost:5199).
4. AUTORIZAÇÃO ESPECIAL DESTA TAREFA: o usuário libera editar, além das zonas verde/amarela, SOMENTE estes arquivos
   da zona vermelha: src/character/hair.ts, src/character/head.ts, src/character/character.ts,
   src/explorar/controle.ts, src/explorar/tipos.ts, src/scenes/scene.ts. Regras para eles: mudança mínima e
   cirúrgica, comentário de 1 linha explicando o porquê, nunca renomear/apagar ids, nunca mudar o formato do save de
   forma incompatível (campos novos sempre opcionais, com `??=` na migração de prepararEstado).
5. MOSTRE A TELA: toda correção visual precisa de captura ANTES e DEPOIS no chat
   (`npm run capturar -- <nome> "<url>"`, guia 07). Abra os PNG e descreva o que vê. Nunca diga "ficou bom" sem olhar.

═══ PARTE A — BUGS VISUAIS (investigar, reproduzir, corrigir, provar) ═══
Método para CADA bug: (1) reproduza com uma URL de captura; (2) ache a causa no código (não chute: leia a função);
(3) corrija na raiz; (4) capture de novo o mesmo caso + 2 variações; (5) anote na tabela do relatório final.

A1. CABELO NA FRENTE DA BOCHECHA (mecha que devia ficar atrás do rosto aparece por cima da bochecha).
   - Onde: src/character/hair.ts (estilos em STYLES: cada um tem `back` = camada atrás da cabeça e `front` = por cima
     do rosto; helpers frontCap/capPath/franjas) e a ordem de desenho em src/character/character.ts (~linha 211:
     drawHairBack antes do rosto, drawHairFront depois). Bochecha e contorno do rosto: src/character/head.ts
     (cheekW, faceOutline).
   - Referência de solução JÁ FEITA: a trança "do lado de lá" foi movida para a camada de TRÁS (comentário em hair.ts:
     "trança do lado de lá: na camada de TRÁS, nascendo na silhueta do rosto"). Mechas laterais do lado LONGE da
     câmera (em ¾, turn ≈ 0,72) devem ir para `back`; só o lado PERTO e a franja ficam em `front`.
   - Reproduzir TODOS os penteados em 3 giros com a galeria:
     npm run capturar -- cabelos-a "/?test&env=parque&n=6&m=parado&hair=longo,ondulado,franja,trancas,mariaChiquinha,blackPower"
     (troque a lista para cobrir todos os ids de penteado do CATALOGO.md; use também &sex=f e &sex=m).
   - Aceite: em ¾ e de frente, nenhuma mecha do lado de lá cobre bochecha/olho/boca; em perfil o cabelo não "flutua"
     na frente do rosto. Nenhum penteado piorou (compare antes/depois lado a lado).

A2. PESOS DA ACADEMIA APARECENDO DO LADO DE FORA (visto da calçada, a barra do supino fica por cima da fachada).
   - Causa provável (confirme!): em src/explorar/controle.ts, desenharBarras() desenha a barra no overlay `frente`
     (depois de TUDO, inclusive da fachada). O mesmo tipo de bug existe em outros overlays: desenharBanheiro (vidro,
     água, vapor do box visíveis de fora da casa), balões de fala e nomes (Actor.drawOverlay, chamado em
     src/scenes/scene.ts depois dos props) e partículas (this.fx.draw: suor, espuma) de quem está DENTRO do prédio.
   - Correção esperada: uma regra única "coisa de dentro de um prédio só aparece na medida em que a fachada está
     transparente". Ex.: helper em controle.ts `visibilidadeDeFora(x, y)` = 1 − alpha da fachada do prédio que cobre x
     quando y < FACHADA_Y (e 1 fora de prédios); use como globalAlpha em desenharBarras e desenharBanheiro; para balões
     e nomes, esconda o overlay de atores dentro de prédio com fachada opaca (ex.: flag no ator lida pelo Scene antes de
     drawOverlay); para partículas, idem ou gere-as só se visíveis.
   - Reproduzir: npm run capturar -- academia-fora "/?ex=7900,860&zoom=0.8&hora=10#explorar"
     (espere NPCs no supino; se precisar force pelo console: __ex.npcs, __ex.testarUso — veja guia 07).
     Também: "/?ex=1500,860&zoom=0.8&hora=10#explorar" (casa por fora) com alguém tomando banho.
   - Aceite: da calçada, nada de dentro da academia/casa atravessa a fachada; ao entrar, tudo volta a aparecer.

A3. VARREDURA GERAL (encontre e corrija pelo menos 5 bugs visuais além dos acima). Roteiro mínimo:
   - npm run capturar -- --roteiro qa/roteiros/explorar.json (11 telas) — e crie qa/roteiros/bugs-visuais.json com os
     seus casos. Varie: dia/noite (hora=21), zoom 0.55 e 1.3, idade=12 (menor), calçada, praça, porta da casa.
   - Procure: coisas desenhadas por cima do que deviam estar atrás (ordem por y / PlacedProp.ordem), gente
     flutuando ou afundada no móvel (assento/plataforma), objetos de mão fora da mão, sobreposição de móveis,
     textos cortados no HUD/menus, NPC atravessando parede/fachada, sombra faltando, cena de contato (abraço/beijo:
     SPEC-07/08) com mão atravessando corpo.
   - Para cada bug: título, URL de reprodução, causa, arquivo:linha, correção, captura antes/depois.

═══ PARTE B — RUA SOCIAL (tão boa quanto a academia) ═══
Hoje: na calçada só há "passantes" anônimos (papel 'passante' em controle.ts: tickPassantes, menuPessoa) com
"Cumprimentar" e "Perguntar as horas" (INTERACOES_PASSANTE em gente.ts). Na academia existe o caminho completo:
Desconhecido → Rosto conhecido → Colega → pedir contato → Contato (vai para L.people / aba Relações) → Amigo → Melhor
amigo, com frequentadores persistentes (garantirFrequentadores, L.explorar.frequentadores.academia).
Objetivo: MORADORES DO BAIRRO com o mesmo caminho, na rua e na praça.

B1. Moradores persistentes: em gente.ts, garantirFrequentadores(L, est, 'rua') passa a gerar ~10 moradores
    (idades variadas, inclusive idosos; semente L.seed + outro número; assiduidade). O tipo já aceita qualquer LugarId
    (L.explorar.frequentadores.rua) — saves antigos continuam válidos.
B2. Presença: em controle.ts, parte dos passantes gerados passa a ser um morador (papel 'frequentador', lugar 'rua',
    com f) que anda pela calçada; outros ficam na PRAÇA (sentam no banco — objetos bancoPraca1/2 —, olham o chafariz,
    passeiam na zona 'praca'). Passantes anônimos continuam existindo (a rua precisa de movimento), mas em menor número.
    Ao clicar num morador que está andando, ele PARA para conversar (para: true) e volta a andar depois.
B3. Níveis por lugar: nivelDe/NIVEIS usam o lugar para o nome do nível 2 — academia "Colega de academia",
    rua "Conhecido(a) do bairro" (adapte o aviso em encenar()). Os ids e a lógica de familiaridade (15/35) ficam iguais.
B4. Interações de rua (acrescente em INTERACOES_ESTRANHO sem mudar as existentes; ids novos em camelCase):
    - generalize o que for genérico para qualquer lugar: cumprimentar, apresentar, piadaEstranho, highFiveEstranho,
      pegarContato (confira as condições `pode`: nada de exigir academia quando não faz sentido);
    - novas SÓ da rua (c.lugar === 'rua'): papo sobre o bairro, comentar o tempo (resposta muda com c.est.hora),
      perguntar as horas (versão com familiaridade), pedir informação, elogiar o cachorro/o look, "Você mora por
      aqui?" — cada uma com 3–5 respostas por personalidade (traco()), consequência real (familiaridade, social,
      diversão) e limite diário (c.hoje);
    - em INTERACOES_CONTATO: "Tomar um café na padaria" (custa R$ 8, vínculo +, fome +), "Sentar no banco da praça
      juntos" (conversa longa, vínculo +, social +), "Caminhar juntos" — só na rua/praça.
    - iniciativa: tickIniciativa hoje só roda na academia; faça moradores também puxarem conversa na rua/praça
      (puxaConversa com falas de bairro).
B5. Aceite (teste de ponta a ponta no navegador, e mostre capturas dos balões e do menu):
    morador desconhecido → cumprimentar/se apresentar alguns dias → vira "Conhecido(a) do bairro" → pedir o contato →
    aparece na aba Relações → interações de contato e clássicas (conversar, elogiar, abraçar...) funcionam na rua.
    Passante anônimo continua com o menu simples (cumprimentar, horas e as novas do guia 05 se quiser).
    Nada quebra na academia (repita o caminho lá).

═══ PARTE C — ENTREGA ═══
1. npm run check (sem erros) → npm run catalog → entrada nova em docs/CHANGELOG.md (data, "Codex", lista de bugs com
   causa/correção e os ids novos) → atualize docs/EXPLORAR.md (seção Gente: moradores do bairro) e marque em
   instrucoesCodex/08-TAREFAS-PRONTAS.md o que concluiu (T1/T2 se fizer).
2. Commits temáticos em português, ex.: "fix(visual): mechas do lado de lá atrás da bochecha",
   "fix(explorar): nada de dentro dos prédios atravessa a fachada", "feat(explorar): moradores do bairro na rua e praça".
   Termine a mensagem de cada commit com a linha:  Co-Authored-By: Codex <noreply@openai.com>
3. PUBLICAR (o usuário AUTORIZA push em main nesta tarefa):
   git checkout main && git pull --ff-only && git merge --no-ff codex/bugs-visuais-e-rua && npm run check && git push origin main
   Depois confira o deploy: gh run list --branch main --limit 1 (tem que ficar "success"; se falhar, leia o log com
   gh run view <id> --log-failed, corrija e publique de novo).
4. ABRIR PARA O USUÁRIO TESTAR: com `npm run dev` rodando, abra o navegador em http://localhost:5199
   (Windows: Start-Process "http://localhost:5199"). No rodapé da tela de título aparece "Versão <data> · <commit>":
   confira que o commit é o que você acabou de publicar. O botão verde "Explorar o mundo" leva direto ao mundo.
5. Relatório final no chat: tabela de bugs (antes/depois com as capturas), o que mudou na rua (com capturas do menu e
   dos balões), comandos que rodou, commit publicado, link do site (https://isaacbraym.github.io/Jogo2dPrototipo/) e o
   que ficou pendente. Se algo não deu, diga claramente — não esconda falhas.

═══ REGRAS QUE NÃO SE QUEBRAM ═══
- Não renomeie nem apague ids; só acrescente. Não use Math.random em lógica de jogo (use rng).
- Humor ácido dentro da SPEC-06; nada sexual com menores; regras do banheiro em docs/EXPLORAR.md continuam valendo.
- Toda interação nova tem consequência real. Texto do jogador com (a); NPC com he(p, 'ele', 'ela').
- Se travar em algo do motor fora da lista autorizada, NÃO edite: registre em docs/PEDIDOS-ENGINE.md e siga com o resto.
```
