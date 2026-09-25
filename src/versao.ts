/**
 * Versão do jogo em execução + verificação de atualização.
 * O build de produção é um único index.html; o GitHub Pages deixa o navegador guardar a página por até 10 min.
 * Ao abrir o site, buscamos o index.html sem cache: se a versão publicada for outra, recarregamos com ?v=<hora>
 * (URL nova = o navegador não usa a cópia velha). Nada disso roda no `npm run dev` nem no file:// (Jogar.bat).
 */
export const VERSAO: string = typeof __VERSAO__ !== 'undefined' ? __VERSAO__ : 'dev';

export async function verificarAtualizacao(): Promise<void> {
  if (import.meta.env?.DEV || !location.protocol.startsWith('http') || VERSAO === 'dev') return;
  try {
    const r = await fetch(location.pathname + '?nocache=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const html = await r.text();
    if (html.includes(VERSAO)) return; // já é a versão publicada
    // evita laço se o servidor ainda estiver propagando: no máximo uma tentativa por minuto
    const ultima = Number(sessionStorage.getItem('viva-atualizou') ?? 0);
    if (Date.now() - ultima < 60_000) return;
    sessionStorage.setItem('viva-atualizou', String(Date.now()));
    const q = new URLSearchParams(location.search);
    q.set('v', String(Date.now()));
    location.replace(location.pathname + '?' + q.toString() + location.hash);
  } catch {
    /* offline: segue com a versão que já está aberta */
  }
}
