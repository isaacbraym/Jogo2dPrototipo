import { RNG } from '../core/rng';
import { mix, hueShift } from '../core/color';
import { clamp } from '../core/math';

export type Sex = 'm' | 'f';

export interface Appearance {
  sex: Sex;
  // corpo
  height: number; // 0..1
  weight: number; // porte 0 magro .. 1 pesado
  muscle: number;
  shoulders: number;
  hips: number;
  chest: number;
  legLength: number;
  neckLength: number;
  neckWidth: number;
  // cabeça
  faceShape: string;
  faceWidth: number;
  faceHeight: number;
  jaw: number;
  chin: number;
  cheeks: number;
  // pele
  skin: string;
  undertone: 'quente' | 'neutro' | 'frio';
  freckles: number;
  moles: number; // 0..1 → quantidade de pintas
  blush: number;
  tattoo?: string; // desenho no braço
  scar?: string; // cicatriz no rosto
  // olhos
  eyeShape: string;
  eyeSize: number;
  eyeSpacing: number;
  eyeHeight: number;
  eyeTilt: number;
  iris: string;
  pupil: number;
  lashes: number;
  lids: number; // peso da pálpebra
  // sobrancelhas
  browStyle: string;
  browThickness: number;
  browLength: number;
  browCurve: number;
  browHeight: number;
  browColor: string;
  // nariz
  noseStyle: string;
  noseSize: number;
  noseWidth: number;
  noseHeight: number;
  // boca
  mouthStyle: string;
  mouthWidth: number;
  lipFullness: number;
  lipColor: string;
  mouthHeight: number;
  // orelhas
  earStyle: string;
  earSize: number;
  // cabelo
  hairStyle: string;
  hairColor: string;
  hairHighlight: string; // '' = sem mechas
  hairVolume: number;
  facialHair: string;
  facialHairColor: string;
  // maquiagem
  eyeshadow: string; // '' = nenhuma
  lipstick: number; // 0..1 intensidade
  // roupas
  top: string;
  topColor: string;
  topColor2: string;
  topPattern: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  // acessórios
  glasses: string;
  glassesColor: string;
  hat: string;
  hatColor: string;
  earrings: string;
  necklace: string;
  accColor: string;
}

export interface Opt {
  id: string;
  name: string;
  sex?: Sex; // tendência (não restrição)
}

export const SKIN_TONES = [
  '#fde3d3', '#f9d4bd', '#f3c6a5', '#ecb994', '#e0a87e', '#d4996c', '#c68a5c', '#b87a4e',
  '#a86b42', '#965b37', '#824c2e', '#6f3f26', '#5d3420', '#4b2a1b', '#3c2217', '#f0c9b4',
];
export const HAIR_COLORS = [
  '#16110f', '#2a1c16', '#3d281c', '#5a3a24', '#7a4f2e', '#9a6a3c', '#b8864c', '#d6ae6a', '#ecd49a', '#f4e6c4',
  '#8e3a1c', '#b24a1f', '#d0692e', '#7d7d82', '#c9c9cc', '#f2f2ee', '#2d4a8a', '#5c3fa0', '#d24b8a', '#2f8f7e', '#e2566b',
];
export const EYE_COLORS = ['#3b2314', '#5b3a1e', '#7a5230', '#8e6a2f', '#6b7a3a', '#3f7a4a', '#2f6fa8', '#5aa0d6', '#6f8390', '#8a8f96', '#7a5aa6', '#b0802a'];
export const LIP_COLORS = ['#c9786f', '#b8635b', '#d98a86', '#a2524c', '#8d4640', '#e59a92', '#c45a6a', '#7a3a36'];
export const CLOTH_COLORS = [
  '#f4f1ea', '#23242b', '#3b4a6b', '#1f3f7a', '#3d7bd9', '#5ec3e8', '#2f8f6f', '#6fbf6a', '#c9d94f', '#f2c14e',
  '#f39237', '#e4572e', '#c2273d', '#e86a92', '#f4b6c8', '#9b5de5', '#5b3c88', '#7a5236', '#c8a27a', '#8a8f98',
  '#5a6470', '#e8d5b0', '#0f7173', '#b5446e',
];
export const MAKEUP_COLORS = ['#b86b8f', '#8a5cc0', '#4f7ac7', '#c79a5b', '#6d4b3b', '#d86a6a', '#3aa39a', '#2b2b35'];

