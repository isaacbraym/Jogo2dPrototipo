import { Life, stat, bond, addLog, parents, children, partner, money, byRel, makePerson, he, Tone, Person, enrollSchool, leaveJobPeople } from './state';
import { EVENTS } from './events';
import { PendingEvent, SceneReq, Outcome, Action, LifeEvent, EvCtx } from './types';
import { rng } from '../core/rng';
import { clamp } from '../core/math';
import { CAREERS } from './careers';
import { inherit } from '../character/appearance';

export interface YearResult {
  scene: SceneReq;
  notes: { text: string; tone: Tone; icon: string }[];
  events: PendingEvent[];
  died: boolean;
  milestone?: string;
}

const MILESTONES: Record<number, string> = {
  1: 'Primeiro aninho!', 3: 'Já sei falar tudo!', 6: 'Hora da escola', 10: 'Uma década de vida!', 13: 'Bem-vindo(a) à adolescência',
  15: 'Quinze anos!', 18: 'Maioridade!', 21: 'Vinte e um!', 30: 'Trintou!', 40: 'Quarentou!', 50: 'Meio século!', 60: 'Sessentão/Sessentona!',
  70: 'Setenta anos de história', 80: 'Oitenta primaveras', 90: 'Noventa anos!', 100: 'CENTENÁRIO!',
};

export function eligible(L: Life, ev: LifeEvent) {
  if (L.player.age < ev.min || L.player.age > ev.max) return 0;
  if (ev.once && L.flags['ev_' + ev.id]) return 0;
  if (ev.cond && !ev.cond(L)) return 0;
  return typeof ev.weight === 'function' ? ev.weight(L) : ev.weight;
}

export function pickEvents(L: Life, max = 2): PendingEvent[] {
  const out: PendingEvent[] = [];
  const pool = EVENTS.map((e) => [e, eligible(L, e)] as const).filter(([, w]) => w > 0);
  // eventos obrigatórios (peso >= 100)
  for (const [e, w] of pool) {
    if (w >= 100 && out.length < 3) {
      const ctx = e.setup ? e.setup(L) : {};
      if (ctx) out.push({ ev: e, ctx });
    }
  }
  const rest = pool.filter(([e, w]) => w < 100 && !out.some((o) => o.ev === e));
  const n = out.length ? 0 : rng.weighted([[0, 2], [1, 5], [2, 2]] as const);
  for (let i = 0; i < Math.min(n, max) && rest.length; i++) {
    const e = rng.weighted(rest.map(([ev, w]) => [ev, w] as const));
    const idx = rest.findIndex(([ev]) => ev === e);
    rest.splice(idx, 1);
    const ctx = e.setup ? e.setup(L) : {};
    if (ctx) out.push({ ev: e, ctx });
  }
  for (const o of out) if (o.ev.once) L.flags['ev_' + o.ev.id] = 1;
  return out;
}

