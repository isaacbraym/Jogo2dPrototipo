/**
 * Modo Explorar — MÓVEIS 2,5D em escala real (1 m = 170 px na escala 1; o controlador ainda aplica a escala da
 * profundidade). Projeção oblíqua leve: frente + topo visível + lateral direita, para dar noção de profundidade
 * sem virar isométrico. Origem de cada desenho = centro da borda de baixo da FRENTE (onde o móvel toca o chão).
 *
 * Móveis com gente dentro são divididos em partes (ver ObjetoMundo.partes): a parte de trás é desenhada antes da
 * pessoa e a da frente depois (cadeira atrás/mesa na frente, cobertor por cima de quem dorme, corrimão da esteira...).
 */
import type { Ctx } from '../render/draw';
import { shade } from '../core/color';

export const M = 170; // px por metro
export const OX = 0.24, OY = -0.52; // deslocamento da profundidade (por px de fundo)

type Face = { frente: string; topo?: string; lado?: string; linha?: string };

/** Caixa oblíqua: frente (x..x+w, yb-h..yb) + topo + lado direito com profundidade d. */
export function caixa(ctx: Ctx, x: number, yb: number, w: number, h: number, d: number, f: Face) {
  const dx = d * OX, dy = d * OY;
  const topo = f.topo ?? shade(f.frente, 0.14), lado = f.lado ?? shade(f.frente, -0.2), linha = f.linha ?? shade(f.frente, -0.5);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = linha;
  ctx.lineJoin = 'round';
  // lado
  ctx.fillStyle = lado;
  ctx.beginPath(); ctx.moveTo(x + w, yb); ctx.lineTo(x + w, yb - h); ctx.lineTo(x + w + dx, yb - h + dy); ctx.lineTo(x + w + dx, yb + dy); ctx.closePath(); ctx.fill(); ctx.stroke();
  // topo
  ctx.fillStyle = topo;
  ctx.beginPath(); ctx.moveTo(x, yb - h); ctx.lineTo(x + w, yb - h); ctx.lineTo(x + w + dx, yb - h + dy); ctx.lineTo(x + dx, yb - h + dy); ctx.closePath(); ctx.fill(); ctx.stroke();
  // frente
  ctx.fillStyle = f.frente;
  ctx.fillRect(x, yb - h, w, h);
  ctx.strokeRect(x, yb - h, w, h);
}

/** Sombra de contato no chão (elipse suave). */
export function sombra(ctx: Ctx, x: number, w: number, d: number, a = 0.18) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(x + (d * OX) / 2, (d * OY) / 2 + 2, w / 2 + 14, Math.abs(d * OY) / 2 + 8, 0, 0, Math.PI * 2); ctx.fill();
}

function perna(ctx: Ctx, x: number, yb: number, h: number, cor: string, w = 7) {
  ctx.fillStyle = cor;
  ctx.fillRect(x - w / 2, yb - h, w, h);
}

const flip = (ctx: Ctx, o: Record<string, unknown>) => { if (o.flip) ctx.scale(-1, 1); };

// ------------------------------------------------------------------ quarto
/** Cama de casal: cabeceira à esquerda, colchão, travesseiros. (a parte da frente é o cobertor) */
function cama(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);
  const L = 2.6 * M, D = 1.1 * M, cor = (o.color as string) ?? '#3d7bd9';
  sombra(ctx, 0, L, D);
  // estrado
  caixa(ctx, -L / 2, 0, L, 0.3 * M, D, { frente: '#8a5a3a' });
  // colchão
  caixa(ctx, -L / 2 + 6, -0.3 * M, L - 12, 0.22 * M, D - 10, { frente: '#f4f1ea', topo: '#fbfaf6' });
  // cabeceira (painel na ponta esquerda, sobe atrás)
  const hx = -L / 2 - 14;
  ctx.fillStyle = '#6b4a2a';
  ctx.strokeStyle = '#3a2614';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx, -1.05 * M); ctx.lineTo(hx + D * OX + 18, -1.05 * M + D * OY); ctx.lineTo(hx + D * OX + 18, D * OY); ctx.closePath(); ctx.fill(); ctx.stroke();
  // travesseiros
  for (let i = 0; i < 2; i++) {
    const px = -L / 2 + 30 + D * OX * (0.25 + i * 0.45), py = -0.52 * M + D * OY * (0.25 + i * 0.45);
    ctx.fillStyle = '#fbfaf6';
    ctx.beginPath(); ctx.ellipse(px + 36, py, 40, 16, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.stroke();
  }
  void cor;
}

/** Cobertor (desenhado DEPOIS de quem dorme): cobre do quadril aos pés. */
function camaCobertor(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);
  const L = 2.6 * M, D = 1.1 * M, cor = (o.color as string) ?? '#3d7bd9';
  // edredom fofo: o topo fica ~16 cm acima do colchão (volume do corpo por baixo)
  const x0 = -L / 2 + 0.7 * M, x1 = L / 2 + 2, yT = -0.52 * M - 0.16 * M, dx = D * OX, dy = D * OY;
  ctx.fillStyle = cor;
  ctx.strokeStyle = shade(cor, -0.45);
  ctx.lineWidth = 1.6;
  // topo (ondulado)
  ctx.beginPath();
  ctx.moveTo(x0, yT);
  for (let i = 1; i <= 6; i++) ctx.quadraticCurveTo(x0 + ((i - 0.5) * (x1 - x0)) / 6, yT - 6, x0 + (i * (x1 - x0)) / 6, yT);
  ctx.lineTo(x1 + dx, yT + dy); ctx.lineTo(x0 + dx - 6, yT + dy);
  ctx.quadraticCurveTo(x0 - 22, yT + dy * 0.5, x0, yT);
  ctx.fill(); ctx.stroke();
  // caimento na frente, até quase o estrado
  ctx.fillStyle = shade(cor, -0.08);
  ctx.beginPath(); ctx.moveTo(x0, yT); ctx.lineTo(x1, yT); ctx.lineTo(x1, -0.24 * M);
  for (let i = 5; i >= 0; i--) ctx.quadraticCurveTo(x0 + ((i + 0.5) * (x1 - x0)) / 6, -0.24 * M + 10, x0 + (i * (x1 - x0)) / 6, -0.24 * M);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // lateral dos pés
  ctx.fillStyle = shade(cor, -0.22);
  ctx.beginPath(); ctx.moveTo(x1, yT); ctx.lineTo(x1 + dx, yT + dy); ctx.lineTo(x1 + dx, -0.24 * M + dy); ctx.lineTo(x1, -0.24 * M); ctx.closePath(); ctx.fill(); ctx.stroke();
  // lençol dobrado por cima (faixa branca na borda da cabeceira)
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath(); ctx.moveTo(x0 - 4, yT - 2); ctx.lineTo(x0 + 26, yT - 2); ctx.lineTo(x0 + 26 + dx, yT + dy - 2); ctx.lineTo(x0 - 4 + dx, yT + dy - 2); ctx.closePath(); ctx.fill();
  ctx.fillRect(x0 - 4, yT - 2, 30, 0.2 * M);
  // estampa
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = x0 + 50; x < x1 - 10; x += 46) { ctx.beginPath(); ctx.arc(x, yT + 0.12 * M, 7, 0, Math.PI * 2); ctx.fill(); }
}

