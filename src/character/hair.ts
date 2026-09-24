import { RC } from './rc';
import { HeadGeom } from './head';
import { Pt } from './rig';
import { part, splineOpen, splineClosed, capsule, circle, ellipse } from '../render/draw';
import { rgba, shade } from '../core/color';
import { RNG } from '../core/rng';
import { lerp } from '../core/math';

interface HG {
  W: number;
  H: number;
  v: number; // volume
  turn: number;
  sway: number;
  t: number;
  /** 0 em ¾ → 1 em perfil (ver perfilDe em head.ts) */
  pf: number;
}

function hairFill(rc: RC, H: number) {
  const g = rc.ctx.createLinearGradient(0, -H * 0.62, 0, H * 1.3);
  g.addColorStop(0, rc.pal.hairHi);
  g.addColorStop(0.22, rc.pal.hair);
  g.addColorStop(1, rc.pal.hairSh);
  return g;
}

function paint(rc: RC, p: Path2D, H: number, lwMul = 1) {
  part(rc.ctx, p, hairFill(rc, H), rc.pal.hairSh, rc.pal.hairLine, rc.lw * lwMul, { x: rc.sh.x, y: rc.sh.y * 1.2 });
}

function strands(rc: RC, clip: Path2D, lines: Pt[][], alpha = 0.55, w = 1.3) {
  const { ctx } = rc;
  ctx.save();
  ctx.clip(clip);
  ctx.strokeStyle = rgba(rc.pal.hairSh, alpha);
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const l of lines) splineOpen(ctx, l, 1, true);
  ctx.stroke();
  ctx.restore();
}

