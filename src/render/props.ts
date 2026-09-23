import { Ctx, part, roundRect, capsule, circle, ellipse, heartPath, starPath, rgrad } from './draw';
import { shade, rgba, mix, lineOf } from '../core/color';
import { Pt } from '../character/rig';

export interface PropOpts {
  color?: string;
  color2?: string;
  state?: number; // 0..1 (ex.: velas acesas, luzes)
  flip?: boolean;
  variant?: number;
  scale?: number;
}

const LW = 1.3;

/** Caixa arredondada com sombreamento e contorno colorido. */
export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, col: string, opts: { line?: string; top?: boolean; lw?: number } = {}) {
  const p = new Path2D();
  roundRect(p, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(col, 0.1));
  g.addColorStop(1, shade(col, -0.12));
  part(ctx, p, g, shade(col, -0.25), opts.line ?? lineOf(col), opts.lw ?? LW, { x: -3, y: -2 });
  if (opts.top !== false) {
    ctx.fillStyle = rgba('#ffffff', 0.18);
    ctx.fillRect(x + r, y + 2, w - r * 2, Math.min(4, h * 0.2));
  }
  return p;
}

function shape(ctx: Ctx, p: Path2D, col: string, lw = LW, sh: Pt | null = { x: -3, y: -2 }) {
  part(ctx, p, col, shade(col, -0.22), lineOf(col), lw, sh);
}

