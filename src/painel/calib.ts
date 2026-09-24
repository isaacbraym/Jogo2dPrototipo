/**
 * Calibrador: propostas de ajuste numérico com desfazer/refazer, variações nomeadas, A/B e
 * geração de overrides para o laboratório. Persistência só pelo formato validado de src/qa/calibracao.ts.
 */
import { MOTIONS, Motion, keyframes, KF, KeyframeFn } from '../character/motions';
import { EXPRESSIONS, Face } from '../character/expressions';
import { KF_ORIGINAIS, EXPR_ORIGINAIS, DUR_ORIGINAIS, kfComAjuste } from '../character/calibracao';
import DADOS from '../data/calibracao.json';
import { Calibracao, AjusteMovimento, CALIBRACAO_VAZIA, validarCalibracao, validarContraRegistros, normalizarCalibracao } from '../qa/calibracao';
import { LIMITES_POSE, LIMITES_FACE, lerCampo } from '../qa/limites';
import { restPose, Pose } from '../character/rig';
import { Overrides, semOverrides } from './lab';
import { clone } from './vida';

export const CALIB_APLICADA: Calibracao = clone(DADOS as Calibracao);

/** Keyframes do CÓDIGO (sem calibração). */
export function kfCodigo(id: string): KF[] | null {
  const orig = KF_ORIGINAIS.get(id);
  if (orig) return orig;
  const kf = (MOTIONS[id]?.fn as Partial<KeyframeFn>)?.kf;
  return kf ?? null;
}
export const ehCalibravel = (id: string) => !!kfCodigo(id);
/** Duração do código (antes de qualquer calibração). */
export const durCodigo = (id: string) => (DUR_ORIGINAIS.has(id) ? DUR_ORIGINAIS.get(id) : MOTIONS[id]?.dur);

/** Valor resolvido de um campo num keyframe (o parcial herda da pose de descanso). */
export function valorKF(frames: KF[], ix: number, campo: string): number {
  const p = { ...restPose(), ...frames[ix][1] } as Pose;
  return lerCampo(p, campo) ?? 0;
}
export const campoPresente = (frames: KF[], ix: number, campo: string) => {
  const [a, b] = campo.split('.');
  const v = (frames[ix][1] as any)[a];
  return b ? v !== undefined : v !== undefined;
};

export function exprCodigo(id: string): Face {
  return EXPR_ORIGINAIS.get(id) ?? (EXPRESSIONS as Record<string, Face>)[id];
}

export function registrosCalib() {
  return {
    keyframes: (id: string) => { if (!MOTIONS[id]) return null; const k = kfCodigo(id); return k ? k.map((f) => f[0]) : undefined; },
    expressao: (id: string) => id in EXPRESSIONS,
  };
}

export function validarTudo(c: Calibracao): string[] {
  const e = validarCalibracao(c);
  return e.length ? e : validarContraRegistros(c, registrosCalib());
}

export interface Variacao { nome: string; nota?: string; calibracao: Calibracao; autor?: string }

export interface PropostaArquivo {
  formato: 'viva-proposta';
  versao: 1;
  titulo: string;
  alvo: string;
  autor: string;
  criado: string;
  variacoes: Variacao[];
  escolhida?: string;
}

/** Estado de trabalho: uma calibração completa (base = arquivo aplicado) + histórico. */
export class Trabalho {
  atual: Calibracao;
  private hist: string[] = [];
  private pos = -1;
  variacoes: Variacao[] = [];
  exploratorio = new Map<string, Record<string, number>>(); // movimento procedural → deslocamentos (só sessão)
  ouvintes = new Set<() => void>();

  constructor(base: Calibracao = CALIB_APLICADA) {
    this.atual = clone(base);
    this.registrar();
  }

  private registrar() {
    const s = JSON.stringify(normalizarCalibracao(this.atual));
    if (this.hist[this.pos] === s) return;
    this.hist = this.hist.slice(0, this.pos + 1);
    this.hist.push(s);
    this.pos = this.hist.length - 1;
  }
  mudou() { this.registrar(); this.ouvintes.forEach((f) => f()); }
  podeDesfazer() { return this.pos > 0; }
  podeRefazer() { return this.pos < this.hist.length - 1; }
  desfazer() { if (this.podeDesfazer()) { this.pos--; this.atual = JSON.parse(this.hist[this.pos]); this.ouvintes.forEach((f) => f()); } }
  refazer() { if (this.podeRefazer()) { this.pos++; this.atual = JSON.parse(this.hist[this.pos]); this.ouvintes.forEach((f) => f()); } }

