import { Appearance } from './appearance';
import { Dims, Pose, Pt } from './rig';
import { Face } from './expressions';
import { makePalette } from './palette';
import { RC, TOP_SPECS } from './rc';
import { armPoints, drawArm, drawHand, drawLeg, drawTorsoSkin, drawNeck, drawTop, drawHood, drawSkirt, drawNecklace, torsoGeom } from './body';
import { headGeom, drawEar, drawFaceBase, drawEye, drawBrow, drawNose, drawMouth, drawBeard, drawMustache, drawFaceExtras, drawGlasses } from './head';
import { drawHairBack, drawHairFront, drawHat } from './hair';
import { drawHeldProp } from '../render/props';
import { Ctx } from '../render/draw';
import { hashStr } from '../core/rng';
import { clamp, lerp } from '../core/math';

export interface DrawOpts {
  turn?: number;
  lookX?: number;
  lookY?: number;
  blink?: number;
  talk?: number;
  sway?: number;
  light?: number; // lado da luz no espaço local
  t?: number;
  propN?: string;
  propF?: string;
  outfit?: Partial<Appearance>;
  lw?: number;
  shadow?: boolean;
  seedKey?: string;
  /**
   * Camada a desenhar (contato entre personagens): 'tras' = braço/objeto distantes; 'corpo' = pernas, tronco, cabeça;
   * 'frente' = braço/objeto próximos; 'maoN' = só a mão próxima (a mão reaparece sobre as costas do outro depois
   * que o braço passou por trás dele). Sem valor = tudo (comportamento normal).
   */
  camada?: 'tras' | 'corpo' | 'frente' | 'maoN';
}

export interface CharFrame {
  head: Pt; // centro da cabeça em coordenadas locais (y para cima negativo)
  headR: number;
  handN?: Pt;
  handF?: Pt;
  top: number; // topo aproximado (y)
}

const seedCache = new Map<string, number>();

function effective(ap: Appearance, age: number, outfit?: Partial<Appearance>): Appearance {
  let a = outfit ? { ...ap, ...outfit } : ap;
  if (age < 2) {
    a = { ...a, hairStyle: age < 1 ? 'raspado' : 'cacheadoCurto', top: outfit?.top ?? 'body', glasses: 'nenhum', hat: outfit?.hat ?? 'nenhum', earrings: 'nenhum', necklace: 'nenhum', eyeshadow: '', lipstick: 0, shoes: 'descalco', facialHair: 'nenhum' };
  } else if (age < 5) {
    const longy = ['longo', 'ondulado', 'franja', 'trancas', 'dreads', 'blackPower'];
    a = { ...a, hairStyle: longy.includes(a.hairStyle) ? (a.sex === 'f' ? 'mariaChiquinha' : 'cacheadoCurto') : a.hairStyle, eyeshadow: '', lipstick: 0 };
  } else if (age < 13) {
    a = { ...a, eyeshadow: '', lipstick: 0 };
    if (a.top === 'blazer' && !outfit?.top) a = { ...a, top: 'camisa' };
  }
  return a;
}

export function legLength(d: Dims) {
  return d.thigh + d.shin + d.ankle * 0.5 + d.footH * 0.55;
}

/**
 * Apoio no chão para poses deitadas/caídas (rotação grande): quanto somar em `pose.y` para que o ponto MAIS BAIXO do corpo
 * (quadril, costas, cabeça, joelhos, calcanhares — cada um com sua espessura) encoste no chão. Sem isso, um corpo girado em
 * volta da pelve fica flutuando na altura do quadril (adulto) ou afundado (criança). Pedido "Contato do corpo caído com o chão".
 */
export function apoioNoChao(d: Dims, pose: Pose, turn: number): number {
  const sk = skeleton(d, pose, turn);
  const c = Math.cos(pose.rot), s = Math.sin(pose.rot);
  const base = -legLength(d) + pose.y;
  let max = -Infinity;
  const ponto = (p: Pt, r: number) => {
    // ponto mais baixo de um círculo de raio r em volta de p, depois da rotação do corpo
    const ry = p.x * s + p.y * c;
    max = Math.max(max, ry + r + base);
  };
  const ombros = { x: (sk.shoulderN.x + sk.shoulderF.x) / 2, y: (sk.shoulderN.y + sk.shoulderF.y) / 2 };
  ponto({ x: 0, y: 0 }, d.hipW * 0.42);
  ponto({ x: ombros.x * 0.5, y: ombros.y * 0.5 }, d.chestW * 0.44);
  ponto(ombros, d.chestW * 0.36);
  ponto(sk.head, d.headH * 0.46);
  for (const [hip, leg] of [[sk.hipN, pose.legN], [sk.hipF, pose.legF]] as const) {
    const k = { x: hip.x + Math.sin(leg.a) * d.thigh, y: hip.y + Math.cos(leg.a) * d.thigh };
    const sa = leg.a - leg.b;
    const an = { x: k.x + Math.sin(sa) * d.shin, y: k.y + Math.cos(sa) * d.shin };
    ponto(k, d.thighW * 0.42);
    ponto(an, d.footH * 0.7);
  }
  return -max;
}