export function flame(ctx: Ctx, x: number, y: number, s: number, t: number) {
  const f = 1 + Math.sin(t * 22 + x) * 0.12;
  const p = new Path2D();
  p.moveTo(x, y - s * 1.8 * f);
  p.quadraticCurveTo(x + s * 0.9, y - s * 0.4, x, y);
  p.quadraticCurveTo(x - s * 0.9, y - s * 0.4, x, y - s * 1.8 * f);
  ctx.save();
  ctx.shadowColor = 'rgba(255,190,80,0.9)';
  ctx.shadowBlur = s * 3;
  ctx.fillStyle = '#ffb22e';
  ctx.fill(p);
  ctx.restore();
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.45, s * 0.3, s * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

// =========================================================== objetos de mão
type Held = (ctx: Ctx, t: number, near: boolean) => void;
export const HELD: Record<string, { follow: boolean; draw: Held; off?: Pt }> = {
  celular: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -6, -14, 12, 22, 3, '#23242b', { top: false });
      ctx.fillStyle = '#5ec3e8';
      ctx.fillRect(-4.5, -12, 9, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(-4.5, -12, 3, 16);
    },
  },
  livro: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -14, -18, 28, 22, 2, '#c2273d');
      ctx.fillStyle = '#f4efe2';
      ctx.fillRect(-12, -16, 24, 3);
      ctx.fillStyle = '#f2c14e';
      ctx.fillRect(-6, -10, 12, 2);
    },
  },
  xicara: {
    follow: false,
    draw: (ctx, t) => {
      const p = new Path2D();
      p.moveTo(-7, -12); p.lineTo(7, -12); p.lineTo(5.5, 4); p.lineTo(-5.5, 4); p.closePath();
      shape(ctx, p, '#f4f1ea');
      ctx.strokeStyle = '#8a8680'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(8, -5, 4, -1.4, 1.4); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 2; i++) { ctx.moveTo(-2 + i * 4, -15); ctx.quadraticCurveTo(-5 + i * 4 + Math.sin(t * 3 + i) * 2, -21, -2 + i * 4, -27); }
      ctx.stroke();
    },
  },
  bebida: {
    follow: false,
    draw: (ctx) => {
      const p = new Path2D();
      p.moveTo(-7, -16); p.lineTo(7, -16); p.lineTo(5, 5); p.lineTo(-5, 5); p.closePath();
      ctx.fillStyle = 'rgba(230,240,255,0.5)'; ctx.fill(p);
      ctx.fillStyle = '#e86a92'; ctx.fillRect(-6, -8, 12, 12);
      ctx.strokeStyle = '#6d6a66'; ctx.lineWidth = 1.2; ctx.stroke(p);
      ctx.strokeStyle = '#5ec3e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -8); ctx.lineTo(6, -24); ctx.stroke();
    },
  },
  microfone: {
    follow: true,
    off: { x: 0, y: 6 },
    draw: (ctx) => {
      box(ctx, -3.5, -2, 7, 22, 3, '#23242b', { top: false });
      const p = new Path2D();
      circle(p, 0, -6, 7);
      part(ctx, p, '#b9bcc4', '#80838c', '#3b3d44', 1.2, { x: -2, y: -2 });
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8;
      for (let i = -4; i <= 4; i += 2.5) { ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i, 0); ctx.stroke(); }
    },
  },
  haltere: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -20, -3, 40, 6, 3, '#8a8f98');
      box(ctx, -26, -11, 9, 22, 3, '#23242b');
      box(ctx, 17, -11, 9, 22, 3, '#23242b');
    },
  },
  anel: {
    follow: false,
    draw: (ctx, t) => {
      box(ctx, -10, -6, 20, 12, 3, '#c2273d');
      const lid = new Path2D();
      roundRect(lid, -10, -20, 20, 12, 3);
      shape(ctx, lid, '#a31f33');
      ctx.fillStyle = '#f7f1e8'; ctx.fillRect(-7, -7, 14, 4);
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, -9, 4, 0, Math.PI * 2); ctx.stroke();
      const s = new Path2D();
      starPath(s, 0, -14, 4 + Math.sin(t * 8) * 1.5, 1.4, 4);
      ctx.fillStyle = '#ffffff'; ctx.fill(s);
    },
  },
  buque: {
    follow: false,
    draw: (ctx) => {
      ctx.strokeStyle = '#2f8f6f'; ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(i * 4, -14); ctx.stroke(); }
      const cols = ['#e4572e', '#f4b6c8', '#f2c14e', '#e86a92', '#fbf8f2'];
      cols.forEach((c, i) => {
        const x = (i - 2) * 6, y = -18 - (i % 2) * 6;
        const p = new Path2D();
        for (let k = 0; k < 5; k++) circle(p, x + Math.cos((k * Math.PI * 2) / 5) * 3.5, y + Math.sin((k * Math.PI * 2) / 5) * 3.5, 3.2);
        shape(ctx, p, c, 1, null);
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      });
      const w = new Path2D();
      w.moveTo(-10, -6); w.lineTo(10, -6); w.lineTo(3, 12); w.lineTo(-3, 12); w.closePath();
      shape(ctx, w, '#f4efe2');
    },
  },
  diploma: {
    follow: false,
    draw: (ctx) => {
      const p = new Path2D();
      capsule(p, -18, 0, 5, 18, 0, 5);
      shape(ctx, p, '#f4efe2');
      ctx.fillStyle = '#c2273d'; ctx.fillRect(-3, -5.5, 6, 11);
    },
  },
  martelo: {
    follow: true,
    off: { x: 0, y: 4 },
    draw: (ctx) => {
      box(ctx, -2.5, -4, 5, 26, 2, '#7a5236');
      box(ctx, -12, 16, 24, 11, 3, '#5a3a24');
    },
  },
  dinheiro: {
    follow: false,
    draw: (ctx) => {
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(-0.5 + i * 0.3);
        box(ctx, -6, -24, 12, 24, 1.5, '#6fbf6a', { top: false });
        ctx.fillStyle = '#3f8a3c'; ctx.beginPath(); ctx.arc(0, -12, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    },
  },
  caixaPertences: {
    follow: false,
    draw: (ctx) => {
      // plantinha e porta-retrato saindo da caixa
      ctx.strokeStyle = '#2f8f6f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(-10, -30); ctx.moveTo(-8, -8); ctx.lineTo(-2, -26); ctx.stroke();
      ctx.fillStyle = '#3fa56a'; ctx.beginPath(); ctx.ellipse(-10, -32, 5, 8, -0.3, 0, 7); ctx.ellipse(-1, -28, 5, 8, 0.4, 0, 7); ctx.fill();
      box(ctx, 4, -24, 16, 20, 1, '#c99a2a', { top: false, lw: 0.8 });
      ctx.fillStyle = '#9fd3ee'; ctx.fillRect(7, -21, 10, 14);
      box(ctx, -26, -8, 52, 34, 2, '#c8a27a');
      ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-26, 2); ctx.lineTo(26, 2); ctx.stroke();
    },
  },
  maleta: {
    follow: false,
    draw: (ctx) => {
      ctx.strokeStyle = '#3b2616'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(7, 2); ctx.stroke();
      box(ctx, -20, 2, 40, 28, 3, '#6d4b2e');
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(-3, 10, 6, 4);
    },
  },
  guardaChuva: {
    follow: false,
    draw: (ctx) => {
      ctx.strokeStyle = '#3b3d44'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -110); ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, 8, 4, 0, Math.PI); ctx.stroke();
      const p = new Path2D();
      p.moveTo(-62, -92);
      p.quadraticCurveTo(0, -150, 62, -92);
      for (let i = 0; i < 4; i++) p.quadraticCurveTo(62 - i * 31 - 15.5, -100, 62 - (i + 1) * 31, -92);
      p.closePath();
      shape(ctx, p, '#3d7bd9');
    },
  },
  balao: {
    follow: false,
    draw: (ctx, t) => {
      ctx.strokeStyle = 'rgba(80,80,80,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8 + Math.sin(t * 2) * 6, -40, Math.sin(t * 1.5) * 5, -80); ctx.stroke();
      const p = new Path2D();
      ellipse(p, Math.sin(t * 1.5) * 5, -98, 16, 20);
      shape(ctx, p, '#e4572e');
    },
  },
  presente: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -15, -26, 30, 26, 3, '#9b5de5');
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(-3, -26, 6, 26); ctx.fillRect(-15, -15, 30, 5);
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(-6, -30, 6, 4, -0.4, 0, Math.PI * 2); ctx.ellipse(6, -30, 6, 4, 0.4, 0, Math.PI * 2); ctx.stroke();
    },
  },
  trofeu: {
    follow: false,
    draw: (ctx, t) => {
      box(ctx, -12, -4, 24, 8, 2, '#5a3a24');
      const p = new Path2D();
      p.moveTo(-14, -40); p.lineTo(14, -40); p.quadraticCurveTo(14, -18, 3, -14); p.lineTo(3, -4); p.lineTo(-3, -4); p.lineTo(-3, -14); p.quadraticCurveTo(-14, -18, -14, -40); p.closePath();
      part(ctx, p, '#f2c14e', '#c99a2a', '#7a5a10', 1.3, { x: -3, y: -2 });
      ctx.strokeStyle = '#c99a2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-15, -32, 5, 1.5, 4.8); ctx.arc(15, -32, 5, -1.7, 1.6); ctx.stroke();
      const s = new Path2D(); starPath(s, 6, -34, 3 + Math.sin(t * 6) * 1.2, 1, 4); ctx.fillStyle = '#fff'; ctx.fill(s);
    },
  },
  papel: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -12, -30, 24, 32, 1, '#fbfaf6', { top: false });
      ctx.fillStyle = '#b9bcc4';
      for (let i = 0; i < 5; i++) ctx.fillRect(-8, -24 + i * 5, i === 4 ? 10 : 16, 1.6);
    },
  },
  sorvete: {
    follow: false,
    draw: (ctx) => {
      const c = new Path2D(); c.moveTo(-7, -10); c.lineTo(7, -10); c.lineTo(0, 10); c.closePath();
      shape(ctx, c, '#d9a55b');
      const s = new Path2D(); circle(s, 0, -14, 8); circle(s, -2, -24, 6.5);
      shape(ctx, s, '#f4b6c8');
      ctx.fillStyle = '#c2273d'; ctx.beginPath(); ctx.arc(0, -31, 2.5, 0, Math.PI * 2); ctx.fill();
    },
  },
  ursinho: {
    follow: false,
    draw: (ctx) => {
      const p = new Path2D();
      circle(p, 0, -6, 10); circle(p, 0, -20, 8); circle(p, -7, -26, 3.5); circle(p, 7, -26, 3.5); circle(p, -9, -4, 4); circle(p, 9, -4, 4);
      shape(ctx, p, '#b8864c');
      ctx.fillStyle = '#2a1c16'; ctx.beginPath(); ctx.arc(-3, -21, 1.3, 0, 7); ctx.arc(3, -21, 1.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8c8a0'; ctx.beginPath(); ctx.ellipse(0, -17, 3.5, 2.5, 0, 0, 7); ctx.fill();
    },
  },
  chocalho: {
    follow: true,
    off: { x: 0, y: 4 },
    draw: (ctx) => {
      box(ctx, -2, -2, 4, 14, 2, '#f4b6c8');
      const p = new Path2D(); circle(p, 0, 18, 8); shape(ctx, p, '#5ec3e8');
    },
  },
  cartas: {
    follow: false,
    draw: (ctx) => {
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(-0.35 + i * 0.35);
        box(ctx, -7, -24, 14, 20, 2, '#fbfaf6', { top: false });
        ctx.fillStyle = i === 1 ? '#23242b' : '#c2273d';
        ctx.beginPath(); heartPath(ctx, 0, -14, 4); ctx.fill();
        ctx.restore();
      }
    },
  },
  camera: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -14, -18, 28, 18, 3, '#23242b');
      const p = new Path2D(); circle(p, 0, -9, 7); shape(ctx, p, '#3b4a6b');
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-2, -11, 2, 0, 7); ctx.fill();
    },
  },
  vassoura: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -2, -60, 4, 90, 2, '#b8864c');
      const p = new Path2D(); p.moveTo(-6, 28); p.lineTo(6, 28); p.lineTo(14, 50); p.lineTo(-14, 50); p.closePath();
      shape(ctx, p, '#e8c46a');
    },
  },
  placa: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -2, -60, 4, 60, 2, '#7a5236');
      box(ctx, -30, -90, 60, 34, 3, '#fbfaf6');
      ctx.fillStyle = '#c2273d'; ctx.font = 'bold 12px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VIVA!', 0, -68);
    },
  },
  lanterna: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -5, -4, 10, 18, 2, '#3b3d44');
      ctx.fillStyle = 'rgba(255,240,180,0.25)';
      ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(-30, 90); ctx.lineTo(30, 90); ctx.lineTo(5, 14); ctx.fill();
    },
  },
  tocha: {
    follow: false,
    draw: (ctx, t) => {
      box(ctx, -2.5, -10, 5, 30, 2, '#7a5236');
      flame(ctx, 0, -10, 7, t);
    },
  },
  controle: {
    follow: false,
    draw: (ctx) => {
      const p = new Path2D(); capsule(p, -12, 0, 7, 12, 0, 7); shape(ctx, p, '#3b3d44');
      ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(7, -2, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#5ec3e8'; ctx.beginPath(); ctx.arc(10, 2, 2, 0, 7); ctx.fill();
    },
  },
  garfo: {
    follow: true,
    draw: (ctx) => {
      box(ctx, -1.5, 0, 3, 24, 1, '#c9c9cc');
      ctx.fillStyle = '#c9c9cc'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 2.5 - 0.7, 22, 1.4, 8);
    },
  },
  pincel: {
    follow: true,
    draw: (ctx) => {
      box(ctx, -1.8, -4, 3.6, 30, 1.5, '#b8864c');
      const p = new Path2D(); p.moveTo(-3, 25); p.lineTo(3, 25); p.lineTo(0, 36); p.closePath();
      shape(ctx, p, '#e4572e', 1);
    },
  },
  bola: {
    follow: false,
    draw: (ctx) => {
      const p = new Path2D(); circle(p, 0, -12, 13); shape(ctx, p, '#fbfaf6');
      ctx.fillStyle = '#23242b';
      const s = new Path2D(); starPath(s, 0, -12, 5, 3, 5); ctx.fill(s);
    },
  },
  violao: {
    follow: false,
    draw: (ctx) => {
      ctx.save(); ctx.rotate(-0.9);
      const p = new Path2D(); circle(p, 0, 22, 18); circle(p, 0, -2, 14);
      shape(ctx, p, '#c8843a');
      ctx.fillStyle = '#3b2616'; ctx.beginPath(); ctx.arc(0, 12, 6, 0, 7); ctx.fill();
      box(ctx, -3.5, -60, 7, 58, 2, '#5a3a24');
      box(ctx, -5, -70, 10, 12, 2, '#3b2616');
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6;
      for (let i = -1.5; i <= 1.5; i += 1) { ctx.beginPath(); ctx.moveTo(i, -60); ctx.lineTo(i, 28); ctx.stroke(); }
      ctx.restore();
    },
  },
  lupa: {
    follow: true,
    draw: (ctx) => {
      box(ctx, -2, 0, 4, 18, 2, '#5a3a24');
      ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 28, 10, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(180,220,255,0.35)'; ctx.fill();
    },
  },
  cigarro: {
    follow: false,
    draw: (ctx, t) => {
      box(ctx, -1, -12, 3, 12, 1, '#f4f1ea', { top: false });
      ctx.fillStyle = 'rgba(200,200,200,0.4)';
      ctx.beginPath(); ctx.arc(Math.sin(t * 2) * 3, -18 - ((t * 10) % 12), 3, 0, 7); ctx.fill();
    },
  },
  // Marmita pequena para levar no trabalho.
  marmita: {
    follow: true, off: { x: 0, y: 3 },
    draw: (ctx) => { box(ctx, -15, -9, 30, 18, 4, '#b9c7c6'); box(ctx, -16, -14, 32, 6, 3, '#dce2dc'); ctx.fillStyle = '#637475'; ctx.fillRect(-3, -13, 6, 3); },
  },
  // Bilhete de loteria com números impressos.
  bilheteLoteria: {
    follow: false,
    draw: (ctx) => { box(ctx, -18, -14, 36, 22, 2, '#f2e8ba', { top: false, lw: 0.8 }); ctx.strokeStyle = '#756d4c'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-15, -5); ctx.lineTo(15, -5); ctx.stroke(); ctx.fillStyle = '#3b403a'; ctx.font = '700 5px monospace'; ctx.textAlign = 'center'; ctx.fillText('08 17 23 41', 0, -8); ctx.fillText('SORTEIO', 0, 3); },
  },
  // Sacola de feira reutilizável.
  sacola: {
    follow: true, off: { x: 0, y: 4 },
    draw: (ctx) => { const p = new Path2D(); p.moveTo(-12, -5); p.lineTo(12, -5); p.lineTo(10, 17); p.quadraticCurveTo(0, 20, -10, 17); p.closePath(); shape(ctx, p, '#e4572e'); ctx.strokeStyle = '#6d3d2b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -4, 7, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#7dbd58'; ctx.beginPath(); ctx.arc(-3, -9, 4, 0, 7); ctx.arc(4, -10, 4, 0, 7); ctx.fill(); },
  },
  // Guarda-chuva que já perdeu a disputa contra o vento.
  guardaChuvaQuebrado: {
    follow: true, off: { x: 0, y: 6 },
    draw: (ctx) => { ctx.strokeStyle = '#665947'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(1, -23); ctx.quadraticCurveTo(1, -28, 6, -27); ctx.stroke(); const p = new Path2D(); p.moveTo(-20, -14); p.quadraticCurveTo(-10, -30, 0, -20); p.quadraticCurveTo(10, -31, 20, -15); p.lineTo(10, -18); p.lineTo(5, -7); p.lineTo(0, -17); p.lineTo(-8, -8); p.lineTo(-11, -19); p.closePath(); shape(ctx, p, '#3d7bd9', 1.1, null); ctx.strokeStyle = '#d4d6db'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -3); ctx.moveTo(-10, -19); ctx.lineTo(-8, -7); ctx.moveTo(10, -19); ctx.lineTo(5, -6); ctx.stroke(); },
  },
  pa: {
    follow: false,
    draw: (ctx) => {
      box(ctx, -2, -50, 4, 70, 2, '#7a5236');
      const p = new Path2D(); p.moveTo(-10, 18); p.lineTo(10, 18); p.lineTo(8, 40); p.quadraticCurveTo(0, 46, -8, 40); p.closePath();
      shape(ctx, p, '#8a8f98');
    },
  },
};

