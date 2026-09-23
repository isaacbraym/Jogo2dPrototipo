import { RC, TopSpec, TOP_SPECS } from './rc';
import { Pt, Limb, Hand } from './rig';
import { capsule, circle, ellipse, part, splineOpen, roundRect, starPath, heartPath } from '../render/draw';
import { mix, shade, rgba } from '../core/color';

const far = (c: string, k = 0.28) => mix(c, shade(c, -0.35), k);

// ---------------------------------------------------------------- tronco
export interface TorsoOpts {
  inf?: number;
  neck?: TopSpec['neck'] | 'skin';
  inset?: number;
  hem?: number;
  flare?: number;
  cropY?: number;
}

export function torsoGeom(rc: RC) {
  const d = rc.d, T = d.torso;
  return {
    T,
    yN: -T,
    yS: -T + 5,
    yA: -T + T * 0.27,
    yC: -T * 0.6,
    yW: -T * 0.33,
    yH: -T * 0.02,
    kR: 1 - 0.2 * rc.turn,
    kL: 1 - 0.1 * rc.turn,
    cx: rc.turn * d.shoulderW * 0.1,
  };
}

export function torsoPath(rc: RC, o: TorsoOpts = {}): Path2D {
  const d = rc.d;
  const g = torsoGeom(rc);
  const inf = o.inf ?? 0;
  const inset = o.inset ?? 0;
  const flare = o.flare ?? 0;
  const hem = o.cropY ?? o.hem ?? d.thighW * 0.42;
  const sw = d.shoulderW / 2, cw = d.chestW / 2, ww = d.waistW / 2, hw = d.hipW / 2;
  const nwBase = (d.neckW / 2) * 1.08 + inf;
  const neck = o.neck ?? 'crew';
  const spread = neck === 'scoop' ? 1.45 : neck === 'boat' ? 1.9 : neck === 'deepV' ? 1.3 : neck === 'v' ? 1.15 : 1;
  const nw = nwBase * spread;
  const depth = { crew: 6, v: 20, deepV: 36, scoop: 15, boat: 5, collar: 5, turtle: -4, hood: 6, skin: -2 }[neck];
  const yCrop = o.cropY;

  const side = (s: 1 | -1): Pt[] => {
    const k = s > 0 ? g.kR : g.kL;
    const bust = s > 0 ? d.bust * rc.turn * 7 : 0;
    const belly = s > 0 ? d.belly * rc.turn * 20 : 0;
    const pts: Pt[] = [];
    if (inset > 0) {
      pts.push({ x: s * (nw + (sw - nw) * inset * 0.5) * k, y: g.yN + 4 });
      pts.push({ x: s * (sw * 0.82 + inf) * k, y: g.yA + 6 });
    } else {
      pts.push({ x: s * (nw + (sw - nw) * 0.55) * k, y: g.yN + 3 + sw * 0.05 });
      pts.push({ x: s * (sw + inf) * k, y: g.yS + 10 });
      pts.push({ x: s * (sw * 0.95 + inf) * k, y: g.yA + 2 });
    }
    pts.push({ x: s * (cw + inf) * k + bust, y: g.yC });
    if (yCrop === undefined || yCrop > g.yW) pts.push({ x: s * (ww + inf) * k + belly, y: g.yW });
    if (yCrop === undefined || yCrop > g.yH) pts.push({ x: s * (hw + inf) * k + belly * 0.3, y: g.yH });
    const hemX = yCrop !== undefined && yCrop < g.yW ? (cw + (ww - cw) * ((yCrop - g.yC) / (g.yW - g.yC)) + inf) * k + bust * 0.5 + belly * 0.5 : (hw + inf + flare) * k;
    pts.push({ x: s * hemX, y: hem });
    return pts;
  };
  const R = side(1), L = side(-1);
  const p = new Path2D();
  const nL = { x: -nw * g.kL + g.cx * 0.5, y: g.yN }, nR = { x: nw * g.kR + g.cx * 0.5, y: g.yN };
  p.moveTo(nL.x, nL.y);
  if (neck === 'v' || neck === 'deepV') {
    p.lineTo(g.cx, g.yN + depth);
    p.lineTo(nR.x, nR.y);
  } else {
    p.quadraticCurveTo(g.cx, g.yN + depth * 2, nR.x, nR.y);
  }
  splineOpen(p, [nR, ...R], 1, false);
  const hr = R[R.length - 1], hl = L[L.length - 1];
  p.quadraticCurveTo(g.cx, hem + 4, hl.x, hl.y);
  splineOpen(p, [...L].reverse().concat([nL]), 1, false);
  p.closePath();
  void hr;
  return p;
}

// ---------------------------------------------------------------- membros
export function armPoints(rc: RC, sh: Pt, limb: Limb, near: boolean) {
  const d = rc.d;
  const splay = (0.1 + Math.max(0, d.hipW / 2 - d.shoulderW * 0.4) / 110 + d.belly * 0.08) * (1 - rc.turn * 0.8);
  const a = limb.a + (near ? -splay : splay);
  const e = { x: sh.x + Math.sin(a) * d.upperArm, y: sh.y + Math.cos(a) * d.upperArm };
  const fa = a + limb.b;
  const w = { x: e.x + Math.sin(fa) * d.foreArm, y: e.y + Math.cos(fa) * d.foreArm };
  return { e, w, fa, a };
}

export function legPoints(rc: RC, hip: Pt, limb: Limb, foot: number) {
  const d = rc.d;
  const k = { x: hip.x + Math.sin(limb.a) * d.thigh, y: hip.y + Math.cos(limb.a) * d.thigh };
  const sa = limb.a - limb.b;
  const an = { x: k.x + Math.sin(sa) * d.shin, y: k.y + Math.cos(sa) * d.shin };
  return { k, an, sa, fa: sa + foot };
}

