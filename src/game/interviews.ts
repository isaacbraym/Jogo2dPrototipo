import { Career } from './careers';
import { Life, stat, addLog, money, hireStaff, playerCast } from './state';
import { LifeEvent, Outcome, PendingEvent, EvCtx } from './types';
import { rng } from '../core/rng';
import { Appearance } from '../character/appearance';

interface Opt { label: string; icon?: string; score: number; reply: string; expr?: string }
interface Q { text: string; opts: Opt[] }
interface Test { text: string; opts: { label: string; ok: boolean }[]; okReply: string; badReply: string; statCheck?: (L: Life) => number }

interface Cfg {
  local: string; // "no mercado Bom Preço"
  env: string;
  formal: 0 | 1 | 2; // 0 informal, 1 arrumadinho, 2 social
  interviewer: string;
  npcOutfit?: Partial<Appearance>;
  standing?: boolean; // entrevista em pé (balcão)
  questions: Q[];
  test: () => Test;
}

// ============================================================= perguntas genéricas
const GENERIC: Q[] = [
  {
    text: 'Onde você se vê daqui a cinco anos?',
    opts: [
      { label: 'No seu lugar, chefe.', icon: '😏', score: 0, reply: 'Hum. Ambicioso(a). Ou uma ameaça. Anotado.', expr: 'desprezo' },
      { label: 'Vivo(a), se Deus quiser.', icon: '🙏', score: 2, reply: 'Com a economia desse jeito, é uma meta audaciosa.', expr: 'convencido' },
      { label: 'Aposentado(a) numa praia.', icon: '🏖️', score: -2, reply: 'Aposentadoria? Que fofo. Você acredita em Papai Noel também?', expr: 'desprezo' },
    ],
  },
  {
    text: 'Qual é o seu maior defeito?',
    opts: [
      { label: 'Sou perfeccionista.', icon: '📐', score: 0, reply: 'Nossa, que original. É a 14ª pessoa hoje.', expr: 'cansado' },
      { label: 'Trabalho demais e não cobro hora extra.', icon: '💼', score: 3, reply: 'O RH sorriu pela primeira vez desde 2009.', expr: 'feliz' },
      { label: 'Chego atrasado(a), mas chego.', icon: '⏰', score: -1, reply: 'Pelo menos é sincero(a). E provavelmente desempregado(a).', expr: 'desprezo' },
    ],
  },
  {
    text: 'Por que saiu do último emprego?',
    opts: [
      { label: 'A empresa faliu. Não fui eu. Juro.', icon: '📉', score: 1, reply: 'Sei... três empresas faliram depois que você entrou?', expr: 'pensativo' },
      { label: 'Meu chefe era insuportável.', icon: '😤', score: -2, reply: 'Entendi. Aqui o chefe também é. Sou eu.', expr: 'bravo' },
      { label: 'Tô "em busca de novos desafios".', icon: '🧗', score: 1, reply: 'Tradução: foi mandado(a) embora. Tudo bem, acontece.', expr: 'convencido' },
    ],
  },
  {
    text: 'Qual a sua pretensão salarial?',
    opts: [
      { label: 'O que vocês puderem pagar.', icon: '🤲', score: 2, reply: 'Ótimo! Vamos poder pagar pouquíssimo.', expr: 'feliz' },
      { label: 'Uns 20 mil por mês.', icon: '🤑', score: -3, reply: 'Querido(a), isso é o faturamento do mês inteiro.', expr: 'chocado' },
      { label: 'Vale-refeição já me faz feliz.', icon: '🍛', score: 1, reply: 'Adoramos gente com expectativas baixas.', expr: 'convencido' },
    ],
  },
  {
    text: 'Você trabalha bem sob pressão?',
    opts: [
      { label: 'Sob pressão eu viro diamante.', icon: '💎', score: 1, reply: 'Aqui você vai virar carvão mesmo. Mas gostei.', expr: 'convencido' },
      { label: 'Eu choro, mas entrego.', icon: '😭', score: 2, reply: 'Honestidade. E o choro não conta como hora extra.', expr: 'feliz' },
      { label: 'Pressão? Só a arterial.', icon: '🩺', score: 0, reply: 'Engraçadinho(a). Humor não paga boleto.', expr: 'cansado' },
    ],
  },
  {
    text: 'Me conta uma situação difícil que você superou.',
    opts: [
      { label: 'Sobrevivi a um grupo de família no WhatsApp.', icon: '📱', score: 2, reply: 'Nossa. Guerreiro(a). Resiliência nível máximo.', expr: 'rindo' },
      { label: 'Nunca tive dificuldades.', icon: '😇', score: -2, reply: 'Então você não tem experiência de vida. Nem de Brasil.', expr: 'desprezo' },
      { label: 'Esta entrevista, neste exato momento.', icon: '😰', score: 1, reply: 'Justo. E ela ainda não acabou.', expr: 'convencido' },
    ],
  },
];

