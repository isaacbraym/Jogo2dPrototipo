import { Ctx, roundRect, part, circle, starPath } from './draw';
import { shade, rgba, mix, lineOf } from '../core/color';
import { RNG } from '../core/rng';
import { box } from './props';

export const X0 = -420;
export const WW = 2120;
export const FLOOR = 560; // junção parede/chão
export const GROUND = 632; // onde os personagens pisam

export type Sky = 'dia' | 'tarde' | 'noite' | 'nublado' | 'amanhecer';

const SKIES: Record<Sky, [number, string][]> = {
  dia: [[0, '#5aa9e6'], [0.55, '#9fd3f5'], [1, '#e3f4fb']],
  tarde: [[0, '#3b3b8f'], [0.35, '#c4588a'], [0.7, '#f3a15e'], [1, '#ffd98e']],
  noite: [[0, '#0b1030'], [0.6, '#1c2356'], [1, '#3a3570']],
  nublado: [[0, '#7d8794'], [0.6, '#a9b1bb'], [1, '#c9ced4']],
  amanhecer: [[0, '#6f8fd8'], [0.5, '#f4b6c8'], [1, '#ffe3b3']],
};

export function sky(ctx: Ctx, kind: Sky, h = FLOOR) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, c] of SKIES[kind]) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(X0, 0, WW, h + 4);
  if (kind === 'noite') {
    const r = new RNG(77);
    for (let i = 0; i < 180; i++) {
      const x = X0 + r.next() * WW, y = r.next() * h * 0.75;
      ctx.fillStyle = rgba('#ffffff', r.range(0.3, 0.95));
      ctx.beginPath();
      ctx.arc(x, y, r.range(0.5, 1.8), 0, 7);
      ctx.fill();
    }
  }
}

export function sun(ctx: Ctx, x: number, y: number, r: number, col = '#fff3c4', glow = '#ffd98e') {
  const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 5);
  g.addColorStop(0, rgba(glow, 0.55));
  g.addColorStop(1, rgba(glow, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 5, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}

export function moon(ctx: Ctx, x: number, y: number, r: number) {
  sun(ctx, x, y, r, '#f4f1e0', '#b9c4ff');
  ctx.fillStyle = 'rgba(180,180,200,0.35)';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.15, 0, 7); ctx.fill();
}

export function cloud(ctx: Ctx, x: number, y: number, s: number, col = '#ffffff', a = 0.95) {
  ctx.save();
  ctx.globalAlpha = a;
  const p = new Path2D();
  circle(p, x, y, 30 * s);
  circle(p, x + 32 * s, y - 14 * s, 36 * s);
  circle(p, x + 70 * s, y, 28 * s);
  circle(p, x + 36 * s, y + 8 * s, 30 * s);
  ctx.fillStyle = col;
  ctx.fill(p);
  ctx.fillStyle = rgba(shade(col, -0.12), 0.6);
  ctx.save();
  ctx.clip(p);
  ctx.fillRect(x - 40 * s, y + 10 * s, 160 * s, 40 * s);
  ctx.restore();
  ctx.restore();
}

export function clouds(ctx: Ctx, t: number, seed: number, n: number, y0: number, y1: number, col = '#ffffff', a = 0.9, speed = 8) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const s = r.range(0.6, 1.4);
    const base = r.next() * WW;
    const x = X0 + ((base + t * speed * s) % (WW + 300)) - 150;
    cloud(ctx, x, r.range(y0, y1), s, col, a);
  }
}

export function hills(ctx: Ctx, y: number, amp: number, col: string, seed: number, freq = 0.004) {
  const r = new RNG(seed);
  const ph = r.range(0, 10), ph2 = r.range(0, 10);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(X0, FLOOR + 200);
  for (let x = X0; x <= X0 + WW; x += 20) {
    ctx.lineTo(x, y - Math.sin(x * freq + ph) * amp - Math.sin(x * freq * 2.3 + ph2) * amp * 0.4);
  }
  ctx.lineTo(X0 + WW, FLOOR + 200);
  ctx.fill();
}

