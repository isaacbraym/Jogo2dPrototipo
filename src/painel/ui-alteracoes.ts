/** Aba Alterações: calibração aplicada, histórico com reversão, trilha de auditoria, arquivos de QA. */
import { h, limpar, toast, modal } from './dom';
import type { App } from './main';
import { api } from './api';
import { tentativasBloqueadas } from './guarda';
import { ESTADO_CALIBRACAO } from '../character/calibracao';

export function montar(el: HTMLElement, app: App, _p: Record<string, string>) {
  const pag = h('div.pagina');
  el.append(pag);
  const cartao = (t: string, ...c: (Node | string)[]) => h('div.cartao', null, h('h3', null, t), ...c);

  async function render() {
    limpar(pag).append(h('div.nota', null, 'Carregando…'));
    let est: any;
    try { est = await api.estado(); } catch (e) { limpar(pag).append(h('div.aviso', null, 'API local indisponível (abra pelo `npm run painel`/`npm run dev`): ' + (e as Error).message)); return; }
    const [cen, prop] = await Promise.all([api.listar('cenarios').catch(() => []), api.listar('propostas').catch(() => [])]);
    limpar(pag);
    pag.append(cartao(`src/data/calibracao.json (hash ${est.hash})`,
      h('div.nota', null, ESTADO_CALIBRACAO.erros.length ? '⚠ o runtime IGNOROU a calibração por erros: ' + ESTADO_CALIBRACAO.erros.join('; ') : `Aplicada no runtime: movimentos [${ESTADO_CALIBRACAO.movimentos.join(', ')}] · expressões [${ESTADO_CALIBRACAO.expressoes.join(', ')}]`),
      h('pre.codigo', null, JSON.stringify(est.calibracao, null, 2))));
    pag.append(cartao(`Histórico (${est.historico.length}) — cópias automáticas antes de cada aplicação`,
      est.historico.length ? h('table.tabela', null, ...est.historico.map((arq: string) => h('tr', null, h('td', null, h('code', null, 'qa/historico/' + arq)),
        h('td', null, h('button.btn.mini', { onclick: async () => {
          const motivo = prompt(`Reverter src/data/calibracao.json para ${arq}?\nInforme o motivo:`);
          if (!motivo || motivo.trim().length < 3) return;
          try { const r = await api.reverter(arq, motivo.trim()); modal('Revertido', h('pre.codigo', null, r.diff)); toast('Revertido. Recarregando…', 'ok'); setTimeout(() => location.reload(), 900); }
          catch (e) { toast((e as Error).message + ((e as any).detalhes ? ': ' + JSON.stringify((e as any).detalhes) : ''), 'erro'); }
        } }, 'reverter para esta'))))) : h('div.nota', null, 'Nenhuma aplicação feita ainda.')));
    pag.append(cartao(`Trilha de auditoria (qa/auditoria.jsonl · ${est.auditoria.length} últimas)`,
      est.auditoria.length ? h('table.tabela', null, h('tr', null, h('th', null, 'quando'), h('th', null, 'ação'), h('th', null, 'arquivo'), h('th', null, 'motivo / origem'), h('th', null, 'diff')),
        ...est.auditoria.map((a: any) => h('tr', null, h('td', null, new Date(a.ts).toLocaleString('pt-BR')), h('td', null, a.acao), h('td', null, h('code', null, a.arquivo ?? a.para ?? '')),
          h('td', null, [a.motivo, a.origem ? JSON.stringify(a.origem) : '', a.antes ? `${a.antes} → ${a.depois}` : ''].filter(Boolean).join(' · ')),
          h('td', null, a.diff?.length ? h('details', null, h('summary', null, `${a.diff.length} linha(s)`), h('pre.codigo', null, a.diff.join('\n'))) : '')))) : h('div.nota', null, 'Vazia.')));
    pag.append(cartao(`Cenários (qa/cenarios · ${cen.length})`, h('table.tabela', null, ...cen.map((c: any) => h('tr', null, h('td', null, h('code', null, c.nome)), h('td', null, c.titulo), h('td', null, h('button.btn.mini', { onclick: async () => app.abrirEsteira(await api.ler('cenarios', c.nome)) }, 'abrir na esteira')))))));
    pag.append(cartao(`Propostas (qa/propostas · ${prop.length})`, h('table.tabela', null, ...prop.map((c: any) => h('tr', null, h('td', null, h('code', null, c.nome)), h('td', null, c.titulo), h('td', null, c.alvo)))),
      h('div.nota', null, 'Abra propostas pelo laboratório (Calibrador → "Abrir de qa/propostas") para comparar em A/B e aplicar.')));
    pag.append(cartao('Proteção dos saves', h('div.nota', null, tentativasBloqueadas.length ? `${tentativasBloqueadas.length} acesso(s) a "viva.*" bloqueado(s) nesta sessão.` : '✔ Nenhum acesso a saves do jogo nesta sessão.')));
  }
  render();
}
