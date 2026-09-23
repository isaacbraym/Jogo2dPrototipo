import { Action, Outcome, Interaction, PendingEvent } from './types';
import { Life, stat, bond, makePerson, partner, friends, money, newId, Person, spouse, he, addLog, REL_LABEL, children } from './state';
import { rng } from '../core/rng';
import { CAREERS, Career } from './careers';
import { DESTINOS, FILMES, PETS_NOMES } from './names';
import { EVENTS } from './events';

const O = (text: string, tone: Outcome['tone'], extra: Partial<Outcome> = {}): Outcome => ({ text, tone, ...extra });

export const ACTIONS: Action[] = [
  // ------------------------------------------------ mente e corpo
  {
    id: 'academia', label: 'Academia', icon: '🏋️', group: 'Mente & Corpo', minAge: 12, desc: 'Treinar pesado: saúde e aparência.',
    run: (L) => { stat(L, 'saude', rng.int(3, 7)); stat(L, 'aparencia', rng.int(1, 4)); stat(L, 'felicidade', 2); L.fitness = Math.min(100, L.fitness + 6); return O('Treino concluído! Você se sente mais forte.', 'bom', { scene: { id: 'academia' } }); },
  },
  {
    id: 'meditar', label: 'Meditar', icon: '🧘', group: 'Mente & Corpo', minAge: 10, desc: 'Encontre paz interior.',
    run: (L) => { stat(L, 'felicidade', rng.int(4, 8)); stat(L, 'saude', 2); return O('Sua mente está leve como uma pluma.', 'bom', { scene: { id: 'meditar' } }); },
  },
  {
    id: 'estudar', label: 'Estudar na biblioteca', icon: '📚', group: 'Mente & Corpo', minAge: 7, desc: 'Aumente sua inteligência.',
    run: (L) => { stat(L, 'inteligencia', rng.int(3, 6)); stat(L, 'felicidade', -1); L.edu.nota += 4; return O('Horas de estudo renderam novos conhecimentos.', 'bom', { scene: { id: 'estudar' } }); },
  },
  {
    id: 'medico', label: 'Check-up médico', icon: '🩺', group: 'Mente & Corpo', minAge: 0, cost: 400, desc: 'Cuide da sua saúde.',
    run: (L) => { const g = L.stats.saude < 50; stat(L, 'saude', rng.int(4, 10)); return O(g ? 'O médico receitou um tratamento. Você está melhorando.' : 'Tudo em ordem! Saúde de ferro.', 'bom', { scene: { id: 'medico', data: { good: true, fala: g ? 'Vamos tratar isso direitinho.' : 'Exames perfeitos!' } } }); },
  },
  {
    id: 'cozinhar', label: 'Cozinhar', icon: '🍳', group: 'Mente & Corpo', minAge: 12, desc: 'Arrisque uma receita nova.',
    run: (L) => { if (rng.chance(0.25)) { stat(L, 'felicidade', -3); return O('A panela pegou fogo! Pizza delivery hoje.', 'ruim', { scene: { id: 'cozinhar', data: { fogo: true, titulo: 'Desastre na cozinha' } } }); } stat(L, 'felicidade', 5); stat(L, 'saude', 2); return O('Ficou delicioso! Você é um(a) chef nato(a).', 'bom', { scene: { id: 'cozinhar', data: { titulo: 'Receita nova' } } }); },
  },
  {
    id: 'pintar', label: 'Pintar', icon: '🎨', group: 'Mente & Corpo', minAge: 5, desc: 'Expressão artística.',
    run: (L) => { stat(L, 'felicidade', 5); stat(L, 'inteligencia', 2); return O('Você criou uma obra que ficou linda!', 'bom', { scene: { id: 'pintar' } }); },
  },
  // ------------------------------------------------ diversão
  {
    id: 'balada', label: 'Balada', icon: '🪩', group: 'Diversão', minAge: 18, cost: 150, desc: 'Dançar até o sol raiar.',
    run: (L) => { stat(L, 'felicidade', rng.int(5, 10)); stat(L, 'saude', -2); if (rng.chance(0.3) && !partner(L)) { const ev = EVENTS.find((e) => e.id === 'amorAdulto')!; const ctx = ev.setup!(L)!; return { ev, ctx } as PendingEvent as any; } return O('Que noite! Você dançou até cansar.', 'bom', { scene: { id: 'balada', others: friends(L).slice(0, 2) } }); },
  },
  {
    id: 'show', label: 'Ir a um show', icon: '🎤', group: 'Diversão', minAge: 12, cost: 250, desc: 'Música ao vivo!',
    run: (L) => { stat(L, 'felicidade', rng.int(7, 12)); return O('O show foi histórico. Você cantou todas!', 'bom', { scene: { id: 'show', data: { sub: 'Banda favorita' } } }); },
  },
  {
    id: 'cinema', label: 'Cinema', icon: '🎬', group: 'Diversão', minAge: 6, cost: 40, desc: 'Pipoca e filme.',
    run: (L) => { const f = rng.pick(FILMES); stat(L, 'felicidade', rng.int(3, 7)); const p = partner(L); if (p) bond(p, 4); return O(`Vocês assistiram "${f}". ${rng.chance(0.5) ? 'Filmaço!' : 'Meio fraco, mas valeu a pipoca.'}`, 'bom', { scene: { id: 'cinema', others: p ? [p] : friends(L).slice(0, 1), data: { filme: f } } }); },
  },
  {
    id: 'praia', label: 'Férias na praia', icon: '🏖️', group: 'Diversão', minAge: 4, cost: 2500, desc: 'Sol, mar e descanso.',
    run: (L) => { stat(L, 'felicidade', rng.int(8, 14)); stat(L, 'saude', 3); return O('Dias perfeitos de sol e mar!', 'bom', { scene: { id: 'ferias' } }); },
  },
  {
    id: 'acampar', label: 'Acampar', icon: '🏕️', group: 'Diversão', minAge: 8, cost: 300, desc: 'Noite sob as estrelas.',
    run: (L) => { stat(L, 'felicidade', rng.int(6, 10)); const f = friends(L)[0]; if (f) bond(f, 8); return O(f ? `Você e ${f.first} passaram a noite contando histórias.` : 'O céu estrelado estava deslumbrante.', 'bom', { scene: { id: 'acampar', others: f ? [f] : [] } }); },
  },
  {
    id: 'videogame', label: 'Videogame', icon: '🎮', group: 'Diversão', minAge: 5, desc: 'Uma partida rápida... ou dez.',
    run: (L) => { const w = rng.chance(0.6); stat(L, 'felicidade', w ? 5 : 1); stat(L, 'saude', -1); return O(w ? 'Vitória épica no online!' : 'Perdeu pra uma criança de 9 anos.', w ? 'bom' : 'neutro', { scene: { id: 'videogame', data: { win: w } } }); },
  },
  {
    id: 'viajar', label: 'Viajar ao exterior', icon: '✈️', group: 'Diversão', minAge: 18, cost: 9000, desc: 'Conhecer o mundo.',
    run: (L) => { const d = rng.pick(DESTINOS); stat(L, 'felicidade', rng.int(10, 16)); stat(L, 'inteligencia', 2); return O(`Você conheceu ${d}! Fotos para a vida toda.`, 'bom', { scene: { id: 'viagem', data: { destino: d } } }); },
  },
  // ------------------------------------------------ amor e amizade
  {
    id: 'namoro', label: 'Procurar um amor', icon: '💘', group: 'Amor & Amigos', minAge: 16, cond: (L) => !partner(L), desc: 'Encontre alguém especial.',
    run: (L) => { const ev = EVENTS.find((e) => e.id === (L.player.age < 20 ? 'crush' : 'amorAdulto'))!; return { ev, ctx: ev.setup!(L)! } as PendingEvent; },
  },
  {
    id: 'amigos', label: 'Fazer amigos', icon: '🤝', group: 'Amor & Amigos', minAge: 4, desc: 'Conhecer gente nova.',
    run: (L) => {
      const sex = rng.chance(0.5) ? 'f' : 'm';
      const f = makePerson(rng, { sex, age: Math.max(4, L.player.age + rng.int(-3, 3)), rel: sex === 'f' ? 'amiga' : 'amigo', bond: rng.int(50, 75) });
      L.people.push(f);
      stat(L, 'felicidade', 5);
      return O(`Você fez amizade com ${f.first}!`, 'bom', { scene: { id: 'interacao', others: [f], data: { action: 'highFive', env: L.player.age < 18 ? 'patio' : 'parque' } } });
    },
  },
  {
    id: 'adotarPet', label: 'Adotar um pet', icon: '🐾', group: 'Amor & Amigos', minAge: 8, cost: 300, desc: 'Um companheiro fiel.',
    run: (L) => { const kind = rng.chance(0.55) ? 'cachorro' : 'gato'; const name = rng.pick(PETS_NOMES); const color = kind === 'cachorro' ? rng.pick(['#c8843a', '#f4e6c4', '#3b2616', '#8a8f98', '#e8c46a']) : rng.pick(['#6f7680', '#e8a060', '#23242b', '#f4f1ea']); L.pets.push({ id: newId(), name, kind, color, age: 1, bond: 80, alive: true }); stat(L, 'felicidade', 10); L.karma += 3; return O(`Você adotou ${name}, ${kind === 'cachorro' ? 'um cachorrinho' : 'um gatinho'} adorável!`, 'bom', { scene: { id: 'pet', data: { kind, nome: name, color, titulo: 'Adoção!', env: 'sala' } } }); },
  },
  {
    id: 'passearPet', label: 'Passear com o pet', icon: '🦮', group: 'Amor & Amigos', minAge: 6, cond: (L) => L.pets.some((p) => p.alive), desc: 'Um passeio no parque.',
    run: (L) => { const pet = L.pets.find((p) => p.alive)!; pet.bond = Math.min(100, pet.bond + 10); stat(L, 'felicidade', 5); stat(L, 'saude', 3); return O(`Passeio delicioso com ${pet.name}.`, 'bom', { scene: { id: 'passeioPet', data: { kind: pet.kind, color: pet.color } } }); },
  },
  {
    id: 'pedirCasamento', label: 'Pedir em casamento', icon: '💍', group: 'Amor & Amigos', minAge: 18, cost: 3000, cond: (L) => { const p = partner(L); return !!p && p.rel !== 'conjuge'; }, desc: 'O grande passo!',
    run: (L) => {
      const p = partner(L)!;
      const yes = rng.chance(p.bond / 110 + 0.1);
      if (yes) { p.rel = 'conjuge'; bond(p, 15); stat(L, 'felicidade', 16); addLog(L, `${p.first} aceitou meu pedido! Casamos em uma linda cerimônia.`, 'especial', '💒'); return O(`${p.first} disse SIM! O casamento foi mágico.`, 'especial', { scene: { id: 'pedido', others: [p], data: { yes: true } }, log: false, followUp: { ev: { id: 'cerimonia', min: 0, max: 200, weight: 0, icon: '💒', title: 'O casamento', text: () => `O dia do casamento com ${p.first} chegou!`, scene: () => ({ id: 'casamento', others: [p] }), auto: () => O('Que dia lindo! Vocês agora são uma família.', 'especial', { log: false }) }, ctx: {} } }); }
      bond(p, -20); stat(L, 'felicidade', -12);
      return O(`${p.first} recusou o pedido...`, 'ruim', { scene: { id: 'pedido', others: [p], data: { yes: false } } });
    },
  },
  {
    id: 'terFilho', label: 'Ter um bebê', icon: '🍼', group: 'Amor & Amigos', minAge: 20, maxAge: 50, cond: (L) => !!spouse(L), desc: 'Aumentar a família.',
    run: (L) => { const ev = EVENTS.find((e) => e.id === 'bebe')!; return { ev, ctx: ev.setup!(L)! } as PendingEvent; },
  },
  {
    id: 'divorcio', label: 'Divórcio', icon: '📄', group: 'Amor & Amigos', minAge: 18, cond: (L) => !!spouse(L), desc: 'Encerrar o casamento.',
    run: (L) => { const s = spouse(L)!; s.rel = 'ex'; bond(s, -40); const half = Math.max(0, Math.round(L.money * 0.4)); L.money -= half; stat(L, 'felicidade', -10); return O(`Você e ${s.first} se divorciaram. A partilha levou ${money(half)}.`, 'ruim', { scene: { id: 'termino', others: [s] } }); },
  },
  // ------------------------------------------------ dinheiro e sorte
  {
    id: 'loteria', label: 'Jogar na loteria', icon: '🎰', group: 'Dinheiro & Sorte', minAge: 18, cost: 10, desc: 'Um bilhete, um sonho.',
    run: (L) => { const w = rng.chance(0.06); if (w) { const v = rng.pick([5000, 20000, 150000, 1000000]); L.money += v; stat(L, 'felicidade', 20); addLog(L, `Ganhei ${money(v)} na loteria!`, 'especial', '🎰'); return O(`INACREDITÁVEL! Você ganhou ${money(v)}!`, 'especial', { scene: { id: 'loteria', data: { win: true, valor: money(v) } }, log: false }); } return O('Não foi dessa vez.', 'neutro', { scene: { id: 'loteria', data: { win: false } } }); },
  },
  {
    id: 'cassino', label: 'Cassino', icon: '🎲', group: 'Dinheiro & Sorte', minAge: 18, cost: 500, desc: 'Apostar R$ 500.',
    run: (L) => { const w = rng.chance(0.4); if (w) { const v = rng.pick([1000, 1500, 3000, 10000]); L.money += v; stat(L, 'felicidade', 8); return O(`Jackpot! Você saiu com ${money(v)}.`, 'bom', { scene: { id: 'cassino', data: { win: true } } }); } stat(L, 'felicidade', -4); return O('A máquina engoliu seu dinheiro.', 'ruim', { scene: { id: 'cassino', data: { win: false } } }); },
  },
  {
    id: 'comprarCarro', label: 'Comprar carro', icon: '🚗', group: 'Dinheiro & Sorte', minAge: 18, cond: (L) => L.licenca && !L.assets.carro, cost: 45000, desc: 'Um carro zero na garagem.',
    run: (L) => { const cor = rng.pick(['#e4572e', '#3d7bd9', '#23242b', '#f4f1ea', '#2f8f6f', '#f2c14e']); L.assets.carro = { nome: rng.pick(['Sedã', 'Hatch', 'SUV', 'Esportivo']), valor: 45000, cor }; stat(L, 'felicidade', 10); return O('Carro novo na garagem! Cheirinho de novo.', 'bom', { scene: { id: 'carroNovo', data: { cor, nome: L.assets.carro.nome } } }); },
  },
  {
    id: 'comprarCasa', label: 'Comprar casa', icon: '🏡', group: 'Dinheiro & Sorte', minAge: 18, cond: (L) => !L.assets.casa, cost: 280000, desc: 'O sonho da casa própria.',
    run: (L) => { L.assets.casa = { nome: 'Casa com jardim', valor: 280000 }; stat(L, 'felicidade', 16); addLog(L, 'Comprei minha casa própria!', 'especial', '🏡'); return O('Chave na mão! A casa é sua.', 'especial', { scene: { id: 'casaNova', others: [...(partner(L) ? [partner(L)!] : []), ...children(L)].slice(0, 2), data: { nome: 'Casa com jardim' } }, log: false }); },
  },
  {
    id: 'mesada', label: 'Pedir mesada', icon: '🪙', group: 'Dinheiro & Sorte', minAge: 6, maxAge: 17, desc: 'Convencer os pais.',
    run: (L) => { const pais = L.people.filter((p) => p.alive && (p.rel === 'mae' || p.rel === 'pai')); const p = pais[0]; if (p && rng.chance(p.bond / 120)) { const v = rng.int(2, 10) * 10; L.money += v; return O(`${p.first} te deu ${money(v)} de mesada!`, 'bom', { scene: { id: 'interacao', others: [p], data: { action: 'pedirDinheiro' } } }); } if (p) bond(p, -2); return O('"Dinheiro não dá em árvore!"', 'ruim', { scene: { id: 'interacao', others: p ? [p] : [], data: { action: 'pedirDinheiro' } } }); },
  },
  // ------------------------------------------------ crime
  {
    id: 'furto', label: 'Furtar uma loja', icon: '🦹', group: 'Crime', minAge: 14, desc: 'Arriscado. Muito arriscado.',
    run: (L) => {
      L.karma -= 8;
      const caught = rng.chance(0.4);
      if (caught) {
        L.crime.ficha += 1;
        const pena = rng.int(1, 3);
        L.crime.preso = true; L.crime.pena = pena;
        stat(L, 'felicidade', -20);
        addLog(L, `Fui preso(a) por furto. Pena de ${pena} ano(s).`, 'ruim', '🚔');
        return O(`A polícia te pegou em flagrante! Condenado(a) a ${pena} ano(s).`, 'ruim', { scene: { id: 'crime', data: { caught: true, titulo: 'Furto' } }, log: false, followUp: { ev: { id: 'julg', min: 0, max: 200, weight: 0, icon: '⚖️', title: 'Julgamento', text: () => 'Você é levado(a) ao tribunal...', scene: () => ({ id: 'julgamento', data: { guilty: true, fala: `Culpado! ${pena} ano(s) de reclusão.` } }), auto: () => O('Você vai cumprir pena na prisão.', 'ruim', { scene: { id: 'cela', data: { sub: `${pena} ano(s) de pena` } }, log: false }) }, ctx: {} } });
      }
      const v = rng.int(3, 20) * 100;
      L.money += v;
      stat(L, 'felicidade', 3);
      return O(`Você escapou com ${money(v)}. Mas a consciência pesa.`, 'neutro', { scene: { id: 'crime', data: { caught: false, titulo: 'Furto' } } });
    },
  },
  {
    id: 'briga', label: 'Arrumar briga', icon: '🥊', group: 'Crime', minAge: 10, desc: 'Resolver na mão.',
    run: (L) => { const win = rng.chance(0.35 + L.fitness / 200); L.karma -= 4; if (win) { stat(L, 'felicidade', 3); return O('Você venceu a briga. Mas pra quê?', 'neutro', { scene: { id: 'briga', data: { win: true, env: 'ruaNoite' } } }); } stat(L, 'saude', -10); return O('Você apanhou feio.', 'ruim', { scene: { id: 'briga', data: { win: false, env: 'ruaNoite' } } }); },
  },
];

