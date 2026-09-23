import { Appearance } from './appearance';
import { clamp, lerp, smoothstep } from '../core/math';

export type Hand = 'aberta' | 'punho' | 'aponta' | 'segura' | 'acena' | 'joinha';

export interface Limb {
  a: number; // ângulo do segmento superior a partir da vertical (+ = para frente)
  b: number; // dobra da articulação (cotovelo p/ frente, joelho p/ trás)
}

export interface Pose {
  x: number; // deslocamento da pelve
  y: number; // + = abaixa
  rot: number; // rotação do corpo inteiro em torno da pelve (deitar / cair)
  lean: number; // inclinação do tronco
  head: number; // inclinação da cabeça
  armN: Limb; // braço próximo (desenhado na frente)
  armF: Limb; // braço distante
  legN: Limb;
  legF: Limb;
  footN: number;
  footF: number;
  sx: number; // squash & stretch
  sy: number;
  handN: Hand;
  handF: Hand;
}

export const restPose = (): Pose => ({
  x: 0, y: 0, rot: 0, lean: 0, head: 0,
  armN: { a: 0.06, b: 0.12 }, armF: { a: -0.06, b: 0.12 },
  legN: { a: 0.02, b: 0 }, legF: { a: -0.02, b: 0 },
  footN: 0, footF: 0, sx: 1, sy: 1, handN: 'aberta', handF: 'aberta',
});

export function copyPose(p: Pose): Pose {
  return { ...p, armN: { ...p.armN }, armF: { ...p.armF }, legN: { ...p.legN }, legF: { ...p.legF } };
}

const lerpLimb = (a: Limb, b: Limb, t: number): Limb => ({ a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t) });

export function blendPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), rot: lerp(a.rot, b.rot, t), lean: lerp(a.lean, b.lean, t), head: lerp(a.head, b.head, t),
    armN: lerpLimb(a.armN, b.armN, t), armF: lerpLimb(a.armF, b.armF, t), legN: lerpLimb(a.legN, b.legN, t), legF: lerpLimb(a.legF, b.legF, t),
    footN: lerp(a.footN, b.footN, t), footF: lerp(a.footF, b.footF, t), sx: lerp(a.sx, b.sx, t), sy: lerp(a.sy, b.sy, t),
    handN: t < 0.5 ? a.handN : b.handN, handF: t < 0.5 ? a.handF : b.handF,
  };
}

export type Stage = 'bebe' | 'crianca' | 'adolescente' | 'adulto' | 'idoso';
export function stageOf(age: number): Stage {
  if (age < 3) return 'bebe';
  if (age < 13) return 'crianca';
  if (age < 18) return 'adolescente';
  if (age < 60) return 'adulto';
  return 'idoso';
}

/** Medidas derivadas da aparência + idade. Tudo em unidades de mundo (adulto ≈ 340 de altura). */
export interface Dims {
  age: number;
  stage: Stage;
  fem: number; // 0..1 dimorfismo aplicado
  headW: number;
  headH: number;
  neckLen: number;
  neckW: number;
  torso: number;
  shoulderW: number;
  chestW: number;
  waistW: number;
  hipW: number;
  bust: number;
  belly: number;
  upperArm: number;
  foreArm: number;
  armW: number;
  foreW: number;
  handR: number;
  thigh: number;
  shin: number;
  thighW: number;
  calfW: number;
  ankle: number;
  footL: number;
  footH: number;
  hunch: number;
  wrinkles: number;
  childFace: number; // 0..1 traços infantis (olhos maiores, testa maior)
  total: number;
}

