/**
 * Tela do modo Explorar: palco em tela cheia + HUD (lugar, relógio, necessidades, dinheiro), minimapa clicável,
 * menu de contexto (objetos e pessoas), números flutuando, diário do dia e resumo ao dormir.
 * A lógica do mundo fica em src/explorar/ (controle.ts); esta tela só desenha a interface e repassa cliques.
 */
import { h, modal } from './dom';
import { App } from './app';
import { Stage } from '../scenes/stage';
import { Life, money, STAT_LABEL, StatKey } from '../game/state';
import { saveLife } from '../game/storage';
import { Explorador, OpcaoMenu, ResumoDia, InterfaceExplorar, Alvo } from '../explorar/controle';
import { TRECHOS, MUNDO_X0, MUNDO_X1 } from '../explorar/mundo';
import { NECESSIDADES, Necessidade } from '../explorar/tipos';

const NEC_INFO: Record<Necessidade, { icon: string; nome: string; cor: string }> = {
  energia: { icon: '⚡', nome: 'Energia', cor: '#f2c14e' },
  fome: { icon: '🍔', nome: 'Fome', cor: '#e8845a' },
  diversao: { icon: '🎈', nome: 'Diversão', cor: '#7c5cff' },
  social: { icon: '💬', nome: 'Social', cor: '#58b368' },
  higiene: { icon: '🧼', nome: 'Higiene', cor: '#7fd3ff' },
  bexiga: { icon: '🚽', nome: 'Bexiga', cor: '#e8d06a' },
};