  ajusteMov(id: string): AjusteMovimento {
    return (this.atual.movimentos[id] ??= {});
  }

  definirCampoKF(id: string, ix: number, campo: string, v: number) {
    const lim = LIMITES_POSE[campo];
    if (lim) v = Math.max(lim.min, Math.min(lim.max, v));
    const aj = this.ajusteMov(id);
    const k = ((aj.keyframes ??= {})[String(ix)] ??= {});
    (k.pose ??= {})[campo] = v;
    this.limparNeutros(id);
    this.mudou();
  }
  definirTempoKF(id: string, ix: number, t: number) {
    const aj = this.ajusteMov(id);
    ((aj.keyframes ??= {})[String(ix)] ??= {}).t = Math.max(0, t);
    this.limparNeutros(id);
    this.mudou();
  }
  definirDur(id: string, dur: number) {
    this.ajusteMov(id).dur = dur;
    this.limparNeutros(id);
    this.mudou();
  }
  restaurarCampoKF(id: string, ix: number, campo: string) {
    const k = this.atual.movimentos[id]?.keyframes?.[String(ix)];
    if (k?.pose) delete k.pose[campo];
    this.limparNeutros(id);
    this.mudou();
  }
  /** Volta o movimento aos valores do código (remove a entrada). */
  restaurarMovimento(id: string) { delete this.atual.movimentos[id]; this.mudou(); }

  definirCampoFace(id: string, campo: string, v: number) {
    const lim = LIMITES_FACE[campo];
    if (lim) v = Math.max(lim.min, Math.min(lim.max, v));
    const orig = exprCodigo(id) as any;
    const e = (this.atual.expressoes[id] ??= {});
    if (Math.abs(orig[campo] - v) < 1e-9) delete e[campo];
    else e[campo] = v;
    if (!Object.keys(e).length) delete this.atual.expressoes[id];
    this.mudou();
  }
  restaurarExpressao(id: string) { delete this.atual.expressoes[id]; this.mudou(); }

  /** Remove ajustes iguais ao código (mantém o arquivo mínimo). */
  private limparNeutros(id: string) {
    const aj = this.atual.movimentos[id];
    const base = kfCodigo(id);
    if (!aj || !base) return;
    for (const [ix, k] of Object.entries(aj.keyframes ?? {})) {
      for (const [campo, v] of Object.entries(k.pose ?? {})) if (Math.abs(valorKF(base, Number(ix), campo) - v) < 1e-9 && campoPresente(base, Number(ix), campo)) delete k.pose![campo];
      if (k.pose && !Object.keys(k.pose).length) delete k.pose;
      if (k.t !== undefined && Math.abs(base[Number(ix)][0] - k.t) < 1e-9) delete k.t;
      if (!Object.keys(k).length) delete aj.keyframes![ix];
    }
    if (aj.keyframes && !Object.keys(aj.keyframes).length) delete aj.keyframes;
    if (aj.dur !== undefined && Math.abs((durCodigo(id) ?? 0) - aj.dur) < 1e-9) delete aj.dur;
    if (!aj.keyframes && aj.dur === undefined) delete this.atual.movimentos[id];
  }

  /** Diferença entre o trabalho e o arquivo aplicado (quais ids mudam). */
  alterados(): { movimentos: string[]; expressoes: string[] } {
    const a = normalizarCalibracao(CALIB_APLICADA), b = normalizarCalibracao(this.atual);
    const ms = new Set([...Object.keys(a.movimentos), ...Object.keys(b.movimentos)]);
    const es = new Set([...Object.keys(a.expressoes), ...Object.keys(b.expressoes)]);
    return {
      movimentos: [...ms].filter((k) => JSON.stringify(a.movimentos[k]) !== JSON.stringify(b.movimentos[k])),
      expressoes: [...es].filter((k) => JSON.stringify(a.expressoes[k]) !== JSON.stringify(b.expressoes[k])),
    };
  }

  /** Overrides (movimentos/expressões) para simular "a proposta" no laboratório. */
  overrides(): Overrides {
    return overridesDe(this.atual, this.exploratorio);
  }

