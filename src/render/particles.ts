import { Ctx, heartPath, starPath } from './draw';
import { rng } from '../core/rng';
import { rgba } from '../core/color';

export type PKind =
  | 'confete' | 'coracao' | 'brilho' | 'lagrima' | 'suor' | 'poeira' | 'impacto' | 'moeda' | 'nota' | 'fumaca'
  | 'faisca' | 'chuva' | 'neve' | 'folha' | 'bolha' | 'musica' | 'zzz' | 'vagalume' | 'petala' | 'texto' | 'estrela' | 'raio' | 'arroz' | 'fogos';

export interface Particle {
  kind: PKind;
  x: number; y: number; vx: number; vy: number;
  ax: number; ay: number; drag: number;
  life: number; max: number;
  size: number; rot: number; vr: number;
  color: string; text?: string;
  phase: number;
  ground?: number;
}

const CONFETTI = ['#e4572e', '#f2c14e', '#3d7bd9', '#6fbf6a', '#e86a92', '#9b5de5', '#5ec3e8', '#fbfaf6'];

export interface SpawnOpts {
  color?: string;
  spread?: number;
  speed?: number;
  size?: number;
  life?: number;
  text?: string;
  dir?: number; // ângulo central (rad)
  cone?: number;
  w?: number; // largura da área de emissão
  h?: number;
  ground?: number;
}

export class Particles {
  list: Particle[] = [];

  spawn(kind: PKind, x: number, y: number, n = 1, o: SpawnOpts = {}) {
    for (let i = 0; i < n; i++) {
      const px = x + (o.w ? rng.range(-o.w / 2, o.w / 2) : 0);
      const py = y + (o.h ? rng.range(-o.h / 2, o.h / 2) : 0);
      const dir = o.dir ?? -Math.PI / 2;
      const cone = o.cone ?? Math.PI * 2;
      const a = dir + rng.range(-cone / 2, cone / 2);
      const sp = (o.speed ?? 200) * rng.range(0.5, 1.1);
      const p: Particle = {
        kind, x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ax: 0, ay: 0, drag: 0,
        life: 0, max: (o.life ?? 1.5) * rng.range(0.7, 1.2), size: (o.size ?? 8) * rng.range(0.7, 1.3),
        rot: rng.range(0, Math.PI * 2), vr: rng.range(-6, 6), color: o.color ?? rng.pick(CONFETTI), text: o.text, phase: rng.range(0, 10), ground: o.ground,
      };
      switch (kind) {
        case 'confete': case 'arroz': p.ay = 420; p.drag = 1.6; p.vr = rng.range(-12, 12); if (kind === 'arroz') { p.color = '#fbf8f0'; p.size *= 0.5; } break;
        case 'fogos': p.ay = 60; p.drag = 1.2; break;
        case 'coracao': p.vx *= 0.25; p.vy = -rng.range(50, 110); p.drag = 0.2; p.color = o.color ?? rng.pick(['#e8335a', '#f06a8a', '#ff8fab']); break;
        case 'brilho': case 'estrela': p.drag = 3; p.vr = rng.range(-3, 3); p.color = o.color ?? '#fff3b0'; break;
        case 'lagrima': p.ay = 700; p.color = '#8fd0ff'; break;
        case 'suor': p.ay = 500; p.color = '#aee0ff'; break;
        case 'poeira': p.drag = 3; p.vy *= 0.35; p.color = o.color ?? '#d9cfc0'; break;
        case 'impacto': p.drag = 0; p.vx = 0; p.vy = 0; p.max = 0.28; break;
        case 'moeda': p.ay = 900; p.color = '#f2c14e'; p.vr = rng.range(-10, 10); break;
        case 'nota': p.ay = 480; p.drag = 1.8; p.color = '#6fbf6a'; break;
        case 'fumaca': p.vx *= 0.2; p.vy = -rng.range(30, 70); p.drag = 0.3; p.color = o.color ?? '#9a9aa2'; break;
        case 'faisca': p.ay = 300; p.drag = 1; p.color = o.color ?? '#ffcf5a'; break;
        case 'chuva': p.vx = -60; p.vy = rng.range(900, 1100); p.color = 'rgba(180,210,255,0.55)'; break;
        case 'neve': p.vx = rng.range(-20, 20); p.vy = rng.range(40, 80); p.color = '#ffffff'; break;
        case 'folha': case 'petala': p.vx = rng.range(-40, 60); p.vy = rng.range(40, 90); p.color = kind === 'petala' ? rng.pick(['#f4b6c8', '#ffd1dc', '#fbf8f2']) : rng.pick(['#e4a23a', '#d0692e', '#c9d94f', '#6fbf6a']); break;
        case 'bolha': p.vx *= 0.2; p.vy = -rng.range(30, 80); p.color = 'rgba(200,235,255,0.8)'; break;
        case 'musica': p.vx = rng.range(-30, 30); p.vy = -rng.range(50, 90); p.color = o.color ?? rng.pick(['#3d7bd9', '#9b5de5', '#e86a92', '#2f8f6f']); p.text = rng.pick(['♪', '♫', '♬']); break;
        case 'zzz': p.vx = rng.range(15, 35); p.vy = -rng.range(25, 45); p.color = '#9fb4ff'; p.text = 'z'; break;
        case 'vagalume': p.vx = rng.range(-15, 15); p.vy = rng.range(-15, 15); p.color = '#f6ff9a'; break;
        case 'texto': p.vx = 0; p.vy = -60; p.drag = 0.8; break;
        case 'raio': p.vx = 0; p.vy = 0; p.max = 0.9; break;
      }
      this.list.push(p);
    }
  }