function sleeveOf(rc: RC): number {
  const spec = TOP_SPECS[rc.ap.top];
  if (!spec) return 1;
  if (rc.ap.top === 'banho' && rc.ap.sex === 'm') return 0;
  return spec.sleeve;
}

export function drawArm(rc: RC, near: boolean) {
  const { ctx, d, pal } = rc;
  const limb = near ? rc.pose.armN : rc.pose.armF;
  const sh = near ? rc.shoulderN : rc.shoulderF;
  const { e, w, fa } = armPoints(rc, sh, limb, near);
  if (near) { rc.handN = w; rc.handAngN = fa; } else { rc.handF = w; rc.handAngF = fa; }
  const rS = d.armW / 2, rE = d.foreW / 2, rW = d.foreW * 0.36;
  const sleeve = sleeveOf(rc);
  const f = !near;
  const skin = f ? far(pal.skin) : pal.skin;
  const lw = rc.lw;
  // pele
  if (sleeve < 2) {
    const p = new Path2D();
    capsule(p, sh.x, sh.y, rS * 0.95, e.x, e.y, rE);
    capsule(p, e.x, e.y, rE, w.x, w.y, rW);
    part(ctx, p, skin, pal.skinSh, pal.skinLine, lw, rc.shS);
    if (d.fem < 0.5 && rc.ap.muscle > 0.55 && sleeve === 0) {
      ctx.strokeStyle = rgba(pal.skinLine, 0.25);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc((sh.x + e.x) / 2 + 2, (sh.y + e.y) / 2, rS * 0.6, -0.8, 0.8);
      ctx.stroke();
    }
  }
  // tatuagem (braço próximo, visível sem manga longa)
  if (near && sleeve < 2 && rc.ap.tattoo && rc.ap.tattoo !== 'nenhuma' && d.age >= 16) {
    const k = 0.74;
    const tx = sh.x + (e.x - sh.x) * k, ty = sh.y + (e.y - sh.y) * k;
    const ua = Math.atan2(e.x - sh.x, e.y - sh.y);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-ua);
    const s = rS * 0.55;
    ctx.fillStyle = rgba('#1f3350', 0.75);
    ctx.strokeStyle = rgba('#1f3350', 0.8);
    ctx.lineWidth = 1.1;
    const tp = new Path2D();
    switch (rc.ap.tattoo) {
      case 'coracao': heartPath(tp, 0, 0, s * 0.9); ctx.fillStyle = rgba('#b8263f', 0.8); ctx.fill(tp); ctx.stroke(tp); break;
      case 'estrela': starPath(tp, 0, 0, s, s * 0.45); ctx.stroke(tp); break;
      case 'ancora':
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, -s * 0.5);
        ctx.moveTo(-s * 0.8, s * 0.3); ctx.quadraticCurveTo(0, s * 1.5, s * 0.8, s * 0.3); ctx.stroke(); break;
      case 'tribal':
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) { ctx.moveTo(-s, i * s * 0.6); ctx.quadraticCurveTo(0, i * s * 0.6 - s * 0.5, s, i * s * 0.6); }
        ctx.lineWidth = 1.8; ctx.stroke(); break;
      default:
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ellipse(tp, Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.35, s * 0.2, a); }
        ctx.fillStyle = rgba('#b5446e', 0.75); ctx.fill(tp);
    }
    ctx.restore();
  }
  const spec = TOP_SPECS[rc.ap.top] ?? TOP_SPECS.camiseta;
  const topCol = spec.open ? (rc.ap.top === 'jaleco' ? pal.white : pal.top) : topColorOf(rc);
  const topSh = spec.open ? (rc.ap.top === 'jaleco' ? pal.whiteSh : pal.topSh) : shade(topCol, -0.2);
  const topLine = spec.open ? (rc.ap.top === 'jaleco' ? pal.whiteLine : pal.topLine) : shade(topCol, -0.55);
  const cCol = f ? far(topCol) : topCol;
  if (sleeve === 1) {
    const m = 0.55;
    const px = sh.x + (e.x - sh.x) * m, py = sh.y + (e.y - sh.y) * m;
    const p = new Path2D();
    capsule(p, sh.x, sh.y - 1, rS + 2.2, px, py, rS + 0.9);
    part(ctx, p, cCol, topSh, topLine, lw, rc.shS);
    // bainha
    ctx.strokeStyle = rgba(topLine, 0.45);
    ctx.lineWidth = 1.3;
    const ang = Math.atan2(py - sh.y, px - sh.x);
    ctx.beginPath();
    ctx.arc(px, py, rS + 1.5, ang - 1.2, ang + 1.2);
    ctx.stroke();
  } else if (sleeve >= 2) {
    const wide = sleeve === 3 ? 5 : 0;
    const p = new Path2D();
    capsule(p, sh.x, sh.y - 1, rS + 3, e.x, e.y, rE + 2.4 + wide * 0.5);
    capsule(p, e.x, e.y, rE + 2.4 + wide * 0.5, w.x, w.y, rW + 3 + wide);
    part(ctx, p, cCol, topSh, topLine, lw, rc.shS);
    // punho
    const cuff = new Path2D();
    const cx = w.x - Math.sin(fa) * 5, cy = w.y - Math.cos(fa) * 5;
    capsule(cuff, cx, cy, rW + 3.2 + wide, w.x, w.y, rW + 3 + wide);
    const cuffCol = rc.ap.top === 'blazer' || rc.ap.top === 'smoking' ? pal.white : rc.ap.top === 'sueter' || rc.ap.top === 'moletom' ? shade(cCol, -0.08) : cCol;
    part(ctx, cuff, cuffCol, null, topLine, lw * 0.7, null);
    // dobra do cotovelo
    ctx.strokeStyle = rgba(topLine, 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(e.x - 4, e.y - 2);
    ctx.quadraticCurveTo(e.x, e.y + 2, e.x + 4, e.y - 1);
    ctx.stroke();
  }
  drawHand(rc, w, fa, near ? rc.pose.handN : rc.pose.handF, f);
}