export const FACE_SHAPES: Opt[] = [
  { id: 'oval', name: 'Oval' },
  { id: 'redondo', name: 'Redondo' },
  { id: 'quadrado', name: 'Quadrado' },
  { id: 'coracao', name: 'Coração' },
  { id: 'longo', name: 'Alongado' },
  { id: 'diamante', name: 'Diamante' },
  { id: 'triangulo', name: 'Triangular' },
];
export const EYE_SHAPES: Opt[] = [
  { id: 'amendoa', name: 'Amêndoa' },
  { id: 'redondo', name: 'Redondo' },
  { id: 'encapuzado', name: 'Encapuzado' },
  { id: 'elevado', name: 'Elevado' },
  { id: 'caido', name: 'Caído' },
  { id: 'monolid', name: 'Monopálpebra' },
  { id: 'grande', name: 'Grande' },
  { id: 'estreito', name: 'Estreito' },
];
export const BROW_STYLES: Opt[] = [
  { id: 'suave', name: 'Suave' },
  { id: 'reta', name: 'Reta' },
  { id: 'arqueada', name: 'Arqueada' },
  { id: 'grossa', name: 'Grossa' },
  { id: 'fina', name: 'Fina' },
  { id: 'angulada', name: 'Angulada' },
  { id: 'cerrada', name: 'Cerrada' },
  { id: 'arredondada', name: 'Arredondada' },
];
export const NOSE_STYLES: Opt[] = [
  { id: 'botao', name: 'Botão' },
  { id: 'reto', name: 'Reto' },
  { id: 'redondo', name: 'Redondo' },
  { id: 'fino', name: 'Fino' },
  { id: 'largo', name: 'Largo' },
  { id: 'aquilino', name: 'Aquilino' },
  { id: 'arrebitado', name: 'Arrebitado' },
  { id: 'pequeno', name: 'Pequeno' },
];
export const MOUTH_STYLES: Opt[] = [
  { id: 'media', name: 'Média' },
  { id: 'carnuda', name: 'Carnuda' },
  { id: 'fina', name: 'Fina' },
  { id: 'larga', name: 'Larga' },
  { id: 'coracao', name: 'Coração' },
  { id: 'pequena', name: 'Pequena' },
];
export const EAR_STYLES: Opt[] = [
  { id: 'redonda', name: 'Redonda' },
  { id: 'pequena', name: 'Pequena' },
  { id: 'grande', name: 'Grande' },
  { id: 'pontuda', name: 'Pontuda' },
  { id: 'colada', name: 'Colada' },
];
export const HAIR_STYLES: Opt[] = [
  { id: 'careca', name: 'Careca' },
  { id: 'raspado', name: 'Raspado' },
  { id: 'curto', name: 'Curto', sex: 'm' },
  { id: 'lateral', name: 'Repartido', sex: 'm' },
  { id: 'topete', name: 'Topete', sex: 'm' },
  { id: 'bagunçado', name: 'Bagunçado', sex: 'm' },
  { id: 'cacheadoCurto', name: 'Cacheado curto' },
  { id: 'moicano', name: 'Moicano', sex: 'm' },
  { id: 'blackPower', name: 'Black power' },
  { id: 'coque', name: 'Coque', sex: 'f' },
  { id: 'rabo', name: 'Rabo de cavalo', sex: 'f' },
  { id: 'chanel', name: 'Chanel', sex: 'f' },
  { id: 'pixie', name: 'Pixie', sex: 'f' },
  { id: 'longo', name: 'Longo liso', sex: 'f' },
  { id: 'ondulado', name: 'Longo ondulado', sex: 'f' },
  { id: 'franja', name: 'Longo com franja', sex: 'f' },
  { id: 'mariaChiquinha', name: 'Maria-chiquinha', sex: 'f' },
  { id: 'trancas', name: 'Tranças', sex: 'f' },
  { id: 'dreads', name: 'Dreads' },
  { id: 'medio', name: 'Médio repicado' },
  { id: 'samurai', name: 'Coque samurai', sex: 'm' },
];
export const FACIAL_HAIR: Opt[] = [
  { id: 'nenhum', name: 'Nenhum' },
  { id: 'rala', name: 'Barba rala' },
  { id: 'bigode', name: 'Bigode' },
  { id: 'cavanhaque', name: 'Cavanhaque' },
  { id: 'cheia', name: 'Barba cheia' },
  { id: 'lenhador', name: 'Lenhador' },
  { id: 'costeleta', name: 'Contorno' },
  { id: 'guidao', name: 'Bigode guidão' },
];
export const TOPS: Opt[] = [
  { id: 'camiseta', name: 'Camiseta' },
  { id: 'mangaLonga', name: 'Manga longa' },
  { id: 'regata', name: 'Regata' },
  { id: 'moletom', name: 'Moletom' },
  { id: 'camisa', name: 'Camisa social' },
  { id: 'polo', name: 'Polo' },
  { id: 'sueter', name: 'Suéter' },
  { id: 'blazer', name: 'Terno' },
  { id: 'jaqueta', name: 'Jaqueta' },
  { id: 'vestido', name: 'Vestido', sex: 'f' },
  { id: 'cropped', name: 'Cropped', sex: 'f' },
];
export const PATTERNS: Opt[] = [
  { id: 'liso', name: 'Liso' },
  { id: 'listras', name: 'Listras' },
  { id: 'bolinhas', name: 'Bolinhas' },
  { id: 'xadrez', name: 'Xadrez' },
  { id: 'estampa', name: 'Estampa' },
];
export const BOTTOMS: Opt[] = [
  { id: 'jeans', name: 'Jeans' },
  { id: 'calca', name: 'Calça social' },
  { id: 'moletom', name: 'Moletom' },
  { id: 'bermuda', name: 'Bermuda' },
  { id: 'saia', name: 'Saia', sex: 'f' },
  { id: 'saiaLonga', name: 'Saia longa', sex: 'f' },
  { id: 'legging', name: 'Legging', sex: 'f' },
];
export const SHOES: Opt[] = [
  { id: 'tenis', name: 'Tênis' },
  { id: 'botas', name: 'Botas' },
  { id: 'social', name: 'Sapato social' },
  { id: 'salto', name: 'Salto', sex: 'f' },
  { id: 'sandalia', name: 'Sandália' },
  { id: 'descalco', name: 'Descalço' },
];
export const GLASSES: Opt[] = [
  { id: 'nenhum', name: 'Nenhum' },
  { id: 'redondo', name: 'Redondo' },
  { id: 'quadrado', name: 'Quadrado' },
  { id: 'gatinho', name: 'Gatinho' },
  { id: 'aviador', name: 'Aviador (sol)' },
  { id: 'escuro', name: 'Óculos escuros' },
];
export const HATS: Opt[] = [
  { id: 'nenhum', name: 'Nenhum' },
  { id: 'bone', name: 'Boné' },
  { id: 'gorro', name: 'Gorro' },
  { id: 'chapeu', name: 'Fedora' },
  { id: 'boina', name: 'Boina' },
  { id: 'faixa', name: 'Faixa' },
];
export const EARRINGS: Opt[] = [
  { id: 'nenhum', name: 'Nenhum' },
  { id: 'ponto', name: 'Ponto de luz' },
  { id: 'argola', name: 'Argola' },
  { id: 'gota', name: 'Gota' },
];
export const TATTOOS: Opt[] = [
  { id: 'nenhuma', name: 'Nenhuma' },
  { id: 'coracao', name: 'Coração' },
  { id: 'estrela', name: 'Estrela' },
  { id: 'ancora', name: 'Âncora' },
  { id: 'tribal', name: 'Tribal' },
  { id: 'flor', name: 'Flor' },
];
export const SCARS: Opt[] = [
  { id: 'nenhuma', name: 'Nenhuma' },
  { id: 'sobrancelha', name: 'Sobrancelha' },
  { id: 'bochecha', name: 'Bochecha' },
  { id: 'queixo', name: 'Queixo' },
];
export const NECKLACES: Opt[] = [
  { id: 'nenhum', name: 'Nenhum' },
  { id: 'corrente', name: 'Corrente' },
  { id: 'pingente', name: 'Pingente' },
  { id: 'perolas', name: 'Pérolas' },
];

