import { Scene, Director } from './scene';
import { SITUATIONS, Cast } from './situations';
import { sfx } from '../core/audio';

export class Stage {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  scene: Scene;
  w = 1280;
  h = 720;
  dpr = 1;
  private last = 0;
  private ro: ResizeObserver;
  busy = false;
  private skip = false;
  private token = 0;
  onSceneStart?: (id: string) => void;
  onSceneEnd?: (id: string) => void;
  paused = false;
  private dead = false;

  constructor(public host: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.scene = new Scene('sala');
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    requestAnimationFrame((t) => this.frame(t, false));
    // watchdog: se o rAF parar (aba em segundo plano), mantém a simulação avançando
    this.watchdog = window.setInterval(() => {
      if (this.dead) return clearInterval(this.watchdog);
      const now = performance.now();
      if (now - this.lastReal > 180) this.frame(now, true);
    }, 120);
  }
  private watchdog = 0;
  private lastReal = 0;

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(200, this.host.clientWidth);
    this.h = Math.max(150, this.host.clientHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    // redimensionar limpa o canvas: redesenha imediatamente
    try {
      this.scene?.draw(this.ctx, this.w, this.h, this.dpr);
    } catch {
      /* cena ainda não pronta */
    }
  }

  private frame(t: number, fromWatchdog: boolean) {
    const dt = Math.min(fromWatchdog ? 0.25 : 0.05, Math.max(0, (t - (this.last || t)) / 1000));
    this.last = t;
    if (!fromWatchdog) this.lastReal = performance.now();
    if (!this.paused && this.host.isConnected) {
      // passos fixos para estabilidade quando dt é grande
      let rest = dt;
      while (rest > 0.0001 && !this.paused) {
        const step = Math.min(0.05, rest);
        this.scene.update(step);
        rest -= step;
      }
      this.scene.draw(this.ctx, this.w, this.h, this.dpr);
    }
    if (!this.dead && !fromWatchdog) requestAnimationFrame((tt) => this.frame(tt, false));
  }

  setSkip(on: boolean) {
    this.skip = on;
    this.scene.timeScale = on ? 7 : 1;
  }

  /** Troca para uma nova cena e executa o roteiro da situação. */
  async play(id: string, cast: Cast): Promise<void> {
    const sit = SITUATIONS[id] ?? SITUATIONS.casa;
    const my = ++this.token;
    this.busy = true;
    // transição
    this.scene.fadeTarget = 1;
    sfx.whoosh();
    await new Promise((r) => setTimeout(r, this.skip ? 60 : 320));
    if (my !== this.token) return;
    const envId = typeof sit.env === 'function' ? sit.env(cast) : sit.env;
    const sc = new Scene(envId);
    sc.fadeA = 1;
    sc.fadeTarget = 0;
    sc.timeScale = this.skip ? 7 : 1;
    this.scene.alive = false;
    this.scene = sc;
    sfx.setMood(sc.env.mood ?? 'calm');
    this.onSceneStart?.(id);
    const d = new Director(sc);
    try {
      await sit.run(d, cast);
    } catch (e) {
      console.error('Erro na cena', id, e);
    }
    if (my === this.token) {
      this.busy = false;
      sc.timeScale = 1;
      this.onSceneEnd?.(id);
    }
  }

  /** Cena sem roteiro (ex.: editor). */
  setScene(sc: Scene) {
    this.token++;
    this.scene.alive = false;
    this.scene = sc;
    this.busy = false;
  }

  destroy() {
    this.dead = true;
    this.scene.alive = false;
    this.token++;
    this.ro.disconnect();
    this.canvas.remove();
  }
}
