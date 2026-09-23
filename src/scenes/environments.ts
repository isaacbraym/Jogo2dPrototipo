import { Ctx, roundRect, part, circle, starPath } from '../render/draw';
import { PROPS, box } from '../render/props';
import {
  X0, WW, FLOOR, sky, sun, moon, clouds, hills, mountains, skyline, treeRow, pines, floor, wall, windowFrame, lightShaft, frameArt, clock, shelf, glow, lampPendant, cloud,
} from '../render/bg';
import { shade, rgba } from '../core/color';
import { RNG } from '../core/rng';
import type { Particles } from '../render/particles';

export interface Layer {
  depth: number; // 0 = infinito (sem parallax extra), 1 = plano dos personagens
  static?: (ctx: Ctx) => void;
  anim?: (ctx: Ctx, t: number) => void;
  front?: boolean;
}

export interface Env {
  id: string;
  name: string;
  layers: Layer[];
  ambient?: (p: Particles, dt: number, t: number, view: { x0: number; x1: number }) => void;
  tint?: { col: string; a: number };
  vignette?: number;
  mood?: 'calm' | 'happy' | 'sad' | 'tense';
}

const P = (id: string, ctx: Ctx, x: number, y: number, t = 0, o: Record<string, unknown> = {}, s = 1) => {
  ctx.save();
  ctx.translate(x, y);
  if (s !== 1) ctx.scale(s, s);
  PROPS[id](ctx, t, o);
  ctx.restore();
};

let acc = 0;
const every = (dt: number, rate: number) => {
  acc += dt * rate;
  const n = Math.floor(acc);
  acc -= n;
  return n;
};

function rain(p: Particles, dt: number, view: { x0: number; x1: number }, rate = 90) {
  const n = every(dt, rate);
  for (let i = 0; i < n; i++) p.spawn('chuva', view.x0 + Math.random() * (view.x1 - view.x0 + 200), -20, 1, { life: 0.8 });
}

// ======================================================================= interiores
const quartoBebe: Env = {
  id: 'quartoBebe', name: 'Quarto do bebê', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#bfe6d8', 'estrelas', '#ffffff');
      windowFrame(ctx, 860, 110, 230, 230, 'dia', 0, { curtains: '#f4b6c8' });
      lightShaft(ctx, 860, 340, 230, 0, '#fff6d0', 0.14);
      frameArt(ctx, 180, 140, 110, 90, 4, '#f4b6c8');
      frameArt(ctx, 320, 170, 70, 70, 7, '#5ec3e8');
      shelf(ctx, 1180, 260, 180, 3);
      floor(ctx, 'madeira', '#e3c49a');
      P('tapete', ctx, 640, 660, 0, { color: '#f4b6c8' });
      P('ursinho', ctx, 1240, 640, 0, {}, 1.6);
    },
    anim: (ctx, t) => {
      // móbile girando
      ctx.save();
      ctx.translate(200, 60);
      ctx.strokeStyle = '#8a8680'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(0, 0); ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = t * 0.8 + (i * Math.PI) / 2;
        const x = Math.cos(a) * 50;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, 40); ctx.stroke();
        ctx.fillStyle = ['#f2c14e', '#5ec3e8', '#e86a92', '#6fbf6a'][i];
        ctx.beginPath(); starPath(ctx, x, 50, 12 * (0.7 + 0.3 * Math.abs(Math.sin(a))), 5, 5); ctx.fill();
      }
      ctx.restore();
    },
  }],
};

const quarto: Env = {
  id: 'quarto', name: 'Quarto', mood: 'calm',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#8fa8d8', 'listras', '#a9bfe6');
      windowFrame(ctx, 780, 110, 220, 210, 'noite', 0, { curtains: '#3b4a6b' });
      frameArt(ctx, 1150, 120, 90, 120, 2, '#23242b');
      frameArt(ctx, 1270, 160, 70, 70, 5, '#e4572e');
      shelf(ctx, 1120, 300, 220, 8);
      floor(ctx, 'madeira', '#b98b5e');
      P('cama', ctx, 180, 640, 0, { color: '#3d7bd9' });
      P('luminaria', ctx, 420, 640, 0, { color: '#f2e6c8' });
      P('tapete', ctx, 700, 670, 0, { color: '#5b3c88' });
    },
    anim: (ctx, t) => { glow(ctx, 890, 215, 160, '#b9c4ff', 0.12 + Math.sin(t) * 0.02); },
  }],
  tint: { col: '#1a1840', a: 0.12 },
};

const sala: Env = {
  id: 'sala', name: 'Sala de estar', mood: 'calm',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#f0d9b5', 'painel', '#c99f77');
      windowFrame(ctx, 170, 100, 240, 220, 'dia', 0, { curtains: '#c2473d' });
      lightShaft(ctx, 170, 330, 240, 0, '#fff3c4', 0.13);
      frameArt(ctx, 560, 110, 130, 90, 1);
      frameArt(ctx, 720, 130, 70, 70, 3);
      clock(ctx, 1000, 130, 34, 0);
      shelf(ctx, 1170, 240, 200, 11);
      floor(ctx, 'madeira', '#a8764c');
      P('tapete', ctx, 700, 660, 0, { color: '#2f8f6f' });
      P('sofa', ctx, 700, 610, 0, { color: '#3d7bd9', color2: '#f2c14e' }, 0.95);
      P('planta', ctx, 1280, 640, 0, {}, 1.2);
      P('luminaria', ctx, 1060, 630, 0, {});
    },
  }],
};

const cozinha: Env = {
  id: 'cozinha', name: 'Cozinha', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#f7efe0', 'azulejo', '#ffffff');
      windowFrame(ctx, 560, 110, 200, 160, 'dia', 0, { curtains: '#f2c14e' });
      // armários superiores
      for (let i = 0; i < 3; i++) box(ctx, 120 + i * 130, 90, 120, 130, 6, '#5ec3e8');
      for (let i = 0; i < 2; i++) box(ctx, 860 + i * 130, 90, 120, 130, 6, '#5ec3e8');
      // bancada
      box(ctx, 80, 420, 1160, 150, 6, '#e6f4fa');
      box(ctx, 70, 405, 1180, 22, 4, '#dfe3e8');
      for (let i = 0; i < 8; i++) { ctx.fillStyle = '#8a8f98'; ctx.fillRect(130 + i * 140, 470, 40, 6); }
      floor(ctx, 'xadrez', '#e8e6e0');
      P('geladeira', ctx, 1330, 640, 0, {});
      P('fogao', ctx, 360, 572, 0, { state: 0 }, 1);
      P('planta', ctx, 1110, 405, 0, {}, 0.6);
    },
  }],
};