const pickBias = (r: RNG, opts: Opt[], sex: Sex, biasOther = 0.12) =>
  r.weighted(opts.map((o) => [o.id, !o.sex || o.sex === sex ? 1 : biasOther] as const));

export function defaultAppearance(sex: Sex = 'f'): Appearance {
  const f = sex === 'f';
  return {
    sex,
    height: 0.5, weight: 0.3, muscle: f ? 0.25 : 0.45, shoulders: 0.5, hips: 0.5, chest: f ? 0.5 : 0.2,
    legLength: 0.5, neckLength: 0.5, neckWidth: 0.5,
    faceShape: 'oval', faceWidth: 0.5, faceHeight: 0.5, jaw: 0.5, chin: 0.5, cheeks: 0.5,
    skin: '#e0a87e', undertone: 'quente', freckles: 0, moles: 0, blush: f ? 0.35 : 0.15,
    eyeShape: 'amendoa', eyeSize: 0.5, eyeSpacing: 0.5, eyeHeight: 0.5, eyeTilt: 0.5,
    iris: '#5b3a1e', pupil: 0.5, lashes: f ? 0.75 : 0.3, lids: 0.4,
    browStyle: f ? 'arqueada' : 'reta', browThickness: f ? 0.4 : 0.6, browLength: 0.5, browCurve: 0.5, browHeight: 0.5, browColor: '#2a1c16',
    noseStyle: f ? 'pequeno' : 'reto', noseSize: 0.5, noseWidth: 0.5, noseHeight: 0.5,
    mouthStyle: f ? 'coracao' : 'media', mouthWidth: 0.5, lipFullness: f ? 0.6 : 0.4, lipColor: '#c9786f', mouthHeight: 0.5,
    earStyle: 'redonda', earSize: 0.5,
    hairStyle: f ? 'ondulado' : 'lateral', hairColor: '#3d281c', hairHighlight: '', hairVolume: 0.5,
    facialHair: 'nenhum', facialHairColor: '#3d281c',
    eyeshadow: '', lipstick: 0,
    top: f ? 'cropped' : 'jaqueta', topColor: f ? '#e86a92' : '#3b4a6b', topColor2: '#f4f1ea', topPattern: 'liso',
    bottom: f ? 'jeans' : 'jeans', bottomColor: '#1f3f7a', shoes: 'tenis', shoesColor: '#f4f1ea',
    glasses: 'nenhum', glassesColor: '#23242b', hat: 'nenhum', hatColor: '#c2273d', earrings: f ? 'argola' : 'nenhum', necklace: 'nenhum', accColor: '#f2c14e',
  };
}

