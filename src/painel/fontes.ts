/**
 * Código-fonte do projeto como texto (somente no servidor de desenvolvimento) para:
 * localizar a definição de cada id (arquivo:linha), mostrar trechos e inferir vínculos estáticos.
 */
import { linhaDe } from '../qa/referencias';

const brutos = import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** caminho relativo ("src/game/events.ts") → texto */
export const FONTES: Record<string, string> = Object.fromEntries(Object.entries(brutos).map(([k, v]) => [k.replace(/^\//, ''), v]));

export interface Local { arquivo: string; linha: number; indice: number }

const cacheLinhas = new Map<string, number[]>();
function quebras(arquivo: string) {
  let q = cacheLinhas.get(arquivo);
  if (!q) {
    q = [];
    const t = FONTES[arquivo] ?? '';
    for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) === 10) q.push(i);
    cacheLinhas.set(arquivo, q);
  }
  return q;
}
export function linha(arquivo: string, indice: number) {
  const q = quebras(arquivo);
  let lo = 0, hi = q.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (q[m] < indice) lo = m + 1; else hi = m; }
  return lo + 1;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Primeira ocorrência de um regex (com âncora opcional depois de `aPartirDe`). */
export function achar(arquivo: string, re: RegExp, aPartirDe = 0): Local | null {
  const t = FONTES[arquivo];
  if (!t) return null;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  r.lastIndex = aPartirDe;
  const m = r.exec(t);
  if (!m) return null;
  return { arquivo, linha: linha(arquivo, m.index), indice: m.index };
}

export const R = {
  idProp: (id: string) => new RegExp(`\\bid:\\s*'${esc(id)}'`),
  chaveObjeto: (id: string, indent = 2) => new RegExp(`^ {${indent}}${esc(id)}: `, 'm'),
  caso: (id: string) => new RegExp(`case '${esc(id)}':`),
  constEnv: (id: string) => new RegExp(`^const ${esc(id)}: Env\\b`, 'm'),
  label: (label: string) => new RegExp(`label:\\s*['"\`]${esc(label)}['"\`]`),
};

/** Trecho do código ao redor de uma linha (para o detalhe). */
export function trecho(arquivo: string, linhaAlvo: number, antes = 2, depois = 14): string {
  const t = FONTES[arquivo];
  if (!t) return '';
  const ls = t.split('\n');
  const a = Math.max(0, linhaAlvo - 1 - antes), b = Math.min(ls.length, linhaAlvo - 1 + depois);
  return ls.slice(a, b).map((l, i) => `${String(a + i + 1).padStart(5)}  ${l}`).join('\n');
}

/** Quantas vezes a string literal 'id' (entre aspas) aparece nos fontes, fora de uma linha excluída. */
export function ocorrenciasLiterais(id: string, excluir?: Local | null): Local[] {
  const out: Local[] = [];
  const re = new RegExp(`['"\`]${esc(id)}['"\`]`, 'g');
  for (const [arquivo, t] of Object.entries(FONTES)) {
    if (arquivo.startsWith('src/painel/') || arquivo.startsWith('src/qa/')) continue;
    for (const m of t.matchAll(re)) {
      const l = linha(arquivo, m.index ?? 0);
      if (excluir && excluir.arquivo === arquivo && excluir.linha === l) continue;
      out.push({ arquivo, linha: l, indice: m.index ?? 0 });
    }
  }
  return out;
}

/** Blocos [início, fim) de itens definidos em sequência num arquivo (ex.: `    id: 'x',` das situações). */
export function blocos(arquivo: string, re: RegExp, limite?: [number, number]): { id: string; ini: number; fim: number }[] {
  const t = FONTES[arquivo] ?? '';
  const [a, b] = limite ?? [0, t.length];
  const hits = [...t.slice(a, b).matchAll(new RegExp(re.source, 'gm'))].map((m) => ({ id: m[1], ini: a + (m.index ?? 0) }));
  return hits.map((h, i) => ({ ...h, fim: hits[i + 1]?.ini ?? b }));
}

export { linhaDe };