/** Escrivaninha com computador (a pessoa senta numa cadeira à esquerda). */
function escrivaninha(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);
  const W = 1.2 * M, H = 0.76 * M, D = 0.6 * M, cor = (o.color as string) ?? '#e8e6e0';
  sombra(ctx, 0, W, D);
  // tampo e pés (vazado por baixo, para as pernas de quem senta)
  caixa(ctx, -W / 2, -H + 0.05 * M, W, 0.05 * M, D, { frente: cor });
  perna(ctx, -W / 2 + 6, 0, H - 0.05 * M, shade(cor, -0.3));
  // gaveteiro à direita
  caixa(ctx, W / 2 - 0.42 * M, 0, 0.42 * M, H - 0.05 * M, D - 4, { frente: shade(cor, -0.05) });
  ctx.fillStyle = shade(cor, -0.4);
  for (let i = 0; i < 3; i++) ctx.fillRect(W / 2 - 0.25 * M, -H + 0.05 * M + 22 + i * 38, 22, 4);
  // monitor (no fundo do tampo)
  const mx = -0.05 * M + D * OX * 0.7, my = -H + D * OY * 0.7;
  ctx.fillStyle = '#23242b';
  ctx.fillRect(mx - 6, my - 20, 12, 22);
  ctx.fillRect(mx - 0.33 * M, my - 0.36 * M - 18, 0.66 * M, 0.36 * M);
  ctx.fillStyle = '#5ec3e8';
  ctx.fillRect(mx - 0.3 * M, my - 0.33 * M - 18, 0.6 * M, 0.3 * M);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 4; i++) ctx.fillRect(mx - 0.26 * M, my - 0.3 * M - 10 + i * 10, 40 + (i % 2) * 30, 3);
  // teclado e caneca
  ctx.fillStyle = '#d7dbe2';
  ctx.beginPath(); ctx.moveTo(mx - 0.28 * M, -H + D * OY * 0.25); ctx.lineTo(mx + 0.1 * M, -H + D * OY * 0.25); ctx.lineTo(mx + 0.13 * M, -H + D * OY * 0.45); ctx.lineTo(mx - 0.25 * M, -H + D * OY * 0.45); ctx.fill();
  ctx.fillStyle = '#e8845a';
  ctx.fillRect(W / 2 - 0.28 * M, -H - 22, 16, 20);
}

/** Cadeira (vista de lado, encosto à esquerda). Assento na altura de 0,47 m. */
function cadeira(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);
  const cor = (o.color as string) ?? '#7a5236';
  const S = 0.47 * M, W = 0.46 * M, D = 0.44 * M;
  sombra(ctx, 0, W, D, 0.14);
  perna(ctx, -W / 2 + 5, 0, S, shade(cor, -0.35));
  perna(ctx, W / 2 - 5, 0, S, shade(cor, -0.35));
  caixa(ctx, -W / 2, -S, W, 0.06 * M, D, { frente: cor });
  // encosto
  caixa(ctx, -W / 2 - 4, -S, 0.06 * M, 0.5 * M, D, { frente: shade(cor, -0.08) });
}

function cadeiraEscritorio(ctx: Ctx) {
  const S = 0.48 * M;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 0, 44, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2b2d3a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-34, -2); ctx.lineTo(34, -2); ctx.moveTo(0, -2); ctx.lineTo(0, -S + 8); ctx.stroke();
  caixa(ctx, -0.25 * M, -S, 0.5 * M, 0.08 * M, 0.44 * M, { frente: '#3b4a6b' });
  caixa(ctx, -0.29 * M, -S - 4, 0.08 * M, 0.55 * M, 0.44 * M, { frente: '#2f3b57' });
}

function estante(ctx: Ctx) {
  const W = 1.0 * M, H = 1.9 * M, D = 0.34 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H, D, { frente: '#8a5a3a' });
  const cores = ['#e8335a', '#3d7bd9', '#f2c14e', '#58b368', '#7c5cff', '#e8845a', '#2f8f6f'];
  for (let r = 0; r < 4; r++) {
    const y = -H + 18 + r * (H / 4.2);
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(-W / 2 + 8, y + H / 4.2 - 18, W - 16, 6);
    let x = -W / 2 + 12;
    for (let b = 0; x < W / 2 - 16; b++) {
      const bw = 10 + ((b * 7 + r * 3) % 9), bh = H / 4.2 - 30 - ((b * 5) % 12);
      ctx.fillStyle = cores[(b + r * 2) % cores.length];
      ctx.fillRect(x, y + H / 4.2 - 18 - bh, bw, bh);
      x += bw + 2;
    }
  }
}

