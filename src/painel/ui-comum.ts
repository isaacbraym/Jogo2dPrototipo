/** Peças de interface compartilhadas pelas abas do painel. */
import { h, copiar, modal } from './dom';
import type { App } from './main';
import type { Vinculo, Item } from './catalogo';
import type { Local } from './fontes';
import { textoPedido, Pedido } from './pedido';

export const localTxt = (l: Local | null | undefined) => (l ? `${l.arquivo}:${l.linha}` : '(sem local no código)');

export function chipVia(v: Vinculo['via']) {
  const r = { estrutural: 'confirmado · registro', estatico: 'inferido · código', observado: 'observado · execução' }[v];
  return h('span.chip.' + v, { title: v === 'estatico' ? 'Inferido do texto do código (pode ser falso positivo). Execute para confirmar.' : v === 'observado' ? 'Registrado ao executar a lógica/cena real no painel.' : 'Lido diretamente de um campo do registro.' }, r);
}

export function linkItem(app: App, chave: string) {
  const it = app.cat.get(chave);
  const [tipo, ...resto] = chave.split(':');
  const id = resto.join(':');
  return h('a', { onclick: () => app.abrirItem(chave), title: it ? it.descricao : 'não está no catálogo' }, `${it?.icone ?? '•'} ${tipo} `, h('code', null, id), it ? '' : ' (?)');
}

export function listaVinculos(app: App, vs: Vinculo[], lado: 'saida' | 'entrada') {
  if (!vs.length) return h('div.nota', null, lado === 'saida' ? 'Nenhum vínculo de saída conhecido.' : 'Nenhum vínculo de entrada conhecido.');
  const ordem = { estrutural: 0, observado: 1, estatico: 2 };
  return h('div', null, ...[...vs].sort((a, b) => ordem[a.via] - ordem[b.via]).slice(0, 200).map((v) => h('div.vinc', null,
    chipVia(v.via),
    h('div', null, linkItem(app, lado === 'saida' ? v.para : v.de), h('div.ctx', null, v.detalhe, v.local ? ` · ${localTxt(v.local)}` : '', v.contexto ? ` · contexto: ${v.contexto}` : '', v.quando ? ` · ${v.quando}` : '')),
  )), vs.length > 200 ? h('div.nota', null, `… e mais ${vs.length - 200}`) : null);
}

/** Modal "Copiar pedido para Luna". */
export function abrirPedido(base: Omit<Pedido, 'observacao' | 'melhoria' | 'variacoes'> & Partial<Pick<Pedido, 'observacao' | 'melhoria' | 'variacoes'>>) {
  const obs = h('textarea.campo', { rows: 3, placeholder: 'O que você observou (ex.: o pé atravessa o chão no impacto)' , value: base.observacao ?? '' }) as HTMLTextAreaElement;
  const mel = h('textarea.campo', { rows: 3, placeholder: 'Melhoria desejada (ex.: chute mais alto e com mais peso no quadril)', value: base.melhoria ?? '' }) as HTMLTextAreaElement;
  const nv = h('input.campo', { type: 'number', min: 1, max: 6, value: String(base.variacoes ?? 3) }) as HTMLInputElement;
  const prev = h('pre.codigo', { style: { maxHeight: '320px', whiteSpace: 'pre-wrap' } });
  const montar = () => textoPedido({ ...base, observacao: obs.value.trim(), melhoria: mel.value.trim(), variacoes: Math.max(1, Number(nv.value) || 1) } as Pedido);
  const atualizar = () => { prev.textContent = montar(); };
  [obs, mel, nv].forEach((e) => e.addEventListener('input', atualizar));
  atualizar();
  const m = modal('Copiar pedido para Luna',
    h('div.linha-form', null, h('label', null, 'Observação'), obs),
    h('div.linha-form', null, h('label', null, 'Melhoria'), mel),
    h('div.linha-form', null, h('label', null, 'Variações'), nv, h('span.nota', null, base.escopoCalibravel ? 'Dentro do escopo do calibrador (proposta JSON).' : 'Exige mudança de código (fora do calibrador).')),
    h('div.secao', null, 'Texto gerado'), prev,
    h('div.linha-form', null, h('button.btn.pri', { onclick: () => { copiar(montar(), 'Pedido'); m.fechar(); } }, 'Copiar pedido')),
  );
}

export function cabecalhoItem(app: App, it: Item) {
  return h('div', null,
    h('div.chips', null, h('span.chip', null, `${it.icone} ${it.tipo}`), h('button.id-copia', { title: 'Copiar id', onclick: () => copiar(it.id, `"${it.id}" copiado`) }, h('code', null, it.id), ' ⧉'),
      h('button.id-copia', { title: 'Copiar referência tipo:id @ arquivo:linha', onclick: () => copiar(`${it.chave} @ ${localTxt(it.local)}`, 'Referência') }, h('code', null, localTxt(it.local)), ' ⧉')),
    h('h2', null, it.nome),
    h('div.nota', null, it.descricao),
  );
  void app;
}