  burst(x: number, y: number, color = '#fff3b0') {
    this.spawn('impacto', x, y, 1, { color, size: 30 });
    this.spawn('estrela', x, y, 7, { speed: 380, size: 7, life: 0.5, color });
    this.spawn('poeira', x, y, 5, { speed: 120, size: 12, life: 0.6 });
  }

  update(dt: number) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life += dt;
      if (p.life >= p.max) {
        L[i] = L[L.length - 1];
        L.pop();
        continue;
      }
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        if (p.kind !== 'confete' && p.kind !== 'arroz' && p.kind !== 'nota') p.vy *= k;
        else p.vy = Math.min(p.vy * k + p.ay * dt * 0.2, 160);
      }
      if (p.kind === 'folha' || p.kind === 'petala' || p.kind === 'neve') p.vx += Math.sin(p.life * 3 + p.phase) * 60 * dt;
      if (p.kind === 'vagalume') {
        p.vx += Math.sin(p.life * 2 + p.phase) * 30 * dt;
        p.vy += Math.cos(p.life * 1.7 + p.phase) * 30 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.ground !== undefined && p.y > p.ground && (p.kind === 'moeda' || p.kind === 'lagrima' || p.kind === 'confete' || p.kind === 'nota')) {
        p.y = p.ground;
        if (p.kind === 'moeda' && Math.abs(p.vy) > 120) p.vy *= -0.4;
        else { p.vy = 0; p.vx *= 0.8; p.vr *= 0.8; }
      }
    }
    if (L.length > 1600) L.splice(0, L.length - 1600);
  }

  draw(ctx: Ctx) {
    for (const p of this.list) {
      const k = p.life / p.max;
      const fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'confete': {
          ctx.rotate(p.rot);
          ctx.scale(1, Math.sin(p.life * 8 + p.phase));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case 'arroz': {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.6, p.size * 0.3, 0, 0, 7); ctx.fill();
          break;
        }
        case 'coracao': {
          const s = p.size * (k < 0.15 ? k / 0.15 : 1);
          ctx.rotate(Math.sin(p.life * 4 + p.phase) * 0.3);
          ctx.fillStyle = p.color;
          ctx.beginPath(); heartPath(ctx, 0, 0, s); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath(); ctx.arc(-s * 0.35, -s * 0.35, s * 0.18, 0, 7); ctx.fill();
          break;
        }
        case 'brilho': case 'estrela': {
          const s = p.size * (1 - k) * (1 + Math.sin(p.life * 20) * 0.2);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath(); starPath(ctx, 0, 0, s, s * 0.3, 4); ctx.fill();
          break;
        }
        case 'lagrima': case 'suor': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.size * 0.6);
          ctx.quadraticCurveTo(p.size * 0.45, p.size * 0.2, 0, p.size * 0.4);
          ctx.quadraticCurveTo(-p.size * 0.45, p.size * 0.2, 0, -p.size * 0.6);
          ctx.fill();
          break;
        }
        case 'poeira': case 'fumaca': {
          const s = p.size * (0.6 + k * 1.6);
          ctx.globalAlpha = Math.max(0, (1 - k) * (p.kind === 'fumaca' ? 0.5 : 0.7));
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, s, 0, 7); ctx.fill();
          break;
        }
        case 'impacto': {
          const s = p.size * (0.5 + k * 1.2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 5 * (1 - k);
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
            ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
          }
          ctx.stroke();
          ctx.fillStyle = rgba('#ffffff', 0.8 * (1 - k));
          ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.fill();
          break;
        }
        case 'moeda': {
          ctx.scale(Math.cos(p.rot), 1);
          ctx.fillStyle = '#f2c14e';
          ctx.strokeStyle = '#a07a1a';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffe28a';
          ctx.fillRect(-p.size * 0.2, -p.size * 0.5, p.size * 0.4, p.size);
          break;
        }
        case 'nota': {
          ctx.rotate(p.rot * 0.3);
          ctx.scale(1, Math.sin(p.life * 6 + p.phase) * 0.5 + 0.7);
          ctx.fillStyle = '#6fbf6a';
          ctx.strokeStyle = '#2f6a2c';
          ctx.lineWidth = 1;
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.strokeRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.fillStyle = '#2f6a2c';
          ctx.beginPath(); ctx.arc(0, 0, p.size * 0.3, 0, 7); ctx.fill();
          break;
        }
        case 'faisca': case 'vagalume': {
          const glow = p.kind === 'vagalume' ? 0.5 + Math.sin(p.life * 5 + p.phase) * 0.5 : 1 - k;
          ctx.globalAlpha = Math.max(0, glow * fade);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(0, 0, p.size * 0.35, 0, 7); ctx.fill();
          break;
        }
        case 'chuva': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p.vx * 0.02, -p.vy * 0.025); ctx.stroke();
          break;
        }
        case 'neve': {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, p.size * 0.35, 0, 7); ctx.fill();
          break;
        }
        case 'folha': case 'petala': {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.7, p.size * 0.35, 0, 0, 7); ctx.fill();
          break;
        }
        case 'bolha': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, p.size * 0.6, 0, 7); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath(); ctx.arc(-p.size * 0.2, -p.size * 0.2, p.size * 0.15, 0, 7); ctx.fill();
          break;
        }
        case 'musica': case 'zzz': case 'texto': {
          ctx.font = `800 ${Math.round(p.size * (p.kind === 'zzz' ? 1 + k : 1.8))}px Nunito, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(20,20,40,0.55)';
          ctx.strokeText(p.text ?? '', 0, 0);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', 0, 0);
          break;
        }
        case 'fogos': {
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(0, 0, p.size * 0.3 * (1 - k * 0.5), 0, 7); ctx.fill();
          break;
        }
        case 'raio': {
          ctx.strokeStyle = '#fff6b0';
          ctx.lineWidth = 4 * (1 - k);
          ctx.shadowColor = '#fff6b0';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          let yy = 0;
          while (yy < p.size) { yy += 40; ctx.lineTo(Math.sin(yy * 13 + p.phase) * 30, yy); }
          ctx.stroke();
          break;
        }
      }
      ctx.restore();
    }
  }

  clear() {
    this.list.length = 0;
  }
}
