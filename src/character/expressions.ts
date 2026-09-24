import { lerp } from '../core/math';

/** Parâmetros faciais contínuos (interpoláveis) + marcadores discretos. */
export interface Face {
  browIn: number; // + levanta a parte interna (tristeza/preocupação), - desce (raiva)
  browUp: number; // eleva sobrancelha inteira
  lidTop: number; // 0 aberto .. 1 fechado
  lidBot: number; // elevação da pálpebra inferior (sorriso nos olhos / desconfiança)
  smile: number; // -1 triste .. 1 sorriso
  open: number; // abertura da boca 0..1
  wide: number; // largura extra da boca
  teeth: number; // 0..1 dentes visíveis
  tongue: number;
  pupil: number; // escala da pupila
  asym: number; // sorriso de canto
  pucker: number; // bico de beijo
  // discretos
  happyEyes: boolean; // olhos ^ ^
  tears: boolean;
  blush: number;
  sweat: boolean;
  heartEyes: boolean;
  anger: boolean;
  dizzy: boolean;
  sparkle: boolean;
}

export const NEUTRAL: Face = {
  browIn: 0, browUp: 0, lidTop: 0.02, lidBot: 0, smile: 0.04, open: 0, wide: 0, teeth: 0, tongue: 0, pupil: 1, asym: 0, pucker: 0,
  happyEyes: false, tears: false, blush: 0, sweat: false, heartEyes: false, anger: false, dizzy: false, sparkle: false,
};

const E = (p: Partial<Face>): Face => ({ ...NEUTRAL, ...p });

