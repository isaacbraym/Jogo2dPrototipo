import { Env, ENVS } from './environments';
import { X0, WW, GROUND, vignette } from '../render/bg';
import { Actor, EmoteKind } from '../character/actor';
import { Appearance } from '../character/appearance';
import { ExprName } from '../character/expressions';
import { Particles, PKind, SpawnOpts } from '../render/particles';
import { PROPS, PropOpts } from '../render/props';
import { Ctx } from '../render/draw';
import { damp, Ease, EaseFn, clamp, lerp } from '../core/math';
import { rgba } from '../core/color';
import { sfx } from '../core/audio';

export interface PlacedProp {
  id: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  opts: PropOpts;
  alpha: number;
  rot: number;
  front?: boolean;
  visible: boolean;
}

// cache global das camadas estáticas (LRU simples)
const layerCache = new Map<string, { canvas: HTMLCanvasElement; top: string; bottom: string }>();
function getLayerCanvas(env: Env, idx: number, res: number) {
  const key = env.id + ':' + idx + ':' + res.toFixed(2);
  let c = layerCache.get(key);
  if (c) {
    layerCache.delete(key);
    layerCache.set(key, c);
    return c;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(WW * res);
  canvas.height = Math.ceil(720 * res);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  ctx.translate(-X0, 0);
  try {
    env.layers[idx].static!(ctx);
  } catch (e) {
    console.error('Falha ao desenhar camada', env.id, idx, e);
  }
  let top = '#101018', bottom = '#101018';
  try {
    const d1 = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(60 * res), 1, 1).data;
    const d2 = ctx.getImageData(Math.floor(canvas.width / 2), canvas.height - 2, 1, 1).data;
    top = `rgb(${d1[0]},${d1[1]},${d1[2]})`;
    bottom = `rgb(${d2[0]},${d2[1]},${d2[2]})`;
  } catch {
    /* ignore */
  }
  c = { canvas, top, bottom };
  layerCache.set(key, c);
  while (layerCache.size > 14) layerCache.delete(layerCache.keys().next().value!);
  return c;
}

/** Escala base mundo→tela: preenche a altura, garantindo uma largura mínima visível. */
export function viewBaseScale(w: number, h: number, minViewW = 760) {
  return Math.min(h / 720, w / minViewW);
}

interface Timer { until: number; resolve: () => void }
interface Tween { t0: number; dur: number; fn: (k: number) => void; ease: EaseFn; resolve: () => void }

export interface Caption { title: string; sub?: string; t: number; dur: number; icon?: string }

export class Scene {
  env: Env;
  actors: Actor[] = [];
  props: PlacedProp[] = [];
  fx = new Particles();
  t = 0;
  cam = { x: 640, y: 360, zoom: 1, tx: 640, ty: 360, tz: 1, shake: 0, speed: 4 };
  flash = 0;
  flashCol = '#ffffff';
  fadeA = 0;
  fadeTarget = 0;
  caption: Caption | null = null;
  timeScale = 1;
  private timers: Timer[] = [];
  private tweens: Tween[] = [];
  view = { x0: 0, x1: 1280, scale: 1, w: 1280, h: 720, y0: 0 };

  /** Converte coordenadas de tela (px CSS) para o mundo. */
  screenToWorld(px: number, py: number) {
    return { x: this.view.x0 + px / this.view.scale, y: this.view.y0 + py / this.view.scale };
  }

  actorAt(px: number, py: number): Actor | null {
    const p = this.screenToWorld(px, py);
    let best: Actor | null = null;
    for (const a of this.actors) {
      if (!a.visible || a.alpha < 0.3) continue;
      const hw = Math.max(40, a.d.shoulderW * 0.75) * a.scale;
      if (Math.abs(p.x - a.x) < hw && p.y <= a.y - a.elev + 10 && p.y >= a.topWorld() - 10) {
        if (!best || a.z >= best.z) best = a;
      }
    }
    return best;
  }
  night = 0; // escurecimento extra
  minViewW = 760; // largura mínima de mundo visível (telas estreitas)
  alive = true; // falso quando a cena é substituída (encerra loops ambientes)
  meta?: Record<string, any>; // dados da situação acessíveis aos roteiros auxiliares
  padBottom = 0; // px ocupados por UI sobre a base da tela (a câmera sobe a cena)
  private padCur = 0;
  onBeat?: (dt: number) => void;