export function mountains(ctx: Ctx, y: number, h: number, col: string, seed: number, snow = false) {
  const r = new RNG(seed);
  let x = X0 - 100;
  while (x < X0 + WW + 100) {
    const w = r.range(220, 420), hh = h * r.range(0.6, 1.1);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y - hh);
    ctx.lineTo(x + w, y);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.08);
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - hh);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w * 0.7, y);
    ctx.fill();
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y - hh);
      ctx.lineTo(x + w / 2 + w * 0.12, y - hh * 0.75);
      ctx.lineTo(x + w / 2, y - hh * 0.8);
      ctx.lineTo(x + w / 2 - w * 0.12, y - hh * 0.74);
      ctx.fill();
    }
    x += w * 0.6;
  }
}

export function skyline(ctx: Ctx, y: number, col: string, seed: number, lit: number, winCol = '#ffd98e', hMul = 1) {
  const r = new RNG(seed);
  let x = X0;
  while (x < X0 + WW) {
    const w = r.range(60, 150), h = r.range(120, 330) * hMul;
    ctx.fillStyle = col;
    ctx.fillRect(x, y - h, w, h + 10);
    if (r.chance(0.3)) ctx.fillRect(x + w * 0.4, y - h - 30, 6, 30);
    if (lit > 0) {
      for (let wy = y - h + 14; wy < y - 16; wy += 18)
        for (let wx = x + 10; wx < x + w - 12; wx += 16)
          if (r.chance(lit)) {
            ctx.fillStyle = rgba(winCol, r.range(0.5, 0.95));
            ctx.fillRect(wx, wy, 8, 10);
          }
    } else {
      ctx.fillStyle = rgba('#ffffff', 0.12);
      for (let wy = y - h + 14; wy < y - 16; wy += 18) for (let wx = x + 10; wx < x + w - 12; wx += 16) ctx.fillRect(wx, wy, 8, 10);
    }
    x += w + r.range(2, 14);
  }
}

export function treeRow(ctx: Ctx, y: number, col: string, seed: number, n: number, s = 1) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const x = X0 + (i / n) * WW + r.range(-30, 30);
    const sc = s * r.range(0.7, 1.2);
    ctx.fillStyle = shade(col, -0.3);
    ctx.fillRect(x - 5 * sc, y - 50 * sc, 10 * sc, 50 * sc);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - 80 * sc, 42 * sc, 0, 7);
    ctx.arc(x - 30 * sc, y - 55 * sc, 30 * sc, 0, 7);
    ctx.arc(x + 30 * sc, y - 58 * sc, 32 * sc, 0, 7);
    ctx.fill();
    ctx.fillStyle = rgba('#ffffff', 0.12);
    ctx.beginPath();
    ctx.arc(x - 12 * sc, y - 100 * sc, 18 * sc, 0, 7);
    ctx.fill();
  }
}

export function pines(ctx: Ctx, y: number, col: string, seed: number, n: number, s = 1) {
  const r = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const x = X0 + (i / n) * WW + r.range(-40, 40);
    const sc = s * r.range(0.7, 1.3);
    ctx.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x - (50 - k * 10) * sc, y - k * 45 * sc);
      ctx.lineTo(x, y - (90 + k * 45) * sc);
      ctx.lineTo(x + (50 - k * 10) * sc, y - k * 45 * sc);
      ctx.fill();
    }
  }
}