function tapete(ctx: Ctx, o: Record<string, unknown>) {
  const W = ((o.w as number) ?? 2.2) * M, D = ((o.d as number) ?? 1.3) * M, cor = (o.color as string) ?? '#5b3c88';
  ctx.fillStyle = cor;
  ctx.globalAlpha *= 0.85;
  ctx.beginPath(); ctx.moveTo(-W / 2, 0); ctx.lineTo(W / 2, 0); ctx.lineTo(W / 2 + D * OX, D * OY); ctx.lineTo(-W / 2 + D * OX, D * OY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-W / 2 + 14, -6); ctx.lineTo(W / 2 - 14, -6); ctx.lineTo(W / 2 + D * OX - 14, D * OY + 6); ctx.lineTo(-W / 2 + D * OX + 14, D * OY + 6); ctx.closePath(); ctx.stroke();
}

function luminariaPe(ctx: Ctx, _o: Record<string, unknown>, t: number, noite = 0) {
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3d4f';
  ctx.fillRect(-2.5, -1.55 * M, 5, 1.55 * M);
  ctx.fillRect(-18, -5, 36, 5);
  ctx.fillStyle = '#f2e6c8';
  ctx.beginPath(); ctx.moveTo(-34, -1.5 * M); ctx.lineTo(34, -1.5 * M); ctx.lineTo(22, -1.85 * M); ctx.lineTo(-22, -1.85 * M); ctx.closePath(); ctx.fill();
  void t; void noite;
}