const maternidade: Env = {
  id: 'maternidade', name: 'Maternidade', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#d6ecf5', 'bolinhas', '#ffffff');
      windowFrame(ctx, 960, 110, 220, 200, 'amanhecer', 0, { curtains: '#f4b6c8' });
      lightShaft(ctx, 960, 320, 220, 0, '#ffe3d0', 0.16);
      // cruz vermelha / placa
      box(ctx, 240, 120, 140, 60, 8, '#ffffff');
      ctx.fillStyle = '#e8335a'; ctx.font = '800 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥ BEM-VINDO', 310, 158);
      floor(ctx, 'piso', '#e3eef2');
      P('leitoHospital', ctx, 360, 640, 0, { state: 0 });
      P('monitorCardiaco', ctx, 140, 640, 0, {});
      P('berco', ctx, 1230, 640, 0, {});
      P('baloes', ctx, 1370, 600, 0, {});
    },
  }],
};

const hospital: Env = {
  id: 'hospital', name: 'Hospital', mood: 'sad',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#bfe3e0', 'liso');
      ctx.fillStyle = '#9fd0cc'; ctx.fillRect(X0, 330, WW, 230);
      // cortina hospitalar
      ctx.fillStyle = '#a9cfe6';
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(1100 + i * 34, 330, 22, 260, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#8a8f98'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1060, 70); ctx.lineTo(1400, 70); ctx.stroke();
      windowFrame(ctx, 520, 100, 200, 170, 'nublado');
      box(ctx, 180, 110, 90, 90, 10, '#ffffff');
      ctx.fillStyle = '#e8335a'; ctx.fillRect(210, 125, 30, 60); ctx.fillRect(195, 140, 60, 30);
      floor(ctx, 'piso', '#dde6e8');
      P('leitoHospital', ctx, 360, 640, 0, { state: 1 });
      P('monitorCardiaco', ctx, 120, 640, 0, {});
    },
  }],
  tint: { col: '#bfe3e0', a: 0.06 },
};

const escola: Env = {
  id: 'escola', name: 'Sala de aula', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#f6df9e', 'liso');
      ctx.fillStyle = '#e9cc84'; ctx.fillRect(X0, 380, WW, 180);
      P('quadroNegro', ctx, 640, 470, 0, {});
      windowFrame(ctx, 60, 110, 170, 200, 'dia');
      windowFrame(ctx, 1080, 110, 170, 200, 'dia');
      lightShaft(ctx, 1080, 320, 170, 0, '#fff6d0', 0.12);
      clock(ctx, 950, 90, 30, 0);
      // mapa
      box(ctx, 1300, 150, 150, 100, 4, '#9fd3ee');
      ctx.fillStyle = '#6fbf6a'; ctx.beginPath(); ctx.ellipse(1350, 190, 30, 20, 0.3, 0, 7); ctx.ellipse(1410, 215, 22, 16, -0.4, 0, 7); ctx.fill();
      floor(ctx, 'piso', '#d8cbb2');
      for (const x of [140, 1140]) P('carteira', ctx, x, 650, 0, {}, 1.2);
    },
  }],
};

const biblioteca: Env = {
  id: 'biblioteca', name: 'Biblioteca', mood: 'calm',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#7a5236', 'madeira');
      for (let i = 0; i < 6; i++) P('estante', ctx, -120 + i * 170 + (i > 2 ? 520 : 0), 580, 0, {}, 1.2);
      windowFrame(ctx, 530, 60, 220, 300, 'tarde', 0, { frame: '#5a3a24' });
      lightShaft(ctx, 530, 370, 220, 0, '#ffcf8a', 0.18);
      floor(ctx, 'carpete', '#8e2c48');
      lampPendant(ctx, 400, 180, '#2f8f6f');
      lampPendant(ctx, 900, 180, '#2f8f6f');
    },
  }],
  tint: { col: '#ffb060', a: 0.06 },
};

const escritorio: Env = {
  id: 'escritorio', name: 'Escritório', mood: 'calm',
  layers: [{
    depth: 0.25,
    static: (ctx) => {
      sky(ctx, 'dia', 520);
      skyline(ctx, 520, '#9fb6d0', 3, 0, '#fff', 1.2);
      skyline(ctx, 520, '#7f98b8', 9, 0, '#fff', 0.8);
    },
  }, {
    depth: 1,
    static: (ctx) => {
      // parede de vidro
      ctx.fillStyle = '#e9eef3';
      ctx.fillRect(X0, 0, WW, 60);
      ctx.fillRect(X0, 470, WW, 100);
      for (let x = X0; x < X0 + WW; x += 260) { box(ctx, x, 40, 22, 450, 2, '#c9ced6', { top: false }); }
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let x = X0; x < X0 + WW; x += 260) { ctx.beginPath(); ctx.moveTo(x + 40, 470); ctx.lineTo(x + 140, 60); ctx.lineTo(x + 180, 60); ctx.lineTo(x + 80, 470); ctx.fill(); }
      box(ctx, X0, 470, WW, 16, 0, '#b9c0c9', { top: false });
      floor(ctx, 'carpete', '#5a6470');
      P('escrivaninha', ctx, 170, 630, 0, { color: '#e8e6e0' });
      P('escrivaninha', ctx, 1130, 630, 0, { color: '#e8e6e0' });
      P('planta', ctx, 1340, 640, 0, {}, 1.3);
      // bebedouro
      box(ctx, 380, 480, 50, 150, 6, '#e8e6e0');
      ctx.fillStyle = 'rgba(94,195,232,0.7)'; ctx.beginPath(); ctx.roundRect(385, 400, 40, 80, 14); ctx.fill();
    },
  }],
};

const academia: Env = {
  id: 'academia', name: 'Academia', mood: 'tense',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#5a6470', 'concreto');
      ctx.fillStyle = '#e4572e'; ctx.fillRect(X0, 300, WW, 26);
      // espelhos
      for (let i = 0; i < 3; i++) {
        const x = 300 + i * 260;
        const g = ctx.createLinearGradient(x, 80, x + 230, 290);
        g.addColorStop(0, '#dcecf5'); g.addColorStop(1, '#9fb6c8');
        ctx.fillStyle = g; ctx.fillRect(x, 80, 230, 200);
        ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 6; ctx.strokeRect(x, 80, 230, 200);
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(x + 30, 280); ctx.lineTo(x + 110, 80); ctx.lineTo(x + 140, 80); ctx.lineTo(x + 60, 280); ctx.fill();
      }
      ctx.fillStyle = '#fbfaf6'; ctx.font = '900 44px Nunito, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('NO PAIN NO GAIN', 1250, 220);
      floor(ctx, 'borracha', '#2b2d36');
      P('rackPesos', ctx, 120, 640, 0, {}, 1.2);
    },
    anim: (ctx, t) => { P('esteira', ctx, 1220, 640, t, {}); },
  }],
};

