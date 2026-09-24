/** Utilitários mínimos de DOM do painel (sem framework). */
type Attrs = Record<string, any> | null;
type Kid = Node | string | number | false | null | undefined | Kid[];

export function h(tag: string, attrs: Attrs = null, ...kids: Kid[]): HTMLElement {
  const [nome, ...cls] = tag.split('.');
  const el = document.createElement(nome || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className += ' ' + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && k !== 'list' && k !== 'type') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  anexar(el, kids);
  return el;
}

function anexar(el: HTMLElement, kids: Kid[]) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue;
    if (Array.isArray(k)) anexar(el, k);
    else el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  }
}

export function limpar(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function toast(msg: string, tipo: 'ok' | 'erro' | 'info' = 'info') {
  let box = document.querySelector('.toasts') as HTMLElement | null;
  if (!box) { box = h('div.toasts'); document.body.appendChild(box); }
  const t = h('div.toast.' + tipo, null, msg);
  box.appendChild(t);
  setTimeout(() => t.classList.add('sai'), 3200);
  setTimeout(() => t.remove(), 3700);
}

export async function copiar(texto: string, rotulo = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto);
    toast(`${rotulo} para a área de transferência.`, 'ok');
  } catch {
    // fallback: textarea selecionável
    const ta = h('textarea.copia-fallback', { value: texto, readOnly: true }) as HTMLTextAreaElement;
    modal('Copie o texto', ta);
    ta.select();
  }
}

/** Botão pequeno que copia um id/caminho. */
export function idCopiavel(id: string, titulo = 'Copiar id') {
  return h('button.id-copia', { title: titulo, onclick: (e: Event) => { e.stopPropagation(); copiar(id, `"${id}" copiado`); } }, h('code', null, id), ' ⧉');
}

export function modal(titulo: string, ...conteudo: Kid[]): { fechar: () => void; corpo: HTMLElement } {
  const fundo = h('div.modal-fundo');
  const corpo = h('div.modal-corpo', null, ...conteudo);
  const caixa = h('div.modal', null, h('div.modal-topo', null, h('b', null, titulo), h('button.fechar', { onclick: () => fechar() }, '✕')), corpo);
  fundo.appendChild(caixa);
  const fechar = () => fundo.remove();
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  document.body.appendChild(fundo);
  return { fechar, corpo };
}

export function baixarJSON(nome: string, dados: unknown) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: nome }) as HTMLAnchorElement;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function lerArquivoJSON(): Promise<any | null> {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept: '.json,application/json' }) as HTMLInputElement;
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return res(null);
      try { res(JSON.parse(await f.text())); } catch { toast('Arquivo JSON inválido', 'erro'); res(null); }
    };
    inp.click();
  });
}

export const fmt = (v: unknown, casas = 3) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(casas).replace(/\.?0+$/, '')) : String(v));

/** Armazenamento próprio do painel (chaves "painel.*" — nunca as do jogo). */
export const memoria = {
  ler<T>(k: string, def: T): T {
    try { const s = localStorage.getItem('painel.' + k); return s ? (JSON.parse(s) as T) : def; } catch { return def; }
  },
  gravar(k: string, v: unknown) {
    try { localStorage.setItem('painel.' + k, JSON.stringify(v)); } catch { /* cheio/indisponível */ }
  },
};
