/**
 * Motor do Laboratório visual: roda cenas/movimentos com o renderizador, atores e roteiros REAIS
 * (Scene, Director, SITUATIONS, physical(), Actor, MOTIONS, ENVS, PROPS, HELD) em passos fixos,
 * com acaso semeado — o que permite busca temporal por REEXECUÇÃO determinística.
 *
 * Por que não usar o laço do Stage: o Stage avança com o relógio real (dt variável + watchdog) e
 * usa setTimeout na transição. Aqui replicamos exatamente o que Stage.play faz para montar a cena
 * (ambiente resolvido pelo elenco, fade de entrada, Director + run), mas avançamos com dt fixo.
 */
import { Scene, Director } from '../scenes/scene';
import { SITUATIONS, Cast, CastMember, physical } from '../scenes/situations';
import { MOTIONS, Motion } from '../character/motions';
import { EXPRESSIONS, Face, ExprName } from '../character/expressions';
import { Actor, EmoteKind } from '../character/actor';
import { Appearance, randomAppearance, Sex } from '../character/appearance';
import { GROUND } from '../render/bg';
import { RNG, rng } from '../core/rng';
import { FluxoAleatorio, drenar, prng, hashDe } from './det';
import { skeleton, legLength } from '../character/character';
import { armPoints, legPoints } from '../character/body';

export const DT = 1 / 60;
export const VW = 1280, VH = 720; // viewport lógico FIXO (a simulação lê Scene.view)

export type ModoLab = 'cena' | 'movimento' | 'acaoCorporal' | 'expressao' | 'ambiente' | 'objeto' | 'objetoMao' | 'visual';

export interface Bonecos {
  idadeA: number; idadeB: number; sexoA: Sex; sexoB: Sex; sementeAparencia: number;
  distancia: number; direcaoA: 1 | -1; direcaoB: 1 | -1; giro: number;
}
export const BONECOS_PADRAO: Bonecos = { idadeA: 30, idadeB: 30, sexoA: 'm', sexoB: 'f', sementeAparencia: 7, distancia: 260, direcaoA: 1, direcaoB: -1, giro: 0.72 };

export interface EspecLab {
  modo: ModoLab;
  id: string;
  cena?: { id: string; data: Record<string, any>; player: CastMember; others: CastMember[] };
  ambiente?: string;
  bonecos: Bonecos;
  semente: number;
  opcaoVisual?: number; // página das opções (modo visual)
  origem?: string; // cadeia de referências (ex.: "interação agg_chute → cena agressao")
}

export interface Overrides {
  movimentos: Map<string, Motion>;
  expressoes: Map<string, Face>;
}
export const semOverrides = (): Overrides => ({ movimentos: new Map(), expressoes: new Map() });

export interface Marca {
  t: number;
  op: string;
  alvo: string;
  arg: string;
  trecho: string; // id estável do trecho: "<op>:<arg>#<ocorrência>"
  dur?: number;
}

// --------------------------------------------------------------- contexto nulo (desenho de simulação)
const noop = () => undefined;
const grad = { addColorStop: noop };
function ctxNulo(): CanvasRenderingContext2D {
  const alvo: any = {
    canvas: { width: VW, height: VH }, globalAlpha: 1, lineWidth: 1, font: '10px sans-serif', fillStyle: '#000', strokeStyle: '#000', lineJoin: 'round', lineCap: 'round', textAlign: 'left', textBaseline: 'alphabetic', globalCompositeOperation: 'source-over', filter: 'none', shadowBlur: 0, shadowColor: 'transparent', imageSmoothingEnabled: true,
    measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad, createConicGradient: () => grad, createPattern: () => null,
    getTransform: () => new DOMMatrix(), getImageData: () => ({ data: new Uint8ClampedArray(4) }), isPointInPath: () => false, getLineDash: () => [],
  };
  return new Proxy(alvo, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } }) as CanvasRenderingContext2D;
}
const NULO = ctxNulo();