const rnd = (a: number, b: number) => rng.int(a, b);
function mathTest(text: string, correct: number, fmt = (n: number) => String(n)): Test {
  const wrong = new Set<number>();
  while (wrong.size < 2) {
    const w = correct + rng.pick([-10, -5, -2, -1, 1, 2, 5, 10]) * (correct > 100 ? 10 : 1);
    if (w !== correct && w >= 0) wrong.add(w);
  }
  const opts = rng.shuffle([{ label: fmt(correct), ok: true }, ...[...wrong].map((w) => ({ label: fmt(w), ok: false }))]);
  return { text, opts, okReply: 'Correto. Pelo menos matemática básica você sabe.', badReply: 'Errado. O caixa ia fechar negativo todo dia.' };
}
function quiz(text: string, right: string, wrongs: string[], okReply: string, badReply: string): Test {
  return { text, opts: rng.shuffle([{ label: right, ok: true }, ...wrongs.map((w) => ({ label: w, ok: false }))]), okReply, badReply };
}
const brl = (n: number) => 'R$ ' + (n / 100).toFixed(2).replace('.', ',');

// ============================================================= por profissão
export const INTERVIEWS: Record<string, Cfg> = {
  caixa: {
    local: 'no Supermercado Bom Preço', env: 'mercado', formal: 0, interviewer: 'Gerente do mercado', standing: true,
    npcOutfit: { top: 'polo', topColor: '#c2273d', topColor2: '#f4f1ea' },
    questions: [{
      text: 'Cliente quer pagar um chiclete de R$ 1,50 com nota de 100. Você...',
      opts: [
        { label: 'Dou o troco com um sorriso.', icon: '😁', score: 2, reply: 'Mentira, mas é a resposta certa.', expr: 'convencido' },
        { label: '"Não tem trocadinho não, amor?"', icon: '🫠', score: 2, reply: 'Isso! Energia de caixa raiz.', expr: 'rindo' },
        { label: 'Fecho o caixa e vou almoçar.', icon: '🍽️', score: -3, reply: 'Você tem perfil de servidor público, não de caixa.', expr: 'bravo' },
      ],
    }],
    test: () => { const preco = rnd(3, 90) * 100 + rng.pick([0, 50, 90, 25]); const pago = Math.ceil(preco / 5000) * 5000 + (rng.chance(0.4) ? 5000 : 0); return { ...mathTest(`TESTE: compra de ${brl(preco)}, cliente paga com ${brl(pago)}. Qual o troco?`, pago - preco, brl) }; },
  },
  barista: {
    local: 'na Cafeteria Grão Gourmet', env: 'cafeteria', formal: 0, interviewer: 'Dono da cafeteria', standing: true,
    npcOutfit: { top: 'camiseta', topColor: '#2f8f6f', hat: 'boina', hatColor: '#23242b' },
    questions: [{
      text: 'Um cliente pede "latte de aveia, meio descafeinado, 42 graus, sem julgamentos". Você...',
      opts: [
        { label: 'Faço exatamente isso, com arte no leite.', icon: '🎨', score: 3, reply: 'Um coração no latte vale mais que diploma.', expr: 'feliz' },
        { label: 'Faço um café normal e escrevo o nome errado.', icon: '✍️', score: 1, reply: 'Hahaha. Tradição das grandes redes.', expr: 'rindo' },
        { label: 'Pergunto se ele quer um Nescafé.', icon: '☕', score: -2, reply: 'Aqui é gourmet, criatura. Nescafé é crime.', expr: 'chocado' },
      ],
    }],
    test: () => quiz('TESTE: qual bebida leva MAIS leite?', 'Latte', ['Espresso', 'Ristretto'], 'Isso! Pode vestir o avental.', 'Não. Você nunca pisou numa cafeteria na vida.'),
  },
  entregador: {
    local: 'no galpão do app VaiRápido', env: 'ruaDia', formal: 0, interviewer: 'Coordenador de logística', standing: true,
    npcOutfit: { top: 'jaqueta', topColor: '#e4572e', hat: 'bone', hatColor: '#e4572e' },
    questions: [{
      text: 'O endereço é "rua sem nome, casa amarela, depois da árvore que caiu". Você...',
      opts: [
        { label: 'Acho no instinto e no GPS.', icon: '🧭', score: 2, reply: 'Instinto é tudo nesse ramo.', expr: 'convencido' },
        { label: 'Ligo pro cliente 17 vezes.', icon: '📞', score: 1, reply: 'O cliente vai te dar 1 estrela, mas recebe.', expr: 'rindo' },
        { label: 'Como o lanche e digo que roubaram.', icon: '🍔', score: -3, reply: 'Você não é o primeiro a pensar nisso. Mas é o primeiro a FALAR.', expr: 'chocado' },
      ],
    }],
    test: () => quiz('TESTE: chuva forte, 12 pedidos, 1 hora. Qual a ordem?', 'Mais perto primeiro, depois em rota', ['Aleatória, confia', 'Os mais caros primeiro e o resto que espere'], 'Boa lógica de rota. Contratado pelo algoritmo.', 'Metade dos pedidos chegaria frio. E o app te bloquearia.'),
  },
  cozinheiro: {
    local: 'no Restaurante Sabor da Vó', env: 'cozinha', formal: 0, interviewer: 'Chef de cozinha', standing: true,
    npcOutfit: { top: 'chef', hat: 'chefe' },
    questions: [{
      text: 'Cliente reclamou que o bife tá cru. Você...',
      opts: [
        { label: 'Refaço na hora, pedindo desculpas.', icon: '🍳', score: 2, reply: 'Profissional. Gostei.', expr: 'feliz' },
        { label: 'Digo que é "mal passado artesanal".', icon: '🧑‍🍳', score: 1, reply: 'Marketing. Você vai longe... ou vai preso.', expr: 'rindo' },
        { label: 'Jogo no micro-ondas e mando de volta.', icon: '📟', score: -3, reply: 'Na MINHA cozinha? Micro-ondas é pra esquentar marmita.', expr: 'furioso' },
      ],
    }],
    test: () => quiz('TESTE: quanto tempo leva, em média, pra cozinhar arroz branco?', 'Uns 18 minutos', ['2 horas', '45 segundos'], 'Certo! Arroz soltinho, emprego garantido.', 'Seu arroz ia virar papa ou pedra. Não dá.'),
  },
  musico: {
    local: 'no Boteco do Zé', env: 'boteco', formal: 0, interviewer: 'Zé, dono do boteco', standing: true,
    npcOutfit: { top: 'regata', topColor: '#f4f1ea', bottom: 'bermuda', bottomColor: '#1f3f7a' },
    questions: [{
      text: '"Toca Evidências?"',
      opts: [
        { label: 'Toco. Com orgulho e lágrimas.', icon: '🎤', score: 3, reply: 'É ISSO! O bar inteiro vai cantar gritando.', expr: 'alegre' },
        { label: 'Só toco música autoral.', icon: '🎼', score: -3, reply: 'Autoral? Aqui o povo quer sofrência, não poesia.', expr: 'desprezo' },
        { label: 'Toco, mas cobro dobrado.', icon: '💸', score: 0, reply: 'Cobra dobrado e ganha metade. Bem-vindo à música.', expr: 'convencido' },
      ],
    }],
    test: () => ({ ...quiz('AUDIÇÃO: complete o clássico — "E nessa loucura de dizer que não te quero, vou negando as aparências, disfarçando as..."', 'evidências', ['diferenças', 'ciências'], 'O boteco inteiro aplaudiu. Até o bêbado da mesa 4.', 'Silêncio constrangedor. Alguém pediu a conta.'), statCheck: (L) => (L.flags.musica ? 2 : 0) }),
  },
  policial: {
    local: 'na Delegacia Central', env: 'delegaciaInterna', formal: 1, interviewer: 'Delegada(o)',
    npcOutfit: { top: 'policial', hat: 'quepe' },
    questions: [{
      text: 'Você vê um colega aceitando "um cafezinho" de um motorista. O que faz?',
      opts: [
        { label: 'Denuncio à corregedoria.', icon: '📢', score: 3, reply: 'Correto. Raro, mas correto.', expr: 'serio' },
        { label: 'Peço metade do café.', icon: '☕', score: -3, reply: 'Você acabou de confessar crime numa entrevista na DELEGACIA.', expr: 'chocado' },
        { label: 'Finjo que não vi.', icon: '🙈', score: -1, reply: 'Anotado. E observado.', expr: 'desprezo' },
      ],
    }],
    test: () => quiz('TESTE: qual o número de emergência da Polícia Militar?', '190', ['192', '193'], 'Certo. O básico, mas tem gente que erra.', 'Esse é de outro serviço. Imagine na hora do assalto.'),
  },
  professor: {
    local: 'na Escola Estadual Monteiro Lobato', env: 'escola', formal: 1, interviewer: 'Diretora da escola',
    npcOutfit: { top: 'camisa', topColor: '#e8d5b0' },
    questions: [{
      text: 'Um aluno te chama de "tio/tia" e joga uma bolinha de papel. Você...',
      opts: [
        { label: 'Transformo em aula de física.', icon: '🧪', score: 3, reply: 'Nossa. Nunca ouvi isso. Adorei.', expr: 'feliz' },
        { label: 'Chamo os pais.', icon: '📞', score: 1, reply: 'Os pais vão dizer que a culpa é sua. Mas ok.', expr: 'cansado' },
        { label: 'Devolvo a bolinha com força.', icon: '🎯', score: -3, reply: 'Isso dá processo, Conselho Tutelar e matéria no jornal.', expr: 'chocado' },
      ],
    }],
    test: () => { const a = rnd(6, 9), b = rnd(6, 9); return { ...mathTest(`TESTE: quanto é ${a} × ${b}?`, a * b), okReply: 'Certo! Tabuada em dia.', badReply: 'Errou a tabuada numa entrevista de PROFESSOR(A).' }; },
  },
  enfermeiro: {
    local: 'no Hospital Santa Luzia', env: 'hospital', formal: 1, interviewer: 'Enfermeira(o)-chefe',
    npcOutfit: { top: 'jaleco', topColor: '#5ec3e8' },
    questions: [{
      text: 'Plantão de 24h, sem café, com 3 pacientes gritando. Topa?',
      opts: [
        { label: 'Topo. Café é psicológico.', icon: '💪', score: 2, reply: 'Você vai descobrir que não é. Mas bem-vindo(a).', expr: 'convencido' },
        { label: 'Só com café.', icon: '☕', score: 0, reply: 'Café tem, só que acabou em 2019.', expr: 'cansado' },
        { label: 'Posso dormir um pouquinho no plantão?', icon: '😴', score: -3, reply: 'Pode, se quiser acordar demitido(a).', expr: 'bravo' },
      ],
    }],
    test: () => quiz('TESTE: temperatura corporal normal de um adulto?', 'Entre 36 e 37 °C', ['Uns 42 °C', 'Uns 30 °C'], 'Correto. Pode pegar o estetoscópio.', 'Com esse valor o paciente já estaria no céu.'),
  },
  medico: {
    local: 'no Hospital Santa Luzia', env: 'hospital', formal: 2, interviewer: 'Diretor(a) clínico(a)',
    npcOutfit: { top: 'jaleco', topColor: '#3d7bd9' },
    questions: [{
      text: 'Paciente chegou com diagnóstico do Google. Você...',
      opts: [
        { label: 'Escuto, examino e explico com calma.', icon: '🩺', score: 3, reply: 'Paciência de monge. Raro.', expr: 'feliz' },
        { label: '"Então quem é o médico aqui?"', icon: '😒', score: 0, reply: 'Clássico. Mas os pacientes odeiam.', expr: 'convencido' },
        { label: 'Receito o que o Google mandou.', icon: '💊', score: -3, reply: 'CRM cassado em tempo recorde.', expr: 'chocado' },
      ],
    }],
    test: () => quiz('TESTE: qual órgão bombeia o sangue?', 'Coração', ['Fígado', 'Baço'], 'Óbvio, mas tem gente que trava.', 'Por favor, nunca me opere.'),
  },
  programador: {
    local: 'na startup Nuvem.io', env: 'escritorio', formal: 0, interviewer: 'Tech Lead de 24 anos',
    npcOutfit: { top: 'moletom', topColor: '#23242b' },
    questions: [{
      text: 'Sistema caiu em produção numa sexta às 18h. Você...',
      opts: [
        { label: 'Resolvo e faço post-mortem.', icon: '🛠️', score: 2, reply: 'Maduro(a). Suspeito, mas maduro(a).', expr: 'convencido' },
        { label: 'git blame e culpo o estagiário.', icon: '🔍', score: 1, reply: 'Sênior de verdade. Adorei.', expr: 'rindo' },
        { label: 'Desligo o notebook e vou pro bar.', icon: '🍺', score: -2, reply: 'Honesto(a), mas o CEO chora.', expr: 'chocado' },
      ],
    }],
    test: () => { const n = rng.pick([8, 10, 16]); return { ...mathTest(`TESTE TÉCNICO: quanto é 2 elevado a ${n}?`, 2 ** n), okReply: 'Certo! Merece um vale-pizza.', badReply: 'Errou. Mas pelo menos não usou o ChatGPT. Ou usou?' }; },
  },
  advogado: {
    local: 'no escritório Souza & Souza Advogados', env: 'escritorio', formal: 2, interviewer: 'Sócio(a)-sênior',
    npcOutfit: { top: 'blazer', topColor: '#23242b', topColor2: '#1f3f7a' },
    questions: [{
      text: 'Seu cliente é claramente culpado. E aí?',
      opts: [
        { label: 'Todo mundo merece defesa.', icon: '⚖️', score: 2, reply: 'Resposta de livro. E cobra por hora.', expr: 'convencido' },
        { label: 'Culpado é quem não paga honorários.', icon: '💰', score: 3, reply: 'Você entendeu o Direito brasileiro.', expr: 'rindo' },
        { label: 'Entrego ele pra polícia.', icon: '🚓', score: -3, reply: 'Você quer ser advogado(a) ou promotor(a)?', expr: 'chocado' },
      ],
    }],
    test: () => quiz('TESTE: o que é "habeas corpus"?', 'Garantia contra prisão ilegal', ['Um prato italiano', 'Tipo de contrato de aluguel'], 'Correto. Sabe o latim da sobrevivência.', 'Isso é resposta de estagiário no primeiro dia.'),
  },
  engenheiro: {
    local: 'na construtora Concreta', env: 'escritorio', formal: 1, interviewer: 'Gerente de obras',
    npcOutfit: { top: 'camisa', topColor: '#9fd3ee' },
    questions: [{
      text: 'A obra está atrasada 2 anos. O que você diz ao cliente?',
      opts: [
        { label: 'Apresento um cronograma realista.', icon: '📊', score: 2, reply: 'Realista? Aqui ninguém usa essa palavra.', expr: 'convencido' },
        { label: '"Chuva, pandemia e alinhamento dos planetas."', icon: '🌧️', score: 3, reply: 'Você nasceu pra construção civil.', expr: 'rindo' },
        { label: 'Culpo o cliente.', icon: '👉', score: -1, reply: 'Tentador, mas ele paga a obra.', expr: 'cansado' },
      ],
    }],
    test: () => quiz('TESTE: a soma dos ângulos internos de um triângulo é...', '180°', ['360°', '90°'], 'Certo! O prédio não vai cair. Provavelmente.', 'Errado. O prédio ia cair no primeiro vento.'),
  },
  artista: {
    local: 'na Galeria Café & Arte', env: 'cafeteria', formal: 0, interviewer: 'Curadora de arte',
    npcOutfit: { top: 'sueter', topColor: '#23242b', glasses: 'gatinho' },
    questions: [{
      text: 'Pediram um logo de graça "pela exposição". Você...',
      opts: [
        { label: 'Exposição não paga aluguel.', icon: '🧾', score: 2, reply: 'Finalmente um artista com noção.', expr: 'feliz' },
        { label: 'Faço. Quem sabe viraliza.', icon: '📈', score: -1, reply: 'Não viraliza. Nunca viraliza.', expr: 'cansado' },
        { label: 'Cobro o triplo por desaforo.', icon: '💅', score: 1, reply: 'Ousado(a). Arte é atitude.', expr: 'convencido' },
      ],
    }],
    test: () => quiz('TESTE: azul + amarelo dá...', 'Verde', ['Roxo', 'Laranja'], 'Correto. O básico da tinta.', 'Você vai pintar o sete — errado.'),
  },
  atleta: {
    local: 'no Centro de Treinamento Olímpico', env: 'academia', formal: 0, interviewer: 'Técnico(a) da equipe',
    npcOutfit: { top: 'esporte', topColor: '#1f3f7a' },
    questions: [{
      text: 'Treino às 5 da manhã, todo dia, inclusive domingo. Topa?',
      opts: [
        { label: 'Eu acordo às 4.', icon: '⏰', score: 3, reply: 'Psicopata do esporte. Perfeito.', expr: 'feliz' },
        { label: 'Domingo não, é dia de churrasco.', icon: '🍖', score: -2, reply: 'Churrasco é o maior rival do atleta brasileiro.', expr: 'desprezo' },
        { label: 'Topo, se tiver café da manhã.', icon: '🥞', score: 1, reply: 'Tem. Ovo cozido. Seis.', expr: 'convencido' },
      ],
    }],
    test: () => ({ text: 'TESTE FÍSICO: 30 flexões seguidas agora, no chão da academia.', opts: [{ label: 'Dar o sangue', ok: true }, { label: 'Fazer 10 e fingir câimbra', ok: false }], okReply: 'Nem suou. Aprovado no físico.', badReply: 'A câimbra foi mais convincente que as flexões.', statCheck: (L) => (L.fitness - 45) / 15 }),
  },
  empresario: {
    local: 'num coworking cheio de pufes', env: 'escritorio', formal: 2, interviewer: 'Investidor(a)-anjo',
    npcOutfit: { top: 'blazer', topColor: '#3b4a6b' },
    questions: [{
      text: 'Faça o pitch da sua ideia em 10 segundos.',
      opts: [
        { label: '"Uber de pão de queijo."', icon: '🧀', score: 2, reply: 'Hmm. Escalável e crocante. Gostei.', expr: 'convencido' },
        { label: '"Blockchain com IA no metaverso."', icon: '🤖', score: 1, reply: 'Não entendi nada, então deve ser genial.', expr: 'pensativo' },
        { label: '"Ainda não tenho ideia."', icon: '🤷', score: -3, reply: 'Então por que você está aqui?', expr: 'desprezo' },
      ],
    }],
    test: () => quiz('TESTE: Lucro = Receita − ...', 'Custos', ['Sonhos', 'Likes'], 'Correto. Já sabe mais que metade das startups.', 'Likes não pagam salário. Nem o seu.'),
  },
  ator: {
    local: 'num teste de elenco no Teatro Municipal', env: 'palco', formal: 1, interviewer: 'Diretor(a) de elenco',
    npcOutfit: { top: 'sueter', topColor: '#23242b', hat: 'boina', hatColor: '#23242b' },
    questions: [{
      text: '"Chore em 3, 2, 1..."',
      opts: [
        { label: 'Penso no meu extrato bancário.', icon: '😭', score: 3, reply: 'Lágrimas reais! Que método é esse?!', expr: 'chocado' },
        { label: 'Finjo com colírio.', icon: '💧', score: 0, reply: 'Eu vi o colírio. Todo mundo viu.', expr: 'desprezo' },
        { label: 'Eu sou mais de comédia.', icon: '🤡', score: -1, reply: 'O teste é pra drama. Leu o edital?', expr: 'cansado' },
      ],
    }],
    test: () => ({ text: 'TESTE: interprete "morte do vilão" agora, no palco.', opts: [{ label: 'Morrer com intensidade', ok: true }, { label: 'Morrer de rir', ok: false }], okReply: 'A plateia vazia aplaudiu. Arrepiou.', badReply: 'O vilão morreu... de vergonha alheia.', statCheck: (L) => (L.stats.aparencia - 55) / 20 }),
  },
};

