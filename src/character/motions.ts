import { Pose, restPose, blendPose, Limb, Hand } from './rig';
import { Ease, EaseFn, clamp } from '../core/math';
import { ExprName } from './expressions';

export interface MotionCtx {
  speed: number; // velocidade de caminhada (unidades/s)
  seed: number;
}

export interface Motion {
  loop: boolean;
  dur?: number; // duração (ações)
  grounded?: boolean; // ajusta pelve para manter o pé no chão (padrão true)
  fn: (t: number, c: MotionCtx) => Pose;
  events?: { t: number; name: string }[];
  expr?: ExprName;
  propN?: string;
  propF?: string;
}

const S = Math.sin, C = Math.cos, PI = Math.PI;
const L = (a: number, b: number): Limb => ({ a, b });

function P(p: Partial<Pose> = {}): Pose {
  return { ...restPose(), ...p };
}

/** Keyframes: lista de [tempo, pose parcial, easing]. */
type KF = [number, Partial<Pose>, EaseFn?];
function keyframes(frames: KF[]) {
  const full = frames.map(([t, p, e]) => [t, P(p), e ?? Ease.inOutQuad] as const);
  return (t: number): Pose => {
    if (t <= full[0][0]) return full[0][1];
    for (let i = 0; i < full.length - 1; i++) {
      const [t0, p0] = full[i];
      const [t1, p1, e] = full[i + 1];
      if (t <= t1) return blendPose(p0, p1, e(clamp((t - t0) / (t1 - t0))));
    }
    return full[full.length - 1][1];
  };
}

const breathe = (p: Pose, t: number, k = 1) => {
  p.y += S(t * 1.7) * 1.1 * k;
  p.armN.a += S(t * 1.7) * 0.015 * k;
  p.armF.a -= S(t * 1.7) * 0.015 * k;
  p.head += S(t * 0.45) * 0.025 * k;
  return p;
};

function walkCycle(t: number, c: MotionCtx, amp: number, bend: number, armAmp: number, lean: number, freqMul = 1): Pose {
  const f = Math.max(0.8, (c.speed / 150) * 1.1) * freqMul;
  const ph = t * f * PI * 2;
  const s = S(ph), co = C(ph);
  const p = P({ lean: lean + Math.abs(co) * 0.02 });
  p.legN = L(s * amp, 0.08 + Math.max(0, co) * bend);
  p.legF = L(-s * amp, 0.08 + Math.max(0, -co) * bend);
  p.footN = Math.max(0, -co) * 0.25 - Math.max(0, co) * 0.2;
  p.footF = Math.max(0, co) * 0.25 - Math.max(0, -co) * 0.2;
  p.armN = L(-s * armAmp, 0.25 + Math.max(0, -s) * armAmp * 0.8);
  p.armF = L(s * armAmp, 0.25 + Math.max(0, s) * armAmp * 0.8);
  p.y = -Math.abs(co) * 3;
  p.head = S(ph * 2) * 0.02;
  return p;
}

const sit = (p: Pose) => {
  p.legN = L(PI / 2 - 0.05, PI / 2 - 0.05);
  p.legF = L(PI / 2 - 0.12, PI / 2 - 0.1);
  p.footN = 0; p.footF = 0;
  return p;
};