export function randomAppearance(r: RNG, sex?: Sex): Appearance {
  const s: Sex = sex ?? (r.chance(0.5) ? 'f' : 'm');
  const f = s === 'f';
  const a = defaultAppearance(s);
  const u = () => clamp(r.gauss(0.5, 0.2), 0, 1);
  a.height = u(); a.weight = clamp(r.gauss(0.32, 0.22), 0, 1); a.muscle = clamp(r.gauss(f ? 0.28 : 0.45, 0.2), 0, 1);
  a.shoulders = u(); a.hips = u(); a.chest = f ? u() : r.range(0, 0.35); a.legLength = u(); a.neckLength = u(); a.neckWidth = u();
  a.faceShape = r.pick(FACE_SHAPES).id; a.faceWidth = u(); a.faceHeight = u(); a.jaw = u(); a.chin = u(); a.cheeks = u();
  a.skin = r.pick(SKIN_TONES); a.undertone = r.pick(['quente', 'neutro', 'frio'] as const);
  a.freckles = r.chance(0.2) ? r.range(0.3, 1) : 0; a.moles = r.chance(0.25) ? r.range(0.2, 1) : 0; a.blush = r.range(0, f ? 0.7 : 0.35);
  a.eyeShape = r.pick(EYE_SHAPES).id; a.eyeSize = u(); a.eyeSpacing = u(); a.eyeHeight = u(); a.eyeTilt = u();
  a.iris = r.weighted(EYE_COLORS.map((c, i) => [c, i < 3 ? 4 : 1] as const)); a.pupil = u(); a.lashes = f ? r.range(0.5, 1) : r.range(0.1, 0.45); a.lids = u();
  a.browStyle = r.pick(BROW_STYLES).id; a.browThickness = f ? r.range(0.2, 0.65) : r.range(0.45, 1); a.browLength = u(); a.browCurve = u(); a.browHeight = u();
  a.noseStyle = r.pick(NOSE_STYLES).id; a.noseSize = u(); a.noseWidth = u(); a.noseHeight = u();
  a.mouthStyle = r.pick(MOUTH_STYLES).id; a.mouthWidth = u(); a.lipFullness = f ? r.range(0.35, 1) : r.range(0.1, 0.6); a.mouthHeight = u();
  a.lipColor = r.pick(LIP_COLORS);
  a.earStyle = r.weighted(EAR_STYLES.map((e) => [e.id, e.id === 'pontuda' ? 0.2 : 1] as const)); a.earSize = u();
  // cabelo: cores naturais correlacionadas ao tom de pele
  const dark = SKIN_TONES.indexOf(a.skin) >= 7;
  a.hairColor = dark ? r.weighted(HAIR_COLORS.slice(0, 13).map((c, i) => [c, i < 3 ? 6 : i < 5 ? 2 : 0.4] as const)) : r.weighted(HAIR_COLORS.slice(0, 13).map((c, i) => [c, i < 6 ? 2 : 1] as const));
  if (r.chance(0.06)) a.hairColor = r.pick(HAIR_COLORS.slice(16));
  a.hairHighlight = r.chance(0.15) ? r.pick(HAIR_COLORS) : '';
  a.hairStyle = pickBias(r, HAIR_STYLES, s, 0.08);
  if (a.hairStyle === 'careca' && r.chance(0.6)) a.hairStyle = f ? 'longo' : 'curto';
  a.hairVolume = u();
  a.browColor = mix(a.hairColor, '#1a1310', 0.35);
  a.facialHair = f ? 'nenhum' : r.chance(0.45) ? r.pick(FACIAL_HAIR.slice(1)).id : 'nenhum';
  a.facialHairColor = a.hairColor;
  a.eyeshadow = f && r.chance(0.35) ? r.pick(MAKEUP_COLORS) : '';
  a.lipstick = f && r.chance(0.4) ? r.range(0.3, 0.9) : 0;
  if (a.lipstick > 0) a.lipColor = r.pick(['#c2273d', '#b5446e', '#d9546b', '#8e2c48', '#e0707e']);
  a.top = pickBias(r, TOPS, s, 0.05); a.topColor = r.pick(CLOTH_COLORS); a.topColor2 = r.pick(CLOTH_COLORS);
  a.topPattern = r.weighted([['liso', 6], ['listras', 1], ['bolinhas', 1], ['xadrez', 1], ['estampa', 1]] as const);
  a.bottom = pickBias(r, BOTTOMS, s, 0.02); a.bottomColor = r.pick(['#1f3f7a', '#23242b', '#3b4a6b', '#5a6470', '#c8a27a', '#7a5236', '#2f8f6f', '#e8d5b0', '#8a8f98']);
  a.shoes = pickBias(r, SHOES.filter((x) => x.id !== 'descalco'), s, 0.02); a.shoesColor = r.pick(['#f4f1ea', '#23242b', '#7a5236', '#c2273d', '#3d7bd9', '#8a8f98']);
  a.glasses = r.chance(0.2) ? r.pick(GLASSES.slice(1, 4)).id : 'nenhum'; a.glassesColor = r.pick(['#23242b', '#7a5236', '#c2273d', '#8a8f98', '#1f3f7a']);
  a.hat = r.chance(0.08) ? r.pick(HATS.slice(1)).id : 'nenhum'; a.hatColor = r.pick(CLOTH_COLORS);
  a.earrings = f ? (r.chance(0.6) ? r.pick(EARRINGS.slice(1)).id : 'nenhum') : r.chance(0.1) ? 'ponto' : 'nenhum';
  a.necklace = r.chance(0.15) ? r.pick(NECKLACES.slice(1)).id : 'nenhum';
  a.tattoo = r.chance(0.12) ? r.pick(TATTOOS.slice(1)).id : 'nenhuma';
  a.scar = r.chance(0.06) ? r.pick(SCARS.slice(1)).id : 'nenhuma';
  a.accColor = r.pick(['#f2c14e', '#c9c9cc', '#e8b4a0']);
  return a;
}