/** Chão em perspectiva (tábuas, piso, carpete, grama...). */
export function floor(ctx: Ctx, kind: 'madeira' | 'piso' | 'carpete' | 'grama' | 'areia' | 'calcada' | 'concreto' | 'borracha' | 'palco' | 'terra' | 'xadrez', col: string, y0 = FLOOR) {
  const g = ctx.createLinearGradient(0, y0, 0, 720);
  g.addColorStop(0, shade(col, -0.12));
  g.addColorStop(1, shade(col, 0.06));
  ctx.fillStyle = g;
  ctx.fillRect(X0, y0, WW, 720 - y0 + 10);
  const vx = 640, vy = -500;
  const proj = (x: number, y: number) => vx + (x - vx) * ((y - vy) / (y0 - vy));
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, y0, WW, 730 - y0);
  ctx.clip();
  const r = new RNG(col.length * 31 + y0);
  if (kind === 'madeira' || kind === 'palco') {
    ctx.strokeStyle = rgba(shade(col, -0.45), 0.35);
    ctx.lineWidth = 1.5;
    for (let x = X0 - 1200; x < X0 + WW + 1200; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(proj(x, 730), 730);
      ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const y = r.range(y0 + 6, 720);
      const xb = r.range(X0, X0 + WW);
      const x1 = proj(xb, y), x2 = proj(xb + 46, y);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#ffffff', 0.05);
    for (let x = X0 - 1200; x < X0 + WW + 1200; x += 92) {
      ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(x + 20, y0); ctx.lineTo(proj(x + 20, 730), 730); ctx.lineTo(proj(x, 730), 730);
      ctx.fill();
    }
  } else if (kind === 'piso' || kind === 'xadrez') {
    const step = 70;
    ctx.strokeStyle = rgba(shade(col, -0.3), 0.4);
    ctx.lineWidth = 1.2;
    if (kind === 'xadrez') {
      let yy = y0, row = 0;
      while (yy < 730) {
        const h = 14 + row * 6;
        for (let x = X0 - 1400, k = 0; x < X0 + WW + 1400; x += step, k++) {
          if ((k + row) % 2) continue;
          ctx.fillStyle = rgba(shade(col, -0.35), 0.55);
          ctx.beginPath();
          ctx.moveTo(proj(x, yy), yy); ctx.lineTo(proj(x + step, yy), yy); ctx.lineTo(proj(x + step, yy + h), yy + h); ctx.lineTo(proj(x, yy + h), yy + h);
          ctx.fill();
        }
        yy += h; row++;
      }
    } else {
      for (let x = X0 - 1400; x < X0 + WW + 1400; x += step) {
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(proj(x, 730), 730); ctx.stroke();
      }
      let yy = y0, row = 0;
      while (yy < 730) { yy += 14 + row * 6; row++; ctx.beginPath(); ctx.moveTo(X0, yy); ctx.lineTo(X0 + WW, yy); ctx.stroke(); }
    }
  } else if (kind === 'carpete' || kind === 'borracha') {
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rgba(r.chance(0.5) ? shade(col, 0.1) : shade(col, -0.12), 0.35);
      ctx.fillRect(X0 + r.next() * WW, y0 + r.next() * 170, 2, 2);
    }
  } else if (kind === 'grama') {
    for (let i = 0; i < 700; i++) {
      const x = X0 + r.next() * WW, y = y0 + r.next() * 170;
      ctx.strokeStyle = rgba(r.chance(0.5) ? shade(col, 0.18) : shade(col, -0.18), 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r.range(-3, 3), y - r.range(4, 10)); ctx.stroke();
    }
    const flowers = ['#f4b6c8', '#fbf8f2', '#f2c14e', '#e86a92'];
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r.pick(flowers);
      ctx.beginPath(); ctx.arc(X0 + r.next() * WW, y0 + 10 + r.next() * 150, 2.5, 0, 7); ctx.fill();
    }
  } else if (kind === 'areia' || kind === 'terra') {
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rgba(r.chance(0.5) ? shade(col, 0.15) : shade(col, -0.15), 0.4);
      ctx.beginPath(); ctx.arc(X0 + r.next() * WW, y0 + r.next() * 170, r.range(0.8, 2), 0, 7); ctx.fill();
    }
  } else if (kind === 'calcada' || kind === 'concreto') {
    ctx.strokeStyle = rgba(shade(col, -0.35), 0.35);
    ctx.lineWidth = 1.5;
    for (let x = X0 - 1400; x < X0 + WW + 1400; x += kind === 'calcada' ? 110 : 220) {
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(proj(x, 730), 730); ctx.stroke();
    }
    for (let yy = y0 + 40; yy < 730; yy += 60) { ctx.beginPath(); ctx.moveTo(X0, yy); ctx.lineTo(X0 + WW, yy); ctx.stroke(); }
  }
  ctx.restore();
  // sombra de contato com a parede
  const sg = ctx.createLinearGradient(0, y0, 0, y0 + 40);
  sg.addColorStop(0, 'rgba(0,0,0,0.18)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(X0, y0, WW, 40);
}

