/**
 * Limites seguros de calibração (espelham a tabela da docs/specs/SPEC-03-animacao-rig-expressoes.md).
 * Módulo puro: usado pelo painel de QA, pelo servidor de desenvolvimento (vite.config.ts),
 * pelo validador (scripts/check-content.ts) e pela aplicação da calibração em runtime.
 */

export interface Limite { min: number; max: number; passo: number; rotulo: string }

/** Campos numéricos da Pose editáveis pelo calibrador, com caminho estável ("legN.a"). */
export const LIMITES_POSE: Record<string, Limite> = {
  x: { min: -20, max: 20, passo: 0.5, rotulo: 'pelve · deslocamento x (px)' },
  y: { min: -30, max: 60, passo: 0.5, rotulo: 'pelve · altura y (px, + abaixa)' },
  rot: { min: -1.6, max: 1.6, passo: 0.01, rotulo: 'corpo · rotação (deitar/cair)' },
  hipTilt: { min: -0.6, max: 0.6, passo: 0.01, rotulo: 'quadril · inclinação lateral' },
  lean: { min: -0.5, max: 0.8, passo: 0.01, rotulo: 'tronco · lombar (lean)' },
  chest: { min: -0.4, max: 0.5, passo: 0.01, rotulo: 'tronco · peito (chest)' },
  breath: { min: 0, max: 1.5, passo: 0.01, rotulo: 'tronco · respiração' },
  neck: { min: -0.4, max: 0.4, passo: 0.01, rotulo: 'pescoço' },
  head: { min: -0.5, max: 0.5, passo: 0.01, rotulo: 'cabeça' },
  shrugN: { min: -0.3, max: 0.6, passo: 0.01, rotulo: 'ombro próximo (shrug)' },
  shrugF: { min: -0.3, max: 0.6, passo: 0.01, rotulo: 'ombro distante (shrug)' },
  'armN.a': { min: -1.2, max: 3.2, passo: 0.01, rotulo: 'braço próximo · ombro (a)' },
  'armN.b': { min: 0, max: 2.6, passo: 0.01, rotulo: 'braço próximo · cotovelo (b)' },
  'armF.a': { min: -1.2, max: 3.2, passo: 0.01, rotulo: 'braço distante · ombro (a)' },
  'armF.b': { min: 0, max: 2.6, passo: 0.01, rotulo: 'braço distante · cotovelo (b)' },
  wristN: { min: -1, max: 1, passo: 0.01, rotulo: 'punho próximo' },
  wristF: { min: -1, max: 1, passo: 0.01, rotulo: 'punho distante' },
  'legN.a': { min: -0.8, max: 1.7, passo: 0.01, rotulo: 'perna próxima · coxa (a)' },
  'legN.b': { min: 0, max: 2.4, passo: 0.01, rotulo: 'perna próxima · joelho (b)' },
  'legF.a': { min: -0.8, max: 1.7, passo: 0.01, rotulo: 'perna distante · coxa (a)' },
  'legF.b': { min: 0, max: 2.4, passo: 0.01, rotulo: 'perna distante · joelho (b)' },
  footN: { min: -0.4, max: 0.5, passo: 0.01, rotulo: 'pé próximo' },
  footF: { min: -0.4, max: 0.5, passo: 0.01, rotulo: 'pé distante' },
  sx: { min: 0.85, max: 1.15, passo: 0.005, rotulo: 'squash/stretch x' },
  sy: { min: 0.85, max: 1.15, passo: 0.005, rotulo: 'squash/stretch y' },
};

/** Agrupamento anatômico para o inspetor de pose. */
export const GRUPOS_POSE: [string, string[]][] = [
  ['Quadril', ['x', 'y', 'rot', 'hipTilt']],
  ['Tronco', ['lean', 'chest', 'breath']],
  ['Pescoço e cabeça', ['neck', 'head']],
  ['Ombros', ['shrugN', 'shrugF']],
  ['Braços e cotovelos', ['armN.a', 'armN.b', 'armF.a', 'armF.b']],
  ['Punhos', ['wristN', 'wristF']],
  ['Pernas e joelhos', ['legN.a', 'legN.b', 'legF.a', 'legF.b']],
  ['Pés', ['footN', 'footF']],
  ['Squash & stretch', ['sx', 'sy']],
];

/** Campos contínuos da expressão facial (Face). */
export const LIMITES_FACE: Record<string, Limite> = {
  browIn: { min: -1, max: 1, passo: 0.01, rotulo: 'sobrancelha interna (+ preocupada, − raiva)' },
  browUp: { min: -1, max: 1, passo: 0.01, rotulo: 'sobrancelha inteira' },
  lidTop: { min: 0, max: 1, passo: 0.01, rotulo: 'pálpebra superior (1 = fechado)' },
  lidBot: { min: 0, max: 1, passo: 0.01, rotulo: 'pálpebra inferior' },
  smile: { min: -1, max: 1, passo: 0.01, rotulo: 'sorriso (−1 triste .. 1)' },
  open: { min: 0, max: 1, passo: 0.01, rotulo: 'abertura da boca' },
  wide: { min: 0, max: 1, passo: 0.01, rotulo: 'largura extra da boca' },
  teeth: { min: 0, max: 1, passo: 0.01, rotulo: 'dentes' },
  tongue: { min: 0, max: 1, passo: 0.01, rotulo: 'língua' },
  pupil: { min: 0.5, max: 1.6, passo: 0.01, rotulo: 'pupila (escala)' },
  asym: { min: -1, max: 1, passo: 0.01, rotulo: 'sorriso de canto' },
  pucker: { min: 0, max: 1, passo: 0.01, rotulo: 'bico' },
  blush: { min: 0, max: 1, passo: 0.01, rotulo: 'rubor' },
};

/** Expressões de sofrimento: regra da SPEC-03 (nunca smile > 0). */
export const EXPRESSOES_SOFRIMENTO = ['triste', 'chorando', 'dor', 'humilhado', 'doente', 'assustado', 'ofegante', 'chocado'];

export const LIMITE_KEYFRAME_T = { min: 0, max: 10 };
export const LIMITE_DUR = { min: 0.1, max: 10 };

/** Lê um campo da pose por caminho ("legN.a"). */
export function lerCampo(obj: any, caminho: string): number | undefined {
  const [a, b] = caminho.split('.');
  const v = b ? obj?.[a]?.[b] : obj?.[a];
  return typeof v === 'number' ? v : undefined;
}
