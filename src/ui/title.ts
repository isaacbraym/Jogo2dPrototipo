import { h, icon, modal, toast, confirmBox } from './dom';
import { Stage } from '../scenes/stage';
import { Scene, Director } from '../scenes/scene';
import { randomAppearance } from '../character/appearance';
import { RNG } from '../core/rng';
import { sfx } from '../core/audio';
import { listSaves, loadLife, deleteLife, lastLifeId, pickJSON, saveLife } from '../game/storage';
import { portraitImg } from './portrait';
import { App } from './app';
import { maoAte, physical } from '../scenes/situations';
import { marcos } from '../scenes/contato';
import { GROUND } from '../render/bg';
import { Life } from '../game/state';

const SHOWCASE: { env: string; run: (d: Director, r: RNG) => Promise<void> }[] = [
  {
    env: 'parque',
    run: async (d, r) => {
      const a = d.add(randomAppearance(r, 'f'), 26, { x: 380, facing: 1 });
      const b = d.add(randomAppearance(r, 'm'), 28, { x: 900, facing: -1 });
      const k = d.add(randomAppearance(r), 7, { x: 160, facing: 1, motion: 'comemorar' });
      d.prop('cachorro', 1100, GROUND, { z: 1, opts: { flip: true, color: '#c8843a' } });
      d.loop(a, 'acenar'); d.loop(b, 'acenar');
      await d.wait(1.8);
      await physical(d, a, b, 'abracar');
      d.loop(k, 'dancar2');
      await d.wait(2.5);
      await physical(d, a, b, 'dancar');
      await d.wait(2);
    },
  },
  {
    env: 'praia',
    run: async (d, r) => {
      const beach = { top: 'banho', bottom: 'bermuda', shoes: 'descalco' };
      const a = d.add(randomAppearance(r, 'm'), 30, { x: 420, facing: 1, outfit: beach });
      const b = d.add(randomAppearance(r, 'f'), 29, { x: 860, facing: -1, outfit: beach });
      await d.wait(1);
      d.loop(a, 'ajoelhar');
      d.fx('brilho', a.handWorld().x, a.handWorld().y - 20, 10, { speed: 90 });
      await d.wait(1.2);
      d.expr(b, 'surpreso', 1);
      await d.wait(1);
      d.loop(b, 'comemorar');
      d.loop(a, 'parado');
      d.confetti(60);
      await d.wait(1.5);
      await physical(d, a, b, 'beijar');
      await d.wait(2);
    },
  },
  {
    env: 'balada',
    run: async (d, r) => {
      for (let i = 0; i < 5; i++) {
        const a = d.add(randomAppearance(r), 22 + i * 3, { x: 260 + i * 190, facing: i % 2 ? -1 : 1, motion: ['dancar', 'dancar2', 'dancar3'][i % 3] });
        a.motionT = i * 0.4;
      }
      for (let i = 0; i < 12; i++) { d.fx('musica', 640 + (i % 5) * 80 - 160, 260, 1); await d.wait(0.6); }
    },
  },
  {
    env: 'casamento',
    run: async (d, r) => {
      const a = d.add(randomAppearance(r, 'f'), 30, { x: 580, facing: 1, outfit: { top: 'noiva', hat: 'veu', shoes: 'salto' } });
      const b = d.add(randomAppearance(r, 'm'), 31, { x: 700, facing: -1, outfit: { top: 'smoking', shoes: 'social' } });
      for (let i = 0; i < 4; i++) d.add(randomAppearance(r), 30 + i * 8, { x: [250, 400, 880, 1030][i], facing: i < 2 ? 1 : -1, motion: 'aplaudir', y: GROUND - 30, z: -1, scale: 0.86 });
      await d.wait(1.2);
      await physical(d, a, b, 'beijar');

      // Pós-beijo: voltam para os convidados e comemoram com as mãos internas realmente unidas.
      a.turn = 0.3; b.turn = 0.3;
      a.lookAt = null; b.lookAt = null;
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      d.expr(a, 'apaixonado', 1.1); d.expr(b, 'apaixonado', 1.1);

      const encontro = (alto: boolean) => {
        const ma = marcos(a), mb = marcos(b);
        const x = (a.x + b.x) / 2;
        const cintura = (ma.costasBaixo.y + mb.costasBaixo.y) / 2 + 10;
        if (!alto) return { x, y: cintura };
        // A mão sobe só até a linha dos ombros: comemora sem varrer olhos/boca.
        const ombros = Math.min(ma.ombroF.y, mb.ombroF.y) - 6;
        return { x, y: Math.max(ombros, cintura - 95) };
      };
      const alvo = (x: typeof a, alto: boolean) => {
        const p = encontro(alto);
        return { x: p.x - x.facing * 2, y: p.y };
      };
      const maosDadas = (x: typeof a) => maoAte(d, x, 'F', [
        { t: 0, p: null, forma: 'aberta' },
        { t: 0.6, p: () => alvo(x, false), forma: 'segura' },
        { t: 0.95, p: () => alvo(x, false), forma: 'segura' },
        { t: 1.75, p: () => alvo(x, true), forma: 'segura' },
        { t: 2.55, p: () => alvo(x, true), forma: 'segura' },
        { t: 3.0, p: null, forma: 'aberta' },
      ]);
      const gesto = maosDadas(a);
      maosDadas(b);

      await d.wait(0.85);
      d.fx('arroz', 640, 180, 40, { w: 400, speed: 80, dir: Math.PI / 2, cone: 1.2, life: 2.5, ground: GROUND + 20 });
      d.confetti(80);
      d.expr(a, 'feliz'); d.expr(b, 'feliz');
      await gesto.feito;
      await d.wait(0.5);
    },
  },
  {
    env: 'acampamento',
    run: async (d, r) => {
      d.prop('fogueira', 640, GROUND + 8, { z: 2 });
      d.add(randomAppearance(r), 24, { x: 500, facing: 1, motion: 'tocarViolao' });
      d.add(randomAppearance(r), 23, { x: 790, facing: -1, motion: 'sentarChao' });
      for (let i = 0; i < 10; i++) { d.fx('musica', 560, 380, 1); await d.wait(0.7); }
    },
  },
];

