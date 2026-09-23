import { LifeEvent, Outcome, EvCtx } from './types';
import { hireStaff, leaveJobPeople } from './state';
import { Life, stat, bond, addLog, makePerson, partner, parents, friends, children, pickRandom, he, money, newId, Person, spouse, byRel } from './state';
import { rng } from '../core/rng';
import { inherit } from '../character/appearance';
import { CURSOS, CAREERS, careerById } from './careers';
import { aggress } from './aggression';
import { DESTINOS, PETS_NOMES } from './names';

const O = (text: string, tone: Outcome['tone'], extra: Partial<Outcome> = {}): Outcome => ({ text, tone, ...extra });

/** Eventos aleatórios anuais — cada um com escolhas e consequências. */
export const EVENTS: LifeEvent[] = [
  // ======================================================== infância
  {
    id: 'primeirosPassos', min: 1, max: 1, weight: 100, once: true, icon: '👣', title: 'Primeiros passos',
    text: () => 'Você está tentando dar os primeiros passos pela sala!',
    scene: (L) => ({ id: 'primeirosPassos', others: parents(L) }),
    auto: (L) => { stat(L, 'felicidade', 6); parents(L).forEach((p) => bond(p, 5)); return O('Você andou sozinho(a) pela primeira vez! Seus pais ficaram radiantes.', 'bom'); },
  },
  {
    id: 'primeiraPalavra', min: 1, max: 2, weight: 60, once: true, icon: '🗣️', title: 'Primeira palavra',
    text: () => 'Todos estão ansiosos para ouvir sua primeira palavra. O que você diz?',
    choices: [
      { label: '"Mamãe!"', icon: '👩', run: (L) => { const m = byRel(L, 'mae')[0]; if (m) bond(m, 10); stat(L, 'felicidade', 3); return O('Sua mãe chorou de emoção.', 'bom'); } },
      { label: '"Papai!"', icon: '👨', run: (L) => { const p = byRel(L, 'pai')[0]; if (p) bond(p, 10); stat(L, 'felicidade', 3); return O('Seu pai contou para a vizinhança inteira.', 'bom'); } },
      { label: '"Biscoito!"', icon: '🍪', run: (L) => { stat(L, 'felicidade', 5); return O('Todos riram. Você ganhou um biscoito.', 'bom'); } },
    ],
  },
  {
    id: 'escolaInicio', min: 6, max: 6, weight: 100, once: true, icon: '🎒', title: 'Primeiro dia de aula',
    text: () => 'Hoje é seu primeiro dia na escola! Como você se sente?',
    scene: (L) => ({ id: 'escolaPrimeiroDia', others: byRel(L, 'mae', 'pai').slice(0, 1) }),
    choices: [
      { label: 'Animado(a)!', icon: '😄', run: (L) => { stat(L, 'felicidade', 5); stat(L, 'inteligencia', 2); L.edu.stage = 'fundamental'; return O('Você fez amizades logo no recreio.', 'bom', { followUp: undefined }); } },
      { label: 'Com medo...', icon: '😰', run: (L) => { stat(L, 'felicidade', -2); L.edu.stage = 'fundamental'; return O('Você chorou na porta, mas no fim do dia estava brincando.', 'neutro'); } },
    ],
  },
  {
    id: 'valentao', min: 7, max: 15, weight: 14, icon: '😠', title: 'Valentão na escola',
    setup: () => ({ s: rng.pick(['Kleber', 'Brenda', 'Juninho', 'Tati', 'Robson']) }),
    text: (_L, c) => `${c.s}, o valentão da escola, quer tomar o seu lanche no recreio. O que você faz?`,
    scene: () => ({ id: 'valentao' }),
    choices: [
      { label: 'Revidar na mão', icon: '👊', run: (L) => { const win = rng.chance(0.3 + L.fitness / 200); if (win) { stat(L, 'felicidade', 6); L.karma -= 2; return O('Você acertou um soco e o valentão nunca mais te incomodou!', 'bom', { scene: { id: 'briga', data: { win: true } } }); } stat(L, 'saude', -8); stat(L, 'felicidade', -6); return O('Você levou a pior e voltou pra casa com o olho roxo.', 'ruim', { scene: { id: 'briga', data: { win: false } } }); } },
      { label: 'Contar à professora', icon: '🧑‍🏫', run: (L) => { stat(L, 'felicidade', 2); L.karma += 2; return O('A professora deu uma bronca no valentão. Justiça feita.', 'bom'); } },
      { label: 'Entregar o lanche', icon: '🥪', run: (L) => { stat(L, 'felicidade', -5); stat(L, 'saude', -1); return O('Você passou fome, mas evitou confusão.', 'ruim'); } },
    ],
  },
  {
    id: 'provaEscola', min: 8, max: 17, weight: 16, icon: '📝', title: 'Prova importante',
    cond: (L) => L.edu.stage === 'fundamental' || L.edu.stage === 'medio',
    text: () => 'Tem prova de matemática amanhã. Como você se prepara?',
    choices: [
      { label: 'Estudar a noite toda', icon: '📚', run: (L) => { const ok = rng.chance(0.5 + L.stats.inteligencia / 200); stat(L, 'inteligencia', 4); stat(L, 'saude', -2); L.edu.nota += ok ? 8 : 2; return ok ? O('Nota 10! Seu esforço valeu a pena.', 'bom', { scene: { id: 'aula', data: { good: true } } }) : O('Você estudou muito, mas deu branco na hora.', 'neutro', { scene: { id: 'aula', data: { good: false } } }); } },
      { label: 'Colar na prova', icon: '🤫', run: (L) => { L.karma -= 5; if (rng.chance(0.35)) { stat(L, 'felicidade', -8); L.edu.nota -= 10; parents(L).forEach((p) => bond(p, -6)); return O('A professora te pegou colando. Zero e bilhete para os pais!', 'ruim'); } L.edu.nota += 5; return O('Ninguém percebeu... dessa vez.', 'neutro'); } },
      { label: 'Jogar videogame', icon: '🎮', run: (L) => { stat(L, 'felicidade', 5); L.edu.nota -= 6; stat(L, 'inteligencia', -1); return O('Você zerou o jogo, mas a prova... nem tanto.', 'ruim', { scene: { id: 'videogame', data: { win: true } } }); } },
    ],
  },
  {
    id: 'petInfancia', min: 5, max: 14, weight: 7, once: true, icon: '🐶', title: 'Um cachorrinho perdido',
    text: () => 'Você encontrou um filhote abandonado na rua. Seus pais deixam você decidir.',
    choices: [
      { label: 'Adotar!', icon: '💕', run: (L) => { const name = rng.pick(PETS_NOMES); L.pets.push({ id: newId(), name, kind: 'cachorro', color: rng.pick(['#c8843a', '#f4e6c4', '#3b2616', '#8a8f98']), age: 1, bond: 80, alive: true }); stat(L, 'felicidade', 10); L.karma += 4; return O(`Você adotou ${name}! Seu melhor amigo de quatro patas.`, 'bom', { scene: { id: 'pet', data: { kind: 'cachorro', nome: name, titulo: 'Novo amigo!' } } }); } },
      { label: 'Levar a um abrigo', icon: '🏠', run: (L) => { L.karma += 3; stat(L, 'felicidade', 2); return O('O abrigo encontrou uma família para ele. Bom trabalho!', 'bom'); } },
    ],
  },
  {
    id: 'brigaIrmao', min: 5, max: 17, weight: 9, icon: '😤', title: 'Briga entre irmãos',
    cond: (L) => byRel(L, 'irmao', 'irma').length > 0,
    setup: (L) => ({ person: pickRandom(byRel(L, 'irmao', 'irma')) }),
    text: (_L, c) => `${c.person!.first} pegou suas coisas sem pedir e quebrou seu brinquedo favorito!`,
    choices: [
      { label: 'Perdoar', icon: '🤗', run: (L, c) => { bond(c.person!, 8); L.karma += 3; return O(`Vocês fizeram as pazes. ${c.person!.first} prometeu tomar cuidado.`, 'bom', { scene: { id: 'interacao', others: [c.person!], data: { action: 'abracar' } } }); } },
      { label: 'Empurrar', icon: '✋', run: (L, c) => { bond(c.person!, -12); L.karma -= 3; parents(L).forEach((p) => bond(p, -3)); return O('Você ficou de castigo por uma semana.', 'ruim', { scene: { id: 'interacao', others: [c.person!], data: { action: 'empurrar' } } }); } },
      { label: 'Contar aos pais', icon: '📣', run: (L, c) => { bond(c.person!, -4); return O(`${c.person!.first} ficou de castigo.`, 'neutro'); } },
    ],
  },
  {
    id: 'talento', min: 8, max: 16, weight: 6, once: true, icon: '🎵', title: 'Descobrindo um talento',
    text: () => 'A escola vai montar uma apresentação. Você quer participar?',
    choices: [
      { label: 'Cantar', icon: '🎤', run: (L) => { const good = rng.chance(0.55); L.flags.musica = 1; stat(L, 'felicidade', good ? 8 : -3); return good ? O('Você arrasou! Todo mundo aplaudiu de pé.', 'bom', { scene: { id: 'show', data: { palco: true, sub: 'Apresentação da escola' } } }) : O('Desafinou feio, mas se divertiu.', 'neutro', { scene: { id: 'show', data: { palco: true } } }); } },
      { label: 'Pintar um quadro', icon: '🎨', run: (L) => { L.flags.arte = 1; stat(L, 'inteligencia', 3); stat(L, 'felicidade', 5); return O('Seu quadro foi exposto no corredor da escola!', 'bom', { scene: { id: 'pintar' } }); } },
      { label: 'Ficar só assistindo', icon: '🙈', run: (L) => { stat(L, 'felicidade', 1); return O('Você assistiu da plateia.', 'neutro'); } },
    ],
  },
  // ======================================================== adolescência
  {
    id: 'crush', min: 13, max: 19, weight: 12, icon: '💘', title: 'Paixão adolescente',
    cond: (L) => !partner(L),
    setup: (L) => {
      const sex = L.player.sex === 'f' ? (rng.chance(0.85) ? 'm' : 'f') : rng.chance(0.85) ? 'f' : 'm';
      const p = makePerson(rng, { sex, age: L.player.age + rng.int(-1, 1), rel: sex === 'f' ? 'namorada' : 'namorado', bond: rng.int(50, 75) });
      return { person: p };
    },
    text: (_L, c) => `Você não para de pensar em ${c.person!.first}, da sua turma. Hoje vocês ficaram sozinhos no pátio...`,
    choices: [
      { label: 'Chamar pra sair', icon: '💌', run: (L, c) => { const p = c.person!; const yes = rng.chance(0.35 + L.stats.aparencia / 250 + L.stats.felicidade / 400); if (yes) { p.metAt = L.player.age; L.people.push(p); stat(L, 'felicidade', 12); return O(`${p.first} aceitou! Vocês estão namorando.`, 'especial', { scene: { id: 'encontro', others: [p], data: { first: true, good: true, line: 'Quer sair comigo?' } } }); } stat(L, 'felicidade', -8); return O(`${p.first} disse que te vê só como amigo(a)...`, 'ruim', { scene: { id: 'encontro', others: [p], data: { first: true, good: false, line: 'Quer sair comigo?' } } }); } },
      { label: 'Escrever um bilhete', icon: '📝', run: (L, c) => { const p = c.person!; if (rng.chance(0.45)) { L.people.push(p); stat(L, 'felicidade', 10); return O(`${p.first} respondeu com um coração. Agora vocês namoram!`, 'especial'); } stat(L, 'felicidade', -4); return O('O bilhete foi lido em voz alta pela turma. Que vergonha!', 'ruim'); } },
      { label: 'Guardar segredo', icon: '🤐', run: (L) => { stat(L, 'felicidade', -2); return O('Você preferiu guardar o sentimento só pra você.', 'neutro'); } },
    ],
  },
  {
    id: 'festaAdolescente', min: 14, max: 19, weight: 10, icon: '🎉', title: 'Convite para uma festa',
    text: () => 'Os colegas vão dar uma festa no sábado — sem os pais em casa. Você vai?',
    choices: [
      { label: 'Vou e danço a noite toda', icon: '💃', run: (L) => { stat(L, 'felicidade', 9); stat(L, 'saude', -2); const f = makePerson(rng, { age: L.player.age, rel: rng.chance(0.5) ? 'amigo' : 'amiga' }); f.rel = f.sex === 'f' ? 'amiga' : 'amigo'; L.people.push(f); return O(`Melhor festa do ano! Você ficou amigo(a) de ${f.first}.`, 'bom', { scene: { id: 'balada', others: [f] } }); } },
      { label: 'Fugir de casa pra ir', icon: '🪟', run: (L) => { if (rng.chance(0.5)) { parents(L).forEach((p) => bond(p, -10)); stat(L, 'felicidade', -4); return O('Seus pais te pegaram pulando a janela. Castigo de um mês!', 'ruim', { scene: { id: 'brigaFamilia', others: parents(L).slice(0, 1) } }); } stat(L, 'felicidade', 10); return O('Ninguém percebeu. A festa foi épica!', 'bom', { scene: { id: 'balada' } }); } },
      { label: 'Ficar em casa estudando', icon: '📖', run: (L) => { stat(L, 'inteligencia', 3); stat(L, 'felicidade', -2); return O('Você perdeu a festa, mas mandou bem na prova.', 'neutro', { scene: { id: 'estudar' } }); } },
    ],
  },
  {
    id: 'espinhas', min: 13, max: 17, weight: 6, icon: '😖', title: 'Crise de espinhas',
    text: () => 'Uma crise de espinhas bem na semana da foto da turma!',
    choices: [
      { label: 'Cuidar da pele', icon: '🧴', run: (L) => { stat(L, 'aparencia', 3); return O('Com cuidado, sua pele melhorou.', 'bom'); } },
      { label: 'Espremer tudo', icon: '😬', run: (L) => { stat(L, 'aparencia', -5); return O('Péssima ideia. Ficou pior.', 'ruim'); } },
    ],
  },
  {
    id: 'vestibular', min: 17, max: 18, weight: 100, once: true, icon: '🎓', title: 'Fim do ensino médio',
    cond: (L) => L.edu.stage === 'medio',
    text: () => 'Você concluiu o ensino médio! E agora, qual o próximo passo?',
    scene: (L) => ({ id: 'formatura', others: parents(L), data: { nivel: 'medio' } }),
    choices: [
      ...CURSOS.slice(0, 6).map((curso) => ({
        label: `Faculdade de ${curso}`, icon: '🏛️',
        run: (L: Life): Outcome => {
          const need = curso === 'Medicina' ? 70 : curso === 'Direito' ? 60 : 45;
          if (L.stats.inteligencia + rng.int(-10, 15) >= need) {
            L.edu.stage = 'faculdade'; L.edu.curso = curso; L.edu.nota = 60; stat(L, 'felicidade', 10);
            return O(`Aprovado(a) em ${curso}! Começa a vida universitária.`, 'especial', { scene: { id: 'comemoracao', data: { titulo: 'Aprovado(a)!', sub: curso, env: 'universidade' } } });
          }
          L.edu.stage = 'formado'; stat(L, 'felicidade', -10);
          return O(`Não foi dessa vez. Você não passou em ${curso}.`, 'ruim', { scene: { id: 'reflexao', data: { titulo: 'Reprovado(a)', env: 'quarto', motion: 'triste' } } });
        },
      })),
      { label: 'Trabalhar direto', icon: '💼', run: (L) => { L.edu.stage = 'formado'; stat(L, 'felicidade', 2); return O('Você decidiu entrar no mercado de trabalho. Procure vagas no menu Carreira!', 'neutro'); } },
      { label: 'Ano sabático viajando', icon: '🌍', run: (L) => { L.edu.stage = 'formado'; stat(L, 'felicidade', 14); L.money -= 3000; const d = rng.pick(DESTINOS); return O(`Você mochilou por ${d}. Experiência inesquecível!`, 'bom', { scene: { id: 'viagem', data: { destino: d, titulo: 'Mochilão!' } } }); } },
    ],
  },
  {
    id: 'cnh', min: 18, max: 30, weight: 10, once: true, icon: '🚗', title: 'Carteira de motorista',
    cond: (L) => !L.licenca,
    text: () => 'Você está pronto(a) para a prova de direção?',
    choices: [
      { label: 'Fazer a prova', icon: '🚦', run: (L) => { L.money -= 1500; const ok = rng.chance(0.55 + L.stats.inteligencia / 300); if (ok) { L.licenca = true; stat(L, 'felicidade', 8); return O('Aprovado(a) de primeira! Carteira na mão.', 'bom', { scene: { id: 'dirigir', data: { ok: true } } }); } stat(L, 'felicidade', -6); return O('Você bateu no cone. Reprovado(a)!', 'ruim', { scene: { id: 'dirigir', data: { ok: false } } }); } },
      { label: 'Deixar para depois', icon: '⏳', run: () => O('Transporte público por enquanto.', 'neutro') },
    ],
  },
  // ======================================================== vida adulta
  {
    id: 'faculdadeFim', min: 21, max: 30, weight: 100, once: true, icon: '🎓', title: 'Formatura na faculdade',
    cond: (L) => L.edu.stage === 'faculdade' && (L.flags.anosFacul as number) >= 4,
    text: (L) => `Depois de anos de estudo, você se forma em ${L.edu.curso}!`,
    scene: (L) => ({ id: 'formatura', others: parents(L), data: { nivel: 'faculdade' } }),
    auto: (L) => { L.edu.stage = 'formado'; L.edu.faculdade = true; stat(L, 'felicidade', 12); stat(L, 'inteligencia', 6); return O(`Diploma de ${L.edu.curso} na mão! Novas portas se abrem.`, 'especial'); },
  },
  {
    id: 'amorAdulto', min: 20, max: 55, weight: (L) => (partner(L) ? 0 : 12), icon: '💞', title: 'Alguém especial',
    setup: (L) => {
      const sex = L.player.sex === 'f' ? (rng.chance(0.85) ? 'm' : 'f') : rng.chance(0.85) ? 'f' : 'm';
      const p = makePerson(rng, { sex, age: Math.max(18, L.player.age + rng.int(-5, 5)), rel: sex === 'f' ? 'namorada' : 'namorado', bond: rng.int(55, 80) });
      p.job = rng.pick(['Arquiteta(o)', 'Chef', 'Designer', 'Médica(o)', 'Fotógrafa(o)', 'Professora(o)', 'Advogada(o)']);
      return { person: p, lugar: rng.pick(['num café', 'na academia', 'num aplicativo de namoro', 'no casamento de um amigo', 'na fila do mercado']) };
    },
    text: (_L, c) => `Você conheceu ${c.person!.first} ${c.lugar}. Rolou uma conexão instantânea!`,
    choices: [
      { label: 'Convidar para jantar', icon: '🍷', run: (L, c) => { const p = c.person!; const yes = rng.chance(0.45 + L.stats.aparencia / 250); if (yes) { p.metAt = L.player.age; L.people.push(p); stat(L, 'felicidade', 12); return O(`O jantar foi perfeito. Você e ${p.first} começaram a namorar!`, 'especial', { scene: { id: 'encontro', others: [p], data: { first: true, good: true } } }); } stat(L, 'felicidade', -6); return O(`${p.first} disse que não sentiu química.`, 'ruim', { scene: { id: 'encontro', others: [p], data: { first: true, good: false } } }); } },
      { label: 'Trocar contatos', icon: '📱', run: (L, c) => { const p = c.person!; p.rel = p.sex === 'f' ? 'amiga' : 'amigo'; L.people.push(p); stat(L, 'felicidade', 3); return O(`Vocês viraram amigos. Quem sabe no futuro...`, 'neutro'); } },
      { label: 'Ignorar', icon: '🚶', run: () => O('Você seguiu seu caminho.', 'neutro') },
    ],
  },
  {
    id: 'pedidoParceiro', min: 22, max: 65, weight: (L) => { const p = partner(L); return p && p.rel !== 'conjuge' && p.bond > 70 && L.player.age - (p.metAt ?? L.player.age) >= 2 ? 10 : 0; }, icon: '💍', title: 'Pedido de casamento!',
    setup: (L) => ({ person: partner(L) }),
    text: (_L, c) => `${c.person!.first} preparou um jantar especial e está se ajoelhando com uma aliança!`,
    choices: [
      { label: 'Aceitar!', icon: '💖', run: (L, c) => { const p = c.person!; p.rel = 'conjuge'; bond(p, 15); stat(L, 'felicidade', 15); L.money -= 15000; addLog(L, `Casei com ${p.first}!`, 'especial', '💒'); return O(`Vocês se casaram numa cerimônia linda!`, 'especial', { scene: { id: 'casamento', others: [p] }, log: false }); } },
      { label: 'Recusar', icon: '💔', run: (L, c) => { const p = c.person!; p.rel = 'ex'; bond(p, -40); stat(L, 'felicidade', -10); return O(`${p.first} ficou arrasado(a) e terminou o relacionamento.`, 'ruim', { scene: { id: 'termino', others: [p] } }); } },
    ],
  },
  {
    id: 'bebe', min: 22, max: 44, weight: (L) => { const s = spouse(L); return s && children(L).length < 4 ? 9 : 0; }, icon: '🍼', title: 'Um bebê a caminho?',
    setup: (L) => ({ person: spouse(L) }),
    text: (_L, c) => `${c.person!.first} quer conversar sobre ter um filho.`,
    choices: [
      { label: 'Vamos ter um bebê!', icon: '👶', run: (L, c) => {
        const s = c.person!;
        const sex = rng.chance(0.5) ? 'f' : 'm';
        const mom = L.player.sex === 'f' ? L.player.ap : s.ap, dad = L.player.sex === 'f' ? s.ap : L.player.ap;
        const kid = makePerson(rng, { sex, age: 0, rel: sex === 'f' ? 'filha' : 'filho', last: L.player.last, bond: 95 });
        kid.ap = inherit(rng, mom, dad, sex);
        L.people.push(kid);
        stat(L, 'felicidade', 15); bond(s, 10);
        addLog(L, `Nasceu ${kid.first}, ${he(kid, 'meu filho', 'minha filha')}!`, 'especial', '👶');
        return O(`${kid.first} nasceu saudável e cheio(a) de vida!`, 'especial', { scene: { id: 'filho', others: [kid, s] }, log: false });
      } },
      { label: 'Adotar uma criança', icon: '🏡', run: (L, c) => { const sex = rng.chance(0.5) ? 'f' : 'm'; const kid = makePerson(rng, { sex, age: rng.int(1, 6), rel: sex === 'f' ? 'filha' : 'filho', last: L.player.last, bond: 80 }); L.people.push(kid); L.karma += 10; stat(L, 'felicidade', 12); bond(c.person!, 6); return O(`Vocês adotaram ${kid.first}! A família cresceu.`, 'especial', { scene: { id: 'interacao', others: [kid], data: { action: 'abracar' } } }); } },
      { label: 'Ainda não', icon: '⏳', run: (L, c) => { bond(c.person!, -5); return O('Vocês decidiram esperar mais um pouco.', 'neutro'); } },
    ],
  },
  {
    id: 'traicao', min: 20, max: 70, weight: (L) => (partner(L) ? 3 : 0), icon: '💔', title: 'Suspeita de traição',
    cond: (L) => !!partner(L),
    setup: (L) => { const person = partner(L); return person ? { person } : null; },
    text: (_L, c) => `Você viu mensagens estranhas no celular de ${c.person!.first}...`,
    choices: [
      { label: 'Confrontar', icon: '😡', run: (L, c) => { const p = c.person!; if (rng.chance(0.4)) { p.rel = 'ex'; bond(p, -50); stat(L, 'felicidade', -15); return O(`${p.first} confessou tudo. O relacionamento acabou.`, 'ruim', { scene: { id: 'termino', others: [p] } }); } bond(p, -8); return O(`Era só uma surpresa de aniversário! Que vergonha...`, 'neutro', { scene: { id: 'interacao', others: [p], data: { action: 'discutir' } } }); } },
      { label: 'Confiar e esquecer', icon: '🕊️', run: (L, c) => { bond(c.person!, 3); stat(L, 'felicidade', -2); return O('Você escolheu confiar.', 'neutro'); } },
      { label: 'Fingir que não viu', icon: '🙈', run: (L, c) => { bond(c.person!, -3); stat(L, 'felicidade', -4); return O('Você guardou a suspeita e fechou o celular. A senha mudou; a dúvida, não.', 'neutro', { mood: 'tenso', react: { player: { expr: 'serio' } } }); } },
      { label: 'Revidar com agressão verbal', icon: '🗯️', run: (L, c) => aggress(L, c.person!, 'xingar') },
    ],
  },
  {
    id: 'amigoPrecisa', min: 16, max: 90, weight: (L) => (friends(L).length ? 7 : 0), icon: '🆘', title: 'Amigo em apuros',
    setup: (L) => ({ person: pickRandom(friends(L)), n: rng.int(1, 8) * 500 }),
    text: (_L, c) => `${c.person!.first} está com dívidas e pediu ${money(c.n!)} emprestado.`,
    choices: [
      { label: 'Emprestar', icon: '💸', cond: (L, c) => L.money >= c.n!, run: (L, c) => { L.money -= c.n!; bond(c.person!, 15); L.karma += 5; if (rng.chance(0.6)) { L.money += c.n!; return O(`${c.person!.first} devolveu tudo e ainda te deu um presente!`, 'bom'); } return O(`${c.person!.first} agradeceu muito... mas nunca devolveu.`, 'neutro'); } },
      { label: 'Negar', icon: '🙅', run: (L, c) => { bond(c.person!, -10); return O(`${c.person!.first} ficou chateado(a).`, 'ruim'); } },
    ],
  },
  {
    id: 'loteriaAchada', min: 18, max: 90, weight: 3, icon: '🎟️', title: 'Bilhete premiado?',
    text: () => 'Você achou um bilhete de loteria na calçada. Os números... parecem familiares.',
    choices: [
      { label: 'Conferir o resultado', icon: '🔍', run: (L) => { if (rng.chance(0.15)) { const v = rng.int(5, 60) * 1000; L.money += v; stat(L, 'felicidade', 15); return O(`Premiado! Você ganhou ${money(v)}!`, 'especial', { scene: { id: 'loteria', data: { win: true, valor: money(v) } } }); } return O('Nenhum número certo.', 'neutro', { scene: { id: 'loteria', data: { win: false } } }); } },
      { label: 'Entregar à polícia', icon: '👮', run: (L) => { L.karma += 5; return O('Você é uma pessoa honesta. O dono ficou grato.', 'bom'); } },
    ],
  },
  {
    id: 'acidenteRua', min: 8, max: 90, weight: 4, icon: '🍌', title: 'Distração na rua',
    text: () => 'Você estava andando olhando o celular quando...',
    auto: (L) => { stat(L, 'saude', -6); stat(L, 'felicidade', -3); return O('Você tropeçou feio na calçada. Nada quebrado, só o orgulho.', 'ruim', { scene: { id: 'tropeco' } }); },
  },
  {
    id: 'doenca', min: 30, max: 95, weight: (L) => 3 + Math.max(0, (L.player.age - 50) / 5), icon: '🤒', title: 'Não está se sentindo bem',
    setup: () => ({ s: rng.pick(['uma gripe forte', 'pressão alta', 'uma crise de coluna', 'uma infecção', 'um problema no coração']) }),
    text: (_L, c) => `Você anda com sintomas estranhos. Suspeita de ${c.s}.`,
    choices: [
      { label: 'Ir ao médico', icon: '🏥', run: (L, c) => { L.money -= 800; const good = rng.chance(0.75); if (good) { stat(L, 'saude', 8); return O(`Diagnóstico precoce! Tratamento de ${c.s} bem-sucedido.`, 'bom', { scene: { id: 'medico', data: { good: true, fala: 'Vai ficar tudo bem, é tratável.' } } }); } stat(L, 'saude', -10); return O(`${(c.s ?? '').charAt(0).toUpperCase() + (c.s ?? '').slice(1)} é mais sério do que parecia. Você precisa se cuidar.`, 'ruim', { scene: { id: 'medico', data: { good: false, fala: 'Precisamos de mais exames...' } } }); } },
      { label: 'Ignorar', icon: '🙈', run: (L, c) => { stat(L, 'saude', -14); return O(`Você ignorou ${c.s} e piorou bastante.`, 'ruim', { scene: { id: 'visitaHospital', others: [...(partner(L) ? [partner(L)!] : []), ...children(L), ...parents(L)].slice(0, 2) } }); } },
      { label: 'Chá da vovó', icon: '🍵', run: (L) => { if (rng.chance(0.4)) { stat(L, 'saude', 3); return O('Incrivelmente, funcionou!', 'bom'); } stat(L, 'saude', -6); return O('O chá não resolveu.', 'ruim'); } },
    ],
  },
  {
    id: 'morteParente', min: 10, max: 110, weight: (L) => (byRel(L, 'mae', 'pai', 'avo', 'avoM').some((p) => p.age > 70) ? 8 : 0), icon: '🕯️', title: 'Uma perda na família',
    setup: (L) => { const old = byRel(L, 'mae', 'pai', 'avo', 'avoM').filter((p) => p.age > 70); return old.length ? { person: rng.pick(old) } : null; },
    text: (_L, c) => `${c.person!.first}, ${he(c.person!, 'seu', 'sua')} ${c.person!.rel === 'mae' ? 'mãe' : c.person!.rel === 'pai' ? 'pai' : 'avó(ô)'}, faleceu aos ${c.person!.age} anos.`,
    auto: (L, c) => {
      const p = c.person!;
      p.alive = false;
      stat(L, 'felicidade', -18);
      const heranca = Math.round((p.money ?? 10000) * (p.bond / 100));
      if (heranca > 0) L.money += heranca;
      addLog(L, `${p.first} faleceu. ${heranca > 0 ? 'Recebi ' + money(heranca) + ' de herança.' : ''}`, 'ruim', '🕯️');
      return O(`Foi um funeral emocionante. ${heranca > 0 ? 'Você herdou ' + money(heranca) + '.' : ''}`, 'ruim', { scene: { id: 'funeral', others: [...children(L), ...byRel(L, 'irmao', 'irma'), ...(partner(L) ? [partner(L)!] : [])].slice(0, 3), data: { nome: p.first, sub: `${p.age} anos` } }, log: false });
    },
  },
  {
    id: 'viagemPremio', min: 18, max: 80, weight: 3, icon: '✈️', title: 'Promoção de passagens',
    setup: () => ({ s: rng.pick(DESTINOS), n: rng.int(3, 9) * 1000 }),
    text: (_L, c) => `Passagens para ${c.s} em promoção por ${money(c.n!)}! Vai?`,
    choices: [
      { label: 'Comprar e viajar', icon: '🧳', cond: (L, c) => L.money >= c.n!, run: (L, c) => { L.money -= c.n!; stat(L, 'felicidade', 14); stat(L, 'saude', 3); return O(`A viagem para ${c.s} foi inesquecível!`, 'bom', { scene: { id: 'viagem', data: { destino: c.s } } }); } },
      { label: 'Guardar dinheiro', icon: '🐷', run: () => O('Você preferiu economizar.', 'neutro') },
    ],
  },
  {
    id: 'crise', min: 35, max: 55, weight: 4, once: true, icon: '🌀', title: 'Crise de meia-idade',
    text: () => 'Você acordou pensando: "é isso que eu quero da vida?"',
    choices: [
      { label: 'Comprar um carro esportivo', icon: '🏎️', cond: (L) => L.money > 60000, run: (L) => { L.money -= 60000; L.assets.carro = { nome: 'Esportivo vermelho', valor: 60000, cor: '#e4572e' }; stat(L, 'felicidade', 12); return O('Vruuum! Você se sente jovem de novo.', 'bom', { scene: { id: 'carroNovo', data: { cor: '#e4572e', nome: 'Esportivo vermelho' } } }); } },
      { label: 'Começar a meditar', icon: '🧘', run: (L) => { stat(L, 'felicidade', 10); stat(L, 'saude', 5); return O('Você encontrou paz interior.', 'bom', { scene: { id: 'meditar' } }); } },
      { label: 'Fazer uma tatuagem', icon: '🖋️', run: (L) => { stat(L, 'felicidade', 6); stat(L, 'aparencia', rng.chance(0.6) ? 3 : -3); return O('Uma tatuagem nova e uma história para contar.', 'neutro'); } },
    ],
  },
  {
    id: 'netos', min: 45, max: 100, weight: (L) => (children(L).some((k) => k.age >= 24) && !L.flags.neto ? 8 : 0), icon: '👵', title: 'Você vai ser avó/avô!',
    cond: (L) => children(L).some((k) => k.age >= 24) && !L.flags.neto,
    setup: (L) => { const person = pickRandom(children(L).filter((k) => k.age >= 24)); return person ? { person } : null; },
    text: (_L, c) => `${c.person!.first} contou que está esperando um bebê!`,
    auto: (L, c) => { const neto = makePerson(rng, { sex: rng.chance(0.5) ? 'f' : 'm', age: 0, rel: 'conhecido', last: c.person!.last, bond: 95 }); L.people.push(neto); L.flags.neto = 1; L.flags.netoPessoaId = neto.id; stat(L, 'felicidade', 14); bond(c.person!, 8); return O(`${c.person!.first} contou que ${neto.first} está a caminho. A família vai crescer; a lista de nomes também.`, 'especial', { scene: { id: 'interacao', others: [c.person!, neto], data: { action: 'abracar' } } }); },
  },
  {
    id: 'reencontro', min: 25, max: 90, weight: (L) => (byRel(L, 'ex').length ? 3 : 0), icon: '🔁', title: 'Reencontro inesperado',
    cond: (L) => byRel(L, 'ex').length > 0,
    setup: (L) => { const person = pickRandom(byRel(L, 'ex')); return person ? { person } : null; },
    text: (_L, c) => `Você esbarrou em ${c.person!.first}, seu/sua ex, no supermercado.`,
    choices: [
      { label: 'Conversar', icon: '💬', run: (L, c) => { bond(c.person!, 10); stat(L, 'felicidade', 3); return O('Foi bom colocar o papo em dia.', 'bom', { scene: { id: 'interacao', others: [c.person!], data: { action: 'conversar', env: 'ruaDia' } } }); } },
      { label: 'Fingir que não viu', icon: '🫣', run: (L, c) => { bond(c.person!, -1); stat(L, 'felicidade', -1); return O('Você se escondeu atrás das bananas. O carrinho andou; o constrangimento ficou.', 'neutro', { react: { player: { expr: 'envergonhado' } } }); } },
      { label: 'Convidar para tentar de novo', icon: '💞', cond: (L) => !partner(L), run: (L, c) => {
        const p = c.person!; const voltou = rng.chance(0.3 + L.stats.aparencia / 350 + p.bond / 500);
        if (voltou) { p.rel = p.sex === 'f' ? 'namorada' : 'namorado'; bond(p, 15); stat(L, 'felicidade', 10); return O(`${p.first} aceitou conversar sobre um recomeço. Vocês combinaram de não discutir na fila do caixa, ao menos hoje.`, 'especial', { scene: { id: 'encontro', others: [p], data: { first: false, good: true } }, react: { npc: { expr: 'feliz', say: 'Vamos com calma desta vez.' } } }); }
        bond(p, -7); stat(L, 'felicidade', -8); return O(`${p.first} agradeceu e recusou. A fila avançou; seu coração pediu senha nova.`, 'ruim', { scene: { id: 'encontro', others: [p], data: { first: false, good: false } }, mood: 'triste', react: { npc: { expr: 'serio', say: 'Prefiro deixar como está.' }, player: { expr: 'triste' } } });
      } },
    ],
  },
  {
    id: 'heroi', min: 16, max: 80, weight: 2, icon: '🦸', title: 'Momento de coragem',
    text: () => 'Uma criança caiu no lago do parque e ninguém está fazendo nada!',
    choices: [
      { label: 'Pular no lago', icon: '🏊', run: (L) => { L.karma += 12; L.fame += 5; stat(L, 'felicidade', 12); stat(L, 'saude', -3); return O('Você salvou a criança e virou notícia na TV!', 'especial', { scene: { id: 'comemoracao', data: { titulo: 'Herói do dia!', env: 'parque' } } }); } },
      { label: 'Chamar os bombeiros', icon: '📞', run: (L) => { L.karma += 5; return O('Os bombeiros chegaram a tempo. Todos a salvo.', 'bom', { scene: { id: 'telefonema', data: { env: 'parque', fala: 'Alô, bombeiros? Rápido!' } } }); } },
    ],
  },
  {
    id: 'propinaChefe', min: 20, max: 65, weight: (L) => (L.job ? 3 : 0), icon: '🕴️', title: 'Proposta suspeita',
    text: () => 'Um colega propõe desviar um pouco da verba da empresa. "Ninguém vai notar", ele diz.',
    choices: [
      { label: 'Topar', icon: '🤑', run: (L) => { L.karma -= 12; if (rng.chance(0.4)) { L.job = null; leaveJobPeople(L); L.crime.ficha += 1; stat(L, 'felicidade', -15); return O('Foram descobertos! Você foi demitido(a) por justa causa.', 'ruim', { scene: { id: 'demissao' } }); } L.money += 20000; return O('Você embolsou R$ 20 mil... e uma consciência pesada.', 'neutro'); } },
      { label: 'Denunciar', icon: '📢', run: (L) => { L.karma += 8; if (L.job) L.job.perf += 15; return O('A diretoria elogiou sua integridade.', 'bom', { scene: { id: 'promocao', data: { cargo: 'Funcionário(a) exemplar' } } }); } },
      { label: 'Recusar em silêncio', icon: '🤐', run: () => O('Você ficou fora disso.', 'neutro') },
    ],
  },
  {
    id: 'ofertaEmprego', min: 18, max: 62, weight: (L) => (!L.job && !L.retired && L.edu.stage !== 'faculdade' && !L.crime.preso ? 18 : 0), icon: '📨', title: 'Oferta de emprego',
    setup: (L) => {
      const ok = CAREERS.filter((c) => L.player.age >= c.minAge && (c.edu !== 'faculdade' || (L.edu.faculdade && (!c.curso || c.curso === L.edu.curso))));
      return ok.length ? { s: rng.pick(ok).id } : null;
    },
    text: (_L, c) => { const car = careerById(c.s!)!; return `Uma empresa viu seu perfil e ofereceu uma vaga de ${car.titles[0]} (${money(car.salary)}/ano). ${car.icon}`; },
    choices: [
      { label: 'Aceitar a vaga', icon: '🤝', run: (L, c) => { const car = careerById(c.s!)!; L.job = { id: car.id, title: car.titles[0], salary: car.salary, perf: 55, years: 0, level: 0 }; L.jobHistory.push(car.titles[0]); hireStaff(L, car.titles[0]); stat(L, 'felicidade', 8); return O(`Contratado(a) como ${car.titles[0]}! Bem-vindo(a) à equipe.`, 'especial', { scene: { id: 'entrevista', data: { ok: true, cargo: car.titles[0] } } }); } },
      { label: 'Negociar salário', icon: '💬', run: (L, c) => { const car = careerById(c.s!)!; if (rng.chance(0.45 + L.stats.inteligencia / 300)) { const sal = Math.round(car.salary * 1.2); L.job = { id: car.id, title: car.titles[0], salary: sal, perf: 55, years: 0, level: 0 }; L.jobHistory.push(car.titles[0]); hireStaff(L, car.titles[0]); stat(L, 'felicidade', 10); return O(`Negociação vencida! ${car.titles[0]} com ${money(sal)}/ano.`, 'especial', { scene: { id: 'entrevista', data: { ok: true, cargo: car.titles[0] } } }); } return O('A empresa retirou a proposta. Ops!', 'ruim', { scene: { id: 'entrevista', data: { ok: false, cargo: car.titles[0] } } }); } },
      { label: 'Recusar', icon: '🙅', run: () => O('Você preferiu esperar algo melhor.', 'neutro') },
    ],
  },
  {
    id: 'bolsa', min: 15, max: 17, weight: (L) => (L.stats.inteligencia > 75 ? 12 : 0), once: true, icon: '🏅', title: 'Olimpíada de conhecimento',
    text: () => 'Você foi selecionado(a) para a olimpíada nacional de ciências!',
    choices: [
      { label: 'Estudar muito e competir', icon: '🧪', run: (L) => { const ok = rng.chance(0.4 + L.stats.inteligencia / 250); stat(L, 'inteligencia', 5); if (ok) { stat(L, 'felicidade', 12); L.flags.medalha = 1; return O('Medalha de ouro! Seu nome saiu no jornal da cidade.', 'especial', { scene: { id: 'comemoracao', data: { titulo: 'Medalha de ouro!', sub: 'Olimpíada de ciências', env: 'escola' } } }); } return O('Ficou em 5º lugar. Nada mal!', 'neutro', { scene: { id: 'estudar' } }); } },
      { label: 'Recusar', icon: '😴', run: () => O('Você preferiu não participar.', 'neutro') },
    ],
  },
  {
    id: 'viral', min: 13, max: 70, weight: 3, icon: '📱', title: 'Seu vídeo viralizou!',
    text: () => 'Um vídeo seu dançando foi compartilhado milhões de vezes!',
    choices: [
      { label: 'Aproveitar a fama', icon: '🌟', run: (L) => { L.fame += 15; stat(L, 'felicidade', 8); const v = rng.int(1, 8) * 1000; L.money += v; return O(`Você fechou uma parceria e ganhou ${money(v)}!`, 'especial', { scene: { id: 'balada' } }); } },
      { label: 'Apagar o vídeo', icon: '🙈', run: (L) => { stat(L, 'felicidade', -2); return O('A internet nunca esquece... mas logo passou.', 'neutro') } },
    ],
  },
  {
    id: 'assalto', min: 16, max: 90, weight: 3, icon: '🔪', title: 'Assalto!',
    text: () => 'Voltando para casa à noite, um assaltante te aborda: "Passa o celular!"',
    choices: [
      { label: 'Reagir', icon: '👊', run: (L) => { if (rng.chance(0.3 + L.fitness / 250)) { stat(L, 'felicidade', 6); L.fame += 2; return O('Você derrubou o assaltante e ele fugiu correndo!', 'bom', { scene: { id: 'briga', data: { win: true, env: 'ruaNoite' } } }); } stat(L, 'saude', -15); return O('Péssima ideia. Você se machucou feio.', 'ruim', { scene: { id: 'briga', data: { win: false, env: 'ruaNoite' } } }); } },
      { label: 'Entregar o celular', icon: '📱', run: (L) => { L.money -= 1500; stat(L, 'felicidade', -6); return O('Você perdeu o celular, mas está a salvo.', 'ruim', { scene: { id: 'reflexao', data: { titulo: 'Assaltado(a)', env: 'ruaNoite', motion: 'susto' } } }); } },
      { label: 'Correr!', icon: '🏃', run: (L) => { if (rng.chance(0.55)) return O('Você correu como nunca e escapou!', 'bom', { scene: { id: 'crime', data: { caught: false, titulo: 'Fuga!' } } }); stat(L, 'saude', -6); return O('Você tropeçou na fuga, mas o ladrão desistiu.', 'neutro', { scene: { id: 'tropeco' } }); } },
    ],
  },
  {
    id: 'festaSurpresa', min: 16, max: 90, weight: (L) => (friends(L).length >= 2 ? 4 : 0), icon: '🎁', title: 'Festa surpresa!',
    setup: (L) => ({ person: pickRandom(friends(L)) }),
    text: (_L, c) => `${c.person!.first} organizou uma festa surpresa pra você!`,
    auto: (L, c) => { stat(L, 'felicidade', 12); friends(L).forEach((f) => bond(f, 5)); return O('Que noite inesquecível com os amigos!', 'bom', { scene: { id: 'aniversario', others: [c.person!, ...friends(L).filter((f) => f !== c.person)].slice(0, 3) } }); },
  },
  {
    id: 'mudanca', min: 20, max: 60, weight: 3, once: true, icon: '🧳', title: 'Proposta de mudança',
    setup: () => ({ s: rng.pick(['Lisboa', 'Florianópolis', 'Curitiba', 'Recife', 'Porto', 'Toronto', 'Berlim']) }),
    text: (_L, c) => `Surgiu a chance de morar em ${c.s}. Recomeçar do zero?`,
    choices: [
      { label: 'Mudar!', icon: '✈️', run: (L, c) => { L.city = c.s!; stat(L, 'felicidade', 10); friends(L).forEach((f) => bond(f, -15)); return O(`Nova vida em ${c.s}! Tudo é novidade.`, 'especial', { scene: { id: 'viagem', data: { titulo: 'Mudança!', destino: c.s } } }); } },
      { label: 'Ficar onde estou', icon: '🏠', run: () => O('Você preferiu ficar perto de quem ama.', 'neutro') },
    ],
  },
  {
    id: 'maratona', min: 18, max: 70, weight: (L) => (L.fitness > 40 ? 5 : 1), icon: '🏃', title: 'Maratona da cidade',
    text: () => 'Vai rolar a maratona da cidade neste domingo. Topa o desafio?',
    choices: [
      { label: 'Correr os 42 km', icon: '🥇', run: (L) => { if (rng.chance(0.3 + L.fitness / 120)) { stat(L, 'saude', 6); stat(L, 'felicidade', 12); L.fitness += 10; return O('Você completou a maratona! Medalha no peito.', 'especial', { scene: { id: 'comemoracao', data: { titulo: 'Maratonista!', env: 'ruaDia' } } }); } stat(L, 'saude', -5); return O('Você desistiu no km 30, exausto(a).', 'ruim', { scene: { id: 'reflexao', data: { titulo: 'Cãibra!', env: 'ruaDia', motion: 'agachar' } } }); } },
      { label: 'Torcer da calçada', icon: '📣', run: (L) => { stat(L, 'felicidade', 3); return O('Você aplaudiu os corredores.', 'neutro') } },
    ],
  },
  {
    id: 'karaoke', min: 18, max: 80, weight: 3, icon: '🎤', title: 'Noite de karaokê',
    text: () => 'Os amigos te arrastaram para um karaokê. Chegou a sua vez!',
    choices: [
      { label: 'Soltar a voz', icon: '🎶', run: (L) => { const good = rng.chance(0.5); stat(L, 'felicidade', good ? 8 : 4); return good ? O('Ovação! Até pediram bis.', 'bom', { scene: { id: 'show', data: { palco: true, sub: 'Karaokê' } } }) : O('Desafinou... mas arrancou risadas de todos.', 'neutro', { scene: { id: 'show', data: { palco: true, sub: 'Karaokê' } } }); } },
      { label: 'Fugir para o banheiro', icon: '🚪', run: () => O('Ninguém percebeu sua fuga estratégica.', 'neutro') },
    ],
  },
  {
    id: 'filhoEscola', min: 30, max: 70, weight: (L) => (children(L).some((k) => k.age >= 7 && k.age <= 17) ? 6 : 0), icon: '📞', title: 'Ligação da escola',
    setup: (L) => ({ person: pickRandom(children(L).filter((k) => k.age >= 7 && k.age <= 17)) }),
    text: (_L, c) => `A diretora ligou: ${c.person!.first} se meteu em confusão na escola.`,
    choices: [
      { label: 'Conversar com calma', icon: '💬', run: (L, c) => { bond(c.person!, 8); L.karma += 2; return O(`${c.person!.first} se abriu e prometeu melhorar.`, 'bom', { scene: { id: 'interacao', others: [c.person!], data: { action: 'conversar' } } }); } },
      { label: 'Dar uma bronca', icon: '😤', run: (L, c) => { bond(c.person!, -8); return O(`${c.person!.first} ficou emburrado(a) no quarto.`, 'neutro', { scene: { id: 'brigaFamilia', others: [c.person!] } }); } },
      { label: 'Tirar o videogame', icon: '🎮', run: (L, c) => { bond(c.person!, -4); stat(L, 'felicidade', -1); return O('Castigo aplicado. Silêncio na casa.', 'neutro'); } },
    ],
  },
  // ======================================================== vida real, versão ácida
  {
    id: 'churrasco', min: 8, max: 90, weight: 5, icon: '🍖', title: 'Churrasco de família',
    text: () => 'Domingo de churrasco. O tio chega com a camisa do time e solta: "É pavê ou pa comê?". Todo mundo olha pra você.',
    scene: (L) => ({ id: 'churrasco', others: [...parents(L), ...byRel(L, 'irmao', 'irma')].slice(0, 3) }),
    choices: [
      { label: 'Rir amarelo', icon: '😬', run: (L) => { stat(L, 'felicidade', -1); parents(L).forEach((p) => bond(p, 2)); return O('Você riu pela 47ª vez da mesma piada. A família te ama. O seu amor-próprio, nem tanto.', 'neutro', { react: { player: { expr: 'envergonhado' } } }); } },
      { label: '"Tio, essa piada é mais velha que o senhor."', icon: '🔥', run: (L) => { stat(L, 'felicidade', 4); parents(L).forEach((p) => bond(p, -3)); return O('Silêncio no quintal. Até a picanha parou de chiar. Sua mãe te deu aquele olhar.', 'neutro', { react: { player: { expr: 'convencido' }, npc: { expr: 'chocado', say: 'Nossa... que grosso(a).' } } }); } },
      { label: 'Fugir pra perto da churrasqueira', icon: '🥩', run: (L) => { stat(L, 'felicidade', 5); stat(L, 'saude', -1); return O('Você virou o(a) assador(a) oficial e comeu o melhor pedaço antes de todo mundo. Estratégia.', 'bom'); } },
    ],
  },
  {
    id: 'golpeZap', min: 30, max: 95, weight: 4, icon: '📱', title: '"Oi mãe, troquei de número"',
    text: () => 'Mensagem de um número desconhecido: "Oi, sou eu, seu filho(a)/sobrinho(a). Troquei de número. Me faz um PIX de R$ 2.000 urgente?"',
    choices: [
      { label: 'Fazer o PIX', icon: '💸', run: (L) => { L.money -= 2000; stat(L, 'felicidade', -8); return O('Caiu no golpe. O "sobrinho" sumiu, o dinheiro também. Agora você é o assunto do grupo da família.', 'ruim', { scene: { id: 'telefonema', data: { fala: 'Como assim não era você?!', good: false } } }); } },
      { label: 'Pedir um áudio', icon: '🎙️', run: (L) => { stat(L, 'felicidade', 3); return O('O golpista sumiu na hora. Você é mais esperto(a) que 90% do grupo da família.', 'bom'); } },
      { label: 'Trollar o golpista', icon: '🤡', run: (L) => { stat(L, 'felicidade', 8); return O('Você mandou 40 figurinhas e um PIX de R$ 0,01 com a mensagem "tá aí, filho". O golpista te bloqueou.', 'bom'); } },
    ],
  },
  {
    id: 'piramide', min: 20, max: 80, weight: (L) => (L.money > 3000 ? 4 : 0), icon: '📈', title: 'Oportunidade imperdível',
    setup: () => ({ n: rng.int(3, 10) * 1000 }),
    text: (_L, c) => `Um conhecido jura que investiu num "clube de investimentos" que rende 30% ao mês. "É só colocar ${money(c.n!)} e chamar mais 3 amigos."`,
    choices: [
      { label: 'Investir tudo!', icon: '🚀', cond: (L, c) => L.money >= c.n!, run: (L, c) => { if (rng.chance(0.15)) { L.money += c.n!; stat(L, 'felicidade', 8); return O(`Surpresa: você saiu antes do colapso e dobrou o dinheiro. Seus 3 amigos, não.`, 'neutro'); } L.money -= c.n!; stat(L, 'felicidade', -10); L.karma -= 3; return O(`O "clube" era uma pirâmide. O dono fugiu pra Dubai. Você perdeu ${money(c.n!)} e 3 amizades.`, 'ruim', { scene: { id: 'reflexao', data: { titulo: 'Pirâmide desabou', env: 'boteco', motion: 'facepalm' } } }); } },
      { label: '"Isso é pirâmide, amigo."', icon: '🔺', run: (L) => { stat(L, 'felicidade', 2); return O('Ele ficou ofendido e te chamou de "mentalidade de pobre". Seis meses depois, estava no jornal.', 'bom'); } },
    ],
  },
  {
    id: 'transito', min: 18, max: 85, weight: (L) => (L.licenca ? 5 : 1), icon: '🚗', title: 'Fechada no trânsito',
    setup: (L) => ({ person: makePerson(rng, { age: L.player.age + rng.int(-10, 15), rel: 'conhecido', bond: 20 }) }),
    text: (_L, c) => `Um motorista te fechou, buzinou e ainda mostrou o dedo. Ele desceu do carro gritando: "Tá olhando o quê?!"`,
    scene: (_L, c) => ({ id: 'transito', others: [c.person!] }),
    choices: [
      { label: 'Respirar fundo e seguir', icon: '🧘', run: (L) => { stat(L, 'felicidade', -2); L.karma += 2; return O('Você contou até dez, xingou baixinho e seguiu viagem. Saúde mental: preservada. Orgulho: nem tanto.', 'neutro', { react: { player: { expr: 'serio' } } }); } },
      { label: 'Xingar de volta', icon: '🤬', run: (L, c) => { c.person!.first = c.person!.first; L.people.push(c.person!); return aggress(L, c.person!, 'xingar'); } },
      { label: 'Descer pra brigar', icon: '👊', run: (L, c) => { L.people.push(c.person!); return aggress(L, c.person!, 'soco'); } },
    ],
  },
  {
    id: 'filaSUS', min: 25, max: 95, weight: (L) => (L.stats.saude < 60 ? 5 : 2), icon: '🏥', title: 'Fila do pronto-socorro',
    text: () => 'Dor nas costas insuportável. No pronto-socorro, a senha é a 187. Estão chamando a 23.',
    scene: () => ({ id: 'filaHospital' }),
    choices: [
      { label: 'Esperar com dignidade', icon: '⏳', run: (L) => { stat(L, 'saude', 4); stat(L, 'felicidade', -5); return O('Nove horas depois, o médico olhou 30 segundos e receitou dipirona. Funcionou. Revoltante, mas funcionou.', 'neutro', { scene: { id: 'medico', data: { good: true, fala: 'Toma dipirona e repousa. Próximo!' } } }); } },
      { label: 'Fingir desmaio pra passar na frente', icon: '🎭', run: (L) => { if (rng.chance(0.4)) { stat(L, 'saude', 5); return O('Oscar de melhor atuação. Você foi atendido(a) em 10 minutos. A culpa, porém, dura até hoje.', 'neutro', { scene: { id: 'medico', data: { good: true, fala: 'Hmm... desmaio curioso esse.' } } }); } stat(L, 'felicidade', -6); L.karma -= 3; return O('A enfermeira viu você abrindo um olho pra conferir. Voltou pro fim da fila, sob vaias.', 'ruim', { mood: 'triste' }); } },
      { label: 'Desistir e tomar chá', icon: '🍵', run: (L) => { stat(L, 'saude', -4); return O('Chá de boldo não cura hérnia. Quem diria.', 'ruim'); } },
    ],
  },
  {
    id: 'festaFirma', min: 18, max: 70, weight: (L) => (L.job ? 6 : 0), icon: '🎄', title: 'Confraternização da firma',
    setup: (L) => ({ person: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: () => 'Festa de fim de ano da empresa: open bar, karaokê e o chefe já está sem gravata. O que você faz?',
    scene: (L, c) => ({ id: 'festaFirma', others: [...(c.person ? [c.person] : []), ...L.people.filter((p) => p.alive && p.rel === 'colegaTrab')].slice(0, 3) }),
    choices: [
      { label: 'Dançar em cima da mesa', icon: '🕺', run: (L, c) => { stat(L, 'felicidade', 8); if (L.job) L.job.perf -= 10; if (c.person) bond(c.person, -5); return O('Você virou lenda da firma — e figurinha no grupo do RH. Na segunda, ninguém te olhava nos olhos.', 'neutro', { react: { player: { motion: 'dancar2' } } }); } },
      { label: 'Puxar saco do chefe', icon: '🍑', run: (L, c) => { if (L.job) L.job.perf += 10; if (c.person) bond(c.person, 10); L.people.filter((p) => p.rel === 'colegaTrab').forEach((p) => bond(p, -6)); return O('Promoção mais perto, colegas mais longe. "Babão(ona)" é seu novo apelido.', 'neutro', { react: { player: { motion: 'joinha', expr: 'convencido' } } }); } },
      { label: 'Comer e ir embora cedo', icon: '🥡', run: (L) => { stat(L, 'felicidade', 3); return O('Você levou quentinha escondida na bolsa. Missão cumprida sem constrangimento.', 'bom'); } },
    ],
  },
  {
    id: 'chefeHumilha', min: 18, max: 70, weight: (L) => (L.job && L.people.some((p) => p.alive && p.rel === 'chefe') ? 5 : 0), icon: '😤', title: 'Humilhação na reunião',
    setup: (L) => ({ person: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: (_L, c) => `Na reunião, ${c.person!.first} (seu/sua chefe) apresentou SUA ideia como se fosse dele(a) e ainda disse que seu último relatório "parecia feito por um estagiário sonolento".`,
    scene: (L, c) => ({ id: 'reuniao', others: [c.person!, ...L.people.filter((p) => p.alive && p.rel === 'colegaTrab')].slice(0, 3) }),
    choices: [
      { label: 'Engolir o choro', icon: '😶', run: (L) => { stat(L, 'felicidade', -6); if (L.job) L.job.perf += 3; return O('Você sorriu, concordou e chorou no banheiro depois. Clássico corporativo.', 'ruim', { mood: 'triste', react: { player: { motion: 'humilhado' } } }); } },
      { label: 'Responder na lata', icon: '🗯️', run: (L, c) => { if (rng.chance(0.45)) { if (L.job) L.job.perf += 8; bond(c.person!, -10); return O('"A ideia era minha e está no e-mail de terça." A sala ficou em silêncio. Você ganhou respeito (e um inimigo).', 'bom', { react: { player: { motion: 'apontarBronca', expr: 'determinado' }, npc: { expr: 'chocado' } } }); } return aggress(L, c.person!, 'xingar'); } },
      { label: 'Jogar o café na cara dele(a)', icon: '☕', run: (L, c) => aggress(L, c.person!, 'jogarBebida') },
    ],
  },
  {
    id: 'provocacaoEscola', min: 8, max: 17, weight: (L) => (L.people.some((p) => p.alive && p.rel === 'colega') ? 7 : 0), icon: '😠', title: 'Provocação no recreio',
    setup: (L) => ({ person: pickRandom(L.people.filter((p) => p.alive && p.rel === 'colega')) }),
    text: (_L, c) => `${c.person!.first} começou a zoar seu cabelo, sua roupa e sua mãe — nessa ordem — na frente da turma inteira.`,
    choices: [
      { label: 'Ignorar', icon: '🙉', run: (L) => { stat(L, 'felicidade', -4); return O('Você fingiu que não ouviu. A turma achou que você não ouviu mesmo. Vitória silenciosa.', 'neutro', { mood: 'triste' }); } },
      { label: 'Zoar de volta', icon: '🎤', run: (L, c) => { if (rng.chance(0.5 + L.stats.inteligencia / 300)) { stat(L, 'felicidade', 8); bond(c.person!, -8); return O(`Você devolveu com uma zoeira tão boa que ${c.person!.first} ficou sem resposta. A turma fez "UUUUH".`, 'bom', { scene: { id: 'agressao', others: [c.person!], data: { kind: 'humilhar', env: 'patio', ctx: 'escola' } } }); } stat(L, 'felicidade', -6); return O('Você gaguejou e ainda levou mais zoeira. Péssima tarde.', 'ruim', { mood: 'triste' }); } },
      { label: 'Partir pra cima', icon: '👊', run: (L, c) => aggress(L, c.person!, 'soco') },
      { label: 'Contar pro(a) professor(a)', icon: '🧑‍🏫', run: (L, c) => { bond(c.person!, -5); L.karma += 1; return O('A professora deu uma bronca geral. Você ganhou fama de "X9", mas ficou sem olho roxo.', 'neutro'); } },
    ],
  },
  {
    id: 'recuperacao', min: 10, max: 17, weight: (L) => (L.edu.nota < 55 ? 8 : 0), icon: '📉', title: 'De recuperação',
    text: () => 'Você ficou de recuperação em matemática. A prova é amanhã. Seus pais ainda não sabem.',
    choices: [
      { label: 'Estudar a madrugada inteira', icon: '📚', run: (L) => { const ok = rng.chance(0.45 + L.stats.inteligencia / 220); L.edu.nota += ok ? 15 : 4; stat(L, 'saude', -3); return ok ? O('Passou raspando! Nota 6,0 — a nota mais linda da sua vida.', 'bom', { scene: { id: 'aula', data: { good: true } } }) : O('Reprovou mesmo assim. Seus pais descobriram pelo boletim no grupo da escola.', 'ruim', { scene: { id: 'brigaFamilia', others: parents(L).slice(0, 1) } }); } },
      { label: 'Colar com a calculadora do celular', icon: '📱', run: (L) => { if (rng.chance(0.4)) { L.edu.nota += 10; return O('Deu certo. Você não aprendeu nada, mas passou. Bem-vindo(a) ao sistema.', 'neutro'); } L.flags.infracoes = ((L.flags.infracoes as number) ?? 0) + 1; parents(L).forEach((p) => bond(p, -8)); return O('Pego(a) colando. Zero, detenção e seus pais chamados. Combo completo.', 'ruim', { scene: { id: 'detencao', data: { frase: 'Não devo colar na prova' } } }); } },
      { label: 'Fingir que está doente', icon: '🤒', run: (L) => { if (rng.chance(0.35)) return O('Atestado conseguido. Ganhou uma semana a mais pra estudar (e não estudou).', 'neutro'); parents(L).forEach((p) => bond(p, -5)); return O('Sua mãe botou o termômetro: 36,5°C. Você foi pra prova e ainda de castigo.', 'ruim', { mood: 'triste' }); } },
    ],
  },
  {
    id: 'vizinho', min: 18, max: 90, weight: 3, icon: '🔊', title: 'Vizinho do paredão',
    text: () => 'São 3 da manhã de uma terça. O vizinho ligou um paredão de som com funk e sertanejo AO MESMO TEMPO.',
    choices: [
      { label: 'Bater na porta e reclamar', icon: '🚪', run: (L) => { const p = makePerson(rng, { age: rng.int(25, 60), rel: 'conhecido', bond: 30 }); L.people.push(p); if (rng.chance(0.5)) { stat(L, 'felicidade', 3); return O(`${p.first} pediu desculpas e baixou o som. Milagre.`, 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'desculpas', env: 'ruaNoite', ok: true } } }); } return O(`${p.first} aumentou o volume "em sua homenagem". Guerra declarada.`, 'ruim', { scene: { id: 'interacao', others: [p], data: { action: 'discutir', env: 'ruaNoite' } }, mood: 'tenso' }); } },
      { label: 'Ligar pra polícia', icon: '🚓', run: (L) => { stat(L, 'felicidade', 2); return O('A viatura chegou às 11h da manhã seguinte. O som já tinha acabado. Serviço excelente.', 'neutro'); } },
      { label: 'Colocar seu próprio som mais alto', icon: '📢', run: (L) => { stat(L, 'felicidade', 6); stat(L, 'saude', -3); L.karma -= 2; return O('Batalha de caixas de som até o sol nascer. O prédio inteiro te odeia. Valeu a pena.', 'neutro', { scene: { id: 'balada' } }); } },
    ],
  },
  {
    id: 'aposentarAuto', min: 65, max: 75, weight: (L) => (L.job && !L.retired ? 30 : 0), icon: '🏖️', title: 'Hora de se aposentar?',
    text: () => 'Depois de tantos anos de trabalho, a aposentadoria está logo ali.',
    choices: [
      { label: 'Aposentar!', icon: '🎉', run: (L) => { L.retired = true; L.flags.aposentadoria = Math.round((L.job?.salary ?? 20000) * 0.6); L.job = null; leaveJobPeople(L); stat(L, 'felicidade', 12); return O('Você se aposentou! Agora é só curtir a vida.', 'especial', { scene: { id: 'aposentadoria' } }); } },
      { label: 'Trabalhar mais um pouco', icon: '💪', run: (L) => { stat(L, 'saude', -3); return O('Você ainda tem lenha pra queimar.', 'neutro') } },
    ],
  },
  {
    id: 'pixNumeroErrado', min: 18, max: 90, weight: 6, once: true, cond: (L) => L.money >= 100, icon: '💸', title: 'Pix para o número errado',
    setup: (L) => ({ person: makePerson(rng, { age: rng.int(25, 65), rel: 'conhecido', bond: 35 }), n: Math.min(rng.int(10, 50) * 10, Math.floor(L.money)) }),
    text: (_L, c) => `Você digitou uma chave errada e mandou ${money(c.n!)} para ${c.person!.first}. O comprovante chegou; a humildade, não.`,
    choices: [
      { label: 'Pedir ajuda ao banco', icon: '🏦', run: (L, c) => {
        if (rng.chance(0.45 + L.stats.inteligencia / 500)) { stat(L, 'felicidade', 3); return O('O banco localizou a transferência a tempo. Uma vez na vida, o protocolo veio antes do boleto.', 'bom', { scene: { id: 'telefonema', data: { fala: 'O valor voltou para sua conta.', good: true } } }); }
        L.money -= c.n!; stat(L, 'felicidade', -5); return O(`O protocolo foi aberto. O dinheiro, ${money(c.n!)}, foi passear sem data de volta.`, 'ruim', { scene: { id: 'telefonema', data: { fala: 'A transferência não pode ser revertida.', good: false } }, mood: 'triste' });
      } },
      { label: 'Pedir a devolução', icon: '📲', run: (L, c) => {
        if (rng.chance(0.4 + L.stats.inteligencia / 500)) { L.karma += 2; return O(`${c.person!.first} devolveu o valor. Ainda existe gente decente; só não dá pra marcar no app.`, 'bom', { scene: { id: 'telefonema', data: { fala: 'Pronto, devolvi. Boa sorte!', good: true } } }); }
        L.money -= c.n!; stat(L, 'felicidade', -4); return O(`${c.person!.first} visualizou e bloqueou. ${money(c.n!)} compraram uma lição sem garantia.`, 'ruim', { scene: { id: 'telefonema', data: { fala: 'Número indisponível.', good: false } }, mood: 'triste' });
      } },
      { label: 'Expor o caso no grupo do bairro', icon: '📣', run: (L, c) => {
        L.money -= c.n!; stat(L, 'felicidade', -3); L.karma -= 1;
        if (!L.people.some((p) => p.id === c.person!.id)) L.people.push(c.person!);
        L.flags.pixExposto = L.player.age; L.flags.pixVizinhoId = c.person!.id;
        return O(`O grupo avisou outras pessoas, mas ${c.person!.first} guardou seu textão. A internet tem memória e pouco serviço.`, 'neutro', { mood: 'tenso', react: { player: { expr: 'serio' } } });
      } },
    ],
  },
  {
    id: 'golpeFalsoParente', min: 20, max: 90, weight: 5, icon: '📞', title: 'Vó, manda um Pix?',
    setup: (L) => {
      const avo = pickRandom(byRel(L, 'avo', 'avoM'));
      const pessoa = avo ?? (() => { const sex = rng.pick(['f', 'm'] as const); return makePerson(rng, { sex, age: rng.int(65, 85), rel: sex === 'f' ? 'avoM' : 'avo', bond: 55 }); })();
      return { person: pessoa, n: rng.int(8, 30) * 100 };
    },
    text: (_L, c) => `${c.person!.first} recebeu mensagem de um suposto neto pedindo ${money(c.n!)}. A foto é de outra pessoa e a urgência tem pressa demais.`,
    choices: [
      { label: 'Ligar para o número salvo', icon: '☎️', run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        bond(p, 7); L.karma += 3; stat(L, 'inteligencia', 1);
        return O(`${p.first} confirmou que está bem e apagou a mensagem. O golpista perdeu a plateia e você ganhou uma ligação longa.`, 'bom', { scene: { id: 'telefonema', others: [p], data: { fala: 'Ainda bem que você ligou!', good: true } }, react: { npc: { expr: 'feliz', say: 'Ainda bem que você ligou!' } } });
      } },
      { label: 'Mandar o valor para ajudar', icon: '💸', cond: (L, c) => L.money >= c.n!, run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        if (rng.chance(0.25 + L.stats.inteligencia / 500)) { bond(p, 4); stat(L, 'felicidade', 2); return O('Você conferiu o nome do recebedor no último segundo e cancelou. O susto foi grátis; raridade nacional.', 'bom'); }
        L.money -= c.n!; bond(p, -3); stat(L, 'felicidade', -7); return O(`O dinheiro foi para o golpista. ${p.first} ficou sem o Pix e você sem ${money(c.n!)}.`, 'ruim', { scene: { id: 'telefonema', others: [p], data: { fala: 'Esse número não é da família!', good: false } }, mood: 'triste', react: { npc: { expr: 'triste', say: 'Esse número não é da família.' } } });
      } },
      { label: 'Avisar a família e bloquear', icon: '🛡️', run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        bond(p, 4); L.karma += 2; stat(L, 'felicidade', 2);
        return O('A família bloqueou o número e ganhou uma nova regra: áudio de emergência também pode esperar uma ligação.', 'bom', { scene: { id: 'telefonema', others: [p], data: { fala: 'Bloqueado. E agora vou ligar pra todo mundo.', good: true } } });
      } },
    ],
  },
  {
    id: 'contaLuzVerão', min: 20, max: 90, weight: (L) => L.flags.contaLuzPendente ? 0 : 6, icon: '🧾', title: 'A luz veio de jatinho',
    setup: () => ({ n: rng.int(8, 25) * 100 }),
    text: (_L, c) => `No calor de 40 °C, o ventilador bateu ponto no terceiro turno. A conta chegou: ${money(c.n!)}.`,
    choices: [
      { label: 'Pagar e aceitar a derrota', icon: '💳', cond: (L, c) => L.money >= c.n!, run: (L, c) => {
        L.money -= c.n!; stat(L, 'felicidade', -2); return O(`A conta de ${money(c.n!)} foi paga. O ventilador agora pode girar com culpa quitada.`, 'neutro');
      } },
      { label: 'Abrir protocolo na ouvidoria', icon: '📝', cond: (L, c) => L.money >= Math.round(c.n! * 0.65), run: (L, c) => {
        if (rng.chance(0.4 + L.stats.inteligencia / 500)) { const reducao = Math.round(c.n! * 0.35); L.money -= c.n! - reducao; stat(L, 'felicidade', 3); return O(`A leitura foi corrigida e você pagou ${money(c.n! - reducao)}. A ouvidoria resolveu antes da próxima era geológica.`, 'bom', { scene: { id: 'telefonema', data: { fala: 'A conta foi revisada.', good: true } } }); }
        L.flags.contaLuzPendente = L.player.age; stat(L, 'felicidade', -4); return O('O protocolo foi aceito. A resposta vem em até 180 dias úteis, contados em calendário de outra dimensão.', 'ruim', { scene: { id: 'telefonema', data: { fala: 'Sua solicitação está em análise.', good: false } }, mood: 'tenso' });
      } },
      { label: 'Deixar o boleto para amanhã', icon: '🧊', run: (L) => {
        L.flags.contaLuzPendente = L.player.age; stat(L, 'felicidade', 1); return O('Você escondeu o boleto embaixo da fruteira. A dívida não vê escuro; só rende juros.', 'neutro');
      } },
      { label: 'Improvisar um “gato”', icon: '⚡', run: (L, c) => {
        L.karma -= 4;
        if (rng.chance(0.25 + L.stats.inteligencia / 500)) { const economia = Math.round(c.n! * 0.15); L.money += economia; stat(L, 'saude', -3); return O(`Você economizou ${money(economia)} neste mês e comprou preocupação para os próximos.`, 'neutro', { scene: { id: 'reflexao', data: { env: 'sala', titulo: 'Conta reduzida', sub: 'Economia baixa, tensão alta.', motion: 'pensando' } }, mood: 'tenso', react: { player: { expr: 'serio' } } }); }
        L.money -= 1200; stat(L, 'saude', -9); stat(L, 'felicidade', -7); return O('Um curto trouxe vistoria, multa e um susto. A economia doméstica saiu cara.', 'ruim', { scene: { id: 'reflexao', data: { env: 'sala', titulo: 'Conta inesperada', sub: 'A multa veio com faísca.', motion: 'triste' } }, mood: 'ferido', react: { player: { expr: 'dor' } } });
      } },
    ],
  },
  {
    id: 'enchenteNaRua', min: 18, max: 90, weight: 4, icon: '🌧️', title: 'A rua virou rio',
    text: () => 'A água já chegou à calçada e seu sofá está mais perto da porta que você. O bairro tenta salvar o que dá.',
    scene: () => ({ id: 'reflexao', data: { env: 'ruaChuva', titulo: 'Rua virou rio', sub: 'O sofá já pediu carona.', motion: 'triste' } }),
    choices: [
      { label: 'Tirar os móveis de casa', icon: '🛋️', run: (L) => {
        if (rng.chance(0.35 + L.fitness / 250)) { stat(L, 'saude', -2); stat(L, 'felicidade', 4); L.money -= 250; return O('Você salvou o sofá e perdeu duas almofadas para a correnteza. A sala sobreviveu com baixa autoestima.', 'bom', { scene: { id: 'reflexao', data: { env: 'ruaChuva', titulo: 'Operação sofá', sub: 'Dois braços, quatro almofadas.', motion: 'correr' } } }); }
        stat(L, 'saude', -9); stat(L, 'felicidade', -7); L.money -= 1200; return O('A água levou o sofá e quase levou você. O seguro pediu fotos; a água não esperou.', 'ruim', { scene: { id: 'reflexao', data: { env: 'ruaChuva', titulo: 'Prejuízo molhado', sub: 'O sofá foi morar no quarteirão.', motion: 'triste' } }, mood: 'ferido', react: { player: { expr: 'dor' } } });
      } },
      { label: 'Filmar para o story', icon: '📱', run: (L) => {
        L.fame += 3; L.karma -= 2; stat(L, 'felicidade', 2); return O('O vídeo teve 12 mil visualizações. Seu colchão também, mas ele não monetizou.', 'neutro', { scene: { id: 'reflexao', data: { env: 'ruaChuva', titulo: 'Ao vivo do alagamento', sub: 'A água subiu. O engajamento também.', motion: 'mexerCelular' } }, react: { player: { expr: 'serio' } } });
      } },
      { label: 'Ajudar os vizinhos', icon: '🤝', run: (L) => {
        L.karma += 5; stat(L, 'saude', -4); stat(L, 'felicidade', 5); return O('Você ergueu móveis de duas casas. O karma subiu; na volta, seu nariz começou a escorrer.', 'bom', { scene: { id: 'reflexao', data: { env: 'ruaChuva', titulo: 'Mutirão na chuva', sub: 'A vizinhança virou equipe.', motion: 'ofegante' } }, mood: 'tenso' });
      } },
    ],
  },
  {
    id: 'apagaoNaEntrega', min: 18, max: 70, weight: (L) => (L.job ? (L.flags.contaLuzPendente ? 5 : 2) : 0),
    cond: (L) => !!L.job, icon: '🕯️', title: 'Apagão no prazo final',
    text: (L) => `Seu relatório vence hoje. O bairro apagou e ${L.job?.title ?? 'o trabalho'} não aceita entrega em vela.`,
    scene: () => ({ id: 'reflexao', data: { env: 'escritorio', titulo: 'Sem energia', sub: 'O prazo continua ligado.', motion: 'facepalm' } }),
    choices: [
      { label: 'Avisar a chefia na hora', icon: '☎️', run: (L) => {
        const aceito = rng.chance(0.5 + (L.job?.perf ?? 50) / 300);
        if (aceito) { if (L.job) L.job.perf += 4; stat(L, 'felicidade', 2); return O('A chefia aceitou o aviso e estendeu o prazo. Transparência: 1, reunião de alinhamento: ainda por vir.', 'bom', { scene: { id: 'telefonema', data: { fala: 'Entrega amanhã. Registre o chamado.', good: true } } }); }
        if (L.job) L.job.perf -= 7; L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1; stat(L, 'felicidade', -4); return O('A chefia achou que faltou planejamento e registrou uma advertência. Poste não costuma pedir opinião.', 'ruim', { scene: { id: 'telefonema', data: { fala: 'O prazo era conhecido desde segunda.', good: false } }, mood: 'tenso', react: { player: { expr: 'serio' } } });
      } },
      { label: 'Dizer que já enviou', icon: '🤥', run: (L) => {
        if (rng.chance(0.2 + L.stats.inteligencia / 500)) { if (L.job) L.job.perf += 2; stat(L, 'felicidade', 3); return O('A chefia encontrou o anexo no e-mail. Era o arquivo errado, mas você ganhou até amanhã para corrigir.', 'neutro'); }
        if (L.job) L.job.perf -= 12; L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1; stat(L, 'felicidade', -7); return O('Pedem o protocolo de envio e registram uma advertência. A única coisa enviada foi sua credibilidade.', 'ruim', { mood: 'triste', react: { player: { expr: 'envergonhado' } } });
      } },
      { label: 'Ir à lan house do bairro', icon: '🖥️', cond: (L) => L.money >= 80, run: (L) => {
        L.money -= 80; stat(L, 'saude', -3); if (L.job) L.job.perf += 5; return O('Você terminou o relatório no computador da lan house. O prazo foi salvo por R$ 80 e um teclado pegajoso.', 'bom', { scene: { id: 'reflexao', data: { env: 'escritorio', titulo: 'Entrega concluída', sub: 'A tomada tinha energia e taxa horária.', motion: 'digitar' } } });
      } },
    ],
  },
  {
    id: 'nomeSujo', min: 20, max: 90, weight: 5, icon: '📉', title: 'Seu nome foi pro cadastro',
    cond: (L) => L.flags.nomeSujo === undefined,
    setup: () => ({ n: rng.int(10, 50) * 100 }),
    text: (_L, c) => `Uma dívida esquecida de ${money(c.n!)} apareceu no cadastro de crédito. O aplicativo oferece três botões e nenhum abraço.`,
    choices: [
      { label: 'Renegociar com entrada', icon: '🧾', cond: (L, c) => L.money >= Math.round(c.n! * 0.2), run: (L, c) => {
        const entrada = Math.round(c.n! * 0.2); L.money -= entrada;
        if (rng.chance(0.45 + L.stats.inteligencia / 250)) { stat(L, 'felicidade', 4); L.karma += 1; return O(`A negociação fechou com entrada de ${money(entrada)}. Seu nome saiu da lista antes do café esfriar.`, 'bom'); }
        L.flags.nomeSujo = L.player.age; stat(L, 'felicidade', -5); return O(`A entrada de ${money(entrada)} foi. A dívida continua e ganhou prazo para pensar no assunto.`, 'ruim', { mood: 'tenso' });
      } },
      { label: 'Ignorar as notificações', icon: '🔕', run: (L) => {
        L.flags.nomeSujo = L.player.age; stat(L, 'felicidade', -6); return O('Você silenciou o aplicativo. O cadastro não silenciou você; só passou a cobrar em letra maior.', 'ruim', { mood: 'tenso' });
      } },
      { label: 'Pagar o feirão “limpa nome”', icon: '🧼', cond: (L) => L.money >= 600, run: (L) => {
        L.money -= 600;
        if (rng.chance(0.3 + L.stats.inteligencia / 500)) { stat(L, 'felicidade', 3); return O('O acordo era legítimo e a restrição saiu. Você leu as letras miúdas; a civilização avança.', 'bom'); }
        L.flags.nomeSujo = L.player.age; stat(L, 'felicidade', -8); return O('O intermediário sumiu depois da taxa. Seu nome continua sujo; agora o saldo também.', 'ruim', { mood: 'triste' });
      } },
    ],
  },
  {
    id: 'furadeiraDomingo', min: 20, max: 90, weight: (L) => L.flags.furadeiraRevidada ? 0 : 5, icon: '🛠️', title: 'Furadeira às sete',
    setup: (L) => ({ person: makePerson(rng, { age: rng.int(25, 70), rel: 'conhecido', bond: 38 }), hora: rng.pick(['7h03', '7h11', '7h29']) }),
    text: (_L, c) => `Domingo, ${c.hora}: o vizinho começou a furar a parede. Você suspeita que a broca atravessou até o seu sonho.`,
    choices: [
      { label: 'Pedir respeito na porta', icon: '🚪', run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        if (rng.chance(0.45 + L.stats.inteligencia / 500)) { bond(p, 6); stat(L, 'felicidade', 3); return O(`${p.first} pediu desculpas e adiou a obra. A conversa durou menos que a furadeira.`, 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'conversar', env: 'suburbio' } }, react: { npc: { expr: 'feliz', say: 'Foi mal, já vou parar.' } } }); }
        bond(p, -8); stat(L, 'felicidade', -4); return O(`${p.first} disse que está dentro do horário permitido. O domingo não foi consultado.`, 'ruim', { scene: { id: 'interacao', others: [p], data: { action: 'discutir', env: 'suburbio' } }, mood: 'tenso', react: { npc: { expr: 'serio', say: 'É só uma furadeira.' } } });
      } },
      { label: 'Chamar o síndico', icon: '📋', run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        if (rng.chance(0.65)) { bond(p, -2); stat(L, 'felicidade', 2); L.karma += 1; return O('O síndico pediu que a obra esperasse. Você ganhou silêncio e uma reunião de condomínio futura.', 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'conversar', env: 'suburbio' } } }); }
        bond(p, -6); stat(L, 'felicidade', -3); return O('O síndico não atendeu; o vizinho ouviu seu recado pelo interfone. Democracia acústica.', 'ruim', { mood: 'tenso', react: { player: { expr: 'serio' } } });
      } },
      { label: 'Ligar o som em resposta', icon: '🔊', run: (L, c) => {
        const p = c.person!; if (!L.people.some((x) => x.id === p.id)) L.people.push(p);
        bond(p, -8); L.karma -= 3; stat(L, 'felicidade', 4); L.flags.furadeiraRevidada = L.player.age; L.flags.furadeiraVizinhoId = p.id;
        return O('A obra ganhou trilha sonora e o prédio ganhou dois inimigos com caixa de som. O síndico ganhou assunto.', 'neutro', { scene: { id: 'interacao', others: [p], data: { action: 'discutir', env: 'suburbio' } }, mood: 'tenso', react: { player: { expr: 'serio' }, npc: { expr: 'bravo', say: 'Aumenta mais que eu quero!' } } });
      } },
    ],
  },
  {
    id: 'cursoMilionario', min: 20, max: 75, weight: (L) => L.money >= 250 ? 5 : 0, once: true, icon: '📈', title: 'Aula para ficar rico',
    setup: () => ({ n: 1997, entrada: 250 }),
    text: (_L, c) => `Um curso promete ensinar a ganhar ${money(c.n!)} por mês com “mentalidade milionária”. A aula grátis já pediu seu cartão.`,
    choices: [
      { label: 'Comprar o pacote completo', icon: '💳', cond: (L, c) => L.money >= c.n!, run: (L, c) => {
        L.money -= c.n!; L.flags.cursoCoachComprado = L.player.age; stat(L, 'felicidade', 2); return O(`Você pagou ${money(c.n!)} por 12 módulos e um grupo VIP. A prosperidade começou no caixa do vendedor.`, 'ruim', { mood: 'tenso' });
      } },
      { label: 'Fechar a aba', icon: '❎', run: (L) => {
        stat(L, 'inteligencia', 1); stat(L, 'felicidade', 2); return O('Você fechou a página e guardou o cartão. Seu patrimônio cresceu exatamente R$ 0; hoje isso é progresso.', 'bom');
      } },
      { label: 'Virar afiliado do curso', icon: '🤝', cond: (L, c) => L.money >= c.entrada!, run: (L, c) => {
        L.money -= c.entrada!; L.flags.cursoCoachComprado = L.player.age; L.fame += 2; L.karma -= 3;
        return O('Você pagou para divulgar o curso e chamou isso de renda passiva. A plataforma recebeu renda ativa.', 'neutro', { react: { player: { expr: 'convencido' } } });
      } },
    ],
  },
  {
    id: 'vizinhoLembra', min: 20, max: 100, weight: 6,
    cond: (L) => {
      const pix = L.flags.pixExposto, furadeira = L.flags.furadeiraRevidada;
      return (typeof pix === 'number' && L.player.age - pix >= 1 && typeof L.flags.pixVizinhoId === 'string') ||
        (typeof furadeira === 'number' && L.player.age - furadeira >= 1 && typeof L.flags.furadeiraVizinhoId === 'string');
    },
    setup: (L) => {
      const pendencias = [
        { tipo: 'pix', idade: L.flags.pixExposto, id: L.flags.pixVizinhoId },
        { tipo: 'furadeira', idade: L.flags.furadeiraRevidada, id: L.flags.furadeiraVizinhoId },
      ].filter((x) => typeof x.id === 'string' && typeof x.idade === 'number' && L.player.age - x.idade >= 1)
        .sort((a, b) => (a.idade as number) - (b.idade as number));
      const item = pendencias[0];
      const person = item && L.people.find((p) => p.id === item.id);
      return item && person ? { tipo: item.tipo, person } : null;
    },
    icon: '📣', title: (_L, c) => c.tipo === 'pix' ? 'O grupo não esquece' : 'Domingo, de novo',
    text: (_L, c) => c.tipo === 'pix'
      ? `${c.person!.first} voltou ao grupo do bairro para cobrar seu textão sobre o Pix. O histórico está fixado; a paz, não.`
      : `${c.person!.first} retomou a obra cedo e lembrou do seu som. O prédio segue sem isolamento e sem maturidade.`,
    choices: [
      { label: 'Conversar sem plateia', icon: '💬', run: (L, c) => {
        const p = c.person!; bond(p, 6); L.karma += 2; stat(L, 'felicidade', 3);
        if (c.tipo === 'pix') { delete L.flags.pixExposto; delete L.flags.pixVizinhoId; }
        else { delete L.flags.furadeiraRevidada; delete L.flags.furadeiraVizinhoId; }
        return O(`${p.first} aceitou baixar o tom. O grupo do bairro perdeu um capítulo; você ganhou silêncio.`, 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'conversar', env: 'suburbio' } }, react: { npc: { expr: 'feliz', say: 'Podemos esquecer isso?' } } });
      } },
      { label: 'Pedir mediação ao síndico', icon: '📋', run: (L, c) => {
        const p = c.person!; bond(p, 2); L.karma += 3; stat(L, 'felicidade', 1);
        if (c.tipo === 'pix') { delete L.flags.pixExposto; delete L.flags.pixVizinhoId; }
        else { delete L.flags.furadeiraRevidada; delete L.flags.furadeiraVizinhoId; }
        return O('O síndico mediou a conversa e registrou tudo em ata. Agora até a paz tem número de protocolo.', 'neutro', { scene: { id: 'interacao', others: [p], data: { action: 'conversar', env: 'suburbio' } } });
      } },
      { label: 'Responder no grupo', icon: '⌨️', run: (L, c) => {
        const p = c.person!; const venceu = rng.chance(0.35 + L.stats.inteligencia / 250);
        if (c.tipo === 'pix') { delete L.flags.pixExposto; delete L.flags.pixVizinhoId; }
        else { delete L.flags.furadeiraRevidada; delete L.flags.furadeiraVizinhoId; }
        if (venceu) { bond(p, -2); stat(L, 'felicidade', 2); return O('Sua resposta encerrou o assunto. O grupo mudou para foto de cachorro e boletos, nessa ordem.', 'neutro'); }
        bond(p, -9); stat(L, 'felicidade', -5); return O('Sua resposta virou captura de tela e figurinha. O grupo achou um novo assunto: você.', 'ruim', { mood: 'tenso', react: { player: { expr: 'envergonhado' } } });
      } },
    ],
  },
  {
    id: 'cobrancaInesperada', min: 20, max: 100, weight: 7,
    cond: (L) => ['contaLuzPendente', 'nomeSujo', 'cursoCoachComprado'].some((flag) => typeof L.flags[flag] === 'number' && L.player.age - (L.flags[flag] as number) >= 1),
    setup: (L) => {
      const pendencias = [
        { tipo: 'luz', flag: 'contaLuzPendente', valor: 650 },
        { tipo: 'credito', flag: 'nomeSujo', valor: 1200 },
        { tipo: 'curso', flag: 'cursoCoachComprado', valor: 997 },
      ].map((x) => ({ ...x, idade: L.flags[x.flag] }))
        .filter((x) => typeof x.idade === 'number' && L.player.age - x.idade >= 1)
        .sort((a, b) => (a.idade as number) - (b.idade as number));
      const item = pendencias[0];
      return item ? { tipo: item.tipo, flag: item.flag, n: item.valor } : null;
    },
    icon: '📬', title: (_L, c) => c.tipo === 'luz' ? 'A ouvidoria respondeu' : c.tipo === 'credito' ? 'O cadastro ainda cobra' : 'O curso renovou sozinho',
    text: (_L, c) => c.tipo === 'luz'
      ? `A resposta do protocolo chegou: a conta venceu e há ${money(c.n!)} em encargos. A ouvidoria agradece sua paciência.`
      : c.tipo === 'credito'
        ? `O cadastro segue restrito e o acordo pede ${money(c.n!)} para limpar a pendência. Seu nome está em mais grupos que você.`
        : `O curso renovou o acesso por ${money(c.n!)}. O módulo de cancelamento fica dentro do módulo de prosperidade.`,
    choices: [
      { label: 'Pagar e encerrar o assunto', icon: '💳', cond: (L, c) => L.money >= c.n!, run: (L, c) => {
        L.money -= c.n!; delete L.flags[c.flag!]; stat(L, 'felicidade', 3);
        return O(`Você pagou ${money(c.n!)} e encerrou a pendência. O alívio veio sem parcelamento; o saldo, também.`, 'neutro', { scene: { id: 'telefonema', data: { fala: 'Sua pendência foi encerrada.', good: true } } });
      } },
      { label: 'Contestar com comprovantes', icon: '🗂️', cond: (L) => L.money >= 100, run: (L, c) => {
        if (rng.chance(0.35 + L.stats.inteligencia / 250)) { delete L.flags[c.flag!]; L.karma += 2; stat(L, 'felicidade', 3); return O('Os comprovantes resolveram a cobrança. Guardar PDF finalmente virou investimento.', 'bom', { scene: { id: 'telefonema', data: { fala: 'A cobrança foi retirada.', good: true } } }); }
        L.money -= 100; L.flags[c.flag!] = L.player.age; stat(L, 'felicidade', -4); return O('O sistema pediu outro formulário para provar que você já enviou o formulário anterior.', 'ruim', { scene: { id: 'telefonema', data: { fala: 'Faltou um documento complementar.', good: false } }, mood: 'tenso' });
      } },
      { label: 'Empurrar para o próximo ano', icon: '📆', run: (L, c) => {
        L.flags[c.flag!] = L.player.age; stat(L, 'felicidade', -4); return O('Você adiou a cobrança. Ela aceitou o convite e já marcou o retorno com juros.', 'ruim', { mood: 'tenso' });
      } },
    ],
  },
  {
    id: 'feedbackSanduiche', min: 20, max: 65, weight: (L) => (L.job && !L.retired ? 7 : 0), icon: '🥪', title: 'Feedback sanduíche',
    setup: (L) => ({ person: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: (_L, c) => `${c.person?.first ?? 'A chefia'} elogiou seu potencial, apontou três falhas e encerrou dizendo que você é essencial. O recheio era cobrança.`,
    scene: (_L, c) => ({ id: 'reuniao', others: c.person ? [c.person] : [] }),
    choices: [
      { label: 'Pedir metas por escrito', icon: '📝', run: (L, c) => {
        if (L.job) L.job.perf += 5; stat(L, 'inteligencia', 1); if (c.person) bond(c.person, 2);
        return O('As metas chegaram por e-mail. Agora a cobrança tem anexo e prazo.', 'bom', { react: { player: { expr: 'serio' }, npc: { expr: 'serio', say: 'Vamos acompanhar de perto.' } } });
      } },
      { label: 'Contestar com resultados', icon: '📊', run: (L, c) => {
        const sucesso = rng.chance(0.35 + L.stats.inteligencia / 250);
        if (sucesso) { if (L.job) L.job.perf += 8; if (c.person) bond(c.person, -3); stat(L, 'felicidade', 3); return O('Os números fecharam a conversa. O chefe chamou de alinhamento; você chamou de terça-feira.', 'bom', { react: { npc: { expr: 'chocado' }, player: { expr: 'determinado' } } }); }
        if (L.job) L.job.perf -= 8; L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1; L.flags.feedbackTrabalho = L.player.age; L.flags.feedbackTrabalhoJob = L.job?.id ?? '';
        stat(L, 'felicidade', -6); if (c.person) bond(c.person, -5);
        return O('O relatório virou “falta de colaboração”. RH registrou a advertência; a planilha não foi convidada.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Fica registrada a advertência.' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Engolir o sanduíche', icon: '😶', run: (L) => {
        if (L.job) L.job.perf += 2; stat(L, 'felicidade', -3);
        return O('Você agradeceu pelo feedback. O gestor anotou “boa atitude” e esqueceu o aumento.', 'neutro', { mood: 'triste', react: { player: { expr: 'serio' } } });
      } },
    ],
  },
  {
    id: 'justaCausaFeedback', min: 21, max: 70, weight: (L) => (L.job ? ((L.flags.advertencias as number) ?? 0) >= 2 ? 12 : 4 : 0), once: true,
    cond: (L) => !!L.job && typeof L.flags.feedbackTrabalho === 'number' && L.player.age - (L.flags.feedbackTrabalho as number) >= 1 && L.flags.feedbackTrabalhoJob === L.job.id && ((L.flags.advertencias as number) ?? 0) >= 2,
    setup: (L) => ({ person: L.people.find((p) => p.alive && p.rel === 'chefe'), testemunha: L.people.find((p) => p.alive && p.rel === 'colegaTrab') }),
    icon: '📦', title: 'Reunião com o RH', text: (_L, c) => `${c.person?.first ?? 'A chefia'} chamou você ao RH. A advertência anterior agora tem uma apresentação de 24 slides.`,
    scene: (_L, c) => ({ id: 'demissao', others: c.person ? [c.person] : [] }),
    choices: [
      { label: 'Contestar com documentos', icon: '🗂️', run: (L, c) => {
        const sucesso = rng.chance(0.25 + L.stats.inteligencia / 300 + (L.job?.perf ?? 0) / 500);
        if (sucesso) { L.flags.advertencias = 0; delete L.flags.feedbackTrabalho; delete L.flags.feedbackTrabalhoJob; if (L.job) L.job.perf += 12; stat(L, 'felicidade', 4); return O('Os registros provaram que a meta mudou três vezes. A justa causa virou “conversa de alinhamento”.', 'bom', { react: { npc: { expr: 'chocado', say: 'Vamos rever o caso.' }, player: { expr: 'feliz' } } }); }
        const antiga = L.job!; L.money += Math.round(antiga.salary * 0.2); L.job = null; leaveJobPeople(L); delete L.flags.feedbackTrabalho; delete L.flags.feedbackTrabalhoJob; stat(L, 'felicidade', -10);
        return O(`O RH manteve a justa causa e pagou ${money(Math.round(antiga.salary * 0.2))} de acerto. Seu crachá perdeu acesso antes da reunião acabar.`, 'ruim', { mood: 'triste', react: { npc: { expr: 'serio', say: 'A decisão está mantida.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Pedir apoio da testemunha', icon: '🗣️', cond: (_L, c) => !!c.testemunha, run: (L, c) => {
        const pessoa = c.testemunha!; const sucesso = rng.chance(0.25 + pessoa.bond / 250 + L.stats.inteligencia / 400);
        if (sucesso) { bond(pessoa, 8); L.flags.advertencias = 0; delete L.flags.feedbackTrabalho; delete L.flags.feedbackTrabalhoJob; if (L.job) L.job.perf += 8; stat(L, 'felicidade', 3); return O(`${pessoa.first} confirmou sua versão. A chefia arquivou o caso e chamou isso de “escuta ativa”.`, 'bom', { react: { npc: { expr: 'chocado' }, player: { expr: 'feliz' } } }); }
        bond(pessoa, -4); const antiga = L.job!; L.money += Math.round(antiga.salary * 0.2); L.job = null; leaveJobPeople(L); delete L.flags.feedbackTrabalho; delete L.flags.feedbackTrabalhoJob; stat(L, 'felicidade', -12);
        return O(`${pessoa.first} ficou em silêncio. A empresa manteve a justa causa; o silêncio não entrou na folha de pagamento.`, 'ruim', { mood: 'triste', react: { npc: { expr: 'serio', say: 'Encerramos por aqui.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Assinar o acordo e sair', icon: '✍️', run: (L) => {
        const antiga = L.job!; L.money += Math.round(antiga.salary * 0.35); L.job = null; leaveJobPeople(L); delete L.flags.feedbackTrabalho; delete L.flags.feedbackTrabalhoJob; stat(L, 'felicidade', -5);
        return O(`Você saiu com ${money(Math.round(antiga.salary * 0.35))} e uma carta de referência que diz “trabalhou aqui”.`, 'neutro', { mood: 'triste', react: { player: { expr: 'serio' } } });
      } },
    ],
  },
  {
    id: 'estagiarioBrilhante', min: 20, max: 65, weight: (L) => (L.job && !L.retired ? 5 : 0), icon: '🧑‍💻', title: 'O estagiário sabe demais',
    setup: (L) => ({ person: makePerson(rng, { age: rng.int(18, 26), rel: 'colegaTrab', bond: 42 }) }),
    text: (_L, c) => `${c.person!.first}, recém-chegado(a) como estagiário(a), resolveu em uma manhã o problema que sua equipe discute desde março.`,
    scene: (_L, c) => ({ id: 'trabalho', others: [c.person!], data: { titulo: 'Primeira semana', sub: 'A planilha ganhou respeito.' } }),
    choices: [
      { label: 'Ensinar o caminho da equipe', icon: '🧭', run: (L, c) => {
        const p = c.person!; L.people.push(p); bond(p, 12); if (L.job) L.job.perf -= 2; L.flags.estagiarioPessoaId = p.id; L.flags.estagiarioIdade = L.player.age; L.flags.estagiarioEscolha = 'mentoria'; L.flags.estagiarioEmprego = L.job?.id ?? '';
        L.karma += 3; stat(L, 'felicidade', 2); return O(`${p.first} aprendeu o fluxo e ainda documentou tudo. Você perdeu duas horas e ganhou um manual que ninguém pediu.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Valeu por explicar!' }, player: { expr: 'serio' } } });
      } },
      { label: 'Disputar a apresentação', icon: '📊', run: (L, c) => {
        const p = c.person!; L.people.push(p); const venceu = rng.chance(0.35 + L.stats.inteligencia / 300);
        L.flags.estagiarioPessoaId = p.id; L.flags.estagiarioIdade = L.player.age; L.flags.estagiarioEscolha = 'disputa'; L.flags.estagiarioEmprego = L.job?.id ?? '';
        if (venceu) { if (L.job) L.job.perf += 5; bond(p, -3); stat(L, 'felicidade', 3); return O('Sua apresentação ficou com o crédito oficial. O estagiário ficou com a solução e uma memória excelente.', 'neutro', { react: { npc: { expr: 'serio' }, player: { expr: 'convencido' } } }); }
        if (L.job) L.job.perf -= 6; bond(p, -8); stat(L, 'felicidade', -4); return O(`${p.first} mostrou o histórico do projeto e seu nome sumiu do slide. Até a fonte parecia testemunha.`, 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'O arquivo tem data.' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Sabotar a apresentação', icon: '🫥', run: (L, c) => {
        const p = c.person!; L.people.push(p); bond(p, -12); L.karma -= 5; L.flags.estagiarioPessoaId = p.id; L.flags.estagiarioIdade = L.player.age; L.flags.estagiarioEscolha = 'sabotou'; L.flags.estagiarioEmprego = L.job?.id ?? '';
        if (rng.chance(0.35 + (L.job?.perf ?? 0) / 350)) { if (L.job) L.job.perf -= 8; L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1; stat(L, 'felicidade', -5); return O('A equipe percebeu que faltavam dados no material e rastreou quem tinha acesso. RH chamou isso de “conversa rápida”.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Isso precisa ser esclarecido.' }, player: { expr: 'envergonhado' } } }); }
        if (L.job) L.job.perf += 3; stat(L, 'felicidade', -2); return O('A apresentação saiu confusa e seu projeto ganhou espaço. O estagiário guardou a dúvida para depois.', 'neutro', { react: { npc: { expr: 'serio' }, player: { expr: 'serio' } } });
      } },
      { label: 'Deixar a pessoa brilhar', icon: '✨', run: (L, c) => {
        const p = c.person!; L.people.push(p); bond(p, 8); if (L.job) L.job.perf += 2; L.flags.estagiarioPessoaId = p.id; L.flags.estagiarioIdade = L.player.age; L.flags.estagiarioEscolha = 'apoiou'; L.flags.estagiarioEmprego = L.job?.id ?? '';
        L.karma += 2; return O(`${p.first} recebeu o elogio e citou sua equipe. A chefia anotou “colaboração” como se fosse verba.`, 'bom', { react: { npc: { expr: 'feliz', say: 'A equipe me ajudou muito.' } } });
      } },
    ],
  },
  {
    id: 'estagiarioVirouChefe', min: 22, max: 90, weight: 7, once: true,
    cond: (L) => typeof L.flags.estagiarioIdade === 'number' && L.player.age - (L.flags.estagiarioIdade as number) >= 2 && !!L.people.find((p) => p.id === L.flags.estagiarioPessoaId && p.alive),
    setup: (L) => {
      const person = L.people.find((p) => p.id === L.flags.estagiarioPessoaId && p.alive);
      return person ? { person, tipo: L.flags.estagiarioEscolha, mesmoEmprego: L.job?.id === L.flags.estagiarioEmprego } : null;
    },
    icon: '📈', title: 'Seu estagiário virou chefe',
    text: (_L, c) => `${c.person!.first}, aquele(a) estagiário(a), agora lidera uma equipe. A rede profissional avisou; o algoritmo não conhece o conceito de constrangimento.`,
    scene: (_L, c) => ({ id: 'trabalho', others: [c.person!], data: { titulo: 'Nova liderança', sub: 'O estágio tinha plano de carreira.' } }),
    choices: [
      { label: 'Reconhecer o mérito', icon: '🤝', run: (L, c) => {
        bond(c.person!, 8); L.karma += 2; stat(L, 'felicidade', 2);
        if (c.tipo === 'mentoria' || c.tipo === 'apoiou') { if (L.job && c.mesmoEmprego) L.job.perf += 4; return O(`${c.person!.first} lembrou que você ajudou no começo e indicou seu nome para um projeto. Uma boa lembrança rendeu mais que um curso motivacional.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Eu não esqueci sua ajuda.' } } }); }
        if (c.tipo === 'sabotou') { L.karma += 2; bond(c.person!, 10); return O(`Você reconheceu que sabotou ${c.person!.first} no começo. A pessoa aceitou o pedido de desculpas; confiança leva mais que um crachá.`, 'neutro', { react: { npc: { expr: 'serio', say: 'Vamos deixar isso para trás.' }, player: { expr: 'serio' } } }); }
        return O(`${c.person!.first} aceitou sua mensagem com educação. O passado não foi apagado, só ganhou cargo novo.`, 'neutro', { react: { npc: { expr: 'serio' } } });
      } },
      { label: 'Pedir uma indicação', icon: '📨', run: (L, c) => {
        const chance = (c.tipo === 'mentoria' || c.tipo === 'apoiou' ? 0.45 : 0.15) + c.person!.bond / 400;
        if (rng.chance(chance)) { bond(c.person!, 4); if (L.job && c.mesmoEmprego) L.job.perf += 5; stat(L, 'felicidade', 4); return O(`${c.person!.first} recomendou você para uma vaga. A antiga equipe virou referência; desta vez, no currículo.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Vou falar bem de você.' } } }); }
        bond(c.person!, -5); stat(L, 'felicidade', -3); return O(`${c.person!.first} agradeceu a mensagem e não respondeu sobre a vaga. Networking também tem botão de arquivar.`, 'ruim', { react: { npc: { expr: 'serio' }, player: { expr: 'triste' } } });
      } },
      { label: 'Silenciar a atualização', icon: '🔕', run: (L) => { stat(L, 'felicidade', 1); return O('Você fechou a notificação. A vida seguiu, sem pedir para ver seu perfil.', 'neutro'); } },
    ],
  },
  {
    id: 'colegaRoubaCredito', min: 20, max: 65, weight: (L) => (L.job && L.people.some((p) => p.alive && p.rel === 'colegaTrab') ? 6 : 0), icon: '📑', title: 'A ideia ganhou outro nome',
    setup: (L) => ({ person: pickRandom(L.people.filter((p) => p.alive && p.rel === 'colegaTrab')), chefe: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: (_L, c) => `${c.person!.first} apresentou sua proposta na reunião e recebeu os parabéns. O arquivo original ainda tem seu nome, em letras pequenas.`,
    scene: (_L, c) => ({ id: 'reuniao', others: [c.person!, ...(c.chefe ? [c.chefe] : [])] }),
    choices: [
      { label: 'Mostrar o histórico do arquivo', icon: '🧾', run: (L, c) => {
        const p = c.person!; const sucesso = rng.chance(0.4 + L.stats.inteligencia / 300);
        if (sucesso) { bond(p, -8); if (L.job) L.job.perf += 5; L.karma += 2; stat(L, 'felicidade', 3); return O('O histórico confirmou a autoria. O colega devolveu o crédito; a reunião não devolveu os 40 minutos.', 'bom', { react: { npc: { expr: 'envergonhado', say: 'O arquivo ficou comigo.' }, player: { expr: 'determinado' } } }); }
        bond(p, -4); if (L.job) L.job.perf -= 3; stat(L, 'felicidade', -5); return O('O arquivo estava numa pasta antiga sem data clara. O crédito ficou com quem compartilhou a tela.', 'ruim', { mood: 'triste', react: { npc: { expr: 'serio' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Conversar em particular', icon: '💬', run: (L, c) => {
        const p = c.person!; const resolveu = rng.chance(0.45 + p.bond / 300);
        if (resolveu) { bond(p, 5); if (L.job) L.job.perf += 2; return O(`${p.first} reconheceu que passou do ponto e corrigiu a ata. A conversa durou 4 minutos, um recorde da firma.`, 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'conversar', env: 'escritorio' } }, react: { npc: { expr: 'serio', say: 'Vou corrigir a ata.' } } }); }
        bond(p, -8); stat(L, 'felicidade', -4); return O(`${p.first} chamou a conversa de “mal-entendido”. O mal-entendido continua usando seu trabalho.`, 'ruim', { scene: { id: 'interacao', others: [p], data: { action: 'discutir', env: 'escritorio' } }, mood: 'tenso', react: { npc: { expr: 'serio' }, player: { expr: 'serio' } } });
      } },
      { label: 'Registrar no RH', icon: '📬', run: (L, c) => {
        const p = c.person!; const apurou = rng.chance(0.3 + L.stats.inteligencia / 350);
        if (apurou) { bond(p, -10); if (L.job) L.job.perf += 3; stat(L, 'felicidade', 2); return O('O RH corrigiu o registro e abriu uma apuração. A planilha agora tem mais testemunhas que a reunião.', 'neutro', { react: { npc: { expr: 'serio', say: 'Vamos conversar depois.' }, player: { expr: 'determinado' } } }); }
        bond(p, -6); if (L.job) L.job.perf -= 5; stat(L, 'felicidade', -6); return O('O RH arquivou por falta de evidência. Seu colega guardou a apresentação; você, o protocolo.', 'ruim', { mood: 'tenso', react: { player: { expr: 'triste' } } });
      } },
    ],
  },
  {
    id: 'happyHourObrigatorio', min: 20, max: 65, weight: (L) => (L.job ? 5 : 0), icon: '🥂', title: 'Happy hour obrigatório',
    setup: (L) => ({ equipe: L.people.filter((p) => p.alive && ['chefe', 'colegaTrab'].includes(p.rel)).slice(0, 3) }),
    text: () => 'A chefia chamou a saída de “opcional”, depois perguntou no grupo quem não vai. O happy hour começa às 19h; sua bateria social, às 2%.',
    scene: (L, c) => ({ id: 'festaFirma', others: c.equipe }),
    choices: [
      { label: 'Ficar e conversar', icon: '🗨️', run: (L, c) => {
        c.equipe.forEach((p: Person) => bond(p, 4)); stat(L, 'felicidade', 3); if (L.job) L.job.perf += 2;
        return O('Você ficou até a sobremesa e ouviu três histórias de trânsito. A equipe chamou isso de integração.', 'bom', { react: { player: { expr: 'feliz' }, npc: { expr: 'feliz', say: 'A gente devia repetir!' } } });
      } },
      { label: 'Ficar na água e observar', icon: '🥤', run: (L, c) => {
        c.equipe.forEach((p: Person) => bond(p, 2)); stat(L, 'felicidade', -1);
        return O('Você pediu água com gás e participou da conversa. O limão foi o único ali sem meta trimestral.', 'neutro', { react: { player: { expr: 'serio' } } });
      } },
      { label: 'Ir embora depois da foto', icon: '📸', run: (L, c) => {
        const chefe = c.equipe.find((p: Person) => p.rel === 'chefe'); const constrangeu = rng.chance(0.25 + L.stats.felicidade / 300);
        if (chefe) bond(chefe, -2); if (L.job) L.job.perf -= 2;
        if (constrangeu) { L.flags.videoFirmaIdade = L.player.age; L.flags.videoFirmaJob = L.job?.id ?? ''; stat(L, 'felicidade', -5); return O('A foto ficou boa; o vídeo dos bastidores, não. Alguém já mandou no grupo do trabalho.', 'ruim', { mood: 'triste', react: { player: { expr: 'envergonhado' } } }); }
        stat(L, 'felicidade', 2); return O('Você escapou sem virar assunto. A foto oficial provou que compareceu; o resto é privacidade.', 'bom', { react: { player: { expr: 'feliz' } } });
      } },
    ],
  },
  {
    id: 'reuniaoQueEmailResolvia', min: 20, max: 65, weight: (L) => (L.job ? 7 : 0), icon: '💻', title: 'Isso podia ser um e-mail',
    setup: (L) => ({ equipe: L.people.filter((p) => p.alive && ['chefe', 'colegaTrab'].includes(p.rel)).slice(0, 3) }),
    text: () => 'A reunião começou com “vou compartilhar a tela” e 11 minutos de silêncio. O assunto cabia em duas linhas e um anexo.',
    scene: (L, c) => ({ id: 'reuniao', others: c.equipe, data: { titulo: 'Alinhamento rápido', sub: 'Duração prevista: 15 min. Real: 2 h' } }),
    choices: [
      { label: 'Mandar resumo por e-mail', icon: '✉️', run: (L, c) => {
        c.equipe.forEach((p: Person) => bond(p, 1)); if (L.job) L.job.perf += 3; stat(L, 'felicidade', 2);
        return O('Você resumiu as decisões em quatro tópicos. A reunião continuou para decidir o assunto do próximo e-mail.', 'bom', { react: { player: { expr: 'feliz' }, npc: { expr: 'serio', say: 'Podemos revisar ao vivo?' } } });
      } },
      { label: 'Apresentar uma pauta objetiva', icon: '📋', run: (L, c) => {
        const acertou = rng.chance(0.4 + L.stats.inteligencia / 300);
        if (acertou) { if (L.job) L.job.perf += 5; c.equipe.forEach((p: Person) => bond(p, 2)); stat(L, 'felicidade', 3); return O('A pauta resolveu o tema em 12 minutos. A chefia chamou de “ritual de eficiência” e marcou outro.', 'bom', { react: { player: { expr: 'determinado' }, npc: { expr: 'feliz', say: 'Boa, fechamos por hoje.' } } }); }
        if (L.job) L.job.perf -= 4; stat(L, 'felicidade', -3); return O('Seu tópico abriu uma discussão paralela sobre o formato da pauta. A pauta ganhou uma pauta.', 'ruim', { mood: 'tenso', react: { player: { expr: 'serio' }, npc: { expr: 'serio' } } });
      } },
      { label: 'Deixar a câmera ligada sem querer', icon: '📷', run: (L, c) => {
        const escapou = rng.chance(0.25 + L.stats.felicidade / 300); const pessoa = c.equipe.find((p: Person) => p.rel === 'chefe');
        if (escapou) { if (L.job) L.job.perf += 1; stat(L, 'felicidade', 2); return O('Você apareceu bocejando, mas a tela congelou bem na hora. A tecnologia, enfim, trabalhou a seu favor.', 'neutro', { react: { player: { motion: 'dormirEmPe', expr: 'envergonhado' } } }); }
        if (L.job) L.job.perf -= 6; if (pessoa) bond(pessoa, -3); stat(L, 'felicidade', -5); return O('Seu bocejo apareceu em alta definição. A chefia perguntou se você estava acompanhando; o microfone respondeu por você.', 'ruim', { mood: 'triste', react: { player: { motion: 'dormirEmPe', expr: 'envergonhado' }, npc: { expr: 'serio', say: 'Está tudo bem por aí?' } } });
      } },
    ],
  },
  {
    id: 'assedioMoralChefe', min: 20, max: 65, weight: (L) => (L.job && L.people.some((p) => p.alive && p.rel === 'chefe') ? 4 : 0), icon: '📣', title: 'A cobrança passou do limite',
    setup: (L) => ({ person: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: (_L, c) => `${c.person!.first} critica seu trabalho em público, muda prazos sem aviso e chama a pressão de “cultura de excelência”.`,
    scene: (L, c) => ({ id: 'diretoria', others: [c.person!, ...L.people.filter((p) => p.alive && p.rel === 'colegaTrab')].slice(0, 3) }),
    choices: [
      { label: 'Registrar e denunciar ao RH', icon: '🗂️', run: (L, c) => {
        const resultado = rng.chance(0.3 + L.stats.inteligencia / 300);
        if (resultado) { L.flags.assedioMoralIdade = L.player.age; L.flags.assedioMoralValor = L.job?.salary ?? 10000; bond(c.person!, -10); L.karma += 4; stat(L, 'felicidade', 2); return O('O RH abriu uma apuração e preservou os registros. A empresa descobriu que “somos uma família” também deixa documentos.', 'neutro', { react: { npc: { expr: 'serio', say: 'A apuração é confidencial.' }, player: { expr: 'determinado' } } }); }
        if (L.job) L.job.perf -= 7; L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1; bond(c.person!, -8); stat(L, 'felicidade', -7);
        return O('O RH pediu mais provas e a chefia marcou uma avaliação de desempenho. A confidencialidade durou até o elevador.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Precisamos conversar sobre sua postura.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Confrontar em particular', icon: '💬', run: (L, c) => {
        const limite = rng.chance(0.35 + L.stats.inteligencia / 300);
        if (limite) { bond(c.person!, -4); if (L.job) L.job.perf += 2; stat(L, 'felicidade', 3); return O('Você pediu prazos claros e respeito nas reuniões. A chefia recuou um passo; o organograma, nenhum.', 'bom', { scene: { id: 'interacao', others: [c.person!], data: { action: 'conversar', env: 'escritorio' } }, react: { npc: { expr: 'serio', say: 'Vamos ajustar o tom.' } } }); }
        bond(c.person!, -8); if (L.job) L.job.perf -= 5; stat(L, 'felicidade', -6); L.flags.advertencias = ((L.flags.advertencias as number) ?? 0) + 1;
        return O(`${c.person!.first} encerrou a conversa chamando sua reação de “falta de alinhamento”. O dicionário corporativo tem páginas demais.`, 'ruim', { mood: 'triste', react: { npc: { expr: 'bravo', say: 'Isso é falta de alinhamento.' }, player: { expr: 'serio' } } });
      } },
      { label: 'Sair da empresa', icon: '🚪', run: (L) => {
        if (L.job) { L.money += Math.round(L.job.salary * 0.15); L.job = null; leaveJobPeople(L); } stat(L, 'felicidade', -3); stat(L, 'saude', 3);
        return O('Você pediu demissão e saiu com o acerto disponível. O silêncio do celular durou dois dias; já foi um benefício.', 'neutro', { mood: 'triste', react: { player: { expr: 'serio' } } });
      } },
    ],
  },
  {
    id: 'indenizacaoTrabalhista', min: 22, max: 75, weight: 6, once: true,
    cond: (L) => typeof L.flags.assedioMoralIdade === 'number' && L.player.age - (L.flags.assedioMoralIdade as number) >= 2,
    setup: (L) => ({ n: Math.max(1000, Math.round((L.flags.assedioMoralValor as number) * 0.25)) }),
    icon: '⚖️', title: 'A apuração teve resposta',
    text: (_L, c) => `Depois de dois anos de documentos e audiências, chegou uma proposta de acordo de ${money(c.n!)}. A pasta ficou mais velha que o protocolo.`,
    choices: [
      { label: 'Aceitar o acordo', icon: '🤝', run: (L, c) => { L.money += c.n!; L.karma += 2; stat(L, 'felicidade', 7); delete L.flags.assedioMoralIdade; delete L.flags.assedioMoralValor; return O(`Você recebeu ${money(c.n!)} e encerrou o caso. O sistema demorou, mas pelo menos calculou os juros emocionais.`, 'bom', { react: { player: { expr: 'feliz' } } }); } },
      { label: 'Contestar e seguir', icon: '📂', run: (L, c) => {
        if (rng.chance(0.35 + L.stats.inteligencia / 300)) { const valor = Math.round(c.n! * 1.5); L.money += valor; stat(L, 'felicidade', 10); delete L.flags.assedioMoralIdade; delete L.flags.assedioMoralValor; return O(`A decisão final pagou ${money(valor)}. Seu arquivo de documentos ganhou uma estante própria.`, 'especial', { react: { player: { expr: 'feliz' } } }); }
        L.money -= Math.min(L.money, 800); stat(L, 'felicidade', -5); delete L.flags.assedioMoralIdade; delete L.flags.assedioMoralValor; return O('A contestação não mudou o acordo e gerou mais custos. A pasta ganhou uma última folha: “encerrado”.', 'ruim', { mood: 'triste', react: { player: { expr: 'triste' } } });
      } },
      { label: 'Encerrar sem acordo', icon: '🧹', run: (L) => { delete L.flags.assedioMoralIdade; delete L.flags.assedioMoralValor; stat(L, 'felicidade', 2); return O('Você fechou o caso e recuperou espaço na gaveta. A empresa enviou uma pesquisa de satisfação.', 'neutro'); } },
    ],
  },
  {
    id: 'layoffSomosFamilia', min: 20, max: 65, weight: (L) => (L.job && !L.retired ? 3 : 0), icon: '📦', title: 'Mudança de estrutura',
    setup: (L) => ({ equipe: L.people.filter((p) => p.alive && ['chefe', 'colegaTrab'].includes(p.rel)).slice(0, 3) }),
    text: () => 'A empresa anunciou um “ajuste estratégico” e disse que todos são uma família. A família recebeu uma caixa para guardar os pertences.',
    scene: (L, c) => ({ id: 'demissao', others: c.equipe, data: { titulo: 'Nova estrutura', sub: 'Sua mesa cabe numa caixa.' } }),
    choices: [
      { label: 'Aceitar o acordo de saída', icon: '📄', run: (L) => {
        const valor = Math.round((L.job?.salary ?? 0) * 0.45); L.money += valor; L.job = null; leaveJobPeople(L); stat(L, 'felicidade', -7); stat(L, 'saude', 2);
        return O(`Você saiu com ${money(valor)} e uma caixa com dois porta-retratos. A empresa manteve a família no grupo de mensagens.`, 'ruim', { mood: 'triste', scene: { id: 'demissao' }, react: { player: { motion: 'sentarCabisbaixo', expr: 'triste' } } });
      } },
      { label: 'Pedir revisão dos critérios', icon: '🔎', run: (L, c) => {
        const ficou = rng.chance(0.25 + (L.job?.perf ?? 0) / 250 + L.stats.inteligencia / 400);
        if (ficou) { if (L.job) L.job.perf += 3; c.equipe.forEach((p: Person) => bond(p, 2)); stat(L, 'felicidade', 2); return O('A lista foi revista e seu cargo ficou. A caixa voltou vazia; a confiança, em análise.', 'neutro', { react: { npc: { expr: 'serio', say: 'Por enquanto, sua vaga fica.' }, player: { expr: 'feliz' } } }); }
        const valor = Math.round((L.job?.salary ?? 0) * 0.25); L.money += valor; L.job = null; leaveJobPeople(L); stat(L, 'felicidade', -10);
        return O(`A decisão foi mantida e o acerto ficou em ${money(valor)}. A caixa já estava montada; eficiência é eficiência.`, 'ruim', { mood: 'triste', react: { npc: { expr: 'serio', say: 'A decisão é definitiva.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Ajudar a equipe a se organizar', icon: '🤝', run: (L, c) => {
        c.equipe.forEach((p: Person) => bond(p, 5)); L.karma += 3; stat(L, 'felicidade', -3); const valor = Math.round((L.job?.salary ?? 0) * 0.3); L.money += valor; L.job = null; leaveJobPeople(L);
        return O(`Você ajudou a equipe a guardar as coisas e recebeu ${money(valor)} no acerto. A empresa chamou de despedida colaborativa.`, 'neutro', { mood: 'triste', react: { npc: { expr: 'triste', say: 'A gente se fala por aqui.' }, player: { expr: 'triste' } } });
      } },
    ],
  },
  {
    id: 'greveParalisacao', min: 20, max: 65, weight: (L) => (L.job ? 4 : 0), icon: '✊', title: 'A equipe parou',
    setup: (L) => ({ equipe: L.people.filter((p) => p.alive && p.rel === 'colegaTrab').slice(0, 3), chefe: L.people.find((p) => p.alive && p.rel === 'chefe') }),
    text: () => 'A equipe convocou uma paralisação por salários e prazos. A chefia enviou um convite para uma reunião sobre o convite.',
    scene: (L, c) => ({ id: 'diretoria', others: [...c.equipe, ...(c.chefe ? [c.chefe] : [])].slice(0, 3) }),
    choices: [
      { label: 'Aderir à paralisação', icon: '🪧', run: (L, c) => {
        const negociou = rng.chance(0.3 + L.stats.inteligencia / 350 + c.equipe.length * 0.06);
        L.flags.greveAderiuIdade = L.player.age; L.flags.greveEmpregoId = L.job?.id ?? '';
        if (negociou) { c.equipe.forEach((p: Person) => bond(p, 8)); if (L.job) L.job.perf += 2; L.karma += 3; stat(L, 'felicidade', 4); return O('A paralisação conseguiu abrir negociação sobre salários e carga. A ata chamou isso de “primeira conversa”.', 'bom', { react: { npc: { expr: 'feliz', say: 'A equipe conseguiu ser ouvida.' } } }); }
        c.equipe.forEach((p: Person) => bond(p, 5)); if (L.job) L.job.perf -= 5; stat(L, 'felicidade', -4); return O('A chefia não cedeu e descontou o dia. A equipe ficou unida; o holerite, menos.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Vamos retomar amanhã.' }, player: { expr: 'serio' } } });
      } },
      { label: 'Continuar trabalhando', icon: '⌨️', run: (L, c) => {
        if (L.job) L.job.perf += 3; c.equipe.forEach((p: Person) => bond(p, -5)); if (c.chefe) bond(c.chefe, 3); stat(L, 'felicidade', -2);
        return O('Você entregou sua parte enquanto a equipe parava. A chefia agradeceu; seus colegas também perceberam.', 'neutro', { react: { npc: { expr: 'serio' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Propor mediação formal', icon: '📋', run: (L, c) => {
        const acordo = rng.chance(0.35 + L.stats.inteligencia / 350);
        if (acordo) { c.equipe.forEach((p: Person) => bond(p, 4)); if (c.chefe) bond(c.chefe, 2); stat(L, 'felicidade', 3); if (L.job) L.job.perf += 2; return O('A mediação marcou uma negociação com representantes. A pauta ficou maior que a mesa, mas coube.', 'bom', { react: { npc: { expr: 'feliz', say: 'Vamos levar as propostas.' } } }); }
        c.equipe.forEach((p: Person) => bond(p, -2)); if (L.job) L.job.perf -= 2; stat(L, 'felicidade', -3); return O('A mediação virou outra reunião sem decisão. A equipe esperava uma ponte; recebeu um formulário.', 'ruim', { mood: 'tenso', react: { player: { expr: 'serio' } } });
      } },
    ],
  },
  {
    id: 'homeOfficeComFamilia', min: 20, max: 65, weight: (L) => (L.job && (children(L).length > 0 || !!partner(L) || L.pets.some((p) => p.alive)) ? 6 : 0), icon: '🏠', title: 'A reunião invadiu a sala',
    setup: (L) => ({ crianca: children(L).find((p) => p.age <= 17), parceiro: partner(L), pet: L.pets.find((p) => p.alive) }),
    text: (_L, c) => c.crianca
      ? `${c.crianca.first} entrou na chamada para avisar que o almoço está pronto. O microfone estava aberto e a pauta, indefesa.`
      : c.pet
        ? `${c.pet.name} latiu durante sua apresentação. O microfone estava aberto; o cachorro, eloquente.`
        : `${c.parceiro?.first ?? 'Alguém da casa'} passou atrás da câmera com uma panela. A equipe descobriu o almoço antes de você.`,
    scene: (_L, c) => ({ id: 'trabalho', others: c.crianca ? [c.crianca] : c.parceiro ? [c.parceiro] : [], data: { titulo: 'Home office', sub: 'O microfone estava aberto.' } }),
    choices: [
      { label: 'Mutar e reorganizar a sala', icon: '🔇', run: (L, c) => {
        if (L.job) L.job.perf += 4; stat(L, 'felicidade', -2); if (c.crianca) bond(c.crianca, -1); if (c.pet) c.pet.bond = Math.max(0, c.pet.bond - 1);
        return O('Você mutou a chamada e voltou ao relatório. A casa ficou quieta por 90 segundos, novo recorde.', 'neutro', { react: { player: { expr: 'serio' } } });
      } },
      { label: 'Apresentar a família à equipe', icon: '👋', run: (L, c) => {
        const deuCerto = rng.chance(0.45 + L.stats.felicidade / 350);
        if (deuCerto) { if (L.job) L.job.perf += 2; if (c.crianca) bond(c.crianca, 4); if (c.parceiro) bond(c.parceiro, 2); if (c.pet) c.pet.bond = Math.min(100, c.pet.bond + 3); stat(L, 'felicidade', 4); return O('A equipe riu, a pauta terminou e alguém perguntou se sua família aceita vaga. Clima organizacional resolvido.', 'bom', { react: { player: { expr: 'feliz' }, npc: { expr: 'feliz', say: 'Pode aparecer mais vezes!' } } }); }
        if (L.job) L.job.perf -= 5; if (c.crianca) bond(c.crianca, -2); if (c.parceiro) bond(c.parceiro, -2); if (c.pet) c.pet.bond = Math.max(0, c.pet.bond - 2); stat(L, 'felicidade', -4);
        return O('A chefia pediu para manter o foco. A família saiu da chamada; o climão ficou até o almoço.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Vamos voltar à pauta.' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Encerrar e cuidar da casa', icon: '🍲', run: (L, c) => {
        if (L.job) L.job.perf -= 3; if (c.crianca) bond(c.crianca, 6); if (c.parceiro) bond(c.parceiro, 4); stat(L, 'felicidade', 3); stat(L, 'saude', 1);
        return O('Você encerrou a chamada e foi almoçar com a família. O prazo ficou para depois; a comida, não.', 'bom', { mood: 'feliz', react: { player: { expr: 'feliz' } } });
      } },
    ],
  },
  {
    id: 'amigoOcultoFirma', min: 20, max: 65, weight: (L) => (L.job && L.people.some((p) => p.alive && p.rel === 'colegaTrab') ? 4 : 0), icon: '🎁', title: 'Amigo oculto do trabalho',
    setup: (L) => ({ person: pickRandom(L.people.filter((p) => p.alive && p.rel === 'colegaTrab')), n: rng.pick([80, 120, 160]) }),
    text: (_L, c) => `No sorteio da firma, você tirou ${c.person!.first}. O limite é ${money(c.n!)} e a lista de sugestões diz “qualquer coisa”.`,
    scene: (L, c) => ({ id: 'festaFirma', others: [c.person!, ...L.people.filter((p) => p.alive && p.rel === 'colegaTrab' && p !== c.person).slice(0, 2)] }),
    choices: [
      { label: 'Comprar algo da lista', icon: '🛍️', cond: (L, c) => L.money >= c.n!, run: (L, c) => {
        L.money -= c.n!; bond(c.person!, 7); stat(L, 'felicidade', 3);
        return O(`${c.person!.first} gostou do presente de ${money(c.n!)}. A lista dizia “qualquer coisa”, mas havia avaliação por estrelas.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Era exatamente o que eu queria!' } } });
      } },
      { label: 'Presentear com um livro usado', icon: '📚', run: (L, c) => {
        const agradou = rng.chance(0.35 + c.person!.bond / 300);
        if (agradou) { bond(c.person!, 4); stat(L, 'felicidade', 2); return O(`${c.person!.first} gostou do livro. Você explicou que as anotações são “conteúdo extra”.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Vou ler com calma!' } } }); }
        bond(c.person!, -4); stat(L, 'felicidade', -2); return O(`${c.person!.first} agradeceu e perguntou se o recibo também era usado. O embrulho ficou ótimo.`, 'neutro', { react: { npc: { expr: 'serio' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Levar lanche para a equipe', icon: '🍰', cond: (L) => L.money >= 60, run: (L, c) => {
        L.money -= 60; L.people.filter((p) => p.alive && p.rel === 'colegaTrab').forEach((p) => bond(p, 2)); bond(c.person!, 3); stat(L, 'felicidade', 4);
        return O('O bolo acabou antes do sorteio. O amigo oculto continua oculto; a fome, resolvida.', 'bom', { react: { npc: { expr: 'feliz', say: 'Quem trouxe bolo merece promoção.' } } });
      } },
    ],
  },
  {
    id: 'festaJuninaEscola', min: 7, max: 16, weight: 7, icon: '🎏', title: 'Festa junina da escola',
    text: () => 'A escola montou barracas, pescaria e uma quadrilha. O microfone anunciou que o casamento caipira tem roteiro; ninguém viu o roteiro.',
    scene: () => ({ id: 'aula', data: { good: true } }),
    choices: [
      { label: 'Dançar na quadrilha', icon: '💃', run: (L) => {
        const acertou = rng.chance(0.45 + L.stats.felicidade / 300);
        if (acertou) { stat(L, 'felicidade', 8); parents(L).forEach((p) => bond(p, 2)); return O('Você acertou a troca de pares e ganhou aplausos. A professora chamou de tradição; seus pés chamaram de surpresa.', 'bom', { scene: { id: 'aula', data: { good: true } }, react: { player: { motion: 'dancar', expr: 'feliz' } } }); }
        stat(L, 'felicidade', 3); return O('Você errou a formação, mas inventou um passo novo. A coreografia oficial fingiu que era parte do plano.', 'neutro', { react: { player: { expr: 'envergonhado' } } });
      } },
      { label: 'Tentar a pescaria', icon: '🎣', run: (L) => {
        const ganhou = rng.chance(0.5); stat(L, 'felicidade', ganhou ? 5 : 2);
        return ganhou ? O('Você pescou um prêmio. A vara era curta, o prêmio também, mas a vitória foi sua.', 'bom') : O('A pescaria não rendeu. Você ganhou um barbante molhado e uma história para o caminho de casa.', 'neutro');
      } },
      { label: 'Ajudar na barraca', icon: '🧁', run: (L) => { stat(L, 'inteligencia', 2); stat(L, 'felicidade', 4); L.karma += 2; return O('Você ajudou a organizar a barraca e ganhou um doce. Trabalho voluntário: pagamento em açúcar.', 'bom'); } },
    ],
  },
  {
    id: 'boletimEscondido', min: 10, max: 17, weight: (L) => (L.edu.nota < 55 && parents(L).length > 0 ? 6 : 0), once: true,
    cond: (L) => L.edu.nota < 55 && parents(L).length > 0,
    setup: (L) => ({ person: pickRandom(parents(L)) }), icon: '📬', title: 'O boletim sumiu',
    text: (_L, c) => `O boletim chegou com duas notas baixas. ${c.person!.first} ainda não viu; sua mochila ganhou um compartimento secreto.`,
    scene: () => ({ id: 'aula', data: { good: false } }),
    choices: [
      { label: 'Contar antes que descubram', icon: '🗣️', run: (L, c) => { bond(c.person!, 4); L.karma += 3; stat(L, 'felicidade', -2); return O(`${c.person!.first} ficou preocupado(a), mas ouviu você. A conversa foi difícil; o boletim continuou sendo papel.`, 'neutro', { scene: { id: 'brigaFamilia', others: [c.person!] }, react: { npc: { expr: 'serio', say: 'Vamos montar um plano.' }, player: { expr: 'serio' } } }); } },
      { label: 'Esconder e estudar para recuperar', icon: '📚', run: (L) => { L.flags.boletimEscondidoIdade = L.player.age; stat(L, 'felicidade', 1); stat(L, 'saude', -1); return O('Você guardou o boletim e abriu o caderno. A ansiedade ficou estudando junto.', 'neutro', { react: { player: { expr: 'serio' } } }); } },
      { label: 'Pedir ajuda para estudar', icon: '✏️', run: (L, c) => {
        const passou = rng.chance(0.4 + L.stats.inteligencia / 300); L.edu.nota += passou ? 8 : 3; stat(L, 'saude', -2);
        if (passou) { bond(c.person!, 3); L.karma += 1; return O(`${c.person!.first} ajudou a revisar e sua nota subiu. O caderno recebeu mais atenção que o grupo da turma.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Você conseguiu melhorar.' } } }); }
        bond(c.person!, -2); return O('Vocês estudaram, mas a prova veio com assunto de outro planeta. Ao menos a família já sabe.', 'neutro', { mood: 'tenso', react: { npc: { expr: 'serio' }, player: { expr: 'triste' } } });
      } },
    ],
  },
  {
    id: 'paisAchamBoletim', min: 11, max: 18, weight: 7, once: true,
    cond: (L) => typeof L.flags.boletimEscondidoIdade === 'number' && L.player.age - (L.flags.boletimEscondidoIdade as number) >= 1 && parents(L).length > 0,
    setup: (L) => ({ person: pickRandom(parents(L)) }), icon: '🔍', title: 'A mochila foi organizada',
    text: (_L, c) => `${c.person!.first} encontrou o boletim escondido. A mochila foi organizada; a conversa também vai ser.`,
    scene: (L, c) => ({ id: 'brigaFamilia', others: [c.person!] }),
    choices: [
      { label: 'Explicar o que aconteceu', icon: '💬', run: (L, c) => { delete L.flags.boletimEscondidoIdade; bond(c.person!, 2); L.karma += 2; stat(L, 'felicidade', -3); return O('Você contou a verdade e combinou de pedir ajuda antes da próxima prova. O castigo virou calendário de estudos.', 'neutro', { react: { npc: { expr: 'serio', say: 'Vamos resolver juntos.' }, player: { expr: 'serio' } } }); } },
      { label: 'Mostrar que a nota melhorou', icon: '📈', run: (L, c) => {
        const melhorou = rng.chance(0.35 + L.stats.inteligencia / 300); delete L.flags.boletimEscondidoIdade;
        if (melhorou) { L.edu.nota += 5; bond(c.person!, 3); stat(L, 'felicidade', 4); return O(`${c.person!.first} viu a melhora e suspendeu o castigo. O boletim ganhou uma continuação menos dramática.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Você está se esforçando.' }, player: { expr: 'feliz' } } }); }
        bond(c.person!, -8); L.flags.infracoes = ((L.flags.infracoes as number) ?? 0) + 1; stat(L, 'felicidade', -7); return O('A nota ainda estava baixa. Seus pais chamaram a escola e a mochila perdeu o direito à privacidade.', 'ruim', { scene: { id: 'detencao', data: { frase: 'Não esconder o boletim' } }, mood: 'triste', react: { npc: { expr: 'bravo', say: 'A gente precisava saber.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Aceitar o castigo', icon: '⏳', run: (L, c) => { delete L.flags.boletimEscondidoIdade; bond(c.person!, -2); stat(L, 'felicidade', -4); return O('Você entregou o videogame por uma semana. O boletim ficou na mesa, sob vigilância.', 'ruim', { mood: 'triste', react: { player: { expr: 'triste' } } }); } },
    ],
  },
  {
    id: 'feiraCienciasEscolar', min: 9, max: 16, weight: 5, icon: '🌋', title: 'Feira de ciências',
    text: () => 'Seu modelo de vulcão está pronto para a demonstração. A diretora sentou na primeira fila e a toalha da mesa pediu transferência.',
    scene: () => ({ id: 'aula', data: { good: true } }),
    choices: [
      { label: 'Apresentar a demonstração', icon: '🧪', run: (L) => {
        const deuCerto = rng.chance(0.4 + L.stats.inteligencia / 300);
        if (deuCerto) { L.edu.nota += 5; stat(L, 'inteligencia', 4); stat(L, 'felicidade', 8); L.karma += 1; return O('O vulcão transbordou na bandeja e os jurados adoraram. Você ganhou um certificado e uma toalha da escola.', 'bom', { scene: { id: 'aula', data: { good: true } }, react: { player: { expr: 'feliz' } } }); }
        L.edu.nota -= 3; L.flags.infracoes = ((L.flags.infracoes as number) ?? 0) + 1; parents(L).forEach((p) => bond(p, -2)); stat(L, 'felicidade', -5);
        return O('O modelo transbordou antes da explicação. Você ficou na detenção para limpar a mesa; a diretora levou o certificado.', 'ruim', { scene: { id: 'detencao', data: { frase: 'Vou testar o projeto antes da feira' } }, mood: 'triste', react: { player: { expr: 'envergonhado' } } });
      } },
      { label: 'Explicar o projeto sem demonstração', icon: '🗣️', run: (L) => { L.edu.nota += 3; stat(L, 'inteligencia', 3); stat(L, 'felicidade', 2); return O('Você explicou o modelo com calma e respondeu às perguntas. Nenhuma toalha precisou depor.', 'bom', { react: { player: { expr: 'determinado' } } }); } },
      { label: 'Ajudar outra equipe a arrumar', icon: '🧹', run: (L) => { L.karma += 3; stat(L, 'felicidade', 4); stat(L, 'inteligencia', 1); return O('Você ajudou a outra equipe a montar a mesa. O projeto deles ganhou menção honrosa; você ganhou um doce.', 'bom'); } },
    ],
  },
  {
    id: 'excursaoEscolar', min: 8, max: 16, weight: 5, icon: '🚌', title: 'Excursão da escola',
    setup: () => ({ destino: rng.pick(['museu de ciências', 'zoológico municipal', 'aquário da cidade']) }),
    text: (_L, c) => `A turma vai visitar o ${c.destino}. A professora pediu para ninguém se afastar; o mapa da turma já tem cara de desafio.`,
    scene: (_L, c) => ({ id: 'viagem', data: { titulo: 'Excursão escolar', destino: c.destino } }),
    choices: [
      { label: 'Ficar junto da turma', icon: '👫', run: (L) => { stat(L, 'felicidade', 4); stat(L, 'inteligencia', 1); parents(L).forEach((p) => bond(p, 1)); return O('Você viu todas as exposições com a turma e voltou no ônibus certo. A professora conferiu a lista três vezes.', 'bom', { react: { player: { expr: 'feliz' } } }); } },
      { label: 'Ver mais uma exposição', icon: '🔎', run: (L, c) => {
        const achou = rng.chance(0.35 + L.stats.inteligencia / 350);
        if (achou) { stat(L, 'inteligencia', 4); stat(L, 'felicidade', 3); return O(`Você voltou a tempo e contou à turma o que viu no ${c.destino}. A professora fingiu que não contou os minutos.`, 'bom', { react: { player: { expr: 'feliz' } } }); }
        stat(L, 'felicidade', -6); parents(L).forEach((p) => bond(p, -2)); return O('Você se afastou e perdeu o grupo por alguns minutos. A professora achou você; sua paz, ainda não.', 'ruim', { scene: { id: 'telefonema', data: { fala: 'Já encontramos. Estamos voltando ao ônibus.', good: true } }, mood: 'tenso', react: { player: { expr: 'envergonhado' } } });
      } },
      { label: 'Sentar na frente do ônibus', icon: '💺', run: (L) => {
        const bem = rng.chance(0.45 + L.stats.saude / 300);
        if (bem) { stat(L, 'saude', 1); stat(L, 'felicidade', 3); return O('A viagem foi tranquila e você não enjoou. O assento da frente ganhou status de patrimônio histórico.', 'bom'); }
        stat(L, 'saude', -3); stat(L, 'felicidade', -4); return O('O ônibus fez 11 curvas e seu estômago abriu um protocolo. A paisagem foi bonita quando você olhou.', 'ruim', { mood: 'triste', react: { player: { expr: 'triste' } } });
      } },
    ],
  },
  {
    id: 'trabalhoGrupoSozinho', min: 9, max: 17, weight: 6, icon: '📚', title: 'Trabalho em grupo',
    setup: (L) => ({ colegas: [makePerson(rng, { age: L.player.age, rel: 'colega', bond: rng.int(30, 55) }), makePerson(rng, { age: L.player.age, rel: 'colega', bond: rng.int(30, 55) })] }),
    text: (_L, c) => `O grupo tem três integrantes e você fez quase tudo. ${c.colegas[0].first} perguntou se a capa já estava pronta.`,
    scene: (_L, c) => ({ id: 'aula', others: c.colegas }),
    choices: [
      { label: 'Fazer o resto do trabalho', icon: '🖊️', run: (L, c) => {
        c.colegas.forEach((p: Person) => { if (!L.people.some((x) => x.id === p.id)) L.people.push(p); bond(p, -6); }); L.edu.nota += 10; stat(L, 'inteligencia', 4); stat(L, 'saude', -3); stat(L, 'felicidade', -3);
        return O('Você terminou o cartaz, a pesquisa e as conclusões. O grupo apareceu para a foto segurando sua nota.', 'neutro', { react: { player: { motion: 'escreverQuadro', expr: 'serio' }, npc: { expr: 'feliz', say: 'Ficou muito bom!' } } });
      } },
      { label: 'Dividir as tarefas de verdade', icon: '🗂️', run: (L, c) => {
        c.colegas.forEach((p: Person) => { if (!L.people.some((x) => x.id === p.id)) L.people.push(p); }); const deuCerto = rng.chance(0.35 + L.stats.inteligencia / 250);
        if (deuCerto) { L.edu.nota += 8; c.colegas.forEach((p: Person) => bond(p, 6)); stat(L, 'felicidade', 5); return O('Cada pessoa entregou sua parte a tempo. O trabalho em grupo funcionou; a professora pediu para registrar a data.', 'bom', { react: { npc: { expr: 'feliz', say: 'A gente conseguiu!' } } }); }
        L.edu.nota -= 3; c.colegas.forEach((p: Person) => bond(p, -5)); stat(L, 'felicidade', -4); return O('Duas partes chegaram em branco e uma tinha outro tema. O grupo ficou unido na culpa.', 'ruim', { mood: 'tenso', react: { player: { expr: 'envergonhado' }, npc: { expr: 'serio' } } });
      } },
      { label: 'Pedir ajuda à professora', icon: '🧑‍🏫', run: (L, c) => {
        c.colegas.forEach((p: Person) => { if (!L.people.some((x) => x.id === p.id)) L.people.push(p); bond(p, -2); }); const mediou = rng.chance(0.55);
        if (mediou) { L.edu.nota += 5; stat(L, 'felicidade', 2); L.karma += 2; return O('A professora redistribuiu as tarefas e deixou claro quem entregaria cada parte. A capa também ganhou dois autores.', 'bom', { react: { npc: { expr: 'serio', say: 'Cada um assume uma parte.' } } }); }
        L.edu.nota -= 2; stat(L, 'felicidade', -3); return O('A professora pediu para tentarem resolver entre vocês. O grupo marcou outra conversa para não resolver.', 'neutro', { mood: 'tenso' });
      } },
    ],
  },
  {
    id: 'primeiroCelular', min: 11, max: 17, weight: 4, once: true, icon: '📱', title: 'Seu primeiro celular',
    text: () => 'Você ganhou um celular. A família combinou regras de uso; a tela já ofereceu 38 maneiras de ignorá-las.',
    scene: () => ({ id: 'aula', data: { good: true } }),
    choices: [
      { label: 'Combinar horários com a família', icon: '⏰', run: (L) => { parents(L).forEach((p) => bond(p, 4)); stat(L, 'inteligencia', 2); stat(L, 'felicidade', 5); return O('Vocês combinaram horários e pausas. O celular aceitou em silêncio, como todo aparelho sem opinião.', 'bom', { react: { player: { expr: 'feliz' } } }); } },
      { label: 'Instalar jogos e virar a noite', icon: '🎮', run: (L) => { L.edu.nota -= 6; stat(L, 'felicidade', 8); stat(L, 'saude', -4); parents(L).forEach((p) => bond(p, -5)); return O('Você jogou até tarde e faltou energia na primeira aula. O celular estava em 100%; você, nem perto.', 'ruim', { scene: { id: 'aula', data: { good: false } }, mood: 'triste', react: { player: { expr: 'cansado' } } }); } },
      { label: 'Deixar o aparelho guardado', icon: '🔕', run: (L) => { L.edu.nota += 3; stat(L, 'felicidade', -2); stat(L, 'saude', 2); return O('Você guardou o celular durante a semana. As notificações acumularam; a prova, não.', 'neutro', { react: { player: { expr: 'serio' } } }); } },
    ],
  },
  {
    id: 'cachorroComeuDever', min: 7, max: 15, weight: 5, icon: '🐶', title: 'O cachorro comeu o dever',
    setup: (L) => ({ pet: L.pets.find((p) => p.alive && p.kind === 'cachorro') }),
    text: (_L, c) => `Seu dever sumiu. Você pensa em dizer que o cachorro comeu, mas a professora pediu uma foto do suspeito.` ,
    scene: () => ({ id: 'aula', data: { good: false } }),
    choices: [
      { label: 'Culpar o cachorro', icon: '🐾', run: (L, c) => {
        const desculpa = c.pet ? rng.chance(0.55) : false;
        if (desculpa) { stat(L, 'felicidade', 3); L.karma -= 2; return O(`${c.pet!.name} apareceu numa foto dormindo ao lado do caderno. A professora aceitou; o cachorro não comentou.`, 'neutro', { react: { player: { expr: 'convencido' } } }); }
        L.edu.nota -= 3; L.flags.infracoes = ((L.flags.infracoes as number) ?? 0) + 1; parents(L).forEach((p) => bond(p, -3)); stat(L, 'felicidade', -5);
        return O(`${c.pet ? 'A foto não provou nada' : 'A professora perguntou o nome do cachorro e você não tinha um'}; veio detenção e seus pais foram chamados.`, 'ruim', { scene: { id: 'detencao', data: { frase: 'Não inventar desculpas para o dever' } }, mood: 'triste', react: { player: { expr: 'envergonhado' } } });
      } },
      { label: 'Contar a verdade e pedir prazo', icon: '🗣️', run: (L) => {
        const aceitou = rng.chance(0.45 + L.stats.inteligencia / 300);
        if (aceitou) { L.edu.nota += 2; L.karma += 3; stat(L, 'felicidade', 2); return O('A professora deu mais um dia para entregar. Honestidade ganhou prazo; o dever continua existindo.', 'bom', { react: { npc: { expr: 'serio', say: 'Entregue amanhã, sem falta.' } } }); }
        L.edu.nota -= 2; parents(L).forEach((p) => bond(p, -2)); stat(L, 'felicidade', -3); return O('A professora pediu que seus pais acompanhassem a tarefa. A mochila virou projeto de transparência.', 'neutro', { scene: { id: 'brigaFamilia', others: parents(L).slice(0, 1) }, mood: 'tenso' });
      } },
      { label: 'Fazer o dever no recreio', icon: '✏️', run: (L) => { L.edu.nota += 3; stat(L, 'saude', -1); stat(L, 'felicidade', -2); return O('Você terminou no recreio e perdeu metade do lanche. A desculpa teria dado menos trabalho, mas não menos pergunta.', 'neutro'); } },
    ],
  },
  {
    id: 'ceiaNatal', min: 18, max: 100, weight: 5, icon: '🎄', title: 'Ceia de Natal',
    setup: (L) => ({ familia: [...parents(L), ...byRel(L, 'irmao', 'irma', 'avo', 'avoM'), ...(partner(L) ? [partner(L)!] : []), ...children(L)].slice(0, 4) }),
    text: () => 'A ceia estava tranquila até alguém perguntar sobre política. O assunto virou genérico, a voz subiu e o pavê pediu distância.',
    scene: (L, c) => ({ id: 'churrasco', others: c.familia }),
    choices: [
      { label: 'Mudar o assunto para a sobremesa', icon: '🍰', run: (L, c) => { c.familia.forEach((p: Person) => bond(p, 3)); stat(L, 'felicidade', 4); return O('Você perguntou quem trouxe o pavê. A mesa voltou a discutir algo que ninguém quer dividir: a última fatia.', 'bom', { react: { npc: { expr: 'feliz', say: 'Eu trouxe, pode pegar.' } } }); } },
      { label: 'Entrar na discussão', icon: '🗣️', run: (L, c) => {
        const acalmou = rng.chance(0.3 + L.stats.inteligencia / 300);
        if (acalmou) { c.familia.forEach((p: Person) => bond(p, 1)); stat(L, 'felicidade', 2); return O('Você conseguiu levar a conversa para outro tema. A família mudou para futebol e se sentiu em terreno seguro.', 'neutro', { react: { player: { expr: 'serio' } } }); }
        c.familia.forEach((p: Person) => bond(p, -4)); stat(L, 'felicidade', -6); return O('A discussão durou até a sobremesa. O peru esfriou; as opiniões, não.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'bravo' }, player: { expr: 'serio' } } });
      } },
      { label: 'Propor um jogo de cartas', icon: '🃏', run: (L, c) => { c.familia.forEach((p: Person) => bond(p, 2)); L.karma += 1; stat(L, 'felicidade', 3); return O('As cartas foram para a mesa e a discussão perdeu a vez. Agora a família briga por quem embaralhou errado.', 'bom'); } },
    ],
  },
  {
    id: 'tiaPerguntaNamoro', min: 25, max: 85, weight: 5, icon: '💌', title: 'E o namoro?',
    cond: (L) => !partner(L),
    setup: () => ({ person: makePerson(rng, { sex: 'f', age: rng.int(45, 75), rel: 'conhecido', bond: 45 }) }),
    text: (_L, c) => `${c.person!.first}, sua tia por consideração, perguntou pela terceira vez se você está namorando. O prato de salada já respondeu por você.`,
    scene: (_L, c) => ({ id: 'churrasco', others: [c.person!] }),
    choices: [
      { label: 'Responder com sinceridade', icon: '💬', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 2); stat(L, 'felicidade', 2); return O('Você disse que está bem assim. Sua tia ouviu e serviu mais salada, prova de que entendeu metade.', 'bom', { react: { npc: { expr: 'feliz', say: 'O importante é você estar bem.' } } }); } },
      { label: 'Dizer que está conhecendo alguém', icon: '🤫', run: (L, c) => {
        L.people.push(c.person!); const acreditou = rng.chance(0.4 + L.stats.inteligencia / 350);
        if (acreditou) { bond(c.person!, 1); stat(L, 'felicidade', 2); return O('Sua tia acreditou e pediu detalhes. Você ganhou tempo; a família abriu uma sindicância.', 'neutro', { react: { npc: { expr: 'feliz', say: 'Quando vamos conhecer?' } } }); }
        bond(c.person!, -3); stat(L, 'felicidade', -3); return O('Ela percebeu a história e ofereceu ajuda para encontrar alguém. O plano ficou mais sério que a mentira.', 'ruim', { react: { npc: { expr: 'serio', say: 'Eu conheço uma pessoa.' }, player: { expr: 'envergonhado' } } });
      } },
      { label: 'Perguntar como ela está', icon: '☕', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 5); stat(L, 'felicidade', 3); return O('Sua tia contou novidades por 20 minutos. Pela primeira vez, a pergunta veio com resposta dos dois lados.', 'bom', { react: { npc: { expr: 'feliz', say: 'Agora você quer saber de mim?' } } }); } },
    ],
  },
  {
    id: 'sograMoraJunto', min: 22, max: 80, weight: (L) => (spouse(L) ? 4 : 0), once: true, icon: '🧳', title: 'Visita sem data de volta',
    cond: (L) => !!spouse(L),
    setup: (L) => { const parceiro = spouse(L); if (!parceiro) return null; const sex = rng.chance(0.5) ? 'f' : 'm'; return { person: makePerson(rng, { sex, age: rng.int(50, 78), rel: 'conhecido', bond: 45 }), parceiro, tipo: sex === 'f' ? 'mãe' : 'pai' }; },
    text: (_L, c) => `${c.tipo === 'mãe' ? 'A mãe' : 'O pai'} de ${c.parceiro!.first}, ${c.person!.first}, veio passar uns dias enquanto a casa passa por obra. A mala veio com endereço fixo.`,
    scene: (_L, c) => ({ id: 'interacao', others: [c.parceiro!, c.person!], data: { action: 'conversar', env: 'sala' } }),
    choices: [
      { label: 'Deixar ficar até a obra acabar', icon: '🏠', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 6); bond(c.parceiro!, 4); stat(L, 'felicidade', -3); return O('Você abriu espaço no armário. A obra não tinha previsão, mas a mala já tinha prateleira.', 'neutro', { react: { npc: { expr: 'feliz', say: 'Não vou atrapalhar.' }, player: { expr: 'serio' } } }); } },
      { label: 'Combinar uma data para a mudança', icon: '📅', run: (L, c) => {
        L.people.push(c.person!); const aceitou = rng.chance(0.4 + L.stats.inteligencia / 300);
        if (aceitou) { bond(c.person!, 2); bond(c.parceiro!, 3); stat(L, 'felicidade', 3); return O('Vocês marcaram uma data e dividiram as tarefas. A reforma finalmente ganhou calendário e testemunhas.', 'bom', { react: { npc: { expr: 'serio', say: 'Combinado. Vou me organizar.' } } }); }
        bond(c.person!, -4); bond(c.parceiro!, -3); stat(L, 'felicidade', -5); return O('A conversa virou discussão sobre quem escolheu o piso. A data da mudança não foi encontrada.', 'ruim', { mood: 'tenso', react: { npc: { expr: 'bravo', say: 'A obra ainda não terminou.' }, player: { expr: 'serio' } } });
      } },
      { label: 'Dividir as tarefas da casa', icon: '🧹', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 3); bond(c.parceiro!, 2); stat(L, 'saude', -1); stat(L, 'felicidade', 2); return O('A visita ajudou com as tarefas. Você aprendeu que a louça também pode ser diplomacia.', 'bom', { react: { npc: { expr: 'feliz', say: 'Assim fica mais fácil.' } } }); } },
    ],
  },
  {
    id: 'irmaoPedeEmprestado', min: 18, max: 90, weight: (L) => (byRel(L, 'irmao', 'irma').length && !L.flags.irmaoEmprestimoPessoaId ? 5 : 0), icon: '💸', title: 'Empréstimo entre irmãos',
    cond: (L) => byRel(L, 'irmao', 'irma').length > 0 && !L.flags.irmaoEmprestimoPessoaId,
    setup: (L) => { const person = pickRandom(byRel(L, 'irmao', 'irma')); return person ? { person, n: rng.int(2, 8) * 500 } : null; },
    text: (_L, c) => `${c.person!.first} pediu ${money(c.n!)} emprestado “só até o mês que vem”. O mês não especificou o ano.`,
    choices: [
      { label: 'Emprestar o dinheiro', icon: '🤝', cond: (L, c) => L.money >= c.n!, run: (L, c) => { L.money -= c.n!; bond(c.person!, 6); L.karma += 2; L.flags.irmaoEmprestimoPessoaId = c.person!.id; L.flags.irmaoEmprestimoIdade = L.player.age; L.flags.irmaoEmprestimoValor = c.n!; return O(`Você emprestou ${money(c.n!)}. Seu irmão agradeceu muito; o calendário ficou de fora da conversa.`, 'neutro', { react: { npc: { expr: 'feliz', say: 'No mês que vem eu devolvo.' } } }); } },
      { label: 'Negar com carinho', icon: '🫶', run: (L, c) => { bond(c.person!, -3); stat(L, 'felicidade', -1); return O(`${c.person!.first} entendeu, mas ficou chateado(a). O limite do cartão agradeceu em silêncio.`, 'neutro', { react: { npc: { expr: 'triste', say: 'Tudo bem, eu dou um jeito.' } } }); } },
      { label: 'Ajudar com uma parte', icon: '🪙', cond: (L) => L.money >= 500, run: (L, c) => { const v = Math.min(500, Math.round(c.n! / 2)); L.money -= v; bond(c.person!, 3); L.karma += 1; stat(L, 'felicidade', 2); return O(`Você ajudou com ${money(v)}. O resto ficou para o mês que ainda não tem nome.`, 'bom'); } },
    ],
  },
  {
    id: 'irmaoNaoDevolve', min: 19, max: 100, weight: 7, once: true,
    cond: (L) => typeof L.flags.irmaoEmprestimoIdade === 'number' && L.player.age - (L.flags.irmaoEmprestimoIdade as number) >= 1 && !!L.people.find((p) => p.id === L.flags.irmaoEmprestimoPessoaId && p.alive),
    setup: (L) => { const person = L.people.find((p) => p.id === L.flags.irmaoEmprestimoPessoaId && p.alive); return person ? { person, n: L.flags.irmaoEmprestimoValor as number } : null; },
    icon: '📆', title: 'O mês que vem chegou',
    text: (_L, c) => `${c.person!.first} ainda não devolveu ${money(c.n!)}. O mês que vem já completou aniversário.`,
    choices: [
      { label: 'Cobrar com calma', icon: '💬', run: (L, c) => {
        const pagou = rng.chance(0.25 + c.person!.bond / 300); delete L.flags.irmaoEmprestimoPessoaId; delete L.flags.irmaoEmprestimoIdade; delete L.flags.irmaoEmprestimoValor;
        if (pagou) { L.money += c.n!; bond(c.person!, 1); stat(L, 'felicidade', 3); return O(`${c.person!.first} devolveu ${money(c.n!)}. Você recebeu o dinheiro e um áudio de seis minutos explicando o atraso.`, 'bom', { react: { npc: { expr: 'serio', say: 'Demorei, mas paguei.' } } }); }
        bond(c.person!, -6); stat(L, 'felicidade', -4); return O(`${c.person!.first} prometeu pagar depois. O empréstimo agora tem juros de ressentimento.`, 'ruim', { mood: 'tenso', react: { npc: { expr: 'serio', say: 'Assim que eu puder.' }, player: { expr: 'serio' } } });
      } },
      { label: 'Perdoar a dívida', icon: '🕊️', run: (L, c) => { delete L.flags.irmaoEmprestimoPessoaId; delete L.flags.irmaoEmprestimoIdade; delete L.flags.irmaoEmprestimoValor; bond(c.person!, 4); L.karma += 2; stat(L, 'felicidade', -2); return O('Você decidiu não cobrar. A relação ganhou paz; seu extrato, uma memória.', 'neutro'); } },
      { label: 'Propor pagamento em partes', icon: '🧾', run: (L, c) => {
        const aceitou = rng.chance(0.4 + L.stats.inteligencia / 350); delete L.flags.irmaoEmprestimoPessoaId; delete L.flags.irmaoEmprestimoIdade; delete L.flags.irmaoEmprestimoValor;
        if (aceitou) { const valor = Math.round(c.n! / 2); L.money += valor; bond(c.person!, 2); stat(L, 'felicidade', 2); return O(`${c.person!.first} pagou ${money(valor)} e combinou o resto depois. O calendário recebeu um mês desta vez.`, 'bom'); }
        bond(c.person!, -7); stat(L, 'felicidade', -4); return O(`${c.person!.first} recusou o acordo. O assunto virou tabu com comprovante.`, 'ruim', { mood: 'triste' });
      } },
    ],
  },
  {
    id: 'herancaBriga', min: 18, max: 100, weight: 5, once: true,
    cond: (L) => L.people.some((p) => !p.alive && (p.rel === 'mae' || p.rel === 'pai')) && byRel(L, 'irmao', 'irma').length > 0,
    setup: (L) => { const falecido = L.people.find((p) => !p.alive && (p.rel === 'mae' || p.rel === 'pai')); const irmaos = byRel(L, 'irmao', 'irma'); return falecido && irmaos.length ? { falecido, irmaos, n: rng.int(10, 40) * 1000 } : null; },
    icon: '⚖️', title: 'A herança virou pauta',
    text: (_L, c) => `Após a morte de ${c.falecido!.first}, apareceram documentos de uma conta de ${money(c.n!)} que ficou fora da divisão inicial. Cada irmão tem uma versão.`,
    scene: (L, c) => ({ id: 'brigaFamilia', others: c.irmaos.slice(0, 3), data: { titulo: 'Divisão da herança' } }),
    choices: [
      { label: 'Dividir entre todos', icon: '🤝', run: (L, c) => {
        const parte = Math.round(c.n! / (c.irmaos.length + 1)); L.money += parte; c.irmaos.forEach((p: Person) => bond(p, 6)); L.karma += 3; stat(L, 'felicidade', -2);
        return O(`Você recebeu ${money(parte)} e propôs encerrar a disputa. A família concordou por escrito, uma raridade maior que a herança.`, 'neutro', { react: { npc: { expr: 'serio', say: 'Vamos dividir igualmente.' } } });
      } },
      { label: 'Disputar a divisão na Justiça', icon: '📑', run: (L, c) => {
        const venceu = rng.chance(0.3 + L.stats.inteligencia / 300);
        if (venceu) { const parte = Math.round(c.n! * 0.6); L.money += parte; c.irmaos.forEach((p: Person) => bond(p, -7)); stat(L, 'felicidade', 2); return O(`A decisão destinou ${money(parte)} a você. O processo terminou; o grupo da família, não.`, 'neutro', { react: { npc: { expr: 'serio' }, player: { expr: 'serio' } } }); }
        L.money -= Math.min(L.money, 2500); c.irmaos.forEach((p: Person) => bond(p, -10)); stat(L, 'felicidade', -8); return O('A divisão ficou como estava e vieram custos do processo. A família agora discute também quem guarda os recibos.', 'ruim', { mood: 'triste', react: { player: { expr: 'triste' } } });
      } },
      { label: 'Abrir mão para evitar a briga', icon: '🕊️', run: (L, c) => { c.irmaos.forEach((p: Person) => bond(p, 5)); L.karma += 4; stat(L, 'felicidade', -3); return O('Você abriu mão da parte e preservou algum espaço para conversar. O cartório não contabiliza paz, infelizmente.', 'neutro', { react: { player: { expr: 'serio' } } }); } },
    ],
  },
  {
    id: 'velorioCoxinha', min: 18, max: 100, weight: 3, once: true,
    cond: (L) => L.people.some((p) => !p.alive && ['mae', 'pai', 'avo', 'avoM'].includes(p.rel)),
    setup: (L) => { const falecido = L.people.find((p) => !p.alive && ['mae', 'pai', 'avo', 'avoM'].includes(p.rel)); return falecido ? { falecido, familia: [...children(L), ...byRel(L, 'irmao', 'irma'), ...(partner(L) ? [partner(L)!] : [])].slice(0, 3) } : null; },
    icon: '🕯️', title: 'Velório e coxinha',
    text: (_L, c) => `No velório de ${c.falecido!.first}, a mesa tem café e coxinha. Um parente que não aparecia há anos chegou perguntando onde fica o guardanapo.`,
    scene: (L, c) => ({ id: 'funeral', others: c.familia, data: { nome: c.falecido!.first, sub: 'Despedida da família' } }),
    choices: [
      { label: 'Apoiar quem está de luto', icon: '🫂', run: (L, c) => { c.familia.forEach((p: Person) => bond(p, 6)); L.karma += 3; stat(L, 'felicidade', -5); return O('Você ficou ao lado da família e ajudou a receber quem chegou. A presença valeu mais que qualquer frase pronta.', 'neutro', { mood: 'triste', react: { player: { expr: 'triste' }, npc: { expr: 'triste' } } }); } },
      { label: 'Conversar com o parente distante', icon: '☕', run: (L, c) => { c.familia.forEach((p: Person) => bond(p, 1)); stat(L, 'felicidade', -3); return O('O parente contou histórias antigas e prometeu visitar. A promessa ganhou endereço; só falta a data.', 'neutro', { mood: 'triste', react: { npc: { expr: 'serio', say: 'A gente precisa se ver mais.' } } }); } },
      { label: 'Despedir-se e ir para casa', icon: '🚪', run: (L) => { stat(L, 'felicidade', -3); stat(L, 'saude', 1); L.karma += 1; return O('Você se despediu da família e voltou para descansar. O café do velório ficou na memória e na roupa.', 'neutro', { mood: 'triste', react: { player: { expr: 'triste' } } }); } },
    ],
  },
  {
    id: 'filhoAdolescenteRebelde', min: 30, max: 80, weight: (L) => (children(L).some((p) => p.age >= 13 && p.age <= 17) ? 6 : 0), icon: '🎧', title: 'O silêncio do adolescente',
    cond: (L) => children(L).some((p) => p.age >= 13 && p.age <= 17),
    setup: (L) => { const person = pickRandom(children(L).filter((p) => p.age >= 13 && p.age <= 17)); return person ? { person, n: rng.pick([1000, 2000, 3000]) } : null; },
    text: (_L, c) => `${c.person!.first} voltou tarde, respondeu “tá tudo bem” e pediu um aparelho novo. O silêncio veio com lista de desejos.`,
    scene: (L, c) => ({ id: 'brigaFamilia', others: [c.person!] }),
    choices: [
      { label: 'Proibir saídas por uma semana', icon: '🚫', run: (L, c) => { bond(c.person!, -8); stat(L, 'felicidade', -4); return O(`${c.person!.first} bateu a porta e respeitou o castigo pelo grupo da família.`, 'ruim', { mood: 'tenso', react: { npc: { expr: 'bravo', say: 'Ninguém me escuta.' }, player: { expr: 'serio' } } }); } },
      { label: 'Perguntar o que está acontecendo', icon: '💬', run: (L, c) => {
        const abriu = rng.chance(0.3 + c.person!.bond / 300 + L.stats.inteligencia / 500);
        if (abriu) { bond(c.person!, 8); stat(L, 'felicidade', 4); L.karma += 2; return O(`${c.person!.first} contou o que estava pesando e aceitou combinar horários. A conversa não veio com manual, mas veio.`, 'bom', { react: { npc: { expr: 'triste', say: 'Valeu por perguntar.' }, player: { expr: 'serio' } } }); }
        bond(c.person!, -2); stat(L, 'felicidade', -3); return O(`${c.person!.first} respondeu “depois”. Você combinou de tentar de novo sem transformar a sala em tribunal.`, 'neutro', { mood: 'tenso', react: { npc: { expr: 'serio' }, player: { expr: 'serio' } } });
      } },
      { label: 'Comprar o que pediu', icon: '🎁', cond: (L, c) => L.money >= c.n!, run: (L, c) => { L.money -= c.n!; bond(c.person!, 6); stat(L, 'felicidade', 3); return O(`Você pagou ${money(c.n!)} pelo aparelho. O clima melhorou até a próxima atualização.`, 'neutro', { react: { npc: { expr: 'feliz', say: 'Você é demais!' } } }); } },
    ],
  },
  {
    id: 'netoSoLigaNoPix', min: 45, max: 100, weight: (L) => (typeof L.flags.netoPessoaId === 'string' ? 6 : 0),
    cond: (L) => typeof L.flags.netoPessoaId === 'string' && !!L.people.find((p) => p.id === L.flags.netoPessoaId && p.alive),
    setup: (L) => { const neto = L.people.find((p) => p.id === L.flags.netoPessoaId && p.alive); return neto ? { neto, n: rng.pick([200, 500, 1200]) } : null; },
    icon: '📲', title: 'Vô, faz um Pix?',
    text: (_L, c) => `${c.neto!.first} mandou mensagem depois de meses: “você consegue me enviar ${money(c.n!)}?”. O afeto chegou em formato de chave.`,
    choices: [
      { label: 'Mandar o Pix', icon: '💸', cond: (L, c) => L.money >= c.n!, run: (L, c) => { L.money -= c.n!; bond(c.neto!, 6); stat(L, 'felicidade', 3); return O(`${c.neto!.first} agradeceu e prometeu ligar no fim de semana. O fim de semana também não especificou o ano.`, 'bom', { react: { npc: { expr: 'feliz', say: 'Valeu, vô!' } } }); } },
      { label: 'Perguntar como está', icon: '💬', run: (L, c) => { bond(c.neto!, 4); stat(L, 'felicidade', 3); return O('Vocês conversaram por meia hora. O Pix ficou para depois; a história da escola, não.', 'bom', { scene: { id: 'interacao', others: [c.neto!], data: { action: 'conversar', env: 'sala' } }, react: { npc: { expr: 'feliz', say: 'Eu também queria conversar.' } } }); } },
      { label: 'Oferecer metade e pedir notícias', icon: '🪙', cond: (L, c) => L.money >= Math.ceil(c.n! / 2), run: (L, c) => { const v = Math.ceil(c.n! / 2); L.money -= v; bond(c.neto!, 3); stat(L, 'felicidade', 2); return O(`Você enviou ${money(v)} e pediu notícias. O neto respondeu com uma foto e um coração, nessa ordem.`, 'neutro'); } },
    ],
  },
  {
    id: 'aprenderCelularComNeto', min: 60, max: 100, weight: (L) => (typeof L.flags.netoPessoaId === 'string' ? 5 : 0), once: true,
    cond: (L) => typeof L.flags.netoPessoaId === 'string' && !!L.people.find((p) => p.id === L.flags.netoPessoaId && p.alive),
    setup: (L) => { const neto = L.people.find((p) => p.id === L.flags.netoPessoaId && p.alive); return neto ? { neto, n: rng.int(3, 15) * 1000 } : null; },
    icon: '📱', title: 'Aula de celular com o neto',
    text: (_L, c) => `${c.neto!.first} está ensinando a usar o celular. Um link promete atualizar sua conta e pede confirmação.`,
    scene: (_L, c) => ({ id: 'interacao', others: [c.neto!], data: { action: 'conversar', env: 'sala' } }),
    choices: [
      { label: 'Abrir o link', icon: '🔗', run: (L, c) => {
        const identificou = rng.chance(0.25 + L.stats.inteligencia / 300);
        if (identificou) { stat(L, 'inteligencia', 3); stat(L, 'felicidade', 2); bond(c.neto!, 3); return O('O endereço parecia estranho e você fechou a página. O neto aprovou; o telefone não pediu opinião.', 'bom', { react: { npc: { expr: 'feliz', say: 'Boa, esse link era suspeito.' } } }); }
        const perda = Math.min(L.money, c.n!); L.money -= perda; bond(c.neto!, -2); stat(L, 'felicidade', -8); return O(`A página era falsa e levou ${money(perda)}. O celular aprendeu uma lição; você pagou a matrícula.`, 'ruim', { mood: 'triste', react: { npc: { expr: 'triste', say: 'Eu devia ter conferido antes.' }, player: { expr: 'triste' } } });
      } },
      { label: 'Pedir para conferir junto', icon: '🔎', run: (L, c) => { stat(L, 'inteligencia', 4); bond(c.neto!, 5); stat(L, 'felicidade', 3); return O('Seu neto mostrou como desconfiar de pedidos inesperados e vocês praticaram com uma mensagem falsa de exemplo.', 'bom', { react: { npc: { expr: 'feliz', say: 'A gente confere junto.' } } }); } },
      { label: 'Ligar para confirmar por outro canal', icon: '📞', run: (L, c) => { L.karma += 2; stat(L, 'inteligencia', 2); stat(L, 'felicidade', 2); bond(c.neto!, 2); return O('Você confirmou por uma ligação conhecida e apagou a mensagem. A cautela não tem botão, mas funciona.', 'bom'); } },
    ],
  },
  {
    id: 'provaVidaInss', min: 60, max: 100, weight: (L) => (L.retired ? 6 : 0), once: true,
    cond: (L) => L.retired,
    icon: '🗃️', title: 'Prova de vida',
    text: () => 'Chegou a época de confirmar que você está vivo(a). O sistema pede um documento; a fila pede uma cadeira.',
    scene: () => ({ id: 'reflexao', data: { env: 'escritorio', titulo: 'Fila do INSS', sub: 'Senha 84. Chamando a 19.', motion: 'sentarCabisbaixo' } }),
    choices: [
      { label: 'Conferir os documentos antes', icon: '📂', run: (L) => {
        const completo = rng.chance(0.45 + L.stats.inteligencia / 300);
        if (completo) { stat(L, 'felicidade', 4); stat(L, 'inteligencia', 1); return O('Todos os documentos estavam certos. Você terminou antes do almoço e ainda desconfiou do sucesso.', 'bom', { react: { player: { expr: 'feliz' } } }); }
        stat(L, 'felicidade', -4); stat(L, 'saude', -2); return O('Faltou uma cópia de um documento que já estava no sistema. A fila ganhou mais uma temporada.', 'ruim', { mood: 'tenso', react: { player: { expr: 'serio' } } });
      } },
      { label: 'Ir ao balcão logo cedo', icon: '🚌', run: (L) => {
        L.money -= 80; const resolveu = rng.chance(0.55 + L.stats.inteligencia / 350);
        if (resolveu) { stat(L, 'felicidade', 5); stat(L, 'saude', -1); return O('A prova de vida foi atualizada no balcão. Você saiu às 11h com o dia inteiro pela metade.', 'bom', { react: { player: { expr: 'feliz' } } }); }
        stat(L, 'felicidade', -6); stat(L, 'saude', -3); return O('O sistema caiu quando chegou sua vez. Você perdeu R$ 80 e ganhou prática em esperar sentado(a).', 'ruim', { mood: 'triste', react: { player: { expr: 'triste' } } });
      } },
      { label: 'Deixar para a semana que vem', icon: '📆', run: (L) => { stat(L, 'felicidade', -3); stat(L, 'saude', 1); return O('Você adiou a ida e descansou hoje. O prazo continuou no calendário, sem aceitar contraproposta.', 'neutro', { mood: 'tenso' }); } },
    ],
  },
  {
    id: 'baileTerceiraIdade', min: 60, max: 100, weight: 5, icon: '🎶', title: 'Baile da terceira idade',
    setup: (L) => ({ person: makePerson(rng, { age: rng.int(60, 90), sex: rng.chance(0.5) ? 'f' : 'm', rel: 'conhecido', bond: 50 }), temParceiro: !!partner(L) }),
    text: (_L, c) => `No baile e na hidroginástica, você conheceu ${c.person!.first}. A banda toca um clássico; a turma lembra cada passo melhor que o joelho.`,
    scene: (_L, c) => ({ id: 'balada', others: [c.person!] }),
    choices: [
      { label: 'Fazer hidroginástica', icon: '🏊', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 4); stat(L, 'saude', 5); stat(L, 'felicidade', 3); return O('A aula terminou com alongamento e conversa. O corpo agradeceu; a piscina ficou com a fofoca.', 'bom', { react: { player: { expr: 'feliz' }, npc: { expr: 'feliz', say: 'Até a próxima aula!' } } }); } },
      { label: 'Convidar para dançar', icon: '💃', run: (L, c) => {
        const p = c.person!; L.people.push(p); const aproximou = rng.chance(0.3 + L.stats.felicidade / 350 + p.bond / 400);
        if (aproximou) { if (!c.temParceiro) { p.rel = p.sex === 'f' ? 'namorada' : 'namorado'; bond(p, 12); stat(L, 'felicidade', 8); return O(`${p.first} aceitou outro convite para dançar. A noite rendeu um romance e dois pedidos de música.`, 'especial', { react: { npc: { expr: 'feliz', say: 'A próxima é nossa.' }, player: { motion: 'dancar2', expr: 'feliz' } } }); } bond(p, 6); stat(L, 'felicidade', 5); return O(`${p.first} dançou com você e a turma toda entrou no refrão. A pista ficou pequena; a alegria, não.`, 'bom', { react: { npc: { expr: 'feliz' }, player: { motion: 'dancar2', expr: 'feliz' } } }); }
        bond(p, -2); stat(L, 'felicidade', -2); return O(`${p.first} preferiu descansar. Vocês ficaram conversando; a banda seguiu sem precisar de justificativa.`, 'neutro', { react: { npc: { expr: 'serio', say: 'Hoje vou só assistir.' } } });
      } },
      { label: 'Ficar para conversar', icon: '☕', run: (L, c) => { L.people.push(c.person!); bond(c.person!, 5); stat(L, 'felicidade', 4); return O('Vocês conversaram até a banda guardar os instrumentos. Ninguém perguntou a idade; perguntaram a próxima data.', 'bom', { react: { npc: { expr: 'feliz', say: 'A gente se vê semana que vem.' } } }); } },
    ],
  },
  {
    id: 'testamentoGato', min: 60, max: 100, weight: (L) => (L.pets.some((p) => p.alive && p.kind === 'gato') && (children(L).length > 0 || byRel(L, 'irmao', 'irma').length > 0 || !!partner(L)) ? 3 : 0), once: true,
    cond: (L) => L.pets.some((p) => p.alive && p.kind === 'gato') && (children(L).length > 0 || byRel(L, 'irmao', 'irma').length > 0 || !!partner(L)),
    setup: (L) => { const pet = L.pets.find((p) => p.alive && p.kind === 'gato'); const familia = [...children(L), ...byRel(L, 'irmao', 'irma'), ...(partner(L) ? [partner(L)!] : [])].slice(0, 3); return pet && familia.length ? { pet, familia, valor: Math.max(0, Math.round(L.money * 0.5)) } : null; },
    icon: '🐈', title: 'O testamento do gato',
    text: (_L, c) => `Você está escrevendo o testamento e pensa em deixar ${money(c.valor!)} para os cuidados de ${c.pet!.name}. A família já pediu uma reunião.`,
    scene: (_L, c) => ({ id: 'brigaFamilia', others: c.familia }),
    choices: [
      { label: 'Deixar a parte do gato', icon: '🐾', run: (L, c) => {
        L.flags.testamentoGatoIdade = L.player.age; L.flags.testamentoGatoValor = c.valor!; L.flags.testamentoGatoPetId = c.pet!.id; c.familia.forEach((p: Person) => bond(p, -6)); stat(L, 'felicidade', 4); return O(`Você reservou ${money(c.valor!)} para ${c.pet!.name}. A família pediu para ver o documento; o gato já escolheu a poltrona.`, 'neutro', { react: { player: { expr: 'serio' } } });
      } },
      { label: 'Dividir entre a família', icon: '👨‍👩‍👧', run: (L) => { children(L).forEach((p) => bond(p, 5)); L.karma += 2; stat(L, 'felicidade', 3); return O('Você deixou instruções para dividir os bens com a família. O gato ganhou um parágrafo e uma caixa nova.', 'bom'); } },
      { label: 'Doar parte para os animais', icon: '🏥', run: (L, c) => { const valor = Math.min(2000, L.money); L.money -= valor; c.pet!.bond = Math.min(100, c.pet!.bond + 8); L.karma += 4; stat(L, 'felicidade', 4); return O(`Você doou ${money(valor)} para cuidar de animais. ${c.pet!.name} acompanhou a decisão do sofá.`, 'bom'); } },
    ],
  },
  {
    id: 'familiaContestaTestamento', min: 61, max: 100, weight: 6, once: true,
    cond: (L) => typeof L.flags.testamentoGatoIdade === 'number' && L.player.age - (L.flags.testamentoGatoIdade as number) >= 1 && (children(L).length > 0 || byRel(L, 'irmao', 'irma').length > 0 || !!partner(L)),
    setup: (L) => ({ pet: L.pets.find((p) => p.id === L.flags.testamentoGatoPetId), familia: [...children(L), ...byRel(L, 'irmao', 'irma'), ...(partner(L) ? [partner(L)!] : [])].slice(0, 3), valor: L.flags.testamentoGatoValor as number }),
    icon: '📜', title: 'A família leu o testamento',
    text: (_L, c) => `Sua família viu a reserva de ${money(c.valor!)} para ${c.pet?.name ?? 'o gato'}. O assunto chegou à mesa antes do café.`,
    scene: (L, c) => ({ id: 'brigaFamilia', others: c.familia }),
    choices: [
      { label: 'Manter a decisão', icon: '🐈', run: (L, c) => { delete L.flags.testamentoGatoIdade; delete L.flags.testamentoGatoValor; delete L.flags.testamentoGatoPetId; c.familia.forEach((p: Person) => bond(p, -4)); L.karma += 1; stat(L, 'felicidade', 2); return O('Você manteve a reserva para o gato. A família discordou; o gato dormiu em cima da cópia assinada.', 'neutro', { react: { npc: { expr: 'serio' } } }); } },
      { label: 'Rever a divisão dos bens', icon: '✍️', run: (L, c) => { delete L.flags.testamentoGatoIdade; delete L.flags.testamentoGatoValor; delete L.flags.testamentoGatoPetId; c.familia.forEach((p: Person) => bond(p, 6)); stat(L, 'felicidade', 4); return O('Você ajustou o testamento para incluir a família e manter os cuidados do gato. A reunião terminou sem votação.', 'bom', { react: { npc: { expr: 'feliz' }, player: { expr: 'feliz' } } }); } },
      { label: 'Reservar apenas para os cuidados', icon: '🧾', run: (L, c) => { delete L.flags.testamentoGatoIdade; delete L.flags.testamentoGatoValor; delete L.flags.testamentoGatoPetId; const valor = Math.min(2000, c.valor!); L.money -= Math.min(L.money, valor); c.familia.forEach((p: Person) => bond(p, 2)); stat(L, 'felicidade', 1); return O(`Você reservou ${money(valor)} para os cuidados do gato e liberou o restante para a família. O gato aprovou sem assinar.`, 'neutro'); } },
    ],
  },
];

export function eventTitle(ev: LifeEvent, L: Life, c: EvCtx) {
  return typeof ev.title === 'function' ? ev.title(L, c) : ev.title;
}

void (null as unknown as Person);
