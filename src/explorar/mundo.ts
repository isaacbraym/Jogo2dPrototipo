/**
 * Modo Explorar — o MUNDO: uma linha contínua de trechos, dos cômodos da casa até a academia, passando pela rua.
 * Sem teleporte: você atravessa a porta da sala e já está na calçada. Objetos com ações (camas, equipamentos...).
 * Para acrescentar um lugar novo: trecho(s) em TRECHOS + pintor em PINTORES + objetos em OBJETOS (ver docs/EXPLORAR.md).
 */
import type { Ctx } from '../render/draw';
import type { Life } from '../game/state';
import type { Trecho, ObjetoMundo, EstadoExplorar } from './tipos';

export const FLOOR = 560; // junção parede/chão
/** faixa de chão onde se anda (profundidade 2,5D): fundo → frente */
export const CHAO_FUNDO = 598;
export const CHAO_FRENTE = 702;

// ------------------------------------------------------------------ trechos (ordem = da esquerda para a direita)
export const TRECHOS: Trecho[] = [
  { id: 'quarto', nome: 'Quarto', lugar: 'casa', x0: 0, x1: 1150, pintor: 'quarto', interno: true },
  { id: 'banheiro', nome: 'Banheiro', lugar: 'casa', x0: 1150, x1: 1750, pintor: 'banheiro', interno: true },
  { id: 'cozinha', nome: 'Cozinha', lugar: 'casa', x0: 1750, x1: 2900, pintor: 'cozinha', interno: true },
  { id: 'sala', nome: 'Sala', lugar: 'casa', x0: 2900, x1: 4300, pintor: 'sala', interno: true },
  { id: 'frenteCasa', nome: 'Frente de casa', lugar: 'rua', x0: 4300, x1: 5400, pintor: 'frenteCasa', interno: false, minIdade: 8 },
  { id: 'rua', nome: 'Rua', lugar: 'rua', x0: 5400, x1: 6800, pintor: 'rua', interno: false, minIdade: 8 },
  { id: 'frenteAcademia', nome: 'Frente da academia', lugar: 'rua', x0: 6800, x1: 7800, pintor: 'frenteAcademia', interno: false, minIdade: 8 },
  { id: 'recepcao', nome: 'Academia · recepção e cardio', lugar: 'academia', x0: 7800, x1: 9200, pintor: 'academiaCardio', interno: true, minIdade: 14 },
  { id: 'pesos', nome: 'Academia · musculação', lugar: 'academia', x0: 9200, x1: 10800, pintor: 'academiaPesos', interno: true, minIdade: 14 },
];
export const MUNDO_X0 = TRECHOS[0].x0;
export const MUNDO_X1 = TRECHOS[TRECHOS.length - 1].x1;

export function trechoEm(x: number): Trecho {
  return TRECHOS.find((t) => x >= t.x0 && x < t.x1) ?? (x < MUNDO_X0 ? TRECHOS[0] : TRECHOS[TRECHOS.length - 1]);
}
export const trechoPorId = (id: string) => TRECHOS.find((t) => t.id === id)!;
/** porta de cada lugar (para o ônibus e para o início do dia) */
export const PONTOS = { cama: 380, portaCasa: 4300, pontoOnibus: 6080, portaAcademia: 7800, recepcao: 8050 };

// ------------------------------------------------------------------ requisitos comuns
const matriculado = (L: Life, e: EstadoExplorar) => (e.matriculaAte !== undefined && e.matriculaAte >= L.player.age ? null : 'Faça a matrícula na recepção primeiro.');
const cansado = (min: number) => (_L: Life, e: EstadoExplorar) => (e.nec.energia < min ? 'Você está sem energia. Coma algo ou vá dormir.' : null);
const juntos = (...fs: ((L: Life, e: EstadoExplorar) => string | null)[]) => (L: Life, e: EstadoExplorar) => {
  for (const f of fs) { const r = f(L, e); if (r) return r; }
  return null;
};

