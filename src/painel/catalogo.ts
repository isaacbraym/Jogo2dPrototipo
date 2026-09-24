/**
 * Catálogo unificado do painel. Fonte de verdade = registros reais do jogo (EVENTS, ACTIONS, INTERACTIONS,
 * AGGRO, INTERVIEWS, CAREERS, SITUATIONS, ENVS, MOTIONS, EXPRESSIONS, PROPS, HELD, listas de aparência).
 * Nenhuma lista de ids é mantida à mão aqui: tudo é lido dos objetos importados e do código-fonte.
 *
 * Vínculos têm três níveis de confiança:
 *   estrutural — lido diretamente de um campo do registro (motion.expr, INTERVIEWS[id].env, agg_<k> → AGGRO[k])
 *   estatico   — inferido do texto do código (regex / literal dentro do bloco do item). Pode ter falso positivo.
 *   observado  — registrado ao EXECUTAR a lógica/cena real no painel, com o contexto que o produziu.
 */
import { EVENTS } from '../game/events';
import { ACTIONS, INTERACTIONS } from '../game/activities';
import { CAREERS } from '../game/careers';
import { INTERVIEWS } from '../game/interviews';
import { AGGRO } from '../game/aggression';
import { ACHIEVEMENTS } from '../game/achievements';
import { SITUATIONS } from '../scenes/situations';
import { ENVS } from '../scenes/environments';
import { MOTIONS, KeyframeFn } from '../character/motions';
import { EXPRESSIONS } from '../character/expressions';
import { PROPS, HELD } from '../render/props';
import { sfx } from '../core/audio';
import * as AP from '../character/appearance';
import { KF_ORIGINAIS, EXPR_ORIGINAIS, ESTADO_CALIBRACAO } from '../character/calibracao';
import { FONTES, achar, R, blocos, linha, ocorrenciasLiterais, Local } from './fontes';
import { varrerReferencias, ARQUIVOS_VARRIDOS, Registro } from '../qa/referencias';

export type Tipo =
  | 'evento' | 'escolha' | 'acao' | 'interacao' | 'agressao' | 'entrevista' | 'cena' | 'acaoCorporal' | 'ambiente'
  | 'movimento' | 'expressao' | 'objeto' | 'objetoMao' | 'visual' | 'flag' | 'emote' | 'particula' | 'som' | 'conquista' | 'sistema';

export const TIPOS: { tipo: Tipo; rotulo: string; icone: string }[] = [
  { tipo: 'evento', rotulo: 'Eventos', icone: '📅' },
  { tipo: 'escolha', rotulo: 'Escolhas', icone: '🔀' },
  { tipo: 'acao', rotulo: 'Ações', icone: '🏃' },
  { tipo: 'interacao', rotulo: 'Interações', icone: '🤝' },
  { tipo: 'agressao', rotulo: 'Agressões', icone: '👊' },
  { tipo: 'entrevista', rotulo: 'Entrevistas', icone: '💼' },
  { tipo: 'cena', rotulo: 'Cenas', icone: '🎬' },
  { tipo: 'acaoCorporal', rotulo: 'Ações corporais', icone: '🤼' },
  { tipo: 'ambiente', rotulo: 'Ambientes', icone: '🏙️' },
  { tipo: 'movimento', rotulo: 'Movimentos', icone: '🕺' },
  { tipo: 'expressao', rotulo: 'Expressões', icone: '😶' },
  { tipo: 'objeto', rotulo: 'Objetos de cena', icone: '🪑' },
  { tipo: 'objetoMao', rotulo: 'Objetos de mão', icone: '📱' },
  { tipo: 'visual', rotulo: 'Parâmetros visuais', icone: '🎨' },
  { tipo: 'flag', rotulo: 'Flags', icone: '🚩' },
  { tipo: 'conquista', rotulo: 'Conquistas', icone: '🏆' },
  { tipo: 'emote', rotulo: 'Emotes', icone: '💬' },
  { tipo: 'particula', rotulo: 'Partículas', icone: '✨' },
  { tipo: 'som', rotulo: 'Sons', icone: '🔊' },
  { tipo: 'sistema', rotulo: 'Sistemas', icone: '⚙️' },
];

