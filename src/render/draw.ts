import { Pt } from '../character/rig';

export type Ctx = CanvasRenderingContext2D;

/** Adiciona uma cápsula afunilada (dois círculos + tangentes externas) ao path. */
export function capsule(p: Path2D, x1: number, y1: number, r1: number, x2: number, y2: number, r2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r2) + 0.01) {
    const r = Math.max(r1, r2);
    const cx = r1 > r2 ? x1 : x2, cy = r1 > r2 ? y1 : y2;
    p.moveTo(cx + r, cy);
    p.arc(cx, cy, r, 0, Math.PI * 2);
    return;
  }
  const th = Math.atan2(dy, dx);
  const ph = Math.acos((r1 - r2) / d);
  p.moveTo(x1 + r1 * Math.cos(th + ph), y1 + r1 * Math.sin(th + ph));
  p.arc(x1, y1, r1, th + ph, th - ph + Math.PI * 2);
  p.arc(x2, y2, r2, th - ph, th + ph);
  p.closePath();
}

export function circle(p: Path2D, x: number, y: number, r: number) {
  p.moveTo(x + r, y);
  p.arc(x, y, r, 0, Math.PI * 2);
}

export function ellipse(p: Path2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  p.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** Spline Catmull-Rom fechada convertida em béziers (formas orgânicas suaves). */
export function splineClosed(p: Path2D, pts: Pt[], tension = 1) {
  const n = pts.length;
  if (n < 3) return;
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t = tension / 6;
    p.bezierCurveTo(p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t, p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t, p2.x, p2.y);
  }
  p.closePath();
}

/** Spline aberta (continua path existente se `move` = false). */
export function splineOpen(p: Path2D | Ctx, pts: Pt[], tension = 1, move = true) {
  const n = pts.length;
  if (n < 2) return;
  if (move) p.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const t = tension / 6;
    p.bezierCurveTo(p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t, p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t, p2.x, p2.y);
  }
}

/** Amostra uma spline fechada em pontos (usado para barba e contornos derivados). */
export function sampleClosed(pts: Pt[], per = 6): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

export function roundRect(p: Path2D | Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

export interface Shading {
  x: number; // deslocamento da forma iluminada (aponta para a luz)
  y: number;
}

/**
 * Parte com contorno + sombreamento cel:
 * 1) traço largo (contorno externo) 2) preenche sombra 3) preenche base deslocada rumo à luz, recortada.
 */
export function part(ctx: Ctx, path: Path2D, base: string | CanvasGradient | CanvasPattern, shadow: string | null, line: string | null, lw: number, sh: Shading | null) {
  if (line && lw > 0) {
    ctx.lineWidth = lw * 2;
    ctx.strokeStyle = line;
    ctx.stroke(path);
  }
  if (shadow && sh) {
    ctx.fillStyle = shadow;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    ctx.translate(sh.x, sh.y);
    ctx.fillStyle = base;
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.fillStyle = base;
    ctx.fill(path);
  }
}

export function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
export function lgrad(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
export function rgrad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][], x1 = x, y1 = y) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function heartPath(p: Path2D | Ctx, x: number, y: number, s: number) {
  p.moveTo(x, y + s * 0.35);
  p.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.1, x, y - s * 0.45);
  p.bezierCurveTo(x + s * 0.45, y - s * 1.1, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  p.closePath();
}

export function starPath(p: Path2D | Ctx, x: number, y: number, r1: number, r2: number, n = 5, rot = -Math.PI / 2) {
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    if (i === 0) p.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else p.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  p.closePath();
}

/** Desenha texto com contorno (títulos em canvas). */
export function outlinedText(ctx: Ctx, text: string, x: number, y: number, fill: string, stroke: string, lw: number) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
