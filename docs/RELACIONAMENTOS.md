# Relacionamentos no VIVA! — o que existe e o que falta

Mapa vivo do sistema de relacionamentos. Legenda: ✅ feito · 🟡 parcial · ⬜ falta · 🔍 analisar antes de implementar.
Código principal: `src/game/relacoes.ts` (memória e regras), `src/game/activities.ts` (interações), `src/game/events.ts`
(eventos anuais), `src/game/life.ts` (passagem do tempo), `src/game/aggression.ts` (agressões).

---

## 1. Vínculo e memória (base de tudo)

| | item | como funciona |
|---|---|---|
| ✅ | Vínculo (`bond` 0–100) | Quanto a pessoa gosta de você **hoje**. Cai 1–4 por ano sem contato. |
| ✅ | **Memória por pessoa** (`Person.memo`) | Guarda **por que** ela sente o que sente: `rancor` (mágoa), `medo`, `gratidao`, `confianca`, nº de agressões, desculpas aceitas/recusadas, **promessas quebradas** e os últimos 12 fatos marcantes. Opcional no save (criada sob demanda; saves antigos continuam válidos). |
| ✅ | Teto de vínculo | Mágoa e medo limitam o máximo: `100 − 0,75×mágoa − 0,35×medo`. Quem apanhou não volta a te amar 100%, por mais abraços que ganhe. A tela mostra "máximo possível hoje". |
| ✅ | Reação a gestos positivos | Toda interação marcada com `gesto` (conversar, abraçar, elogiar, presente, consolar, beijar, massagem, serenata, piada, dançar, brincar, pedir dinheiro, encontro) passa por `reacao()`: pode ser **recusada** (mágoa, medo, afastamento) e rende **menos** quanto mais mágoa houver. |
| ✅ | Consolo de quem machucou | "Consolar" é recusado se você agrediu a pessoa há ≤ 1 ano ou se a mágoa ≥ 35: *"Foi VOCÊ quem me machucou."* Insistir aumenta a mágoa. |
| ✅ | Medo | Violência física gera medo; com medo alto, carinho/romance são recusados com frequência ("se encolheu"). |
| ✅ | Desculpas com credibilidade | Chance depende de vínculo, mágoa, medo, gratidão, traços (gentil/rabugento), de já ter pedido desculpas no mesmo ano e das **promessas quebradas** (pediu desculpas e agrediu de novo). Aceitas reduzem a mágoa aos poucos — cada vez menos se você reincide. |
| ✅ | Cortar contato | Mágoa ≥ 85, ≥ 2 agressões e vínculo ≤ 15 → a pessoa **corta contato**: recusa quase tudo. Só volta a falar quando a mágoa baixa de 40 (anos). |
| ✅ | Repetição cansa | O mesmo gesto várias vezes no mesmo ano rende cada vez menos; a partir do 5º pode ser recusado ("você já veio aqui 6 vezes"). |
| ✅ | Gratidão amortece | Presentes, apoio e favores geram gratidão, que reduz mágoas pequenas e aumenta a chance de perdão. |
| ✅ | O tempo cura (devagar) | Por ano sem agressão: mágoa −6 (−3 se rabugento), medo −7, gratidão −3, confiança sobe até 55. Agressão recente trava a cura. |
| ✅ | Interface | Linha da pessoa mostra 🚫/💢/😨; o cartão mostra etiquetas ("Muita mágoa", "Tem medo de você", "Não confia", "Grato(a)", "promessas quebradas", "Noivado", "Divorciados") e os últimos fatos lembrados. |
| 🟡 | Contexto dos gestos | Hoje o gesto é genérico ("consolar" alguém). Falta saber **do que** consolar (luto, demissão, término) e **quem causou**. |
| ⬜ | Memória de terceiros | Fofoca e reputação: a mãe saber que você bateu no irmão, amigos em comum tomando lado. |
| ⬜ | Memória positiva de longo prazo | Momentos felizes marcantes (viagem, formatura juntos) como fatos que amortecem crises. |
| 🔍 | Personalidade mais rica | Traços hoje afetam pouco (gentil, rabugento, mandão…). Analisar: temperamento, apego, perdão fácil/difícil por pessoa. |

