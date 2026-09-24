import { h, icon, clear, modal, toast, confirmBox } from './dom';
import { Stage } from '../scenes/stage';
import { Cast, CastMember } from '../scenes/situations';
import { App } from './app';
import {
  Life, STAT_KEYS, STAT_LABEL, StatKey, Person, money, fullName, REL_LABEL, playerCast, cast, partner, children, stat, addLog, byRel, Tone, newId,
} from '../game/state';
import { ageUp, resolveAction, isPending, outcomeFromEvent, evChoices, continueAsChild, registrarResultado } from '../game/life';
import { ACTIONS, INTERACTIONS, jobOffers, workHard, askPromotion, quitJob } from '../game/activities';
import { startInterview } from '../game/interviews';
import { Outcome, PendingEvent, SceneReq, Action } from '../game/types';
import { eventTitle } from '../game/events';
import { saveLife, downloadJSON } from '../game/storage';
import { portraitImg } from './portrait';
import { sfx } from '../core/audio';
import { rng } from '../core/rng';
import { CAREERS } from '../game/careers';
import { ACHIEVEMENTS, checkAchievements } from '../game/achievements';
import { descreverMemoria, tetoVinculo } from '../game/relacoes';

const STAT_ICON: Record<StatKey, string> = { felicidade: 'heart', saude: 'health', inteligencia: 'brain', aparencia: 'star' };
const STAT_COL: Record<StatKey, string> = { felicidade: 'var(--st-felicidade)', saude: 'var(--st-saude)', inteligencia: 'var(--st-inteligencia)', aparencia: 'var(--st-aparencia)' };

interface Snap { stats: Record<StatKey, number>; money: number }

const PRISON_ACTIONS: Action[] = [
  { id: 'p-malhar', label: 'Malhar no pátio', icon: '💪', group: 'Prisão', minAge: 0, desc: 'Ficar forte para sobreviver.', run: (L) => { stat(L, 'saude', 5); L.fitness += 6; return { text: 'Você treinou pesado no pátio.', tone: 'bom', scene: { id: 'cela', data: { titulo: 'Treino na cela' } } }; } },
  { id: 'p-ler', label: 'Ler na biblioteca', icon: '📖', group: 'Prisão', minAge: 0, desc: 'Educação atrás das grades.', run: (L) => { stat(L, 'inteligencia', 5); return { text: 'Você devorou vários livros.', tone: 'bom', scene: { id: 'estudar' } }; } },
  { id: 'p-bom', label: 'Bom comportamento', icon: '😇', group: 'Prisão', minAge: 0, desc: 'Pode reduzir a pena.', run: (L) => { L.karma += 3; if (rng.chance(0.3) && L.crime.pena > 1) { L.crime.pena--; return { text: 'Sua pena foi reduzida em 1 ano!', tone: 'bom' }; } return { text: 'Os guardas notaram sua conduta.', tone: 'neutro' }; } },
  { id: 'p-fugir', label: 'Tentar fugir', icon: '🏃', group: 'Prisão', minAge: 0, desc: 'Arriscadíssimo.', run: (L) => { if (rng.chance(0.18)) { L.crime.preso = false; L.crime.pena = 0; L.crime.ficha += 1; return { text: 'Você fugiu pela lavanderia! Agora é um(a) foragido(a).', tone: 'especial', scene: { id: 'crime', data: { caught: false, titulo: 'Fuga!' } } }; } L.crime.pena += 2; stat(L, 'saude', -8); return { text: 'Pego(a) na cerca! Mais 2 anos de pena.', tone: 'ruim', scene: { id: 'cela', data: { titulo: 'Fuga frustrada', sub: `Faltam ${L.crime.pena} anos` } } }; } },
];

