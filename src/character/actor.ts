import { Appearance } from './appearance';
import { computeDims, Dims, Pose, blendPose, copyPose, solveIK } from './rig';
import { EXPRESSIONS, ExprName, Face, blendFace, NEUTRAL } from './expressions';
import { MOTIONS, groundDrop, Motion } from './motions';
import { drawCharacter, CharFrame, legLength, skeleton } from './character';
import { Ctx, roundRect, heartPath, starPath } from '../render/draw';
import { clamp, damp, Ease, lerp } from '../core/math';
import { rng } from '../core/rng';
import { armPoints } from './body';
import './calibracao'; // aplica src/data/calibracao.json sobre MOTIONS/EXPRESSIONS (uma vez)

export type EmoteKind = 'coracao' | 'raiva' | 'exclamacao' | 'interrogacao' | 'reticencias' | 'zzz' | 'musica' | 'suor' | 'ideia' | 'estrela' | 'dinheiro' | 'caveira' | 'coracaoPartido' | 'lagrima';

interface Bubble { text: string; t: number; dur: number; kind: 'fala' | 'pensa' | 'grito' }
interface Emote { kind: EmoteKind; t: number; dur: number }

let ACTOR_ID = 0;
/** Reinicia a numeração de atores (o id alimenta semente de movimento/olhar; usado pelo painel de QA para replays idênticos). */
export function resetActorIds(start = 0) {
  ACTOR_ID = start;
}

export class Actor {
  id = ++ACTOR_ID;
  ap: Appearance;
  age: number;
  d: Dims;
  name = '';
  x = 0;
  y = 600; // chão (mundo)
  elev = 0; // altura adicional (cama, cadeira no palco...)
  facing: 1 | -1 = 1;
  turn = 0.72;
  scale = 1;
  alpha = 1;
  visible = true;
  z = 0;
  outfit?: Partial<Appearance>;
  propN?: string;
  propF?: string;

  // animação
  motionName = 'parado';
  baseMotion = 'parado';
  motionT = 0;
  private motion: Motion = MOTIONS.parado;
  private fromPose: Pose | null = null;
  private fade = 1;
  private fadeDur = 0.25;
  pose: Pose;
  onEvent?: (name: string, a: Actor) => void;
  private actionDone?: () => void;

  // rosto
  exprName: ExprName = 'neutro';
  private exprTarget: Face = EXPRESSIONS.neutro;
  private exprOverride: { name: ExprName; until: number } | null = null;
  face: Face = { ...NEUTRAL };
  private blink = 0;
  private nextBlink = rng.range(1, 4);
  private blinkPhase = -1;
  lookAt: Actor | { x: number; y: number } | null = null;
  lookX = 0;
  lookY = 0;
  talkUntil = 0;
  private time = 0;

  // locomoção
  walkTarget: number | null = null;
  speed = 150;
  private walkResolve?: () => void;
  run = false;

  // física do cabelo
  sway = 0;
  private swayV = 0;
  private lastHeadX = 0;

  // IK opcional para os braços (alvo no mundo)
  reachN: { x: number; y: number } | null = null;
  reachF: { x: number; y: number } | null = null;

  bubble: Bubble | null = null;
  emote: Emote | null = null;
  frame: CharFrame | null = null;
  shake = 0;

  constructor(ap: Appearance, age: number) {
    this.ap = ap;
    this.age = age;
    this.d = computeDims(ap, age);
    this.pose = MOTIONS.parado.fn(0, { speed: 0, seed: 0 });
  }

  setAppearance(ap: Appearance, age = this.age) {
    this.ap = ap;
    this.age = age;
    this.d = computeDims(ap, age);
  }

  setAge(age: number) {
    this.age = age;
    this.d = computeDims(this.ap, age);
  }

  /** Troca de movimento com crossfade. */
  play(name: string, opts: { fade?: number; base?: boolean } = {}): Promise<void> {
    const m = MOTIONS[name];
    if (!m) return Promise.resolve();
    this.fromPose = copyPose(this.pose);
    this.fade = 0;
    this.fadeDur = opts.fade ?? 0.22;
    this.motion = m;
    this.motionName = name;
    this.motionT = 0;
    if (m.loop && opts.base !== false) this.baseMotion = name;
    if (this.actionDone) {
      this.actionDone();
      this.actionDone = undefined;
    }
    if (!m.loop) {
      return new Promise((res) => (this.actionDone = res));
    }
    return Promise.resolve();
  }

  setExpr(name: ExprName, hold?: number) {
    if (hold) this.exprOverride = { name, until: this.time + hold };
    else {
      this.exprName = name;
      this.exprOverride = null;
    }
  }