  constructor(envId: string) {
    this.env = ENVS[envId] ?? ENVS.sala;
  }

  // ------------------------------------------------ tempo
  wait(sec: number): Promise<void> {
    return new Promise((resolve) => this.timers.push({ until: this.t + sec, resolve }));
  }
  tween(dur: number, fn: (k: number) => void, ease: EaseFn = Ease.inOutQuad): Promise<void> {
    return new Promise((resolve) => this.tweens.push({ t0: this.t, dur: Math.max(0.001, dur), fn, ease, resolve }));
  }

  addActor(ap: Appearance, age: number, o: { x?: number; facing?: 1 | -1; name?: string; motion?: string; expr?: ExprName; turn?: number; y?: number; elev?: number; scale?: number; outfit?: Partial<Appearance>; z?: number } = {}): Actor {
    const a = new Actor(ap, age);
    a.x = o.x ?? 640;
    a.y = o.y ?? GROUND;
    a.elev = o.elev ?? 0;
    a.facing = o.facing ?? 1;
    a.name = o.name ?? '';
    a.turn = o.turn ?? 0.72;
    a.scale = o.scale ?? 1;
    a.outfit = o.outfit;
    a.z = o.z ?? 0;
    if (o.motion) a.play(o.motion, { fade: 0.01 });
    if (o.expr) a.setExpr(o.expr);
    a.onEvent = (name, act) => this.onActorEvent(name, act);
    this.actors.push(a);
    return a;
  }

  removeActor(a: Actor) {
    this.actors = this.actors.filter((x) => x !== a);
  }

  addProp(id: string, x: number, y = GROUND, o: { z?: number; scale?: number; opts?: PropOpts; front?: boolean; alpha?: number } = {}): PlacedProp {
    const p: PlacedProp = { id, x, y, z: o.z ?? -1, scale: o.scale ?? 1, opts: o.opts ?? {}, alpha: o.alpha ?? 1, rot: 0, front: o.front, visible: true };
    this.props.push(p);
    return p;
  }

  private onActorEvent(name: string, a: Actor) {
    const h = a.handWorld(true);
    switch (name) {
      case 'hit': {
        const tx = h.x + a.facing * 20;
        this.fx.burst(tx, h.y);
        sfx.hit();
        this.cam.shake = Math.max(this.cam.shake, 10);
        break;
      }
      case 'slap': {
        const hf = a.handWorld(false);
        this.fx.burst(hf.x + a.facing * 15, hf.y, '#ffb3b3');
        sfx.slap();
        this.cam.shake = Math.max(this.cam.shake, 6);
        break;
      }
      case 'push': this.fx.spawn('poeira', a.x + a.facing * 60, GROUND, 5, { speed: 90, size: 12, life: 0.6 }); sfx.whoosh(); break;
      case 'thud': this.fx.spawn('poeira', a.x, a.y, 9, { speed: 150, size: 16, life: 0.8, cone: Math.PI, dir: -Math.PI / 2 }); this.cam.shake = 8; sfx.thud(); break;
      case 'land': this.fx.spawn('poeira', a.x, a.y, 6, { speed: 110, size: 10, life: 0.5, cone: Math.PI, dir: -Math.PI / 2 }); sfx.step(); break;
      case 'jump': sfx.boing(); break;
      case 'clap': {
        const hf = a.handWorld(false);
        this.fx.spawn('estrela', hf.x, hf.y, 8, { speed: 260, size: 8, life: 0.6 });
        sfx.slap();
        break;
      }
      case 'bang': this.fx.burst(h.x + a.facing * 20, h.y + 20, '#f2c14e'); sfx.gavel(); this.cam.shake = 5; break;
      case 'throw': sfx.whoosh(); break;
      case 'blow': sfx.swoosh(); break;
      case 'give': sfx.pop(); break;
    }
  }