function planta(ctx: Ctx, o: Record<string, unknown>) {
  const s = (o.s as number) ?? 1;
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(0, 0, 30 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  caixa(ctx, -22 * s, 0, 44 * s, 46 * s, 30 * s, { frente: (o.color as string) ?? '#c0533a' });
  const folhas = ['#3f8f45', '#58b368', '#2f7a3a'];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.32;
    ctx.fillStyle = folhas[i % 3];
    ctx.save();
    ctx.translate(4 * s, -46 * s);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ctx.ellipse(0, -48 * s, 12 * s, 46 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ banheiro
function pia(ctx: Ctx) {
  const W = 0.7 * M, H = 0.85 * M, D = 0.5 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H - 0.05 * M, D, { frente: '#e9eef0' });
  caixa(ctx, -W / 2 - 8, -H + 0.05 * M, W + 16, 0.06 * M, D + 6, { frente: '#f7fafb' });
  ctx.fillStyle = '#bfe3ee';
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, -H + D * OY * 0.5, W * 0.32, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa7b0';
  ctx.fillRect(D * OX * 0.8 - 4, -H + D * OY * 0.85 - 26, 8, 26);
  ctx.fillRect(D * OX * 0.8 - 4, -H + D * OY * 0.85 - 26, 22, 6);
  ctx.fillStyle = '#c9d2d4';
  ctx.fillRect(-W / 2 + 14, -H + 40, W - 28, 5);
}

/** Vaso sanitário 2,5D (assento a 0,42 m). opts: tampa (0/1), agua (0..1). */
function vaso(ctx: Ctx, o: Record<string, unknown>) {
  const tampa = (o.tampa as number) ?? 0, agua = (o.agua as number) ?? 0;
  sombra(ctx, 0, 0.42 * M, 0.6 * M, 0.14);
  // caixa acoplada (fundo, encostada na parede)
  caixa(ctx, -0.42 * M, -0.42 * M, 0.2 * M, 0.38 * M, 0.44 * M, { frente: '#f4f7f8' });
  // pé
  caixa(ctx, -0.18 * M, 0, 0.26 * M, 0.34 * M, 0.3 * M, { frente: '#e9eff1' });
  // bacia (elipse oblíqua no alto)
  const cy = -0.42 * M, cx = -0.02 * M;
  ctx.fillStyle = '#f7fafb';
  ctx.strokeStyle = '#b9c8cc';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(cx + 16, cy - 10, 0.25 * M, 0.13 * M, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = agua > 0 ? '#8fd0e6' : '#bfe3ee';
  ctx.beginPath(); ctx.ellipse(cx + 18, cy - 11, 0.16 * M, 0.08 * M, -0.2, 0, Math.PI * 2); ctx.fill();
  if (agua > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(cx + 18, cy - 11, 0.1 * M * agua, 0.05 * M * agua, agua * 9, 0, Math.PI * 1.4); ctx.stroke();
  }
  // tampa: aberta = em pé encostada na caixa; fechada = sobre a bacia
  ctx.fillStyle = '#eef3f5';
  ctx.strokeStyle = '#b9c8cc';
  if (tampa) { ctx.beginPath(); ctx.ellipse(-0.24 * M, cy - 0.28 * M, 0.08 * M, 0.26 * M, 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  else { ctx.beginPath(); ctx.ellipse(cx + 16, cy - 14, 0.25 * M, 0.12 * M, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // rolo de papel na parede
  ctx.fillStyle = '#9aa7b0';
  ctx.fillRect(-0.62 * M, -0.8 * M, 26, 5);
  ctx.fillStyle = '#fbfaf6';
  ctx.beginPath(); ctx.arc(-0.62 * M + 13, -0.8 * M + 12, 11, 0, Math.PI * 2); ctx.fill();
}

/** Base do box (o vidro e a água são desenhados pelo controlador). */
function box(ctx: Ctx) {
  const W = 1.1 * M, D = 0.9 * M;
  caixa(ctx, -W / 2, 0, W, 0.08 * M, D, { frente: '#dfe9ec', topo: '#eef5f7' });
  ctx.fillStyle = '#9fb1b6';
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, -0.08 * M + D * OY * 0.5, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  // cano e chuveiro
  const cx = -W / 2 + D * OX + 30, top = -2.4 * M + D * OY;
  ctx.fillStyle = '#b9c8cc';
  ctx.fillRect(cx - 4, top, 8, 60);
  ctx.fillRect(cx - 4, top + 54, 50, 8);
  ctx.fillStyle = '#c9d2d4';
  ctx.beginPath(); ctx.ellipse(cx + 50, top + 64, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
  // vidro lateral (direita), em profundidade
  const H = 2.3 * M, dx = D * OX, dy = D * OY;
  ctx.fillStyle = 'rgba(210,235,245,0.22)';
  ctx.strokeStyle = '#b9c8cc'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W / 2, -0.08 * M); ctx.lineTo(W / 2 + dx, -0.08 * M + dy); ctx.lineTo(W / 2 + dx, -H + dy); ctx.lineTo(W / 2, -H); ctx.closePath(); ctx.fill(); ctx.stroke();
}
/** Porta de vidro do box (na frente de quem toma banho). A faixa jateada do banho é desenhada pelo controlador. */
function boxFrente(ctx: Ctx) {
  const W = 1.1 * M, H = 2.3 * M;
  ctx.fillStyle = 'rgba(210,235,245,0.16)';
  ctx.fillRect(-W / 2, -H, W, H - 0.08 * M);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.moveTo(-W / 2 + 14, -H); ctx.lineTo(-W / 2 + 40, -H); ctx.lineTo(-W / 2 + 10, -H * 0.55); ctx.lineTo(-W / 2 + 4, -H * 0.55); ctx.fill();
  ctx.strokeStyle = '#b9c8cc'; ctx.lineWidth = 4;
  ctx.strokeRect(-W / 2, -H, W, H - 0.08 * M);
  ctx.fillStyle = '#9aa7b0';
  ctx.fillRect(W / 2 - 22, -H * 0.52, 5, 44); // puxador
}

// ------------------------------------------------------------------ cozinha
function geladeira(ctx: Ctx) {
  const W = 0.72 * M, H = 1.8 * M, D = 0.68 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H, D, { frente: '#eef1f4' });
  ctx.strokeStyle = '#b9c1c9'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-W / 2, -H * 0.66); ctx.lineTo(W / 2, -H * 0.66); ctx.stroke();
  ctx.fillStyle = '#9aa3ad';
  ctx.fillRect(W / 2 - 16, -H * 0.9, 6, 60);
  ctx.fillRect(W / 2 - 16, -H * 0.58, 6, 90);
  const imas = ['#e8335a', '#3d7bd9', '#f2c14e', '#58b368'];
  imas.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-W / 2 + 16 + i * 18, -H * 0.8 + (i % 2) * 14, 12, 12); });
  ctx.fillStyle = '#fff';
  ctx.fillRect(-W / 2 + 18, -H * 0.5, 44, 56);
  ctx.fillStyle = '#9aa0b0';
  for (let i = 0; i < 4; i++) ctx.fillRect(-W / 2 + 22, -H * 0.5 + 8 + i * 11, 34, 2);
}

/** Bancada da cozinha com pia, fogão embutido e micro-ondas. */
function bancada(ctx: Ctx, _o: Record<string, unknown>, t: number) {
  const W = 2.2 * M, H = 0.9 * M, D = 0.62 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H - 0.05 * M, D, { frente: '#e07a5f' });
  // portas
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
  for (let x = -W / 2 + W / 5; x < W / 2; x += W / 5) { ctx.beginPath(); ctx.moveTo(x, -H + 0.05 * M + 6); ctx.lineTo(x, -6); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = -W / 2 + W / 10; x < W / 2; x += W / 5) ctx.fillRect(x - 8, -H * 0.62, 16, 4);
  // tampo de pedra
  caixa(ctx, -W / 2 - 6, -H + 0.05 * M, W + 12, 0.05 * M, D + 4, { frente: '#f1ede4', topo: '#fbf8f1' });
  // cuba
  ctx.fillStyle = '#b9c8cc';
  ctx.beginPath(); ctx.ellipse(-W * 0.28 + D * OX * 0.5, -H + D * OY * 0.5, 44, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa7b0';
  ctx.fillRect(-W * 0.28 + D * OX * 0.85 - 3, -H + D * OY * 0.85 - 30, 6, 30);
  ctx.fillRect(-W * 0.28 + D * OX * 0.85 - 3, -H + D * OY * 0.85 - 30, 24, 6);
  // cooktop com panela
  const fx = W * 0.18 + D * OX * 0.5, fy = -H + D * OY * 0.5;
  ctx.fillStyle = '#23242b';
  ctx.beginPath(); ctx.moveTo(fx - 60, fy + 12); ctx.lineTo(fx + 60, fy + 12); ctx.lineTo(fx + 68, fy - 12); ctx.lineTo(fx - 52, fy - 12); ctx.fill();
  ctx.fillStyle = '#58606a';
  caixa(ctx, fx - 28, fy + 2, 46, 26, 30, { frente: '#9aa3ad' });
  // micro-ondas
  caixa(ctx, W / 2 - 0.62 * M, -H + D * OY * 0.7, 0.5 * M, 0.3 * M, 0.34 * M, { frente: '#3a3d4f' });
  ctx.fillStyle = 'rgba(120,180,220,0.5)';
  ctx.fillRect(W / 2 - 0.58 * M, -H + D * OY * 0.7 - 0.25 * M, 0.3 * M, 0.2 * M);
  ctx.fillStyle = '#7fd3ff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.floor(t / 60) % 24}`.padStart(2, '0') + ':' + `${Math.floor(t) % 60}`.padStart(2, '0'), W / 2 - 0.23 * M, -H + D * OY * 0.7 - 0.18 * M);
}

function mesaJantar(ctx: Ctx) {
  const W = 1.7 * M, H = 0.76 * M, D = 0.9 * M;
  sombra(ctx, 0, W, D);
  perna(ctx, -W / 2 + 10, 0, H, '#5a3a24', 9);
  perna(ctx, W / 2 - 10, 0, H, '#5a3a24', 9);
  perna(ctx, -W / 2 + 10 + D * OX, D * OY, H, '#4a2e1c', 9);
  perna(ctx, W / 2 - 10 + D * OX, D * OY, H, '#4a2e1c', 9);
  caixa(ctx, -W / 2, -H + 0.06 * M, W, 0.06 * M, D, { frente: '#8a5a3a', topo: '#a8764a' });
  // toalha, pratos e fruteira
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(-W * 0.2, -H); ctx.lineTo(W * 0.2, -H); ctx.lineTo(W * 0.2 + D * OX, -H + D * OY); ctx.lineTo(-W * 0.2 + D * OX, -H + D * OY); ctx.fill();
  for (const px of [-W * 0.32, W * 0.3]) { ctx.fillStyle = '#fbfaf6'; ctx.beginPath(); ctx.ellipse(px + D * OX * 0.4, -H + D * OY * 0.4, 22, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, -H + D * OY * 0.5 - 6, 26, 12, 0, Math.PI, 0); ctx.fill();
  ['#e8335a', '#58b368', '#f2c14e'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(D * OX * 0.5 - 10 + i * 10, -H + D * OY * 0.5 - 16, 8, 0, Math.PI * 2); ctx.fill(); });
}

// ------------------------------------------------------------------ sala
/** Sofá de frente para a câmera: parte de trás (encosto e assento). */
function sofa(ctx: Ctx, o: Record<string, unknown>) {
  const W = 2.5 * M, D = 0.9 * M, cor = (o.color as string) ?? '#3d7bd9';
  sombra(ctx, 0, W, D);
  // encosto (fundo)
  caixa(ctx, -W / 2 + D * OX * 0.7, D * OY * 0.7, W, 0.85 * M, D * 0.3, { frente: shade(cor, -0.06) });
  // assento
  caixa(ctx, -W / 2, 0, W, 0.44 * M, D * 0.72, { frente: cor });
  // almofadas
  ctx.fillStyle = (o.color2 as string) ?? '#f2c14e';
  ctx.beginPath(); ctx.ellipse(-W / 2 + 70 + D * OX * 0.8, -0.44 * M + D * OY * 0.8 - 26, 30, 26, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(W / 2 - 60 + D * OX * 0.8, -0.44 * M + D * OY * 0.8 - 26, 30, 26, -0.2, 0, Math.PI * 2); ctx.fill();
  // braço esquerdo (o direito vem na parte da frente)
  caixa(ctx, -W / 2 - 0.12 * M, 0, 0.14 * M, 0.62 * M, D, { frente: shade(cor, -0.12) });
}
function sofaBraco(ctx: Ctx, o: Record<string, unknown>) {
  const W = 2.5 * M, D = 0.9 * M, cor = (o.color as string) ?? '#3d7bd9';
  caixa(ctx, W / 2 - 0.02 * M, 0, 0.14 * M, 0.62 * M, D, { frente: shade(cor, -0.12) });
}

function mesaCentro(ctx: Ctx) {
  const W = 1.0 * M, H = 0.42 * M, D = 0.55 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H, D, { frente: '#6b4a2a', topo: '#8a5a3a' });
  ctx.fillStyle = '#e8845a';
  ctx.fillRect(-20 + D * OX * 0.5, -H + D * OY * 0.5 - 14, 16, 14);
  ctx.fillStyle = '#3d7bd9';
  ctx.fillRect(10 + D * OX * 0.5, -H + D * OY * 0.5 - 6, 38, 6);
}

/** Rack com TV, de frente para a câmera. */
function rackTv(ctx: Ctx, _o: Record<string, unknown>, t: number) {
  const W = 1.8 * M, H = 0.5 * M, D = 0.45 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H, D, { frente: '#3a2e28' });
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-W / 2 + 12, -H + 12, W / 2 - 18, H - 24);
  // TV
  const tx = D * OX * 0.6, ty = -H + D * OY * 0.6;
  ctx.fillStyle = '#23242b';
  ctx.fillRect(tx - 14, ty - 16, 28, 16);
  ctx.fillRect(tx - 0.62 * M, ty - 0.72 * M, 1.24 * M, 0.7 * M);
  const g = ctx.createLinearGradient(0, ty - 0.7 * M, 0, ty);
  const k = (Math.sin(t * 1.3) + 1) / 2;
  g.addColorStop(0, `rgb(${60 + k * 60},${120 + k * 40},${200})`);
  g.addColorStop(1, '#58b368');
  ctx.fillStyle = g;
  ctx.fillRect(tx - 0.58 * M, ty - 0.68 * M, 1.16 * M, 0.62 * M);
}

