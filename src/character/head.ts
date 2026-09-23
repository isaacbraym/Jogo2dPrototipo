import { RC } from './rc';
import { Pt } from './rig';
import { part, splineClosed, sampleClosed, heartPath, starPath, capsule, ellipse } from '../render/draw';
import { rgba, shade, mix } from '../core/color';
import { clamp, lerp } from '../core/math';
import { RNG } from '../core/rng';

interface FaceShape { fw: number; cw: number; jw: number; jy: number; chw: number; chy: number; cd: number; hMul?: number }
const SHAPES: Record<string, FaceShape> = {
  oval: { fw: 0.9, cw: 0.98, jw: 0.8, jy: 0.3, chw: 0.34, chy: 0.47, cd: 0.52 },
  redondo: { fw: 0.94, cw: 1.02, jw: 0.92, jy: 0.3, chw: 0.5, chy: 0.46, cd: 0.5 },
  quadrado: { fw: 0.94, cw: 0.99, jw: 0.97, jy: 0.36, chw: 0.54, chy: 0.5, cd: 0.53 },
  coracao: { fw: 0.98, cw: 1.0, jw: 0.7, jy: 0.3, chw: 0.2, chy: 0.47, cd: 0.53 },
  longo: { fw: 0.88, cw: 0.94, jw: 0.8, jy: 0.34, chw: 0.36, chy: 0.52, cd: 0.57, hMul: 1.06 },
  diamante: { fw: 0.82, cw: 1.05, jw: 0.7, jy: 0.3, chw: 0.26, chy: 0.47, cd: 0.53 },
  triangulo: { fw: 0.84, cw: 0.96, jw: 0.95, jy: 0.33, chw: 0.5, chy: 0.49, cd: 0.53 },
};

export interface HeadGeom {
  W: number;
  H: number;
  contour: Pt[];
  facePath: Path2D;
  fx: number; // deslocamento das feições (3/4)
  eyeY: number;
  eyeSp: number;
  ew: number;
  noseY: number;
  mouthY: number;
  browY: number;
  cheekW: number;
  jawY: number;
  chinY: number;
}

export function headGeom(rc: RC): HeadGeom {
  const { ap, d, turn } = rc;
  const s = SHAPES[ap.faceShape] ?? SHAPES.oval;
  const W = d.headW, H = d.headH * (s.hMul ?? 1);
  const baby = d.childFace;
  const cheek = s.cw * (0.95 + ap.cheeks * 0.1) * (1 + baby * 0.05);
  const jaw = s.jw * (0.86 + ap.jaw * 0.24) * (1 + baby * 0.12);
  const chin = s.chw * (0.75 + ap.chin * 0.5) * (1 + baby * 0.5);
  const chinDrop = (ap.chin - 0.5) * 0.04 - baby * 0.03;
  const raw: Pt[] = [
    { x: 0, y: -0.5 },
    { x: s.fw * 0.5, y: -0.27 },
    { x: cheek * 0.5, y: 0.03 },
    { x: jaw * 0.5, y: s.jy - baby * 0.04 },
    { x: chin * 0.5, y: s.chy + chinDrop },
    { x: 0, y: s.cd + chinDrop },
    { x: -chin * 0.5, y: s.chy + chinDrop },
    { x: -jaw * 0.5, y: s.jy - baby * 0.04 },
    { x: -cheek * 0.5, y: 0.03 },
    { x: -s.fw * 0.5, y: -0.27 },
  ];
  const contour = raw.map((p) => {
    let x = p.x * W, y = p.y * H;
    x *= x > 0 ? 1 - 0.15 * turn : 1 + 0.03 * turn;
    if (y > -0.1 * H) x += turn * W * 0.1 * clamp((y + 0.1 * H) / (0.6 * H), 0, 1);
    return { x, y };
  });
  const facePath = new Path2D();
  splineClosed(facePath, contour, 1);
  // crânio (parte de trás da cabeça em 3/4)
  facePath.moveTo(0, 0);
  facePath.ellipse(-turn * W * 0.1, -H * 0.13, W * (0.5 + turn * 0.04), H * 0.39, 0, 0, Math.PI * 2);
  const fx = turn * W * 0.165;
  const eyeY = H * (0.03 + (ap.eyeHeight - 0.5) * 0.08 + baby * 0.07);
  const eyeSp = W * (0.2 + (ap.eyeSpacing - 0.5) * 0.06) * (1 - 0.1 * turn);
  const ew = W * (0.19 + (ap.eyeSize - 0.5) * 0.05) * (1 + baby * 0.2);
  return {
    W, H, contour, facePath, fx, eyeY, eyeSp, ew,
    noseY: H * (0.2 + (ap.noseHeight - 0.5) * 0.05 + baby * 0.03),
    mouthY: H * (0.325 + (ap.mouthHeight - 0.5) * 0.045 + baby * 0.01),
    browY: eyeY - H * (0.115 + (ap.browHeight - 0.5) * 0.05),
    cheekW: cheek * W * 0.5,
    jawY: s.jy * H,
    chinY: (s.cd + chinDrop) * H,
  };
}

