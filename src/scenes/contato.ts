/**
 * Contato entre dois personagens (abraço, beijo...). Motor — zona vermelha.
 *
 * Em vez de "encostar" dois bonecos a uma distância fixa, o controlador lê a cada quadro o ESQUELETO real de cada um
 * (peito, costas, boca, altura da cabeça), e:
 *   1. posiciona os corpos para que o ponto de contato se encontre (peito com peito, boca com boca);
 *   2. leva as mãos às costas do outro por IK (reachN/reachF), com entrada e saída suaves;
 *   3. corrige a diferença de altura (quem é mais alto se inclina, quem é mais baixo fica na ponta dos pés);
 *   4. gira as cabeças para o perfil e inclina para lados opostos (os narizes não colidem);
 *   5. liga o `enlace` para a cena intercalar camadas: braço distante ATRÁS do corpo do outro, braço próximo NA FRENTE.
 *
 * Tudo é aditivo sobre o movimento-base (Actor.ajuste), então funciona com qualquer idade, altura e roupa.
 * Documentação: docs/specs/SPEC-07-contato-entre-personagens.md
 */
import { Actor } from '../character/actor';
import { skeleton, legLength } from '../character/character';
import type { Hand, Pose, Pt } from '../character/rig';
import { frenteBocaX, perfilDe } from '../character/head';
import { clamp, lerp } from '../core/math';

export type TipoContato = 'abraco' | 'beijo';

/** Converte um ponto do quadro da pelve (como em skeleton()) para o mundo. */
export function localParaMundo(a: Actor, p: Pt, pose: Pose = a.pose): Pt {
  const c = Math.cos(pose.rot), s = Math.sin(pose.rot);
  const rx = p.x * c - p.y * s, ry = p.x * s + p.y * c;
  const lx = (rx + pose.x) * pose.sx;
  const ly = (ry - legLength(a.d) + pose.y) * pose.sy;
  return { x: a.x + lx * a.facing * a.scale, y: a.y - a.elev + ly * a.scale };
}

/** Ponto no tronco (quadro do tronco: x para a frente do personagem, y do quadril para cima negativo) → mundo. */
function noTronco(a: Actor, x: number, y: number): Pt {
  // mesma cadeia do desenho (inTorso): gira o peito em torno do pivô e depois tudo pela lombar
  const sk = skeleton(a.d, a.pose, a.turn);
  let px = x, py = y;
  if (y < sk.pivotY) {
    const c = Math.cos(a.pose.chest), s = Math.sin(a.pose.chest), yy = y - sk.pivotY;
    px = x * c - yy * s;
    py = x * s + yy * c + sk.pivotY;
  }
  const cl = Math.cos(sk.lean), sl = Math.sin(sk.lean);
  return localParaMundo(a, { x: px * cl - py * sl, y: px * sl + py * cl });
}

/** Pontos de referência do corpo no mundo. */
export function marcos(a: Actor) {
  const d = a.d, T = d.torso, t = a.turn;
  const cw = d.chestW / 2;
  const frenteX = cw * (1 - 0.2 * t) + d.bust * t * 7;
  const costasX = -cw * (1 - 0.1 * t);
  const sk = skeleton(d, a.pose, t);
  const cab = localParaMundo(a, sk.head);
  // boca: frente dos lábios (mesma conta de head.ts) girada pela cabeça
  const W = d.headW, H = d.headH;
  const mx = frenteBocaX(W, t), my = H * 0.325;
  const ca = Math.cos(sk.headAng), sa = Math.sin(sk.headAng);
  const bocaLocal = { x: sk.head.x + mx * ca - my * sa, y: sk.head.y + mx * sa + my * ca };
  const naCabeca = (hx: number, hy: number) => localParaMundo(a, { x: sk.head.x + hx * ca - hy * sa, y: sk.head.y + hx * sa + hy * ca });
  return {
    peitoFrente: noTronco(a, frenteX, -T * 0.62),
    costasAlto: noTronco(a, costasX - 2, -T * 0.72),
    costasBaixo: noTronco(a, costasX - 1, -T * 0.42),
    cabeca: cab,
    boca: localParaMundo(a, bocaLocal),
    ombro: localParaMundo(a, sk.shoulderN),
    /** ombro do lado de lá — em ¾ é o que fica do lado para onde a pessoa olha (o mais perto de quem está à frente dela) */
    ombroF: localParaMundo(a, sk.shoulderF),
    /** bochecha visível (alvo de tapa, carinho) */
    rosto: naCabeca(W * (0.26 + t * 0.12), H * 0.12),
    /** queixo/mandíbula (alvo de soco) — na silhueta do rosto, do lado para onde a pessoa olha */
    queixo: naCabeca(W * (0.22 + t * 0.12), H * 0.36),
  };
}