export function ageUp(L: Life): YearResult {
  const notes: YearResult['notes'] = [];
  const note = (text: string, tone: Tone, icon: string) => { notes.push({ text, tone, icon }); addLog(L, text, tone, icon); };
  L.player.age++;
  L.yearsActions = 0;
  const age = L.player.age;
  for (const p of L.people) if (p.alive) p.age++;
  for (const p of L.pets) if (p.alive) p.age++;

  // ---- estatísticas naturais
  stat(L, 'felicidade', Math.round((62 - L.stats.felicidade) * 0.08) + rng.int(-3, 3));
  if (age > 45) stat(L, 'saude', -rng.int(0, age > 70 ? 5 : 3));
  else stat(L, 'saude', Math.round((75 - L.stats.saude) * 0.05) + rng.int(-2, 2));
  if (age > 55) stat(L, 'aparencia', -rng.int(0, 2));
  if (age < 22) stat(L, 'inteligencia', rng.int(0, 3));
  L.fitness = clamp(L.fitness - 3, 0, 100);

  // ---- educação
  if (age === 14 && L.edu.stage === 'fundamental') { L.edu.stage = 'medio'; note('Comecei o ensino médio.', 'neutro', '🏫'); }
  if (age >= 6 && age < 18 && L.edu.stage === 'nenhum') L.edu.stage = 'fundamental';
  if (age === 6 || age === 14) enrollSchool(L);
  if (age === 18) L.people.filter((x) => x.rel === 'colega' || x.rel === 'professor').forEach((x) => (x.rel = 'conhecido'));
  if (age < 18 && (L.flags.infracoes as number) > 0) L.flags.infracoes = Math.max(0, (L.flags.infracoes as number) - 1);
  if (L.edu.stage === 'faculdade') {
    L.flags.anosFacul = ((L.flags.anosFacul as number) ?? 0) + 1;
    // mensalidade: pais ajudam se o vínculo for bom
    const help = parents(L).some((p) => p.bond > 55) ? 0.5 : 0;
    L.money -= Math.round(5000 * (1 - help));
  }
  L.edu.nota = clamp(L.edu.nota + Math.round((L.stats.inteligencia - L.edu.nota) * 0.2), 0, 100);

  // ---- trabalho e dinheiro
  if (L.job && !L.crime.preso) {
    const j = L.job;
    j.years++;
    j.perf = clamp(j.perf + rng.int(-10, 6), 0, 100);
    const net = Math.round(j.salary * 0.62);
    L.money += net;
    if (j.perf < 15 && rng.chance(0.5)) {
      note(`Fui demitido(a) do cargo de ${j.title}. Desempenho "abaixo das expectativas", disseram.`, 'ruim', '📦');
      L.job = null;
      leaveJobPeople(L);
      stat(L, 'felicidade', -12);
    }
  } else if (L.retired) {
    L.money += (L.flags.aposentadoria as number) ?? 15000;
  } else if (age >= 21 && L.edu.stage !== 'faculdade') {
    // bicos e ajuda da família amortecem o custo de vida
    L.money -= parents(L).length ? 1500 : 2500;
  }
  if (age < 18) {
    // mesada eventual
    if (rng.chance(0.3)) L.money += rng.int(1, 5) * 20;
  }
  if (L.assets.casa) L.assets.casa.valor = Math.round(L.assets.casa.valor * rng.range(1.01, 1.06));
  if (L.assets.carro) L.assets.carro.valor = Math.round(L.assets.carro.valor * 0.88);
  if (L.money < -15000) {
    stat(L, 'felicidade', -4);
    const last = (L.flags.avisoDivida as number) ?? -99;
    if (age - last >= 4) { note('As dívidas estão tirando meu sono.', 'ruim', '💸'); L.flags.avisoDivida = age; }
  }

  // ---- relacionamentos
  for (const p of L.people) {
    if (!p.alive) continue;
    bond(p, -rng.int(1, 4));
    if (p.bond < 12 && (p.rel === 'amigo' || p.rel === 'amiga')) { p.rel = 'colega'; note(`Eu e ${p.first} nos afastamos.`, 'neutro', '🍂'); }
    if (p.bond < 10 && (p.rel === 'namorado' || p.rel === 'namorada' || p.rel === 'conjuge')) {
      note(`${p.first} ${p.rel === 'conjuge' ? 'pediu o divórcio' : 'terminou comigo'}.`, 'ruim', '💔');
      p.rel = 'ex';
      stat(L, 'felicidade', -12);
    }
    // mortes naturais de NPCs muito idosos (pais são tratados por evento)
    if (!['mae', 'pai', 'avo', 'avoM'].includes(p.rel) && p.age > 75 && rng.chance((p.age - 75) / 60)) {
      p.alive = false;
      note(`${p.first} faleceu aos ${p.age} anos.`, 'ruim', '🕯️');
      stat(L, 'felicidade', -6);
    }
  }
  for (const pet of L.pets) {
    if (!pet.alive) continue;
    if (pet.age > 10 && rng.chance((pet.age - 10) / 8)) {
      pet.alive = false;
      stat(L, 'felicidade', -10);
      note(`Meu pet ${pet.name} partiu para o céu dos bichinhos.`, 'ruim', '🌈');
    }
  }
  // filhos crescem e às vezes saem de casa
  for (const k of children(L)) if (k.age === 18) note(`${k.first} fez 18 anos e ${he(k, 'foi', 'foi')} para a faculdade.`, 'bom', '🎓');

  // ---- prisão
  if (L.crime.preso) {
    L.crime.pena--;
    stat(L, 'felicidade', -8);
    if (L.crime.pena <= 0) {
      L.crime.preso = false;
      note('Cumpri minha pena. Estou livre!', 'especial', '🕊️');
    }
  }

  // ---- morte
  let died = false;
  const oldRisk = age > 62 ? Math.pow((age - 62) / 38, 3) * 0.55 : 0;
  const sickRisk = L.stats.saude <= 0 ? 0.8 : L.stats.saude < 12 ? 0.18 : 0;
  if (rng.chance(oldRisk + sickRisk) || age >= 118) {
    died = true;
    L.dead = true;
    L.cause = L.stats.saude < 15 ? 'complicações de saúde' : age > 90 ? 'velhice, em paz' : 'causas naturais';
    addLog(L, `Faleci aos ${age} anos (${L.cause}).`, 'especial', '🕊️');
  }

  const events = died || L.crime.preso ? [] : pickEvents(L);
  const milestone = MILESTONES[age];
  const scene: SceneReq = died
    ? { id: 'morte', data: { idade: age } }
    : L.crime.preso
      ? { id: 'cela', data: { titulo: 'Na prisão', sub: `Faltam ${L.crime.pena} ano(s)` } }
      : milestone || age % 10 === 0 || age <= 12
        ? { id: 'aniversario', others: birthdayGuests(L) }
        : { id: 'casa', data: { ageUp: true, mood: L.stats.felicidade > 70 ? 'feliz' : L.stats.felicidade < 30 ? 'triste' : 'neutro' } };
  L.updated = Date.now();
  return { scene, notes, events, died, milestone };
}