/** Desenha o personagem com a origem no chão, virado para +x. */
export function drawCharacter(ctx: Ctx, apIn: Appearance, d: Dims, pose: Pose, face: Face, o: DrawOpts = {}): CharFrame {
  const ap = effective(apIn, d.age, o.outfit);
  const pal = makePalette(ap, d.age);
  const turn = o.turn ?? 0.7;
  const lx = o.light ?? -1;
  const key = o.seedKey ?? ap.skin + ap.hairColor + ap.faceShape;
  let seed = seedCache.get(key);
  if (seed === undefined) {
    seed = hashStr(key);
    seedCache.set(key, seed);
  }
  const rc: RC = {
    ctx, ap, d, pose, face, pal, turn, lx,
    sh: { x: lx * 3.2, y: -2.2 },
    shS: { x: lx * 2, y: -1.5 },
    lw: o.lw ?? 1.25,
    t: o.t ?? 0,
    lookX: o.lookX ?? 0,
    lookY: o.lookY ?? 0,
    blink: o.blink ?? 0,
    talk: o.talk ?? 0,
    sway: o.sway ?? 0,
    swayV: 0,
    lean: pose.lean + d.hunch,
    shoulderN: { x: 0, y: 0 },
    shoulderF: { x: 0, y: 0 },
    neck: { x: 0, y: 0 },
    headAng: 0,
    head: { x: 0, y: 0 },
    hipN: { x: 0, y: 0 },
    hipF: { x: 0, y: 0 },
    handAngN: 0,
    handAngF: 0,
    propN: o.propN,
    propF: o.propF,
    seed,
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // sombra no chão
  if (o.shadow !== false) {
    const sw = d.shoulderW * 0.75 * (1 - Math.min(0.6, Math.max(0, -pose.y) / 200));
    const g = ctx.createRadialGradient(pose.x, 0, 0, pose.x, 0, sw);
    g.addColorStop(0, 'rgba(20,15,30,0.34)');
    g.addColorStop(1, 'rgba(20,15,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(pose.x, 0, sw, sw * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.scale(pose.sx, pose.sy);
  const legLen = legLength(d);
  ctx.translate(pose.x, -legLen + pose.y);
  ctx.rotate(pose.rot);

  // --- geometria (esqueleto compartilhado com IK/âncoras)
  const lean = rc.lean;
  const rot = (x: number, y: number, a: number): Pt => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  const sk = skeleton(d, pose, turn);
  rc.neck = sk.neck;
  rc.shoulderN = sk.shoulderN;
  rc.shoulderF = sk.shoulderF;
  rc.headAng = sk.headAng;
  rc.head = sk.head;
  rc.hipN = sk.hipN;
  rc.hipF = sk.hipF;

  const hg = headGeom(rc);
  const inHead = (fn: () => void) => {
    ctx.save();
    ctx.translate(rc.head.x, rc.head.y);
    ctx.rotate(rc.headAng);
    fn();
    ctx.restore();
  };
  // tronco em dois segmentos: abdômen (lean) + peito (lean + chest), unidos no pivô com sobreposição
  const bent = Math.abs(pose.chest) > 0.004 || Math.abs(pose.breath) > 0.004;
  const inTorso = (fn: () => void) => {
    if (!bent) {
      ctx.save();
      ctx.rotate(lean);
      fn();
      ctx.restore();
      return;
    }
    const yP = sk.pivotY;
    ctx.save();
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.rect(-400, yP - 12, 800, 800);
    ctx.clip();
    fn();
    ctx.restore();
    ctx.save();
    ctx.rotate(lean);
    ctx.translate(0, yP);
    ctx.rotate(pose.chest);
    ctx.scale(1 + pose.breath * 0.04, 1 + pose.breath * 0.015);
    ctx.translate(0, -yP);
    ctx.beginPath();
    ctx.rect(-400, -800, 800, 800 + yP + 2);
    ctx.clip();
    fn();
    ctx.restore();
  };

  // --- ordem de pintura (com camadas opcionais para contato entre dois personagens)
  const cam = o.camada;
  const tras = !cam || cam === 'tras', corpo = !cam || cam === 'corpo', frente = !cam || cam === 'frente';
  if (!tras || !frente) {
    // mãos precisam existir no quadro mesmo quando o braço não é desenhado nesta camada
    const bN = armPoints(rc, rc.shoulderN, pose.armN, true), bF = armPoints(rc, rc.shoulderF, pose.armF, false);
    rc.handN = bN.w; rc.handAngN = bN.fa; rc.handF = bF.w; rc.handAngF = bF.fa;
  }
  if (corpo) inHead(() => drawHairBack(rc, hg));
  if (tras) {
    drawArm(rc, false);
    if (rc.propF && rc.handF) drawHeldProp(ctx, rc.propF, rc.handF, rc.handAngF, rc.t, false);
  }
  if (corpo) {
  drawLeg(rc, false);
  drawLeg(rc, true);
  inTorso(() => {
    drawTorsoSkin(rc);
    drawHood(rc);
  });
  drawNeck(rc);
  inTorso(() => {
    drawSkirt(rc);
    drawTop(rc);
    drawNecklace(rc);
  });
  inHead(() => {
    if (turn < 0.6) drawEar(rc, hg, 1);
    if (turn < 0.3) drawEar(rc, hg, -1);
    drawFaceBase(rc, hg);
    if (turn >= 0.3) drawEar(rc, hg, -1);
    drawEye(rc, hg, 1);
    drawEye(rc, hg, -1);
    drawNose(rc, hg);
    drawBeard(rc, hg);
    drawMouth(rc, hg);
    drawMustache(rc, hg);
    drawHairFront(rc, hg);
    if (d.age >= 2) {
      drawBrow(rc, hg, 1);
      drawBrow(rc, hg, -1);
    }
    drawGlasses(rc, hg);
    drawHat(rc, hg);
    drawFaceExtras(rc, hg);
  });
  }
  if (frente) {
    drawArm(rc, true);
    if (rc.propN && rc.handN) drawHeldProp(ctx, rc.propN, rc.handN, rc.handAngN, rc.t, true);
  }
  if (cam === 'maoN' && rc.handN) drawHand(rc, rc.handN, rc.handAngN + pose.wristN, pose.handN, false);
  ctx.restore();

  // coordenadas locais (aplicando squash e rotação do corpo)
  const toLocal = (p: Pt): Pt => {
    const r = rot(p.x, p.y, pose.rot);
    return { x: (r.x + pose.x) * pose.sx, y: (r.y - legLen + pose.y) * pose.sy };
  };
  return {
    head: toLocal(rc.head),
    headR: d.headH * 0.5,
    handN: rc.handN ? toLocal(rc.handN) : undefined,
    handF: rc.handF ? toLocal(rc.handF) : undefined,
    top: toLocal(rc.head).y - d.headH * 0.6,
  };
}

export interface Skeleton {
  lean: number;
  pivotY: number;
  neck: Pt;
  shoulderN: Pt;
  shoulderF: Pt;
  headAng: number;
  head: Pt;
  hipN: Pt;
  hipF: Pt;
}

/**
 * Esqueleto no quadro da pelve (y para baixo): pelve → abdômen → peito (pivô) → clavículas/ombros,
 * pescoço → cabeça, e quadris com inclinação lateral.
 */
export function skeleton(d: Dims, pose: Pose, turn: number): Skeleton {
  const lean = pose.lean + d.hunch;
  const T = d.torso;
  const pivotY = -T * 0.42;
  const kL = 1 - 0.1 * turn, kR = 1 - 0.2 * turn;
  const cx = turn * d.shoulderW * 0.1;
  const yS = -T + 5;
  const cc = Math.cos(pose.chest), cs = Math.sin(pose.chest);
  const bx = 1 + pose.breath * 0.04;
  // ponto do peito → quadro da pelve
  const up = (x: number, y: number): Pt => {
    const lx = x * bx, ly = y - pivotY;
    const rx = lx * cc - ly * cs, ry = lx * cs + ly * cc + pivotY;
    return { x: rx * Math.cos(lean) - ry * Math.sin(lean), y: rx * Math.sin(lean) + ry * Math.cos(lean) };
  };
  const sy = yS + d.armW * 0.42;
  const neck = up(cx * 0.5, -T);
  // em perfil (turn > 1) o ombro próximo vem para o meio do tronco — senão o braço nasce nas costas
  const pfO = clamp((turn - 1) / 0.45, 0, 1);
  const shoulderN = up(lerp(-d.shoulderW * 0.43 * kL, -d.shoulderW * 0.14, pfO), sy - pose.shrugN * d.armW * 0.55);
  const shoulderF = up(d.shoulderW * 0.43 * kR - turn * d.shoulderW * 0.14, sy - pose.shrugF * d.armW * 0.55);
  const base = lean + pose.chest + pose.neck;
  const hAng = base + pose.head * 0.35;
  const neckTop = { x: neck.x + Math.sin(hAng) * d.neckLen, y: neck.y - Math.cos(hAng) * d.neckLen };
  const headAng = base + pose.head;
  const head = { x: neckTop.x + Math.sin(headAng) * d.headH * 0.4, y: neckTop.y - Math.cos(headAng) * d.headH * 0.4 };
  const tilt = pose.hipTilt * d.hipW * 0.08;
  return {
    lean, pivotY, neck, shoulderN, shoulderF, headAng, head,
    hipN: { x: -d.hipW * 0.22 * (1 - 0.25 * turn), y: -tilt },
    hipF: { x: d.hipW * 0.22 * (1 - 0.6 * turn), y: tilt },
  };
}

/** Posição local da cabeça sem desenhar (para retratos / balões). */
export function headAnchor(d: Dims, pose: Pose, turn = 0.3): Pt {
  const legLen = legLength(d);
  const sk = skeleton(d, pose, turn);
  const { x, y } = sk.head;
  const r = { x: x * Math.cos(pose.rot) - y * Math.sin(pose.rot), y: x * Math.sin(pose.rot) + y * Math.cos(pose.rot) };
  return { x: (r.x + pose.x) * pose.sx, y: (r.y - legLen + pose.y) * pose.sy };
}

export { TOP_SPECS };