export interface Item {
  tipo: Tipo;
  id: string;
  chave: string;
  nome: string;
  icone: string;
  descricao: string;
  local: Local | null;
  detalhes: [string, string][];
  dados?: any;
  busca: string;
}

export type Via = 'estrutural' | 'estatico' | 'observado';
export interface Vinculo { de: string; para: string; via: Via; detalhe: string; local?: Local | null; contexto?: string; quando?: string }

export const chave = (tipo: Tipo, id: string) => `${tipo}:${id}`;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const REG_PARA_TIPO: Record<Registro, Tipo> = {
  motion: 'movimento', expr: 'expressao', prop: 'objeto', held: 'objetoMao', fx: 'particula', emote: 'emote', sfx: 'som', scene: 'cena', env: 'ambiente',
};

/** Campo da aparência → lista de opções real exportada por character/appearance.ts. */
const OPCOES_VISUAIS: Record<string, AP.Opt[] | string[]> = {
  faceShape: AP.FACE_SHAPES, eyeShape: AP.EYE_SHAPES, browStyle: AP.BROW_STYLES, noseStyle: AP.NOSE_STYLES, mouthStyle: AP.MOUTH_STYLES,
  earStyle: AP.EAR_STYLES, hairStyle: AP.HAIR_STYLES, facialHair: AP.FACIAL_HAIR, top: AP.TOPS, topPattern: AP.PATTERNS, bottom: AP.BOTTOMS,
  shoes: AP.SHOES, glasses: AP.GLASSES, hat: AP.HATS, earrings: AP.EARRINGS, tattoo: AP.TATTOOS, scar: AP.SCARS, necklace: AP.NECKLACES,
  skin: AP.SKIN_TONES, hairColor: AP.HAIR_COLORS, facialHairColor: AP.HAIR_COLORS, browColor: AP.HAIR_COLORS, iris: AP.EYE_COLORS,
  lipColor: AP.LIP_COLORS, topColor: AP.CLOTH_COLORS, topColor2: AP.CLOTH_COLORS, bottomColor: AP.CLOTH_COLORS, shoesColor: AP.CLOTH_COLORS,
  glassesColor: AP.CLOTH_COLORS, hatColor: AP.CLOTH_COLORS, accColor: AP.CLOTH_COLORS, eyeshadow: AP.MAKEUP_COLORS,
};

export const unionOf = (arquivo: string, nome: string) => {
  const m = (FONTES[arquivo] ?? '').match(new RegExp(`export type ${nome}\\s*=([^;]+);`));
  return m ? [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]) : [];
};

export class Catalogo {
  itens = new Map<string, Item>();
  vinculos: Vinculo[] = [];
  private saidaIdx = new Map<string, Vinculo[]>();
  private entradaIdx = new Map<string, Vinculo[]>();
  lista: Item[] = [];

  constructor() {
    this.montar();
  }

  get(k: string) { return this.itens.get(k); }
  saida(k: string) { return this.saidaIdx.get(k) ?? []; }
  entrada(k: string) { return this.entradaIdx.get(k) ?? []; }
  doTipo(t: Tipo) { return this.lista.filter((i) => i.tipo === t); }

  add(i: Omit<Item, 'chave' | 'busca'>) {
    const k = chave(i.tipo, i.id);
    if (this.itens.has(k)) return this.itens.get(k)!;
    const it: Item = { ...i, chave: k, busca: semAcento([i.id, i.nome, i.descricao, i.tipo].join(' ')) };
    this.itens.set(k, it);
    return it;
  }