export type WallPattern = 'liso' | 'listras' | 'bolinhas' | 'losangos' | 'tijolos' | 'azulejo' | 'painel' | 'estrelas' | 'concreto' | 'madeira';

export function wall(ctx: Ctx, col: string, pattern: WallPattern = 'liso', col2?: string, y1 = FLOOR) {
  const g = ctx.createLinearGradient(0, 0, 0, y1);
  g.addColorStop(0, shade(col, -0.12));
  g.addColorStop(0.35, col);
  g.addColorStop(1, shade(col, -0.06));
  ctx.fillStyle = g;
  ctx.fillRect(X0, 0, WW, y1);
  const c2 = col2 ?? shade(col, 0.08);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X0, 0, WW, y1);
  ctx.clip();
  const r = new RNG(col.length * 7 + pattern.length);
  switch (pattern) {
    case 'listras':
      ctx.fillStyle = rgba(c2, 0.45);
      for (let x = X0; x < X0 + WW; x += 60) ctx.fillRect(x, 0, 26, y1);
      break;
    case 'bolinhas':
      ctx.fillStyle = rgba(c2, 0.5);
      for (let y = 20, row = 0; y < y1; y += 40, row++) for (let x = X0 + (row % 2) * 20; x < X0 + WW; x += 40) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
      break;
    case 'estrelas':
      ctx.fillStyle = rgba(c2, 0.55);
      for (let y = 30, row = 0; y < y1; y += 70, row++) for (let x = X0 + (row % 2) * 35; x < X0 + WW; x += 70) { ctx.beginPath(); starPath(ctx, x, y, 8, 3.5, 5); ctx.fill(); }
      break;
    case 'losangos':
      ctx.strokeStyle = rgba(c2, 0.4);
      ctx.lineWidth = 2;
      for (let x = X0 - y1; x < X0 + WW; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + y1, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + y1, 0); ctx.lineTo(x, y1); ctx.stroke();
      }
      break;
    case 'tijolos':
      for (let y = 0, row = 0; y < y1; y += 26, row++)
        for (let x = X0 - (row % 2) * 30; x < X0 + WW; x += 60) {
          ctx.fillStyle = rgba(r.chance(0.5) ? shade(col, 0.08) : shade(col, -0.08), 1);
          ctx.fillRect(x + 2, y + 2, 56, 22);
        }
      break;
    case 'azulejo':
      ctx.strokeStyle = rgba(shade(col, -0.25), 0.5);
      ctx.lineWidth = 1.5;
      for (let x = X0; x < X0 + WW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y1); ctx.stroke(); }
      for (let y = 0; y < y1; y += 40) { ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X0 + WW, y); ctx.stroke(); }
      break;
    case 'painel': {
      const py = y1 * 0.58;
      ctx.fillStyle = c2;
      ctx.fillRect(X0, py, WW, y1 - py);
      ctx.strokeStyle = rgba(shade(c2, -0.3), 0.5);
      ctx.lineWidth = 2;
      for (let x = X0 + 20; x < X0 + WW; x += 120) { ctx.strokeRect(x, py + 20, 96, y1 - py - 44); }
      ctx.fillStyle = shade(c2, 0.1);
      ctx.fillRect(X0, py - 8, WW, 12);
      break;
    }
    case 'concreto':
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = rgba(r.chance(0.5) ? '#ffffff' : '#000000', 0.04);
        ctx.beginPath(); ctx.arc(X0 + r.next() * WW, r.next() * y1, r.range(2, 8), 0, 7); ctx.fill();
      }
      ctx.strokeStyle = rgba(shade(col, -0.25), 0.3);
      for (let x = X0; x < X0 + WW; x += 240) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y1); ctx.stroke(); }
      break;
    case 'madeira':
      ctx.strokeStyle = rgba(shade(col, -0.3), 0.4);
      ctx.lineWidth = 2;
      for (let x = X0; x < X0 + WW; x += 38) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y1); ctx.stroke(); }
      break;
  }
  ctx.restore();
  // rodapé
  ctx.fillStyle = shade(col2 ?? col, -0.25);
  ctx.fillRect(X0, y1 - 16, WW, 16);
  ctx.fillStyle = rgba('#ffffff', 0.18);
  ctx.fillRect(X0, y1 - 16, WW, 3);
  // moldura de teto
  ctx.fillStyle = shade(col, -0.2);
  ctx.fillRect(X0, 0, WW, 12);
}