// ------------------------------------------------------------------ objetos interativos
export const OBJETOS: ObjetoMundo[] = [
  // ---- quarto
  {
    id: 'cama', nome: 'Cama', prop: 'cama', x: 330, y: 640, w: 330, h: 150, opts: { color: '#3d7bd9' },
    acoes: [
      { id: 'dormir', label: 'Dormir (encerra o dia)', icon: '😴', minutos: 0, motion: 'deitado', dx: 20, lado: 1, especial: 'dormir', efeito: {} },
      { id: 'cochilar', label: 'Cochilar 1 h', icon: '💤', minutos: 60, motion: 'deitado', dx: 20, lado: 1, efeito: { nec: { energia: 22 } }, texto: 'Que cochilo bom.' },
    ],
  },
  {
    id: 'escrivaninha', nome: 'Escrivaninha', prop: 'escrivaninha', x: 760, y: 632, w: 220, h: 170, opts: { color: '#e8e6e0' },
    acoes: [
      { id: 'estudar', label: 'Estudar', icon: '📚', minutos: 90, motion: 'estudar', dx: -70, lado: 1, efeito: { stats: { inteligencia: 3 }, nec: { energia: -10, diversao: -8 } }, texto: 'Estudou um bocado. O cérebro agradece; a diversão, não.', cond: cansado(10) },
      { id: 'jogarPc', label: 'Jogar no computador', icon: '🎮', minutos: 60, motion: 'digitar', dx: -70, lado: 1, efeito: { stats: { felicidade: 2 }, nec: { diversao: 22, energia: -5 } }, texto: 'Mais uma partida. Só mais uma.' },
    ],
  },
  {
    id: 'espelhoQuarto', nome: 'Espelho', prop: 'espelho', x: 1000, y: 626, w: 110, h: 250,
    acoes: [
      { id: 'arrumar', label: 'Se arrumar', icon: '💇', minutos: 20, motion: 'maosNaCintura', dx: -60, lado: 1, efeito: { stats: { aparencia: 2 }, nec: { social: 3 } }, texto: 'Pronto(a) para o mundo.' },
      { id: 'selfie', label: 'Tirar uma selfie', icon: '🤳', minutos: 10, motion: 'selfie', dx: -60, lado: 1, segura: 'celular', efeito: { stats: { felicidade: 1 }, nec: { social: 4 } }, texto: '37 fotos depois, uma prestou.' },
    ],
  },
  // ---- banheiro
  {
    id: 'pia', nome: 'Pia e espelho', desenho: 'pia', x: 1330, y: 612, w: 170, h: 250,
    acoes: [
      { id: 'lavarMaos', label: 'Lavar as mãos', icon: '🧼', minutos: 2, motion: 'lavarMaos', dx: 0, lado: 1, especial: 'lavarMaos', efeito: { nec: { higiene: 6 } } },
      { id: 'escovar', label: 'Escovar os dentes', icon: '🪥', minutos: 5, motion: 'lavarMaos', dx: 0, lado: 1, efeito: { stats: { saude: 1 }, nec: { higiene: 5 } }, texto: 'Dentes brilhando. O dentista ficaria orgulhoso (e desempregado).' },
    ],
  },
  {
    id: 'vaso', nome: 'Vaso sanitário', desenho: 'vaso', x: 1470, y: 612, w: 100, h: 150, opts: { tampa: 0, agua: 0 },
    acoes: [
      { id: 'xixi', label: 'Fazer o número 1', icon: '💧', minutos: 3, motion: 'xixiEmPe', dx: -64, dy: 6, lado: 1, especial: 'xixi', efeito: { nec: { bexiga: 100 } } },
      { id: 'coco', label: 'Fazer o número 2', icon: '💩', minutos: 12, motion: 'sentarVaso', dx: 6, dy: 2, lado: 1, especial: 'coco', efeito: { nec: { bexiga: 100 } } },
    ],
  },
  {
    id: 'chuveiro', nome: 'Chuveiro', desenho: 'chuveiro', x: 1630, y: 598, w: 170, h: 420,
    acoes: [
      { id: 'banho', label: 'Tomar banho', icon: '🚿', minutos: 20, motion: 'banhoEnsaboar', dx: 0, dy: -20, lado: 1, especial: 'banho', efeito: { stats: { aparencia: 1, felicidade: 1 }, nec: { higiene: 100, energia: 6 } } },
    ],
  },
  // ---- cozinha
  {
    id: 'geladeira', nome: 'Geladeira', prop: 'geladeira', x: 1880, y: 640, w: 120, h: 260,
    acoes: [
      { id: 'lanche', label: 'Fazer um lanche', icon: '🥪', minutos: 15, motion: 'comer', dx: 90, lado: -1, efeito: { nec: { fome: 30, energia: 5 } }, texto: 'Sanduíche de geladeira: gourmet do improviso.' },
      { id: 'agua', label: 'Beber água', icon: '🥤', minutos: 3, motion: 'beber', dx: 90, lado: -1, segura: 'xicara', efeito: { stats: { saude: 1 }, nec: { energia: 3, bexiga: -18 } }, texto: 'Hidratado(a). A bexiga anotou.' },
    ],
  },
  {
    id: 'fogao', nome: 'Fogão', prop: 'fogao', x: 2150, y: 600, w: 170, h: 170,
    acoes: [
      { id: 'cozinhar', label: 'Cozinhar uma refeição', icon: '🍳', minutos: 50, motion: 'cozinhar', dx: 0, lado: 1, efeito: { stats: { saude: 2, felicidade: 1 }, nec: { fome: 55, diversao: 4 } }, texto: 'Arroz, feijão e orgulho.' },
    ],
  },
  {
    id: 'mesaJantar', nome: 'Mesa de jantar', prop: 'mesaJantar', x: 2560, y: 650, w: 320, h: 130,
    acoes: [
      { id: 'comerMesa', label: 'Comer à mesa', icon: '🍽️', minutos: 25, motion: 'comer', dx: -150, lado: 1, efeito: { nec: { fome: 35, social: 2 } }, texto: 'Refeição sentada, como gente civilizada.' },
    ],
  },
  // ---- sala
  {
    id: 'sofa', nome: 'Sofá', prop: 'sofa', x: 3300, y: 616, w: 330, h: 160, opts: { color: '#3d7bd9', color2: '#f2c14e' }, escala: 0.95,
    acoes: [
      { id: 'tv', label: 'Assistir TV', icon: '📺', minutos: 60, motion: 'sentarFeliz', dx: 0, dy: 12, lado: 1, elev: 18, efeito: { stats: { felicidade: 2 }, nec: { diversao: 25, energia: 4 } }, texto: 'Três episódios de uma série sobre uma série.' },
      { id: 'cochiloSofa', label: 'Tirar um cochilo', icon: '💤', minutos: 45, motion: 'dormirEmPe', dx: 0, dy: 12, lado: 1, elev: 18, efeito: { nec: { energia: 16 } }, texto: 'Acordou com a marca da almofada na cara.' },
    ],
  },
  {
    id: 'tv', nome: 'TV', prop: 'tv', x: 3720, y: 606, w: 170, h: 180, flip: true,
    acoes: [
      { id: 'videogame', label: 'Jogar videogame', icon: '🕹️', minutos: 60, motion: 'jogarVideogame', dx: -200, lado: 1, segura: 'controle', efeito: { stats: { felicidade: 3 }, nec: { diversao: 30, energia: -4 } }, texto: 'Zerou a fase. Perdeu a noção do tempo.' },
    ],
  },
  {
    id: 'estante', nome: 'Estante', prop: 'estante', x: 4050, y: 590, w: 180, h: 300,
    acoes: [
      { id: 'lerLivro', label: 'Ler um livro', icon: '📖', minutos: 60, motion: 'ler', dx: -90, lado: 1, segura: 'livro', efeito: { stats: { inteligencia: 2, felicidade: 1 }, nec: { diversao: 10 } }, texto: 'Um capítulo virou cinco.' },
    ],
  },
  // ---- rua
  {
    id: 'pontoOnibus', nome: 'Ponto de ônibus', desenho: 'pontoOnibus', x: PONTOS.pontoOnibus, y: 600, w: 260, h: 280,
    acoes: [
      { id: 'onibus', label: 'Pegar ônibus (R$ 5)', icon: '🚌', minutos: 20, motion: 'parado', dx: 0, lado: 1, especial: 'onibus', efeito: { dinheiro: -5 } },
    ],
  },
  {
    id: 'bancoPraca', nome: 'Banco', prop: 'banco', x: 5700, y: 612, w: 200, h: 110,
    acoes: [
      { id: 'observar', label: 'Sentar e ver o movimento', icon: '👀', minutos: 30, motion: 'sentar', dx: 0, dy: 8, lado: 1, elev: 14, efeito: { stats: { felicidade: 1 }, nec: { diversao: 8, energia: 6 } }, texto: 'Um senhor passou com um papagaio. O dia valeu.' },
    ],
  },
  {
    id: 'orelhao', nome: 'Orelhão', prop: 'orelhao', x: 6560, y: 620, w: 110, h: 260, escala: 0.8,
    acoes: [
      { id: 'orelhaoLigar', label: 'Tentar ligar', icon: '☎️', minutos: 5, motion: 'telefone', dx: -50, lado: 1, efeito: { nec: { diversao: 3 } }, texto: 'Ninguém atende orelhão desde 2004.' },
    ],
  },
  // ---- academia
  {
    id: 'balcao', nome: 'Recepção', desenho: 'balcaoAcademia', x: PONTOS.recepcao, y: 606, w: 260, h: 170,
    acoes: [
      { id: 'matricula', label: 'Fazer matrícula (R$ 120/ano)', icon: '📝', minutos: 10, motion: 'parado', dx: 0, dy: 40, lado: 1, especial: 'matricula', efeito: { dinheiro: -120 } },
    ],
  },
  ...[8450, 8750, 9050].map((x, i): ObjetoMundo => ({
    id: 'esteira' + (i + 1), nome: 'Esteira', prop: 'esteira', x, y: 640, w: 200, h: 200, exclusivo: true,
    acoes: [
      { id: 'correrEsteira', label: 'Correr 30 min', icon: '🏃', minutos: 30, motion: 'esteira', dx: -8, dy: -2, lado: 1, elev: 14, efeito: { stats: { saude: 3, aparencia: 1 }, fitness: 3, nec: { energia: -18, fome: -12, higiene: -22 } }, texto: 'Cinco quilômetros. Ou quatro. O visor está mentindo?', cond: juntos(matriculado, cansado(20)) },
      { id: 'caminharEsteira', label: 'Caminhar 30 min', icon: '🚶', minutos: 30, motion: 'andar', dx: -8, dy: -2, lado: 1, elev: 14, efeito: { stats: { saude: 2 }, fitness: 1, nec: { energia: -8, fome: -6 } }, texto: 'Caminhada leve, consciência pesada.', cond: juntos(matriculado, cansado(10)) },
    ],
  })),
  {
    id: 'bebedouro', nome: 'Bebedouro', desenho: 'bebedouro', x: 9150, y: 606, w: 90, h: 200,
    acoes: [
      { id: 'beberAcademia', label: 'Beber água', icon: '💧', minutos: 3, motion: 'beber', dx: -60, lado: 1, segura: 'xicara', efeito: { nec: { energia: 4, bexiga: -18 } }, texto: 'Água gelada pós-treino: melhor bebida do mundo.' },
    ],
  },
  ...[9480, 9900].map((x, i): ObjetoMundo => ({
    id: 'supino' + (i + 1), nome: 'Supino', prop: 'bancoSupino', x, y: 640, w: 240, h: 170, exclusivo: true,
    acoes: [
      { id: 'supino', label: 'Supino (peito)', icon: '🏋️', minutos: 40, motion: 'levantarPeso', dx: 0, lado: 1, efeito: { stats: { saude: 2, aparencia: 2 }, fitness: 3, nec: { energia: -20, fome: -10, higiene: -18 } }, texto: 'O peito vai estar dolorido amanhã. Ótimo sinal (dizem).', cond: juntos(matriculado, cansado(22)) },
    ],
  })),
  {
    id: 'rackPesos', nome: 'Halteres', prop: 'rackPesos', x: 10300, y: 640, w: 240, h: 180, exclusivo: true, escala: 1.1,
    acoes: [
      { id: 'rosca', label: 'Rosca direta (bíceps)', icon: '💪', minutos: 30, motion: 'rosca', dx: 150, lado: -1, segura: 'haltere', efeito: { stats: { aparencia: 2, saude: 1 }, fitness: 2, nec: { energia: -14, fome: -8, higiene: -14 } }, texto: 'Bíceps bombeado. Foto no espelho obrigatória.', cond: juntos(matriculado, cansado(15)) },
    ],
  },
  {
    id: 'espelhoAcademia', nome: 'Espelhão', desenho: 'espelhao', x: 10620, y: 580, w: 200, h: 320,
    acoes: [
      { id: 'selfieAcademia', label: 'Foto no espelho', icon: '🤳', minutos: 5, motion: 'selfie', dx: -110, lado: 1, segura: 'celular', efeito: { stats: { felicidade: 1 }, nec: { social: 5 } }, texto: '#foco #fé #frango' },
    ],
  },
];