/** Fila global: só um laboratório simula por vez (o Math.random semeado não pode vazar entre eles). */
let filaGlobal: Promise<unknown> = Promise.resolve();
function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
  const p = filaGlobal.then(fn, fn);
  filaGlobal = p.catch(() => undefined);
  return p;
}

// --------------------------------------------------------------- Director instrumentado
class DirectorRastreado extends Director {
  constructor(sc: Scene, private run: LabRun) { super(sc); }
  private r(op: string, a: Actor | null, arg: string, dur?: number) { this.run.marcar(op, a, arg, dur); }
  add(ap: Appearance, age: number, o: Parameters<Scene['addActor']>[2] = {}) {
    const a = super.add(ap, age, o);
    this.run.registrarAtor(a, o?.name);
    this.r('add', a, o?.motion ?? '');
    return a;
  }
  walk(a: Actor, x: number, run = false) { this.r(run ? 'correr' : 'andar', a, String(Math.round(x))); return super.walk(a, x, run); }
  async act(a: Actor, motion: string) { const t0 = this.sc.t; this.r('act', a, motion, MOTIONS[motion]?.dur); await super.act(a, motion); void t0; }
  loop(a: Actor, motion: string, fade = 0.25) { this.r('loop', a, motion); super.loop(a, motion, fade); }
  async say(a: Actor, text: string, dur?: number, kind: 'fala' | 'pensa' | 'grito' = 'fala') { this.r(kind, a, text, dur); return super.say(a, text, dur, kind); }
  expr(a: Actor, e: ExprName, hold?: number) { this.r('expr', a, e, hold); super.expr(a, e, hold); }
  emote(a: Actor, k: EmoteKind, dur = 1.8) { this.r('emote', a, k, dur); super.emote(a, k, dur); }
  prop(id: string, x: number, y?: number, o: Parameters<Scene['addProp']>[3] = {}) { this.r('prop', null, id); return super.prop(id, x, y, o); }
  fx(kind: any, x: number, y: number, n = 1, o: any = {}) { this.r('fx', null, kind); super.fx(kind, x, y, n, o); }
  burst(x: number, y: number, col?: string) { this.r('burst', null, col ?? ''); super.burst(x, y, col); }
  shake(n = 10) { this.r('shake', null, String(n)); super.shake(n); }
  flash(col = '#ffffff', a = 0.9) { this.r('flash', null, col); super.flash(col, a); }
  focus(x: number, y = 360, zoom = 1, speed = 3) { this.r('camera', null, `${Math.round(x)},${Math.round(y)} ×${zoom}`); super.focus(x, y, zoom, speed); }
  caption(title: string, sub?: string, dur = 3.2) { this.r('legenda', null, title + (sub ? ' — ' + sub : ''), dur); super.caption(title, sub, dur); }
  sfx(name: any) { this.r('som', null, String(name)); super.sfx(name); }
  confetti(n = 80) { this.r('fx', null, 'confete'); super.confetti(n); }
  hearts(x: number, y: number, n = 6) { this.r('fx', null, 'coracao'); super.hearts(x, y, n); }
  moveActor(a: Actor, x: number, y: number, dur: number, ease?: any) { this.r('mover', a, `${Math.round(x)},${Math.round(y)}`, dur); return super.moveActor(a, x, y, dur, ease); }
  fadeActor(a: Actor, to: number, dur = 0.6) { this.r('fade', a, String(to), dur); return super.fadeActor(a, to, dur); }
}

// --------------------------------------------------------------- execução
export class LabRun {
  sc!: Scene;
  d!: DirectorRastreado;
  fluxo!: FluxoAleatorio;
  marcas: Marca[] = [];
  eventosMov: { t: number; nome: string; ator: string; movimento: string }[] = [];
  rotulos = new Map<Actor, string>();
  terminou = false;
  tFim: number | null = null;
  erro: string | null = null;
  private contagem = new Map<string, number>();
  private promessa: Promise<void> | null = null;