let cssPronto = false;
function css() {
  if (cssPronto) return;
  cssPronto = true;
  const s = document.createElement('style');
  s.textContent = `
  .screen.explorar { position: fixed; inset: 0; background: #07060f; overflow: hidden; user-select: none; }
  .explorar .stage-host { position: absolute; inset: 0; cursor: pointer; }
  .ex-top { position: absolute; left: 12px; right: 12px; top: 10px; display: flex; gap: 10px; align-items: flex-start; pointer-events: none; z-index: 5; }
  .ex-card { pointer-events: auto; background: rgba(18, 13, 43, 0.78); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.14); border-radius: 16px; padding: 10px 14px; color: #fff; box-shadow: 0 10px 30px -12px rgba(0,0,0,0.7); }
  .ex-lugar { font-family: var(--display); font-weight: 800; font-size: 20px; line-height: 1.05; }
  .ex-top > .ex-card:first-child { min-width: 200px; max-width: 260px; }
  .ex-hora { font-size: 13px; font-weight: 800; color: var(--muted); margin-top: 4px; }
  .ex-grana { font-weight: 900; color: #9be89b; margin-top: 4px; font-size: 13px; }
  .ex-necs { display: grid; grid-template-columns: repeat(3, 118px); gap: 6px 12px; }
  .ex-nec { font-size: 12px; font-weight: 800; }
  .ex-nec .bar { height: 7px; border-radius: 6px; background: rgba(255,255,255,0.14); overflow: hidden; margin-top: 3px; }
  .ex-nec .bar i { display: block; height: 100%; border-radius: 6px; transition: width .4s; }
  .ex-nec.baixa { animation: exPulso 1s infinite; }
  @keyframes exPulso { 50% { opacity: 0.45; } }
  .ex-acoes { margin-left: auto; display: flex; gap: 8px; pointer-events: auto; }
  .ex-mapa { position: absolute; left: 50%; transform: translateX(-50%); bottom: 12px; width: min(820px, calc(100% - 24px)); height: 34px; display: flex; border-radius: 12px; overflow: hidden; z-index: 5; border: 1px solid rgba(255,255,255,0.18); background: rgba(18,13,43,0.7); backdrop-filter: blur(6px); }
  .ex-mapa .tr { position: relative; height: 100%; border-right: 1px solid rgba(255,255,255,0.12); font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.75); display: flex; align-items: center; justify-content: center; text-align: center; cursor: pointer; line-height: 1; padding: 0 2px; }
  .ex-mapa .tr:hover { background: rgba(255,255,255,0.1); }
  .ex-mapa .tr.casa { background: rgba(242,193,78,0.12); } .ex-mapa .tr.rua { background: rgba(88,179,104,0.12); } .ex-mapa .tr.academia { background: rgba(230,57,86,0.14); }
  .ex-mapa .eu { position: absolute; top: 3px; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%; background: #fff; box-shadow: 0 0 10px #fff; transition: left .2s linear; pointer-events: none; }
  .ex-mapa .npc { position: absolute; bottom: 3px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; pointer-events: none; }
  .ex-menu { position: absolute; z-index: 20; min-width: 230px; max-width: 290px; background: rgba(18,13,43,0.95); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 8px; color: #fff; box-shadow: 0 20px 50px -10px rgba(0,0,0,0.8); animation: exAbre .16s ease-out; }
  @keyframes exAbre { from { transform: scale(0.9); opacity: 0; } }
  .ex-menu h4 { margin: 4px 8px 8px; font-family: var(--display); font-size: 16px; }
  .ex-menu button { display: flex; width: 100%; gap: 10px; align-items: center; text-align: left; background: rgba(255,255,255,0.06); color: #fff; border: 0; border-radius: 11px; padding: 9px 10px; margin: 3px 0; font: 800 14px var(--display, sans-serif); cursor: pointer; }
  .ex-menu button:hover { background: rgba(255,255,255,0.16); }
  .ex-menu button.bloq { opacity: 0.45; cursor: not-allowed; }
  .ex-menu button small { display: block; font: 700 11px sans-serif; color: var(--muted); }
  .ex-menu .ic { font-size: 20px; width: 26px; text-align: center; }
  .ex-flut { position: absolute; z-index: 15; font: 900 17px var(--display, sans-serif); text-shadow: 0 2px 0 rgba(0,0,0,0.55); pointer-events: none; animation: exSobe 1.8s ease-out forwards; white-space: nowrap; transform: translateX(-50%); }
  @keyframes exSobe { 0% { opacity: 0; margin-top: 10px; } 15% { opacity: 1; margin-top: 0; } 100% { opacity: 0; margin-top: -60px; } }
  .ex-diario { position: absolute; left: 12px; bottom: 56px; width: min(360px, calc(100% - 24px)); z-index: 4; display: flex; flex-direction: column; gap: 5px; pointer-events: none; }
  .ex-diario div { background: rgba(18,13,43,0.72); color: #fff; font-size: 13px; font-weight: 700; padding: 7px 11px; border-radius: 11px; border-left: 4px solid #9aa0b0; animation: exAbre .2s; }
  .ex-diario .bom { border-color: #58b368; } .ex-diario .ruim { border-color: #e8335a; }
  .ex-prog { position: absolute; left: 50%; top: 84px; transform: translateX(-50%); z-index: 6; background: rgba(18,13,43,0.85); color: #fff; border-radius: 14px; padding: 8px 14px; font-weight: 800; font-size: 13px; min-width: 220px; text-align: center; border: 1px solid rgba(255,255,255,0.18); }
  .ex-prog .bar { height: 8px; background: rgba(255,255,255,0.15); border-radius: 8px; overflow: hidden; margin-top: 6px; }
  .ex-prog .bar i { display: block; height: 100%; background: linear-gradient(90deg, #7c5cff, #ff8a5c); }
  .ex-dica { position: absolute; z-index: 14; pointer-events: none; background: rgba(0,0,0,0.75); color: #fff; font: 800 12px sans-serif; padding: 5px 9px; border-radius: 8px; transform: translate(-50%, -130%); white-space: nowrap; }
  .ex-zoom { position: absolute; right: 12px; bottom: 56px; z-index: 5; display: flex; flex-direction: column; gap: 6px; }
  .ex-zoom button { width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(18,13,43,0.78); color: #fff; font: 900 20px sans-serif; cursor: pointer; }
  .ex-zoom button:hover { background: rgba(60,50,110,0.9); }
  @media (max-width: 720px) { .ex-necs { grid-template-columns: repeat(3, 76px); } .ex-lugar { font-size: 16px; } .ex-acoes .btn span { display: none; } .ex-mapa .tr { font-size: 0; } }
  `;
  document.head.appendChild(s);
}

