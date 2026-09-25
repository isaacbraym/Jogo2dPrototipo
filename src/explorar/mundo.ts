/**
 * Modo Explorar — o MUNDO (v2): uma rua contínua em PROFUNDIDADE (2,5D, estilo casa de bonecas).
 *
 *   y   95 ─ 560   parede do fundo dos interiores / céu e prédios distantes lá fora
 *   y  560 ─ 750   chão dos interiores (onde se anda dentro de casa e da academia) / praça
 *   y  750          FACHADAS dos prédios (somem quando você está dentro — corte estilo The Sims)
 *   y  750 ─ 805   jardim e caminho até a porta
 *   y  805 ─ 892   CALÇADA contínua (quem passa na rua anda aqui, em frente às casas)
 *   y  898 ─ 1000  rua com carros
 *
 * Tudo que se desenha tem escala real (1 m = 170 px — ver moveis.ts) e a escala da profundidade (escalaProf).
 * Para acrescentar coisas, leia docs/EXPLORAR.md e instrucoesCodex/.
 */
import type { Ctx } from '../render/draw';
import type { Life } from '../game/state';
import type { Trecho, ObjetoMundo, EstadoExplorar, Zona } from './tipos';
import { M, OX, OY, caixa } from './moveis';

export const FLOOR = 560;
export const TETO = 95;
export const FACHADA_Y = 750;
export const CALCADA_Y0 = 805, CALCADA_Y1 = 892, RUA_Y0 = 898;
export const MUNDO_ALTURA = 1000;
/** limites de andar (usados por partes antigas do código) */
export const CHAO_FUNDO = 606;
export const CHAO_FRENTE = 888;

/** Escala da profundidade: quanto mais perto da câmera (y maior), maior. Vale para gente E objetos. */
export function escalaProf(y: number) {
  return 0.8 + Math.max(0, Math.min(1.25, (y - 600) / 280)) * 0.36;
}

// ------------------------------------------------------------------ trechos (fundo: interiores e paisagens)
export const TRECHOS: Trecho[] = [
  { id: 'vizinho', nome: 'Rua das Palmeiras', lugar: 'rua', x0: 0, x1: 300, pintor: 'paisagem', interno: false },
  { id: 'quarto', nome: 'Quarto', lugar: 'casa', x0: 300, x1: 1150, pintor: 'quarto', interno: true },
  { id: 'banheiro', nome: 'Banheiro', lugar: 'casa', x0: 1150, x1: 1750, pintor: 'banheiro', interno: true },
  { id: 'cozinha', nome: 'Cozinha', lugar: 'casa', x0: 1750, x1: 2600, pintor: 'cozinha', interno: true },
  { id: 'sala', nome: 'Sala', lugar: 'casa', x0: 2600, x1: 3600, pintor: 'sala', interno: true },
  { id: 'praca', nome: 'Praça', lugar: 'rua', x0: 3600, x1: 5900, pintor: 'praca', interno: false, minIdade: 8 },
  { id: 'cardio', nome: 'Academia · cardio', lugar: 'academia', x0: 5900, x1: 7700, pintor: 'academiaCardio', interno: true, minIdade: 14 },
  { id: 'musculacao', nome: 'Academia · musculação', lugar: 'academia', x0: 7700, x1: 8900, pintor: 'academiaPesos', interno: true, minIdade: 14 },
  { id: 'lojas', nome: 'Comércio', lugar: 'rua', x0: 8900, x1: 11200, pintor: 'paisagem', interno: false, minIdade: 8 },
];
export const MUNDO_X0 = 0;
export const MUNDO_X1 = 11200;

export function trechoEm(x: number): Trecho {
  return TRECHOS.find((t) => x >= t.x0 && x < t.x1) ?? (x < MUNDO_X0 ? TRECHOS[0] : TRECHOS[TRECHOS.length - 1]);
}
export const trechoPorId = (id: string) => TRECHOS.find((t) => t.id === id)!;

// ------------------------------------------------------------------ zonas de andar (sobreposição = passagem)
export const ZONAS: Zona[] = [
  { id: 'casa', x0: 330, x1: 3570, y0: 608, y1: 742, predio: 'casa' },
  { id: 'portaCasa', x0: 3312, x1: 3388, y0: 734, y1: 820, minIdade: 8 },
  { id: 'calcada', x0: 20, x1: 11180, y0: 814, y1: 886, minIdade: 8 },
  { id: 'praca', x0: 3620, x1: 5880, y0: 642, y1: 820, minIdade: 8 },
  { id: 'portaAcademia', x0: 6072, x1: 6148, y0: 734, y1: 820, minIdade: 14 },
  { id: 'academia', x0: 5930, x1: 8870, y0: 608, y1: 742, predio: 'academia', minIdade: 14 },
];

export function zonaEm(x: number, y: number): Zona | null {
  // preferência para zonas de prédio/porta quando há sobreposição
  let achou: Zona | null = null;
  for (const z of ZONAS) if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) { if (!achou || z.predio || z.id.startsWith('porta')) achou = z; }
  return achou;
}

/** Ponto andável mais próximo (clique fora das zonas vai para a borda mais perto). */
export function pontoAndavel(x: number, y: number, idade = 99): { x: number; y: number; zona: Zona } {
  let melhor: { x: number; y: number; zona: Zona } | null = null, dMin = Infinity;
  for (const z of ZONAS) {
    if ((z.minIdade ?? 0) > idade) continue;
    let px = Math.max(z.x0, Math.min(z.x1, x)), py = Math.max(z.y0, Math.min(z.y1, y));
    // Praça/calçada têm móveis altos: o clique precisa parar no contorno físico, não no meio do desenho.
    ({ x: px, y: py } = tirarDeObstaculos(px, py, z));
    const d = Math.hypot(px - x, (py - y) * 1.4);
    if (d < dMin) { dMin = d; melhor = { x: px, y: py, zona: z }; }
  }
  return melhor!;
}

function tirarDeObstaculos(x: number, y: number, z: Zona): { x: number; y: number } {
  let px = x, py = y;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const hit = obstaculosAndar().find((o) => Math.abs(px - o.x) < o.rx && Math.abs(py - o.y) < o.ry);
    if (!hit) break;
    const margem = 4;
    const candidatos = [
      { x: hit.x - hit.rx - margem, y: py },
      { x: hit.x + hit.rx + margem, y: py },
      { x: px, y: hit.y - hit.ry - margem },
      { x: px, y: hit.y + hit.ry + margem },
    ].filter((p) => p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1);
    if (!candidatos.length) break;
    const melhor = candidatos.sort((a, b) => Math.hypot(a.x - px, (a.y - py) * 1.4) - Math.hypot(b.x - px, (b.y - py) * 1.4))[0];
    px = melhor.x; py = melhor.y;
  }
  return { x: px, y: py };
}

function obstaculosAndar(): { x: number; y: number; rx: number; ry: number }[] {
  const out: { x: number; y: number; rx: number; ry: number }[] = [];
  for (const o of OBJETOS) {
    if (o.id === 'chafariz') out.push({ x: o.x, y: o.y + 24, rx: 225, ry: 92 });
    else if (o.id.startsWith('bancoPraca')) out.push({ x: o.x, y: o.y + 8, rx: 190, ry: 42 });
    else if (o.id === 'pontoOnibus') out.push({ x: o.x, y: o.y - 4, rx: 150, ry: 48 });
  }
  for (const d of DECORACAO) {
    if (d.desenho === 'poste') out.push({ x: d.x, y: d.y, rx: 24, ry: 28 });
    else if (d.desenho === 'lixeira') out.push({ x: d.x, y: d.y, rx: 38, ry: 30 });
    else if (d.desenho === 'hidrante') out.push({ x: d.x, y: d.y, rx: 34, ry: 26 });
    else if (d.desenho === 'arvore' && d.y >= 640) out.push({ x: d.x, y: d.y, rx: 48, ry: 34 });
  }
  return out;
}