/** 0 em ¾, 1 em perfil completo (turn ≥ 1.45) — espelha a regra de head.ts. */
export function perfil(turn: number) {
  return perfilDe(turn);
}

interface Estado { turn0: number; x0: number; z0: number; y0: number }

export class Contato {
  vivo = true;
  /** 0 → 1: quanto o contato está "engajado" (entrada/saída suaves) */
  peso = 0;
  alvo = 1;
  t = 0;
  private falta = 0;
  /** beijo: quem é o mais alto/mais baixo — decidido UMA vez, em pé (recalcular por quadro faz os papéis trocarem quando a
   *  compensação iguala as bocas, e a pose oscila) */
  private alta!: Actor;
  private baixa!: Actor;
  /** beijo: correção vertical acumulada em px (controle integral do rastreio de altura) */
  private altC = 0;
  /** beijo: o que cada um está fazendo agora (px por estágio) — lido pelo painel/QA e pelos testes */
  diagnostico: { erro: number; c: number; alta: Record<string, number>; baixa: Record<string, number> } | null = null;
  private ini = new Map<Actor, Estado>();
  /** onde cada mão estava (relativa ao corpo) antes do contato — início do arco de alcance */
  private maoIni = new Map<Actor, { n: Pt; f: Pt }>();
  constructor(public a: Actor, public b: Actor, public tipo: TipoContato, public o: { aperto?: number; turn?: number } = {}) {
    for (const x of [a, b]) this.ini.set(x, { turn0: x.turn, x0: x.x, z0: x.z, y0: x.y });
    a.enlace = b;
    b.enlace = a;
    if (tipo === 'abraco') {
      // composição: quem é mais baixo fica NA FRENTE (cabeça apoiada no ombro/peito do outro);
      // o mais alto fica atrás, olhando por cima do ombro — os dois rostos aparecem
      const ha = marcos(a).cabeca.y, hb = marcos(b).cabeca.y;
      const baixo = ha >= hb ? a : b, alto = baixo === a ? b : a;
      baixo.z = Math.max(a.z, b.z) + 0.01;
      alto.z = Math.min(this.ini.get(a)!.z0, this.ini.get(b)!.z0);
      if (baixo.z <= alto.z) baixo.z = alto.z + 0.5;
    }
    if (tipo === 'beijo') {
      const ya = marcos(a).boca.y, yb = marcos(b).boca.y;
      this.alta = ya <= yb ? a : b;
      this.baixa = this.alta === a ? b : a;
      // pré-alimentação: começa já com a diferença em pé (o integrador só corrige o resto)
      this.altC = clamp(Math.abs(ya - yb) * RASTREIO_BEIJO.preAlimentacao, 0, 400);
    }
  }

  /** Quem está na frente (desenhado por cima): maior z. */
  get frente() { return this.a.z >= this.b.z ? this.a : this.b; }

  soltar() { this.alvo = 0; }