function birthdayGuests(L: Life): Person[] {
  const list = [...(L.player.age < 18 ? parents(L) : []), ...(partner(L) ? [partner(L)!] : []), ...children(L), ...byRel(L, 'irmao', 'irma'), ...byRel(L, 'amigo', 'amiga')];
  return list.slice(0, 3);
}

export function resolveAction(L: Life, a: Action): Outcome | PendingEvent | string {
  const cost = typeof a.cost === 'function' ? a.cost(L) : a.cost ?? 0;
  if (cost > 0 && L.money < cost && L.player.age >= 18) return `Você precisa de ${money(cost)} para isso.`;
  if (cost > 0 && L.player.age < 18) {
    const pais = parents(L);
    if (!pais.length) return 'Você não tem quem pague por isso.';
  } else if (cost > 0) L.money -= cost;
  L.yearsActions++;
  return a.run(L);
}

export function isPending(x: unknown): x is PendingEvent {
  return !!x && typeof x === 'object' && 'ev' in (x as any);
}

/** Continua a vida como um dos filhos (herança de geração). */
export function continueAsChild(L: Life, kid: Person): Life {
  const r = rng;
  const heranca = Math.max(0, Math.round(L.money * 0.7));
  const nl: Life = {
    ...L,
    id: L.id + '-g' + (L.generation + 1),
    player: { ...kid, rel: 'amigo', bond: 100 },
    stats: { felicidade: r.int(55, 80), saude: r.int(70, 100), inteligencia: r.int(35, 90), aparencia: r.int(40, 90) },
    money: heranca,
    karma: 50, fitness: 30, fame: 0,
    people: [],
    pets: [],
    log: [],
    edu: { stage: kid.age >= 18 ? 'formado' : kid.age >= 14 ? 'medio' : kid.age >= 6 ? 'fundamental' : 'nenhum', nota: 60 },
    job: null, retired: false, jobHistory: [], assets: L.assets.casa ? { casa: L.assets.casa } : {},
    crime: { ficha: 0, preso: false, pena: 0 }, flags: {}, dead: false, cause: undefined, generation: L.generation + 1, yearsActions: 0, licenca: kid.age >= 18,
  };
  // pais: o jogador anterior (falecido) e o cônjuge
  const sp = L.people.find((p) => p.rel === 'conjuge' && p.alive);
  if (sp) nl.people.push({ ...sp, rel: sp.sex === 'f' ? 'mae' : 'pai', bond: 80 });
  for (const s of children(L)) if (s.id !== kid.id) nl.people.push({ ...s, rel: s.sex === 'f' ? 'irma' : 'irmao', bond: 60 });
  addLog(nl, `Após a morte de ${L.player.first}, herdei ${money(heranca)} e sigo em frente.`, 'especial', '🌳');
  return nl;
}

/**
 * Efeitos de estado de APRESENTAR um resultado (diário + humor da próxima cena em casa).
 * Fonte única usada pela tela do jogo (ui/game.ts) e pelo painel de QA, para que o painel
 * reproduza exatamente o que o jogo faz.
 */
export function registrarResultado(L: Life, o: Outcome) {
  if (o.log !== false) addLog(L, o.text, o.tone, o.icon ?? (o.tone === 'bom' ? '😊' : o.tone === 'ruim' ? '😣' : o.tone === 'especial' ? '⭐' : '•'));
  if (o.mood) L.flags.moodNext = o.mood;
}

export function outcomeFromEvent(L: Life, pe: PendingEvent, choiceIdx: number | null): Outcome {
  const { ev, ctx } = pe;
  if (choiceIdx === null) return ev.auto!(L, ctx);
  return ev.choices![choiceIdx].run(L, ctx);
}

export function evChoices(L: Life, pe: PendingEvent) {
  return (pe.ev.choices ?? []).map((c, i) => ({ c, i, ok: !c.cond || c.cond(L, pe.ctx) }));
}

export function newbornSibling(L: Life) {
  const mom = byRel(L, 'mae')[0], dad = byRel(L, 'pai')[0];
  if (!mom || !dad) return;
  const sex = rng.chance(0.5) ? 'f' : 'm';
  const s = makePerson(rng, { sex, age: 0, rel: sex === 'f' ? 'irma' : 'irmao', last: L.player.last, bond: 70 });
  s.ap = inherit(rng, mom.ap, dad.ap, sex);
  L.people.push(s);
  return s;
}

export type { EvCtx };
void CAREERS;