// ---------------------------------------------------------------- orelhas
export function drawEar(rc: RC, hg: HeadGeom, side: -1 | 1) {
  const { ctx, ap, pal, turn } = rc;
  const { W, H } = hg;
  const sz = 0.8 + ap.earSize * 0.4;
  const eh = H * 0.21 * sz * (ap.earStyle === 'grande' ? 1.2 : ap.earStyle === 'pequena' ? 0.82 : 1);
  const ewid = W * 0.11 * sz * (ap.earStyle === 'grande' ? 1.2 : ap.earStyle === 'colada' ? 0.75 : 1);
  let x: number;
  if (side < 0) x = -hg.cheekW * (1 + 0.02 * turn) + turn * W * 0.2;
  else x = hg.cheekW * (1 - 0.12 * turn) - turn * W * 0.05;
  const y = H * 0.07;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);
  const p = new Path2D();
  const pointy = ap.earStyle === 'pontuda';
  p.moveTo(-2, -eh * 0.45);
  if (pointy) {
    p.quadraticCurveTo(ewid * 0.6, -eh * 0.7, ewid * 1.1, -eh * 1.05);
    p.quadraticCurveTo(ewid * 1.15, -eh * 0.2, ewid * 0.9, eh * 0.1);
  } else {
    p.bezierCurveTo(ewid * 0.8, -eh * 0.62, ewid * 1.25, -eh * 0.2, ewid * 0.9, eh * 0.1);
  }
  p.bezierCurveTo(ewid * 0.7, eh * 0.35, ewid * (ap.earStyle === 'colada' ? 0.3 : 0.7), eh * 0.6, 0, eh * 0.5);
  p.closePath();
  part(ctx, p, pal.skin, pal.skinSh, pal.skinLine, rc.lw * 0.9, { x: -1.5, y: -1 });
  ctx.strokeStyle = rgba(pal.skinLine, 0.5);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(ewid * 0.2, -eh * 0.3);
  ctx.quadraticCurveTo(ewid * 0.75, -eh * 0.3, ewid * 0.55, eh * 0.05);
  ctx.quadraticCurveTo(ewid * 0.4, eh * 0.2, ewid * 0.3, eh * 0.05);
  ctx.stroke();
  // brinco
  if (ap.earrings !== 'nenhum' && rc.d.age >= 4) {
    const lx = ewid * 0.3, ly = eh * 0.48;
    ctx.fillStyle = pal.acc;
    ctx.strokeStyle = pal.accLine;
    ctx.lineWidth = 1;
    if (ap.earrings === 'ponto') {
      ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx - 0.7, ly - 0.7, 0.8, 0, Math.PI * 2); ctx.fill();
    } else if (ap.earrings === 'argola') {
      ctx.strokeStyle = pal.acc; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(lx, ly + 6, 6.5, -Math.PI * 0.4, Math.PI * 1.4); ctx.stroke();
    } else {
      const sw = Math.sin(rc.t * 3) * 0.15 + rc.sway * 0.5;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(sw);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 5); ctx.strokeStyle = pal.acc; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 9, 3, 4.5, 0, 0, Math.PI * 2); ctx.fillStyle = pal.acc; ctx.fill(); ctx.strokeStyle = pal.accLine; ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- rosto base e detalhes