export const objetoPorId = (id: string) => OBJETOS.find((o) => o.id === id);

/** Decoração sem ação (postes acendem à noite). */
export interface Decoracao { prop: string; x: number; y: number; escala?: number; opts?: Record<string, unknown>; acende?: boolean }
export const DECORACAO: Decoracao[] = [
  { prop: 'arvore', x: 4620, y: 596, escala: 1.05 },
  { prop: 'poste', x: 5250, y: 604, acende: true },
  { prop: 'arvore', x: 5980, y: 598, escala: 0.95, opts: { color: '#58b368' } },
  { prop: 'poste', x: 6420, y: 604, acende: true },
  { prop: 'hidrante', x: 6680, y: 640, escala: 0.9 },
  { prop: 'poste', x: 7050, y: 604, acende: true },
  { prop: 'planta', x: 7760, y: 640, escala: 1.2 },
  { prop: 'planta', x: 3000, y: 640, escala: 1.1 },
];

// ------------------------------------------------------------------ céu e luz pela hora
export function luz(hora: number) {
  const h = (hora / 60) % 24;
  // 0 = dia pleno; 1 = noite fechada
  const noite = h < 5 ? 1 : h < 7 ? 1 - (h - 5) / 2 : h < 17.5 ? 0 : h < 19.5 ? (h - 17.5) / 2 : 1;
  const entardecer = h >= 16.5 && h < 19.5 ? 1 - Math.abs(h - 18) / 1.5 : h >= 5 && h < 7 ? 1 - Math.abs(h - 6) : 0;
  return { noite, entardecer: Math.max(0, entardecer) };
}

