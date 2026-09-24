import { Action, Outcome, Interaction, PendingEvent } from './types';
import { Life, stat, bond, makePerson, partner, friends, money, newId, Person, spouse, he, addLog, REL_LABEL, children, leaveJobPeople } from './state';
import { rng } from '../core/rng';
import { CAREERS, Career } from './careers';
import { DESTINOS, FILMES, PETS_NOMES } from './names';
import { EVENTS } from './events';
import { aggress, AGGRO, AggroKind, contextOf, envFor as aggroEnv } from './aggression';
import { mem, lembrar, reacao, contarGesto, limitarVinculo, chanceDesculpas, encerrarRelacao, podeNamorar, Reacao } from './relacoes';
import { LifeEvent } from './types';

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
  leaveJobPeople(L);
  stat(L, 'felicidade', 4);
  return O(`Você pediu demissão do cargo de ${j.title}.`, 'neutro', { scene: { id: 'reflexao', data: { titulo: 'Novos ares', env: 'ruaDia', motion: 'feliz' } } });
}

// ------------------------------------------------ interações (relacionamentos)
const romantic = (p: Person) => p.rel === 'namorado' || p.rel === 'namorada' || p.rel === 'conjuge';
const envFor = (L: Life, p: Person) => {
  const c = contextOf(L, p);
  if (c === 'trabalho' || c === 'escola') return aggroEnv(L, c, p);
  if (romantic(p)) return rng.pick(['sala', 'parque', 'praia']);
  if (p.rel === 'amigo' || p.rel === 'amiga') return L.player.age < 18 ? rng.pick(['parque', 'patio']) : rng.pick(['parque', 'ruaDia', 'boteco']);
  return L.player.age < 18 ? 'sala' : rng.pick(['sala', 'cozinha']);
};
const sc = (L: Life, p: Person, action: string) => ({ id: 'interacao', others: [p], data: { action, env: envFor(L, p) } });