export function windowFrame(ctx: Ctx, x: number, y: number, w: number, h: number, view: Sky, t = 0, opts: { city?: boolean; curtains?: string; frame?: string } = {}) {
  const frame = opts.frame ?? '#f7f3ea';
  ctx.save();
  // vista
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [o, c] of SKIES[view]) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (view === 'noite') {
    const r = new RNG(x);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = rgba('#ffffff', r.range(0.4, 0.9)); ctx.fillRect(x + r.next() * w, y + r.next() * h * 0.6, 1.5, 1.5); }
    moon(ctx, x + w * 0.72, y + h * 0.25, 14);
  } else if (view === 'tarde') sun(ctx, x + w * 0.3, y + h * 0.65, 20, '#ffe7b0', '#ff9a5e');
  else if (view === 'dia') {
    cloud(ctx, x + w * 0.1, y + h * 0.3, 0.6);
  }
  if (opts.city) {
    const r = new RNG(Math.round(x));
    let bx = x - 10;
    while (bx < x + w) {
      const bw = r.range(30, 60), bh = r.range(h * 0.25, h * 0.7);
      ctx.fillStyle = view === 'noite' ? '#1a1d3a' : '#8aa4c4';
      ctx.fillRect(bx, y + h - bh, bw, bh);
      for (let wy = y + h - bh + 8; wy < y + h - 6; wy += 12) for (let wx = bx + 5; wx < bx + bw - 6; wx += 10)
        if (r.chance(view === 'noite' ? 0.45 : 0.9)) { ctx.fillStyle = view === 'noite' ? rgba('#ffd98e', 0.8) : rgba('#ffffff', 0.35); ctx.fillRect(wx, wy, 5, 6); }
      bx += bw + 3;
    }
  } else if (view !== 'noite') {
    ctx.fillStyle = view === 'tarde' ? '#6a4a7a' : '#6fbf6a';
    ctx.beginPath(); ctx.ellipse(x + w * 0.3, y + h, w * 0.6, h * 0.25, 0, 0, 7); ctx.fill();
    ctx.fillStyle = view === 'tarde' ? '#553c68' : '#3fa56a';
    ctx.beginPath(); ctx.ellipse(x + w * 0.85, y + h, w * 0.5, h * 0.18, 0, 0, 7); ctx.fill();
  }
  // reflexo
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.moveTo(x + w * 0.1, y + h); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.62, y); ctx.lineTo(x + w * 0.22, y + h); ctx.fill();
  ctx.restore();
  // moldura
  ctx.strokeStyle = frame;
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  ctx.strokeStyle = rgba(lineOf(frame), 0.6);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
  box(ctx, x - 16, y + h + 2, w + 32, 12, 3, frame);
  if (opts.curtains) {
    for (const s of [-1, 1]) {
      const cx = s < 0 ? x - 30 : x + w + 30;
      ctx.fillStyle = opts.curtains;
      ctx.beginPath();
      ctx.moveTo(cx - 32, y - 30);
      ctx.lineTo(cx + 32, y - 30);
      ctx.quadraticCurveTo(cx + s * -8, y + h * 0.5, cx + 26 - s * 8, y + h + 60);
      ctx.lineTo(cx - 26 - s * 8, y + h + 60);
      ctx.quadraticCurveTo(cx - 20, y + h * 0.4, cx - 32, y - 30);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(opts.curtains, -0.35), 0.6);
      ctx.lineWidth = 2;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 14, y - 20); ctx.quadraticCurveTo(cx + k * 10, y + h * 0.5, cx + k * 14 - s * 6, y + h + 55); ctx.stroke(); }
    }
    box(ctx, x - 80, y - 40, w + 160, 10, 5, '#8a8f98');
  }
  void t;
}

