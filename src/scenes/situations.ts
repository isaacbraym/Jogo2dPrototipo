import { Director } from './scene';
import { Appearance, randomAppearance, Sex } from '../character/appearance';
import { Actor } from '../character/actor';
import { GROUND } from '../render/bg';
import { legLength } from '../character/character';
import { RNG, rng } from '../core/rng';
import { Ease } from '../core/math';
import { sfx } from '../core/audio';

export interface CastMember {
  ap: Appearance;
  age: number;
  name: string;
  sex: Sex;
}

export interface Cast {
  player: CastMember;
  others: CastMember[];
  data?: Record<string, any>;
}

export interface Situation {
  id: string;
  env: string | ((c: Cast) => string);
  title?: string;
  run: (d: Director, c: Cast) => Promise<void>;
}

const npc = (seed: number, sex?: Sex, age = 35): CastMember => {
  const r = new RNG(seed);
  const s = sex ?? (r.chance(0.5) ? 'f' : 'm');
  return { ap: randomAppearance(r, s), age, name: '', sex: s };
};
const other = (c: Cast, i: number, fallbackSeed: number, sex?: Sex, age = 35): CastMember => c.others[i] ?? npc(fallbackSeed, sex, age);

const P = (d: Director, c: Cast, x = 560, o: Parameters<Director['add']>[2] = {}) => d.add(c.player.ap, c.player.age, { x, name: c.player.name, ...o });
const O = (d: Director, m: CastMember, x = 740, o: Parameters<Director['add']>[2] = {}) => d.add(m.ap, m.age, { x, facing: -1, name: m.name, ...o });

/** Deita o ator sobre uma superfície de altura `top` (acima do chão). */
function lieOn(a: Actor, top: number) {
  a.elev = top + a.d.thighW * 0.42 * a.scale - legLength(a.d) * a.scale;
}

function faceEach(a: Actor, b: Actor) {
  a.facing = b.x > a.x ? 1 : -1;
  b.facing = a.x > b.x ? 1 : -1;
  a.lookAt = b;
  b.lookAt = a;
}

function crowd(d: Director, n: number, x0: number, x1: number, seed: number, motion = 'aplaudir', opts: { outfit?: Partial<Appearance>; age?: number; scale?: number; y?: number; z?: number } = {}) {
  const r = new RNG(seed);
  const list: Actor[] = [];
  for (let i = 0; i < n; i++) {
    const m = npc(seed * 13 + i, undefined, opts.age ?? r.int(20, 60));
    const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1) + r.range(-15, 15);
    const a = d.add(m.ap, m.age, { x, facing: x < 640 ? 1 : -1, motion, outfit: opts.outfit, scale: opts.scale ?? 0.86, y: opts.y ?? GROUND - 30, z: opts.z ?? -0.5 });
    a.motionT = r.range(0, 3);
    list.push(a);
  }
  return list;
}

/** Ação física genérica entre dois personagens (usada no menu de relacionamentos). */
export async function physical(d: Director, a: Actor, b: Actor, action: string) {
  faceEach(a, b);
  const close = async (gap: number) => {
    const mid = (a.x + b.x) / 2;
    const ax = mid - (a.facing * gap) / 2;
    const bx = mid + (a.facing * gap) / 2;
    await Promise.all([d.walk(a, ax), d.walk(b, bx)]);
    faceEach(a, b);
  };
  switch (action) {
    case 'abracar': {
      await close(Math.max(70, (a.d.headW + b.d.headW) * 0.4));
      a.z = 1; b.z = 0.5;
      d.loop(a, 'abracar'); d.loop(b, 'abracarTras');
      d.sfx('heart');
      d.focus((a.x + b.x) / 2, 330, 1.25);
      for (let i = 0; i < 3; i++) { d.hearts((a.x + b.x) / 2, a.headWorld().y - 20, 3); await d.wait(0.6); }
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      d.resetCam();
      break;
    }
    case 'beijar': {
      await close(Math.max(74, (a.d.headW + b.d.headW) * 0.42));
      a.z = 1; b.z = 0.5;
      d.focus((a.x + b.x) / 2, 300, 1.45);
      d.loop(a, 'beijar'); d.loop(b, 'beijarTras');
      await d.wait(0.6);
      d.sfx('kiss');
      d.hearts((a.x + b.x) / 2, a.headWorld().y - 10, 10);
      await d.wait(1.6);
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      d.expr(a, 'apaixonado', 2); d.expr(b, 'apaixonado', 2);
      d.resetCam();
      break;
    }
    case 'highFive': {
      await close(120);
      await Promise.all([d.act(a, 'highFive'), d.act(b, 'highFive')]);
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      break;
    }
    case 'apertoMao': {
      await close(110);
      d.loop(a, 'apertoMao'); d.loop(b, 'apertoMao');
      await d.wait(1.6);
      d.loop(a, 'parado'); d.loop(b, 'parado');
      break;
    }
    case 'soco': {
      await close(125);
      d.loop(b, 'lutar');
      d.focus((a.x + b.x) / 2, 360, 1.2);
      await d.act(a, 'soco');
      d.act(b, 'cair');
      d.expr(b, 'tonto', 3);
      await d.wait(1.2);
      d.emote(b, 'estrela');
      d.loop(a, 'vitoria');
      await d.wait(1);
      d.resetCam();
      break;
    }
    case 'tapa': {
      await close(110);
      await d.act(a, 'tapa');
      d.act(b, 'estremecer');
      d.expr(b, 'surpreso', 2);
      await d.wait(0.8);
      d.loop(b, 'furia');
      d.emote(b, 'raiva');
      await d.wait(1);
      break;
    }
    case 'empurrar': {
      await close(110);
      await d.act(a, 'empurrar');
      d.moveActor(b, b.x + a.facing * 60, b.y, 0.35, Ease.outQuad);
      d.act(b, 'estremecer');
      await d.wait(1);
      d.loop(b, 'bracosCruzados');
      break;
    }
    case 'dancar': {
      await close(170);
      d.loop(a, 'dancar'); d.loop(b, 'dancar2');
      for (let i = 0; i < 5; i++) { d.fx('musica', (a.x + b.x) / 2, a.topWorld(), 2); await d.wait(0.5); }
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      break;
    }
    case 'discutir': {
      await close(170);
      d.loop(a, 'furia'); d.loop(b, 'bracosCruzados');
      await d.say(a, 'Você nunca me escuta!', 1.8, 'grito');
      d.loop(b, 'furia');
      await d.say(b, 'Olha quem fala!', 1.6, 'grito');
      d.emote(a, 'raiva'); d.emote(b, 'raiva');
      await d.wait(1);
      d.loop(a, 'bracosCruzados');
      break;
    }
    case 'elogiar': {
      await close(170);
      d.loop(a, 'joinha');
      await d.say(a, 'Você é incrível, sabia?', 1.8);
      d.expr(b, 'envergonhado', 2.5);
      d.emote(b, 'coracao');
      d.loop(b, 'feliz');
      await d.wait(1.4);
      break;
    }
    case 'presente': {
      await close(120);
      a.propN = 'presente';
      await d.act(a, 'entregar');
      a.propN = undefined;
      b.propN = 'presente';
      d.loop(b, 'comemorar');
      d.fx('brilho', b.x, b.topWorld() + 40, 10, { speed: 200 });
      await d.wait(1.6);
      b.propN = undefined;
      d.loop(b, 'feliz');
      break;
    }
    case 'conversar': {
      await close(170);
      d.loop(a, 'feliz'); d.loop(b, 'feliz');
      await d.say(a, 'E aí, como vão as coisas?', 1.6);
      await d.say(b, 'Tudo ótimo! Que bom te ver.', 1.6);
      d.loop(a, 'rir'); d.loop(b, 'rir');
      await d.wait(1.2);
      d.loop(a, 'parado'); d.loop(b, 'parado');
      break;
    }
    case 'pedirDinheiro': {
      await close(150);
      d.loop(a, 'nervoso');
      await d.say(a, 'Será que você me empresta uns trocados?', 2);
      break;
    }
    case 'brincar': {
      await close(170);
      d.loop(a, 'comemorar'); d.loop(b, 'dancar2');
      for (let i = 0; i < 4; i++) { d.fx('brilho', (a.x + b.x) / 2, a.topWorld(), 3); await d.wait(0.5); }
      d.loop(a, 'rir'); d.loop(b, 'rir');
      await d.wait(1);
      break;
    }
  }
}