export const INTERACTIONS: Interaction[] = [
  {
    id: 'conversar', gesto: 'conversa', label: 'Conversar', icon: '💬', cond: (L) => L.player.age >= 3,
    run: (L, p) => { bond(p, rng.int(3, 7)); stat(L, 'felicidade', 2); return O(`Você teve uma ótima conversa com ${p.first}.`, 'bom', { scene: sc(L, p, 'conversar') }); },
  },
  {
    id: 'abracar', gesto: 'carinho', label: 'Abraçar', icon: '🤗', cond: () => true,
    run: (L, p) => { bond(p, rng.int(5, 9)); stat(L, 'felicidade', 4); return O(`Um abraço apertado em ${p.first}. Aquece o coração!`, 'bom', { scene: sc(L, p, 'abracar') }); },
  },
  {
    id: 'beijar', gesto: 'romance', label: 'Beijar', icon: '💋', cond: (L, p) => romantic(p) && L.player.age >= 13,
    run: (L, p) => { bond(p, rng.int(6, 10)); stat(L, 'felicidade', 6); return O(`Um beijo apaixonado em ${p.first}.`, 'bom', { scene: sc(L, p, 'beijar') }); },
  },
  {
    id: 'highFive', gesto: 'diversao', label: 'Toca aqui!', icon: '🙌', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(2, 5)); stat(L, 'felicidade', 2); return O(`${p.first} bateu na sua mão com entusiasmo!`, 'bom', { scene: sc(L, p, 'highFive') }); },
  },
  {
    id: 'dancar', gesto: 'diversao', label: 'Dançar juntos', icon: '💃', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(4, 8)); stat(L, 'felicidade', 5); return O(`Você e ${p.first} dançaram e riram muito.`, 'bom', { scene: sc(L, p, 'dancar') }); },
  },
  {
    id: 'elogiar', gesto: 'conversa', label: 'Elogiar', icon: '🌟', cond: (L) => L.player.age >= 4,
    run: (L, p) => { bond(p, rng.int(3, 7)); return O(`${p.first} ficou todo(a) sem graça com o elogio.`, 'bom', { scene: sc(L, p, 'elogiar') }); },
  },
  {
    id: 'presente', gesto: 'carinho', label: 'Dar presente', icon: '🎁', cond: (L) => L.player.age >= 5 && L.money >= 100,
    run: (L, p) => { L.money -= 100; bond(p, rng.int(8, 14)); lembrar(L, p, 'presente'); return O(`${p.first} amou o presente!`, 'bom', { scene: sc(L, p, 'presente') }); },
  },
  {
    id: 'brincar', gesto: 'diversao', label: 'Brincar', icon: '🪁', cond: (L, p) => L.player.age < 14 || p.age < 14,
    run: (L, p) => { bond(p, rng.int(5, 9)); stat(L, 'felicidade', 5); return O(`Tarde divertida brincando com ${p.first}!`, 'bom', { scene: sc(L, p, 'brincar') }); },
  },
  {
    id: 'pedirDinheiro', gesto: 'pedido', label: 'Pedir dinheiro', icon: '💰', cond: (L, p) => L.player.age >= 8 && ['mae', 'pai', 'avo', 'avoM', 'conjuge'].includes(p.rel),
    run: (L, p) => { if (rng.chance(p.bond / 140)) { const v = rng.int(1, 20) * (L.player.age < 18 ? 10 : 100); L.money += v; bond(p, -2); return O(`${p.first} te deu ${money(v)}.`, 'bom', { scene: sc(L, p, 'pedirDinheiro') }); } bond(p, -6); return O(`${p.first} negou e ficou incomodado(a).`, 'ruim', { scene: sc(L, p, 'pedirDinheiro') }); },
  },
  {
    id: 'discutir', label: 'Discutir', icon: '😤', cond: (L) => L.player.age >= 5,
    run: (L, p) => { bond(p, -rng.int(8, 14)); stat(L, 'felicidade', -4); lembrar(L, p, 'discussao', 1, 'Vocês discutiram feio.'); return O(`Você e ${p.first} tiveram uma discussão feia.`, 'ruim', { scene: sc(L, p, 'discutir') }); },
  },
  // ---------------- gestos gentis / conversa
  {
    id: 'piada', gesto: 'conversa', label: 'Contar piada', icon: '🤡', group: 'Conversa', cond: (L) => L.player.age >= 6,
    run: (L, p) => {
      const piada = rng.pick(['Por que o pão não entende a batata? Porque o pão é francês.', 'Sabe o que o zero disse pro oito? Que cinto maneiro!', 'O que é um pontinho amarelo no céu? Um yellowcóptero.', 'Qual o contrário de volátil? Vem cá, sobrinho.']);
      const ok = rng.chance(0.45 + L.stats.inteligencia / 300);
      bond(p, ok ? rng.int(4, 8) : -2);
      return O(ok ? `"${piada}" — ${p.first} riu tanto que roncou.` : `"${piada}" — Silêncio. Dava pra ouvir um grilo. ${p.first} só disse: "tá".`, ok ? 'bom' : 'neutro', { scene: { ...sc(L, p, 'piada'), data: { ...sc(L, p, 'piada').data, piada, ok } } });
    },
  },
  {
    id: 'fofocar', label: 'Fofocar', icon: '🤫', group: 'Conversa', cond: (L) => L.player.age >= 8,
    run: (L, p) => {
      const alvo = L.people.find((x) => x.alive && x !== p && x.rel !== 'mae' && x.rel !== 'pai');
      bond(p, rng.int(2, 6));
      L.karma -= 2;
      if (alvo && rng.chance(0.3)) { bond(alvo, -15); lembrar(L, alvo, 'humilhacao', 1, 'Você espalhou fofoca sobre ' + alvo.first + '.'); return O(`A fofoca sobre ${alvo.first} vazou — e adivinha quem foi apontado(a) como fonte? Pois é.`, 'ruim', { scene: sc(L, p, 'fofocar') }); }
      return O(`Você e ${p.first} passaram uma hora falando mal dos outros. Terapêutico.`, 'neutro', { scene: sc(L, p, 'fofocar') });
    },
  },
  {
    id: 'consolar', gesto: 'consolo', label: 'Consolar', icon: '🫂', group: 'Conversa', cond: (L) => L.player.age >= 5,
    run: (L, p) => { bond(p, rng.int(6, 11)); L.karma += 2; lembrar(L, p, 'apoio'); return O(`Você ouviu os desabafos de ${p.first} por horas. Nem olhou o celular. Isso é amor.`, 'bom', { scene: sc(L, p, 'consolar') }); },
  },
  {
    id: 'desculpas', label: 'Pedir desculpas', icon: '🙏', group: 'Conversa', cond: (_L, p) => p.bond < 60 || (p.memo?.rancor ?? 0) >= 20 || !!p.memo?.afastado,
    run: (L, p) => {
      const m = mem(p);
      const ok = rng.chance(chanceDesculpas(L, p));
      const s = sc(L, p, 'desculpas');
      s.data = { ...s.data, ok } as any;
      if (ok) {
        const quebrou = m.promessasQuebradas;
        lembrar(L, p, 'desculpaAceita', 1, 'Você pediu desculpas e foi perdoado(a).');
        bond(p, rng.int(6, 12));
        limitarVinculo(p);
        const ressalva = quebrou >= 1 ? ' Mas avisou: "É a última vez. Da outra vez você também prometeu."' : m.rancor >= 40 ? ' A ferida ainda está aberta; vai levar tempo.' : '';
        return O(`${p.first} aceitou suas desculpas.${ressalva}`, 'bom', { scene: s, react: { npc: { expr: m.rancor >= 40 ? 'serio' : 'triste' } } });
      }
      lembrar(L, p, 'desculpaRecusada');
      bond(p, -2);
      const fala = m.promessasQuebradas >= 2 ? `"Você já me pediu desculpas ${m.desculpas + m.desculpasRecusadas} vezes. E continua fazendo."` : m.medo >= 40 ? '"Fica longe de mim."' : '"Desculpa não conserta nada."';
      return O(`${p.first} ouviu tudo e respondeu: ${fala} Saiu andando.`, 'ruim', { scene: s, mood: 'triste', react: { npc: { expr: m.medo >= 40 ? 'assustado' : 'desprezo' } } });
    },
  },
  {
    id: 'massagem', gesto: 'carinho', label: 'Fazer massagem', icon: '💆', group: 'Carinho', cond: (L, p) => L.player.age >= 14 && ['namorado', 'namorada', 'conjuge', 'mae', 'pai', 'avo', 'avoM'].includes(p.rel),
    run: (L, p) => { bond(p, rng.int(6, 10)); return O(`${p.first} derreteu na massagem. Você descobriu um nó nas costas do tamanho de uma noz.`, 'bom', { scene: sc(L, p, 'massagem') }); },
  },
  {
    id: 'serenata', gesto: 'romance', label: 'Fazer serenata', icon: '🎸', group: 'Carinho', cond: (L, p) => L.player.age >= 13 && ['namorado', 'namorada', 'conjuge', 'amigo', 'amiga'].includes(p.rel),
    run: (L, p) => {
      const ok = rng.chance(0.4 + (L.flags.musica ? 0.3 : 0));
      bond(p, ok ? rng.int(10, 16) : -4);
      const s = sc(L, p, 'serenata');
      s.data = { ...s.data, ok } as any;
      return ok ? O(`Serenata impecável. ${p.first} chorou, a vizinha chorou, até o cachorro uivou junto.`, 'especial', { scene: s })
        : O(`Você desafinou tanto que o vizinho jogou um chinelo. ${p.first} fingiu que não te conhecia.`, 'ruim', { scene: s });
    },
  },
  // ---------------- agressões (com consequências reais)
  ...(Object.keys(AGGRO) as AggroKind[]).map((k): Interaction => ({
    id: 'agg_' + k,
    label: AGGRO[k].label,
    icon: AGGRO[k].icon,
    group: 'Agressão',
    cond: (L, p) => L.player.age >= (k === 'xingar' || k === 'empurrar' ? 4 : k === 'roubar' ? 8 : 6) && !(k === 'roubar' && p.age < 10),
    run: (L, p) => aggress(L, p, k),
  })),
  // ---------------- amor (namoro, noivado, casamento, separação) — ver docs/RELACIONAMENTOS.md
  {
    id: 'paquerar', label: 'Chamar para sair', icon: '💌', group: 'Amor',
    cond: (L, p) => !partner(L) && ['amigo', 'amiga', 'conhecido', 'colega', 'colegaTrab'].includes(p.rel) && podeNamorar(L, p) && !p.memo?.afastado,
    run: (L, p) => {
      const m = mem(p);
      const chance = 0.18 + p.bond / 260 + L.stats.aparencia / 400 + m.gratidao / 400 - m.rancor / 90 - m.medo / 80 + (L.stats.felicidade > 70 ? 0.05 : 0);
      if (rng.chance(Math.max(0.03, chance))) {
        const doTrabalho = p.rel === 'colegaTrab';
        p.rel = p.sex === 'f' ? 'namorada' : 'namorado';
        p.metAt = L.player.age;
        bond(p, rng.int(8, 14));
        limitarVinculo(p);
        stat(L, 'felicidade', 10);
        addLog(L, `Comecei a namorar ${p.first}.`, 'especial', '💘');
        return O(`${p.first} disse sim! O "vamos tomar um café" virou namoro.${doTrabalho ? ' Romance no trabalho: o RH ainda não sabe.' : ''}`, 'especial', { scene: { id: 'encontro', others: [p], data: { first: true, good: true } }, log: false });
      }
      bond(p, -rng.int(2, 6));
      stat(L, 'felicidade', -6);
      lembrar(L, p, 'rejeicao');
      return O(rng.pick([`${p.first} respondeu: "Te vejo como amigo(a)". A friendzone tem vista pro mar, pelo menos.`, `${p.first} riu, achando que era piada. Não era.`, `${p.first} disse que "não está num bom momento". O bom momento durou até sábado, com outra pessoa.`]), 'ruim', { scene: { id: 'encontro', others: [p], data: { first: true, good: false } }, mood: 'triste' });
    },
  },
  {
    id: 'encontro', gesto: 'romance', label: 'Encontro romântico', icon: '🍷', group: 'Amor',
    cond: (L, p) => romantic(p) && L.player.age >= 14,
    run: (L, p) => {
      const custo = L.player.age >= 18 ? 250 : 40;
      L.money -= custo;
      if (rng.chance(0.15)) { bond(p, -2); return O(`O restaurante perdeu a reserva, choveu e o carro de aplicativo cancelou três vezes. ${p.first} riu no fim. Você não.`, 'neutro', { scene: { id: 'encontro', others: [p], data: { good: false, line: 'Pelo menos a companhia é boa...' } } }); }
      bond(p, rng.int(7, 13));
      stat(L, 'felicidade', 6);
      return O(`Jantar, conversa boa e aquela troca de olhares. Custou ${money(custo)} e valeu cada centavo.`, 'bom', { scene: { id: 'encontro', others: [p], data: { good: true } } });
    },
  },
  {
    id: 'dr', label: 'Conversar sobre a relação', icon: '🗣️', group: 'Amor',
    cond: (L, p) => romantic(p) && L.player.age >= 16,
    run: (L, p) => {
      const m = mem(p);
      if (m.afastado) return O(`${p.first} não quer conversar. Nem sobre a relação, nem sobre o tempo.`, 'ruim', { mood: 'tenso' });
      const ok = rng.chance(0.45 + p.bond / 250 + m.confianca / 300 - m.rancor / 200);
      if (ok) {
        m.rancor = Math.max(0, m.rancor - rng.int(8, 15));
        m.confianca = Math.min(100, m.confianca + 4);
        bond(p, rng.int(3, 7));
        limitarVinculo(p);
        return O('Duas horas de "a gente precisa conversar". Choro, sinceridade e um acordo: lavar a louça é dos dois. A relação respirou.', 'bom', { scene: sc(L, p, 'conversar'), react: { npc: { expr: 'aliviado' } } });
      }
      lembrar(L, p, 'discussao', 1, 'A conversa sobre a relação virou briga.');
      bond(p, -rng.int(4, 9));
      return O('A DR virou briga, a briga virou lista de defeitos, a lista virou "e a sua mãe, hein?". Todos perderam.', 'ruim', { scene: sc(L, p, 'discutir'), mood: 'tenso' });
    },
  },
  {
    id: 'pedirCasamento', label: 'Pedir em casamento', icon: '💍', group: 'Amor',
    cond: (L, p) => (p.rel === 'namorado' || p.rel === 'namorada') && L.player.age >= 18 && p.age >= 18 && p.memo?.noivado === undefined,
    run: (L, p) => {
      const m = mem(p);
      const anos = L.player.age - (p.metAt ?? L.player.age);
      const alianca = L.money >= 3000 ? 3000 : 0;
      L.money -= alianca;
      const chance = 0.1 + p.bond / 170 + Math.min(3, anos) * 0.08 + m.confianca / 400 - m.rancor / 70 - m.medo / 60 - (anos < 1 ? 0.25 : 0) - (alianca ? 0 : 0.08);
      if (rng.chance(Math.max(0.02, chance))) {
        lembrar(L, p, 'noivado', 1, 'Vocês ficaram noivos.');
        bond(p, 10);
        limitarVinculo(p);
        stat(L, 'felicidade', 14);
        addLog(L, `${p.first} disse SIM! Estamos noivos.`, 'especial', '💍');
        return O(`De joelhos, no meio do restaurante, ${alianca ? 'com uma aliança de ' + money(alianca) : 'com um anel de latinha de refrigerante'}. ${p.first} chorou e disse SIM. Agora é marcar a data (Relações → ${p.first} → "Marcar o casamento").`, 'especial', { scene: { id: 'encontro', others: [p], data: { good: true, line: 'Quer casar comigo?' } }, log: false, react: { npc: { expr: 'chorando', emote: 'coracao' } } });
      }
      lembrar(L, p, 'pedidoRecusado', 1, 'Seu pedido de casamento foi recusado.');
      bond(p, -8);
      stat(L, 'felicidade', -14);
      const termina = m.rancor >= 30 || p.bond < 40 || anos < 1 ? rng.chance(0.5) : rng.chance(0.15);
      if (termina) {
        const extra = encerrarRelacao(L, p, 'parceiro');
        return O(`${p.first} olhou a aliança, olhou pra você e disse: "Acho que a gente precisa terminar". Na frente do garçom. ${extra}`.trim(), 'ruim', { scene: { id: 'termino', others: [p] }, mood: 'triste', log: false });
      }
      return O(`${p.first} disse "ainda não estou pronto(a)". O restaurante inteiro fingiu não ouvir.${alianca ? ' A aliança não tem devolução.' : ''}`, 'ruim', { scene: { id: 'encontro', others: [p], data: { good: false, line: 'Quer casar comigo?' } }, mood: 'triste' });
    },
  },
  {
    id: 'casar', label: 'Marcar o casamento', icon: '💒', group: 'Amor',
    cond: (_L, p) => (p.rel === 'namorado' || p.rel === 'namorada') && p.memo?.noivado !== undefined,
    run: (_L, p) => ({ text: `Hora de decidir como vai ser o grande dia com ${p.first}.`, tone: 'neutro', log: false, skipCard: true, followUp: { ev: EVENTO_CASAMENTO, ctx: { person: p } } }),
  },
  {
    id: 'terminar', label: 'Terminar namoro', icon: '💔', group: 'Amor', cond: (_L, p) => p.rel === 'namorado' || p.rel === 'namorada',
    run: (L, p) => {
      const amava = p.bond >= 60 && (p.memo?.rancor ?? 0) < 30;
      const extra = encerrarRelacao(L, p, 'jogador');
      const txt = amava ? `${p.first} não esperava. Chorou, perguntou "o que eu fiz?" e você não soube responder.` : `${p.first} só disse "finalmente". Ninguém ficou surpreso(a).`;
      return O(`${txt} ${extra}`.trim(), 'ruim', { scene: { id: 'termino', others: [p] }, react: { npc: { expr: amava ? 'chorando' : 'serio' } }, mood: 'triste', log: false });
    },
  },
  {
    id: 'divorcio', label: 'Pedir o divórcio', icon: '⚖️', group: 'Amor', cond: (_L, p) => p.rel === 'conjuge',
    run: (L, p) => {
      const consensual = p.bond < 35 || (p.memo?.rancor ?? 0) >= 50;
      const extra = encerrarRelacao(L, p, 'jogador', { consensual });
      return O(consensual ? `${p.first} assinou sem discutir: "Eu ia pedir primeiro". Divórcio amigável — dentro do possível. ${extra}` : `${p.first} não aceitou bem. Advogados, audiências e uma discussão épica sobre quem fica com a air fryer. ${extra}`, 'ruim', { scene: { id: 'termino', others: [p] }, mood: 'triste', log: false, react: { npc: { expr: consensual ? 'serio' : 'furioso' } } });
    },
  },
  {
    id: 'reatar', label: 'Tentar voltar', icon: '🔁', group: 'Amor',
    cond: (L, p) => p.rel === 'ex' && !partner(L) && podeNamorar(L, p) && !p.memo?.afastado,
    run: (L, p) => {
      const m = mem(p);
      const chance = p.bond / 160 + m.gratidao / 300 + m.confianca / 400 - m.rancor / 70 - (m.terminos ?? 0) * 0.08 - (m.divorcio !== undefined ? 0.1 : 0);
      if (rng.chance(Math.max(0.03, chance))) {
        lembrar(L, p, 'reconciliacao', 1, 'Vocês reataram.');
        p.rel = p.sex === 'f' ? 'namorada' : 'namorado';
        p.metAt = L.player.age;
        bond(p, 8);
        limitarVinculo(p);
        stat(L, 'felicidade', 8);
        return O(`${p.first} topou tentar de novo. Os amigos já apostam quanto tempo dura.`, 'bom', { scene: { id: 'encontro', others: [p], data: { good: true, line: 'Dessa vez vai ser diferente.' } } });
      }
      bond(p, -4);
      stat(L, 'felicidade', -6);
      return O(`${p.first} respondeu: "Ex é ex por um motivo". E visualizou o resto sem responder.`, 'ruim', { mood: 'triste' });
    },
  },
];

