import { Appearance } from './appearance';
import { Dims, Pose, Pt } from './rig';
import { Face } from './expressions';
import { Pal } from './palette';
import { Ctx, Shading } from '../render/draw';

/** Contexto de renderização compartilhado por todas as partes do personagem. */
export interface RC {
  ctx: Ctx;
  ap: Appearance;
  d: Dims;
  pose: Pose;
  face: Face;
  pal: Pal;
  turn: number;
  lx: number; // lado da luz no espaço local (-1 esquerda, 1 direita)
  sh: Shading; // deslocamento de sombreamento de partes grandes
  shS: Shading; // partes pequenas
  lw: number; // espessura do contorno
  t: number;
  lookX: number;
  lookY: number;
  blink: number;
  talk: number;
  sway: number;
  swayV: number;
  // geometria (quadro da pelve, y para baixo)
  lean: number;
  shoulderN: Pt;
  shoulderF: Pt;
  neck: Pt;
  headAng: number;
  head: Pt;
  hipN: Pt;
  hipF: Pt;
  handN?: Pt;
  handF?: Pt;
  handAngN: number;
  handAngF: number;
  propN?: string;
  propF?: string;
  seed: number;
}

export interface TopSpec {
  sleeve: 0 | 1 | 2 | 3; // nenhuma, curta, longa, longa e larga
  neck: 'crew' | 'v' | 'scoop' | 'collar' | 'turtle' | 'hood' | 'deepV' | 'boat';
  len: number; // extensão abaixo do quadril (fração do tronco); negativo = cropped
  inset: number; // alças (0 = ombros cobertos)
  open?: 'blazer' | 'jacket' | 'coat'; // peça aberta sobre camiseta interna
  dress?: number; // comprimento da saia do vestido (fração da perna), 0 = sem
  flare?: number;
  forceBottom?: string;
  forceBottomColor?: string;
}

export const TOP_SPECS: Record<string, TopSpec> = {
  camiseta: { sleeve: 1, neck: 'crew', len: 0.1, inset: 0 },
  mangaLonga: { sleeve: 2, neck: 'crew', len: 0.1, inset: 0 },
  regata: { sleeve: 0, neck: 'scoop', len: 0.1, inset: 0.5 },
  moletom: { sleeve: 2, neck: 'hood', len: 0.16, inset: 0 },
  camisa: { sleeve: 2, neck: 'collar', len: 0.12, inset: 0 },
  polo: { sleeve: 1, neck: 'collar', len: 0.1, inset: 0 },
  sueter: { sleeve: 2, neck: 'crew', len: 0.12, inset: 0 },
  blazer: { sleeve: 2, neck: 'deepV', len: 0.16, inset: 0, open: 'blazer' },
  jaqueta: { sleeve: 2, neck: 'v', len: 0.08, inset: 0, open: 'jacket' },
  vestido: { sleeve: 0, neck: 'scoop', len: 0.1, inset: 0.42, dress: 0.55, flare: 0.35 },
  cropped: { sleeve: 1, neck: 'scoop', len: -0.22, inset: 0 },
  // contextuais
  jaleco: { sleeve: 2, neck: 'v', len: 0.2, inset: 0, open: 'coat', dress: 0.45, flare: 0.15 },
  camisola: { sleeve: 1, neck: 'boat', len: 0.1, inset: 0, dress: 0.6, flare: 0.25 },
  presidiario: { sleeve: 1, neck: 'v', len: 0.1, inset: 0, forceBottom: 'calca', forceBottomColor: '#f07a1e' },
  beca: { sleeve: 3, neck: 'v', len: 0.1, inset: 0, dress: 0.75, flare: 0.3 },
  body: { sleeve: 1, neck: 'crew', len: 0.12, inset: 0, forceBottom: 'fralda' },
  pijama: { sleeve: 2, neck: 'collar', len: 0.12, inset: 0, forceBottom: 'moletom' },
  noiva: { sleeve: 0, neck: 'boat', len: 0.1, inset: 0.3, dress: 1.0, flare: 0.9 },
  smoking: { sleeve: 2, neck: 'deepV', len: 0.16, inset: 0, open: 'blazer' },
  esporte: { sleeve: 0, neck: 'scoop', len: 0.1, inset: 0.45, forceBottom: 'bermuda' },
  uniforme: { sleeve: 1, neck: 'collar', len: 0.1, inset: 0 },
  policial: { sleeve: 1, neck: 'collar', len: 0.12, inset: 0, forceBottom: 'calca', forceBottomColor: '#1d2a44' },
  chef: { sleeve: 2, neck: 'turtle', len: 0.18, inset: 0 },
  banho: { sleeve: 0, neck: 'scoop', len: -0.2, inset: 0.55, forceBottom: 'sunga' },
  /** sem roupa (banho no modo Explorar, SÓ adultos): tronco de pele lisa, sem detalhes íntimos (estilo boneco) */
  nu: { sleeve: 0, neck: 'scoop', len: 0, inset: 0, forceBottom: 'nu' },
};
