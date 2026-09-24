/**
 * Aplica a calibração fina aprovada (src/data/calibracao.json) sobre MOTIONS e EXPRESSIONS.
 *
 * Importado por `actor.ts` (efeito colateral único, depois de todos os blocos de movimentos
 * terem sido registrados). Entradas inválidas são ignoradas com aviso — nunca derrubam o jogo.
 * Os valores ORIGINAIS do código ficam preservados em `kfOriginal`/`ORIGINAIS_EXPR` para o painel
 * de QA mostrar "código × calibrado × proposta". Ver docs/PAINEL-QA.md.
 */
import DADOS from '../data/calibracao.json';
import { MOTIONS, keyframes, KF, KeyframeFn } from './motions';
import { EXPRESSIONS, Face } from './expressions';
import { Calibracao, validarCalibracao, validarContraRegistros } from '../qa/calibracao';
import { restPose } from './rig';

export interface EstadoCalibracao {
  aplicada: boolean;
  erros: string[];
  movimentos: string[];
  expressoes: string[];
}

/** Keyframes originais (do código) de cada movimento calibrado. */
export const KF_ORIGINAIS = new Map<string, KF[]>();
/** Duração original (do código) dos movimentos calibrados. */
export const DUR_ORIGINAIS = new Map<string, number | undefined>();
/** Valores originais das expressões calibradas. */
export const EXPR_ORIGINAIS = new Map<string, Face>();

export const ESTADO_CALIBRACAO: EstadoCalibracao = { aplicada: false, erros: [], movimentos: [], expressoes: [] };

export function keyframesDe(id: string): KF[] | undefined | null {
  const m = MOTIONS[id];
  if (!m) return null;
  const kf = (m.fn as Partial<KeyframeFn>).kf;
  return kf ?? undefined;
}

/** Monta os keyframes resultantes de um ajuste sobre uma lista base (sem mutar a base). */
export function kfComAjuste(base: KF[], aj: Calibracao['movimentos'][string] | undefined): KF[] {
  const out: KF[] = base.map(([t, p, e]) => [t, clonePoseParcial(p), e]);
  if (!aj?.keyframes) return out;
  for (const [ix, k] of Object.entries(aj.keyframes)) {
    const f = out[Number(ix)];
    if (!f) continue;
    if (typeof k.t === 'number') f[0] = k.t;
    for (const [campo, v] of Object.entries(k.pose ?? {})) definirCampo(f[1], campo, v);
  }
  return out;
}

export function clonePoseParcial(p: Partial<import('./rig').Pose>) {
  const o: any = { ...p };
  for (const l of ['armN', 'armF', 'legN', 'legF']) if (o[l]) o[l] = { ...o[l] };
  return o as Partial<import('./rig').Pose>;
}

/** Define "legN.a" numa pose parcial; se o membro não existir, parte do valor de descanso. */
export function definirCampo(p: any, campo: string, v: number) {
  const [a, b] = campo.split('.');
  if (b) {
    const rest = (restPose() as any)[a];
    p[a] = { ...(p[a] ?? rest), [b]: v };
  } else p[a] = v;
}

function aplicar(c: Calibracao) {
  const erros = [...validarCalibracao(c)];
  if (!erros.length) {
    erros.push(...validarContraRegistros(c, {
      keyframes: (id) => { const k = keyframesDe(id); return k === null ? null : k === undefined ? undefined : k.map((f) => f[0]); },
      expressao: (id) => id in EXPRESSIONS,
    }));
  }
  if (erros.length) {
    ESTADO_CALIBRACAO.erros = erros;
    console.warn('[calibração] ignorada por conter erros:', erros);
    return;
  }
  for (const [id, aj] of Object.entries(c.movimentos)) {
    const m = MOTIONS[id];
    const base = keyframesDe(id)!;
    KF_ORIGINAIS.set(id, base);
    DUR_ORIGINAIS.set(id, m.dur);
    m.fn = keyframes(kfComAjuste(base, aj));
    if (typeof aj.dur === 'number') m.dur = aj.dur;
    ESTADO_CALIBRACAO.movimentos.push(id);
  }
  for (const [id, campos] of Object.entries(c.expressoes)) {
    const tabela = EXPRESSIONS as Record<string, Face>;
    EXPR_ORIGINAIS.set(id, { ...tabela[id] });
    tabela[id] = { ...tabela[id], ...campos };
    ESTADO_CALIBRACAO.expressoes.push(id);
  }
  ESTADO_CALIBRACAO.aplicada = true;
}

aplicar(DADOS as Calibracao);
