/** Aba Laboratório: reprodução determinística, linha do tempo, inspetor de pose/esqueleto, calibrador A/B. */
import { h, limpar, toast, copiar, memoria, baixarJSON, lerArquivoJSON, modal, fmt } from './dom';
import type { App } from './main';
import { LabRun, EspecLab, ModoLab, BONECOS_PADRAO, DT, Marca, semOverrides, opcoesDoCampo, verificarDeterminismo } from './lab';
import { Trabalho, kfCodigo, valorKF, ehCalibravel, kfNoInstante, overridesCodigo, exprCodigo, durCodigo, validarTudo, CALIB_APLICADA, aplicarVariacao, Variacao, PropostaArquivo } from './calib';
import { MOTIONS, KF } from '../character/motions';
import { EXPRESSIONS, Face } from '../character/expressions';
import { ENVS } from '../scenes/environments';
import { SITUATIONS } from '../scenes/situations';
import { PROPS, HELD } from '../render/props';
import { LIMITES_POSE, GRUPOS_POSE, LIMITES_FACE, lerCampo } from '../qa/limites';
import { normalizarCalibracao, serializar } from '../qa/calibracao';
import { api, nomeArquivo } from './api';
import { abrirPedido, localTxt } from './ui-comum';
import { observar } from './observado';
import { Actor } from '../character/actor';
import { kfComAjuste } from '../character/calibracao';

const MODOS: [ModoLab, string][] = [['cena', 'Cena'], ['movimento', 'Movimento'], ['acaoCorporal', 'Ação corporal (2 bonecos)'], ['expressao', 'Expressão'], ['ambiente', 'Ambiente'], ['objeto', 'Objeto de cena'], ['objetoMao', 'Objeto de mão'], ['visual', 'Parâmetro visual']];