// ------------------------------------------------ carreira
export function jobOffers(L: Life): Career[] {
  return CAREERS.filter((c) => {
    if (L.player.age < c.minAge) return false;
    if (c.edu === 'faculdade' && !(L.edu.faculdade && (!c.curso || c.curso === L.edu.curso || rng.chance(0.15)))) return false;
    if (c.edu === 'medio' && L.player.age < 18) return false;
    return true;
  });
}

export function applyJob(L: Life, c: Career): Outcome {
  const chance = 0.45 + (L.stats.inteligencia - c.smarts) / 120 + (c.looks ? (L.stats.aparencia - c.looks) / 150 : 0) - L.crime.ficha * 0.12;
  const ok = rng.chance(Math.max(0.08, Math.min(0.92, chance)));
  if (ok) {
    L.job = { id: c.id, title: c.titles[0], salary: c.salary, perf: 55, years: 0, level: 0 };
    L.jobHistory.push(c.titles[0]);
    stat(L, 'felicidade', 8);
    addLog(L, `Fui contratado(a) como ${c.titles[0]}!`, 'especial', c.icon);
    return O(`Parabéns! Você foi contratado(a) como ${c.titles[0]}. Salário: ${money(c.salary)}/ano.`, 'especial', { scene: { id: 'entrevista', data: { ok: true, cargo: c.titles[0] } }, log: false });
  }
  stat(L, 'felicidade', -5);
  return O(`A vaga de ${c.title} ficou com outra pessoa.`, 'ruim', { scene: { id: 'entrevista', data: { ok: false, cargo: c.title } } });
}