  say(text: string, dur = 2.4, kind: Bubble['kind'] = 'fala') {
    this.bubble = { text, t: 0, dur, kind };
    if (kind !== 'pensa') this.talkUntil = this.time + Math.min(dur - 0.3, 0.25 + text.length * 0.045);
  }

  emoteOn(kind: EmoteKind, dur = 1.8) {
    this.emote = { kind, t: 0, dur };
  }

  walkTo(x: number, run = false): Promise<void> {
    this.walkTarget = x;
    this.run = run;
    if (this.walkResolve) this.walkResolve();
    return new Promise((res) => (this.walkResolve = res));
  }

  headWorld(): { x: number; y: number } {
    if (!this.frame) return { x: this.x, y: this.y - this.d.total * this.scale };
    return { x: this.x + this.frame.head.x * this.facing * this.scale, y: this.y - this.elev + this.frame.head.y * this.scale };
  }

  handWorld(near = true): { x: number; y: number } {
    const h = near ? this.frame?.handN : this.frame?.handF;
    if (!h) return this.headWorld();
    return { x: this.x + h.x * this.facing * this.scale, y: this.y - this.elev + h.y * this.scale };
  }

  topWorld(): number {
    if (!this.frame) return this.y - this.d.total * this.scale;
    return this.y - this.elev + this.frame.top * this.scale;
  }