export const EXPRESSIONS = {
  neutro: E({}),
  feliz: E({ smile: 0.75, lidBot: 0.18, browUp: 0.12 }),
  alegre: E({ smile: 1, open: 0.45, teeth: 1, tongue: 0.4, happyEyes: true, browUp: 0.3, blush: 0.3 }),
  rindo: E({ smile: 1, open: 0.8, teeth: 1, tongue: 0.7, happyEyes: true, browUp: 0.35, blush: 0.4 }),
  triste: E({ smile: -0.6, browIn: 0.7, lidTop: 0.3, pupil: 1.1 }),
  chorando: E({ smile: -0.9, open: 0.35, browIn: 0.9, lidTop: 0.55, tears: true, blush: 0.25 }),
  bravo: E({ smile: -0.45, browIn: -0.9, lidTop: 0.28, lidBot: 0.15, teeth: 0.3, open: 0.1, pupil: 0.85 }),
  furioso: E({ smile: -0.6, browIn: -1, lidTop: 0.2, open: 0.45, teeth: 1, wide: 0.3, anger: true, pupil: 0.7 }),
  surpreso: E({ smile: 0, open: 0.7, browUp: 0.8, lidTop: -0.12, pupil: 0.8, wide: -0.35 }),
  assustado: E({ smile: -0.4, open: 0.55, browUp: 0.6, browIn: 0.6, lidTop: -0.1, pupil: 0.65, sweat: true, teeth: 0.4 }),
  apaixonado: E({ smile: 0.8, lidTop: 0.25, lidBot: 0.15, blush: 0.9, heartEyes: true, browUp: 0.2 }),
  convencido: E({ smile: 0.5, asym: 0.8, lidTop: 0.35, browUp: 0.1, browIn: -0.2 }),
  cansado: E({ smile: -0.15, lidTop: 0.6, browIn: 0.3 }),
  doente: E({ smile: -0.4, lidTop: 0.5, browIn: 0.5, sweat: true, blush: 0.2 }),
  enojado: E({ smile: -0.5, asym: -0.5, lidTop: 0.35, lidBot: 0.3, browIn: -0.5, teeth: 0.4, open: 0.12 }),
  pensativo: E({ smile: 0, asym: 0.4, lidTop: 0.22, browUp: 0.25, browIn: 0.3 }),
  dormindo: E({ smile: 0.1, lidTop: 1 }),
  beijo: E({ smile: 0.2, pucker: 1, lidTop: 0.85, blush: 0.6 }),
  aconchego: E({ smile: 0.5, happyEyes: true, lidTop: 0.2, blush: 0.45, browIn: 0.15, browUp: 0.12 }), // olhos fechados e sorriso calmo (abraço)
  determinado: E({ smile: 0.25, browIn: -0.5, lidTop: 0.18, asym: 0.2 }),
  envergonhado: E({ smile: 0.35, lidTop: 0.3, browIn: 0.4, blush: 1, sweat: true }),
  tonto: E({ smile: -0.2, open: 0.3, dizzy: true, browIn: 0.4 }),
  encantado: E({ smile: 0.9, open: 0.3, teeth: 1, sparkle: true, browUp: 0.4, pupil: 1.3 }),
  concentrado: E({ smile: -0.05, browIn: -0.35, lidTop: 0.25, asym: -0.15 }),
  dor: E({ smile: -0.55, browIn: 0.85, lidTop: 0.55, lidBot: 0.3, open: 0.22, teeth: 1, wide: 0.25, sweat: true, pupil: 0.8 }),
  ofegante: E({ smile: -0.15, open: 0.5, browIn: 0.35, lidTop: 0.3, tongue: 0.2, sweat: true, blush: 0.4 }),
  humilhado: E({ smile: -0.35, browIn: 0.7, lidTop: 0.45, blush: 1, sweat: true, pupil: 0.9 }),
  desprezo: E({ smile: 0.15, asym: -0.9, lidTop: 0.42, lidBot: 0.15, browIn: -0.45 }),
  chocado: E({ smile: -0.25, open: 0.6, browUp: 0.95, lidTop: -0.15, pupil: 0.55, wide: -0.2 }),
  serio: E({ smile: -0.12, browIn: -0.2, lidTop: 0.15 }),
  gritando: E({ smile: -0.3, open: 1, teeth: 0.6, tongue: 0.5, browIn: -0.8, wide: 0.2, anger: true }),
  // Sorriso enviesado para comentário irônico.
  sarcastico: E({ asym: 0.75, smile: 0.22, lidTop: 0.34, browUp: 0.25, browIn: -0.12 }),
  // Olhar estreito de quem ouviu uma promessa improvável.
  desconfiado: E({ smile: -0.05, lidTop: 0.16, lidBot: 0.3, browIn: 0.18, browUp: 0.12, pupil: 0.92 }),
  // Tensão baixando depois de uma notícia boa.
  aliviado: E({ smile: 0.42, lidTop: 0.3, browIn: 0.12, browUp: 0.12, blush: 0.12 }),
  // Reação de enjoo sem transformar o mal-estar em piada.
  enjoado: E({ smile: -0.62, open: 0.12, lidTop: 0.4, browIn: 0.48, asym: -0.25, sweat: true }),
  // Cansaço pesado, sem sorriso.
  derrotado: E({ smile: -0.72, lidTop: 0.58, browIn: 0.72, browUp: 0.08, asym: -0.12 }),
} satisfies Record<string, Face>;

export type ExprName = keyof typeof EXPRESSIONS;

const NUM: (keyof Face)[] = ['browIn', 'browUp', 'lidTop', 'lidBot', 'smile', 'open', 'wide', 'teeth', 'tongue', 'pupil', 'asym', 'pucker', 'blush'];

export function blendFace(a: Face, b: Face, t: number, out: Face = { ...a }): Face {
  for (const k of NUM) (out as any)[k] = lerp(a[k] as number, b[k] as number, t);
  const d = t < 0.5 ? a : b;
  out.happyEyes = d.happyEyes; out.tears = d.tears; out.sweat = d.sweat; out.heartEyes = d.heartEyes;
  out.anger = d.anger; out.dizzy = d.dizzy; out.sparkle = d.sparkle;
  return out;
}