/** Feixe de luz da janela no chão (aditivo). */
export function lightShaft(ctx: Ctx, x: number, y: number, w: number, h: number, col = '#fff3c4', a = 0.16) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, y, 0, 720);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w + 260, 720);
  ctx.lineTo(x + 180, 720);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  void h;
}

export function frameArt(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, frame = '#c99a2a') {
  box(ctx, x - 6, y - 6, w + 12, h + 12, 3, frame);
  const r = new RNG(seed);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const hue = r.pick(['#5ec3e8', '#f39237', '#9b5de5', '#6fbf6a', '#e86a92', '#f2c14e']);
  g.addColorStop(0, shade(hue, 0.4));
  g.addColorStop(1, shade(hue, -0.1));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const kind = seed % 3;
  if (kind === 0) {
    ctx.fillStyle = shade(hue, -0.35);
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.6, y + h * 0.7); ctx.lineTo(x + w * 0.8, y + h * 0.35); ctx.lineTo(x + w, y + h); ctx.fill();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.25, Math.min(w, h) * 0.1, 0, 7); ctx.fill();
  } else if (kind === 1) {
    for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(r.pick(['#fbf3e4', '#23242b', '#e4572e', '#f2c14e', '#3d7bd9']), 0.75); ctx.beginPath(); ctx.arc(x + w * 0.2 + r.next() * w * 0.6, y + h * 0.2 + r.next() * h * 0.6, r.range(3, Math.min(w, h) * 0.16), 0, 7); ctx.fill(); }
  } else {
    ctx.fillStyle = '#fbf3e4'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.42, Math.min(w, h) * 0.2, 0, 7); ctx.fill();
    ctx.fillRect(x + w * 0.3, y + h * 0.62, w * 0.4, h * 0.38);
  }
}

export function clock(ctx: Ctx, x: number, y: number, r: number, t: number) {
  const p = new Path2D();
  circle(p, x, y, r);
  part(ctx, p, '#fbfaf6', '#dedbd2', '#3b3d44', 2, null);
  ctx.strokeStyle = '#3b3d44';
  ctx.lineWidth = 2.5;
  const s = t * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(s * 0.08) * r * 0.5, y - Math.cos(s * 0.08) * r * 0.5);
  ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(s) * r * 0.75, y - Math.cos(s) * r * 0.75);
  ctx.stroke();
}

export function shelf(ctx: Ctx, x: number, y: number, w: number, seed: number) {
  box(ctx, x, y, w, 10, 2, '#8a5a3a');
  const r = new RNG(seed);
  let bx = x + 6;
  while (bx < x + w - 20) {
    if (r.chance(0.25)) {
      const pot = new Path2D(); roundRect(pot, bx, y - 22, 20, 22, 4);
      part(ctx, pot, '#d0692e', '#a04a1e', '#5a2a0e', 1, null);
      ctx.fillStyle = '#3fa56a'; ctx.beginPath(); ctx.arc(bx + 10, y - 28, 12, 0, 7); ctx.fill();
      bx += 26;
    } else {
      const bw = r.range(8, 14), bh = r.range(22, 36);
      box(ctx, bx, y - bh, bw, bh, 1.5, r.pick(['#c2273d', '#3d7bd9', '#f2c14e', '#2f8f6f', '#9b5de5']), { top: false, lw: 0.8 });
      bx += bw + 1;
    }
  }
}

export function vignette(ctx: Ctx, w: number, h: number, a = 0.35, col = '#0b0820') {
  const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, rgba(col, 0));
  g.addColorStop(1, rgba(col, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function glow(ctx: Ctx, x: number, y: number, r: number, col: string, a = 0.4) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}

export function lampPendant(ctx: Ctx, x: number, y: number, col = '#f2c14e', on = true) {
  ctx.strokeStyle = '#3b3d44';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
  const p = new Path2D();
  p.moveTo(x - 34, y + 30); p.quadraticCurveTo(x, y - 18, x + 34, y + 30); p.closePath();
  part(ctx, p, col, shade(col, -0.25), lineOf(col), 1.4, null);
  if (on) {
    glow(ctx, x, y + 34, 220, '#ffe3a0', 0.28);
    ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.ellipse(x, y + 30, 16, 5, 0, 0, 7); ctx.fill();
  }
}

export { mix };