function misturar(c1: string, c2: string, k: number) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return `rgb(${r},${g},${bl})`;
}

export function coresCeu(hora: number) {
  const { noite, entardecer } = luz(hora);
  const topoDia = '#5aa8e8', baseDia = '#bfe3f7';
  const topoTarde = '#6a5aa8', baseTarde = '#f4a36b';
  const topoNoite = '#0d1330', baseNoite = '#2a2f5a';
  const topo = noite > 0.5 ? misturar(topoTarde, topoNoite, (noite - 0.5) * 2) : misturar(topoDia, topoTarde, Math.max(entardecer, noite * 2) * 0.9);
  const base = noite > 0.5 ? misturar(baseTarde, baseNoite, (noite - 0.5) * 2) : misturar(baseDia, baseTarde, Math.max(entardecer, noite * 2) * 0.9);
  return { topo, base, noite };
}

// ------------------------------------------------------------------ pintores de fundo
type Pintor = (ctx: Ctx, t: Trecho, hora: number, tempo: number) => void;

function ceu(ctx: Ctx, x0: number, x1: number, hora: number, ate = FLOOR) {
  const c = coresCeu(hora);
  const g = ctx.createLinearGradient(0, 0, 0, ate);
  g.addColorStop(0, c.topo);
  g.addColorStop(1, c.base);
  ctx.fillStyle = g;
  ctx.fillRect(x0, 0, x1 - x0, ate);
  if (c.noite > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(c.noite - 0.6) * 1.8})`;
    for (let i = 0; i < 26; i++) {
      const sx = x0 + ((i * 397 + x0 * 7) % (x1 - x0)), sy = 20 + ((i * 131) % 260);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
}

function janela(ctx: Ctx, x: number, y: number, w: number, h: number, hora: number, cortina = '#e87a90') {
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ceu(ctx, x, x + w, hora, y + h);
  // prédios lá fora
  const { noite } = luz(hora);
  ctx.fillStyle = noite > 0.5 ? '#1c2244' : '#8fb4cf';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i * (w / 4) + 6, y + h * (0.45 + (i % 2) * 0.12), w / 4 - 10, h);
  if (noite > 0.5) {
    ctx.fillStyle = '#ffd97a';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 14 + i * (w / 6), y + h * 0.7, 5, 6);
  }
  ctx.restore();
  ctx.strokeStyle = '#d8cfc0';
  ctx.lineWidth = 6;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  // cortinas
  ctx.fillStyle = cortina;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 16); ctx.lineTo(x + 22, y - 16); ctx.quadraticCurveTo(x + 10, y + h * 0.6, x + 18, y + h + 16); ctx.lineTo(x - 22, y + h + 16); ctx.closePath();
  ctx.moveTo(x + w + 22, y - 16); ctx.lineTo(x + w - 22, y - 16); ctx.quadraticCurveTo(x + w - 10, y + h * 0.6, x + w - 18, y + h + 16); ctx.lineTo(x + w + 22, y + h + 16); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9a8a74';
  ctx.fillRect(x - 36, y - 22, w + 72, 7);
}

/** parede interna com papel de parede listrado + rodapé */
function parede(ctx: Ctx, x0: number, x1: number, cor: string, lista: string, faixa = true) {
  ctx.fillStyle = cor;
  ctx.fillRect(x0, 0, x1 - x0, FLOOR);
  if (faixa) {
    ctx.fillStyle = lista;
    for (let x = x0; x < x1; x += 44) ctx.fillRect(x, 0, 16, FLOOR - 150);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x0, FLOOR - 150, x1 - x0, 150);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x0, FLOOR - 154, x1 - x0, 6);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(x0, 0, x1 - x0, 26);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(x0, FLOOR - 16, x1 - x0, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x0, FLOOR - 2, x1 - x0, 2);
}

function piso(ctx: Ctx, x0: number, x1: number, tipo: 'madeira' | 'ceramica' | 'azulejo' | 'borracha' | 'calcada', c1: string, c2: string) {
  const g = ctx.createLinearGradient(0, FLOOR, 0, 720);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x0, FLOOR, x1 - x0, 720 - FLOOR);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, FLOOR, x1 - x0, 720 - FLOOR);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  if (tipo === 'madeira') {
    for (let i = 0, y = FLOOR + 8; y < 720; i++, y += 10 + i * 2.2) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      for (let x = x0 + ((i * 97) % 140); x < x1; x += 180 + i * 6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10 + i * 2.2); ctx.stroke(); }
    }
  } else if (tipo === 'borracha') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < (x1 - x0) / 6; i++) ctx.fillRect(x0 + ((i * 53) % (x1 - x0)), FLOOR + ((i * 29) % 160), 2, 2);
    for (let x = x0; x < x1; x += 160) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x - 40, 720); ctx.stroke(); }
  } else {
    const passo = tipo === 'azulejo' ? 50 : tipo === 'calcada' ? 90 : 110;
    const meio = (x0 + x1) / 2;
    for (let x = x0 - passo * 4; x < x1 + passo * 4; x += passo) {
      ctx.beginPath(); ctx.moveTo(meio + (x - meio) * 0.72, FLOOR); ctx.lineTo(meio + (x - meio) * 1.25, 720); ctx.stroke();
    }
    for (let i = 0, y = FLOOR + 14; y < 720; i++, y += 16 + i * 5) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  }
  ctx.restore();
}

/** batente de porta entre dois cômodos (a passagem é livre) */
function batente(ctx: Ctx, x: number, cor = '#efe6d6') {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 34, 0, 68, FLOOR);
  ctx.fillStyle = cor;
  ctx.fillRect(x - 30, 0, 12, FLOOR);
  ctx.fillRect(x + 18, 0, 12, FLOOR);
  ctx.fillRect(x - 30, 150, 60, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - 18, 164, 36, FLOOR - 164);
}

function quadro(ctx: Ctx, x: number, y: number, w: number, h: number, cor: string) {
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
  ctx.fillStyle = cor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(x + w * 0.65, y + h * 0.35, Math.min(w, h) * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * 0.4, y + h * 0.45); ctx.lineTo(x + w * 0.7, y + h * 0.7); ctx.lineTo(x + w, y + h * 0.5); ctx.lineTo(x + w, y + h); ctx.fill();
}

function luminariaTeto(ctx: Ctx, x: number, hora: number) {
  const { noite } = luz(hora);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 70); ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.moveTo(x - 34, 100); ctx.lineTo(x + 34, 100); ctx.lineTo(x + 16, 68); ctx.lineTo(x - 16, 68); ctx.closePath(); ctx.fill();
  if (noite > 0.2) {
    const g = ctx.createRadialGradient(x, 120, 10, x, 300, 420);
    g.addColorStop(0, `rgba(255,220,150,${0.32 * noite})`);
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 450, 90, 900, 630);
  }
}

function predios(ctx: Ctx, x0: number, x1: number, hora: number, semente: number) {
  const { noite } = luz(hora);
  for (let x = x0 - 40, i = 0; x < x1; i++) {
    const w = 120 + ((i * 37 + semente) % 90), h = 180 + ((i * 71 + semente) % 200);
    ctx.fillStyle = noite > 0.5 ? '#232a52' : ['#9db6cc', '#b7c7d6', '#8aa6bf'][i % 3];
    ctx.fillRect(x, FLOOR - 40 - h, w, h + 40);
    ctx.fillStyle = noite > 0.5 ? 'rgba(255,217,122,0.8)' : 'rgba(255,255,255,0.35)';
    for (let wy = FLOOR - 20 - h; wy < FLOOR - 70; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 28) if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 12, 16);
    x += w + 16;
  }
}

function calcada(ctx: Ctx, x0: number, x1: number, hora: number) {
  // gramado/muro ao fundo, calçada e meio-fio
  ctx.fillStyle = '#6fae5a';
  ctx.fillRect(x0, FLOOR - 30, x1 - x0, 34);
  piso(ctx, x0, x1, 'calcada', '#d9d4c8', '#bdb6a6');
  ctx.fillStyle = '#8c877c';
  ctx.fillRect(x0, 706, x1 - x0, 5);
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(x0, 711, x1 - x0, 9);
  void hora;
}

export const PINTORES: Record<string, Pintor> = {
  quarto: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#cfe0f0', '#c1d4e8');
    piso(ctx, t.x0, t.x1, 'madeira', '#c8955e', '#a8764a');
    janela(ctx, t.x0 + 540, 170, 170, 190, hora, '#7aa7e8');
    quadro(ctx, t.x0 + 140, 190, 120, 90, '#f4b6c8');
    luminariaTeto(ctx, t.x0 + 600, hora);
  },
  banheiro: (ctx, t, hora) => {
    ctx.fillStyle = '#e8f3f5';
    ctx.fillRect(t.x0, 0, t.x1 - t.x0, FLOOR);
    ctx.strokeStyle = 'rgba(80,140,160,0.25)';
    ctx.lineWidth = 2;
    for (let y = 250; y < FLOOR; y += 40) { ctx.beginPath(); ctx.moveTo(t.x0, y); ctx.lineTo(t.x1, y); ctx.stroke(); }
    for (let x = t.x0; x < t.x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, FLOOR); ctx.stroke(); }
    ctx.fillStyle = '#9fd3dc';
    ctx.fillRect(t.x0, 244, t.x1 - t.x0, 8);
    piso(ctx, t.x0, t.x1, 'azulejo', '#dbe7ea', '#b9ccd1');
    // box do chuveiro: parede de azulejo, ralo e registro (o chuveiro e a vidraça são objetos)
    ctx.fillStyle = '#d6ecf1';
    ctx.fillRect(t.x0 + 390, 110, 180, FLOOR - 110);
    ctx.strokeStyle = 'rgba(80,140,160,0.3)';
    ctx.lineWidth = 1.5;
    for (let y = 130; y < FLOOR; y += 30) { ctx.beginPath(); ctx.moveTo(t.x0 + 390, y); ctx.lineTo(t.x0 + 570, y); ctx.stroke(); }
    ctx.fillStyle = '#b9c8cc';
    ctx.fillRect(t.x0 + 386, 104, 188, 8);
    ctx.fillStyle = '#9fb1b6';
    ctx.beginPath(); ctx.ellipse(t.x0 + 480, 612, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9d2d4';
    ctx.beginPath(); ctx.arc(t.x0 + 540, 330, 9, 0, Math.PI * 2); ctx.fill();
    // porta-toalha com toalha pendurada
    ctx.fillStyle = '#9aa7b0';
    ctx.fillRect(t.x0 + 30, 300, 110, 6);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(t.x0 + 50, 306, 70, 120);
    ctx.fillStyle = '#7fb3d5';
    ctx.fillRect(t.x0 + 50, 390, 70, 10);
    luminariaTeto(ctx, t.x0 + 300, hora);
    batente(ctx, t.x0);
  },
  cozinha: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#fbe9c9', '#f4dcb0', false);
    // azulejo de cozinha atrás da bancada
    ctx.fillStyle = '#fff6e6';
    ctx.fillRect(t.x0 + 20, 300, t.x1 - t.x0 - 40, 150);
    ctx.strokeStyle = 'rgba(200,160,110,0.35)';
    ctx.lineWidth = 1.5;
    for (let x = t.x0 + 20; x < t.x1 - 20; x += 30) { ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x, 450); ctx.stroke(); }
    for (let y = 300; y <= 450; y += 30) { ctx.beginPath(); ctx.moveTo(t.x0 + 20, y); ctx.lineTo(t.x1 - 20, y); ctx.stroke(); }
    // armários altos
    ctx.fillStyle = '#e07a5f';
    for (let x = t.x0 + 260; x < t.x0 + 900; x += 150) {
      ctx.fillRect(x, 140, 138, 130);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x + 62, 210, 14, 5);
      ctx.fillStyle = '#e07a5f';
    }
    piso(ctx, t.x0, t.x1, 'ceramica', '#e9dcc4', '#cbb895');
    janela(ctx, t.x0 + 960, 150, 120, 130, hora, '#f2c14e');
    luminariaTeto(ctx, t.x0 + 600, hora);
    batente(ctx, t.x0);
  },
  sala: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#f3d9c4', '#ecc9ae');
    piso(ctx, t.x0, t.x1, 'madeira', '#b98355', '#94653d');
    janela(ctx, t.x0 + 180, 160, 200, 200, hora, '#e87a90');
    quadro(ctx, t.x0 + 520, 180, 150, 100, '#7fb3d5');
    quadro(ctx, t.x0 + 720, 200, 80, 80, '#f2c14e');
    luminariaTeto(ctx, t.x0 + 450, hora);
    luminariaTeto(ctx, t.x0 + 1000, hora);
    batente(ctx, t.x0);
    // tapete
    ctx.fillStyle = 'rgba(91,60,136,0.55)';
    ctx.beginPath(); ctx.ellipse(t.x0 + 520, 670, 300, 34, 0, 0, Math.PI * 2); ctx.fill();
    // parede externa com a porta da frente (aberta)
    const px = t.x1;
    ctx.fillStyle = '#b86b4b';
    ctx.fillRect(px - 40, 0, 40, FLOOR);
    ctx.fillStyle = '#6b3f26';
    ctx.fillRect(px - 150, 150, 110, FLOOR - 150);
    ctx.fillStyle = '#8a5a3a';
    ctx.beginPath(); ctx.moveTo(px - 150, 150); ctx.lineTo(px - 104, 172); ctx.lineTo(px - 104, FLOOR + 6); ctx.lineTo(px - 150, FLOOR); ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(px - 116, 370, 5, 0, Math.PI * 2); ctx.fill();
  },
  frenteCasa: (ctx, t, hora) => {
    // a casa aparece "em corte" à esquerda (os cômodos); aqui fora: jardim, muro baixo, caixa de correio e a cidade
    ceu(ctx, t.x0, t.x1, hora);
    predios(ctx, t.x0 + 200, t.x1, hora, 3);
    // telhado da casa saindo da parede externa
    ctx.fillStyle = '#c0533a';
    ctx.beginPath(); ctx.moveTo(t.x0 - 60, 40); ctx.lineTo(t.x0 + 90, 150); ctx.lineTo(t.x0 - 60, 150); ctx.closePath(); ctx.fill();
    // jardim com arbustos e flores
    ctx.fillStyle = '#5a9e4b';
    ctx.fillRect(t.x0, FLOOR - 60, 520, 64);
    for (let i = 0; i < 7; i++) {
      const bx = t.x0 + 40 + i * 70;
      ctx.fillStyle = i % 2 ? '#4c8f3f' : '#62ad52';
      ctx.beginPath(); ctx.arc(bx, FLOOR - 58, 34, Math.PI, 0); ctx.fill();
      ctx.fillStyle = ['#f4b6c8', '#f2c14e', '#fff'][i % 3];
      ctx.beginPath(); ctx.arc(bx - 10, FLOOR - 70, 5, 0, Math.PI * 2); ctx.arc(bx + 12, FLOOR - 62, 4, 0, Math.PI * 2); ctx.fill();
    }
    // muro baixo com portão
    ctx.fillStyle = '#e9e1d2';
    ctx.fillRect(t.x0 + 520, FLOOR - 90, 440, 94);
    ctx.fillStyle = '#d4c9b5';
    for (let x = t.x0 + 520; x < t.x0 + 960; x += 55) ctx.fillRect(x, FLOOR - 94, 50, 10);
    // caixa de correio
    ctx.fillStyle = '#58606a';
    ctx.fillRect(t.x0 + 1000, FLOOR - 110, 8, 114);
    ctx.fillStyle = '#2b5d8a';
    ctx.fillRect(t.x0 + 980, FLOOR - 150, 48, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Nº 42', t.x0 + 983, FLOOR - 124);
    calcada(ctx, t.x0, t.x1, hora);
  },
  rua: (ctx, t, hora) => {
    ceu(ctx, t.x0, t.x1, hora);
    predios(ctx, t.x0, t.x1, hora, 11);
    calcada(ctx, t.x0, t.x1, hora);
  },
  frenteAcademia: (ctx, t, hora, tempo) => {
    ceu(ctx, t.x0, t.x1, hora);
    predios(ctx, t.x0, t.x0 + 400, hora, 5);
    // prédio da academia
    ctx.fillStyle = '#2b2d3a';
    ctx.fillRect(t.x0 + 380, 60, t.x1 - t.x0 - 380, FLOOR - 60);
    ctx.fillStyle = '#3a3d4f';
    for (let y = 100; y < 380; y += 60) ctx.fillRect(t.x0 + 380, y, t.x1 - t.x0 - 380, 4);
    // letreiro neon
    const pisca = (Math.sin(tempo * 3.3) + 1) / 2;
    ctx.fillStyle = '#12131a';
    ctx.fillRect(t.x0 + 470, 120, 420, 90);
    ctx.font = '900 54px sans-serif';
    ctx.fillStyle = `rgba(255,70,110,${0.75 + pisca * 0.25})`;
    ctx.shadowColor = '#ff466e';
    ctx.shadowBlur = 18;
    ctx.fillText('VIVA FIT', t.x0 + 520, 185);
    ctx.shadowBlur = 0;
    // vidraças e porta de vidro
    ctx.fillStyle = 'rgba(140,200,230,0.55)';
    ctx.fillRect(t.x0 + 430, 260, 330, FLOOR - 260);
    ctx.strokeStyle = '#9aa';
    ctx.lineWidth = 4;
    ctx.strokeRect(t.x0 + 430, 260, 330, FLOOR - 260);
    ctx.fillStyle = 'rgba(160,210,235,0.6)';
    ctx.fillRect(t.x1 - 120, 250, 110, FLOOR - 250);
    ctx.strokeRect(t.x1 - 120, 250, 110, FLOOR - 250);
    calcada(ctx, t.x0, t.x1, hora);
  },
  academiaCardio: (ctx, t, hora) => academia(ctx, t, hora, true),
  academiaPesos: (ctx, t, hora) => academia(ctx, t, hora, false),
};

function academia(ctx: Ctx, t: Trecho, hora: number, cardio: boolean) {
  ctx.fillStyle = '#2f3240';
  ctx.fillRect(t.x0, 0, t.x1 - t.x0, FLOOR);
  ctx.fillStyle = '#e63956';
  ctx.fillRect(t.x0, 330, t.x1 - t.x0, 16);
  // espelhos na parede do fundo
  const g = ctx.createLinearGradient(0, 120, 0, 480);
  g.addColorStop(0, 'rgba(190,215,235,0.35)');
  g.addColorStop(1, 'rgba(120,150,175,0.25)');
  ctx.fillStyle = g;
  for (let x = t.x0 + 60; x < t.x1 - 100; x += 300) {
    ctx.fillRect(x, 360, 260, 190);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(x + 30, 360); ctx.lineTo(x + 70, 360); ctx.lineTo(x + 20, 550); ctx.lineTo(x - 20 + 20, 550); ctx.fill();
    ctx.fillStyle = g;
  }
  // cartazes
  ctx.font = '900 30px sans-serif';
  ctx.fillStyle = '#f2c14e';
  if (cardio) ctx.fillText('SEM DOR, SEM GANHO', t.x0 + 180, 120);
  else ctx.fillText('HOJE É DIA DE PERNA (MENTIRA)', t.x0 + 140, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '700 18px sans-serif';
  ctx.fillText(cardio ? 'Horário: 6h às 23h · Traga toalha' : 'Devolva os halteres. Por favor. Estamos implorando.', t.x0 + 180, 160);
  piso(ctx, t.x0, t.x1, 'borracha', '#2a2a30', '#15151a');
  // luzes tubulares
  for (let x = t.x0 + 150; x < t.x1; x += 380) {
    ctx.fillStyle = '#f7f7ff';
    ctx.fillRect(x, 30, 220, 10);
  }
  if (cardio) batente(ctx, t.x0, '#9aa0b0');
  else batente(ctx, t.x0, '#9aa0b0');
  void hora;
}

// ------------------------------------------------------------------ desenhos próprios de objetos
export const DESENHOS: Record<string, (ctx: Ctx, o: ObjetoMundo, hora: number) => void> = {
  pia: (ctx) => {
    ctx.fillStyle = '#f4f7f8';
    ctx.fillRect(-70, -110, 140, 110);
    ctx.fillStyle = '#dfe7ea';
    ctx.fillRect(-80, -120, 160, 16);
    ctx.fillStyle = '#b9c8cc';
    ctx.fillRect(-6, -150, 12, 32);
    // espelho
    ctx.fillStyle = 'rgba(190,225,240,0.8)';
    ctx.fillRect(-60, -310, 120, 140);
    ctx.strokeStyle = '#c9b89a';
    ctx.lineWidth = 6;
    ctx.strokeRect(-60, -310, 120, 140);
  },
  pontoOnibus: (ctx) => {
    ctx.fillStyle = '#2b5d8a';
    ctx.fillRect(-120, -260, 240, 16);
    ctx.fillStyle = '#58606a';
    ctx.fillRect(-110, -250, 8, 250);
    ctx.fillRect(102, -250, 8, 250);
    ctx.fillStyle = 'rgba(160,210,235,0.45)';
    ctx.fillRect(-100, -240, 200, 150);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(-90, -70, 180, 12);
    ctx.fillStyle = '#f2c14e';
    ctx.fillRect(126, -300, 60, 60);
    ctx.fillStyle = '#2b2d3a';
    ctx.font = '900 30px sans-serif';
    ctx.fillText('🚌', 136, -258);
    ctx.fillStyle = '#58606a';
    ctx.fillRect(152, -240, 8, 240);
  },
  // vaso sanitário (tampa abre; na descarga a água gira) + rolo de papel na parede
  vaso: (ctx, o) => {
    const op = o as unknown as { tampa?: number; agua?: number };
    // rolo de papel
    ctx.fillStyle = '#9aa7b0';
    ctx.fillRect(-92, -176, 26, 5);
    ctx.fillStyle = '#fbfaf6';
    ctx.beginPath(); ctx.arc(-79, -164, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-90, -164, 9, 22);
    // caixa acoplada
    ctx.fillStyle = '#f4f7f8';
    ctx.fillRect(-46, -150, 46, 78);
    ctx.fillStyle = '#dfe7ea';
    ctx.fillRect(-50, -156, 54, 10);
    ctx.fillStyle = '#c9d2d4';
    ctx.beginPath(); ctx.arc(-23, -151, 5, 0, Math.PI * 2); ctx.fill();
    // pé e bacia
    ctx.fillStyle = '#e9eff1';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(26, 0); ctx.quadraticCurveTo(30, -34, 44, -58); ctx.lineTo(-30, -58); ctx.quadraticCurveTo(-24, -30, -18, 0); ctx.fill();
    ctx.fillStyle = '#f7fafb';
    ctx.beginPath(); ctx.ellipse(8, -60, 40, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (op.agua ?? 0) > 0 ? '#8fd0e6' : '#bfe3ee';
    ctx.beginPath(); ctx.ellipse(10, -61, 28, 6, 0, 0, Math.PI * 2); ctx.fill();
    if ((op.agua ?? 0) > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(10, -61, 16 * (op.agua ?? 0), 3.5 * (op.agua ?? 0), (op.agua ?? 0) * 9, 0, Math.PI * 1.4); ctx.stroke();
    }
    // assento e tampa
    ctx.strokeStyle = '#dfe7ea';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(8, -62, 40, 11, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f4f7f8';
    if (op.tampa) { ctx.beginPath(); ctx.ellipse(-36, -100, 9, 42, 0.1, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(8, -64, 41, 10, 0, Math.PI, Math.PI * 2); ctx.fill(); }
  },
  // chuveiro (a água é desenhada em partículas pelo controlador)
  chuveiro: (ctx) => {
    ctx.fillStyle = '#b9c8cc';
    ctx.fillRect(-4, -470, 8, 40);
    ctx.fillRect(-4, -434, 34, 7);
    ctx.fillStyle = '#c9d2d4';
    ctx.beginPath(); ctx.ellipse(34, -424, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = -2; i <= 2; i++) ctx.fillRect(32 + i * 7, -419, 2, 2);
  },
  balcaoAcademia: (ctx) => {
    ctx.fillStyle = '#e63956';
    ctx.fillRect(-130, -120, 260, 120);
    ctx.fillStyle = '#1c1d26';
    ctx.fillRect(-140, -132, 280, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '900 26px sans-serif';
    ctx.fillText('RECEPÇÃO', -72, -52);
  },
  bebedouro: (ctx) => {
    ctx.fillStyle = '#d7dde2';
    ctx.fillRect(-30, -150, 60, 150);
    ctx.fillStyle = 'rgba(140,200,240,0.8)';
    ctx.fillRect(-26, -200, 52, 56);
    ctx.fillStyle = '#9aa7b0';
    ctx.fillRect(-10, -120, 20, 10);
  },
  espelhao: (ctx) => {
    ctx.fillStyle = 'rgba(200,225,240,0.55)';
    ctx.fillRect(-95, -330, 190, 320);
    ctx.strokeStyle = '#1c1d26';
    ctx.lineWidth = 8;
    ctx.strokeRect(-95, -330, 190, 320);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.moveTo(-60, -330); ctx.lineTo(-20, -330); ctx.lineTo(-80, -10); ctx.lineTo(-95, -10); ctx.fill();
  },
};