export function titleScreen(app: App) {
  const host = h('div.stage-host');
  const stage = new Stage(host);
  let alive = true;
  const vitrine = new URLSearchParams(location.search).get('vitrine');
  const vitrineFixa = vitrine ? SHOWCASE.findIndex((s) => s.env === vitrine) : -1;
  let idx = vitrineFixa >= 0 ? vitrineFixa : Math.floor(Math.random() * SHOWCASE.length);
  const r = new RNG((Math.random() * 1e9) | 0);
  const cycle = async () => {
    while (alive) {
      const s = SHOWCASE[vitrineFixa >= 0 ? vitrineFixa : idx % SHOWCASE.length];
      if (vitrineFixa < 0) idx++;
      const sc = new Scene(s.env);
      if (stage.h > stage.w) sc.minViewW = 430;
      sc.fadeA = 1;
      sc.fadeTarget = 0;
      stage.setScene(sc);
      await s.run(new Director(sc), r);
      await new Promise((res) => setTimeout(res, 1200));
      sc.fadeTarget = 1;
      await new Promise((res) => setTimeout(res, 500));
    }
  };
  cycle();

  const cont = lastLifeId();
  const menu = h('div.title-menu', null,
    h('div.row', null,
      h('button.btn.primary.big', { onclick: () => app.go('editor') }, icon('sparkles'), 'Nova vida'),
      cont ? h('button.btn.purple.big', { onclick: () => { const L = loadLife(cont); if (L) app.go('game', L); } }, icon('play'), 'Continuar') : null,
    ),
    h('div.row', null,
      h('button.btn', { onclick: () => loadDialog(app) }, icon('folder'), 'Carregar vida'),
      h('button.btn', { onclick: () => app.go('editor', { presets: true }) }, icon('face'), 'Meus personagens'),
    ),
  );
  const musicBtn = h('button.icon-btn' + (sfx.musicOn ? '.on' : ''), { title: 'Música', onclick: () => { sfx.unlock(); sfx.setMusic(!sfx.musicOn); musicBtn.classList.toggle('on', sfx.musicOn); } }, icon('music'));
  const sfxBtn = h('button.icon-btn' + (sfx.sfxOn ? '.on' : ''), { title: 'Efeitos sonoros', onclick: () => { sfx.unlock(); sfx.setSfx(!sfx.sfxOn); sfxBtn.classList.toggle('on', sfx.sfxOn); } }, icon('sound'));
  const el = h('div.screen.title-screen', { onpointerdown: () => sfx.unlock() },
    host,
    h('div.title-overlay', null,
      h('h1.logo', null, ...'VIVA!'.split('').map((c) => h('span', null, c))),
      h('p.tagline', null, 'Uma vida. Mil escolhas. Todas as consequências.'),
      menu,
      h('div.title-foot', null, musicBtn, sfxBtn, h('span', null, 'Protótipo v1.0 · Canvas2D procedural')),
    ),
  );
  return {
    el,
    destroy: () => {
      alive = false;
      stage.destroy();
    },
  };
}

export function loadDialog(app: App) {
  const list = h('div.saves-list');
  const render = () => {
    list.innerHTML = '';
    const saves = listSaves();
    if (!saves.length) list.appendChild(h('div.empty', null, 'Nenhuma vida salva ainda. Comece uma nova!'));
    for (const s of saves) {
      list.appendChild(h('div.save-item', { onclick: () => { const L = loadLife(s.id); if (L) { close(); app.go('game', L); } } },
        portraitImg(s.ap, s.age, 56, s.dead ? 'dormindo' : 'feliz', s.dead ? '#5a5670' : '#6b5bd6'),
        h('div.grow', null, h('b', null, s.name), h('small', null, `${s.age} anos · ${s.dead ? 'falecido(a)' : 'vivo(a)'} · geração ${s.generation}`), h('small', null, new Date(s.updated).toLocaleString('pt-BR'))),
        h('button.icon-btn', { title: 'Excluir', onclick: async (e: Event) => { e.stopPropagation(); if (await confirmBox('Excluir vida', `Excluir a vida de ${s.name}? Isso não pode ser desfeito.`, 'Excluir')) { deleteLife(s.id); render(); } } }, icon('trash')),
      ));
    }
  };
  render();
  const body = h('div', null, list, h('div.row.end', { style: { marginTop: '12px' } },
    h('button.btn.small', { onclick: async () => { const data = await pickJSON(); if (data && data.player && data.stats) { saveLife(data as Life); toast('Vida importada!', 'ok'); render(); } else if (data) toast('Arquivo inválido.', 'bad'); } }, icon('upload'), 'Importar arquivo'),
  ));
  const close = modal('Carregar vida', body, { wide: true });
}