const liga = (a: Zona, b: Zona) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

/** Rota entre dois pontos passando pelas passagens (busca em largura nas zonas). */
export function rota(de: { x: number; y: number }, para: { x: number; y: number }, idade = 99): { x: number; y: number }[] {
  const zi = zonaEm(de.x, de.y) ?? pontoAndavel(de.x, de.y, idade).zona;
  const alvo = pontoAndavel(para.x, para.y, idade);
  if (zi === alvo.zona || (zonaEm(alvo.x, alvo.y) === zi)) return [{ x: alvo.x, y: alvo.y }];
  const vis = new Map<Zona, Zona | null>([[zi, null]]);
  const fila: Zona[] = [zi];
  while (fila.length) {
    const z = fila.shift()!;
    if (z === alvo.zona) break;
    for (const n of ZONAS) if (!vis.has(n) && liga(z, n) && (n.minIdade ?? 0) <= idade) { vis.set(n, z); fila.push(n); }
  }
  if (!vis.has(alvo.zona)) return [{ x: Math.max(zi.x0, Math.min(zi.x1, para.x)), y: Math.max(zi.y0, Math.min(zi.y1, para.y)) }];
  const cadeia: Zona[] = [];
  for (let z: Zona | null = alvo.zona; z; z = vis.get(z) ?? null) cadeia.unshift(z);
  const pts: { x: number; y: number }[] = [];
  let cx = de.x, cy = de.y;
  for (let i = 0; i < cadeia.length - 1; i++) {
    const a = cadeia[i], b = cadeia[i + 1];
    // centro da passagem (interseção), puxado para o ponto atual
    const ix0 = Math.max(a.x0, b.x0), ix1 = Math.min(a.x1, b.x1), iy0 = Math.max(a.y0, b.y0), iy1 = Math.min(a.y1, b.y1);
    const px = Math.max(ix0 + 6, Math.min(ix1 - 6, cx)), py = (iy0 + iy1) / 2;
    // entra na passagem pelo lado certo (primeiro alinha em x dentro da zona atual)
    if (Math.abs(px - cx) > 8) pts.push({ x: px, y: Math.max(a.y0, Math.min(a.y1, cy)) });
    pts.push({ x: px, y: py });
    cx = px; cy = py;
  }
  pts.push({ x: alvo.x, y: alvo.y });
  return pts;
}

/** Nome do lugar para o HUD. */
export function lugarEm(x: number, y: number): string {
  const z = zonaEm(x, y);
  if (z?.id === 'calcada' || z?.id?.startsWith('porta')) {
    const t = trechoEm(x);
    const frente = t.lugar === 'casa' ? 'de casa' : t.lugar === 'academia' ? 'da academia' : t.id === 'praca' ? 'da praça' : t.id === 'lojas' ? 'do comércio' : '';
    return `Calçada${frente ? ' · em frente ' + frente : ''}`;
  }
  return trechoEm(x).nome;
}

export const PONTOS = { inicioX: 700, inicioY: 712, portaCasa: 3350, pontoOnibus: 5700, portaAcademia: 6110, recepcao: 6300, frenteCasa: { x: 3350, y: 850 }, frenteAcademia: { x: 6110, y: 850 }, praca: { x: 4700, y: 760 } };

// ------------------------------------------------------------------ requisitos comuns
const matriculado = (L: Life, e: EstadoExplorar) => (e.matriculaAte !== undefined && e.matriculaAte >= L.player.age ? null : 'Faça a matrícula na recepção primeiro.');
const cansado = (min: number) => (_L: Life, e: EstadoExplorar) => (e.nec.energia < min ? 'Você está sem energia. Coma algo ou vá dormir.' : null);
const juntos = (...fs: ((L: Life, e: EstadoExplorar) => string | null)[]) => (L: Life, e: EstadoExplorar) => {
  for (const f of fs) { const r = f(L, e); if (r) return r; }
  return null;
};