  update(dt: number) {
    const { a, b } = this;
    this.t += dt;
    const entra = this.tipo === 'beijo' ? 1.0 : 0.8;
    // anda em direção ao alvo e PARA nele (antes, com peso == alvo, descia e subia a cada quadro: tremor em todo contato)
    if (this.alvo > this.peso) this.peso = Math.min(this.alvo, this.peso + dt / entra);
    else if (this.alvo < this.peso) this.peso = Math.max(this.alvo, this.peso - dt / 0.7);
    // Tempo em camadas (como um animador faria): primeiro giram o corpo e as mãos buscam o outro (antecipação);
    // só depois vem o contato (corpo/boca encostam). Na saída, a ordem se inverte: o rosto se afasta, as mãos soltam por último.
    const wM = easeInOut(clamp(this.peso / 0.6, 0, 1));
    const w = easeInOut(clamp((this.peso - 0.3) / 0.7, 0, 1));
    const turnAlvo = this.o.turn ?? (this.tipo === 'beijo' ? 1.42 : 0.98);
    for (const x of [a, b]) {
      // no abraço, quem está na frente mostra mais o rosto (bochecha no ombro do outro, virado para a câmera)
      const alvoX = this.tipo === 'abraco' && this.o.turn === undefined && x === this.frente ? 0.8 : turnAlvo;
      x.turn = lerp(this.ini.get(x)!.turn0, alvoX, wM);
    }

    // ---- 0. mesmo nível de chão: fora de interação cada um anda na sua "faixa" (2,5D); em contato direto os dois deslizam
    // para a linha média e, ao soltar, voltam suavemente para a própria faixa
    const ia = this.ini.get(a)!, ib = this.ini.get(b)!;
    const chao = (ia.y0 + ib.y0) / 2;
    a.y = lerp(ia.y0, chao, wM);
    b.y = lerp(ib.y0, chao, wM);

    const ma = marcos(a), mb = marcos(b);
    const aperto = this.o.aperto ?? 0.6;

    // ---- 1. posição: aproxima os corpos (cada um anda metade da correção)
    let erro = 0;
    // "apertão": no meio do abraço os dois se apertam por meio segundo (e sobem um pouco), depois relaxam
    const apertao = this.tipo === 'abraco' && this.alvo > 0 ? Math.sin(Math.PI * clamp((this.t - 1.05) / 0.6, 0, 1)) : 0;
    if (this.tipo === 'abraco') {
      // peito com peito, com leve sobreposição (roupas e corpos se apertam). Em 2D as cabeças não conseguem se cruzar
      // em x sem um corpo atravessar o outro — a separação dos rostos vem da ALTURA (ver bloco 2).
      const folga = lerp(34, -6 - aperto * 10 - apertao * 7, w);
      erro = (mb.peitoFrente.x - ma.peitoFrente.x) * a.facing - folga;
    } else {
      const folga = lerp(30, -1.5, w); // lábios encostando
      erro = (mb.boca.x - ma.boca.x) * a.facing - folga;
    }
    const passo = clamp(erro, -90, 90) * Math.min(1, dt * 7) * wM;
    a.x += (passo / 2) * a.facing;
    b.x -= (passo / 2) * a.facing;

    // ---- 2. altura: quem é mais alto se inclina/abaixa a cabeça; quem é mais baixo sobe na ponta dos pés
    const alta = ma.cabeca.y < mb.cabeca.y ? a : b, baixa = alta === a ? b : a;
    const dif = Math.abs(ma.cabeca.y - mb.cabeca.y);
    const ref = this.tipo === 'beijo' ? (alta === a ? ma.boca.y - mb.boca.y : mb.boca.y - ma.boca.y) : 0;
    const sway = Math.sin(this.t * 1.6) * 0.035 * w;
    const respira = (Math.sin(this.t * 2.1) + 1) * 0.5;
    if (this.tipo === 'abraco') {
      // o da FRENTE encosta a cabeça no ombro do outro (desce o rosto); o de TRÁS fica ereto, rosto por cima do ombro.
      // Se as alturas forem parecidas, o da frente dobra um pouco mais (senão as cabeças se cobrem).
      const frente = this.frente, tras = frente === a ? b : a;
      const hF = frente === a ? ma.cabeca.y : mb.cabeca.y, hT = frente === a ? mb.cabeca.y : ma.cabeca.y;
      const H = frente.d.headH * frente.scale;
      // quanto a cabeça da frente ainda precisa descer para o rosto de trás aparecer por cima (meta: ~0,85 cabeça)
      // controle integral: a medida já inclui o ajuste aplicado, então acumula até o erro zerar (não para no meio)
      // critério: o TOPO da cabeça da frente (com folga para cabelo volumoso) precisa ficar abaixo da boca de quem está atrás
      const bocaT = (frente === a ? mb : ma).boca.y;
      const topoF = hF - H * (0.62 + frente.ap.hairVolume * 0.08);
      const erroAltura = (bocaT + H * 0.04 - topoF) / H;
      this.falta = clamp(this.falta + erroAltura * dt * 3.5 * w, 0, 1.3);
      const f = this.falta;
      const ap = apertao;
      // a altura sai dos joelhos e da lombar; a cabeça só encosta (inclinação pequena — rosto deitado de lado lê como "torto")
      // o rosto não pode somar toda a curvatura da coluna (lombar + peito + pescoço): a cabeça compensa e fica só
      // levemente deitada (≈ 0,22 rad) — bochecha encostada, não "rosto de lado"
      // descer SEM afundar os pés: primeiro dobra os joelhos (pés plantados), o que faltar vira inclinação do tronco.
      // (antes era `y` positivo: o corpo inteiro descia e os pés ficavam abaixo do chão do outro)
      const desce = Math.max(0, f * 40 - ap * 3);
      const Lp = (frente.d.thigh + frente.d.shin) * frente.scale;
      const pxJ = Math.min(desce, Lp * (1 - Math.cos(ABRACO_JOELHOS_MAX / 2)));
      const joelhos = 2 * Math.acos(clamp(1 - pxJ / Lp, -1, 1));
      const resto = desce - pxJ;
      const lf = 0.12 + f * 0.06 + ap * 0.05 + Math.min(0.3, resto / 80), cf = 0.06 + f * 0.05 + Math.min(0.16, resto / 160), nf = 0.05 + f * 0.03;
      aplicar(frente, { lean: lf * w, chest: cf * w, neck: nf * w, head: (0.3 + ap * 0.05 - lf - cf - nf) * w, joelhos: joelhos * w, hipTilt: sway * 4, breath: respira * 0.6 * w, x: sway * 30, shrugN: (0.3 + ap * 0.25) * w, shrugF: (0.3 + ap * 0.25) * w }, dt);
      // quem está atrás: ereto, na ponta dos pés quando precisa, queixo um pouco erguido "por cima do ombro"
      const pt = Math.min(15, f * 11) + ap * 4;
      aplicar(tras, { lean: (0.04 + ap * 0.04) * w, chest: -0.04 * w, neck: 0.02 * w, head: (-0.04 - ap * 0.06) * w, pontas: pt * w, hipTilt: -sway * 4, breath: respira * 0.6 * w, x: sway * 30, shrugN: (0.22 + ap * 0.2) * w, shrugF: (0.18 + ap * 0.2) * w }, dt);
      void alta; void baixa; void dif;
    } else {
      // beijo: RASTREIO DE ALTURA (SPEC-08). Mede as duas bocas a cada quadro e acumula a correção até elas se encontrarem;
      // a correção é distribuída em estágios, como o corpo real faz (ver RASTREIO_BEIJO e distribuirAltura).
      const alta = this.alta, baixa = this.baixa;
      const mA = alta === a ? ma : mb, mB = alta === a ? mb : ma;
      const erroY = mB.boca.y - mA.boca.y; // > 0: a boca do mais alto ainda está acima
      // a postura de altura entra JUNTO com a aproximação (wM), antes de os lábios encostarem (w): quem vai beijar
      // já inclina a cabeça/fica na ponta dos pés enquanto chega — não "corrige" depois do toque
      const wH = wM;
      if (wH > RASTREIO_BEIJO.integraAPartirDe) this.altC += erroY * Math.min(1, dt * RASTREIO_BEIJO.ganho);
      const capA = capacidade(alta, 'desce'), capB = capacidade(baixa, 'sobe');
      this.altC = clamp(this.altC, -6, capA + capB);
      const c = Math.max(0, this.altC);
      // divisão: o mais alto faz a maior parte; se um esgotar, o outro completa
      let usoA = Math.min(c * RASTREIO_BEIJO.parteDoMaisAlto, capA);
      const usoB = Math.min(c - usoA, capB);
      usoA = Math.min(c - usoB, capA);
      const dA = distribuirAltura(alta, 'desce', usoA);
      const dB = distribuirAltura(baixa, 'sobe', usoB);
      // "pressão" lenta e fora de fase — o beijo respira em vez de congelar; base de inclinações opostas cruza os narizes
      const pressao = Math.sin(this.t * 2.2) * 0.035 * w;
      const ba = RASTREIO_BEIJO.base;
      aplicar(alta, {
        head: (ba.cabecaMaisAlto + dA.head) * wH + pressao, neck: dA.neck * wH, chest: (ba.peito + dA.chest) * wH, lean: (ba.lombar + dA.lean) * wH,
        joelhos: dA.joelhos * wH, breath: respira * 0.4 * w, hipTilt: sway * 2,
      }, dt);
      aplicar(baixa, {
        head: (ba.cabecaMaisBaixo - dB.head) * wH - pressao, neck: -dB.neck * wH, chest: (ba.peito - dB.chest) * wH, lean: ba.lombar * wH,
        pontas: dB.pontas * wH,
        breath: respira * 0.4 * w, hipTilt: -sway * 2,
      }, dt);
      this.diagnostico = { erro: erroY, c, alta: dA, baixa: dB };
      void dif; void ref;
    }

    // ---- 3. mãos nas costas do outro (IK), com alcance suave
    const maos = (x: Actor, alvo: ReturnType<typeof marcos>) => {
      // guarda a posição de repouso das mãos (relativa ao corpo) enquanto o contato não engatou
      if (wM < 0.02 || !this.maoIni.has(x)) {
        const n = x.handWorld(true), f = x.handWorld(false);
        this.maoIni.set(x, { n: { x: n.x - x.x, y: n.y - x.y }, f: { x: f.x - x.x, y: f.y - x.y } });
      }
      if (wM < 0.02) { x.reachN = null; x.reachF = null; return; }
      const mi = this.maoIni.get(x)!;
      const hn = { x: x.x + mi.n.x, y: x.y + mi.n.y }, hf = { x: x.x + mi.f.x, y: x.y + mi.f.y };
      const naFrente = x === this.frente;
      const cw = (x === a ? b : a).d.chestW * (x === a ? b : a).scale;
      let tn: Pt, tf: Pt;
      if (this.tipo === 'abraco') {
        if (naFrente) {
          // quem está na frente abraça pela cintura: mão baixa e um pouco para dentro das costas (o cotovelo dobra)
          const p0 = { x: lerp(alvo.costasAlto.x, alvo.costasBaixo.x, 0.85), y: lerp(alvo.costasAlto.y, alvo.costasBaixo.y, 0.85) };
          tn = { x: p0.x - x.facing * cw * 0.3, y: p0.y + 4 };
          tf = { x: alvo.costasBaixo.x - x.facing * cw * 0.2, y: alvo.costasBaixo.y + 8 };
        } else {
          // quem está atrás envolve por cima: mão aberta nas costas altas (reaparece sobre o corpo do outro)
          tn = { x: alvo.costasAlto.x - x.facing * cw * 0.12, y: alvo.costasAlto.y + 8 };
          tf = { x: alvo.costasAlto.x - x.facing * cw * 0.05, y: alvo.costasAlto.y + 14 };
        }
      } else {
        const outro = x === a ? b : a;
        const W = outro.d.headW * outro.scale, Hh = outro.d.headH * outro.scale;
        if (naFrente) {
          // quem está na frente: mão próxima no rosto do outro (maxilar, entre a boca e a orelha — não cobre olhos
          // nem boca); a distante na cintura, por trás do corpo do outro
          const rosto = { x: alvo.cabeca.x + outro.facing * W * 0.02, y: alvo.cabeca.y + Hh * 0.34 };
          // se o rosto estiver longe demais do ombro (braço esticaria como uma barra na horizontal), a mão desce
          // para a cintura do outro (quem é bem mais alto segura pela cintura) — mistura contínua pela distância
          const sh = localParaMundo(x, skeleton(x.d, x.pose, x.turn).shoulderN);
          const L = (x.d.upperArm + x.d.foreArm) * x.scale;
          const k = clamp((Math.hypot(rosto.x - sh.x, rosto.y - sh.y) - L * 0.86) / (L * 0.12), 0, 1);
          const cintura = { x: lerp(alvo.peitoFrente.x, alvo.costasBaixo.x, 0.45), y: alvo.costasBaixo.y + outro.d.torso * outro.scale * 0.12 };
          tn = { x: lerp(rosto.x, cintura.x, k), y: lerp(rosto.y, cintura.y, k) };
          tf = { x: alvo.costasBaixo.x - x.facing * cw * 0.1, y: alvo.costasBaixo.y };
        } else {
          // quem está atrás: braço próximo envolve a cintura (a mão reaparece nas costas do outro), o distante sobe às costas
          tn = { x: alvo.costasBaixo.x - x.facing * cw * 0.14, y: lerp(alvo.costasAlto.y, alvo.costasBaixo.y, 0.75) };
          tf = { x: alvo.costasAlto.x - x.facing * cw * 0.1, y: alvo.costasAlto.y + 6 };
        }
      }
      // quem abraça pela frente nunca leva a mão acima do próprio ombro (o braço cruzaria o próprio rosto)
      if (this.tipo === 'abraco' && naFrente) {
        const sy = localParaMundo(x, skeleton(x.d, x.pose, x.turn).shoulderN).y + x.d.torso * x.scale * 0.12;
        tn = { x: tn.x, y: Math.max(tn.y, sy) };
        tf = { x: tf.x, y: Math.max(tf.y, sy + 6) };
      }
      // a mão não vai em linha reta: sobe num arco (abre o braço) e desce no alvo; a mão distante atrasa um pouco
      const T = x.d.torso * x.scale;
      // no beijo, a mão que vai ao rosto espera o corpo chegar (senão o braço cruza a boca do outro ainda longe)
      const uN = this.tipo === 'beijo' && naFrente ? easeInOut(clamp((this.peso - 0.2) / 0.65, 0, 1)) : wM, uF = easeInOut(clamp(this.peso / 0.7, 0, 1));
      const n = arco(hn, tn, uN, T * 0.35, x.facing * T * 0.12);
      const f = arco(hf, tf, uF, T * 0.25, x.facing * T * 0.08);
      // carinho: a mão no rosto/costas não fica parada — pequeno afago lento
      const afago = Math.sin(this.t * 2.3) * 1.4 * w;
      x.reachN = { x: n.x + afago * 0.5 * x.facing, y: n.y + afago };
      x.reachF = f;
    };
    maos(a, mb);
    maos(b, ma);

    if (this.peso <= 0 && this.alvo === 0) this.encerrar();
  }