  salvarVariacao(nome: string, nota = '') {
    const alt = this.alterados();
    const cal: Calibracao = { ...CALIBRACAO_VAZIA, movimentos: {}, expressoes: {} };
    for (const id of alt.movimentos) if (this.atual.movimentos[id]) cal.movimentos[id] = clone(this.atual.movimentos[id]);
    for (const id of alt.expressoes) if (this.atual.expressoes[id]) cal.expressoes[id] = clone(this.atual.expressoes[id]);
    // ids que voltaram ao código aparecem como entrada vazia (remoção) — representados por ausência + lista "remover"
    const v: Variacao & { remover?: string[] } = { nome, nota, calibracao: normalizarCalibracao(cal), autor: 'painel' };
    const rem = [...alt.movimentos.filter((id) => !this.atual.movimentos[id]).map((x) => 'movimento:' + x), ...alt.expressoes.filter((id) => !this.atual.expressoes[id]).map((x) => 'expressao:' + x)];
    if (rem.length) v.remover = rem;
    this.variacoes = this.variacoes.filter((x) => x.nome !== nome).concat(v);
    this.ouvintes.forEach((f) => f());
    return v;
  }

  /** Carrega uma variação sobre a calibração aplicada (substitui só as entradas da variação). */
  carregarVariacao(v: Variacao & { remover?: string[] }) {
    this.atual = aplicarVariacao(CALIB_APLICADA, v);
    this.mudou();
  }
}

export function aplicarVariacao(base: Calibracao, v: Variacao & { remover?: string[] }): Calibracao {
  const c = clone(base);
  for (const [id, m] of Object.entries(v.calibracao.movimentos)) c.movimentos[id] = clone(m);
  for (const [id, e] of Object.entries(v.calibracao.expressoes)) c.expressoes[id] = clone(e);
  for (const r of v.remover ?? []) {
    const [t, id] = r.split(':');
    if (t === 'movimento') delete c.movimentos[id];
    if (t === 'expressao') delete c.expressoes[id];
  }
  return normalizarCalibracao(c);
}

/** Constrói overrides a partir de uma calibração (e deslocamentos exploratórios). */
export function overridesDe(c: Calibracao, exploratorio?: Map<string, Record<string, number>>): Overrides {
  const ov = semOverrides();
  const idsMov = new Set([...Object.keys(c.movimentos), ...KF_ORIGINAIS.keys()]);
  for (const id of idsMov) {
    const base = kfCodigo(id);
    const m = MOTIONS[id];
    if (!base || !m) continue;
    const aj = c.movimentos[id];
    const novo: Motion = { ...m, fn: keyframes(kfComAjuste(base, aj)), dur: aj?.dur ?? durCodigo(id) };
    ov.movimentos.set(id, novo);
  }
  const idsExp = new Set([...Object.keys(c.expressoes), ...EXPR_ORIGINAIS.keys()]);
  for (const id of idsExp) ov.expressoes.set(id, { ...exprCodigo(id), ...(c.expressoes[id] ?? {}) });
  for (const [id, desl] of exploratorio ?? []) {
    const m = ov.movimentos.get(id) ?? MOTIONS[id];
    if (!m) continue;
    const f = m.fn;
    ov.movimentos.set(id, {
      ...m, fn: (t, cx) => {
        const p = f(t, cx);
        const q: any = { ...p, armN: { ...p.armN }, armF: { ...p.armF }, legN: { ...p.legN }, legF: { ...p.legF } };
        for (const [campo, dv] of Object.entries(desl)) {
          const [a, b] = campo.split('.');
          if (b) q[a][b] += dv; else q[a] += dv;
        }
        return q;
      },
    });
  }
  return ov;
}

/** Overrides que forçam os valores do CÓDIGO (ignora a calibração aplicada) — para comparar "código × proposta". */
export function overridesCodigo(): Overrides {
  return overridesDe(CALIBRACAO_VAZIA);
}

/** Keyframe mais próximo de um instante do movimento. */
export function kfNoInstante(frames: KF[], t: number): number {
  let ix = 0, d = Infinity;
  for (let i = 0; i < frames.length; i++) { const dd = Math.abs(frames[i][0] - t); if (dd < d - 1e-9) { d = dd; ix = i; } }
  return ix;
}