// ------------------------------------------------------------------ objetos interativos (y = onde a pessoa usa; partes na frente/atrás dela)
export const OBJETOS: ObjetoMundo[] = [
  // ---- quarto
  {
    id: 'cama', nome: 'Cama', desenho: 'cama', x: 548, y: 668, w: 440, h: 200, opts: { color: '#3d7bd9' },
    partes: [{ desenho: 'cama', opts: { color: '#3d7bd9' } }, { desenho: 'camaCobertor', frente: true, opts: { color: '#3d7bd9' } }],
    acoes: [
      { id: 'dormir', label: 'Dormir (encerra o dia)', icon: '😴', minutos: 0, motion: 'dormirCama', dx: 30, dy: -26, lado: 1, plataforma: 0.52, especial: 'dormir', efeito: {} },
      { id: 'cochilar', label: 'Cochilar 1 h', icon: '💤', minutos: 60, motion: 'dormirCama', dx: 30, dy: -26, lado: 1, plataforma: 0.52, efeito: { nec: { energia: 22 } }, texto: 'Que cochilo bom.' },
    ],
  },
  {
    id: 'escrivaninha', nome: 'Escrivaninha', desenho: 'escrivaninha', x: 965, y: 664, w: 230, h: 210, opts: { color: '#e8e6e0' },
    partes: [{ desenho: 'cadeiraEscritorio', dx: -125 }, { desenho: 'escrivaninha', frente: true, opts: { color: '#e8e6e0' } }],
    acoes: [
      { id: 'estudar', label: 'Estudar', icon: '📚', minutos: 90, motion: 'estudar', dx: -125, lado: 1, assento: 0.48, efeito: { stats: { inteligencia: 3 }, nec: { energia: -10, diversao: -8 } }, texto: 'Estudou um bocado. O cérebro agradece; a diversão, não.', cond: cansado(10) },
      { id: 'jogarPc', label: 'Jogar no computador', icon: '🎮', minutos: 60, motion: 'digitar', dx: -125, lado: 1, assento: 0.48, efeito: { stats: { felicidade: 2 }, nec: { diversao: 22, energia: -5 } }, texto: 'Mais uma partida. Só mais uma.' },
    ],
  },
  {
    id: 'espelhoQuarto', nome: 'Espelho', desenho: 'espelhao', x: 1100, y: 612, w: 130, h: 330, escala: 0.62,
    acoes: [
      { id: 'arrumar', label: 'Se arrumar', icon: '💇', minutos: 20, motion: 'maosNaCintura', dx: -70, dy: 70, lado: 1, efeito: { stats: { aparencia: 2 }, nec: { social: 3 } }, texto: 'Pronto(a) para o mundo.' },
      { id: 'selfie', label: 'Tirar uma selfie', icon: '🤳', minutos: 10, motion: 'selfie', dx: -70, dy: 70, lado: 1, segura: 'celular', efeito: { stats: { felicidade: 1 }, nec: { social: 4 } }, texto: '37 fotos depois, uma prestou.' },
    ],
  },
  // ---- banheiro
  {
    id: 'pia', nome: 'Pia', desenho: 'pia', x: 1250, y: 618, w: 150, h: 200,
    acoes: [
      { id: 'lavarMaos', label: 'Lavar as mãos', icon: '🧼', minutos: 2, motion: 'lavarMaos', dx: 0, dy: 64, lado: 1, giro: 0.35, especial: 'lavarMaos', efeito: { nec: { higiene: 6 } } },
      { id: 'escovar', label: 'Escovar os dentes', icon: '🪥', minutos: 5, motion: 'lavarMaos', dx: 0, dy: 64, lado: 1, giro: 0.35, efeito: { stats: { saude: 1 }, nec: { higiene: 5 } }, texto: 'Dentes brilhando. O dentista ficaria orgulhoso (e desempregado).' },
    ],
  },
  {
    id: 'vaso', nome: 'Vaso sanitário', desenho: 'vaso', x: 1410, y: 660, w: 110, h: 170, opts: { tampa: 0, agua: 0 },
    acoes: [
      { id: 'xixi', label: 'Fazer o número 1', icon: '💧', minutos: 3, motion: 'xixiEmPe', dx: -78, dy: 0, lado: 1, especial: 'xixi', efeito: { nec: { bexiga: 100 } } },
      { id: 'coco', label: 'Fazer o número 2', icon: '💩', minutos: 12, motion: 'sentarVaso', dx: 4, dy: -8, lado: 1, giro: 0.4, assento: 0.46, especial: 'coco', efeito: { nec: { bexiga: 100 } } },
    ],
  },
  {
    id: 'chuveiro', nome: 'Chuveiro', desenho: 'box', x: 1590, y: 700, w: 200, h: 380,
    partes: [{ desenho: 'box' }, { desenho: 'boxFrente', frente: true }],
    acoes: [
      { id: 'banho', label: 'Tomar banho', icon: '🚿', minutos: 20, motion: 'banhoEnsaboar', dx: 20, dy: -44, lado: 1, plataforma: 0.08, especial: 'banho', efeito: { stats: { aparencia: 1, felicidade: 1 }, nec: { higiene: 100, energia: 6 } } },
    ],
  },
  // ---- cozinha
  {
    id: 'geladeira', nome: 'Geladeira', desenho: 'geladeira', x: 1850, y: 616, w: 130, h: 320,
    acoes: [
      { id: 'lanche', label: 'Fazer um lanche', icon: '🥪', minutos: 15, motion: 'comer', dx: 110, dy: 50, lado: -1, efeito: { nec: { fome: 30, energia: 5 } }, texto: 'Sanduíche de geladeira: gourmet do improviso.' },
      { id: 'agua', label: 'Beber água', icon: '🥤', minutos: 3, motion: 'beber', dx: 110, dy: 50, lado: -1, segura: 'xicara', efeito: { stats: { saude: 1 }, nec: { energia: 3, bexiga: -18 } }, texto: 'Hidratado(a). A bexiga anotou.' },
    ],
  },
  {
    id: 'bancada', nome: 'Fogão e bancada', desenho: 'bancada', x: 2190, y: 616, w: 380, h: 200,
    acoes: [
      { id: 'cozinhar', label: 'Cozinhar uma refeição', icon: '🍳', minutos: 50, motion: 'cozinhar', dx: 60, dy: 62, lado: 1, giro: 0.35, efeito: { stats: { saude: 2, felicidade: 1 }, nec: { fome: 55, diversao: 4 } }, texto: 'Arroz, feijão e orgulho.' },
      { id: 'lavarLouca', label: 'Lavar a louça', icon: '🧽', minutos: 20, motion: 'lavarMaos', dx: -110, dy: 62, lado: 1, giro: 0.35, efeito: { stats: { felicidade: -1 }, nec: { higiene: -2 } }, texto: 'A louça acabou. Por enquanto.' },
    ],
  },
  {
    id: 'mesaJantar', nome: 'Mesa de jantar', desenho: 'mesaJantar', x: 2340, y: 700, w: 300, h: 170,
    partes: [{ desenho: 'cadeira', dx: -190 }, { desenho: 'cadeira', dx: 190, opts: { flip: true } }, { desenho: 'mesaJantar', frente: true }],
    acoes: [
      { id: 'comerMesa', label: 'Comer à mesa', icon: '🍽️', minutos: 25, motion: 'comer', dx: -190, lado: 1, assento: 0.47, efeito: { nec: { fome: 35, social: 2 } }, texto: 'Refeição sentada, como gente civilizada.' },
    ],
  },
  // ---- sala
  {
    id: 'sofa', nome: 'Sofá', desenho: 'sofa', x: 2980, y: 650, w: 430, h: 190, opts: { color: '#3d7bd9', color2: '#f2c14e' },
    partes: [{ desenho: 'sofa', opts: { color: '#3d7bd9', color2: '#f2c14e' } }, { desenho: 'sofaBraco', frente: true, opts: { color: '#3d7bd9' } }],
    acoes: [
      { id: 'tv', label: 'Assistir TV', icon: '📺', minutos: 60, motion: 'sentarFeliz', dx: 40, dy: -26, lado: 1, giro: 0.5, assento: 0.44, efeito: { stats: { felicidade: 2 }, nec: { diversao: 25, energia: 4 } }, texto: 'Três episódios de uma série sobre uma série.' },
      { id: 'cochiloSofa', label: 'Tirar um cochilo', icon: '💤', minutos: 45, motion: 'dormirEmPe', dx: -40, dy: -26, lado: 1, giro: 0.4, assento: 0.44, efeito: { nec: { energia: 16 } }, texto: 'Acordou com a marca da almofada na cara.' },
    ],
  },
  {
    id: 'tv', nome: 'TV', desenho: 'rackTv', x: 3380, y: 626, w: 320, h: 260,
    acoes: [
      { id: 'videogame', label: 'Jogar videogame', icon: '🕹️', minutos: 60, motion: 'jogarVideogame', dx: -160, dy: 90, lado: 1, segura: 'controle', efeito: { stats: { felicidade: 3 }, nec: { diversao: 30, energia: -4 } }, texto: 'Zerou a fase. Perdeu a noção do tempo.' },
    ],
  },
  {
    id: 'estante', nome: 'Estante', desenho: 'estante', x: 2700, y: 610, w: 180, h: 330,
    acoes: [
      { id: 'lerLivro', label: 'Ler um livro', icon: '📖', minutos: 60, motion: 'ler', dx: 40, dy: 80, lado: -1, segura: 'livro', efeito: { stats: { inteligencia: 2, felicidade: 1 }, nec: { diversao: 10 } }, texto: 'Um capítulo virou cinco.' },
    ],
  },
  // ---- praça e calçada
  ...[4180, 5160].map((x, i): ObjetoMundo => ({
    id: 'bancoPraca' + (i + 1), nome: 'Banco da praça', desenho: 'bancoPraca', x, y: 690, w: 400, h: 170, exclusivo: true,
    acoes: [
      { id: 'observar', label: 'Sentar e ver o movimento', icon: '👀', minutos: 30, motion: 'sentar', dx: i ? 60 : -60, dy: -18, lado: i ? -1 : 1, giro: 0.45, assento: 0.45, efeito: { stats: { felicidade: 1 }, nec: { diversao: 8, energia: 6 } }, texto: 'Um senhor passou com um papagaio. O dia valeu.' },
    ],
  })),
  {
    id: 'chafariz', nome: 'Chafariz', desenho: 'chafariz', x: 4650, y: 700, w: 380, h: 240,
    acoes: [
      { id: 'moeda', label: 'Jogar uma moeda e pedir um desejo (R$ 1)', icon: '🪙', minutos: 3, motion: 'darOmbros', dx: -210, dy: 40, lado: 1, efeito: { stats: { felicidade: 1 }, dinheiro: -1, nec: { diversao: 4 } }, texto: 'Você pediu um desejo. O chafariz agradece a doação.' },
    ],
  },
  {
    id: 'pontoOnibus', nome: 'Ponto de ônibus', desenho: 'pontoOnibus', x: PONTOS.pontoOnibus, y: 830, w: 360, h: 420,
    acoes: [
      { id: 'onibus', label: 'Pegar ônibus (R$ 5)', icon: '🚌', minutos: 20, motion: 'parado', dx: 0, dy: 10, lado: 1, especial: 'onibus', efeito: { dinheiro: -5 } },
    ],
  },
  {
    id: 'orelhao', nome: 'Orelhão', desenho: 'orelhao', x: 9040, y: 826, w: 120, h: 300,
    acoes: [
      { id: 'orelhaoLigar', label: 'Tentar ligar', icon: '☎️', minutos: 5, motion: 'telefone', dx: -62, dy: 18, lado: 1, efeito: { nec: { diversao: 3 } }, texto: 'Ninguém atende orelhão desde 2004.' },
    ],
  },
  // ---- academia · cardio
  {
    id: 'balcao', nome: 'Recepção', desenho: 'balcaoAcademia', x: PONTOS.recepcao, y: 650, w: 360, h: 200,
    acoes: [
      { id: 'matricula', label: 'Fazer matrícula (R$ 120/ano)', icon: '📝', minutos: 10, motion: 'parado', dx: -210, dy: 40, lado: 1, especial: 'matricula', efeito: { dinheiro: -120 } },
    ],
  },
  ...[6720, 7110, 7500].map((x, i): ObjetoMundo => ({
    id: 'esteira' + (i + 1), nome: 'Esteira', desenho: 'esteira', x, y: 648, w: 400, h: 260, exclusivo: true,
    partes: [{ desenho: 'esteira' }, { desenho: 'esteiraFrente', frente: true }],
    acoes: [
      { id: 'correrEsteira', label: 'Correr 30 min', icon: '🏃', minutos: 30, motion: 'esteira', dx: -30, dy: -34, lado: 1, plataforma: 0.22, efeito: { stats: { saude: 3, aparencia: 1 }, fitness: 3, nec: { energia: -18, fome: -12, higiene: -22 } }, texto: 'Cinco quilômetros. Ou quatro. O visor está mentindo?', cond: juntos(matriculado, cansado(20)) },
      { id: 'caminharEsteira', label: 'Caminhar 30 min', icon: '🚶', minutos: 30, motion: 'andar', dx: -30, dy: -34, lado: 1, plataforma: 0.22, efeito: { stats: { saude: 2 }, fitness: 1, nec: { energia: -8, fome: -6, higiene: -10 } }, texto: 'Caminhada leve, consciência pesada.', cond: juntos(matriculado, cansado(10)) },
    ],
  })),
  ...[6820, 7180].map((x, i): ObjetoMundo => ({
    id: 'bike' + (i + 1), nome: 'Bicicleta ergométrica', desenho: 'bike', x, y: 730, w: 200, h: 220, exclusivo: true,
    acoes: [
      { id: 'pedalar', label: 'Pedalar 30 min', icon: '🚴', minutos: 30, motion: 'pedalar', dx: -22, dy: -4, lado: 1, assento: 0.66, efeito: { stats: { saude: 3 }, fitness: 2, nec: { energia: -14, fome: -10, higiene: -16 } }, texto: 'Pedalou 12 km sem sair do lugar. A vida é assim.', cond: juntos(matriculado, cansado(15)) },
    ],
  })),
  {
    id: 'bebedouro', nome: 'Bebedouro', desenho: 'bebedouro', x: 7650, y: 614, w: 90, h: 250,
    acoes: [
      { id: 'beberAcademia', label: 'Beber água', icon: '💧', minutos: 3, motion: 'beber', dx: -70, dy: 64, lado: 1, segura: 'xicara', efeito: { nec: { energia: 4, bexiga: -18 } }, texto: 'Água gelada pós-treino: melhor bebida do mundo.' },
    ],
  },
  // ---- academia · musculação
  ...[7960, 8270].map((x, i): ObjetoMundo => ({
    id: 'supino' + (i + 1), nome: 'Supino', desenho: 'supino', x, y: 668, w: 330, h: 230, exclusivo: true,
    acoes: [
      { id: 'supino', label: 'Supino (peito)', icon: '🏋️', minutos: 40, motion: 'supino', dx: 45, dy: -20, lado: 1, plataforma: 0.54, efeito: { stats: { saude: 2, aparencia: 2 }, fitness: 3, nec: { energia: -20, fome: -10, higiene: -18 } }, texto: 'O peito vai estar dolorido amanhã. Ótimo sinal (dizem).', cond: juntos(matriculado, cansado(22)) },
    ],
  })),
  {
    id: 'rackPesos', nome: 'Halteres', desenho: 'rackHalteres', x: 8610, y: 626, w: 360, h: 200, exclusivo: true,
    vagas: [{ dx: -160, dy: 90 }, { dx: 0, dy: 100 }, { dx: 160, dy: 90 }],
    acoes: [
      { id: 'rosca', label: 'Rosca direta (bíceps)', icon: '💪', minutos: 30, motion: 'rosca', dx: 0, dy: 100, lado: 1, giro: 0.4, segura: 'haltere', efeito: { stats: { aparencia: 2, saude: 1 }, fitness: 2, nec: { energia: -14, fome: -8, higiene: -14 } }, texto: 'Bíceps bombeado. Foto no espelho obrigatória.', cond: juntos(matriculado, cansado(15)) },
    ],
  },
  {
    id: 'espelhoAcademia', nome: 'Espelhão', desenho: 'espelhao', x: 8810, y: 610, w: 220, h: 360,
    acoes: [
      { id: 'selfieAcademia', label: 'Foto no espelho', icon: '🤳', minutos: 5, motion: 'selfie', dx: -120, dy: 80, lado: 1, segura: 'celular', efeito: { stats: { felicidade: 1 }, nec: { social: 5 } }, texto: '#foco #fé #frango' },
    ],
  },
];