export function workHard(L: Life): Outcome {
  const j = L.job!;
  const c = CAREERS.find((x) => x.id === j.id)!;
  j.perf = Math.min(100, j.perf + rng.int(8, 15));
  stat(L, 'felicidade', -2);
  stat(L, 'saude', -1);
  return O('Você trabalhou duro. Seu chefe notou!', 'bom', { scene: { id: 'trabalho', data: { env: c.env, motion: c.motion, outfit: c.outfit, titulo: j.title, fala: c.id === 'medico' ? 'Doutor(a), paciente no leito 3!' : undefined } } });
}

export function askPromotion(L: Life): Outcome {
  const j = L.job!;
  const c = CAREERS.find((x) => x.id === j.id)!;
  if (j.level >= c.titles.length - 1) return O('Você já está no topo da carreira!', 'neutro');
  if (rng.chance((j.perf - 30) / 80 + j.years * 0.04)) {
    j.level++;
    j.title = c.titles[j.level];
    j.salary = Math.round(j.salary * 1.45);
    j.perf = 50;
    stat(L, 'felicidade', 12);
    addLog(L, `Fui promovido(a) a ${j.title}!`, 'especial', '📈');
    return O(`Promovido(a) a ${j.title}! Novo salário: ${money(j.salary)}/ano.`, 'especial', { scene: { id: 'promocao', data: { cargo: j.title } }, log: false });
  }
  j.perf -= 8;
  stat(L, 'felicidade', -5);
  return O('O chefe disse "ainda não". Continue se esforçando.', 'ruim', { scene: { id: 'reflexao', data: { titulo: 'Promoção negada', env: 'escritorio', motion: 'facepalm' } } });
}

