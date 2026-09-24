/**
 * Vínculos OBSERVADOS em execução (esteira e laboratório), com o contexto que os produziu.
 * Guardados na memória do painel ("painel.observados") para sobreviver a recarregamentos.
 */
import { Catalogo } from './catalogo';
import { memoria } from './dom';

export interface Observacao { de: string; para: string; detalhe: string; contexto: string; quando: string }

let lista: Observacao[] = memoria.ler<Observacao[]>('observados', []);
let catalogo: Catalogo | null = null;
const ouvintes = new Set<() => void>();

export function ligarObservacoes(c: Catalogo) {
  catalogo = c;
  for (const o of lista) aplicar(o);
}

function aplicar(o: Observacao) {
  if (!catalogo) return;
  // "evento-cadeia:<id>" = evento encadeado não registrado em EVENTS (ex.: etapas da entrevista)
  if (o.para.startsWith('evento-cadeia:')) return;
  if (!catalogo.get(o.de) || !catalogo.get(o.para)) return;
  catalogo.ligar({ de: o.de, para: o.para, via: 'observado', detalhe: o.detalhe, contexto: o.contexto, quando: o.quando });
}

export function observar(itens: { de: string; para: string; detalhe: string }[], contexto: string) {
  const quando = new Date().toLocaleString('pt-BR');
  let novos = 0;
  for (const i of itens) {
    if (lista.some((x) => x.de === i.de && x.para === i.para && x.detalhe === i.detalhe)) continue;
    const o = { ...i, contexto, quando };
    lista.push(o);
    aplicar(o);
    novos++;
  }
  if (lista.length > 5000) lista = lista.slice(-5000);
  if (novos) { memoria.gravar('observados', lista); ouvintes.forEach((f) => f()); }
  return novos;
}

export function todasObservacoes() { return lista; }
export function limparObservacoes() { lista = []; memoria.gravar('observados', lista); }
export function aoObservar(f: () => void) { ouvintes.add(f); return () => ouvintes.delete(f); }
