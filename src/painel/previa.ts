/** Prévia animada (catálogo): roda um LabRun em tempo real e reinicia ao fim. */
import { LabRun, EspecLab, DT, BONECOS_PADRAO, ModoLab } from './lab';
import type { Item } from './catalogo';

export function especDoItem(it: Item, extra: Partial<EspecLab> = {}): EspecLab | null {
  const mapa: Partial<Record<string, ModoLab>> = { movimento: 'movimento', acaoCorporal: 'acaoCorporal', expressao: 'expressao', ambiente: 'ambiente', objeto: 'objeto', objetoMao: 'objetoMao', visual: 'visual', cena: 'cena' };
  const modo = mapa[it.tipo];
  if (!modo) return null;
  return { modo, id: it.id, bonecos: { ...BONECOS_PADRAO }, semente: 1, ambiente: modo === 'objeto' || modo === 'objetoMao' || modo === 'expressao' ? 'sala' : undefined, ...extra };
}

export function previaAnimada(canvas: HTMLCanvasElement, espec: EspecLab, maxSeg = 12) {
  const run = new LabRun(espec);
  let vivo = true, ocupado = false, ultimo = performance.now(), acum = 0;
  const ctx = canvas.getContext('2d')!;
  const tamanho = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || 480, hh = canvas.clientHeight || 270;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    return { w, hh, dpr };
  };
  const quadro = async (agora: number) => {
    if (!vivo) return;
    acum += Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!ocupado) {
      ocupado = true;
      try {
        if (!run.sc) await run.iniciar();
        const n = Math.floor(acum / DT);
        acum -= n * DT;
        await run.avancar(Math.min(n, 6));
        if ((run.terminou && run.sc.t > (run.tFim ?? 0) + 0.6) || run.sc.t > maxSeg) await run.iniciar();
        const { w, hh, dpr } = tamanho();
        run.desenhar(ctx, w, hh, dpr);
      } catch (e) {
        console.error('Prévia falhou', espec.modo, espec.id, e);
        vivo = false;
      }
      ocupado = false;
    }
    if (vivo) requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
  return () => { vivo = false; };
}