function shine(rc: RC, clip: Path2D, cx: number, cy: number, rx: number, ry: number, a0 = 3.6, a1 = 5.9) {
  const { ctx } = rc;
  ctx.save();
  ctx.clip(clip);
  ctx.lineCap = 'round';
  // faixa de brilho em segmentos afunilados (estilo “anel de luz”)
  const segs = [[0.02, 0.3, 0.55], [0.36, 0.62, 0.8], [0.68, 0.82, 0.45]];
  const base = Math.max(2.5, ry * 0.2);
  for (const [s0, s1, k] of segs) {
    const g0 = a0 + (a1 - a0) * s0, g1 = a0 + (a1 - a0) * s1;
    ctx.strokeStyle = rgba(rc.pal.hairHi, 0.35 + k * 0.35);
    ctx.lineWidth = base * (0.6 + k * 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, g0, g1);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba('#ffffff', 0.28);
  ctx.lineWidth = base * 0.35;
  ctx.beginPath();
  ctx.ellipse(cx, cy - base * 0.2, rx * 0.97, ry * 0.95, 0, a0 + (a1 - a0) * 0.4, a0 + (a1 - a0) * 0.58);
  ctx.stroke();
  if (rc.ap.hairHighlight) {
    ctx.strokeStyle = rgba(rc.pal.hairStreak, 0.75);
    ctx.lineWidth = Math.max(3, rx * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.3, cy - ry * 1.4);
    ctx.quadraticCurveTo(cx + rx * 0.55, cy, cx + rx * 0.45, cy + ry * 1.6);
    ctx.moveTo(cx - rx * 0.4, cy - ry * 1.3);
    ctx.quadraticCurveTo(cx - rx * 0.6, cy, cx - rx * 0.7, cy + ry * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** Contorno externo padrão da “calota” de cabelo (da esquerda para a direita). */
function capOuter(g: HG, sideY: number, wMul = 1, extra = 0): Pt[] {
  const { W, H, v } = g;
  const back = -g.turn * W * 0.05;
  return [
    { x: -W * 0.53 * wMul + back, y: sideY },
    { x: -W * 0.57 * wMul - v * 0.35 + back, y: -H * 0.2 },
    { x: -W * 0.42 * wMul - v * 0.3 + back, y: -H * 0.43 - v * 0.6 - extra * 0.5 },
    { x: back * 0.5, y: -H * 0.54 - v - extra },
    { x: W * 0.42 * wMul + v * 0.3, y: -H * 0.43 - v * 0.6 - extra * 0.5 },
    { x: W * 0.56 * wMul + v * 0.35, y: -H * 0.2 },
    { x: W * 0.52 * wMul, y: sideY },
  ];
}

function capPath(g: HG, outer: Pt[], fringe: Pt[]): Path2D {
  const p = new Path2D();
  splineOpen(p, outer, 1, true);
  const f = fringe.map((q) => ({ x: q.x + g.turn * g.W * 0.07 * (1 - Math.abs(q.x) / g.W), y: q.y }));
  splineOpen(p, [outer[outer.length - 1], ...f, outer[0]], 1, false);
  p.closePath();
  return p;
}

// ------------------------------------------------ franjas (direita → esquerda)
const F = {
  crop: (W: number, H: number): Pt[] => [
    { x: W * 0.47, y: -H * 0.1 }, { x: W * 0.42, y: -H * 0.27 }, { x: W * 0.2, y: -H * 0.3 }, { x: 0, y: -H * 0.28 }, { x: -W * 0.22, y: -H * 0.31 }, { x: -W * 0.42, y: -H * 0.27 }, { x: -W * 0.47, y: -H * 0.1 },
  ],
  side: (W: number, H: number): Pt[] => [
    { x: W * 0.47, y: -H * 0.08 }, { x: W * 0.42, y: -H * 0.3 }, { x: W * 0.24, y: -H * 0.36 }, { x: W * 0.02, y: -H * 0.3 }, { x: -W * 0.22, y: -H * 0.23 }, { x: -W * 0.4, y: -H * 0.14 }, { x: -W * 0.48, y: -H * 0.02 },
  ],
  center: (W: number, H: number): Pt[] => [
    { x: W * 0.5, y: H * 0.02 }, { x: W * 0.4, y: -H * 0.2 }, { x: W * 0.16, y: -H * 0.33 }, { x: 0, y: -H * 0.37 }, { x: -W * 0.16, y: -H * 0.33 }, { x: -W * 0.4, y: -H * 0.2 }, { x: -W * 0.5, y: H * 0.02 },
  ],
  bangs: (W: number, H: number): Pt[] => [
    { x: W * 0.5, y: -H * 0.02 }, { x: W * 0.42, y: -H * 0.1 }, { x: W * 0.2, y: -H * 0.11 }, { x: 0, y: -H * 0.12 }, { x: -W * 0.2, y: -H * 0.11 }, { x: -W * 0.42, y: -H * 0.1 }, { x: -W * 0.5, y: -H * 0.02 },
  ],
  high: (W: number, H: number): Pt[] => [
    { x: W * 0.48, y: -H * 0.1 }, { x: W * 0.38, y: -H * 0.32 }, { x: 0, y: -H * 0.38 }, { x: -W * 0.38, y: -H * 0.32 }, { x: -W * 0.48, y: -H * 0.1 },
  ],
  swoop: (W: number, H: number): Pt[] => [
    { x: W * 0.47, y: -H * 0.06 }, { x: W * 0.38, y: -H * 0.18 }, { x: W * 0.12, y: -H * 0.16 }, { x: -W * 0.12, y: -H * 0.2 }, { x: -W * 0.34, y: -H * 0.26 }, { x: -W * 0.47, y: -H * 0.1 },
  ],
  jagged: (W: number, H: number): Pt[] => [
    { x: W * 0.48, y: -H * 0.08 }, { x: W * 0.4, y: -H * 0.2 }, { x: W * 0.3, y: -H * 0.13 }, { x: W * 0.18, y: -H * 0.27 }, { x: W * 0.05, y: -H * 0.15 }, { x: -W * 0.08, y: -H * 0.28 }, { x: -W * 0.22, y: -H * 0.16 }, { x: -W * 0.34, y: -H * 0.27 }, { x: -W * 0.46, y: -H * 0.1 },
  ],
};

// ------------------------------------------------ peças traseiras
function longBack(rc: RC, g: HG, len: number, wavy: boolean, widthMul = 1) {
  const { W, H, v } = g;
  const sw = g.sway;
  const bw = W * 0.62 * widthMul + v * 0.4;
  const y1 = H * len;
  const p = new Path2D();
  const pts: Pt[] = [];
  const n = 6;
  const back = -g.turn * W * 0.08;
  pts.push({ x: -W * 0.55 - v * 0.3 + back, y: -H * 0.25 });
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const wave = wavy ? Math.sin(t * 9 + g.t * 1.5) * W * 0.04 : 0;
    pts.push({ x: -W * 0.55 - (bw - W * 0.55) * t - v * 0.3 + back + wave + sw * H * t * t, y: -H * 0.25 + (y1 + H * 0.25) * t });
  }
  const bottom: Pt[] = [];
  const nb = wavy ? 7 : 5;
  for (let i = 1; i < nb; i++) {
    const t = i / nb;
    bottom.push({ x: -bw + back + 2 * bw * t + sw * H, y: y1 + (i % 2 ? H * 0.05 : -H * 0.01) + (wavy ? H * 0.02 : 0) });
  }
  const right: Pt[] = [];
  for (let i = n; i >= 1; i--) {
    const t = i / n;
    const wave = wavy ? Math.sin(t * 9 + g.t * 1.5 + 2) * W * 0.04 : 0;
    right.push({ x: W * 0.55 + (bw - W * 0.55) * t + v * 0.3 + back * 0.3 + wave + sw * H * t * t, y: -H * 0.25 + (y1 + H * 0.25) * t });
  }
  right.push({ x: W * 0.55 + v * 0.3, y: -H * 0.25 });
  const all = [...pts, ...bottom, ...right, { x: 0, y: -H * 0.55 - v }];
  splineClosed(p, all, 1);
  paint(rc, p, H);
  const lines: Pt[][] = [];
  for (let i = -2; i <= 2; i++) lines.push([{ x: i * W * 0.15, y: H * 0.1 }, { x: i * W * 0.2 + sw * H * 0.5, y: H * 0.6 }, { x: i * W * 0.22 + sw * H, y: y1 }]);
  strands(rc, p, lines, 0.45);
}

function tail(rc: RC, ax: number, ay: number, len: number, w: number, ang: number, ties = true, braided = false) {
  const { ctx } = rc;
  const H = rc.d.headH;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  const p = new Path2D();
  if (braided) {
    const seg = 6;
    for (let i = 0; i < seg; i++) {
      const y = (len / seg) * (i + 0.5);
      const ww = w * (1 - i * 0.07);
      ellipse(p, (i % 2 ? 1 : -1) * ww * 0.15, y, ww * 0.62, (len / seg) * 0.72, (i % 2 ? 0.35 : -0.35));
    }
  } else {
    p.moveTo(-w * 0.5, 0);
    p.bezierCurveTo(-w * 0.9, len * 0.3, -w * 0.6, len * 0.75, -w * 0.05, len);
    p.quadraticCurveTo(w * 0.15, len * 0.9, w * 0.25, len * 1.02);
    p.bezierCurveTo(w * 0.7, len * 0.7, w * 0.9, len * 0.3, w * 0.5, 0);
    p.closePath();
  }
  paint(rc, p, H * 0.6);
  if (!braided) strands(rc, p, [[{ x: -w * 0.15, y: len * 0.1 }, { x: -w * 0.2, y: len * 0.5 }, { x: 0, y: len * 0.9 }], [{ x: w * 0.15, y: len * 0.1 }, { x: w * 0.25, y: len * 0.5 }, { x: w * 0.1, y: len * 0.85 }]], 0.5);
  if (ties) {
    const tp = new Path2D();
    capsule(tp, -w * 0.45, 2, 3.2, w * 0.45, 2, 3.2);
    part(ctx, tp, rc.pal.acc, null, rc.pal.accLine, 0.9, null);
  }
  ctx.restore();
}

// ------------------------------------------------ estilos
type StyleFn = (rc: RC, g: HG) => void;
interface Style { back?: StyleFn; front?: StyleFn }

function frontCap(rc: RC, g: HG, fringe: Pt[], sideY: number, extra = 0, wMul = 1, strandsOn = true) {
  const outer = capOuter(g, sideY, wMul, extra);
  const p = capPath(g, outer, fringe);
  paint(rc, p, g.H);
  if (strandsOn) {
    const { W, H } = g;
    strands(rc, p, [
      [{ x: -W * 0.05, y: -H * 0.5 - g.v }, { x: -W * 0.2, y: -H * 0.38 }, { x: -W * 0.32, y: -H * 0.25 }],
      [{ x: W * 0.1, y: -H * 0.5 - g.v }, { x: W * 0.22, y: -H * 0.38 }, { x: W * 0.32, y: -H * 0.22 }],
      [{ x: -W * 0.3, y: -H * 0.45 }, { x: -W * 0.44, y: -H * 0.3 }, { x: -W * 0.48, y: -H * 0.12 }],
    ]);
  }
  shine(rc, p, -g.W * 0.05 - g.turn * g.W * 0.05, -g.H * 0.3 - g.v * 0.4, g.W * 0.36, g.H * 0.16);
  return p;
}

function sidesLocks(rc: RC, g: HG, len: number, wavy = false) {
  // mechas que emolduram o rosto (na frente dos ombros)
  const { W, H } = g;
  for (const s of [-1, 1]) {
    if (s > 0 && g.turn > 0.75) continue;
    const x0 = s * W * 0.5 - (s < 0 ? g.turn * W * 0.02 : g.turn * W * 0.12);
    const p = new Path2D();
    const sw = g.sway * H * 0.6;
    const wv = (k: number) => (wavy ? Math.sin(k * 7 + g.t * 1.6 + s) * W * 0.03 : 0);
    p.moveTo(x0 - s * W * 0.02, -H * 0.3);
    p.bezierCurveTo(x0 + s * W * 0.14, -H * 0.05, x0 + s * W * 0.14 + wv(0.5) + sw * 0.5, H * len * 0.5, x0 + s * W * 0.07 + wv(1) + sw, H * len);
    p.quadraticCurveTo(x0 - s * W * 0.02 + sw, H * len * 0.9, x0 - s * W * 0.07 + wv(0.9) + sw * 0.9, H * len * 0.8);
    p.bezierCurveTo(x0 - s * W * 0.05 + wv(0.6), H * len * 0.4, x0 - s * W * 0.07, H * 0.0, x0 - s * W * 0.1, -H * 0.2);
    p.closePath();
    paint(rc, p, H);
    strands(rc, p, [[{ x: x0, y: -H * 0.1 }, { x: x0 + s * W * 0.05 + sw * 0.4, y: H * len * 0.5 }, { x: x0 + s * W * 0.02 + sw, y: H * len * 0.95 }]], 0.5);
  }
}

const STYLES: Record<string, Style> = {
  careca: {
    front: (rc, g) => {
      const { ctx } = rc;
      ctx.fillStyle = rgba('#ffffff', 0.22);
      ctx.beginPath();
      ctx.ellipse(-g.W * 0.12, -g.H * 0.36, g.W * 0.16, g.H * 0.07, -0.3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  raspado: {
    front: (rc, g) => {
      const { W, H } = g;
      const outer = capOuter({ ...g, v: 1 }, -H * 0.06, 0.98);
      const p = capPath(g, outer, F.crop(W, H).map((q) => ({ x: q.x * 0.98, y: q.y - H * 0.02 })));
      rc.ctx.fillStyle = rgba(rc.pal.hair, 0.72);
      rc.ctx.fill(p);
      rc.ctx.save();
      rc.ctx.clip(p);
      const r = new RNG(rc.seed + 11);
      rc.ctx.fillStyle = rgba(rc.pal.hairSh, 0.6);
      for (let i = 0; i < 160; i++) rc.ctx.fillRect(r.range(-W * 0.6, W * 0.6), r.range(-H * 0.6, 0), 1.2, 1.2);
      rc.ctx.restore();
    },
  },
  curto: { front: (rc, g) => frontCap(rc, g, F.crop(g.W, g.H), -g.H * 0.06) },
  lateral: {
    front: (rc, g) => {
      const p = frontCap(rc, g, F.side(g.W, g.H), -g.H * 0.04, g.H * 0.03);
      rc.ctx.save();
      rc.ctx.clip(p);
      rc.ctx.strokeStyle = rgba(rc.pal.hairSh, 0.9);
      rc.ctx.lineWidth = 1.6;
      rc.ctx.beginPath();
      rc.ctx.moveTo(g.W * 0.26 + g.turn * 5, -g.H * 0.36);
      rc.ctx.quadraticCurveTo(g.W * 0.24, -g.H * 0.5, g.W * 0.12, -g.H * 0.6);
      rc.ctx.stroke();
      rc.ctx.restore();
    },
  },
  topete: {
    front: (rc, g) => {
      const { W, H } = g;
      const outer = capOuter(g, -H * 0.1, 0.98, H * 0.02);
      outer[3] = { x: W * 0.08, y: -H * 0.54 - g.v * 2.6 };
      outer[4] = { x: W * 0.46, y: -H * 0.5 - g.v * 1.6 };
      outer.splice(5, 0, { x: W * 0.5, y: -H * 0.36 - g.v * 0.4 });
      const p = capPath(g, outer, F.high(W, H));
      paint(rc, p, H);
      strands(rc, p, [
        [{ x: -W * 0.3, y: -H * 0.3 }, { x: -W * 0.05, y: -H * 0.55 - g.v * 2 }, { x: W * 0.35, y: -H * 0.55 - g.v * 1.5 }],
        [{ x: -W * 0.1, y: -H * 0.32 }, { x: W * 0.1, y: -H * 0.5 - g.v * 1.8 }, { x: W * 0.42, y: -H * 0.45 - g.v }],
      ]);
      shine(rc, p, W * 0.05, -H * 0.42 - g.v * 1.4, W * 0.3, H * 0.12);
    },
  },
  bagunçado: {
    front: (rc, g) => {
      const { W, H, v } = g;
      const outer: Pt[] = [];
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (i / n) * Math.PI;
        const r = i % 2 ? 1.12 + v / W : 0.98;
        outer.push({ x: Math.cos(a) * W * 0.55 * r - g.turn * W * 0.05, y: -H * 0.12 + Math.sin(a) * H * 0.44 * r - (i % 2 ? v * 0.8 : 0) });
      }
      outer[0].y = -H * 0.02;
      outer[n].y = -H * 0.02;
      const p = capPath(g, outer, F.jagged(W, H));
      paint(rc, p, H);
      shine(rc, p, -W * 0.05, -H * 0.3, W * 0.34, H * 0.15);
    },
  },
  cacheadoCurto: {
    front: (rc, g) => {
      const { W, H, v } = g;
      const p = new Path2D();
      const base = capPath(g, capOuter(g, -H * 0.05, 1.02), F.crop(W, H).map((q) => ({ x: q.x, y: q.y + H * 0.02 })));
      p.addPath(base);
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 1.02 + (i / n) * Math.PI * 0.96;
        circle(p, Math.cos(a) * (W * 0.52 + v * 0.3) - g.turn * W * 0.04, -H * 0.1 + Math.sin(a) * (H * 0.44 + v), W * 0.1 + v * 0.1);
      }
      for (let i = 0; i < 6; i++) circle(p, -W * 0.36 + i * W * 0.15 + g.turn * W * 0.05, -H * 0.28 + (i % 2) * 3, W * 0.075);
      paint(rc, p, H);
      rc.ctx.save();
      rc.ctx.clip(p);
      rc.ctx.strokeStyle = rgba(rc.pal.hairSh, 0.6);
      rc.ctx.lineWidth = 1.2;
      const r = new RNG(rc.seed + 2);
      for (let i = 0; i < 22; i++) {
        rc.ctx.beginPath();
        rc.ctx.arc(r.range(-W * 0.5, W * 0.5), r.range(-H * 0.6, -H * 0.2), r.range(2, 4), 0.5, 4);
        rc.ctx.stroke();
      }
      rc.ctx.restore();
      shine(rc, p, -W * 0.05, -H * 0.35, W * 0.3, H * 0.14);
    },
  },
  moicano: {
    front: (rc, g) => {
      STYLES.raspado.front!(rc, g);
      const { W, H, v } = g;
      const p = new Path2D();
      const n = 6;
      const cx = g.turn * W * 0.05;
      p.moveTo(cx - W * 0.1, -H * 0.3);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const a = Math.PI * 1.15 + t * Math.PI * 0.7;
        const r = H * 0.5 + v * 2 + H * 0.12;
        p.lineTo(cx + Math.cos(a) * r * 0.75, -H * 0.05 + Math.sin(a) * r);
        const a2 = Math.PI * 1.15 + ((i + 1) / n) * Math.PI * 0.7;
        p.lineTo(cx + Math.cos(a2) * H * 0.42, -H * 0.05 + Math.sin(a2) * H * 0.5);
      }
      p.lineTo(cx + W * 0.1, -H * 0.3);
      p.closePath();
      paint(rc, p, H);
    },
  },
  blackPower: {
    back: (rc, g) => {
      const { W, H, v } = g;
      const R = W * (0.68 + v / W * 1.4);
      const cx = -g.turn * W * 0.08, cy = -H * 0.2;
      const p = new Path2D();
      const n = 22;
      const pts: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = R * (i % 2 ? 1.03 : 0.97) * (a > 0.3 && a < Math.PI - 0.3 ? 0.9 : 1);
        pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.92 });
      }
      splineClosed(p, pts, 1);
      paint(rc, p, H);
      rc.ctx.save();
      rc.ctx.clip(p);
      const r = new RNG(rc.seed + 4);
      rc.ctx.strokeStyle = rgba(rc.pal.hairSh, 0.55);
      rc.ctx.lineWidth = 1.2;
      for (let i = 0; i < 50; i++) {
        rc.ctx.beginPath();
        rc.ctx.arc(cx + r.range(-R, R), cy + r.range(-R, R), r.range(2, 5), 0, 3.5);
        rc.ctx.stroke();
      }
      rc.ctx.restore();
      shine(rc, p, cx - R * 0.1, cy - R * 0.35, R * 0.6, R * 0.3);
    },
    front: (rc, g) => {
      const { W, H } = g;
      const p = capPath(g, capOuter({ ...g, v: g.v * 0.5 }, -H * 0.04, 1.02), F.crop(W, H).map((q) => ({ x: q.x, y: q.y + 3 })));
      paint(rc, p, H, 0.6);
    },
  },
  coque: {
    back: (rc, g) => {
      const { W, H, v } = g;
      const p = new Path2D();
      circle(p, -g.turn * W * 0.18, -H * 0.6 - v * 0.6, W * 0.22 + v * 0.15);
      paint(rc, p, H);
      strands(rc, p, [[{ x: -W * 0.2 - g.turn * W * 0.18, y: -H * 0.62 }, { x: -g.turn * W * 0.18, y: -H * 0.72 - v }, { x: W * 0.18 - g.turn * W * 0.18, y: -H * 0.6 }]]);
    },
    front: (rc, g) => {
      frontCap(rc, g, F.center(g.W, g.H).map((q) => ({ x: q.x * 0.98, y: q.y - g.H * 0.02 })), -g.H * 0.02, -g.v * 0.4);
    },
  },
  samurai: {
    back: (rc, g) => {
      const { W, H } = g;
      const p = new Path2D();
      ellipse(p, -g.turn * W * 0.25, -H * 0.6, W * 0.13, W * 0.1);
      paint(rc, p, H);
    },
    front: (rc, g) => {
      STYLES.raspado.front!(rc, g);
      const { W, H } = g;
      const outer = capOuter({ ...g, v: g.v * 0.6 }, -H * 0.3, 0.9);
      const p = capPath(g, outer, F.high(W, H).map((q) => ({ x: q.x * 0.9, y: q.y - H * 0.02 })));
      paint(rc, p, H);
      strands(rc, p, [[{ x: 0, y: -H * 0.38 }, { x: -W * 0.1, y: -H * 0.5 }, { x: -W * 0.25, y: -H * 0.55 }], [{ x: W * 0.2, y: -H * 0.35 }, { x: W * 0.05, y: -H * 0.5 }, { x: -W * 0.15, y: -H * 0.58 }]]);
    },
  },
  rabo: {
    back: (rc, g) => {
      const { W, H } = g;
      const ax = -W * 0.2 - g.turn * W * 0.3, ay = -H * 0.36;
      tail(rc, ax, ay, H * 1.05, W * 0.3, 0.25 + g.turn * 0.35 + g.sway * 1.4 + Math.sin(g.t * 2) * 0.03);
    },
    front: (rc, g) => { frontCap(rc, g, F.side(g.W, g.H).map((q) => ({ x: q.x, y: q.y - g.H * 0.02 })), -g.H * 0.02, -g.v * 0.3); },
  },
  mariaChiquinha: {
    back: (rc, g) => {
      const { W, H } = g;
      for (const s of [-1, 1]) {
        if (s > 0 && g.turn > 0.8) continue;
        const ax = s * W * 0.46 - g.turn * W * 0.12, ay = -H * 0.18;
        tail(rc, ax, ay, H * 0.7, W * 0.22, -s * 0.5 + g.sway * 1.6 + Math.sin(g.t * 2.2 + s) * 0.05);
      }
    },
    front: (rc, g) => { frontCap(rc, g, F.center(g.W, g.H), -g.H * 0.02, -g.v * 0.2); },
  },
  trancas: {
    // trança do lado de lá: na camada de TRÁS, nascendo na silhueta do rosto (em ¾ o rosto a cobre em parte, como no real)
    back: (rc, g) => {
      const { W, H } = g;
      if (g.turn > 1.3) return;
      const ax = W * 0.44 * (1 - 0.15 * g.turn) + g.turn * W * 0.04, ay = H * 0.05;
      tail(rc, ax, ay, H * 1.0, W * 0.2, -0.12 - g.turn * 0.08 + g.sway * 1.2, true, true);
    },
    // trança do lado de cá: na frente, sobre a orelha/ombro próximo
    front: (rc, g) => {
      frontCap(rc, g, F.center(g.W, g.H), 0);
      const { W, H } = g;
      // em perfil a trança próxima nasce logo atrás da orelha (que foi para o meio da cabeça)
      const ax = lerp(-W * 0.44 - g.turn * W * 0.1, -W * 0.28, g.pf), ay = H * 0.05;
      tail(rc, ax, ay, H * 1.0, W * 0.2, 0.12 + g.sway * 1.2, true, true);
    },
  },
  dreads: {
    back: (rc, g) => {
      const { W, H } = g;
      const r = new RNG(rc.seed + 9);
      for (let i = 0; i < 9; i++) {
        const x = -W * 0.55 + (i / 8) * W * 1.1 - g.turn * W * 0.1;
        const p = new Path2D();
        const len = H * r.range(0.85, 1.1);
        capsule(p, x, -H * 0.2, W * 0.07, x * 1.05 + g.sway * H * 0.8, len, W * 0.055);
        paint(rc, p, H);
      }
    },
    front: (rc, g) => {
      const { W, H } = g;
      const p = frontCap(rc, g, F.crop(W, H), -H * 0.04, 0, 1, false);
      rc.ctx.save();
      rc.ctx.clip(p);
      rc.ctx.strokeStyle = rgba(rc.pal.hairSh, 0.6);
      rc.ctx.lineWidth = 2;
      for (let i = -3; i <= 3; i++) {
        rc.ctx.beginPath();
        rc.ctx.moveTo(i * W * 0.1, -H * 0.6);
        rc.ctx.lineTo(i * W * 0.14, -H * 0.25);
        rc.ctx.stroke();
      }
      rc.ctx.restore();
      for (const s of [-1, 1]) {
        if (s > 0 && g.turn > 0.7) continue;
        for (let k = 0; k < 2; k++) {
          const x = s * (W * 0.46 + k * W * 0.08) - g.turn * W * 0.08;
          const pp = new Path2D();
          capsule(pp, x, -H * 0.15, W * 0.065, x + s * 3 + g.sway * H * 0.6, H * (0.75 + k * 0.1), W * 0.05);
          paint(rc, pp, H);
        }
      }
    },
  },
  chanel: {
    back: (rc, g) => {
      const { W, H, v } = g;
      const p = new Path2D();
      const back = -g.turn * W * 0.08;
      splineClosed(p, [
        { x: back, y: -H * 0.56 - v }, { x: W * 0.6 + v * 0.4, y: -H * 0.2 }, { x: W * 0.62 + v * 0.4 + g.sway * H * 0.3, y: H * 0.34 }, { x: W * 0.3, y: H * 0.42 },
        { x: -W * 0.3 + back, y: H * 0.42 }, { x: -W * 0.64 - v * 0.4 + back + g.sway * H * 0.3, y: H * 0.34 }, { x: -W * 0.62 - v * 0.4 + back, y: -H * 0.2 },
      ], 1);
      paint(rc, p, H);
    },
    front: (rc, g) => {
      const { W, H } = g;
      frontCap(rc, g, F.side(W, H).map((q, i) => (i === 0 ? { x: q.x + W * 0.1, y: H * 0.36 } : q)).concat([{ x: -W * 0.6, y: H * 0.36 }]), H * 0.36, 0, 1.08);
    },
  },
  pixie: {
    front: (rc, g) => {
      const { W, H } = g;
      const fringe = [{ x: W * 0.47, y: -H * 0.05 }, { x: W * 0.38, y: -H * 0.25 }, { x: W * 0.15, y: -H * 0.26 }, { x: -W * 0.1, y: -H * 0.18 }, { x: -W * 0.28, y: -H * 0.08 }, { x: -W * 0.4, y: -H * 0.12 }, { x: -W * 0.5, y: H * 0.05 }];
      frontCap(rc, g, fringe, H * 0.05, g.H * 0.02, 1.02);
    },
  },
  medio: {
    back: (rc, g) => longBack(rc, g, 0.62, false, 0.95),
    front: (rc, g) => {
      const { W, H } = g;
      frontCap(rc, g, F.jagged(W, H).map((q) => ({ x: q.x, y: q.y + H * 0.02 })), H * 0.1, g.H * 0.02, 1.05);
    },
  },
  longo: {
    back: (rc, g) => longBack(rc, g, 1.45, false),
    front: (rc, g) => {
      frontCap(rc, g, F.center(g.W, g.H), H0(g), 0, 1.02);
      sidesLocks(rc, g, 1.25);
    },
  },
  ondulado: {
    back: (rc, g) => longBack(rc, g, 1.35, true, 1.1),
    front: (rc, g) => {
      frontCap(rc, g, F.side(g.W, g.H), H0(g), g.H * 0.02, 1.05);
      sidesLocks(rc, g, 1.15, true);
    },
  },
  franja: {
    back: (rc, g) => longBack(rc, g, 1.4, false),
    front: (rc, g) => {
      const p = frontCap(rc, g, F.bangs(g.W, g.H), H0(g), 0, 1.02, false);
      strands(rc, p, [-0.3, -0.15, 0, 0.15, 0.3].map((k) => [{ x: k * g.W, y: -g.H * 0.4 }, { x: k * g.W * 1.1, y: -g.H * 0.13 }]), 0.45);
      sidesLocks(rc, g, 1.2);
    },
  },
};