export const MOTIONS: Record<string, Motion> = {
  // ------------------------------------------------ ociosos
  parado: { loop: true, fn: (t) => breathe(P(), t) },
  feliz: {
    loop: true,
    fn: (t) => {
      const p = P();
      p.y = -Math.abs(S(t * 3.2)) * 3;
      p.head = S(t * 1.6) * 0.06;
      p.armN = L(0.1 + S(t * 3.2) * 0.08, 0.3);
      p.armF = L(-0.1 - S(t * 3.2) * 0.08, 0.3);
      return p;
    },
    expr: 'feliz',
  },
  triste: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.1, head: 0.3 });
      p.armN = L(0.02, 0.05); p.armF = L(-0.02, 0.05);
      return breathe(p, t * 0.6, 1.4);
    },
    expr: 'triste',
  },
  bracosCruzados: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: -0.04 });
      p.armN = L(0.65, 2.05); p.armF = L(0.55, 2.1);
      p.handN = 'punho'; p.handF = 'punho';
      p.footN = Math.max(0, S(t * 6)) * 0.25;
      return breathe(p, t);
    },
    expr: 'bravo',
  },
  pensando: {
    loop: true,
    fn: (t) => {
      const p = P({ head: -0.12 + S(t) * 0.03 });
      p.armN = L(0.55, 2.35); p.handN = 'punho';
      p.armF = L(0.5, 1.6);
      return breathe(p, t);
    },
    expr: 'pensativo',
  },
  nervoso: {
    loop: true,
    fn: (t) => {
      const p = P({ x: S(t * 3) * 3, head: S(t * 2.3) * 0.08 });
      p.armN = L(0.45, 1.9 + S(t * 9) * 0.2); p.armF = L(0.4, 1.8 + S(t * 9 + 1) * 0.2);
      p.handN = 'punho'; p.handF = 'punho';
      return p;
    },
    expr: 'assustado',
  },
  maosNaCintura: {
    loop: true,
    fn: (t) => {
      const p = P();
      p.armN = L(-0.55, 1.9); p.armF = L(0.55, -1.9);
      p.handN = 'punho'; p.handF = 'punho';
      return breathe(p, t);
    },
  },
  // ------------------------------------------------ locomoção
  andar: { loop: true, fn: (t, c) => walkCycle(t, c, 0.42, 0.75, 0.38, 0.04) },
  correr: {
    loop: true,
    fn: (t, c) => {
      const p = walkCycle(t, c, 0.75, 1.5, 0.85, 0.2, 1.25);
      p.armN.b = 1.4; p.armF.b = 1.4;
      p.handN = 'punho'; p.handF = 'punho';
      p.y -= 4;
      return p;
    },
  },
  esteira: {
    loop: true,
    fn: (t) => {
      const p = walkCycle(t, { speed: 260, seed: 0 }, 0.6, 1.3, 0.75, 0.15, 1.1);
      p.armN.b = 1.4; p.armF.b = 1.4; p.handN = 'punho'; p.handF = 'punho';
      return p;
    },
    expr: 'determinado',
  },
  // ------------------------------------------------ festa
  dancar: {
    loop: true,
    fn: (t) => {
      const b = t * 2 * PI * 1.1;
      const p = P({ x: S(b) * 9, lean: S(b) * 0.06, head: S(b * 2) * 0.1 });
      p.y = -Math.abs(S(b * 2)) * 6;
      p.armN = L(2.4 + S(b * 2) * 0.35, 0.4 + S(b * 2) * 0.3);
      p.armF = L(-0.2 + S(b) * 0.4, 1.2);
      p.legN = L(0.15 + S(b) * 0.2, 0.2 + Math.max(0, S(b)) * 0.5);
      p.legF = L(-0.15 + S(b) * 0.2, 0.2 + Math.max(0, -S(b)) * 0.5);
      p.handN = 'aponta';
      return p;
    },
    expr: 'alegre',
  },
  dancar2: {
    loop: true,
    fn: (t) => {
      const b = t * 2 * PI * 1.2;
      const p = P({ head: S(b) * 0.12 });
      p.y = -Math.abs(S(b)) * 10;
      p.armN = L(-2.55 + S(b) * 0.3, 0.3 - S(b) * 0.3);
      p.armF = L(2.6 - S(b) * 0.3, 0.3 + S(b) * 0.3);
      p.legN = L(0.25, 0.3 + Math.abs(S(b)) * 0.4);
      p.legF = L(-0.25, 0.3 + Math.abs(C(b)) * 0.4);
      p.handN = 'acena'; p.handF = 'acena';
      return p;
    },
    expr: 'rindo',
  },
  dancar3: {
    loop: true,
    fn: (t) => {
      const b = t * 2 * PI;
      const p = P({ x: S(b) * 14, lean: -S(b) * 0.1 });
      p.armN = L(1.3 + S(b) * 0.6, 1.2); p.armF = L(1.3 - S(b) * 0.6, 1.2);
      p.handN = 'punho'; p.handF = 'punho';
      p.legN = L(0.2 + S(b) * 0.25, 0.3); p.legF = L(-0.2 + S(b) * 0.25, 0.3);
      p.y = -Math.abs(C(b)) * 4;
      return p;
    },
    expr: 'feliz',
  },
  comemorar: {
    loop: true,
    grounded: false,
    fn: (t) => {
      const ph = (t * 1.8) % 1;
      const air = S(ph * PI);
      const p = P();
      p.y = -air * 42 + (ph < 0.08 || ph > 0.92 ? 6 : 0);
      p.sy = 1 + (air - 0.5) * 0.1; p.sx = 1 - (air - 0.5) * 0.07;
      p.armN = L(-2.55 - S(t * 12) * 0.12, 0.25); p.armF = L(2.6 - S(t * 12) * 0.12, 0.25);
      p.handN = 'punho'; p.handF = 'punho';
      p.legN = L(0.1 + air * 0.25, air * 0.8); p.legF = L(-0.1 - air * 0.1, air * 1.1);
      return p;
    },
    expr: 'alegre',
  },
  acenar: {
    loop: true,
    fn: (t) => {
      const p = breathe(P(), t);
      p.armF = L(2.45, 0.45 + S(t * 9) * 0.4);
      p.handF = 'acena';
      p.head = -0.05;
      return p;
    },
    expr: 'feliz',
  },
  aplaudir: {
    loop: true,
    fn: (t) => {
      const p = breathe(P(), t);
      const k = S(t * 16);
      p.armN = L(0.95, 1.05 + k * 0.28); p.armF = L(1.05, 1.0 - k * 0.2);
      p.y = -Math.abs(S(t * 4)) * 2;
      return p;
    },
    expr: 'alegre',
  },
  // ------------------------------------------------ emoções
  chorar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.12, head: 0.3 });
      p.armN = L(0.95, 2.45); p.armF = L(0.85, 2.5);
      p.y = S(t * 18) * 1.2;
      p.handN = 'aberta'; p.handF = 'aberta';
      return p;
    },
    expr: 'chorando',
  },
  rir: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: -0.12 + S(t * 13) * 0.035, head: -0.22 });
      p.armN = L(0.55, 1.45); p.armF = L(0.15, 0.35 + S(t * 13) * 0.1);
      p.y = S(t * 13) * 1.4;
      return p;
    },
    expr: 'rindo',
  },
  furia: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.12, x: S(t * 30) * 1.5 });
      p.armN = L(0.25, 0.6); p.armF = L(-0.2, 0.6);
      p.handN = 'punho'; p.handF = 'punho';
      p.footN = Math.max(0, S(t * 8)) * 0.4;
      return p;
    },
    expr: 'furioso',
  },
  susto: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: -0.15, head: -0.1, x: S(t * 40) * 1 });
      p.armN = L(1.9, 1.4); p.armF = L(2.0, 1.3);
      p.handN = 'acena'; p.handF = 'acena';
      return p;
    },
    expr: 'assustado',
  },
  darOmbros: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.12 }), t);
      p.armN = L(-0.35, 1.7); p.armF = L(0.35, -1.7);
      p.handN = 'aberta'; p.handF = 'aberta';
      return p;
    },
    expr: 'convencido',
  },
  facepalm: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.3, lean: 0.06 }), t);
      p.armN = L(0.85, 2.55); p.handN = 'aberta';
      return p;
    },
    expr: 'cansado',
  },
  rezar: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.25 }), t);
      p.armN = L(0.62, 1.95); p.armF = L(0.62, 1.95);
      return p;
    },
    expr: 'dormindo',
  },
  vitoria: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ lean: -0.05 }), t);
      p.armF = L(2.95, 0.15 + S(t * 8) * 0.1); p.handF = 'punho';
      p.armN = L(0.3, 1.3); p.handN = 'punho';
      p.y = -Math.abs(S(t * 4)) * 4;
      return p;
    },
    expr: 'alegre',
  },
  joinha: {
    loop: true,
    fn: (t) => {
      const p = breathe(P(), t);
      p.armF = L(1.3, 1.1); p.handF = 'joinha';
      return p;
    },
    expr: 'convencido',
  },
  apontar: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ lean: 0.04 }), t);
      p.armF = L(1.52, 0.05); p.handF = 'aponta';
      return p;
    },
  },
  lutar: {
    loop: true,
    fn: (t) => {
      const b = S(t * 7);
      const p = P({ lean: 0.12, y: 6 + b * 2, x: b * 2 });
      p.armN = L(0.95, 2.15); p.armF = L(0.8, 2.2);
      p.handN = 'punho'; p.handF = 'punho';
      p.legN = L(0.35, 0.35); p.legF = L(-0.35, 0.3);
      return p;
    },
    expr: 'determinado',
  },
  // ------------------------------------------------ sentado / deitado
  sentar: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: -0.05 }));
      p.armN = L(0.5, 0.9); p.armF = L(0.45, 0.95);
      return breathe(p, t);
    },
  },
  sentarFeliz: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: -0.02, head: S(t * 2) * 0.06 }));
      p.armN = L(0.4, 0.8); p.armF = L(0.45, 0.7);
      p.legN.b += S(t * 4) * 0.12;
      return p;
    },
    expr: 'feliz',
  },
  digitar: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: 0.1, head: 0.05 }));
      p.armN = L(1.0, 0.7 + S(t * 18) * 0.05); p.armF = L(1.05, 0.65 + S(t * 18 + 1.5) * 0.05);
      return p;
    },
    expr: 'concentrado',
  },
  estudar: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: 0.2, head: 0.25 }));
      p.armN = L(0.9 + S(t * 3) * 0.05, 1.1); p.handN = 'segura';
      p.armF = L(1.0, 1.6); p.handF = 'punho';
      return p;
    },
    expr: 'concentrado',
    propN: 'pincel',
  },
  deitado: {
    loop: true,
    grounded: false,
    fn: (t) => {
      const p = P({ rot: -PI / 2, head: -0.05 });
      p.armN = L(0.2, 0.2); p.armF = L(0.15, 0.2);
      p.y += S(t * 1.2) * 1.5;
      return p;
    },
    expr: 'dormindo',
  },
  deitadoDoente: {
    loop: true,
    grounded: false,
    fn: (t) => {
      const p = P({ rot: -PI / 2 + 0.1, head: -0.1 });
      p.armN = L(0.3, 0.3);
      p.y += S(t * 1.2) * 1;
      return p;
    },
    expr: 'doente',
  },
  sentarChao: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: -0.04 });
      p.legN = L(1.35, 2.4); p.legF = L(1.25, 2.5);
      p.armN = L(0.35, 0.6); p.armF = L(0.3, 0.6);
      return breathe(p, t);
    },
  },
  engatinhar: {
    loop: true,
    grounded: false,
    fn: (t) => {
      const ph = t * PI * 2 * 1.2;
      const p = P({ rot: 1.25, y: 0, lean: 0 });
      p.head = -1.0;
      p.armN = L(-1.25 + S(ph) * 0.35, 0.1); p.armF = L(-1.25 - S(ph) * 0.35, 0.1);
      p.legN = L(-0.2 - S(ph) * 0.3, 1.4); p.legF = L(-0.2 + S(ph) * 0.3, 1.4);
      return p;
    },
    expr: 'alegre',
  },
  meditar: {
    loop: true,
    grounded: false,
    fn: (t) => {
      const p = P({ y: -20 + S(t * 1.5) * 8 });
      p.legN = L(1.45, 2.75); p.legF = L(1.35, 2.8);
      p.armN = L(0.5, 0.7); p.armF = L(0.45, 0.75);
      p.handN = 'aberta'; p.handF = 'aberta';
      p.head = 0.05;
      return p;
    },
    expr: 'dormindo',
  },
  ajoelhar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.05 });
      p.legN = L(0.05, PI / 2 + 0.05); p.legF = L(1.4, 1.45);
      p.footN = 0.6;
      p.armN = L(1.35, 0.4); p.handN = 'segura';
      p.armF = L(0.4, 0.8);
      return breathe(p, t);
    },
    expr: 'envergonhado',
    propN: 'anel',
  },
  agachar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.35 });
      p.legN = L(1.0, 2.0); p.legF = L(0.9, 1.9);
      p.armN = L(0.9, 0.4); p.armF = L(0.8, 0.5);
      return breathe(p, t);
    },
  },
  // ------------------------------------------------ atividades
  levantarPeso: {
    loop: true,
    fn: (t) => {
      const k = (S(t * 3.2) + 1) / 2;
      const p = P({ y: k * 3 });
      p.armN = L(PI - 0.15 - k * 0.2, 0.2 + k * 1.8); p.armF = L(PI - 0.1 - k * 0.2, 0.25 + k * 1.8);
      p.handN = 'segura'; p.handF = 'segura';
      p.legN = L(0.18, 0.1 + k * 0.2); p.legF = L(-0.18, 0.1 + k * 0.2);
      return p;
    },
    expr: 'determinado',
    propN: 'haltere',
  },
  rosca: {
    loop: true,
    fn: (t) => {
      const k = (S(t * 3.5) + 1) / 2;
      const p = breathe(P(), t);
      p.armN = L(0.15, 0.2 + k * 2.2); p.handN = 'segura';
      p.armF = L(0.1, 0.2 + (1 - k) * 2.2); p.handF = 'segura';
      return p;
    },
    expr: 'concentrado',
    propN: 'haltere',
    propF: 'haltere',
  },
  telefone: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.1 + S(t * 1.3) * 0.04 }), t);
      p.armN = L(0.75, 2.55); p.handN = 'segura';
      p.armF = L(0.35, 1.4);
      return p;
    },
    propN: 'celular',
  },
  mexerCelular: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.28 }), t);
      p.armN = L(0.9, 1.6); p.handN = 'segura';
      p.armF = L(0.95, 1.5 + S(t * 6) * 0.08);
      return p;
    },
    propN: 'celular',
    expr: 'concentrado',
  },
  ler: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.22 }), t);
      p.armN = L(0.85, 1.5); p.handN = 'segura';
      p.armF = L(0.9, 1.45);
      return p;
    },
    propN: 'livro',
    expr: 'concentrado',
  },
  lerSentado: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ head: 0.22 }));
      p.armN = L(0.9, 1.4); p.handN = 'segura';
      p.armF = L(0.95, 1.35);
      return breathe(p, t);
    },
    propN: 'livro',
    expr: 'concentrado',
  },
  beber: {
    loop: true,
    fn: (t) => {
      const k = (S(t * 1.5) + 1) / 2;
      const p = breathe(P({ head: -k * 0.12 }), t);
      p.armN = L(0.6 + k * 0.3, 1.2 + k * 1.2); p.handN = 'segura';
      return p;
    },
    propN: 'bebida',
  },
  cafe: {
    loop: true,
    fn: (t) => {
      const k = Math.max(0, S(t * 1.2));
      const p = breathe(P({ head: -k * 0.1 }), t);
      p.armN = L(0.6 + k * 0.3, 1.3 + k * 1.1); p.handN = 'segura';
      return p;
    },
    propN: 'xicara',
    expr: 'feliz',
  },
  comer: {
    loop: true,
    fn: (t) => {
      const k = Math.max(0, S(t * 2.4));
      const p = sit(P({ lean: 0.08 }));
      p.armN = L(0.8 + k * 0.2, 1.0 + k * 1.5); p.handN = 'segura';
      p.armF = L(0.9, 0.7);
      return p;
    },
    propN: 'garfo',
    expr: 'feliz',
  },
  cantar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: -0.06 + S(t * 2) * 0.04, head: -0.15 });
      p.armN = L(0.95, 2.1); p.handN = 'segura';
      p.armF = L(1.6 + S(t * 2) * 0.5, 0.25); p.handF = 'acena';
      p.y = -Math.abs(S(t * 4)) * 3;
      return p;
    },
    propN: 'microfone',
    expr: 'alegre',
  },
  tocarViolao: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.12 + S(t * 4) * 0.05 }), t);
      p.armF = L(1.15, 0.5); p.handF = 'segura';
      p.armN = L(0.55 + S(t * 14) * 0.12, 1.25); p.handN = 'punho';
      return p;
    },
    propF: 'violao',
    expr: 'feliz',
  },
  cozinhar: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ lean: 0.08, head: 0.2 }), t);
      p.armN = L(1.0 + S(t * 5) * 0.2, 0.8 + C(t * 5) * 0.3); p.handN = 'segura';
      p.armF = L(0.6, 1.5);
      return p;
    },
    propN: 'garfo',
    expr: 'concentrado',
  },
  pintar: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: -0.05 }), t);
      p.armN = L(1.6 + S(t * 4) * 0.25, 0.4 + C(t * 4) * 0.2); p.handN = 'segura';
      p.armF = L(0.5, 1.5);
      return p;
    },
    propN: 'pincel',
    expr: 'concentrado',
  },
  segurarBebe: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ head: 0.3, x: S(t * 1.4) * 3 }), t);
      p.armN = L(0.42 + S(t * 1.4) * 0.04, 1.3); p.armF = L(0.55, 1.2);
      return p;
    },
    expr: 'apaixonado',
  },
  varrer: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ lean: 0.1 }), t);
      p.armN = L(0.7 + S(t * 4) * 0.3, 0.6); p.handN = 'segura';
      p.armF = L(0.9 + S(t * 4) * 0.3, 1.0);
      return p;
    },
    propN: 'vassoura',
  },
  dirigir: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: 0.02 }));
      p.armN = L(1.2 + S(t * 1.5) * 0.05, 0.4); p.armF = L(1.25 - S(t * 1.5) * 0.05, 0.4);
      p.handN = 'punho'; p.handF = 'punho';
      return p;
    },
    expr: 'concentrado',
  },
  jogarVideogame: {
    loop: true,
    fn: (t) => {
      const p = sit(P({ lean: 0.12, x: S(t * 5) * 2 }));
      p.armN = L(0.95, 1.4 + S(t * 11) * 0.1); p.handN = 'segura';
      p.armF = L(0.95, 1.4 - S(t * 11) * 0.1);
      return p;
    },
    propN: 'controle',
    expr: 'concentrado',
  },
  dormirEmPe: {
    loop: true,
    fn: (t) => {
      const p = P({ head: 0.3 + S(t * 0.8) * 0.05, lean: 0.05 });
      return p;
    },
    expr: 'dormindo',
  },
  empurrarCarrinho: {
    loop: true,
    fn: (t, c) => {
      const p = walkCycle(t, c, 0.35, 0.6, 0, 0.15);
      p.armN = L(1.2, 0.3); p.armF = L(1.25, 0.25);
      p.handN = 'punho'; p.handF = 'punho';
      return p;
    },
  },
  // ------------------------------------------------ ações (não repetem)
  soco: {
    loop: false,
    dur: 0.8,
    fn: keyframes([
      [0, { lean: 0 }],
      [0.22, { lean: -0.12, armN: L(0.3, 2.3), armF: L(0.8, 2.1), handN: 'punho', handF: 'punho', legN: L(0.2, 0.2), legF: L(-0.25, 0.2) }, Ease.outQuad],
      [0.32, { lean: 0.3, x: 12, armN: L(1.55, 0.02), armF: L(0.7, 2.2), handN: 'punho', handF: 'punho', legN: L(0.45, 0.3), legF: L(-0.35, 0.1) }, Ease.inQuad],
      [0.5, { lean: 0.28, x: 12, armN: L(1.5, 0.05), armF: L(0.7, 2.2), handN: 'punho', handF: 'punho', legN: L(0.45, 0.3), legF: L(-0.35, 0.1) }],
      [0.8, { lean: 0.05, armN: L(0.9, 2.1), armF: L(0.8, 2.2), handN: 'punho', handF: 'punho' }],
    ]),
    events: [{ t: 0.32, name: 'hit' }],
    expr: 'furioso',
  },
  tapa: {
    loop: false,
    dur: 0.75,
    fn: keyframes([
      [0, {}],
      [0.25, { lean: -0.08, armF: L(2.3, 0.5), handF: 'aberta' }, Ease.outQuad],
      [0.34, { lean: 0.18, armF: L(1.1, 0.15), handF: 'aberta' }, Ease.inQuad],
      [0.75, { lean: 0.02, armF: L(0.3, 0.3) }],
    ]),
    events: [{ t: 0.33, name: 'slap' }],
    expr: 'bravo',
  },
  chute: {
    loop: false,
    dur: 0.8,
    fn: keyframes([
      [0, {}],
      [0.2, { lean: 0.1, legN: L(-0.4, 1.2), armN: L(-0.5, 1), armF: L(0.6, 1.2) }],
      [0.32, { lean: -0.25, legN: L(1.5, 0.05), armN: L(-0.9, 0.6), armF: L(1.2, 1.0), footN: -0.3 }, Ease.inQuad],
      [0.5, { lean: -0.2, legN: L(1.4, 0.1), armN: L(-0.9, 0.6), armF: L(1.2, 1.0) }],
      [0.8, {}],
    ]),
    events: [{ t: 0.32, name: 'hit' }],
    expr: 'furioso',
  },
  empurrar: {
    loop: false,
    dur: 0.8,
    fn: keyframes([
      [0, {}],
      [0.2, { lean: -0.05, armN: L(0.9, 1.9), armF: L(0.95, 1.85) }],
      [0.32, { lean: 0.32, x: 14, armN: L(1.5, 0.1), armF: L(1.45, 0.15), legN: L(0.4, 0.2), legF: L(-0.35, 0.1) }, Ease.inQuad],
      [0.8, { lean: 0.05 }],
    ]),
    events: [{ t: 0.32, name: 'push' }],
    expr: 'bravo',
  },
  abracar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.1, head: 0.18 + S(t * 1.5) * 0.03, x: S(t * 1.5) * 1.5 });
      p.armN = L(1.25, 1.05); p.armF = L(1.2, 1.2);
      return p;
    },
    expr: 'apaixonado',
  },
  abracarTras: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.08, head: 0.22 + S(t * 1.5) * 0.03, x: S(t * 1.5) * 1.5 });
      p.armN = L(1.05, 0.95); p.armF = L(0.95, 1.05);
      return p;
    },
    expr: 'apaixonado',
  },
  beijarTras: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.18, head: 0.1 });
      p.armN = L(0.9, 0.9); p.armF = L(0.85, 1.0);
      p.y = S(t) * 0.5;
      return p;
    },
    expr: 'beijo',
  },
  beijar: {
    loop: true,
    fn: (t) => {
      const p = P({ lean: 0.2, head: 0.12 });
      p.armN = L(1.2, 1.1); p.armF = L(1.0, 1.3);
      p.legF = L(-0.1, 0.4); p.footF = 0.5;
      p.y = S(t) * 0.5;
      return p;
    },
    expr: 'beijo',
  },
  highFive: {
    loop: false,
    dur: 1.0,
    fn: keyframes([
      [0, {}],
      [0.3, { armF: L(2.4, 0.6), handF: 'aberta', lean: -0.04 }, Ease.outBack],
      [0.42, { armF: L(2.1, 0.15), handF: 'aberta', lean: 0.1 }, Ease.inQuad],
      [0.7, { armF: L(2.2, 0.2), handF: 'aberta', lean: 0.05 }],
      [1.0, {}],
    ]),
    events: [{ t: 0.42, name: 'clap' }],
    expr: 'alegre',
  },
  apertoMao: {
    loop: true,
    fn: (t) => {
      const p = breathe(P({ lean: 0.06 }), t);
      p.armN = L(1.15 + S(t * 9) * 0.1, 0.25); p.handN = 'punho';
      return p;
    },
    expr: 'feliz',
  },
  cair: {
    loop: false,
    dur: 1.2,
    grounded: false,
    fn: keyframes([
      [0, {}],
      [0.2, { lean: -0.25, armN: L(2.2, 0.3), armF: L(2.4, 0.3), handN: 'acena', handF: 'acena' }],
      [0.6, { rot: -1.45, y: 40, head: -0.1, armN: L(2.6, 0.2), armF: L(2.2, 0.3) }, Ease.inQuad],
      [0.75, { rot: -1.5, y: 44, head: 0.1, armN: L(2.4, 0.2), armF: L(2.0, 0.3), legN: L(0.5, 0.4) }, Ease.outBounce],
      [1.2, { rot: -1.52, y: 46, head: 0.05, armN: L(2.3, 0.2), armF: L(2.0, 0.3), legN: L(0.3, 0.2) }],
    ]),
    events: [{ t: 0.62, name: 'thud' }],
    expr: 'tonto',
  },
  pular: {
    loop: false,
    dur: 0.9,
    grounded: false,
    fn: keyframes([
      [0, {}],
      [0.2, { y: 14, sy: 0.9, sx: 1.07, lean: 0.12, armN: L(-0.6, 0.5), armF: L(-0.6, 0.5), legN: L(0.6, 1.2), legF: L(0.5, 1.1) }, Ease.outQuad],
      [0.45, { y: -80, sy: 1.08, sx: 0.95, armN: L(-2.6, 0.2), armF: L(2.7, 0.2), legN: L(0.3, 0.8), legF: L(-0.1, 1.0) }, Ease.outCubic],
      [0.7, { y: 0, sy: 1.02, armN: L(-1.8, 0.4), armF: L(1.8, 0.4) }, Ease.inCubic],
      [0.78, { y: 10, sy: 0.9, sx: 1.08, legN: L(0.5, 1.0), legF: L(0.4, 0.9) }, Ease.outQuad],
      [0.9, {}],
    ]),
    events: [{ t: 0.2, name: 'jump' }, { t: 0.72, name: 'land' }],
    expr: 'alegre',
  },
  reverencia: {
    loop: false,
    dur: 1.4,
    fn: keyframes([
      [0, {}],
      [0.5, { lean: 0.85, head: 0.2, armN: L(0.9, 0.5), armF: L(0.2, 1.2) }],
      [0.9, { lean: 0.85, head: 0.2, armN: L(0.9, 0.5), armF: L(0.2, 1.2) }],
      [1.4, {}],
    ]),
    expr: 'feliz',
  },
  jogarChapeu: {
    loop: false,
    dur: 1.0,
    fn: keyframes([
      [0, {}],
      [0.25, { y: 8, armF: L(0.2, 1.8), armN: L(0.2, 1.8), handF: 'punho', handN: 'punho' }],
      [0.45, { y: -20, armF: L(2.9, 0.1), armN: L(-2.8, 0.1), handF: 'acena', handN: 'acena' }, Ease.outBack],
      [1.0, { armF: L(2.5, 0.3), armN: L(-2.4, 0.3), handF: 'acena', handN: 'acena' }],
    ]),
    events: [{ t: 0.42, name: 'throw' }],
    expr: 'alegre',
  },
  soprar: {
    loop: false,
    dur: 1.2,
    fn: keyframes([
      [0, {}],
      [0.4, { lean: -0.1, head: -0.15 }],
      [0.6, { lean: 0.35, head: 0.1, armN: L(0.4, 0.8), armF: L(0.35, 0.8) }, Ease.outQuad],
      [1.2, { lean: 0.05 }],
    ]),
    events: [{ t: 0.6, name: 'blow' }],
    expr: 'beijo',
  },
  bater: {
    loop: false,
    dur: 0.6,
    fn: keyframes([
      [0, {}],
      [0.2, { armN: L(2.2, 0.8), handN: 'segura' }],
      [0.3, { armN: L(1.2, 0.3), handN: 'segura', lean: 0.1 }, Ease.inQuad],
      [0.6, { armN: L(1.3, 0.5), handN: 'segura' }],
    ]),
    events: [{ t: 0.3, name: 'bang' }],
    propN: 'martelo',
    expr: 'determinado',
  },
  estremecer: {
    loop: false,
    dur: 0.6,
    fn: (t) => {
      const p = P({ lean: -0.18 * (1 - t / 0.6), x: -S(t * 60) * 4 * (1 - t / 0.6) });
      p.armN = L(0.6, 1.6); p.armF = L(0.5, 1.5);
      return p;
    },
    expr: 'tonto',
  },
  entregar: {
    loop: false,
    dur: 1.0,
    fn: keyframes([
      [0, { armN: L(0.3, 1.2), handN: 'segura' }],
      [0.45, { lean: 0.12, armN: L(1.4, 0.2), handN: 'segura' }, Ease.outBack],
      [0.8, { lean: 0.1, armN: L(1.35, 0.25), handN: 'segura' }],
      [1.0, { armN: L(1.2, 0.3), handN: 'segura' }],
    ]),
    events: [{ t: 0.5, name: 'give' }],
    expr: 'feliz',
  },
};

export type MotionName = keyof typeof MOTIONS;

/** Ajusta a altura da pelve para manter o pé mais baixo no chão. */
export function groundDrop(p: Pose, thigh: number, shin: number): number {
  const ext = (l: Limb) => thigh * Math.cos(l.a) + shin * Math.cos(l.a - l.b);
  const e = Math.max(ext(p.legN), ext(p.legF));
  return thigh + shin - e;
}

export type { Hand };