  ligar(v: Vinculo) {
    if (v.de === v.para) return;
    const dup = this.saida(v.de).find((x) => x.para === v.para && x.via === v.via && x.detalhe === v.detalhe && x.contexto === v.contexto);
    if (dup) return;
    this.vinculos.push(v);
    (this.saidaIdx.get(v.de) ?? this.saidaIdx.set(v.de, []).get(v.de)!).push(v);
    (this.entradaIdx.get(v.para) ?? this.entradaIdx.set(v.para, []).get(v.para)!).push(v);
  }

  buscar(q: string, tipos: Set<Tipo>, limite = 400): { itens: Item[]; total: number } {
    const termos = semAcento(q).split(/\s+/).filter(Boolean);
    const out: Item[] = [];
    let total = 0;
    for (const it of this.lista) {
      if (tipos.size && !tipos.has(it.tipo)) continue;
      if (termos.length && !termos.every((t) => it.busca.includes(t))) continue;
      total++;
      if (out.length < limite) out.push(it);
    }
    // id exato primeiro
    const ql = q.trim();
    out.sort((a, b) => Number(b.id === ql) - Number(a.id === ql));
    return { itens: out, total };
  }

  contagens() {
    const c: Record<string, number> = {};
    for (const i of this.lista) c[i.tipo] = (c[i.tipo] ?? 0) + 1;
    return c;
  }

