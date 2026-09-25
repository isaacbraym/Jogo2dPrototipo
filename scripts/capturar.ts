/**
 * Capturas de tela do jogo SEM depender de nenhuma IA/ferramenta de navegador: usa o Edge/Chrome em modo headless com
 * "tempo virtual" (o jogo avança o tempo exato pedido, então a captura sai no instante certo, sempre igual).
 *
 * Pré-requisito: `npm run dev` rodando (http://localhost:5199).
 *
 * Uso:
 *   npm run capturar -- <nome> "<url ou caminho>" [--tempo 9000] [--tam 1280x720]
 *   npm run capturar -- --roteiro qa/roteiros/beijo-alturas.json
 *
 * Exemplos:
 *   npm run capturar -- beijo-alta "/?test&sit=interacao&sex=f&alt=1,0&at=3.6&data={\"action\":\"beijar\",\"env\":\"parque\"}"
 *   npm run capturar -- vitrine-casamento "/?vitrine=casamento" --tempo 6000
 *
 * Saída: qa/capturas/<AAAA-MM-DD_HHMMSS>/<nome>.png (pasta ignorada pelo git) e, no terminal, uma linha Markdown
 * `![nome](caminho)` por imagem — cole no chat/relatório para mostrar a tela.
 *
 * Roteiro (JSON): { "tempo": 9000, "tam": "1280x720", "capturas": [ { "nome": "...", "url": "/?test&...", "tempo": 9000 } ] }
 * Dentro da url, `data={...}` pode vir em JSON puro: o script codifica.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const BASE = process.env.VIVA_URL ?? 'http://localhost:5199';
const NAVEGADORES = [
  process.env.VIVA_NAVEGADOR,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean) as string[];

interface Captura { nome: string; url: string; tempo?: number; tam?: string }

function navegador(): string {
  const n = NAVEGADORES.find((p) => existsSync(p));
  if (!n) throw new Error('Nenhum Edge/Chrome encontrado. Defina VIVA_NAVEGADOR com o caminho do executável.');
  return n;
}

/** Monta a URL final: aceita caminho relativo e codifica `data={...}` escrito em JSON puro. */
function montarUrl(u: string): string {
  let url = u.startsWith('http') ? u : BASE + (u.startsWith('/') ? u : '/' + u);
  url = url.replace(/([?&]data=)(\{.*?\})(?=&|$)/, (_m, p: string, json: string) => p + encodeURIComponent(json));
  return url;
}

/** Tempo virtual padrão: congelamentos por `at=` precisam de at + folga; o resto, 9 s. */
function tempoPadrao(url: string): number {
  const at = /[?&]at=([\d.]+)/.exec(url);
  return at ? Math.round((Number(at[1]) + 3) * 1000) : 9000;
}

async function servidorNoAr(): Promise<boolean> {
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

function capturar(c: Captura, pasta: string, exe: string): string {
  const url = montarUrl(c.url);
  const [w, h] = (c.tam ?? '1280x720').split('x').map(Number);
  const arquivo = resolve(join(pasta, c.nome.replace(/[^\w.-]+/g, '_') + '.png'));
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    `--window-size=${w},${h}`, `--virtual-time-budget=${c.tempo ?? tempoPadrao(url)}`,
    `--screenshot=${arquivo}`, url,
  ];
  // O "tempo virtual" do Edge headless às vezes trava em páginas com animação contínua (modo Explorar) e não grava a
  // imagem: nesse caso tenta de novo em TEMPO REAL (--timeout), que sempre termina.
  const ok = () => existsSync(arquivo) && statSync(arquivo).size >= 1000;
  let r = spawnSync(exe, args, { encoding: 'utf8', timeout: 45_000 });
  for (let tent = 1; tent < 3 && !ok(); tent++) {
    const real = args.map((a) => (a.startsWith('--virtual-time-budget=') ? `--timeout=${(c.tempo ?? tempoPadrao(url)) + 7000}` : a));
    r = spawnSync(exe, real, { encoding: 'utf8', timeout: 60_000 });
  }
  if (!ok()) {
    throw new Error(`Falhou "${c.nome}" (${url}).\n${r.stderr?.slice(-600) ?? ''}`);
  }
  return arquivo;
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const roteiro = opt('--roteiro');
  const tempo = opt('--tempo');
  const tam = opt('--tam');
  let lista: Captura[];
  if (roteiro) {
    const j = JSON.parse(readFileSync(roteiro, 'utf8'));
    lista = (j.capturas as Captura[]).map((c) => ({ tempo: j.tempo, tam: j.tam, ...c }));
  } else {
    const [nome, url] = argv;
    if (!nome || !url) {
      console.log('Uso: npm run capturar -- <nome> "<url>" [--tempo ms] [--tam 1280x720]  |  --roteiro arquivo.json');
      process.exit(1);
    }
    lista = [{ nome, url }];
  }
  for (const c of lista) {
    if (tempo) c.tempo = Number(tempo);
    if (tam) c.tam = tam;
  }
  if (!(await servidorNoAr())) {
    console.error(`O jogo não respondeu em ${BASE}. Rode "npm run dev" em outro terminal e tente de novo.`);
    process.exit(1);
  }
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const pasta = join('qa', 'capturas', `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`);
  mkdirSync(pasta, { recursive: true });
  const exe = navegador();
  console.log(`Capturando ${lista.length} tela(s) com ${exe.split(/[\\/]/).pop()}...\n`);
  for (const c of lista) {
    const arq = capturar(c, pasta, exe);
    console.log(`![${c.nome}](${arq.replace(/\\/g, '/')})`);
  }
  console.log(`\nPasta: ${resolve(pasta)}`);
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(1); });
