import './ui/styles.css';
import { App } from './ui/app';
import { sfx } from './core/audio';

const root = document.getElementById('app')!;
const params = new URLSearchParams(location.search);

if (params.has('test')) {
  import('./test').then((m) => m.testHarness(root));
} else {
  const app = new App(root);
  (window as any).app = app;
  const start = async () => {
    const hash = location.hash.replace('#', '');
    if (hash === 'editor') return app.go('editor');
    if (hash === 'demo') {
      const [{ randomAppearance }, { newLife }, { rng }, { NOMES_F, NOMES_M, SOBRENOMES }] = await Promise.all([
        import('./character/appearance'), import('./game/state'), import('./core/rng'), import('./game/names'),
      ]);
      const ap = randomAppearance(rng);
      return app.go('game', newLife(ap, rng.pick(ap.sex === 'f' ? NOMES_F : NOMES_M), rng.pick(SOBRENOMES), 'São Paulo', 25));
    }
    if (hash === 'explorar') {
      // atalho de teste: vida aleatória de 25 anos direto no modo Explorar
      const [{ randomAppearance }, { newLife }, { rng }, { NOMES_F, NOMES_M, SOBRENOMES }] = await Promise.all([
        import('./character/appearance'), import('./game/state'), import('./core/rng'), import('./game/names'),
      ]);
      const ap = randomAppearance(rng);
      const idade = Number(new URLSearchParams(location.search).get('idade') ?? 25) || 25; // ?idade=12 (QA)
      return app.go('explorar', newLife(ap, rng.pick(ap.sex === 'f' ? NOMES_F : NOMES_M), rng.pick(SOBRENOMES), 'São Paulo', idade));
    }
    if (hash === 'jogo') {
      const { lastLifeId, loadLife } = await import('./game/storage');
      const id = lastLifeId();
      const L = id ? loadLife(id) : null;
      if (L) return app.go('game', L);
    }
    app.go('title');
  };
  // aguarda as fontes (sem travar caso estejam offline)
  Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(start);
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
}
