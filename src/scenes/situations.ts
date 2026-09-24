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
      d.act(b, 'cair').then(() => d.loop(b, 'caidoChao'));
      d.expr(b, 'tonto', 3);
      await d.wait(1.2);
      d.emote(b, 'estrela');
      d.loop(a, 'ofegante');
      d.expr(a, 'serio');
      await d.wait(1);
      d.resetCam();
      break;
    }
    case 'piada': {
      await close(170);
      d.loop(a, 'contarPiada');
      await d.say(a, d.sc.meta?.piada ?? 'Sabe o que o zero disse pro oito?', 2.4);
      if (d.sc.meta?.ok !== false) { d.loop(b, 'rir'); d.sfx('laugh'); d.loop(a, 'rir'); }
      else { d.loop(b, 'bracosCruzados'); d.expr(b, 'cansado'); d.emote(b, 'reticencias'); d.loop(a, 'nervoso'); d.expr(a, 'envergonhado'); }
      await d.wait(1.8);
      break;
    }
    case 'fofocar': {
      await close(95);
      d.loop(a, 'cochichar'); d.loop(b, 'cochichar');
      d.look(a, b); d.look(b, a);
      await d.say(a, 'Você não sabe da maior...', 1.6, 'pensa');
      d.expr(b, 'chocado', 1.5);
      d.emote(b, 'exclamacao');
      await d.wait(1.4);
      d.loop(b, 'rir');
      await d.wait(1);
      break;
    }
    case 'consolar': {
      d.loop(b, 'chorar');
      await close(95);
      d.loop(a, 'consolar');
      await d.say(a, 'Vai ficar tudo bem. Tô aqui.', 2);
      await d.wait(1);
      d.loop(b, 'triste');
      break;
    }
    case 'desculpas': {
      await close(150);
      d.loop(b, 'bracosCruzados');
      d.loop(a, 'desculpas');
      await d.say(a, 'Me desculpa. De verdade.', 2);
      if (d.sc.meta?.ok !== false) { d.loop(b, 'parado'); d.expr(b, 'triste', 1.5); await d.wait(0.6); await physical(d, a, b, 'abracar'); }
      else { d.loop(b, 'apontarBronca'); await d.say(b, 'Desculpa não conserta nada.', 1.8, 'grito'); b.lookAt = null; await d.walk(b, b.x + b.facing * -500); d.loop(a, 'triste'); }
      break;
    }
    case 'massagem': {
      const chair = d.prop('cadeira', b.x, GROUND, { z: b.z - 0.3, opts: { color: '#7a5236', flip: b.facing < 0 } });
      void chair;
      d.loop(b, 'sentarFeliz');
      d.expr(b, 'dormindo');
      a.x = b.x - b.facing * 70;
      a.facing = b.facing;
      a.z = b.z + 1;
      d.loop(a, 'massagem');
      await d.wait(2.4);
      d.expr(b, 'apaixonado', 2);
      d.hearts(b.x, b.headWorld().y - 30, 5);
      await d.wait(1.2);
      break;
    }
    case 'serenata': {
      a.propF = undefined;
      d.loop(a, 'tocarViolao');
      for (let i = 0; i < 5; i++) { d.fx('musica', a.x, a.topWorld(), 1); await d.wait(0.5); }
      if (d.sc.meta?.ok !== false) { d.loop(b, 'feliz'); d.expr(b, 'apaixonado', 3); d.hearts(b.x, b.headWorld().y - 20, 8); d.sfx('heart'); }
      else { d.loop(b, 'facepalm'); d.fx('poeira', a.x, a.topWorld() - 60, 1); d.sfx('thud'); d.expr(a, 'envergonhado', 3); }
      await d.wait(1.6);
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
      const mood = c.data?.mood as string | undefined;
      const moodIdle = mood === 'triste' ? 'triste' : mood === 'feliz' ? 'feliz' : mood === 'tenso' ? 'bracosCruzados' : mood === 'ferido' ? 'olhoRoxo' : 'parado';
      const moodFam = mood === 'tenso' || mood === 'ferido' ? ['bracosCruzados', 'pensando', 'mexerCelular', 'apontarBronca'] : null;
      if (age >= 3) d.loop(p, moodIdle);
      if (mood === 'ferido' && age >= 3) d.expr(p, 'dor');
      if (mood === 'tenso' && age >= 3) d.expr(p, 'serio');
      // vida ambiente (não bloqueia o roteiro)
      const sc = d.sc;
      const IDLE = moodFam ?? ['acenar', 'rir', 'mexerCelular', 'cafe', 'ler', 'darOmbros', 'pensando', 'dancar3', 'feliz', 'bracosCruzados'];
      const PIDLE = mood === 'ferido' ? ['olhoRoxo', 'dor', 'sentarCabisbaixo'] : mood === 'tenso' ? ['bracosCruzados', 'pensando', 'mexerCelular', 'furia'] : mood === 'triste' ? ['triste', 'mexerCelular', 'pensando'] : ['feliz', 'mexerCelular', 'cafe', 'pensando', 'rir'];
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
            const m = rng.pick(who === p ? PIDLE : IDLE);
            d.loop(who, m);
            if (m === 'rir') d.fx('musica', who.headWorld().x, who.topWorld(), 1);
            await d.wait(rng.range(2.5, 4.5));
            if (!sc.alive) break;
            d.loop(who, who === p ? moodIdle : 'parado');
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
    env: 'loterica',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: 1 });
      p.propN = 'bilheteLoteria';
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
      d.sc.meta = c.data;
      const p = P(d, c, 460, { facing: 1 });
      const o = O(d, other(c, 0, 90), 820, { facing: -1 });
      faceEach(p, o);
      await d.wait(0.3);
      await physical(d, p, o, c.data?.action ?? 'conversar');
      await d.wait(0.6);
    },
  },
  // ================================================================ agressões e consequências
  {
    id: 'agressao',
    env: (c) => c.data?.env ?? 'sala',
    run: async (d, c) => {
      const k = c.data?.kind as string;
      const p = P(d, c, 460, { facing: 1, z: 1 });
      const v = O(d, other(c, 0, 93), 820, { facing: -1, z: 0.5 });
      faceEach(p, v);
      d.expr(p, 'bravo');
      d.expr(v, 'serio');
      const close = async (gap: number) => {
        const mid = (p.x + v.x) / 2;
        await Promise.all([d.walk(p, mid - gap / 2), d.walk(v, mid + gap / 2)]);
        faceEach(p, v);
      };
      let onGround = false;
      if (c.data?.ctx === 'escola' || k === 'humilhar') {
        const kids = crowd(d, 3, 180, 1100, 404, 'rirDe', { age: c.player.age, scale: 0.85, z: -1 });
        kids.forEach((kk) => { kk.facing = kk.x < 640 ? 1 : -1; if (k !== 'humilhar') { kk.play('susto'); } });
      }
      switch (k) {
        case 'xingar': {
          await close(180);
          d.loop(p, 'apontarBronca');
          await d.say(p, rng.pick(['Seu verme!', 'Vai catar coquinho!', 'Mala sem alça!', 'Pé de pano!', 'Sua anta!']), 1.8, 'grito');
          d.expr(v, 'chocado', 1.4);
          break;
        }
        case 'pegadinha': {
          const chair = d.prop('cadeira', v.x + 12, GROUND, { z: 0.2, opts: { color: '#3d7bd9', flip: true } });
          d.loop(v, 'sentar');
          await d.wait(0.6);
          await d.walk(p, v.x + 70);
          p.facing = -1;
          d.loop(p, 'roubar');
          await d.wait(0.6);
          d.moveProp(chair, chair.x + 90, GROUND, 0.3, Ease.outQuad);
          await d.act(v, 'cair');
          d.sfx('thud');
          d.loop(v, 'caidoChao');
          onGround = true;
          d.loop(p, 'rirDe');
          p.facing = -1;
          await d.wait(1.6);
          break;
        }
        case 'empurrar': {
          await close(110);
          await d.act(p, 'empurrar');
          d.moveActor(v, v.x + 70, v.y, 0.35, Ease.outQuad);
          await d.act(v, 'estremecer');
          break;
        }
        case 'jogarBebida': {
          await close(125);
          await d.act(p, 'jogarBebida');
          const h = v.headWorld();
          d.fx('bolha', h.x, h.y, 16, { speed: 220, size: 10, life: 0.8, color: 'rgba(160,210,255,0.9)' });
          d.fx('suor', h.x, h.y, 10, { speed: 160, size: 9, life: 0.9 });
          d.sfx('splash');
          d.loop(v, 'molhado');
          await d.wait(1.6);
          break;
        }
        case 'humilhar': {
          await close(200);
          d.loop(p, 'rirDe');
          await d.say(p, 'Olha só pra isso, gente! HAHAHA', 2, 'grito');
          d.loop(v, 'humilhado');
          d.sfx('laugh');
          await d.wait(1.4);
          break;
        }
        case 'tapa': {
          await close(110);
          await d.act(p, 'tapa');
          await d.act(v, 'estremecer');
          d.expr(v, 'chocado', 1.5);
          break;
        }
        case 'roubar': {
          v.facing = 1;
          v.lookAt = null;
          d.loop(v, 'mexerCelular');
          p.x = 260;
          d.loop(p, 'roubar');
          await d.moveActor(p, v.x - 70, GROUND, 1.8, Ease.inOutSine);
          d.emote(p, 'dinheiro');
          await d.wait(0.6);
          if (c.data?.caught) {
            v.facing = -1;
            d.emote(v, 'exclamacao');
            d.loop(v, 'apontarBronca');
            await d.say(v, 'LADRÃO! PEGA LADRÃO!', 1.8, 'grito');
            d.loop(p, 'susto');
          } else {
            p.propN = 'dinheiro';
            await d.walk(p, -200, true);
          }
          break;
        }
        default: {
          // soco / chute / cabeçada
          await close(k === 'cabecada' ? 92 : 125);
          d.loop(v, 'lutar');
          d.focus((p.x + v.x) / 2, 360, 1.2);
          if (c.data?.dodged) {
            const hit = d.act(p, k === 'chute' ? 'chute' : k === 'cabecada' ? 'cabecada' : 'socoForte');
            await d.wait(0.28);
            d.moveActor(v, v.x + 60, v.y, 0.2, Ease.outQuad);
            await hit;
            await d.act(p, 'cair');
            d.loop(p, 'caidoChao');
            d.expr(p, 'envergonhado');
            d.loop(v, 'rirDe');
            d.sfx('laugh');
            await d.wait(1.4);
            await d.act(p, 'levantarChao');
            d.loop(p, 'humilhado');
          } else {
            await d.act(p, k === 'chute' ? 'chute' : k === 'cabecada' ? 'cabecada' : 'socoForte');
            if (c.data?.injured || !c.data?.retaliate) {
              await d.act(v, 'cair');
              d.loop(v, 'caidoChao');
              onGround = true;
              d.emote(v, 'estrela');
            } else {
              await d.act(v, 'estremecer');
            }
          }
          d.resetCam();
        }
      }
      // ------------------------ desfecho
      if (c.data?.retaliate) {
        if (onGround) await d.act(v, 'levantarChao');
        d.loop(v, 'lutar');
        d.expr(v, 'furioso');
        faceEach(p, v);
        const gap = Math.abs(v.x - p.x);
        if (gap > 140) await d.walk(v, p.x + (v.x > p.x ? 125 : -125));
        faceEach(p, v);
        d.focus((p.x + v.x) / 2, 360, 1.2);
        await d.act(v, 'socoForte');
        await d.act(p, 'cair');
        d.loop(p, 'caidoChao');
        d.emote(p, 'estrela');
        d.loop(v, 'ofegante');
        d.expr(v, 'bravo');
        await d.wait(1.6);
        await d.act(p, 'levantarChao');
        d.loop(p, 'olhoRoxo');
        d.resetCam();
      } else if (c.data?.injured) {
        d.expr(v, 'dor');
        d.loop(p, 'ofegante');
        d.expr(p, 'chocado');
        await d.say(p, 'Eita... acho que exagerei.', 1.8, 'pensa');
      } else if (k !== 'roubar' && k !== 'pegadinha' && !c.data?.dodged) {
        d.loop(p, 'bracosCruzados');
        d.expr(p, 'serio');
        if (k === 'humilhar') { d.loop(p, 'rirDe'); d.expr(v, 'humilhado'); }
        else if (c.player.age < 12 || v.age < 12) { d.loop(v, 'chorar'); }
        else { d.loop(v, 'furia'); d.emote(v, 'raiva'); await d.say(v, rng.pick(['Você vai se arrepender disso!', 'Isso não vai ficar assim!', 'Tá maluco(a)?!']), 1.8, 'grito'); }
      } else if (onGround) {
        await d.wait(0.8);
        await d.act(v, 'levantarChao');
        d.loop(v, 'furia');
        d.emote(v, 'raiva');
      }
      await d.wait(1.2);
    },
  },
  {
    id: 'detencao',
    env: 'escola',
    run: async (d, c) => {
      d.sc.night = 0.12;
      const prof = O(d, other(c, 1, 505, undefined, 48), 1000, { facing: -1, motion: 'bracosCruzados' });
      const p = P(d, c, 560, { facing: -1, motion: 'escreverQuadro', outfit: c.player.age < 18 ? { top: 'uniforme', topColor: '#3d7bd9', topColor2: '#f4f1ea' } : undefined });
      p.facing = 1;
      p.x = 520;
      p.turn = 0.85;
      d.caption('Detenção', 'Escreva 100 vezes', 2.8);
      const frase = (c.data?.frase as string) ?? 'Não devo agredir colegas';
      const board = d.prop('fraseQuadro', 640, 330, { z: -0.5, opts: { state: 0 } });
      (board.opts as any).text = frase;
      await d.sc.tween(3.2, (k) => (board.opts.state = k));
      d.expr(prof, 'serio');
      await d.say(prof, 'Mais 97 vezes. Com letra bonita.', 2);
      d.loop(p, 'sentarCabisbaixo');
      await d.wait(0.8);
    },
  },
  {
    id: 'diretoria',
    env: 'diretoria',
    run: async (d, c) => {
      const expulso = c.data?.tipo === 'expulsao';
      const dir = d.add(npc(707, 'f', 56).ap, 56, { x: 640, y: GROUND - 60, z: -2, scale: 0.92, turn: 0.2, motion: 'apontarBronca', outfit: { top: 'blazer', topColor: '#5b3c88', glasses: 'gatinho' } });
      const p = P(d, c, 430, { facing: 1, motion: 'sentarCabisbaixo', z: 1 });
      d.prop('cadeira', 418, GROUND, { z: 0.5, opts: { color: '#5a3a24' } });
      const par = c.others[0] ? O(d, c.others[0], 900, { facing: -1, motion: 'bracosCruzados', z: 1 }) : null;
      d.caption(expulso ? 'EXPULSÃO' : 'Suspensão', expulso ? 'Pode esvaziar o armário' : 'Pais chamados na escola', 3);
      d.expr(dir, 'bravo');
      await d.say(dir, expulso ? 'Chega. Você está EXPULSO(A) desta escola.' : 'Suspensão. E da próxima vez, é expulsão.', 2.4, 'grito');
      if (par) {
        d.expr(par, 'furioso');
        par.lookAt = p;
        await d.say(par, 'A gente conversa em casa, mocinho(a).', 2.2);
        d.loop(par, 'apontarBronca');
      }
      d.expr(p, 'humilhado');
      d.emote(p, 'suor');
      await d.wait(1.4);
    },
  },
  {
    id: 'demissaoSeguranca',
    env: (c) => c.data?.env ?? 'escritorio',
    run: async (d, c) => {
      const p = P(d, c, 640, { facing: -1, motion: 'escoltado' });
      p.propN = 'caixaPertences';
      const seg = d.add(npc(808, 'm', 40).ap, 40, { x: 780, facing: -1, scale: 1.08, motion: 'seguranca', outfit: { top: 'camiseta', topColor: '#23242b', glasses: 'escuro' } });
      d.caption('Justa causa', 'Acompanhe o segurança, por favor', 2.8);
      await d.wait(0.6);
      await d.say(seg, 'Por aqui. Sem gracinha.', 1.6);
      p.speed = 90;
      seg.speed = 90;
      d.walk(seg, -120);
      await d.walk(p, -260);
    },
  },
  {
    id: 'boletim',
    env: 'delegaciaInterna',
    run: async (d, c) => {
      const cop = d.add(npc(909, undefined, 45).ap, 45, { x: 640, y: GROUND - 60, z: -1, facing: -1, motion: 'digitar', outfit: { top: 'policial', hat: 'quepe' } });
      d.prop('cadeira', 628, GROUND - 60, { z: -1.5, opts: { color: '#3b3d44', flip: true } });
      const p = P(d, c, 330, { facing: 1, motion: 'sentarCabisbaixo', z: 1 });
      d.prop('cadeira', 318, GROUND, { z: 0.5, opts: { color: '#3b3d44' } });
      const v = c.others[0] ? O(d, c.others[0], 980, { facing: -1, motion: c.data?.injured ? 'olhoRoxo' : 'bracosCruzados', z: 1 }) : null;
      d.caption('Delegacia', 'Registro de ocorrência', 2.6);
      await d.say(cop, 'Nome completo, RG e... por que você fez isso?', 2.2);
      d.loop(p, 'darOmbros');
      await d.say(p, 'Foi mal...?', 1.2);
      if (v) { d.expr(v, 'bravo'); await d.say(v, 'Quero processar também!', 1.6, 'grito'); }
      d.loop(p, 'sentarCabisbaixo');
      await d.wait(0.8);
    },
  },
  {
    id: 'entrevista2',
    env: (c) => c.data?.env ?? 'escritorio',
    run: async (d, c) => {
      const stand = !!c.data?.standing;
      const outfit = c.data?.outfit ?? undefined;
      const quem = other(c, 0, 1212, undefined, 42);
      if (stand) {
        const p = P(d, c, 470, { facing: 1, outfit, motion: 'nervoso', z: 1 });
        const o = O(d, quem, 790, { facing: -1, outfit: c.data?.npcOutfit, motion: 'bracosCruzados' });
        faceEach(p, o);
        p.name = c.player.name;
      } else {
        d.prop('mesa', 640, GROUND + 8, { z: 1, opts: { color: '#e8e6e0' } });
        d.prop('cadeira', 488, GROUND, { z: -0.6, opts: { color: '#3b3d44' } });
        d.prop('cadeira', 792, GROUND, { z: -0.6, opts: { color: '#3b3d44', flip: true } });
        const p = P(d, c, 505, { facing: 1, outfit, motion: 'entrevistado', z: 0 });
        const o = O(d, quem, 775, { facing: -1, outfit: c.data?.npcOutfit, motion: 'entrevistador', z: 0 });
        faceEach(p, o);
      }
      d.caption(`Entrevista: ${c.data?.cargo ?? ''}`, c.data?.quem, 2.6);
      d.sfx('pop');
      await d.wait(1.2);
    },
  },
  {
    id: 'churrasco',
    env: 'suburbio',
    run: async (d, c) => {
      d.prop('churrasqueira', 980, GROUND, { z: -1 });
      d.prop('mesa', 330, GROUND + 6, { z: 1, opts: { color: '#e4572e' } });
      const tio = d.add(npc(3131, 'm', 55).ap, 55, { x: 870, facing: -1, motion: 'contarPiada', outfit: { top: 'camiseta', topColor: '#f2c14e', topColor2: '#2f8f6f', topPattern: 'listras', bottom: 'bermuda', shoes: 'sandalia', hat: 'bone', hatColor: '#2f8f6f' } });
      tio.propF = 'bebida';
      const fam = c.others.slice(0, 2).map((m, i) => O(d, m, i ? 1080 : 220, { facing: i ? -1 : 1, motion: i ? 'cafe' : 'feliz' }));
      const p = P(d, c, 560, { facing: 1 });
      faceEach(p, tio);
      d.caption('Churrasco de domingo', 'A família reunida (infelizmente)', 2.8);
      await d.say(tio, 'É pavê ou pa comê? HAHAHA', 2.2, 'grito');
      d.loop(tio, 'rir');
      d.sfx('laugh');
      fam.forEach((f) => d.expr(f, 'cansado'));
      d.expr(p, 'cansado');
      d.loop(p, 'facepalm');
      await d.wait(1);
    },
  },
  {
    id: 'transito',
    env: 'ruaDia',
    run: async (d, c) => {
      d.prop('carro', 330, GROUND - 6, { z: -1, scale: 1.3, opts: { color: '#3d7bd9' } });
      d.prop('carro', 950, GROUND - 6, { z: -1, scale: 1.3, opts: { color: '#c2273d', flip: true } });
      const o = O(d, other(c, 0, 4141, 'm', 40), 830, { facing: -1, motion: 'furia', z: 1 });
      const p = P(d, c, 470, { facing: 1, motion: 'susto', z: 1 });
      faceEach(p, o);
      d.caption('Trânsito', 'Hora do rush, humor zero', 2.6);
      d.sfx('siren');
      await d.say(o, 'TÁ OLHANDO O QUÊ, Ô BARBEIRO?!', 2, 'grito');
      d.emote(o, 'raiva');
      d.loop(p, 'bracosCruzados');
      d.expr(p, 'bravo');
      await d.wait(0.6);
    },
  },
  {
    id: 'filaHospital',
    env: 'hospital',
    run: async (d, c) => {
      const fila = crowd(d, 4, 700, 1200, 5151, 'sentarCabisbaixo', { scale: 0.9, y: GROUND - 10, z: -0.5 });
      fila.forEach((f, i) => {
        f.facing = -1;
        f.play(i % 2 ? 'dormirEmPe' : 'sentarCabisbaixo');
        if (!(i % 2)) d.prop('cadeira', f.x, GROUND, { z: f.z - 0.3, opts: { color: '#3d6f8f', flip: true } });
      });
      const p = P(d, c, 330, { facing: 1, motion: 'dor', z: 1 });
      d.caption('Pronto-socorro', 'Senha 187 — chamando a 23', 3);
      d.fx('texto', 800, 180, 1, { text: 'SENHA 23', color: '#ff5c7a', size: 16, life: 3 });
      await d.wait(1.2);
      d.emote(p, 'caveira', 2.2);
      await d.wait(1);
    },
  },
  {
    id: 'festaFirma',
    env: 'escritorio',
    run: async (d, c) => {
      d.sc.night = 0.25;
      d.prop('bandeirinhas', 640, 60, { z: -2, opts: { scale: 1400 } });
      d.prop('mesa', 640, GROUND + 8, { z: 1, opts: { color: '#c2273d' } });
      const ppl = c.others.slice(0, 3).map((m, i) => O(d, m, [300, 860, 1060][i] ?? 900, { facing: i ? -1 : 1, motion: ['dancar3', 'beber', 'dancar'][i] }));
      const p = P(d, c, 500, { facing: 1, motion: 'dancar2' });
      d.caption('Confraternização', 'Open bar e decisões ruins', 2.8);
      for (let i = 0; i < 5; i++) { d.fx('musica', 640 + rng.range(-300, 300), 260, 1); await d.wait(0.45); }
      void ppl; void p;
    },
  },
  {
    id: 'reuniao',
    env: 'escritorio',
    run: async (d, c) => {
      d.prop('mesa', 640, GROUND + 8, { z: 1, opts: { color: '#e8e6e0' } });
      const chefe = O(d, other(c, 0, 6161, undefined, 50), 860, { facing: -1, motion: 'apontarBronca', outfit: { top: 'blazer' } });
      const cols = c.others.slice(1, 3).map((m, i) => O(d, m, i ? 1100 : 280, { facing: i ? -1 : 1, motion: 'rirDe', z: -0.5 }));
      const p = P(d, c, 520, { facing: 1, motion: 'humilhado', z: 1 });
      faceEach(p, chefe);
      d.caption('Reunião de alinhamento', 'Ninguém sai alinhado', 2.8);
      await d.say(chefe, 'Esse relatório parece feito por um estagiário sonolento!', 2.6, 'grito');
      cols.forEach((k) => d.expr(k, 'rindo'));
      d.expr(p, 'humilhado');
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
  // Reunião remota em que o microfone é o personagem mais presente.
  {
    id: 'reuniaoZoom',
    env: 'escritorio',
    run: async (d, c) => {
      d.prop('mesa', 640, GROUND + 10, { z: -0.6, opts: { color: '#6d4b2e' } });
      d.prop('tv', 990, GROUND - 40, { z: -0.8, scale: 0.8 });
      d.prop('cadeira', 470, GROUND, { z: -0.5, opts: { color: '#3d7bd9' } });
      const p = P(d, c, 470, { facing: 1, motion: 'entrevistado' });
      p.propN = 'marmita';
      const chefe = O(d, other(c, 0, 7812, undefined, 48), 850, { facing: -1, motion: 'entrevistador' });
      d.caption('Chamada sem pauta', 'A câmera ligada. O assunto, não.', 2.5);
      await d.say(chefe, 'Você está no mudo.', 1.5);
      await d.act(p, 'bocejar');
      d.loop(p, 'digitarFurioso'); d.expr(p, 'desconfiado'); d.sfx('tick');
      await d.say(p, 'Estou anotando os próximos passos.', 1.8);
      await d.act(p, 'espreguicar');
      d.loop(chefe, 'bracosCruzados'); d.expr(chefe, 'serio');
      await d.wait(0.8);
    },
  },
  // Furadeira no domingo cedo interrompe o descanso do apartamento.
  {
    id: 'furadeiraDomingo',
    env: 'sala',
    run: async (d, c) => {
      d.prop('sofa', 420, GROUND + 2, { z: -0.5, scale: 0.82 });
      d.prop('ventilador', 1110, GROUND, { z: -0.4, scale: 0.72, opts: { state: 1 } });
      const p = P(d, c, 500, { facing: 1, motion: 'sentarCabisbaixo' });
      const vizinho = O(d, other(c, 0, 8071, undefined, 42), 910, { facing: -1, motion: 'bracosCruzados' });
      d.caption('Domingo, 7h02', 'A parede começou a trabalhar.', 2.4);
      await d.wait(0.4); d.shake(3); d.sfx('thud');
      await d.act(p, 'espreguicar');
      d.loop(p, 'abanar'); d.expr(p, 'bravo');
      await d.say(p, 'Tem horário para essa obra?', 1.8);
      d.loop(vizinho, 'carregarCaixa');
      await d.act(vizinho, 'limparSuor');
      await d.say(vizinho, 'É só mais um furo.', 1.5);
      await d.wait(0.7);
    },
  },
  // Ceia em família: uma pergunta simples atravessa a mesa inteira.
  {
    id: 'ceiaNatal',
    env: 'cozinha',
    run: async (d, c) => {
      d.prop('mesa', 650, GROUND + 4, { z: -0.4, scale: 1.15, opts: { color: '#8a5a3a' } });
      d.prop('bolo', 650, GROUND - 20, { z: -0.2, scale: 0.62 });
      const p = P(d, c, 460, { facing: 1, motion: 'sentarCabisbaixo' });
      const parente = O(d, other(c, 0, 2512, undefined, 58), 790, { facing: -1, motion: 'contarPiada' });
      const parente2 = O(d, other(c, 1, 2513, undefined, 52), 1010, { facing: -1, motion: 'sentarCabisbaixo', scale: 0.9 });
      d.caption('Ceia de Natal', 'O pavê trouxe assunto e parentes.', 2.5);
      await d.say(parente, 'E quem trouxe a sobremesa?', 1.6);
      d.expr(p, 'sarcastico');
      await d.say(p, 'A sobremesa trouxe a conversa.', 1.7);
      d.expr(parente2, 'pensativo');
      await d.wait(0.8);
      d.loop(p, 'feliz');
    },
  },
  // Quadrilha escolar com barraca, bandeirinhas e passos improvisados.
  {
    id: 'festaJunina',
    env: 'patio',
    run: async (d, c) => {
      d.prop('bandeirinhas', 640, 190, { z: -1, opts: { scale: 900 } });
      d.prop('barraca', 980, GROUND, { z: -0.5, scale: 0.8, opts: { color: '#e4572e' } });
      const p = P(d, c, 530, { facing: 1, motion: 'dancarQuadrilha' });
      const par = O(d, other(c, 0, 6017, undefined, 12), 780, { facing: -1, motion: 'dancarQuadrilha' });
      par.propN = 'sacola';
      d.caption('Arraiá da escola', 'A coreografia tinha testemunhas.', 2.5);
      d.sfx('applause');
      await d.say(par, 'Olha a chuva!', 1.3);
      d.emote(p, 'exclamacao');
      await d.act(p, 'selfie');
      d.loop(p, 'dancarQuadrilha'); d.loop(par, 'dancarQuadrilha');
      await d.wait(1.1);
      d.sfx('cheer');
      await d.wait(0.8);
    },
  },
  // Vulcão escolar transborda; a professora ajuda a reorganizar a feira.
  {
    id: 'feiraCiencias',
    env: 'escola',
    run: async (d, c) => {
      d.prop('mesa', 790, GROUND + 3, { z: -0.4, scale: 1.1, opts: { color: '#8a5a3a' } });
      const vulcao = d.prop('vulcaoEscolar', 790, GROUND - 4, { z: 0.2, scale: 0.8, opts: { state: 1 } });
      const p = P(d, c, 500, { facing: 1, motion: 'estudar' });
      d.expr(p, 'concentrado');
      const professora = O(d, other(c, 0, 9411, 'f', 38), 990, { facing: -1, motion: 'bracosCruzados' });
      d.caption('Feira de ciências', 'A experiência pediu mais espaço.', 2.5);
      await d.wait(0.5); d.shake(2); d.sfx('splash');
      d.fx('poeira', vulcao.x, GROUND - 110, 8, { speed: 30, size: 5, life: 1.1 });
      await d.act(p, 'escorregar');
      d.loop(p, 'ajoelharImplorar'); d.expr(p, 'envergonhado');
      await d.say(p, 'A lava estava no roteiro.', 1.8);
      d.loop(professora, 'bracosCruzados'); d.expr(professora, 'serio');
      await d.say(professora, 'Vamos secar a mesa primeiro.', 1.8);
      d.expr(p, 'serio');
      await d.wait(0.8);
    },
  },
  // Mutirão na água alta, com um móvel pesado e ajuda dos vizinhos.
  {
    id: 'enchente',
    env: 'ruaChuva',
    run: async (d, c) => {
      d.prop('sofa', 340, GROUND, { z: -0.4, scale: 0.8 });
      d.prop('carro', 1110, GROUND - 6, { z: -0.6, scale: 0.82, opts: { color: '#6d8791' } });
      const p = P(d, c, 490, { facing: 1, motion: 'carregarCaixa' });
      const vizinha = O(d, other(c, 0, 4316, 'f', 35), 820, { facing: -1, motion: 'carregarCaixa' });
      vizinha.propN = 'guardaChuvaQuebrado';
      d.caption('Mutirão na chuva', 'A rua virou corredor de água.', 2.5);
      d.sfx('splash'); d.shake(1.5);
      if (c.data?.acao === 'filmar') {
        d.loop(p, 'gravarStory');
        await d.say(p, 'A água chegou à calçada.', 1.8);
        d.expr(vizinha, 'serio');
        await d.say(vizinha, 'Guarda o celular e vem ajudar.', 1.8);
      } else {
        await d.say(vizinha, 'Pega a caixa de cima!', 1.5);
        d.loop(p, 'carregarCaixa'); d.loop(vizinha, 'carregarCaixa');
        if (c.data?.falhou) { await d.act(p, 'tropecarEscada'); d.emote(p, 'suor'); d.expr(p, 'dor'); }
        else { await d.act(p, 'carregarCaixa'); d.emote(p, 'suor'); }
      }
      await d.wait(1);
    },
  },
  // Assalto dentro do ônibus: tensão, escolha e saída segura.
  {
    id: 'assaltoOnibus',
    env: 'rodoviaria',
    run: async (d, c) => {
      d.prop('cadeira', 340, GROUND, { z: -0.5, scale: 0.9, opts: { color: '#3d7bd9' } });
      d.prop('cadeira', 570, GROUND, { z: -0.5, scale: 0.9, opts: { color: '#3d7bd9' } });
      const p = P(d, c, 490, { facing: 1, motion: 'susto' });
      const assaltante = O(d, other(c, 0, 6639, 'm', 28), 870, { facing: -1, motion: 'seguranca' });
      const passageira = O(d, other(c, 1, 6640, 'f', 44), 1070, { facing: -1, motion: 'entrevistado', scale: 0.9 });
      d.caption('No ônibus à noite', 'O corredor ficou em silêncio.', 2.5);
      await d.say(assaltante, 'Celulares na bolsa. Sem gritar.', 1.8);
      d.expr(p, 'assustado'); d.loop(p, 'bracosCruzados');
      if (c.data?.acao === 'reagir') {
        d.loop(passageira, 'ajoelharImplorar');
        await d.say(passageira, 'Leva o aparelho e deixa todos sair.', 2);
        if (c.data?.escapou) { d.loop(assaltante, 'darOmbros'); await d.moveActor(assaltante, 1230, GROUND, 0.8); d.expr(p, 'aliviado'); }
        else { assaltante.propN = 'celular'; d.expr(p, 'dor'); await d.wait(0.5); }
      } else if (c.data?.acao === 'correr') {
        if (c.data?.escapou) { await d.moveActor(p, 220, GROUND, 1.1); d.expr(p, 'aliviado'); }
        else { await d.act(p, 'escorregar'); assaltante.propN = 'celular'; d.expr(p, 'dor'); }
      } else if (c.data?.acao === 'entregar') {
        p.propN = 'celular';
        await d.say(p, 'Aqui. Só deixa a porta livre.', 1.7);
        d.expr(assaltante, 'serio');
        p.propN = undefined;
      } else if (c.data?.acao === 'falso') {
        p.propN = 'celular';
        await d.say(p, 'Esse velho ainda liga. Pode ficar.', 1.6);
        p.propN = undefined;
        assaltante.propN = 'celular';
        if (c.data?.escapou) { d.expr(p, 'aliviado'); await d.say(assaltante, 'Desce logo.', 1.2); }
        else { d.expr(p, 'dor'); await d.wait(0.5); }
      }
      if (c.data?.desmaio) {
        await d.act(passageira, 'desmaiar');
        d.expr(p, 'triste');
        await d.wait(0.7);
      }
      await d.wait(0.8);
    },
  },
  // Despedida no velório, com apoio aos parentes presentes.
  {
    id: 'velorioCoxinha',
    env: 'cemiterio',
    run: async (d, c) => {
      d.prop('mesa', 920, GROUND + 3, { z: -0.5, scale: 0.72, opts: { color: '#6d4b2e' } });
      const p = P(d, c, 500, { facing: 1, motion: 'sentarCabisbaixo' });
      p.propN = 'xicara';
      const familiar = O(d, other(c, 0, 7215, undefined, 54), 790, { facing: -1, motion: 'sentarCabisbaixo' });
      d.caption('Uma despedida', c.data?.nome ?? 'A família está reunida.', 2.6);
      d.sfx('sad');
      await d.say(familiar, 'Obrigado por ficar com a gente.', 1.8);
      d.expr(p, 'triste'); d.loop(p, 'sentarCabisbaixo');
      await d.wait(1.1);
      d.expr(familiar, 'triste');
      await d.wait(0.8);
    },
  },
  // Bingo comunitário em que a cartela vale mais que o prêmio.
  {
    id: 'bingoIdosos',
    env: 'sala',
    run: async (d, c) => {
      d.prop('mesa', 680, GROUND + 8, { z: -0.5, scale: 0.88, opts: { color: '#7a5236' } });
      const p = P(d, c, 470, { facing: 1, motion: 'contarDinheiro' });
      const vizinho = O(d, other(c, 0, 3391, undefined, 72), 840, { facing: -1, motion: 'torcerFutebol' });
      d.caption('Bingo do bairro', 'A cartela cheia tem torcida.', 2.5);
      await d.say(vizinho, 'B-12! Confere a coluna.', 1.6);
      d.sfx(c.data?.ganhou === false ? 'sad' : c.data?.ganhou === true ? 'coin' : 'tick');
      if (c.data?.ganhou === false) { d.expr(p, 'derrotado'); await d.say(p, 'Faltou só um número.', 1.6); }
      else { d.emote(p, 'estrela'); d.expr(p, 'feliz'); await d.say(p, 'Bingo! Uma rodada para a mesa.', 1.8); }
      await d.wait(1);
    },
  },
  // Variação de QA 1: consulta acolhedora, médica na altura da paciente e lágrimas pela gravidade.
  {
    id: 'medicoV1',
    env: 'hospital',
    run: async (d, c) => {
      const doc = O(d, other(c, 0, 41, undefined, 45), 700, { facing: -1, outfit: { top: 'jaleco', topColor: '#5ec3e8' } });
      const p = P(d, c, 380, { facing: 1, outfit: { top: 'camisola' }, motion: 'deitadoDoente', turn: 0.3, z: 1 });
      lieOn(p, 110);
      d.expr(p, 'triste');
      d.caption(c.data?.titulo ?? 'Consulta médica', c.data?.sub, 2.8);
      await d.walk(doc, 560);
      doc.facing = -1;
      doc.lookAt = p;
      d.loop(doc, 'agachar');
      d.expr(doc, 'serio');
      await d.say(doc, 'Vou examinar você com calma, combinado?', 2);
      await d.say(p, 'Tá doendo bastante.', 1.8);
      d.loop(doc, 'pensando');
      doc.lookAt = p.headWorld();
      for (let i = 0; i < 5; i++) {
        const head = p.headWorld();
        const angle = p.pose.rot + p.pose.lean + p.pose.chest + p.pose.neck + p.pose.head;
        const eyeX = head.x + Math.cos(angle) * p.facing * 7;
        const eyeY = head.y + Math.sin(angle) * p.facing * 7;
        d.fx('lagrima', eyeX, eyeY, 1, { color: '#8fd0ff', speed: 35, dir: Math.PI / 2, cone: 0, size: 8, life: 1.3 });
        await d.wait(0.42);
      }
      d.loop(doc, 'acenar');
      if (c.data?.good) {
        await d.say(doc, c.data?.fala ?? 'A gente vai cuidar de você.', 2);
        d.expr(p, 'aliviado');
        d.sfx('chime');
      } else {
        await d.say(doc, c.data?.fala ?? 'Vou acompanhar você de perto.', 2);
        d.expr(doc, 'triste');
        d.expr(p, 'triste');
        d.sfx('heartbeat');
      }
      await d.wait(1.2);
    },
  },
  // Variação de QA 2: exame focado nos sinais da paciente, seguido de contato visual e explicação.
  {
    id: 'medicoV2',
    env: 'hospital',
    run: async (d, c) => {
      const doc = O(d, other(c, 0, 41, undefined, 45), 760, { facing: -1, outfit: { top: 'jaleco', topColor: '#5ec3e8' } });
      const p = P(d, c, 380, { facing: 1, outfit: { top: 'camisola' }, motion: 'deitadoDoente', turn: 0.3, z: 1 });
      lieOn(p, 110);
      d.expr(p, 'triste');
      d.caption(c.data?.titulo ?? 'Exame no hospital', c.data?.sub, 2.8);
      await d.walk(doc, 545);
      doc.facing = -1;
      d.loop(doc, 'agachar');
      d.expr(doc, 'concentrado');
      doc.lookAt = p.handWorld();
      await d.say(doc, 'Vou conferir seus sinais e entender onde dói.', 2);
      d.loop(doc, 'pensando');
      doc.lookAt = p.headWorld();
      for (let i = 0; i < 5; i++) {
        const head = p.headWorld();
        const angle = p.pose.rot + p.pose.lean + p.pose.chest + p.pose.neck + p.pose.head;
        const eyeX = head.x + Math.cos(angle) * p.facing * 7;
        const eyeY = head.y + Math.sin(angle) * p.facing * 7;
        d.fx('lagrima', eyeX, eyeY, 1, { color: '#8fd0ff', speed: 35, dir: Math.PI / 2, cone: 0, size: 8, life: 1.3 });
        await d.wait(0.42);
      }
      if (c.data?.good) {
        d.loop(doc, 'joinha');
        await d.say(doc, c.data?.fala ?? 'Os sinais estão melhores. Vamos seguir cuidando.', 2.2);
        d.expr(p, 'aliviado');
        d.sfx('chime');
      } else {
        d.loop(doc, 'apontar');
        doc.lookAt = p.headWorld();
        await d.say(doc, c.data?.fala ?? 'Vou pedir mais exames para ter certeza.', 2.2);
        d.expr(doc, 'serio');
        d.expr(p, 'triste');
        d.sfx('heartbeat');
      }
      await d.wait(1.2);
    },
  },
  // Variação de QA 3: médica explica o plano olhando para a paciente e oferece acolhimento.
  {
    id: 'medicoV3',
    env: 'hospital',
    run: async (d, c) => {
      const doc = O(d, other(c, 0, 41, undefined, 45), 720, { facing: -1, outfit: { top: 'jaleco', topColor: '#5ec3e8' } });
      const p = P(d, c, 380, { facing: 1, outfit: { top: 'camisola' }, motion: 'deitadoDoente', turn: 0.3, z: 1 });
      lieOn(p, 110);
      d.expr(p, 'triste');
      d.caption(c.data?.titulo ?? 'Plano de cuidado', c.data?.sub, 2.8);
      await d.walk(doc, 555);
      doc.facing = -1;
      doc.lookAt = p;
      d.loop(doc, 'agachar');
      d.expr(doc, 'serio');
      await d.say(doc, 'Eu vou explicar cada passo do tratamento.', 2);
      d.loop(doc, 'apontar');
      doc.lookAt = p.headWorld();
      for (let i = 0; i < 5; i++) {
        const head = p.headWorld();
        const angle = p.pose.rot + p.pose.lean + p.pose.chest + p.pose.neck + p.pose.head;
        const eyeX = head.x + Math.cos(angle) * p.facing * 7;
        const eyeY = head.y + Math.sin(angle) * p.facing * 7;
        d.fx('lagrima', eyeX, eyeY, 1, { color: '#8fd0ff', speed: 35, dir: Math.PI / 2, cone: 0, size: 8, life: 1.3 });
        await d.wait(0.42);
      }
      if (c.data?.good) {
        d.loop(doc, 'acenar');
        await d.say(doc, c.data?.fala ?? 'Você não está sozinha. Vamos por partes.', 2.2);
        d.expr(p, 'aliviado');
        d.sfx('chime');
      } else {
        d.loop(doc, 'pensando');
        doc.lookAt = p;
        await d.say(doc, c.data?.fala ?? 'Vou ficar por perto enquanto avaliamos.', 2.2);
        d.expr(p, 'triste');
        d.sfx('heartbeat');
      }
      await d.wait(1.2);
    },
  },
];

export const SITUATIONS: Record<string, Situation> = Object.fromEntries(S.map((s) => [s.id, s]));
export { npc };
void sfx;