export function explorarScreen(app: App, L: Life) {
  css();
  const host = h('div.stage-host') as HTMLDivElement;
  const stage = new Stage(host);
  const lugar = h('div.ex-lugar');
  const hora = h('div.ex-hora');
  const grana = h('div.ex-grana');
  const necs = h('div.ex-necs');
  const barras = {} as Record<Necessidade, { fill: HTMLElement; root: HTMLElement }>;
  for (const k of NECESSIDADES) {
    const fill = h('i', { style: { background: NEC_INFO[k].cor } });
    const root = h('div.ex-nec', null, `${NEC_INFO[k].icon} ${NEC_INFO[k].nome}`, h('div.bar', null, fill));
    barras[k] = { fill, root };
    necs.appendChild(root);
  }
  const btnFim = h('button.btn.small', { title: 'Encerrar o dia e voltar à vida' }, '🌙 ', h('span', null, 'Encerrar o dia'));
  const btnVoltar = h('button.btn.small.ghost', { title: 'Voltar sem encerrar o dia' }, '↩ ', h('span', null, 'Voltar'));
  const top = h('div.ex-top', null,
    h('div.ex-card', null, lugar, hora, grana),
    h('div.ex-card', null, necs),
    h('div.ex-acoes', null, btnVoltar, btnFim),
  );
  const mapa = h('div.ex-mapa');
  const diario = h('div.ex-diario');
  const prog = h('div.ex-prog', { style: { display: 'none' } });
  const dica = h('div.ex-dica', { style: { display: 'none' } });
  const zoomMais = h('button', { title: 'Aproximar (roda do mouse)' }, '+');
  const zoomMenos = h('button', { title: 'Afastar a câmera (roda do mouse)' }, '−');
  const zoomBox = h('div.ex-zoom', null, zoomMais, zoomMenos);
  const el = h('div.screen.explorar', null, host, top, mapa, diario, prog, dica, zoomBox);

  let menu: HTMLElement | null = null;
  const fecharMenu = () => { menu?.remove(); menu = null; };
  let ultimoMenuXY = { x: 0, y: 0 };

  const ui: InterfaceExplorar = {
    flutuar(xm, ym, texto, cor = '#fff') {
      const v = ex.sc.view;
      const sx = (xm - v.x0) * v.scale, sy = (ym - v.y0) * v.scale;
      const f = h('div.ex-flut', { style: { left: sx + 'px', top: sy + 'px', color: cor } }, texto);
      el.appendChild(f);
      setTimeout(() => f.remove(), 1900);
    },
    aviso(texto, tipo = 'info') { registrar(texto, tipo === 'bad' ? 'ruim' : tipo === 'ok' ? 'bom' : 'neutro', 5200); },
    registrar(texto, tom) { registrar(texto, tom); },
    progresso(frac, rotulo) {
      if (frac === null) { prog.style.display = 'none'; return; }
      prog.style.display = '';
      prog.replaceChildren(h('div', null, rotulo ?? ''), h('div.bar', null, h('i', { style: { width: Math.round(frac * 100) + '%' } })));
    },
    escolher(titulo, opcoes) { abrirMenu(titulo, opcoes); },
    fimDoDia(r) { mostrarResumo(r); },
    atualizar() { atualizar(); },
  };

  function registrar(texto: string, tom: 'bom' | 'ruim' | 'neutro', dur = 4200) {
    const d = h('div.' + tom, null, texto);
    diario.appendChild(d);
    while (diario.children.length > 4) diario.firstChild?.remove();
    setTimeout(() => d.remove(), dur);
  }

  function abrirMenu(titulo: string, opcoes: OpcaoMenu[]) {
    fecharMenu();
    menu = h('div.ex-menu', null, h('h4', null, titulo),
      ...opcoes.map((o) => h('button' + (o.bloqueio ? '.bloq' : ''), {
        onclick: (e: MouseEvent) => {
          e.stopPropagation();
          if (o.bloqueio) { registrar(o.bloqueio, 'ruim'); return; }
          fecharMenu();
          o.run();
        },
      }, h('span.ic', null, o.icon), h('span', null, o.label, o.bloqueio ? h('small', null, o.bloqueio) : null))));
    el.appendChild(menu);
    const r = el.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const x = Math.min(Math.max(8, ultimoMenuXY.x + 12), r.width - m.width - 8);
    const y = Math.min(Math.max(70, ultimoMenuXY.y - m.height / 2), r.height - m.height - 56);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  const ex = new Explorador(L, ui);
  stage.setScene(ex.sc);
  (window as unknown as { __ex: Explorador }).__ex = ex; // inspeção/QA pelo console
  // QA por URL (capturas headless, ver instrucoesCodex/): ?ex=3350,850&zoom=0.6&hora=21&usar=supino1:supino
  const qp = new URLSearchParams(location.search);
  if (qp.has('zoom')) ex.zoom = Number(qp.get('zoom'));
  if (qp.has('ex')) { const [x, y] = (qp.get('ex') ?? '').split(',').map(Number); ex.teleportar(x, y); }
  if (qp.has('hora')) { ex.est.hora = Number(qp.get('hora')) * 60; ex.avancar(0); }
  if (qp.has('usar')) { const [o, a] = (qp.get('usar') ?? '').split(':'); ex.testarUso(o, a, true); }
  if (qp.has('zoom')) ex.sc.cam.zoom = ex.sc.cam.tz = ex.zoom;
  // captura: sem a animação de entrada da tela (no Edge headless em tempo real ela pode parar no meio e escurecer tudo)
  if (['ex', 'zoom', 'hora', 'usar'].some((k) => qp.has(k))) el.style.animation = 'none';

  // ------------------------------------------------ minimapa
  const largura = MUNDO_X1 - MUNDO_X0;
  const pontoEu = h('div.eu');
  for (const tr of TRECHOS) {
    mapa.appendChild(h('div.tr.' + tr.lugar, {
      style: { width: ((tr.x1 - tr.x0) / largura) * 100 + '%' }, title: tr.nome,
      onclick: (e: MouseEvent) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const k = (e.clientX - rect.left) / rect.width;
        ex.pararUso();
        ex.irPara(tr.x0 + (tr.x1 - tr.x0) * k, tr.interno ? 720 : 850, true);
      },
    }, tr.nome.split(' · ')[0]));
  }
  mapa.appendChild(pontoEu);
  const pontosNpc: HTMLElement[] = [];

  // ------------------------------------------------ entrada
  let ultimoClique = 0;
  const pos = (e: PointerEvent) => { const r = host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  host.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    ultimoMenuXY = p;
    fecharMenu();
    const agora = performance.now();
    const duplo = agora - ultimoClique < 320;
    ultimoClique = agora;
    ex.clicar(p.x, p.y, duplo);
  });
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const p = pos(e);
    const a: Alvo | null = ex.alvoEm(p.x, p.y);
    ex.destaque = a?.tipo === 'obj' ? a.obj : null;
    const r = ex.rotuloAlvo(a);
    if (r) { dica.style.display = ''; dica.textContent = r; dica.style.left = p.x + 'px'; dica.style.top = p.y + 'px'; }
    else dica.style.display = 'none';
  });
  host.addEventListener('pointerleave', () => { dica.style.display = 'none'; ex.destaque = null; });
  // zoom: roda do mouse, pinça (ctrl+roda no trackpad) e botões
  host.addEventListener('wheel', (e) => { e.preventDefault(); ex.ajustarZoom(Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
  zoomMais.onclick = (e) => { e.stopPropagation(); ex.ajustarZoom(1.15); };
  zoomMenos.onclick = (e) => { e.stopPropagation(); ex.ajustarZoom(1 / 1.15); };
  zoomBox.addEventListener('pointerdown', (e) => e.stopPropagation());
  // teclado: setas/WASD andam, Shift corre
  const teclas = new Set<string>();
  const direcao = () => {
    const x = (teclas.has('arrowright') || teclas.has('d') ? 1 : 0) - (teclas.has('arrowleft') || teclas.has('a') ? 1 : 0);
    const y = (teclas.has('arrowdown') || teclas.has('s') ? 1 : 0) - (teclas.has('arrowup') || teclas.has('w') ? 1 : 0);
    ex.direcao = x || y ? { x, y, correr: teclas.has('shift') } : null;
    if (!x && !y) ex.pararTeclado();
  };
  const kd = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's', 'shift'].includes(k)) { teclas.add(k); fecharMenu(); ex.pararUso(); direcao(); e.preventDefault(); } };
  const ku = (e: KeyboardEvent) => { teclas.delete(e.key.toLowerCase()); direcao(); };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  // ------------------------------------------------ HUD
  function atualizar() {
    lugar.textContent = ex.lugarAtual();
    hora.textContent = `🕒 ${ex.horaTexto()} · Dia ${ex.est.dias + 1} · ${L.player.age} anos`;
    grana.textContent = money(L.money);
    for (const k of NECESSIDADES) {
      const v = ex.est.nec[k];
      barras[k].fill.style.width = v + '%';
      barras[k].root.classList.toggle('baixa', v < 20);
    }
    pontoEu.style.left = ((ex.eu.x - MUNDO_X0) / largura) * 100 + '%';
    while (pontosNpc.length < ex.npcs.length) { const d = h('div.npc'); mapa.appendChild(d); pontosNpc.push(d); }
    pontosNpc.forEach((d, i) => {
      const n = ex.npcs[i];
      d.style.display = n ? '' : 'none';
      if (!n) return;
      d.style.left = ((n.ator.x - MUNDO_X0) / largura) * 100 + '%';
      d.style.background = ex.nivel(n).cor;
    });
  }
  const iv = setInterval(atualizar, 250);
  atualizar();

  // ------------------------------------------------ saídas
  const sair = () => { saveLife(L); app.go('game', L); };
  btnVoltar.onclick = (e) => { e.stopPropagation(); saveLife(L); sair(); };
  btnFim.onclick = (e) => { e.stopPropagation(); ex.encerrarDia('saiu'); };

  function mostrarResumo(r: ResumoDia) {
    saveLife(L);
    const linhas: Node[] = [];
    const titulo = r.motivo === 'dormiu' ? '🌙 Boa noite!' : r.motivo === 'apagou' ? '😵 Você apagou de sono' : '🌆 Fim do dia';
    const st = Object.entries(r.stats) as [StatKey, number][];
    if (st.length) linhas.push(h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '8px 0' } },
      ...st.map(([k, v]) => h('span.tag', { style: { fontSize: '14px', padding: '6px 10px' } }, `${v > 0 ? '+' : ''}${v} ${STAT_LABEL[k]}`))));
    if (r.fitness) linhas.push(h('p', null, `💪 Forma física ${r.fitness > 0 ? '+' : ''}${r.fitness}`));
    if (r.dinheiro) linhas.push(h('p', null, `💰 ${r.dinheiro > 0 ? 'Ganhou' : 'Gastou'} ${money(Math.abs(r.dinheiro))}`));
    if (r.conheceu.length) linhas.push(h('p', null, `🤝 Conheceu: ${r.conheceu.join(', ')}`));
    if (r.contatos.length) linhas.push(h('p', null, `📇 Contatos novos: ${r.contatos.join(', ')} — veja na aba Relações!`));
    for (const m of r.momentos) linhas.push(h('p', null, '✨ ' + m));
    if (!linhas.length) linhas.push(h('p.muted', null, 'Um dia tranquilo. Às vezes é disso que a gente precisa.'));
    linhas.push(h('div', { style: { display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' } },
      h('button.btn.primary', { onclick: () => { fecha(); app.go('explorar', L); } }, '☀️ Viver o próximo dia'),
      h('button.btn', { onclick: () => { fecha(); sair(); } }, '📖 Voltar à vida'),
    ));
    const fecha = modal(`${titulo} — Dia ${r.dia}`, h('div', null, ...linhas), { onClose: () => undefined });
  }

  return {
    el,
    destroy() {
      clearInterval(iv);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      fecharMenu();
      stage.destroy();
    },
  };
}
