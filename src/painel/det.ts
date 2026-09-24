/**
 * Execução determinística no painel.
 *
 * Fontes de não determinismo encontradas no código e como o painel as trata:
 *  1. `rng` global (core/rng) — reiniciado com `rng.reseed(seed)`.
 *  2. `Math.random` (newLife, newId, partículas, tremor de câmera, ambientes) — substituído por um
 *     PRNG semeado SOMENTE durante a execução/simulação; o desenho na tela usa outro fluxo.
 *  3. Contador de ids de pessoas (`newId`, iniciado com Date.now()) — `resetIds()` antes de cada execução.
 *  4. Contador de atores (`Actor.id` alimenta semente de movimento e olhar) — `resetActorIds()` por cena.
 *  5. Datas (`Life.created/updated`) — ignoradas nas comparações.
 *  6. setTimeout só dispara sons (d.say, casa) e não altera estado; áudio fica mudo no painel.
 *  7. `Actor.frame`/`Scene.view` são calculados no desenho e lidos pelo roteiro → o laboratório
 *     executa um "desenho de simulação" (contexto nulo, viewport lógico fixo 1280×720) a cada passo.
 */
import { rng } from '../core/rng';
import { resetIds } from '../game/state';
import { resetActorIds } from '../character/actor';

export function prng(seed: number) {
  let s = seed >>> 0;
  const f = () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.assign(f, { estado: () => s, definir: (v: number) => { s = v >>> 0; } });
}

export const RANDOM_ORIGINAL = Math.random;

/**
 * O motor de áudio (core/audio) gera buffers de ruído com Math.random e os guarda em cache: a 1ª cena
 * que toca um som consome números do fluxo semeado e as seguintes não — quebrando o replay.
 * Som não altera estado de jogo/cena, então no painel toda chamada de som usa um acaso próprio.
 */
export function isolarAudio(sfx: object) {
  const proto = Object.getPrototypeOf(sfx);
  for (const k of Object.getOwnPropertyNames(proto)) {
    const f = (sfx as any)[k];
    if (typeof f !== 'function' || k === 'constructor') continue;
    (sfx as any)[k] = function (this: unknown, ...args: unknown[]) {
      const antes = Math.random;
      Math.random = RANDOM_ORIGINAL;
      try { return f.apply(sfx, args); } finally { Math.random = antes; }
    };
  }
}

/** Roda `fn` com todas as fontes de acaso semeadas; restaura Math.random no fim. */
export function comSemente<T>(seed: number, fn: () => T): T {
  const antes = Math.random;
  Math.random = prng(seed ^ 0x5bd1e995);
  rng.reseed(seed);
  resetIds(1000);
  try {
    return fn();
  } finally {
    Math.random = antes;
  }
}

/** Fluxos separados para a simulação de cena (estado) e para o desenho (efeito visual apenas). */
export class FluxoAleatorio {
  sim: ReturnType<typeof prng>;
  rngEstado: number;
  constructor(seed: number) {
    this.sim = prng(seed ^ 0x27d4eb2f);
    this.rngEstado = seed >>> 0; // mesmo estado que rng.reseed(seed) produziria
    resetActorIds(0);
  }
  /** Executa `fn` com Math.random e rng da simulação; salva os estados ao sair. */
  dentro<T>(fn: () => T): T {
    const antes = Math.random;
    const rngAntes = rng.estado();
    Math.random = this.sim;
    rng.reseed(this.rngEstado);
    try {
      return fn();
    } finally {
      this.rngEstado = rng.estado();
      rng.reseed(rngAntes);
      Math.random = antes;
    }
  }
}

/** Esvazia a fila de microtarefas (continuações dos roteiros async) sem o atraso mínimo do setTimeout. */
let canal: MessageChannel | null = null; // criado sob demanda (não prende processos Node em testes)
const filaResolve: (() => void)[] = [];
export function drenar(): Promise<void> {
  if (!canal) {
    canal = new MessageChannel();
    canal.port1.onmessage = () => filaResolve.shift()?.();
  }
  const c = canal;
  return new Promise((r) => { filaResolve.push(r); c.port2.postMessage(0); });
}

/** Hash curto e estável de um objeto (para comparar execuções). */
export function hashDe(v: unknown): string {
  const s = JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isInteger(x) ? Math.round(x * 1e6) / 1e6 : x));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