  constructor(public espec: EspecLab, public ov: Overrides = semOverrides()) {}

  rotulo(a: Actor | null) { return a ? this.rotulos.get(a) ?? a.name ?? `ator${a.id}` : ''; }

  registrarAtor(a: Actor, nome?: string) {
    const jogador = this.espec.cena?.player.name;
    let r = nome && jogador && nome === jogador ? 'P' : nome || '';
    if (!r) r = `A${this.rotulos.size + 1}`;
    if ([...this.rotulos.values()].includes(r)) r = `${r}${this.rotulos.size + 1}`;
    this.rotulos.set(a, r);
    const orig = a.onEvent;
    a.onEvent = (n, ator) => {
      this.eventosMov.push({ t: this.sc.t, nome: n, ator: this.rotulo(ator), movimento: ator.motionName });
      this.marcar('evento', ator, `${n}@${ator.motionName}`);
      orig?.(n, ator);
    };
  }

  marcar(op: string, a: Actor | null, arg: string, dur?: number) {
    const base = `${op}:${arg.length > 32 ? arg.slice(0, 32) + '…' : arg}`;
    const n = (this.contagem.get(base) ?? 0) + 1;
    this.contagem.set(base, n);
    this.marcas.push({ t: this.sc?.t ?? 0, op, alvo: this.rotulo(a), arg, trecho: `${base}#${n}`, dur });
  }

  /** Monta a cena do zero (t = 0). */
  async iniciar() {
    return exclusivo(async () => {
      this.fluxo = new FluxoAleatorio(this.espec.semente);
      this.marcas = []; this.eventosMov = []; this.rotulos.clear(); this.contagem.clear();
      this.terminou = false; this.tFim = null; this.erro = null;
      await this.comOverrides(async () => {
        const { sc, roteiro } = this.montar();
        this.sc = sc;
        this.d = new DirectorRastreado(sc, this);
        this.promessa = roteiro(this.d)
          .then(() => { this.terminou = true; this.tFim = this.sc.t; })
          .catch((e) => { this.erro = (e as Error).stack ?? String(e); this.terminou = true; this.tFim = this.sc.t; });
        await drenar();
        this.simDesenho();
      });
    });
  }