const blendN = (r: RNG, a: number, b: number) => clamp((r.chance(0.5) ? a : b) * 0.6 + ((a + b) / 2) * 0.4 + r.gauss(0, 0.08), 0, 1);

/** Herança genética: filho(a) recebe traços misturados dos pais. */
export function inherit(r: RNG, mom: Appearance, dad: Appearance, sex: Sex): Appearance {
  const c = randomAppearance(r, sex);
  const pick = <T>(x: T, y: T) => (r.chance(0.5) ? x : y);
  const numeric: (keyof Appearance)[] = [
    'height', 'faceWidth', 'faceHeight', 'jaw', 'chin', 'cheeks', 'eyeSize', 'eyeSpacing', 'eyeHeight', 'eyeTilt', 'noseSize', 'noseWidth', 'noseHeight',
    'mouthWidth', 'lipFullness', 'mouthHeight', 'earSize', 'legLength', 'neckLength', 'browCurve', 'hairVolume', 'lids',
  ];
  for (const k of numeric) (c as any)[k] = blendN(r, mom[k] as number, dad[k] as number);
  c.skin = mix(mom.skin, dad.skin, r.range(0.3, 0.7));
  c.undertone = pick(mom.undertone, dad.undertone);
  c.faceShape = pick(mom.faceShape, dad.faceShape);
  c.eyeShape = pick(mom.eyeShape, dad.eyeShape);
  c.iris = r.chance(0.85) ? pick(mom.iris, dad.iris) : c.iris;
  c.noseStyle = pick(mom.noseStyle, dad.noseStyle);
  c.mouthStyle = pick(mom.mouthStyle, dad.mouthStyle);
  c.earStyle = pick(mom.earStyle, dad.earStyle);
  c.browStyle = r.chance(0.7) ? pick(mom.browStyle, dad.browStyle) : c.browStyle;
  const natural = (h: string) => HAIR_COLORS.indexOf(h) < 0 || HAIR_COLORS.indexOf(h) < 13;
  const hm = natural(mom.hairColor) ? mom.hairColor : '#3d281c';
  const hd = natural(dad.hairColor) ? dad.hairColor : '#3d281c';
  c.hairColor = r.chance(0.5) ? pick(hm, hd) : mix(hm, hd, 0.5);
  if (['#7d7d82', '#c9c9cc', '#f2f2ee'].includes(c.hairColor)) c.hairColor = '#5a3a24';
  c.hairHighlight = '';
  c.browColor = mix(c.hairColor, '#1a1310', 0.35);
  c.facialHairColor = c.hairColor;
  c.freckles = r.chance(mom.freckles > 0 || dad.freckles > 0 ? 0.6 : 0.08) ? r.range(0.3, 0.9) : 0;
  c.lipColor = pick(mom.lipstick > 0 ? c.lipColor : mom.lipColor, dad.lipColor);
  c.lipstick = 0;
  c.eyeshadow = '';
  return c;
}