  update(dt: number) {
    this.time += dt;
    // locomoção
    if (this.walkTarget !== null) {
      const dx = this.walkTarget - this.x;
      const sp = (this.run ? this.speed * 2.1 : this.speed) * this.scale;
      if (Math.abs(dx) < 3) {
        this.x = this.walkTarget;
        this.walkTarget = null;
        if (this.motionName === 'andar' || this.motionName === 'correr') this.play(this.baseMotion === 'andar' || this.baseMotion === 'correr' ? 'parado' : this.baseMotion, { fade: 0.3 });
        const r = this.walkResolve;
        this.walkResolve = undefined;
        r?.();
      } else {
        this.facing = dx > 0 ? 1 : -1;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
        const want = this.run ? 'correr' : 'andar';
        if (this.motionName !== want) {
          const base = this.baseMotion;
          this.play(want, { fade: 0.18 });
          this.baseMotion = base === 'andar' || base === 'correr' ? 'parado' : base;
        }
      }
    }
    // pose
    this.motionT += dt;
    const m = this.motion;
    let t = this.motionT;
    if (!m.loop && m.dur && t >= m.dur) {
      // terminou a ação
      if (m.events) for (const e of m.events) if (e.t > t - dt && e.t <= t) this.onEvent?.(e.name, this);
      const done = this.actionDone;
      this.actionDone = undefined;
      this.play(this.baseMotion, { fade: 0.25 });
      done?.();
      t = this.motionT;
    } else if (m.events) {
      for (const e of m.events) if (e.t > t - dt && e.t <= t) this.onEvent?.(e.name, this);
    }
    let target = this.motion.fn(this.motionT, { speed: this.speed * (this.run ? 2.1 : 1), seed: this.id });
    if (this.motion.grounded !== false && target.rot === 0) {
      target = { ...target, y: target.y + groundDrop(target, this.d.thigh, this.d.shin, this.d.hipW) };
    }
    if (this.fromPose && this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt / this.fadeDur);
      this.pose = blendPose(this.fromPose, target, Ease.inOutQuad(this.fade));
    } else this.pose = target;
    this.applyIK();
    // expressão
    let en: ExprName = this.exprOverride && this.exprOverride.until > this.time ? this.exprOverride.name : this.exprName;
    if (en === 'neutro' && this.motion.expr) en = this.motion.expr;
    if (this.exprOverride && this.exprOverride.until <= this.time) this.exprOverride = null;
    this.exprTarget = EXPRESSIONS[en];
    this.face = blendFace(this.face, this.exprTarget, 1 - Math.exp(-dt * 12), this.face);
    // marcadores discretos seguem o alvo imediatamente (a interpolação por quadro nunca passa de 0.5)
    const tg = this.exprTarget;
    this.face.happyEyes = tg.happyEyes;
    this.face.tears = tg.tears;
    this.face.sweat = tg.sweat;
    this.face.heartEyes = tg.heartEyes;
    this.face.anger = tg.anger;
    this.face.dizzy = tg.dizzy;
    this.face.sparkle = tg.sparkle;
    // piscar
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkPhase < 0) {
      this.blinkPhase = 0;
      this.nextBlink = rng.range(2, 5.5);
    }
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.16;
      this.blink = this.blinkPhase < 0.5 ? this.blinkPhase * 2 : Math.max(0, 2 - this.blinkPhase * 2);
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1;
        this.blink = 0;
      }
    }
    // olhar
    let lx = Math.sin(this.time * 0.37 + this.id) * 0.25, ly = Math.sin(this.time * 0.29 + this.id * 2) * 0.12;
    if (this.lookAt) {
      const tgt = this.lookAt instanceof Actor ? this.lookAt.headWorld() : this.lookAt;
      const h = this.headWorld();
      lx = clamp(((tgt.x - h.x) * this.facing) / 250, -1, 1);
      ly = clamp((tgt.y - h.y) / 250, -1, 1);
    }
    this.lookX = damp(this.lookX, lx, 8, dt);
    this.lookY = damp(this.lookY, ly, 8, dt);
    // cabelo (mola)
    const hx = this.headWorld().x;
    const vel = (hx - this.lastHeadX) / Math.max(dt, 0.001);
    this.lastHeadX = hx;
    const targetSway = clamp(-vel * this.facing * 0.0012, -0.35, 0.35) - this.pose.lean * 0.3;
    this.swayV += ((targetSway - this.sway) * 60 - this.swayV * 7) * dt;
    this.sway += this.swayV * dt;
    // balões
    if (this.bubble) {
      this.bubble.t += dt;
      if (this.bubble.t > this.bubble.dur) this.bubble = null;
    }
    if (this.emote) {
      this.emote.t += dt;
      if (this.emote.t > this.emote.dur) this.emote = null;
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
  }

  private applyIK() {
    for (const near of [true, false]) {
      const tgt = near ? this.reachN : this.reachF;
      if (!tgt) continue;
      // converte o alvo para o quadro da pelve
      const legLen = legLength(this.d);
      const lx = ((tgt.x - this.x) * this.facing) / this.scale - this.pose.x;
      const ly = (tgt.y - (this.y - this.elev)) / this.scale + legLen - this.pose.y;
      const sk = skeleton(this.d, this.pose, this.turn);
      const sh = near ? sk.shoulderN : sk.shoulderF;
      const sol = solveIK(sh.x, sh.y, lx, ly, this.d.upperArm, this.d.foreArm, 1);
      // compensa o “splay” aplicado em armPoints
      const probe = armPoints({ d: this.d, turn: this.turn } as any, { x: 0, y: 0 }, { a: 0, b: 0 }, near);
      const splay = probe.a;
      const limb = { a: sol.a - splay, b: sol.b };
      if (near) this.pose.armN = limb;
      else this.pose.armF = limb;
    }
  }

  draw(ctx: Ctx, t: number) {
    if (!this.visible || this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    const sh = this.shake > 0 ? Math.sin(t * 60) * this.shake * 6 : 0;
    ctx.translate(this.x + sh, this.y - this.elev);
    ctx.scale(this.facing * this.scale, this.scale);
    this.frame = drawCharacter(ctx, this.ap, this.d, this.pose, this.face, {
      turn: this.turn,
      lookX: this.lookX,
      lookY: this.lookY,
      blink: this.blink,
      talk: this.time < this.talkUntil ? Math.abs(Math.sin(this.time * 18)) * 0.6 : 0,
      sway: this.sway,
      light: -this.facing,
      t,
      propN: this.propN ?? this.motion.propN,
      propF: this.propF ?? this.motion.propF,
      outfit: this.outfit,
      seedKey: this.ap.skin + this.ap.hairColor + this.id,
      shadow: this.elev < 5 && Math.abs(this.pose.rot) < 0.4,
    });
    ctx.restore();
  }

  /** Balões e emotes (desenhados por cima de toda a cena). */
  drawOverlay(ctx: Ctx, t: number) {
    if (!this.visible || !this.frame) return;
    const top = this.topWorld();
    const hx = this.headWorld().x;
    if (this.emote) {
      const e = this.emote;
      const k = e.t / e.dur;
      const pop = e.t < 0.25 ? Ease.outBack(e.t / 0.25) : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
      ctx.save();
      ctx.translate(hx + this.facing * 34, top - 26 + Math.sin(t * 4) * 3);
      ctx.scale(pop, pop);
      drawEmote(ctx, e.kind, t);
      ctx.restore();
    }
    if (this.bubble) {
      const b = this.bubble;
      const k = b.t / b.dur;
      const pop = b.t < 0.2 ? Ease.outBack(b.t / 0.2) : k > 0.9 ? 1 - (k - 0.9) / 0.1 : 1;
      drawBubble(ctx, b.text, hx, top - 20, pop, b.kind, this.facing);
    }
  }
}