  encerrar() {
    for (const x of [this.a, this.b]) {
      x.reachN = null; x.reachF = null; x.enlace = null; x.ajuste = null;
      x.turn = this.ini.get(x)!.turn0;
      x.z = this.ini.get(x)!.z0;
      x.y = this.ini.get(x)!.y0;
    }
    this.vivo = false;
  }
}

/** Curva de alcance: bezier quadrática de `de` até `ate`, com o controle acima (sobe) e à frente do meio do caminho. */
function arco(de: Pt, ate: Pt, u: number, sobe: number, frente: number): Pt {
  const c = { x: (de.x + ate.x) / 2 + frente, y: Math.min(de.y, ate.y) - sobe };
  const v = 1 - u;
  return { x: v * v * de.x + 2 * v * u * c.x + u * u * ate.x, y: v * v * de.y + 2 * v * u * c.y + u * u * ate.y };
}

function easeInOut(k: number) {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

/** Suaviza o ajuste aditivo do ator em direção ao alvo. */
function aplicar(a: Actor, alvo: Partial<Record<AjusteCampo, number>>, dt: number) {
  const atual = (a.ajuste ??= {});
  const k = Math.min(1, dt * 6);
  for (const c of CAMPOS) {
    const v = alvo[c] ?? 0;
    atual[c] = lerp(atual[c] ?? 0, v, k);
  }
}
export type AjusteCampo = 'x' | 'y' | 'lean' | 'chest' | 'neck' | 'head' | 'hipTilt' | 'breath' | 'shrugN' | 'shrugF' | 'footN' | 'footF' | 'joelhos' | 'pontas';
const CAMPOS: AjusteCampo[] = ['x', 'y', 'lean', 'chest', 'neck', 'head', 'hipTilt', 'breath', 'shrugN', 'shrugF', 'footN', 'footF', 'joelhos', 'pontas'];

// =====================================================================================================================
// Rastreio de altura do beijo (SPEC-08). Os números abaixo são os ÚNICOS que se deve ajustar para mudar o comportamento.

/**
 * Parâmetros do rastreio. Ângulos em radianos; `px` são pixels de subida/descida DA BOCA.
 * `eficiencia` é quantos px a boca anda por radiano daquela articulação, em múltiplos da largura da cabeça (W) — é uma
 * estimativa: o controle é em malha fechada, então um valor impreciso só muda a velocidade, não o resultado.
 */
export const RASTREIO_BEIJO = {
  /** quanto da diferença o mais alto resolve (o resto é do mais baixo) */
  parteDoMaisAlto: 0.55,
  /** velocidade do integrador (1/s) — maior = acha a boca mais rápido, mas pode tremer */
  ganho: 4,
  /** só integra com a postura de altura já quase toda aplicada (antes disso o erro é da entrada, não da altura) */
  integraAPartirDe: 0.97,
  /** fração da diferença de altura em pé usada como palpite inicial (< 1: melhor chegar um pouco curto que passar da boca) */
  preAlimentacao: 0.75,
  /** inclinações de base, mesmo com alturas iguais: cabeças em ângulos opostos para os narizes se cruzarem */
  base: { cabecaMaisAlto: 0.06, cabecaMaisBaixo: -0.1, peito: 0, lombar: 0.02 },
  /** ordem e limites de quem DESCE (o mais alto): primeiro a cabeça, depois pescoço, depois encurvar, por último os joelhos */
  desce: [
    { campo: 'head', max: 0.18, eficiencia: 0.42 },
    { campo: 'neck', max: 0.14, eficiencia: 0.55 },
    { campo: 'chest', max: 0.12, eficiencia: 0.7 },
    { campo: 'lean', max: 0.08, eficiencia: 0.8 },
    { campo: 'joelhos', max: 0.9, eficiencia: 0 }, // joelhos: conta exata pela perna (ver pxDoEstagio)
  ],
  /** ordem e limites de quem SOBE (o mais baixo): queixo para cima, pescoço, ponta dos pés, e um leve arco nas costas */
  sobe: [
    { campo: 'head', max: 0.2, eficiencia: 0.42 },
    { campo: 'neck', max: 0.12, eficiencia: 0.5 },
    { campo: 'pontas', max: 0.075, eficiencia: 0 }, // ponta dos pés: max em fração do comprimento da perna; 1 px = 1 px
    { campo: 'chest', max: 0.06, eficiencia: 0.5 },
  ],
};

/** Abraço: quanto quem está na frente pode dobrar os joelhos (rad) antes de o resto da descida virar inclinação do tronco. */
export const ABRACO_JOELHOS_MAX = 1.25;

type Sentido = 'desce' | 'sobe';
type Estagio = { campo: string; max: number; eficiencia: number };

/** px que a boca anda com o estágio no valor `v` (monotônico). */
function pxDoEstagio(x: Actor, e: Estagio, v: number): number {
  const W = x.d.headW * x.scale;
  if (e.campo === 'joelhos') {
    // dobrar b rad (coxa a/2 para a frente, canela b): o quadril desce Lp·(1 − cos(b/2))
    const Lp = (x.d.thigh + x.d.shin) * x.scale;
    return Lp * (1 - Math.cos(v / 2));
  }
  if (e.campo === 'pontas') return v; // já em px
  return v * e.eficiencia * W;
}

function maxDoEstagio(x: Actor, e: Estagio): number {
  if (e.campo === 'pontas') return e.max * legLength(x.d) * x.scale;
  return e.max;
}

/** Soma de px que o ator consegue mover a boca naquele sentido, com todos os estágios no limite. */
function capacidade(x: Actor, sentido: Sentido): number {
  let t = 0;
  for (const e of RASTREIO_BEIJO[sentido]) t += pxDoEstagio(x, e, maxDoEstagio(x, e));
  return t;
}

/**
 * Converte `px` (quanto a boca precisa andar) em valores de articulação, enchendo os estágios EM ORDEM: só passa ao
 * próximo quando o anterior chegou ao limite. Os limites de cada estágio vêm de RASTREIO_BEIJO.
 */
export function distribuirAltura(x: Actor, sentido: Sentido, px: number): Record<string, number> {
  const out: Record<string, number> = { head: 0, neck: 0, chest: 0, lean: 0, joelhos: 0, pontas: 0 };
  let resta = Math.max(0, px);
  for (const e of RASTREIO_BEIJO[sentido]) {
    if (resta <= 0) break;
    const vmax = maxDoEstagio(x, e);
    const cap = pxDoEstagio(x, e, vmax);
    if (cap <= 0) continue;
    if (resta >= cap) { out[e.campo] += vmax; resta -= cap; continue; }
    // inverso por bisseção (vale para estágios não lineares como os joelhos)
    let lo = 0, hi = vmax;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (pxDoEstagio(x, e, m) < resta) lo = m; else hi = m; }
    out[e.campo] += (lo + hi) / 2;
    resta = 0;
  }
  return out;
}