  // ------------------------------------------------------------------ montagem
  private montar() {
    const F = {
      ev: 'src/game/events.ts', at: 'src/game/activities.ts', ag: 'src/game/aggression.ts', iv: 'src/game/interviews.ts', ca: 'src/game/careers.ts',
      si: 'src/scenes/situations.ts', en: 'src/scenes/environments.ts', mo: 'src/character/motions.ts', ex: 'src/character/expressions.ts',
      pr: 'src/render/props.ts', ap: 'src/character/appearance.ts', ac: 'src/game/achievements.ts', li: 'src/game/life.ts', ui: 'src/ui/game.ts',
    };

    // sistemas (pseudo-itens para atribuir referências de arquivos que não são listas de conteúdo)
    const sistemas: [string, string, string, string][] = [
      ['agressao', 'Motor de agressão', F.ag, 'aggress(L, p, kind): esquiva, revide, ferimento e consequências por contexto'],
      ['entrevistas', 'Motor de entrevistas', F.iv, 'startInterview: roupa → perguntas → teste → contratação'],
      ['motorAnual', 'Motor anual (ageUp/pickEvents)', F.li, 'envelhecimento, salário, mortes, sorteio de eventos'],
      ['uiJogo', 'Tela do jogo (ui/game.ts)', F.ui, 'apresentação de cenas/cartões, cena de casa, reações'],
    ];
    for (const [id, nome, arq, desc] of sistemas) this.add({ tipo: 'sistema', id, nome, icone: '⚙️', descricao: desc, local: { arquivo: arq, linha: 1, indice: 0 }, detalhes: [] });

    // ---- eventos e escolhas
    for (const ev of EVENTS) {
      const loc = achar(F.ev, R.idProp(ev.id));
      const titulo = typeof ev.title === 'function' ? '(título dinâmico)' : ev.title;
      this.add({
        tipo: 'evento', id: ev.id, nome: titulo, icone: ev.icon, local: loc,
        descricao: `Evento anual ${ev.min}–${ev.max} anos${ev.once ? ', acontece uma vez' : ''}.`,
        detalhes: [
          ['idades', `${ev.min}–${ev.max}`],
          ['peso', typeof ev.weight === 'function' ? 'função (depende da vida)' : String(ev.weight)],
          ['única', ev.once ? 'sim (flag ev_' + ev.id + ')' : 'não'],
          ['condição', ev.cond ? 'sim' : 'não'],
          ['setup', ev.setup ? 'sim' : 'não'],
          ['escolhas', ev.choices ? String(ev.choices.length) : 'automático'],
        ],
        dados: ev,
      });
      (ev.choices ?? []).forEach((c, i) => {
        const lc = loc ? achar(F.ev, R.label(c.label), loc.indice) : null;
        const cid = `${ev.id}#${i}`;
        this.add({ tipo: 'escolha', id: cid, nome: c.label, icone: c.icon ?? '🔀', local: lc, descricao: `Escolha ${i + 1} de "${titulo}"`, detalhes: [['evento', ev.id], ['índice', String(i)], ['condição própria', c.cond ? 'sim' : 'não']], dados: { ev, i } });
        this.ligar({ de: chave('evento', ev.id), para: chave('escolha', cid), via: 'estrutural', detalhe: 'escolha do evento' });
      });
    }

    // ---- ações e interações
    const aggLinha = achar(F.at, /\.\.\.\(Object\.keys\(AGGRO\)/);
    for (const a of ACTIONS) {
      this.add({ tipo: 'acao', id: a.id, nome: a.label, icone: a.icon, local: achar(F.at, R.idProp(a.id)), descricao: a.desc, detalhes: [['grupo', a.group], ['idade mínima', String(a.minAge)], ['idade máxima', a.maxAge !== undefined ? String(a.maxAge) : '—'], ['custo', typeof a.cost === 'function' ? 'função' : a.cost ? 'R$ ' + a.cost : '—'], ['condição', a.cond ? 'sim' : 'não']], dados: a });
    }
    for (const it of INTERACTIONS) {
      const gerada = it.id.startsWith('agg_');
      this.add({ tipo: 'interacao', id: it.id, nome: it.label, icone: it.icon, local: gerada ? aggLinha : achar(F.at, R.idProp(it.id)), descricao: gerada ? `Gerada automaticamente a partir de AGGRO["${it.id.slice(4)}"].` : `Interação da aba Relações (${it.group ?? 'Geral'}).`, detalhes: [['grupo', it.group ?? 'Geral']], dados: it });
      if (gerada) this.ligar({ de: chave('interacao', it.id), para: chave('agressao', it.id.slice(4)), via: 'estrutural', detalhe: 'run → aggress(L, p, kind)', local: aggLinha });
    }
    for (const [k, v] of Object.entries(AGGRO)) {
      this.add({ tipo: 'agressao', id: k, nome: v.label, icone: v.icon, local: achar(F.ag, R.chaveObjeto(k)), descricao: `Agressão de severidade ${v.sev} (1–5).`, detalhes: [['severidade', String(v.sev)]], dados: v });
      this.ligar({ de: chave('agressao', k), para: chave('sistema', 'agressao'), via: 'estrutural', detalhe: 'aggress(L, p, kind)' });
    }

    // ---- carreiras / entrevistas
    for (const c of CAREERS) {
      const iv = INTERVIEWS[c.id];
      const ivIni = (FONTES[F.iv] ?? '').indexOf('export const INTERVIEWS');
      this.add({
        tipo: 'entrevista', id: c.id, nome: `${c.title} — entrevista`, icone: c.icon, local: iv ? achar(F.iv, R.chaveObjeto(c.id), Math.max(0, ivIni)) : achar(F.ca, R.idProp(c.id)),
        descricao: iv ? `Entrevista ${iv.local}, com ${iv.interviewer}.` : 'SEM entrevista configurada.',
        detalhes: [['cargo', c.title], ['salário', 'R$ ' + c.salary], ['escolaridade', c.edu], ['idade mínima', String(c.minAge)], ['ambiente', iv?.env ?? '—'], ['formalidade', iv ? ['informal', 'arrumadinho', 'social'][iv.formal] : '—'], ['perguntas próprias', String(iv?.questions.length ?? 0)]],
        dados: { carreira: c, cfg: iv },
      });
      if (iv) this.ligar({ de: chave('entrevista', c.id), para: chave('ambiente', iv.env), via: 'estrutural', detalhe: 'INTERVIEWS[id].env' });
      this.ligar({ de: chave('entrevista', c.id), para: chave('sistema', 'entrevistas'), via: 'estrutural', detalhe: 'startInterview(L, carreira)' });
    }

    // ---- cenas e ações corporais
    const siTxt = FONTES[F.si] ?? '';
    const marcoSit = siTxt.indexOf('// ================================================================== situações');
    const physIni = siTxt.indexOf('export async function physical');
    const casos = blocos(F.si, /^ {4}case '(\w+)':/, [physIni, marcoSit]);
    for (const b of casos) {
      if (this.itens.has(chave('acaoCorporal', b.id))) continue;
      this.add({ tipo: 'acaoCorporal', id: b.id, nome: `physical("${b.id}")`, icone: '🤼', local: { arquivo: F.si, linha: linha(F.si, b.ini), indice: b.ini }, descricao: 'Interação corporal reutilizável entre dois atores (cena "interacao" com data.action).', detalhes: [], dados: b });
      this.ligar({ de: chave('cena', 'interacao'), para: chave('acaoCorporal', b.id), via: 'estatico', detalhe: 'physical(d, a, b, data.action)' });
    }
    const blocosSit = blocos(F.si, /^ {4}id: '(\w+)',\s*$/, [marcoSit, siTxt.length]);
    for (const s of Object.values(SITUATIONS)) {
      const b = blocosSit.find((x) => x.id === s.id);
      const dataKeys = b ? [...new Set([...siTxt.slice(b.ini, b.fim).matchAll(/c\.data\?\.(\w+)/g)].map((m) => m[1]))] : [];
      this.add({
        tipo: 'cena', id: s.id, nome: s.title ?? s.id, icone: '🎬', local: b ? { arquivo: F.si, linha: linha(F.si, b.ini), indice: b.ini } : null,
        descricao: `Situação roteirizada. Ambiente: ${typeof s.env === 'function' ? 'dinâmico (depende do elenco/dados)' : s.env}.`,
        detalhes: [['ambiente', typeof s.env === 'function' ? '(função)' : s.env], ['lê data', dataKeys.join(', ') || '—']],
        dados: { sit: s, dataKeys },
      });
      if (typeof s.env === 'string') this.ligar({ de: chave('cena', s.id), para: chave('ambiente', s.env), via: 'estrutural', detalhe: 'Situation.env' });
    }

    // ---- ambientes, movimentos, expressões, objetos
    for (const e of Object.values(ENVS)) {
      this.add({ tipo: 'ambiente', id: e.id, nome: e.name, icone: '🏙️', local: achar(F.en, R.constEnv(e.id)) ?? achar(F.en, R.idProp(e.id)), descricao: `Ambiente "${e.name}" (${e.layers.length} camada(s), trilha ${e.mood ?? 'calm'}).`, detalhes: [['camadas', String(e.layers.length)], ['trilha', e.mood ?? 'calm'], ['partículas ambientes', e.ambient ? 'sim' : 'não'], ['tinta', e.tint ? `${e.tint.col} ${e.tint.a}` : '—']], dados: e });
    }
    const moTxt = FONTES[F.mo] ?? '';
    for (const [id, m] of Object.entries(MOTIONS)) {
      const kf = (m.fn as Partial<KeyframeFn>).kf;
      const calib = KF_ORIGINAIS.has(id);
      this.add({
        tipo: 'movimento', id, nome: id, icone: m.loop ? '🔁' : '▶️', local: achar(F.mo, R.chaveObjeto(id)),
        descricao: `${m.loop ? 'Estado em loop' : `Ação de ${m.dur}s`}${kf ? `, ${kf.length} keyframes (calibrável)` : ', procedural (fórmula no código)'}${calib ? ' · CALIBRADO em src/data/calibracao.json' : ''}.`,
        detalhes: [['tipo', m.loop ? 'loop' : 'ação'], ['duração', m.dur ? m.dur + 's' : '—'], ['keyframes', kf ? String(kf.length) : 'procedural'], ['eventos', (m.events ?? []).map((e) => `${e.name}@${e.t}s`).join(', ') || '—'], ['expressão', m.expr ?? '—'], ['objeto de mão', [m.propN, m.propF].filter(Boolean).join(', ') || '—'], ['pés no chão', m.grounded === false ? 'não (livre)' : 'sim']],
        dados: m,
      });
      if (m.expr) this.ligar({ de: chave('movimento', id), para: chave('expressao', m.expr), via: 'estrutural', detalhe: 'Motion.expr' });
      for (const p of [m.propN, m.propF]) if (p) this.ligar({ de: chave('movimento', id), para: chave('objetoMao', p), via: 'estrutural', detalhe: 'Motion.propN/propF' });
    }
    void moTxt;
    for (const [id, f] of Object.entries(EXPRESSIONS)) {
      const orig = EXPR_ORIGINAIS.has(id);
      this.add({ tipo: 'expressao', id, nome: id, icone: '😶', local: achar(F.ex, R.chaveObjeto(id)), descricao: `Expressão facial${orig ? ' · CALIBRADA em src/data/calibracao.json' : ''}.`, detalhes: Object.entries(f).filter(([, v]) => v !== 0 && v !== false).map(([k, v]) => [k, String(v)] as [string, string]), dados: f });
    }
    const prTxt = FONTES[F.pr] ?? '';
    const propsIni = prTxt.indexOf('export const PROPS'), heldIni = prTxt.indexOf('export const HELD');
    for (const id of Object.keys(PROPS)) this.add({ tipo: 'objeto', id, nome: id, icone: '🪑', local: achar(F.pr, R.chaveObjeto(id), Math.max(0, propsIni)), descricao: 'Objeto de cena desenhado por código (d.prop).', detalhes: [] });
    for (const [id, hd] of Object.entries(HELD)) this.add({ tipo: 'objetoMao', id, nome: id, icone: '✋', local: achar(F.pr, R.chaveObjeto(id), Math.max(0, heldIni)), descricao: `Objeto de mão (${hd.follow ? 'gira com a mão' : 'fica de pé'}).`, detalhes: [['segue a mão', hd.follow ? 'sim' : 'não']] });

    // ---- parâmetros visuais (campos de Appearance)
    const apTxt = FONTES[F.ap] ?? '';
    const ini = apTxt.indexOf('export interface Appearance'), fim = apTxt.indexOf('\n}', ini);
    for (const m of apTxt.slice(ini, fim).matchAll(/^ {2}(\w+)\??:\s*([^;]+);(?:\s*\/\/\s*(.*))?/gm)) {
      const campo = m[1];
      const ops = OPCOES_VISUAIS[campo];
      const idx = ini + (m.index ?? 0);
      const tipoTs = m[2].trim();
      this.add({
        tipo: 'visual', id: campo, nome: campo, icone: '🎨', local: { arquivo: F.ap, linha: linha(F.ap, idx), indice: idx },
        descricao: `Aparência · ${tipoTs}${m[3] ? ' — ' + m[3] : ''}${ops ? ` · ${ops.length} opções` : ''}.`,
        detalhes: [['tipo', tipoTs], ['opções', ops ? String(ops.length) : tipoTs === 'number' ? 'contínuo' : '—']],
        dados: { campo, tipoTs, opcoes: ops },
      });
    }

    // ---- emotes, partículas, sons, conquistas
    for (const id of unionOf('src/character/actor.ts', 'EmoteKind')) this.add({ tipo: 'emote', id, nome: id, icone: '💬', local: achar('src/character/actor.ts', new RegExp(`case '${id}'`)), descricao: 'Emote sobre a cabeça (d.emote / react.emote).', detalhes: [] });
    for (const id of unionOf('src/render/particles.ts', 'PKind')) this.add({ tipo: 'particula', id, nome: id, icone: '✨', local: achar('src/render/particles.ts', new RegExp(`'${id}'`)), descricao: 'Tipo de partícula (d.fx).', detalhes: [] });
    for (const id of Object.getOwnPropertyNames(Object.getPrototypeOf(sfx)).filter((k) => typeof (sfx as any)[k] === 'function' && !['constructor', 'unlock', 'setMusic', 'setSfx', 'setMood', 'tone', 'noise', 'persist', 'makeImpulse', 'startMusic'].includes(k))) {
      this.add({ tipo: 'som', id, nome: id, icone: '🔊', local: achar('src/core/audio.ts', new RegExp(`^ {2}${id}\\(`, 'm')), descricao: 'Som sintetizado (d.sfx).', detalhes: [] });
    }
    for (const a of ACHIEVEMENTS) this.add({ tipo: 'conquista', id: a.id, nome: a.name, icone: a.icon, local: achar(F.ac, R.idProp(a.id)), descricao: a.desc, detalhes: [['flag', 'ach_' + a.id]] });

    // ---- usos genéricos: menus e sorteio percorrem os registros inteiros
    for (const ev of EVENTS) this.ligar({ de: chave('sistema', 'motorAnual'), para: chave('evento', ev.id), via: 'estrutural', detalhe: 'pickEvents percorre EVENTS (sorteio anual por peso)' });
    for (const a of ACTIONS) this.ligar({ de: chave('sistema', 'uiJogo'), para: chave('acao', a.id), via: 'estrutural', detalhe: 'aba Atividades lista ACTIONS' });
    for (const it of INTERACTIONS) this.ligar({ de: chave('sistema', 'uiJogo'), para: chave('interacao', it.id), via: 'estrutural', detalhe: 'aba Relações lista INTERACTIONS' });
    for (const c of CAREERS) this.ligar({ de: chave('sistema', 'uiJogo'), para: chave('entrevista', c.id), via: 'estrutural', detalhe: 'aba Carreira → Candidatar → startInterview' });

    // ---- vínculos estáticos (inferidos do código) ------------------------------------------
    this.vinculosEstaticos(F, casos, blocosSit, marcoSit);

    this.lista = [...this.itens.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.id.localeCompare(b.id));
  }

  private vinculosEstaticos(F: Record<string, string>, casos: { id: string; ini: number; fim: number }[], blocosSit: { id: string; ini: number; fim: number }[], _marco: number) {
    const refs = varrerReferencias(Object.fromEntries(ARQUIVOS_VARRIDOS.map((f) => [f, FONTES[f] ?? ''])));
    const blocosEv = blocos(F.ev, /^ {4}id: '(\w+)'/);
    const blocosAt = blocos(F.at, /^ {4}id: '(\w+)'/);
    const ivTxt = FONTES[F.iv] ?? '';
    const ivIni = ivTxt.indexOf('export const INTERVIEWS');
    const blocosIv = blocos(F.iv, /^ {2}(\w+): \{/, [Math.max(0, ivIni), ivTxt.length]);
    const acoes = new Set(ACTIONS.map((a) => a.id));
    const dono = (arquivo: string, idx: number): string | null => {
      const dentro = (bs: { id: string; ini: number; fim: number }[]) => bs.find((b) => idx >= b.ini && idx < b.fim);
      if (arquivo === F.ev) { const b = dentro(blocosEv); return b ? chave('evento', b.id) : null; }
      if (arquivo === F.at) { const b = dentro(blocosAt); return b ? chave(acoes.has(b.id) ? 'acao' : 'interacao', b.id) : null; }
      if (arquivo === F.si) { const c = dentro(casos); if (c) return chave('acaoCorporal', c.id); const s = dentro(blocosSit); return s ? chave('cena', s.id) : null; }
      if (arquivo === F.iv) { const b = idx >= ivIni ? dentro(blocosIv) : null; return b && INTERVIEWS[b.id] ? chave('entrevista', b.id) : chave('sistema', 'entrevistas'); }
      if (arquivo === F.ag) return chave('sistema', 'agressao');
      if (arquivo === F.li) return chave('sistema', 'motorAnual');
      if (arquivo === F.ui) return chave('sistema', 'uiJogo');
      return null;
    };
    for (const r of refs) {
      const de = dono(r.arquivo, r.indice);
      if (!de) continue;
      this.ligar({ de, para: chave(REG_PARA_TIPO[r.registro], r.id), via: 'estatico', detalhe: `${r.padrao} (literal no código)`, local: { arquivo: r.arquivo, linha: r.linha, indice: r.indice } });
    }
    // literais de movimento/expressão dentro de blocos de cena que o regex não pega (ex.: ternários)
    const siTxt = FONTES[F.si] ?? '';
    const nomesMov = new Set(Object.keys(MOTIONS));
    for (const b of [...blocosSit, ...casos]) {
      const de = chave(casos.includes(b) ? 'acaoCorporal' : 'cena', b.id);
      for (const m of siTxt.slice(b.ini, b.fim).matchAll(/'(\w+)'/g)) {
        if (!nomesMov.has(m[1])) continue;
        const para = chave('movimento', m[1]);
        if (this.saida(de).some((v) => v.para === para)) continue;
        const idx = b.ini + (m.index ?? 0);
        this.ligar({ de, para, via: 'estatico', detalhe: 'literal no bloco (nome montado por expressão; confirme executando)', local: { arquivo: F.si, linha: linha(F.si, idx), indice: idx } });
      }
    }
    // interações que usam sc(L, p, 'acao') → cena interacao + ação corporal
    const atTxt = FONTES[F.at] ?? '';
    for (const b of blocosAt) {
      const de = chave(acoes.has(b.id) ? 'acao' : 'interacao', b.id);
      for (const m of atTxt.slice(b.ini, b.fim).matchAll(/\bsc\(L,\s*p,\s*'(\w+)'\)/g)) {
        const idx = b.ini + (m.index ?? 0);
        const loc = { arquivo: F.at, linha: linha(F.at, idx), indice: idx };
        this.ligar({ de, para: chave('cena', 'interacao'), via: 'estatico', detalhe: `sc(L, p, '${m[1]}') → cena interacao`, local: loc });
        this.ligar({ de, para: chave('acaoCorporal', m[1]), via: 'estatico', detalhe: `sc(L, p, '${m[1]}') → data.action`, local: loc });
      }
    }
    // flags: quem escreve e quem lê
    const arquivosFlags = [F.ev, F.at, F.ag, F.iv, F.li, 'src/game/state.ts', F.ui, F.ac];
    for (const arq of arquivosFlags) {
      const t = FONTES[arq] ?? '';
      for (const m of t.matchAll(/flags(?:\.(\w+)|\[['`](\w+)['`]\])(\s*(?:=(?!=)|\+=|-=))?/g)) {
        const id = m[1] ?? m[2];
        const escreve = !!m[3];
        const idx = m.index ?? 0;
        const loc = { arquivo: arq, linha: linha(arq, idx), indice: idx };
        this.add({ tipo: 'flag', id, nome: id, icone: '🚩', local: loc, descricao: 'Chave em L.flags (memória de consequências).', detalhes: [] });
        const d = dono(arq, idx) ?? (arq === F.ac ? chave('sistema', 'motorAnual') : null);
        if (!d) continue;
        if (escreve) this.ligar({ de: d, para: chave('flag', id), via: 'estatico', detalhe: 'escreve a flag', local: loc });
        else this.ligar({ de: chave('flag', id), para: d, via: 'estatico', detalhe: 'é lida por', local: loc });
      }
    }
  }

  /** Itens sem nenhuma referência literal nos fontes (fora da definição) e sem vínculo de entrada. */
  semReferencia(tipos: Tipo[]): Item[] {
    return this.lista.filter((i) => tipos.includes(i.tipo) && !this.entrada(i.chave).length && ocorrenciasLiterais(i.id, i.local).length === 0);
  }
}

export const ESTADO_CALIB = ESTADO_CALIBRACAO;
