/**
 * VIVA! · Painel de QA — ferramenta LOCAL de desenvolvimento (npm run painel → /painel.html).
 * Não faz parte do jogo publicado: o build de produção só empacota index.html.
 */
import './painel.css';
import { instalarGuardas } from './guarda';
instalarGuardas(); // antes de qualquer módulo do jogo tocar no localStorage

import { h, limpar, memoria } from './dom';
import { sfx } from '../core/audio';
import { isolarAudio } from './det';
isolarAudio(sfx); // som nunca consome o acaso semeado da simulação
import { Catalogo } from './catalogo';
import { ligarObservacoes } from './observado';
import { Trabalho } from './calib';
import type { Cenario } from './vida';
import type { EspecLab } from './lab';

export type Aba = 'catalogo' | 'esteira' | 'lab' | 'qualidade' | 'alteracoes';

export interface App {
  cat: Catalogo;
  trabalho: Trabalho;
  cenario: Cenario | null;
  lab: EspecLab | null;
  labContexto: { cadeia: string; semente?: number; cenario?: string } | null;
  falhas: { quando: string; contexto: string; msg: string }[];
  contextoAtual: string;
  ir(aba: Aba, params?: Record<string, string>): void;
  abrirItem(chave: string): void;
  abrirLab(espec: EspecLab, contexto?: App['labContexto']): void;
  abrirEsteira(c: Cenario): void;
}

const raiz = document.getElementById('painel')!;
const t0 = performance.now();
const cat = new Catalogo();
ligarObservacoes(cat);

const app: App = {
  cat,
  trabalho: new Trabalho(),
  cenario: memoria.ler<Cenario | null>('cenario', null),
  lab: memoria.ler<EspecLab | null>('lab', null),
  labContexto: memoria.ler('labContexto', null),
  falhas: [],
  contextoAtual: 'painel',
  ir: (aba, params) => { location.hash = aba + (params ? '?' + new URLSearchParams(params).toString() : ''); },
  abrirItem: (k) => app.ir('catalogo', { item: k }),
  abrirLab: (espec, contexto = null) => { app.lab = espec; app.labContexto = contexto; memoria.gravar('lab', espec); memoria.gravar('labContexto', contexto); app.ir('lab', { r: String(Date.now()) }); },
  abrirEsteira: (c) => { app.cenario = c; memoria.gravar('cenario', c); app.ir('esteira', { r: String(Date.now()) }); },
};

// falhas de renderização/execução (Scene.draw registra erros de desenho via console.error)
const erroOriginal = console.error.bind(console);
console.error = (...args: unknown[]) => {
  app.falhas.push({ quando: new Date().toLocaleTimeString('pt-BR'), contexto: app.contextoAtual, msg: args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(' ') });
  if (app.falhas.length > 300) app.falhas.shift();
  erroOriginal(...args);
};
window.addEventListener('error', (e) => app.falhas.push({ quando: new Date().toLocaleTimeString('pt-BR'), contexto: app.contextoAtual, msg: e.message }));

// ------------------------------------------------------------------ layout
const ABAS: [Aba, string][] = [['catalogo', 'Catálogo'], ['esteira', 'Esteira de eventos'], ['lab', 'Laboratório'], ['qualidade', 'Qualidade'], ['alteracoes', 'Alterações']];
const botoes = new Map<Aba, HTMLElement>();
const busca = h('input.campo.busca-global', { placeholder: 'Buscar qualquer id ou nome (Enter)…', onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') app.ir('catalogo', { q: (e.target as HTMLInputElement).value }); } }) as HTMLInputElement;
const topo = h('div.topo', null,
  h('div.marca', null, 'VIVA! ', h('span', null, 'Painel de QA')),
  h('span.aviso-dev', { title: 'Só existe no servidor de desenvolvimento; não é publicado.' }, 'local · desenvolvimento'),
  h('div.abas', null, ...ABAS.map(([a, r]) => { const b = h('button', { onclick: () => app.ir(a) }, r); botoes.set(a, b); return b; })),
  busca,
  h('span.nota', null, `${cat.lista.length} itens · ${cat.vinculos.length} vínculos · ${Math.round(performance.now() - t0)} ms`),
);
const conteudo = h('div.conteudo');
limpar(raiz).append(topo, conteudo);

let desmontar: (() => void) | void;
async function rota() {
  const [aba0, qs] = location.hash.replace(/^#/, '').split('?');
  const aba = (ABAS.some(([a]) => a === aba0) ? aba0 : 'catalogo') as Aba;
  const params = Object.fromEntries(new URLSearchParams(qs ?? ''));
  botoes.forEach((b, a) => b.classList.toggle('ativa', a === aba));
  desmontar?.();
  limpar(conteudo);
  app.contextoAtual = aba;
  const mod = aba === 'catalogo' ? await import('./ui-catalogo')
    : aba === 'esteira' ? await import('./ui-esteira')
    : aba === 'lab' ? await import('./ui-lab')
    : aba === 'qualidade' ? await import('./ui-qualidade')
    : await import('./ui-alteracoes');
  if (params.q !== undefined) busca.value = params.q;
  desmontar = mod.montar(conteudo, app, params);
}
window.addEventListener('hashchange', rota);
rota();