export const objetoPorId = (id: string) => OBJETOS.find((o) => o.id === id);

/** Decoração sem ação (postes acendem à noite). `desenho` = MOVEIS; `prop` = PROPS antigos. */
export interface Decoracao { desenho?: string; prop?: string; x: number; y: number; escala?: number; opts?: Record<string, unknown>; acende?: boolean }
export const DECORACAO: Decoracao[] = [
  // quarto
  { desenho: 'tapete', x: 560, y: 736, opts: { color: '#5b3c88', w: 2.4, d: 0.9 } },
  { desenho: 'planta', x: 360, y: 700, opts: { s: 1.1 } },
  { desenho: 'luminariaPe', x: 800, y: 626 },
  // banheiro
  { desenho: 'tapete', x: 1400, y: 736, opts: { color: '#7fb3d5', w: 0.9, d: 0.5 } },
  // cozinha
  { desenho: 'planta', x: 2560, y: 626, opts: { s: 0.8, color: '#3d7bd9' } },
  // sala
  { desenho: 'tapete', x: 2960, y: 738, opts: { color: '#e8845a', w: 2.6, d: 1.0 } },
  { desenho: 'mesaCentro', x: 2960, y: 724 },
  { desenho: 'luminariaPe', x: 2740, y: 700 },
  { desenho: 'planta', x: 3530, y: 720, opts: { s: 1.2 } },
  // praça
  { desenho: 'arvore', x: 3720, y: 650, opts: { s: 1.1 } },
  { desenho: 'arvore', x: 4420, y: 646, opts: { s: 0.95, color: '#58b368' } },
  { desenho: 'arvore', x: 5500, y: 652, opts: { s: 1.05 } },
  { desenho: 'poste', x: 3950, y: 800, acende: true },
  { desenho: 'poste', x: 5300, y: 800, acende: true },
  { desenho: 'lixeira', x: 4400, y: 790 },
  { desenho: 'planta', x: 3900, y: 690, opts: { s: 0.9 } },
  // calçada
  { desenho: 'hidrante', x: 3640, y: 822 },
  { desenho: 'poste', x: 1200, y: 818, acende: true },
  { desenho: 'poste', x: 2500, y: 818, acende: true },
  { desenho: 'poste', x: 6700, y: 818, acende: true },
  { desenho: 'poste', x: 8000, y: 818, acende: true },
  { desenho: 'poste', x: 10000, y: 818, acende: true },
  { desenho: 'arvore', x: 7300, y: 816, opts: { s: 0.8, color: '#58b368' } },
  { desenho: 'lixeira', x: 9400, y: 822 },
  // academia
  { desenho: 'anilhas', x: 7790, y: 618 },
  { desenho: 'planta', x: 5980, y: 640, opts: { s: 1.2 } },
];

