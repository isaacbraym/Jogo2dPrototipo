/**
 * VIVA! · Painel de QA — ferramenta LOCAL de desenvolvimento (npm run painel → /painel.html).
 * Não faz parte do jogo publicado: o build de produção só empacota index.html.
 */
import './painel.css';
import { instalarGuardas } from './guarda';
instalarGuardas(); // antes de qualquer módulo do jogo tocar no localStorage

import { h, limpar, memoria, modal, toast } from './dom';
import { api } from './api';
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
  /** false = TRAVADO: nada é gravado no projeto (padrão sempre que o painel abre). */
  liberado: boolean;
  /** Garante que o painel está destravado; se não estiver, pede confirmação explícita. */
  exigirLiberacao(acao: string): Promise<boolean>;
  travar(): Promise<void>;
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
  liberado: false,
  exigirLiberacao: (acao) => pedirLiberacao(acao),
  travar: async () => { try { await api.definirTrava(false); } catch { /* servidor fora */ } definirTrava(false); },
};

// ------------------------------------------------------------------ trava de gravação
function definirTrava(v: boolean) {
  app.liberado = v;
  document.body.classList.toggle('travado', !v);
  cadeado.textContent = v ? '🔓 Gravação LIBERADA' : '🔒 Travado · só testes';
  cadeado.className = 'btn cadeado ' + (v ? 'liberado' : 'fechado');
  cadeado.title = v ? 'Clique para travar de novo. Aplicar/reverter trava sozinho em seguida.' : 'Nada é gravado no projeto. Clique para liberar (pede confirmação).';
}
function pedirLiberacao(acao: string): Promise<boolean> {
  if (app.liberado) return Promise.resolve(true);
  return new Promise((ok) => {
    const chk = h('input', { type: 'checkbox' }) as HTMLInputElement;
    const botao = h('button.btn.pri', { disabled: true }, 'Destravar e continuar') as HTMLButtonElement;
    chk.onchange = () => { botao.disabled = !chk.checked; };
    let respondeu = false;
    const m = modal('Painel travado',
      h('div', null, h('p', null, 'O painel está ', h('b', null, 'TRAVADO'), ': suas mudanças são só prévia (lado B) e nada é gravado no projeto.'),
        h('p', null, 'Você pediu: ', h('b', null, acao), '.')),
      h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '10px 0' } }, chk, 'Sim, desejo destravar e gravar esta alteração no projeto.'),
      h('div.linha-form', null, botao, h('button.btn', { onclick: () => { respondeu = true; m.fechar(); ok(false); } }, 'Continuar só testando')));
    botao.onclick = async () => {
      try { await api.definirTrava(true); definirTrava(true); respondeu = true; m.fechar(); ok(true); }
      catch (e) { toast('Não foi possível destravar: ' + (e as Error).message, 'erro'); }
    };
    // fechar pelo ✕ ou clicando fora = continua travado
    new MutationObserver((_, obs) => { if (!document.body.contains(m.corpo)) { obs.disconnect(); if (!respondeu) ok(false); } }).observe(document.body, { childList: true });
  });
}
const cadeado = h('button.btn.cadeado', { onclick: async () => {
  if (app.liberado) { await app.travar(); toast('Travado: nada será gravado no projeto.', 'ok'); }
  else if (await pedirLiberacao('liberar gravação no projeto')) toast('Gravação liberada até você aplicar algo ou travar de novo.', 'ok');
} });
definirTrava(false);
// o servidor sempre sobe travado; se ficou liberado de antes (outra aba), trava ao abrir o painel
api.trava().then((r) => { if (r.liberado) app.travar(); }).catch(() => { /* API indisponível: continua travado */ });

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
  cadeado,
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
