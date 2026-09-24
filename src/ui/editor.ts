import { h, icon, clear, modal, toast, promptBox, confirmBox } from './dom';
import { Stage } from '../scenes/stage';
import { Scene, viewBaseScale } from '../scenes/scene';
import { Actor } from '../character/actor';
import {
  Appearance, Opt, defaultAppearance, randomAppearance, cloneAppearance, SKIN_TONES, HAIR_COLORS, EYE_COLORS, LIP_COLORS, CLOTH_COLORS, MAKEUP_COLORS,
  FACE_SHAPES, EYE_SHAPES, BROW_STYLES, NOSE_STYLES, MOUTH_STYLES, EAR_STYLES, HAIR_STYLES, FACIAL_HAIR, TOPS, PATTERNS, BOTTOMS, SHOES, GLASSES, HATS, EARRINGS, NECKLACES, TATTOOS, SCARS,
} from '../character/appearance';
import { renderThumb, View, portraitImg } from './portrait';
import { rng } from '../core/rng';
import { sfx } from '../core/audio';
import { App } from './app';
import { CIDADES, NOMES_F, NOMES_M, SOBRENOMES } from '../game/names';
import { listPresets, savePreset, deletePreset, downloadJSON, pickJSON, saveLife, Preset } from '../game/storage';
import { newLife, newId } from '../game/state';
import { GROUND } from '../render/bg';

type K = keyof Appearance;
type Ctrl =
  | { kind: 'tiles'; key: K; label: string; opts: Opt[]; view: View; outfitAge?: number }
  | { kind: 'slider'; key: K; label: string; left?: string; right?: string }
  | { kind: 'colors'; key: K; label: string; palette: string[]; none?: boolean }
  | { kind: 'seg'; key: K; label: string; opts: { id: string; name: string }[] }
  | { kind: 'custom'; render: () => HTMLElement };

type Focus = 'full' | 'head' | 'face' | 'eyes' | 'body' | 'legs' | 'feet';
interface Cat { id: string; name: string; icon: string; zoom: Focus; ctrls: () => Ctrl[] }

/** Parte do corpo a enquadrar ao editar cada parâmetro. */
function focusOf(key: string | undefined, fallback: Focus): Focus {
  if (!key) return fallback;
  if (/^(height|weight|muscle|legLength)$/.test(key)) return 'full';
  if (/^(shoulders|chest|hips|neckLength|neckWidth|top|topColor|topColor2|topPattern|necklace|tattoo)$/.test(key)) return 'body';
  if (/^(bottom|bottomColor)$/.test(key)) return 'legs';
  if (/^(shoes|shoesColor)$/.test(key)) return 'feet';
  if (/^(eye|iris|pupil|lashes|lids|brow)/.test(key)) return 'eyes';
  if (/^(nose|mouth|lip|facialHair|eyeshadow|lipstick|glasses|scar|freckles|moles|blush)/.test(key)) return 'face';
  if (/^(face|jaw|chin|cheeks|skin|undertone|ear|hair|hat|earrings|accColor)/.test(key)) return 'head';
  return fallback;
}

