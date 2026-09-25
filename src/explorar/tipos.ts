/**
 * Modo Explorar — tipos compartilhados. Visão geral e regras em docs/EXPLORAR.md.
 *
 * O mundo é uma LINHA contínua de trechos (cômodos da casa → rua → academia...). Cada trecho tem um "pintor" de fundo,
 * uma faixa de chão onde se anda (profundidade 2,5D) e objetos interativos. Pessoas são atores do motor normal.
 */
import type { Life, Person, StatKey } from '../game/state';
import type { Hand } from '../character/rig';

/** Necessidades do dia (0 = crítico, 100 = cheio), no estilo "The Sims". */
export type Necessidade = 'energia' | 'fome' | 'diversao' | 'social' | 'higiene' | 'bexiga';
export const NECESSIDADES: Necessidade[] = ['energia', 'fome', 'diversao', 'social', 'higiene', 'bexiga'];

export type LugarId = 'casa' | 'rua' | 'academia';

export interface Trecho {
  id: string;
  nome: string;
  lugar: LugarId;
  /** início e fim no eixo x do mundo */
  x0: number;
  x1: number;
  /** pintor do fundo (parede, chão, janelas...) — desenha só entre x0 e x1 */
  pintor: string;
  interno: boolean;
  /** idade mínima para entrar (ex.: rua e academia) */
  minIdade?: number;
}

/** Efeitos de uma ação: stats do jogo (com retorno decrescente no ano) e necessidades do dia. */
export interface Efeito {
  stats?: Partial<Record<StatKey, number>>;
  nec?: Partial<Record<Necessidade, number>>;
  fitness?: number;
  dinheiro?: number;
}

export interface AcaoObjeto {
  id: string;
  label: string;
  icon: string;
  /** minutos de jogo que a ação consome */
  minutos: number;
  /** movimento durante o uso */
  motion: string;
  /** onde o personagem fica em relação ao objeto (dx no mundo; `lado` = para onde olha: 1 direita, -1 esquerda) */
  dx: number;
  dy?: number;
  lado?: 1 | -1;
  /** altura extra (sentado/deitado sobre o móvel), em px já na escala 1 */
  elev?: number;
  /** altura do assento/colchão em METROS: o controlador calcula a elevação certa para o corpo de cada um */
  assento?: number;
  /** altura em METROS da superfície onde a pessoa fica em pé ou deitada (colchão, lona da esteira, banco do supino) */
  plataforma?: number;
  /** giro do corpo durante a ação (0 = de frente para a câmera, 0,72 = ¾) — ex.: sentado no sofá de frente */
  giro?: number;
  /** objeto de mão durante a ação */
  segura?: string;
  forma?: Hand;
  efeito: Efeito;
  /** frase mostrada ao terminar */
  texto?: string;
  cond?: (L: Life, est: EstadoExplorar) => string | null; // null = pode; texto = motivo do bloqueio
  /** ação especial (dormir, matrícula, viajar) tratada pelo controlador */
  especial?: 'dormir' | 'matricula' | 'onibus' | 'porta' | 'banho' | 'xixi' | 'coco' | 'lavarMaos';
}

export interface ObjetoMundo {
  id: string;
  nome: string;
  prop?: string; // desenho de PROPS
  x: number;
  y: number; // base (chão) — define profundidade
  escala?: number;
  flip?: boolean;
  opts?: Record<string, unknown>;
  /** caixa de clique (largura e altura acima da base) */
  w: number;
  h: number;
  acoes: AcaoObjeto[];
  /** só um usuário por vez (equipamentos) */
  exclusivo?: boolean;
  /** desenho próprio (MOVEIS em moveis.ts) quando não há prop pronta */
  desenho?: string;
  /**
   * Partes desenhadas separadamente: por padrão ficam ATRÁS de quem usa o objeto; `frente: true` desenha a parte
   * DEPOIS da pessoa (mesa na frente de quem senta, cobertor por cima de quem dorme, corrimão da esteira).
   */
  partes?: { desenho: string; dx?: number; dy?: number; opts?: Record<string, unknown>; frente?: boolean }[];
  /** vários lugares no mesmo objeto (rack de halteres): cada vaga é um ponto de uso independente */
  vagas?: { dx: number; dy?: number; lado?: 1 | -1 }[];
}

/** Área onde se anda. Zonas que se sobrepõem se ligam (a sobreposição é a "porta"). */
export interface Zona {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** prédio a que pertence (a fachada fica transparente quando você está dentro) */
  predio?: 'casa' | 'academia';
  minIdade?: number;
}

/** Frequentador de um lugar (academia): gente que você reencontra, com familiaridade antes de virar contato. */
export interface Frequentador {
  pessoa: Person;
  /** familiaridade antes do contato (0..100) */
  fam: number;
  /** sabe o nome dele(a)? */
  nomeConhecido: boolean;
  /** vezes que vocês se viram */
  encontros: number;
  /** já pegou o contato (a pessoa foi para L.people) */
  contato: boolean;
  /** chance de estar no lugar a cada visita (0..1) */
  assiduidade: number;
  /** equipamento favorito */
  favorito?: string;
  /** última vez que recusou pegar contato (dia) */
  recusouEm?: number;
}

export interface EstadoExplorar {
  /** dias vividos no total e neste ano de vida */
  dias: number;
  diasNoAno: number;
  anoRef: number;
  /** relógio do dia em minutos (0..1440) */
  hora: number;
  nec: Record<Necessidade, number>;
  /** usos de cada ação neste ano (retorno decrescente) */
  usos: Record<string, number>;
  frequentadores: Partial<Record<LugarId, Frequentador[]>>;
  /** matrícula na academia válida até esta idade */
  matriculaAte?: number;
  /** onde parou (x, y) */
  x?: number;
  y?: number;
  /** usou o vaso e não lavou as mãos (as pessoas percebem...) */
  maosSujas?: boolean;
}
