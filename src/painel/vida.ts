/**
 * Cenários de teste: vidas isoladas, válidas e editáveis (nunca os saves reais).
 */
import { Life, Person, REL_LABEL, Rel, STAT_KEYS, makePerson, hireStaff, enrollSchool, byRel } from '../game/state';
import { CAREERS } from '../game/careers';
import { EVENTS } from '../game/events';
import { LifeEvent } from '../game/types';
import { fixture, Kind, KINDS, BASE_AGE, ROTULO_PERFIL } from '../qa/fixtures';
import { RNG } from '../core/rng';
import { comSemente } from './det';

export interface Cenario {
  formato: 'viva-cenario';
  versao: 1;
  titulo: string;
  alvo: { tipo: 'evento' | 'interacao' | 'acao' | 'agressao' | 'entrevista'; id: string; pessoaId?: string };
  semente: number;
  forcar: { condicao?: boolean; idade?: boolean; unica?: boolean; escolhaDesabilitada?: boolean };
  caminho: number[];
  vida: Life;
  origem: string;
  nota?: string;
  criado: string;
}

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export { KINDS, ROTULO_PERFIL, BASE_AGE };
export type { Kind };

/** Cria uma vida a partir de um perfil de teste, com sorteios semeados (reprodutível). */
export function vidaDoPerfil(kind: Kind, idade: number, semente: number): Life {
  return comSemente(semente, () => clone(fixture(kind, idade)));
}

export function novoCenario(alvo: Cenario['alvo'], vida: Life, origem: string, semente = 1): Cenario {
  return { formato: 'viva-cenario', versao: 1, titulo: `${alvo.tipo} ${alvo.id}`, alvo, semente, forcar: {}, caminho: [], vida: clone(vida), origem, criado: new Date().toISOString() };
}

// ---------------------------------------------------------------- validação de vida
const EDU = ['nenhum', 'fundamental', 'medio', 'faculdade', 'formado'];
export function validarVida(L: any): { erros: string[]; avisos: string[] } {
  const erros: string[] = [], avisos: string[] = [];
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  if (!L || typeof L !== 'object') return { erros: ['vida não é um objeto'], avisos };
  if (L.version !== 1) erros.push('version deve ser 1');
  if (!L.player || typeof L.player !== 'object') erros.push('player ausente');
  else {
    if (!num(L.player.age) || L.player.age < 0 || L.player.age > 130) erros.push('player.age deve ser número 0..130');
    if (!L.player.ap || typeof L.player.ap !== 'object') erros.push('player.ap (aparência) ausente');
    if (L.player.sex !== 'm' && L.player.sex !== 'f') erros.push("player.sex deve ser 'm' ou 'f'");
    if (!L.player.first) erros.push('player.first vazio');
  }
  for (const k of STAT_KEYS) if (!num(L.stats?.[k]) || L.stats[k] < 0 || L.stats[k] > 100) erros.push(`stats.${k} deve ser 0..100`);
  for (const k of ['money', 'karma', 'fitness', 'fame']) if (!num(L[k])) erros.push(`${k} deve ser número`);
  if (!Array.isArray(L.people)) erros.push('people deve ser lista');
  else {
    const ids = new Set<string>();
    L.people.forEach((p: Person, i: number) => {
      const w = `people[${i}]`;
      if (!p.id) erros.push(`${w}.id vazio`);
      else if (ids.has(p.id)) erros.push(`${w}.id duplicado (${p.id})`);
      ids.add(p.id);
      if (!(p.rel in REL_LABEL)) erros.push(`${w}.rel "${p.rel}" inválida (${Object.keys(REL_LABEL).join(', ')})`);
      if (!num(p.age) || p.age < 0) erros.push(`${w}.age inválida`);
      if (!num(p.bond) || p.bond < 0 || p.bond > 100) erros.push(`${w}.bond deve ser 0..100`);
      if (typeof p.alive !== 'boolean') erros.push(`${w}.alive deve ser true/false`);
      if (!p.ap) erros.push(`${w}.ap (aparência) ausente`);
      if (!Array.isArray(p.traits)) erros.push(`${w}.traits deve ser lista`);
    });
  }
  if (!Array.isArray(L.pets)) erros.push('pets deve ser lista');
  if (!Array.isArray(L.log)) erros.push('log deve ser lista');
  if (!L.edu || !EDU.includes(L.edu.stage)) erros.push(`edu.stage deve ser ${EDU.join('/')}`);
  if (L.job !== null && (typeof L.job !== 'object' || !L.job.id)) erros.push('job deve ser null ou { id, title, salary, perf, years, level }');
  if (L.job && !CAREERS.some((c) => c.id === L.job.id)) avisos.push(`job.id "${L.job.id}" não é uma carreira de CAREERS`);
  if (!L.crime || !num(L.crime.ficha) || typeof L.crime.preso !== 'boolean') erros.push('crime deve ter { ficha, preso, pena }');
  if (!L.flags || typeof L.flags !== 'object') erros.push('flags deve ser objeto');
  else for (const [k, v] of Object.entries(L.flags)) if (!['number', 'boolean', 'string'].includes(typeof v)) erros.push(`flags.${k} deve ser número, texto ou booleano`);
  if (!L.assets || typeof L.assets !== 'object') erros.push('assets deve ser objeto');
  if (L.dead) avisos.push('vida marcada como morta');
  return { erros, avisos };
}