function H0(g: HG) {
  return g.H * 0.02;
}

/** Camada traseira (antes do corpo). Chamado no quadro da cabeça. */
export function drawHairBack(rc: RC, hg: HeadGeom) {
  const st = STYLES[rc.ap.hairStyle];
  if (!st?.back) return;
  // em perfil o cabelo de trás cai pelas COSTAS (atrás da nuca), não atrás do tronco — recua bem mais que a frente
  emPerfil(rc, hg, () => st.back!(rc, hgOf(rc, hg)), 0.3);
}

/** Camada frontal (sobre o rosto). */
export function drawHairFront(rc: RC, hg: HeadGeom) {
  const st = STYLES[rc.ap.hairStyle];
  if (!st?.front) return;
  emPerfil(rc, hg, () => st.front!(rc, hgOf(rc, hg)), 0.06);
}

/**
 * Perfil: os penteados foram desenhados para ¾ e cairiam sobre o nariz/boca. Recua o cabelo para o crânio e recorta
 * pela linha do cabelo (testa → têmpora → costeleta), deixando a silhueta do rosto livre. Em ¾ (pf = 0) não faz nada.
 */
function emPerfil(rc: RC, hg: HeadGeom, desenha: () => void, recuo: number) {
  if (hg.pf < 0.02) return desenha();
  const { ctx } = rc;
  const { W, H, pf } = hg;
  const lim = (x: number) => lerp(W * 1.2, x, pf);
  const corte = new Path2D();
  corte.moveTo(-W * 3, -H * 3);
  corte.lineTo(W * 3, -H * 3);
  corte.lineTo(W * 3, -H * 0.44);
  corte.lineTo(lim(hg.plano - W * 0.02), -H * 0.4);
  corte.lineTo(lim(hg.plano - W * 0.12), -H * 0.3);
  corte.lineTo(lim(W * 0.16), -H * 0.16);
  corte.lineTo(lim(W * 0.05), H * 0.06);
  corte.lineTo(lim(W * 0.02), H * 0.3);
  corte.lineTo(lim(W * 0.02), H * 0.62);
  corte.lineTo(lim(W * 0.2), H * 0.72);
  corte.lineTo(W * 3, H * 0.72);
  corte.lineTo(W * 3, H * 3);
  corte.lineTo(-W * 3, H * 3);
  corte.closePath();
  ctx.save();
  ctx.clip(corte);
  ctx.translate(-pf * W * recuo, 0);
  desenha();
  ctx.restore();
}