const restaurante: Env = {
  id: 'restaurante', name: 'Restaurante', mood: 'calm',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#6d2334', 'losangos', '#8e3a4a');
      windowFrame(ctx, 900, 90, 300, 250, 'noite', 0, { city: true, frame: '#3b2616', curtains: '#c99a2a' });
      frameArt(ctx, 200, 130, 140, 100, 9, '#c99a2a');
      floor(ctx, 'madeira', '#5a3a24');
      P('planta', ctx, 90, 640, 0, {}, 1.3);
      P('planta', ctx, 1340, 640, 0, {}, 1.3);
    },
    anim: (ctx, t) => {
      lampPendant(ctx, 460, 150, '#c99a2a');
      lampPendant(ctx, 820, 150, '#c99a2a');
      glow(ctx, 640, 520, 300, '#ffb060', 0.12 + Math.sin(t * 3) * 0.01);
    },
  }],
  tint: { col: '#3a1020', a: 0.12 },
  vignette: 0.5,
};

const balada: Env = {
  id: 'balada', name: 'Balada', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#1a1330', 'tijolos');
      floor(ctx, 'palco', '#1b1530');
      P('balcaoBar', ctx, 1500, 630, 0, {});
    },
    anim: (ctx, t) => {
      // pista de dança
      const vx = 640, vy = -500;
      const proj = (x: number, y: number) => vx + (x - vx) * ((y - vy) / (FLOOR - vy));
      let yy = FLOOR + 10, row = 0;
      while (yy < 720) {
        const h = 16 + row * 7;
        for (let k = 0; k < 10; k++) {
          const x = 240 + k * 80;
          const hue = (k * 40 + row * 70 + t * 120) % 360;
          const on = Math.sin(t * 5 + k * 1.3 + row * 2) > 0.2;
          ctx.fillStyle = on ? `hsla(${hue},90%,60%,0.55)` : 'rgba(40,30,70,0.5)';
          ctx.beginPath(); ctx.moveTo(proj(x, yy), yy); ctx.lineTo(proj(x + 76, yy), yy); ctx.lineTo(proj(x + 76, yy + h - 3), yy + h - 3); ctx.lineTo(proj(x, yy + h - 3), yy + h - 3); ctx.fill();
        }
        yy += h; row++;
      }
      // feixes de luz
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cols = ['255,60,160', '60,200,255', '180,90,255', '255,220,80'];
      for (let i = 0; i < 4; i++) {
        const a = Math.sin(t * 0.9 + i * 1.7) * 0.6;
        const x = 200 + i * 300;
        ctx.save(); ctx.translate(x, 0); ctx.rotate(a);
        const g = ctx.createLinearGradient(0, 0, 0, 700);
        g.addColorStop(0, `rgba(${cols[i]},0.35)`); g.addColorStop(1, `rgba(${cols[i]},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(120, 720); ctx.lineTo(-120, 720); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.translate(640, 90); PROPS.globoDisco(ctx, t, {}); ctx.restore();
      P('caixaSom', ctx, 80, 630, t, {}, 1.3);
      P('caixaSom', ctx, 1220, 630, t, {}, 1.3);
    },
  }],
  tint: { col: '#200a40', a: 0.18 },
  vignette: 0.6,
};

const tribunal: Env = {
  id: 'tribunal', name: 'Tribunal', mood: 'tense',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#8a5a3a', 'painel', '#6d4b2e');
      for (const x of [80, 1240]) { box(ctx, x, 30, 60, 530, 4, '#e8dcc6'); box(ctx, x - 10, 30, 80, 24, 4, '#d8c8aa'); }
      // bandeiras
      for (const [x, c] of [[260, '#2f8f6f'], [1060, '#1f3f7a']] as const) {
        box(ctx, x, 150, 6, 420, 2, '#c99a2a');
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + 6, 160); ctx.quadraticCurveTo(x + 50, 180, x + 90, 160); ctx.lineTo(x + 90, 270); ctx.quadraticCurveTo(x + 50, 290, x + 6, 270); ctx.fill();
        ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(x + 48, 215, 16, 0, 7); ctx.fill();
      }
      floor(ctx, 'madeira', '#6d4b2e');
    },
  }],
  tint: { col: '#3a2010', a: 0.08 },
};

const prisao: Env = {
  id: 'prisao', name: 'Prisão', mood: 'sad',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#7d8590', 'concreto');
      // janelinha
      box(ctx, 580, 90, 120, 80, 4, '#5a6068');
      ctx.fillStyle = '#9fd3ee'; ctx.fillRect(590, 100, 100, 60);
      ctx.fillStyle = '#3b3f46'; for (let i = 0; i < 5; i++) ctx.fillRect(598 + i * 20, 100, 6, 60);
      lightShaft(ctx, 590, 170, 100, 0, '#e8f4ff', 0.12);
      // beliche
      box(ctx, 100, 360, 300, 30, 4, '#8a8f98'); box(ctx, 110, 330, 280, 34, 10, '#c9c2a8');
      box(ctx, 100, 540, 300, 30, 4, '#8a8f98'); box(ctx, 110, 510, 280, 34, 10, '#c9c2a8');
      box(ctx, 96, 320, 12, 320, 3, '#5a6068'); box(ctx, 392, 320, 12, 320, 3, '#5a6068');
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.font = '20px "Patrick Hand", cursive';
      ctx.fillText('|||| |||| |||| ||', 1050, 240);
      floor(ctx, 'concreto', '#6a707a');
      // vaso
      box(ctx, 1200, 560, 70, 70, 20, '#dfe3e8');
    },
  }, {
    depth: 1.15,
    front: true,
    static: (ctx) => {
      ctx.save(); ctx.translate(640, 720); PROPS.grades(ctx, 0, { scale: 2200 }); ctx.restore();
    },
  }],
  tint: { col: '#203040', a: 0.14 },
  vignette: 0.55,
};

const cassino: Env = {
  id: 'cassino', name: 'Cassino', mood: 'tense',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#5a1020', 'losangos', '#c99a2a');
      ctx.fillStyle = '#c99a2a'; ctx.fillRect(X0, 90, WW, 8);
      for (let i = 0; i < 5; i++) P('caçaNiquel', ctx, -40 + i * 130 + (i > 1 ? 780 : 0), 560, 0, { state: 0 }, 0.9);
      floor(ctx, 'carpete', '#7a1a2a');
      const r = new RNG(3);
      for (let i = 0; i < 60; i++) { ctx.fillStyle = rgba('#c99a2a', 0.25); ctx.beginPath(); starPath(ctx, X0 + r.next() * WW, FLOOR + 20 + r.next() * 150, 6, 2.5, 4); ctx.fill(); }
    },
    anim: (ctx, t) => {
      for (const x of [300, 980]) {
        // lustre
        ctx.strokeStyle = '#c99a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 60); ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const a = (i / 6) * Math.PI;
          const lx = x + Math.cos(a) * 60, ly = 70 + Math.sin(a) * 20;
          ctx.fillStyle = Math.sin(t * 6 + i) > 0 ? '#fff6d0' : '#ffe3a0';
          ctx.beginPath(); ctx.arc(lx, ly, 5, 0, 7); ctx.fill();
        }
        glow(ctx, x, 80, 200, '#ffd98e', 0.25);
      }
    },
  }],
  tint: { col: '#3a0a10', a: 0.1 },
  vignette: 0.55,
};

const aeroporto: Env = {
  id: 'aeroporto', name: 'Aeroporto', mood: 'calm',
  layers: [{
    depth: 0.3,
    static: (ctx) => {
      sky(ctx, 'dia', 480);
      ctx.fillStyle = '#9aa7b4'; ctx.fillRect(X0, 420, WW, 60);
      P('aviao', ctx, 900, 420, 0, {}, 1.1);
    },
    anim: (ctx, t) => { clouds(ctx, t, 9, 5, 60, 200, '#ffffff', 0.8, 6); },
  }, {
    depth: 1,
    static: (ctx) => {
      ctx.fillStyle = '#e9eef3'; ctx.fillRect(X0, 0, WW, 50); ctx.fillRect(X0, 480, WW, 90);
      for (let x = X0; x < X0 + WW; x += 300) box(ctx, x, 40, 18, 450, 2, '#c9ced6', { top: false });
      // painel de voos
      box(ctx, 120, 90, 300, 150, 6, '#1b1c22');
      ctx.font = '700 16px monospace'; ctx.textAlign = 'left';
      const voos = [['PARIS', 'EMBARQUE', '#3cf07a'], ['TÓQUIO', 'ATRASADO', '#f2c14e'], ['NOVA YORK', 'NO HORÁRIO', '#5ec3e8'], ['LISBOA', 'EMBARQUE', '#3cf07a']];
      voos.forEach(([c, s, col], i) => { ctx.fillStyle = '#f2c14e'; ctx.fillText(c, 136, 124 + i * 30); ctx.fillStyle = col; ctx.fillText(s, 290, 124 + i * 30); });
      floor(ctx, 'piso', '#cfd6dd');
      for (let i = 0; i < 4; i++) { box(ctx, 900 + i * 110, 560, 90, 20, 6, '#3d7bd9'); box(ctx, 905 + i * 110, 500, 80, 64, 10, '#3d7bd9'); box(ctx, 940 + i * 110, 580, 10, 50, 2, '#8a8f98'); }
      P('mala', ctx, 1360, 640, 0, { color: '#e4572e' });
    },
  }],
};

// ======================================================================= exteriores
const parque: Env = {
  id: 'parque', name: 'Parque', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'dia'); sun(ctx, 1150, 110, 40); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 1, 7, 50, 240) },
    { depth: 0.3, static: (ctx) => { hills(ctx, 430, 40, '#8fd18a', 2); hills(ctx, 470, 30, '#6fbf6a', 5); treeRow(ctx, 480, '#3fa56a', 4, 14, 0.8); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'grama', '#6fbf6a', 520);
        // caminho
        ctx.fillStyle = '#e8d5b0';
        ctx.beginPath(); ctx.moveTo(X0, 600); ctx.quadraticCurveTo(640, 560, X0 + WW, 610); ctx.lineTo(X0 + WW, 690); ctx.quadraticCurveTo(640, 650, X0, 690); ctx.fill();
        P('arvore', ctx, 60, 600, 0, {}, 1.2);
        P('arvore', ctx, 1330, 610, 0, { color: '#58b368' }, 1.1);
        P('banco', ctx, 1050, 600, 0, {});
        P('poste', ctx, 250, 600, 0, { state: 0 });
        P('arbusto', ctx, 450, 560, 0, { variant: 1 });
        P('arbusto', ctx, 880, 555, 0, {});
      },
      anim: (ctx, t) => {
        // pássaros
        for (let i = 0; i < 3; i++) {
          const x = X0 + ((t * 60 + i * 400) % (WW + 200)), y = 150 + i * 30 + Math.sin(t * 2 + i) * 10;
          ctx.strokeStyle = '#3b3d44'; ctx.lineWidth = 2;
          const f = Math.sin(t * 10 + i) * 6;
          ctx.beginPath(); ctx.moveTo(x - 10, y - f); ctx.quadraticCurveTo(x - 5, y - 4, x, y); ctx.quadraticCurveTo(x + 5, y - 4, x + 10, y - f); ctx.stroke();
        }
      },
    },
  ],
  ambient: (p, dt, _t, v) => { if (every(dt, 0.8)) p.spawn('folha', v.x0 + Math.random() * (v.x1 - v.x0), -10, 1, { size: 9, life: 9 }); },
};

const patio: Env = {
  id: 'patio', name: 'Pátio da escola', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'dia'); sun(ctx, 200, 100, 36); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 3, 6, 40, 200) },
    {
      depth: 0.5,
      static: (ctx) => {
        // prédio da escola
        box(ctx, 380, 170, 560, 330, 4, '#e8a87c');
        const roof = new Path2D(); roof.moveTo(360, 176); roof.lineTo(660, 80); roof.lineTo(960, 176); roof.closePath();
        part(ctx, roof, '#c2473d', shade('#c2473d', -0.2), '#6a1a12', 1.5, null);
        for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
          const x = 420 + i * 130, y = 210 + k * 110;
          box(ctx, x, y, 80, 70, 3, '#fbfaf6'); ctx.fillStyle = '#9fd3ee'; ctx.fillRect(x + 6, y + 6, 68, 58);
        }
        box(ctx, 620, 400, 80, 100, 4, '#7a5236');
        ctx.fillStyle = '#fbfaf6'; ctx.font = '900 26px Nunito'; ctx.textAlign = 'center'; ctx.fillText('ESCOLA', 660, 150);
        treeRow(ctx, 500, '#3fa56a', 11, 10, 0.7);
      },
    },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'areia', '#e8d5b0', 500);
        // cerca
        for (let x = X0; x < X0 + WW; x += 30) box(ctx, x, 440, 12, 90, 3, '#fbfaf6', { top: false, lw: 0.8 });
        box(ctx, X0, 460, WW, 8, 2, '#fbfaf6', { top: false });
        P('balanco', ctx, 150, 630, 0, {});
        P('arvore', ctx, 1300, 620, 0, {}, 1.1);
      },
      anim: (ctx, t) => { P('balanco', ctx, 150, 630, t, {}); },
    },
  ],
};

const praia: Env = {
  id: 'praia', name: 'Praia', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'tarde', 460); sun(ctx, 640, 380, 55, '#fff1c8', '#ff8a5e'); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 5, 5, 60, 220, '#ffc9a8', 0.7, 5) },
    {
      depth: 0.35,
      anim: (ctx, t) => {
        const g = ctx.createLinearGradient(0, 400, 0, 540);
        g.addColorStop(0, '#6a5ca8'); g.addColorStop(0.5, '#3f7fc0'); g.addColorStop(1, '#5ec3e8');
        ctx.fillStyle = g; ctx.fillRect(X0, 400, WW, 150);
        // reflexo do sol
        ctx.fillStyle = 'rgba(255,220,160,0.5)';
        for (let i = 0; i < 9; i++) { const w = 120 - i * 10 + Math.sin(t * 2 + i) * 10; ctx.fillRect(640 - w / 2, 408 + i * 12, w, 3); }
        // ondas
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        for (let r = 0; r < 4; r++) {
          ctx.beginPath();
          for (let x = X0; x < X0 + WW; x += 12) ctx.lineTo(x, 440 + r * 26 + Math.sin(x * 0.02 + t * 1.5 + r) * 4);
          ctx.stroke();
        }
      },
    },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'areia', '#f3d9a4', 540);
        // coqueiro
        ctx.save(); ctx.translate(120, 640);
        ctx.strokeStyle = '#8a5a3a'; ctx.lineWidth = 22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(40, -200, 100, -400); ctx.stroke();
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.5;
          ctx.save(); ctx.translate(100, -400); ctx.rotate(a);
          ctx.fillStyle = i % 2 ? '#2f8f6f' : '#3fa56a';
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(80, -40, 170, 20); ctx.quadraticCurveTo(80, -5, 0, 0); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        // guarda-sol
        ctx.save(); ctx.translate(1250, 650);
        box(ctx, -3, -230, 6, 230, 2, '#fbfaf6');
        const u = new Path2D(); u.moveTo(-140, -200); u.quadraticCurveTo(0, -300, 140, -200); u.closePath();
        part(ctx, u, '#e4572e', '#b8401e', '#5a1a0a', 1.5, null);
        ctx.save(); ctx.clip(u); ctx.fillStyle = '#fbfaf6'; for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(0, -270); ctx.lineTo(i * 40, -190); ctx.lineTo((i + 1) * 40, -190); ctx.fill(); } ctx.restore();
        box(ctx, -110, -24, 180, 16, 6, '#5ec3e8');
        ctx.restore();
      },
    },
  ],
  tint: { col: '#ff9a5e', a: 0.08 },
};

const ruaNoite: Env = {
  id: 'ruaNoite', name: 'Rua à noite', mood: 'tense',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'noite'); moon(ctx, 1100, 90, 30); } },
    { depth: 0.3, static: (ctx) => { skyline(ctx, 520, '#1d2046', 12, 0.35); } },
    {
      depth: 0.6,
      static: (ctx) => {
        // fachadas
        const cols = ['#3b2d4f', '#2d3b58', '#4a2d3b', '#2d4a48'];
        for (let i = 0; i < 9; i++) {
          const x = X0 + i * 250, h = 300 + (i % 3) * 60;
          box(ctx, x, 540 - h, 240, h, 2, cols[i % 4], { top: false });
          for (let wy = 540 - h + 30; wy < 440; wy += 70) for (let wx = x + 30; wx < x + 210; wx += 70) {
            const on = (wx * 7 + wy * 3) % 5 > 1;
            box(ctx, wx, wy, 40, 45, 2, on ? '#ffd98e' : '#1b1c2e', { top: false, lw: 0.8 });
          }
          // toldo / loja
          ctx.fillStyle = ['#c2273d', '#2f8f6f', '#3d7bd9'][i % 3];
          ctx.fillRect(x + 20, 450, 200, 18);
          ctx.fillStyle = 'rgba(255,217,142,0.6)'; ctx.fillRect(x + 40, 470, 160, 70);
        }
      },
      anim: (ctx, t) => {
        ctx.save();
        ctx.font = '900 34px Nunito, sans-serif';
        ctx.fillStyle = Math.sin(t * 3) > -0.6 ? '#ff5ec4' : '#5a2a4a';
        ctx.shadowColor = '#ff5ec4'; ctx.shadowBlur = 20;
        ctx.fillText('BAR 24H', 280, 420);
        ctx.restore();
      },
    },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'calcada', '#4a4f5c', 540);
        ctx.fillStyle = '#2b2d36'; ctx.fillRect(X0, 670, WW, 60);
        ctx.fillStyle = '#f2c14e'; for (let x = X0; x < X0 + WW; x += 120) ctx.fillRect(x, 690, 60, 6);
        P('poste', ctx, 150, 640, 0, { state: 1 });
        P('poste', ctx, 1150, 640, 0, { state: 1 });
        P('hidrante', ctx, 960, 640, 0, {});
      },
    },
  ],
  tint: { col: '#10143a', a: 0.22 },
  vignette: 0.55,
};

const ruaChuva: Env = {
  ...ruaNoite,
  id: 'ruaChuva', name: 'Rua sob chuva', mood: 'sad',
  ambient: (p, dt, _t, v) => rain(p, dt, v, 110),
  tint: { col: '#1a2440', a: 0.3 },
};

const ruaDia: Env = {
  id: 'ruaDia', name: 'Centro da cidade', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'dia'); sun(ctx, 300, 90, 36); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 8, 6, 30, 180) },
    { depth: 0.3, static: (ctx) => skyline(ctx, 500, '#a9bcd4', 21, 0) },
    {
      depth: 0.6,
      static: (ctx) => {
        const cols = ['#f2c14e', '#e8a87c', '#9fd3ee', '#f4b6c8', '#bfe6d8'];
        for (let i = 0; i < 9; i++) {
          const x = X0 + i * 250, h = 280 + (i % 3) * 50;
          box(ctx, x, 540 - h, 240, h, 2, cols[i % 5], { top: false });
          for (let wy = 540 - h + 30; wy < 420; wy += 70) for (let wx = x + 30; wx < x + 210; wx += 70) box(ctx, wx, wy, 40, 45, 2, '#dff2fb', { top: false, lw: 0.8 });
          ctx.fillStyle = ['#c2273d', '#2f8f6f', '#3d7bd9', '#9b5de5'][i % 4];
          ctx.beginPath(); ctx.moveTo(x + 10, 440); ctx.lineTo(x + 230, 440); ctx.lineTo(x + 220, 470); ctx.lineTo(x + 20, 470); ctx.fill();
          ctx.fillStyle = '#fbfaf6'; for (let k = 0; k < 6; k++) ctx.fillRect(x + 20 + k * 36, 440, 18, 30);
          ctx.fillStyle = 'rgba(159,211,238,0.7)'; ctx.fillRect(x + 30, 476, 180, 64);
        }
      },
    },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'calcada', '#c9c2b8', 540);
        ctx.fillStyle = '#5a5f6a'; ctx.fillRect(X0, 675, WW, 60);
        ctx.fillStyle = '#fbfaf6'; for (let x = X0; x < X0 + WW; x += 120) ctx.fillRect(x, 695, 60, 5);
        P('arvore', ctx, 180, 640, 0, {}, 0.9);
        P('arvore', ctx, 1200, 640, 0, {}, 0.95);
        P('cone', ctx, 900, 650, 0, {});
      },
    },
  ],
};

const casamento: Env = {
  id: 'casamento', name: 'Jardim do casamento', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'amanhecer'); sun(ctx, 640, 200, 40, '#fff6e0', '#ffc9a8'); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 11, 6, 40, 200, '#fff0f4', 0.8, 5) },
    { depth: 0.3, static: (ctx) => { hills(ctx, 460, 30, '#a8dca0', 7); treeRow(ctx, 480, '#6fbf6a', 13, 12, 0.7); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'grama', '#8fd18a', 510);
        // tapete do altar
        ctx.fillStyle = '#fbf8f2';
        ctx.beginPath(); ctx.moveTo(560, 520); ctx.lineTo(720, 520); ctx.lineTo(820, 720); ctx.lineTo(460, 720); ctx.fill();
        for (const s of [-1, 1]) for (let r = 0; r < 3; r++) {
          const x = 640 + s * (260 + r * 110);
          P('cadeira', ctx, x, 600 + r * 10, 0, { color: '#fbfaf6', flip: s > 0 }, 0.75);
        }
        P('arco', ctx, 640, 600, 0, {}, 1.05);
      },
      anim: (ctx, t) => {
        ctx.save(); ctx.translate(640, 40); PROPS.bandeirinhas(ctx, t, { scale: 1400 }); ctx.restore();
      },
    },
  ],
  ambient: (p, dt, _t, v) => { if (every(dt, 1.5)) p.spawn('petala', v.x0 + Math.random() * (v.x1 - v.x0), -10, 1, { size: 9, life: 10 }); },
};

const acampamento: Env = {
  id: 'acampamento', name: 'Acampamento', mood: 'calm',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'noite'); moon(ctx, 300, 110, 34); } },
    { depth: 0.2, static: (ctx) => { mountains(ctx, 470, 260, '#262c5a', 3, true); } },
    { depth: 0.45, static: (ctx) => { pines(ctx, 520, '#18223a', 5, 16, 0.9); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'terra', '#3a3a2a', 520);
        P('barraca', ctx, 1120, 620, 0, { color: '#f39237' });
        box(ctx, 150, 600, 150, 30, 14, '#7a5236');
      },
      anim: (ctx, t) => { P('fogueira', ctx, 640, 640, t, {}); },
    },
  ],
  ambient: (p, dt, _t, v) => {
    if (every(dt, 1.2)) p.spawn('vagalume', v.x0 + Math.random() * (v.x1 - v.x0), 300 + Math.random() * 300, 1, { size: 8, life: 6 });
    if (Math.random() < dt * 6) p.spawn('faisca', 640 + Math.random() * 20 - 10, 600, 1, { speed: 60, dir: -Math.PI / 2, cone: 0.6, life: 1.5, size: 6 });
  },
  tint: { col: '#0a1030', a: 0.2 },
  vignette: 0.6,
};

const cemiterio: Env = {
  id: 'cemiterio', name: 'Cemitério', mood: 'sad',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'nublado'); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 13, 9, 20, 250, '#8d96a2', 0.9, 4) },
    { depth: 0.35, static: (ctx) => { hills(ctx, 470, 20, '#6d7a70', 3); for (let i = 0; i < 12; i++) P('lapide', ctx, X0 + 80 + i * 180, 500, 0, {}, 0.45); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'grama', '#5f7d5a', 520);
        // cerca de ferro
        for (let x = X0; x < X0 + WW; x += 26) { ctx.fillStyle = '#23242b'; ctx.fillRect(x, 420, 5, 110); ctx.beginPath(); ctx.moveTo(x - 3, 420); ctx.lineTo(x + 2.5, 408); ctx.lineTo(x + 8, 420); ctx.fill(); }
        ctx.fillRect(X0, 440, WW, 5); ctx.fillRect(X0, 500, WW, 5);
        // árvore seca
        ctx.strokeStyle = '#3b3230'; ctx.lineCap = 'round';
        const branch = (x: number, y: number, a: number, l: number, w: number) => {
          if (l < 12) return;
          const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l;
          ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
          branch(x2, y2, a - 0.45, l * 0.72, w * 0.65);
          branch(x2, y2, a + 0.4, l * 0.68, w * 0.65);
        };
        branch(1250, 640, 0.05, 130, 18);
        P('lapide', ctx, 240, 620, 0, {}, 0.9);
        P('lapide', ctx, 1050, 610, 0, {}, 0.8);
      },
    },
  ],
  ambient: (p, dt, _t, v) => rain(p, dt, v, 25),
  tint: { col: '#4a5260', a: 0.18 },
  vignette: 0.55,
};

const palco: Env = {
  id: 'palco', name: 'Show', mood: 'happy',
  layers: [
    {
      depth: 1,
      static: (ctx) => {
        ctx.fillStyle = '#0e0b1e'; ctx.fillRect(X0, 0, WW, 720);
        // treliça
        ctx.strokeStyle = '#3b3d44'; ctx.lineWidth = 4;
        ctx.strokeRect(X0 + 300, 40, WW - 600, 30);
        for (let x = X0 + 300; x < X0 + WW - 300; x += 30) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x + 30, 70); ctx.stroke(); }
        // telão
        box(ctx, 340, 90, 600, 260, 8, '#1b1c22');
        ctx.save(); ctx.translate(640, 632); PROPS.palco(ctx, 0, {}); ctx.restore();
        floor(ctx, 'palco', '#2b2336', 572);
      },
      anim: (ctx, t) => {
        const g = ctx.createLinearGradient(346, 96, 934, 344);
        const h = (t * 30) % 360;
        g.addColorStop(0, `hsl(${h},80%,55%)`); g.addColorStop(1, `hsl(${(h + 90) % 360},80%,45%)`);
        ctx.fillStyle = g; ctx.fillRect(346, 96, 588, 248);
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '900 60px Nunito'; ctx.textAlign = 'center'; ctx.fillText('♪ AO VIVO ♪', 640, 240);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const x = 100 + i * 270, a = Math.sin(t * 1.2 + i) * 0.4;
          ctx.save(); ctx.translate(x, 50); ctx.rotate(a);
          const lg = ctx.createLinearGradient(0, 0, 0, 650);
          lg.addColorStop(0, 'rgba(255,240,200,0.3)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(110, 650); ctx.lineTo(-110, 650); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        P('caixaSom', ctx, 100, 632, t, {}, 1.5);
        P('caixaSom', ctx, 1180, 632, t, {}, 1.5);
      },
    },
    {
      depth: 1.2,
      front: true,
      anim: (ctx, t) => {
        // plateia em silhueta
        for (let i = 0; i < 26; i++) {
          const x = X0 + 40 + i * 82, bob = Math.abs(Math.sin(t * 4 + i * 0.7)) * 14;
          ctx.fillStyle = i % 2 ? '#07050f' : '#0e0a1c';
          ctx.beginPath(); ctx.arc(x, 690 - bob, 30, 0, 7); ctx.fill();
          ctx.fillRect(x - 40, 710 - bob, 80, 60);
          if (i % 4 === 0) { ctx.save(); ctx.translate(x + 30, 660 - bob); ctx.rotate(-0.3 + Math.sin(t * 4 + i) * 0.3); ctx.fillRect(-6, -70, 12, 70); ctx.restore(); }
          if (i % 7 === 3) { ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.fillRect(x - 12, 620 - bob, 8, 12); }
        }
      },
    },
  ],
  vignette: 0.4,
};

const zen: Env = {
  id: 'zen', name: 'Jardim zen', mood: 'calm',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'amanhecer'); sun(ctx, 950, 250, 50, '#fff6e0', '#ffb08a'); } },
    { depth: 0.2, static: (ctx) => { mountains(ctx, 470, 220, '#9a8ab8', 8); mountains(ctx, 490, 160, '#7f6fa0', 12); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'areia', '#e8dcc6', 520);
        ctx.strokeStyle = 'rgba(150,130,100,0.35)'; ctx.lineWidth = 2;
        for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(640, 640, 120 + k * 45, 26 + k * 10, 0, 0, 7); ctx.stroke(); }
        // bambus
        for (let i = 0; i < 9; i++) {
          const x = X0 + 120 + i * 50 + (i > 4 ? 1300 : 0);
          box(ctx, x, 60, 16, 480, 6, '#6fbf6a', { top: false });
          for (let y = 100; y < 520; y += 70) { ctx.fillStyle = '#3fa56a'; ctx.fillRect(x - 2, y, 20, 4); }
        }
        // pedras
        for (const [x, y, r] of [[380, 600, 40], [930, 610, 55], [1000, 640, 25]] as const) {
          const p = new Path2D(); p.ellipse(x, y, r * 1.3, r * 0.8, 0, 0, 7);
          part(ctx, p, '#9aa0a8', '#6d737b', '#3b3f46', 1.4, { x: -4, y: -4 });
        }
        // lanterna de pedra
        box(ctx, 190, 480, 40, 120, 4, '#b9b5ad'); box(ctx, 160, 460, 100, 20, 6, '#9a968e'); box(ctx, 175, 420, 70, 44, 4, '#b9b5ad');
        ctx.fillStyle = '#ffd98e'; ctx.fillRect(195, 430, 30, 24);
      },
    },
  ],
  ambient: (p, dt, _t, v) => { if (every(dt, 0.7)) p.spawn('petala', v.x0 + Math.random() * (v.x1 - v.x0), -10, 1, { size: 8, life: 11 }); },
  tint: { col: '#ffc0a0', a: 0.06 },
};

const ceu: Env = {
  id: 'ceu', name: 'Além', mood: 'calm',
  layers: [
    {
      depth: 0,
      static: (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, 720);
        g.addColorStop(0, '#fff6e0'); g.addColorStop(0.5, '#ffe7c2'); g.addColorStop(1, '#f4d0e8');
        ctx.fillStyle = g; ctx.fillRect(X0, 0, WW, 720);
      },
      anim: (ctx, t) => {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) {
          const a = -0.7 + i * 0.17 + Math.sin(t * 0.3 + i) * 0.02;
          ctx.save(); ctx.translate(640, -100); ctx.rotate(a);
          const lg = ctx.createLinearGradient(0, 0, 0, 900);
          lg.addColorStop(0, 'rgba(255,250,220,0.35)'); lg.addColorStop(1, 'rgba(255,250,220,0)');
          ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(70, 900); ctx.lineTo(-70, 900); ctx.fill();
          ctx.restore();
        }
        ctx.restore();
      },
    },
    { depth: 0.3, anim: (ctx, t) => clouds(ctx, t, 17, 10, 100, 450, '#ffffff', 0.85, 10) },
    {
      depth: 1,
      static: (ctx) => {
        // portão dourado
        ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(500, 560); ctx.lineTo(500, 260); ctx.arc(640, 260, 140, Math.PI, 0); ctx.lineTo(780, 560); ctx.stroke();
        ctx.lineWidth = 3;
        for (let x = 520; x < 770; x += 22) { ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x, 200 + Math.abs(x - 640) * 0.5); ctx.stroke(); }
        for (let i = 0; i < 16; i++) cloud(ctx, X0 + i * 140, 600 + (i % 3) * 20, 1.6, '#ffffff', 1);
      },
    },
  ],
  ambient: (p, dt, _t, v) => { if (every(dt, 2)) p.spawn('brilho', v.x0 + Math.random() * (v.x1 - v.x0), 100 + Math.random() * 400, 1, { size: 10, life: 2, speed: 10 }); },
};

const suburbio: Env = {
  id: 'suburbio', name: 'Casa nova', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'dia'); sun(ctx, 1200, 110, 40); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 21, 6, 40, 200) },
    { depth: 0.3, static: (ctx) => { hills(ctx, 440, 25, '#9ad49a', 9); treeRow(ctx, 470, '#58b368', 23, 14, 0.6); } },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'grama', '#7cc97a', 520);
        P('casaFachada', ctx, 640, 560, 0, { color: '#f2c14e' }, 0.95);
        ctx.fillStyle = '#d8d0c0';
        ctx.beginPath(); ctx.moveTo(605, 560); ctx.lineTo(675, 560); ctx.lineTo(740, 720); ctx.lineTo(540, 720); ctx.fill();
        for (let x = X0; x < X0 + WW; x += 34) if (x < 300 || x > 980) box(ctx, x, 540, 14, 70, 4, '#fbfaf6', { top: false, lw: 0.8 });
        box(ctx, X0, 560, 720, 8, 2, '#fbfaf6', { top: false });
        box(ctx, 980, 560, 800, 8, 2, '#fbfaf6', { top: false });
        P('arvore', ctx, 90, 620, 0, {}, 1.05);
        P('arbusto', ctx, 380, 580, 0, { variant: 1 });
        P('arbusto', ctx, 900, 580, 0, { variant: 1 });
      },
    },
  ],
};

const cinema: Env = {
  id: 'cinema', name: 'Cinema', mood: 'calm',
  layers: [
    {
      depth: 1,
      static: (ctx) => {
        ctx.fillStyle = '#140d1c'; ctx.fillRect(X0, 0, WW, 720);
        for (const s of [-1, 1]) { ctx.fillStyle = '#6d1a2a'; ctx.fillRect(640 + s * 520 - (s < 0 ? 120 : 0), 30, 120, 520); }
        floor(ctx, 'carpete', '#3a1020', 560);
      },
      anim: (ctx, t) => {
        const g = ctx.createLinearGradient(260, 60, 1020, 400);
        const k = (Math.sin(t * 0.7) + 1) / 2;
        g.addColorStop(0, `rgb(${120 + k * 100},${140},${200 - k * 60})`); g.addColorStop(1, `rgb(${60},${80 + k * 60},${120})`);
        ctx.fillStyle = g; ctx.fillRect(260, 60, 760, 380);
        glow(ctx, 640, 250, 700, '#9fc6ff', 0.12 + k * 0.05);
      },
    },
    {
      depth: 1.2,
      front: true,
      static: (ctx) => {
        for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) {
          const x = X0 + i * 140 + r * 70, y = 670 + r * 50;
          box(ctx, x, y - 60, 120, 110, 30, '#8e2c48');
        }
      },
    },
  ],
  tint: { col: '#100820', a: 0.25 },
  vignette: 0.65,
};

const universidade: Env = {
  id: 'universidade', name: 'Universidade', mood: 'happy',
  layers: [
    { depth: 0, static: (ctx) => { sky(ctx, 'dia'); } },
    { depth: 0.1, anim: (ctx, t) => clouds(ctx, t, 31, 6, 40, 180) },
    {
      depth: 0.5,
      static: (ctx) => {
        box(ctx, 240, 180, 800, 330, 4, '#e8dcc6');
        const roof = new Path2D(); roof.moveTo(220, 186); roof.lineTo(640, 70); roof.lineTo(1060, 186); roof.closePath();
        part(ctx, roof, '#d8c8aa', '#b8a888', '#5a4a2a', 1.6, null);
        for (let i = 0; i < 8; i++) { box(ctx, 290 + i * 98, 210, 34, 300, 6, '#fbf8f2'); }
        ctx.fillStyle = '#5a4a2a'; ctx.font = '900 30px serif'; ctx.textAlign = 'center'; ctx.fillText('UNIVERSITAS', 640, 165);
        treeRow(ctx, 520, '#3fa56a', 41, 8, 0.8);
      },
    },
    {
      depth: 1,
      static: (ctx) => {
        floor(ctx, 'grama', '#7cc97a', 520);
        ctx.fillStyle = '#e8dcc6'; ctx.beginPath(); ctx.moveTo(560, 520); ctx.lineTo(720, 520); ctx.lineTo(900, 720); ctx.lineTo(380, 720); ctx.fill();
        P('banco', ctx, 200, 620, 0, {});
        P('arvore', ctx, 1300, 630, 0, {}, 1.1);
      },
    },
  ],
};

const concessionaria: Env = {
  id: 'concessionaria', name: 'Concessionária', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      wall(ctx, '#e9eef3', 'liso');
      for (let x = X0; x < X0 + WW; x += 320) { box(ctx, x, 40, 16, 520, 2, '#c9ced6', { top: false }); }
      ctx.fillStyle = '#3d7bd9'; ctx.font = '900 46px Nunito'; ctx.textAlign = 'center'; ctx.fillText('AUTO VIVA', 640, 110);
      floor(ctx, 'piso', '#f4f4f0');
      glow(ctx, 640, 600, 400, '#ffffff', 0.25);
    },
  }],
};

const estudio: Env = {
  id: 'estudio', name: 'Estúdio', mood: 'happy',
  layers: [{
    depth: 1,
    static: (ctx) => {
      const g = ctx.createRadialGradient(640, 300, 40, 640, 360, 900);
      g.addColorStop(0, '#6a4fc8'); g.addColorStop(0.45, '#35276f'); g.addColorStop(1, '#140e33');
      ctx.fillStyle = g; ctx.fillRect(X0, 0, WW, 720);
      // bokeh
      const r = new RNG(12);
      for (let i = 0; i < 40; i++) {
        const x = X0 + r.next() * WW, y = r.next() * 520, rr = r.range(10, 50);
        ctx.fillStyle = rgba(r.pick(['#ff7a59', '#ffb547', '#7c5cff', '#5ec3e8', '#ff5c8a']), r.range(0.05, 0.14));
        ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
      }
      // chão
      const fg = ctx.createLinearGradient(0, 560, 0, 720);
      fg.addColorStop(0, '#241a55'); fg.addColorStop(1, '#120c30');
      ctx.fillStyle = fg; ctx.fillRect(X0, 560, WW, 170);
      ctx.strokeStyle = 'rgba(160,140,255,0.12)'; ctx.lineWidth = 1.5;
      for (let x = X0 - 1400; x < X0 + WW + 1400; x += 80) { ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(640 + (x - 640) * 1.9, 730); ctx.stroke(); }
      for (let y = 575; y < 720; y += 22 + (y - 560) * 0.15) { ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X0 + WW, y); ctx.stroke(); }
      // plataforma
      const pg = ctx.createRadialGradient(640, 632, 10, 640, 632, 220);
      pg.addColorStop(0, 'rgba(255,200,140,0.55)'); pg.addColorStop(0.6, 'rgba(255,150,120,0.18)'); pg.addColorStop(1, 'rgba(255,150,120,0)');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(640, 632, 260, 60, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,160,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(640, 634, 170, 34, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,210,160,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(640, 634, 210, 44, 0, 0, 7); ctx.stroke();
    },
    anim: (ctx, t) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createLinearGradient(0, 0, 0, 640);
      lg.addColorStop(0, 'rgba(255,240,220,0.22)'); lg.addColorStop(1, 'rgba(255,240,220,0)');
      ctx.fillStyle = lg;
      const sway = Math.sin(t * 0.6) * 20;
      ctx.beginPath(); ctx.moveTo(600 + sway, 0); ctx.lineTo(680 + sway, 0); ctx.lineTo(860, 640); ctx.lineTo(420, 640); ctx.fill();
      ctx.restore();
    },
  }],
  ambient: (p, dt, _t, v) => { if (every(dt, 1.5)) p.spawn('brilho', v.x0 + Math.random() * (v.x1 - v.x0), 120 + Math.random() * 400, 1, { size: 7, life: 2, speed: 8, color: '#ffe3b0' }); },
  vignette: 0.45,
};

const delegacia: Env = {
  ...ruaNoite,
  id: 'delegacia', name: 'Abordagem policial', mood: 'tense',
  ambient: undefined,
};

export const ENVS: Record<string, Env> = {
  quartoBebe, quarto, sala, cozinha, maternidade, hospital, escola, biblioteca, escritorio, academia, restaurante, balada, tribunal, prisao, cassino,
  aeroporto, parque, patio, praia, ruaNoite, ruaChuva, ruaDia, casamento, acampamento, cemiterio, palco, zen, ceu, suburbio, cinema, universidade,
  concessionaria, delegacia, estudio,
};

export { X0, WW, FLOOR, roundRect, circle };
