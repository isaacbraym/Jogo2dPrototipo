import { Scene } from './scenes/scene';
import { Trajeto } from './scenes/contato';
import { Stage } from './scenes/stage';
import { randomAppearance, defaultAppearance } from './character/appearance';
import { RNG } from './core/rng';
import { npc } from './scenes/situations';

/**
 * Harness de desenvolvimento (?test):
 *  - ?test&env=parque&n=4&ages=5,30         → galeria de personagens
 *  - ?test&sit=casamento&age=28&at=4        → roda uma situação e congela no instante `at` (s)
 */
export function testHarness(root: HTMLElement) {
  root.innerHTML = '<div id="st" style="position:fixed;inset:0"></div>';
  const stage = new Stage(root.querySelector('#st') as HTMLElement);
  const q = new URLSearchParams(location.search);
  const r = new RNG(Number(q.get('seed') ?? 5));
  (window as any).stage = stage;
  const sit = q.get('sit');
  if (sit) {
    const sex = (q.get('sex') as 'f' | 'm') ?? 'f';
    const cast = {
      player: { ap: randomAppearance(r, sex), age: Number(q.get('age') ?? 25), name: 'Ana', sex },
      others: [npc(11, sex === 'f' ? 'm' : 'f', Number(q.get('oage') ?? 27)), npc(12, 'm', 32), npc(13, 'f', 20)],
      data: JSON.parse(q.get('data') ?? '{}'),
    };
    cast.others[0].name = 'Léo';
    stage.play(sit, cast);
    // &hit=<seg>: congela <seg> depois do primeiro evento de contato (tapa, soco, toca-aqui...) — instante exato do impacto
    const hit = q.get('hit');
    if (hit !== null) {
      const orig = Trajeto.prototype.update;
      let alvoT = -1;
      Trajeto.prototype.update = function (this: Trajeto, dt: number) {
        const antes = this.t;
        orig.call(this, dt);
        if (alvoT < 0 && (this.o.eventos ?? []).some((e) => e.t > antes && e.t <= this.t)) alvoT = stage.scene.t + Number(hit);
        if (alvoT >= 0 && stage.scene.t >= alvoT && !stage.paused) { stage.paused = true; (window as any).frozen = true; }
      };
    }
    const at = Number(q.get('at') ?? 0);
    if (at > 0) {
      const iv = setInterval(() => {
        if (stage.scene.t >= at) {
          stage.paused = true;
          clearInterval(iv);
          (window as any).frozen = true;
        }
      }, 16);
    }
    return;
  }
  const env = q.get('env') ?? 'sala';
  const sc = new Scene(env);
  const n = Number(q.get('n') ?? 5);
  const ages = (q.get('ages') ?? '30').split(',').map(Number);
  const turn = Number(q.get('turn') ?? 0.7);
  const mot = q.get('m') ?? 'parado';
  for (let i = 0; i < n; i++) {
    const ap = q.get('def') ? defaultAppearance(i % 2 ? 'm' : 'f') : randomAppearance(r);
    // auditoria de penteados: &hair=trancas,longo,... (um por boneco, repete) e &span=largura ocupada pela fileira
    const hairs = q.get('hair')?.split(',');
    if (hairs) { ap.hairStyle = hairs[i % hairs.length]; ap.hat = 'nenhum'; }
    const span = Number(q.get('span') ?? 1100);
    const a = sc.addActor(ap, ages[i % ages.length], { x: 640 + (i - (n - 1) / 2) * (span / Math.max(n, 1)), facing: i % 2 ? -1 : 1, turn, motion: mot });
    if (q.get('expr')) a.setExpr(q.get('expr') as any);
    const exprs = q.get('exprs')?.split(',');
    if (exprs) a.setExpr(exprs[i % exprs.length] as any);
  }
  const z = Number(q.get('zoom') ?? 1);
  sc.focus(Number(q.get('cx') ?? 640), Number(q.get('cy') ?? 360), z);
  sc.cam.x = sc.cam.tx;
  sc.cam.y = sc.cam.ty;
  sc.cam.zoom = z;
  stage.setScene(sc);
}
