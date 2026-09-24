import { Appearance, Sex, relativeOf, randomAppearance, cloneAppearance, inherit } from '../character/appearance';
import { RNG, rng } from '../core/rng';
import { clamp } from '../core/math';
import { NOMES_F, NOMES_M, SOBRENOMES } from './names';
import type { CastMember } from '../scenes/situations';
import type { Memoria } from './relacoes';

export type StatKey = 'felicidade' | 'saude' | 'inteligencia' | 'aparencia';
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ['felicidade', 'saude', 'inteligencia', 'aparencia'];
export const STAT_LABEL: Record<StatKey, string> = { felicidade: 'Felicidade', saude: 'Saúde', inteligencia: 'Inteligência', aparencia: 'Aparência' };

export type Rel =
  | 'mae' | 'pai' | 'irmao' | 'irma' | 'amigo' | 'amiga' | 'namorado' | 'namorada' | 'conjuge' | 'ex' | 'filho' | 'filha' | 'colega' | 'avo' | 'avoM'
  | 'chefe' | 'colegaTrab' | 'professor' | 'conhecido';

export const REL_LABEL: Record<Rel, string> = {
  mae: 'Mãe', pai: 'Pai', irmao: 'Irmão', irma: 'Irmã', amigo: 'Amigo', amiga: 'Amiga', namorado: 'Namorado', namorada: 'Namorada',
  conjuge: 'Cônjuge', ex: 'Ex', filho: 'Filho', filha: 'Filha', colega: 'Colega de escola', avo: 'Avô', avoM: 'Avó',
  chefe: 'Chefe', colegaTrab: 'Colega de trabalho', professor: 'Professor(a)', conhecido: 'Conhecido(a)',
};

export interface Person {
  id: string;
  first: string;
  last: string;
  sex: Sex;
  age: number;
  alive: boolean;
  ap: Appearance;
  rel: Rel;
  bond: number; // 0..100
  traits: string[];
  job?: string;
  money?: number;
  metAt?: number;
  /** memória do que o jogador fez com esta pessoa (opcional; criada sob demanda — ver game/relacoes.ts) */
  memo?: Memoria;
}

export interface Pet {
  id: string;
  name: string;
  kind: 'cachorro' | 'gato';
  color: string;
  age: number;
  bond: number;
  alive: boolean;
}

export type Tone = 'bom' | 'ruim' | 'neutro' | 'especial';
export interface LogEntry {
  age: number;
  text: string;
  tone: Tone;
  icon?: string;
}

export interface Job {
  id: string;
  title: string;
  salary: number;
  perf: number;
  years: number;
  level: number;
}

export interface Life {
  version: 1;
  id: string;
  created: number;
  updated: number;
  player: Person;
  stats: Stats;
  money: number;
  karma: number;
  fitness: number;
  fame: number;
  people: Person[];
  pets: Pet[];
  log: LogEntry[];
  edu: { stage: 'nenhum' | 'fundamental' | 'medio' | 'faculdade' | 'formado'; curso?: string; nota: number; faculdade?: boolean };
  job: Job | null;
  retired: boolean;
  jobHistory: string[];
  assets: { casa?: { nome: string; valor: number }; carro?: { nome: string; valor: number; cor: string } };
  crime: { ficha: number; preso: boolean; pena: number };
  flags: Record<string, number | boolean | string>;
  city: string;
  dead: boolean;
  cause?: string;
  generation: number;
  yearsActions: number; // ações feitas neste ano
  licenca: boolean;
  seed: number;
}

let uid = Date.now() % 100000;
/** Reinicia o contador de ids (usado só pelo painel de QA para reproduções determinísticas). */
export function resetIds(start: number) {
  uid = start;
}
export const newId = () => (++uid).toString(36) + Math.floor(Math.random() * 1e6).toString(36);

export function randomName(r: RNG, sex: Sex) {
  return r.pick(sex === 'f' ? NOMES_F : NOMES_M);
}

