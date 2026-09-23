import { Appearance } from '../character/appearance';
import { computeDims, restPose, Pose } from '../character/rig';
import { EXPRESSIONS, ExprName } from '../character/expressions';
import { drawCharacter, headAnchor, legLength } from '../character/character';
import { rgba } from '../core/color';

export type View = 'head' | 'face' | 'body' | 'full' | 'legs' | 'feet' | 'eyes';

const cache = new Map<string, string>();

/**
 * Renderiza um retrato/miniatura do personagem num canvas.
 * `view` define o enquadramento.
 */
export function renderThumb(canvas: HTMLCanvasElement, ap: Appearance, age: number, view: View, size: number, o: { expr?: ExprName; bg?: string | null; turn?: number; pose?: Pose; outfit?: Partial<Appearance> } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (o.bg) {
    const g = ctx.createRadialGradient(size / 2, size * 0.35, size * 0.1, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, o.bg);
    g.addColorStop(1, rgba('#1b1438', 0.9));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const d = computeDims(ap, age);
  const pose = o.pose ?? restPose();
  const head = headAnchor(d, pose);
  const legLen = legLength(d);
  let cx: number, cy: number, span: number;
  switch (view) {
    case 'face': cx = head.x + d.headW * 0.06; cy = head.y + d.headH * 0.06; span = d.headH * 1.05; break;
    case 'eyes': cx = head.x + d.headW * 0.06; cy = head.y + d.headH * 0.04; span = d.headH * 0.7; break;
    case 'head': cx = head.x; cy = head.y + d.headH * 0.12; span = d.headH * 1.55; break;
    case 'body': cx = 0; cy = head.y + (d.headH + d.torso) * 0.55; span = d.headH + d.torso * 1.5; break;
    case 'legs': cx = 0; cy = -legLen * 0.55; span = legLen * 1.25; break;
    case 'feet': cx = 0; cy = -d.footH * 2.5; span = d.shin * 0.9; break;
    default: cx = 0; cy = -d.total * 0.5; span = d.total * 1.12; break;
  }
  const s = size / span;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  drawCharacter(ctx, ap, d, pose, EXPRESSIONS[o.expr ?? 'feliz'], { turn: o.turn ?? 0.3, light: -1, lw: Math.max(1.1, 1.3 / Math.max(0.6, s)), shadow: view === 'full', outfit: o.outfit, t: 0 });
  ctx.restore();
}

/** Retrato como <img> com cache (para listas). */
export function portraitImg(ap: Appearance, age: number, size = 56, expr: ExprName = 'feliz', bg = '#6b5bd6'): HTMLImageElement {
  const key = JSON.stringify(ap) + '|' + Math.round(age) + '|' + size + '|' + expr + '|' + bg;
  let url = cache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    renderThumb(c, ap, age, 'head', size, { expr, bg });
    url = c.toDataURL('image/png');
    cache.set(key, url);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  const img = new Image();
  img.src = url;
  img.className = 'portrait';
  img.width = size;
  img.height = size;
  img.alt = '';
  return img;
}