// ---------------------------------------------------------------- diff de estado
export interface Mudanca { area: string; campo: string; antes: unknown; depois: unknown }

export function diffVida(A: Life, B: Life): Mudanca[] {
  const out: Mudanca[] = [];
  const cmp = (area: string, campo: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ area, campo, antes: a, depois: b }); };
  for (const k of STAT_KEYS) cmp('atributos', k, A.stats[k], B.stats[k]);
  for (const k of ['money', 'karma', 'fitness', 'fame'] as const) cmp(k === 'money' ? 'dinheiro' : 'atributos', k, A[k], B[k]);
  cmp('carreira', 'job', A.job, B.job);
  cmp('carreira', 'jobHistory', A.jobHistory, B.jobHistory);
  cmp('carreira', 'retired', A.retired, B.retired);
  cmp('educação', 'edu', A.edu, B.edu);
  cmp('crime', 'crime', A.crime, B.crime);
  cmp('vida', 'dead', A.dead, B.dead);
  cmp('vida', 'cause', A.cause, B.cause);
  cmp('bens', 'assets', A.assets, B.assets);
  cmp('vida', 'licenca', A.licenca, B.licenca);
  const fk = new Set([...Object.keys(A.flags), ...Object.keys(B.flags)]);
  for (const k of [...fk].sort()) cmp('flags', k, A.flags[k], B.flags[k]);
  const pa = new Map(A.people.map((p) => [p.id, p])), pb = new Map(B.people.map((p) => [p.id, p]));
  for (const [id, p] of pb) {
    const q = pa.get(id);
    const nome = `${p.first} (${p.rel})`;
    if (!q) { out.push({ area: 'pessoas', campo: `+ ${nome}`, antes: undefined, depois: { rel: p.rel, idade: p.age, vinculo: p.bond } }); continue; }
    cmp('vínculos', `${nome} · bond`, q.bond, p.bond);
    cmp('pessoas', `${nome} · rel`, q.rel, p.rel);
    cmp('pessoas', `${nome} · viva`, q.alive, p.alive);
    cmp('pessoas', `${nome} · emprego`, q.job, p.job);
  }
  for (const [id, q] of pa) if (!pb.has(id)) out.push({ area: 'pessoas', campo: `− ${q.first} (${q.rel})`, antes: q.rel, depois: undefined });
  cmp('pets', 'pets', A.pets, B.pets);
  if (B.log.length > A.log.length) for (const e of B.log.slice(A.log.length)) out.push({ area: 'diário', campo: `${e.icon ?? '•'} ${e.tone}`, antes: undefined, depois: e.text });
  return out;
}