export function computeDims(ap: Appearance, age: number): Dims {
  const stage = stageOf(age);
  const f = ap.sex === 'f';
  // crescimento
  let body: number, head: number;
  if (age < 3) { body = lerp(0.34, 0.44, age / 3); head = lerp(0.66, 0.74, age / 3); }
  else if (age < 13) { body = lerp(0.46, 0.76, (age - 3) / 10); head = lerp(0.76, 0.9, (age - 3) / 10); }
  else if (age < 18) { body = lerp(0.8, 0.98, (age - 13) / 5); head = lerp(0.91, 0.99, (age - 13) / 5); }
  else if (age < 65) { body = 1; head = 1; }
  else { body = lerp(1, 0.96, clamp((age - 65) / 20)); head = 1; }
  const dim = smoothstep(10, 17, age); // dimorfismo sexual
  const fem = f ? dim : 0;
  const masc = f ? 0 : dim;
  const baby = age < 3 ? 1 : age < 6 ? 1 - (age - 3) / 3 : 0;
  const w = ap.weight * (0.35 + 0.65 * smoothstep(3, 16, age)) + baby * 0.35;
  const mu = ap.muscle * dim;

  const hScale = (0.9 + ap.height * 0.2) * body;
  const headH = 104 * (0.92 + ap.faceHeight * 0.16) * head;
  const headW = 90 * (0.9 + ap.faceWidth * 0.2) * head * (1 + baby * 0.06) * (1 + w * 0.06);
  const neckLen = (7 + ap.neckLength * 14) * body * (1 - baby * 0.6);
  const neckW = headW * (0.3 + ap.neckWidth * 0.1 + masc * 0.05 + mu * 0.05 + w * 0.06);
  const torso = 100 * hScale * (0.96 + ap.legLength * -0.08);
  const shoulderW = (86 + masc * 20 - fem * 4) * (0.86 + ap.shoulders * 0.28) * body + mu * 16 + w * 14;
  const chestW = shoulderW * (0.84 + fem * 0.04) + w * 12;
  const waistW = (58 + masc * 4 - fem * 8) * body + w * 54 + mu * 3;
  const hipW = (66 + fem * 22) * (0.88 + ap.hips * 0.26) * body + w * 30;
  const legs = 150 * hScale * (0.92 + ap.legLength * 0.16) * (1 - baby * 0.25);
  const armScale = hScale * (1 - baby * 0.25);
  const armW = (17 + mu * 9 + w * 11 - fem * 2) * (0.55 + 0.45 * body) * (1 + baby * 0.35);
  const thighW = (28 + fem * 4 + w * 18 + mu * 6) * (0.55 + 0.45 * body) * (1 + baby * 0.35);
  const wrinkles = smoothstep(48, 88, age);
  const hunch = smoothstep(68, 92, age) * 0.16;
  const d: Dims = {
    age, stage, fem,
    headW, headH, neckLen, neckW, torso, shoulderW, chestW, waistW, hipW,
    bust: fem * (0.2 + ap.chest * 0.8),
    belly: clamp(w - 0.35, 0, 1) * (1 - baby) + baby * 0.4,
    upperArm: 60 * armScale, foreArm: 56 * armScale,
    armW, foreW: armW * 0.84, handR: 10.5 * (0.6 + 0.4 * body) * (1 + baby * 0.2),
    thigh: legs * 0.5, shin: legs * 0.44, thighW, calfW: thighW * 0.72, ankle: legs * 0.06,
    footL: 30 * (0.55 + 0.45 * body) + masc * 3, footH: 12 * (0.6 + 0.4 * body),
    hunch, wrinkles, childFace: clamp(1 - (age - 2) / 13, 0, 1),
    total: 0,
  };
  d.total = legs + torso + neckLen + headH * 0.95;
  return d;
}

export interface Pt { x: number; y: number }

/** Resolve IK de 2 ossos. Retorna ângulos no padrão do rig (a a partir da vertical, b dobra p/ frente). */
export function solveIK(sx: number, sy: number, tx: number, ty: number, l1: number, l2: number, bendSign = 1): Limb {
  const dx = tx - sx, dy = ty - sy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dx, dy);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const alpha = Math.acos(cosA);
  const cosB = clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1);
  const bend = Math.PI - Math.acos(cosB);
  // no nosso padrão, ângulo cresce p/ frente; dobra positiva dobra o antebraço para frente/cima
  return { a: base - alpha * bendSign, b: bend * bendSign };
}
