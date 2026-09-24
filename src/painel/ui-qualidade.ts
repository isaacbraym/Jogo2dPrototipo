/** Aba Qualidade: referências quebradas, alcance de eventos, varredura de cenas, inconsistências, itens sem uso. */
import { h, limpar, toast, memoria } from './dom';
import type { App } from './main';
import { EVENTS } from '../game/events';
import { SITUATIONS } from '../scenes/situations';
import { ENVS } from '../scenes/environments';
import { MOTIONS, KeyframeFn } from '../character/motions';
import { EXPRESSIONS } from '../character/expressions';
import { PROPS, HELD } from '../render/props';
import { varrerReferencias, ARQUIVOS_VARRIDOS } from '../qa/referencias';
import { LIMITES_POSE, lerCampo } from '../qa/limites';
import { restPose } from '../character/rig';
import { FONTES } from './fontes';
import { unionOf, Tipo } from './catalogo';
import { procurarVidaValida, requisitosDoCodigo, eventoEscreveFlag, novoCenario, vidaDoPerfil } from './vida';
import { executar, todosOsCaminhos } from './execucao';
import { observar, todasObservacoes } from './observado';
import { LabRun, BONECOS_PADRAO, DT } from './lab';
import { tentativasBloqueadas } from './guarda';
import { ESTADO_CALIBRACAO } from '../character/calibracao';
import { chipVia, linkItem, localTxt } from './ui-comum';
import { cenarioParaItem } from './cenarios';

interface Varredura { quando: string; itens: number; falhas: { chave: string; msg: string }[] }