/** Gera um parente com semelhança familiar a partir de uma aparência base. */
export function relativeOf(r: RNG, base: Appearance, sex: Sex, similarity = 0.6): Appearance {
  const c = randomAppearance(r, sex);
  const numeric: (keyof Appearance)[] = ['faceWidth', 'faceHeight', 'jaw', 'chin', 'cheeks', 'eyeSize', 'eyeSpacing', 'eyeHeight', 'eyeTilt', 'noseSize', 'noseWidth', 'mouthWidth', 'earSize'];
  for (const k of numeric) (c as any)[k] = clamp((base[k] as number) * similarity + (c[k] as number) * (1 - similarity), 0, 1);
  if (r.chance(similarity)) c.faceShape = base.faceShape;
  if (r.chance(similarity)) c.eyeShape = base.eyeShape;
  if (r.chance(similarity)) c.noseStyle = base.noseStyle;
  if (r.chance(0.6)) c.iris = base.iris;
  c.skin = mix(base.skin, c.skin, r.range(0.05, 0.35));
  c.undertone = base.undertone;
  const hc = HAIR_COLORS.indexOf(base.hairColor) >= 16 ? '#3d281c' : base.hairColor;
  c.hairColor = r.chance(0.6) ? hc : mix(hc, c.hairColor, 0.4);
  c.hairHighlight = '';
  c.browColor = mix(c.hairColor, '#1a1310', 0.35);
  c.facialHairColor = c.hairColor;
  if (base.freckles > 0 && r.chance(0.5)) c.freckles = r.range(0.2, 0.8);
  return c;
}

export function cloneAppearance(a: Appearance): Appearance {
  return JSON.parse(JSON.stringify(a));
}

export function appearanceKey(a: Appearance): string {
  return JSON.stringify(a);
}

/** Cor de cabelo com envelhecimento. */
export function agedHair(hair: string, age: number): string {
  if (age < 42) return hair;
  const t = Math.min(1, (age - 42) / 38);
  return mix(hair, t > 0.8 ? '#f2f0ea' : '#b9b8b6', Math.min(1, t * 1.15));
}

export function tintVariant(hex: string, r: RNG) {
  return hueShift(hex, r.range(-0.03, 0.03), r.range(-0.05, 0.05), r.range(-0.05, 0.05));
}
