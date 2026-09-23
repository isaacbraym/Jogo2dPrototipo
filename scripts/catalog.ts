/**
 * Gera docs/CATALOGO.md a partir dos registros reais do código.
 *   npm run catalog
 * Rode sempre que adicionar conteúdo — o catálogo é a lista oficial de nomes
 * (use-a para não criar duplicatas e para saber o que já existe).
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { EVENTS } from '../src/game/events';
import { ACTIONS, INTERACTIONS } from '../src/game/activities';
import { CAREERS } from '../src/game/careers';
import { INTERVIEWS } from '../src/game/interviews';
import { AGGRO } from '../src/game/aggression';
import { SITUATIONS } from '../src/scenes/situations';
import { ENVS } from '../src/scenes/environments';
import { MOTIONS } from '../src/character/motions';
import { EXPRESSIONS } from '../src/character/expressions';
import { PROPS, HELD } from '../src/render/props';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { sfx } from '../src/core/audio';

const src = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const unionOf = (file: string, typeName: string) => {
  const m = src(file).match(new RegExp(`export type ${typeName}\\s*=([^;]+);`));
  return m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : [];
};
const code = (xs: string[]) => xs.map((x) => '`' + x + '`').join(' · ');
const esc = (s: string) => s.replace(/\|/g, '\\|');
const title = (t: unknown) => (typeof t === 'function' ? '(dinâmico)' : String(t));

const out: string[] = [];
const h = (s: string) => out.push('', s, '');
out.push('# Catálogo de conteúdo (gerado)', '', '> **Não edite à mão.** Gerado por `npm run catalog` a partir dos registros do código.', '> Use para conferir nomes existentes antes de criar algo novo.');

h(`## Eventos anuais — ${EVENTS.length}`);
out.push('| id | idades | título | tipo |', '|---|---|---|---|');
for (const e of EVENTS) out.push(`| \`${e.id}\` | ${e.min}–${e.max} | ${e.icon} ${esc(title(e.title))} | ${e.choices ? e.choices.length + ' escolhas' : 'automático'}${e.once ? ', única' : ''} |`);

h(`## Ações (aba Atividades) — ${ACTIONS.length}`);
out.push('| id | grupo | rótulo | idade mín. |', '|---|---|---|---|');
for (const a of ACTIONS) out.push(`| \`${a.id}\` | ${a.group} | ${a.icon} ${esc(a.label)} | ${a.minAge} |`);

h(`## Interações (aba Relações) — ${INTERACTIONS.length}`);
out.push('| id | grupo | rótulo |', '|---|---|---|');
for (const i of INTERACTIONS) out.push(`| \`${i.id}\` | ${i.group ?? 'Geral'} | ${i.icon} ${esc(i.label)} |`);

h(`## Agressões — ${Object.keys(AGGRO).length}`);
out.push('| tipo | severidade (1–5) |', '|---|---|');
for (const [k, v] of Object.entries(AGGRO)) out.push(`| \`${k}\` | ${(v as { sev: number }).sev} |`);

h(`## Carreiras e entrevistas — ${CAREERS.length}`);
out.push('| id | cargo | ambiente da entrevista | entrevistador |', '|---|---|---|---|');
for (const c of CAREERS) {
  const iv = INTERVIEWS[c.id];
  out.push(`| \`${c.id}\` | ${c.icon} ${c.title} | ${iv ? '`' + iv.env + '`' : '**FALTANDO**'} | ${iv?.interviewer ?? ''} |`);
}

h(`## Cenas/situações — ${Object.keys(SITUATIONS).length}`);
// chaves de c.data lidas por cada situação (extraídas do código-fonte)
const sitSrc = src('src/scenes/situations.ts');
const blocks = new Map<string, string>();
{
  const re = /^ {4}id: '(\w+)',\s*$/gm;
  const hits = [...sitSrc.matchAll(re)];
  hits.forEach((m, i) => blocks.set(m[1], sitSrc.slice(m.index, hits[i + 1]?.index ?? sitSrc.length)));
}
out.push('| id | ambiente | chaves de `data` lidas |', '|---|---|---|');
for (const s of Object.values(SITUATIONS)) {
  const keys = [...new Set([...(blocks.get(s.id) ?? '').matchAll(/c\.data\?\.(\w+)/g)].map((m) => m[1]))];
  out.push(`| \`${s.id}\` | ${typeof s.env === 'function' ? '(dinâmico)' : '`' + s.env + '`'} | ${keys.map((k) => '`' + k + '`').join(', ')} |`);
}
out.push('', 'Ações físicas de `physical()` (use em `interacao` com `data.action`): ' + code([...new Set([...sitSrc.slice(0, sitSrc.indexOf('// ================================================================== situações')).matchAll(/case '(\w+)'/g)].map((m) => m[1]))]));

h(`## Ambientes — ${Object.keys(ENVS).length}`);
out.push(code(Object.keys(ENVS)));

h(`## Movimentos — ${Object.keys(MOTIONS).length}`);
const loops = Object.entries(MOTIONS).filter(([, m]) => m.loop).map(([k]) => k);
const acts = Object.entries(MOTIONS).filter(([, m]) => !m.loop).map(([k, m]) => `${k} (${m.dur ?? '?'}s)`);
out.push('**Em loop (estados):** ' + code(loops), '', '**Ações (duração fixa):** ' + code(acts));

h(`## Expressões — ${Object.keys(EXPRESSIONS).length}`);
out.push(code(Object.keys(EXPRESSIONS)));

h(`## Objetos de cena (\`d.prop\`) — ${Object.keys(PROPS).length}`);
out.push(code(Object.keys(PROPS)));

h(`## Objetos de mão (\`propN\`/\`propF\`) — ${Object.keys(HELD).length}`);
out.push(code(Object.keys(HELD)));

h('## Emotes (`d.emote`)');
out.push(code(unionOf('src/character/actor.ts', 'EmoteKind')));

h('## Partículas (`d.fx`)');
out.push(code(unionOf('src/render/particles.ts', 'PKind')));

h('## Sons (`d.sfx`)');
out.push(code(Object.getOwnPropertyNames(Object.getPrototypeOf(sfx)).filter((k) => typeof (sfx as any)[k] === 'function' && !['constructor', 'unlock', 'setMusic', 'setSfx', 'setMood', 'tone', 'noise', 'persist', 'makeImpulse', 'startMusic', 'stopMusic', 'hover', 'click', 'tick', 'talk'].includes(k))));

h('## Flags de vida (`L.flags.*`) em uso');
{
  const files = ['src/game/events.ts', 'src/game/activities.ts', 'src/game/aggression.ts', 'src/game/interviews.ts', 'src/game/life.ts', 'src/game/state.ts', 'src/ui/game.ts'];
  const rows: string[] = [];
  const seen = new Map<string, Set<string>>();
  for (const f of files) for (const m of src(f).matchAll(/flags(?:\.(\w+)|\[['`](\w+)['`]\])/g)) {
    const k = m[1] ?? m[2];
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k)!.add(f.replace('src/', ''));
  }
  for (const [k, fs] of [...seen].sort()) rows.push(`| \`${k}\` | ${[...fs].join(', ')} |`);
  out.push('Além destas, `ev_<id>` marca eventos `once` já ocorridos.', '', '| flag | onde |', '|---|---|', ...rows);
}

h(`## Conquistas — ${ACHIEVEMENTS.length}`);
out.push(code(ACHIEVEMENTS.map((a) => a.id)));

writeFileSync(new URL('../docs/CATALOGO.md', import.meta.url), out.join('\n') + '\n');
console.log('docs/CATALOGO.md atualizado.');
