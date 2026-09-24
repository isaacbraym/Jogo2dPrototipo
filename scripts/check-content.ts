/**
 * Validador de conteúdo do VIVA! — roda em Node (sem navegador).
 *
 *   npm run check          → typecheck + este validador (modo completo)
 *   npx tsx scripts/check-content.ts --quick   → menos vidas simuladas
 *
 * O que ele garante (sai com código 1 se houver ERRO):
 *  1. IDs únicos (eventos, ações, interações, situações, carreiras).
 *  2. Toda referência literal no código existe no registro certo:
 *     cena (SITUATIONS), ambiente (ENVS), movimento (MOTIONS), expressão (EXPRESSIONS),
 *     objeto de cena (PROPS), objeto de mão (HELD), partícula (PKind), emote (EmoteKind), som (sfx).
 *  3. Cada movimento e expressão produz números finitos.
 *  4. Todo evento é executado em vários "perfis de vida"; TODA escolha roda pelo menos uma vez,
 *     e cada Outcome (incluindo next/followUp) é validado: textos sem "undefined/NaN",
 *     tom válido, cena existente, react com movimento/expressão/emote válidos, stats finitos.
 *  5. Todas as ações e interações (inclusive agressões) rodam em perfis compatíveis.
 *  6. Toda carreira tem entrevista e a taxa de contratação com respostas aleatórias fica num intervalo jogável.
 *  7. Simulação de vidas inteiras (0 → morte) com escolhas aleatórias sem exceções.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { validarCalibracao, validarContraRegistros } from '../src/qa/calibracao';
import { KF_ORIGINAIS, keyframesDe } from '../src/character/calibracao';
import { validarVida } from '../src/painel/vida';
import { EVENTS } from '../src/game/events';
import { ACTIONS, INTERACTIONS } from '../src/game/activities';
import { CAREERS } from '../src/game/careers';
import { INTERVIEWS, startInterview } from '../src/game/interviews';
import { ageUp, outcomeFromEvent } from '../src/game/life';
import { Life, Person, newLife, STAT_KEYS } from '../src/game/state';
import { fixture, KINDS, Kind } from '../src/qa/fixtures';
import { varrerReferencias, ARQUIVOS_VARRIDOS } from '../src/qa/referencias';
import { Outcome, PendingEvent, LifeEvent, EvCtx } from '../src/game/types';
import { SITUATIONS, Cast } from '../src/scenes/situations';
import { ENVS } from '../src/scenes/environments';
import { MOTIONS } from '../src/character/motions';
import { EXPRESSIONS } from '../src/character/expressions';
import { PROPS, HELD } from '../src/render/props';
import { randomAppearance, defaultAppearance } from '../src/character/appearance';
import { RNG, rng } from '../src/core/rng';
import { sfx } from '../src/core/audio';
import { ESTADO_CALIBRACAO } from '../src/character/calibracao';

const QUICK = process.argv.includes('--quick');
const errors: string[] = [];
const warns: string[] = [];
const err = (m: string) => { if (errors.length < 400) errors.push(m); };
const warn = (m: string) => { if (warns.length < 400) warns.push(m); };

// ------------------------------------------------------------ registros
const src = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const unionOf = (file: string, typeName: string) => {
  const m = src(file).match(new RegExp(`export type ${typeName}\\s*=([^;]+);`));
  return new Set(m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : []);
};
const REG = {
  scene: new Set(Object.keys(SITUATIONS)),
  env: new Set(Object.keys(ENVS)),
  motion: new Set(Object.keys(MOTIONS)),
  expr: new Set(Object.keys(EXPRESSIONS)),
  prop: new Set(Object.keys(PROPS)),
  held: new Set(Object.keys(HELD)),
  fx: unionOf('src/render/particles.ts', 'PKind'),
  emote: unionOf('src/character/actor.ts', 'EmoteKind'),
  sfx: new Set(Object.getOwnPropertyNames(Object.getPrototypeOf(sfx)).filter((k) => typeof (sfx as any)[k] === 'function')),
};
const TONES = new Set(['bom', 'ruim', 'neutro', 'especial']);
const MOODS = new Set(['tenso', 'triste', 'ferido', 'feliz']);

// ------------------------------------------------------------ 0. calibração (src/data/calibracao.json)
for (const e of ESTADO_CALIBRACAO.erros) err(`[calibração] ${e} — corrija src/data/calibracao.json pelo painel de QA`);

// propostas (qa/propostas/*.json) e cenários (qa/cenarios/*.json) entregues por agentes/painel
{
  const regCalib = {
    keyframes: (id: string) => { if (!MOTIONS[id]) return null; const k = KF_ORIGINAIS.get(id) ?? keyframesDe(id); return k ? k.map((f) => f[0]) : undefined; },
    expressao: (id: string) => id in EXPRESSIONS,
  };
  const dirQa = (d: string) => { try { return readdirSync(new URL('../qa/' + d + '/', import.meta.url)).filter((f) => f.endsWith('.json')); } catch { return []; } };
  for (const f of dirQa('propostas')) {
    let j: any;
    try { j = JSON.parse(src('qa/propostas/' + f)); } catch { err(`[proposta] qa/propostas/${f}: JSON inválido`); continue; }
    if (j.formato !== 'viva-proposta' || !Array.isArray(j.variacoes)) { err(`[proposta] qa/propostas/${f}: precisa de "formato": "viva-proposta" e "variacoes": [...]`); continue; }
    for (const v of j.variacoes) {
      const e = validarCalibracao(v.calibracao);
      const e2 = e.length ? [] : validarContraRegistros(v.calibracao, regCalib);
      for (const x of [...e, ...e2]) err(`[proposta] qa/propostas/${f} variação "${v.nome}": ${x}`);
    }
  }
  const alvosValidos: Record<string, (id: string) => boolean> = {
    evento: (id) => EVENTS.some((e) => e.id === id), interacao: (id) => INTERACTIONS.some((i) => i.id === id), agressao: (id) => INTERACTIONS.some((i) => i.id === 'agg_' + id),
    acao: (id) => ACTIONS.some((a) => a.id === id), entrevista: (id) => CAREERS.some((c) => c.id === id),
  };
  for (const f of dirQa('cenarios')) {
    let j: any;
    try { j = JSON.parse(src('qa/cenarios/' + f)); } catch { err(`[cenário] qa/cenarios/${f}: JSON inválido`); continue; }
    if (j.formato !== 'viva-cenario') { err(`[cenário] qa/cenarios/${f}: "formato" deve ser "viva-cenario"`); continue; }
    if (!alvosValidos[j.alvo?.tipo]?.(j.alvo?.id)) err(`[cenário] qa/cenarios/${f}: alvo ${j.alvo?.tipo}:${j.alvo?.id} não existe mais`);
    for (const x of validarVida(j.vida).erros) err(`[cenário] qa/cenarios/${f}: vida inválida — ${x}`);
  }
}

// ------------------------------------------------------------ 1. ids únicos
function uniq(kind: string, ids: string[]) {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) err(`[id] ${kind} duplicado: "${id}"`);
    seen.add(id);
  }
}
uniq('evento', EVENTS.map((e) => e.id));
uniq('ação', ACTIONS.map((a) => a.id));
uniq('interação', INTERACTIONS.map((a) => a.id));
uniq('carreira', CAREERS.map((a) => a.id));
{
  const ids = [...src('src/scenes/situations.ts').matchAll(/^ {4}id: '(\w+)',\s*$/gm)].map((m) => m[1]);
  uniq('situação', ids);
}

// ------------------------------------------------------------ 2. referências literais
type RegKey = keyof typeof REG;
const fontes = Object.fromEntries(ARQUIVOS_VARRIDOS.map((f) => [f, src(f)]));
const refs = varrerReferencias(fontes);
const refCount = refs.length;
for (const r of refs) if (!REG[r.registro as RegKey].has(r.id)) err(`[ref] ${r.registro} "${r.id}" não existe — ${r.arquivo}:${r.linha}`);

// ------------------------------------------------------------ 3. movimentos e expressões numéricos
const finiteDeep = (o: unknown, path: string, bad: string[]) => {
  if (typeof o === 'number') { if (!Number.isFinite(o)) bad.push(path); return; }
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) finiteDeep(v, path + '.' + k, bad);
};
for (const [name, m] of Object.entries(MOTIONS)) {
  const dur = m.dur ?? 4;
  for (let i = 0; i <= 24; i++) {
    const t = (dur * i) / 24;
    let pose;
    try { pose = m.fn(t, { speed: 150, seed: 7 }); } catch (e) { err(`[motion] "${name}" lançou exceção em t=${t.toFixed(2)}: ${(e as Error).message}`); break; }
    const bad: string[] = [];
    finiteDeep(pose, name, bad);
    if (bad.length) { err(`[motion] "${name}" gera valor não finito em t=${t.toFixed(2)}: ${bad.slice(0, 3).join(', ')}`); break; }
  }
  if (m.expr && !REG.expr.has(m.expr)) err(`[motion] "${name}" usa expressão inexistente "${m.expr}"`);
  for (const h of [m.propN, m.propF]) if (h && !REG.held.has(h)) err(`[motion] "${name}" segura objeto inexistente "${h}"`);
}
for (const [name, f] of Object.entries(EXPRESSIONS)) {
  const bad: string[] = [];
  finiteDeep(f, name, bad);
  if (bad.length) err(`[expr] "${name}" tem valor não finito: ${bad.join(', ')}`);
}

// ------------------------------------------------------------ situações: ambiente resolvível
const sampleCast = (age: number): Cast => ({
  player: { ap: defaultAppearance('f'), age, name: 'Ana', sex: 'f' },
  others: [{ ap: defaultAppearance('m'), age: age + 2, name: 'Léo', sex: 'm' }],
  data: {},
});
for (const s of Object.values(SITUATIONS)) {
  for (const age of [0, 8, 16, 30, 75]) {
    try {
      const env = typeof s.env === 'function' ? s.env(sampleCast(age)) : s.env;
      if (!REG.env.has(env)) { err(`[cena] "${s.id}" aponta para ambiente inexistente "${env}" (idade ${age})`); break; }
    } catch (e) { err(`[cena] "${s.id}" env() lançou: ${(e as Error).message}`); break; }
  }
}

// ------------------------------------------------------------ perfis de vida (fixtures)
// ------------------------------------------------------------ validação de Outcome
const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object |\bnull\b/;
function checkText(where: string, t: unknown) {
  if (typeof t !== 'string') { err(`${where}: texto não é string (${typeof t})`); return; }
  if (!t.trim()) err(`${where}: texto vazio`);
  if (BAD_TEXT.test(t)) err(`${where}: texto com lixo de interpolação → "${t.slice(0, 120)}"`);
}
function checkLife(where: string, L: Life) {
  for (const k of STAT_KEYS) {
    const v = L.stats[k];
    if (!Number.isFinite(v)) err(`${where}: stat ${k} = ${v}`);
    else if (v < 0 || v > 100) err(`${where}: stat ${k} fora de 0..100 (${v}) — use stat(L, k, d)`);
  }
  if (!Number.isFinite(L.money)) err(`${where}: dinheiro = ${L.money}`);
  for (const p of L.people) if (!Number.isFinite(p.bond) || p.bond < 0 || p.bond > 100) err(`${where}: vínculo de ${p.first} = ${p.bond} — use bond(p, d)`);
}
function checkReact(where: string, r: Outcome['react']) {
  if (!r) return;
  for (const side of ['npc', 'player'] as const) {
    const x = r[side];
    if (!x) continue;
    if (x.motion && !REG.motion.has(x.motion)) err(`${where}: react.${side}.motion "${x.motion}" não existe`);
    if (x.expr && !REG.expr.has(x.expr)) err(`${where}: react.${side}.expr "${x.expr}" não existe`);
    if (x.emote && !REG.emote.has(x.emote)) err(`${where}: react.${side}.emote "${x.emote}" não existe`);
    if (x.say !== undefined) checkText(`${where} react.${side}.say`, x.say);
  }
}
const scenesUsed = new Map<string, number>();
function checkOutcome(where: string, L: Life, o: Outcome | undefined, depth = 0, explore = true) {
  if (!o) { err(`${where}: run() não retornou Outcome`); return; }
  if (depth > 14) { err(`${where}: cadeia next/followUp profunda demais (loop?)`); return; }
  checkText(where + ' text', o.text);
  if (!TONES.has(o.tone)) err(`${where}: tom inválido "${o.tone}"`);
  if (o.title !== undefined) checkText(where + ' title', o.title);
  if (typeof o.log === 'string') checkText(where + ' log', o.log);
  if (o.mood && !MOODS.has(o.mood)) err(`${where}: mood inválido "${o.mood}"`);
  if (o.scene) {
    if (!REG.scene.has(o.scene.id)) err(`${where}: cena "${o.scene.id}" não existe`);
    scenesUsed.set(o.scene.id, (scenesUsed.get(o.scene.id) ?? 0) + 1);
    if (o.scene.data?.env && !REG.env.has(o.scene.data.env)) err(`${where}: scene.data.env "${o.scene.data.env}" não existe`);
    if (o.scene.data?.action && !REG.motion.has(o.scene.data.action) && !String(o.scene.data.action).match(/^\w+$/)) err(`${where}: scene.data.action estranho`);
  }
  checkReact(where, o.react);
  checkLife(where, L);
  if (o.next) checkOutcome(where + ' → next', L, o.next, depth + 1, explore);
  if (o.followUp) runPending(where + ' → followUp', L, o.followUp, depth + 1, false);
}
function evText(where: string, L: Life, ev: LifeEvent, ctx: EvCtx) {
  checkText(where + ' text()', ev.text(L, ctx));
  checkText(where + ' title', typeof ev.title === 'function' ? ev.title(L, ctx) : ev.title);
  const sc = ev.scene?.(L, ctx);
  if (sc) {
    if (!REG.scene.has(sc.id)) err(`${where}: scene() aponta para cena inexistente "${sc.id}"`);
    scenesUsed.set(sc.id, (scenesUsed.get(sc.id) ?? 0) + 1);
  }
}
/** Executa um evento pendente (seguindo cadeia com escolha aleatória). */
function runPending(where: string, L: Life, pe: PendingEvent, depth: number, _all: boolean) {
  const w = `${where} [${pe.ev.id}]`;
  try {
    evText(w, L, pe.ev, pe.ctx);
    const choices = (pe.ev.choices ?? []).filter((c) => !c.cond || c.cond(L, pe.ctx));
    if (pe.ev.choices && !choices.length && !pe.ev.auto) err(`${w}: nenhuma escolha disponível e sem auto()`);
    const idx = choices.length ? pe.ev.choices!.indexOf(rng.pick(choices)) : null;
    const o = outcomeFromEvent(L, pe, idx);
    checkOutcome(w, L, o, depth, false);
  } catch (e) {
    err(`${w}: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
  }
}

// ------------------------------------------------------------ 4. todos os eventos, todas as escolhas
const agesFor = (ev: LifeEvent) => {
  const lo = Math.max(0, ev.min), hi = Math.min(100, ev.max);
  const s = new Set([lo, hi, Math.round((lo + hi) / 2)]);
  return [...s];
};
const neverReached: string[] = [];
const choicesNeverRun: string[] = [];
for (const ev of EVENTS) {
  let reached = false;
  const ran = new Set<number>();
  for (const age of agesFor(ev)) {
    for (const kind of KINDS) {
      const probe = fixture(kind, age);
      try {
        if (ev.cond && !ev.cond(probe)) continue;
        const w = typeof ev.weight === 'function' ? ev.weight(probe) : ev.weight;
        if (!(w > 0)) continue;
        const ctx = ev.setup ? ev.setup(probe) : {};
        if (ctx === null) continue;
        reached = true;
        evText(`[evento ${ev.id}] idade ${age}/${kind}`, probe, ev, ctx);
        if (ev.auto && !ev.choices) {
          const o = ev.auto(probe, ctx);
          checkOutcome(`[evento ${ev.id}] auto idade ${age}/${kind}`, probe, o);
          ran.add(0);
          continue;
        }
        (ev.choices ?? []).forEach((ch, i) => {
          const L = fixture(kind, age); // vida nova por escolha
          if (ev.cond && !ev.cond(L)) return;
          const c = ev.setup ? ev.setup(L) : {};
          if (c === null) return;
          if (ch.cond && !ch.cond(L, c)) return;
          try {
            const o = ch.run(L, c);
            ran.add(i);
            checkOutcome(`[evento ${ev.id}] escolha "${ch.label}" idade ${age}/${kind}`, L, o);
          } catch (e) {
            err(`[evento ${ev.id}] escolha "${ch.label}" idade ${age}/${kind}: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
          }
        });
      } catch (e) {
        err(`[evento ${ev.id}] idade ${age}/${kind}: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
      }
    }
  }
  if (!reached) neverReached.push(ev.id);
  else (ev.choices ?? []).forEach((ch, i) => { if (!ran.has(i)) choicesNeverRun.push(`${ev.id} → "${ch.label}"`); });
}
if (neverReached.length) warn(`[cobertura] eventos que nenhum perfil de teste alcançou (confira cond/setup): ${neverReached.join(', ')}`);
if (choicesNeverRun.length) warn(`[cobertura] escolhas nunca executadas: ${choicesNeverRun.join('; ')}`);

// ------------------------------------------------------------ 5. ações e interações
for (const a of ACTIONS) {
  let ran = false;
  for (const kind of KINDS) {
    const L = fixture(kind);
    if (L.player.age < a.minAge || (a.maxAge !== undefined && L.player.age > a.maxAge)) continue;
    L.money = 1e6;
    try {
      if (a.cond && !a.cond(L)) continue;
      ran = true;
      const r = a.run(L);
      if ('ev' in r) runPending(`[ação ${a.id}] ${kind}`, L, r, 0, true);
      else checkOutcome(`[ação ${a.id}] ${kind}`, L, r);
    } catch (e) {
      err(`[ação ${a.id}] ${kind}: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
    }
  }
  if (!ran) warn(`[cobertura] ação "${a.id}" não rodou em nenhum perfil`);
}
for (const it of INTERACTIONS) {
  let ran = false;
  for (const kind of KINDS) {
    const probe = fixture(kind);
    const rels = new Set(probe.people.filter((p) => p.alive && it.cond(probe, p)).map((p) => p.rel));
    for (const rel of rels) {
      const L = fixture(kind);
      const p = L.people.find((x) => x.alive && x.rel === rel && it.cond(L, x)) as Person | undefined;
      if (!p) continue;
      try {
        ran = true;
        checkOutcome(`[interação ${it.id}] ${kind}/${rel}`, L, it.run(L, p));
      } catch (e) {
        err(`[interação ${it.id}] ${kind}/${rel}: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
      }
    }
  }
  if (!ran) warn(`[cobertura] interação "${it.id}" não rodou em nenhum perfil`);
}

// ------------------------------------------------------------ 6. entrevistas
const hireRates: string[] = [];
for (const c of CAREERS) {
  if (!INTERVIEWS[c.id]) { err(`[entrevista] carreira "${c.id}" sem entrada em INTERVIEWS (src/game/interviews.ts)`); continue; }
  if (!REG.env.has(INTERVIEWS[c.id].env)) err(`[entrevista] "${c.id}" usa ambiente inexistente "${INTERVIEWS[c.id].env}"`);
  let ok = 0;
  const N = QUICK ? 40 : 150;
  for (let i = 0; i < N; i++) {
    const L = fixture('desempregadoPobre', 28);
    L.crime.ficha = 0;
    L.stats.inteligencia = 60;
    L.stats.aparencia = 60;
    let pe: PendingEvent | undefined = startInterview(L, c);
    let n = 0;
    try {
      while (pe && n++ < 20) {
        const chs = pe.ev.choices!;
        const o: Outcome = chs[Math.floor(Math.random() * chs.length)].run(L, pe.ctx);
        checkText(`[entrevista ${c.id}]`, o.text);
        checkReact(`[entrevista ${c.id}]`, o.react);
        if (o.scene && !REG.scene.has(o.scene.id)) err(`[entrevista ${c.id}] cena "${o.scene.id}" não existe`);
        if (o.scene) scenesUsed.set(o.scene.id, (scenesUsed.get(o.scene.id) ?? 0) + 1);
        pe = o.followUp;
      }
    } catch (e) {
      err(`[entrevista ${c.id}]: EXCEÇÃO ${(e as Error).message}`);
      break;
    }
    if (L.job) ok++;
  }
  const rate = ok / N;
  hireRates.push(`${c.id} ${(rate * 100).toFixed(0)}%`);
  if (rate < 0.05 || rate > 0.85) warn(`[entrevista] "${c.id}" contrata ${(rate * 100).toFixed(0)}% com respostas aleatórias (ideal 15–60%)`);
}

// ------------------------------------------------------------ 7. vidas inteiras
const LIVES = QUICK ? 15 : 60;
let years = 0, deaths = 0;
const lifeErr0 = errors.length;
for (let n = 0; n < LIVES && errors.length - lifeErr0 < 30; n++) {
  const r = new RNG(n + 1);
  const L = newLife(randomAppearance(r), 'Sim', 'Ulador', 'São Paulo', 0);
  for (let y = 0; y < 130 && !L.dead; y++) {
    try {
      const yr = ageUp(L);
      years++;
      if (!REG.scene.has(yr.scene.id)) err(`[vida ${n}] ageUp pediu cena inexistente "${yr.scene.id}"`);
      yr.notes.forEach((x) => checkText(`[vida ${n}] nota`, x.text));
      for (const pe of yr.events) runPending(`[vida ${n} idade ${L.player.age}]`, L, pe, 0, false);
      // às vezes faz uma ação ou interação aleatória, como um jogador faria
      if (rng.chance(0.5)) {
        const acts = ACTIONS.filter((a) => L.player.age >= a.minAge && (a.maxAge === undefined || L.player.age <= a.maxAge) && (!a.cond || a.cond(L)));
        const a = rng.pick(acts);
        if (a) { const res = a.run(L); if ('ev' in res) runPending(`[vida ${n} ação ${a.id}]`, L, res, 0, false); else checkOutcome(`[vida ${n} ação ${a.id}]`, L, res, 0, false); }
      }
      if (rng.chance(0.4)) {
        const p = rng.pick(L.people.filter((x) => x.alive));
        const its = p ? INTERACTIONS.filter((i) => i.cond(L, p)) : [];
        const it = rng.pick(its);
        if (p && it) checkOutcome(`[vida ${n} interação ${it.id}/${p.rel}]`, L, it.run(L, p), 0, false);
      }
    } catch (e) {
      err(`[vida ${n} idade ${L.player.age}]: EXCEÇÃO ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`);
      break;
    }
  }
  if (L.dead) deaths++;
  else warn(`[vida ${n}] não morreu em 130 anos (idade ${L.player.age}) — confira o motor de morte`);
}

// ------------------------------------------------------------ relatório
const neverUsed = [...REG.scene].filter((s) => !scenesUsed.has(s) && !src('src/game/life.ts').includes(`'${s}'`) && !src('src/ui/game.ts').includes(`'${s}'`));
console.log('\nVIVA! — validação de conteúdo' + (QUICK ? ' (rápida)' : ''));
console.log('─'.repeat(60));
console.log(`Registros: ${REG.scene.size} cenas · ${REG.env.size} ambientes · ${REG.motion.size} movimentos · ${REG.expr.size} expressões · ${REG.prop.size} objetos · ${REG.held.size} objetos de mão`);
console.log(`Conteúdo:  ${EVENTS.length} eventos · ${ACTIONS.length} ações · ${INTERACTIONS.length} interações · ${CAREERS.length} carreiras`);
console.log(`Checado:   ${refCount} referências literais · ${LIVES} vidas (${years} anos, ${deaths} mortes)`);
console.log(`Contratação aleatória: ${hireRates.join(' · ')}`);
if (neverUsed.length) console.log(`Cenas sem uso detectado pelo teste (podem ser usadas via UI/dados dinâmicos): ${neverUsed.join(', ')}`);
if (warns.length) { console.log(`\n⚠️  ${warns.length} aviso(s):`); warns.forEach((w) => console.log('  - ' + w)); }
if (errors.length) {
  console.log(`\n❌ ${errors.length} ERRO(S):`);
  errors.forEach((e) => console.log('  - ' + e));
  process.exit(1);
}
console.log('\n✅ Tudo certo.');
