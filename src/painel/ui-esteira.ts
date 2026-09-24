/** Aba Esteira: cenário isolado → execução real passo a passo → diferenças de estado → sementes. */
import { h, limpar, toast, copiar, memoria, baixarJSON, lerArquivoJSON, modal, fmt } from './dom';
import type { App } from './main';
import { EVENTS } from '../game/events';
import { ACTIONS, INTERACTIONS } from '../game/activities';
import { CAREERS } from '../game/careers';
import { AGGRO } from '../game/aggression';
import { REL_LABEL, Rel, STAT_KEYS, leaveJobPeople, Life } from '../game/state';
import {
  Cenario, KINDS, ROTULO_PERFIL, BASE_AGE, Kind, vidaDoPerfil, validarVida, motivosEvento, requisitosDoCodigo, procurarVidaValida,
  adicionarPessoa, darEmprego, envelhecerSoIdade, clone, novoCenario, Mudanca,
} from './vida';
import { executar, explorarSementes, todosOsCaminhos, Execucao, Passo } from './execucao';
import { observar } from './observado';
import { api, nomeArquivo } from './api';
import { BONECOS_PADRAO } from './lab';
import { abrirPedido } from './ui-comum';

export function montar(el: HTMLElement, app: App, _p: Record<string, string>) {
  let cen: Cenario = app.cenario ?? novoCenario({ tipo: 'evento', id: 'estagiarioVirouChefe' }, vidaDoPerfil('adultoSolteiro', 30, 1), 'padrão', 1);
  let ex: Execucao | null = null;
  const esq = h('div.est-col.est-esq'), meio = h('div.est-col.est-meio'), dir = h('div.est-col.est-dir');
  el.append(esq, meio, dir);

  const salvarLocal = () => { app.cenario = cen; memoria.gravar('cenario', cen); };
  const caminhoEl = h('code');
  const rodar = () => {
    salvarLocal();
    caminhoEl.textContent = `[${cen.caminho.join(', ')}]`;
    ex = executar(cen);
    const n = observar(ex.observados, `esteira · ${cen.alvo.tipo} ${cen.alvo.id} · semente ${cen.semente} · caminho [${cen.caminho.join(',')}]${ex.forcada.length ? ' · FORÇADA' : ''}`);
    void n;
    renderMeio();
    renderDir();
  };

  // ================================================================ coluna esquerda: cenário
  function renderEsq() {
    limpar(esq);
    const L = cen.vida;
    const val = validarVida(L);
    const alvos = [
      ...EVENTS.map((e) => ['evento', e.id]), ...INTERACTIONS.filter((i) => !i.id.startsWith('agg_')).map((i) => ['interacao', i.id]),
      ...Object.keys(AGGRO).map((k) => ['agressao', k]), ...ACTIONS.map((a) => ['acao', a.id]), ...CAREERS.map((c) => ['entrevista', c.id]),
    ];
    const dl = h('datalist', { id: 'alvos-dl' }, ...alvos.map(([t, id]) => h('option', { value: `${t}:${id}` })));
    const alvoInp = h('input.campo', { list: 'alvos-dl', value: `${cen.alvo.tipo}:${cen.alvo.id}`, onchange: (e: Event) => {
      const [t, ...r] = (e.target as HTMLInputElement).value.split(':');
      const id = r.join(':');
      if (!alvos.some(([a, b]) => a === t && b === id)) return toast('Alvo inexistente. Use tipo:id (ex.: evento:estagiarioVirouChefe).', 'erro');
      cen = { ...cen, alvo: { tipo: t as Cenario['alvo']['tipo'], id }, caminho: [], titulo: `${t} ${id}` };
      renderEsq(); rodar();
    } });
    esq.append(h('div.secao', null, 'Alvo'), dl, alvoInp);
    if (cen.alvo.tipo === 'interacao' || cen.alvo.tipo === 'agressao') {
      const it = INTERACTIONS.find((i) => i.id === (cen.alvo.tipo === 'agressao' ? 'agg_' + cen.alvo.id : cen.alvo.id));
      esq.append(h('div.linha-form', null, h('label', null, 'Pessoa-alvo'),
        h('select.campo', { onchange: (e: Event) => { cen.alvo.pessoaId = (e.target as HTMLSelectElement).value; cen.caminho = []; rodar(); } },
          h('option', { value: '' }, '— escolha —'),
          ...L.people.map((p) => h('option', { value: p.id, selected: p.id === cen.alvo.pessoaId }, `${p.first} (${p.rel}, ${p.age}a, vínculo ${p.bond})${!p.alive ? ' †' : ''}${it && !it.cond(L, p) ? ' · indisponível' : ''}`)))));
    }
    // semente e reprodução
    const sem = h('input.campo', { type: 'number', value: String(cen.semente), onchange: (e: Event) => { cen.semente = Number((e.target as HTMLInputElement).value) | 0; rodar(); } });
    esq.append(h('div.secao', null, 'Semente e reprodução'),
      h('div.linha-form', null, h('label', null, 'Semente'), sem,
        h('button.btn.mini', { onclick: () => { cen.semente = (Math.random() * 1e6) | 0; renderEsq(); rodar(); } }, '🎲'),
        h('button.btn.mini', { title: 'Executa duas vezes do zero e compara o estado observável', onclick: () => { const a = executar(cen), b = executar(cen); toast(a.hash === b.hash ? `✅ Idêntico nas duas execuções (hash ${a.hash})` : `❌ Divergiu: ${a.hash} × ${b.hash}`, a.hash === b.hash ? 'ok' : 'erro'); } }, 'Repetir e comparar')),
      h('div.linha-form', null, h('label', null, 'Caminho'), caminhoEl, h('button.btn.mini', { onclick: () => { cen.caminho = []; rodar(); } }, 'limpar')),
    );
    // forçar
    const chk = (k: keyof Cenario['forcar'], rot: string) => h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', checked: !!cen.forcar[k], onchange: (e: Event) => { cen.forcar = { ...cen.forcar, [k]: (e.target as HTMLInputElement).checked }; rodar(); } }), ' ', rot);
    esq.append(h('div.secao', null, 'Forçar (marca a execução como FORÇADA)'),
      chk('idade', 'ignorar faixa de idade'), chk('unica', 'ignorar "uma vez por vida"'), chk('condicao', 'ignorar condição / peso zero / prisão'), chk('escolhaDesabilitada', 'permitir escolha desabilitada'));
    // pré-requisitos (eventos)
    if (cen.alvo.tipo === 'evento') {
      const ev = EVENTS.find((e) => e.id === cen.alvo.id);
      if (ev) {
        const mot = motivosEvento(L, ev);
        const req = requisitosDoCodigo(L, ev);
        esq.append(...[h('div.secao', null, 'Disponibilidade e pré-requisitos'),
          h('div', null, ...mot.map((m) => h('div', { style: { color: m.ok ? '#9ff0c3' : '#ffb3c6', fontSize: '12.5px' } }, `${m.ok ? '✔' : '✘'} ${m.rotulo}: ${m.detalhe}`))),
          req.requisitos.length ? h('table.tabela', null, h('tr', null, h('th', null, 'o código consulta'), h('th', null, 'nesta vida'), h('th', null, '')),
            ...req.requisitos.map((r) => h('tr', null, h('td', null, r.texto), h('td', { style: { color: r.ok === false ? '#ffb3c6' : r.ok ? '#9ff0c3' : '' } }, r.valorAtual),
              h('td', null, r.ajuda ? h('button.btn.mini', { onclick: () => { r.ajuda!.aplicar(cen.vida); cen.caminho = []; renderEsq(); rodar(); } }, r.ajuda.rotulo) : '')))) : h('div.nota', null, 'O código de cond/peso/setup não consulta flags, pessoas ou emprego.'),
          req.precursores.length ? h('div', null, h('div.nota', null, 'Eventos que ESCREVEM as flags exigidas (rode um deles nesta vida para montar o caminho real):'),
            ...[...new Set(req.precursores.map((p) => p.evento))].map((id) => {
              const pev = EVENTS.find((e) => e.id === id)!;
              const sel = h('select.campo', { style: { width: '180px' } }, ...(pev.choices ?? []).map((c, i) => h('option', { value: String(i) }, `${i + 1}. ${c.label}`))) as HTMLSelectElement;
              const anos = h('input.campo', { type: 'number', value: '2', title: 'anos a envelhecer depois (só idade)' }) as HTMLInputElement;
              return h('div.grupo-sem', null, h('b', null, id), ' ', h('span.nota', null, `(${pev.min}–${pev.max})`), h('div.linha-form', null, pev.choices ? sel : '', '+', anos, 'anos',
                h('button.btn.mini', { onclick: () => {
                  const pc: Cenario = { ...clone(cen), alvo: { tipo: 'evento', id }, caminho: pev.choices ? [Number(sel.value)] : [], forcar: { ...cen.forcar } };
                  const r = executar(pc);
                  const falhou = r.passos.find((p) => p.tipo === 'bloqueio' || p.tipo === 'erro');
                  if (falhou) return toast(`Precursor não rodou: ${falhou.titulo}`, 'erro');
                  const nova = clone(r.final);
                  envelhecerSoIdade(nova, Number(anos.value) || 0);
                  cen = { ...cen, vida: nova, caminho: [], origem: `${cen.origem} + precursor ${id}#${sel.value}${r.forcada.length ? ' (FORÇADO)' : ''} (semente ${cen.semente}) + ${anos.value} ano(s)` };
                  renderEsq(); rodar();
                  toast(`Precursor ${id} executado com a lógica real${r.forcada.length ? ' — FORÇADO' : ''}.`, 'ok');
                } }, 'Rodar precursor')));
            })) : null,
          h('details', null, h('summary', { style: { cursor: 'pointer', fontSize: '12px' } }, 'Código de cond / peso / setup'), h('pre.codigo', null, req.fonte || '(sem condição)')),
          h('div.linha-form', null, h('button.btn.mini', { onclick: () => { const r = procurarVidaValida(ev, cen.semente); if (!r) return toast('Nenhum perfil de teste satisfaz o evento: use os precursores/ajudas acima.', 'erro'); cen = { ...cen, vida: r.vida, origem: r.origem, caminho: [] }; renderEsq(); rodar(); } }, '🔎 Procurar vida válida nos perfis')),
        ].filter((x): x is HTMLElement => !!x));
      }
    }
    // vida base
    const perfil = h('select.campo', { style: { width: '170px' } }, ...KINDS.map((k) => h('option', { value: k }, ROTULO_PERFIL[k]))) as HTMLSelectElement;
    const idade = h('input.campo', { type: 'number', value: String(L.player.age) }) as HTMLInputElement;
    esq.append(h('div.secao', null, 'Vida do cenário (isolada — nunca um save)'),
      h('div.nota', null, `Origem: ${cen.origem}`),
      h('div.linha-form', null, perfil, idade, h('button.btn.mini', { onclick: () => { const k = perfil.value as Kind; cen = { ...cen, vida: vidaDoPerfil(k, Number(idade.value) || BASE_AGE[k], cen.semente), origem: `perfil "${k}" aos ${idade.value}`, caminho: [] }; renderEsq(); rodar(); } }, 'Gerar vida')),
      val.erros.length ? h('div.aviso', null, 'Vida inválida: ' + val.erros.join('; ')) : h('div.nota', null, '✔ vida válida' + (val.avisos.length ? ' · avisos: ' + val.avisos.join('; ') : '')),
    );
    esq.append(editorVida(L));
    // salvar / carregar
    const nome = h('input.campo', { placeholder: 'nome do cenário', value: nomeArquivo(cen.titulo) }) as HTMLInputElement;
    const lista = h('div');
    const carregarLista = async () => {
      try {
        const arqs = await api.listar('cenarios');
        limpar(lista).append(...arqs.map((a: any) => h('div.linha-form', null, h('button.btn.mini', { onclick: async () => { const c = await api.ler('cenarios', a.nome); if (validarVida(c.vida).erros.length) return toast('Cenário com vida inválida.', 'erro'); cen = c; renderEsq(); rodar(); toast(`Cenário ${a.nome} carregado.`, 'ok'); } }, 'carregar'), h('code', null, a.nome), h('span.nota', null, a.titulo))));
        if (!arqs.length) lista.append(h('div.nota', null, 'Nenhum cenário em qa/cenarios/.'));
      } catch (e) { limpar(lista).append(h('div.nota', null, 'API local indisponível: ' + (e as Error).message)); }
    };
    esq.append(h('div.secao', null, 'Salvar / carregar / compartilhar'),
      h('div.linha-form', null, nome, h('button.btn.mini', { onclick: async () => {
        if (validarVida(cen.vida).erros.length) return toast('Corrija a vida antes de salvar.', 'erro');
        if (!(await app.exigirLiberacao('salvar o cenário em qa/cenarios'))) return toast('Nada foi gravado (painel travado). Use "Exportar JSON" para guardar fora do projeto.', 'info');
        try { const r = await api.salvar('cenarios', nomeArquivo(nome.value), { ...cen, titulo: cen.titulo || nome.value }); toast(`Salvo em ${r.arquivo}`, 'ok'); carregarLista(); } catch (e) { toast((e as Error).message, 'erro'); }
      } }, 'Salvar em qa/cenarios')),
      h('div.linha-form', null,
        h('button.btn.mini', { onclick: () => baixarJSON(`${nomeArquivo(nome.value)}.cenario.json`, cen) }, 'Exportar JSON'),
        h('button.btn.mini', { onclick: async () => { const c = await lerArquivoJSON(); if (!c) return; if (c.formato !== 'viva-cenario') return toast('Não é um arquivo viva-cenario.', 'erro'); const v = validarVida(c.vida); if (v.erros.length) return toast('Vida inválida: ' + v.erros[0], 'erro'); cen = c; renderEsq(); rodar(); } }, 'Importar JSON'),
        h('button.btn.mini', { onclick: () => copiar(JSON.stringify(cen), 'Cenário (JSON)') }, 'Copiar JSON')),
      lista);
    carregarLista();
  }

  function editorVida(L: Life) {
    const box = h('details', { open: memoria.ler('editorAberto', false), ontoggle: (e: Event) => memoria.gravar('editorAberto', (e.target as HTMLDetailsElement).open) });
    const mud = () => { cen.caminho = []; renderEsq(); rodar(); };
    const num = (rot: string, v: number, set: (n: number) => void) => h('div.linha-form', null, h('label', null, rot), h('input.campo', { type: 'number', value: String(v), onchange: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); mud(); } }));
    box.append(h('summary', { style: { cursor: 'pointer', fontWeight: 800 } }, 'Editar vida (atributos, dinheiro, emprego, pessoas, flags)'),
      num('Idade', L.player.age, (n) => { const d = n - L.player.age; envelhecerSoIdade(L, d); }),
      ...STAT_KEYS.map((k) => num(k, L.stats[k], (n) => { L.stats[k] = Math.max(0, Math.min(100, n)); })),
      num('Dinheiro', L.money, (n) => { L.money = n; }), num('Karma', L.karma, (n) => { L.karma = n; }), num('Ficha criminal', L.crime.ficha, (n) => { L.crime.ficha = Math.max(0, n); }),
      h('div.linha-form', null, h('label', null, 'Emprego'), h('select.campo', { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; if (!v) { L.job = null; leaveJobPeople(L); } else darEmprego(L, v); mud(); } },
        h('option', { value: '' }, 'desempregado(a)'), ...CAREERS.map((c) => h('option', { value: c.id, selected: L.job?.id === c.id }, c.title)))),
      h('div.linha-form', null, h('label', null, 'Escolaridade'), h('select.campo', { onchange: (e: Event) => { L.edu.stage = (e.target as HTMLSelectElement).value as Life['edu']['stage']; mud(); } },
        ...['nenhum', 'fundamental', 'medio', 'faculdade', 'formado'].map((s) => h('option', { value: s, selected: L.edu.stage === s }, s)))),
      h('div.linha-form', null, h('label', null, 'Preso(a)'), h('input', { type: 'checkbox', checked: L.crime.preso, onchange: (e: Event) => { L.crime.preso = (e.target as HTMLInputElement).checked; mud(); } })),
      h('div.secao', null, 'Pessoas'),
      h('table.tabela', null, h('tr', null, h('th', null, 'nome'), h('th', null, 'rel'), h('th', null, 'idade'), h('th', null, 'vínculo'), h('th', null, 'viva'), h('th', null, '')),
        ...L.people.map((p, i) => h('tr', null, h('td', null, p.first),
          h('td', null, h('select', { onchange: (e: Event) => { p.rel = (e.target as HTMLSelectElement).value as Rel; mud(); } }, ...Object.keys(REL_LABEL).map((r) => h('option', { value: r, selected: r === p.rel }, r)))),
          h('td', null, h('input', { type: 'number', value: String(p.age), style: { width: '52px' }, onchange: (e: Event) => { p.age = Number((e.target as HTMLInputElement).value); mud(); } })),
          h('td', null, h('input', { type: 'number', value: String(p.bond), style: { width: '52px' }, onchange: (e: Event) => { p.bond = Math.max(0, Math.min(100, Number((e.target as HTMLInputElement).value))); mud(); } })),
          h('td', null, h('input', { type: 'checkbox', checked: p.alive, onchange: (e: Event) => { p.alive = (e.target as HTMLInputElement).checked; mud(); } })),
          h('td', null, h('button.btn.mini', { onclick: () => { L.people.splice(i, 1); mud(); } }, '✕'))))),
      h('div.linha-form', null, h('select.campo', { id: 'nova-rel', style: { width: '140px' } }, ...Object.keys(REL_LABEL).map((r) => h('option', { value: r }, r))),
        h('button.btn.mini', { onclick: () => { adicionarPessoa(L, (document.getElementById('nova-rel') as HTMLSelectElement).value as Rel); mud(); } }, '+ pessoa')),
      h('div.secao', null, 'Flags'),
      h('table.tabela', null, ...Object.entries(L.flags).map(([k, v]) => h('tr', null, h('td', null, h('code', null, k)),
        h('td', null, h('input', { value: JSON.stringify(v), style: { width: '120px' }, onchange: (e: Event) => { try { const nv = JSON.parse((e.target as HTMLInputElement).value); if (!['number', 'string', 'boolean'].includes(typeof nv)) throw 0; L.flags[k] = nv; mud(); } catch { toast('Valor de flag deve ser número, "texto" ou true/false', 'erro'); } } })),
        h('td', null, h('button.btn.mini', { onclick: () => { delete L.flags[k]; mud(); } }, '✕'))))),
      h('div.linha-form', null, h('input.campo', { id: 'nova-flag', placeholder: 'flag', style: { width: '140px' } }), h('input.campo', { id: 'nova-flag-v', placeholder: 'valor JSON', style: { width: '100px' } }),
        h('button.btn.mini', { onclick: () => { const k = (document.getElementById('nova-flag') as HTMLInputElement).value.trim(); const vs = (document.getElementById('nova-flag-v') as HTMLInputElement).value; if (!/^\w+$/.test(k)) return toast('Nome de flag inválido', 'erro'); try { L.flags[k] = JSON.parse(vs || '1'); } catch { L.flags[k] = vs; } mud(); } }, '+ flag')),
      h('div.secao', null, 'JSON da vida (avançado)'),
      (() => { const ta = h('textarea.campo', { rows: 8, value: JSON.stringify(L, null, 1) }) as HTMLTextAreaElement; return h('div', null, ta, h('button.btn.mini', { onclick: () => { try { const nv = JSON.parse(ta.value); const v = validarVida(nv); if (v.erros.length) return modal('Vida inválida', h('pre.codigo', null, v.erros.join('\n'))); cen.vida = nv; mud(); } catch (e) { toast('JSON inválido: ' + (e as Error).message, 'erro'); } } }, 'Aplicar JSON')); })(),
    );
    return box;
  }

  // ================================================================ coluna do meio: esteira
  function renderMeio() {
    limpar(meio);
    if (!ex) return;
    meio.append(h('div.linha-form', null, h('b', null, `▶ ${cen.alvo.tipo} ${cen.alvo.id}`), h('span.nota', null, `semente ${cen.semente} · caminho [${cen.caminho.join(',')}] · hash ${ex.hash}`),
      h('button.btn.mini', { onclick: () => {
        const cams = todosOsCaminhos(cen);
        modal(`Todos os caminhos (${cams.length})`, h('table.tabela', null, h('tr', null, h('th', null, 'caminho'), h('th', null, 'desfechos'), h('th', null, 'mudanças'), h('th', null, '')),
          ...cams.map((c) => { const r = executar({ ...cen, caminho: c }); return h('tr', null, h('td', null, h('code', null, `[${c.join(',')}]`)), h('td', null, r.passos.filter((p) => p.tipo === 'resultado' || p.tipo === 'bloqueio').map((p) => `${p.titulo}${p.cena ? ` [${p.cena.id}]` : ''}`).join(' → ')), h('td', null, String(r.mudancasTotais.length)), h('td', null, h('button.btn.mini', { onclick: () => { cen.caminho = c; rodar(); } }, 'abrir'))); })));
        for (const c of cams) observar(executar({ ...cen, caminho: c }).observados, `esteira · todos os caminhos de ${cen.alvo.id} · semente ${cen.semente}`);
      } }, '🔀 Percorrer todas as escolhas')));
    if (ex.forcada.length) meio.append(h('div.forcado-banner', null, '⚠ EXECUÇÃO FORÇADA com condição ignorada — não é um caminho alcançável normalmente: ' + ex.forcada.join(' · ')));
    for (const p of ex.passos) meio.append(cartaoPasso(p));
  }

  function cartaoPasso(p: Passo) {
    const c = h('div.passo.' + p.tipo + (p.tom === 'ruim' ? '.ruim' : ''), { style: { marginLeft: `${p.nivel * 18}px` } },
      h('div.cab', null, p.icone ? h('span', null, p.icone) : '', h('span', null, rotuloTipo(p.tipo) + ' · ' + p.titulo), h('span.ramo', null, p.ramo)));
    if (p.forcado?.length) c.append(h('div.chips', null, ...p.forcado.map((f) => h('span.chip.forcado', null, 'forçado: ' + f))));
    if (p.texto) c.append(h('div.txt', null, p.texto));
    if (p.tipo === 'abertura' || p.tipo === 'pendente') {
      if (p.escolhas?.length && p.tipo === 'abertura') {
        const decisao = ex!.passos.find((x) => x.tipo === 'decisao' && x.eventoId === p.eventoId && x.ramo === p.ramo) ?? ex!.passos.find((x) => x.tipo === 'pendente' && x.ramo === p.ramo);
        const d = decisao?.decisao;
        c.append(h('div.escolhas', null, ...p.escolhas.map((e) => h('button.btn' + (decisao?.escolhida === e.idx ? '.sel' : ''), {
          disabled: !e.ok && !cen.forcar.escolhaDesabilitada,
          title: e.ok ? '' : 'Escolha desabilitada nesta vida (cond da escolha = falso)',
          onclick: () => { if (d === undefined) return; cen.caminho = [...cen.caminho.slice(0, d), e.idx]; rodar(); },
        }, `${e.icone ?? ''} ${e.idx + 1}. ${e.rotulo}${e.ok ? '' : ' (desabilitada)'}`))));
      }
    }
    if (p.cena) {
      c.append(h('div.chips', null, h('span.chip', null, `🎬 cena ${p.cena.id}`), ...Object.entries(p.cena.data).map(([k, v]) => h('span.chip', null, `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)),
        p.cena.othersNomes.length ? h('span.chip', null, 'elenco: ' + p.cena.othersNomes.join(', ')) : '',
        h('button.btn.mini', { onclick: () => app.abrirLab({ modo: 'cena', id: p.cena!.id, cena: { id: p.cena!.id, data: p.cena!.data, player: p.cena!.player, others: p.cena!.others }, bonecos: { ...BONECOS_PADRAO }, semente: cen.semente }, { cadeia: `${cen.alvo.tipo} ${cen.alvo.id} → ${p.ramo} → cena ${p.cena!.id}`, semente: cen.semente, cenario: `${cen.titulo} (caminho [${cen.caminho.join(',')}], semente ${cen.semente})` }) }, '▶ ver cena no laboratório')));
    }
    if (p.react) c.append(h('div.chips', null, ...(['npc', 'player'] as const).filter((k) => p.react![k]).map((k) => h('span.chip', null, `reação ${k}: ${Object.entries(p.react![k]!).map(([a, b]) => `${a}=${b}`).join(' ')}`))));
    if (p.mood) c.append(h('div.chips', null, h('span.chip', null, `humor da próxima cena em casa: ${p.mood}`)));
    if (p.mudancas?.length) c.append(tabelaMudancas(p.mudancas));
    else if (p.tipo === 'resultado') c.append(h('div.nota', null, p.ramo.includes('›next') ? 'Sem mudança própria neste elo (os efeitos da cadeia costumam ser aplicados no primeiro resultado).' : '⚠ Nenhuma mudança de estado nesta consequência (SPEC-01: toda escolha deve mudar algo).'));
    if (p.tipo === 'resultado' || p.tipo === 'abertura') c.append(h('div', { style: { textAlign: 'right' } }, h('button.btn.mini', { onclick: () => abrirPedido({
      tipo: p.tipo === 'abertura' ? 'evento' : 'resultado', id: p.eventoId ?? cen.alvo.id, cadeia: `${cen.alvo.tipo} ${cen.alvo.id} → ${p.ramo}${p.cena ? ' → cena ' + p.cena.id : ''}`,
      arquivo: app.cat.get(`evento:${p.eventoId ?? cen.alvo.id}`)?.local ? `${app.cat.get(`evento:${p.eventoId ?? cen.alvo.id}`)!.local!.arquivo}:${app.cat.get(`evento:${p.eventoId ?? cen.alvo.id}`)!.local!.linha}` : '(ver catálogo)',
      semente: cen.semente, cenario: `qa/cenarios/${nomeArquivo(cen.titulo)}.json (salve antes) · caminho [${cen.caminho.join(',')}]`,
      valores: { texto: p.texto, mudancas: p.mudancas?.map((m) => `${m.campo}: ${JSON.stringify(m.antes)} → ${JSON.stringify(m.depois)}`) }, escopoCalibravel: false,
    }) }, '✉ pedido para Luna')));
    return c;
  }

  // ================================================================ coluna direita: estado e sementes
  function renderDir() {
    limpar(dir);
    if (!ex) return;
    const I = ex.inicial, F = ex.final;
    dir.append(h('div.secao', null, 'Antes → depois (cadeia inteira)'),
      h('table.tabela', null,
        ...STAT_KEYS.map((k) => linhaAD(k, I.stats[k], F.stats[k])),
        linhaAD('dinheiro', I.money, F.money), linhaAD('karma', I.karma, F.karma), linhaAD('emprego', I.job?.title ?? '—', F.job?.title ?? '—'),
        linhaAD('ficha', I.crime.ficha, F.crime.ficha), linhaAD('preso', I.crime.preso, F.crime.preso), linhaAD('pessoas', I.people.length, F.people.length)),
      ex.mudancasTotais.length ? tabelaMudancas(ex.mudancasTotais) : h('div.nota', null, 'Sem mudanças.'));
    const de = h('input.campo', { type: 'number', value: '1' }) as HTMLInputElement, ate = h('input.campo', { type: 'number', value: '60' }) as HTMLInputElement;
    const res = h('div');
    dir.append(h('div.secao', null, 'Explorar sementes (desfechos aleatórios)'),
      h('div.linha-form', null, 'de', de, 'até', ate, h('button.btn.mini', { onclick: () => {
        const a = Number(de.value) | 0, b = Math.min(a + 500, Number(ate.value) | 0);
        const grupos = explorarSementes(cen, a, b);
        for (const g of grupos) observar(g.exemplo.observados, `esteira · exploração de sementes ${a}–${b} · ${cen.alvo.id} · caminho [${cen.caminho.join(',')}]`);
        limpar(res).append(h('div.nota', null, `${grupos.length} desfecho(s) distinto(s) em ${b - a + 1} sementes`),
          ...grupos.map((g) => h('div.grupo-sem', null, h('b', null, `${g.sementes.length}× `), h('span', null, g.assinatura || '(sem resultado)'),
            h('div.linha-form', null, h('span.nota', null, 'sementes: ' + g.sementes.slice(0, 12).join(', ') + (g.sementes.length > 12 ? '…' : '')),
              h('button.btn.mini', { onclick: () => { cen.semente = g.sementes[0]; renderEsq(); rodar(); } }, `usar ${g.sementes[0]}`)))));
      } }, 'Explorar')), res);
    dir.append(h('div.secao', null, 'Diário (novas entradas)'), h('div', null, ...F.log.slice(I.log.length).map((l) => h('div', { style: { fontSize: '12.5px' } }, `${l.icon ?? '•'} ${l.text}`))));
  }

  renderEsq();
  rodar();
  return () => salvarLocal();
}

function linhaAD(k: string, a: unknown, b: unknown) {
  const mudou = JSON.stringify(a) !== JSON.stringify(b);
  return h('tr', null, h('td', null, k), h('td', null, String(a)), h('td', null, mudou ? '→' : ''), h('td', { style: { color: mudou ? '#ffb547' : '' } }, String(b)));
}

function tabelaMudancas(ms: Mudanca[]) {
  return h('table.tabela.diff', null, ...ms.map((m) => h('tr', null, h('td', null, h('span.chip', null, m.area)), h('td', null, m.campo),
    h('td.menos', null, m.antes === undefined ? '' : typeof m.antes === 'object' ? JSON.stringify(m.antes) : fmt(m.antes)),
    h('td.mais', null, m.depois === undefined ? '(removido)' : typeof m.depois === 'object' ? JSON.stringify(m.depois) : fmt(m.depois)))));
}

const rotuloTipo = (t: Passo['tipo']) => ({ elegibilidade: 'Elegibilidade', abertura: 'Cena de abertura + texto', decisao: 'Decisão', resultado: 'Consequência', conquista: 'Conquistas', bloqueio: 'Bloqueio', erro: 'Erro', pendente: 'Pendente' })[t];