const DRESS: { label: string; icon: string; level: 0 | 1 | 2; outfit: Partial<Appearance> | null }[] = [
  { label: 'De terno/tailleur', icon: '🤵', level: 2, outfit: { top: 'blazer', topColor: '#23242b', topColor2: '#c2273d', bottom: 'calca', bottomColor: '#23242b', shoes: 'social', shoesColor: '#23242b' } },
  { label: 'Arrumadinho(a) casual', icon: '👕', level: 1, outfit: { top: 'camisa', topColor: '#f4f1ea', bottom: 'jeans', bottomColor: '#1f3f7a', shoes: 'tenis', shoesColor: '#f4f1ea' } },
  { label: 'Do jeito que acordei', icon: '🥱', level: 0, outfit: null },
];

const DRESS_REPLY = (need: number, got: number): [number, string] => {
  if (need === got) return [2, 'Vestido(a) na medida certa pro lugar.'];
  if (got === 2 && need === 0) return [-1, 'De terno aqui? Veio de um velório ou vai pra um?'];
  if (got === 0 && need === 2) return [-3, 'Chinelo e camiseta furada numa entrevista dessas. Corajoso(a).'];
  if (got > need) return [0, 'Um pouco arrumado(a) demais, mas vá lá.'];
  return [-1, 'Faltou capricho no visual. Anotado.'];
};