export function drawBubble(ctx: Ctx, text: string, x: number, y: number, pop: number, kind: 'fala' | 'pensa' | 'grito', facing: number) {
  ctx.save();
  ctx.font = `700 ${kind === 'grito' ? 22 : 19}px Nunito, sans-serif`;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > 230 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  const lh = 24;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34;
  const h = lines.length * lh + 20;
  const bx = x + facing * 30 - w / 2, by = y - h - 22;
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.translate(-x, -y);
  ctx.fillStyle = 'rgba(20,16,40,0.18)';
  ctx.beginPath();
  roundRect(ctx, bx + 3, by + 5, w, h, 18);
  ctx.fill();
  ctx.fillStyle = kind === 'grito' ? '#fff4d6' : '#ffffff';
  ctx.strokeStyle = kind === 'grito' ? '#e4572e' : '#2b2440';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (kind === 'pensa') {
    roundRect(ctx, bx, by, w, h, h / 2);
  } else roundRect(ctx, bx, by, w, h, 18);
  ctx.fill();
  ctx.stroke();
  if (kind === 'pensa') {
    for (const [dx, dy, r] of [[0, 12, 7], [-facing * 8, 26, 4.5]] as const) {
      ctx.beginPath();
      ctx.arc(x + facing * 16 + dx, by + h + dy - 4, r, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(x + facing * 6, by + h - 1);
    ctx.lineTo(x - facing * 4, by + h + 18);
    ctx.lineTo(x + facing * 24, by + h - 1);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x + facing * 6 - (facing < 0 ? 18 : 0), by + h - 3.5, 20, 4);
  }
  ctx.fillStyle = '#2b2440';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 10 + lh / 2 + i * lh));
  ctx.restore();
}

export function drawEmote(ctx: Ctx, kind: EmoteKind, t: number) {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2b2440';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.lineTo(-16, 32);
  ctx.lineTo(2, 21);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 20.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const beat = 1 + Math.sin(t * 10) * 0.08;
  switch (kind) {
    case 'coracao':
    case 'coracaoPartido': {
      ctx.save();
      ctx.scale(beat, beat);
      ctx.fillStyle = '#e8335a';
      ctx.beginPath();
      heartPath(ctx, 0, 3, 12);
      ctx.fill();
      if (kind === 'coracaoPartido') {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(-3, 0); ctx.lineTo(3, 4); ctx.lineTo(0, 10);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case 'raiva': {
      ctx.strokeStyle = '#e0233a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.save();
      ctx.scale(beat, beat);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
        ctx.quadraticCurveTo(Math.cos(a + 0.5) * 9, Math.sin(a + 0.5) * 9, Math.cos(a) * 12, Math.sin(a) * 12);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'exclamacao': case 'interrogacao': case 'reticencias': case 'dinheiro': {
      const txt = { exclamacao: '!', interrogacao: '?', reticencias: '…', dinheiro: '$' }[kind];
      ctx.font = '900 28px Nunito, sans-serif';
      ctx.fillStyle = kind === 'dinheiro' ? '#2f8f6f' : kind === 'exclamacao' ? '#e4572e' : '#3d7bd9';
      ctx.fillText(txt, 0, 2);
      break;
    }
    case 'zzz':
      ctx.font = '900 18px Nunito, sans-serif';
      ctx.fillStyle = '#5b6ee8';
      ctx.fillText('z', -7, 5); ctx.font = '900 14px Nunito'; ctx.fillText('z', 3, -2); ctx.font = '900 10px Nunito'; ctx.fillText('z', 10, -8);
      break;
    case 'musica':
      ctx.font = '900 26px sans-serif';
      ctx.fillStyle = '#9b5de5';
      ctx.fillText('♫', 0, 2);
      break;
    case 'suor':
    case 'lagrima': {
      ctx.fillStyle = '#6fbef0';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(11, 4, 0, 11);
      ctx.quadraticCurveTo(-11, 4, 0, -12);
      ctx.fill();
      break;
    }
    case 'ideia': {
      ctx.fillStyle = '#f2c14e';
      ctx.shadowColor = '#f2c14e';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -3, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8a8f98';
      ctx.fillRect(-5, 6, 10, 7);
      break;
    }
    case 'estrela': {
      ctx.fillStyle = '#f2c14e';
      ctx.save();
      ctx.rotate(t * 2);
      ctx.beginPath();
      starPath(ctx, 0, 0, 14, 6, 5);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'caveira': {
      ctx.font = '26px sans-serif';
      ctx.fillText('💀', 0, 2);
      break;
    }
  }
}

export { lerp };