  private montar(): { sc: Scene; roteiro: (d: DirectorRastreado) => Promise<void> } {
    const e = this.espec;
    const B = e.bonecos;
    const r = new RNG(B.sementeAparencia);
    const apA = randomAppearance(r, B.sexoA), apB = randomAppearance(r, B.sexoB);
    const env = e.ambiente ?? 'sala';
    switch (e.modo) {
      case 'cena': {
        const sit = SITUATIONS[e.id] ?? SITUATIONS.casa;
        const cast: Cast = e.cena ? { player: e.cena.player, others: e.cena.others, data: e.cena.data } : { player: { ap: apA, age: B.idadeA, name: 'Ana', sex: B.sexoA }, others: [{ ap: apB, age: B.idadeB, name: 'Léo', sex: B.sexoB }], data: {} };
        const envId = typeof sit.env === 'function' ? sit.env(cast) : sit.env;
        const sc = new Scene(envId);
        sc.fadeA = 1; sc.fadeTarget = 0; // igual ao Stage.play
        return { sc, roteiro: (d) => sit.run(d, cast) };
      }
      case 'movimento': {
        const sc = new Scene(env);
        const m = MOTIONS[e.id];
        return {
          sc, roteiro: async (d) => {
            const a = d.add(apA, B.idadeA, { x: 640 - B.distancia / 2, facing: B.direcaoA, name: 'A', turn: B.giro, z: 1 });
            const b = d.add(apB, B.idadeB, { x: 640 + B.distancia / 2, facing: B.direcaoB, name: 'B', turn: B.giro, z: 0.5 });
            a.lookAt = b; b.lookAt = a;
            d.focus(640, 400, 1.25, 20);
            if (!m) return;
            if (m.loop) { d.loop(a, e.id); await d.wait(5); }
            else { await d.wait(0.5); await d.act(a, e.id); await d.wait(0.8); }
          },
        };
      }
      case 'acaoCorporal': {
        const sc = new Scene(env);
        return {
          sc, roteiro: async (d) => {
            const a = d.add(apA, B.idadeA, { x: 640 - B.distancia / 2, facing: B.direcaoA, name: 'A', turn: B.giro, z: 1 });
            const b = d.add(apB, B.idadeB, { x: 640 + B.distancia / 2, facing: B.direcaoB, name: 'B', turn: B.giro, z: 0.5 });
            await d.wait(0.3);
            await physical(d, a, b, e.id);
            await d.wait(0.8);
          },
        };
      }
      case 'expressao': {
        const sc = new Scene(env);
        return {
          sc, roteiro: async (d) => {
            const a = d.add(apA, B.idadeA, { x: 640, facing: 1, name: 'A', turn: 0.35, z: 1 });
            await d.wait(DT); // o 1º desenho de simulação calcula Actor.frame (posição real da cabeça)
            d.focus(640, a.headWorld().y + a.d.headH * 0.15, 2.8, 60);
            await d.wait(0.6);
            d.expr(a, e.id as ExprName);
            await d.wait(2.4);
            d.expr(a, 'neutro');
            await d.wait(1);
            d.expr(a, e.id as ExprName);
            await d.wait(2);
          },
        };
      }
      case 'ambiente': {
        const sc = new Scene(e.id);
        return {
          sc, roteiro: async (d) => {
            d.add(apA, B.idadeA, { x: 470, facing: 1, name: 'A', turn: B.giro, motion: 'parado' });
            d.add(apB, B.idadeB, { x: 810, facing: -1, name: 'B', turn: B.giro, motion: 'parado' });
            await d.wait(6);
          },
        };
      }
      case 'objeto': {
        const sc = new Scene(env);
        return {
          sc, roteiro: async (d) => {
            d.prop(e.id, 640, GROUND + 8, { z: 1 });
            d.add(apA, B.idadeA, { x: 380, facing: 1, name: 'A', turn: B.giro, motion: 'parado', z: 0 });
            d.focus(640, 470, 1.4, 30);
            await d.wait(3);
          },
        };
      }
      case 'objetoMao': {
        const sc = new Scene(env);
        return {
          sc, roteiro: async (d) => {
            const a = d.add(apA, B.idadeA, { x: 600, facing: 1, name: 'A', turn: B.giro, z: 1 });
            a.propN = e.id;
            const b = d.add(apB, B.idadeB, { x: 760, facing: -1, name: 'B', turn: B.giro, z: 0.5 });
            b.propF = e.id;
            d.focus(680, 470, 2.3, 30);
            d.loop(a, 'parado');
            await d.wait(1.2);
            await d.act(a, 'entregar');
            await d.wait(1.5);
          },
        };
      }
      case 'visual': {
        const sc = new Scene(env);
        return {
          sc, roteiro: async (d) => {
            const campo = e.id;
            const ops = opcoesDoCampo(campo);
            const pag = e.opcaoVisual ?? 0;
            const fatia = ops.slice(pag * 5, pag * 5 + 5);
            fatia.forEach((op, i) => {
              const ap = { ...apA, [campo]: op.valor } as Appearance;
              const a = d.add(ap, B.idadeA, { x: 640 + (i - (fatia.length - 1) / 2) * 190, facing: 1, name: op.rotulo, turn: 0.55, motion: 'parado' });
              a.say(op.rotulo, 60, 'pensa');
            });
            await d.wait(4);
          },
        };
      }
    }
  }

