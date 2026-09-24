/** Aba Catálogo: busca unificada, filtros por tipo, detalhe com vínculos, código e prévia real. */
import { h, limpar, memoria, toast } from './dom';
import type { App } from './main';
import { TIPOS, Tipo, Item } from './catalogo';
import { trecho, ocorrenciasLiterais } from './fontes';
import { listaVinculos, abrirPedido, cabecalhoItem, localTxt } from './ui-comum';
import { especDoItem, previaAnimada } from './previa';
import { cenarioParaItem } from './cenarios';
import { ehCalibravel } from './calib';
import { opcoesDoCampo } from './lab';

export function montar(el: HTMLElement, app: App, params: Record<string, string>) {
  const cat = app.cat;
  const filtro = new Set<Tipo>(memoria.ler<Tipo[]>('filtroTipos', []));
  let q = params.q ?? memoria.ler('buscaCat', '');
  let sel: string | null = params.item ?? null;
  let pararPrevia: (() => void) | null = null;

  const cont = cat.contagens();
  const lateral = h('div.cat-lateral', null,
    h('input.campo', { placeholder: 'Filtrar…', value: q, oninput: (e: Event) => { q = (e.target as HTMLInputElement).value; memoria.gravar('buscaCat', q); render(); } }),
    h('div.secao', null, 'Tipos'),
    h('label', null, h('input', { type: 'checkbox', checked: filtro.size === 0, onchange: () => { filtro.clear(); memoria.gravar('filtroTipos', []); montarLateral(); render(); } }), 'Todos', h('span.n', null, String(cat.lista.length))),
    ...TIPOS.map(({ tipo, rotulo, icone }) => h('label', null,
      h('input', { type: 'checkbox', checked: filtro.has(tipo), onchange: (e: Event) => { if ((e.target as HTMLInputElement).checked) filtro.add(tipo); else filtro.delete(tipo); memoria.gravar('filtroTipos', [...filtro]); render(); } }),
      `${icone} ${rotulo}`, h('span.n', null, String(cont[tipo] ?? 0)))),
    h('div.secao', null, 'Legenda de vínculos'),
    h('div.nota', null, h('span.chip.estrutural', null, 'confirmado · registro'), ' lido de um campo do registro.'),
    h('div.nota', null, h('span.chip.observado', null, 'observado · execução'), ' visto ao executar no painel (com contexto).'),
    h('div.nota', null, h('span.chip.estatico', null, 'inferido · código'), ' achado no texto do código; confirme executando.'),
  );
  const montarLateral = () => { lateral.querySelectorAll('input[type=checkbox]').forEach((c, i) => { (c as HTMLInputElement).checked = i === 0 ? filtro.size === 0 : filtro.has(TIPOS[i - 1].tipo); }); };
  const lista = h('div.cat-lista');
  const det = h('div.cat-det');
  el.append(lateral, lista, det);

  function render() {
    const { itens, total } = cat.buscar(q, filtro, 600);
    limpar(lista);
    lista.append(h('div.nota', { style: { padding: '8px 12px' } }, `${total} resultado(s)${total > itens.length ? ` — mostrando ${itens.length}; refine a busca` : ''}`));
    const frag = document.createDocumentFragment();
    for (const it of itens) {
      const linha = h('div.cat-linha' + (it.chave === sel ? '.sel' : ''), { onclick: () => { sel = it.chave; history.replaceState(null, '', `#catalogo?item=${encodeURIComponent(it.chave)}`); render(); detalhe(); } },
        h('span', null, it.icone),
        h('div', null, h('div.nm', null, it.nome !== it.id ? `${it.nome} ` : '', h('code', null, it.id)), h('div.t', null, `${it.tipo} · ${localTxt(it.local)}`)),
        h('span.nota', null, String(cat.saida(it.chave).length + cat.entrada(it.chave).length)),
      );
      frag.appendChild(linha);
    }
    lista.appendChild(frag);
  }

  function detalhe() {
    pararPrevia?.(); pararPrevia = null;
    limpar(det);
    const it = sel ? cat.get(sel) : null;
    if (!it) { det.append(h('div.nota', null, 'Selecione um item. Dica: busque por id exato (ex.: estagiarioVirouChefe, agg_chute, chute).')); return; }
    det.append(cabecalhoItem(app, it));
    det.append(acoes(it));
    const spec = especDoItem(it);
    if (spec) {
      const cv = h('canvas.previa') as HTMLCanvasElement;
      det.append(h('div.secao', null, 'Prévia (renderizador real)'), cv);
      requestAnimationFrame(() => { pararPrevia = previaAnimada(cv, spec); });
    }
    if (it.tipo === 'visual') {
      const ops = opcoesDoCampo(it.id);
      det.append(h('div.secao', null, `Opções (${ops.length})`), h('div.chips', null, ...ops.slice(0, 80).map((o) => h('span.chip', { title: String(o.valor) }, o.rotulo))));
    }
    if (it.detalhes.length) det.append(h('div.secao', null, 'Detalhes'), h('table.tabela', null, ...it.detalhes.map(([k, v]) => h('tr', null, h('th', null, k), h('td', null, v)))));
    det.append(h('div.secao', null, `Saída — o que ${it.id} usa/produz (${cat.saida(it.chave).length})`), listaVinculos(app, cat.saida(it.chave), 'saida'));
    det.append(h('div.secao', null, `Entrada — quem usa ${it.id} (${cat.entrada(it.chave).length})`), listaVinculos(app, cat.entrada(it.chave), 'entrada'));
    const lits = ocorrenciasLiterais(it.id, it.local);
    det.append(h('div.secao', null, `Ocorrências literais de "${it.id}" no código (${lits.length})`),
      lits.length ? h('div.nota', null, lits.slice(0, 30).map((l) => `${l.arquivo}:${l.linha}`).join(' · ') + (lits.length > 30 ? ' …' : ''))
        : h('div.nota', null, cat.entrada(it.chave).length ? 'Nenhum literal, mas há vínculo de entrada (uso estrutural/observado).' : '⚠ Nenhuma ocorrência literal e nenhum vínculo de entrada. Pode ser sem uso OU usado por nome montado em tempo de execução — confirme em Qualidade → varreduras.'));
    if (it.local) det.append(h('div.secao', null, `Código — ${localTxt(it.local)}`), h('pre.codigo', null, trecho(it.local.arquivo, it.local.linha, 1, it.tipo === 'cena' || it.tipo === 'evento' ? 30 : 16)));
  }

  function acoes(it: Item) {
    const b: HTMLElement[] = [];
    const cen = ['evento', 'escolha', 'interacao', 'agressao', 'acao', 'entrevista'].includes(it.tipo);
    if (cen) b.push(h('button.btn.pri', { onclick: () => { const c = cenarioParaItem(it, 1); if (!c) return toast('Não achei um cenário inicial para este item.', 'erro'); app.abrirEsteira(c); } }, '▶ Executar na esteira'));
    const spec = especDoItem(it);
    if (spec) b.push(h('button.btn.pri', { onclick: () => app.abrirLab(spec, { cadeia: `${it.tipo} ${it.id}` }) }, '🔬 Abrir no laboratório'));
    b.push(h('button.btn', { onclick: () => abrirPedido({ tipo: it.tipo, id: it.id, cadeia: `${it.tipo} ${it.id}`, arquivo: localTxt(it.local), escopoCalibravel: (it.tipo === 'movimento' && ehCalibravel(it.id)) || it.tipo === 'expressao' }) }, '✉ Copiar pedido para Luna'));
    return h('div.chips', { style: { margin: '10px 0' } }, ...b);
  }

  render();
  detalhe();
  return () => { pararPrevia?.(); };
}