// =====================================================================================================================
// Trajeto de mão: a mão vai por IK de chave em chave; cada chave pode apontar para um marco VIVO do corpo do outro.
// É o jeito de fazer tapa, soco, empurrão, aperto de mão, toca-aqui, entregar objeto e mão no ombro encostarem de verdade.

export type PontoMao = Pt | (() => Pt) | null; // null = repouso (onde o movimento-base deixaria a mão)
export interface ChaveMao {
  /** segundos desde o início */
  t: number;
  p: PontoMao;
  /** forma da mão a partir desta chave */
  forma?: Hand;
  /** easing do trecho que CHEGA nesta chave (padrão: inOutSine) */
  ease?: (k: number) => number;
}

export class Trajeto {
  vivo = true;
  t = 0;
  private repouso: Pt | null = null;
  private resolver!: () => void;
  /** resolve quando a última chave termina */
  feito = new Promise<void>((r) => (this.resolver = r));
  constructor(
    public a: Actor,
    public mao: 'N' | 'F',
    public chaves: ChaveMao[],
    public o: { mexe?: (t: number) => Pt; eventos?: { t: number; fn: () => void }[] } = {},
  ) {
    const h = a.handWorld(mao === 'N');
    this.repouso = { x: h.x - a.x, y: h.y - a.y };
  }