  /** Aplica movimentos/expressões propostos SÓ enquanto este laboratório simula. */
  private async comOverrides(fn: () => Promise<void>) {
    const salvosM: [string, Motion][] = [], salvosE: [string, Face][] = [];
    for (const [k, m] of this.ov.movimentos) { salvosM.push([k, MOTIONS[k]]); MOTIONS[k] = m; }
    const EX = EXPRESSIONS as Record<string, Face>;
    for (const [k, f] of this.ov.expressoes) { salvosE.push([k, EX[k]]); EX[k] = f; }
    const antes = Math.random;
    const rngAntes = rng;
    const estadoRng = rngAntes.estado();
    Math.random = this.fluxo.sim;
    rngAntes.reseed(this.fluxo.rngEstado);
    try {
      await fn();
    } finally {
      this.fluxo.rngEstado = rngAntes.estado();
      rngAntes.reseed(estadoRng);
      Math.random = antes;
      for (const [k, m] of salvosM) MOTIONS[k] = m;
      for (const [k, f] of salvosE) EX[k] = f;
    }
  }

  /** "Desenho de simulação": calcula Actor.frame e Scene.view como o jogo faz a cada quadro. */
  private simDesenho() {
    // O desenho não altera estado de simulação, mas CONSOME Math.random (tremor de câmera e, só na 1ª vez,
    // o desenho de camadas estáticas que depois fica em cache). Usamos um acaso descartável por quadro
    // para que o fluxo semeado da simulação não dependa do cache global de camadas.
    const antes = Math.random;
    Math.random = prng(this.quadro * 104729 + 3);
    try { this.sc.draw(NULO, VW, VH, 1); } finally { Math.random = antes; }
  }

  /** Avança n passos fixos (dt maior só para varreduras em lote, onde o replay quadro a quadro não importa). */
  async avancar(n: number, dt = DT) {
    if (!this.sc || n <= 0) return;
    await exclusivo(() => this.comOverrides(async () => {
      for (let i = 0; i < n; i++) {
        this.sc.update(dt);
        await drenar();
        this.simDesenho();
      }
    }));
  }

  /** Busca temporal: reexecuta do zero até t (determinístico). */
  async irPara(t: number) {
    const alvo = Math.max(0, Math.round(t / DT));
    const atual = this.sc ? Math.round(this.sc.t / DT) : -1;
    if (!this.sc || alvo < atual) { await this.iniciar(); await this.avancar(alvo); }
    else await this.avancar(alvo - atual);
  }

  get quadro() { return this.sc ? Math.round(this.sc.t / DT) : 0; }

  /** Desenha na tela (acaso separado para não alterar a simulação). */
  desenhar(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, opcoes: { esqueleto?: boolean; atorSel?: Actor | null; deslocamentos?: Map<string, number>; camera?: { zoom?: number; dx?: number; dy?: number } | null } = {}) {
    if (!this.sc) return;
    const antes = Math.random;
    // acaso do desenho (tremor de câmera) semeado pelo quadro: A e B no mesmo quadro tremem igual
    Math.random = prng(this.quadro * 7919 + 17);
    const sc = this.sc;
    const deslocados: [Actor, number][] = [];
    const cam = { ...sc.cam };
    try {
      for (const [a, r] of this.rotulos) { const dx = opcoes.deslocamentos?.get(r); if (dx) { deslocados.push([a, a.x]); a.x += dx; } }
      if (opcoes.camera) { sc.cam.zoom *= opcoes.camera.zoom ?? 1; sc.cam.x += opcoes.camera.dx ?? 0; sc.cam.y += opcoes.camera.dy ?? 0; }
      // a tela real tem outro tamanho: desenhamos no viewport lógico e escalamos (Scene.view da simulação não é tocado)
      const vistaSim = { ...sc.view };
      const escala = Math.min(w / VW, h / VH);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0c0a18';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const ox = (w - VW * escala) / 2, oy = (h - VH * escala) / 2;
      const alvoDpr = dpr * escala;
      ctx.save();
      ctx.translate(ox * dpr, oy * dpr);
      const tr = ctx.getTransform();
      // Scene.draw faz setTransform(dpr...) — compensamos com um dpr efetivo e deslocamento
      const ctxProx = new Proxy(ctx, {
        get(t, k) {
          if (k === 'setTransform') return (a: number, b: number, c: number, d: number, e: number, f: number) => t.setTransform(a, b, c, d, e + tr.e, f + tr.f);
          const v = (t as any)[k];
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, k, v) { (t as any)[k] = v; return true; },
      });
      sc.draw(ctxProx, VW, VH, alvoDpr);
      if (opcoes.esqueleto) for (const a of sc.actors) if (a.visible) desenharEsqueleto(ctxProx, sc, a, alvoDpr, a === opcoes.atorSel);
      ctx.restore();
      sc.view = vistaSim;
    } finally {
      for (const [a, x] of deslocados) a.x = x;
      Object.assign(sc.cam, cam);
      Math.random = antes;
    }
  }

