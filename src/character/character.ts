import { Appearance } from './appearance';
import { Dims, Pose, Pt } from './rig';
import { Face } from './expressions';
import { makePalette } from './palette';
import { RC, TOP_SPECS } from './rc';
import { drawArm, drawLeg, drawTorsoSkin, drawNeck, drawTop, drawHood, drawSkirt, drawNecklace, torsoGeom } from './body';
import { headGeom, drawEar, drawFaceBase, drawEye, drawBrow, drawNose, drawMouth, drawBeard, drawMustache, drawFaceExtras, drawGlasses } from './head';
import { drawHairBack, drawHairFront, drawHat } from './hair';
import { drawHeldProp } from '../render/props';
import { Ctx } from '../render/draw';
import { hashStr } from '../core/rng';

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

  // --- geometria
  const lean = rc.lean;
  const rot = (x: number, y: number, a: number): Pt => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
  const tg = torsoGeom(rc);
  const T = d.torso;
  rc.neck = rot(tg.cx * 0.5, -T, lean);
  const sy = tg.yS + d.armW * 0.42;
  rc.shoulderN = rot(-d.shoulderW * 0.43 * tg.kL, sy, lean);
  rc.shoulderF = rot(d.shoulderW * 0.43 * tg.kR - turn * d.shoulderW * 0.14, sy, lean);
  const hAng = lean + pose.head * 0.35;
  const neckTop = { x: rc.neck.x + Math.sin(hAng) * d.neckLen, y: rc.neck.y - Math.cos(hAng) * d.neckLen };
  rc.headAng = lean + pose.head;
  rc.head = { x: neckTop.x + Math.sin(rc.headAng) * d.headH * 0.4, y: neckTop.y - Math.cos(rc.headAng) * d.headH * 0.4 };
  rc.hipN = { x: -d.hipW * 0.22 * (1 - 0.25 * turn), y: 0 };
  rc.hipF = { x: d.hipW * 0.22 * (1 - 0.6 * turn), y: 0 };

  const hg = headGeom(rc);
  const inHead = (fn: () => void) => {
    ctx.save();
    ctx.translate(rc.head.x, rc.head.y);
    ctx.rotate(rc.headAng);
    fn();
    ctx.restore();
  };
  const inTorso = (fn: () => void) => {
    ctx.save();
    ctx.rotate(lean);
    fn();
    ctx.restore();
  };

  // --- ordem de pintura
  inHead(() => drawHairBack(rc, hg));
  drawArm(rc, false);
  if (rc.propF && rc.handF) drawHeldProp(ctx, rc.propF, rc.handF, rc.handAngF, rc.t, false);
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
  drawArm(rc, true);
  if (rc.propN && rc.handN) drawHeldProp(ctx, rc.propN, rc.handN, rc.handAngN, rc.t, true);
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

/** Posição local da cabeça sem desenhar (para retratos / balões). */
export function headAnchor(d: Dims, pose: Pose): Pt {
  const legLen = legLength(d);
  const lean = pose.lean + d.hunch;
  const T = d.torso;
  const nx = Math.sin(lean) * T, ny = -Math.cos(lean) * T;
  const hAng = lean + pose.head;
  const x = nx + Math.sin(hAng) * (d.neckLen + d.headH * 0.4);
  const y = ny - Math.cos(hAng) * (d.neckLen + d.headH * 0.4);
  const r = { x: x * Math.cos(pose.rot) - y * Math.sin(pose.rot), y: x * Math.sin(pose.rot) + y * Math.cos(pose.rot) };
  return { x: (r.x + pose.x) * pose.sx, y: (r.y - legLen + pose.y) * pose.sy };
}

export { TOP_SPECS };