  private ponto(p: PontoMao): Pt {
    if (p === null) return { x: this.a.x + this.repouso!.x, y: this.a.y + this.repouso!.y };
    return typeof p === 'function' ? p() : p;
  }

  update(dt: number) {
    if (!this.vivo) return;
    const t0 = this.t;
    this.t += dt;
    for (const e of this.o.eventos ?? []) if (e.t > t0 && e.t <= this.t) e.fn();
    const ks = this.chaves, a = this.a, near = this.mao === 'N';
    const fim = ks[ks.length - 1].t;
    if (this.t >= fim) { this.encerrar(); return; }
    let i = 0;
    while (i < ks.length - 2 && this.t >= ks[i + 1].t) i++;
    const k0 = ks[i], k1 = ks[i + 1];
    const u = clamp((this.t - k0.t) / Math.max(1e-4, k1.t - k0.t), 0, 1);
    const e = (k1.ease ?? suave)(u);
    // trecho entre dois repousos: devolve o braço ao movimento-base
    if (k0.p === null && k1.p === null) {
      if (near) a.reachN = null; else a.reachF = null;
    } else {
      const p0 = this.ponto(k0.p), p1 = this.ponto(k1.p);
      const m = this.o.mexe?.(this.t) ?? { x: 0, y: 0 };
      const alvo = { x: lerp(p0.x, p1.x, e) + m.x, y: lerp(p0.y, p1.y, e) + m.y };
      if (near) a.reachN = alvo; else a.reachF = alvo;
    }
    let forma: Hand | undefined;
    for (const k of ks) if (k.t <= this.t && k.forma) forma = k.forma;
    if (forma) a.maoForma = { ...(a.maoForma ?? {}), [this.mao]: forma };
  }