export function drawFaceBase(rc: RC, hg: HeadGeom) {
  const { ctx, pal, ap, d, turn } = rc;
  const { W, H } = hg;
  part(ctx, hg.facePath, pal.skin, pal.skinSh, pal.skinLine, rc.lw, { x: rc.sh.x * 1.4, y: rc.sh.y });
  ctx.save();
  ctx.clip(hg.facePath);
  // plano lateral em 3/4
  if (turn > 0.2) {
    ctx.fillStyle = rgba(pal.skinSh, 0.35 * turn);
    ctx.beginPath();
    ctx.ellipse(hg.cheekW + W * 0.12 - turn * W * 0.05, H * 0.1, W * 0.18, H * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // luz na bochecha
  const hx = hg.fx - hg.eyeSp * 0.9, hy = hg.eyeY + H * 0.16;
  const gl = ctx.createRadialGradient(hx, hy, 0, hx, hy, W * 0.22);
  gl.addColorStop(0, rgba(pal.skinHi, 0.55));
  gl.addColorStop(1, rgba(pal.skinHi, 0));
  ctx.fillStyle = gl;
  ctx.fillRect(-W, -H, W * 2, H * 2);
  // blush
  const bl = clamp(ap.blush * 0.45 + rc.face.blush * 0.7 + d.childFace * 0.15, 0, 1);
  if (bl > 0.02) {
    for (const s of [-1, 1]) {
      const bx = hg.fx + s * hg.eyeSp * (s > 0 ? 1.05 - turn * 0.3 : 1.1), by = hg.eyeY + H * 0.15;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, W * 0.13);
      g.addColorStop(0, rgba(pal.blush, 0.55 * bl));
      g.addColorStop(1, rgba(pal.blush, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(bx, by, W * 0.15, W * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      if (rc.face.blush > 0.6) {
        ctx.strokeStyle = rgba(shade(pal.blush, -0.2), 0.5);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(bx - 6 + i * 5, by - 2);
          ctx.lineTo(bx - 9 + i * 5, by + 3);
        }
        ctx.stroke();
      }
    }
  }
  // sardas e pintas
  const r = new RNG(rc.seed);
  if (ap.freckles > 0.02) {
    ctx.fillStyle = rgba(pal.skinSh2, 0.55);
    const n = Math.round(ap.freckles * 26);
    for (let i = 0; i < n; i++) {
      const s = r.chance(0.5) ? -1 : 1;
      const fx2 = hg.fx * 1.2 + s * r.range(W * 0.04, hg.eyeSp * 1.4) * (s > 0 ? 1 - turn * 0.3 : 1);
      const fy = hg.eyeY + H * r.range(0.07, 0.2);
      ctx.beginPath();
      ctx.arc(fx2, fy, r.range(0.7, 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (ap.moles > 0.05) {
    ctx.fillStyle = rgba(shade(pal.skin, -0.55), 0.85);
    const n = 1 + Math.floor(ap.moles * 2.5);
    const r2 = new RNG(rc.seed + 7);
    for (let i = 0; i < n; i++) {
      const mx = hg.fx + r2.range(-W * 0.32, W * 0.32);
      const my = r2.range(-H * 0.05, H * 0.4);
      ctx.beginPath();
      ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // cicatriz
  if (ap.scar && ap.scar !== 'nenhuma' && d.age >= 8) {
    const sx0 = hg.fx - hg.eyeSp;
    let pts: [number, number, number, number];
    if (ap.scar === 'sobrancelha') pts = [sx0 - 2, hg.browY - H * 0.05, sx0 + 5, hg.browY + H * 0.05];
    else if (ap.scar === 'bochecha') pts = [sx0 - W * 0.08, hg.eyeY + H * 0.1, sx0 + W * 0.06, hg.eyeY + H * 0.2];
    else pts = [hg.fx * 1.2 - W * 0.06, hg.chinY - H * 0.08, hg.fx * 1.2 + W * 0.04, hg.chinY - H * 0.04];
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(pal.skinSh2, 0.9);
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.stroke();
    ctx.strokeStyle = rgba(pal.skinHi, 0.7);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(pts[0] + 1, pts[1]); ctx.lineTo(pts[2] + 1, pts[3]); ctx.stroke();
    if (ap.scar === 'bochecha') {
      ctx.strokeStyle = rgba(pal.skinSh2, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const t = i / 4, x = pts[0] + (pts[2] - pts[0]) * t, y = pts[1] + (pts[3] - pts[1]) * t;
        ctx.moveTo(x - 3, y + 2); ctx.lineTo(x + 3, y - 2);
      }
      ctx.stroke();
    }
  }
  // rugas
  if (d.wrinkles > 0.02) {
    ctx.strokeStyle = rgba(pal.skinLine, 0.35 * d.wrinkles);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const y = -H * (0.27 - i * 0.05);
      ctx.moveTo(hg.fx - W * 0.2, y);
      ctx.quadraticCurveTo(hg.fx, y - 3, hg.fx + W * 0.2, y);
    }
    for (const s of [-1, 1]) {
      const cx = hg.fx + s * (hg.eyeSp + hg.ew * 0.6);
      ctx.moveTo(cx, hg.eyeY - 2);
      ctx.lineTo(cx + s * 5, hg.eyeY - 4);
      ctx.moveTo(cx, hg.eyeY + 2);
      ctx.lineTo(cx + s * 5, hg.eyeY + 4);
      const nx = hg.fx * 1.2 + s * W * 0.13;
      ctx.moveTo(nx, hg.noseY + 2);
      ctx.quadraticCurveTo(nx + s * W * 0.05, hg.mouthY - 2, nx + s * W * 0.04, hg.mouthY + H * 0.06);
    }
    ctx.stroke();
  }
  // sombra de maquiagem
  if (ap.eyeshadow) {
    for (const s of [-1, 1] as const) {
      const ex = hg.fx + s * hg.eyeSp * (s > 0 ? 1 - 0.28 * turn : 1);
      const g = ctx.createRadialGradient(ex, hg.eyeY - hg.ew * 0.25, 0, ex, hg.eyeY - hg.ew * 0.2, hg.ew * 0.75);
      g.addColorStop(0, rgba(ap.eyeshadow, 0.55));
      g.addColorStop(1, rgba(ap.eyeshadow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(ex, hg.eyeY - hg.ew * 0.22, hg.ew * 0.8, hg.ew * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- olhos
interface EyeSpec { h: number; w?: number; ui: number; uo: number; li: number; lo: number; tilt: number; crease: number; hood?: number }
const EYES: Record<string, EyeSpec> = {
  amendoa: { h: 0.62, ui: 0.95, uo: 0.9, li: 0.52, lo: 0.42, tilt: 0.12, crease: 1 },
  redondo: { h: 0.8, ui: 1.05, uo: 1.05, li: 0.9, lo: 0.9, tilt: 0, crease: 1 },
  encapuzado: { h: 0.56, ui: 0.78, uo: 0.9, li: 0.52, lo: 0.46, tilt: 0.04, crease: 0, hood: 1 },
  elevado: { h: 0.6, ui: 0.8, uo: 1.05, li: 0.5, lo: 0.3, tilt: 0.38, crease: 1 },
  caido: { h: 0.6, ui: 1.05, uo: 0.72, li: 0.42, lo: 0.58, tilt: -0.28, crease: 1 },
  monolid: { h: 0.47, ui: 0.72, uo: 0.82, li: 0.45, lo: 0.4, tilt: 0.16, crease: 0 },
  grande: { h: 0.84, w: 1.12, ui: 1.1, uo: 1.1, li: 0.85, lo: 0.8, tilt: 0.02, crease: 1 },
  estreito: { h: 0.44, ui: 0.78, uo: 0.72, li: 0.4, lo: 0.38, tilt: 0.06, crease: 1 },
};

type Bez = [Pt, Pt, Pt, Pt];
const lp = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const bezAt = (b: Bez, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * b[0].x + 3 * u * u * t * b[1].x + 3 * u * t * t * b[2].x + t * t * t * b[3].x,
    y: u * u * u * b[0].y + 3 * u * u * t * b[1].y + 3 * u * t * t * b[2].y + t * t * t * b[3].y,
  };
};

export function drawEye(rc: RC, hg: HeadGeom, side: -1 | 1) {
  const { ctx, ap, pal, face, turn, d } = rc;
  const spec = EYES[ap.eyeShape] ?? EYES.amendoa;
  const ew = hg.ew * (spec.w ?? 1);
  const eh = ew * spec.h * 0.95 * (1 + d.childFace * 0.12);
  const tilt = spec.tilt + (ap.eyeTilt - 0.5) * 0.4;
  const scaleX = side > 0 ? 1 - 0.3 * turn : 1 + 0.03 * turn;
  const ex = hg.fx + side * hg.eyeSp * (side > 0 ? 1 - 0.3 * turn : 1 + 0.02 * turn);
  // quadro do olho: +x aponta para fora do rosto em ambos os olhos
  ctx.save();
  ctx.translate(ex, hg.eyeY);
  ctx.scale(side * scaleX, 1);

  const I: Pt = { x: -ew / 2, y: eh * 0.08 };
  const O: Pt = { x: ew / 2, y: -tilt * eh };
  const U: Bez = [I, { x: -ew * 0.24, y: -eh * spec.ui }, { x: ew * 0.24, y: -eh * spec.uo - tilt * eh * 0.4 }, O];
  const Lr: Bez = [I, { x: -ew * 0.2, y: eh * spec.li }, { x: ew * 0.22, y: eh * spec.lo - tilt * eh * 0.3 }, O];
  const lidAmt = clamp(face.lidTop + ap.lids * 0.1 + rc.blink, -0.2, 1);
  const botAmt = clamp(face.lidBot, 0, 0.9);
  const lash = pal.lash;
  const lashW = 1.9 + ap.lashes * 1.1 + (d.fem > 0.5 ? 0.5 : 0);

  if (face.happyEyes || lidAmt >= 0.97) {
    // olho fechado (^ ou —)
    ctx.strokeStyle = lash;
    ctx.lineWidth = lashW + 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (face.happyEyes) {
      ctx.moveTo(I.x, I.y + eh * 0.25);
      ctx.bezierCurveTo(-ew * 0.25, -eh * 0.85, ew * 0.25, -eh * 0.85, O.x, O.y + eh * 0.35);
    } else {
      const c = [I, lp(U[1], Lr[1], 0.95), lp(U[2], Lr[2], 0.95), O];
      ctx.moveTo(c[0].x, c[0].y);
      ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y);
      if (ap.lashes > 0.4) {
        for (let i = 0; i < 3; i++) {
          const p = bezAt(c as Bez, 0.55 + i * 0.18);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 2 + i, p.y + 3 + ap.lashes * 2);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const sclera = new Path2D();
  sclera.moveTo(I.x, I.y);
  sclera.bezierCurveTo(U[1].x, U[1].y, U[2].x, U[2].y, O.x, O.y);
  sclera.bezierCurveTo(Lr[2].x, Lr[2].y, Lr[1].x, Lr[1].y, I.x, I.y);
  sclera.closePath();
  ctx.fillStyle = '#fbf8f4';
  ctx.fill(sclera);
  ctx.save();
  ctx.clip(sclera);
  // íris
  const lx = rc.lookX * side;
  const ir = Math.min(ew * 0.31, eh * 0.78) * (1 + d.childFace * 0.1) * (spec.h > 0.75 ? 1.05 : 1);
  const icx = lx * ew * 0.2 + (side > 0 ? ew * 0.04 * turn : 0), icy = rc.lookY * eh * 0.18 + eh * 0.02;
  if (face.heartEyes) {
    const hp = new Path2D();
    heartPath(hp, icx, icy + ir * 0.3, ir * 1.05);
    ctx.fillStyle = '#e8335a';
    ctx.fill(hp);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(icx - ir * 0.35, icy - ir * 0.25, ir * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (face.dizzy) {
    ctx.strokeStyle = lash;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < 14; a += 0.3) {
      const rr = (a / 14) * ir;
      const x = icx + Math.cos(a + rc.t * 8) * rr, y = icy + Math.sin(a + rc.t * 8) * rr;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(icx, icy + ir * 0.35, ir * 0.1, icx, icy, ir);
    g.addColorStop(0, pal.irisLight);
    g.addColorStop(0.55, pal.iris);
    g.addColorStop(1, pal.irisDark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(icx, icy, ir, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(pal.irisDark, 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // pupila
    const pr = ir * (0.38 + ap.pupil * 0.16) * face.pupil;
    ctx.fillStyle = '#120c0c';
    ctx.beginPath();
    ctx.arc(icx, icy, pr, 0, Math.PI * 2);
    ctx.fill();
    // brilhos
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(icx - ir * 0.36 * side, icy - ir * 0.38, ir * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(icx + ir * 0.35 * side, icy + ir * 0.3, ir * 0.13, 0, Math.PI * 2);
    ctx.fill();
    if (face.sparkle) {
      const sp = new Path2D();
      starPath(sp, icx + ir * 0.1, icy - ir * 0.05, ir * 0.55, ir * 0.14, 4);
      ctx.fill(sp);
    }
  }
  // sombra da pálpebra superior
  const sg = ctx.createLinearGradient(0, -eh * 0.9, 0, eh * 0.1);
  sg.addColorStop(0, 'rgba(60,30,30,0.35)');
  sg.addColorStop(1, 'rgba(60,30,30,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(-ew, -eh * 1.2, ew * 2, eh * 1.3);
  ctx.restore();

  // pálpebra superior
  let top: Pt[] = U;
  if (lidAmt > 0.02) {
    const c: Pt[] = [I, lp(U[1], Lr[1], lidAmt * 0.95), lp(U[2], Lr[2], lidAmt * 0.95), O];
    const lid = new Path2D();
    lid.moveTo(I.x, I.y);
    lid.bezierCurveTo(U[1].x, U[1].y - 1, U[2].x, U[2].y - 1, O.x, O.y);
    lid.bezierCurveTo(c[2].x, c[2].y, c[1].x, c[1].y, I.x, I.y);
    lid.closePath();
    ctx.fillStyle = mix(pal.skin, pal.skinSh, 0.25);
    ctx.fill(lid);
    ctx.strokeStyle = mix(pal.skin, pal.skinSh, 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke(lid);
    top = c;
  }
  // pálpebra inferior
  if (botAmt > 0.02) {
    const c: Pt[] = [I, lp(Lr[1], U[1], botAmt * 0.6), lp(Lr[2], U[2], botAmt * 0.6), O];
    const lid = new Path2D();
    lid.moveTo(I.x, I.y);
    lid.bezierCurveTo(Lr[1].x, Lr[1].y + 1, Lr[2].x, Lr[2].y + 1, O.x, O.y);
    lid.bezierCurveTo(c[2].x, c[2].y, c[1].x, c[1].y, I.x, I.y);
    ctx.fillStyle = pal.skin;
    ctx.fill(lid);
    ctx.strokeStyle = rgba(pal.skinLine, 0.45);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(I.x, I.y);
    ctx.bezierCurveTo(c[1].x, c[1].y, c[2].x, c[2].y, O.x, O.y);
    ctx.stroke();
  } else {
    ctx.strokeStyle = rgba(pal.skinLine, 0.35);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(I.x + ew * 0.1, I.y + 1);
    ctx.bezierCurveTo(Lr[1].x, Lr[1].y + 0.5, Lr[2].x, Lr[2].y + 0.5, O.x, O.y + 1);
    ctx.stroke();
  }
  // linha dos cílios
  ctx.strokeStyle = lash;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lashW;
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  ctx.bezierCurveTo(top[1].x, top[1].y, top[2].x, top[2].y, top[3].x, top[3].y);
  ctx.stroke();
  // reforço externo + cílios
  const tb = top as Bez;
  ctx.lineWidth = lashW * 1.35;
  ctx.beginPath();
  const a0 = bezAt(tb, 0.55);
  ctx.moveTo(a0.x, a0.y);
  for (let t = 0.6; t <= 1.001; t += 0.1) {
    const p = bezAt(tb, t);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  if (ap.lashes > 0.35) {
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    const n = ap.lashes > 0.7 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const p = bezAt(tb, 0.72 + i * 0.12);
      const len = 3 + ap.lashes * 4;
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + len * 0.5, p.y - len * 0.3, p.x + len * 0.8, p.y - len * 0.9);
    }
    ctx.moveTo(O.x, O.y);
    ctx.quadraticCurveTo(O.x + 3, O.y - 1, O.x + 3 + ap.lashes * 3, O.y - 3 - ap.lashes * 2);
    ctx.stroke();
  }
  // vinco
  if (spec.crease && lidAmt < 0.8) {
    ctx.strokeStyle = rgba(pal.skinLine, 0.32);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-ew * 0.3, U[1].y * 0.7 - eh * 0.38);
    ctx.quadraticCurveTo(0, -eh * (spec.ui + 0.55), ew * 0.42, O.y - eh * 0.5);
    ctx.stroke();
  } else if (spec.hood) {
    ctx.strokeStyle = rgba(pal.skinLine, 0.28);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-ew * 0.35, -eh * 0.7);
    ctx.quadraticCurveTo(ew * 0.1, -eh * 1.05, ew * 0.55, O.y - eh * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- sobrancelhas
export function drawBrow(rc: RC, hg: HeadGeom, side: -1 | 1) {
  const { ctx, ap, pal, face, turn } = rc;
  const ew = hg.ew;
  const scaleX = side > 0 ? 1 - 0.3 * turn : 1 + 0.03 * turn;
  const ex = hg.fx + side * hg.eyeSp * (side > 0 ? 1 - 0.3 * turn : 1 + 0.02 * turn);
  const style = ap.browStyle;
  let th = ew * (0.12 + ap.browThickness * 0.14);
  if (style === 'grossa' || style === 'cerrada') th *= 1.35;
  if (style === 'fina') th *= 0.6;
  const len = ew * (0.95 + ap.browLength * 0.4);
  let curve = ew * (0.08 + ap.browCurve * 0.18);
  if (style === 'reta') curve *= 0.3;
  if (style === 'arqueada' || style === 'arredondada') curve *= 1.5;
  const raiseAll = face.browUp * ew * 0.35;
  const inY = -face.browIn * ew * 0.3;
  const inX = face.browIn < 0 ? -face.browIn * ew * 0.08 : 0;
  ctx.save();
  ctx.translate(ex, hg.browY - raiseAll);
  ctx.scale(side * scaleX, 1);
  const P0: Pt = { x: -ew * 0.55 + inX, y: inY + (face.browIn < 0 ? -face.browIn * ew * 0.08 : 0) };
  const peakT = style === 'angulada' ? 0.62 : style === 'arqueada' ? 0.6 : 0.5;
  const P2: Pt = { x: -ew * 0.55 + len, y: ew * 0.12 - face.browIn * ew * 0.05 };
  const Pm: Pt = { x: lerp(P0.x, P2.x, peakT), y: lerp(P0.y, P2.y, peakT) - curve };
  const pts: Pt[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let p: Pt;
    if (style === 'angulada') {
      p = t < peakT ? lp(P0, Pm, t / peakT) : lp(Pm, P2, (t - peakT) / (1 - peakT));
    } else {
      const c = { x: 2 * Pm.x - (P0.x + P2.x) / 2, y: 2 * Pm.y - (P0.y + P2.y) / 2 };
      const u = 1 - t;
      p = { x: u * u * P0.x + 2 * u * t * c.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * c.y + t * t * P2.y };
    }
    pts.push(p);
  }
  const thick = (t: number) => {
    const base = style === 'reta' || style === 'grossa' ? 1 - t * 0.45 : 1 - t * 0.7;
    return th * Math.max(0.2, base) * (t < 0.08 ? 0.75 + t * 3 : 1);
  };
  const p = new Path2D();
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
    const nx = -dy / dl, ny = dx / dl;
    const w = thick(i / N) / 2;
    top.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
    bot.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
  }
  p.moveTo(top[0].x, top[0].y);
  for (const q of top) p.lineTo(q.x, q.y);
  for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i].x, bot[i].y);
  p.closePath();
  ctx.fillStyle = pal.brow;
  ctx.strokeStyle = pal.brow;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.2;
  ctx.fill(p);
  ctx.stroke(p);
  if (style === 'cerrada' || style === 'grossa') {
    ctx.strokeStyle = rgba(shade(pal.brow, -0.3), 0.7);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 1; i < N; i += 1) {
      const q = pts[i];
      ctx.moveTo(q.x - 1, q.y + th * 0.3);
      ctx.lineTo(q.x + 2, q.y - th * 0.45);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- nariz
export function drawNose(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, turn, d } = rc;
  const { W, H } = hg;
  const size = (0.8 + ap.noseSize * 0.4) * (1 - d.childFace * 0.3);
  const nw = W * (0.1 + ap.noseWidth * 0.06) * size;
  const nl = H * (0.13 + ap.noseSize * 0.05) * size;
  const x = hg.fx * 1.55;
  const y = hg.noseY;
  const st = ap.noseStyle;
  const line = rgba(pal.skinLine, 0.75);
  ctx.save();
  ctx.translate(x, y);
  // sombra projetada
  ctx.fillStyle = rgba(pal.skinSh2, 0.3);
  ctx.beginPath();
  ctx.ellipse(-rc.lx * 2 + turn * 3, nw * 0.35, nw * 0.7, nw * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5;
  // ponte (visível em 3/4)
  if (turn > 0.45 || st === 'aquilino') {
    ctx.beginPath();
    const bx = nw * 0.35 + turn * nw * 0.4;
    ctx.moveTo(bx - 1, -nl * 0.7);
    if (st === 'aquilino') ctx.quadraticCurveTo(bx + nw * 0.55, -nl * 0.45, bx + nw * 0.35, -nl * 0.1);
    else ctx.quadraticCurveTo(bx + nw * 0.15, -nl * 0.4, bx + nw * 0.35 + (st === 'arrebitado' ? -2 : 0), -nl * 0.1);
    ctx.globalAlpha = 0.25 + turn * 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // ponta
  ctx.fillStyle = rgba(pal.skinSh, 0.8);
  if (st === 'redondo' || st === 'botao') {
    const r = st === 'redondo' ? nw * 0.55 : nw * 0.38;
    ctx.beginPath();
    ctx.ellipse(turn * 3, -r * 0.2, r, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(pal.skinSh, 0.35);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(turn * 3, -r * 0.1, r, 0.3, Math.PI - 0.3);
    ctx.stroke();
  } else if (st === 'largo') {
    ctx.beginPath();
    ctx.moveTo(-nw * 0.9, -nw * 0.1);
    ctx.quadraticCurveTo(-nw * 1.0, nw * 0.35, -nw * 0.45, nw * 0.3);
    ctx.quadraticCurveTo(0, nw * 0.55, nw * 0.45 + turn * 2, nw * 0.3);
    ctx.quadraticCurveTo(nw * 1.0, nw * 0.35, nw * 0.9, -nw * 0.1);
    ctx.stroke();
  } else if (st === 'arrebitado') {
    ctx.beginPath();
    ctx.moveTo(-nw * 0.5, nw * 0.1);
    ctx.quadraticCurveTo(0, nw * 0.5, nw * 0.55 + turn * 3, -nw * 0.1);
    ctx.stroke();
  } else if (st === 'pequeno') {
    ctx.beginPath();
    ctx.moveTo(nw * 0.1 + turn * 3, -nw * 0.5);
    ctx.quadraticCurveTo(nw * 0.45 + turn * 3, nw * 0.1, -nw * 0.1, nw * 0.2);
    ctx.stroke();
  } else {
    // reto / fino / aquilino
    const k = st === 'fino' ? 0.7 : 1;
    ctx.beginPath();
    ctx.moveTo(-nw * 0.55 * k, nw * 0.05);
    ctx.quadraticCurveTo(-nw * 0.3 * k, nw * 0.4, 0, nw * 0.35);
    ctx.quadraticCurveTo(nw * 0.5 * k + turn * 3, nw * 0.4, nw * 0.55 * k + turn * 4, -nw * 0.1);
    ctx.stroke();
  }
  // narinas
  ctx.fillStyle = rgba(shade(pal.skin, -0.5), 0.55);
  const nr = st === 'arrebitado' ? 1.9 : st === 'largo' ? 1.7 : 1.3;
  for (const s of [-1, 1]) {
    if (s > 0 && turn > 0.7) continue;
    ctx.beginPath();
    ctx.ellipse(s * nw * 0.32 + turn * 2, nw * 0.25, nr * 1.3, nr * 0.8, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // brilho da ponta
  ctx.fillStyle = rgba(pal.skinHi, 0.8);
  ctx.beginPath();
  ctx.ellipse(-nw * 0.1 + turn * 2, -nw * 0.3, 2.2 * size, 1.5 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- boca
export function drawMouth(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, face, turn, d } = rc;
  const { W, H } = hg;
  const st = ap.mouthStyle;
  const wMul = st === 'larga' ? 1.2 : st === 'pequena' ? 0.8 : st === 'coracao' ? 0.92 : 1;
  const full = clamp(ap.lipFullness + (st === 'carnuda' ? 0.3 : st === 'fina' ? -0.3 : 0), 0, 1.3);
  const talkOpen = rc.talk;
  const open = clamp(face.open + talkOpen * 0.5, 0, 1);
  const pucker = face.pucker;
  const mw = W * (0.12 + ap.mouthWidth * 0.06) * wMul * (1 + face.wide * 0.35 + face.smile * 0.08) * (1 - pucker * 0.55) * (1 - d.childFace * 0.2);
  const smile = face.smile;
  const x = hg.fx * 1.3, y = hg.mouthY;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 - 0.18 * turn, 1);
  const cy = -smile * H * 0.04;
  const L: Pt = { x: -mw, y: cy + face.asym * H * 0.012 };
  const R: Pt = { x: mw, y: cy - face.asym * H * 0.03 };
  const lipsAlpha = clamp(0.35 + full * 0.5 + ap.lipstick * 0.4 + d.fem * 0.2, 0, 1);

  if (pucker > 0.5) {
    const r = W * 0.05;
    ctx.fillStyle = pal.lip;
    ctx.strokeStyle = pal.lipLine;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.1, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shade(pal.lip, -0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.35, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (open < 0.06) {
    // boca fechada: lábios + linha
    const midY = smile * H * 0.018;
    if (lipsAlpha > 0.1) {
      const upH = H * 0.012 * (0.5 + full) , loH = H * 0.026 * (0.4 + full);
      ctx.globalAlpha = lipsAlpha;
      const up = new Path2D();
      up.moveTo(L.x, L.y);
      if (st === 'coracao' || full > 0.6) {
        up.quadraticCurveTo(-mw * 0.5, midY - upH * 1.6, -mw * 0.12, midY - upH * 1.5);
        up.quadraticCurveTo(0, midY - upH * 0.9, mw * 0.12, midY - upH * 1.5);
        up.quadraticCurveTo(mw * 0.5, midY - upH * 1.6, R.x, R.y);
      } else up.quadraticCurveTo(0, midY - upH * 2.2, R.x, R.y);
      up.quadraticCurveTo(0, midY * 2 - 1, L.x, L.y);
      ctx.fillStyle = pal.lipSh;
      ctx.fill(up);
      const lo = new Path2D();
      lo.moveTo(L.x, L.y);
      lo.quadraticCurveTo(0, midY * 2 - 1, R.x, R.y);
      lo.quadraticCurveTo(mw * 0.6, midY + loH * 1.6, 0, midY + loH * 1.7);
      lo.quadraticCurveTo(-mw * 0.6, midY + loH * 1.6, L.x, L.y);
      ctx.fillStyle = pal.lip;
      ctx.fill(lo);
      ctx.fillStyle = rgba('#ffffff', 0.35);
      ctx.beginPath();
      ctx.ellipse(-mw * 0.15, midY + loH * 0.9, mw * 0.22, loH * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = pal.lipLine;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L.x, L.y);
    ctx.quadraticCurveTo(0, midY * 2, R.x, R.y);
    ctx.stroke();
    // covinhas do sorriso
    if (smile > 0.4) {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(pal.skinLine, 0.45);
      ctx.beginPath();
      ctx.moveTo(L.x - 2, L.y - 3); ctx.quadraticCurveTo(L.x - 4, L.y, L.x - 1.5, L.y + 3);
      ctx.moveTo(R.x + 2, R.y - 3); ctx.quadraticCurveTo(R.x + 4, R.y, R.x + 1.5, R.y + 3);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // boca aberta
  const oh = H * 0.15 * open;
  const topY = -oh * 0.15 + smile * H * 0.012;
  const botY = oh * 0.85 + smile * H * 0.03;
  const cav = new Path2D();
  cav.moveTo(L.x, L.y);
  cav.bezierCurveTo(-mw * 0.5, topY - H * 0.005, mw * 0.5, topY - H * 0.005, R.x, R.y);
  cav.bezierCurveTo(mw * 0.8, botY, -mw * 0.8, botY, L.x, L.y);
  cav.closePath();
  ctx.fillStyle = pal.mouth;
  ctx.fill(cav);
  ctx.save();
  ctx.clip(cav);
  if (face.teeth > 0.05) {
    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(-mw, topY - 4, mw * 2, 4 + H * 0.028 * face.teeth);
    if (open > 0.55 && face.teeth > 0.7) {
      ctx.fillRect(-mw, botY - H * 0.022, mw * 2, H * 0.03);
    }
  }
  if (face.tongue > 0.05 || open > 0.4) {
    ctx.fillStyle = '#e0707e';
    ctx.beginPath();
    ctx.ellipse(mw * 0.05, botY, mw * 0.55, oh * 0.35 * (0.6 + face.tongue * 0.6), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = pal.lipLine;
  ctx.lineWidth = 1.8;
  ctx.stroke(cav);
  if (lipsAlpha > 0.3) {
    ctx.globalAlpha = lipsAlpha * 0.9;
    ctx.strokeStyle = pal.lip;
    ctx.lineWidth = 2 + full * 2;
    ctx.beginPath();
    ctx.moveTo(L.x + 2, L.y + 2);
    ctx.bezierCurveTo(mw * -0.6, botY + 3, mw * 0.6, botY + 3, R.x - 2, R.y + 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- barba
function beardPath(rc: RC, hg: HeadGeom, kind: string): Path2D | null {
  const { W, H } = hg;
  const c = sampleClosed(hg.contour, 8);
  const p = new Path2D();
  const mx = hg.fx * 1.3, my = hg.mouthY;
  const mw = W * 0.2;
  if (kind === 'cheia' || kind === 'rala' || kind === 'lenhador' || kind === 'costeleta') {
    const yTop = hg.eyeY + H * 0.12;
    const lower = c.filter((q) => q.y > yTop);
    // ordena da direita para a esquerda pela parte de baixo
    const right = lower.filter((q) => q.x >= 0).sort((a, b) => a.y - b.y);
    const left = lower.filter((q) => q.x < 0).sort((a, b) => b.y - a.y);
    const ext = kind === 'lenhador' ? H * 0.18 : kind === 'cheia' ? H * 0.04 : 0;
    const outer = [...right, ...left].map((q) => {
      const k = 1.04;
      const down = Math.max(0, (q.y - hg.jawY) / (hg.chinY - hg.jawY));
      return { x: q.x * k, y: q.y + ext * down + (kind === 'costeleta' ? 0 : 1.5) };
    });
    if (!outer.length) return null;
    p.moveTo(outer[0].x, outer[0].y);
    for (const q of outer) p.lineTo(q.x, q.y);
    if (kind === 'costeleta') {
      const inner = outer.map((q) => ({ x: q.x * 0.84 + mx * 0.1, y: q.y - H * 0.06 })).reverse();
      for (const q of inner) p.lineTo(q.x, q.y);
    } else {
      const last = outer[outer.length - 1];
      p.lineTo(last.x * 0.85, last.y - H * 0.02);
      p.quadraticCurveTo(mx - mw * 1.3, my - H * 0.02, mx - mw * 0.6, my - H * 0.075);
      p.quadraticCurveTo(mx, my - H * 0.095, mx + mw * 0.6, my - H * 0.075);
      p.quadraticCurveTo(mx + mw * 1.3, my - H * 0.02, outer[0].x * 0.85, outer[0].y - H * 0.02);
    }
    p.closePath();
    return p;
  }
  if (kind === 'cavanhaque') {
    p.moveTo(mx - mw * 0.75, my - H * 0.06);
    p.quadraticCurveTo(mx, my - H * 0.09, mx + mw * 0.75, my - H * 0.06);
    p.quadraticCurveTo(mx + mw * 0.95, my + H * 0.02, mx + mw * 0.5, hg.chinY - H * 0.02);
    p.quadraticCurveTo(mx, hg.chinY + H * 0.05, mx - mw * 0.5, hg.chinY - H * 0.02);
    p.quadraticCurveTo(mx - mw * 0.95, my + H * 0.02, mx - mw * 0.75, my - H * 0.06);
    p.closePath();
    return p;
  }
  return null;
}

export function drawBeard(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, d } = rc;
  const kind = ap.facialHair;
  if (kind === 'nenhum' || d.age < 16 || kind === 'bigode' || kind === 'guidao') return;
  const p = beardPath(rc, hg, kind);
  if (!p) return;
  if (kind === 'rala') {
    ctx.save();
    ctx.clip(hg.facePath);
    ctx.fillStyle = rgba(pal.fh, 0.28);
    ctx.fill(p);
    ctx.clip(p);
    const r = new RNG(rc.seed + 3);
    ctx.fillStyle = rgba(pal.fhSh, 0.45);
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(r.range(-hg.W * 0.6, hg.W * 0.6), r.range(hg.eyeY, hg.H * 0.62), 1, 1);
    }
    ctx.restore();
    return;
  }
  const g = ctx.createLinearGradient(0, hg.eyeY, 0, hg.chinY + 20);
  g.addColorStop(0, pal.fh);
  g.addColorStop(1, pal.fhSh);
  part(ctx, p, g, pal.fhSh, pal.fhLine, rc.lw * 0.9, rc.shS);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = rgba(pal.fhSh, 0.7);
  ctx.lineWidth = 1;
  const r = new RNG(rc.seed + 5);
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = r.range(-hg.W * 0.55, hg.W * 0.55), y = r.range(hg.eyeY + 10, hg.chinY + 20);
    ctx.moveTo(x, y);
    ctx.lineTo(x + r.range(-1.5, 1.5), y + 4);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawMustache(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, d, face } = rc;
  const kind = ap.facialHair;
  if (d.age < 16 || !['bigode', 'guidao', 'cavanhaque', 'cheia', 'lenhador'].includes(kind)) return;
  const { W, H } = hg;
  const mx = hg.fx * 1.3, my = hg.mouthY - H * 0.035 - face.open * H * 0.01 - face.smile * H * 0.01;
  const mw = W * (kind === 'guidao' ? 0.2 : 0.17);
  const p = new Path2D();
  p.moveTo(mx, my - H * 0.03);
  p.quadraticCurveTo(mx + mw * 0.6, my - H * 0.045, mx + mw, my + H * 0.005);
  if (kind === 'guidao') {
    p.quadraticCurveTo(mx + mw * 1.35, my - H * 0.01, mx + mw * 1.25, my - H * 0.06);
    p.quadraticCurveTo(mx + mw * 1.5, my - H * 0.01, mx + mw * 1.1, my + H * 0.02);
  }
  p.quadraticCurveTo(mx + mw * 0.5, my + H * 0.012, mx, my + H * 0.002);
  p.quadraticCurveTo(mx - mw * 0.5, my + H * 0.012, mx - mw, my + H * 0.005);
  if (kind === 'guidao') {
    p.quadraticCurveTo(mx - mw * 1.5, my - H * 0.01, mx - mw * 1.25, my - H * 0.06);
    p.quadraticCurveTo(mx - mw * 1.35, my - H * 0.01, mx - mw * 1.0, my + H * 0.005);
  }
  p.quadraticCurveTo(mx - mw * 0.6, my - H * 0.045, mx, my - H * 0.03);
  p.closePath();
  part(ctx, p, pal.fh, pal.fhSh, pal.fhLine, rc.lw * 0.8, { x: 0, y: -1.5 });
}

// ---------------------------------------------------------------- extras de expressão
export function drawFaceExtras(rc: RC, hg: HeadGeom) {
  const { ctx, face, t } = rc;
  const { W, H } = hg;
  if (face.tears) {
    for (const s of [-1, 1] as const) {
      if (s > 0 && rc.turn > 0.8) continue;
      const ex = hg.fx + s * hg.eyeSp * (s > 0 ? 1 - 0.3 * rc.turn : 1) + s * hg.ew * 0.25;
      const g = ctx.createLinearGradient(0, hg.eyeY, 0, hg.chinY);
      g.addColorStop(0, 'rgba(140,200,255,0.85)');
      g.addColorStop(1, 'rgba(140,200,255,0.1)');
      ctx.fillStyle = g;
      ctx.beginPath();
      const wob = Math.sin(t * 6 + s) * 1.5;
      ctx.moveTo(ex - 2.5, hg.eyeY + 3);
      ctx.quadraticCurveTo(ex - 4 + wob, hg.eyeY + H * 0.2, ex - 2 + wob, hg.chinY - 4);
      ctx.lineTo(ex + 3 + wob, hg.chinY - 4);
      ctx.quadraticCurveTo(ex + 3 + wob, hg.eyeY + H * 0.2, ex + 2.5, hg.eyeY + 3);
      ctx.fill();
    }
  }
  if (face.sweat) {
    const sx = hg.fx - W * 0.38, sy = -H * 0.18 + ((t * 20) % 14);
    const p = new Path2D();
    p.moveTo(sx, sy - 7);
    p.quadraticCurveTo(sx + 5, sy + 1, sx, sy + 3.5);
    p.quadraticCurveTo(sx - 5, sy + 1, sx, sy - 7);
    ctx.fillStyle = 'rgba(170,220,255,0.9)';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(60,120,180,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke(p);
  }
  if (face.anger) {
    const ax = hg.fx + W * 0.28, ay = -H * 0.3;
    const pulse = 1 + Math.sin(t * 10) * 0.12;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#e0233a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
      ctx.quadraticCurveTo(Math.cos(a + 0.5) * 6, Math.sin(a + 0.5) * 6, Math.cos(a) * 8, Math.sin(a) * 8);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Óculos (sobre os olhos). */
export function drawGlasses(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, turn } = rc;
  if (ap.glasses === 'nenhum' || rc.d.age < 4) return;
  const st = ap.glasses;
  const dark = st === 'aviador' || st === 'escuro';
  const ew = hg.ew;
  const lensW = ew * 0.72, lensH = ew * (st === 'aviador' ? 0.62 : st === 'redondo' ? 0.66 : 0.5);
  const centers = ([-1, 1] as const).map((s) => ({ s, x: hg.fx + s * hg.eyeSp * (s > 0 ? 1 - 0.3 * turn : 1 + 0.02 * turn), sx: s > 0 ? 1 - 0.3 * turn : 1 }));
  ctx.save();
  ctx.lineWidth = st === 'quadrado' || st === 'escuro' ? 3 : 2.2;
  ctx.strokeStyle = pal.glass;
  ctx.lineJoin = 'round';
  for (const c of centers) {
    ctx.save();
    ctx.translate(c.x, hg.eyeY + 1);
    ctx.scale(c.s * c.sx, 1);
    const p = new Path2D();
    if (st === 'redondo') ellipse(p, 0, 0, lensW, lensW * 0.95);
    else if (st === 'aviador') {
      p.moveTo(-lensW, -lensH * 0.7);
      p.quadraticCurveTo(0, -lensH * 0.95, lensW * 1.05, -lensH * 0.7);
      p.quadraticCurveTo(lensW * 1.2, lensH * 0.9, lensW * 0.1, lensH);
      p.quadraticCurveTo(-lensW * 0.9, lensH * 0.9, -lensW, -lensH * 0.7);
    } else if (st === 'gatinho') {
      p.moveTo(-lensW * 0.9, -lensH * 0.6);
      p.lineTo(lensW * 1.25, -lensH * 1.05);
      p.quadraticCurveTo(lensW * 1.1, lensH * 0.9, 0, lensH * 0.85);
      p.quadraticCurveTo(-lensW * 1.0, lensH * 0.8, -lensW * 0.9, -lensH * 0.6);
    } else {
      const rr = st === 'escuro' ? 5 : 4;
      p.moveTo(-lensW + rr, -lensH);
      p.arcTo(lensW, -lensH, lensW, lensH, rr);
      p.arcTo(lensW, lensH, -lensW, lensH, rr * 1.8);
      p.arcTo(-lensW, lensH, -lensW, -lensH, rr * 1.8);
      p.arcTo(-lensW, -lensH, lensW, -lensH, rr);
      p.closePath();
    }
    if (dark) {
      const g = ctx.createLinearGradient(0, -lensH, 0, lensH);
      g.addColorStop(0, 'rgba(20,22,30,0.95)');
      g.addColorStop(1, st === 'aviador' ? 'rgba(90,60,40,0.85)' : 'rgba(40,40,55,0.92)');
      ctx.fillStyle = g;
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(-lensW, -lensH * 0.2);
      ctx.lineTo(-lensW * 0.2, -lensH);
      ctx.lineTo(lensW * 0.1, -lensH);
      ctx.lineTo(-lensW, lensH * 0.3);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(200,230,255,0.16)';
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-lensW * 0.5, -lensH * 0.3);
      ctx.lineTo(-lensW * 0.1, -lensH * 0.75);
      ctx.stroke();
      ctx.restore();
    }
    ctx.stroke(p);
    ctx.restore();
  }
  // ponte
  const a = centers[0], b = centers[1];
  ctx.beginPath();
  ctx.moveTo(a.x + lensW * 0.95 * a.sx, hg.eyeY - lensH * 0.3);
  ctx.quadraticCurveTo((a.x + b.x) / 2, hg.eyeY - lensH * 0.7, b.x - lensW * 0.95 * b.sx, hg.eyeY - lensH * 0.3);
  ctx.stroke();
  // haste para a orelha próxima
  ctx.beginPath();
  ctx.moveTo(a.x - lensW * a.sx, hg.eyeY - lensH * 0.5);
  ctx.lineTo(-hg.cheekW + turn * hg.W * 0.18, hg.eyeY + 2);
  ctx.stroke();
  ctx.restore();
}

export { capsule };