// ================================================================== situações
const S: Situation[] = [
  {
    id: 'casa',
    env: (c) => (c.player.age < 3 ? 'quartoBebe' : c.player.age < 18 ? 'quarto' : 'sala'),
    run: async (d, c) => {
      const age = c.player.age;
      const p = P(d, c, 640, { facing: 1, turn: 0.55, z: 1 });
      const fam: Actor[] = c.others.slice(0, 3).map((m, i) => O(d, m, [360, 930, 1110][i], { facing: i === 0 ? 1 : -1, turn: 0.6, z: 0 }));
      fam.forEach((f) => (f.lookAt = p));
      const pets = (c.data?.pets ?? []) as { kind: string; color: string }[];
      const petProps = pets.slice(0, 2).map((pt, i) => d.prop(pt.kind, 470 + i * 380, GROUND + 6, { z: 2, opts: { color: pt.color, flip: i === 1, scale: 0.9 } }));
      if (age < 3) d.focus(640, 470, 1.3, 10);
      if (c.data?.ageUp) {
        d.caption(`${age} anos`, age >= 60 ? 'A sabedoria vem com o tempo' : age >= 30 ? 'Mais um capítulo' : 'Mais um ano de vida', 2.4);
        setTimeout(() => sfx.chime(), 150);
      }
      if (age < 1) { p.elev = 0; d.loop(p, 'sentarChao'); d.expr(p, 'feliz'); }
      else if (age < 3) d.loop(p, 'engatinhar');
      else d.loop(p, c.data?.mood === 'triste' ? 'triste' : c.data?.mood === 'feliz' ? 'feliz' : 'parado');
      // vida ambiente (não bloqueia o roteiro)
      const sc = d.sc;
      const IDLE = ['acenar', 'rir', 'mexerCelular', 'cafe', 'ler', 'darOmbros', 'pensando', 'dancar3', 'feliz', 'bracosCruzados'];
      (async () => {
        await d.wait(2.5);
        while (sc.alive) {
          const who = rng.pick([...fam, ...(age >= 3 ? [p] : [])]);
          if (who && rng.chance(0.55)) {
            const target = Math.max(260, Math.min(1080, who.x + rng.range(-160, 160)));
            await Promise.race([d.walk(who, target), d.wait(4)]);
            if (!sc.alive) break;
            if (who !== p || rng.chance(0.5)) who.facing = p.x > who.x ? 1 : -1;
          }
          if (who) {
            const m = rng.pick(who === p ? ['feliz', 'mexerCelular', 'cafe', 'pensando', 'rir'] : IDLE);
            d.loop(who, m);
            if (m === 'rir') d.fx('musica', who.headWorld().x, who.topWorld(), 1);
            await d.wait(rng.range(2.5, 4.5));
            if (!sc.alive) break;
            d.loop(who, who === p ? (c.data?.mood === 'triste' ? 'triste' : 'parado') : 'parado');
          }
          for (const pp of petProps) {
            if (rng.chance(0.4)) {
              const nx = Math.max(250, Math.min(1100, pp.x + rng.range(-200, 200)));
              pp.opts.flip = nx < pp.x;
              pp.opts.state = 1;
              d.moveProp(pp, nx, pp.y, Math.abs(nx - pp.x) / 120 + 0.3, Ease.inOutSine).then(() => (pp.opts.state = 0));
            }
          }
          await d.wait(rng.range(1.5, 3.5));
        }
      })();
      await d.wait(0.4);
    },
  },
  {
    id: 'nascimento',
    env: 'maternidade',
    title: 'Um novo começo',
    run: async (d, c) => {
      const mom = O(d, other(c, 0, 1, 'f', 30), 600, { facing: 1, motion: 'segurarBebe' });
      const dad = O(d, other(c, 1, 2, 'm', 32), 900, { facing: -1, motion: 'parado' });
      const baby = P(d, c, 0, { motion: 'deitado', scale: 1, turn: 0.4, z: 1 });
      baby.visible = false;
      d.focus(700, 330, 1.2);
      await d.wait(0.6);
      mom.frame && mom.handWorld(true);
      const place = () => {
        const h = mom.handWorld(true), h2 = mom.handWorld(false);
        baby.x = (h.x + h2.x) / 2 - 10;
        baby.elev = GROUND - (h.y + h2.y) / 2 - legLength(baby.d) * baby.scale + 4;
        baby.facing = 1;
      };
      place();
      baby.visible = true;
      d.flash('#fff6e0', 0.8);
      d.sfx('chime');
      d.caption('Nasceu ' + c.player.name + '!', 'Bem-vindo(a) ao mundo', 3.5);
      d.sc.onBeat = () => place();
      d.expr(mom, 'apaixonado');
      d.loop(dad, 'comemorar');
      d.hearts(700, 300, 8);
      await d.wait(1.4);
      d.loop(dad, 'aplaudir');
      d.hearts(mom.x, 280, 6);
      await d.say(dad, 'É perfeito(a)!', 1.8);
      d.loop(dad, 'feliz');
      await d.wait(1.2);
      d.resetCam();
    },
  },
  {
    id: 'primeirosPassos',
    env: 'sala',
    run: async (d, c) => {
      const mom = O(d, other(c, 0, 1, 'f', 31), 900, { facing: -1, motion: 'agachar' });
      const dad = O(d, other(c, 1, 2, 'm', 33), 330, { facing: 1, motion: 'agachar' });
      const kid = P(d, c, 420, { facing: 1 });
      kid.speed = 55;
      d.caption('Primeiros passos!', undefined, 3);
      d.look(mom, kid); d.look(dad, kid);
      await d.walk(kid, 640);
      d.act(kid, 'cair');
      await d.wait(1);
      d.expr(kid, 'surpreso', 1);
      d.loop(kid, 'parado');
      await d.wait(0.6);
      await d.walk(kid, 800);
      d.loop(mom, 'comemorar');
      d.loop(dad, 'aplaudir');
      d.loop(kid, 'feliz');
      d.sfx('success');
      d.confetti(50);
      await d.wait(2);
    },
  },
  {
    id: 'aniversario',
    env: (c) => (c.player.age < 18 ? 'sala' : 'cozinha'),
    run: async (d, c) => {
      const cake = d.prop('bolo', 640, GROUND + 6, { z: 2, scale: 0.9, opts: { state: 1 } });
      d.prop('baloes', 300, GROUND - 40, { z: -2 });
      d.prop('baloes', 1000, GROUND - 40, { z: -2 });
      d.prop('presentes', 1120, GROUND, { z: -1 });
      const hat = { hat: 'festa' };
      const p = P(d, c, 560, { facing: 1, outfit: hat });
      const guests = c.others.slice(0, 3).map((m, i) => O(d, m, [820, 360, 960][i], { facing: i === 1 ? 1 : -1, outfit: hat, motion: 'aplaudir' }));
      d.caption(`Feliz aniversário!`, `${c.player.name} fez ${c.player.age} ${c.player.age === 1 ? 'ano' : 'anos'}`, 3.4);
      d.focus(640, 330, 1.2);
      d.sfx('applause');
      await d.wait(1.4);
      await d.act(p, 'soprar');
      cake.opts.state = 0;
      d.fx('fumaca', 640, GROUND - 90, 6, { speed: 30, size: 8 });
      d.sfx('success');
      d.confetti(110);
      d.loop(p, 'comemorar');
      guests.forEach((g, i) => d.loop(g, i % 2 ? 'dancar3' : 'comemorar'));
      await d.wait(2.4);
      d.loop(p, 'feliz');
      d.resetCam();
    },
  },
  {
    id: 'escolaPrimeiroDia',
    env: 'patio',
    run: async (d, c) => {
      const par = O(d, other(c, 0, 1, 'f', 32), 420, { facing: 1 });
      const p = P(d, c, 500, { facing: 1, outfit: { top: 'uniforme', topColor: '#3d7bd9', topColor2: '#f4f1ea' } });
      d.caption('Primeiro dia de aula', undefined, 3);
      d.loop(par, 'acenar');
      await d.say(par, 'Boa aula, meu amor!', 1.6);
      d.face(p, par);
      d.loop(p, 'acenar');
      await d.wait(1.2);
      p.facing = 1;
      const kids = crowd(d, 3, 880, 1180, 55, 'feliz', { age: c.player.age, outfit: { top: 'uniforme', topColor: '#3d7bd9', topColor2: '#f4f1ea' }, scale: 1, y: GROUND - 10 });
      await d.walk(p, 800);
      d.emote(p, 'estrela');
      kids.forEach((k) => d.loop(k, 'acenar'));
      d.loop(p, 'feliz');
      await d.wait(1.5);
    },
  },
  {
    id: 'aula',
    env: 'escola',
    run: async (d, c) => {
      const prof = O(d, other(c, 0, 7, undefined, 45), 460, { facing: 1, motion: 'apontar' });
      const p = P(d, c, 760, { facing: -1, outfit: c.player.age < 18 ? { top: 'uniforme', topColor: '#3d7bd9', topColor2: '#f4f1ea' } : undefined });
      d.prop('carteira', 760, GROUND + 4, { z: 1, scale: 1 });
      p.facing = -1;
      d.loop(p, 'estudar');
      await d.say(prof, 'Prestem atenção: isto cai na prova!', 2.2);
      const good = c.data?.good !== false;
      await d.wait(0.8);
      if (good) {
        d.emote(p, 'ideia');
        d.sfx('sparkle');
        d.loop(p, 'sentarFeliz');
        await d.say(p, 'Entendi tudo!', 1.4);
      } else {
        d.emote(p, 'zzz');
        d.expr(p, 'cansado');
        d.loop(p, 'sentar');
        await d.wait(1.8);
      }
    },
  },
  {
    id: 'valentao',
    env: 'patio',
    run: async (d, c) => {
      const bully = O(d, other(c, 0, 11, 'm', c.player.age + 1), 900, { facing: -1, motion: 'bracosCruzados' });
      const p = P(d, c, 560, { facing: 1, motion: 'nervoso' });
      bully.scale = 1.08;
      await d.walk(bully, 720);
      faceEach(p, bully);
      d.loop(bully, 'furia');
      await d.say(bully, 'Me passa o seu lanche!', 1.8, 'grito');
      d.loop(p, 'susto');
      d.emote(p, 'suor');
      await d.wait(1);
    },
  },
  {
    id: 'briga',
    env: (c) => c.data?.env ?? 'patio',
    run: async (d, c) => {
      const foe = O(d, other(c, 0, 12, 'm', c.player.age), 760, { facing: -1, motion: 'lutar' });
      const p = P(d, c, 540, { facing: 1, motion: 'lutar' });
      faceEach(p, foe);
      d.caption('Briga!', undefined, 2);
      const win = c.data?.win !== false;
      await d.wait(0.8);
      if (win) {
        await physical(d, p, foe, 'soco');
        d.sfx('cheer');
      } else {
        await physical(d, foe, p, 'soco');
        d.expr(p, 'chorando', 3);
      }
      await d.wait(0.8);
    },
  },
  {
    id: 'formatura',
    env: (c) => (c.data?.nivel === 'faculdade' ? 'universidade' : 'patio'),
    run: async (d, c) => {
      const gown = { top: 'beca', hat: 'capelo' };
      const p = P(d, c, 640, { facing: 1, outfit: gown, turn: 0.45 });
      const mates = crowd(d, 4, 300, 1000, 91, 'feliz', { outfit: gown, age: c.player.age, scale: 0.9 });
      const fam = c.others.slice(0, 2).map((m, i) => O(d, m, i ? 1150 : 150, { facing: i ? -1 : 1, motion: 'aplaudir' }));
      d.caption('Formatura!', c.data?.nivel === 'faculdade' ? 'Diploma universitário conquistado' : 'Ensino médio concluído', 3.4);
      p.propN = 'diploma';
      d.loop(p, 'vitoria');
      await d.wait(1.6);
      p.propN = undefined;
      const all = [p, ...mates];
      all.forEach((a) => d.act(a, 'jogarChapeu'));
      await d.wait(0.42);
      for (const a of all) {
        a.outfit = { top: 'beca' };
        const cap = d.prop('capeloVoando', a.headWorld().x, a.headWorld().y - 20, { z: 5, front: true });
        d.moveProp(cap, cap.x + rng.range(-80, 80), cap.y - rng.range(220, 320), 0.9, Ease.outCubic).then(() => d.moveProp(cap, cap.x + rng.range(-40, 40), GROUND - 10, 1.2, Ease.inQuad));
      }
      d.sfx('cheer');
      d.confetti(120);
      await d.wait(1.2);
      all.forEach((a) => d.loop(a, 'comemorar'));
      fam.forEach((f) => d.loop(f, 'comemorar'));
      await d.wait(2.2);
    },
  },
  {
    id: 'encontro',
    env: 'restaurante',
    run: async (d, c) => {
      d.prop('mesaJantar', 640, GROUND + 10, { z: 1 });
      d.prop('cadeira', 490, GROUND, { z: -1, opts: { color: '#5a3a24' } });
      d.prop('cadeira', 790, GROUND, { z: -1, opts: { color: '#5a3a24', flip: true } });
      const p = P(d, c, 520, { facing: 1, motion: 'sentarFeliz' });
      const o = O(d, other(c, 0, 21, undefined, c.player.age), 760, { facing: -1, motion: 'sentarFeliz' });
      faceEach(p, o);
      d.caption(c.data?.first ? 'Primeiro encontro' : 'Encontro romântico', o.name ? 'com ' + o.name : undefined, 3);
      d.focus(640, 330, 1.25);
      await d.say(p, c.data?.line ?? 'Você está linda(o) hoje.', 1.8);
      const good = c.data?.good !== false;
      if (good) {
        d.expr(o, 'envergonhado', 2);
        d.emote(o, 'coracao');
        await d.say(o, 'Que fofo... estou adorando a noite!', 2);
        d.hearts(640, 280, 8);
        d.expr(o, 'rindo', 2.5); d.expr(p, 'rindo', 2.5);
        d.sfx('laugh');
      } else {
        d.loop(o, 'bracosCruzados');
        d.emote(o, 'reticencias');
        await d.say(o, 'Hmm... acho que não temos química.', 2);
        d.expr(p, 'triste', 3);
      }
      await d.wait(1.5);
      d.resetCam();
    },
  },
  {
    id: 'beijoPraia',
    env: 'praia',
    run: async (d, c) => {
      const p = P(d, c, 460, { facing: 1, outfit: { top: 'banho', bottom: 'bermuda', shoes: 'descalco' } });
      const o = O(d, other(c, 0, 22, undefined, c.player.age), 840, { facing: -1, outfit: { top: 'banho', bottom: 'bermuda', shoes: 'descalco' } });
      d.caption('Pôr do sol a dois', undefined, 3);
      await physical(d, p, o, 'beijar');
      await d.wait(0.8);
    },
  },
  {
    id: 'pedido',
    env: (c) => c.data?.env ?? 'praia',
    run: async (d, c) => {
      const p = P(d, c, 520, { facing: 1 });
      const o = O(d, other(c, 0, 23, undefined, c.player.age), 760, { facing: -1 });
      faceEach(p, o);
      d.focus(640, 360, 1.25);
      await d.say(p, 'Tenho algo importante pra te perguntar...', 2);
      d.loop(p, 'ajoelhar');
      d.sfx('sparkle');
      d.fx('brilho', p.handWorld().x, p.handWorld().y - 20, 10, { speed: 90 });
      await d.say(p, 'Você quer casar comigo?', 2);
      const yes = c.data?.yes !== false;
      d.expr(o, 'surpreso', 1.2);
      d.emote(o, 'exclamacao');
      await d.wait(1.2);
      if (yes) {
        d.loop(o, 'comemorar');
        await d.say(o, 'SIM! Mil vezes sim!', 1.6, 'grito');
        d.loop(p, 'parado');
        d.sfx('success');
        await physical(d, p, o, 'abracar');
        d.confetti(60);
      } else {
        d.loop(o, 'darOmbros');
        await d.say(o, 'Desculpa... eu não estou pronto(a).', 2);
        d.loop(p, 'chorar');
        d.emote(p, 'coracaoPartido');
        d.sfx('sad');
      }
      await d.wait(1.5);
      d.resetCam();
    },
  },
  {
    id: 'casamento',
    env: 'casamento',
    run: async (d, c) => {
      const p = c.player;
      const o = other(c, 0, 24, p.sex === 'f' ? 'm' : 'f', p.age);
      const outfitOf = (m: CastMember) => (m.sex === 'f' ? { top: 'noiva', hat: 'veu', shoes: 'salto' } : { top: 'smoking', shoes: 'social' });
      const pa = P(d, c, 580, { facing: 1, outfit: outfitOf(p), turn: 0.55 });
      const oa = O(d, o, 700, { facing: -1, outfit: outfitOf(o), turn: 0.55 });
      const celebrante = d.add(npc(77, 'm', 60).ap, 60, { x: 640, y: GROUND - 60, scale: 0.9, z: -2, turn: 0.1, motion: 'ler' });
      const guests = [
        ...crowd(d, 3, 140, 400, 88, 'feliz', { y: GROUND - 36, z: -1, scale: 0.84 }),
        ...crowd(d, 3, 880, 1140, 89, 'feliz', { y: GROUND - 36, z: -1, scale: 0.84 }),
      ];
      guests.forEach((g) => { g.facing = g.x < 640 ? 1 : -1; });
      faceEach(pa, oa);
      d.caption('O grande dia!', `${p.name} & ${o.name}`, 3.6);
      d.focus(640, 320, 1.3);
      await d.say(celebrante, 'Eu vos declaro casados!', 2);
      await physical(d, pa, oa, 'beijar');
      d.sfx('bell');
      d.sfx('cheer');
      guests.forEach((g) => d.loop(g, 'aplaudir'));
      for (let i = 0; i < 4; i++) {
        d.fx('arroz', 640, 180, 40, { w: 400, speed: 80, dir: Math.PI / 2, cone: 1.2, life: 2.5, ground: GROUND + 20 });
        d.confetti(30);
        await d.wait(0.6);
      }
      d.loop(pa, 'comemorar'); d.loop(oa, 'comemorar');
      d.resetCam();
      await d.wait(1.5);
      void celebrante;
    },
  },
  {
    id: 'termino',
    env: 'ruaChuva',
    run: async (d, c) => {
      const p = P(d, c, 560, { facing: 1 });
      const o = O(d, other(c, 0, 25, undefined, c.player.age), 740, { facing: -1, motion: 'bracosCruzados' });
      faceEach(p, o);
      d.caption('Fim de um amor', undefined, 2.6);
      await d.say(o, 'Acabou. Não dá mais pra nós.', 2);
      d.loop(p, 'susto');
      await d.say(p, 'Espera... não faz isso!', 1.6);
      o.lookAt = null;
      await d.walk(o, 1300);
      d.loop(p, 'chorar');
      d.emote(p, 'coracaoPartido', 2.5);
      d.sfx('sad');
      d.focus(p.x, 340, 1.35);
      for (let i = 0; i < 4; i++) { d.fx('lagrima', p.headWorld().x, p.headWorld().y + 10, 2, { speed: 60, dir: Math.PI / 2, cone: 1.4, size: 8, life: 1 }); await d.wait(0.5); }
      d.resetCam();
    },
  },
  {
    id: 'entrevista',
    env: 'escritorio',
    run: async (d, c) => {
      const boss = O(d, other(c, 0, 31, undefined, 48), 780, { facing: -1, outfit: { top: 'blazer' } });
      const p = P(d, c, 300, { facing: 1, outfit: { top: 'blazer', topColor: '#23242b', topColor2: '#c2273d', bottom: 'calca', bottomColor: '#23242b', shoes: 'social', shoesColor: '#23242b' } });
      d.caption('Entrevista de emprego', c.data?.cargo, 3);
      await d.walk(p, 600);
      faceEach(p, boss);
      await physical(d, p, boss, 'apertoMao');
      await d.say(boss, 'Por que devemos contratar você?', 2);
      d.loop(p, 'pensando');
      await d.wait(1);
      d.loop(p, 'joinha');
      await d.say(p, 'Porque eu dou o meu melhor!', 1.8);
      const ok = c.data?.ok !== false;
      if (ok) {
        d.loop(boss, 'joinha');
        await d.say(boss, 'Você está contratado(a)!', 1.8);
        d.loop(p, 'comemorar');
        d.sfx('success');
        d.confetti(50);
      } else {
        d.loop(boss, 'darOmbros');
        await d.say(boss, 'Vamos ligar pra você... talvez.', 1.8);
        d.loop(p, 'triste');
        d.sfx('fail');
      }
      await d.wait(1.5);
    },
  },
  {
    id: 'trabalho',
    env: (c) => c.data?.env ?? 'escritorio',
    run: async (d, c) => {
      const outfit = c.data?.outfit;
      const p = P(d, c, 640, { facing: 1, outfit });
      const mot = c.data?.motion ?? 'digitar';
      if (mot === 'digitar') {
        d.prop('escrivaninha', 740, GROUND, { z: 1, opts: { color: '#e8e6e0' } });
        d.prop('cadeira', 588, GROUND, { z: -0.5, opts: { color: '#3b3d44' } });
        p.x = 600;
      }
      d.loop(p, mot);
      d.caption(c.data?.titulo ?? 'Dia de trabalho', c.data?.sub, 2.8);
      const coworker = O(d, other(c, 0, 33, undefined, 30), 1200, { facing: -1 });
      coworker.propN = 'xicara';
      await d.walk(coworker, 880);
      coworker.lookAt = p;
      await d.say(coworker, c.data?.fala ?? 'Café? Hoje o dia vai ser longo!', 1.8);
      d.emote(p, c.data?.good === false ? 'suor' : 'estrela');
      await d.wait(1.2);
      coworker.propN = undefined;
    },
  },
  {
    id: 'promocao',
    env: 'escritorio',
    run: async (d, c) => {
      const boss = O(d, other(c, 0, 34, undefined, 52), 780, { facing: -1, outfit: { top: 'blazer' } });
      const p = P(d, c, 540, { facing: 1 });
      const team = crowd(d, 3, 950, 1250, 34, 'aplaudir', { scale: 0.9 });
      faceEach(p, boss);
      d.caption('Promoção!', c.data?.cargo, 3);
      await d.say(boss, 'Parabéns! Você merece esta promoção.', 2);
      boss.propN = 'trofeu';
      await d.act(boss, 'entregar');
      boss.propN = undefined;
      p.propN = 'trofeu';
      d.loop(p, 'vitoria');
      d.sfx('levelUp');
      d.confetti(90);
      d.fx('nota', 640, 100, 20, { w: 600, speed: 40, dir: Math.PI / 2, life: 3, size: 10, ground: GROUND + 30 });
      team.forEach((t) => d.loop(t, 'comemorar'));
      await d.wait(2.2);
      p.propN = undefined;
    },
  },
  {
    id: 'demissao',
    env: 'escritorio',
    run: async (d, c) => {
      const boss = O(d, other(c, 0, 35, undefined, 52), 800, { facing: -1, outfit: { top: 'blazer' }, motion: 'bracosCruzados' });
      const p = P(d, c, 560, { facing: 1 });
      faceEach(p, boss);
      d.caption('Demitido(a)', undefined, 2.6);
      await d.say(boss, 'Sinto muito, mas você está fora.', 2);
      d.loop(boss, 'apontar');
      boss.facing = 1;
      d.expr(p, 'chorando');
      d.sfx('fail');
      await d.wait(0.8);
      p.propN = 'maleta';
      d.loop(p, 'triste');
      await d.walk(p, -200);
    },
  },
  {
    id: 'academia',
    env: 'academia',
    run: async (d, c) => {
      const p = P(d, c, 620, { facing: 1, outfit: { top: 'esporte', topColor: c.player.ap.topColor, shoes: 'tenis' } });
      d.caption('Hora do treino', undefined, 2.4);
      d.loop(p, 'levantarPeso');
      for (let i = 0; i < 4; i++) { d.fx('suor', p.headWorld().x, p.headWorld().y, 2, { speed: 120, size: 7, life: 0.9 }); await d.wait(0.6); }
      d.loop(p, 'rosca');
      await d.wait(1.6);
      d.loop(p, 'vitoria');
      d.emote(p, 'estrela');
      d.sfx('levelUp');
      await d.wait(1.2);
    },
  },
  {
    id: 'balada',
    env: 'balada',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, turn: 0.45 });
      const friends = c.others.slice(0, 2).map((m, i) => O(d, m, i ? 820 : 460, { facing: i ? -1 : 1, motion: i ? 'dancar3' : 'dancar2' }));
      const others = crowd(d, 5, 180, 1100, 99, 'dancar', { scale: 0.85 });
      d.caption('Noite na balada', undefined, 2.4);
      d.loop(p, 'dancar');
      others.forEach((o, i) => d.loop(o, ['dancar', 'dancar2', 'dancar3'][i % 3]));
      for (let i = 0; i < 6; i++) { d.fx('musica', 640 + rng.range(-300, 300), 250, 2); await d.wait(0.5); }
      d.loop(p, 'dancar2');
      await d.wait(1.5);
      void friends;
    },
  },
  {
    id: 'show',
    env: 'palco',
    run: async (d, c) => {
      const perform = !!c.data?.palco;
      const p = P(d, c, 640, { facing: 1, turn: 0.2, y: GROUND - 20 });
      d.caption(perform ? 'No palco!' : 'Show ao vivo', c.data?.sub, 2.6);
      d.loop(p, perform ? (c.data?.violao ? 'tocarViolao' : 'cantar') : 'dancar2');
      for (let i = 0; i < 8; i++) { d.fx('musica', 640 + rng.range(-200, 200), 280, 2); d.fx('brilho', 640 + rng.range(-500, 500), rng.range(100, 400), 1, { speed: 20 }); await d.wait(0.45); }
      if (perform) { d.sfx('applause'); d.loop(p, 'reverencia'); d.act(p, 'reverencia'); }
      await d.wait(1.5);
    },
  },
  {
    id: 'medico',
    env: 'hospital',
    run: async (d, c) => {
      const doc = O(d, other(c, 0, 41, undefined, 45), 700, { facing: -1, outfit: { top: 'jaleco', topColor: '#5ec3e8' } });
      const p = P(d, c, 380, { facing: 1, outfit: { top: 'camisola' }, motion: 'deitadoDoente', turn: 0.3, z: 1 });
      lieOn(p, 110);
      d.prop('cobertor', 470, GROUND - 100, { z: 2 });
      d.caption(c.data?.titulo ?? 'Consulta médica', c.data?.sub, 2.8);
      await d.walk(doc, 560);
      doc.facing = -1;
      doc.propN = 'lupa';
      d.loop(doc, 'pensando');
      await d.wait(1.2);
      doc.propN = undefined;
      await d.say(doc, c.data?.fala ?? 'Vamos cuidar de você.', 2);
      if (c.data?.good) { d.loop(doc, 'joinha'); d.expr(p, 'feliz'); d.sfx('chime'); }
      else { d.loop(doc, 'triste'); d.expr(p, 'triste'); d.sfx('heartbeat'); }
      await d.wait(1.5);
    },
  },
  {
    id: 'visitaHospital',
    env: 'hospital',
    run: async (d, c) => {
      const p = P(d, c, 380, { facing: 1, outfit: { top: 'camisola' }, motion: 'deitadoDoente', turn: 0.3, z: 1 });
      lieOn(p, 110);
      d.prop('cobertor', 470, GROUND - 100, { z: 2 });
      const fam = c.others.slice(0, 2).map((m, i) => O(d, m, 1200 + i * 100, { facing: -1 }));
      d.caption('Visita no hospital', undefined, 2.6);
      for (const [i, f] of fam.entries()) {
        f.propN = i === 0 ? 'buque' : undefined;
        d.walk(f, 600 + i * 150);
      }
      await d.wait(2.2);
      fam.forEach((f) => { f.lookAt = p; f.facing = -1; d.loop(f, 'triste'); });
      if (fam[0]) await d.say(fam[0], 'Melhoras! Estamos aqui com você.', 2);
      d.expr(p, 'feliz');
      d.hearts(p.x + 40, 400, 5);
      await d.wait(1.5);
    },
  },
  {
    id: 'tropeco',
    env: 'ruaDia',
    run: async (d, c) => {
      const p = P(d, c, 200, { facing: 1 });
      p.propN = 'celular';
      d.loop(p, 'mexerCelular');
      await d.wait(0.2);
      p.speed = 110;
      await d.walk(p, 620);
      d.emote(p, 'exclamacao');
      p.propN = undefined;
      await d.act(p, 'cair');
      d.expr(p, 'tonto', 3);
      for (let i = 0; i < 3; i++) { d.fx('estrela', p.x + 40, GROUND - 70, 2, { speed: 60, size: 9 }); await d.wait(0.4); }
      const passer = O(d, npc(1234, undefined, 40), 1100, { facing: -1 });
      await d.walk(passer, 820);
      d.loop(passer, 'rir');
      d.sfx('laugh');
      await d.wait(1.2);
    },
  },
  {
    id: 'ferias',
    env: 'praia',
    run: async (d, c) => {
      const p = P(d, c, 500, { facing: 1, outfit: { top: 'banho', bottom: 'bermuda', shoes: 'descalco', glasses: 'escuro' } });
      d.caption('Férias na praia!', c.data?.sub, 2.8);
      d.loop(p, 'feliz');
      await d.wait(0.8);
      await d.act(p, 'pular');
      d.fx('bolha', p.x, GROUND - 40, 8, { speed: 80 });
      d.sfx('splash');
      p.propN = 'sorvete';
      d.loop(p, 'feliz');
      await d.wait(1);
      p.propN = undefined;
      d.loop(p, 'dancar3');
      await d.wait(1.4);
    },
  },
  {
    id: 'acampar',
    env: 'acampamento',
    run: async (d, c) => {
      d.prop('fogueira', 640, GROUND + 8, { z: 2 });
      const p = P(d, c, 520, { facing: 1, motion: 'sentarChao' });
      const f = c.others[0] ? O(d, c.others[0], 780, { facing: -1, motion: 'tocarViolao' }) : null;
      d.caption('Noite de acampamento', undefined, 2.6);
      if (!f) d.loop(p, 'tocarViolao');
      for (let i = 0; i < 6; i++) { d.fx('musica', 640, 380, 1); await d.wait(0.5); }
      d.expr(p, 'feliz');
      d.emote(p, 'musica');
      await d.wait(1.2);
    },
  },
  {
    id: 'cassino',
    env: 'cassino',
    run: async (d, c) => {
      const slot = d.prop('caçaNiquel', 780, GROUND, { z: -1, opts: { state: 1 } });
      const p = P(d, c, 620, { facing: 1, motion: 'nervoso' });
      d.caption('Cassino', 'Tudo ou nada!', 2.4);
      d.sfx('tick');
      await d.wait(2.2);
      const win = c.data?.win === true;
      slot.opts = { state: 0, variant: win ? 1 : 0 };
      if (win) {
        d.sfx('cash');
        d.loop(p, 'comemorar');
        d.fx('moeda', 780, GROUND - 150, 40, { speed: 380, dir: -Math.PI / 2, cone: 1.6, life: 2.5, size: 9, ground: GROUND + 10 });
        d.flash('#fff3b0', 0.6);
        await d.wait(2.4);
      } else {
        d.sfx('fail');
        d.loop(p, 'facepalm');
        d.emote(p, 'reticencias');
        await d.wait(2);
      }
    },
  },
  {
    id: 'loteria',
    env: 'sala',
    run: async (d, c) => {
      d.prop('tv', 1000, GROUND - 20, { z: -1 });
      const p = P(d, c, 640, { facing: 1 });
      p.propN = 'papel';
      d.loop(p, 'ler');
      d.caption('Resultado da loteria', undefined, 2.4);
      await d.wait(1.6);
      const win = c.data?.win === true;
      if (win) {
        d.emote(p, 'exclamacao');
        d.expr(p, 'surpreso', 1);
        await d.wait(0.8);
        p.propN = undefined;
        d.loop(p, 'comemorar');
        d.sfx('cash');
        d.flash('#fff3b0', 0.7);
        for (let i = 0; i < 3; i++) { d.fx('nota', 640, -20, 25, { w: 900, speed: 40, dir: Math.PI / 2, life: 4, size: 11, ground: GROUND + 30 }); await d.wait(0.5); }
        d.caption('GANHOU!', c.data?.valor, 3);
        await d.wait(1.5);
      } else {
        d.expr(p, 'triste');
        p.propN = undefined;
        d.loop(p, 'darOmbros');
        await d.say(p, 'Quem sabe na próxima...', 1.6);
      }
    },
  },
  {
    id: 'crime',
    env: 'ruaNoite',
    run: async (d, c) => {
      const p = P(d, c, 200, { facing: 1, outfit: { top: 'moletom', topColor: '#23242b', hat: 'gorro', hatColor: '#23242b' } });
      d.caption(c.data?.titulo ?? 'Plano arriscado', undefined, 2.4);
      d.loop(p, 'agachar');
      d.sc.night = 0.15;
      await d.moveActor(p, 560, GROUND, 2.2);
      d.emote(p, 'suor');
      await d.wait(0.6);
      p.propN = 'dinheiro';
      d.sfx('coin');
      d.loop(p, 'parado');
      await d.wait(0.4);
      const caught = c.data?.caught === true;
      if (caught) {
        d.sfx('siren');
        const car = d.prop('viatura', 1600, GROUND + 10, { z: 1, scale: 1.55, opts: { flip: true } });
        await d.moveProp(car, 1080, GROUND + 10, 1.2, Ease.outCubic);
        d.loop(p, 'susto');
        const cop = O(d, npc(555, undefined, 38), 900, { facing: -1, outfit: { top: 'policial', hat: 'quepe' }, motion: 'apontar' });
        await d.say(cop, 'Parado! Mãos pra cima!', 1.8, 'grito');
        p.propN = undefined;
        d.loop(p, 'susto');
      } else {
        await d.walk(p, 1400, true);
      }
    },
  },
  {
    id: 'abordagem',
    env: 'delegacia',
    run: async (d, c) => {
      d.prop('viatura', 1000, GROUND + 10, { z: -1, scale: 1.55, opts: { flip: true } });
      const cop = O(d, npc(556, undefined, 38), 760, { facing: -1, outfit: { top: 'policial', hat: 'quepe' }, motion: 'apontar' });
      const p = P(d, c, 560, { facing: 1, motion: 'susto' });
      d.caption('Preso(a)!', undefined, 2.4);
      d.sfx('siren');
      await d.say(cop, 'Você tem o direito de permanecer calado.', 2.2);
      d.loop(p, 'triste');
      await d.wait(1.2);
      void cop;
    },
  },
  {
    id: 'julgamento',
    env: 'tribunal',
    run: async (d, c) => {
      const judge = d.add(npc(601, undefined, 60).ap, 60, { x: 640, y: GROUND - 120, scale: 0.9, z: -3, outfit: { top: 'beca' }, turn: 0.15 });
      d.prop('bancadaJuiz', 640, GROUND - 70, { z: -2 });
      const p = P(d, c, 330, { facing: 1, outfit: { top: 'presidiario' }, motion: 'nervoso', z: 1 });
      d.caption('Julgamento', undefined, 2.4);
      await d.say(judge, c.data?.fala ?? 'O tribunal chegou a um veredito...', 2.2);
      d.act(judge, 'bater');
      await d.wait(0.6);
      if (c.data?.guilty) { d.loop(p, 'chorar'); d.sfx('sad'); }
      else { d.loop(p, 'comemorar'); d.sfx('success'); }
      await d.wait(1.8);
    },
  },
  {
    id: 'cela',
    env: 'prisao',
    run: async (d, c) => {
      const p = P(d, c, 700, { facing: -1, outfit: { top: 'presidiario' }, motion: 'triste' });
      d.caption(c.data?.titulo ?? 'Atrás das grades', c.data?.sub, 2.8);
      await d.wait(1);
      d.loop(p, 'sentarChao');
      d.emote(p, 'reticencias');
      await d.wait(1.5);
    },
  },
  {
    id: 'filho',
    env: 'maternidade',
    run: async (d, c) => {
      const baby = c.others[0] ?? npc(71, undefined, 0);
      const p = P(d, c, 620, { facing: 1, motion: 'segurarBebe' });
      const partner = c.others[1] ? O(d, c.others[1], 880, { facing: -1, motion: 'aplaudir' }) : null;
      const b = d.add(baby.ap, 0, { x: 0, motion: 'deitado', z: 1, turn: 0.4 });
      b.visible = false;
      d.focus(680, 330, 1.25);
      await d.wait(0.5);
      const place = () => {
        const h = p.handWorld(true), h2 = p.handWorld(false);
        b.x = (h.x + h2.x) / 2 - 10;
        b.elev = GROUND - (h.y + h2.y) / 2 - legLength(b.d) * b.scale + 4;
      };
      d.sc.onBeat = () => place();
      place();
      b.visible = true;
      d.flash('#fff6e0', 0.8);
      d.sfx('chime');
      d.caption(`Nasceu ${baby.name || 'seu bebê'}!`, 'Você agora é ' + (c.player.sex === 'f' ? 'mãe' : 'pai'), 3.5);
      d.hearts(680, 300, 10);
      await d.wait(1.6);
      if (partner) d.loop(partner, 'comemorar');
      d.hearts(680, 280, 6);
      await d.wait(1.6);
      d.resetCam();
    },
  },
  {
    id: 'pet',
    env: (c) => c.data?.env ?? 'parque',
    run: async (d, c) => {
      const p = P(d, c, 560, { facing: 1 });
      const kind = c.data?.kind ?? 'cachorro';
      const pet = d.prop(kind, 1500, GROUND, { z: 1, opts: { color: c.data?.color, flip: true, state: 1 } });
      d.caption(c.data?.titulo ?? 'Novo amigo!', c.data?.nome, 2.8);
      pet.opts.flip = true;
      await d.moveProp(pet, 760, GROUND, 2, Ease.outQuad);
      pet.opts.state = 0;
      pet.opts.variant = 1;
      d.emote(p, 'coracao');
      d.loop(p, 'agachar');
      d.hearts(700, GROUND - 120, 8);
      d.sfx('heart');
      await d.wait(1.6);
      d.loop(p, 'comemorar');
      await d.wait(1.2);
    },
  },
  {
    id: 'passeioPet',
    env: 'parque',
    run: async (d, c) => {
      const p = P(d, c, 100, { facing: 1 });
      const kind = c.data?.kind ?? 'cachorro';
      const pet = d.prop(kind, 250, GROUND, { z: 1, opts: { color: c.data?.color, state: 1 } });
      p.speed = 120;
      d.caption('Passeio no parque', undefined, 2.4);
      d.moveProp(pet, 900, GROUND, 5.2, Ease.linear);
      await d.walk(p, 760);
      pet.opts.state = 0;
      d.loop(p, 'feliz');
      d.emote(p, 'musica');
      await d.wait(1.2);
    },
  },
  {
    id: 'funeral',
    env: 'cemiterio',
    run: async (d, c) => {
      d.prop('lapide', 640, GROUND - 10, { z: -1, opts: { state: 1 } });
      const blackOut = { top: 'blazer', topColor: '#1b1c22', topColor2: '#1b1c22', bottom: 'calca', bottomColor: '#1b1c22' };
      const p = P(d, c, 460, { facing: 1, outfit: blackOut, motion: 'triste' });
      const mourners = c.others.slice(0, 3).map((m, i) => O(d, m, 800 + i * 110, { facing: -1, outfit: blackOut, motion: i % 2 ? 'rezar' : 'triste' }));
      p.propF = 'guardaChuva';
      d.caption('Adeus, ' + (c.data?.nome ?? 'querido(a)'), c.data?.sub, 3.4);
      d.sfx('sad');
      await d.wait(1.5);
      d.loop(p, 'chorar');
      d.focus(560, 330, 1.2);
      await d.wait(2);
      d.loop(p, 'rezar');
      d.resetCam();
      await d.wait(1);
      void mourners;
    },
  },
  {
    id: 'morte',
    env: 'ceu',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, turn: 0.3, motion: 'rezar' });
      p.alpha = 0;
      d.caption('Descanse em paz', `${c.player.name} (${c.data?.idade ?? c.player.age} anos)`, 4);
      d.sfx('magic');
      await d.fadeActor(p, 0.85, 1.2);
      d.loop(p, 'meditar');
      await d.sc.tween(3, (k) => (p.elev = k * 120), Ease.inOutSine);
      d.fx('brilho', p.x, p.topWorld() + 60, 20, { speed: 120 });
    },
  },
  {
    id: 'meditar',
    env: 'zen',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, turn: 0.2, motion: 'meditar' });
      d.caption('Paz interior', undefined, 2.6);
      for (let i = 0; i < 6; i++) { d.fx('brilho', p.x + rng.range(-100, 100), GROUND - rng.range(50, 250), 1, { speed: 20 }); await d.wait(0.5); }
      d.emote(p, 'estrela');
      await d.wait(1);
    },
  },
  {
    id: 'brigaFamilia',
    env: 'cozinha',
    run: async (d, c) => {
      const par = O(d, other(c, 0, 81, undefined, 45), 780, { facing: -1, motion: 'maosNaCintura' });
      const p = P(d, c, 520, { facing: 1 });
      faceEach(p, par);
      d.caption('Discussão em família', undefined, 2.4);
      await physical(d, p, par, 'discutir');
      await d.wait(0.6);
    },
  },
  {
    id: 'interacao',
    env: (c) => c.data?.env ?? 'sala',
    run: async (d, c) => {
      const p = P(d, c, 460, { facing: 1 });
      const o = O(d, other(c, 0, 90), 820, { facing: -1 });
      faceEach(p, o);
      await d.wait(0.3);
      await physical(d, p, o, c.data?.action ?? 'conversar');
      await d.wait(0.6);
    },
  },
  {
    id: 'cinema',
    env: 'cinema',
    run: async (d, c) => {
      const p = P(d, c, 560, { facing: 1, turn: 0.1, y: GROUND - 20, motion: 'sentarFeliz' });
      const o = c.others[0] ? O(d, c.others[0], 720, { facing: 1, turn: 0.1, y: GROUND - 20, motion: 'sentarFeliz' }) : null;
      d.caption('Sessão de cinema', c.data?.filme, 2.8);
      await d.wait(1.5);
      d.expr(p, 'surpreso', 1);
      d.emote(p, 'exclamacao');
      await d.wait(1.2);
      d.expr(p, 'rindo', 2);
      d.sfx('laugh');
      if (o) { d.expr(o, 'rindo', 2); d.hearts(640, 300, 4); }
      await d.wait(1.5);
    },
  },
  {
    id: 'casaNova',
    env: 'suburbio',
    run: async (d, c) => {
      d.prop('placaVendido', 960, GROUND, { z: -1 });
      const p = P(d, c, 300, { facing: 1 });
      const fam = c.others.slice(0, 2).map((m, i) => O(d, m, 200 - i * 90, { facing: 1 }));
      d.caption('Casa nova!', c.data?.nome, 3);
      fam.forEach((f, i) => d.walk(f, [440, 820][i] ?? 900));
      await d.walk(p, 620);
      p.facing = -1;
      d.loop(p, 'comemorar');
      fam.forEach((f) => d.loop(f, 'aplaudir'));
      d.sfx('success');
      d.confetti(70);
      await d.wait(2.2);
    },
  },
  {
    id: 'carroNovo',
    env: 'concessionaria',
    run: async (d, c) => {
      const car = d.prop('carro', 820, GROUND, { z: -1, scale: 1.6, opts: { color: c.data?.cor ?? '#e4572e' } });
      const p = P(d, c, 420, { facing: 1 });
      d.caption('Carro novo!', c.data?.nome, 3);
      d.fx('brilho', 760, GROUND - 120, 14, { speed: 160 });
      d.sfx('sparkle');
      d.loop(p, 'comemorar');
      await d.wait(1.6);
      d.loop(p, 'joinha');
      d.sfx('engine');
      car.opts.state = 1;
      await d.wait(0.3);
      await d.moveProp(car, 1700, GROUND, 1.6, Ease.inCubic);
      d.loop(p, 'acenar');
      await d.wait(0.6);
    },
  },
  {
    id: 'viagem',
    env: 'aeroporto',
    run: async (d, c) => {
      d.prop('mala', 460, GROUND, { z: 1, opts: { color: '#9b5de5' } });
      const p = P(d, c, 520, { facing: 1, outfit: { glasses: 'aviador', hat: 'bone' } });
      d.caption(c.data?.titulo ?? 'Partiu viagem!', c.data?.destino, 3);
      d.loop(p, 'acenar');
      await d.wait(1.5);
      d.loop(p, 'feliz');
      await d.walk(p, 1350);
    },
  },
  {
    id: 'aposentadoria',
    env: 'escritorio',
    run: async (d, c) => {
      d.prop('bolo', 640, GROUND + 6, { z: 2, scale: 0.8, opts: { state: 1 } });
      d.prop('baloes', 300, GROUND - 40, { z: -2 });
      const p = P(d, c, 520, { facing: 1 });
      const team = crowd(d, 4, 760, 1200, 45, 'aplaudir', { scale: 0.9 });
      d.caption('Aposentadoria!', 'Missão cumprida', 3);
      d.sfx('applause');
      await d.say(p, 'Obrigado(a) por tudo, pessoal!', 1.8);
      d.loop(p, 'acenar');
      team.forEach((t) => d.loop(t, 'comemorar'));
      d.confetti(80);
      await d.wait(2);
    },
  },
  {
    id: 'cozinhar',
    env: 'cozinha',
    run: async (d, c) => {
      const stove = d.prop('fogao', 640, GROUND - 60, { z: -1, opts: { state: 0 } });
      stove.visible = false;
      const p = P(d, c, 520, { facing: -1, outfit: c.data?.chef ? { top: 'chef', hat: 'chefe' } : undefined, motion: 'cozinhar', z: 1 });
      d.caption(c.data?.titulo ?? 'Mão na massa', undefined, 2.4);
      await d.wait(1.8);
      if (c.data?.fogo) {
        const f = d.prop('fogo', 335, GROUND - 222, { z: -0.5 });
        d.sfx('fire');
        d.loop(p, 'susto');
        d.emote(p, 'exclamacao');
        for (let i = 0; i < 6; i++) { d.fx('fumaca', 360, GROUND - 230, 3, { speed: 40, size: 18, life: 2.5 }); await d.wait(0.35); }
        d.sc.props = d.sc.props.filter((x) => x !== f);
        d.loop(p, 'facepalm');
        await d.wait(1);
      } else {
        d.fx('brilho', 360, GROUND - 220, 8, { speed: 100 });
        d.loop(p, 'joinha');
        d.sfx('chime');
        await d.wait(1.4);
      }
    },
  },
  {
    id: 'estudar',
    env: 'biblioteca',
    run: async (d, c) => {
      d.prop('mesa', 700, GROUND + 6, { z: 1, opts: { color: '#8a5a3a' } });
      d.prop('livrosPilha', 740, GROUND - 80, { z: 1.5 });
      d.prop('cadeira', 566, GROUND, { z: -0.5, opts: { color: '#5a3a24' } });
      const p = P(d, c, 580, { facing: 1, motion: 'lerSentado' });
      d.caption('Estudando', undefined, 2.4);
      await d.wait(1.8);
      d.emote(p, 'ideia');
      d.sfx('sparkle');
      d.loop(p, 'sentarFeliz');
      await d.wait(1.2);
    },
  },
  {
    id: 'pintar',
    env: 'parque',
    run: async (d, c) => {
      const easel = d.prop('cavalete', 760, GROUND, { z: -0.5, opts: { state: 0 } });
      const p = P(d, c, 600, { facing: 1, motion: 'pintar' });
      d.caption('Momento artístico', undefined, 2.4);
      await d.sc.tween(3, (k) => (easel.opts.state = k));
      d.loop(p, 'vitoria');
      d.emote(p, 'estrela');
      d.sfx('chime');
      await d.wait(1.2);
    },
  },
  {
    id: 'videogame',
    env: 'quarto',
    run: async (d, c) => {
      d.prop('tv', 1000, GROUND - 10, { z: -0.5 });
      d.prop('cadeira', 686, GROUND, { z: -0.5, opts: { color: '#c2273d' } });
      const p = P(d, c, 700, { facing: 1, motion: 'jogarVideogame', turn: 0.5 });
      d.caption('Jogatina', undefined, 2.2);
      await d.wait(2.2);
      if (c.data?.win !== false) { d.loop(p, 'comemorar'); d.sfx('levelUp'); }
      else { d.loop(p, 'furia'); d.emote(p, 'raiva'); }
      await d.wait(1.4);
    },
  },
  {
    id: 'reflexao',
    env: (c) => c.data?.env ?? 'ruaChuva',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, motion: c.data?.motion ?? 'triste' });
      d.caption(c.data?.titulo ?? 'Um momento difícil', c.data?.sub, 2.8);
      d.focus(640, 330, 1.2);
      await d.wait(2.5);
      d.resetCam();
    },
  },
  {
    id: 'comemoracao',
    env: (c) => c.data?.env ?? 'sala',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, motion: 'comemorar' });
      d.caption(c.data?.titulo ?? 'Que notícia boa!', c.data?.sub, 2.8);
      d.sfx('success');
      d.confetti(80);
      await d.wait(2.2);
      d.loop(p, 'feliz');
    },
  },
  {
    id: 'telefonema',
    env: (c) => c.data?.env ?? 'sala',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1, motion: 'telefone' });
      d.caption(c.data?.titulo ?? 'Telefonema', c.data?.sub, 2.6);
      await d.say(p, c.data?.fala ?? 'Alô? Sério?!', 1.8);
      d.loop(p, c.data?.good === false ? 'chorar' : 'comemorar');
      await d.wait(1.6);
    },
  },
  {
    id: 'dirigir',
    env: 'ruaDia',
    run: async (d, c) => {
      const car = d.prop('carro', -400, GROUND, { z: 1, scale: 1.6, opts: { color: c.data?.cor ?? '#3d7bd9', state: 1 } });
      const inst = O(d, npc(1500, undefined, 50), 900, { facing: -1, motion: 'bracosCruzados' });
      d.caption('Prova de direção', undefined, 2.4);
      d.sfx('engine');
      await d.moveProp(car, 640, GROUND, 2.2, Ease.outCubic);
      car.opts.state = 0;
      const p = P(d, c, 560, { facing: 1 });
      p.alpha = 0;
      await d.fadeActor(p, 1, 0.3);
      await d.walk(p, 760);
      if (c.data?.ok !== false) { d.loop(inst, 'joinha'); await d.say(inst, 'Aprovado(a)!', 1.4); d.loop(p, 'comemorar'); d.sfx('success'); }
      else { d.loop(inst, 'darOmbros'); await d.say(inst, 'Reprovado(a). Tente de novo.', 1.6); d.loop(p, 'triste'); }
      await d.wait(1.2);
    },
  },
];

export const SITUATIONS: Record<string, Situation> = Object.fromEntries(S.map((s) => [s.id, s]));
export { npc };
void sfx;
