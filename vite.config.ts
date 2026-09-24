import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { painelApi } from './scripts/painel-api';

// Build gera um único index.html autocontido: abre direto via file:// (duplo clique / .bat),
// sem servidor e sem problemas de CORS com módulos ES.
export default defineConfig({
  base: './',
  // painelApi só existe no `vite` de desenvolvimento (apply: 'serve'); o build de produção não o contém.
  plugins: [viteSingleFile(), painelApi()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  server: { port: 5199, open: false },
});