export function editorScreen(app: App, opts: { presets?: boolean; ap?: Appearance } = {}) {
  let ap: Appearance = opts.ap ? cloneAppearance(opts.ap) : randomAppearance(rng, rng.chance(0.5) ? 'f' : 'm');
  let first = rng.pick(ap.sex === 'f' ? NOMES_F : NOMES_M);
  let last = rng.pick(SOBRENOMES);
  let city = rng.pick(CIDADES.slice(0, 15));
  let startAge = 0;
  let previewAge = 26;
  let turn = 0.32;
  const undo: string[] = [];
  const redo: string[] = [];

  // ------------------------------------------------ palco
  const host = h('div.stage-host');
  const stage = new Stage(host);
  const sc = new Scene('estudio');
  stage.setScene(sc);
  const actor: Actor = sc.addActor(ap, previewAge, { x: 640, facing: 1, turn, y: GROUND });
  actor.speed = 0;
  let zoomMode: Cat['zoom'] = 'full';
  sc.cam.speed = 5;
  sc.onBeat = () => {
    const hw = actor.headWorld();
    const H = stage.h, W = stage.w;
    const base = viewBaseScale(W, H, sc.minViewW);
    // px ocupados pelos controles sobrepostos (medidos do DOM)
    const uiBottom = (stageBox.querySelector('.ed-stage-ui') as HTMLElement | null)?.offsetHeight ?? 118;
    const uiTop = ((stageBox.querySelector('.ed-stage-top') as HTMLElement | null)?.offsetHeight ?? 56) + 4;
    const avail = H - uiBottom - uiTop;
    const shift = (z: number) => (uiBottom - uiTop) / 2 / (base * z);
    const d = actor.d;
    const legLen = d.thigh + d.shin + d.ankle;
    // enquadramento por parte do corpo: [centro x, centro y, altura de mundo a caber]
    const F: Record<Focus, [number, number, number]> = {
      full: [640, GROUND - d.total * 0.5, d.total * 1.1],
      head: [hw.x, hw.y + d.headH * 0.2, d.headH * 1.55],
      face: [hw.x + 4, hw.y + d.headH * 0.06, d.headH * 1.05],
      eyes: [hw.x + 4, hw.y + d.headH * 0.02, d.headH * 0.62],
      body: [640, GROUND - legLen - d.torso * 0.45, d.torso * 1.9 + d.neckLen],
      legs: [640, GROUND - legLen * 0.52, legLen * 1.25],
      feet: [640, GROUND - d.shin * 0.3, d.shin * 0.95],
    };
    const [fx, fy, span] = F[zoomMode];
    const z = Math.max(0.7, Math.min(9, (avail * 0.88) / (span * base)));
    sc.focus(fx, fy + shift(z), z);
  };

  const applyAp = (push = true) => {
    if (push) {
      undo.push(JSON.stringify(actor.ap));
      if (undo.length > 80) undo.shift();
      redo.length = 0;
    }
    actor.setAppearance(cloneAppearance(ap), previewAge);
    scheduleThumbs();
    updateFoot();
  };
  const set = (k: K, v: any) => {
    (ap as any)[k] = v;
    applyAp();
  };

  // ------------------------------------------------ categorias
  const face = (): Ctrl[] => [];
  void face;
  const CATS: Cat[] = [
    {
      id: 'id', name: 'Identidade', icon: 'id', zoom: 'full', ctrls: () => [
        { kind: 'seg', key: 'sex', label: 'Apresentação corporal', opts: [{ id: 'f', name: 'Feminina' }, { id: 'm', name: 'Masculina' }] },
        { kind: 'custom', render: identityFields },
      ],
    },
    {
      id: 'corpo', name: 'Corpo', icon: 'body', zoom: 'full', ctrls: () => [
        { kind: 'slider', key: 'height', label: 'Altura', left: 'Baixa', right: 'Alta' },
        { kind: 'slider', key: 'weight', label: 'Porte', left: 'Magro', right: 'Robusto' },
        { kind: 'slider', key: 'muscle', label: 'Musculatura' },
        { kind: 'slider', key: 'shoulders', label: 'Ombros' },
        { kind: 'slider', key: 'hips', label: 'Quadril' },
        { kind: 'slider', key: 'chest', label: 'Busto / peitoral' },
        { kind: 'slider', key: 'legLength', label: 'Proporção das pernas' },
        { kind: 'slider', key: 'neckLength', label: 'Comprimento do pescoço' },
        { kind: 'slider', key: 'neckWidth', label: 'Largura do pescoço' },
      ],
    },
    {
      id: 'rosto', name: 'Rosto', icon: 'face', zoom: 'head', ctrls: () => [
        { kind: 'tiles', key: 'faceShape', label: 'Formato do rosto', opts: FACE_SHAPES, view: 'head' },
        { kind: 'slider', key: 'faceWidth', label: 'Largura' },
        { kind: 'slider', key: 'faceHeight', label: 'Altura' },
        { kind: 'slider', key: 'jaw', label: 'Mandíbula' },
        { kind: 'slider', key: 'chin', label: 'Queixo' },
        { kind: 'slider', key: 'cheeks', label: 'Bochechas' },
      ],
    },
    {
      id: 'pele', name: 'Pele', icon: 'skin', zoom: 'head', ctrls: () => [
        { kind: 'colors', key: 'skin', label: 'Tom de pele', palette: SKIN_TONES },
        { kind: 'seg', key: 'undertone', label: 'Subtom', opts: [{ id: 'quente', name: 'Quente' }, { id: 'neutro', name: 'Neutro' }, { id: 'frio', name: 'Frio' }] },
        { kind: 'slider', key: 'freckles', label: 'Sardas' },
        { kind: 'slider', key: 'moles', label: 'Pintas' },
        { kind: 'slider', key: 'blush', label: 'Rubor facial' },
        { kind: 'tiles', key: 'scar', label: 'Cicatriz', opts: SCARS, view: 'face' },
        { kind: 'tiles', key: 'tattoo', label: 'Tatuagem (braço)', opts: TATTOOS, view: 'body', outfitAge: 26 },
      ],
    },
    {
      id: 'olhos', name: 'Olhos', icon: 'eye', zoom: 'eyes', ctrls: () => [
        { kind: 'tiles', key: 'eyeShape', label: 'Formato', opts: EYE_SHAPES, view: 'eyes' },
        { kind: 'colors', key: 'iris', label: 'Cor da íris', palette: EYE_COLORS },
        { kind: 'slider', key: 'eyeSize', label: 'Tamanho' },
        { kind: 'slider', key: 'eyeSpacing', label: 'Espaçamento' },
        { kind: 'slider', key: 'eyeHeight', label: 'Altura' },
        { kind: 'slider', key: 'eyeTilt', label: 'Inclinação' },
        { kind: 'slider', key: 'pupil', label: 'Pupila' },
        { kind: 'slider', key: 'lashes', label: 'Cílios' },
        { kind: 'slider', key: 'lids', label: 'Pálpebras' },
      ],
    },
    {
      id: 'sobrancelhas', name: 'Sobrancelha', icon: 'brow', zoom: 'eyes', ctrls: () => [
        { kind: 'tiles', key: 'browStyle', label: 'Modelo', opts: BROW_STYLES, view: 'eyes' },
        { kind: 'colors', key: 'browColor', label: 'Cor', palette: HAIR_COLORS },
        { kind: 'slider', key: 'browThickness', label: 'Espessura' },
        { kind: 'slider', key: 'browLength', label: 'Comprimento' },
        { kind: 'slider', key: 'browCurve', label: 'Curvatura' },
        { kind: 'slider', key: 'browHeight', label: 'Posição' },
      ],
    },
    {
      id: 'nariz', name: 'Nariz', icon: 'nose', zoom: 'face', ctrls: () => [
        { kind: 'tiles', key: 'noseStyle', label: 'Modelo', opts: NOSE_STYLES, view: 'face' },
        { kind: 'slider', key: 'noseSize', label: 'Tamanho' },
        { kind: 'slider', key: 'noseWidth', label: 'Largura' },
        { kind: 'slider', key: 'noseHeight', label: 'Posição' },
      ],
    },
    {
      id: 'boca', name: 'Boca', icon: 'mouth', zoom: 'face', ctrls: () => [
        { kind: 'tiles', key: 'mouthStyle', label: 'Modelo', opts: MOUTH_STYLES, view: 'face' },
        { kind: 'colors', key: 'lipColor', label: 'Cor dos lábios', palette: LIP_COLORS },
        { kind: 'slider', key: 'mouthWidth', label: 'Largura' },
        { kind: 'slider', key: 'lipFullness', label: 'Volume dos lábios' },
        { kind: 'slider', key: 'mouthHeight', label: 'Posição' },
      ],
    },
    {
      id: 'orelhas', name: 'Orelhas', icon: 'ear', zoom: 'head', ctrls: () => [
        { kind: 'tiles', key: 'earStyle', label: 'Modelo', opts: EAR_STYLES, view: 'head' },
        { kind: 'slider', key: 'earSize', label: 'Tamanho' },
      ],
    },
    {
      id: 'cabelo', name: 'Cabelo', icon: 'hair', zoom: 'head', ctrls: () => [
        { kind: 'tiles', key: 'hairStyle', label: 'Penteado', opts: HAIR_STYLES, view: 'head' },
        { kind: 'colors', key: 'hairColor', label: 'Cor', palette: HAIR_COLORS },
        { kind: 'colors', key: 'hairHighlight', label: 'Mechas', palette: HAIR_COLORS, none: true },
        { kind: 'slider', key: 'hairVolume', label: 'Volume' },
      ],
    },
    {
      id: 'barba', name: 'Pelos faciais', icon: 'beard', zoom: 'face', ctrls: () => [
        { kind: 'tiles', key: 'facialHair', label: 'Estilo', opts: FACIAL_HAIR, view: 'face' },
        { kind: 'colors', key: 'facialHairColor', label: 'Cor', palette: HAIR_COLORS },
      ],
    },
    {
      id: 'maquiagem', name: 'Maquiagem', icon: 'makeup', zoom: 'face', ctrls: () => [
        { kind: 'colors', key: 'eyeshadow', label: 'Sombra', palette: MAKEUP_COLORS, none: true },
        { kind: 'slider', key: 'lipstick', label: 'Batom (intensidade)' },
        { kind: 'colors', key: 'lipColor', label: 'Cor do batom', palette: ['#c2273d', '#b5446e', '#d9546b', '#8e2c48', '#e0707e', '#f39a8c', '#6d2334', '#9b5de5'] },
      ],
    },
    {
      id: 'roupas', name: 'Roupas', icon: 'shirt', zoom: 'body', ctrls: () => [
        { kind: 'tiles', key: 'top', label: 'Parte de cima', opts: TOPS, view: 'body' },
        { kind: 'colors', key: 'topColor', label: 'Cor principal', palette: CLOTH_COLORS },
        { kind: 'tiles', key: 'topPattern', label: 'Estampa', opts: PATTERNS, view: 'body' },
        { kind: 'colors', key: 'topColor2', label: 'Cor secundária / detalhes', palette: CLOTH_COLORS },
        { kind: 'tiles', key: 'bottom', label: 'Parte de baixo', opts: BOTTOMS, view: 'legs' },
        { kind: 'colors', key: 'bottomColor', label: 'Cor', palette: CLOTH_COLORS },
        { kind: 'tiles', key: 'shoes', label: 'Calçados', opts: SHOES, view: 'feet' },
        { kind: 'colors', key: 'shoesColor', label: 'Cor dos calçados', palette: CLOTH_COLORS },
      ],
    },
    {
      id: 'acessorios', name: 'Acessórios', icon: 'glasses', zoom: 'head', ctrls: () => [
        { kind: 'tiles', key: 'glasses', label: 'Óculos', opts: GLASSES, view: 'face' },
        { kind: 'colors', key: 'glassesColor', label: 'Cor da armação', palette: ['#23242b', '#7a5236', '#c2273d', '#8a8f98', '#1f3f7a', '#f2c14e', '#e86a92', '#f4f1ea'] },
        { kind: 'tiles', key: 'hat', label: 'Chapéu', opts: HATS, view: 'head' },
        { kind: 'colors', key: 'hatColor', label: 'Cor do chapéu', palette: CLOTH_COLORS },
        { kind: 'tiles', key: 'earrings', label: 'Brincos', opts: EARRINGS, view: 'head' },
        { kind: 'tiles', key: 'necklace', label: 'Colar', opts: NECKLACES, view: 'head' },
        { kind: 'colors', key: 'accColor', label: 'Metal', palette: ['#f2c14e', '#c9c9cc', '#e8b4a0', '#23242b'] },
      ],
    },
  ];
  let cat = CATS[0];

  // ------------------------------------------------ painel
  const panel = h('div.ed-panel');
  const thumbJobs: (() => void)[] = [];
  let thumbRaf = 0;
  const scheduleThumbs = () => {
    cancelAnimationFrame(thumbRaf);
    thumbRaf = requestAnimationFrame(() => {
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < thumbJobs.length && performance.now() - t0 < 12) thumbJobs[i++]();
        if (i < thumbJobs.length) thumbRaf = requestAnimationFrame(step);
      };
      step();
    });
  };

  function identityFields(): HTMLElement {
    const nameIn = h('input.input', { value: first, maxlength: 20, oninput: (e: Event) => { first = (e.target as HTMLInputElement).value; updateFoot(); } });
    const lastIn = h('input.input', { value: last, maxlength: 24, oninput: (e: Event) => { last = (e.target as HTMLInputElement).value; } });
    const citySel = h('select.input', { onchange: (e: Event) => (city = (e.target as HTMLSelectElement).value) }, ...CIDADES.map((c) => h('option', { value: c, selected: c === city }, c)));
    const seg = h('div.seg', null,
      ...[[0, 'Nascer (bebê)'], [18, 'Aos 18 anos']].map(([v, n]) => h('button' + (startAge === v ? '.on' : ''), { onclick: (e: Event) => { startAge = v as number; seg.querySelectorAll('button').forEach((b) => b.classList.remove('on')); (e.currentTarget as HTMLElement).classList.add('on'); } }, n as string)),
    );
    return h('div', null,
      h('div.ctrl', null, h('label.field', null, h('span', null, 'Nome'), nameIn)),
      h('div.ctrl', null, h('label.field', null, h('span', null, 'Sobrenome'), lastIn)),
      h('div.ctrl', null, h('label.field', null, h('span', null, 'Cidade natal'), citySel)),
      h('div.ctrl', null, h('label', null, 'Começar a vida'), seg),
      h('button.btn.small', { onclick: () => { first = rng.pick(ap.sex === 'f' ? NOMES_F : NOMES_M); last = rng.pick(SOBRENOMES); renderPanel(); updateFoot(); } }, icon('dice'), 'Sortear nome'),
    );
  }

  function renderPanel() {
    clear(panel);
    thumbJobs.length = 0;
    const ctrls = cat.ctrls();
    const idx = CATS.indexOf(cat);
    panel.appendChild(h('div.panel-head', null,
      h('h3', null, cat.name),
      h('span.count', null, `${idx + 1}/${CATS.length} · ${ctrls.filter((c) => c.kind !== 'custom').length || 5} ajustes`),
    ));
    // índice rápido: todos os ajustes da categoria visíveis de uma vez
    const labeled = ctrls.filter((c): c is Exclude<Ctrl, { kind: 'custom' }> => c.kind !== 'custom');
    const els: HTMLElement[] = [];
    if (labeled.length > 2) {
      panel.appendChild(h('div.ctrl-index', null, ...labeled.map((c, i) => h('button.chip.mini', {
        onclick: () => {
          const el = els[i];
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          zoomMode = focusOf(c.key as string, cat.zoom);
          el?.classList.add('flash');
          setTimeout(() => el?.classList.remove('flash'), 900);
        },
      }, c.label))));
    }
    for (const c of ctrls) {
      const el = renderCtrl(c);
      if (c.kind !== 'custom') {
        els.push(el);
        el.addEventListener('pointerdown', () => {
          const f = focusOf(c.key as string, cat.zoom);
          if (f !== zoomMode) { zoomMode = f; }
          panel.querySelectorAll('.ctrl.active').forEach((x) => x.classList.remove('active'));
          el.classList.add('active');
        });
      }
      panel.appendChild(el);
    }
    // navegação entre categorias
    const prev = CATS[idx - 1], next = CATS[idx + 1];
    panel.appendChild(h('div.cat-nav', null,
      prev ? h('button.btn.small', { onclick: () => selectCat(prev) }, icon('back'), prev.name) : h('span'),
      next ? h('button.btn.small.purple', { onclick: () => selectCat(next) }, next.name, icon('next')) : h('span'),
    ));
    panel.scrollTop = 0;
    scheduleThumbs();
  }

  function selectCat(c: Cat) {
    cat = c;
    cats.querySelectorAll('.ed-cat').forEach((x, i) => x.classList.toggle('on', CATS[i] === c));
    (cats.children[CATS.indexOf(c)] as HTMLElement)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    zoomMode = c.zoom;
    renderPanel();
    sfx.swoosh();
  }

  function renderCtrl(c: Ctrl): HTMLElement {
    if (c.kind === 'custom') return c.render();
    const wrap = h('div.ctrl');
    if (c.kind === 'slider') {
      const val = Math.round(((ap[c.key] as number) ?? 0.5) * 100);
      const out = h('span', null, String(val));
      const inp = h('input', { type: 'range', min: 0, max: 100, value: val }) as HTMLInputElement;
      inp.style.setProperty('--p', val + '%');
      let pushed = false;
      inp.addEventListener('input', () => {
        const v = Number(inp.value);
        inp.style.setProperty('--p', v + '%');
        out.textContent = String(v);
        if (!pushed) { undo.push(JSON.stringify(actor.ap)); redo.length = 0; pushed = true; }
        (ap as any)[c.key] = v / 100;
        applyAp(false);
      });
      inp.addEventListener('change', () => { pushed = false; sfx.tick(); });
      wrap.append(h('label', null, h('span', null, c.label), out), inp);
      if (c.left) wrap.append(h('div.row', { style: { justifyContent: 'space-between', fontSize: '11px', color: 'var(--dim)', fontWeight: '800' } }, h('span', null, c.left), h('span', null, c.right)));
      return wrap;
    }
    if (c.kind === 'seg') {
      const seg = h('div.seg', null, ...c.opts.map((o) => h('button' + (ap[c.key] === o.id ? '.on' : ''), { onclick: () => {
        if (c.key === 'sex' && ap.sex !== o.id) {
          ap.sex = o.id as any;
          ap.chest = o.id === 'f' ? 0.5 : 0.2;
          if (o.id === 'f') ap.facialHair = 'nenhum';
          first = rng.pick(o.id === 'f' ? NOMES_F : NOMES_M);
        }
        set(c.key, o.id);
        renderPanel();
      } }, o.name)));
      wrap.append(h('label', null, c.label), seg);
      return wrap;
    }
    if (c.kind === 'colors') {
      const sw = h('div.swatches');
      const cur = String(ap[c.key] ?? '');
      if (c.none) sw.appendChild(h('button.sw.none' + (cur === '' ? '.on' : ''), { title: 'Nenhum', onclick: () => { set(c.key, ''); renderPanel(); } }));
      for (const col of c.palette) sw.appendChild(h('button.sw' + (cur.toLowerCase() === col.toLowerCase() ? '.on' : ''), { style: { background: col }, title: col, onclick: () => { set(c.key, col); renderPanel(); } }));
      const custom = h('input', { type: 'color', value: cur && cur.startsWith('#') && cur.length === 7 ? cur : '#888888' }) as HTMLInputElement;
      custom.addEventListener('input', () => { (ap as any)[c.key] = custom.value; applyAp(false); });
      custom.addEventListener('change', () => { set(c.key, custom.value); renderPanel(); });
      sw.appendChild(h('label.sw.custom', { title: 'Cor personalizada' }, custom));
      wrap.append(h('label', null, c.label), sw);
      return wrap;
    }
    // tiles
    const grid = h('div.tiles');
    for (const o of c.opts) {
      const cv = h('canvas') as HTMLCanvasElement;
      const tile = h('button.tile' + (ap[c.key] === o.id ? '.on' : ''), { onclick: () => {
        set(c.key, o.id);
        grid.querySelectorAll('.tile').forEach((t) => t.classList.remove('on'));
        tile.classList.add('on');
        if (c.key === 'hat' || c.key === 'top') actor.play('feliz', { fade: 0.2 });
        sfx.pop();
      } }, cv, h('span', null, o.name));
      grid.appendChild(tile);
      thumbJobs.push(() => {
        const test = { ...ap, [c.key]: o.id } as Appearance;
        renderThumb(cv, test, previewAge < 13 && c.key !== 'tattoo' ? previewAge : 26, c.view, 76, {
          expr: 'feliz',
          turn: c.view === 'eyes' || c.view === 'face' ? 0.15 : 0.3,
          outfit: c.key === 'tattoo' ? { top: 'regata' } : undefined,
        });
      });
    }
    wrap.append(h('label', null, c.label), grid);
    return wrap;
  }

  // ------------------------------------------------ categorias (coluna)
  const cats = h('div.ed-cats', null, ...CATS.map((c) => {
    const b = h('button.ed-cat' + (c === cat ? '.on' : ''), { onclick: () => selectCat(c) }, icon(c.icon), c.name);
    return b;
  }));

  // ------------------------------------------------ controles do palco
  const AGES: [number, string][] = [[1, 'Bebê'], [8, 'Criança'], [15, 'Adolescente'], [26, 'Adulto'], [45, 'Meia-idade'], [74, 'Idoso']];
  const ageChips = h('div.chips', null, ...AGES.map(([a, n]) => {
    const b = h('button.chip' + (a === previewAge ? '.on' : ''), { onclick: () => {
      previewAge = a;
      ageChips.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      actor.setAppearance(cloneAppearance(ap), previewAge);
      actor.play(a < 3 ? 'sentarChao' : 'feliz', { fade: 0.2 });
      scheduleThumbs();
    } }, n);
    return b;
  }));
  const POSES: [string, string, string?][] = [['parado', '🧍 Parado'], ['acenar', '👋 Acenar'], ['dancar', '💃 Dançar'], ['rir', '😂 Rir'], ['chorar', '😢 Chorar'], ['furia', '😡 Bravo'], ['pular', '🦘 Pular'], ['apaixonado', '😍 Amor', 'expr'], ['surpreso', '😲 Susto', 'expr']];
  const poseChips = h('div.chips.poses', null, ...POSES.map(([m, n, kind]) => h('button.chip', { onclick: () => {
    if (kind === 'expr') { actor.setExpr(m as any, 2.2); actor.play('feliz'); return; }
    actor.setExpr('neutro');
    actor.play(m);
  } }, n)));
  const turnIn = h('input', { type: 'range', min: 0, max: 100, value: Math.round(turn * 100) }) as HTMLInputElement;
  turnIn.style.setProperty('--p', turnIn.value + '%');
  turnIn.addEventListener('input', () => { turn = Number(turnIn.value) / 100; actor.turn = turn; turnIn.style.setProperty('--p', turnIn.value + '%'); });
  const flipBtn = h('button.chip', { onclick: () => (actor.facing = actor.facing === 1 ? -1 : 1) }, '↔ Espelhar');

  // ------------------------------------------------ rodapé
  const nameLbl = h('b');
  const foot = h('div.ed-foot', null,
    h('div.row', null, nameLbl),
    h('button.btn.primary.big', { onclick: start }, icon('play'), 'Começar vida'),
  );
  function updateFoot() {
    nameLbl.textContent = `${first || 'Sem nome'} ${last}`;
  }
  updateFoot();

  /** Pergunta com que idade a vida começa (presets + idade livre). */
  function escolherIdade(): Promise<number | null> {
    return new Promise((resolve) => {
      let feito = false;
      const PRESETS: [number, string, string][] = [
        [0, '👶 Nascer', 'Desde o berço: família, escola, tudo.'],
        [6, '🎒 Criança', 'Primeiro ano da escola.'],
        [14, '🧑‍🎤 Adolescente', 'Ensino médio, crushes e espinhas.'],
        [18, '🎓 Maioridade', 'Mundo adulto: sem escola, sem mesada.'],
        [25, '💼 Jovem adulto', 'Hora de arrumar emprego.'],
        [40, '🧔 Meia-idade', 'A crise dos 40 já vem incluída.'],
        [65, '👵 Terceira idade', 'Netos, INSS e hidroginástica.'],
      ];
      const livre = h('input.input', { type: 'number', min: 0, max: 90, value: String(startAge), style: { width: '90px' } }) as HTMLInputElement;
      const ok = (idade: number) => { feito = true; close(); resolve(Math.max(0, Math.min(90, Math.round(idade)))); };
      const body = h('div', null,
        h('p', null, 'Com que idade você quer começar esta vida?'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', margin: '10px 0' } },
          ...PRESETS.map(([idade, rot, desc]) => h('button.btn' + (idade === startAge ? '.primary' : '.ghost'), { style: { flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', height: 'auto', padding: '10px 12px' }, onclick: () => ok(idade) },
            h('b', null, `${rot} · ${idade} anos`), h('small', { style: { opacity: '0.8', fontWeight: '600' } }, desc)))),
        h('div.row', { style: { gap: '8px', alignItems: 'center' } }, h('span', null, 'Outra idade:'), livre, h('button.btn.primary', { onclick: () => ok(Number(livre.value) || 0) }, 'Começar')),
      );
      const close = modal('Começar nova vida', body, { onClose: () => { if (!feito) resolve(null); } });
    });
  }

  async function start() {
    if (!first.trim()) { toast('Dê um nome ao personagem!', 'bad'); cat = CATS[0]; renderPanel(); return; }
    const idade = await escolherIdade();
    if (idade === null) return;
    startAge = idade;
    sfx.success();
    const L = newLife(ap, first.trim(), last.trim() || 'Silva', city, startAge);
    saveLife(L);
    app.go('game', L);
  }

  // ------------------------------------------------ topo
  const doUndo = () => {
    const s = undo.pop();
    if (!s) return;
    redo.push(JSON.stringify(ap));
    ap = JSON.parse(s);
    applyAp(false);
    renderPanel();
  };
  const doRedo = () => {
    const s = redo.pop();
    if (!s) return;
    undo.push(JSON.stringify(ap));
    ap = JSON.parse(s);
    applyAp(false);
    renderPanel();
  };
  const randomize = () => {
    undo.push(JSON.stringify(ap));
    ap = randomAppearance(rng, rng.chance(0.5) ? 'f' : 'm');
    first = rng.pick(ap.sex === 'f' ? NOMES_F : NOMES_M);
    applyAp(false);
    renderPanel();
    actor.play('pular');
    sfx.magic();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
  };
  window.addEventListener('keydown', onKey);

  const savePresetFlow = async () => {
    const name = await promptBox('Salvar personagem', 'Nome do personagem', `${first} ${last}`.trim());
    if (!name) return;
    const p: Preset = { id: newId(), name, ap: cloneAppearance(ap), first, last, created: Date.now() };
    if (savePreset(p)) toast('Personagem salvo!', 'ok');
    else toast('Não foi possível salvar (armazenamento cheio?).', 'bad');
  };
  const loadPresetFlow = () => {
    const grid = h('div.presets');
    const render = () => {
      clear(grid);
      const list = listPresets();
      if (!list.length) grid.appendChild(h('div.empty', { style: { gridColumn: '1/-1' } }, 'Nenhum personagem salvo ainda.'));
      for (const p of list) {
        grid.appendChild(h('div.preset', { onclick: () => {
          undo.push(JSON.stringify(ap));
          ap = cloneAppearance(p.ap);
          first = p.first; last = p.last;
          applyAp(false);
          renderPanel();
          close();
          toast(`${p.name} carregado!`, 'ok');
        } },
          portraitImg(p.ap, 26, 88),
          h('b', null, p.name),
          h('button.icon-btn.del', { title: 'Excluir', onclick: async (e: Event) => { e.stopPropagation(); if (await confirmBox('Excluir', `Excluir ${p.name}?`, 'Excluir')) { deletePreset(p.id); render(); } } }, icon('trash')),
        ));
      }
    };
    render();
    const body = h('div', null, grid, h('div.row.end', { style: { marginTop: '14px' } },
      h('button.btn.small', { onclick: () => downloadJSON(`personagem-${first || 'viva'}.json`, { tipo: 'viva-personagem', first, last, ap }) }, icon('download'), 'Exportar atual'),
      h('button.btn.small', { onclick: async () => {
        const d = await pickJSON();
        if (d && d.ap && d.ap.skin) { undo.push(JSON.stringify(ap)); ap = { ...defaultAppearance(d.ap.sex), ...d.ap }; first = d.first ?? first; last = d.last ?? last; applyAp(false); renderPanel(); close(); toast('Personagem importado!', 'ok'); }
        else if (d) toast('Arquivo inválido.', 'bad');
      } }, icon('upload'), 'Importar arquivo'),
    ));
    const close = modal('Meus personagens', body, { wide: true });
  };

  const top = h('div.ed-top', null,
    h('button.icon-btn', { title: 'Voltar', onclick: () => app.go('title') }, icon('back')),
    h('h2', null, 'Crie seu personagem'),
    h('div.grow'),
    h('button.btn.small', { onclick: randomize }, icon('dice'), h('span.hide-sm', null, 'Aleatório')),
    h('button.icon-btn', { title: 'Desfazer (Ctrl+Z)', onclick: doUndo }, icon('undo')),
    h('button.icon-btn', { title: 'Refazer (Ctrl+Y)', onclick: doRedo }, icon('redo')),
    h('button.btn.small', { onclick: savePresetFlow }, icon('save'), h('span.hide-sm', null, 'Salvar')),
    h('button.btn.small', { onclick: loadPresetFlow }, icon('folder'), h('span.hide-sm', null, 'Carregar')),
  );

  const stageBox = h('div.ed-stage', null, host,
    h('div.ed-stage-top', null, ageChips),
    h('div.ed-stage-ui', null,
      poseChips,
      h('div.turn-row', null,
        h('button.chip.pose-toggle', { onclick: () => stageBox.classList.toggle('show-poses') }, '🎭 Poses'),
        h('span', null, 'GIRAR'), turnIn, flipBtn),
    ),
  );

  const el = h('div.screen.editor', null, top, h('div.ed-main', null, cats, stageBox, panel), foot);
  renderPanel();
  applyAp(false);
  if (opts.presets) setTimeout(loadPresetFlow, 300);
  actor.play('acenar');
  setTimeout(() => actor.play('feliz'), 2200);

  return {
    el,
    destroy: () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(thumbRaf);
      stage.destroy();
    },
  };
}