/** Remove campos voláteis (datas) antes de hash/comparação. */
export function estadoObservavel(L: Life) {
  const { created: _c, updated: _u, ...resto } = L;
  return resto;
}

// ---------------------------------------------------------------- elegibilidade e pré-requisitos
export interface Motivo { ok: boolean; rotulo: string; detalhe: string; forcavel: boolean; chave: 'idade' | 'unica' | 'condicao' | 'peso' | 'setup' | 'preso' }

export function motivosEvento(L: Life, ev: LifeEvent): Motivo[] {
  const m: Motivo[] = [];
  const idadeOk = L.player.age >= ev.min && L.player.age <= ev.max;
  m.push({ chave: 'idade', ok: idadeOk, rotulo: 'Idade', detalhe: `jogador tem ${L.player.age}; evento exige ${ev.min}–${ev.max}`, forcavel: true });
  const jaOcorreu = !!(ev.once && L.flags['ev_' + ev.id]);
  m.push({ chave: 'unica', ok: !jaOcorreu, rotulo: 'Uma vez por vida', detalhe: ev.once ? (jaOcorreu ? `flag ev_${ev.id} já marcada` : `ainda não ocorreu (flag ev_${ev.id} ausente)`) : 'evento pode repetir', forcavel: true });
  let condOk = true, condDet = 'sem condição';
  if (ev.cond) {
    try { condOk = !!ev.cond(L); condDet = condOk ? 'cond(L) = verdadeiro' : 'cond(L) = FALSO'; } catch (e) { condOk = false; condDet = 'cond(L) lançou erro: ' + (e as Error).message; }
  }
  m.push({ chave: 'condicao', ok: condOk, rotulo: 'Condição', detalhe: condDet, forcavel: true });
  let peso = 0, pesoDet = '';
  try { peso = typeof ev.weight === 'function' ? ev.weight(L) : ev.weight; pesoDet = `peso = ${peso}${typeof ev.weight === 'function' ? ' (função avaliada nesta vida)' : ''}${peso >= 100 ? ' → obrigatório no ano' : ''}`; } catch (e) { pesoDet = 'peso lançou erro: ' + (e as Error).message; }
  m.push({ chave: 'peso', ok: peso > 0, rotulo: 'Peso no sorteio', detalhe: pesoDet + (peso > 0 ? '' : ' → nunca é sorteado nesta vida'), forcavel: true });
  m.push({ chave: 'preso', ok: !L.crime.preso, rotulo: 'Fora da prisão', detalhe: L.crime.preso ? 'jogador preso: o motor anual não sorteia eventos' : 'ok', forcavel: true });
  return m;
}

export interface Requisito { texto: string; valorAtual: string; ok: boolean | null; ajuda?: { rotulo: string; aplicar: (L: Life) => void } }