export function montar(el: HTMLElement, app: App, _p: Record<string, string>) {
  const pag = h('div.pagina');
  el.append(pag);
  let cancelar = false;

  const secao = (titulo: string, ...c: (Node | string)[]) => h('div.cartao', null, h('h3', null, titulo), ...c);

  function render() {
    limpar(pag);
    // 0. calibração
    pag.append(secao('Calibração aplicada (src/data/calibracao.json)',
      ESTADO_CALIBRACAO.erros.length ? h('div.aviso', null, 'IGNORADA por erros: ' + ESTADO_CALIBRACAO.erros.join('; ')) : h('div.nota', null, `✔ válida · movimentos calibrados: ${ESTADO_CALIBRACAO.movimentos.join(', ') || 'nenhum'} · expressões: ${ESTADO_CALIBRACAO.expressoes.join(', ') || 'nenhuma'}`)));

    // 1. referências quebradas
    const reg: Record<string, Set<string>> = {
      motion: new Set(Object.keys(MOTIONS)), expr: new Set(Object.keys(EXPRESSIONS)), prop: new Set(Object.keys(PROPS)), held: new Set(Object.keys(HELD)),
      fx: new Set(unionOf('src/render/particles.ts', 'PKind')), emote: new Set(unionOf('src/character/actor.ts', 'EmoteKind')), sfx: new Set(app.cat.lista.filter((i) => i.tipo === 'som').map((i) => i.id).concat(['talk', 'click', 'hover', 'tick'])),
      scene: new Set(Object.keys(SITUATIONS)), env: new Set(Object.keys(ENVS)),
    };
    const quebradas = varrerReferencias(Object.fromEntries(ARQUIVOS_VARRIDOS.map((f) => [f, FONTES[f] ?? '']))).filter((r) => !reg[r.registro].has(r.id));
    pag.append(secao(`Referências literais quebradas (${quebradas.length})`, quebradas.length ? h('table.tabela', null, ...quebradas.map((r) => h('tr', null, h('td', null, r.registro), h('td', null, h('code', null, r.id)), h('td', null, `${r.arquivo}:${r.linha}`)))) : h('div.nota', null, '✔ Nenhuma (mesma regra do npm run check).')));

    // 2. vínculos observados
    const obs = todasObservacoes();
    pag.append(secao(`Vínculos observados em execução (${obs.length})`, h('div.nota', null, 'Registrados pela esteira e pelo laboratório. Eles transformam referências dinâmicas (nomes montados em tempo de execução) em referências confirmadas.'),
      h('div.linha-form', null, h('button.btn.mini', { onclick: () => { if (confirm('Apagar as observações do painel? (não afeta o jogo)')) { memoria.gravar('observados', []); location.reload(); } } }, 'limpar observações'))));

    // 3. varreduras
    const vEv = memoria.ler<Varredura | null>('varreduraEventos', null), vCe = memoria.ler<Varredura | null>('varreduraCenas', null);
    const saidaEv = h('div'), saidaCe = h('div'), saidaInc = h('div');
    pag.append(secao('Varredura de eventos (alcance + todas as escolhas)',
      h('div.nota', null, 'Para cada evento: procura uma vida válida nos perfis; se não houver, verifica se ALGUM evento escreve as flags exigidas (precursor). Depois percorre todas as escolhas com a lógica real e registra vínculos observados e inconsistências.'),
      h('div.linha-form', null, h('button.btn.pri', { onclick: () => varrerEventos(saidaEv, saidaInc) }, '▶ Varrer eventos'), h('button.btn.mini', { onclick: () => { cancelar = true; } }, 'cancelar'), vEv ? h('span.nota', null, `última: ${vEv.quando} · ${vEv.itens} eventos · ${vEv.falhas.length} alerta(s)`) : ''),
      saidaEv, saidaInc));
    pag.append(secao('Varredura de cenas (execução real, headless)',
      h('div.nota', null, 'Roda cada situação com elenco genérico e dados vazios (dt 1/20, até 14 s), capturando exceções do roteiro, falhas de desenho, movimentos/expressões inexistentes pedidos em tempo de execução e vínculos observados.'),
      h('div.linha-form', null, h('button.btn.pri', { onclick: () => varrerCenas(saidaCe) }, '▶ Varrer cenas'), h('button.btn.mini', { onclick: () => { cancelar = true; } }, 'cancelar'), vCe ? h('span.nota', null, `última: ${vCe.quando} · ${vCe.itens} cenas · ${vCe.falhas.length} falha(s)`) : ''),
      saidaCe));
    if (vCe?.falhas.length) saidaCe.append(tabelaFalhas(vCe.falhas));
    if (vEv?.falhas.length) saidaEv.append(tabelaFalhas(vEv.falhas));

    // 4. itens sem uso
    const tipos: Tipo[] = ['movimento', 'expressao', 'objeto', 'objetoMao', 'ambiente', 'cena', 'acaoCorporal', 'particula', 'emote'];
    const sem = app.cat.semReferencia(tipos);
    const varridoTudo = !!(vEv && vCe);
    pag.append(secao(`Itens sem referência (${sem.length})`,
      h('div.nota', null, varridoTudo
        ? 'Sem ocorrência literal no código, sem vínculo estrutural/estático e sem observação nas varreduras desta máquina → "sem uso comprovado" (dentro do que as varreduras executam).'
        : 'Sem ocorrência literal nem vínculo. Rode as DUAS varreduras acima para confirmar: nomes montados em tempo de execução só aparecem executando. Até lá, o status é "pendente".'),
      h('table.tabela', null, ...sem.map((i) => h('tr', null, h('td', null, linkItem(app, i.chave)), h('td', null, localTxt(i.local)), h('td', null, h('span.chip' + (varridoTudo ? '.ruim' : ''), null, varridoTudo ? 'sem uso comprovado' : 'pendente de varredura')))))));

    // 5. limites SPEC-03 nos keyframes do código
    const fora: string[] = [];
    for (const [id, m] of Object.entries(MOTIONS)) {
      const kf = (m.fn as Partial<KeyframeFn>).kf;
      if (!kf) continue;
      kf.forEach(([t, p], i) => { const full = { ...restPose(), ...p }; for (const [c, lim] of Object.entries(LIMITES_POSE)) { const v = lerCampo(full, c); if (v !== undefined && (v < lim.min || v > lim.max)) fora.push(`${id} kf${i} (t=${t}) ${c} = ${v} (seguro ${lim.min}..${lim.max})`); } });
    }
    pag.append(secao(`Keyframes do código fora dos limites seguros da SPEC-03 (${fora.length})`, h('div.nota', null, 'Informativo: o calibrador não deixa gravar valores assim; o código pode ter exceções intencionais (ex.: deitar).'), h('pre.codigo', null, fora.join('\n') || '✔ nenhum')));

    // 6. falhas e proteção de saves
    pag.append(secao(`Falhas capturadas nesta sessão (${app.falhas.length})`, app.falhas.length ? h('pre.codigo', null, app.falhas.map((f) => `[${f.quando}] (${f.contexto}) ${f.msg}`).join('\n')) : h('div.nota', null, '✔ nenhuma')));
    pag.append(secao(`Proteção dos saves do jogo`, h('div.nota', null, tentativasBloqueadas.length ? `${tentativasBloqueadas.length} tentativa(s) de acesso a chaves "viva.*" BLOQUEADAS: ` + tentativasBloqueadas.map((t) => `${t.op} ${t.chave}`).join(', ') : '✔ Nenhuma leitura/escrita de saves do jogo ocorreu nesta sessão (o painel bloqueia "viva.*").')));
  }

  function tabelaFalhas(fs: { chave: string; msg: string }[]) {
    return h('table.tabela', null, ...fs.slice(0, 300).map((f) => h('tr', null, h('td', null, linkItem(app, f.chave)), h('td', { style: { whiteSpace: 'pre-wrap' } }, f.msg))));
  }

  async function varrerEventos(saida: HTMLElement, saidaInc: HTMLElement) {
    cancelar = false;
    const falhas: { chave: string; msg: string }[] = [];
    const inconsist: { chave: string; msg: string }[] = [];
    let n = 0;
    for (const ev of EVENTS) {
      if (cancelar) break;
      limpar(saida).append(h('div.nota', null, `varrendo ${++n}/${EVENTS.length}: ${ev.id}…`));
      await new Promise((r) => setTimeout(r, 0));
      const achado = procurarVidaValida(ev, 1);
      if (!achado) {
        const req = requisitosDoCodigo(vidaDoPerfil('adultoSolteiro', Math.max(ev.min, 18), 1), ev);
        const flags = req.requisitos.filter((r) => r.texto.startsWith('flag ')).map((r) => r.texto.slice(5));
        const semEscritor = flags.filter((f) => !EVENTS.some((e) => e !== ev && eventoEscreveFlag(e, f)) && !/advertencias|infracoes|anosFacul|aposentadoria|moodNext|expulsoes|ach_/.test(f));
        falhas.push({ chave: `evento:${ev.id}`, msg: semEscritor.length ? `INALCANÇÁVEL: nenhum evento escreve a(s) flag(s) ${semEscritor.join(', ')}` : `só alcançável com pré-requisitos (precursores: ${[...new Set(req.precursores.map((p) => p.evento))].join(', ') || 'ver cond'})` });
        continue;
      }
      const it = app.cat.get(`evento:${ev.id}`)!;
      const base = cenarioParaItem(it, 1) ?? novoCenario({ tipo: 'evento', id: ev.id }, achado.vida, achado.origem, 1);
      for (const cam of todosOsCaminhos(base, 5, 40)) {
        const ex = executar({ ...base, caminho: cam });
        observar(ex.observados, `varredura de eventos · ${ev.id} · caminho [${cam.join(',')}] · semente 1`);
        for (const p of ex.passos) {
          if (p.tipo === 'erro') falhas.push({ chave: `evento:${ev.id}`, msg: `caminho [${cam}]: ${p.titulo}: ${p.texto.split('\n')[0]}` });
          if (p.tipo === 'resultado') {
            // consequências encadeadas (›next) costumam ter os efeitos aplicados antes, no início da cadeia
            if (!p.ramo.includes('›next') && !p.mudancas?.length && !p.outcomeRef?.followUp && !p.outcomeRef?.skipCard) inconsist.push({ chave: `evento:${ev.id}`, msg: `caminho [${cam}] "${p.titulo}": consequência sem nenhuma mudança de estado (SPEC-01 §3.1)` });
            if (p.cena) {
              const sit = app.cat.get(`cena:${p.cena.id}`);
              const lidas: string[] = sit?.dados?.dataKeys ?? [];
              const extras = Object.keys(p.cena.data).filter((k) => !lidas.includes(k));
              if (sit && extras.length && typeof (SITUATIONS[p.cena.id]?.env) !== 'function') inconsist.push({ chave: `evento:${ev.id}`, msg: `cena ${p.cena.id} recebe data.${extras.join(', data.')} que o roteiro não lê (erro de digitação?)` });
              if (p.cena.data.env && !(p.cena.data.env in ENVS)) inconsist.push({ chave: `evento:${ev.id}`, msg: `data.env "${p.cena.data.env}" não existe` });
            }
            const txt = (p.texto ?? '').toLowerCase();
            if (/demitid|justa causa|mandado\(a\) embora/.test(txt) && ex.inicial.job && ex.final.job && ex.inicial.job.id === ex.final.job.id) inconsist.push({ chave: `evento:${ev.id}`, msg: `caminho [${cam}]: texto fala em demissão mas o emprego continua (${ex.final.job.title}) — inferido pelo texto` });
            if (p.tom === 'bom' && p.mudancas?.length && p.mudancas.every((m) => m.area === 'atributos' && typeof m.antes === 'number' && typeof m.depois === 'number' && (m.depois as number) < (m.antes as number))) inconsist.push({ chave: `evento:${ev.id}`, msg: `caminho [${cam}] "${p.titulo}": tom "bom" mas só atributos caíram` });
          }
        }
      }
    }
    memoria.gravar('varreduraEventos', { quando: new Date().toLocaleString('pt-BR'), itens: n, falhas: [...falhas, ...inconsist] } as Varredura);
    limpar(saida).append(h('div.nota', null, `✔ ${n} eventos varridos · ${falhas.length} alerta(s) de alcance/erro`), tabelaFalhas(falhas));
    limpar(saidaInc).append(h('h3', null, `Inconsistências estado × resultado × cena (${inconsist.length})`), tabelaFalhas(inconsist));
    toast('Varredura de eventos concluída.', 'ok');
  }

  async function varrerCenas(saida: HTMLElement) {
    cancelar = false;
    const falhas: { chave: string; msg: string }[] = [];
    const ids = Object.keys(SITUATIONS);
    let n = 0;
    for (const id of ids) {
      if (cancelar) break;
      limpar(saida).append(h('div.nota', null, `varrendo ${++n}/${ids.length}: ${id}…`));
      const antes = app.falhas.length;
      app.contextoAtual = `varredura de cenas · ${id}`;
      const run = new LabRun({ modo: 'cena', id, bonecos: { ...BONECOS_PADRAO }, semente: 1 });
      try {
        await run.iniciar();
        let passos = 0;
        while (!run.terminou && run.sc.t < 14 && !cancelar) { await run.avancar(20, 1 / 20); passos += 20; if (passos % 100 === 0) await new Promise((r) => setTimeout(r, 0)); }
        await run.avancar(10, 1 / 20);
        // desenho real num canvas fora da tela, para pegar falhas de renderização
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
        run.desenhar(cv.getContext('2d')!, 320, 180, 1, { esqueleto: false });
      } catch (e) { falhas.push({ chave: `cena:${id}`, msg: 'exceção: ' + (e as Error).message }); }
      if (run.erro) falhas.push({ chave: `cena:${id}`, msg: 'roteiro lançou: ' + run.erro.split('\n')[0] });
      if (!run.terminou) falhas.push({ chave: `cena:${id}`, msg: `roteiro não terminou em 14 s (t=${run.sc?.t.toFixed(1)})` });
      for (const f of app.falhas.slice(antes)) falhas.push({ chave: `cena:${id}`, msg: 'falha registrada: ' + f.msg.split('\n')[0] });
      const obs: { de: string; para: string; detalhe: string }[] = [];
      for (const m of run.marcas) {
        if ((m.op === 'act' || m.op === 'loop') && !(m.arg in MOTIONS)) falhas.push({ chave: `cena:${id}`, msg: `pede movimento inexistente "${m.arg}" (t=${m.t.toFixed(2)}s) — o ator ignora em silêncio` });
        if (m.op === 'expr' && !(m.arg in EXPRESSIONS)) falhas.push({ chave: `cena:${id}`, msg: `pede expressão inexistente "${m.arg}"` });
        if (m.op === 'prop' && !(m.arg in PROPS)) falhas.push({ chave: `cena:${id}`, msg: `pede objeto inexistente "${m.arg}"` });
        if (m.op === 'act' || m.op === 'loop') obs.push({ de: `cena:${id}`, para: `movimento:${m.arg}`, detalhe: `d.${m.op} (trecho ${m.trecho})` });
        if (m.op === 'expr') obs.push({ de: `cena:${id}`, para: `expressao:${m.arg}`, detalhe: 'd.expr' });
        if (m.op === 'prop') obs.push({ de: `cena:${id}`, para: `objeto:${m.arg}`, detalhe: 'd.prop' });
        if (m.op === 'fx') obs.push({ de: `cena:${id}`, para: `particula:${m.arg}`, detalhe: 'd.fx' });
        if (m.op === 'emote') obs.push({ de: `cena:${id}`, para: `emote:${m.arg}`, detalhe: 'd.emote' });
        if (m.op === 'add' && m.arg) obs.push({ de: `cena:${id}`, para: `movimento:${m.arg}`, detalhe: 'add({ motion })' });
      }
      for (const a of run.sc?.actors ?? []) { if (a.propN) obs.push({ de: `cena:${id}`, para: `objetoMao:${a.propN}`, detalhe: 'ator.propN' }); if (a.propF) obs.push({ de: `cena:${id}`, para: `objetoMao:${a.propF}`, detalhe: 'ator.propF' }); }
      if (run.sc) obs.push({ de: `cena:${id}`, para: `ambiente:${run.sc.env.id}`, detalhe: 'ambiente resolvido (elenco genérico, data vazia)' });
      observar(obs, `varredura de cenas · elenco genérico · data {} · semente 1`);
      await new Promise((r) => setTimeout(r, 0));
    }
    app.contextoAtual = 'qualidade';
    memoria.gravar('varreduraCenas', { quando: new Date().toLocaleString('pt-BR'), itens: n, falhas } as Varredura);
    limpar(saida).append(h('div.nota', null, `✔ ${n} cenas executadas · ${falhas.length} falha(s)`), tabelaFalhas(falhas));
    toast('Varredura de cenas concluída.', 'ok');
    render();
  }

  render();
  void chipVia; void DT;
  return () => { cancelar = true; };
}
