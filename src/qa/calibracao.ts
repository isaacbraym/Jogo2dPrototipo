/**
 * Formato e validação da calibração fina (src/data/calibracao.json).
 *
 * A calibração é uma camada de dados, pequena e auditável, sobre valores NUMÉRICOS que o código já
 * declara de forma estruturada: keyframes de movimentos feitos com `keyframes([...])` e campos
 * contínuos de expressões. Ela nunca cria movimentos, nunca altera funções procedurais e nunca
 * renomeia ids. Módulo puro (sem DOM, sem imports do jogo): usado no runtime, no painel, no
 * servidor de desenvolvimento e no validador.
 */
import { LIMITES_POSE, LIMITES_FACE, LIMITE_KEYFRAME_T, LIMITE_DUR, EXPRESSOES_SOFRIMENTO } from './limites';

export interface AjusteKeyframe {
  /** novo instante do keyframe (s) — opcional */
  t?: number;
  /** campos da pose por caminho estável ("lean", "legN.a") */
  pose?: Record<string, number>;
}

export interface AjusteMovimento {
  dur?: number;
  /** índice do keyframe (como string) → ajuste */
  keyframes?: Record<string, AjusteKeyframe>;
  nota?: string;
}

export interface Calibracao {
  formato: 'viva-calibracao';
  versao: 1;
  movimentos: Record<string, AjusteMovimento>;
  expressoes: Record<string, Record<string, number>>;
}

export const CALIBRACAO_VAZIA: Calibracao = { formato: 'viva-calibracao', versao: 1, movimentos: {}, expressoes: {} };

const ID = /^[A-Za-z][A-Za-z0-9_]*$/;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const arred = (v: number) => Math.round(v * 10000) / 10000;

/**
 * Validação estrutural + limites seguros. Não precisa conhecer os registros do jogo;
 * a existência de movimento/keyframe é conferida por `validarContraRegistros`.
 */
export function validarCalibracao(c: unknown): string[] {
  const erros: string[] = [];
  const x = c as Calibracao;
  if (!x || typeof x !== 'object') return ['calibração não é um objeto'];
  if (x.formato !== 'viva-calibracao') erros.push('campo "formato" deve ser "viva-calibracao"');
  if (x.versao !== 1) erros.push('campo "versao" deve ser 1');
  const chaves = Object.keys(x).filter((k) => !['formato', 'versao', 'movimentos', 'expressoes'].includes(k));
  if (chaves.length) erros.push(`chaves desconhecidas: ${chaves.join(', ')}`);
  if (!x.movimentos || typeof x.movimentos !== 'object') erros.push('"movimentos" ausente');
  if (!x.expressoes || typeof x.expressoes !== 'object') erros.push('"expressoes" ausente');
  for (const [id, m] of Object.entries(x.movimentos ?? {})) {
    if (!ID.test(id)) erros.push(`movimento com id inválido "${id}"`);
    const extra = Object.keys(m ?? {}).filter((k) => !['dur', 'keyframes', 'nota'].includes(k));
    if (extra.length) erros.push(`movimento ${id}: chaves desconhecidas ${extra.join(', ')}`);
    if (m.dur !== undefined && (!num(m.dur) || m.dur < LIMITE_DUR.min || m.dur > LIMITE_DUR.max)) erros.push(`movimento ${id}: dur fora de ${LIMITE_DUR.min}..${LIMITE_DUR.max}`);
    if (m.nota !== undefined && (typeof m.nota !== 'string' || m.nota.length > 300)) erros.push(`movimento ${id}: nota inválida (texto até 300 caracteres)`);
    for (const [ix, k] of Object.entries(m.keyframes ?? {})) {
      if (!/^\d+$/.test(ix)) { erros.push(`movimento ${id}: índice de keyframe inválido "${ix}"`); continue; }
      const ek = Object.keys(k ?? {}).filter((q) => !['t', 'pose'].includes(q));
      if (ek.length) erros.push(`movimento ${id} kf${ix}: chaves desconhecidas ${ek.join(', ')}`);
      if (k.t !== undefined && (!num(k.t) || k.t < LIMITE_KEYFRAME_T.min || k.t > LIMITE_KEYFRAME_T.max)) erros.push(`movimento ${id} kf${ix}: t fora do limite`);
      for (const [campo, v] of Object.entries(k.pose ?? {})) {
        const lim = LIMITES_POSE[campo];
        if (!lim) { erros.push(`movimento ${id} kf${ix}: campo "${campo}" não é calibrável`); continue; }
        if (!num(v)) { erros.push(`movimento ${id} kf${ix}.${campo}: valor não numérico`); continue; }
        if (v < lim.min || v > lim.max) erros.push(`movimento ${id} kf${ix}.${campo} = ${v} fora do limite seguro ${lim.min}..${lim.max} (SPEC-03)`);
      }
    }
  }
  for (const [id, f] of Object.entries(x.expressoes ?? {})) {
    if (!ID.test(id)) erros.push(`expressão com id inválido "${id}"`);
    for (const [campo, v] of Object.entries(f ?? {})) {
      const lim = LIMITES_FACE[campo];
      if (!lim) { erros.push(`expressão ${id}: campo "${campo}" não é calibrável`); continue; }
      if (!num(v) || v < lim.min || v > lim.max) erros.push(`expressão ${id}.${campo} = ${v} fora de ${lim.min}..${lim.max}`);
    }
    if (EXPRESSOES_SOFRIMENTO.includes(id) && num(f?.smile) && f.smile > 0) erros.push(`expressão ${id}: sofrimento não pode ter smile > 0 (SPEC-03)`);
  }
  return erros;
}