export function makePerson(r: RNG, o: { sex?: Sex; age: number; rel: Rel; last?: string; ap?: Appearance; first?: string; bond?: number }): Person {
  const sex = o.sex ?? (r.chance(0.5) ? 'f' : 'm');
  return {
    id: newId(),
    first: o.first ?? randomName(r, sex),
    last: o.last ?? r.pick(SOBRENOMES),
    sex,
    age: o.age,
    alive: true,
    ap: o.ap ?? randomAppearance(r, sex),
    rel: o.rel,
    bond: o.bond ?? r.int(55, 90),
    traits: pickTraits(r),
  };
}

const TRAITS = ['gentil', 'engraçado', 'ciumento', 'ambicioso', 'preguiçoso', 'generoso', 'mandão', 'tímido', 'aventureiro', 'romântico', 'rabugento', 'leal'];
function pickTraits(r: RNG) {
  const a = r.shuffle([...TRAITS]);
  return a.slice(0, 2);
}

export function newLife(ap: Appearance, first: string, last: string, city: string, startAge = 0): Life {
  const seed = (Math.random() * 1e9) | 0;
  const r = new RNG(seed);
  const player: Person = {
    id: newId(), first, last, sex: ap.sex, age: startAge, alive: true, ap: cloneAppearance(ap), rel: 'amigo', bond: 100, traits: [],
  };
  const momAge = startAge + r.int(21, 36), dadAge = momAge + r.int(-3, 6);
  const mom = makePerson(r, { sex: 'f', age: momAge, rel: 'mae', last: r.pick(SOBRENOMES), ap: relativeOf(r, ap, 'f', 0.62), bond: r.int(70, 95) });
  const dad = makePerson(r, { sex: 'm', age: dadAge, rel: 'pai', last, ap: relativeOf(r, ap, 'm', 0.55), bond: r.int(60, 92) });
  mom.job = r.pick(['Professora', 'Enfermeira', 'Advogada', 'Vendedora', 'Engenheira', 'Artista', 'Contadora', 'Cozinheira']);
  dad.job = r.pick(['Mecânico', 'Professor', 'Motorista', 'Médico', 'Programador', 'Comerciante', 'Policial', 'Pedreiro']);
  mom.money = r.int(2, 60) * 1000;
  dad.money = r.int(2, 60) * 1000;
  const people: Person[] = [mom, dad];
  const nSib = r.weighted([[0, 3], [1, 4], [2, 2]] as const);
  for (let i = 0; i < nSib; i++) {
    const sex: Sex = r.chance(0.5) ? 'f' : 'm';
    const sib = makePerson(r, { sex, age: Math.max(0, startAge + r.int(-6, 8)), rel: sex === 'f' ? 'irma' : 'irmao', last, bond: r.int(45, 85) });
    sib.ap = inherit(r, mom.ap, dad.ap, sex);
    if (sib.age === startAge) sib.age += 2;
    people.push(sib);
  }
  const L: Life = {
    version: 1, id: newId(), created: Date.now(), updated: Date.now(),
    player,
    stats: { felicidade: r.int(70, 95), saude: r.int(75, 100), inteligencia: r.int(35, 90), aparencia: r.int(40, 90) },
    money: 0, karma: 50, fitness: 30, fame: 0,
    people, pets: [], log: [],
    edu: { stage: 'nenhum', nota: 60 },
    job: null, retired: false, jobHistory: [],
    assets: {},
    crime: { ficha: 0, preso: false, pena: 0 },
    flags: {},
    city, dead: false, generation: 1, yearsActions: 0, licenca: false, seed,
  };
  if (startAge >= 18) {
    L.money = r.int(500, 4000) + (startAge >= 30 ? r.int(2, 30) * 1000 : 0);
    L.edu.stage = 'formado';
    L.edu.faculdade = false;
    L.licenca = startAge >= 20 && r.chance(0.7);
  } else if (startAge >= 6) {
    // começa no meio da vida escolar: série correspondente + turma
    L.edu.stage = startAge < 14 ? 'fundamental' : 'medio';
    enrollSchool(L);
  }
  // pais idosos podem já ter falecido quando a vida começa tarde
  for (const pa of [mom, dad]) {
    if (pa.age > 72 && r.chance(Math.min(0.97, (pa.age - 72) / 22))) {
      pa.alive = false;
      addLog(L, `${pa.first}, ${pa.rel === 'mae' ? 'minha mãe' : 'meu pai'}, já faleceu.`, 'ruim', '🕯️');
    }
  }
  if (startAge > 0) addLog(L, `Aos ${startAge} anos, ${first} começa uma nova fase da vida em ${city}.`, 'especial', '🌱');
  else addLog(L, `Nasci em ${city}. Sou filho(a) de ${mom.first} e ${dad.first}.`, 'especial', '👶');
  return L;
}