  focus(x: number, y = 360, zoom = 1) {
    this.cam.tx = x;
    this.cam.ty = y;
    this.cam.tz = zoom;
  }

  update(dt: number) {
    dt *= this.timeScale;
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.timers[i].until <= this.t) {
        const tm = this.timers[i];
        this.timers.splice(i, 1);
        tm.resolve();
      }
    }
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      const k = clamp((this.t - tw.t0) / tw.dur);
      tw.fn(tw.ease(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (const a of this.actors) a.update(dt);
    this.fx.update(dt);
    this.env.ambient?.(this.fx, dt, this.t, { x0: this.view.x0, x1: this.view.x1 });
    const c = this.cam;
    c.x = damp(c.x, c.tx, c.speed, dt);
    c.y = damp(c.y, c.ty, c.speed, dt);
    c.zoom = damp(c.zoom, c.tz, c.speed, dt);
    c.shake = Math.max(0, c.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.fadeA = damp(this.fadeA, this.fadeTarget, 5, dt);
    if (this.caption) {
      this.caption.t += dt;
      if (this.caption.t > this.caption.dur) this.caption = null;
    }
    this.onBeat?.(dt);
  }

  /** Renderiza a cena. `w`,`h` em pixels CSS; `dpr` densidade. */
  draw(ctx: Ctx, w: number, h: number, dpr: number) {
    const baseScale = viewBaseScale(w, h, this.minViewW);
    const c = this.cam;
    const scale = baseScale * c.zoom;
    const viewW = w / scale, viewH = h / scale;
    const sx = c.shake > 0 ? (Math.random() - 0.5) * c.shake : 0;
    const sy = c.shake > 0 ? (Math.random() - 0.5) * c.shake : 0;
    // limita câmera à área do mundo
    const halfW = viewW / 2;
    const camX = clamp(c.x, X0 + halfW, X0 + WW - halfW);
    this.padCur += (this.padBottom - this.padCur) * 0.12;
    const padW = this.padCur / scale; // em unidades de mundo
    const camY = (viewH >= 720 ? 720 - viewH / 2 : clamp(c.y, viewH / 2, 720 - viewH / 2)) + padW * 0.85;
    this.view = { x0: camX - halfW, x1: camX + halfW, scale, w, h, y0: camY - viewH / 2 };
    const res = Math.min(2, Math.max(1, dpr * baseScale * 1.15));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // preenchimento para áreas fora do mundo (telas muito altas)
    const firstStatic = this.env.layers.findIndex((l) => !!l.static);
    if (firstStatic >= 0) {
      const lc = getLayerCanvas(this.env, firstStatic, res);
      ctx.fillStyle = lc.top;
      ctx.fillRect(0, 0, w, h / 2);
      ctx.fillStyle = lc.bottom;
      ctx.fillRect(0, h / 2, w, h / 2);
    } else {
      ctx.fillStyle = '#101018';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.save();
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(scale, scale);
    ctx.translate(-camX, -camY);

    const drawLayer = (i: number) => {
      const L = this.env.layers[i];
      const px = (camX - 640) * (1 - L.depth);
      ctx.save();
      ctx.translate(px, 0);
      if (L.static) {
        const lc = getLayerCanvas(this.env, i, res);
        ctx.drawImage(lc.canvas, X0, 0, WW, 720);
      }
      L.anim?.(ctx, this.t);
      ctx.restore();
    };
    this.env.layers.forEach((L, i) => { if (!L.front) drawLayer(i); });

    // objetos e atores ordenados por profundidade
    type Item = { z: number; y: number; draw: () => void };
    const items: Item[] = [];
    for (const p of this.props) {
      if (!p.visible || p.front) continue;
      items.push({ z: p.z, y: p.y, draw: () => this.drawProp(ctx, p) });
    }
    for (const a of this.actors) items.push({ z: a.z, y: a.y, draw: () => a.draw(ctx, this.t) });
    items.sort((a, b) => a.z - b.z || a.y - b.y);
    for (const it of items) {
      const depth = (ctx as any).__depth;
      ctx.save();
      try {
        it.draw();
      } catch (e) {
        console.error(e);
      }
      ctx.restore();
      void depth;
    }
    this.fx.draw(ctx);
    for (const p of this.props) if (p.visible && p.front) this.drawProp(ctx, p);
    this.env.layers.forEach((L, i) => { if (L.front) drawLayer(i); });
    for (const a of this.actors) a.drawOverlay(ctx, this.t);
    ctx.restore();

    // pós-processamento em espaço de tela
    const tint = this.env.tint;
    if (tint) {
      ctx.fillStyle = rgba(tint.col, tint.a);
      ctx.fillRect(0, 0, w, h);
    }
    if (this.night > 0) {
      ctx.fillStyle = rgba('#0a0a2a', this.night);
      ctx.fillRect(0, 0, w, h);
    }
    vignette(ctx, w, h, this.env.vignette ?? 0.3);
    if (this.flash > 0) {
      ctx.fillStyle = rgba(this.flashCol, Math.min(1, this.flash));
      ctx.fillRect(0, 0, w, h);
    }
    if (this.fadeA > 0.002) {
      ctx.fillStyle = rgba('#07060f', this.fadeA);
      ctx.fillRect(0, 0, w, h);
    }
    if (this.caption) this.drawCaption(ctx, w, h);
  }

  private drawProp(ctx: Ctx, p: PlacedProp) {
    const fn = PROPS[p.id];
    if (!fn) return;
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    if (p.rot) ctx.rotate(p.rot);
    if (p.scale !== 1) ctx.scale(p.scale, p.scale);
    fn(ctx, this.t, p.opts);
    ctx.restore();
  }

  private drawCaption(ctx: Ctx, w: number, h: number) {
    const c = this.caption!;
    const k = c.t / c.dur;
    const inn = Ease.outBack(clamp(c.t / 0.45));
    const out = k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
    const a = Math.min(inn, out);
    ctx.save();
    ctx.globalAlpha = clamp(a);
    const y = lerp(-60, Math.min(90, h * 0.14), inn);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fs = Math.round(Math.min(44, w / 18));
    ctx.font = `900 ${fs}px Nunito, sans-serif`;
    const tw = ctx.measureText(c.title).width;
    const bw = tw + 80;
    ctx.fillStyle = 'rgba(15,10,35,0.55)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - bw / 2, y - fs * 0.85, bw, fs * 1.7 + (c.sub ? fs * 0.75 : 0), 22);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(20,10,40,0.6)';
    ctx.strokeText(c.title, w / 2, y);
    const g = ctx.createLinearGradient(0, y - fs / 2, 0, y + fs / 2);
    g.addColorStop(0, '#fff6d0');
    g.addColorStop(1, '#ffc46b');
    ctx.fillStyle = g;
    ctx.fillText(c.title, w / 2, y);
    if (c.sub) {
      ctx.font = `700 ${Math.round(fs * 0.46)}px Nunito, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(c.sub, w / 2, y + fs * 0.85);
    }
    ctx.restore();
  }
}

/** API de roteiro de cena (async/await). */
export class Director {
  skipping = false;
  constructor(public sc: Scene) {}

  get t() { return this.sc.t; }
  wait(s: number) { return this.sc.wait(s); }
  add(ap: Appearance, age: number, o: Parameters<Scene['addActor']>[2] = {}) { return this.sc.addActor(ap, age, o); }
  walk(a: Actor, x: number, run = false) { return a.walkTo(x, run); }
  async act(a: Actor, motion: string) { await a.play(motion); }
  loop(a: Actor, motion: string, fade = 0.25) { a.play(motion, { fade }); }
  async say(a: Actor, text: string, dur?: number, kind: 'fala' | 'pensa' | 'grito' = 'fala') {
    const d = dur ?? Math.min(4.2, 1.4 + text.length * 0.05);
    a.say(text, d, kind);
    if (kind !== 'pensa') {
      const n = Math.min(8, Math.round(text.length / 5));
      for (let i = 0; i < n; i++) setTimeout(() => sfx.talk(), i * 70);
    }
    await this.wait(d * 0.85);
  }
  expr(a: Actor, e: ExprName, hold?: number) { a.setExpr(e, hold); }
  emote(a: Actor, k: EmoteKind, dur = 1.8) {
    a.emoteOn(k, dur);
    if (k === 'coracao') sfx.heart();
    else if (k === 'exclamacao') sfx.pop();
  }
  look(a: Actor, target: Actor | { x: number; y: number } | null) { a.lookAt = target; }
  face(a: Actor, b: Actor) { a.facing = b.x > a.x ? 1 : -1; a.lookAt = b; }
  prop(id: string, x: number, y?: number, o: Parameters<Scene['addProp']>[3] = {}) { return this.sc.addProp(id, x, y, o); }
  moveProp(p: PlacedProp, x: number, y: number, dur: number, ease: EaseFn = Ease.inOutQuad) {
    const x0 = p.x, y0 = p.y;
    return this.sc.tween(dur, (k) => { p.x = lerp(x0, x, k); p.y = lerp(y0, y, k); }, ease);
  }
  fadeProp(p: PlacedProp, to: number, dur = 0.5) {
    const a0 = p.alpha;
    return this.sc.tween(dur, (k) => (p.alpha = lerp(a0, to, k)));
  }
  moveActor(a: Actor, x: number, y: number, dur: number, ease: EaseFn = Ease.inOutQuad) {
    const x0 = a.x, y0 = a.y;
    return this.sc.tween(dur, (k) => { a.x = lerp(x0, x, k); a.y = lerp(y0, y, k); }, ease);
  }
  fadeActor(a: Actor, to: number, dur = 0.6) {
    const a0 = a.alpha;
    return this.sc.tween(dur, (k) => (a.alpha = lerp(a0, to, k)));
  }
  fx(kind: PKind, x: number, y: number, n = 1, o: SpawnOpts = {}) { this.sc.fx.spawn(kind, x, y, n, o); }
  burst(x: number, y: number, col?: string) { this.sc.fx.burst(x, y, col); }
  confetti(n = 80) {
    const v = this.sc.view;
    this.sc.fx.spawn('confete', (v.x0 + v.x1) / 2, -20, n, { w: v.x1 - v.x0, speed: 60, dir: Math.PI / 2, cone: 1, life: 4, size: 11, ground: GROUND + 40 });
  }
  hearts(x: number, y: number, n = 6) { this.sc.fx.spawn('coracao', x, y, n, { w: 60, size: 12, life: 2.2 }); }
  shake(n = 10) { this.sc.cam.shake = n; }
  flash(col = '#ffffff', a = 0.9) { this.sc.flash = a; this.sc.flashCol = col; }
  focus(x: number, y = 360, zoom = 1, speed = 3) { this.sc.cam.speed = speed; this.sc.focus(x, y, zoom); }
  resetCam(speed = 3) { this.focus(640, 360, 1, speed); }
  caption(title: string, sub?: string, dur = 3.2) { this.sc.caption = { title, sub, t: 0, dur }; }
  fadeOut() { this.sc.fadeTarget = 1; return this.wait(0.6); }
  fadeIn() { this.sc.fadeTarget = 0; return this.wait(0.4); }
  sfx(name: keyof typeof sfx) {
    const f = (sfx as any)[name];
    if (typeof f === 'function') f.call(sfx);
  }
}