## 2. Agressão, perdão e consequências

| | item | como funciona |
|---|---|---|
| ✅ | Registro na memória | Toda agressão grava mágoa (8 + 11×severidade + reincidência), medo (se física), perda de confiança e gratidão, e um fato ("Agressão: dar um soco."). |
| ✅ | Revide depende da memória | Mágoa acumulada aumenta a chance de revide; medo diminui. |
| ✅ | Violência no namoro/casamento | Agressão física grave termina na hora; agressões "menores" repetidas (mágoa ≥ 70 ou 3+ agressões) também terminam — com partilha, se for casamento. |
| ✅ | Humilhação e discussão | Humilhar e fofoca vazada geram mágoa; discutir gera mágoa pequena. |
| ✅ | Contexto (escola/trabalho/família/rua) | Detenção, suspensão, expulsão, advertência, justa causa, B.O., prisão (ver SPEC-05). |
| ⬜ | Medida protetiva / restrição | Após violência grave em casal, proibição de contato por anos. |
| 🔍 | Terapia / controle da raiva | Atividade que reduz a severidade das próximas reincidências e melhora a credibilidade das desculpas. |

## 3. Paquera e namoro

| | item | como funciona |
|---|---|---|
| ✅ | Conhecer alguém | Eventos `crush` (13–19) e `amorAdulto` (20–55). |
| ✅ | **Chamar para sair** (`paquerar`) | Com amigo(a), colega, colega de trabalho ou conhecido(a), sem estar namorando, com idade compatível (`podeNamorar`: ≥14; menores só com menores, diferença ≤ 2; adultos, diferença razoável). Chance: vínculo, aparência, humor, gratidão − mágoa − medo. Recusa gera "friendzone" e um pouco de mágoa. |
| ✅ | **Encontro romântico** | Custa R$ 250 (adulto) ou R$ 40; 15% de desastre. Sujeito à reação da pessoa. |
| ✅ | **Conversar sobre a relação (DR)** | Pode reduzir mágoa e aumentar confiança — ou virar briga. |
| ✅ | Beijar, massagem, serenata | Gestos de romance/carinho com memória. |
| ✅ | **Terminar namoro** | Reação conforme o que ela sentia (choro × "finalmente"); ela lembra do término. |
| ✅ | Parceiro(a) termina (`parceiroTermina`) | Evento quando vínculo < 30 ou mágoa ≥ 55: implorar (depende de gratidão/confiança/promessas), aceitar com dignidade, fazer escândalo. |
| ✅ | Término automático | Vínculo < 10 ou mágoa ≥ 90 no fim do ano → a outra pessoa termina. |
| ✅ | **Tentar voltar** (`reatar`) e ex que manda mensagem (`exQuerVoltar`) | Dependem de vínculo, gratidão, confiança, mágoa e quantos términos já houve. |
| ⬜ | Ficar / relacionamento casual | Estado antes do namoro. |
| ⬜ | Ciúmes e controle | Eventos de ciúme, senha do celular, amigos do(a) parceiro(a). |
| ⬜ | Trair (jogador) | Hoje só o(a) parceiro(a) trai (evento `traicao`). Falta a traição do jogador com risco de ser descoberto. |
| 🔍 | Orientação e preferências | Hoje ~85% heterossexual por sorteio; analisar preferência explícita no editor. |
| 🔍 | App de namoro | Atividade com perfis sorteados e golpes. |

## 4. Noivado e casamento