  encerrar() {
    if (!this.vivo) return;
    if (this.mao === 'N') this.a.reachN = null; else this.a.reachF = null;
    if (this.a.maoForma) { delete this.a.maoForma[this.mao]; if (!this.a.maoForma.N && !this.a.maoForma.F) this.a.maoForma = null; }
    this.vivo = false;
    this.resolver();
  }
}

/**
 * Reação física com mola (cabeça vira, tronco recua, corpo é empurrado) — sincronizada com o impacto.
 * `dir` = sentido do golpe no mundo (+1 para a direita). Soma em Actor.impulso e some sozinha.
 */
export class Impacto {
  vivo = true;
  t = 0;
  constructor(public a: Actor, public dir: number, public forca = 1, public tipo: 'cabeca' | 'tronco' = 'cabeca') {}
  update(dt: number) {
    this.t += dt;
    // mola subamortecida: pico rápido, pequeno rebote, volta
    const k = Math.exp(-this.t * 6) * Math.sin(this.t * 17 + 0.35) * this.forca;
    // golpe vindo da frente do personagem empurra para trás (recuo) — no quadro dele, "para trás" é -facing
    const contra = this.dir * this.a.facing < 0 ? 1 : -1;
    const f = this.tipo === 'cabeca'
      ? { head: -0.55 * k * contra, neck: -0.25 * k * contra, lean: -0.12 * k * contra, x: -8 * k * contra }
      : { lean: -0.3 * k * contra, chest: -0.2 * k * contra, head: 0.15 * k * contra, x: -16 * k * contra };
    this.a.impulso = f;
    if (this.t > 1.1) { this.a.impulso = null; this.vivo = false; }
  }
}