// ---------------- memória: gestos positivos passam pela reação da pessoa (ver game/relacoes.ts)
function recusa(L: Life, p: Person, r: Reacao): Outcome {
  const m = mem(p);
  bond(p, -1);
  if (r.motivo === 'causador') m.rancor = Math.min(100, m.rancor + 3);
  if (r.motivo === 'afastado') return O(r.texto!, 'ruim', { mood: 'triste', title: 'Sem resposta' });
  const titulo = r.motivo === 'medo' ? 'Com medo de você' : r.motivo === 'causador' ? 'Não de você' : r.motivo === 'cansou' ? 'Deu por hoje' : 'Recusado';
  return O(r.texto!, 'ruim', {
    title: titulo, scene: sc(L, p, 'conversar'), mood: 'tenso',
    react: { npc: { expr: r.motivo === 'medo' ? 'assustado' : r.motivo === 'causador' ? 'triste' : 'desprezo', motion: r.motivo === 'medo' ? 'nervoso' : 'bracosCruzados' }, player: { expr: 'envergonhado' } },
  });
}
for (const it of INTERACTIONS) {
  if (!it.gesto) continue;
  const original = it.run;
  const gesto = it.gesto;
  it.run = (L, p) => {
    const r = reacao(L, p, gesto);
    if (!r.aceita) return recusa(L, p, r);
    const antes = p.bond;
    const o = original(L, p);
    const ganho = p.bond - antes;
    if (ganho > 0) p.bond = antes + Math.max(1, Math.round(ganho * r.fator));
    limitarVinculo(p);
    contarGesto(L, p);
    if (r.nota && o.tone !== 'ruim') o.text += ' ' + r.nota;
    return o;
  };
}