// ------------------------------------------------------------------ céu e luz pela hora
export function luz(hora: number) {
  const h = (hora / 60) % 24;
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

function ceu(ctx: Ctx, x0: number, x1: number, hora: number, ate = FLOOR, de = -400) {
  const c = coresCeu(hora);
  const g = ctx.createLinearGradient(0, 0, 0, ate);
  g.addColorStop(0, c.topo);
  g.addColorStop(1, c.base);
  ctx.fillStyle = g;
  ctx.fillRect(x0, de, x1 - x0, ate - de);
  if (c.noite > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(c.noite - 0.6) * 1.8})`;
    for (let i = 0; i < 26; i++) ctx.fillRect(x0 + ((i * 397 + x0 * 7) % Math.max(1, x1 - x0)), 20 + ((i * 131) % 260), 2, 2);
  }
}

function janela(ctx: Ctx, x: number, y: number, w: number, h: number, hora: number, cortina = '#e87a90') {
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ceu(ctx, x, x + w, hora, y + h, y);
  const { noite } = luz(hora);
  ctx.fillStyle = noite > 0.5 ? '#1c2244' : '#8fb4cf';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + i * (w / 4) + 6, y + h * (0.45 + (i % 2) * 0.12), w / 4 - 10, h);
  if (noite > 0.5) { ctx.fillStyle = '#ffd97a'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 14 + i * (w / 6), y + h * 0.7, 5, 6); }
  ctx.restore();
  ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 6;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  ctx.fillStyle = cortina;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 16); ctx.lineTo(x + 22, y - 16); ctx.quadraticCurveTo(x + 10, y + h * 0.6, x + 18, y + h + 16); ctx.lineTo(x - 22, y + h + 16); ctx.closePath();
  ctx.moveTo(x + w + 22, y - 16); ctx.lineTo(x + w - 22, y - 16); ctx.quadraticCurveTo(x + w - 10, y + h * 0.6, x + w - 18, y + h + 16); ctx.lineTo(x + w + 22, y + h + 16); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9a8a74';
  ctx.fillRect(x - 36, y - 22, w + 72, 7);
}

/** parede interna (do teto ao chão) com papel de parede listrado, meia-parede e rodapé */
function parede(ctx: Ctx, x0: number, x1: number, cor: string, lista: string, faixa = true) {
  ctx.fillStyle = cor;
  ctx.fillRect(x0, TETO, x1 - x0, FLOOR - TETO);
  if (faixa) {
    ctx.fillStyle = lista;
    for (let x = x0; x < x1; x += 44) ctx.fillRect(x, TETO, 16, FLOOR - 150 - TETO);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x0, FLOOR - 150, x1 - x0, 150);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x0, FLOOR - 154, x1 - x0, 6);
  }
  // sanca do teto e corte da laje (vista de "casa de bonecas")
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(x0, TETO, x1 - x0, 22);
  ctx.fillStyle = '#e9e1d2';
  ctx.fillRect(x0, TETO - 18, x1 - x0, 18);
  ctx.fillStyle = '#b8ad98';
  ctx.fillRect(x0, TETO - 22, x1 - x0, 4);
  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(x0, FLOOR - 16, x1 - x0, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x0, FLOOR - 2, x1 - x0, 2);
}

type TipoPiso = 'madeira' | 'ceramica' | 'azulejo' | 'borracha' | 'calcada' | 'grama' | 'pedra';
function piso(ctx: Ctx, x0: number, x1: number, tipo: TipoPiso, c1: string, c2: string, y0 = FLOOR, y1 = FACHADA_Y) {
  if (!isFinite(x0) || !isFinite(x1)) return;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  const altura = y1 - y0;
  if (tipo === 'madeira') {
    for (let i = 0, y = y0 + 8; y < y1; i++, y += 10 + i * 2.6) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      for (let x = x0 + ((i * 97) % 140); x < x1; x += 200 + i * 6) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10 + i * 2.6); ctx.stroke(); }
    }
  } else if (tipo === 'borracha') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < (x1 - x0) / 5; i++) ctx.fillRect(x0 + ((i * 53) % (x1 - x0)), y0 + ((i * 29) % altura), 2, 2);
    for (let x = x0; x < x1; x += 170) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - altura * 0.45, y1); ctx.stroke(); }
  } else if (tipo === 'grama') {
    ctx.strokeStyle = 'rgba(40,90,30,0.25)';
    for (let i = 0; i < (x1 - x0) / 7; i++) { const x = x0 + ((i * 37) % (x1 - x0)), y = y0 + ((i * 53) % altura); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 7); ctx.stroke(); }
  } else {
    const passo = tipo === 'azulejo' ? 50 : tipo === 'calcada' ? 95 : tipo === 'pedra' ? 70 : 115;
    // linhas de fuga (perspectiva): as juntas se abrem na direção da câmera
    for (let x = x0 - passo * 6; x < x1 + passo * 6; x += passo) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - altura * 0.45, y1); ctx.stroke(); }
    for (let i = 0, y = y0 + 12; y < y1; i++, y += 14 + i * 4) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  }
  ctx.restore();
}

/** batente de porta entre dois cômodos (a passagem é livre) */
function batente(ctx: Ctx, x: number, cor = '#efe6d6') {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 34, TETO, 68, FLOOR - TETO);
  ctx.fillStyle = cor;
  ctx.fillRect(x - 30, TETO, 12, FLOOR - TETO);
  ctx.fillRect(x + 18, TETO, 12, FLOOR - TETO);
  ctx.fillRect(x - 30, 200, 60, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x - 18, 214, 36, FLOOR - 214);
  // soleira no chão, em perspectiva
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.moveTo(x - 20, FLOOR); ctx.lineTo(x + 20, FLOOR); ctx.lineTo(x + 20 - (FACHADA_Y - FLOOR) * 0.45, FACHADA_Y); ctx.lineTo(x - 20 - (FACHADA_Y - FLOOR) * 0.45, FACHADA_Y); ctx.fill();
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
  ctx.strokeStyle = '#555'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, TETO); ctx.lineTo(x, TETO + 60); ctx.stroke();
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.moveTo(x - 34, TETO + 90); ctx.lineTo(x + 34, TETO + 90); ctx.lineTo(x + 16, TETO + 58); ctx.lineTo(x - 16, TETO + 58); ctx.closePath(); ctx.fill();
  if (noite > 0.2) {
    const g = ctx.createRadialGradient(x, TETO + 110, 10, x, 400, 460);
    g.addColorStop(0, `rgba(255,220,150,${0.3 * noite})`);
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 480, TETO + 90, 960, FACHADA_Y - TETO - 90);
  }
}

function predios(ctx: Ctx, x0: number, x1: number, hora: number, semente: number, base = FLOOR - 20) {
  const { noite } = luz(hora);
  for (let x = x0 - 40, i = 0; x < x1; i++) {
    const w = 120 + ((i * 37 + semente) % 90), h = 200 + ((i * 71 + semente) % 220);
    ctx.fillStyle = noite > 0.5 ? '#232a52' : ['#9db6cc', '#b7c7d6', '#8aa6bf'][i % 3];
    ctx.fillRect(x, base - h, w, h + 40);
    ctx.fillStyle = noite > 0.5 ? 'rgba(255,217,122,0.8)' : 'rgba(255,255,255,0.35)';
    for (let wy = base - h + 20; wy < base - 30; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 28) if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 12, 16);
    x += w + 16;
  }
}

export const PINTORES: Record<string, Pintor> = {
  paisagem: (ctx, t, hora) => {
    ceu(ctx, t.x0, t.x1, hora, FLOOR + 40);
    predios(ctx, t.x0, t.x1, hora, t.x0 % 97);
    piso(ctx, t.x0, t.x1, 'grama', '#6fae5a', '#5d9a4b', FLOOR, CALCADA_Y0);
  },
  quarto: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#cfe0f0', '#c1d4e8');
    piso(ctx, t.x0, t.x1, 'madeira', '#c8955e', '#a8764a');
    janela(ctx, t.x0 + 520, 200, 170, 190, hora, '#7aa7e8');
    quadro(ctx, t.x0 + 110, 230, 120, 90, '#f4b6c8');
    quadro(ctx, t.x0 + 260, 250, 60, 60, '#f2c14e');
    luminariaTeto(ctx, t.x0 + 420, hora);
  },
  banheiro: (ctx, t, hora) => {
    ctx.fillStyle = '#e8f3f5';
    ctx.fillRect(t.x0, TETO, t.x1 - t.x0, FLOOR - TETO);
    ctx.strokeStyle = 'rgba(80,140,160,0.25)'; ctx.lineWidth = 2;
    for (let y = 290; y < FLOOR; y += 40) { ctx.beginPath(); ctx.moveTo(t.x0, y); ctx.lineTo(t.x1, y); ctx.stroke(); }
    for (let x = t.x0; x < t.x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, 290); ctx.lineTo(x, FLOOR); ctx.stroke(); }
    ctx.fillStyle = '#9fd3dc';
    ctx.fillRect(t.x0, 284, t.x1 - t.x0, 8);
    ctx.fillStyle = '#e9e1d2'; ctx.fillRect(t.x0, TETO - 18, t.x1 - t.x0, 18);
    // espelho sobre a pia e toalheiro
    ctx.fillStyle = 'rgba(190,225,240,0.85)'; ctx.fillRect(t.x0 + 50, 250, 110, 130);
    ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 6; ctx.strokeRect(t.x0 + 50, 250, 110, 130);
    ctx.fillStyle = '#9aa7b0'; ctx.fillRect(t.x0 + 190, 330, 90, 6);
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(t.x0 + 205, 336, 60, 110);
    ctx.fillStyle = '#7fb3d5'; ctx.fillRect(t.x0 + 205, 420, 60, 10);
    // parede de azulejo do box
    ctx.fillStyle = '#d6ecf1'; ctx.fillRect(t.x0 + 350, TETO, 250, FLOOR - TETO);
    ctx.strokeStyle = 'rgba(80,140,160,0.3)'; ctx.lineWidth = 1.5;
    for (let y = TETO + 20; y < FLOOR; y += 30) { ctx.beginPath(); ctx.moveTo(t.x0 + 350, y); ctx.lineTo(t.x0 + 600, y); ctx.stroke(); }
    piso(ctx, t.x0, t.x1, 'azulejo', '#dbe7ea', '#b9ccd1');
    luminariaTeto(ctx, t.x0 + 260, hora);
    batente(ctx, t.x0);
  },
  cozinha: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#fbe9c9', '#f4dcb0', false);
    ctx.fillStyle = '#fff6e6'; ctx.fillRect(t.x0 + 200, 330, 560, 150);
    ctx.strokeStyle = 'rgba(200,160,110,0.35)'; ctx.lineWidth = 1.5;
    for (let x = t.x0 + 200; x < t.x0 + 760; x += 30) { ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x, 480); ctx.stroke(); }
    for (let y = 330; y <= 480; y += 30) { ctx.beginPath(); ctx.moveTo(t.x0 + 200, y); ctx.lineTo(t.x0 + 760, y); ctx.stroke(); }
    // armários altos com portas
    for (let x = t.x0 + 230; x < t.x0 + 740; x += 128) {
      ctx.fillStyle = '#e07a5f'; ctx.fillRect(x, 170, 120, 130);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(x, 170, 120, 130);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 52, 270, 16, 5);
    }
    // relógio e prateleira de temperos
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x0 + 110, 220, 28, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a3d4f'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(t.x0 + 110, 220); ctx.lineTo(t.x0 + 110, 200); ctx.moveTo(t.x0 + 110, 220); ctx.lineTo(t.x0 + 124, 226); ctx.stroke();
    piso(ctx, t.x0, t.x1, 'ceramica', '#e9dcc4', '#cbb895');
    janela(ctx, t.x0 + 640, 190, 120, 110, hora, '#f2c14e');
    luminariaTeto(ctx, t.x0 + 640, hora);
    batente(ctx, t.x0);
  },
  sala: (ctx, t, hora) => {
    parede(ctx, t.x0, t.x1, '#f3d9c4', '#ecc9ae');
    piso(ctx, t.x0, t.x1, 'madeira', '#b98355', '#94653d');
    janela(ctx, t.x0 + 520, 190, 220, 210, hora, '#e87a90');
    quadro(ctx, t.x0 + 240, 230, 150, 100, '#7fb3d5');
    quadro(ctx, t.x0 + 800, 240, 80, 80, '#f2c14e');
    luminariaTeto(ctx, t.x0 + 360, hora);
    luminariaTeto(ctx, t.x0 + 780, hora);
    batente(ctx, t.x0);
  },
  praca: (ctx, t, hora) => {
    ceu(ctx, t.x0, t.x1, hora, FLOOR + 40);
    predios(ctx, t.x0, t.x1, hora, 11, FLOOR - 60);
    // cerca-viva ao fundo
    for (let x = t.x0; x < t.x1; x += 70) { ctx.fillStyle = (x / 70) % 2 ? '#4c8f3f' : '#58b368'; ctx.beginPath(); ctx.arc(x, FLOOR + 6, 46, Math.PI, 0); ctx.fill(); }
    piso(ctx, t.x0, t.x1, 'grama', '#6fae5a', '#5d9a4b', FLOOR, CALCADA_Y0);
    // caminhos de pedra portuguesa
    ctx.save();
    ctx.beginPath(); ctx.rect(t.x0, FLOOR + 30, t.x1 - t.x0, CALCADA_Y0 - FLOOR - 30); ctx.clip();
    piso(ctx, t.x0 + 200, t.x1 - 200, 'pedra', '#e5dfd2', '#cfc6b3', 660, CALCADA_Y0);
    ctx.restore();
  },
  academiaCardio: (ctx, t, hora) => academia(ctx, t, hora, true),
  academiaPesos: (ctx, t, hora) => academia(ctx, t, hora, false),
};

/** Pinta um trecho: nos interiores, primeiro o céu por cima do corte da laje (visto quando a fachada some). */
export function pintarTrecho(ctx: Ctx, tr: Trecho, hora: number, t: number) {
  if (tr.interno) {
    ceu(ctx, tr.x0, tr.x1, hora, TETO - 18);
    predios(ctx, tr.x0, tr.x1, hora, tr.x0 % 89, TETO - 18);
  }
  PINTORES[tr.pintor]?.(ctx, tr, hora, t);
}

function academia(ctx: Ctx, t: Trecho, hora: number, cardio: boolean) {
  ctx.fillStyle = '#2f3240';
  ctx.fillRect(t.x0, TETO, t.x1 - t.x0, FLOOR - TETO);
  ctx.fillStyle = '#1c1d26'; ctx.fillRect(t.x0, TETO - 18, t.x1 - t.x0, 18);
  ctx.fillStyle = '#e63956';
  ctx.fillRect(t.x0, 360, t.x1 - t.x0, 16);
  // espelhos no fundo
  const g = ctx.createLinearGradient(0, 380, 0, FLOOR);
  g.addColorStop(0, 'rgba(190,215,235,0.35)');
  g.addColorStop(1, 'rgba(120,150,175,0.25)');
  for (let x = t.x0 + 60; x < t.x1 - 100; x += 300) {
    ctx.fillStyle = g; ctx.fillRect(x, 390, 260, 160);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(x + 30, 390); ctx.lineTo(x + 70, 390); ctx.lineTo(x + 20, 550); ctx.lineTo(x, 550); ctx.fill();
  }
  ctx.font = '900 34px sans-serif'; ctx.fillStyle = '#f2c14e';
  ctx.fillText(cardio ? 'SEM DOR, SEM GANHO' : 'HOJE É DIA DE PERNA (MENTIRA)', t.x0 + 180, 190);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '700 18px sans-serif';
  ctx.fillText(cardio ? 'Horário: 6h às 23h · Traga toalha · Borrife o aparelho' : 'Devolva os halteres. Por favor. Estamos implorando.', t.x0 + 180, 230);
  // ventiladores de parede
  for (let x = t.x0 + 400; x < t.x1; x += 700) { ctx.fillStyle = '#9aa0b0'; ctx.beginPath(); ctx.arc(x, 290, 34, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2f3240'; ctx.beginPath(); ctx.arc(x, 290, 8, 0, Math.PI * 2); ctx.fill(); }
  piso(ctx, t.x0, t.x1, 'borracha', '#2a2a30', '#15151a');
  for (let x = t.x0 + 150; x < t.x1; x += 380) { ctx.fillStyle = '#f7f7ff'; ctx.fillRect(x, TETO + 8, 220, 10); }
  batente(ctx, t.x0, '#9aa0b0');
  void hora;
}

// ------------------------------------------------------------------ jardins, calçada e rua (contínuos, sobre os trechos)
export function pintarRua(ctx: Ctx, x0: number, x1: number, hora: number) {
  if (!isFinite(x0) || !isFinite(x1) || x1 - x0 > 20000) return; // proteção: laços por x precisam de limites finitos
  // jardim na frente dos prédios
  for (const [a, b] of [[300, 3600], [5900, 8900]] as const) {
    if (b < x0 || a > x1) continue;
    piso(ctx, a, b, 'grama', '#6fae5a', '#5d9a4b', FACHADA_Y, CALCADA_Y0);
  }
  // caminhos até as portas
  for (const px of [PONTOS.portaCasa, PONTOS.portaAcademia]) {
    ctx.fillStyle = '#d9cfbd';
    ctx.beginPath(); ctx.moveTo(px - 46, FACHADA_Y); ctx.lineTo(px + 46, FACHADA_Y); ctx.lineTo(px + 46 - 24, CALCADA_Y0); ctx.lineTo(px - 46 - 24, CALCADA_Y0); ctx.fill();
  }
  // calçada
  piso(ctx, x0, x1, 'calcada', '#d9d4c8', '#c4bdae', CALCADA_Y0, CALCADA_Y1);
  // meio-fio e rua
  ctx.fillStyle = '#9a958a'; ctx.fillRect(x0, CALCADA_Y1, x1 - x0, 6);
  const g = ctx.createLinearGradient(0, RUA_Y0, 0, MUNDO_ALTURA);
  g.addColorStop(0, '#4a4a52'); g.addColorStop(1, '#3a3a42');
  ctx.fillStyle = g; ctx.fillRect(x0, RUA_Y0, x1 - x0, MUNDO_ALTURA + 400 - RUA_Y0);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let x = Math.floor(x0 / 160) * 160; x < x1; x += 160) ctx.fillRect(x, 948, 80, 6);
  // faixa de pedestres em frente à praça
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 6; i++) ctx.fillRect(5000 + i * 34, RUA_Y0 + 8, 20, MUNDO_ALTURA - RUA_Y0 - 16);
  void hora;
}

// ------------------------------------------------------------------ fachadas (ficam na linha FACHADA_Y; a da casa e a da academia somem quando você entra)
export interface Fachada { id: string; x0: number; x1: number; predio?: 'casa' | 'academia'; desenho: (ctx: Ctx, largura: number, hora: number, t: number, o: Record<string, unknown>) => void }

function janelaFachada(ctx: Ctx, x: number, y: number, w: number, h: number, hora: number, cortina: string) {
  const { noite } = luz(hora);
  ctx.fillStyle = '#f4efe6'; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  if (noite > 0.4) { g.addColorStop(0, '#ffd98a'); g.addColorStop(1, '#f2a33a'); }
  else { g.addColorStop(0, '#bfe3f7'); g.addColorStop(1, '#7fb3d5'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.moveTo(x + 10, y); ctx.lineTo(x + 40, y); ctx.lineTo(x + 10, y + h * 0.6); ctx.fill();
  ctx.fillStyle = cortina;
  ctx.fillRect(x, y, 18, h); ctx.fillRect(x + w - 18, y, 18, h);
  ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 5; ctx.strokeRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  // floreira
  caixa(ctx, x - 12, y + h + 30, w + 24, 22, 20, { frente: '#8a5a3a' });
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#e8335a', '#f2c14e', '#fff'][i % 3]; ctx.beginPath(); ctx.arc(x + 6 + i * (w / 4.5), y + h + 4, 7, 0, Math.PI * 2); ctx.fill(); }
}

export const FACHADAS: Fachada[] = [
  {
    id: 'vizinho', x0: 20, x1: 290,
    desenho: (ctx, L, hora) => {
      ctx.fillStyle = '#9fd3c7'; ctx.fillRect(0, -560, L, 560);
      ctx.fillStyle = '#5a8c86';
      ctx.beginPath(); ctx.moveTo(-20, -560); ctx.lineTo(L / 2, -680); ctx.lineTo(L + 20, -560); ctx.fill();
      janelaFachada(ctx, 60, -430, 140, 120, hora, '#f2c14e');
      ctx.fillStyle = '#6b3f26'; ctx.fillRect(90, -230, 90, 230);
    },
  },
  {
    id: 'casa', x0: 300, x1: 3600, predio: 'casa',
    desenho: (ctx, L, hora, _t, o) => {
      const H = FACHADA_Y - TETO + 18;
      // telhado
      ctx.fillStyle = '#c0533a';
      ctx.beginPath(); ctx.moveTo(-50, -H); ctx.lineTo(L + 50, -H); ctx.lineTo(L - 60, -H - 140); ctx.lineTo(60, -H - 140); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
      for (let y = -H - 130; y < -H; y += 22) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(L - 40, y); ctx.stroke(); }
      ctx.fillStyle = '#9a3f2c'; ctx.fillRect(-50, -H - 6, L + 100, 14);
      // parede
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(0, -H, L, H);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      for (let x = 0; x < L; x += 60) ctx.fillRect(x, -H, 2, H);
      // barrado de pedra
      ctx.fillStyle = '#c9b89a'; ctx.fillRect(0, -80, L, 80);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      for (let x = 0; x < L; x += 48) for (let y = -80; y < 0; y += 20) ctx.strokeRect(x + ((y / 20) % 2) * 24, y, 48, 20);
      // janelas dos cômodos (a luz acende à noite)
      janelaFachada(ctx, 330, -460, 170, 170, hora, '#7aa7e8');
      janelaFachada(ctx, 1030, -470, 90, 80, hora, '#9fd3dc');
      janelaFachada(ctx, 1640, -460, 160, 160, hora, '#f2c14e');
      janelaFachada(ctx, 2480, -470, 240, 180, hora, '#e87a90');
      // porta da frente (abre quando alguém chega perto)
      const dx = PONTOS.portaCasa - 300;
      ctx.fillStyle = '#efe6d6'; ctx.fillRect(dx - 80, -400, 160, 400);
      ctx.fillStyle = 'rgba(30,20,10,0.75)'; ctx.fillRect(dx - 66, -386, 132, 386);
      if (o.aberta) { ctx.fillStyle = '#6b3f26'; ctx.beginPath(); ctx.moveTo(dx - 66, -386); ctx.lineTo(dx - 30, -370); ctx.lineTo(dx - 30, 10); ctx.lineTo(dx - 66, 0); ctx.fill(); }
      else { ctx.fillStyle = '#6b3f26'; ctx.fillRect(dx - 66, -386, 132, 386); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(dx + 44, -190, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(dx - 50, -360, 100, 150); ctx.strokeRect(dx - 50, -190, 100, 160); }
      // luminária da entrada e número
      const { noite } = luz(hora);
      ctx.fillStyle = noite > 0.4 ? '#ffe9a8' : '#e9e1d2';
      ctx.beginPath(); ctx.arc(dx + 120, -330, 14, 0, Math.PI * 2); ctx.fill();
      if (noite > 0.4) { const g = ctx.createRadialGradient(dx + 120, -330, 5, dx + 120, -250, 220); g.addColorStop(0, 'rgba(255,220,140,0.45)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(dx - 120, -560, 480, 560); }
      ctx.fillStyle = '#2b5d8a'; ctx.fillRect(dx + 100, -260, 56, 30);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('42', dx + 116, -238);
      // capacho e ar-condicionado
      ctx.fillStyle = '#8a5a3a'; ctx.fillRect(dx - 60, -8, 120, 8);
      caixa(ctx, 1300, -560, 110, 70, 40, { frente: '#e9eef0' });
      ctx.fillStyle = '#58606a'; ctx.fillRect(L - 24, -H, 10, H);
    },
  },
  {
    id: 'academia', x0: 5900, x1: 8900, predio: 'academia',
    desenho: (ctx, L, hora, t) => {
      const H = FACHADA_Y - TETO + 18;
      ctx.fillStyle = '#2b2d3a'; ctx.fillRect(0, -H - 60, L, H + 60);
      ctx.fillStyle = '#3a3d4f';
      for (let y = -H - 40; y < -100; y += 60) ctx.fillRect(0, y, L, 4);
      // vitrines com a academia lá dentro (silhuetas)
      for (let x = 320; x < L - 200; x += 520) {
        ctx.fillStyle = 'rgba(120,180,210,0.45)'; ctx.fillRect(x, -470, 440, 380);
        ctx.fillStyle = 'rgba(20,20,30,0.35)';
        ctx.beginPath(); ctx.arc(x + 140, -280, 26, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 120, -254, 40, 120);
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.moveTo(x + 40, -470); ctx.lineTo(x + 110, -470); ctx.lineTo(x + 20, -90); ctx.lineTo(x, -90); ctx.fill();
        ctx.strokeStyle = '#9aa'; ctx.lineWidth = 4; ctx.strokeRect(x, -470, 440, 380);
      }
      // letreiro neon
      const pisca = (Math.sin(t * 3.3) + 1) / 2;
      ctx.fillStyle = '#12131a'; ctx.fillRect(700, -H - 20, 520, 110);
      ctx.font = '900 70px sans-serif';
      ctx.fillStyle = `rgba(255,70,110,${0.75 + pisca * 0.25})`;
      ctx.shadowColor = '#ff466e'; ctx.shadowBlur = 20;
      ctx.fillText('VIVA FIT', 770, -H + 66);
      ctx.shadowBlur = 0;
      // porta de vidro e toldo
      const dx = PONTOS.portaAcademia - 5900;
      ctx.fillStyle = 'rgba(160,210,235,0.7)'; ctx.fillRect(dx - 70, -380, 140, 380);
      ctx.strokeStyle = '#c9d2d4'; ctx.lineWidth = 5; ctx.strokeRect(dx - 70, -380, 140, 380);
      ctx.beginPath(); ctx.moveTo(dx, -380); ctx.lineTo(dx, 0); ctx.stroke();
      ctx.fillStyle = '#e63956';
      ctx.beginPath(); ctx.moveTo(dx - 130, -420); ctx.lineTo(dx + 130, -420); ctx.lineTo(dx + 160, -370); ctx.lineTo(dx - 160, -370); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('ENTRADA', dx - 42, -388);
      void hora;
    },
  },
  {
    id: 'padaria', x0: 9000, x1: 9950,
    desenho: (ctx, L, hora) => loja(ctx, L, hora, '#f4e1c1', '#c0533a', 'PADARIA PÃO NOSSO', '🥖', '#8a5a3a'),
  },
  {
    id: 'farmacia', x0: 10050, x1: 11100,
    desenho: (ctx, L, hora) => loja(ctx, L, hora, '#e8f3f5', '#2f8f6f', 'DROGARIA SAÚDE+', '💊', '#2f8f6f'),
  },
];

function loja(ctx: Ctx, L: number, hora: number, parede: string, toldo: string, nome: string, icone: string, cor: string) {
  const H = 560;
  ctx.fillStyle = parede; ctx.fillRect(0, -H, L, H);
  ctx.fillStyle = cor; ctx.fillRect(0, -H, L, 90);
  ctx.fillStyle = '#fff'; ctx.font = '900 40px sans-serif'; ctx.fillText(nome, 40, -H + 60);
  // toldo listrado
  for (let x = 0; x < L; x += 60) { ctx.fillStyle = (x / 60) % 2 ? toldo : '#fff'; ctx.beginPath(); ctx.moveTo(x, -H + 110); ctx.lineTo(x + 60, -H + 110); ctx.lineTo(x + 70, -H + 170); ctx.lineTo(x + 10, -H + 170); ctx.fill(); }
  // vitrine com prateleiras e porta com aviso
  ctx.fillStyle = 'rgba(180,215,230,0.6)'; ctx.fillRect(40, -360, L - 300, 300);
  for (let y = -330; y < -80; y += 70) { ctx.fillStyle = '#8a5a3a'; ctx.fillRect(50, y + 50, L - 320, 6); ctx.font = '26px sans-serif'; for (let x = 70; x < L - 280; x += 60) ctx.fillText(icone, x, y + 46); }
  ctx.fillStyle = '#6b3f26'; ctx.fillRect(L - 210, -360, 150, 360);
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(L - 190, -250, 110, 50);
  ctx.fillStyle = '#2b2d3a'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('EM BREVE', L - 178, -219);
  void hora;
}

/** Muro baixo da casa (na frente do jardim), com o portão aberto no caminho da porta. */
export function muroCasa(ctx: Ctx) {
  const a = 300, b = 3600, gate = PONTOS.portaCasa;
  for (const [x0, x1] of [[a, gate - 60], [gate + 60, b]] as const) {
    ctx.fillStyle = '#e9e1d2';
    ctx.fillRect(x0, -64, x1 - x0, 64);
    ctx.fillStyle = '#d4c9b5';
    for (let x = x0; x < x1; x += 56) ctx.fillRect(x, -70, 52, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x0, -12, x1 - x0, 12);
  }
  // pilares do portão
  for (const x of [gate - 70, gate + 50]) caixa(ctx, x, 0, 20, 90, 16, { frente: '#d4c9b5' });
  void OX; void OY; void M;
}