function suave(k: number) {
  return 0.5 - Math.cos(Math.PI * k) / 2;
}
/** Easings de golpe: aceleração no ataque (inQuad), desaceleração no recolher (outQuad). */
export const golpe = (k: number) => k * k;
export const recolhe = (k: number) => 1 - (1 - k) * (1 - k);
export const salta = (k: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

/** Ponto a uma fração do alcance do braço, a partir do ombro, na direção `ang` (0 = frente do ator, +π/2 = para baixo). */
export function doOmbro(a: Actor, mao: 'N' | 'F', frac: number, ang: number): Pt {
  const sk = skeleton(a.d, a.pose, a.turn);
  const sh = localParaMundo(a, mao === 'N' ? sk.shoulderN : sk.shoulderF);
  const L = (a.d.upperArm + a.d.foreArm) * a.scale * frac;
  return { x: sh.x + Math.cos(ang) * L * a.facing, y: sh.y + Math.sin(ang) * L };
}

/** Distância horizontal que falta para o ombro de `a` alcançar `alvo` com o braço a `frac` do comprimento. */
export function faltaAlcance(a: Actor, alvo: Pt, frac = 0.85, mao: 'N' | 'F' = 'N') {
  const sk = skeleton(a.d, a.pose, a.turn);
  const sh = localParaMundo(a, mao === 'N' ? sk.shoulderN : sk.shoulderF);
  const L = (a.d.upperArm + a.d.foreArm) * a.scale * frac;
  const dy = alvo.y - sh.y;
  const dxQuer = Math.sqrt(Math.max(0, L * L - dy * dy));
  return (alvo.x - sh.x) * a.facing - dxQuer;
}
