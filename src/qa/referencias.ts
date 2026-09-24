/**
 * Varredura estática de referências literais no código-fonte (compartilhada pelo validador e pelo painel de QA).
 * Encontra usos como `d.loop(p, 'chorar')`, `scene: { id: 'agressao' }`, `expr: 'dor'`.
 * É INFERÊNCIA por texto: não enxerga nomes montados em tempo de execução (`k === 'chute' ? 'chute' : ...`
 * é pego; `'agg_' + k` não). O painel complementa com vínculos OBSERVADOS em execução.
 */

export type Registro = 'motion' | 'expr' | 'prop' | 'held' | 'fx' | 'emote' | 'sfx' | 'scene' | 'env';

export const PADROES: [RegExp, Registro, string][] = [
  [/d\.(?:loop|act)\(\s*[\w.[\]]+\s*,\s*'(\w+)'/g, 'motion', 'd.loop/d.act'],
  [/\bmotion:\s*'(\w+)'/g, 'motion', 'motion:'],
  [/\.play\(\s*'(\w+)'/g, 'motion', '.play()'],
  [/d\.expr\(\s*[\w.[\]]+\s*,\s*'(\w+)'/g, 'expr', 'd.expr'],
  [/\bexpr:\s*'(\w+)'/g, 'expr', 'expr:'],
  [/setExpr\(\s*'(\w+)'/g, 'expr', 'setExpr()'],
  [/d\.prop\(\s*'(\w+)'/g, 'prop', 'd.prop'],
  [/\bprop[NF]\s*[=:]\s*'(\w+)'/g, 'held', 'propN/propF'],
  [/d\.fx\(\s*'(\w+)'/g, 'fx', 'd.fx'],
  [/d\.emote\(\s*[\w.[\]]+\s*,\s*'(\w+)'/g, 'emote', 'd.emote'],
  [/\bemote:\s*'(\w+)'/g, 'emote', 'emote:'],
  [/d\.sfx\(\s*'(\w+)'/g, 'sfx', 'd.sfx'],
  [/\bscene:\s*\{\s*id:\s*'(\w+)'/g, 'scene', 'scene: { id }'],
  [/\bscene:\s*\([^)]*\)\s*=>\s*\(\{\s*id:\s*'(\w+)'/g, 'scene', 'scene: () => ({ id })'],
  [/\bid:\s*'(\w+)',\s*(?:others|data):/g, 'scene', '{ id, others/data }'],
  [/\benv:\s*'(\w+)'/g, 'env', 'env:'],
];

export const ARQUIVOS_VARRIDOS = [
  'src/scenes/situations.ts', 'src/game/events.ts', 'src/game/activities.ts', 'src/game/aggression.ts',
  'src/game/interviews.ts', 'src/game/life.ts', 'src/game/careers.ts', 'src/ui/game.ts',
];

export interface RefEstatica { registro: Registro; id: string; arquivo: string; linha: number; padrao: string; indice: number }

export function linhaDe(texto: string, indice: number) {
  let n = 1;
  for (let i = 0; i < indice; i++) if (texto.charCodeAt(i) === 10) n++;
  return n;
}

export function varrerReferencias(fontes: Record<string, string>): RefEstatica[] {
  const out: RefEstatica[] = [];
  for (const [arquivo, texto] of Object.entries(fontes)) {
    // tabela de quebras de linha para localizar rápido
    const quebras: number[] = [];
    for (let i = 0; i < texto.length; i++) if (texto.charCodeAt(i) === 10) quebras.push(i);
    const linha = (ix: number) => { let lo = 0, hi = quebras.length; while (lo < hi) { const m = (lo + hi) >> 1; if (quebras[m] < ix) lo = m + 1; else hi = m; } return lo + 1; };
    for (const [re, registro, padrao] of PADROES) {
      for (const m of texto.matchAll(re)) out.push({ registro, id: m[1], arquivo, linha: linha(m.index ?? 0), padrao, indice: m.index ?? 0 });
    }
  }
  return out;
}