export function quitJob(L: Life): Outcome {
  const j = L.job!;
  L.job = null;
  stat(L, 'felicidade', 4);
  return O(`Você pediu demissão do cargo de ${j.title}.`, 'neutro', { scene: { id: 'reflexao', data: { titulo: 'Novos ares', env: 'ruaDia', motion: 'feliz' } } });
}

// ------------------------------------------------ interações (relacionamentos)
const romantic = (p: Person) => p.rel === 'namorado' || p.rel === 'namorada' || p.rel === 'conjuge';
const envFor = (L: Life, p: Person) => (romantic(p) ? rng.pick(['sala', 'parque', 'praia']) : p.rel === 'amigo' || p.rel === 'amiga' ? rng.pick(['parque', 'ruaDia']) : L.player.age < 18 ? 'sala' : rng.pick(['sala', 'cozinha']));
const sc = (L: Life, p: Person, action: string) => ({ id: 'interacao', others: [p], data: { action, env: envFor(L, p) } });

export const INTERACTIONS: Interaction[] = [
  {
    id: 'conversar', label: 'Conversar', icon: '💬', cond: (L) => L.player.age >= 3,
    run: (L, p) => { bond(p, rng.int(3, 7)); stat(L, 'felicidade', 2); return O(`Você teve uma ótima conversa com ${p.first}.`, 'bom', { scene: sc(L, p, 'conversar') }); },
  },
  {
    id: 'abracar', label: 'Abraçar', icon: '🤗', cond: () => true,
    run: (L, p) => { bond(p, rng.int(5, 9)); stat(L, 'felicidade', 4); return O(`Um abraço apertado em ${p.first}. Aquece o coração!`, 'bom', { scene: sc(L, p, 'abracar') }); },
  },
  {
    id: 'beijar', label: 'Beijar', icon: '💋', cond: (L, p) => romantic(p) && L.player.age >= 13,
    run: (L, p) => { bond(p, rng.int(6, 10)); stat(L, 'felicidade', 6); return O(`Um beijo apaixonado em ${p.first}.`, 'bom', { scene: sc(L, p, 'beijar') }); },
  },
  {
    id: 'highFive', label: 'Toca aqui!', icon: '🙌', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(2, 5)); stat(L, 'felicidade', 2); return O(`${p.first} bateu na sua mão com entusiasmo!`, 'bom', { scene: sc(L, p, 'highFive') }); },
  },
  {
    id: 'dancar', label: 'Dançar juntos', icon: '💃', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(4, 8)); stat(L, 'felicidade', 5); return O(`Você e ${p.first} dançaram e riram muito.`, 'bom', { scene: sc(L, p, 'dancar') }); },
  },
  {
    id: 'elogiar', label: 'Elogiar', icon: '🌟', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(3, 7)); return O(`${p.first} ficou todo(a) sem graça com o elogio.`, 'bom', { scene: sc(L, p, 'elogiar') }); },
  },
  {
    id: 'presente', label: 'Dar presente', icon: '🎁', cond: (L) => L.player.age >= 5 && L.money >= 100,
    run: (L, p) => { L.money -= 100; bond(p, rng.int(8, 14)); return O(`${p.first} amou o presente!`, 'bom', { scene: sc(L, p, 'presente') }); },
  },
  {
    id: 'brincar', label: 'Brincar', icon: '🪁', cond: (L, p) => L.player.age < 14 || p.age < 14,
    run: (L, p) => { bond(p, rng.int(5, 9)); stat(L, 'felicidade', 5); return O(`Tarde divertida brincando com ${p.first}!`, 'bom', { scene: sc(L, p, 'brincar') }); },
  },
  {
    id: 'pedirDinheiro', label: 'Pedir dinheiro', icon: '💰', cond: (L, p) => L.player.age >= 8 && ['mae', 'pai', 'avo', 'avoM', 'conjuge'].includes(p.rel),
    run: (L, p) => { if (rng.chance(p.bond / 140)) { const v = rng.int(1, 20) * (L.player.age < 18 ? 10 : 100); L.money += v; bond(p, -2); return O(`${p.first} te deu ${money(v)}.`, 'bom', { scene: sc(L, p, 'pedirDinheiro') }); } bond(p, -6); return O(`${p.first} negou e ficou incomodado(a).`, 'ruim', { scene: sc(L, p, 'pedirDinheiro') }); },
  },
  {
    id: 'discutir', label: 'Discutir', icon: '😤', cond: (L) => L.player.age >= 5,
    run: (L, p) => { bond(p, -rng.int(8, 14)); stat(L, 'felicidade', -4); return O(`Você e ${p.first} tiveram uma discussão feia.`, 'ruim', { scene: sc(L, p, 'discutir') }); },
  },
  {
    id: 'empurrar', label: 'Empurrar', icon: '✋', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, -rng.int(10, 16)); L.karma -= 3; return O(`Você empurrou ${p.first}. Clima péssimo.`, 'ruim', { scene: sc(L, p, 'empurrar') }); },
  },
  {
    id: 'tapa', label: 'Dar um tapa', icon: '🖐️', cond: (L) => L.player.age >= 6,
    run: (L, p) => { bond(p, -rng.int(15, 25)); L.karma -= 5; return O(`PÁ! ${p.first} não vai esquecer isso tão cedo.`, 'ruim', { scene: sc(L, p, 'tapa') }); },
  },
  {
    id: 'soco', label: 'Dar um soco', icon: '👊', cond: (L) => L.player.age >= 8,
    run: (L, p) => { bond(p, -rng.int(25, 40)); L.karma -= 10; if (rng.chance(0.2) && L.player.age >= 18) { L.crime.ficha += 1; return O(`${p.first} prestou queixa por agressão!`, 'ruim', { scene: sc(L, p, 'soco') }); } return O(`Você acertou ${p.first} em cheio. Isso vai ter consequências.`, 'ruim', { scene: sc(L, p, 'soco') }); },
  },
  {
    id: 'terminar', label: 'Terminar namoro', icon: '💔', cond: (_L, p) => p.rel === 'namorado' || p.rel === 'namorada',
    run: (L, p) => { p.rel = 'ex'; bond(p, -30); stat(L, 'felicidade', -8); return O(`Você terminou com ${p.first}.`, 'ruim', { scene: { id: 'termino', others: [p] } }); },
  },
];

export function relLabel(p: Person) {
  return REL_LABEL[p.rel];
}

void he;
