import { LifeEvent, Outcome, EvCtx } from './types';
import { Life, stat, bond, addLog, makePerson, partner, parents, friends, children, pickRandom, he, money, newId, Person, spouse, byRel } from './state';
import { rng } from '../core/rng';
import { inherit } from '../character/appearance';
import { CURSOS, CAREERS, careerById } from './careers';
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
    setup: (L) => ({ person: partner(L) }),
    text: (_L, c) => `Você viu mensagens estranhas no celular de ${c.person!.first}...`,
    choices: [
      { label: 'Confrontar', icon: '😡', run: (L, c) => { const p = c.person!; if (rng.chance(0.4)) { p.rel = 'ex'; bond(p, -50); stat(L, 'felicidade', -15); return O(`${p.first} confessou tudo. O relacionamento acabou.`, 'ruim', { scene: { id: 'termino', others: [p] } }); } bond(p, -8); return O(`Era só uma surpresa de aniversário! Que vergonha...`, 'neutro', { scene: { id: 'interacao', others: [p], data: { action: 'discutir' } } }); } },
      { label: 'Confiar e esquecer', icon: '🕊️', run: (L, c) => { bond(c.person!, 3); stat(L, 'felicidade', -2); return O('Você escolheu confiar.', 'neutro'); } },
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
    setup: (L) => ({ person: pickRandom(children(L).filter((k) => k.age >= 24)) }),
    text: (_L, c) => `${c.person!.first} contou que está esperando um bebê!`,
    auto: (L, c) => { L.flags.neto = 1; stat(L, 'felicidade', 14); bond(c.person!, 8); return O('A família vai crescer! Você está radiante.', 'especial', { scene: { id: 'interacao', others: [c.person!], data: { action: 'abracar' } } }); },
  },
  {
    id: 'reencontro', min: 25, max: 90, weight: (L) => (byRel(L, 'ex').length ? 3 : 0), icon: '🔁', title: 'Reencontro inesperado',
    setup: (L) => ({ person: pickRandom(byRel(L, 'ex')) }),
    text: (_L, c) => `Você esbarrou em ${c.person!.first}, seu/sua ex, no supermercado.`,
    choices: [
      { label: 'Conversar', icon: '💬', run: (L, c) => { bond(c.person!, 10); stat(L, 'felicidade', 3); return O('Foi bom colocar o papo em dia.', 'bom', { scene: { id: 'interacao', others: [c.person!], data: { action: 'conversar', env: 'ruaDia' } } }); } },
      { label: 'Fingir que não viu', icon: '🫣', run: () => O('Você se escondeu atrás das bananas.', 'neutro') },
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
      { label: 'Topar', icon: '🤑', run: (L) => { L.karma -= 12; if (rng.chance(0.4)) { L.job = null; L.crime.ficha += 1; stat(L, 'felicidade', -15); return O('Foram descobertos! Você foi demitido(a) por justa causa.', 'ruim', { scene: { id: 'demissao' } }); } L.money += 20000; return O('Você embolsou R$ 20 mil... e uma consciência pesada.', 'neutro'); } },
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
      { label: 'Aceitar a vaga', icon: '🤝', run: (L, c) => { const car = careerById(c.s!)!; L.job = { id: car.id, title: car.titles[0], salary: car.salary, perf: 55, years: 0, level: 0 }; L.jobHistory.push(car.titles[0]); stat(L, 'felicidade', 8); return O(`Contratado(a) como ${car.titles[0]}! Bem-vindo(a) à equipe.`, 'especial', { scene: { id: 'entrevista', data: { ok: true, cargo: car.titles[0] } } }); } },
      { label: 'Negociar salário', icon: '💬', run: (L, c) => { const car = careerById(c.s!)!; if (rng.chance(0.45 + L.stats.inteligencia / 300)) { const sal = Math.round(car.salary * 1.2); L.job = { id: car.id, title: car.titles[0], salary: sal, perf: 55, years: 0, level: 0 }; L.jobHistory.push(car.titles[0]); stat(L, 'felicidade', 10); return O(`Negociação vencida! ${car.titles[0]} com ${money(sal)}/ano.`, 'especial', { scene: { id: 'entrevista', data: { ok: true, cargo: car.titles[0] } } }); } return O('A empresa retirou a proposta. Ops!', 'ruim', { scene: { id: 'entrevista', data: { ok: false, cargo: car.titles[0] } } }); } },
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
  {
    id: 'aposentarAuto', min: 65, max: 75, weight: (L) => (L.job && !L.retired ? 30 : 0), icon: '🏖️', title: 'Hora de se aposentar?',
    text: () => 'Depois de tantos anos de trabalho, a aposentadoria está logo ali.',
    choices: [
      { label: 'Aposentar!', icon: '🎉', run: (L) => { L.retired = true; L.flags.aposentadoria = Math.round((L.job?.salary ?? 20000) * 0.6); L.job = null; stat(L, 'felicidade', 12); return O('Você se aposentou! Agora é só curtir a vida.', 'especial', { scene: { id: 'aposentadoria' } }); } },
      { label: 'Trabalhar mais um pouco', icon: '💪', run: (L) => { stat(L, 'saude', -3); return O('Você ainda tem lenha pra queimar.', 'neutro') } },
    ],
  },
];

export function eventTitle(ev: LifeEvent, L: Life, c: EvCtx) {
  return typeof ev.title === 'function' ? ev.title(L, c) : ev.title;
}

void (null as unknown as Person);
