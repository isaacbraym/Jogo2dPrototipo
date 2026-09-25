import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';
import { painelApi } from './scripts/painel-api';

/** Versão visível no jogo: "AAAA-MM-DD HH:MM · <commit>" (o commit ganha "+" se havia mudanças não commitadas). */
function versao(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const sujo = execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (sujo) commit += '+';
  } catch {
    /* sem git: fica "dev" */
  }
  return `${data} · ${commit}`;
}

// Build gera um único index.html autocontido: abre direto via file:// (duplo clique / .bat),
// sem servidor e sem problemas de CORS com módulos ES.
export default defineConfig({
  base: './',
  define: { __VERSAO__: JSON.stringify(versao()) },
  // painelApi só existe no `vite` de desenvolvimento (apply: 'serve'); o build de produção não o contém.
  plugins: [viteSingleFile(), painelApi()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  server: { port: 5199, open: false },
});