export function addLog(L: Life, text: string, tone: Tone = 'neutro', icon?: string) {
  L.log.push({ age: L.player.age, text, tone, icon });
  if (L.log.length > 900) L.log.splice(0, L.log.length - 900);
}

export function stat(L: Life, k: StatKey, d: number) {
  L.stats[k] = clamp(Math.round(L.stats[k] + d), 0, 100);
}

export function bond(p: Person, d: number) {
  p.bond = clamp(Math.round(p.bond + d), 0, 100);
}

export const fullName = (p: Person) => `${p.first} ${p.last}`;

export function living(L: Life) {
  return L.people.filter((p) => p.alive);
}
export function byRel(L: Life, ...rels: Rel[]) {
  return L.people.filter((p) => p.alive && rels.includes(p.rel));
}
export function partner(L: Life): Person | undefined {
  return L.people.find((p) => p.alive && (p.rel === 'namorado' || p.rel === 'namorada' || p.rel === 'conjuge'));
}
export function spouse(L: Life): Person | undefined {
  return L.people.find((p) => p.alive && p.rel === 'conjuge');
}
export function parents(L: Life) {
  return byRel(L, 'mae', 'pai');
}
export function children(L: Life) {
  return byRel(L, 'filho', 'filha');
}
export function friends(L: Life) {
  return byRel(L, 'amigo', 'amiga');
}

export function cast(p: Person): CastMember {
  return { ap: p.ap, age: p.age, name: p.first, sex: p.sex };
}

export function playerCast(L: Life): CastMember {
  return { ap: L.player.ap, age: L.player.age, name: L.player.first, sex: L.player.sex };
}

export function money(n: number) {
  const s = Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + ' mi' : Math.abs(n) >= 1e4 ? Math.round(n / 1000) + ' mil' : n.toLocaleString('pt-BR');
  return 'R$ ' + s;
}

export function pickRandom<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(rng.next() * arr.length)] : undefined;
}

export const he = (p: { sex: Sex }, m: string, f: string) => (p.sex === 'f' ? f : m);

/** Cria chefe e colegas ao entrar num emprego (substitui os anteriores). */
export function hireStaff(L: Life, jobTitle: string) {
  L.people.filter((x) => x.rel === 'chefe' || x.rel === 'colegaTrab').forEach((x) => (x.rel = 'conhecido'));
  const r = rng;
  const boss = makePerson(r, { age: Math.max(28, L.player.age + r.int(5, 20)), rel: 'chefe', bond: r.int(35, 60) });
  boss.job = 'Chefe de ' + jobTitle.toLowerCase();
  L.people.push(boss);
  for (let i = 0; i < 2; i++) {
    const c = makePerson(r, { age: Math.max(18, L.player.age + r.int(-6, 8)), rel: 'colegaTrab', bond: r.int(35, 65) });
    c.job = jobTitle;
    L.people.push(c);
  }
  L.flags.advertencias = 0;
}

export function leaveJobPeople(L: Life) {
  L.people.filter((x) => x.rel === 'chefe' || x.rel === 'colegaTrab').forEach((x) => (x.rel = 'conhecido'));
}

/** Turma nova: dois colegas e um(a) professor(a). */
export function enrollSchool(L: Life) {
  L.people.filter((x) => x.rel === 'colega' || x.rel === 'professor').forEach((x) => (x.rel = 'conhecido'));
  const r = rng;
  for (let i = 0; i < 2; i++) L.people.push(makePerson(r, { age: L.player.age + r.int(-1, 1), rel: 'colega', bond: r.int(40, 70) }));
  const prof = makePerson(r, { age: r.int(28, 60), rel: 'professor', bond: r.int(45, 65) });
  prof.job = r.pick(['Matemática', 'Português', 'História', 'Ciências', 'Educação Física']);
  L.people.push(prof);
}
