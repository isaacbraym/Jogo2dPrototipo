export type RGB = [number, number, number];
const cache = new Map<string, string>();

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function rgbToHsl(r: number, g: number, b: number): RGB {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}
export function hsl(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(((h % 1) + 1) % 1, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
  return rgbToHex(r, g, b);
}

/** Clareia (amt>0) ou escurece (amt<0) mantendo matiz; escurecimento satura levemente (sombra “viva”). */
export function shade(hex: string, amt: number): string {
  const key = 's' + hex + amt;
  const c = cache.get(key);
  if (c) return c;
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  let out: string;
  if (amt >= 0) out = hsl(h, s * (1 - amt * 0.3), l + (1 - l) * amt);
  else out = hsl(h, Math.min(1, s * (1 - amt * 0.35) + 0.04), l * (1 + amt));
  cache.set(key, out);
  return out;
}
export function mix(a: string, b: string, t: number): string {
  const key = 'm' + a + b + t.toFixed(3);
  const c = cache.get(key);
  if (c) return c;
  const A = hexToRgb(a), B = hexToRgb(b);
  const out = rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  cache.set(key, out);
  return out;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function hueShift(hex: string, dh: number, ds = 0, dl = 0): string {
  const [h, s, l] = rgbToHsl(...hexToRgb(hex));
  return hsl(h + dh, s + ds, l + dl);
}
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
/** Cor de contorno: escura, saturada, derivada da própria cor (linhas coloridas = acabamento premium). */
export function lineOf(hex: string, k = 0.55): string {
  return shade(hueShift(hex, -0.01, 0.1, 0), -k);
}