  atores() { return [...this.rotulos.entries()].map(([a, r]) => ({ a, r })); }

  /** Estado observável do instante (para provar determinismo). */
  instantaneo() {
    const sc = this.sc;
    return hashDe({
      t: sc.t, cam: [sc.cam.x, sc.cam.y, sc.cam.zoom, sc.cam.shake], fx: sc.fx.list.map((p) => [p.kind, p.x, p.y]), cap: sc.caption?.title,
      atores: sc.actors.map((a) => [this.rotulo(a), a.x, a.y, a.facing, a.motionName, a.motionT, a.pose, a.face, a.bubble?.text, a.emote?.kind, a.propN, a.propF]),
      marcas: this.marcas.length,
    });
  }
}

/**
 * Prova de determinismo: (1) toca quadro a quadro, desenhando na tela entre os passos, até t;
 * (2) busca t direto (reexecução); (3) de novo. Os três instantâneos têm de ser iguais.
 */
export async function verificarDeterminismo(espec: EspecLab, ov: Overrides, t: number, canvas?: HTMLCanvasElement) {
  const a = new LabRun(espec, ov);
  await a.iniciar();
  const n = Math.round(t / DT);
  const ctx = canvas?.getContext('2d');
  for (let i = 0; i < n; i++) { await a.avancar(1); if (ctx && i % 3 === 0) a.desenhar(ctx, canvas!.clientWidth || 320, canvas!.clientHeight || 180, 1); }
  const b = new LabRun(espec, ov);
  await b.irPara(t);
  const c = new LabRun(espec, ov);
  await c.irPara(t);
  const ha = a.instantaneo(), hb = b.instantaneo(), hc = c.instantaneo();
  return { ok: ha === hb && hb === hc, tocado: ha, buscado: hb, repetido: hc };
}

