import { Appearance, agedHair } from './appearance';
import { shade, mix, lineOf, hueShift, luminance } from '../core/color';

export interface Pal {
  skin: string; skinSh: string; skinSh2: string; skinHi: string; skinLine: string; blush: string;
  lip: string; lipSh: string; lipLine: string; mouth: string;
  hair: string; hairSh: string; hairHi: string; hairLine: string; hairStreak: string;
  brow: string; lash: string; iris: string; irisDark: string; irisLight: string;
  fh: string; fhSh: string; fhLine: string;
  top: string; topSh: string; topLine: string; top2: string; top2Sh: string; top2Line: string;
  bottom: string; bottomSh: string; bottomLine: string;
  shoe: string; shoeSh: string; shoeLine: string;
  acc: string; accSh: string; accLine: string;
  hat: string; hatSh: string; hatLine: string;
  glass: string; glassLine: string;
  white: string; whiteSh: string; whiteLine: string;
}

const cache = new Map<string, Pal>();

export function makePalette(ap: Appearance, age: number): Pal {
  const ageKey = age < 42 ? 0 : Math.round(age / 3);
  const key = [ap.skin, ap.undertone, ap.hairColor, ap.hairHighlight, ap.iris, ap.lipColor, ap.lipstick, ap.browColor, ap.facialHairColor, ap.topColor, ap.topColor2, ap.bottomColor, ap.shoesColor, ap.accColor, ap.hatColor, ap.glassesColor, ageKey].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const under = ap.undertone === 'quente' ? '#c0503a' : ap.undertone === 'frio' ? '#7a4a78' : '#9a5a4a';
  const skin = ap.skin;
  const dark = luminance(skin) < 0.35;
  const skinSh = mix(shade(skin, -0.17), under, 0.16);
  const hair = agedHair(ap.hairColor, age);
  const fhc = agedHair(ap.facialHairColor, age + 4);
  const brow = agedHair(ap.browColor, age - 6);
  const lipBase = ap.lipstick > 0 ? mix(mix(skin, '#b8635b', 0.5), ap.lipColor, ap.lipstick) : mix(skin, ap.lipColor, dark ? 0.35 : 0.55);
  const p: Pal = {
    skin,
    skinSh,
    skinSh2: mix(shade(skin, -0.3), under, 0.2),
    skinHi: shade(skin, 0.22),
    skinLine: mix(shade(skin, dark ? -0.62 : -0.52), under, 0.25),
    blush: mix(under, '#ff6f7a', 0.5),
    lip: lipBase,
    lipSh: shade(lipBase, -0.18),
    lipLine: mix(shade(lipBase, -0.5), shade(skin, -0.6), 0.4),
    mouth: '#4a1a22',
    hair,
    hairSh: shade(hair, luminance(hair) > 0.6 ? -0.22 : -0.3),
    hairHi: shade(hair, luminance(hair) < 0.15 ? 0.28 : 0.2),
    hairLine: lineOf(hair, luminance(hair) < 0.12 ? 0.25 : 0.55),
    hairStreak: ap.hairHighlight ? ap.hairHighlight : shade(hair, 0.35),
    brow,
    lash: mix(shade(brow, -0.5), '#140c0c', 0.6),
    iris: ap.iris,
    irisDark: shade(ap.iris, -0.45),
    irisLight: shade(hueShift(ap.iris, 0.02), 0.35),
    fh: fhc, fhSh: shade(fhc, -0.3), fhLine: lineOf(fhc, 0.5),
    top: ap.topColor, topSh: shade(ap.topColor, -0.2), topLine: lineOf(ap.topColor),
    top2: ap.topColor2, top2Sh: shade(ap.topColor2, -0.2), top2Line: lineOf(ap.topColor2),
    bottom: ap.bottomColor, bottomSh: shade(ap.bottomColor, -0.22), bottomLine: lineOf(ap.bottomColor),
    shoe: ap.shoesColor, shoeSh: shade(ap.shoesColor, -0.22), shoeLine: lineOf(ap.shoesColor),
    acc: ap.accColor, accSh: shade(ap.accColor, -0.25), accLine: lineOf(ap.accColor),
    hat: ap.hatColor, hatSh: shade(ap.hatColor, -0.22), hatLine: lineOf(ap.hatColor),
    glass: ap.glassesColor, glassLine: lineOf(ap.glassesColor, 0.4),
    white: '#f7f5f0', whiteSh: '#dcd8d0', whiteLine: '#6d6a66',
  };
  cache.set(key, p);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return p;
}
