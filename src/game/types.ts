import type { Life, Person, Tone } from './state';

export interface SceneReq {
  id: string;
  others?: Person[];
  data?: Record<string, any>;
}

export interface Outcome {
  title?: string;
  text: string;
  tone: Tone;
  icon?: string;
  scene?: SceneReq;
  log?: string | false; // texto para o diário (padrão: text)
  followUp?: PendingEvent; // novo evento encadeado
  next?: Outcome; // consequência encadeada (mostrada em seguida, com cena própria)
  skipCard?: boolean; // não mostra cartão de resultado (usado em cadeias como entrevistas)
  mood?: 'tenso' | 'triste' | 'ferido' | 'feliz'; // humor da próxima cena em casa
  react?: { npc?: { expr?: string; emote?: string; say?: string; motion?: string }; player?: { expr?: string; emote?: string; say?: string; motion?: string } };
}

export interface EvCtx {
  person?: Person;
  n?: number;
  s?: string;
  [k: string]: any;
}

export interface Choice {
  label: string;
  icon?: string;
  hint?: string;
  cond?: (L: Life, c: EvCtx) => boolean;
  run: (L: Life, c: EvCtx) => Outcome;
}

export interface LifeEvent {
  id: string;
  min: number;
  max: number;
  weight: number | ((L: Life) => number);
  once?: boolean;
  cond?: (L: Life) => boolean;
  icon: string;
  title: string | ((L: Life, c: EvCtx) => string);
  setup?: (L: Life) => EvCtx | null;
  text: (L: Life, c: EvCtx) => string;
  scene?: (L: Life, c: EvCtx) => SceneReq | undefined;
  choices?: Choice[];
  auto?: (L: Life, c: EvCtx) => Outcome;
}

export interface PendingEvent {
  ev: LifeEvent;
  ctx: EvCtx;
}

export interface Action {
  id: string;
  label: string;
  icon: string;
  desc: string;
  group: string;
  minAge: number;
  maxAge?: number;
  cost?: number | ((L: Life) => number);
  cond?: (L: Life) => boolean;
  run: (L: Life) => Outcome | PendingEvent;
}

export interface Interaction {
  id: string;
  label: string;
  icon: string;
  group?: string;
  cond: (L: Life, p: Person) => boolean;
  run: (L: Life, p: Person) => Outcome;
}