/** Informações mínimas dos registros para validar referências (fornecidas por quem chama). */
export interface RegistrosCalib {
  /** id → tempos dos keyframes (undefined = movimento procedural, não calibrável) */
  keyframes: (id: string) => number[] | undefined | null;
  expressao: (id: string) => boolean;
}

/** Confere se movimentos/keyframes/expressões existem e se a ordem dos tempos continua válida. */
export function validarContraRegistros(c: Calibracao, reg: RegistrosCalib): string[] {
  const erros: string[] = [];
  for (const [id, m] of Object.entries(c.movimentos)) {
    const ts = reg.keyframes(id);
    if (ts === null) { erros.push(`movimento "${id}" não existe`); continue; }
    if (ts === undefined) { erros.push(`movimento "${id}" é procedural (não usa keyframes) — exige mudança de código`); continue; }
    const novos = [...ts];
    for (const [ix, k] of Object.entries(m.keyframes ?? {})) {
      const i = Number(ix);
      if (i >= ts.length) { erros.push(`movimento ${id}: keyframe ${i} não existe (há ${ts.length})`); continue; }
      if (k.t !== undefined) novos[i] = k.t;
    }
    for (let i = 1; i < novos.length; i++) if (!(novos[i] > novos[i - 1])) erros.push(`movimento ${id}: tempos dos keyframes deixam de ser crescentes (kf${i - 1}=${novos[i - 1]}, kf${i}=${novos[i]})`);
    if (m.dur !== undefined && novos.length && m.dur < novos[novos.length - 1] - 1e-9) erros.push(`movimento ${id}: dur ${m.dur} menor que o último keyframe (${novos[novos.length - 1]})`);
  }
  for (const id of Object.keys(c.expressoes)) if (!reg.expressao(id)) erros.push(`expressão "${id}" não existe`);
  return erros;
}

/** Normaliza (ordena chaves, arredonda, remove vazios) para diffs estáveis e legíveis. */
export function normalizarCalibracao(c: Calibracao): Calibracao {
  const out: Calibracao = { formato: 'viva-calibracao', versao: 1, movimentos: {}, expressoes: {} };
  for (const id of Object.keys(c.movimentos).sort()) {
    const m = c.movimentos[id];
    const nm: AjusteMovimento = {};
    if (num(m.dur)) nm.dur = arred(m.dur);
    const kfs: Record<string, AjusteKeyframe> = {};
    for (const ix of Object.keys(m.keyframes ?? {}).sort((a, b) => Number(a) - Number(b))) {
      const k = m.keyframes![ix];
      const nk: AjusteKeyframe = {};
      if (num(k.t)) nk.t = arred(k.t);
      const pose: Record<string, number> = {};
      for (const f of Object.keys(k.pose ?? {}).sort()) pose[f] = arred(k.pose![f]);
      if (Object.keys(pose).length) nk.pose = pose;
      if (Object.keys(nk).length) kfs[ix] = nk;
    }
    if (Object.keys(kfs).length) nm.keyframes = kfs;
    if (m.nota) nm.nota = m.nota;
    if (nm.dur !== undefined || nm.keyframes) out.movimentos[id] = nm;
  }
  for (const id of Object.keys(c.expressoes).sort()) {
    const f: Record<string, number> = {};
    for (const k of Object.keys(c.expressoes[id]).sort()) f[k] = arred(c.expressoes[id][k]);
    if (Object.keys(f).length) out.expressoes[id] = f;
  }
  return out;
}

/** Diff textual linha a linha (JSON normalizado com 2 espaços). */
export function diffTexto(antes: string, depois: string): string {
  const a = antes.split('\n'), b = depois.split('\n');
  // LCS simples (arquivos pequenos)
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push('  ' + a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push('- ' + a[i++]);
    else out.push('+ ' + b[j++]);
  }
  while (i < n) out.push('- ' + a[i++]);
  while (j < m) out.push('+ ' + b[j++]);
  return out.join('\n');
}

export const serializar = (c: Calibracao) => JSON.stringify(normalizarCalibracao(c), null, 2) + '\n';