export function drawHeldProp(ctx: Ctx, id: string, hand: Pt, ang: number, t: number, near: boolean) {
  const h = HELD[id];
  if (!h) return;
  ctx.save();
  ctx.translate(hand.x, hand.y);
  if (h.follow) {
    ctx.rotate(-ang);
    ctx.translate(h.off?.x ?? 0, h.off?.y ?? 0);
  } else {
    ctx.translate(0, 6);
  }
  h.draw(ctx, t, near);
  ctx.restore();
}

// =========================================================== objetos de cena
export type SceneProp = (ctx: Ctx, t: number, o: PropOpts) => void;

function candle(ctx: Ctx, x: number, y: number, lit: boolean, t: number, col: string) {
  box(ctx, x - 2.5, y - 16, 5, 16, 1.5, col, { top: false, lw: 0.8 });
  if (lit) flame(ctx, x, y - 17, 4, t);
}

export const PROPS: Record<string, SceneProp> = {
  bolo: (ctx, t, o) => {
    const lit = (o.state ?? 1) > 0.5;
    // prato
    ctx.fillStyle = '#e8e6e0';
    ctx.beginPath(); ctx.ellipse(0, -2, 58, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a968e'; ctx.lineWidth = 1.2; ctx.stroke();
    const tiers: [number, number, string][] = [[46, 34, o.color ?? '#f4b6c8'], [32, 26, '#fbf3e4']];
    let y = -6;
    for (const [w, h, c] of tiers) {
      const p = new Path2D();
      p.moveTo(-w, y); p.lineTo(-w, y - h);
      p.ellipse(0, y - h, w, 8, 0, Math.PI, 0);
      p.lineTo(w, y);
      p.ellipse(0, y, w, 8, 0, 0, Math.PI);
      p.closePath();
      shape(ctx, p, c);
      ctx.fillStyle = shade(c, 0.12);
      ctx.beginPath(); ctx.ellipse(0, y - h, w, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lineOf(c); ctx.lineWidth = 1; ctx.stroke();
      // cobertura escorrendo
      ctx.fillStyle = '#fbfaf6';
      for (let i = 0; i < 7; i++) {
        const x = -w + 6 + (i * (w * 2 - 12)) / 6;
        ctx.beginPath(); ctx.ellipse(x, y - h + 5 + (i % 2) * 3, 4, 6 + (i % 3) * 2, 0, 0, Math.PI * 2); ctx.fill();
      }
      y -= h;
    }
    ctx.fillStyle = '#c2273d';
    ctx.beginPath(); ctx.arc(0, y - 6, 5, 0, Math.PI * 2); ctx.fill();
    const cols = ['#5ec3e8', '#f2c14e', '#9b5de5', '#6fbf6a'];
    for (let i = 0; i < 4; i++) candle(ctx, -18 + i * 12, y + 2 - (i % 2) * 2, lit, t, cols[i]);
  },
  presentes: (ctx) => {
    const g: [number, number, number, string, string][] = [[-40, 40, 34, '#3d7bd9', '#f2c14e'], [0, 30, 50, '#e86a92', '#fbfaf6'], [34, 36, 28, '#6fbf6a', '#e4572e']];
    for (const [x, w, h, c, r] of g) {
      box(ctx, x - w / 2, -h, w, h, 3, c);
      ctx.fillStyle = r; ctx.fillRect(x - 3, -h, 6, h); ctx.fillRect(x - w / 2, -h * 0.6, w, 5);
      ctx.strokeStyle = r; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x - 6, -h - 4, 6, 4, -0.4, 0, 7); ctx.ellipse(x + 6, -h - 4, 6, 4, 0.4, 0, 7); ctx.stroke();
    }
  },
  baloes: (ctx, t) => {
    const cols = ['#e4572e', '#f2c14e', '#3d7bd9', '#e86a92', '#9b5de5', '#6fbf6a'];
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 22 + Math.sin(t * 1.2 + i) * 6, y = -170 - (i % 3) * 30 + Math.sin(t * 1.7 + i * 2) * 5;
      ctx.strokeStyle = 'rgba(80,80,80,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(x * 0.3, y * 0.5, x, y + 20); ctx.stroke();
      const p = new Path2D(); ellipse(p, x, y, 17, 21); shape(ctx, p, cols[i]);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 8, 4, 6, -0.4, 0, 7); ctx.fill();
    }
  },
  mesa: (ctx, _t, o) => {
    const c = o.color ?? '#fbfaf6';
    box(ctx, -8, -80, 16, 80, 3, '#5a3a24');
    box(ctx, -40, -6, 80, 8, 3, '#5a3a24');
    const p = new Path2D();
    p.moveTo(-90, -86); p.lineTo(90, -86); p.lineTo(96, -50); p.quadraticCurveTo(0, -40, -96, -50); p.closePath();
    shape(ctx, p, c);
    ctx.fillStyle = shade(c, 0.08); ctx.beginPath(); ctx.ellipse(0, -86, 90, 12, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = lineOf(c); ctx.lineWidth = 1.2; ctx.stroke();
  },
  mesaJantar: (ctx, t) => {
    PROPS.mesa(ctx, t, { color: '#fbf3e4' });
    // velas e pratos
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(s * 50, -88, 22, 5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b9b5ad'; ctx.lineWidth = 1; ctx.stroke();
    }
    candle(ctx, -8, -88, true, t, '#fbfaf6');
    candle(ctx, 8, -88, true, t + 1, '#fbfaf6');
    ctx.fillStyle = '#c2273d'; ctx.beginPath(); ctx.arc(0, -96, 5, 0, 7); ctx.fill();
  },
  cadeira: (ctx, _t, o) => {
    const c = o.color ?? '#7a5236';
    const f = o.flip ? -1 : 1;
    ctx.save(); ctx.scale(f, 1);
    box(ctx, -26, -150, 8, 150, 3, c);
    box(ctx, -26, -76, 56, 10, 3, shade(c, 0.1));
    box(ctx, 22, -70, 8, 70, 3, shade(c, -0.1));
    box(ctx, -26, -150, 8, 60, 3, c);
    box(ctx, -30, -150, 14, 70, 4, shade(c, 0.05));
    ctx.restore();
  },
  sofa: (ctx, _t, o) => {
    const c = o.color ?? '#3d7bd9';
    box(ctx, -150, -110, 300, 70, 18, shade(c, -0.08));
    box(ctx, -140, -62, 280, 44, 12, c);
    box(ctx, -165, -90, 40, 80, 14, c);
    box(ctx, 125, -90, 40, 80, 14, c);
    ctx.strokeStyle = rgba(lineOf(c), 0.5); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, -20); ctx.stroke();
    box(ctx, -150, -12, 12, 12, 2, '#3b2616'); box(ctx, 138, -12, 12, 12, 2, '#3b2616');
    const pl = new Path2D(); roundRect(pl, -120, -100, 50, 40, 12); ctx.save(); ctx.translate(0, 0); ctx.rotate(-0.08); shape(ctx, pl, o.color2 ?? '#f2c14e'); ctx.restore();
  },
  cama: (ctx, _t, o) => {
    const c = o.color ?? '#9b5de5';
    box(ctx, -130, -150, 22, 150, 6, '#7a5236');
    box(ctx, -125, -70, 260, 40, 6, '#7a5236');
    box(ctx, -120, -92, 250, 30, 10, '#fbfaf6');
    const p = new Path2D(); roundRect(p, -60, -98, 195, 44, 12); shape(ctx, p, c);
    ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 45, -95); ctx.lineTo(-50 + i * 45, -58); ctx.stroke(); }
    const pil = new Path2D(); roundRect(pil, -112, -112, 55, 26, 12); shape(ctx, pil, '#fbfaf6');
    box(ctx, 125, -110, 18, 110, 6, '#7a5236');
  },
  berco: (ctx) => {
    box(ctx, -80, -120, 160, 14, 5, '#f4efe2');
    box(ctx, -80, -40, 160, 14, 5, '#f4efe2');
    for (let i = 0; i <= 8; i++) box(ctx, -78 + i * 19, -110, 5, 76, 2, '#fbf8f2', { top: false });
    box(ctx, -86, -130, 12, 130, 4, '#e8dcc6');
    box(ctx, 74, -130, 12, 130, 4, '#e8dcc6');
    // móbile
    ctx.strokeStyle = '#8a8680'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(60, -130); ctx.lineTo(60, -200); ctx.lineTo(20, -200); ctx.stroke();
  },
  tv: (ctx, t, o) => {
    box(ctx, -110, -40, 220, 40, 6, '#5a3a24');
    box(ctx, -8, -60, 16, 22, 2, '#23242b');
    box(ctx, -95, -180, 190, 120, 6, '#1b1c22');
    const on = (o.state ?? 1) > 0.5;
    const g = ctx.createLinearGradient(-88, -174, 88, -66);
    if (on) {
      const h = (t * 0.1) % 1;
      g.addColorStop(0, `hsl(${h * 360},60%,55%)`);
      g.addColorStop(1, `hsl(${(h * 360 + 120) % 360},60%,35%)`);
    } else { g.addColorStop(0, '#2b2d36'); g.addColorStop(1, '#16171c'); }
    ctx.fillStyle = g; ctx.fillRect(-88, -173, 176, 106);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(-88, -173); ctx.lineTo(-20, -173); ctx.lineTo(-88, -100); ctx.fill();
  },
  estante: (ctx) => {
    box(ctx, -70, -260, 140, 260, 4, '#7a5236');
    const cols = ['#c2273d', '#3d7bd9', '#f2c14e', '#2f8f6f', '#9b5de5', '#e4572e', '#5b3c88', '#0f7173'];
    for (let s = 0; s < 4; s++) {
      const y = -250 + s * 62;
      ctx.fillStyle = '#4a2f1c'; ctx.fillRect(-62, y, 124, 54);
      let x = -58;
      let k = s * 3;
      while (x < 50) {
        const w = 9 + ((k * 7) % 8), h = 38 + ((k * 13) % 14);
        box(ctx, x, y + 54 - h, w, h, 1.5, cols[k % cols.length], { top: false, lw: 0.8 });
        x += w + 1; k++;
      }
      ctx.fillStyle = '#8a5a3a'; ctx.fillRect(-66, y + 54, 132, 6);
    }
  },
  planta: (ctx, t, o) => {
    const s = o.scale ?? 1;
    ctx.save(); ctx.scale(s, s);
    const pot = new Path2D(); pot.moveTo(-24, -44); pot.lineTo(24, -44); pot.lineTo(18, 0); pot.lineTo(-18, 0); pot.closePath();
    shape(ctx, pot, o.color ?? '#d0692e');
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.38 + Math.sin(t * 1.3 + i) * 0.04;
      const L = 60 + (i % 3) * 18;
      const leaf = new Path2D();
      const ex = Math.cos(a) * L, ey = -44 + Math.sin(a) * L;
      leaf.moveTo(0, -44);
      leaf.quadraticCurveTo(ex * 0.5 - Math.sin(a) * 14, -44 + (ey + 44) * 0.5 + Math.cos(a) * 14, ex, ey);
      leaf.quadraticCurveTo(ex * 0.5 + Math.sin(a) * 14, -44 + (ey + 44) * 0.5 - Math.cos(a) * 14, 0, -44);
      shape(ctx, leaf, i % 2 ? '#2f8f6f' : '#3fa56a', 1.1, null);
    }
    ctx.restore();
  },
  luminaria: (ctx, _t, o) => {
    box(ctx, -3, -200, 6, 200, 2, '#3b3d44');
    box(ctx, -22, -6, 44, 6, 3, '#3b3d44');
    const sh = new Path2D(); sh.moveTo(-28, -200); sh.lineTo(28, -200); sh.lineTo(18, -240); sh.lineTo(-18, -240); sh.closePath();
    shape(ctx, sh, o.color ?? '#f2e6c8');
    const g = ctx.createRadialGradient(0, -200, 0, 0, -200, 140);
    g.addColorStop(0, 'rgba(255,230,160,0.35)'); g.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -200, 140, 0, 7); ctx.fill();
  },
  escrivaninha: (ctx, t, o) => {
    box(ctx, -110, -96, 220, 14, 3, o.color ?? '#c8a27a');
    box(ctx, -104, -84, 12, 84, 3, shade(o.color ?? '#c8a27a', -0.15));
    box(ctx, 50, -84, 54, 84, 3, shade(o.color ?? '#c8a27a', -0.08));
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(70, -60, 14, 3); ctx.fillRect(70, -30, 14, 3);
    // monitor
    box(ctx, -8, -118, 16, 24, 2, '#3b3d44');
    box(ctx, -60, -190, 120, 78, 6, '#23242b');
    const g = ctx.createLinearGradient(-54, -184, 54, -118);
    g.addColorStop(0, '#3d7bd9'); g.addColorStop(1, '#5ec3e8');
    ctx.fillStyle = g; ctx.fillRect(-54, -184, 108, 66);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) ctx.fillRect(-46, -176 + i * 11, 30 + ((i * 17 + Math.floor(t * 3)) % 50), 4);
    box(ctx, -40, -104, 60, 8, 2, '#d8d8d8');
    box(ctx, 30, -104, 12, 8, 4, '#d8d8d8');
  },
  carteira: (ctx, _t, o) => {
    box(ctx, -50, -70, 100, 10, 3, o.color ?? '#c8a27a');
    box(ctx, -44, -60, 8, 60, 2, '#8a8f98');
    box(ctx, 36, -60, 8, 60, 2, '#8a8f98');
  },
  quadroNegro: (ctx) => {
    box(ctx, -170, -330, 340, 180, 6, '#7a5236');
    ctx.fillStyle = '#23483a'; ctx.fillRect(-160, -320, 320, 160);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2;
    ctx.font = '22px "Patrick Hand", "Comic Sans MS", cursive'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('2 + 2 = 4', -140, -280); ctx.fillText('ABC', 40, -280);
    ctx.beginPath(); ctx.moveTo(-140, -230); ctx.quadraticCurveTo(-60, -270, 20, -230); ctx.stroke();
    box(ctx, -170, -160, 340, 10, 3, '#8a5a3a');
  },
  armarios: (ctx, _t, o) => {
    const c = o.color ?? '#3d7bd9';
    for (let i = 0; i < 4; i++) {
      box(ctx, -130 + i * 65, -260, 60, 260, 3, c);
      ctx.fillStyle = shade(c, -0.3);
      for (let k = 0; k < 4; k++) ctx.fillRect(-120 + i * 65, -240 + k * 6, 40, 2.5);
      ctx.fillRect(-85 + i * 65, -150, 4, 20);
    }
  },
  balanco: (ctx, t) => {
    ctx.strokeStyle = '#c2273d'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(-80, -230); ctx.lineTo(-50, 0); ctx.moveTo(110, 0); ctx.lineTo(80, -230); ctx.lineTo(50, 0); ctx.stroke();
    ctx.strokeStyle = '#3d7bd9'; ctx.beginPath(); ctx.moveTo(-86, -228); ctx.lineTo(86, -228); ctx.stroke();
    for (const s of [-1, 1]) {
      const a = Math.sin(t * 1.6 + s) * 0.25;
      ctx.save(); ctx.translate(s * 40, -226); ctx.rotate(a);
      ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14, 170); ctx.moveTo(14, 0); ctx.lineTo(14, 170); ctx.stroke();
      box(ctx, -20, 168, 40, 8, 3, '#f2c14e');
      ctx.restore();
    }
  },
  banco: (ctx, _t, o) => {
    const c = o.color ?? '#b8864c';
    box(ctx, -80, -52, 160, 10, 3, c);
    box(ctx, -80, -100, 160, 10, 3, c);
    box(ctx, -80, -80, 160, 10, 3, c);
    box(ctx, -70, -44, 8, 44, 2, '#3b3d44');
    box(ctx, 62, -44, 8, 44, 2, '#3b3d44');
  },
  arvore: (ctx, t, o) => {
    const s = o.scale ?? 1;
    const c = o.color ?? '#3fa56a';
    ctx.save(); ctx.scale(s, s);
    const tr = new Path2D(); tr.moveTo(-16, 0); tr.quadraticCurveTo(-8, -80, -12, -170); tr.lineTo(12, -170); tr.quadraticCurveTo(8, -80, 16, 0); tr.closePath();
    shape(ctx, tr, '#7a5236');
    const sw = Math.sin(t * 0.8) * 3;
    const p = new Path2D();
    const blobs: [number, number, number][] = [[0, -250, 70], [-60, -200, 55], [60, -205, 55], [-35, -290, 48], [40, -285, 50], [0, -180, 50]];
    for (const [x, y, r] of blobs) circle(p, x + sw * (y / -250), y, r);
    part(ctx, p, c, shade(c, -0.25), lineOf(c), 1.5, { x: -8, y: -8 });
    ctx.fillStyle = rgba(shade(c, 0.25), 0.6);
    for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.arc(x - r * 0.3 + sw, y - r * 0.35, r * 0.28, 0, 7); ctx.fill(); }
    ctx.restore();
  },
  arbusto: (ctx, _t, o) => {
    const c = o.color ?? '#3fa56a';
    const p = new Path2D();
    circle(p, -30, -26, 30); circle(p, 10, -38, 36); circle(p, 44, -24, 26);
    part(ctx, p, c, shade(c, -0.25), lineOf(c), 1.3, { x: -5, y: -5 });
    if (o.variant) { ctx.fillStyle = '#e86a92'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-40 + i * 16, -40 + (i % 2) * 14, 4, 0, 7); ctx.fill(); } }
  },
  carro: (ctx, t, o) => {
    const c = o.color ?? '#e4572e';
    const f = o.flip ? -1 : 1;
    ctx.save(); ctx.scale(f, 1);
    const body = new Path2D();
    body.moveTo(-150, -30); body.lineTo(-150, -70); body.quadraticCurveTo(-148, -88, -120, -92);
    body.lineTo(-80, -96); body.quadraticCurveTo(-55, -150, 10, -150); body.quadraticCurveTo(60, -150, 85, -100);
    body.quadraticCurveTo(140, -95, 152, -72); body.lineTo(154, -34); body.quadraticCurveTo(150, -26, 140, -26); body.lineTo(-140, -26); body.closePath();
    part(ctx, body, c, shade(c, -0.25), lineOf(c), 1.6, { x: -6, y: -5 });
    const win = new Path2D();
    win.moveTo(-68, -98); win.quadraticCurveTo(-48, -138, 8, -140); win.lineTo(8, -100); win.closePath();
    win.moveTo(18, -140); win.quadraticCurveTo(55, -138, 72, -100); win.lineTo(18, -100); win.closePath();
    ctx.fillStyle = '#9fd3ee'; ctx.fill(win); ctx.strokeStyle = lineOf(c); ctx.lineWidth = 1.5; ctx.stroke(win);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(-50, -102); ctx.lineTo(-30, -134); ctx.lineTo(-20, -134); ctx.lineTo(-40, -102); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(146, -64, 6, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e4572e'; ctx.fillRect(-152, -66, 6, 14);
    ctx.strokeStyle = rgba(lineOf(c), 0.6); ctx.beginPath(); ctx.moveTo(12, -98); ctx.lineTo(12, -34); ctx.moveTo(30, -80); ctx.lineTo(44, -80); ctx.stroke();
    for (const x of [-95, 95]) {
      ctx.save(); ctx.translate(x, -28); ctx.rotate((o.state ?? 0) * t * 10);
      const w = new Path2D(); circle(w, 0, 0, 27); shape(ctx, w, '#23242b', 1.5, null);
      const hub = new Path2D(); circle(hub, 0, 0, 13); shape(ctx, hub, '#c9c9cc', 1, null);
      ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * 1.256) * 12, Math.sin(k * 1.256) * 12); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  },
  viatura: (ctx, t, o) => {
    PROPS.carro(ctx, t, { ...o, color: '#f4f1ea' });
    const f = o.flip ? -1 : 1;
    ctx.save(); ctx.scale(f, 1);
    ctx.fillStyle = '#1d2a44'; ctx.fillRect(-140, -70, 280, 16);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLÍCIA', -60, -58);
    const on = Math.sin(t * 12) > 0;
    box(ctx, -20, -162, 40, 12, 3, on ? '#e0233a' : '#3d7bd9');
    const g = ctx.createRadialGradient(0, -156, 0, 0, -156, 160);
    const col = on ? '255,40,60' : '60,120,255';
    g.addColorStop(0, `rgba(${col},0.45)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -156, 160, 0, 7); ctx.fill();
    ctx.restore();
  },
  caçaNiquel: (ctx, t, o) => {
    box(ctx, -55, -230, 110, 230, 10, '#c2273d');
    box(ctx, -45, -215, 90, 30, 6, '#f2c14e');
    ctx.fillStyle = '#23242b'; ctx.font = 'bold 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('777', 0, -193);
    box(ctx, -42, -170, 84, 60, 6, '#fbfaf6');
    const sym = ['🍒', '⭐', '7', '🔔', '💎'];
    ctx.font = 'bold 22px sans-serif';
    for (let i = 0; i < 3; i++) {
      const spin = (o.state ?? 0) > 0.5;
      const k = spin ? Math.floor(t * 20 + i * 3) % sym.length : (o.variant ?? 0) === 1 ? 2 : (i * 2) % sym.length;
      ctx.fillStyle = '#c2273d';
      ctx.fillText(sym[k], -27 + i * 27, -130);
    }
    box(ctx, -40, -90, 80, 20, 4, '#23242b');
    ctx.strokeStyle = '#c9c9cc'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(56, -150); ctx.lineTo(74, -190); ctx.stroke();
    const k = new Path2D(); circle(k, 76, -194, 9); shape(ctx, k, '#e4572e');
    for (let i = 0; i < 6; i++) { ctx.fillStyle = Math.sin(t * 8 + i) > 0 ? '#fff3b0' : '#f2c14e'; ctx.beginPath(); ctx.arc(-45 + i * 18, -224, 3.5, 0, 7); ctx.fill(); }
  },
  mesaPoker: (ctx) => {
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.ellipse(0, -84, 170, 34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f7a4a'; ctx.beginPath(); ctx.ellipse(0, -86, 155, 27, 0, 0, 7); ctx.fill();
    box(ctx, -12, -70, 24, 70, 3, '#3b2616');
    const cols = ['#c2273d', '#3d7bd9', '#f4f1ea', '#23242b'];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) {
      ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.ellipse(-60 + i * 40, -88 - k * 3, 10, 4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
  },
  fogueira: (ctx, t) => {
    for (let i = -1; i <= 1; i += 2) { ctx.save(); ctx.rotate(i * 0.35); box(ctx, -42, -12, 84, 14, 7, '#7a5236'); ctx.restore(); }
    const g = ctx.createRadialGradient(0, -30, 0, 0, -30, 260);
    g.addColorStop(0, `rgba(255,170,60,${0.4 + Math.sin(t * 9) * 0.05})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -30, 260, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 11, h = 34 + Math.sin(t * 10 + i * 2) * 8 + (i === 2 ? 20 : 0);
      const p = new Path2D(); p.moveTo(x - 12, -8); p.quadraticCurveTo(x - 10, -h * 0.6, x + Math.sin(t * 7 + i) * 4, -h); p.quadraticCurveTo(x + 10, -h * 0.6, x + 12, -8); p.closePath();
      ctx.fillStyle = i % 2 ? '#ff8a2a' : '#ffb22e'; ctx.fill(p);
    }
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(0, -18, 8, 14, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 6; k++) { box(ctx, -60 + k * 20, -6, 16, 10, 5, '#8a8f98', { top: false, lw: 0.8 }); }
  },
  barraca: (ctx, _t, o) => {
    const c = o.color ?? '#f39237';
    const p = new Path2D(); p.moveTo(-130, 0); p.lineTo(0, -170); p.lineTo(130, 0); p.closePath();
    shape(ctx, p, c, 1.6);
    const d = new Path2D(); d.moveTo(-40, 0); d.lineTo(0, -120); d.lineTo(40, 0); d.closePath();
    ctx.fillStyle = shade(c, -0.45); ctx.fill(d);
    ctx.strokeStyle = '#3b3d44'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -170); ctx.lineTo(0, -190); ctx.stroke();
  },
  arco: (ctx, t) => {
    ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-150, 0); ctx.lineTo(-150, -260); ctx.arc(0, -260, 150, Math.PI, 0); ctx.lineTo(150, 0); ctx.stroke();
    const cols = ['#f4b6c8', '#fbf8f2', '#e86a92', '#f2c14e'];
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + (i / 25) * Math.PI;
      const x = Math.cos(a) * 150, y = -260 + Math.sin(a) * 150;
      const r = 12 + (i % 3) * 3;
      const p = new Path2D();
      for (let k = 0; k < 5; k++) circle(p, x + Math.cos(k * 1.256 + t * 0.2) * r * 0.45, y + Math.sin(k * 1.256) * r * 0.45, r * 0.45);
      shape(ctx, p, cols[i % 4], 0.9, null);
    }
    for (let i = 0; i < 10; i++) {
      for (const s of [-1, 1]) {
        const y = -20 - i * 24;
        const p = new Path2D(); ellipse(p, s * 150 + s * 8, y, 12, 6, s * 0.6);
        shape(ctx, p, '#3fa56a', 0.8, null);
      }
    }
  },
  lapide: (ctx, _t, o) => {
    const p = new Path2D(); p.moveTo(-50, 0); p.lineTo(-50, -110); p.arc(0, -110, 50, Math.PI, 0); p.lineTo(50, 0); p.closePath();
    shape(ctx, p, '#9aa0a8', 1.6);
    ctx.fillStyle = '#5a6068'; ctx.font = 'bold 16px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('R.I.P', 0, -110);
    ctx.fillRect(-30, -90, 60, 3); ctx.fillRect(-24, -78, 48, 3);
    if (o.state) { const f = new Path2D(); for (let i = 0; i < 3; i++) circle(f, -20 + i * 18, -8, 7); shape(ctx, f, '#e86a92', 1, null); }
  },
  // Orelhão azul de rua, com fone e fio enrolado.
  orelhao: (ctx, _t, o) => {
    const col = o.color ?? '#2c7890';
    box(ctx, -8, -285, 16, 285, 3, '#606d70'); box(ctx, -53, -278, 106, 190, 12, col);
    box(ctx, -39, -260, 78, 15, 4, '#d9e7da'); ctx.fillStyle = '#36554d'; ctx.font = '700 11px Nunito'; ctx.textAlign = 'center'; ctx.fillText('TELEFONE', 0, -249);
    box(ctx, -28, -230, 56, 70, 5, '#24363c'); for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) { ctx.fillStyle = '#d5d8d4'; ctx.beginPath(); ctx.arc(-14 + k * 14, -217 + i * 16, 3, 0, 7); ctx.fill(); }
    box(ctx, -32, -146, 64, 14, 7, '#2f3439'); ctx.strokeStyle = '#343a3c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, -140); for (let i = 0; i < 5; i++) ctx.quadraticCurveTo(45, -132 + i * 5, 33, -128 + i * 5); ctx.stroke();
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(31, -132, 5, 0, 7); ctx.fill();
  },
  // Carrinho de mercado de arame com alça e rodas.
  carrinhoMercado: (ctx, _t, o) => {
    const c = o.color ?? '#9aa2a2'; const p = new Path2D(); p.moveTo(-65, -105); p.lineTo(52, -105); p.lineTo(40, -45); p.lineTo(-40, -45); p.closePath(); shape(ctx, p, '#c8d0ce', 1.5); ctx.strokeStyle = c; ctx.lineWidth = 2;
    for (let y = -96; y <= -53; y += 14) { ctx.beginPath(); ctx.moveTo(-57, y); ctx.lineTo(48, y); ctx.stroke(); }
    for (let x = -48; x <= 42; x += 18) { ctx.beginPath(); ctx.moveTo(x, -102); ctx.lineTo(x * 0.72, -48); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(48, -104); ctx.lineTo(78, -130); ctx.stroke(); box(ctx, -22, -42, 10, 39, 2, '#687275'); box(ctx, 32, -42, 10, 39, 2, '#687275');
    for (const x of [-18, 38]) { const w = new Path2D(); circle(w, x, -1, 9); shape(ctx, w, '#35393c', 1.2); const h = new Path2D(); circle(h, x, -1, 3); shape(ctx, h, '#c8d0ce', 0.8, null); }
  },
  // Ventilador de coluna com hélice giratória.
  ventilador: (ctx, t, o) => {
    const ligado = (o.state ?? 0) > 0.5; box(ctx, -5, -150, 10, 132, 4, '#aeb4b4'); box(ctx, -34, -16, 68, 10, 5, '#676d70');
    const cage = new Path2D(); circle(cage, 0, -190, 52); shape(ctx, cage, '#9ea5a5', 2, null); ctx.strokeStyle = '#9ea5a5'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, -190 + Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 49, -190 + Math.sin(a) * 49); ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const a = (ligado ? t * 15 : 0) + i * Math.PI * 2 / 3; const p = new Path2D(); p.moveTo(0, -190); p.quadraticCurveTo(Math.cos(a + 0.5) * 40, -190 + Math.sin(a + 0.5) * 40, Math.cos(a) * 44, -190 + Math.sin(a) * 44); p.quadraticCurveTo(Math.cos(a - 0.4) * 20, -190 + Math.sin(a - 0.4) * 20, 0, -190); shape(ctx, p, '#c5ccca', 1, null); }
    const hub = new Path2D(); circle(hub, 0, -190, 8); shape(ctx, hub, '#6d7475', 1, null);
  },
  // Maquete de vulcão escolar com lava de papel crepom.
  vulcaoEscolar: (ctx, t, o) => {
    const c = o.color ?? '#8a5a3a'; const p = new Path2D(); p.moveTo(-55, 0); p.lineTo(-27, -68); p.lineTo(-15, -52); p.lineTo(0, -102); p.lineTo(18, -52); p.lineTo(30, -66); p.lineTo(56, 0); p.closePath(); shape(ctx, p, c, 1.6);
    const crater = new Path2D(); crater.ellipse(0, -97, 16, 6, 0, 0, 7); shape(ctx, crater, '#49362a', 1, null);
    ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-5, -92); ctx.quadraticCurveTo(-22, -52 + Math.sin(t * 4) * 3, -29, -12); ctx.moveTo(8, -92); ctx.quadraticCurveTo(24, -45 + Math.sin(t * 4 + 1) * 3, 32, -8); ctx.stroke();
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(0, -99, 5 + Math.sin(t * 7) * 1.2, 0, 7); ctx.fill();
  },
  leitoHospital: (ctx, _t, o) => {
    box(ctx, -150, -100, 300, 16, 4, '#c9ced6');
    box(ctx, -146, -118, 292, 22, 8, '#fbfaf6');
    box(ctx, -150, -84, 8, 84, 2, '#8a8f98'); box(ctx, 142, -84, 8, 84, 2, '#8a8f98');
    box(ctx, -160, -180, 14, 180, 4, '#c9ced6');
    ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, -120); ctx.lineTo(-60, -150); ctx.lineTo(140, -150); ctx.lineTo(140, -120); ctx.stroke();
    if (o.state) { const p = new Path2D(); roundRect(p, -30, -124, 176, 30, 10); shape(ctx, p, '#a9cfe6'); }
  },
  monitorCardiaco: (ctx, t, o) => {
    box(ctx, -4, -150, 8, 150, 2, '#8a8f98');
    box(ctx, -40, -6, 80, 6, 3, '#8a8f98');
    box(ctx, -50, -230, 100, 80, 6, '#3b3d44');
    ctx.fillStyle = '#0d1a14'; ctx.fillRect(-42, -222, 84, 60);
    ctx.strokeStyle = (o.state ?? 1) > 0.5 ? '#3cf07a' : '#f04a4a'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -40; x <= 40; x += 2) {
      const ph = ((x + 40) / 80 + t * 0.8) % 1;
      let y = -192;
      if ((o.state ?? 1) > 0.5) { if (ph > 0.45 && ph < 0.5) y -= 18; else if (ph > 0.5 && ph < 0.55) y += 10; }
      if (x === -40) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  },
  bancoSupino: (ctx) => {
    box(ctx, -90, -60, 180, 16, 6, '#23242b');
    box(ctx, -80, -44, 10, 44, 2, '#8a8f98'); box(ctx, 70, -44, 10, 44, 2, '#8a8f98');
    box(ctx, 60, -160, 10, 110, 2, '#8a8f98'); box(ctx, -70, -160, 10, 110, 2, '#8a8f98');
  },
  rackPesos: (ctx) => {
    box(ctx, -80, -150, 160, 10, 3, '#5a6470');
    box(ctx, -80, -80, 160, 10, 3, '#5a6470');
    box(ctx, -76, -150, 8, 150, 2, '#3b3d44'); box(ctx, 68, -150, 8, 150, 2, '#3b3d44');
    const cols = ['#e4572e', '#3d7bd9', '#f2c14e', '#23242b'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const x = -60 + i * 38, y = -150 + r * 70;
      box(ctx, x - 12, y - 16, 24, 8, 3, '#8a8f98', { top: false });
      box(ctx, x - 16, y - 24, 8, 22, 3, cols[i]); box(ctx, x + 8, y - 24, 8, 22, 3, cols[i]);
    }
  },
  esteira: (ctx, t) => {
    box(ctx, -110, -30, 220, 24, 8, '#3b3d44');
    ctx.fillStyle = '#23242b'; ctx.fillRect(-100, -30, 200, 6);
    ctx.fillStyle = '#5a6470'; for (let i = 0; i < 10; i++) ctx.fillRect(-100 + ((i * 20 - t * 120) % 200 + 200) % 200, -30, 3, 6);
    box(ctx, 80, -180, 10, 150, 3, '#5a6470');
    box(ctx, 50, -200, 60, 30, 6, '#3b3d44');
    ctx.fillStyle = '#3cf07a'; ctx.fillRect(58, -194, 44, 12);
  },
  pedestalMic: (ctx) => {
    box(ctx, -3, -170, 6, 170, 2, '#3b3d44');
    ctx.fillStyle = '#3b3d44'; ctx.beginPath(); ctx.ellipse(0, -2, 30, 6, 0, 0, 7); ctx.fill();
    const p = new Path2D(); circle(p, 0, -178, 9); shape(ctx, p, '#b9bcc4');
  },
  caixaSom: (ctx, t) => {
    box(ctx, -45, -180, 90, 180, 6, '#23242b');
    const pulse = 1 + Math.max(0, Math.sin(t * 13)) * 0.08;
    for (const [y, r] of [[-130, 30], [-50, 22]] as const) {
      const p = new Path2D(); circle(p, 0, y, r * pulse); shape(ctx, p, '#3b3d44', 1.2, null);
      ctx.fillStyle = '#16171c'; ctx.beginPath(); ctx.arc(0, y, r * 0.45 * pulse, 0, 7); ctx.fill();
    }
  },
  globoDisco: (ctx, t) => {
    ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(0, -40); ctx.stroke();
    const g = ctx.createRadialGradient(-10, -10, 4, 0, 0, 40);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8a8f98');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.clip();
    for (let y = -40; y < 40; y += 8) for (let x = -40; x < 40; x += 8) {
      const k = Math.sin(x * 0.3 + y * 0.2 + t * 5);
      ctx.fillStyle = k > 0.7 ? '#ffffff' : k > 0 ? 'rgba(200,220,255,0.5)' : 'rgba(80,80,110,0.4)';
      ctx.fillRect(x + ((y / 8) % 2) * 4, y, 7, 7);
    }
    ctx.restore();
  },
  bancadaJuiz: (ctx) => {
    box(ctx, -170, -210, 340, 210, 6, '#6d4b2e');
    box(ctx, -180, -222, 360, 18, 4, '#8a5a3a');
    ctx.fillStyle = '#5a3a24';
    for (let i = 0; i < 3; i++) ctx.fillRect(-150 + i * 105, -190, 90, 170);
    const s = new Path2D(); circle(s, 0, -120, 34); shape(ctx, s, '#f2c14e');
    ctx.fillStyle = '#8a6a1a'; ctx.font = 'bold 26px serif'; ctx.textAlign = 'center'; ctx.fillText('⚖', 0, -110);
  },
  grades: (ctx, _t, o) => {
    const w = o.scale ?? 1400;
    ctx.fillStyle = '#5a6068';
    for (let x = -w / 2; x <= w / 2; x += 46) {
      const g = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      g.addColorStop(0, '#3b3f46'); g.addColorStop(0.4, '#9aa0a8'); g.addColorStop(1, '#3b3f46');
      ctx.fillStyle = g; ctx.fillRect(x - 6, -720, 12, 720);
    }
    ctx.fillStyle = '#4a4f57'; ctx.fillRect(-w / 2, -480, w, 16); ctx.fillRect(-w / 2, -100, w, 16);
  },
  balcaoBar: (ctx, t) => {
    box(ctx, -260, -120, 520, 120, 6, '#5a3a24');
    box(ctx, -270, -132, 540, 16, 4, '#2b2d36');
    ctx.fillStyle = 'rgba(94,195,232,0.6)'; ctx.fillRect(-260, -10, 520, 4);
    for (let i = 0; i < 5; i++) {
      const x = -200 + i * 100;
      ctx.fillStyle = 'rgba(230,240,255,0.5)'; ctx.fillRect(x, -160, 14, 28);
      ctx.fillStyle = ['#e86a92', '#5ec3e8', '#f2c14e', '#9b5de5', '#6fbf6a'][i]; ctx.fillRect(x + 1, -150, 12, 18);
    }
    void t;
  },
  fogao: (ctx, t, o) => {
    box(ctx, -60, -150, 120, 150, 6, '#e8e6e0');
    ctx.fillStyle = '#23242b'; ctx.fillRect(-50, -110, 100, 70);
    ctx.fillStyle = 'rgba(255,150,60,0.3)'; ctx.fillRect(-46, -106, 92, 62);
    box(ctx, -64, -160, 128, 12, 3, '#3b3d44');
    for (let i = -1; i <= 1; i += 2) { ctx.fillStyle = '#23242b'; ctx.beginPath(); ctx.ellipse(i * 30, -160, 20, 5, 0, 0, 7); ctx.fill(); }
    // panela
    box(ctx, -52, -196, 44, 34, 6, '#8a8f98');
    if ((o.state ?? 0) > 0.5) {
      for (let i = 0; i < 4; i++) {
        const y = -210 - ((t * 60 + i * 20) % 80);
        ctx.fillStyle = `rgba(60,60,60,${0.5 - ((t * 60 + i * 20) % 80) / 180})`;
        ctx.beginPath(); ctx.arc(-30 + Math.sin(t * 3 + i) * 10, y, 14 + ((t * 60 + i * 20) % 80) * 0.2, 0, 7); ctx.fill();
      }
      flame(ctx, -30, -196, 12, t);
      flame(ctx, -18, -196, 9, t + 1);
    }
  },
  geladeira: (ctx) => {
    box(ctx, -55, -300, 110, 300, 10, '#f4f4f0');
    ctx.fillStyle = '#c9c9cc'; ctx.fillRect(-55, -190, 110, 3);
    box(ctx, 38, -270, 6, 50, 3, '#8a8f98'); box(ctx, 38, -170, 6, 60, 3, '#8a8f98');
    const cols = ['#e4572e', '#3d7bd9', '#f2c14e'];
    for (let i = 0; i < 3; i++) { box(ctx, -40 + i * 18, -260 + i * 8, 14, 18, 2, cols[i], { top: false, lw: 0.6 }); }
  },
  mala: (ctx, _t, o) => {
    const c = o.color ?? '#3d7bd9';
    box(ctx, -40, -110, 80, 110, 10, c);
    ctx.strokeStyle = shade(c, -0.4); ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 20, -104); ctx.lineTo(i * 20, -6); ctx.stroke(); }
    box(ctx, -4, -150, 8, 42, 2, '#3b3d44'); box(ctx, -20, -156, 40, 8, 3, '#3b3d44');
    for (const s of [-1, 1]) { ctx.fillStyle = '#23242b'; ctx.beginPath(); ctx.arc(s * 28, 2, 6, 0, 7); ctx.fill(); }
  },
  casaFachada: (ctx, t, o) => {
    const c = o.color ?? '#f2c14e';
    box(ctx, -210, -300, 420, 300, 4, c);
    const roof = new Path2D(); roof.moveTo(-250, -290); roof.lineTo(0, -470); roof.lineTo(250, -290); roof.closePath();
    shape(ctx, roof, '#c2473d', 1.8);
    box(ctx, -40, -150, 80, 150, 6, '#7a5236');
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(26, -74, 4, 0, 7); ctx.fill();
    for (const x of [-150, 90]) {
      box(ctx, x, -230, 70, 70, 4, '#fbfaf6');
      ctx.fillStyle = '#9fd3ee'; ctx.fillRect(x + 6, -224, 58, 58);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 6, -224, 20, 58);
      ctx.fillStyle = '#fbfaf6'; ctx.fillRect(x + 33, -224, 4, 58); ctx.fillRect(x + 6, -197, 58, 4);
    }
    box(ctx, 110, -430, 40, 90, 3, '#8a5a3a');
    if (o.state) {
      for (let i = 0; i < 3; i++) { const y = -440 - ((t * 20 + i * 25) % 75); ctx.fillStyle = `rgba(220,220,220,${0.5 - ((t * 20 + i * 25) % 75) / 150})`; ctx.beginPath(); ctx.arc(130 + Math.sin(t + i) * 6, y, 12, 0, 7); ctx.fill(); }
    }
  },
  placaVendido: (ctx) => {
    box(ctx, -4, -130, 8, 130, 2, '#7a5236');
    box(ctx, -60, -150, 120, 60, 4, '#fbfaf6');
    ctx.fillStyle = '#c2273d'; ctx.font = 'bold 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('VENDIDO', 0, -112);
  },
  caixao: (ctx) => {
    const p = new Path2D(); p.moveTo(-150, -30); p.lineTo(-130, -80); p.lineTo(140, -80); p.lineTo(160, -30); p.lineTo(140, 0); p.lineTo(-130, 0); p.closePath();
    shape(ctx, p, '#5a3a24', 1.6);
    ctx.fillStyle = '#c99a2a'; ctx.fillRect(-100, -44, 200, 4);
    PROPS.buqueChao(ctx, 0, {});
  },
  buqueChao: (ctx) => {
    const cols = ['#fbf8f2', '#f4b6c8', '#e86a92'];
    for (let i = 0; i < 7; i++) { const p = new Path2D(); circle(p, -30 + i * 10, -84 - (i % 2) * 8, 9); shape(ctx, p, cols[i % 3], 0.8, null); }
  },
  palco: (ctx, t) => {
    box(ctx, -600, -60, 1200, 60, 4, '#2b2d36');
    ctx.fillStyle = '#3b3d44'; ctx.fillRect(-600, -60, 1200, 6);
    for (let i = 0; i < 6; i++) {
      const x = -500 + i * 200;
      const on = Math.sin(t * 3 + i) > 0;
      ctx.fillStyle = on ? '#fff3b0' : '#8a6a1a'; ctx.beginPath(); ctx.arc(x, -30, 8, 0, 7); ctx.fill();
    }
  },
  podio: (ctx) => {
    box(ctx, -50, -130, 100, 130, 6, '#6d4b2e');
    box(ctx, -60, -140, 120, 16, 4, '#8a5a3a');
    const s = new Path2D(); circle(s, 0, -80, 20); shape(ctx, s, '#f2c14e');
  },
  cavalete: (ctx, t, o) => {
    ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(0, -240); ctx.lineTo(50, 0); ctx.moveTo(0, -240); ctx.lineTo(0, 0); ctx.stroke();
    box(ctx, -70, -220, 140, 110, 3, '#fbfaf6');
    const prog = o.state ?? 1;
    ctx.save(); ctx.beginPath(); ctx.rect(-64, -214, 128 * prog, 98); ctx.clip();
    const g = ctx.createLinearGradient(0, -214, 0, -116); g.addColorStop(0, '#5ec3e8'); g.addColorStop(1, '#f2c14e');
    ctx.fillStyle = g; ctx.fillRect(-64, -214, 128, 98);
    ctx.fillStyle = '#2f8f6f'; ctx.beginPath(); ctx.moveTo(-64, -130); ctx.quadraticCurveTo(-10, -180, 64, -140); ctx.lineTo(64, -116); ctx.lineTo(-64, -116); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(30, -190, 12, 0, 7); ctx.fill();
    ctx.restore();
    box(ctx, -60, -112, 120, 8, 2, '#7a5236');
    void t;
  },
  ursinho: (ctx, t) => HELD.ursinho.draw(ctx, t, true),
  churrasqueira: (ctx, t) => {
    // churrasqueira de tijolo com espetos e fumaça
    box(ctx, -80, -150, 160, 150, 4, '#b0694a');
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = -146; y < 0; y += 18) for (let x = -76 + ((y / 18) % 2) * 18; x < 70; x += 36) ctx.fillRect(x, y, 34, 2);
    box(ctx, -90, -160, 180, 16, 3, '#8a8f98');
    ctx.fillStyle = '#23242b'; ctx.fillRect(-70, -128, 140, 50);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = Math.sin(t * 9 + i) > 0 ? '#ff6a2a' : '#c2273d'; ctx.beginPath(); ctx.arc(-55 + i * 22, -84, 7, 0, 7); ctx.fill(); }
    for (let i = 0; i < 3; i++) {
      box(ctx, -96, -178 - i * 4 + i * 0, 192, 4, 1, '#c9c9cc', { top: false, lw: 0.5 });
      const mp = new Path2D(); roundRect(mp, -60 + i * 38, -190, 30, 16, 6);
      part(ctx, mp, i === 1 ? '#8e2c48' : '#a8543a', '#6d2334', '#3a1010', 1, null);
    }
    box(ctx, 50, -290, 34, 130, 3, '#8a5a3a');
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.5 + i / 4) % 1;
      ctx.fillStyle = `rgba(210,210,210,${0.45 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(67 + Math.sin(t + i) * 8, -300 - k * 120, 14 + k * 20, 0, 7); ctx.fill();
    }
  },
  fraseQuadro: (ctx, _t, o) => {
    const text = ((o as any).text as string) ?? 'Não devo bagunçar';
    ctx.fillStyle = '#23483a';
    ctx.fillRect(-150, -180, 300, 160);
    ctx.save();
    ctx.beginPath(); ctx.rect(-150, -180, 300, 160); ctx.clip();
    ctx.font = '17px "Patrick Hand", "Comic Sans MS", cursive';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const lines = 7;
    const shown = (o.state ?? 1) * lines;
    for (let i = 0; i < lines; i++) {
      const k = Math.max(0, Math.min(1, shown - i));
      if (k <= 0) break;
      const full = text + '.';
      ctx.fillText(full.slice(0, Math.ceil(full.length * k)), -140, -160 + i * 21);
    }
    ctx.restore();
  },
  cobertor: (ctx, _t, o) => {
    const c = o.color ?? '#a9cfe6';
    const p = new Path2D();
    p.moveTo(-95, 18);
    p.bezierCurveTo(-100, -20, -60, -30, -20, -26);
    p.bezierCurveTo(30, -22, 70, -30, 98, -14);
    p.quadraticCurveTo(108, 6, 96, 22);
    p.closePath();
    shape(ctx, p, c);
    ctx.strokeStyle = rgba(lineOf(c), 0.35); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(-60 + i * 40, -20); ctx.quadraticCurveTo(-55 + i * 40, 0, -65 + i * 40, 18); }
    ctx.stroke();
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-96, -22, 26, 40);
  },
  capeloVoando: (ctx, t) => {
    ctx.save();
    ctx.rotate(Math.sin(t * 6) * 0.4);
    const top = new Path2D();
    top.moveTo(0, -14); top.lineTo(34, -4); top.lineTo(0, 6); top.lineTo(-34, -4); top.closePath();
    part(ctx, top, '#262938', null, '#05060a', 1.2, null);
    box(ctx, -18, 0, 36, 12, 2, '#1d1f2a', { top: false });
    ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(20, 0, 24, 18); ctx.stroke();
    ctx.restore();
  },
  fogo: (ctx, t) => {
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 14, h = 60 + Math.sin(t * 12 + i * 2) * 18 + (i === 3 ? 30 : 0);
      const p = new Path2D(); p.moveTo(x - 16, 0); p.quadraticCurveTo(x - 14, -h * 0.6, x + Math.sin(t * 8 + i) * 6, -h); p.quadraticCurveTo(x + 14, -h * 0.6, x + 16, 0); p.closePath();
      ctx.fillStyle = i % 2 ? '#ff6a2a' : '#ffb22e';
      ctx.fill(p);
    }
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.ellipse(0, -20, 14, 26, 0, 0, 7); ctx.fill();
    propGlow(ctx, 0, -40, 200, '#ff9a3a', 0.35);
  },
  cachorro: (ctx, t, o) => drawDog(ctx, t, o),
  gato: (ctx, t, o) => drawCat(ctx, t, o),
  aviao: (ctx, _t, o) => {
    const c = o.color ?? '#fbfaf6';
    const p = new Path2D();
    p.moveTo(-200, -40); p.quadraticCurveTo(-200, -70, -150, -72); p.lineTo(170, -72); p.quadraticCurveTo(220, -64, 230, -40); p.quadraticCurveTo(220, -20, 170, -14); p.lineTo(-150, -14); p.quadraticCurveTo(-200, -14, -200, -40); p.closePath();
    shape(ctx, p, c, 1.6);
    const w = new Path2D(); w.moveTo(-40, -40); w.lineTo(60, -40); w.lineTo(-10, 40); w.lineTo(-60, 40); w.closePath(); shape(ctx, w, shade(c, -0.1));
    const tl = new Path2D(); tl.moveTo(-190, -60); tl.lineTo(-170, -130); tl.lineTo(-140, -130); tl.lineTo(-130, -68); tl.closePath(); shape(ctx, tl, '#3d7bd9');
    ctx.fillStyle = '#3b4a6b'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.arc(-110 + i * 22, -48, 5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#3d7bd9'; ctx.fillRect(-150, -30, 320, 6);
  },
  bandeirinhas: (ctx, t, o) => {
    const w = o.scale ?? 900;
    const cols = ['#e4572e', '#f2c14e', '#3d7bd9', '#6fbf6a', '#e86a92', '#9b5de5'];
    ctx.strokeStyle = 'rgba(80,80,80,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.quadraticCurveTo(0, 60, w / 2, 0); ctx.stroke();
    const n = Math.floor(w / 36);
    for (let i = 0; i <= n; i++) {
      const tt = i / n, x = -w / 2 + w * tt, y = 120 * tt * (1 - tt) * 0.5 * 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * 0.08);
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.lineTo(0, 24); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  },
  livrosPilha: (ctx) => {
    const cols = ['#c2273d', '#3d7bd9', '#f2c14e', '#2f8f6f'];
    for (let i = 0; i < 4; i++) box(ctx, -30 + (i % 2) * 6, -14 - i * 14, 60, 13, 2, cols[i], { top: false, lw: 0.9 });
  },
  tapete: (ctx, _t, o) => {
    const c = o.color ?? '#b5446e';
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 230, 30, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 200, 22, 0, 0, 7); ctx.stroke();
  },
  espelho: (ctx) => {
    box(ctx, -50, -300, 100, 200, 40, '#c99a2a');
    const g = ctx.createLinearGradient(-40, -290, 40, -110);
    g.addColorStop(0, '#dff2fb'); g.addColorStop(1, '#9fc6dc');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-40, -290, 80, 180, 34); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(-30, -200); ctx.lineTo(10, -280); ctx.lineTo(20, -280); ctx.lineTo(-30, -180); ctx.fill();
  },
  telescopio: (ctx) => {
    ctx.strokeStyle = '#3b3d44'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -80); ctx.lineTo(-30, 0); ctx.moveTo(0, -80); ctx.lineTo(30, 0); ctx.moveTo(0, -80); ctx.lineTo(0, 0); ctx.stroke();
    ctx.save(); ctx.translate(0, -90); ctx.rotate(-0.6);
    box(ctx, -60, -12, 120, 24, 8, '#3d7bd9');
    ctx.restore();
  },
  cone: (ctx) => {
    const p = new Path2D(); p.moveTo(-20, 0); p.lineTo(0, -60); p.lineTo(20, 0); p.closePath();
    shape(ctx, p, '#f39237');
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-11, -34, 22, 7);
  },
  hidrante: (ctx) => {
    box(ctx, -16, -70, 32, 70, 8, '#c2273d');
    box(ctx, -24, -50, 48, 12, 5, '#c2273d');
    const p = new Path2D(); circle(p, 0, -72, 14); shape(ctx, p, '#a31f33');
  },
  poste: (ctx, _t, o) => {
    box(ctx, -5, -400, 10, 400, 3, '#3b3d44');
    box(ctx, -5, -400, 70, 8, 3, '#3b3d44');
    const on = (o.state ?? 1) > 0.5;
    box(ctx, 44, -400, 32, 16, 4, on ? '#fff3b0' : '#8a8f98');
    if (on) {
      const g = ctx.createRadialGradient(60, -386, 0, 60, -386, 260);
      g.addColorStop(0, 'rgba(255,240,180,0.35)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(44, -386); ctx.lineTo(-100, 0); ctx.lineTo(220, 0); ctx.lineTo(76, -386); ctx.fill();
    }
  },
};

// =========================================================== pets
export function drawDog(ctx: Ctx, t: number, o: PropOpts) {
  const c = o.color ?? '#c8843a';
  const f = o.flip ? -1 : 1;
  const walk = o.state ?? 0;
  const s = o.scale ?? 1;
  ctx.save();
  ctx.scale(f * s, s);
  ctx.fillStyle = 'rgba(20,15,30,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 50, 8, 0, 0, 7); ctx.fill();
  const bob = walk ? Math.abs(Math.sin(t * 10)) * 4 : Math.sin(t * 2) * 1;
  const legA = walk ? Math.sin(t * 10) * 0.5 : 0;
  const line = lineOf(c);
  const leg = (x: number, a: number) => {
    const p = new Path2D(); capsule(p, x, -34, 7, x + Math.sin(a) * 26, -6, 6);
    part(ctx, p, c, shade(c, -0.2), line, 1.2, null);
    const pw = new Path2D(); ellipse(pw, x + Math.sin(a) * 26 + 3, -4, 8, 5); part(ctx, pw, shade(c, 0.15), null, line, 1, null);
  };
  leg(-26, -legA); leg(22, legA);
  // cauda
  const wag = Math.sin(t * (walk ? 14 : 9)) * 0.5;
  ctx.save(); ctx.translate(-40, -52 - bob); ctx.rotate(-0.9 + wag);
  const tl = new Path2D(); capsule(tl, 0, 0, 5, 0, -28, 3); part(ctx, tl, c, null, line, 1.2, null);
  ctx.restore();
  const body = new Path2D(); ellipse(body, 0, -46 - bob, 44, 22);
  part(ctx, body, c, shade(c, -0.2), line, 1.4, { x: -3, y: -3 });
  ctx.fillStyle = rgba('#ffffff', 0.35); ctx.beginPath(); ctx.ellipse(8, -38 - bob, 22, 10, 0, 0, 7); ctx.fill();
  leg(-18, legA * 0.8); leg(28, -legA * 0.8);
  // cabeça
  ctx.save(); ctx.translate(42, -70 - bob); ctx.rotate(Math.sin(t * 1.5) * 0.08);
  const ear = new Path2D(); ellipse(ear, -12, -2, 9, 18, 0.4 + Math.sin(t * 8) * 0.1 * walk);
  part(ctx, ear, shade(c, -0.3), null, line, 1.2, null);
  const hd = new Path2D(); circle(hd, 0, 0, 22); ellipse(hd, 18, 8, 16, 11);
  part(ctx, hd, c, shade(c, -0.2), line, 1.4, { x: -3, y: -2 });
  ctx.fillStyle = shade(c, 0.35); ctx.beginPath(); ctx.ellipse(18, 10, 12, 8, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(32, 4, 5, 4, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(8, -6, 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(7, -7, 1.2, 0, 7); ctx.fill();
  if (o.variant === 1 || walk) { ctx.fillStyle = '#e0707e'; ctx.beginPath(); ctx.ellipse(22, 18, 5, 7, 0.2, 0, 7); ctx.fill(); }
  ctx.strokeStyle = line; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(14, 16); ctx.quadraticCurveTo(22, 18, 28, 13); ctx.stroke();
  ctx.fillStyle = '#c2273d'; ctx.fillRect(-18, 14, 22, 5);
  ctx.restore();
  ctx.restore();
}

export function drawCat(ctx: Ctx, t: number, o: PropOpts) {
  const c = o.color ?? '#6f7680';
  const f = o.flip ? -1 : 1;
  const s = o.scale ?? 1;
  const line = lineOf(c);
  ctx.save();
  ctx.scale(f * s, s);
  ctx.fillStyle = 'rgba(20,15,30,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 7, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(-30, -26); ctx.rotate(-1.2 + Math.sin(t * 2) * 0.3);
  const tl = new Path2D(); capsule(tl, 0, 0, 5, 10, -34, 4); part(ctx, tl, c, null, line, 1.2, null);
  ctx.restore();
  const body = new Path2D(); ellipse(body, -4, -24, 32, 20); part(ctx, body, c, shade(c, -0.2), line, 1.4, { x: -3, y: -3 });
  for (const x of [-20, 14]) { const p = new Path2D(); capsule(p, x, -14, 6, x + 2, -3, 5.5); part(ctx, p, c, null, line, 1.1, null); }
  ctx.save(); ctx.translate(26, -46);
  const hd = new Path2D(); circle(hd, 0, 0, 19);
  hd.moveTo(-16, -8); hd.lineTo(-12, -28); hd.lineTo(-2, -16); hd.closePath();
  hd.moveTo(16, -8); hd.lineTo(12, -28); hd.lineTo(2, -16); hd.closePath();
  part(ctx, hd, c, shade(c, -0.2), line, 1.4, { x: -2, y: -2 });
  const blink = Math.sin(t * 0.7) > 0.97;
  ctx.fillStyle = '#9ad14a';
  for (const x of [-7, 7]) {
    if (blink) { ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x - 4, -2); ctx.lineTo(x + 4, -2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(x, -2, 4.5, 5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x, -2, 1.5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#9ad14a'; }
  }
  ctx.fillStyle = '#e0707e'; ctx.beginPath(); ctx.moveTo(-2.5, 5); ctx.lineTo(2.5, 5); ctx.lineTo(0, 8); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 0.8;
  ctx.beginPath(); for (const sgn of [-1, 1]) { ctx.moveTo(sgn * 6, 8); ctx.lineTo(sgn * 22, 5); ctx.moveTo(sgn * 6, 9); ctx.lineTo(sgn * 22, 11); } ctx.stroke();
  ctx.restore();
  ctx.restore();
}

export function propGlow(ctx: Ctx, x: number, y: number, r: number, col: string, a = 0.4) {
  ctx.fillStyle = rgrad(ctx, x, y, 0, r, [[0, rgba(col, a)], [1, rgba(col, 0)]]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export { mix };