// ------------------------------------------------------------------ rua / praça
function bancoPraca(ctx: Ctx) {
  const W = 2.3 * M, S = 0.45 * M, D = 0.55 * M;
  sombra(ctx, 0, W, D);
  for (const x of [-W / 2 + 18, W / 2 - 18]) { perna(ctx, x, 0, S, '#3a3d4f', 8); perna(ctx, x + D * OX * 0.6, D * OY * 0.6, S, '#2b2d3a', 8); }
  // ripas do assento
  for (let i = 0; i < 3; i++) caixa(ctx, -W / 2, -S + i * -3 + D * OY * (i * 0.2), W, 0.04 * M, D * 0.22, { frente: '#a8764a', topo: '#c8955e' });
  // encosto
  for (let i = 0; i < 2; i++) caixa(ctx, -W / 2 + D * OX * 0.7, -S - 0.16 * M - i * 0.16 * M + D * OY * 0.7, W, 0.1 * M, 6, { frente: '#a8764a' });
}

function arvore(ctx: Ctx, o: Record<string, unknown>) {
  const s = (o.s as number) ?? 1, cor = (o.color as string) ?? '#4c8f3f';
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(8, 0, 90 * s, 22 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a2a';
  ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(14 * s, 0); ctx.lineTo(9 * s, -170 * s); ctx.lineTo(-9 * s, -170 * s); ctx.fill();
  const bolas: [number, number, number, string][] = [[0, -250, 95, cor], [-70, -200, 70, shade(cor, -0.08)], [70, -205, 72, shade(cor, 0.06)], [-30, -310, 70, shade(cor, 0.1)], [40, -300, 66, cor]];
  for (const [x, y, r, c] of bolas) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.arc(-30 * s, -300 * s, 30 * s, 0, Math.PI * 2); ctx.fill();
}

function poste(ctx: Ctx, o: Record<string, unknown>) {
  const acesa = !!o.state;
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a3d4f';
  ctx.fillRect(-4, -2.2 * M, 8, 2.2 * M);
  ctx.fillRect(-4, -2.2 * M, 60, 7);
  ctx.fillStyle = acesa ? '#ffe9a8' : '#c9d2d4';
  ctx.beginPath(); ctx.ellipse(56, -2.2 * M + 12, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
  if (acesa) {
    const g = ctx.createRadialGradient(56, -2.2 * M + 20, 4, 56, -0.4 * M, 1.6 * M);
    g.addColorStop(0, 'rgba(255,230,150,0.35)');
    g.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(40, -2.2 * M + 16); ctx.lineTo(72, -2.2 * M + 16); ctx.lineTo(56 + 1.2 * M, 0); ctx.lineTo(56 - 1.2 * M, 0); ctx.fill();
  }
}

function chafariz(ctx: Ctx, _o: Record<string, unknown>, t: number) {
  const W = 2.2 * M, D = 1.1 * M;
  sombra(ctx, 0, W, D, 0.12);
  ctx.fillStyle = '#b9b3a6';
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, D * OY * 0.5, W / 2, Math.abs(D * OY) / 2 + 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6fb8d6';
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, D * OY * 0.5 - 10, W / 2 - 16, Math.abs(D * OY) / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9d978a';
  ctx.fillRect(D * OX * 0.5 - 10, D * OY * 0.5 - 130, 20, 120);
  ctx.beginPath(); ctx.ellipse(D * OX * 0.5, D * OY * 0.5 - 130, 50, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,250,0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 0.6, r = 40 + ((t * 40 + i * 13) % 30);
    ctx.beginPath(); ctx.moveTo(D * OX * 0.5, D * OY * 0.5 - 150); ctx.quadraticCurveTo(D * OX * 0.5 + Math.cos(a) * r * 0.6, D * OY * 0.5 - 190, D * OX * 0.5 + Math.cos(a) * r, D * OY * 0.5 - 20 + Math.sin(a) * 8); ctx.stroke();
  }
}

function lixeira(ctx: Ctx) {
  caixa(ctx, -16, 0, 32, 0.75 * M, 26, { frente: '#2f8f6f' });
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('♻', -6, -0.4 * M);
}

function hidrante(ctx: Ctx) {
  ctx.fillStyle = '#e63956';
  ctx.fillRect(-12, -0.62 * M, 24, 0.62 * M);
  ctx.beginPath(); ctx.arc(0, -0.62 * M, 14, Math.PI, 0); ctx.fill();
  ctx.fillRect(-20, -0.4 * M, 40, 10);
}

/** Ponto de ônibus com abrigo e banco (sobre a calçada). */
function pontoOnibus(ctx: Ctx) {
  const W = 1.9 * M, D = 0.7 * M;
  sombra(ctx, 0, W, D);
  const cx = -W / 2;
  ctx.fillStyle = '#58606a';
  ctx.fillRect(cx + 6, -2.3 * M, 8, 2.3 * M);
  ctx.fillRect(cx + W - 14, -2.3 * M, 8, 2.3 * M);
  ctx.fillRect(cx + 6 + D * OX, -2.3 * M + D * OY, 8, 2.3 * M);
  ctx.fillRect(cx + W - 14 + D * OX, -2.3 * M + D * OY, 8, 2.3 * M);
  ctx.fillStyle = 'rgba(160,210,235,0.35)';
  ctx.fillRect(cx + D * OX, -2.2 * M + D * OY, W, 1.7 * M);
  caixa(ctx, cx - 10, -2.3 * M, W + 20, 0.08 * M, D + 10, { frente: '#2b5d8a' });
  caixa(ctx, cx + 20 + D * OX * 0.5, -0.45 * M + D * OY * 0.5, W - 40, 0.05 * M, D * 0.35, { frente: '#8a5a3a' });
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(cx + W + 16, -2.6 * M, 60, 60);
  ctx.fillStyle = '#2b2d3a';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('🚌', cx + W + 24, -2.6 * M + 44);
  ctx.fillStyle = '#58606a';
  ctx.fillRect(cx + W + 42, -2.25 * M, 8, 2.25 * M);
}

function orelhao(ctx: Ctx) {
  ctx.fillStyle = '#58606a';
  ctx.fillRect(-5, -1.3 * M, 10, 1.3 * M);
  ctx.fillStyle = '#f2a33a';
  ctx.beginPath(); ctx.ellipse(0, -1.55 * M, 48, 58, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-48, -1.55 * M, 96, 18);
  caixa(ctx, -18, -1.15 * M, 36, 0.36 * M, 14, { frente: '#3d7bd9' });
}

// ------------------------------------------------------------------ academia
/** Esteira: base e corrimão do fundo (o corredor fica EM CIMA da lona). */
function esteira(ctx: Ctx, _o: Record<string, unknown>, t: number) {
  const L = 2.3 * M, D = 0.8 * M, H = 0.22 * M;
  sombra(ctx, 0, L, D);
  caixa(ctx, -L / 2, 0, L, H, D, { frente: '#2b2d3a', topo: '#1c1d26' });
  // lona correndo
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const x = -L / 2 + 20 + ((i * 44 - t * 160) % (L - 40) + (L - 40)) % (L - 40);
    ctx.beginPath(); ctx.moveTo(x, -H - 6); ctx.lineTo(x + D * OX * 0.8, -H + D * OY * 0.8 - 6); ctx.stroke();
  }
  // coluna do painel (à direita) e corrimão do fundo
  const px = L / 2 - 30;
  ctx.fillStyle = '#58606a';
  ctx.fillRect(px + D * OX * 0.85 - 5, -1.35 * M + D * OY * 0.85, 10, 1.35 * M - H);
  ctx.fillRect(-L / 2 + 90 + D * OX * 0.85, -1.05 * M + D * OY * 0.85, px - (-L / 2 + 90), 7);
}
/** Esteira: painel e corrimão da frente (desenhados por cima de quem corre). */
function esteiraFrente(ctx: Ctx, _o: Record<string, unknown>, t: number) {
  const L = 2.3 * M, H = 0.22 * M;
  const px = L / 2 - 30;
  ctx.fillStyle = '#6b7380';
  ctx.fillRect(px - 5, -1.35 * M, 10, 1.35 * M - H);
  ctx.fillRect(-L / 2 + 90, -1.05 * M, px - (-L / 2 + 90), 7);
  caixa(ctx, px - 40, -1.35 * M, 90, 0.24 * M, 0.5 * M, { frente: '#1c1d26' });
  ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#58e08a' : '#3fc070';
  ctx.fillRect(px - 32, -1.35 * M + 0.06 * M - 0.24 * M + 10, 70, 16);
}

/** Supino: banco e suportes com a barra apoiada (a pessoa deita no banco). */
function supino(ctx: Ctx, o: Record<string, unknown>) {
  const L = 1.8 * M, S = 0.44 * M, D = 0.3 * M;
  sombra(ctx, 0, L + 60, 0.9 * M);
  perna(ctx, -L / 2 + 16, 0, S, '#3a3d4f', 10);
  perna(ctx, L / 2 - 16, 0, S, '#3a3d4f', 10);
  caixa(ctx, -L / 2, -S, L, 0.1 * M, D, { frente: '#e63956', topo: '#c42d47' });
  // suportes (na cabeceira, à esquerda) atrás e na frente do banco
  const sx = -L / 2 + 20;
  for (const k of [0.9, 0]) {
    ctx.fillStyle = k ? '#2b2d3a' : '#3a3d4f';
    ctx.fillRect(sx - 5 + 0.9 * M * OX * k, -1.25 * M + 0.9 * M * OY * k, 10, 1.25 * M);
  }
  // barra apoiada (se ninguém está usando)
  if (!o.emUso) {
    ctx.strokeStyle = '#c9d2d4'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(sx - 20, -1.2 * M + 6); ctx.lineTo(sx + 0.9 * M * OX + 20, -1.2 * M + 0.9 * M * OY + 6); ctx.stroke();
    for (const k of [-0.1, 1.1]) {
      ctx.fillStyle = '#1c1d26';
      ctx.beginPath(); ctx.ellipse(sx + 0.9 * M * OX * k, -1.2 * M + 0.9 * M * OY * k + 6, 12, 34, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** Rack de halteres (vários pares — várias pessoas usam ao mesmo tempo). */
function rackHalteres(ctx: Ctx) {
  const W = 2.0 * M, H = 0.95 * M, D = 0.6 * M;
  sombra(ctx, 0, W, D);
  // dois níveis inclinados
  for (let n = 0; n < 2; n++) {
    const y = -H * (0.45 + n * 0.45), off = n * 0.5;
    caixa(ctx, -W / 2 + D * OX * off, y + D * OY * off, W, 0.05 * M, D * 0.45, { frente: '#3a3d4f' });
    for (let i = 0; i < 7; i++) {
      const x = -W / 2 + 26 + i * (W - 50) / 6 + D * OX * off, yy = y - 12 + D * OY * off;
      const c = ['#e63956', '#3d7bd9', '#f2c14e', '#58b368', '#7c5cff', '#e8845a', '#9aa0b0'][i];
      ctx.fillStyle = '#23242b';
      ctx.fillRect(x - 14, yy - 2, 28, 4);
      ctx.fillStyle = c;
      ctx.fillRect(x - 18, yy - 9, 8, 18);
      ctx.fillRect(x + 10, yy - 9, 8, 18);
    }
  }
  perna(ctx, -W / 2 + 10, 0, H, '#2b2d3a', 10);
  perna(ctx, W / 2 - 10, 0, H, '#2b2d3a', 10);
}

/** Bicicleta ergométrica (a pessoa senta e pedala). */
function bike(ctx: Ctx) {
  sombra(ctx, 0, 1.1 * M, 0.5 * M, 0.16);
  ctx.fillStyle = '#2b2d3a';
  ctx.fillRect(-0.55 * M, -12, 1.1 * M, 12);
  ctx.strokeStyle = '#3a3d4f'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-0.3 * M, -12); ctx.lineTo(-0.12 * M, -0.62 * M); ctx.moveTo(0.3 * M, -12); ctx.lineTo(0.28 * M, -1.1 * M); ctx.stroke();
  ctx.fillStyle = '#e63956';
  ctx.beginPath(); ctx.arc(0.1 * M, -0.3 * M, 0.2 * M, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c1d26';
  ctx.fillRect(-0.24 * M, -0.66 * M, 0.26 * M, 0.07 * M);
  ctx.fillRect(0.22 * M, -1.14 * M, 0.2 * M, 0.06 * M);
}

function bebedouro(ctx: Ctx) {
  caixa(ctx, -0.18 * M, 0, 0.36 * M, 1.0 * M, 0.3 * M, { frente: '#d7dde2' });
  ctx.fillStyle = 'rgba(140,200,240,0.85)';
  ctx.fillRect(-0.14 * M + 0.3 * M * OX * 0.5, -1.35 * M + 0.3 * M * OY * 0.5, 0.28 * M, 0.35 * M);
  ctx.fillStyle = '#9aa7b0';
  ctx.fillRect(-10, -0.8 * M, 20, 8);
}

function balcaoAcademia(ctx: Ctx) {
  const W = 2.0 * M, H = 1.05 * M, D = 0.6 * M;
  sombra(ctx, 0, W, D);
  caixa(ctx, -W / 2, 0, W, H, D, { frente: '#e63956' });
  caixa(ctx, -W / 2 - 10, -H, W + 20, 0.06 * M, D + 6, { frente: '#1c1d26' });
  ctx.fillStyle = '#fff';
  ctx.font = '900 30px sans-serif';
  ctx.fillText('RECEPÇÃO', -W / 2 + 40, -H * 0.45);
  // monitor e catraca
  ctx.fillStyle = '#23242b';
  ctx.fillRect(W * 0.2 + D * OX * 0.6, -H - 60 + D * OY * 0.6, 70, 50);
}

function espelhao(ctx: Ctx) {
  ctx.fillStyle = 'rgba(200,225,240,0.55)';
  ctx.fillRect(-0.6 * M, -2.1 * M, 1.2 * M, 1.9 * M);
  ctx.strokeStyle = '#1c1d26'; ctx.lineWidth = 8;
  ctx.strokeRect(-0.6 * M, -2.1 * M, 1.2 * M, 1.9 * M);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.moveTo(-0.4 * M, -2.1 * M); ctx.lineTo(-0.15 * M, -2.1 * M); ctx.lineTo(-0.5 * M, -0.2 * M); ctx.lineTo(-0.6 * M, -0.2 * M); ctx.fill();
}

function anilhas(ctx: Ctx) {
  ctx.fillStyle = '#2b2d3a';
  ctx.fillRect(-6, -1.2 * M, 12, 1.2 * M);
  for (let i = 0; i < 5; i++) {
    const r = 46 - i * 6;
    ctx.fillStyle = i % 2 ? '#3a3d4f' : '#1c1d26';
    ctx.beginPath(); ctx.ellipse(8 + i * 6, -0.3 * M - i * 30, 10, r, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ------------------------------------------------------------------ rua
/** Carro de passeio 2,5D (frente para a direita; opts.flip vira). opts: color, noite (faróis acesos), giro (rodas). */
function carro(ctx: Ctx, o: Record<string, unknown>) {
  flip(ctx, o);
  const L = 3.8 * M, D = 0.62 * M, cor = (o.color as string) ?? '#e63956', giro = (o.giro as number) ?? 0;
  const dx = D * OX, dy = D * OY;
  sombra(ctx, 0, L, D * 0.8, 0.28);
  const roda = (x: number, y: number, longe: boolean) => {
    ctx.fillStyle = longe ? '#111' : '#1c1d26';
    ctx.beginPath(); ctx.ellipse(x, y, 0.3 * M, 0.3 * M, 0, 0, Math.PI * 2); ctx.fill();
    if (longe) return;
    ctx.fillStyle = '#b9c2c9';
    ctx.beginPath(); ctx.arc(x, y, 0.15 * M, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#6b7380'; ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) { const a = giro + (k * Math.PI * 2) / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 0.14 * M, y + Math.sin(a) * 0.14 * M); ctx.stroke(); }
  };
  // rodas do lado de lá
  roda(-L * 0.3 + dx * 0.85, -0.3 * M + dy * 0.85, true);
  roda(L * 0.3 + dx * 0.85, -0.3 * M + dy * 0.85, true);
  // carroceria
  caixa(ctx, -L / 2, -0.2 * M, L, 0.62 * M, D * 0.92, { frente: cor });
  // cabine com vidros (trapézio) e teto em profundidade
  const y0 = -0.82 * M, y1 = -1.38 * M, a0 = -L * 0.3, a1 = -L * 0.2, b1 = L * 0.12, b0 = L * 0.24;
  ctx.fillStyle = shade(cor, 0.1);
  ctx.beginPath(); ctx.moveTo(a1, y1); ctx.lineTo(b1, y1); ctx.lineTo(b1 + dx * 0.85, y1 + dy * 0.85); ctx.lineTo(a1 + dx * 0.85, y1 + dy * 0.85); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(cor, -0.06);
  ctx.beginPath(); ctx.moveTo(a0, y0); ctx.lineTo(a1, y1); ctx.lineTo(b1, y1); ctx.lineTo(b0, y0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.9)';
  ctx.beginPath(); ctx.moveTo(a0 + 16, y0 - 4); ctx.lineTo(a1 + 10, y1 + 8); ctx.lineTo(-L * 0.04, y1 + 8); ctx.lineTo(-L * 0.04, y0 - 4); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-L * 0.02, y0 - 4); ctx.lineTo(-L * 0.02, y1 + 8); ctx.lineTo(b1 - 6, y1 + 8); ctx.lineTo(b0 - 18, y0 - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(a0 + 30, y0 - 4); ctx.lineTo(a1 + 22, y1 + 8); ctx.lineTo(a1 + 40, y1 + 8); ctx.lineTo(a0 + 48, y0 - 4); ctx.fill();
  // maçaneta, frisos, faróis e lanternas
  ctx.fillStyle = shade(cor, -0.4);
  ctx.fillRect(-L * 0.12, -0.62 * M, 26, 5); ctx.fillRect(L * 0.08, -0.62 * M, 26, 5);
  ctx.fillRect(-L / 2, -0.36 * M, L, 3);
  const noite = !!o.noite;
  ctx.fillStyle = noite ? '#fff6c8' : '#f4efe0';
  ctx.fillRect(L / 2 - 16, -0.58 * M, 14, 16);
  ctx.fillStyle = noite ? '#ff3b3b' : '#b8323a';
  ctx.fillRect(-L / 2 + 2, -0.58 * M, 12, 16);
  if (noite) {
    const g = ctx.createLinearGradient(L / 2, 0, L / 2 + 2.2 * M, 0);
    g.addColorStop(0, 'rgba(255,240,180,0.45)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(L / 2, -0.52 * M); ctx.lineTo(L / 2 + 2.2 * M, -0.9 * M); ctx.lineTo(L / 2 + 2.2 * M, 0.05 * M); ctx.closePath(); ctx.fill();
  }
  // rodas do lado de cá
  roda(-L * 0.3, -0.3 * M, false);
  roda(L * 0.3, -0.3 * M, false);
}

export type DesenhoMovel = (ctx: Ctx, o: Record<string, unknown>, t: number) => void;
export const MOVEIS: Record<string, DesenhoMovel> = {
  cama, camaCobertor, boxFrente, escrivaninha, cadeira, cadeiraEscritorio, estante, tapete, luminariaPe, planta, pia, vaso, box, geladeira, bancada,
  mesaJantar, sofa, sofaBraco, mesaCentro, rackTv, bancoPraca, arvore, poste, chafariz, lixeira, hidrante, pontoOnibus, orelhao, esteira,
  esteiraFrente, supino, rackHalteres, bike, bebedouro, balcaoAcademia, espelhao, anilhas, carro,
};