| | item | como funciona |
|---|---|---|
| ✅ | **Pedir em casamento** (`pedirCasamento`) | Adultos namorando. Aliança de R$ 3 mil (ou "anel de latinha" sem dinheiro, com chance menor). Chance: vínculo, tempo de namoro, confiança − mágoa − medo; menos de 1 ano de namoro pesa contra. Recusa magoa e pode terminar o namoro. |
| ✅ | Noivado | Fica na memória (`noivado`) e aparece no cartão ("Noivado"). |
| ✅ | **Marcar o casamento** (`casar`) | Evento encadeado "O grande dia": festa grande (R$ 25 mil), cartório e churrasco (R$ 2 mil), adiar (magoa) ou desistir (termina e humilha). |
| ✅ | Pedido feito pelo(a) parceiro(a) (`pedidoParceiro`) | Só acontece sem mágoa relevante; aceitar casa na hora, recusar termina. |
| ✅ | Bodas (`bodas`) | A cada 5 anos: jantar surpresa ou esquecer a data (e ela lembra). |
| ✅ | Filhos (`bebe`) | Casal decide ter filho (evento existente). |
| ⬜ | Sobrenome, morar junto, dividir despesas | Casamento ainda não mexe em finanças do dia a dia. |
| ⬜ | Sogra/sogro como relação real | Pedido aberto em `PEDIDOS-ENGINE.md` (tipos de relação da família ampliada). |
| 🔍 | Crises conjugais recorrentes | Rotina, dinheiro, filhos, sogra — eventos que usam a memória. |

## 5. Separação e divórcio

| | item | como funciona |
|---|---|---|
| ✅ | **Pedir o divórcio** (`divorcio`) | Amigável se o(a) cônjuge já estava mal (vínculo < 35 ou mágoa ≥ 50); litigioso caso contrário. |
| ✅ | Cônjuge pede divórcio (`conjugePedeDivorcio`) | Vínculo < 30 ou mágoa ≥ 55: assinar amigável, **terapia de casal** (R$ 3 mil, pode salvar o casamento) ou brigar na Justiça (R$ 8 mil). |
| ✅ | Partilha | Advogado (R$ 1,5 mil amigável / R$ 6 mil litigioso), 40–65% do dinheiro (50% se amigável), casa vendida e dividida (50%) ou fica com você. |
| ✅ | Filhos | Vínculo com os filhos cai; **pensão alimentícia** anual (8% do salário, mínimo R$ 3 mil por filho menor) até os 18. |
| ✅ | Ex-cônjuge | Vira `ex`, com a data do divórcio na memória; pode voltar a namorar (mais difícil). |
| ⬜ | Guarda compartilhada / visitas | Decidir com quem os filhos ficam, dias de visita, alienação parental. |
| ⬜ | Viuvez | Morte do cônjuge com luto, herança e "nunca mais casou". |
| 🔍 | Pensão para o ex-cônjuge | Casos de dependência financeira. |

## 6. Família, amizades, escola e trabalho

| | item | situação |
|---|---|---|
| ✅ | Memória vale para todos | Mãe, pai, irmãos, amigos, colegas, chefe, professor — todos lembram. |
| ✅ | Amizade esfria | Vínculo < 12 → amigo(a) vira conhecido(a) (antes virava "colega de escola" por engano; corrigido). |
| 🟡 | Família com contato cortado | Parente pode cortar contato; ainda sem eventos próprios (reencontro no Natal, herança deserdando). |
| ⬜ | Amizade profunda | Melhor amigo(a), padrinho/madrinha, favores e dívidas entre amigos com memória. |
| ⬜ | Colegas de trabalho lembram | Promoção disputada, puxada de tapete, ajuda em crise. |

## 7. Regras para quem cria conteúdo (Luna e outros)

- Em interações novas que são **gestos positivos**, preencha `gesto: 'carinho' | 'conversa' | 'romance' | 'consolo' | 'pedido' | 'diversao'`.
  O motor aplica recusa, redução e repetição automaticamente.
- Quando algo marcante acontece com uma pessoa, registre: `lembrar(L, p, 'agressao' | 'humilhacao' | 'favor' | ..., sev, 'texto curto')`.
- Para ler a memória em condições e textos: `mem(p).rancor`, `mem(p).medo`, `mem(p).confianca`, `mem(p).gratidao`, `mem(p).fatos`.
- Para terminar qualquer relação amorosa, use **sempre** `encerrarRelacao(L, p, 'jogador' | 'parceiro', { consensual })` — ele aplica partilha, pensão e memória.
- Romance só entre pessoas com `podeNamorar(L, p)`.
- `src/game/relacoes.ts` é zona vermelha (motor); pedidos de mudança vão para `docs/PEDIDOS-ENGINE.md`.