const O = (text: string, tone: Outcome['tone'], extra: Partial<Outcome> = {}): Outcome => ({ text, tone, ...extra });

const REJECT = [
  'A vaga ficou com o sobrinho do dono. Sempre fica.',
  'Disseram que vão "manter seu currículo no banco de talentos". O banco é a lixeira.',
  'Escolheram alguém com 10 anos de experiência pra vaga júnior. Normal.',
  '"Você é qualificado(a) demais." Tradução: querem pagar menos.',
  'Te deram "retorno em breve". Isso foi há três anos, emocionalmente.',
];

/** Monta a entrevista como uma cadeia de eventos com escolhas. */
export function startInterview(L: Life, c: Career): PendingEvent {
  const cfg = INTERVIEWS[c.id];
  const st: { score: number; outfit: Partial<Appearance> | null } = { score: 0, outfit: null };
  const qs = rng.shuffle([...GENERIC]).slice(0, 2);
  const all: Q[] = [...cfg.questions, ...qs];
  const sceneBase = () => ({ id: 'entrevista2', data: { env: cfg.env, outfit: st.outfit, npcOutfit: cfg.npcOutfit, standing: cfg.standing, cargo: c.title, quem: cfg.interviewer, icon: c.icon } });

  const finish = (): Outcome => {
    // bônus de atributos + ficha criminal + sorte
    const statBonus = (L.stats.inteligencia - c.smarts) / 30 + (c.looks ? (L.stats.aparencia - c.looks) / 40 : 0) - L.crime.ficha * 1.2;
    const total = st.score + statBonus + rng.range(-1.5, 1.5);
    const p = 1 / (1 + Math.exp(-(total - 3)));
    const ok = rng.chance(Math.min(0.95, Math.max(0.03, p)));
    if (ok) {
      L.job = { id: c.id, title: c.titles[0], salary: c.salary, perf: 55 + Math.round(st.score * 2), years: 0, level: 0 };
      L.jobHistory.push(c.titles[0]);
      hireStaff(L, c.titles[0]);
      stat(L, 'felicidade', 10);
      addLog(L, `Passei na entrevista ${cfg.local}: agora sou ${c.titles[0]}!`, 'especial', c.icon);
      return O(`CONTRATADO(A)! ${cfg.interviewer} apertou sua mão: "Começa segunda. Não se atrase." Salário: ${money(c.salary)}/ano.`, 'especial', {
        title: 'Vaga conquistada!', icon: c.icon, log: false,
        react: { npc: { expr: 'feliz', say: 'Bem-vindo(a) à equipe!', motion: 'joinha' }, player: { expr: 'alegre', motion: 'comemorar' } },
        mood: 'feliz',
      });
    }
    stat(L, 'felicidade', -6);
    const why = total < 1 ? 'Sua entrevista foi um desastre digno de meme.' : rng.pick(REJECT);
    addLog(L, `Reprovado(a) na entrevista para ${c.title}. ${why}`, 'ruim', '📭');
    return O(`Não foi dessa vez. ${why}`, 'ruim', {
      title: 'Reprovado(a)', icon: '📭', log: false,
      react: { npc: { expr: 'desprezo', say: 'A gente te liga. Talvez.', motion: 'darOmbros' }, player: { expr: 'triste', motion: 'sentarCabisbaixo' } },
      mood: 'triste',
    });
  };

  const testEvent = (prefix: string): PendingEvent => {
    const t = cfg.test();
    const ev: LifeEvent = {
      id: 'int_teste', min: 0, max: 200, weight: 0, icon: '🧪', title: `Teste prático — ${c.title}`,
      text: () => `${prefix}${t.text}`,
      choices: t.opts.map((o) => ({
        label: o.label, icon: '❔',
        run: (LL: Life) => {
          const bonus = t.statCheck ? t.statCheck(LL) : 0;
          const passed = o.ok && (t.statCheck ? rng.chance(0.5 + bonus / 4) : true);
          st.score += passed ? 3 : -2;
          const fin = finish();
          return { ...fin, text: `"${passed ? t.okReply : t.badReply}"\n\n${fin.text}` };
        },
      })),
    };
    return { ev, ctx: {} };
  };

  const qEvent = (i: number, prefix: string): PendingEvent => {
    const q = all[i];
    const ev: LifeEvent = {
      id: 'int_q' + i, min: 0, max: 200, weight: 0, icon: '🎙️', title: `${cfg.interviewer} pergunta (${i + 1}/${all.length})`,
      text: () => `${prefix}"${q.text}"`,
      choices: q.opts.map((o) => ({
        label: o.label, icon: o.icon,
        run: (): Outcome => {
          st.score += o.score;
          const nxt = i + 1 < all.length ? qEvent(i + 1, `💬 "${o.reply}"\n\n`) : testEvent(`💬 "${o.reply}"\n\n`);
          return O(o.reply, 'neutro', { skipCard: true, log: false, followUp: nxt, react: { npc: { expr: o.expr, say: o.reply }, player: { expr: o.score >= 2 ? 'feliz' : o.score < 0 ? 'envergonhado' : 'pensativo' } } });
        },
      })),
    };
    return { ev, ctx: {} };
  };

  const dressEvent: LifeEvent = {
    id: 'int_roupa', min: 0, max: 200, weight: 0, icon: c.icon, title: `Entrevista: ${c.title}`,
    text: () => `Você foi chamado(a) para uma entrevista ${cfg.local}. Antes de sair de casa: como vai vestido(a)?`,
    choices: DRESS.map((d) => ({
      label: d.label, icon: d.icon,
      run: (): Outcome => {
        st.outfit = d.outfit;
        const [s, reply] = DRESS_REPLY(cfg.formal, d.level);
        st.score += s;
        return O(reply, 'neutro', { skipCard: true, log: false, scene: sceneBase(), followUp: qEvent(0, `👀 ${cfg.interviewer} te olha de cima a baixo: "${reply}"\n\n`) });
      },
    })),
  };
  void playerCast;
  return { ev: dressEvent, ctx: {} as EvCtx };
}