function hgOf(rc: RC, hg: HeadGeom): HG {
  let v = hg.H * (0.03 + rc.ap.hairVolume * 0.07);
  if (rc.ap.hat !== 'nenhum' && rc.ap.hat !== 'faixa') v *= 0.3;
  return { W: hg.W, H: hg.H, v, turn: rc.turn, sway: rc.sway, t: rc.t, pf: hg.pf };
}

// ------------------------------------------------ chapéus
export function drawHat(rc: RC, hg: HeadGeom) {
  const { ctx, ap, pal, turn } = rc;
  const hat = ap.hat;
  if (hat === 'nenhum') return;
  const { W, H } = hg;
  const col = pal.hat, sh = pal.hatSh, line = pal.hatLine;
  const back = -turn * W * 0.05;
  if (hat === 'bone') {
    const p = new Path2D();
    p.moveTo(-W * 0.56 + back, -H * 0.2);
    p.bezierCurveTo(-W * 0.58 + back, -H * 0.62, W * 0.55, -H * 0.66, W * 0.55, -H * 0.2);
    p.closePath();
    part(ctx, p, col, sh, line, rc.lw, rc.shS);
    const b = new Path2D();
    const dir = 0.2 + turn * 0.8;
    b.moveTo(-W * 0.3 + turn * W * 0.3, -H * 0.2);
    b.quadraticCurveTo(W * (0.3 + dir * 0.4), -H * 0.26, W * (0.2 + dir * 0.55), -H * 0.12);
    b.quadraticCurveTo(W * 0.3, -H * 0.1, -W * 0.3 + turn * W * 0.3, -H * 0.16);
    b.closePath();
    part(ctx, b, shade(col, -0.08), null, line, rc.lw, null);
    ctx.fillStyle = shade(col, 0.2);
    ctx.beginPath();
    ctx.arc(back * 0.5, -H * 0.58, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(line, 0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(back * 0.5, -H * 0.58);
    ctx.quadraticCurveTo(-W * 0.15, -H * 0.4, -W * 0.18, -H * 0.2);
    ctx.stroke();
  } else if (hat === 'gorro') {
    const p = new Path2D();
    p.moveTo(-W * 0.58 + back, -H * 0.12);
    p.bezierCurveTo(-W * 0.62 + back, -H * 0.8, W * 0.6, -H * 0.8, W * 0.57, -H * 0.12);
    p.closePath();
    part(ctx, p, col, sh, line, rc.lw, rc.shS);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = rgba(line, 0.25);
    ctx.lineWidth = 1.3;
    for (let x = -W * 0.6; x < W * 0.6; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, -H * 0.8);
      ctx.lineTo(x, -H * 0.1);
      ctx.stroke();
    }
    ctx.restore();
    const band = new Path2D();
    band.moveTo(-W * 0.6 + back, -H * 0.1);
    band.quadraticCurveTo(0, -H * 0.2, W * 0.59, -H * 0.1);
    band.lineTo(W * 0.58, -H * 0.24);
    band.quadraticCurveTo(0, -H * 0.34, -W * 0.59 + back, -H * 0.24);
    band.closePath();
    part(ctx, band, shade(col, -0.1), null, line, rc.lw, null);
    const pom = new Path2D();
    circle(pom, back, -H * 0.72, W * 0.12);
    part(ctx, pom, pal.top2 === col ? shade(col, 0.3) : '#f7f5f0', '#dcd8d0', '#8a8680', rc.lw, rc.shS);
  } else if (hat === 'chapeu') {
    const brim = new Path2D();
    ellipse(brim, back * 0.5, -H * 0.3, W * 0.85, H * 0.1);
    part(ctx, brim, shade(col, -0.05), sh, line, rc.lw, null);
    const crown = new Path2D();
    crown.moveTo(-W * 0.45 + back, -H * 0.3);
    crown.bezierCurveTo(-W * 0.5 + back, -H * 0.9, W * 0.5, -H * 0.9, W * 0.45, -H * 0.3);
    crown.quadraticCurveTo(0, -H * 0.22, -W * 0.45 + back, -H * 0.3);
    part(ctx, crown, col, sh, line, rc.lw, rc.shS);
    ctx.fillStyle = pal.top2;
    ctx.beginPath();
    ctx.moveTo(-W * 0.46 + back, -H * 0.36);
    ctx.quadraticCurveTo(0, -H * 0.28, W * 0.46, -H * 0.36);
    ctx.lineTo(W * 0.47, -H * 0.44);
    ctx.quadraticCurveTo(0, -H * 0.36, -W * 0.47 + back, -H * 0.44);
    ctx.fill();
  } else if (hat === 'boina') {
    const p = new Path2D();
    ellipse(p, W * 0.08, -H * 0.48, W * 0.6, H * 0.18, -0.12);
    part(ctx, p, col, sh, line, rc.lw, rc.shS);
    ctx.fillStyle = line;
    ctx.fillRect(W * 0.05, -H * 0.7, 3, 6);
  } else if (hat === 'faixa') {
    ctx.strokeStyle = col;
    ctx.lineWidth = H * 0.08;
    ctx.beginPath();
    ctx.moveTo(-W * 0.54 + back, -H * 0.2);
    ctx.quadraticCurveTo(0, -H * 0.42, W * 0.54, -H * 0.2);
    ctx.stroke();
  } else if (hat === 'capelo') {
    const p = new Path2D();
    p.moveTo(-W * 0.48, -H * 0.3);
    p.lineTo(W * 0.48, -H * 0.3);
    p.lineTo(W * 0.44, -H * 0.52);
    p.lineTo(-W * 0.44, -H * 0.52);
    p.closePath();
    part(ctx, p, '#1d1f2a', '#101118', '#05060a', rc.lw, null);
    const top = new Path2D();
    top.moveTo(0, -H * 0.68);
    top.lineTo(W * 0.72, -H * 0.56);
    top.lineTo(0, -H * 0.44);
    top.lineTo(-W * 0.72, -H * 0.56);
    top.closePath();
    part(ctx, top, '#262938', null, '#05060a', rc.lw, null);
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.56);
    ctx.quadraticCurveTo(W * 0.5, -H * 0.55, W * 0.55 + Math.sin(rc.t * 3) * 3, -H * 0.3);
    ctx.stroke();
  } else if (hat === 'veu') {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.strokeStyle = 'rgba(200,200,210,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-W * 0.3, -H * 0.5);
    ctx.quadraticCurveTo(-W * 0.9 + rc.sway * H, H * 0.4, -W * 0.7 + rc.sway * H * 1.4, H * 1.4);
    ctx.lineTo(W * 0.1 + rc.sway * H * 1.4, H * 1.3);
    ctx.quadraticCurveTo(W * 0.1, H * 0.2, W * 0.3, -H * 0.5);
    ctx.fill();
    ctx.stroke();
    const tiara = new Path2D();
    tiara.moveTo(-W * 0.35, -H * 0.46);
    tiara.quadraticCurveTo(0, -H * 0.62, W * 0.35, -H * 0.46);
    ctx.strokeStyle = '#e8d9a8';
    ctx.lineWidth = 3;
    ctx.stroke(tiara);
  } else if (hat === 'chefe') {
    const p = new Path2D();
    p.moveTo(-W * 0.45, -H * 0.3);
    p.lineTo(-W * 0.5, -H * 0.7);
    p.bezierCurveTo(-W * 0.8, -H * 1.1, -W * 0.1, -H * 1.3, 0, -H * 1.0);
    p.bezierCurveTo(W * 0.1, -H * 1.3, W * 0.8, -H * 1.1, W * 0.5, -H * 0.7);
    p.lineTo(W * 0.45, -H * 0.3);
    p.closePath();
    part(ctx, p, '#fbfaf6', '#dedbd2', '#8a8680', rc.lw, rc.shS);
  } else if (hat === 'quepe') {
    const p = new Path2D();
    p.moveTo(-W * 0.52, -H * 0.24);
    p.lineTo(-W * 0.56, -H * 0.55);
    p.quadraticCurveTo(0, -H * 0.72, W * 0.56, -H * 0.55);
    p.lineTo(W * 0.52, -H * 0.24);
    p.closePath();
    part(ctx, p, '#1d2a44', '#141d30', '#0a0f1a', rc.lw, rc.shS);
    const b = new Path2D();
    b.moveTo(-W * 0.1 + turn * W * 0.3, -H * 0.24);
    b.quadraticCurveTo(W * 0.5, -H * 0.22, W * 0.65, -H * 0.12);
    b.lineTo(-W * 0.1 + turn * W * 0.3, -H * 0.16);
    b.closePath();
    part(ctx, b, '#0e0f14', null, '#000', rc.lw, null);
    const s = new Path2D();
    circle(s, turn * W * 0.1, -H * 0.42, 5);
    part(ctx, s, '#f2c14e', null, '#8a6a1a', 1, null);
  } else if (hat === 'festa') {
    const p = new Path2D();
    p.moveTo(-W * 0.25, -H * 0.42);
    p.lineTo(W * 0.05, -H * 1.1);
    p.lineTo(W * 0.3, -H * 0.42);
    p.closePath();
    part(ctx, p, '#9b5de5', null, '#4a2a7a', rc.lw, null);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = '#f2c14e';
    for (let i = 0; i < 5; i++) ctx.fillRect(-W, -H * 0.5 - i * H * 0.14, W * 2, H * 0.04);
    ctx.restore();
    ctx.fillStyle = '#e86a92';
    ctx.beginPath();
    ctx.arc(W * 0.05, -H * 1.12, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === 'coroa') {
    const p = new Path2D();
    p.moveTo(-W * 0.4, -H * 0.38);
    p.lineTo(-W * 0.45, -H * 0.72);
    p.lineTo(-W * 0.2, -H * 0.55);
    p.lineTo(0, -H * 0.8);
    p.lineTo(W * 0.2, -H * 0.55);
    p.lineTo(W * 0.45, -H * 0.72);
    p.lineTo(W * 0.4, -H * 0.38);
    p.closePath();
    part(ctx, p, '#f2c14e', '#c99a2a', '#7a5a10', rc.lw, rc.shS);
    ctx.fillStyle = '#e4572e';
    ctx.beginPath();
    ctx.arc(0, -H * 0.5, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