export function drawHand(rc: RC, w: Pt, ang: number, hand: Hand, isFar: boolean) {
  const { ctx, pal, d } = rc;
  const r = d.handR;
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(-ang);
  const skin = isFar ? far(pal.skin) : pal.skin;
  const p = new Path2D();
  if (hand === 'punho' || hand === 'segura' || hand === 'aponta' || hand === 'joinha') {
    ellipse(p, 0, r * 0.95, r * 0.95, r * 1.02);
    if (hand === 'aponta') capsule(p, 0.5, r * 1.4, r * 0.3, 1, r * 2.7, r * 0.26);
    if (hand === 'joinha') capsule(p, r * 0.6, r * 0.8, r * 0.33, r * 1.45, r * 0.3, r * 0.3);
  } else if (hand === 'acena') {
    ellipse(p, 0, r * 1.05, r * 0.9, r * 1.0);
    for (let i = 0; i < 4; i++) {
      const aa = -0.45 + i * 0.3;
      capsule(p, Math.sin(aa) * r * 0.5, r * 1.3, r * 0.25, Math.sin(aa) * r * 1.5, r * 1.1 + Math.cos(aa) * r * 1.3, r * 0.22);
    }
    capsule(p, r * 0.6, r * 0.7, r * 0.3, r * 1.45, r * 0.5, r * 0.26);
  } else {
    ellipse(p, 0, r * 1.15, r * 0.82, r * 1.18);
    capsule(p, r * 0.45, r * 0.55, r * 0.34, r * 0.95, r * 1.35, r * 0.28);
  }
  part(ctx, p, skin, pal.skinSh, pal.skinLine, rc.lw * 0.85, { x: -rc.shS.x * 0.5, y: rc.shS.y * 0.5 });
  if (hand === 'aberta') {
    ctx.strokeStyle = rgba(pal.skinLine, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, r * 1.6);
    ctx.lineTo(-r * 0.25, r * 2.15);
    ctx.moveTo(r * 0.15, r * 1.65);
    ctx.lineTo(r * 0.15, r * 2.2);
    ctx.stroke();
  } else if (hand === 'punho' || hand === 'segura') {
    ctx.strokeStyle = rgba(pal.skinLine, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r * 0.1, r * 1.0, r * 0.55, -0.4, 1.4);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- pernas e calçados
type Cover = { col: string; sh: string; line: string; to: number; kind: string };

function bottomCover(rc: RC): Cover | null {
  const ap = rc.ap, pal = rc.pal;
  const spec = TOP_SPECS[ap.top];
  let kind = spec?.forceBottom ?? ap.bottom;
  let col = spec?.forceBottomColor ?? pal.bottom;
  if (ap.top === 'pijama' || ap.top === 'body') col = pal.top;
  if (ap.top === 'smoking') col = '#1b1c22';
  if (ap.top === 'banho' && kind === 'sunga') col = ap.sex === 'm' ? pal.top : pal.top;
  const sh = shade(col, -0.22), line = shade(col, -0.58);
  switch (kind) {
    case 'jeans': case 'calca': case 'moletom': case 'legging': return { col, sh, line, to: 1, kind };
    case 'bermuda': return { col, sh, line, to: 0.62, kind };
    case 'sunga': return { col, sh, line, to: ap.sex === 'm' ? 0.3 : 0.08, kind };
    case 'fralda': return { col: '#f4f4f0', sh: '#d8d8d2', line: '#8a8a86', to: 0.12, kind };
    case 'saia': case 'saiaLonga': return { col, sh, line, to: 0.1, kind };
    default: return { col, sh, line, to: 1, kind };
  }
}

export function drawLeg(rc: RC, near: boolean) {
  const { ctx, d, pal } = rc;
  const limb = near ? rc.pose.legN : rc.pose.legF;
  const hip = near ? rc.hipN : rc.hipF;
  const { k, an, sa, fa } = legPoints(rc, hip, limb, near ? rc.pose.footN : rc.pose.footF);
  const rH = d.thighW / 2, rK = d.calfW * 0.5, rA = d.calfW * 0.33;
  const f = !near;
  const cov = bottomCover(rc);
  const spec = TOP_SPECS[rc.ap.top];
  const legTotal = d.thigh + d.shin;
  const to = cov ? cov.to : 0;
  if (to < 1) {
    const p = new Path2D();
    capsule(p, hip.x, hip.y, rH * 0.95, k.x, k.y, rK);
    capsule(p, k.x, k.y, rK, an.x, an.y, rA);
    const skin = f ? far(rc.pal.skin) : rc.pal.skin;
    const legwear = rc.ap.bottom === 'saia' && rc.d.fem > 0.5 && !spec?.dress ? null : null;
    void legwear;
    part(ctx, p, skin, pal.skinSh, pal.skinLine, rc.lw, rc.shS);
    // joelho
    ctx.strokeStyle = rgba(pal.skinLine, 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(k.x + 2, k.y, rK * 0.5, -1, 1);
    ctx.stroke();
  }
  if (cov && to > 0) {
    const col = f ? far(cov.col) : cov.col;
    const baggy = cov.kind === 'moletom' ? 2.5 : cov.kind === 'legging' ? -1 : cov.kind === 'calca' ? 1.5 : 0.8;
    const p = new Path2D();
    const L = to * legTotal;
    if (L <= d.thigh) {
      const t = L / d.thigh;
      const px = hip.x + (k.x - hip.x) * t, py = hip.y + (k.y - hip.y) * t;
      capsule(p, hip.x, hip.y - 4, rH + baggy + 1, px, py, rH * (1 - t * 0.2) + baggy + 1);
    } else {
      capsule(p, hip.x, hip.y - 4, rH + baggy + 1, k.x, k.y, rK + baggy + 1.2);
      const t = Math.min(1, (L - d.thigh) / d.shin);
      const px = k.x + (an.x - k.x) * t, py = k.y + (an.y - k.y) * t;
      const flare = cov.kind === 'calca' || cov.kind === 'jeans' ? 1.5 : 0;
      capsule(p, k.x, k.y, rK + baggy + 1.2, px, py, (rK + (rA - rK) * t) + baggy + 1.6 + flare);
    }
    if (near) {
      // parte superior da calça une as duas pernas
      const g = torsoGeom(rc);
      const ww = d.waistW / 2, hw = d.hipW / 2;
      const top = new Path2D();
      const yb = g.yW * 0.8;
      top.moveTo(-ww * g.kL, yb);
      top.lineTo(ww * g.kR + d.belly * rc.turn * 14, yb);
      top.quadraticCurveTo(hw * g.kR + 2, g.yH - 6, hw * g.kR, 6);
      top.quadraticCurveTo(hw * 0.4, d.thighW * 0.7, 0, d.thighW * 0.55);
      top.quadraticCurveTo(-hw * 0.4, d.thighW * 0.7, -hw * g.kL, 6);
      top.quadraticCurveTo(-hw * g.kL - 2, g.yH - 6, -ww * g.kL, yb);
      top.closePath();
      if (cov.kind !== 'saia' && cov.kind !== 'saiaLonga') p.addPath(top);
    }
    const pg = ctx.createLinearGradient(0, -rc.d.torso * 0.3, 0, rc.d.thigh + rc.d.shin);
    pg.addColorStop(0, shade(col, 0.06));
    pg.addColorStop(1, shade(col, -0.1));
    part(ctx, p, pg, cov.sh, cov.line, rc.lw, rc.shS);
    // detalhes
    ctx.strokeStyle = rgba(cov.line, 0.3);
    ctx.lineWidth = 1.1;
    if (cov.kind === 'jeans' && to >= 1) {
      ctx.setLineDash([2.5, 2.5]);
      ctx.strokeStyle = rgba('#e8c46a', 0.55);
      ctx.beginPath();
      ctx.moveTo(hip.x + rH * 0.55, hip.y + 4);
      ctx.lineTo(k.x + rK * 0.6, k.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // barra
      ctx.strokeStyle = rgba(shade(cov.col, 0.25), 0.8);
      ctx.lineWidth = 2;
      const bx = an.x - Math.sin(sa) * 4, by = an.y - Math.cos(sa) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - (rA + 3) * Math.cos(sa), by + (rA + 3) * Math.sin(sa));
      ctx.lineTo(bx + (rA + 3) * Math.cos(sa), by - (rA + 3) * Math.sin(sa));
      ctx.stroke();
    } else if (cov.kind === 'calca') {
      ctx.beginPath();
      ctx.moveTo(hip.x + 2, hip.y + 8);
      ctx.lineTo(k.x + 2, k.y);
      ctx.lineTo(an.x + 1, an.y - 4);
      ctx.stroke();
    } else if (cov.kind === 'moletom' && to >= 1) {
      const p2 = new Path2D();
      const bx = an.x - Math.sin(sa) * 5, by = an.y - Math.cos(sa) * 5;
      capsule(p2, bx, by, rA + 3.5, an.x, an.y, rA + 3.2);
      part(ctx, p2, shade(col, -0.06), null, cov.line, rc.lw * 0.7, null);
    }
  }
  drawShoe(rc, an, fa, sa, f, to);
}

export function drawShoe(rc: RC, an: Pt, fa: number, sa: number, isFar: boolean, cover: number) {
  const { ctx, d, pal } = rc;
  const style = rc.ap.shoes;
  const L = d.footL * (0.5 + 0.5 * rc.turn);
  const h = d.footH;
  ctx.save();
  ctx.translate(an.x + Math.sin(sa) * d.ankle * 0.5, an.y + Math.cos(sa) * d.ankle * 0.5);
  ctx.rotate(-fa);
  const col = isFar ? far(pal.shoe) : pal.shoe;
  const heel = -L * 0.32;
  if (style === 'descalco' || style === 'sandalia') {
    const p = new Path2D();
    p.moveTo(heel, -h * 0.6);
    p.quadraticCurveTo(heel - 4, h * 0.5, heel + 4, h * 0.55);
    p.lineTo(L * 0.85, h * 0.55);
    p.quadraticCurveTo(L * 1.05, h * 0.5, L * 0.9, -h * 0.05);
    p.quadraticCurveTo(L * 0.5, -h * 0.35, L * 0.1, -h * 0.9);
    p.closePath();
    const skin = isFar ? far(pal.skin) : pal.skin;
    part(ctx, p, skin, pal.skinSh, pal.skinLine, rc.lw * 0.85, null);
    if (style === 'sandalia') {
      ctx.fillStyle = shade(col, -0.1);
      ctx.fillRect(heel - 2, h * 0.45, L * 1.3, 3.2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L * 0.25, -h * 0.4);
      ctx.lineTo(L * 0.55, h * 0.4);
      ctx.moveTo(L * 0.05, -h * 0.6);
      ctx.lineTo(heel, h * 0.1);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const p = new Path2D();
  if (style === 'botas') {
    p.moveTo(heel, -h * 2.3);
    p.lineTo(L * 0.25, -h * 2.3);
    p.quadraticCurveTo(L * 0.3, -h * 0.6, L * 0.6, -h * 0.5);
    p.quadraticCurveTo(L * 1.1, -h * 0.3, L * 1.02, h * 0.55);
    p.lineTo(heel - 2, h * 0.55);
    p.closePath();
  } else if (style === 'salto') {
    p.moveTo(heel + 2, -h * 0.8);
    p.quadraticCurveTo(L * 0.4, -h * 0.5, L * 1.1, h * 0.35);
    p.lineTo(L * 0.4, h * 0.45);
    p.quadraticCurveTo(heel + 6, -h * 0.2, heel + 3, h * 0.2);
    p.lineTo(heel + 1, h * 0.9);
    p.lineTo(heel - 2, h * 0.9);
    p.lineTo(heel - 3, -h * 0.2);
    p.closePath();
  } else {
    const toeUp = style === 'tenis' ? 0.45 : 0.35;
    p.moveTo(heel, -h * 0.75);
    p.quadraticCurveTo(L * 0.3, -h * 0.8, L * 0.62, -h * toeUp);
    p.quadraticCurveTo(L * 1.08, -h * 0.25, L * 1.02, h * 0.55);
    p.lineTo(heel - 1, h * 0.55);
    p.quadraticCurveTo(heel - 5, 0, heel, -h * 0.75);
    p.closePath();
  }
  const shine = style === 'social' ? shade(col, 0.15) : col;
  part(ctx, p, shine, pal.shoeSh, pal.shoeLine, rc.lw * 0.9, { x: 0, y: -2 });
  if (style === 'tenis') {
    ctx.fillStyle = '#fbfaf7';
    ctx.strokeStyle = pal.shoeLine;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(heel - 1, h * 0.12);
    ctx.lineTo(L * 1.05, h * 0.12);
    ctx.lineTo(L * 1.02, h * 0.6);
    ctx.lineTo(heel - 1, h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.shoeLine, 0.6);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(L * (0.2 + i * 0.13), -h * 0.62 + i * 1.2);
      ctx.lineTo(L * (0.28 + i * 0.13), -h * 0.35 + i * 1.2);
    }
    ctx.stroke();
  } else if (style === 'social') {
    ctx.fillStyle = rgba('#ffffff', 0.45);
    ctx.beginPath();
    ctx.ellipse(L * 0.62, -h * 0.25, L * 0.18, h * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(col, -0.45);
    ctx.fillRect(heel - 1, h * 0.35, L * 1.3, h * 0.25);
  } else if (style === 'botas') {
    ctx.fillStyle = shade(col, -0.4);
    ctx.fillRect(heel - 2, h * 0.3, L * 1.3, h * 0.3);
    ctx.strokeStyle = rgba(pal.shoeLine, 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(heel, -h * 1.9);
    ctx.lineTo(L * 0.22, -h * 1.9);
    ctx.stroke();
  }
  ctx.restore();
  void cover;
}

// ---------------------------------------------------------------- tronco nu / roupas
export function topColorOf(rc: RC): string {
  const t = rc.ap.top;
  if (t === 'jaleco') return rc.pal.top;
  if (t === 'camisola') return '#a9cfe6';
  if (t === 'presidiario') return '#f07a1e';
  if (t === 'beca') return '#1d1f2a';
  if (t === 'noiva') return '#fbf8f2';
  if (t === 'smoking') return '#1b1c22';
  if (t === 'chef') return '#f7f5f0';
  if (t === 'policial') return '#2c4a7a';
  return rc.pal.top;
}

export function drawTorsoSkin(rc: RC) {
  const { ctx, pal } = rc;
  const p = torsoPath(rc, { neck: 'skin' });
  part(ctx, p, pal.skin, pal.skinSh, pal.skinLine, rc.lw, rc.sh);
  // anatomia sutil (visível sem camiseta)
  const g = torsoGeom(rc);
  const d = rc.d;
  ctx.strokeStyle = rgba(pal.skinLine, 0.25);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (d.fem < 0.5 && d.age > 12) {
    ctx.moveTo(g.cx - d.chestW * 0.3, g.yC + 4);
    ctx.quadraticCurveTo(g.cx - d.chestW * 0.12, g.yC + 10, g.cx - 2, g.yC + 2);
    ctx.moveTo(g.cx + d.chestW * 0.3, g.yC + 4);
    ctx.quadraticCurveTo(g.cx + d.chestW * 0.12, g.yC + 10, g.cx + 2, g.yC + 2);
  }
  ctx.moveTo(g.cx + 1, g.yW + 4);
  ctx.arc(g.cx + 1, g.yW + 6, 1.6, 0, Math.PI * 2);
  ctx.stroke();
}

export function drawNeck(rc: RC) {
  const { ctx, pal, d } = rc;
  const n = rc.neck;
  const h = rc.head;
  const p = new Path2D();
  const r = d.neckW / 2;
  capsule(p, n.x, n.y + 4, r * 1.02, h.x + (h.x - n.x) * 0.1, h.y + d.headH * 0.2, r * 0.95);
  part(ctx, p, pal.skin, pal.skinSh, pal.skinLine, rc.lw, rc.shS);
  // sombra do queixo
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = rgba(pal.skinSh2, 0.55);
  ctx.beginPath();
  ctx.ellipse(h.x + rc.turn * 4, h.y + d.headH * 0.42, d.headW * 0.36, d.headH * 0.18, rc.headAng, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function patternFill(rc: RC, path: Path2D, base: string) {
  const { ctx, ap, pal } = rc;
  const pat = ap.topPattern;
  if (pat === 'liso') return;
  const c2 = pal.top2;
  const g = torsoGeom(rc);
  ctx.save();
  ctx.clip(path);
  const x0 = -rc.d.shoulderW, x1 = rc.d.shoulderW, y0 = g.yN - 10, y1 = rc.d.thighW + 10;
  if (pat === 'listras') {
    ctx.fillStyle = rgba(c2, 0.85);
    for (let y = y0; y < y1; y += 13) ctx.fillRect(x0, y, x1 - x0, 5.5);
  } else if (pat === 'bolinhas') {
    ctx.fillStyle = rgba(c2, 0.9);
    for (let y = y0, row = 0; y < y1; y += 11, row++)
      for (let x = x0 + (row % 2) * 6; x < x1; x += 12) {
        ctx.beginPath();
        ctx.arc(x, y, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
  } else if (pat === 'xadrez') {
    ctx.fillStyle = rgba(c2, 0.32);
    for (let y = y0; y < y1; y += 16) ctx.fillRect(x0, y, x1 - x0, 7);
    for (let x = x0; x < x1; x += 16) ctx.fillRect(x, y0, 7, y1 - y0);
    ctx.fillStyle = rgba(shade(base, -0.5), 0.18);
    for (let y = y0 + 11; y < y1; y += 16) ctx.fillRect(x0, y, x1 - x0, 1.5);
  } else if (pat === 'estampa') {
    const cx = g.cx * 1.4, cy = g.yC + 6;
    const s = rc.d.chestW * 0.2;
    const sp = new Path2D();
    const kind = (rc.seed >> 3) % 3;
    if (kind === 0) starPath(sp, cx, cy, s, s * 0.45);
    else if (kind === 1) heartPath(sp, cx, cy + s * 0.2, s * 0.95);
    else circle(sp, cx, cy, s * 0.8);
    ctx.fillStyle = c2;
    ctx.fill(sp);
    ctx.strokeStyle = rgba(shade(c2, -0.5), 0.6);
    ctx.lineWidth = 1.4;
    ctx.stroke(sp);
    if (kind === 2) {
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Parte superior da roupa (no quadro do tronco). */
export function drawTop(rc: RC) {
  const { ctx, ap, pal, d } = rc;
  const spec = TOP_SPECS[ap.top] ?? TOP_SPECS.camiseta;
  if (ap.top === 'banho' && ap.sex === 'm' && d.age >= 3) return;
  const g = torsoGeom(rc);
  const col = topColorOf(rc);
  const sh = shade(col, -0.2), line = shade(col, -0.56);
  const hemY = spec.len < 0 ? g.yW + spec.len * g.T * 0.4 + g.T * 0.05 : g.yH + spec.len * g.T + 6;

  if (spec.open) {
    // camada interna
    const innerCol = spec.open === 'blazer' ? (ap.top === 'smoking' ? '#fbfaf6' : pal.white) : spec.open === 'coat' ? pal.top : pal.top2;
    const inner = torsoPath(rc, { inf: 1, neck: spec.open === 'blazer' ? 'collar' : 'crew', hem: g.yH + 8 });
    part(ctx, inner, innerCol, shade(innerCol, -0.18), shade(innerCol, -0.55), rc.lw, rc.sh);
    if (spec.open === 'blazer') {
      // gravata
      const tieCol = ap.top === 'smoking' ? '#15151a' : pal.top2;
      const tp = new Path2D();
      if (ap.top === 'smoking') {
        tp.moveTo(g.cx - 9, g.yN + 2); tp.lineTo(g.cx, g.yN + 6); tp.lineTo(g.cx + 9, g.yN + 2); tp.lineTo(g.cx + 9, g.yN + 11); tp.lineTo(g.cx, g.yN + 7); tp.lineTo(g.cx - 9, g.yN + 11); tp.closePath();
      } else {
        tp.moveTo(g.cx - 3.5, g.yN + 3); tp.lineTo(g.cx + 3.5, g.yN + 3); tp.lineTo(g.cx + 2.5, g.yN + 8);
        tp.lineTo(g.cx + 6, g.yW + 6); tp.lineTo(g.cx, g.yW + 13); tp.lineTo(g.cx - 6, g.yW + 6); tp.lineTo(g.cx - 2.5, g.yN + 8); tp.closePath();
      }
      part(ctx, tp, tieCol, shade(tieCol, -0.25), shade(tieCol, -0.6), rc.lw * 0.7, null);
    }
    // jaqueta aberta: dois painéis
    const outerCol = spec.open === 'coat' ? pal.white : col;
    const oSh = spec.open === 'coat' ? pal.whiteSh : sh, oLine = spec.open === 'coat' ? pal.whiteLine : line;
    const full = torsoPath(rc, { inf: 2.5, neck: 'deepV', hem: hemY, flare: spec.open === 'coat' ? 6 : 2 });
    ctx.save();
    const gap = spec.open === 'blazer' ? 0 : 1;
    const cut = new Path2D();
    const openW = spec.open === 'blazer' ? 7 : 11;
    cut.rect(-400, -400, 800, 800);
    cut.moveTo(g.cx - openW * gap, g.yN - 5);
    cut.lineTo(g.cx + openW * gap + 0.01, g.yN - 5);
    cut.lineTo(g.cx + openW * (gap + 0.3), hemY + 20);
    cut.lineTo(g.cx - openW * (gap + 0.3), hemY + 20);
    cut.closePath();
    ctx.clip(cut, 'evenodd');
    part(ctx, full, outerCol, oSh, oLine, rc.lw, rc.sh);
    ctx.restore();
    // lapelas
    ctx.strokeStyle = rgba(oLine, 0.7);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(g.cx - 12, g.yN + 1); ctx.lineTo(g.cx - 16, g.yC + 2); ctx.lineTo(g.cx - 3, g.yW);
    ctx.moveTo(g.cx + 12, g.yN + 1); ctx.lineTo(g.cx + 16, g.yC + 2); ctx.lineTo(g.cx + 3, g.yW);
    ctx.stroke();
    if (spec.open === 'jacket') {
      ctx.strokeStyle = rgba('#d8d8d8', 0.8);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(g.cx - openW - 1, g.yC); ctx.lineTo(g.cx - openW - 3, hemY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (spec.open === 'coat') {
      ctx.fillStyle = rgba(oLine, 0.25);
      roundRect(ctx, g.cx - d.chestW * 0.42, g.yC - 2, 12, 10, 2);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, g.cx + d.chestW * 0.2, g.yW + 14, 14, 14, 2);
      ctx.fill();
    }
    if (spec.open === 'blazer') {
      ctx.fillStyle = shade(col, -0.35);
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(g.cx + openW + 3, g.yW + 6 + i * 11, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(line, 0.5);
      ctx.beginPath();
      ctx.moveTo(g.cx - d.chestW * 0.4, g.yC + 2);
      ctx.lineTo(g.cx - d.chestW * 0.2, g.yC + 2);
      ctx.stroke();
    }
    return;
  }

  const neck = spec.neck;
  const path = torsoPath(rc, { inf: 1.5, neck, inset: spec.inset, hem: hemY, cropY: spec.len < 0 ? hemY : undefined, flare: 1 });
  const cg = ctx.createLinearGradient(0, g.yN, 0, hemY);
  cg.addColorStop(0, shade(col, 0.1));
  cg.addColorStop(0.5, col);
  cg.addColorStop(1, shade(col, -0.08));
  part(ctx, path, cg, sh, line, rc.lw, rc.sh);
  patternFill(rc, path, col);
  if (ap.top === 'camisola') {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = rgba('#ffffff', 0.55);
    for (let y = g.yN; y < hemY; y += 12) for (let x = -60; x < 60; x += 12) {
      ctx.beginPath(); ctx.arc(x + ((y / 12) % 2) * 6, y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  // busto: sombra sutil
  if (d.bust > 0.15) {
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = rgba(line, 0.28 * d.bust + 0.08);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const bw = d.chestW * 0.2;
    const by = g.yC + 5 + d.bust * 4;
    if (rc.turn < 0.6) {
      ctx.moveTo(g.cx - bw * 2, by - 2);
      ctx.quadraticCurveTo(g.cx - bw, by + 6, g.cx - 1, by);
    }
    ctx.moveTo(g.cx + 1, by);
    ctx.quadraticCurveTo(g.cx + bw, by + 6, g.cx + bw * 2 + rc.turn * 6, by - 2);
    ctx.stroke();
    ctx.restore();
  }
  // detalhes por peça
  ctx.strokeStyle = rgba(line, 0.5);
  ctx.lineWidth = 1.3;
  if (ap.top === 'camisa' || ap.top === 'polo' || ap.top === 'uniforme' || ap.top === 'pijama' || ap.top === 'policial') {
    // gola
    const cw = d.neckW * 0.62;
    const cp = new Path2D();
    cp.moveTo(g.cx, g.yN + 9);
    cp.lineTo(g.cx - cw, g.yN - 2);
    cp.lineTo(g.cx - cw - 3, g.yN + 9);
    cp.lineTo(g.cx - 3, g.yN + 13);
    cp.closePath();
    cp.moveTo(g.cx, g.yN + 9);
    cp.lineTo(g.cx + cw, g.yN - 2);
    cp.lineTo(g.cx + cw + 3, g.yN + 9);
    cp.lineTo(g.cx + 3, g.yN + 13);
    cp.closePath();
    const collarCol = ap.top === 'uniforme' ? pal.top2 : col;
    part(ctx, cp, shade(collarCol, 0.08), null, line, rc.lw * 0.7, null);
    ctx.fillStyle = shade(col, -0.4);
    const nb = ap.top === 'polo' || ap.top === 'uniforme' ? 2 : 5;
    for (let i = 0; i < nb; i++) {
      ctx.beginPath();
      ctx.arc(g.cx + 0.5, g.yN + 18 + i * ((g.yH - g.yN - 20) / 5), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(g.cx + 3, g.yN + 13);
    ctx.lineTo(g.cx + 3, ap.top === 'polo' || ap.top === 'uniforme' ? g.yN + 34 : hemY);
    ctx.stroke();
    if (ap.top === 'camisa') {
      ctx.strokeRect(g.cx - d.chestW * 0.36, g.yC - 3, 11, 12);
    }
    if (ap.top === 'policial') {
      const bp = new Path2D();
      starPath(bp, g.cx - d.chestW * 0.3, g.yC + 2, 6, 3, 6);
      part(ctx, bp, '#f2c14e', null, '#8a6a1a', 0.8, null);
    }
  } else if (ap.top === 'moletom') {
    // bolso canguru + cordões
    ctx.beginPath();
    ctx.moveTo(g.cx - d.waistW * 0.3, hemY - 4);
    ctx.lineTo(g.cx - d.waistW * 0.22, g.yW + 4);
    ctx.lineTo(g.cx + d.waistW * 0.22, g.yW + 4);
    ctx.lineTo(g.cx + d.waistW * 0.3, hemY - 4);
    ctx.stroke();
    ctx.strokeStyle = pal.top2;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(g.cx - 5, g.yN + 6); ctx.lineTo(g.cx - 6, g.yN + 26);
    ctx.moveTo(g.cx + 5, g.yN + 6); ctx.lineTo(g.cx + 6, g.yN + 24);
    ctx.stroke();
    ctx.fillStyle = shade(col, -0.1);
    ctx.fillRect(-d.hipW / 2, hemY - 6, d.hipW, 0);
  } else if (ap.top === 'sueter') {
    ctx.strokeStyle = rgba(line, 0.3);
    for (let x = -d.hipW / 2; x < d.hipW / 2; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, hemY - 7);
      ctx.lineTo(x, hemY);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(pal.top2, 0.9);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-d.chestW * 0.5, g.yC + 10);
    ctx.lineTo(d.chestW * 0.5, g.yC + 10);
    ctx.stroke();
  } else if (ap.top === 'beca') {
    ctx.beginPath();
    ctx.moveTo(g.cx - 4, g.yN + 18); ctx.lineTo(g.cx - 8, hemY);
    ctx.moveTo(g.cx + 4, g.yN + 18); ctx.lineTo(g.cx + 8, hemY);
    ctx.stroke();
  } else if (ap.top === 'chef') {
    ctx.fillStyle = '#9a9a9a';
    for (let i = 0; i < 3; i++) for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.arc(g.cx + s * 8, g.yN + 16 + i * 14, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (ap.top === 'presidiario') {
    ctx.fillStyle = '#23242b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(1000 + (rc.seed % 9000)), g.cx + d.chestW * 0.18, g.yC + 4);
  }
  // gola alta / capuz
  if (neck === 'turtle') {
    const tp = new Path2D();
    capsule(tp, rc.neck.x * 0, g.yN - 1, d.neckW * 0.58, 0, g.yN - rc.d.neckLen * 0.6, d.neckW * 0.54);
    part(ctx, tp, col, sh, line, rc.lw, null);
  }
  if (spec.dress) drawDressSkirt(rc, col, sh, line, spec);
}

export function drawHood(rc: RC) {
  if (rc.ap.top !== 'moletom') return;
  const { ctx } = rc;
  const g = torsoGeom(rc);
  const col = topColorOf(rc);
  const p = new Path2D();
  p.moveTo(-rc.d.neckW * 1.1, g.yN + 6);
  p.quadraticCurveTo(-rc.d.neckW * 1.3 - rc.turn * 8, g.yN - 18, -rc.turn * 10, g.yN - 16);
  p.quadraticCurveTo(rc.d.neckW * 1.3, g.yN - 16, rc.d.neckW * 1.1, g.yN + 6);
  p.closePath();
  part(ctx, p, shade(col, -0.1), shade(col, -0.25), shade(col, -0.56), rc.lw, rc.shS);
}

/** Saia do vestido / jaleco / beca (quadro da pelve, oscila com as pernas). */
export function drawDressSkirt(rc: RC, col: string, sh: string, line: string, spec: TopSpec) {
  const { ctx, d, pose } = rc;
  const g = torsoGeom(rc);
  // desfaz rotação do tronco para a saia pender
  ctx.save();
  ctx.rotate(-rc.lean);
  const len = (d.thigh + d.shin) * (spec.dress ?? 0.5);
  const top = g.yW + 4;
  const ww = (d.waistW / 2 + 2);
  const hw = d.hipW / 2 + 4 + (spec.flare ?? 0.3) * len * 0.35;
  const swing = (Math.sin(pose.legN.a) + Math.sin(pose.legF.a)) * 0.5 * len * 0.5;
  const spread = Math.abs(Math.sin(pose.legN.a) - Math.sin(pose.legF.a)) * len * 0.3;
  const y1 = top + len;
  const p = new Path2D();
  p.moveTo(-ww * g.kL, top);
  p.lineTo(ww * g.kR, top);
  p.bezierCurveTo(ww + 8, top + len * 0.3, hw + spread + swing, y1 - len * 0.2, hw + spread + swing, y1);
  const n = 5;
  for (let i = 1; i <= n; i++) {
    const x = hw + spread + swing - ((2 * (hw + spread)) * i) / n;
    p.quadraticCurveTo(x + (hw * 2) / n / 2, y1 + 5, x, y1);
  }
  p.bezierCurveTo(-hw - spread + swing, y1 - len * 0.2, -ww - 8, top + len * 0.3, -ww * g.kL, top);
  p.closePath();
  part(ctx, p, col, sh, line, rc.lw, rc.sh);
  ctx.strokeStyle = rgba(line, 0.28);
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(i * ww * 0.5, top + 8);
    ctx.quadraticCurveTo(i * hw * 0.55 + swing * 0.4, top + len * 0.6, i * hw * 0.65 + swing, y1 - 2);
  }
  ctx.stroke();
  if (rc.ap.top === 'noiva') {
    ctx.fillStyle = rgba('#ffffff', 0.5);
    for (let i = 0; i < 16; i++) {
      const x = ((i * 37) % 100) / 100 * hw * 1.6 - hw * 0.8 + swing * 0.5;
      const y = top + ((i * 53) % 100) / 100 * len;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Saias (peça de baixo). */
export function drawSkirt(rc: RC) {
  const ap = rc.ap;
  const spec = TOP_SPECS[ap.top];
  if (spec?.dress || spec?.forceBottom) return;
  if (ap.bottom !== 'saia' && ap.bottom !== 'saiaLonga') return;
  const col = rc.pal.bottom;
  drawDressSkirt(rc, col, rc.pal.bottomSh, rc.pal.bottomLine, { sleeve: 0, neck: 'crew', len: 0, inset: 0, dress: ap.bottom === 'saia' ? 0.36 : 0.92, flare: ap.bottom === 'saia' ? 0.5 : 0.3 });
}

export function drawNecklace(rc: RC) {
  const { ctx, ap, pal, d } = rc;
  if (ap.necklace === 'nenhum' || d.age < 5) return;
  const g = torsoGeom(rc);
  const w = d.neckW * 0.62;
  const depth = ap.necklace === 'pingente' ? 16 : 11;
  ctx.strokeStyle = pal.acc;
  ctx.lineWidth = ap.necklace === 'corrente' ? 1.8 : 1.2;
  if (ap.necklace === 'perolas') {
    ctx.fillStyle = '#f6f1e6';
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = g.cx + (t - 0.5) * 2 * w;
      const y = g.yN - 2 + Math.sin(t * Math.PI) * depth;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(g.cx - w, g.yN - 3);
  ctx.quadraticCurveTo(g.cx, g.yN - 3 + depth * 2, g.cx + w, g.yN - 3);
  ctx.stroke();
  if (ap.necklace === 'pingente') {
    const p = new Path2D();
    heartPath(p, g.cx, g.yN - 3 + depth + 4, 4.5);
    part(ctx, p, pal.acc, null, pal.accLine, 0.8, null);
  }
}