export function montar(el: HTMLElement, app: App, _p: Record<string, string>) {
  let espec: EspecLab = app.lab ?? { modo: 'movimento', id: 'chute', bonecos: { ...BONECOS_PADRAO }, semente: 1 };
  const trab: Trabalho = app.trabalho;
  let comparar = memoria.ler('labAB', true);
  let aCodigo = memoria.ler('labACodigo', false);
  let esqueleto = memoria.ler('labEsq', true);
  let runA: LabRun | null = null, runB: LabRun | null = null;
  let marcas: Marca[] = [], duracao = 5, tempo = 0, tocando = false, vel = 1, ocupado = false, vivo = true;
  let atorSel: string | null = null;
  let kfSel: number | null = null, seguirKf = true;
  const deslocamentos = new Map<string, number>();
  let camera: { zoom: number; dx: number; dy: number } | null = null;
  let movCal: string | null = null; // movimento em calibração
  let exprCal: string | null = null;

  const cadeiaBase = () => app.labContexto?.cadeia ?? `${espec.modo} ${espec.id}`;

  // ------------------------------------------------------------------ layout
  const barra = h('div.lab-barra');
  const vistas = h('div.lab-vistas');
  const cvA = h('canvas') as HTMLCanvasElement, cvB = h('canvas') as HTMLCanvasElement;
  const vistaA = h('div.lab-vista', null, cvA, h('span.rotulo-ab', null, 'A · aplicado'));
  const vistaB = h('div.lab-vista', null, cvB, h('span.rotulo-ab', null, 'B · proposta'));
  vistas.append(vistaA, vistaB);
  const linhaT = h('div.linha-tempo');
  const cursor = h('div.cursor');
  const leitura = h('span.mono');
  const controles = h('div.linha-form');
  const tempoBox = h('div.lab-tempo', null, controles, linhaT);
  const centro = h('div.lab-centro', null, barra, vistas, tempoBox);
  const insp = h('div.lab-insp');
  const vivoBox = h('div'), calBox = h('div'), expBox = h('div'), cenaBox = h('div');
  insp.append(vivoBox, calBox, expBox, cenaBox);
  el.append(h('div.lab', null, centro, insp));

  // ------------------------------------------------------------------ barra superior
  function renderBarra() {
    limpar(barra);
    const tipoCat: Record<ModoLab, string> = { cena: 'cena', movimento: 'movimento', acaoCorporal: 'acaoCorporal', expressao: 'expressao', ambiente: 'ambiente', objeto: 'objeto', objetoMao: 'objetoMao', visual: 'visual' };
    const ids = app.cat.lista.filter((i) => i.tipo === tipoCat[espec.modo]).map((i) => i.id);
    const dl = h('datalist', { id: 'lab-ids' }, ...ids.map((i) => h('option', { value: i })));
    const B = espec.bonecos;
    const num = (v: number, set: (n: number) => void, w = 58, titulo = '') => h('input.campo', { type: 'number', value: String(v), title: titulo, style: { width: w + 'px' }, onchange: (e: Event) => { set(Number((e.target as HTMLInputElement).value)); reconstruir(); } });
    barra.append(
      h('select.campo', { style: { width: '150px' }, onchange: (e: Event) => { espec = { ...espec, modo: (e.target as HTMLSelectElement).value as ModoLab, id: '', cena: undefined }; app.labContexto = null; renderBarra(); } }, ...MODOS.map(([m, r]) => h('option', { value: m, selected: m === espec.modo }, r))),
      dl, h('input.campo', { list: 'lab-ids', value: espec.id, style: { width: '170px' }, placeholder: 'id', onchange: (e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (!ids.includes(v)) return toast('Id não existe neste tipo.', 'erro'); espec = { ...espec, id: v, cena: undefined }; app.labContexto = null; reconstruir(); } }),
      espec.modo !== 'cena' && espec.modo !== 'ambiente' ? h('select.campo', { style: { width: '120px' }, title: 'ambiente de fundo', onchange: (e: Event) => { espec.ambiente = (e.target as HTMLSelectElement).value; reconstruir(); } }, ...Object.keys(ENVS).map((k) => h('option', { value: k, selected: k === (espec.ambiente ?? 'sala') }, k))) : '',
      h('span.nota', null, 'A:'), num(B.idadeA, (n) => (B.idadeA = n), 50, 'idade A'), h('select.campo', { style: { width: '52px' }, onchange: (e: Event) => { B.sexoA = (e.target as HTMLSelectElement).value as 'm' | 'f'; reconstruir(); } }, h('option', { value: 'm', selected: B.sexoA === 'm' }, 'm'), h('option', { value: 'f', selected: B.sexoA === 'f' }, 'f')),
      h('button.btn.mini', { title: 'virar A', onclick: () => { B.direcaoA = (B.direcaoA * -1) as 1 | -1; renderBarra(); } }, B.direcaoA > 0 ? '→' : '←'),
      h('span.nota', null, 'B:'), num(B.idadeB, (n) => (B.idadeB = n), 50, 'idade B'), h('select.campo', { style: { width: '52px' }, onchange: (e: Event) => { B.sexoB = (e.target as HTMLSelectElement).value as 'm' | 'f'; reconstruir(); } }, h('option', { value: 'm', selected: B.sexoB === 'm' }, 'm'), h('option', { value: 'f', selected: B.sexoB === 'f' }, 'f')),
      h('button.btn.mini', { title: 'virar B', onclick: () => { B.direcaoB = (B.direcaoB * -1) as 1 | -1; renderBarra(); } }, B.direcaoB > 0 ? '→' : '←'),
      h('span.nota', null, 'dist'), num(B.distancia, (n) => (B.distancia = Math.max(60, Math.min(700, n))), 62, 'distância entre os bonecos'),
      h('span.nota', null, 'aparência'), num(B.sementeAparencia, (n) => (B.sementeAparencia = n | 0), 58, 'semente da aparência dos bonecos'),
      h('span.nota', null, 'semente'), num(espec.semente, (n) => (espec.semente = n | 0), 62, 'semente da simulação'),
      espec.modo === 'visual' ? h('span', null, h('span.nota', null, 'página'), num(espec.opcaoVisual ?? 0, (n) => (espec.opcaoVisual = Math.max(0, n | 0)), 46)) : '',
      h('label.nota', null, h('input', { type: 'checkbox', checked: comparar, onchange: (e: Event) => { comparar = (e.target as HTMLInputElement).checked; memoria.gravar('labAB', comparar); reconstruir(); } }), ' A/B'),
      h('label.nota', { title: 'A mostra os valores do CÓDIGO (ignora src/data/calibracao.json)' }, h('input', { type: 'checkbox', checked: aCodigo, onchange: (e: Event) => { aCodigo = (e.target as HTMLInputElement).checked; memoria.gravar('labACodigo', aCodigo); reconstruir(); } }), ' A = código'),
      h('label.nota', null, h('input', { type: 'checkbox', checked: esqueleto, onchange: (e: Event) => { esqueleto = (e.target as HTMLInputElement).checked; memoria.gravar('labEsq', esqueleto); } }), ' esqueleto'),
    );
    if (espec.id) reconstruir();
  }

  // ------------------------------------------------------------------ controles de tempo
  function renderControles() {
    limpar(controles).append(
      h('button.btn.mini', { title: 'reiniciar', onclick: () => irPara(0) }, '⏮'),
      h('button.btn.mini', { title: 'quadro anterior', onclick: () => { tocando = false; irPara(tempo - DT); } }, '◀|'),
      h('button.btn.mini', { onclick: () => { tocando = !tocando; if (tocando && tempo >= duracao - DT) irPara(0); renderControles(); } }, tocando ? '⏸ pausar' : '▶ reproduzir'),
      h('button.btn.mini', { title: 'próximo quadro', onclick: () => { tocando = false; irPara(tempo + DT); } }, '|▶'),
      h('select.campo', { style: { width: '80px' }, onchange: (e: Event) => { vel = Number((e.target as HTMLSelectElement).value); } }, ...[0.1, 0.25, 0.5, 1, 2].map((v) => h('option', { value: String(v), selected: v === vel }, `${v}×`))),
      h('input.campo', { type: 'number', step: '0.01', value: tempo.toFixed(3), style: { width: '90px' }, title: 'ir para o instante (s)', onchange: (e: Event) => { tocando = false; irPara(Number((e.target as HTMLInputElement).value) || 0); } }),
      leitura,
      h('button.btn.mini', { title: 'Toca quadro a quadro até o instante atual, busca o mesmo instante por reexecução duas vezes e compara o estado observável', onclick: async () => {
        toast('Verificando determinismo…');
        const r = await verificarDeterminismo(espec, aCodigo ? overridesCodigo() : semOverrides(), tempo, cvA);
        toast(r.ok ? `✅ Determinístico em t=${tempo.toFixed(2)}s (hash ${r.buscado})` : `❌ Divergiu: tocado ${r.tocado} · buscado ${r.buscado} · repetido ${r.repetido}`, r.ok ? 'ok' : 'erro');
      } }, 'Verificar determinismo'),
      h('button.btn.mini', { onclick: () => pedidoInstante() }, '✉ Copiar pedido para Luna (instante)'),
    );
  }

  // ------------------------------------------------------------------ construção / busca
  let geracao = 0;
  async function reconstruir() {
    const g = ++geracao;
    tocando = false;
    app.lab = espec; memoria.gravar('lab', espec);
    vistaB.style.display = comparar ? '' : 'none';
    (vistaA.querySelector('.rotulo-ab') as HTMLElement).textContent = comparar ? (aCodigo ? 'A · código (sem calibração)' : 'A · aplicado') : aCodigo ? 'código (sem calibração)' : 'aplicado';
    const ovA = aCodigo ? overridesCodigo() : semOverrides();
    // passada completa para a linha do tempo (marcas + duração)
    const pre = new LabRun(espec, ovA);
    try {
      await pre.iniciar();
      while (!pre.terminou && pre.sc.t < 30) { await pre.avancar(90); if (g !== geracao || !vivo) return; await new Promise((r) => requestAnimationFrame(r)); }
    } catch (e) { toast('Falha ao montar: ' + (e as Error).message, 'erro'); console.error(e); return; }
    if (g !== geracao) return;
    marcas = pre.marcas;
    duracao = Math.min(30, (pre.tFim ?? pre.sc.t) + 0.8);
    if (pre.erro) toast('O roteiro lançou erro: ' + pre.erro.split('\n')[0], 'erro');
    registrarObservacoes(pre);
    runA = new LabRun(espec, ovA);
    runB = comparar ? new LabRun(espec, trab.overrides()) : null;
    tempo = Math.min(tempo, duracao);
    await runA.irPara(tempo);
    if (runB) await runB.irPara(tempo);
    if (!atorSel || !runA.atores().some((x) => x.r === atorSel)) atorSel = runA.atores()[0]?.r ?? null;
    desenharLinhaTempo();
    renderControles();
    atualizarKfSeguido();
    renderCal();
    renderExpr();
    renderCena();
    atualizarVivo(true);
  }

  function registrarObservacoes(r: LabRun) {
    if (espec.modo !== 'cena' && espec.modo !== 'acaoCorporal') return;
    const de = espec.modo === 'cena' ? `cena:${espec.id}` : `acaoCorporal:${espec.id}`;
    const obs: { de: string; para: string; detalhe: string }[] = [];
    for (const m of r.marcas) {
      if (m.op === 'act' || m.op === 'loop') obs.push({ de, para: `movimento:${m.arg}`, detalhe: `d.${m.op} (trecho ${m.trecho})` });
      if (m.op === 'expr') obs.push({ de, para: `expressao:${m.arg}`, detalhe: `d.expr (trecho ${m.trecho})` });
      if (m.op === 'prop') obs.push({ de, para: `objeto:${m.arg}`, detalhe: 'd.prop' });
      if (m.op === 'fx') obs.push({ de, para: `particula:${m.arg}`, detalhe: 'd.fx' });
      if (m.op === 'emote') obs.push({ de, para: `emote:${m.arg}`, detalhe: 'd.emote' });
      if (m.op === 'som') obs.push({ de, para: `som:${m.arg}`, detalhe: 'd.sfx' });
      if (m.op === 'add' && m.arg) obs.push({ de, para: `movimento:${m.arg}`, detalhe: 'add({ motion })' });
    }
    obs.push({ de, para: `ambiente:${r.sc.env.id}`, detalhe: 'ambiente resolvido' });
    observar(obs, `laboratório · ${cadeiaBase()} · semente ${espec.semente}${espec.cena ? ' · data=' + JSON.stringify(espec.cena.data) : ''}`);
  }

  async function irPara(t: number) {
    tempo = Math.max(0, Math.min(duracao, t));
    if (ocupado) return;
    ocupado = true;
    try {
      if (runA) await runA.irPara(tempo);
      if (runB) await runB.irPara(tempo);
    } finally { ocupado = false; }
    if (seguirKf) atualizarKfSeguido();
    atualizarVivo(true);
  }

  // ------------------------------------------------------------------ laço de desenho
  let ultimo = performance.now(), ultInsp = 0;
  const quadro = async (agora: number) => {
    if (!vivo) return;
    const dt = Math.min(0.1, (agora - ultimo) / 1000);
    ultimo = agora;
    if (tocando && !ocupado && runA) {
      let alvo = tempo + dt * vel;
      if (alvo >= duracao) { alvo = duracao; tocando = false; renderControles(); }
      await irPara(alvo);
    }
    desenhar();
    if (agora - ultInsp > 180) { ultInsp = agora; atualizarVivo(false); }
    requestAnimationFrame(quadro);
  };
  function desenhar() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (const [cv, run] of [[cvA, runA], [cvB, runB]] as const) {
      if (!run?.sc || (cv === cvB && !comparar)) continue;
      const w = cv.clientWidth, hh = cv.clientHeight;
      if (!w || !hh) continue;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
      const sel = run.atores().find((x) => x.r === atorSel)?.a ?? null;
      run.desenhar(cv.getContext('2d')!, w, hh, dpr, { esqueleto, atorSel: sel, deslocamentos, camera });
    }
    cursor.style.left = `${(tempo / duracao) * 100}%`;
    leitura.textContent = ` t = ${tempo.toFixed(3)} s · quadro ${Math.round(tempo / DT)} / ${Math.round(duracao / DT)} (dt fixo 1/60)`;
  }
  requestAnimationFrame(quadro);

  // ------------------------------------------------------------------ linha do tempo
  const CORES: Record<string, string> = { act: '#ffb547', loop: '#b58cff', fala: '#5aa0ff', grito: '#ff5c7a', pensa: '#7fb7ff', expr: '#9ff0c3', legenda: '#ffffff', evento: '#ff3b3b', fx: '#ffe08a', camera: '#8a8f98', som: '#6c6696', emote: '#f06a8a' };
  function desenharLinhaTempo() {
    limpar(linhaT);
    const faixas = new Map<string, number>();
    for (const m of marcas) {
      const x = (m.t / duracao) * 100;
      if (m.dur && (m.op === 'act' || m.op === 'fala' || m.op === 'grito' || m.op === 'legenda')) {
        if (!faixas.has(m.alvo)) faixas.set(m.alvo, faixas.size);
        const y = 4 + (faixas.get(m.alvo)! % 4) * 11;
        linhaT.append(h('div.faixa', { title: `${m.trecho} · ${m.alvo} · ${m.t.toFixed(2)}s`, style: { left: x + '%', width: Math.max(0.4, (m.dur / duracao) * 100) + '%', top: y + 'px', background: CORES[m.op] ?? '#888' } }));
      } else {
        linhaT.append(h('div.marca-t', { title: `${m.trecho} · ${m.alvo} · ${m.t.toFixed(2)}s`, style: { left: x + '%', background: CORES[m.op] ?? '#555' } }));
      }
    }
    linhaT.append(cursor);
  }
  let arrastando = false;
  const buscarPorX = (e: MouseEvent) => { const r = linhaT.getBoundingClientRect(); tocando = false; irPara(((e.clientX - r.left) / r.width) * duracao); };
  linhaT.addEventListener('mousedown', (e) => { arrastando = true; buscarPorX(e); });
  window.addEventListener('mousemove', (e) => { if (arrastando) buscarPorX(e); });
  window.addEventListener('mouseup', () => { arrastando = false; });

  // ------------------------------------------------------------------ inspetor vivo
  function atorAtual() { return runA?.atores().find((x) => x.r === atorSel)?.a ?? null; }
  function trechoAtual(a: Actor | null): Marca | null {
    if (!a) return null;
    const r = runA!.rotulo(a);
    const ms = marcas.filter((m) => m.alvo === r && (m.op === 'act' || m.op === 'loop') && m.t <= tempo + 1e-6);
    return ms[ms.length - 1] ?? null;
  }
  function kfInfo(a: Actor | null) {
    if (!a) return null;
    const id = a.motionName;
    const frames = kfCodigo(id);
    if (!frames) return { id, frames: null as KF[] | null, ix: -1 };
    return { id, frames, ix: kfNoInstante(trab.atual.movimentos[id] ? kfAtualizados(id) : frames, a.motionT) };
  }
  function kfAtualizados(id: string): KF[] {
    const base = kfCodigo(id)!;
    const aj = trab.atual.movimentos[id];
    return base.map(([t, p, e], i) => [aj?.keyframes?.[String(i)]?.t ?? t, p, e]);
  }
  function caminhoCampo(campo: string) {
    const a = atorAtual();
    const tr = trechoAtual(a);
    const info = kfInfo(a);
    const partes = [cadeiaBase()];
    const rotCena = `${espec.modo === 'cena' ? 'cena' : 'ação corporal'} ${espec.id}`;
    if ((espec.modo === 'cena' || espec.modo === 'acaoCorporal') && !partes[0].endsWith(rotCena)) partes.push(rotCena);
    if (tr) partes.push(`trecho ${tr.trecho}`);
    if (a) partes.push(`ator ${runA!.rotulo(a)}`, `movimento ${a.motionName}`);
    if (info?.frames) partes.push(`kf${info.ix} (t=${fmt(kfAtualizados(info.id)[info.ix][0])}s)`);
    partes.push(campo);
    return [...new Set(partes)].join(' → ');
  }
  function atualizarKfSeguido() {
    const a = atorAtual();
    if (!a) return;
    const info = kfInfo(a);
    const mudouMov = movCal !== (info?.frames ? info.id : a.motionName);
    if (info?.frames && (info.ix !== kfSel || mudouMov)) { movCal = info.id; kfSel = info.ix; renderCal(); }
    else if (!info?.frames && mudouMov) { movCal = a.motionName; kfSel = null; renderCal(); }
    const e = (a.exprName === 'neutro' && (MOTIONS[a.motionName]?.expr)) || a.exprName;
    if (e !== exprCal) { exprCal = e as string; renderExpr(); }
  }

  function atualizarVivo(forcar: boolean) {
    if (!runA?.sc) return;
    if (!forcar && !tocando) return;
    const sc = runA.sc;
    const a = atorAtual();
    limpar(vivoBox);
    vivoBox.append(
      h('div.secao', null, 'Contexto'),
      h('div', { style: { fontSize: '12.5px' } }, h('b', null, cadeiaBase()), app.labContexto?.cenario ? h('div.nota', null, 'cenário: ' + app.labContexto.cenario) : '', h('div.nota', null, `modo ${espec.modo} · id ${espec.id} · semente ${espec.semente} · ambiente ${sc.env.id}`)),
      runA.erro ? h('div.aviso', null, 'Erro no roteiro: ' + runA.erro.split('\n')[0]) : '',
      h('div.secao', null, 'Cena agora'),
      h('table.tabela', null,
        h('tr', null, h('th', null, 'tempo'), h('td', null, `${sc.t.toFixed(3)} s (quadro ${runA.quadro})${runA.terminou ? ` · roteiro terminou em ${runA.tFim?.toFixed(2)}s` : ''}`)),
        h('tr', null, h('th', null, 'câmera'), h('td', null, `x ${sc.cam.x.toFixed(0)} y ${sc.cam.y.toFixed(0)} zoom ${sc.cam.zoom.toFixed(2)} → alvo ${sc.cam.tx.toFixed(0)},${sc.cam.ty.toFixed(0)} ×${sc.cam.tz.toFixed(2)}${sc.cam.shake > 0 ? ` · tremor ${sc.cam.shake.toFixed(1)}` : ''}`)),
        h('tr', null, h('th', null, 'legenda'), h('td', null, sc.caption ? `${sc.caption.title}${sc.caption.sub ? ' — ' + sc.caption.sub : ''}` : '—')),
        h('tr', null, h('th', null, 'efeitos'), h('td', null, `${sc.fx.list.length} partícula(s) · flash ${sc.flash.toFixed(2)} · fade ${sc.fadeA.toFixed(2)}`)),
        h('tr', null, h('th', null, 'objetos'), h('td', null, sc.props.map((p) => p.id).join(', ') || '—'))),
      h('div.secao', null, 'Atores'),
      h('table.tabela.atores-t', null, h('tr', null, h('th', null, 'ator'), h('th', null, 'movimento'), h('th', null, 'expressão'), h('th', null, 'mão'), h('th', null, 'x · dir')),
        ...runA.atores().map(({ a: at, r }) => h('tr' + (r === atorSel ? '.sel' : ''), { onclick: () => { atorSel = r; kfSel = null; movCal = null; atualizarKfSeguido(); renderCal(); atualizarVivo(true); } },
          h('td', null, r), h('td', null, `${at.motionName} ${at.motionT.toFixed(2)}s`), h('td', null, exprEfetiva(at)), h('td', null, [at.propN ?? MOTIONS[at.motionName]?.propN, at.propF ?? MOTIONS[at.motionName]?.propF].filter(Boolean).join(', ') || '—'),
          h('td', null, `${at.x.toFixed(0)} ${at.facing > 0 ? '→' : '←'}${at.bubble ? ' 💬' : ''}${at.emote ? ' ' + at.emote.kind : ''}`)))),
      h('div.secao', null, `Ações do Director (${marcas.length})`),
      h('div.marcas-lista', null, ...marcas.map((m) => h('div' + (m.t <= tempo + 1e-6 ? '.passou' : '.futuro') + (m === ultimaMarca() ? '.atual' : ''), { title: 'clique para ir ao instante · duplo clique copia o id do trecho', onclick: () => { tocando = false; irPara(m.t); }, ondblclick: () => copiar(`${cadeiaBase()} → trecho ${m.trecho}`, 'Trecho') },
        h('span.mono', null, m.t.toFixed(2) + 's'), h('span', null, `${m.alvo ? m.alvo + ' · ' : ''}`, h('b', null, m.op), ' ', m.arg.slice(0, 60), h('span.nota', null, `  ${m.trecho}`))))),
      a ? inspetorPose(a) : h('div.nota', null, 'Selecione um ator.'),
    );
    const at = vivoBox.querySelector('.marcas-lista .atual') as HTMLElement | null;
    at?.scrollIntoView({ block: 'nearest' });
  }
  const ultimaMarca = () => { let u: Marca | null = null; for (const m of marcas) if (m.t <= tempo + 1e-6) u = m; return u; };
  const exprEfetiva = (a: Actor) => { const o = (a as any).exprOverride; return o && o.until > (a as any).time ? `${o.name} (temporária)` : a.exprName === 'neutro' && MOTIONS[a.motionName]?.expr ? `${MOTIONS[a.motionName].expr} (do movimento)` : a.exprName; };

  function inspetorPose(a: Actor) {
    const p = a.pose as any;
    const b = runB?.atores().find((x) => x.r === atorSel)?.a;
    const tr = trechoAtual(a);
    return h('div', null,
      h('div.secao', null, `Pose de ${runA!.rotulo(a)} (quadro atual${b ? ', A × B' : ''})`),
      h('div.nota', null, `movimento ${a.motionName}${tr ? ` · trecho ${tr.trecho}` : ''} · giro ${a.turn} · escala ${a.scale} · mãos ${p.handN}/${p.handF}`),
      ...GRUPOS_POSE.map(([g, campos]) => h('div', null, h('div.nota', { style: { marginTop: '4px', fontWeight: 800 } }, g),
        ...campos.map((c) => {
          const va = lerCampo(p, c) ?? 0, vb = b ? lerCampo(b.pose, c) ?? 0 : null;
          return h('div.pose-campo', { title: LIMITES_POSE[c]?.rotulo ?? c }, h('span', null, c, ' ', h('span.nota', null, LIMITES_POSE[c]?.rotulo ?? '')), h('span.v', null, va.toFixed(3)),
            h('span.v', { style: { color: vb !== null && Math.abs(vb - va) > 1e-4 ? '#ffb547' : '#6c6696' } }, vb === null ? '' : vb.toFixed(3)),
            h('button.btn.mini', { title: 'copiar caminho deste campo', onclick: () => copiar(caminhoCampo(c), 'Caminho') }, '⧉'));
        }))),
    );
  }

  // ------------------------------------------------------------------ calibrador
  let atraso = 0;
  const propostaMudou = () => {
    clearTimeout(atraso);
    atraso = window.setTimeout(async () => {
      if (!runA) return;
      runB = comparar ? new LabRun(espec, trab.overrides()) : null;
      if (runB) { const t = tempo; await runB.irPara(t); }
      renderCal(); renderExpr();
      atualizarVivo(true);
    }, 80);
  };
  trab.ouvintes.add(propostaMudou);

  function renderCal() {
    limpar(calBox);
    const a = atorAtual();
    const id = movCal ?? (espec.modo === 'movimento' ? espec.id : a?.motionName ?? null);
    calBox.append(h('div.secao', null, 'Calibrador de movimento'));
    if (!id || !MOTIONS[id]) { calBox.append(h('div.nota', null, 'Nenhum movimento selecionado.')); return; }
    const item = app.cat.get('movimento:' + id);
    calBox.append(h('div.nota', null, h('b', null, id), ` · ${localTxt(item?.local)} · `, h('button.btn.mini', { onclick: () => app.abrirItem('movimento:' + id) }, 'ver no catálogo')));
    calBox.append(h('div.linha-form', null,
      h('button.btn.mini', { disabled: !trab.podeDesfazer(), onclick: () => trab.desfazer() }, '↶ desfazer'),
      h('button.btn.mini', { disabled: !trab.podeRefazer(), onclick: () => trab.refazer() }, '↷ refazer'),
      h('button.btn.mini', { onclick: () => trab.restaurarMovimento(id) }, 'valores do código'),
      h('label.nota', null, h('input', { type: 'checkbox', checked: seguirKf, onchange: (e: Event) => { seguirKf = (e.target as HTMLInputElement).checked; } }), ' seguir o keyframe do instante')));
    const frames = kfCodigo(id);
    if (!frames) {
      calBox.append(h('div.aviso', null, 'Movimento PROCEDURAL (fórmula no código, sem keyframes): não é persistível pelo calibrador. Os controles abaixo somam deslocamentos só nesta sessão (prévia exploratória em B). Para tornar definitivo: "Copiar pedido para Luna" — exige mudança de código.'));
      const desl = trab.exploratorio.get(id) ?? {};
      for (const [g, campos] of GRUPOS_POSE) {
        calBox.append(h('div.nota', { style: { fontWeight: 800 } }, g));
        for (const c of campos) {
          const lim = LIMITES_POSE[c];
          const v = desl[c] ?? 0;
          const faixa = (lim.max - lim.min) / 2;
          calBox.append(h('div.cal-campo' + (v ? '.mudou' : ''), null, h('span.rot', null, c),
            h('input', { type: 'range', min: String(-faixa), max: String(faixa), step: String(lim.passo), value: String(v), oninput: (e: Event) => { const nv = Number((e.target as HTMLInputElement).value); const d = { ...(trab.exploratorio.get(id) ?? {}) }; if (nv) d[c] = nv; else delete d[c]; if (Object.keys(d).length) trab.exploratorio.set(id, d); else trab.exploratorio.delete(id); propostaMudou(); } }),
            h('span.v.mono', null, (v >= 0 ? '+' : '') + v.toFixed(2)), h('span.orig', null, 'Δ sessão'), h('span', null, '')));
        }
      }
      calBox.append(h('button.btn', { onclick: () => pedidoMov(id, true) }, '✉ Copiar pedido para Luna (movimento procedural)'));
      return;
    }
    const aj = trab.atual.movimentos[id];
    const kfsProp = kfAtualizados(id);
    const aplicado = CALIB_APLICADA.movimentos[id];
    calBox.append(h('div.nota', null, `${frames.length} keyframes · duração código ${durCodigo(id)}s${aplicado ? ' · há calibração APLICADA em src/data/calibracao.json' : ''}${aj ? ' · proposta com alterações' : ''}`),
      h('div.kfs', null, ...kfsProp.map(([t], i) => h('button.btn.mini' + (i === kfSel ? '.sel' : ''), { title: 'clique: selecionar e ir ao instante (se o ator estiver neste movimento)', onclick: () => { kfSel = i; seguirKf = false; renderCal(); } }, `kf${i} · ${fmt(t)}s${aj?.keyframes?.[String(i)] ? ' ✎' : ''}`))));
    const dur = aj?.dur ?? durCodigo(id) ?? 0;
    if (!MOTIONS[id].loop) calBox.append(h('div.cal-campo', null, h('span.rot', null, 'duração (s)'), h('input', { type: 'range', min: '0.2', max: '4', step: '0.01', value: String(dur), oninput: (e: Event) => trab.definirDur(id, Number((e.target as HTMLInputElement).value)) }), h('span.v.mono', null, fmt(dur)), h('span.orig', null, `código ${fmt(durCodigo(id))}`), h('span', null, '')));
    if (kfSel !== null && frames[kfSel]) {
      const ix = kfSel;
      const tCod = frames[ix][0], tProp = kfsProp[ix][0];
      const tMin = ix > 0 ? kfsProp[ix - 1][0] + 0.01 : 0, tMax = ix < frames.length - 1 ? kfsProp[ix + 1][0] - 0.01 : Math.max(tProp, dur);
      calBox.append(h('div.cal-campo' + (Math.abs(tCod - tProp) > 1e-9 ? '.mudou' : ''), null, h('span.rot', null, `kf${ix} · instante t`),
        h('input', { type: 'range', min: String(tMin), max: String(Math.max(tMin, tMax)), step: '0.005', value: String(tProp), disabled: ix === 0, oninput: (e: Event) => trab.definirTempoKF(id, ix, Number((e.target as HTMLInputElement).value)) }),
        h('span.v.mono', null, fmt(tProp)), h('span.orig', null, `código ${fmt(tCod)}`), h('span', null, '')));
      const baseAplicada = aplicado ? kfComAjusteLocal(frames, aplicado) : frames;
      const propostos = kfComAjusteLocal(frames, aj);
      for (const [g, campos] of GRUPOS_POSE) {
        calBox.append(h('div.nota', { style: { fontWeight: 800, marginTop: '4px' } }, g));
        for (const c of campos) {
          const lim = LIMITES_POSE[c];
          const vc = valorKF(frames, ix, c), va = valorKF(baseAplicada, ix, c), vp = valorKF(propostos, ix, c);
          const fora = vp < lim.min || vp > lim.max;
          calBox.append(h('div.cal-campo' + (Math.abs(vp - vc) > 1e-9 ? '.mudou' : '') + (fora ? '.fora' : ''), { title: `${lim.rotulo} · limite seguro ${lim.min}..${lim.max} (SPEC-03)` },
            h('span.rot', null, c),
            h('input', { type: 'range', min: String(lim.min), max: String(lim.max), step: String(lim.passo), value: String(vp), oninput: (e: Event) => trab.definirCampoKF(id, ix, c, Number((e.target as HTMLInputElement).value)) }),
            h('input', { type: 'number', step: String(lim.passo), value: vp.toFixed(3), style: { width: '64px' }, onchange: (e: Event) => trab.definirCampoKF(id, ix, c, Number((e.target as HTMLInputElement).value)) }),
            h('span.orig', { title: `aplicado ${fmt(va)}` }, `cód ${fmt(vc)}`),
            h('button.btn.mini', { title: 'copiar caminho', onclick: () => copiar(`${cadeiaBase()} → movimento ${id} → kf${ix} (t=${fmt(tProp)}s) → ${c}`, 'Caminho') }, '⧉')));
        }
      }
    } else calBox.append(h('div.nota', null, 'Escolha um keyframe acima (ou pause a reprodução com o ator neste movimento).'));
    calBox.append(painelVariacoes(id));
  }

  const kfComAjusteLocal = (base: KF[], aj: any): KF[] => kfComAjuste(base, aj); // mesma regra do runtime

  function painelVariacoes(alvoId: string) {
    const box = h('div');
    const alt = trab.alterados();
    const erros = validarTudo(trab.atual);
    const nome = h('input.campo', { placeholder: 'nome da variação (ex.: V1 chute mais alto)', style: { width: '220px' } }) as HTMLInputElement;
    box.append(h('div.secao', null, 'Variações e persistência'),
      h('div.aviso.so-travado', null, '🔒 Painel travado: tudo que você mexe aqui é só prévia (lado B) e some ao recarregar. Nada vai para o jogo até você clicar em aplicar, marcar "Sim, desejo aplicar" e destravar.'),
      h('div.nota', null, `Alterações pendentes (proposta × aplicado): ${[...alt.movimentos.map((x) => 'mov:' + x), ...alt.expressoes.map((x) => 'expr:' + x)].join(', ') || 'nenhuma'}`),
      erros.length ? h('div.aviso', null, 'Proposta inválida: ' + erros.join('; ')) : '',
      h('div.linha-form', null, nome, h('button.btn.mini', { onclick: () => { if (!nome.value.trim()) return toast('Dê um nome à variação.', 'erro'); trab.salvarVariacao(nome.value.trim()); toast('Variação guardada nesta sessão.', 'ok'); } }, 'Guardar variação')),
      ...trab.variacoes.map((v) => h('div.grupo-sem', null, h('b', null, v.nome), ' ', h('span.nota', null, Object.keys(v.calibracao.movimentos).concat(Object.keys(v.calibracao.expressoes)).join(', ')),
        h('div.linha-form', null, h('button.btn.mini', { onclick: () => trab.carregarVariacao(v) }, 'comparar em B'), h('button.btn.mini', { onclick: () => aplicarComDiff(v) }, 'aplicar esta'), h('button.btn.mini', { onclick: () => { trab.variacoes = trab.variacoes.filter((x) => x !== v); renderCal(); } }, '✕')))),
      h('div.linha-form', null,
        h('button.btn.mini', { onclick: () => exportarProposta(alvoId) }, 'Exportar proposta JSON'),
        h('button.btn.mini', { onclick: () => importarProposta() }, 'Importar proposta (ex.: do Luna)'),
        h('button.btn.mini', { onclick: () => salvarProposta(alvoId) }, 'Salvar em qa/propostas'),
        h('button.btn.mini', { onclick: () => listarPropostas() }, 'Abrir de qa/propostas')),
      h('div.linha-form', null,
        h('button.btn.pri', { disabled: !!erros.length || (!alt.movimentos.length && !alt.expressoes.length), onclick: () => aplicarComDiff(null) }, 'Aplicar proposta atual → src/data/calibracao.json'),
        h('button.btn.mini', { onclick: () => pedidoMov(alvoId, false) }, '✉ Copiar pedido para Luna')),
      h('div.nota', null, 'Aplicar mostra o diff, exige motivo, guarda cópia em qa/historico e registra em qa/auditoria.jsonl. Reverter: aba Alterações.'));
    return box;
  }

  function propostaArquivo(alvo: string): PropostaArquivo {
    const vs = trab.variacoes.length ? trab.variacoes : [trab.salvarVariacao('proposta-atual')];
    return { formato: 'viva-proposta', versao: 1, titulo: `Proposta para ${alvo}`, alvo, autor: 'painel', criado: new Date().toISOString(), variacoes: vs };
  }
  function exportarProposta(alvo: string) { baixarJSON(`${nomeArquivo(alvo)}.proposta.json`, propostaArquivo(alvo)); }
  async function salvarProposta(alvo: string) {
    if (!(await app.exigirLiberacao(`salvar a proposta de ${alvo} em qa/propostas`))) return toast('Nada foi gravado (painel travado). Use "Exportar proposta JSON" para guardar fora do projeto.', 'info');
    try { const r = await api.salvar('propostas', nomeArquivo(`${alvo}-${new Date().toISOString().slice(0, 10)}`), propostaArquivo(alvo)); toast(`Salvo em ${r.arquivo}`, 'ok'); } catch (e) { toast((e as Error).message + ((e as any).detalhes ? ': ' + JSON.stringify((e as any).detalhes) : ''), 'erro'); }
  }
  function aceitarProposta(p: any) {
    if (p?.formato !== 'viva-proposta' || !Array.isArray(p.variacoes)) return toast('Não é um arquivo viva-proposta.', 'erro');
    const invalidas: string[] = [];
    for (const v of p.variacoes as Variacao[]) {
      const e = validarTudo(aplicarVariacao(CALIB_APLICADA, v));
      if (e.length) invalidas.push(`${v.nome}: ${e.join('; ')}`);
      else trab.variacoes = trab.variacoes.filter((x) => x.nome !== v.nome).concat(v);
    }
    if (invalidas.length) modal('Variações recusadas (fora do escopo seguro)', h('pre.codigo', { style: { whiteSpace: 'pre-wrap' } }, invalidas.join('\n')));
    toast(`${p.variacoes.length - invalidas.length} variação(ões) carregada(s). Use "comparar em B".`, 'ok');
    renderCal();
  }
  async function importarProposta() { const p = await lerArquivoJSON(); if (p) aceitarProposta(p); }
  async function listarPropostas() {
    try {
      const arqs = await api.listar('propostas');
      const m = modal('Propostas em qa/propostas', ...(arqs.length ? arqs.map((a: any) => h('div.linha-form', null, h('button.btn.mini', { onclick: async () => { aceitarProposta(await api.ler('propostas', a.nome)); m.fechar(); } }, 'abrir'), h('code', null, a.nome), h('span.nota', null, `${a.titulo} · ${a.atualizado}`))) : [h('div.nota', null, 'Nenhuma proposta salva.')]));
    } catch (e) { toast((e as Error).message, 'erro'); }
  }

  async function aplicarComDiff(v: Variacao | null) {
    const alvo = v ? aplicarVariacao(CALIB_APLICADA, v) : normalizarCalibracao(trab.atual);
    try {
      const est = await api.estado();
      const prev = await api.previa(alvo).catch((e: any) => e.dados);
      if (prev?.erros?.length) return modal('Proposta recusada pelo servidor', h('pre.codigo', { style: { whiteSpace: 'pre-wrap' } }, prev.erros.join('\n')));
      const motivo = h('input.campo', { placeholder: 'motivo (obrigatório): ex.: chute com mais peso no quadril' }) as HTMLInputElement;
      const certeza = h('input', { type: 'checkbox' }) as HTMLInputElement;
      const diff = h('pre.codigo', { style: { maxHeight: '360px' } }, ...String(prev.diff).split('\n').map((l) => h('div', { style: { color: l.startsWith('+ ') ? '#4fd18b' : l.startsWith('- ') ? '#ff5c7a' : '' } }, l)));
      const m = modal(`Aplicar ${v ? 'variação "' + v.nome + '"' : 'proposta atual'} em src/data/calibracao.json`,
        h('div.nota', null, 'Diff do arquivo (linhas + entram, − saem). Depois de aplicar, o servidor recarrega os módulos e o painel reinicia com a nova calibração.'),
        diff,
        h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '8px 0' } }, certeza, h('b', null, 'Sim, desejo aplicar esta alteração no jogo (grava src/data/calibracao.json).')),
        h('div.linha-form', null, motivo,
          h('button.btn.pri', { onclick: async () => {
            if (!certeza.checked) return toast('Marque "Sim, desejo aplicar" para confirmar. Sem isso nada é gravado.', 'erro');
            if (motivo.value.trim().length < 3) return toast('Informe o motivo.', 'erro');
            if (!(await app.exigirLiberacao('aplicar a calibração no jogo'))) return;
            try { const r = await api.aplicar(alvo, motivo.value.trim(), est.hash, { cadeia: cadeiaBase(), variacao: v?.nome ?? null }); toast(`Aplicado. Cópia anterior: qa/historico/${r.copiaAnterior}`, 'ok'); m.fechar(); setTimeout(() => location.reload(), 700); }
            catch (e) { toast((e as Error).message, 'erro'); }
          } }, 'Confirmar e aplicar')));
      void serializar;
    } catch (e) { toast('API local indisponível: ' + (e as Error).message, 'erro'); }
  }

  // ------------------------------------------------------------------ expressão
  function renderExpr() {
    limpar(expBox);
    const id = espec.modo === 'expressao' ? espec.id : exprCal;
    expBox.append(h('div.secao', null, 'Calibrador de expressão'));
    if (!id || !(id in EXPRESSIONS)) { expBox.append(h('div.nota', null, 'A expressão atual do ator selecionado aparece aqui.')); return; }
    const cod = exprCodigo(id) as any;
    const prop = { ...cod, ...(trab.atual.expressoes[id] ?? {}) } as Face & Record<string, number>;
    expBox.append(h('div.nota', null, h('b', null, id), ` · ${localTxt(app.cat.get('expressao:' + id)?.local)} `, h('button.btn.mini', { onclick: () => trab.restaurarExpressao(id) }, 'valores do código')));
    for (const [c, lim] of Object.entries(LIMITES_FACE)) {
      const vp = (prop as any)[c] as number, vc = cod[c] as number;
      expBox.append(h('div.cal-campo' + (Math.abs(vp - vc) > 1e-9 ? '.mudou' : ''), { title: lim.rotulo }, h('span.rot', null, c),
        h('input', { type: 'range', min: String(lim.min), max: String(lim.max), step: String(lim.passo), value: String(vp), oninput: (e: Event) => trab.definirCampoFace(id, c, Number((e.target as HTMLInputElement).value)) }),
        h('span.v.mono', null, fmt(vp)), h('span.orig', null, `cód ${fmt(vc)}`), h('span', null, '')));
    }
    expBox.append(h('div.nota', null, 'Marcadores (lágrimas, suor, olhos de coração...) não são calibráveis: exigem código.'));
  }

  // ------------------------------------------------------------------ ajustes exploratórios de cena
  function renderCena() {
    limpar(cenaBox);
    cenaBox.append(h('div.secao', null, 'Ajustes exploratórios de cena (não persistem)'),
      h('div.nota', null, 'Deslocam atores e câmera SÓ no desenho, para testar composição. Posições, tempos de roteiro e câmera de cena ficam no código da situação: use o pedido para Luna.'));
    for (const { r } of runA?.atores() ?? []) {
      const v = deslocamentos.get(r) ?? 0;
      cenaBox.append(h('div.cal-campo' + (v ? '.mudou' : ''), null, h('span.rot', null, `x de ${r}`), h('input', { type: 'range', min: '-300', max: '300', step: '1', value: String(v), oninput: (e: Event) => { const n = Number((e.target as HTMLInputElement).value); if (n) deslocamentos.set(r, n); else deslocamentos.delete(r); } }), h('span.v.mono', null, ''), h('span.orig', null, 'Δ px'), h('span', null, '')));
    }
    const cam = camera ?? { zoom: 1, dx: 0, dy: 0 };
    for (const [k, min, max, st] of [['zoom', 0.5, 2.5, 0.01], ['dx', -400, 400, 1], ['dy', -300, 300, 1]] as const) {
      cenaBox.append(h('div.cal-campo', null, h('span.rot', null, `câmera ${k}`), h('input', { type: 'range', min: String(min), max: String(max), step: String(st), value: String((cam as any)[k]), oninput: (e: Event) => { camera = { ...(camera ?? { zoom: 1, dx: 0, dy: 0 }), [k]: Number((e.target as HTMLInputElement).value) }; } }), h('span', null, ''), h('span.orig', null, k === 'zoom' ? '×' : 'px'), h('span', null, '')));
    }
    cenaBox.append(h('button.btn.mini', { onclick: () => { deslocamentos.clear(); camera = null; renderCena(); } }, 'zerar ajustes exploratórios'));
  }

  // ------------------------------------------------------------------ pedidos
  function valoresAtuais() {
    const a = atorAtual();
    const v: Record<string, unknown> = { instante_s: Number(tempo.toFixed(3)), quadro: Math.round(tempo / DT) };
    if (a) {
      v.ator = runA!.rotulo(a); v.movimento = a.motionName; v.tMovimento = Number(a.motionT.toFixed(3)); v.expressao = exprEfetiva(a);
      const pose: Record<string, number> = {};
      for (const c of Object.keys(LIMITES_POSE)) pose[c] = Number((lerCampo(a.pose, c) ?? 0).toFixed(3));
      v.pose = pose;
    }
    if (deslocamentos.size) v.deslocamentosExploratorios = Object.fromEntries(deslocamentos);
    if (camera) v.cameraExploratoria = camera;
    const alt = trab.alterados();
    if (alt.movimentos.length || alt.expressoes.length) v.propostaNoPainel = normalizarCalibracao(trab.atual);
    return v;
  }
  function pedidoInstante() {
    const a = atorAtual();
    const tr = trechoAtual(a);
    const item = app.cat.get(`${espec.modo === 'acaoCorporal' ? 'acaoCorporal' : espec.modo === 'objeto' ? 'objeto' : espec.modo === 'objetoMao' ? 'objetoMao' : espec.modo}:${espec.id}`);
    abrirPedido({
      tipo: espec.modo, id: espec.id, cadeia: caminhoCampo('(instante)').replace(/ → \(instante\)$/, ''),
      arquivo: localTxt(item?.local) + (a && app.cat.get('movimento:' + a.motionName) ? ` · movimento em ${localTxt(app.cat.get('movimento:' + a.motionName)!.local)}` : ''),
      semente: espec.semente, cenario: app.labContexto?.cenario ?? (espec.cena ? `data=${JSON.stringify(espec.cena.data)}` : `bonecos=${JSON.stringify(espec.bonecos)}`),
      instante: `${tempo.toFixed(3)} s (quadro ${Math.round(tempo / DT)})`, trecho: tr?.trecho, valores: valoresAtuais(),
      escopoCalibravel: !!a && ehCalibravel(a.motionName),
    });
  }
  function pedidoMov(id: string, procedural: boolean) {
    const item = app.cat.get('movimento:' + id);
    const v = valoresAtuais();
    if (procedural && trab.exploratorio.get(id)) v.deslocamentosDesejados = trab.exploratorio.get(id);
    if (!procedural) {
      const frames = kfCodigo(id)!;
      v.keyframesCodigo = frames.map(([t, p]) => ({ t, ...p }));
      if (kfSel !== null) v.keyframeSelecionado = kfSel;
    }
    abrirPedido({ tipo: 'movimento', id, cadeia: caminhoCampo('(movimento)').replace(/ → \(movimento\)$/, ''), arquivo: localTxt(item?.local), semente: espec.semente, cenario: app.labContexto?.cenario, instante: `${tempo.toFixed(3)} s`, trecho: trechoAtual(atorAtual())?.trecho, valores: v, escopoCalibravel: !procedural });
  }

  renderBarra();
  renderControles();
  return () => { vivo = false; trab.ouvintes.delete(propostaMudou); };
}

// silencia imports só usados em tipos
void SITUATIONS; void PROPS; void HELD; void opcoesDoCampo;