/** Lê o código de cond/weight/setup e aponta o que ele consulta na vida (análise textual, não eval). */
export function requisitosDoCodigo(L: Life, ev: LifeEvent): { fonte: string; requisitos: Requisito[]; precursores: { evento: string; flag: string }[] } {
  const fonte = [ev.cond ? 'cond: ' + ev.cond.toString() : '', typeof ev.weight === 'function' ? 'weight: ' + ev.weight.toString() : '', ev.setup ? 'setup: ' + ev.setup.toString() : ''].filter(Boolean).join('\n');
  const req: Requisito[] = [];
  const flags = new Set([...fonte.matchAll(/flags(?:\.(\w+)|\[['`](\w+)['`]\])/g)].map((m) => m[1] ?? m[2]).filter((f) => f !== 'ev_'));
  const precursores: { evento: string; flag: string }[] = [];
  for (const f of flags) {
    const v = L.flags[f];
    req.push({ texto: `flag ${f}`, valorAtual: v === undefined ? '(ausente)' : JSON.stringify(v), ok: v !== undefined ? null : false });
    for (const e of EVENTS) if (e !== ev && eventoEscreveFlag(e, f)) precursores.push({ evento: e.id, flag: f });
  }
  // pessoas referenciadas por id guardado em flag
  for (const m of fonte.matchAll(/p\.id === L\.flags\.(\w+)/g)) {
    const pid = L.flags[m[1]];
    const p = L.people.find((x) => x.id === pid);
    req.push({ texto: `pessoa com id = flags.${m[1]} (viva)`, valorAtual: p ? `${p.first} (${p.rel}, ${p.alive ? 'viva' : 'morta'})` : '(não encontrada)', ok: !!p?.alive });
  }
  const rels = new Set<string>();
  for (const m of fonte.matchAll(/byRel\(L,\s*([^)]*)\)/g)) for (const r of m[1].matchAll(/'(\w+)'/g)) rels.add(r[1]);
  for (const r of rels) req.push({ texto: `relação "${r}"`, valorAtual: String(byRel(L, r as Rel).length), ok: byRel(L, r as Rel).length > 0, ajuda: { rotulo: `+ pessoa ${r}`, aplicar: (V) => adicionarPessoa(V, r as Rel) } });
  const helpers: [RegExp, string, (L: Life) => number, Rel][] = [
    [/partner\(L\)/, 'parceiro(a) (namoro ou cônjuge)', (V) => V.people.filter((p) => p.alive && ['namorado', 'namorada', 'conjuge'].includes(p.rel)).length, 'namorada'],
    [/spouse\(L\)/, 'cônjuge', (V) => V.people.filter((p) => p.alive && p.rel === 'conjuge').length, 'conjuge'],
    [/parents\(L\)/, 'pai/mãe vivos', (V) => V.people.filter((p) => p.alive && ['mae', 'pai'].includes(p.rel)).length, 'mae'],
    [/children\(L\)/, 'filhos', (V) => V.people.filter((p) => p.alive && ['filho', 'filha'].includes(p.rel)).length, 'filho'],
    [/friends\(L\)/, 'amigos', (V) => V.people.filter((p) => p.alive && ['amigo', 'amiga'].includes(p.rel)).length, 'amigo'],
  ];
  for (const [re, rot, conta, rel] of helpers) if (re.test(fonte)) req.push({ texto: rot, valorAtual: String(conta(L)), ok: conta(L) > 0, ajuda: { rotulo: `+ ${rel}`, aplicar: (V) => adicionarPessoa(V, rel) } });
  if (/L\.job\b/.test(fonte)) req.push({ texto: 'emprego (L.job)', valorAtual: L.job ? `${L.job.title} (${L.job.id})` : 'desempregado(a)', ok: !!L.job, ajuda: { rotulo: '+ emprego (caixa)', aplicar: (V) => darEmprego(V, 'caixa') } });
  if (/L\.retired/.test(fonte)) req.push({ texto: 'aposentado(a)', valorAtual: String(L.retired), ok: null });
  for (const m of fonte.matchAll(/L\.edu\.stage\s*===\s*'(\w+)'/g)) req.push({ texto: `escolaridade = ${m[1]}`, valorAtual: L.edu.stage, ok: L.edu.stage === m[1], ajuda: { rotulo: `edu = ${m[1]}`, aplicar: (V) => { V.edu.stage = m[1] as Life['edu']['stage']; } } });
  for (const m of fonte.matchAll(/L\.money\s*(>=|>|<=|<)\s*([\d_e.]+)/g)) req.push({ texto: `dinheiro ${m[1]} ${m[2]}`, valorAtual: String(L.money), ok: null, ajuda: { rotulo: `dinheiro = ${Number(m[2].replace(/_/g, '')) + (m[1].startsWith('>') ? 1 : -1)}`, aplicar: (V) => { V.money = Number(m[2].replace(/_/g, '')) + (m[1].startsWith('>') ? 1 : -1); } } });
  if (/L\.pets/.test(fonte)) req.push({ texto: 'pets', valorAtual: String(L.pets.filter((p) => p.alive).length), ok: null });
  if (/L\.assets\.casa/.test(fonte)) req.push({ texto: 'casa própria', valorAtual: L.assets.casa ? L.assets.casa.nome : '—', ok: null });
  if (/L\.assets\.carro/.test(fonte)) req.push({ texto: 'carro', valorAtual: L.assets.carro ? L.assets.carro.nome : '—', ok: null });
  return { fonte, requisitos: req, precursores };
}

export function eventoEscreveFlag(e: LifeEvent, flag: string): boolean {
  const re = new RegExp(`flags(?:\\.${flag}|\\[['\`]${flag}['\`]\\])\\s*(=(?!=)|\\+=|-=)`);
  const partes = [e.setup, e.auto, ...(e.choices ?? []).map((c) => c.run)].filter(Boolean) as Function[];
  return partes.some((f) => re.test(f.toString()));
}

// ---------------------------------------------------------------- ajudantes de montagem (usam funções reais)
export function adicionarPessoa(L: Life, rel: Rel, o: { idade?: number; vinculo?: number } = {}) {
  const r = new RNG(L.people.length * 97 + 13);
  const idade = o.idade ?? (['mae', 'pai'].includes(rel) ? L.player.age + 28 : ['filho', 'filha'].includes(rel) ? Math.max(0, L.player.age - 28) : ['avo', 'avoM'].includes(rel) ? L.player.age + 55 : L.player.age);
  const sex = ['mae', 'irma', 'amiga', 'namorada', 'filha', 'avoM'].includes(rel) ? 'f' : ['pai', 'irmao', 'amigo', 'namorado', 'filho', 'avo'].includes(rel) ? 'm' : undefined;
  const p = makePerson(r, { rel, age: idade, bond: o.vinculo ?? 70, sex });
  if (['namorado', 'namorada'].includes(rel)) p.metAt = L.player.age - 3;
  L.people.push(p);
  return p;
}

export function darEmprego(L: Life, careerId: string) {
  const c = CAREERS.find((x) => x.id === careerId) ?? CAREERS[0];
  L.job = { id: c.id, title: c.titles[0], salary: c.salary, perf: 55, years: 1, level: 0 };
  if (!L.jobHistory.includes(c.titles[0])) L.jobHistory.push(c.titles[0]);
  hireStaff(L, c.titles[0]);
}

export function matricular(L: Life) {
  enrollSchool(L);
}

/** Envelhece só a idade (jogador, pessoas e pets), sem rodar o motor anual. */
export function envelhecerSoIdade(L: Life, anos: number) {
  L.player.age += anos;
  for (const p of L.people) if (p.alive) p.age += anos;
  for (const p of L.pets) if (p.alive) p.age += anos;
}

/** Procura uma vida em que o evento seja elegível: perfis de teste × idades da faixa. */
export function procurarVidaValida(ev: LifeEvent, semente: number): { vida: Life; origem: string } | null {
  const idades = [...new Set([ev.min, Math.round((ev.min + ev.max) / 2), Math.min(ev.max, ev.min + 5), ev.max].map((a) => Math.max(0, Math.min(100, a))))];
  for (const idade of idades) {
    for (const k of KINDS) {
      const L = vidaDoPerfil(k, idade, semente);
      const ok = comSemente(semente, () => motivosEvento(L, ev).every((m) => m.ok) && (ev.setup ? ev.setup(clone(L)) !== null : true));
      if (ok) return { vida: L, origem: `perfil "${k}" (${ROTULO_PERFIL[k]}) aos ${idade}` };
    }
  }
  return null;
}

export function pessoaPorId(L: Life, id?: string) {
  return id ? L.people.find((p) => p.id === id) : undefined;
}