/** Evento encadeado pela interação "Marcar o casamento". */
const EVENTO_CASAMENTO: LifeEvent = {
  id: 'casamentoNoivos', min: 18, max: 120, weight: 0, icon: '💒', title: 'O grande dia',
  text: (_L, c) => `Você e ${c.person!.first} vão se casar. Como vai ser?`,
  choices: [
    { label: 'Festa grande (R$ 25 mil)', icon: '🎉', cond: (L) => L.money >= 25000, run: (L, c) => casar(L, c.person!, 25000, 'Festa com 200 convidados, 180 que você não conhece e um tio dançando no palco. Inesquecível — e parcelado.') },
    { label: 'Cartório e churrasco (R$ 2 mil)', icon: '🍖', run: (L, c) => casar(L, c.person!, 2000, 'Cartório de manhã, churrasco à tarde, pagode à noite. O juiz de paz errou seu nome duas vezes.') },
    { label: 'Adiar mais um pouco', icon: '⏳', run: (_L, c) => { const p = c.person!; bond(p, -6); mem(p).rancor = Math.min(100, mem(p).rancor + 6); return O(`${p.first} disse que entende. Não entende.`, 'neutro', { mood: 'tenso' }); } },
    { label: 'Desistir do casamento', icon: '🏃', run: (L, c) => { const p = c.person!; lembrar(L, p, 'humilhacao', 1, 'Você desistiu do casamento.'); const extra = encerrarRelacao(L, p, 'jogador'); return O(`Você desmarcou tudo. ${p.first} devolveu a aliança pelo correio, sem remetente. ${extra}`.trim(), 'ruim', { scene: { id: 'termino', others: [p] }, mood: 'triste', log: false }); } },
  ],
};
function casar(L: Life, p: Person, custo: number, texto: string): Outcome {
  L.money -= custo;
  p.rel = 'conjuge';
  lembrar(L, p, 'casamento', 1, 'Vocês se casaram.');
  bond(p, 12);
  limitarVinculo(p);
  stat(L, 'felicidade', 15);
  addLog(L, `Casei com ${p.first}!`, 'especial', '💒');
  return O(texto, 'especial', { scene: { id: 'casamento', others: [p] }, log: false });
}

export function relLabel(p: Person) {
  return REL_LABEL[p.rel];
}

void he;
