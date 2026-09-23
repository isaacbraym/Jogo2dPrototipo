import { Life } from './state';
import { Appearance } from '../character/appearance';

const K_SAVES = 'viva.saves.v1';
const K_PRESETS = 'viva.presets.v1';
const K_LAST = 'viva.last.v1';

export interface SaveMeta {
  id: string;
  name: string;
  age: number;
  updated: number;
  dead: boolean;
  generation: number;
  ap: Appearance;
}

export interface Preset {
  id: string;
  name: string;
  ap: Appearance;
  first: string;
  last: string;
  created: number;
}

function read<T>(k: string, def: T): T {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : def;
  } catch {
    return def;
  }
}
function write(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export function listSaves(): SaveMeta[] {
  const all = read<Record<string, Life>>(K_SAVES, {});
  return Object.values(all)
    .map((L) => ({ id: L.id, name: `${L.player.first} ${L.player.last}`, age: L.player.age, updated: L.updated, dead: L.dead, generation: L.generation, ap: L.player.ap }))
    .sort((a, b) => b.updated - a.updated);
}

export function saveLife(L: Life): boolean {
  const all = read<Record<string, Life>>(K_SAVES, {});
  L.updated = Date.now();
  all[L.id] = L;
  const ok = write(K_SAVES, all);
  write(K_LAST, L.id);
  return ok;
}

export function loadLife(id: string): Life | null {
  const all = read<Record<string, Life>>(K_SAVES, {});
  return all[id] ?? null;
}

export function deleteLife(id: string) {
  const all = read<Record<string, Life>>(K_SAVES, {});
  delete all[id];
  write(K_SAVES, all);
}

export function lastLifeId(): string | null {
  const id = read<string | null>(K_LAST, null);
  if (!id) return null;
  const L = loadLife(id);
  return L && !L.dead ? id : null;
}

export function listPresets(): Preset[] {
  return read<Preset[]>(K_PRESETS, []).sort((a, b) => b.created - a.created);
}

export function savePreset(p: Preset) {
  const list = read<Preset[]>(K_PRESETS, []).filter((x) => x.id !== p.id);
  list.push(p);
  return write(K_PRESETS, list);
}

export function deletePreset(id: string) {
  write(K_PRESETS, read<Preset[]>(K_PRESETS, []).filter((x) => x.id !== id));
}

export function downloadJSON(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export function pickJSON(): Promise<any | null> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => {
        try {
          resolve(JSON.parse(String(r.result)));
        } catch {
          resolve(null);
        }
      };
      r.readAsText(f);
    };
    inp.click();
  });
}