export function gameScreen(app: App, L: Life) {
  let busy = false;
  const host = h('div.stage-host');
  const stage = new Stage(host);
  stage.onSceneStart = () => { stage.scene.padBottom = cardPad; };

  // ------------------------------------------------ HUD
  const hudPortrait = h('div');
  const hudName = h('div.hud-name');
  const hudSub = h('div.hud-sub');
  const hudMoney = h('div.hud-money');
  const musicBtn = h('button.icon-btn' + (sfx.musicOn ? '.on' : ''), { title: 'Música', onclick: () => { sfx.setMusic(!sfx.musicOn); musicBtn.classList.toggle('on', sfx.musicOn); } }, icon('music'));
  const sfxBtn = h('button.icon-btn' + (sfx.sfxOn ? '.on' : ''), { title: 'Sons', onclick: () => { sfx.setSfx(!sfx.sfxOn); sfxBtn.classList.toggle('on', sfx.sfxOn); } }, icon('sound'));
  const hud = h('div.hud', null,
    h('div.hud-card', null, hudPortrait, h('div', null, hudName, hudSub, hudMoney)),
    h('div.hud-right', null,
      musicBtn, sfxBtn,
      h('button.icon-btn', { title: 'Salvar', onclick: () => { if (saveLife(L)) toast('Jogo salvo!', 'ok'); else toast('Falha ao salvar.', 'bad'); } }, icon('save')),
      h('button.icon-btn', { title: 'Menu principal', onclick: async () => { saveLife(L); app.go('title'); } }, icon('home')),
    ),
  );
  const skipBtn = h('button.btn.small.skip-btn', { onclick: () => { stage.setSkip(true); skipBtn.style.display = 'none'; } }, icon('skip'), 'Pular cena');
  skipBtn.style.display = 'none';
  const evLayer = h('div.ev-layer');

  // ------------------------------------------------ status + botão de idade
  const statEls = {} as Record<StatKey, { root: HTMLElement; fill: HTMLElement; val: HTMLElement }>;
  const stats = h('div.stats', null, ...STAT_KEYS.map((k) => {
    const fill = h('div.fill', { style: { background: `linear-gradient(90deg, ${STAT_COL[k]}, color-mix(in srgb, ${STAT_COL[k]} 60%, white))` } });
    const val = h('div.val');
    const root = h('div.stat', { title: STAT_LABEL[k] }, h('span', { style: { color: STAT_COL[k] } }, icon(STAT_ICON[k])), h('div.lbl', null, STAT_LABEL[k]), h('div.bar', null, fill), val);
    statEls[k] = { root, fill, val };
    return root;
  }));
  const ageBtn = h('button.age-btn', { onclick: () => doAgeUp(), title: 'Envelhecer 1 ano' }, h('b', null, '+1'), h('small', null, 'ANO')) as HTMLButtonElement;
  const bottom = h('div.g-bottom', null, stats, ageBtn);

  // ------------------------------------------------ abas
  const TABS = [
    { id: 'vida', name: 'Vida', icon: 'life' },
    { id: 'atividades', name: 'Atividades', icon: 'activity' },
    { id: 'relacoes', name: 'Relações', icon: 'people' },
    { id: 'carreira', name: 'Carreira', icon: 'work' },
    { id: 'perfil', name: 'Perfil', icon: 'id' },
  ];
  let tab = 'vida';
  const tabBody = h('div.tab-body');
  const tabBtns = TABS.map((t) => {
    const b = h('button.tab' + (t.id === tab ? '.on' : ''), { onclick: () => { tab = t.id; tabBtns.forEach((x) => x.classList.remove('on')); b.classList.add('on'); renderTab(); tabBody.scrollTop = 0; sfx.swoosh(); } }, icon(t.icon), t.name);
    return b;
  });
  const right = h('div.g-right', null, h('div.tabs', null, ...tabBtns), tabBody);

  // ações físicas diretas sobre o personagem na cena atual — só aparecem as que a idade permite
  const EMOTES: { em: string; label: string; motion: string; minAge: number; snd: () => void }[] = [
    { em: '😂', label: 'Rir', motion: 'rir', minAge: 0, snd: () => sfx.laugh() },
    { em: '😢', label: 'Chorar', motion: 'chorar', minAge: 0, snd: () => sfx.cry() },
    { em: '👋', label: 'Acenar', motion: 'acenar', minAge: 2, snd: () => sfx.pop() },
    { em: '😡', label: 'Bravo', motion: 'furia', minAge: 2, snd: () => sfx.thud() },
    { em: '💃', label: 'Dançar', motion: 'dancar', minAge: 3, snd: () => sfx.magic() },
    { em: '🦘', label: 'Pular', motion: 'pular', minAge: 3, snd: () => {} },
    { em: '🙌', label: 'Comemorar', motion: 'comemorar', minAge: 3, snd: () => sfx.cheer() },
    { em: '🤔', label: 'Pensar', motion: 'pensando', minAge: 4, snd: () => sfx.tick() },
    { em: '🙇', label: 'Reverência', motion: 'reverencia', minAge: 5, snd: () => sfx.swoosh() },
    { em: '🧘', label: 'Meditar', motion: 'meditar', minAge: 8, snd: () => sfx.magic() },
  ];
  const liberadas = () => EMOTES.filter((e) => L.player.age >= e.minAge);
  let emoteTimer = 0;
  const emoteBar = h('div.emote-bar');
  let emotesMostrados = -1;
  function renderEmotes() {
    const lista = liberadas();
    if (lista.length === emotesMostrados) return;
    emotesMostrados = lista.length;
    clear(emoteBar).append(...lista.map((e) => h('button.emote', { title: e.label, onclick: () => fazerEmote(e) }, h('span', null, e.em))));
  }
  function fazerEmote(e: (typeof EMOTES)[number]) {
    const pa = stage.scene.actors.find((a) => a.name === L.player.first);
    if (!pa || busy || stage.busy) return;
    const motion = e.motion;
    e.snd();
    const base = pa.baseMotion;
    clearTimeout(emoteTimer);
    if (motion === 'pular' || motion === 'reverencia') pa.play(motion);
    else {
      pa.play(motion, { base: false });
      emoteTimer = window.setTimeout(() => pa.play(base, { fade: 0.35 }), 2600);
    }
    const hw = pa.headWorld();
    if (motion === 'dancar') for (let i = 0; i < 4; i++) setTimeout(() => stage.scene.fx.spawn('musica', hw.x, hw.y - 30, 1), i * 400);
    if (motion === 'comemorar') stage.scene.fx.spawn('confete', hw.x, hw.y - 60, 40, { speed: 380, dir: -Math.PI / 2, cone: 1.4, life: 2.4, size: 10 });
    if (motion === 'chorar') pa.emoteOn('lagrima');
    if (motion === 'furia') pa.emoteOn('raiva');
    if (motion === 'pensando') pa.emoteOn('ideia', 2.4);
    if (motion === 'meditar') stage.scene.fx.spawn('brilho', hw.x, hw.y, 10, { speed: 90, size: 9 });
  }
  /** Mostra (uma vez) um aviso simples quando novas ações do palco são liberadas pela idade. */
  function avisarNovasAcoes() {
    const vistas = typeof L.flags.acoesPalcoVistas === 'number' ? (L.flags.acoesPalcoVistas as number) : -1;
    const lista = liberadas();
    L.flags.acoesPalcoVistas = lista.length;
    if (vistas < 0 || lista.length <= vistas) return; // 1ª vez (vida nova/save antigo): só registra
    const novas = lista.slice(vistas);
    modal('Novas ações liberadas!', h('div', null,
      h('p', null, `Com ${L.player.age} anos você já consegue:`),
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '10px 0' } }, ...novas.map((e) => h('span.tag', { style: { fontSize: '15px', padding: '6px 12px' } }, `${e.em} ${e.label}`))),
      h('p.muted', null, 'Use os botões no canto do palco para o seu personagem fazer isso a qualquer momento.'),
    ));
    sfx.levelUp();
  }
  renderEmotes();
  avisarNovasAcoes();
  const stageWrap = h('div.g-stage', null, host, hud, skipBtn, evLayer, emoteBar);
  const left = h('div.g-left', null, stageWrap, bottom);
  const el = h('div.screen.game', null, left, right);

  // ------------------------------------------------ renderização
  let lastPortraitKey = '';
  function refresh(prev?: Snap) {
    const p = L.player;
    const pk = Math.floor(p.age / 3) + '|' + L.dead;
    if (pk !== lastPortraitKey) {
      lastPortraitKey = pk;
      clear(hudPortrait).appendChild(portraitImg(p.ap, p.age, 58, L.dead ? 'dormindo' : 'feliz', '#7c5cff'));
    }
    hudName.textContent = fullName(p);
    const jobTxt = L.crime.preso ? '⛓️ Na prisão' : L.job ? L.job.title : L.retired ? 'Aposentado(a)' : L.edu.stage === 'faculdade' ? `Universitário(a) · ${L.edu.curso}` : p.age >= 6 && p.age < 18 ? 'Estudante' : p.age < 6 ? 'Criança' : 'Desempregado(a)';
    hudSub.textContent = `${p.age} ${p.age === 1 ? 'ano' : 'anos'} · ${jobTxt}`;
    clear(hudMoney).append(icon('coin'), money(L.money));
    for (const k of STAT_KEYS) {
      const v = L.stats[k];
      statEls[k].fill.style.width = v + '%';
      statEls[k].val.textContent = String(v);
      if (prev && prev.stats[k] !== v) {
        const c = prev.stats[k] < v ? 'pulse-up' : 'pulse-down';
        statEls[k].root.classList.remove('pulse-up', 'pulse-down');
        void statEls[k].root.offsetWidth;
        statEls[k].root.classList.add(c);
      }
    }
    ageBtn.disabled = busy || L.dead;
    renderEmotes();
    emoteBar.classList.toggle('hide', busy || L.dead || L.crime.preso || liberadas().length === 0);
    renderTab();
  }

  function renderTab() {
    clear(tabBody);
    if (tab === 'vida') renderLog();
    else if (tab === 'atividades') renderActs();
    else if (tab === 'relacoes') renderRels();
    else if (tab === 'carreira') renderCareer();
    else renderProfile();
  }

  function renderLog() {
    const byAge = new Map<number, typeof L.log>();
    for (const e of L.log) {
      if (!byAge.has(e.age)) byAge.set(e.age, []);
      byAge.get(e.age)!.push(e);
    }
    const ages = [...byAge.keys()].sort((a, b) => a - b).slice(-40);
    for (const a of ages) {
      tabBody.appendChild(h('div.year', null,
        h('div.year-h', null, `Idade ${a}`),
        ...byAge.get(a)!.map((e) => h('div.entry.' + e.tone, null, h('span.em', null, e.icon ?? '•'), h('span', null, e.text))),
      ));
    }
    requestAnimationFrame(() => (tabBody.scrollTop = tabBody.scrollHeight));
  }

  function renderActs() {
    if (L.dead) { tabBody.appendChild(h('div.empty', null, 'Esta vida chegou ao fim. 🕊️')); return; }
    const list = L.crime.preso ? PRISON_ACTIONS : ACTIONS.filter((a) => L.player.age >= a.minAge && (a.maxAge === undefined || L.player.age <= a.maxAge) && (!a.cond || a.cond(L)));
    if (!list.length) { tabBody.appendChild(h('div.empty', null, 'Você ainda é muito pequeno(a) para atividades. Aproveite a infância!')); return; }
    const groups = new Map<string, Action[]>();
    for (const a of list) {
      if (!groups.has(a.group)) groups.set(a.group, []);
      groups.get(a.group)!.push(a);
    }
    for (const [g, acts] of groups) {
      tabBody.appendChild(h('div.sec-title', null, g));
      tabBody.appendChild(h('div.acts', null, ...acts.map((a) => {
        const cost = typeof a.cost === 'function' ? a.cost(L) : a.cost;
        return h('button.act', { disabled: busy, onclick: () => doAction(a) },
          h('span.em', null, a.icon), h('b', null, a.label), h('small', null, a.desc),
          cost ? h('span.cost', null, L.player.age < 18 ? 'pais pagam' : money(cost)) : null,
        );
      })));
    }
  }

  function personRow(p: Person) {
    return h('div.person' + (p.alive ? '' : '.dead'), { onclick: () => p.alive && openPerson(p) },
      portraitImg(p.ap, p.age, 52, p.alive ? (p.bond < 30 ? 'bravo' : 'feliz') : 'dormindo', p.rel === 'mae' || p.rel === 'pai' ? '#5ec3e8' : p.rel.startsWith('namor') || p.rel === 'conjuge' ? '#ff5c8a' : p.rel === 'filho' || p.rel === 'filha' ? '#ffb547' : '#7c5cff'),
      h('div.info', null,
        h('b', null, fullName(p)),
        h('small', null, `${REL_LABEL[p.rel]}${p.memo?.noivado !== undefined ? ' (noivado)' : ''} · ${p.age} anos${p.alive ? '' : ' · falecido(a)'}${p.memo?.afastado ? ' · 🚫 cortou contato' : (p.memo?.rancor ?? 0) >= 60 ? ' · 💢 magoado(a)' : (p.memo?.medo ?? 0) >= 40 ? ' · 😨 com medo' : ''}`),
        p.alive ? h('div.bond', null, h('i', { style: { width: p.bond + '%', backgroundPosition: `-${(100 - p.bond) * 2}px 0` } })) : null,
      ),
    );
  }

  function renderRels() {
    const groups: [string, Person[]][] = [
      ['Amor', L.people.filter((p) => p.alive && ['namorado', 'namorada', 'conjuge'].includes(p.rel))],
      ['Família', L.people.filter((p) => ['mae', 'pai', 'irmao', 'irma', 'avo', 'avoM'].includes(p.rel))],
      ['Filhos', L.people.filter((p) => ['filho', 'filha'].includes(p.rel))],
      ['Amizades', L.people.filter((p) => p.alive && ['amigo', 'amiga'].includes(p.rel))],
      ['Trabalho', L.people.filter((p) => p.alive && ['chefe', 'colegaTrab'].includes(p.rel))],
      ['Escola', L.people.filter((p) => p.alive && ['colega', 'professor'].includes(p.rel))],
      ['Outros', L.people.filter((p) => p.alive && ['ex', 'conhecido'].includes(p.rel)).slice(-8)],
    ];
    let any = false;
    for (const [g, ps] of groups) {
      if (!ps.length) continue;
      any = true;
      tabBody.appendChild(h('div.sec-title', null, g));
      ps.forEach((p) => tabBody.appendChild(personRow(p)));
    }
    const pets = L.pets.filter((p) => p.alive);
    if (pets.length) {
      tabBody.appendChild(h('div.sec-title', null, icon('paw'), 'Pets'));
      for (const pet of pets) tabBody.appendChild(h('div.person', { onclick: () => doOutcome(() => { pet.bond = Math.min(100, pet.bond + 8); stat(L, 'felicidade', 4); return { text: `Você brincou com ${pet.name}. Que alegria!`, tone: 'bom', scene: { id: 'pet', data: { kind: pet.kind, color: pet.color, nome: pet.name, titulo: 'Hora de brincar', env: 'sala' } } }; }) },
        h('div', { style: { fontSize: '34px', width: '52px', textAlign: 'center' } }, pet.kind === 'cachorro' ? '🐶' : '🐱'),
        h('div.info', null, h('b', null, pet.name), h('small', null, `${pet.kind === 'cachorro' ? 'Cachorro' : 'Gato'} · ${pet.age} anos`), h('div.bond', null, h('i', { style: { width: pet.bond + '%' } }))),
      ));
    }
    if (!any) tabBody.appendChild(h('div.empty', null, 'Nenhum relacionamento ainda.'));
  }

  function openPerson(p: Person) {
    const list = INTERACTIONS.filter((i) => i.cond(L, p));
    const body = h('div', null,
      h('div.p-head', null,
        portraitImg(p.ap, p.age, 96, p.bond < 30 ? 'bravo' : 'feliz', '#7c5cff'),
        h('div', null,
          h('div', { style: { fontFamily: 'var(--display)', fontSize: '22px', fontWeight: '800' } }, fullName(p)),
          h('div.muted', { style: { fontWeight: '700' } }, `${REL_LABEL[p.rel]} · ${p.age} anos${p.job ? ' · ' + p.job : ''}`),
          h('div', null, ...p.traits.map((t) => h('span.tag', null, t))),
          h('div.bond', { style: { width: '200px' } }, h('i', { style: { width: p.bond + '%', backgroundPosition: `-${(100 - p.bond) * 2}px 0` } })),
          h('small.muted', null, `Relacionamento: ${p.bond}%${tetoVinculo(p) < 100 && p.memo ? ` · máximo possível hoje: ${tetoVinculo(p)}%` : ''}`),
        ),
      ),
      ...(() => {
        const etiquetas = descreverMemoria(p);
        const fatos = (p.memo?.fatos ?? []).slice(-4).reverse();
        if (!etiquetas.length && !fatos.length) return [];
        return [
          h('div.sec-title', null, 'O que ' + p.first + ' sente e lembra'),
          h('div', null, ...etiquetas.map((e) => h('span.tag', { style: { background: e.tom === 'ruim' ? 'rgba(255,92,122,.28)' : e.tom === 'bom' ? 'rgba(79,209,139,.25)' : '' } }, e.texto))),
          ...fatos.map((f) => h('div.muted', { style: { fontSize: '13px', marginTop: '4px' } }, `• aos ${f.idade}: ${f.texto}`)),
        ];
      })(),
      ...(() => {
        const groups = new Map<string, typeof list>();
        for (const it of list) {
          const g = it.group ?? 'Interações';
          if (!groups.has(g)) groups.set(g, []);
          groups.get(g)!.push(it);
        }
        const order = ['Interações', 'Conversa', 'Carinho', 'Amor', 'Agressão'];
        return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).flatMap(([g, its]) => [
          h('div.sec-title' + (g === 'Agressão' ? '.danger' : ''), null, g === 'Agressão' ? '⚠️ Agressão (há consequências)' : g),
          h('div.inter-grid', null, ...its.map((it) => h('button.inter' + (g === 'Agressão' ? '.bad' : ''), { onclick: () => { close(); doOutcome(() => it.run(L, p)); } }, h('span.em', null, it.icon), it.label))),
        ]);
      })(),
    );
    const close = modal(p.first, body);
  }

  function renderCareer() {
    const p = L.player;
    const e = L.edu;
    const eduTxt = { nenhum: 'Ainda não estuda', fundamental: 'Ensino fundamental', medio: 'Ensino médio', faculdade: `Faculdade de ${e.curso}`, formado: e.faculdade ? `Graduado(a) em ${e.curso}` : 'Ensino médio completo' }[e.stage];
    tabBody.appendChild(h('div.card', null, h('h4', null, '🎓 Educação'), h('div.kv', null, 'Situação', h('b', null, eduTxt)), h('div.kv', null, 'Desempenho', h('b', null, `${e.nota}/100`))));
    if (L.crime.preso) {
      tabBody.appendChild(h('div.card', null, h('h4', null, '⛓️ Na prisão'), h('div.kv', null, 'Pena restante', h('b', null, `${L.crime.pena} ano(s)`))));
      return;
    }
    if (L.job) {
      const j = L.job;
      const c = CAREERS.find((x) => x.id === j.id);
      tabBody.appendChild(h('div.card.hl', null,
        h('h4', null, `${c?.icon ?? '💼'} ${j.title}`),
        h('div.kv', null, 'Salário anual', h('b', null, money(j.salary))),
        h('div.kv', null, 'Anos no cargo', h('b', null, String(j.years))),
        h('div.kv', null, 'Desempenho', h('b', null, `${j.perf}%`)),
        h('div.bond', null, h('i', { style: { width: j.perf + '%', backgroundPosition: `-${(100 - j.perf) * 2}px 0` } })),
        h('div.row.wrap', { style: { marginTop: '12px' } },
          h('button.btn.small.primary', { disabled: busy, onclick: () => doOutcome(() => workHard(L)) }, '💪 Trabalhar duro'),
          h('button.btn.small', { disabled: busy, onclick: () => doOutcome(() => askPromotion(L)) }, '📈 Pedir promoção'),
          h('button.btn.small.danger', { disabled: busy, onclick: async () => { if (await confirmBox('Pedir demissão', 'Tem certeza que quer largar o emprego?', 'Pedir demissão')) doOutcome(() => quitJob(L)); } }, '🚪 Demitir-se'),
        ),
      ));
      return;
    }
    if (L.retired) { tabBody.appendChild(h('div.card', null, h('h4', null, '🏖️ Aposentado(a)'), h('div.kv', null, 'Aposentadoria anual', h('b', null, money((L.flags.aposentadoria as number) ?? 15000))))); return; }
    if (p.age < 16) { tabBody.appendChild(h('div.empty', null, 'Vagas de emprego a partir dos 16 anos.')); return; }
    tabBody.appendChild(h('div.sec-title', null, 'Vagas disponíveis'));
    const offers = jobOffers(L);
    if (!offers.length) tabBody.appendChild(h('div.empty', null, 'Nenhuma vaga compatível agora. Estude mais!'));
    for (const c of offers) {
      tabBody.appendChild(h('div.job', null,
        h('span.em', null, c.icon),
        h('div', null, h('b', null, c.title), h('small', null, `${money(c.salary)}/ano · ${c.edu === 'faculdade' ? 'exige faculdade' + (c.curso ? ' (' + c.curso + ')' : '') : c.edu === 'medio' ? 'exige ensino médio' : 'sem requisitos'}`)),
        h('button.btn.small.primary', { disabled: busy, onclick: () => lock(async () => { await presentEvent(startInterview(L, c)); }) }, 'Candidatar'),
      ));
    }
  }

  function renderProfile() {
    const p = L.player;
    tabBody.appendChild(h('div.card.hl', null,
      h('div.p-head', null, portraitImg(p.ap, p.age, 84, 'feliz', '#ff7a59'),
        h('div', null, h('div', { style: { fontFamily: 'var(--display)', fontSize: '22px', fontWeight: '800' } }, fullName(p)), h('div.muted', { style: { fontWeight: '700' } }, `${p.age} anos · ${L.city}`), h('div.muted', { style: { fontWeight: '700' } }, `Geração ${L.generation}`))),
      h('div.kv', null, 'Dinheiro', h('b', null, money(L.money))),
      h('div.kv', null, 'Carma', h('b', null, L.karma >= 60 ? 'Anjo 😇' : L.karma >= 40 ? 'Neutro 🙂' : 'Encrenqueiro 😈')),
      h('div.kv', null, 'Forma física', h('b', null, `${L.fitness}%`)),
      h('div.kv', null, 'Ficha criminal', h('b', null, L.crime.ficha ? `${L.crime.ficha} ocorrência(s)` : 'Limpa')),
      h('div.kv', null, 'Carteira de motorista', h('b', null, L.licenca ? 'Sim' : 'Não')),
    ));
    tabBody.appendChild(h('div.sec-title', null, '🏠 Bens'));
    const assets = [];
    if (L.assets.casa) assets.push(h('div.job', null, h('span.em', null, '🏡'), h('div', null, h('b', null, L.assets.casa.nome), h('small', null, `Valor: ${money(L.assets.casa.valor)}`))));
    if (L.assets.carro) assets.push(h('div.job', null, h('span.em', null, '🚗'), h('div', null, h('b', null, L.assets.carro.nome), h('small', null, `Valor: ${money(L.assets.carro.valor)}`))));
    if (!assets.length) assets.push(h('div.empty', null, 'Nenhum bem ainda.'));
    assets.forEach((a) => tabBody.appendChild(a));
    tabBody.appendChild(h('div.sec-title', null, `🏅 Conquistas (${ACHIEVEMENTS.filter((a) => L.flags['ach_' + a.id]).length}/${ACHIEVEMENTS.length})`));
    tabBody.appendChild(h('div.achs', null, ...ACHIEVEMENTS.map((a) => {
      const got = L.flags['ach_' + a.id];
      return h('div.ach' + (got ? '.got' : ''), { title: a.desc + (got ? ` (aos ${got} anos)` : '') }, h('span.em', null, got ? a.icon : '🔒'), h('b', null, a.name), h('small', null, a.desc));
    })));
    tabBody.appendChild(h('div.sec-title', null, '💾 Jogo'));
    tabBody.appendChild(h('div.row.wrap', null,
      h('button.btn.small', { onclick: () => { saveLife(L); toast('Jogo salvo!', 'ok'); } }, icon('save'), 'Salvar'),
      h('button.btn.small', { onclick: () => downloadJSON(`vida-${p.first}-${p.age}anos.json`, L) }, icon('download'), 'Exportar vida'),
      h('button.btn.small', { onclick: () => downloadJSON(`personagem-${p.first}.json`, { tipo: 'viva-personagem', first: p.first, last: p.last, ap: p.ap }) }, icon('face'), 'Exportar personagem'),
      h('button.btn.small.danger', { onclick: async () => { if (await confirmBox('Nova vida', 'Abandonar esta vida e começar outra? (ela continua salva)', 'Nova vida')) { saveLife(L); app.go('editor'); } } }, icon('sparkles'), 'Nova vida'),
    ));
  }

  // ------------------------------------------------ cartões de evento
  function card(o: { icon: string; title: string; text: string; tone?: Tone; choices?: { label: string; icon?: string; ok?: boolean }[]; deltas?: HTMLElement | null; cta?: string }): Promise<number> {
    return new Promise((resolve) => {
      clear(evLayer);
      const choose = (i: number) => {
        c.classList.add('out');
        setPad(0);
        setTimeout(() => { c.remove(); resolve(i); }, 220);
      };
      const btns = o.choices?.length
        ? h('div.ev-choices', null, ...o.choices.map((ch, i) => h('button.choice', { disabled: ch.ok === false, onclick: () => choose(i), title: ch.ok === false ? 'Indisponível' : undefined }, h('span.em', null, ch.icon ?? '➜'), h('span', null, ch.label), h('span.kbd', null, String(i + 1)))))
        : h('div.row.end', null, h('button.btn.primary', { onclick: () => choose(-1) }, o.cta ?? 'Continuar', icon('next')));
      const c = h('div.ev-card.' + (o.tone ?? 'neutro'), null,
        h('div.ev-head', null, h('div.ev-icon', null, o.icon), h('div', null, h('div.ev-title', null, o.title), h('div.ev-age', null, `${L.player.first} · ${L.player.age} ${L.player.age === 1 ? 'ano' : 'anos'}`))),
        h('div.ev-text', null, o.text),
        o.deltas ?? null,
        btns,
      );
      evLayer.appendChild(c);
      // sobe a cena para que os personagens não fiquem atrás do cartão
      requestAnimationFrame(() => setPad(Math.min(c.offsetHeight + 24, stage.h * 0.55)));
      if (o.tone === 'especial') sfx.chime();
      else sfx.pop();
    });
  }
  let cardPad = 0;
  function setPad(v: number) {
    cardPad = v;
    stage.scene.padBottom = v;
  }

  function snap(): Snap {
    return { stats: { ...L.stats }, money: L.money };
  }
  function deltaChips(before: Snap): HTMLElement | null {
    const chips: HTMLElement[] = [];
    for (const k of STAT_KEYS) {
      const d = L.stats[k] - before.stats[k];
      if (d) chips.push(h('span.delta.' + (d > 0 ? 'up' : 'down'), { style: { animationDelay: chips.length * 0.07 + 's' } }, icon(STAT_ICON[k]), `${d > 0 ? '+' : ''}${d} ${STAT_LABEL[k]}`));
    }
    const dm = L.money - before.money;
    if (dm) chips.push(h('span.delta.' + (dm > 0 ? 'up' : 'down'), { style: { animationDelay: chips.length * 0.07 + 's' } }, icon('coin'), `${dm > 0 ? '+' : '-'}${money(Math.abs(dm))}`));
    return chips.length ? h('div.deltas', null, ...chips) : null;
  }

  function castFor(req: SceneReq): Cast {
    const others: CastMember[] = (req.others ?? []).map((p) => cast(p));
    return { player: playerCast(L), others, data: req.data };
  }

  function homeReq(): SceneReq {
    const kid = L.player.age < 18;
    const others = kid
      ? [...byRel(L, 'mae', 'pai'), ...byRel(L, 'irmao', 'irma').filter((s) => s.age < 25)]
      : [...(partner(L) ? [partner(L)!] : []), ...children(L).filter((k) => k.alive && k.age < 18)];
    const forced = L.flags.moodNext as string | undefined;
    delete L.flags.moodNext;
    return {
      id: 'casa',
      others: others.slice(0, 3),
      data: {
        mood: forced ?? (L.stats.saude < 25 ? 'ferido' : L.stats.felicidade > 70 ? 'feliz' : L.stats.felicidade < 30 ? 'triste' : 'neutro'),
        pets: L.pets.filter((p) => p.alive).map((p) => ({ kind: p.kind, color: p.color })),
      },
    };
  }

  async function playScene(req: SceneReq | undefined, waitEnd = true) {
    if (!req) return;
    if (req.id === 'casa' && !req.others) {
      const hr = homeReq();
      req = { ...hr, data: { ...hr.data, ...req.data } };
    }
    skipBtn.style.display = '';
    stage.setSkip(false);
    const pr = stage.play(req.id, castFor(req));
    if (waitEnd) await pr;
    else await Promise.race([pr, new Promise((r) => setTimeout(r, 2600))]);
    pr.then(() => { skipBtn.style.display = 'none'; stage.setSkip(false); });
  }

  /** Aplica reações (expressão, fala, emote, movimento) aos atores da cena atual sem recarregá-la. */
  function applyReact(r: Outcome['react']) {
    if (!r) return;
    const acts = stage.scene.actors;
    const pa = acts.find((a) => a.name === L.player.first);
    const npc = acts.find((a) => a !== pa && a.visible);
    const apply = (a: typeof pa, x: NonNullable<Outcome['react']>['npc']) => {
      if (!a || !x) return;
      if (x.expr) a.setExpr(x.expr as any, 3.5);
      if (x.say) a.say(x.say, Math.min(4.5, 1.6 + x.say.length * 0.045));
      if (x.emote) a.emoteOn(x.emote as any);
      if (x.motion) a.play(x.motion, { base: true });
    };
    apply(npc, r.npc);
    apply(pa, r.player);
  }

  async function presentOutcome(o: Outcome, before: Snap) {
    registrarResultado(L, o);
    await playScene(o.scene);
    applyReact(o.react);
    refresh(before);
    if (!o.skipCard) {
      if (o.tone === 'bom') sfx.success();
      else if (o.tone === 'ruim') sfx.fail();
      await card({ icon: o.icon ?? (o.tone === 'bom' ? '😊' : o.tone === 'ruim' ? '😣' : o.tone === 'especial' ? '🌟' : '📌'), title: o.title ?? (o.tone === 'bom' ? 'Deu certo!' : o.tone === 'ruim' ? 'Que pena...' : o.tone === 'especial' ? 'Momento especial!' : 'Resultado'), text: o.text, tone: o.tone, deltas: deltaChips(before) });
    }
    if (o.next) await presentOutcome(o.next, snap());
    if (o.followUp) await presentEvent(o.followUp);
  }

  async function presentEvent(pe: PendingEvent) {
    const before = snap();
    const title = eventTitle(pe.ev, L, pe.ctx);
    const text = pe.ev.text(L, pe.ctx);
    const setup = pe.ev.scene?.(L, pe.ctx);
    if (setup) await playScene(setup, false);
    let idx: number | null = null;
    if (pe.ev.choices?.length) {
      const ch = evChoices(L, pe);
      idx = await card({ icon: pe.ev.icon, title, text, choices: ch.map((c) => ({ label: c.c.label, icon: c.c.icon, ok: c.ok })) });
    } else {
      await card({ icon: pe.ev.icon, title, text, cta: 'Ver o que acontece' });
    }
    const out = outcomeFromEvent(L, pe, idx);
    await presentOutcome(out, before);
  }

  async function lock(fn: () => Promise<void>) {
    if (busy || L.dead) return;
    busy = true;
    refresh();
    try {
      await fn();
    } catch (e) {
      console.error(e);
      toast('Algo deu errado nesse evento.', 'bad');
    }
    busy = false;
    clear(evLayer);
    const got = checkAchievements(L);
    got.forEach((a, i) => setTimeout(() => { toast(`${a.icon} Conquista: ${a.name}!`, 'ok'); sfx.levelUp(); addLog(L, `Conquista desbloqueada: ${a.name}`, 'especial', a.icon); saveLife(L); renderTab(); }, 400 + i * 900));
    if (!L.dead) {
      saveLife(L);
      playScene(homeReq(), false);
    }
    refresh();
  }

  function doOutcome(fn: () => Outcome) {
    lock(async () => {
      const before = snap();
      const o = fn();
      await presentOutcome(o, before);
    });
  }

  function doAction(a: Action) {
    lock(async () => {
      const before = snap();
      const r = resolveAction(L, a);
      if (typeof r === 'string') { toast(r, 'bad'); return; }
      if (isPending(r)) await presentEvent(r);
      else await presentOutcome(r, before);
    });
  }

  function doAgeUp() {
    lock(async () => {
      const before = snap();
      sfx.levelUp();
      const res = ageUp(L);
      refresh(before);
      if (res.died) { await deathFlow(); return; }
      await playScene(res.scene, res.events.length > 0 ? false : true);
      const notes = res.notes.map((n) => `${n.icon} ${n.text}`).join('\n');
      await card({
        icon: '🎂', tone: res.milestone ? 'especial' : 'neutro',
        title: res.milestone ?? `Agora você tem ${L.player.age} ${L.player.age === 1 ? 'ano' : 'anos'}!`,
        text: notes || (L.crime.preso ? 'Mais um ano atrás das grades.' : 'Um novo ano começa. O que vai fazer dele?'),
        deltas: deltaChips(before), cta: res.events.length ? 'Continuar' : 'Vamos lá!',
      });
      for (const pe of res.events) await presentEvent(pe);
    }).then(() => avisarNovasAcoes());
  }

  async function deathFlow() {
    saveLife(L);
    await playScene({ id: 'morte', data: { idade: L.player.age } });
    sfx.sad();
    showObituary();
  }

  function showObituary() {
    const p = L.player;
    const kids = children(L);
    const sp = L.people.find((x) => x.rel === 'conjuge');
    const cont = kids.filter((k) => k.alive);
    const ov = h('div.obit', null, h('div.obit-card', null,
      portraitImg(p.ap, p.age, 120, 'dormindo', '#ffe3b0'),
      h('h2', null, fullName(p)),
      h('div.muted', { style: { fontWeight: '800' } }, `${p.age} anos · ${L.cause ?? 'causas naturais'}`),
      h('div.obit-grid', null,
        h('div', null, 'Patrimônio', h('b', null, money(L.money + (L.assets.casa?.valor ?? 0) + (L.assets.carro?.valor ?? 0)))),
        h('div', null, 'Carreira', h('b', null, L.jobHistory.at(-1) ?? 'Nenhuma')),
        h('div', null, 'Família', h('b', null, `${sp ? 'Casado(a) com ' + sp.first : 'Solteiro(a)'}`)),
        h('div', null, 'Filhos', h('b', null, String(kids.length))),
        h('div', null, 'Felicidade', h('b', null, `${L.stats.felicidade}%`)),
        h('div', null, 'Carma', h('b', null, L.karma >= 60 ? 'Anjo 😇' : L.karma >= 40 ? 'Neutro' : 'Encrenqueiro 😈')),
      ),
      h('p.muted', { style: { fontWeight: '700', lineHeight: '1.5' } }, epitaph()),
      (() => {
        const best = L.log.filter((e) => e.tone === 'especial').slice(-6);
        if (!best.length) return null;
        return h('div', { style: { textAlign: 'left', marginTop: '6px' } },
          h('div.sec-title', null, '✨ Momentos marcantes'),
          ...best.map((e) => h('div.entry.especial', null, h('span.em', null, e.icon ?? '⭐'), h('span', null, `${e.age} anos — ${e.text}`))),
        );
      })(),
      h('div.row.wrap', { style: { justifyContent: 'center', marginTop: '10px' } },
        cont.length ? h('button.btn.primary', { onclick: () => pickHeir(cont) }, '🌳 Continuar como filho(a)') : null,
        h('button.btn.purple', { onclick: () => app.go('editor') }, icon('sparkles'), 'Nova vida'),
        h('button.btn', { onclick: () => app.go('title') }, icon('home'), 'Menu'),
      ),
    ));
    left.appendChild(ov);
  }

  function epitaph() {
    const s = L.stats;
    if (L.karma > 70) return 'Uma alma generosa, que deixou o mundo um pouco melhor.';
    if (L.crime.ficha > 2) return 'Viveu perigosamente e nunca pediu desculpas.';
    if (s.felicidade > 75) return 'Sorriu mais do que chorou. Uma vida bem vivida.';
    if (L.money > 1e6) return 'Conquistou fortuna. Será que conquistou paz?';
    return 'Cada escolha contou uma história. Esta foi a sua.';
  }

  function pickHeir(kids: Person[]) {
    const body = h('div.presets', null, ...kids.map((k) => h('div.preset', { onclick: () => {
      close();
      const nl = continueAsChild(L, k);
      nl.id = newId();
      saveLife(nl);
      app.go('game', nl);
    } }, portraitImg(k.ap, k.age, 88), h('b', null, `${k.first} (${k.age})`))));
    const close = modal('Escolha o(a) herdeiro(a)', body, { wide: true });
  }

  // ------------------------------------------------ clique nos personagens
  host.addEventListener('pointerdown', (ev) => {
    const e = ev as PointerEvent;
    const r = host.getBoundingClientRect();
    const a = stage.scene.actorAt((e.clientX - r.left) * (host.clientWidth / r.width), (e.clientY - r.top) * (host.clientHeight / r.height));
    if (!a) return;
    sfx.unlock();
    const isPlayer = a.name === L.player.first;
    const hw = a.headWorld();
    if (isPlayer) {
      const opts: [string, string, () => void][] = [['rindo', 'rir', () => sfx.laugh()], ['surpreso', 'pular', () => sfx.boing()], ['envergonhado', 'feliz', () => sfx.pop()], ['alegre', 'acenar', () => sfx.pop()]];
      const [ex, mot, snd] = rng.pick(opts);
      snd();
      a.setExpr(ex as any, 1.6);
      if (!busy && !stage.busy && L.player.age >= 2) {
        const base = a.baseMotion;
        if (mot === 'pular') a.play('pular');
        else { a.play(mot, { base: false }); setTimeout(() => a.play(base, { fade: 0.3 }), 1600); }
      }
      stage.scene.fx.spawn('coracao', hw.x, hw.y - 40, 3, { size: 10, life: 1.6, w: 40 });
    } else {
      sfx.pop();
      a.setExpr('feliz', 1.5);
      a.emoteOn(rng.pick(['coracao', 'musica', 'estrela', 'exclamacao', 'interrogacao'] as const), 1.6);
      a.shake = 0.4;
    }
  });

  // ------------------------------------------------ atalhos de teclado
  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('.modal-ov')) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const cardBtn = evLayer.querySelector('.ev-card:not(.out) .btn.primary') as HTMLButtonElement | null;
    const choices = [...evLayer.querySelectorAll('.ev-card:not(.out) .choice')] as HTMLButtonElement[];
    if (e.key === 'Escape' && skipBtn.style.display !== 'none') { skipBtn.click(); e.preventDefault(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && cardBtn) { cardBtn.click(); e.preventDefault(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= choices.length && !choices[n - 1].disabled) { choices[n - 1].click(); e.preventDefault(); return; }
    if (e.key === ' ' && !ageBtn.disabled && !choices.length) { ageBtn.click(); e.preventDefault(); }
  };
  window.addEventListener('keydown', onKey);

  // ------------------------------------------------ início
  refresh();
  if (L.dead) {
    showObituary();
  } else if (L.log.length <= 1 && L.player.age === 0) {
    lock(async () => {
      await playScene({ id: 'nascimento', others: byRel(L, 'mae', 'pai') });
      await card({ icon: '👶', tone: 'especial', title: `Bem-vindo(a), ${L.player.first}!`, text: `Você nasceu em ${L.city}, filho(a) de ${byRel(L, 'mae')[0]?.first ?? '?'} e ${byRel(L, 'pai')[0]?.first ?? '?'}. Toque em "+1 ANO" para viver e explore as abas para fazer escolhas.`, cta: 'Começar!' });
    });
  } else {
    playScene(homeReq(), false);
    if (L.log.length <= 1) {
      lock(async () => {
        await card({ icon: '🌱', tone: 'especial', title: `Olá, ${L.player.first}!`, text: `Você tem ${L.player.age} anos e vive em ${L.city}. Procure um emprego na aba Carreira, conheça pessoas e faça escolhas. Toque em "+1 ANO" para avançar.`, cta: 'Começar!' });
      });
    }
  }

  return {
    el,
    destroy: () => {
      window.removeEventListener('keydown', onKey);
      stage.destroy();
    },
  };
}

void partner;
void byRel;