// --------------------------------------------------------------- esqueleto
export function desenharEsqueleto(ctx: CanvasRenderingContext2D, sc: Scene, a: Actor, dpr: number, destaque: boolean) {
  const v = sc.view;
  ctx.save();
  ctx.setTransform(dpr * v.scale, 0, 0, dpr * v.scale, -v.x0 * v.scale * dpr, -v.y0 * v.scale * dpr);
  ctx.translate(a.x, a.y - a.elev);
  ctx.scale(a.facing * a.scale, a.scale);
  const p = a.pose, d = a.d;
  ctx.scale(p.sx, p.sy);
  ctx.translate(p.x, -legLength(d) + p.y);
  ctx.rotate(p.rot);
  const sk = skeleton(d, p, a.turn);
  const rc = { d, turn: a.turn } as any;
  const bN = armPoints(rc, sk.shoulderN, p.armN, true), bF = armPoints(rc, sk.shoulderF, p.armF, false);
  const lN = legPoints(rc, sk.hipN, p.legN, p.footN), lF = legPoints(rc, sk.hipF, p.legF, p.footF);
  const linha = (pts: { x: number; y: number }[], cor: string, w = 3) => {
    ctx.strokeStyle = cor; ctx.lineWidth = w / Math.max(0.2, v.scale); ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
  };
  const ponto = (q: { x: number; y: number }, cor: string) => { ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(q.x, q.y, 4 / Math.max(0.2, v.scale), 0, Math.PI * 2); ctx.fill(); };
  const alfa = destaque ? 1 : 0.55;
  ctx.globalAlpha = alfa;
  const pe = (an: { x: number; y: number }, fa: number) => ({ x: an.x + Math.sin(fa + Math.PI / 2) * d.footL * 0.7, y: an.y + Math.cos(fa + Math.PI / 2) * d.footL * 0.7 });
  // lado distante (azul) atrás, próximo (laranja) na frente
  linha([sk.shoulderF, bF.e, bF.w], '#5aa0ff'); linha([sk.hipF, lF.k, lF.an, pe(lF.an, lF.fa)], '#5aa0ff');
  const pivo = { x: 0, y: sk.pivotY };
  const pivoR = { x: pivo.x * Math.cos(sk.lean) - pivo.y * Math.sin(sk.lean), y: pivo.x * Math.sin(sk.lean) + pivo.y * Math.cos(sk.lean) };
  linha([{ x: 0, y: 0 }, pivoR, sk.neck, sk.head], '#ffffff', 4);
  linha([sk.shoulderN, sk.neck, sk.shoulderF], '#ffffff', 2);
  linha([sk.hipN, sk.hipF], '#ffffff', 2);
  linha([sk.shoulderN, bN.e, bN.w], '#ffb547'); linha([sk.hipN, lN.k, lN.an, pe(lN.an, lN.fa)], '#ffb547');
  for (const q of [sk.head, sk.neck, pivoR, { x: 0, y: 0 }, sk.shoulderN, sk.shoulderF, bN.e, bN.w, bF.e, bF.w, sk.hipN, sk.hipF, lN.k, lN.an, lF.k, lF.an]) ponto(q, '#ff5c7a');
  ctx.restore();
}

// --------------------------------------------------------------- opções visuais
import * as AP from '../character/appearance';
const LISTAS: Record<string, AP.Opt[] | string[]> = {
  faceShape: AP.FACE_SHAPES, eyeShape: AP.EYE_SHAPES, browStyle: AP.BROW_STYLES, noseStyle: AP.NOSE_STYLES, mouthStyle: AP.MOUTH_STYLES,
  earStyle: AP.EAR_STYLES, hairStyle: AP.HAIR_STYLES, facialHair: AP.FACIAL_HAIR, top: AP.TOPS, topPattern: AP.PATTERNS, bottom: AP.BOTTOMS,
  shoes: AP.SHOES, glasses: AP.GLASSES, hat: AP.HATS, earrings: AP.EARRINGS, tattoo: AP.TATTOOS, scar: AP.SCARS, necklace: AP.NECKLACES,
  skin: AP.SKIN_TONES, hairColor: AP.HAIR_COLORS, facialHairColor: AP.HAIR_COLORS, browColor: AP.HAIR_COLORS, iris: AP.EYE_COLORS,
  lipColor: AP.LIP_COLORS, topColor: AP.CLOTH_COLORS, topColor2: AP.CLOTH_COLORS, bottomColor: AP.CLOTH_COLORS, shoesColor: AP.CLOTH_COLORS,
  glassesColor: AP.CLOTH_COLORS, hatColor: AP.CLOTH_COLORS, accColor: AP.CLOTH_COLORS, eyeshadow: AP.MAKEUP_COLORS,
};
export function opcoesDoCampo(campo: string): { valor: any; rotulo: string }[] {
  const l = LISTAS[campo];
  if (l) return (l as any[]).map((o) => (typeof o === 'string' ? { valor: o, rotulo: o } : { valor: o.id, rotulo: o.name }));
  if (campo === 'sex') return [{ valor: 'f', rotulo: 'f' }, { valor: 'm', rotulo: 'm' }];
  if (campo === 'undertone') return ['quente', 'neutro', 'frio'].map((v) => ({ valor: v, rotulo: v }));
  return [0, 0.25, 0.5, 0.75, 1].map((v) => ({ valor: v, rotulo: `${campo}=${v}` }));
}
