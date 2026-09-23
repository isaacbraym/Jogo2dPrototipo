import { sfx } from '../core/audio';

type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, any> | null;

/** Criação de elementos enxuta (estilo hyperscript). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | string, props?: Props, ...children: Child[]): HTMLElementTagNameMap[K] {
  const [t, ...cls] = String(tag).split('.');
  const el = document.createElement(t || 'div') as any;
  if (cls.length) el.className = cls.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        const ev = k.slice(2).toLowerCase();
        if (ev === 'click') {
          el.addEventListener('click', (e: Event) => {
            sfx.unlock();
            if (!el.dataset.silent) sfx.click();
            v(e);
          });
        } else el.addEventListener(ev, v);
      } else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// ------------------------------------------------------------ ícones
const ICONS: Record<string, string> = {
  heart: '<path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.5 1-1.4 2.4-2.5 4.4-2.5 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/>',
  health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3c0 1.2.7 2.2 1.6 2.7A3 3 0 0 0 6 16a3 3 0 0 0 3 3h1V3H9zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 3 3c0 1.2-.7 2.2-1.6 2.7A3 3 0 0 1 18 16a3 3 0 0 1-3 3h-1V3h1z"/>',
  star: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.8-1 1.6-2.5 1.9-2.5.9-2.5 2 1 1.8 2.5 1.8 2.5-.8 2.5-1.8" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>',
  life: '<path d="M4 20c0-6 3.5-10 8-10s8 4 8 10M12 10V4M9 6l3-2 3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2.5 20c.6-3.9 3.3-6.5 6.5-6.5s5.9 2.6 6.5 6.5zM15 20c.3-2.4-.3-4.2-1.4-5.6 1-.6 2.1-.9 3.4-.9 2.7 0 4.6 2.2 5 6.5z"/>',
  work: '<path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 3h6V6H9z"/>',
  home: '<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 0v5h8V3M7 21v-7h10v7"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="#000" fill-opacity=".45"><circle cx="8" cy="8" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/></g>',
  undo: '<path d="M9 7H4V2M4.5 7A8 8 0 1 1 5 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  redo: '<path d="M15 7h5V2M19.5 7A8 8 0 1 0 19 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  next: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  music: '<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.8"/><circle cx="17.5" cy="16" r="2.8"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  skip: '<path d="M4 5l8 7-8 7zM12 5l8 7-8 7z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  body: '<circle cx="12" cy="5" r="3"/><path d="M7 9h10l-1.5 6H14l-.5 7h-3l-.5-7H8.5z"/>',
  face: '<circle cx="12" cy="12" r="9"/><g fill="#000" fill-opacity=".45"><circle cx="9" cy="10" r="1.3"/><circle cx="15" cy="10" r="1.3"/></g><path d="M8.5 14.5c1.8 2 5.2 2 7 0" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>',
  skin: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2" fill="#000" fill-opacity=".45"/>',
  brow: '<path d="M3 13c3-5 9-6.5 18-3.5-7-1-12 .5-15 5z"/>',
  nose: '<path d="M12 3c-1 5-4 9-4 12a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  mouth: '<path d="M3 11c3 0 5-2 9-2s6 2 9 2c-2 5-5 7-9 7s-7-2-9-7z"/>',
  ear: '<path d="M8 20c2 1 5 0 5-3 0-2 2-3 3-5a6 6 0 1 0-11-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  hair: '<path d="M4 14c0-6 3.6-10 8-10s8 4 8 10c0 3-1 5-2 6 0-5-2-9-6-10-1 3-4 5-8 6 0 1.5 0 2.5 0 4-1-1-0-4 0-6z"/>',
  beard: '<path d="M4 8c0 7 3.5 13 8 13s8-6 8-13c-2 2-4 3-8 3S6 10 4 8z"/>',
  makeup: '<path d="M14 3l5 5-9 9-5 1 1-5z"/>',
  shirt: '<path d="M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9L6 10 3 7z"/>',
  glasses: '<circle cx="6.5" cy="13" r="3.8" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.5" cy="13" r="3.8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10.3 12.5c1-1 2.4-1 3.4 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  id: '<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="8" cy="11" r="2.4" fill="#000" fill-opacity=".45"/><path d="M13 10h6M13 14h4" stroke="#000" stroke-opacity=".45" stroke-width="1.8" stroke-linecap="round"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  trash: '<path d="M5 7h14l-1 13H6zM9 7V4h6v3M3 7h18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  paw: '<circle cx="6" cy="10" r="2.2"/><circle cx="10" cy="6" r="2.2"/><circle cx="14" cy="6" r="2.2"/><circle cx="18" cy="10" r="2.2"/><path d="M12 11c3 0 6 4 6 6.5 0 2-2 2.5-3.5 2-1-.3-1.7-.7-2.5-.7s-1.5.4-2.5.7C8 20 6 19.5 6 17.5 6 15 9 11 12 11z"/>',
  sparkles: '<path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
};

export function icon(name: string, cls = ''): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] ?? ICONS.star}</svg>`;
  return wrap.firstChild as SVGSVGElement;
}

// ------------------------------------------------------------ toast & modal
let toastHost: HTMLElement | null = null;
export function toast(msg: string, kind: 'ok' | 'bad' | 'info' = 'info') {
  if (!toastHost) {
    toastHost = h('div.toasts');
    document.body.appendChild(toastHost);
  }
  const t = h('div.toast.' + kind, null, msg);
  toastHost.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 2600);
}

export function modal(title: string, body: Node, opts: { wide?: boolean; onClose?: () => void } = {}) {
  const close = () => {
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 250);
    opts.onClose?.();
  };
  const ov = h('div.modal-ov', { onclick: (e: MouseEvent) => { if (e.target === ov) close(); } },
    h('div.modal' + (opts.wide ? '.wide' : ''), null,
      h('div.modal-head', null, h('h3', null, title), h('button.icon-btn', { onclick: close, title: 'Fechar' }, icon('close'))),
      h('div.modal-body', null, body),
    ),
  );
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  return close;
}

export function confirmBox(title: string, text: string, okLabel = 'Confirmar'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const body = h('div.confirm', null,
      h('p', null, text),
      h('div.row.end', null,
        h('button.btn.ghost', { onclick: () => { done = true; close(); resolve(false); } }, 'Cancelar'),
        h('button.btn.primary', { onclick: () => { done = true; close(); resolve(true); } }, okLabel),
      ),
    );
    const close = modal(title, body, { onClose: () => { if (!done) resolve(false); } });
  });
}

export function promptBox(title: string, label: string, value: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const inp = h('input.input', { value, maxlength: 40 }) as HTMLInputElement;
    const ok = () => { done = true; close(); resolve(inp.value.trim() || value); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    const body = h('div.confirm', null, h('label.field', null, h('span', null, label), inp), h('div.row.end', null, h('button.btn.ghost', { onclick: () => { done = true; close(); resolve(null); } }, 'Cancelar'), h('button.btn.primary', { onclick: ok }, 'Salvar')));
    const close = modal(title, body, { onClose: () => { if (!done) resolve(null); } });
    setTimeout(() => inp.focus(), 50);
  });
}
