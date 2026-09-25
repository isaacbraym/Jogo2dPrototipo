/**
 * Modo Explorar — CONTROLADOR: o mundo vivo. Recebe cliques da interface, move o jogador (point-and-click 2,5D),
 * roda o relógio e as necessidades, faz os NPCs viverem (treinar, revezar, conversar, puxar papo) e executa as
 * interações NO PRÓPRIO MUNDO (usa physical/contato do motor — sem trocar de cena). Regras em docs/EXPLORAR.md.
 */
import { Scene, Director, PlacedProp } from '../scenes/scene';
import { Actor } from '../character/actor';
import { PROPS } from '../render/props';
import { physical } from '../scenes/situations';
import { RNG, rng } from '../core/rng';
import { clamp } from '../core/math';
import { sfx } from '../core/audio';
import { Life, Person, stat, addLog, STAT_LABEL, StatKey, makePerson } from '../game/state';
import { INTERACTIONS } from '../game/activities';
import type { Interaction, Outcome } from '../game/types';
import { MOTIONS, groundDrop } from '../character/motions';
import { legLength } from '../character/character';
import {
  TRECHOS, OBJETOS, DECORACAO, FACHADAS, FACHADA_Y, CALCADA_Y0, MUNDO_X0, MUNDO_X1, MUNDO_ALTURA, PONTOS, trechoEm, zonaEm, pontoAndavel, rota,
  lugarEm, escalaProf, luz, coresCeu, pintarTrecho, pintarRua, muroCasa, trechoPorId,
} from './mundo';
import { MOVEIS, M } from './moveis';
import {
  garantirFrequentadores, pessoaDe, nivelDe, INTERACOES_ESTRANHO, INTERACOES_CONTATO, classicasPara, FISICO_DE, PAPO_AMBIENTE,
  puxaConversa, mudarFam, INTERACOES_PASSANTE, FALAS_CASA, type CtxInteracao, type InteracaoMundo, type Resultado, type Nivel,
} from './gente';
import { NECESSIDADES, type EstadoExplorar, type Frequentador, type ObjetoMundo, type AcaoObjeto, type LugarId, type Necessidade, type Trecho } from './tipos';

// ------------------------------------------------------------------ ritmo do tempo
/** minutos de jogo por segundo real andando pelo mundo */
export const MIN_POR_SEG = 1.5;
/** ações correm em avanço rápido: segundos reais = minutos / esta taxa (mínimo 2,4 s) */
export const AVANCO = 14;
/** quanto cada necessidade cai por hora de jogo */
export const QUEDA_HORA: Record<Necessidade, number> = { energia: 3.2, fome: 5, diversao: 3, social: 2.4, higiene: 2.2, bexiga: 7 };
/** a partir de que idade o banho mostra o personagem sem roupa (menores tomam banho atrás da cortina, sempre vestidos) */
export const IDADE_NUDEZ = 18;
/** retorno decrescente: ganho × 1/(1 + usos no ano × fator) */
export const CANSACO_ANO = 0.1;
export const HORA_ACORDAR = 7 * 60;
export const HORA_LIMITE = 26 * 60; // 2h da manhã: apaga de sono

// ------------------------------------------------------------------ móveis e fachadas registrados como props
for (const [id, fn] of Object.entries(MOVEIS)) PROPS['movel_' + id] = (ctx, t, o) => fn(ctx, o as Record<string, unknown>, t);
for (const f of FACHADAS) PROPS['fachada_' + f.id] = (ctx, t, o) => f.desenho(ctx, f.x1 - f.x0, ((o as Record<string, unknown>).hora as number) ?? 720, t, o as Record<string, unknown>);
PROPS.explorar_muro = (ctx) => muroCasa(ctx);

/** Altura da pelve acima dos pés num movimento (px na escala 1) — para sentar na altura certa de cada assento. */
function alturaPelve(a: Actor, motion: string): number {
  const m = MOTIONS[motion];
  if (!m) return legLength(a.d);
  let p = m.fn(0, { speed: 1, seed: a.id });
  if (m.grounded !== false && p.rot === 0) p = { ...p, y: p.y + groundDrop(p, a.d.thigh, a.d.shin, a.d.hipW) };
  return legLength(a.d) - p.y;
}

export type Alvo =
  | { tipo: 'npc'; npc: NpcVivo }
  | { tipo: 'obj'; obj: ObjetoMundo }
  | { tipo: 'pet'; id: string; nome: string }
  | { tipo: 'chao'; x: number; y: number };

export interface NpcVivo {
  ator: Actor;
  p: Person;
  f?: Frequentador;
  papel: 'frequentador' | 'familia' | 'passante';
  lugar: LugarId;
  estado: 'livre' | 'indo' | 'usando' | 'pausa' | 'interagindo' | 'saindo';
  obj?: ObjetoMundo;
  acao?: AcaoObjeto;
  ate: number;
  alvo?: { x: number; y: number; correr?: boolean };
  depois?: () => void;
  /** interações feitas com esta pessoa hoje (por id) */
  hoje: Record<string, number>;
  visto: boolean;
}

/** Opção de menu mostrada pela interface. */
export interface OpcaoMenu { id: string; label: string; icon: string; bloqueio?: string; run: () => void }

export interface InterfaceExplorar {
  flutuar(xMundo: number, yMundo: number, texto: string, cor?: string): void;
  aviso(texto: string, tipo?: 'ok' | 'bad' | 'info'): void;
  registrar(texto: string, tom: 'bom' | 'ruim' | 'neutro'): void;
  progresso(frac: number | null, rotulo?: string): void;
  fimDoDia(resumo: ResumoDia): void;
  escolher(titulo: string, opcoes: OpcaoMenu[]): void;
  atualizar(): void;
}

export interface ResumoDia {
  dia: number;
  motivo: 'dormiu' | 'apagou' | 'saiu';
  stats: Partial<Record<StatKey, number>>;
  dinheiro: number;
  fitness: number;
  conheceu: string[];
  contatos: string[];
  momentos: string[];
}

/** Ponto de uso de uma ação (ou de uma vaga do objeto), já na escala da profundidade. */
export function pontoDeUso(o: ObjetoMundo, ac: AcaoObjeto, vaga = -1) {
  const s = escalaProf(o.y) * (o.escala ?? 1);
  const v = vaga >= 0 && o.vagas ? o.vagas[vaga] : null;
  const dx = v ? v.dx : ac.dx, dy = v ? v.dy ?? 0 : ac.dy ?? 0;
  return { x: o.x + dx * s, y: o.y + dy, s, lado: (v?.lado ?? ac.lado ?? 1) as 1 | -1 };
}

export class Explorador {
  sc: Scene;
  d: Director;
  eu: Actor;
  npcs: NpcVivo[] = [];
  est: EstadoExplorar;
  props = new Map<string, PlacedProp>();
  ocupado = new Map<string, Actor>();
  /** o que o jogador está fazendo */
  ocupadoEu: { obj: ObjetoMundo; acao: AcaoObjeto; t: number; dur: number; vaga: string } | null = null;
  private mover: { x: number; y: number; correr: boolean; depois?: () => void; resto?: { x: number; y: number }[] } | null = null;
  /** fachadas (a da casa e a da academia ficam transparentes quando você está dentro) */
  private fachadas: { pp: PlacedProp; predio?: string }[] = [];
  /** coisas entre a câmera e um prédio (muro, postes, árvores da calçada): ficam translúcidas quando você está lá dentro */
  private naFrente: { pp: PlacedProp; predio?: string }[] = [];
  private retomadaRua = new Map<NpcVivo, { alvo: NonNullable<NpcVivo['alvo']>; depois?: () => void }>();
  private emInteracao = false;
  private proxPassante = 6;
  private proxIniciativa = 18;
  private proxPapo = 5;
  private statsIni: Record<StatKey, number>;
  private dinheiroIni: number;
  private fitnessIni: number;
  private conheceu = new Set<string>();
  private contatosNovos: string[] = [];
  private momentos: string[] = [];
  encerrado = false;
  /** zoom da câmera (roda do mouse / botões): menor = mais longe, mais mundo na tela */
  zoom = 0.92;
  static ZOOM_MIN = 0.5;
  static ZOOM_MAX = 1.4;

  constructor(public L: Life, public ui: InterfaceExplorar) {
    this.est = prepararEstado(L);
    this.statsIni = { ...L.stats };
    this.dinheiroIni = L.money;
    this.fitnessIni = L.fitness ?? 0;
    this.sc = new Scene('sala');
    this.d = new Director(this.sc);
    this.sc.minViewW = 900;
    this.sc.mundo = {
      x0: MUNDO_X0,
      x1: MUNDO_X1,
      y0: -260,
      y1: MUNDO_ALTURA,
      fundo: (ctx, v, t) => {
        for (const tr of TRECHOS) {
          if (tr.x1 < v.x0 - 60 || tr.x0 > v.x1 + 60) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(tr.x0, -600, tr.x1 - tr.x0, CALCADA_Y0 + 600);
          ctx.clip();
          pintarTrecho(ctx, tr, this.est.hora, t);
          ctx.restore();
        }
        // limita à largura do mundo (com a tela ainda sem tamanho a vista pode ser infinita)
        const a = Math.max(MUNDO_X0, v.x0 - 50), b = Math.min(MUNDO_X1, v.x1 + 50);
        if (b > a) pintarRua(ctx, a, b, this.est.hora);
      },
      frente: (ctx, v) => this.desenharDestaques(ctx, v),
    };
    // Overlays de atores internos respeitam a opacidade da fachada, igual ao corpo desenhado por profundidade.
    this.sc.actorOverlayAlpha = (a) => this.visibilidadeDeFora(a.x, a.y);
    // objetos (móveis com partes: a de trás antes de quem usa, a da frente depois)
    for (const o of OBJETOS) this.montarObjeto(o);
    // decoração (postes acendem à noite)
    for (const dc of DECORACAO) {
      const id = dc.desenho ? 'movel_' + dc.desenho : dc.prop!;
      const pp = this.sc.addProp(id, dc.x, dc.y, { z: 0, scale: (dc.escala ?? 1) * escalaProf(dc.y), opts: { ...(dc.opts ?? {}) } });
      if (dc.desenho === 'tapete') pp.ordem = 0; // tapete fica sempre por baixo de tudo
      if (dc.acende) this.postes.push(pp);
      if (dc.y > FACHADA_Y) this.naFrente.push({ pp, predio: predioEm(dc.x) });
    }
    // fachadas e muro (na linha da rua)
    for (const f of FACHADAS) this.fachadas.push({ pp: this.sc.addProp('fachada_' + f.id, f.x0, FACHADA_Y, { z: 0, opts: { hora: this.est.hora } as PlacedProp['opts'] }), predio: f.predio });
    this.naFrente.push({ pp: this.sc.addProp('explorar_muro', 0, 803, { z: 0 }), predio: 'casa' });
    // jogador
    const ini = this.est.x !== undefined ? pontoAndavel(this.est.x, this.est.y ?? PONTOS.inicioY, L.player.age) : { x: PONTOS.inicioX, y: PONTOS.inicioY };
    this.eu = this.sc.addActor(L.player.ap, L.player.age, { x: ini.x, y: ini.y, facing: 1, name: L.player.first, z: 0 });
    this.eu.scale = escalaProf(this.eu.y);
    this.atualizarCeu();
    this.popularCasa();
    this.popularPets();
    this.popularAcademia();
    this.popularRua();
    this.sc.focus(this.eu.x, this.camY(), this.zoom);
    this.sc.cam.x = this.sc.cam.tx;
    this.sc.cam.y = this.sc.cam.ty;
    this.sc.cam.zoom = this.zoom;
    this.tickFachadas(10); // já começa com a fachada certa (sem esmaecer)
    this.sc.onBeat = (dt) => this.tick(dt);
  }

  // ================================================================== consulta
  trechoAtual(): Trecho { return trechoEm(this.eu.x); }
  /** nome do lugar exato (cômodo, calçada em frente a...) */
  lugarAtual(): string { return lugarEm(this.eu.x, this.eu.y); }
  /** está dentro de um prédio (casa/academia)? */
  dentroDe(a: Actor = this.eu): string | undefined { const z = zonaEm(a.x, a.y); return z?.predio; }
  private camY() { return clamp(this.eu.y - 290, 330, 600); }
  ajustarZoom(fator: number) { this.zoom = clamp(this.zoom * fator, Explorador.ZOOM_MIN, Explorador.ZOOM_MAX); }

  /** Coloca um objeto no mundo: escala da profundidade, partes (atrás/na frente de quem usa). */
  private montarObjeto(o: ObjetoMundo) {
    const s = escalaProf(o.y) * (o.escala ?? 1);
    const usoY = o.y + (o.acoes[0]?.dy ?? 0);
    const senta = o.acoes.some((a) => a.assento !== undefined || a.plataforma !== undefined);
    const lista: PlacedProp[] = [];
    const partes = o.partes ?? [{ desenho: o.desenho! }];
    for (const pt of partes) {
      const id = o.prop && !o.partes ? o.prop : 'movel_' + pt.desenho;
      const pp = this.sc.addProp(id, o.x + (pt.dx ?? 0) * s, o.y + (pt.dy ?? 0), { z: 0, scale: s, opts: { ...(o.opts ?? {}), ...(pt.opts ?? {}), flip: o.flip || pt.opts?.flip } as PlacedProp['opts'] });
      // quem usa fica ENTRE as partes: a de trás um pouco antes, a da frente um pouco depois
      if (pt.frente) pp.ordem = Math.max(o.y, usoY) + 1;
      else if (senta || o.partes) pp.ordem = Math.min(o.y, usoY) - 1;
      lista.push(pp);
    }
    this.props.set(o.id, lista[0]);
    this.partesDe.set(o.id, lista);
  }
  private partesDe = new Map<string, PlacedProp[]>();
  private marcarUso(o: ObjetoMundo, emUso: boolean) {
    for (const pp of this.partesDe.get(o.id) ?? []) pp.opts = { ...pp.opts, emUso } as typeof pp.opts;
  }
  /** vaga livre de um objeto (rack de halteres tem várias; o resto tem uma só). -1 = nenhuma */
  private vagaLivre(o: ObjetoMundo, quem: Actor): number {
    const n = o.vagas?.length ?? 1;
    for (let i = 0; i < n; i++) {
      const dono = this.ocupado.get(this.chaveVaga(o, i));
      if (!dono || dono === quem) return i;
    }
    return -1;
  }
  private chaveVaga(o: ObjetoMundo, i: number) { return o.vagas ? `${o.id}#${i}` : o.id; }
  /** Posiciona o ator para usar a ação: altura do assento/colchão/lona, giro do corpo, lado. */
  private posicionar(a: Actor, o: ObjetoMundo, ac: AcaoObjeto, vaga = -1) {
    const pu = pontoDeUso(o, ac, o.vagas ? vaga : -1);
    a.x = pu.x;
    a.y = pu.y;
    a.scale = escalaProf(a.y);
    a.facing = pu.lado;
    a.turn = ac.giro ?? 0.72;
    if (ac.assento !== undefined) {
      // assento (m) × escala do objeto − altura natural da pelve sentada (menos a "almofada" da coxa)
      const pelve = alturaPelve(a, ac.motion) - a.d.thighW * 0.45;
      a.elev = Math.max(0, ac.assento * M * pu.s - pelve * a.scale);
    } else if (ac.plataforma !== undefined) a.elev = ac.plataforma * M * pu.s;
    else a.elev = ac.elev ?? 0;
  }
  horaTexto(h = this.est.hora) {
    const m = Math.floor(h) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  }
  academiaAberta() { const h = (this.est.hora / 60) % 24; return h >= 6 && h < 23; }

  /** O que está sob o ponteiro (coordenadas de tela, px CSS). */
  alvoEm(sx: number, sy: number): Alvo | null {
    const w = this.sc.screenToWorld(sx, sy);
    const a = this.sc.actorAt(sx, sy);
    if (a && a !== this.eu) {
      const npc = this.npcs.find((n) => n.ator === a);
      if (npc) return { tipo: 'npc', npc };
    }
    // fachada opaca (você está do lado de fora): clicar nela leva até a porta
    const fora = !this.dentroDe();
    let melhor: ObjetoMundo | null = null;
    for (const o of OBJETOS) {
      const s = (o.escala ?? 1) * escalaProf(o.y);
      if (fora && o.y < FACHADA_Y - 4 && trechoEm(o.x).interno) continue;
      if (Math.abs(w.x - o.x) <= (o.w * s) / 2 && w.y <= o.y + 14 && w.y >= o.y - o.h * s) {
        if (!melhor || o.y > melhor.y) melhor = o;
      }
    }
    if (melhor) return { tipo: 'obj', obj: melhor };
    for (const pt of this.pets) if (Math.abs(w.x - pt.pp.x) < 60 && w.y <= pt.pp.y + 10 && w.y >= pt.pp.y - 90) return { tipo: 'pet', id: pt.id, nome: pt.nome };
    if (fora && w.y < FACHADA_Y && trechoEm(w.x).interno) {
      // clicou na fachada: vai até a porta daquele prédio (e entra, se for a casa/academia)
      const lugar = trechoEm(w.x).lugar;
      const px = lugar === 'casa' ? PONTOS.portaCasa : PONTOS.portaAcademia;
      return { tipo: 'chao', x: px, y: FACHADA_Y - 30 };
    }
    return { tipo: 'chao', x: w.x, y: w.y };
  }

  rotuloAlvo(a: Alvo | null): string | null {
    if (!a) return null;
    if (a.tipo === 'obj') return a.obj.nome;
    if (a.tipo === 'pet') return `${a.nome} 🐾`;
    if (a.tipo === 'npc') {
      const n = a.npc;
      const nome = n.f && !n.f.nomeConhecido && n.papel === 'frequentador' ? 'Desconhecido(a)' : n.p.first;
      return `${nome} · ${this.nivel(n).nome}`;
    }
    return null;
  }

  nivel(n: NpcVivo): Nivel {
    if (n.papel === 'familia') return { n: 5, nome: relTexto(n.p), cor: '#e8845a' };
    if (n.papel === 'passante') return { n: 0, nome: 'Passante', cor: '#9aa0b0' };
    return nivelDe(n.f, pessoaDe(this.L, n.f!), this.L, n.lugar);
  }

  // ================================================================== comandos da interface
  clicar(sx: number, sy: number, duplo: boolean) {
    if (this.encerrado || this.emInteracao) return;
    const a = this.alvoEm(sx, sy);
    if (!a) return;
    if (a.tipo === 'chao') {
      this.pararUso();
      this.irPara(a.x, a.y, duplo);
      this.sc.fx.spawn('brilho', a.x, a.y - 4, 4, { speed: 40, size: 5, life: 0.4 });
      return;
    }
    if (a.tipo === 'obj') return this.menuObjeto(a.obj);
    if (a.tipo === 'pet') return this.ui.escolher(`${a.nome} 🐾`, [{ id: 'brincar', label: 'Brincar', icon: '🎾', run: () => this.brincarPet(a.id) }]);
    return this.menuPessoa(a.npc);
  }

  menuObjeto(o: ObjetoMundo) {
    const ops: OpcaoMenu[] = o.acoes.map((ac) => ({
      id: ac.id, label: ac.label, icon: ac.icon, bloqueio: this.bloqueio(o, ac) ?? undefined,
      run: () => this.usar(o, ac),
    }));
    this.ui.escolher(o.nome, ops);
  }

  menuPessoa(n: NpcVivo) {
    const p = n.papel === 'frequentador' ? pessoaDe(this.L, n.f!) : n.p;
    const c = this.ctxInteracao(n, p);
    const ops: OpcaoMenu[] = [];
    const naVida = this.L.people.includes(p);
    if (n.papel === 'passante') {
      for (const it of INTERACOES_PASSANTE) if (it.pode({ ...c, hoje: n.hoje[it.id] ?? 0 })) ops.push({ id: it.id, label: it.label, icon: it.icon, run: () => this.interagirMundo(n, it) });
    } else if (!naVida) {
      for (const it of INTERACOES_ESTRANHO) if (it.pode({ ...c, hoje: n.hoje[it.id] ?? 0 })) ops.push({ id: it.id, label: it.label, icon: it.icon, run: () => this.interagirMundo(n, it) });
      if (n.f && n.f.nomeConhecido && n.f.fam < 35 && !n.f.contato) ops.push({ id: 'contatoBloq', label: 'Pedir o contato', icon: '📇', bloqueio: `Conheça melhor primeiro (familiaridade ${n.f.fam}/35)`, run: () => undefined });
    } else {
      for (const it of INTERACOES_CONTATO) if (it.pode({ ...c, hoje: n.hoje[it.id] ?? 0 })) ops.push({ id: it.id, label: it.label, icon: it.icon, run: () => this.interagirMundo(n, it) });
      for (const it of classicasPara(this.L, p)) ops.push({ id: it.id, label: it.label, icon: it.icon, run: () => this.interagirClassica(n, p, it) });
    }
    if (!ops.length) ops.push({ id: 'nada', label: 'Nada a fazer agora', icon: '🤷', bloqueio: 'Volte outro dia.', run: () => undefined });
    const nome = n.papel === 'frequentador' && n.f && !n.f.nomeConhecido ? 'Desconhecido(a)' : p.first;
    this.ui.escolher(`${nome} · ${this.nivel(n).nome}`, ops);
  }

  // ================================================================== movimento
  /** Anda até (x, y) pelo caminho das zonas (portas, portão, calçada). Limites por idade: rua ≥ 8, academia ≥ 14. */
  irPara(x: number, y: number, correr = false, depois?: () => void, avisar = true) {
    const idade = this.L.player.age;
    const z = zonaEm(x, y);
    if (avisar && z && (z.minIdade ?? 0) > idade) this.ui.aviso(z.predio === 'academia' || z.id === 'portaAcademia' ? 'A academia só aceita a partir de 14 anos.' : 'Você ainda é novo(a) demais para sair sozinho(a).', 'info');
    const pts = rota({ x: this.eu.x, y: this.eu.y }, { x: clamp(x, MUNDO_X0 + 30, MUNDO_X1 - 30), y }, idade);
    const [p0, ...resto] = pts;
    this.mover = { x: p0.x, y: p0.y, correr, depois, resto };
  }

  private passo(a: Actor, alvo: { x: number; y: number; correr?: boolean }, dt: number, veloc = 1): boolean {
    const dx = alvo.x - a.x, dy = alvo.y - a.y;
    const dist = Math.hypot(dx, dy * 1.6);
    if (dist < 3) {
      if (a.motionName === 'andar' || a.motionName === 'correr') a.play('parado', { fade: 0.2 });
      return true;
    }
    const v = (alvo.correr ? 330 : 165) * veloc * dt * a.scale;
    const k = Math.min(1, v / dist);
    a.x += dx * k;
    a.y += dy * k;
    if (Math.abs(dx) > 2) a.facing = dx > 0 ? 1 : -1;
    const quer = alvo.correr ? 'correr' : 'andar';
    if (a.motionName !== quer) a.play(quer, { fade: 0.15 });
    return false;
  }

  pararUso() {
    if (!this.ocupadoEu) return;
    const { obj, vaga } = this.ocupadoEu;
    this.ocupadoEu = null;
    this.ocupado.delete(vaga);
    this.marcarUso(obj, [...this.ocupado.keys()].some((k) => k === obj.id || k.startsWith(obj.id + '#')));
    this.sairDoMovel(this.eu, obj);
    this.eu.propN = undefined;
    this.eu.maoForma = null;
    this.eu.play('parado', { fade: 0.2 });
    this.ui.progresso(null);
  }

  // ================================================================== usar objetos
  bloqueio(o: ObjetoMundo, ac: AcaoObjeto): string | null {
    const b = ac.cond?.(this.L, this.est);
    if (b) return b;
    if (ac.efeito.dinheiro && this.L.money + ac.efeito.dinheiro < 0) return 'Dinheiro insuficiente.';
    if (o.exclusivo && this.vagaLivre(o, this.eu) < 0) {
      const quem = this.ocupado.get(this.chaveVaga(o, 0));
      return o.vagas ? 'Todos os halteres estão em uso. Espere um pouco.' : `Ocupado por ${quem?.name || 'alguém'}.`;
    }
    if (trechoEm(o.x).lugar === 'academia' && !this.academiaAberta()) return 'A academia está fechada (6h às 23h).';
    return null;
  }

  usar(o: ObjetoMundo, ac: AcaoObjeto) {
    const b = this.bloqueio(o, ac);
    if (b) return this.ui.aviso(b, 'bad');
    this.pararUso();
    const vaga = this.vagaLivre(o, this.eu);
    const chave = this.chaveVaga(o, Math.max(0, vaga));
    const pu = pontoDeUso(o, ac, o.vagas ? vaga : -1);
    if (o.exclusivo) this.ocupado.set(chave, this.eu);
    // anda até a frente do móvel (ponto de chegada) e só então "entra" nele
    const chegada = { x: pu.x, y: Math.max(pu.y, o.y + 6) };
    this.irPara(chegada.x, chegada.y, Math.abs(chegada.x - this.eu.x) > 900, () => this.comecarUso(o, ac, Math.max(0, vaga), chave), false);
  }

  private comecarUso(o: ObjetoMundo, ac: AcaoObjeto, vaga: number, chave: string) {
    const e = this.eu;
    this.posicionar(e, o, ac, vaga);
    if (ac.especial) return this.especial(o, ac);
    e.propN = ac.segura;
    e.play(ac.motion, { fade: 0.25 });
    if (o.exclusivo) this.marcarUso(o, true);
    const dur = Math.max(2.4, ac.minutos / AVANCO);
    this.ocupadoEu = { obj: o, acao: ac, t: 0, dur, vaga: chave };
  }

  /** Coloca o jogador em (x, y) na hora (câmera junto) — QA e ônibus. */
  teleportar(x: number, y: number) {
    const p = pontoAndavel(x, isNaN(y) ? this.eu.y : y, this.L.player.age);
    this.pararUso();
    this.mover = null;
    this.eu.x = p.x;
    this.eu.y = p.y;
    this.eu.scale = escalaProf(p.y);
    this.sc.focus(p.x, this.camY(), this.zoom);
    this.sc.cam.x = this.sc.cam.tx;
    this.sc.cam.y = this.sc.cam.ty;
    this.tickFachadas(10);
  }

  /** QA pelo console: teleporta e começa a ação na hora, sem requisitos — `__ex.testarUso('cama', 'cochilar')`. */
  testarUso(objId: string, acaoId?: string, manter = false) {
    const o = OBJETOS.find((x) => x.id === objId);
    const ac = o?.acoes.find((a) => !acaoId || a.id === acaoId);
    if (!o || !ac) return 'objeto/ação não existe';
    this.pararUso();
    this.mover = null;
    const vaga = Math.max(0, this.vagaLivre(o, this.eu));
    const chave = this.chaveVaga(o, vaga);
    if (o.exclusivo) this.ocupado.set(chave, this.eu);
    this.comecarUso(o, ac, vaga, chave);
    if (manter && this.ocupadoEu) {
      this.ocupadoEu.dur = 1e9; // captura: a ação não termina sozinha
      this.eu.play(ac.motion, { fade: 0.01 }); // e já na pose final (o headless desenha poucos quadros)
    }
    this.sc.focus(this.eu.x, this.camY(), this.zoom);
    this.sc.cam.x = this.sc.cam.tx;
    this.sc.cam.y = this.sc.cam.ty;
    this.tickFachadas(10);
    return 'ok';
  }

  /** Sai do móvel: volta para o chão, na frente dele, com o giro normal. */
  private sairDoMovel(a: Actor, o?: ObjetoMundo) {
    const subiu = a.elev > 1;
    a.elev = 0;
    a.turn = 0.72;
    a.propN = undefined;
    a.maoForma = null;
    if (o && subiu) a.y = Math.max(a.y, o.y + 8);
    a.scale = escalaProf(a.y);
    a.play('parado', { fade: 0.2 });
  }

  private terminarUso() {
    const u = this.ocupadoEu!;
    this.aplicarEfeito(u.acao.id, u.acao.efeito, u.acao.texto);
    this.pararUso();
    this.ui.atualizar();
  }

  private especial(o: ObjetoMundo, ac: AcaoObjeto) {
    const e = this.eu;
    if (ac.especial === 'banho') return void this.roteiroBanho(o);
    if (ac.especial === 'xixi') return void this.roteiroVaso(o, 1);
    if (ac.especial === 'coco') return void this.roteiroVaso(o, 2);
    if (ac.especial === 'lavarMaos') return void this.roteiroLavarMaos();
    if (ac.especial === 'dormir') {
      e.play(ac.motion, { fade: 0.3 });
      this.sc.fadeTarget = 1;
      setTimeout(() => this.encerrarDia('dormiu'), 1400);
      return;
    }
    if (ac.especial === 'matricula') {
      if (this.est.matriculaAte !== undefined && this.est.matriculaAte >= this.L.player.age) return this.ui.aviso('Sua matrícula já está em dia. Agora é treinar!', 'info');
      this.L.money -= 120;
      this.est.matriculaAte = this.L.player.age;
      this.ui.flutuar(e.x, e.topWorld() - 20, '− R$ 120', '#ff8a8a');
      this.d.say(e, 'Quero me matricular!', 1.6);
      addLog(this.L, 'Você se matriculou na academia VIVA FIT.', 'bom', '🏋️');
      this.momentos.push('Fez a matrícula na academia.');
      this.ui.aviso('Matrícula feita! Os aparelhos estão liberados este ano.', 'ok');
      this.ui.atualizar();
      return;
    }
    if (ac.especial === 'onibus') {
      const ir = (x: number, nome: string) => () => {
        if (this.L.money < 5) return this.ui.aviso('Sem dinheiro para o ônibus.', 'bad');
        this.L.money -= 5;
        this.sc.fadeTarget = 1;
        sfx.whoosh();
        setTimeout(() => {
          this.avancar(20);
          this.eu.x = x;
          this.eu.y = 850;
          this.eu.scale = escalaProf(850);
          this.sc.cam.x = this.sc.cam.tx = x;
          this.sc.fadeTarget = 0;
          this.ui.aviso(`Você desceu em: ${nome}.`, 'info');
          this.ui.atualizar();
        }, 700);
      };
      const ops: OpcaoMenu[] = [
        { id: 'casa', label: 'Ir para casa', icon: '🏠', run: ir(PONTOS.frenteCasa.x, 'Em frente de casa') },
        { id: 'academia', label: 'Ir para a academia', icon: '🏋️', bloqueio: this.L.player.age < 14 ? 'A partir de 14 anos.' : undefined, run: ir(PONTOS.frenteAcademia.x, 'Em frente à academia') },
      ];
      this.ui.escolher('Ônibus (R$ 5)', ops);
    }
  }

  /** Aplica efeitos com retorno decrescente no ano e mostra os números flutuando. */
  aplicarEfeito(id: string, ef: AcaoObjeto['efeito'], texto?: string) {
    const L = this.L, est = this.est;
    const usos = (est.usos[id] = (est.usos[id] ?? 0) + 1) - 1;
    const mult = 1 / (1 + usos * CANSACO_ANO);
    const e = this.eu;
    let dy = 0;
    const mostra = (t: string, cor: string) => { this.ui.flutuar(e.x, e.topWorld() - 16 - dy, t, cor); dy += 22; };
    for (const [k, v] of Object.entries(ef.stats ?? {}) as [StatKey, number][]) {
      const g = Math.floor(v * mult + rng.next() * 0.999);
      if (!g) continue;
      stat(L, k, g);
      mostra(`${g > 0 ? '+' : ''}${g} ${STAT_LABEL[k]}`, g > 0 ? '#9be89b' : '#ff8a8a');
    }
    if (ef.fitness) {
      const g = Math.max(0, Math.round(ef.fitness * mult));
      L.fitness = clamp((L.fitness ?? 0) + g, 0, 100);
      if (g) mostra(`+${g} Forma física`, '#7fd3ff');
    }
    for (const [k, v] of Object.entries(ef.nec ?? {}) as [Necessidade, number][]) est.nec[k] = clamp(est.nec[k] + v, 0, 100);
    if (ef.dinheiro) { L.money += ef.dinheiro; mostra(`${ef.dinheiro > 0 ? '+' : '−'} R$ ${Math.abs(ef.dinheiro)}`, ef.dinheiro > 0 ? '#9be89b' : '#ff8a8a'); }
    if (texto) this.ui.registrar(texto, 'bom');
    if (usos >= 6) this.ui.registrar('Você já fez muito isso este ano: o corpo e a cabeça rendem cada vez menos.', 'neutro');
  }

  // ================================================================== interações
  ctxInteracao(n: NpcVivo, p: Person): CtxInteracao {
    return { L: this.L, est: this.est, p, f: n.f, ocupada: n.estado === 'usando' ? n.obj?.id : undefined, lugar: n.lugar, hoje: 0 };
  }

  private async chegarPerto(n: NpcVivo, para: boolean) {
    if (para) {
      // Morador abordado no passeio retoma o mesmo destino depois da conversa.
      if (n.papel === 'frequentador' && n.lugar === 'rua' && n.estado === 'indo' && n.alvo) {
        this.retomadaRua.set(n, { alvo: { ...n.alvo }, depois: n.depois });
        n.alvo = undefined; n.depois = undefined;
      }
      this.soltarNpc(n);
    }
    n.estado = 'interagindo';
    const lado = this.eu.x < n.ator.x ? -1 : 1;
    const gx = n.ator.x + lado * 150 * n.ator.scale;
    const gy = n.ator.elev > 1 && n.obj ? Math.max(n.ator.y, n.obj.y + 8) : n.ator.y;
    await new Promise<void>((res) => this.irPara(gx, gy, Math.abs(gx - this.eu.x) > 700, res, false));
    this.eu.facing = n.ator.x > this.eu.x ? 1 : -1;
    if (para) n.ator.facing = this.eu.x > n.ator.x ? 1 : -1;
    this.eu.lookAt = n.ator;
    n.ator.lookAt = this.eu;
  }

  async interagirMundo(n: NpcVivo, it: InteracaoMundo) {
    if (this.emInteracao) return;
    this.pararUso();
    this.emInteracao = true;
    try {
      const p = n.papel === 'frequentador' ? pessoaDe(this.L, n.f!) : n.p;
      const para = it.para || n.estado !== 'usando';
      await this.chegarPerto(n, para);
      const c = { ...this.ctxInteracao(n, p), hoje: n.hoje[it.id] ?? 0 };
      n.hoje[it.id] = (n.hoje[it.id] ?? 0) + 1;
      const r = it.run(c);
      this.comentarCorpo(n, r);
      await this.encenar(n, r);
      if (n.f && !this.conheceu.has(p.id) && n.f.nomeConhecido) this.conheceu.add(p.id);
      if (r.novoContato) {
        this.contatosNovos.push(p.first);
        this.ui.aviso(`📇 ${p.first} foi adicionado(a) aos seus relacionamentos!`, 'ok');
        sfx.pop();
      }
    } finally {
      this.fimInteracao(n);
    }
  }

  async interagirClassica(n: NpcVivo, p: Person, it: Interaction) {
    if (this.emInteracao) return;
    this.pararUso();
    this.emInteracao = true;
    try {
      await this.chegarPerto(n, true);
      const antes = p.bond;
      const out: Outcome = it.run(this.L, p);
      const acao = (out.scene?.id === 'interacao' ? out.scene.data?.action : undefined) ?? (out.tone === 'ruim' ? undefined : FISICO_DE[it.id]);
      if (acao) {
        await physical(this.d, this.eu, n.ator, acao);
      } else {
        n.ator.play('bracosCruzados', { fade: 0.2 });
        n.ator.setExpr('bravo', 2);
        await this.d.wait(1.4);
      }
      const dif = p.bond - antes;
      if (dif) this.ui.flutuar(n.ator.x, n.ator.topWorld() - 18, `${dif > 0 ? '+' : ''}${dif} vínculo`, dif > 0 ? '#ffb3c8' : '#ff8a8a');
      this.est.nec.social = clamp(this.est.nec.social + (out.tone === 'ruim' ? -4 : 10), 0, 100);
      this.ui.registrar(out.text, out.tone === 'ruim' ? 'ruim' : out.tone === 'bom' ? 'bom' : 'neutro');
      if ((p.rel === 'conhecido') && p.bond >= 55) {
        p.rel = p.sex === 'f' ? 'amiga' : 'amigo';
        this.ui.aviso(`🎉 Você e ${p.first} agora são amigos!`, 'ok');
        addLog(this.L, `🎉 Você e ${p.first} viraram amigos.`, 'bom', '🎉');
        this.momentos.push(`Virou amigo(a) de ${p.first}.`);
      }
      if (out.next) this.ui.registrar(out.next.text, 'neutro');
    } finally {
      this.fimInteracao(n);
    }
  }

  /** Encena o resultado: falas em balões, animação de contato ou reação, números flutuando. */
  private async encenar(n: NpcVivo, r: Resultado) {
    const fam0 = n.f?.fam ?? 0;
    if (r.eu) await this.d.say(this.eu, r.eu, Math.min(3, 1.2 + r.eu.length * 0.035));
    if (r.fisico) await physical(this.d, this.eu, n.ator, r.fisico);
    if (r.reacaoNpc && n.estado !== 'usando') n.ator.play(r.reacaoNpc, { fade: 0.2 });
    if (r.expr) n.ator.setExpr(r.expr as never, 2);
    if (r.ela) await this.d.say(n.ator, r.ela, Math.min(3.4, 1.2 + r.ela.length * 0.035));
    if (r.social) this.est.nec.social = clamp(this.est.nec.social + r.social, 0, 100);
    if (r.diversao) this.est.nec.diversao = clamp(this.est.nec.diversao + r.diversao, 0, 100);
    const dfam = (n.f?.fam ?? 0) - fam0;
    if (dfam && !r.novoContato) this.ui.flutuar(n.ator.x, n.ator.topWorld() - 18, `${dfam > 0 ? '+' : ''}${dfam} familiaridade`, dfam > 0 ? '#ffe08a' : '#ff8a8a');
    this.ui.registrar(r.texto, r.tom);
    if (r.tom === 'bom' && n.f && n.f.fam >= 35 && fam0 < 35) {
      const nivel = n.lugar === 'rua' ? 'conhecido(a) do bairro' : 'colega de academia';
      this.ui.aviso(`${n.p.first} agora é seu/sua ${nivel}. Já dá para pedir o contato!`, 'ok');
    }
  }

  /** As pessoas reparam: mau cheiro e mão que não foi lavada depois do banheiro. */
  private comentarCorpo(n: NpcVivo, r: Resultado) {
    if (n.papel === 'passante') return;
    if (this.est.nec.higiene < 18) {
      if (n.f) mudarFam(n.f, -3);
      r.ela = rng.pick(['(...cheiro de academia sem banho, hein?)', 'Nossa, você veio direto da esteira?', '*respira pela boca*']) + (r.ela ? ' ' + r.ela : '');
      r.texto += ' (Seu cheiro não ajudou nada. Um banho resolveria.)';
      r.tom = r.tom === 'bom' ? 'neutro' : r.tom;
    }
    if (this.est.maosSujas && (r.fisico === 'apertoMao' || r.fisico === 'highFive')) {
      if (n.f) mudarFam(n.f, -2);
      r.ela = 'Você lavou as mãos depois do banheiro? ...Tá bom, né.' + (r.ela ? ' ' + r.ela : '');
    }
  }

  private fimInteracao(n: NpcVivo) {
    this.emInteracao = false;
    this.eu.z = 0; n.ator.z = 0;
    this.eu.lookAt = null;
    n.ator.lookAt = null;
    this.eu.scale = escalaProf(this.eu.y);
    n.ator.scale = escalaProf(n.ator.y);
    if (n.estado === 'interagindo') {
      const retomar = this.retomadaRua.get(n);
      if (retomar) {
        this.retomadaRua.delete(n);
        n.estado = 'indo'; n.alvo = retomar.alvo; n.depois = retomar.depois;
        n.ator.play('andar', { fade: 0.25 });
      } else {
        n.estado = 'pausa'; n.ate = this.sc.t + rng.range(1.5, 3); n.ator.play('parado', { fade: 0.3 });
      }
    }
    this.eu.play('parado', { fade: 0.3 });
    this.ui.atualizar();
  }

  // ================================================================== NPCs
  private novoNpc(p: Person, papel: NpcVivo['papel'], lugar: LugarId, x: number, y: number, f?: Frequentador): NpcVivo {
    const a = this.sc.addActor(p.ap, p.age, { x, y, facing: rng.chance(0.5) ? 1 : -1, name: papel === 'frequentador' && f && !f.nomeConhecido ? '' : p.first, z: 0 });
    a.scale = escalaProf(y);
    const n: NpcVivo = { ator: a, p, f, papel, lugar, estado: 'livre', ate: rng.range(0.5, 3), hoje: {}, visto: false };
    this.npcs.push(n);
    return n;
  }

  private popularCasa() {
    const L = this.L;
    const vivos = L.people.filter((p) => p.alive);
    const mora = L.player.age < 18
      ? vivos.filter((p) => ['mae', 'pai'].includes(p.rel) || (['irmao', 'irma'].includes(p.rel) && p.age < 26))
      : vivos.filter((p) => p.rel === 'conjuge' || (['filho', 'filha'].includes(p.rel) && p.age < 18));
    const r = new RNG(L.seed + this.est.dias * 13);
    mora.slice(0, 4).forEach((p, i) => {
      const tr = TRECHOS.filter((t) => t.lugar === 'casa')[(i + 1) % 4];
      this.novoNpc(p, 'familia', 'casa', r.range(tr.x0 + 150, tr.x1 - 150), r.range(700, 736));
    });
  }

  /** Os pets da sua vida andam pela casa (clique para brincar). */
  pets: { pp: PlacedProp; alvo: number; ate: number; nome: string; id: string }[] = [];
  private popularPets() {
    const vivos = (this.L.pets ?? []).filter((p) => p.alive).slice(0, 2);
    vivos.forEach((pet, i) => {
      const x = 1900 + i * 900;
      const pp = this.sc.addProp(pet.kind, x, 728, { z: 0, scale: 0.9 * escalaProf(728), opts: { color: pet.color } });
      this.pets.push({ pp, alvo: x, ate: 0, nome: pet.name, id: pet.id });
    });
  }

  private tickPets(dt: number) {
    for (const pt of this.pets) {
      pt.ate -= dt;
      if (pt.ate <= 0) {
        pt.ate = rng.range(3, 8);
        // às vezes segue você pela casa
        const perto = trechoEm(this.eu.x).lugar === 'casa' && rng.chance(0.5);
        pt.alvo = clamp(perto ? this.eu.x + rng.range(-160, 160) : pt.pp.x + rng.range(-350, 350), 380, 3520);
      }
      const dx = pt.alvo - pt.pp.x;
      if (Math.abs(dx) > 3) {
        pt.pp.x += Math.sign(dx) * Math.min(Math.abs(dx), 110 * dt);
        pt.pp.opts = { ...pt.pp.opts, flip: dx < 0, state: Math.floor(this.sc.t * 8) % 2 };
      }
    }
  }

  brincarPet(id: string) {
    const pet = this.L.pets.find((p) => p.id === id);
    const pt = this.pets.find((p) => p.id === id);
    if (!pet || !pt) return;
    this.pararUso();
    this.irPara(pt.pp.x - 90, pt.pp.y - 4, false, () => {
      this.eu.facing = 1;
      this.eu.play('agachar', { fade: 0.2 });
      pet.bond = Math.min(100, pet.bond + 5);
      this.sc.fx.spawn('coracao', pt.pp.x, pt.pp.y - 60, 5, { w: 40, size: 11, life: 1.6 });
      this.aplicarEfeito('brincarPet', { stats: { felicidade: 2 }, nec: { diversao: 12, social: 6 } }, `${pet.name} ficou felicíssimo(a). Você também.`);
      setTimeout(() => this.eu.play('parado', { fade: 0.3 }), 1400);
    });
  }

  private popularAcademia() {
    if (this.L.player.age < 14) return;
    const lista = garantirFrequentadores(this.L, this.est, 'academia');
    const r = new RNG(this.L.seed + this.est.dias * 31 + 5);
    const presentes = lista.filter((f) => r.chance(f.assiduidade)).slice(0, 5);
    for (const f of presentes) {
      const p = pessoaDe(this.L, f);
      if (!p.alive) continue;
      const tr = r.chance(0.5) ? trechoPorId('cardio') : trechoPorId('musculacao');
      this.novoNpc(p, 'frequentador', 'academia', r.range(tr.x0 + 250, tr.x1 - 200), r.range(700, 736), f);
    }
  }

  /** Moradores persistentes do bairro: alguns sentam na praça, outros circulam pela calçada. */
  private popularRua() {
    if (this.L.player.age < 8) return;
    const lista = garantirFrequentadores(this.L, this.est, 'rua');
    const r = new RNG(this.L.seed + this.est.dias * 43 + 19);
    const presentes = lista.filter((f) => r.chance(f.assiduidade)).slice(0, 6);
    const bancos = ['bancoPraca1', 'bancoPraca2'].map((id) => OBJETOS.find((o) => o.id === id)!).filter(Boolean);
    presentes.forEach((f, i) => {
      const p = pessoaDe(this.L, f);
      if (!p.alive) return;
      if (i < bancos.length) {
        const o = bancos[i], ac = o.acoes[0];
        const n = this.novoNpc(p, 'frequentador', 'rua', o.x, o.y, f);
        this.ocupado.set(this.chaveVaga(o, 0), n.ator);
        this.marcarUso(o, true);
        n.obj = o; n.acao = ac;
        this.posicionar(n.ator, o, ac, 0);
        n.ator.play(ac.motion, { fade: 0.01 });
        n.estado = 'usando';
        n.ate = this.sc.t + r.range(10, 24);
        return;
      }
      const naPraca = i % 2 === 0;
      const alvo = naPraca
        ? pontoAndavel(r.range(3750, 5750), r.range(700, 790), 99)
        : pontoAndavel(r.range(3550, 6000), r.range(828, 878), 99);
      const n = this.novoNpc(p, 'frequentador', 'rua', alvo.x, alvo.y, f);
      n.estado = 'pausa';
      n.ate = this.sc.t + r.range(1, 5);
    });
  }

  private soltarNpc(n: NpcVivo) {
    const o = n.obj;
    if (o) {
      for (const [k, a] of [...this.ocupado]) if (a === n.ator) this.ocupado.delete(k);
      this.marcarUso(o, [...this.ocupado.keys()].some((k) => k === o.id || k.startsWith(o.id + '#')));
    }
    if (n.estado === 'usando' || n.ator.elev > 0) this.sairDoMovel(n.ator, o);
    n.ator.propN = undefined;
    n.obj = undefined;
    n.acao = undefined;
  }

  private pensarNpc(n: NpcVivo) {
    const t = this.sc.t;
    if (n.papel === 'passante') return;
    if (n.papel === 'frequentador' && n.lugar === 'rua') return this.pensarMoradorRua(n);
    const daCasa = n.papel === 'familia';
    const objs = OBJETOS.filter((o) => (daCasa ? trechoEm(o.x).lugar === 'casa' : trechoEm(o.x).lugar === 'academia') && o.acoes.some((a) => !a.especial));
    const livres = objs.filter((o) => !o.exclusivo || this.vagaLivre(o, n.ator) >= 0);
    const fav = n.f?.favorito;
    let o: ObjetoMundo | undefined;
    if (!daCasa && !this.academiaAberta()) {
      // academia fechando: todo mundo vai embora
      n.estado = 'saindo';
      n.alvo = { x: PONTOS.portaAcademia, y: 738 };
      return;
    }
    const sorte = rng.next();
    if (sorte < 0.62 && livres.length) o = (fav && livres.find((x) => x.id.startsWith(fav))) || rng.pick(livres);
    else if (sorte < 0.8 && !daCasa) {
      // conversa com outro frequentador
      const outro = rng.pick(this.npcs.filter((m) => m !== n && m.lugar === n.lugar && m.estado !== 'interagindo'));
      if (outro) {
        n.estado = 'indo';
        n.alvo = { x: outro.ator.x + (outro.ator.x > n.ator.x ? -130 : 130), y: outro.ator.y };
        n.depois = () => {
          n.ator.facing = outro.ator.x > n.ator.x ? 1 : -1;
          this.d.say(n.ator, rng.pick(PAPO_AMBIENTE), 2.2);
          n.estado = 'pausa';
          n.ate = t + rng.range(3, 6);
        };
        return;
      }
    }
    if (!o) {
      const tr = trechoEm(n.ator.x);
      n.estado = 'indo';
      n.alvo = { x: clamp(n.ator.x + rng.range(-400, 400), tr.x0 + 80, tr.x1 - 80), y: rng.range(700, 738) };
      n.depois = () => { n.estado = 'pausa'; n.ate = this.sc.t + rng.range(2, 5); };
      return;
    }
    const ac = rng.pick(o.acoes.filter((a) => !a.especial));
    const vaga = Math.max(0, this.vagaLivre(o, n.ator));
    if (o.exclusivo) this.ocupado.set(this.chaveVaga(o, vaga), n.ator);
    n.obj = o;
    n.acao = ac;
    n.estado = 'indo';
    const pu = pontoDeUso(o, ac, o.vagas ? vaga : -1);
    n.alvo = { x: pu.x, y: Math.max(pu.y, o.y + 6) };
    n.depois = () => {
      const a = n.ator;
      this.posicionar(a, o, ac, vaga);
      if (o.exclusivo) this.marcarUso(o, true);
      a.propN = ac.segura;
      a.play(ac.motion, { fade: 0.25 });
      n.estado = 'usando';
      n.ate = this.sc.t + rng.range(12, 28);
    };
  }

  /** Rotina própria dos moradores: banco, chafariz e passeio — nunca tentam usar aparelhos da academia. */
  private pensarMoradorRua(n: NpcVivo) {
    const t = this.sc.t;
    const sorte = rng.next();
    if (sorte < 0.3) {
      const bancos = OBJETOS.filter((o) => o.id === 'bancoPraca1' || o.id === 'bancoPraca2')
        .filter((o) => this.vagaLivre(o, n.ator) >= 0);
      if (bancos.length) {
        const o = rng.pick(bancos), ac = o.acoes[0];
        this.ocupado.set(this.chaveVaga(o, 0), n.ator);
        this.marcarUso(o, true);
        n.obj = o; n.acao = ac; n.estado = 'indo';
        const pu = pontoDeUso(o, ac, 0);
        n.alvo = { x: pu.x, y: Math.max(pu.y, o.y + 6) };
        n.depois = () => {
          this.posicionar(n.ator, o, ac, 0);
          n.ator.play(ac.motion, { fade: 0.25 });
          n.estado = 'usando';
          n.ate = this.sc.t + rng.range(10, 22);
        };
        return;
      }
    }
    if (sorte < 0.5) {
      const direita = rng.chance(0.5);
      const p = pontoAndavel(direita ? 4930 : 4370, rng.range(735, 790), 99);
      n.estado = 'indo'; n.alvo = { x: p.x, y: p.y };
      n.depois = () => {
        n.ator.facing = direita ? -1 : 1;
        if (rng.chance(0.5)) this.d.say(n.ator, rng.pick(['Bonito esse chafariz.', 'Moeda dá sorte mesmo?', 'Cinco minutos de paz.']), 2, 'pensa');
        n.estado = 'pausa'; n.ate = t + rng.range(4, 8);
      };
      return;
    }
    const naPraca = rng.chance(0.6);
    const p = naPraca
      ? pontoAndavel(rng.range(3720, 5800), rng.range(700, 800), 99)
      : pontoAndavel(clamp(n.ator.x + rng.range(-900, 900), 250, 10850), rng.range(824, 880), 99);
    n.estado = 'indo';
    n.alvo = { x: p.x, y: p.y };
    n.depois = () => { n.estado = 'pausa'; n.ate = this.sc.t + rng.range(2, 6); };
  }

  private tickNpcs(dt: number) {
    const t = this.sc.t;
    for (const n of [...this.npcs]) {
      const a = n.ator;
      a.scale = escalaProf(a.y);
      if (n.estado === 'livre' || n.estado === 'pausa') this.afastarSobreposicao(n, dt);
      if (n.estado === 'interagindo') continue;
      if (n.estado === 'indo' || n.estado === 'saindo') {
        if (n.alvo && this.passo(a, n.alvo, dt, n.papel === 'passante' ? 0.9 : 0.85)) {
          if (n.estado === 'saindo' || n.papel === 'passante') { this.removerNpc(n); continue; }
          const dep = n.depois; n.depois = undefined; n.estado = 'pausa'; n.ate = t + 1.5;
          dep?.();
        }
        continue;
      }
      if (t < n.ate) continue;
      if (n.estado === 'usando') { this.soltarNpc(n); n.estado = 'pausa'; n.ate = t + rng.range(1, 3); continue; }
      this.pensarNpc(n);
    }
    // conta encontros (primeira vez que você vê a pessoa no dia)
    for (const n of this.npcs) {
      if (!n.visto && n.f && Math.abs(n.ator.x - this.eu.x) < 700) { n.visto = true; n.f.encontros++; }
    }
  }

  /** Pequena separação só em repouso evita dois corpos ocupando exatamente o mesmo pixel sem atrapalhar contatos. */
  private afastarSobreposicao(n: NpcVivo, dt: number) {
    const a = n.ator;
    const outros = [this.eu, ...this.npcs.filter((m) => m !== n && (m.estado === 'livre' || m.estado === 'pausa')).map((m) => m.ator)];
    for (const b of outros) {
      const dx = a.x - b.x, dy = a.y - b.y;
      if (Math.abs(dx) >= 72 || Math.abs(dy) >= 34) continue;
      const lado = dx === 0 ? (a.id > b.id ? 1 : -1) : Math.sign(dx);
      const p = pontoAndavel(a.x + lado * Math.min(55, (72 - Math.abs(dx)) * dt * 8), a.y, 99);
      if (trechoEm(p.x).lugar === n.lugar) { a.x = p.x; a.y = p.y; }
    }
  }

  private removerNpc(n: NpcVivo) {
    this.soltarNpc(n);
    this.sc.removeActor(n.ator);
    this.npcs = this.npcs.filter((m) => m !== n);
  }

  /** Vida na rua: gente passando pela CALÇADA, de ponta a ponta (passam em frente às casas, nunca entram). */
  private tickPassantes(dt: number) {
    this.proxPassante -= dt;
    // some quem já saiu de vista há tempo
    for (const n of this.npcs.filter((m) => m.papel === 'passante' && m.estado !== 'interagindo')) if (Math.abs(n.ator.x - this.eu.x) > 2600) this.removerNpc(n);
    const noite = luz(this.est.hora).noite;
    if (this.proxPassante > 0 || this.npcs.filter((n) => n.papel === 'passante').length >= (noite > 0.6 ? 1 : 3)) return;
    this.proxPassante = rng.range(7, 13) * (noite > 0.6 ? 2 : 1);
    const daDireita = rng.chance(0.5);
    const v = this.sc.view;
    const x0 = clamp(daDireita ? v.x1 + rng.range(80, 400) : v.x0 - rng.range(80, 400), MUNDO_X0 + 10, MUNDO_X1 - 10);
    const p = makePerson(rng, { age: rng.int(12, 80), rel: 'conhecido', bond: 30 });
    const n = this.novoNpc(p, 'passante', 'rua', x0, rng.range(818, 884));
    n.estado = 'indo';
    n.alvo = { x: daDireita ? MUNDO_X0 + 5 : MUNDO_X1 - 5, y: n.ator.y };
    if (rng.chance(0.3)) n.ator.propN = rng.pick(['celular', 'sacola', 'guardaChuva']);
  }

  /** Um frequentador toma a iniciativa de falar com você. */
  private tickIniciativa(dt: number) {
    this.proxIniciativa -= dt;
    if (this.proxIniciativa > 0 || this.emInteracao || this.ocupadoEu || this.mover) return;
    this.proxIniciativa = rng.range(20, 40);
    const perto = this.npcs.filter((n) => n.papel === 'frequentador' && (n.estado === 'pausa' || n.estado === 'livre') && Math.abs(n.ator.x - this.eu.x) < 650 && this.dentroDe(n.ator) === this.dentroDe());
    if (!perto.length) return;
    const n = rng.pick(perto);
    n.estado = 'indo';
    n.alvo = { x: this.eu.x + (n.ator.x > this.eu.x ? 140 : -140), y: this.eu.y };
    n.depois = () => {
      if (this.emInteracao) return;
      n.ator.facing = this.eu.x > n.ator.x ? 1 : -1;
      this.eu.facing = n.ator.x > this.eu.x ? 1 : -1;
      this.d.say(n.ator, puxaConversa(n.p, n.f!, n.lugar), 2.4);
      mudarFam(n.f!, 2);
      this.est.nec.social = clamp(this.est.nec.social + 3, 0, 100);
      this.ui.registrar(`${n.f!.nomeConhecido ? n.p.first : 'Alguém'} puxou conversa com você. Clique na pessoa para responder!`, 'neutro');
      n.estado = 'pausa';
      n.ate = this.sc.t + 6;
    };
  }

  /** Conversas entre NPCs próximos ao jogador (ambiente vivo). */
  private tickPapo(dt: number) {
    this.proxPapo -= dt;
    if (this.proxPapo > 0) return;
    this.proxPapo = rng.range(6, 12);
    const cands = this.npcs.filter((n) => n.papel !== 'passante' && n.estado !== 'interagindo' && Math.abs(n.ator.x - this.eu.x) < 800 && !n.ator.bubble);
    if (!cands.length) return;
    const n = rng.pick(cands);
    const falas = n.papel === 'familia' ? FALAS_CASA
      : n.lugar === 'rua' ? ['Bonito dia.', 'A praça tá cheia hoje.', 'Vou passar na padaria.', 'Esse banco já é patrimônio.', 'Bora caminhar?']
        : n.estado === 'usando' ? ['Mais uma!', 'Uff...', 'Queima!', 'Só mais três...'] : PAPO_AMBIENTE;
    this.d.say(n.ator, rng.pick(falas), 2, n.estado === 'usando' ? 'pensa' : 'fala');
  }

  // ================================================================== relógio e necessidades
  avancar(min: number) {
    const e = this.est;
    e.hora += min;
    for (const k of NECESSIDADES) e.nec[k] = clamp(e.nec[k] - (QUEDA_HORA[k] * min) / 60, 0, 100);
    if (e.nec.fome < 12 && rng.chance(min / 120)) { stat(this.L, 'saude', -1); this.ui.registrar('Você está com fome demais. A saúde sente.', 'ruim'); }
    if (e.nec.social < 10 && rng.chance(min / 180)) { stat(this.L, 'felicidade', -1); this.ui.registrar('Dia solitário. Converse com alguém.', 'ruim'); }
    this.atualizarCeu();
  }

  postes: PlacedProp[] = [];
  private atualizarCeu() {
    const c = coresCeu(this.est.hora);
    const acesa = luz(this.est.hora).noite > 0.45 ? 1 : 0;
    for (const p of this.postes ?? []) if (p.opts.state !== acesa) p.opts = { ...p.opts, state: acesa };
    const dentro = this.eu ? !!this.dentroDe() : true;
    const { noite } = luz(this.est.hora);
    this.sc.night = noite * (dentro ? 0.16 : 0.36);
    for (const f of this.fachadas ?? []) f.pp.opts = { ...f.pp.opts, hora: this.est.hora } as typeof f.pp.opts;
    if (this.sc.mundo) { this.sc.mundo.corTopo = c.topo; this.sc.mundo.corBase = '#222'; }
  }

  // ================================================================== laço principal
  private tick(dt: number) {
    if (this.encerrado) return;
    const e = this.eu;
    // roteiro (banho, vaso) em andamento: relógio acelerado e barra de progresso
    if (this.roteiro) {
      const r = this.roteiro;
      r.t += dt;
      this.avancar((r.minutos * dt) / r.dur);
      this.ui.progresso(Math.min(1, r.t / r.dur), r.rotulo);
    } else if (this.ocupadoEu) {
      const u = this.ocupadoEu;
      u.t += dt;
      this.avancar((u.acao.minutos * dt) / u.dur);
      this.ui.progresso(Math.min(1, u.t / u.dur), u.acao.label);
      if (u.t >= u.dur) this.terminarUso();
    } else {
      this.avancar(dt * MIN_POR_SEG);
    }
    if (this.mover) {
      const cansado = this.est.nec.energia < 10 && !this.emInteracao ? 0.7 : 1;
      if (this.passo(e, this.mover, dt, cansado)) {
        const prox = this.mover.resto?.shift();
        if (prox) { this.mover.x = prox.x; this.mover.y = prox.y; }
        else { const dep = this.mover.depois; this.mover = null; dep?.(); }
      }
    }
    if (!this.ocupadoEu && !this.roteiro && e.elev < 1) e.scale = escalaProf(e.y);
    if (this.direcao && (this.direcao.x || this.direcao.y) && !this.emInteracao && !this.ocupadoEu) {
      const alvo = pontoAndavel(e.x + this.direcao.x * 90, e.y + this.direcao.y * 50, this.L.player.age);
      this.mover = { x: alvo.x, y: alvo.y, correr: this.direcao.correr };
    }
    this.tickFachadas(dt);
    this.tickCorpo(dt);
    this.tickNpcs(dt);
    this.tickPets(dt);
    this.tickPassantes(dt);
    this.tickCarros(dt);
    if (this.trechoAtual().lugar === 'academia' || this.trechoAtual().lugar === 'rua') this.tickIniciativa(dt);
    this.tickPapo(dt);
    // câmera segue (em x e em y: dentro de casa mostra do teto ao jardim; na rua, a fachada e a calçada)
    this.sc.focus(e.x, this.camY(), this.zoom);
    this.est.x = e.x;
    this.est.y = e.y;
    if (this.est.hora >= HORA_LIMITE) this.encerrarDia('apagou');
  }

  /** Casa de bonecas: a fachada do prédio onde você está some (e volta quando você sai). */
  private visibilidadeDeFora(x: number, y: number) {
    if (y >= FACHADA_Y) return 1;
    const predio = predioEm(x);
    if (!predio) return 1;
    const fachada = this.fachadas.find((f) => f.predio === predio);
    return fachada ? clamp(1 - fachada.pp.alpha, 0, 1) : 1;
  }

  private tickFachadas(dt: number) {
    const dentro = this.dentroDe();
    const naPorta = zonaEm(this.eu.x, this.eu.y)?.id;
    for (const f of this.fachadas) {
      if (!f.predio) continue;
      let alvo = dentro === f.predio ? 0.06 : 1;
      if (naPorta === (f.predio === 'casa' ? 'portaCasa' : 'portaAcademia')) alvo = clamp((this.eu.y - (FACHADA_Y - 16)) / 70, 0.06, 1);
      f.pp.alpha += (alvo - f.pp.alpha) * Math.min(1, dt * 6);
      f.pp.opts = { ...f.pp.opts, aberta: naPorta === 'portaCasa' } as typeof f.pp.opts;
    }
    // o que está na frente do prédio onde você está fica translúcido (props e gente na calçada)
    const k = Math.min(1, dt * 6);
    for (const f of this.naFrente) f.pp.alpha += ((dentro && f.predio === dentro ? 0.22 : 1) - f.pp.alpha) * k;
    for (const n of this.npcs) {
      const alvo = dentro && n.ator.y > FACHADA_Y && predioEm(n.ator.x) === dentro ? 0.26 : 1;
      n.ator.alpha += (alvo - n.ator.alpha) * k;
    }
  }

  pararTeclado() { if (this.mover && !this.mover.depois) this.mover = { ...this.mover, x: this.eu.x, y: this.eu.y }; }
  /** direção do teclado (setas/WASD); a interface atualiza */
  direcao: { x: number; y: number; correr: boolean } | null = null;

  /** contorno do objeto sob o ponteiro (destaque) */
  destaque: ObjetoMundo | null = null;
  private desenharDestaques(ctx: CanvasRenderingContext2D, _v: { x0: number; x1: number }) {
    this.desenharCarros(ctx);
    this.desenharBanheiro(ctx);
    const o = this.destaque;
    if (!o) return this.desenharBarras(ctx);
    this.desenharBarras(ctx);
    const s = (o.escala ?? 1) * escalaProf(o.y);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,140,0.9)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(o.x - (o.w * s) / 2, o.y - o.h * s, o.w * s, o.h * s + 10);
    ctx.restore();
  }

  /** Carros na rua (a faixa da rua é a mais perto da câmera: são desenhados por cima de tudo). */
  carros: { x: number; y: number; v: number; cor: string; giro: number }[] = [];
  private proxCarro = 2;
  private tickCarros(dt: number) {
    for (const c of this.carros) { c.x += c.v * dt; c.giro += (c.v * dt) / (0.3 * M); }
    this.carros = this.carros.filter((c) => Math.abs(c.x - this.eu.x) < 3200);
    this.proxCarro -= dt;
    const noite = luz(this.est.hora).noite;
    if (this.proxCarro > 0 || this.carros.length >= 3) return;
    this.proxCarro = rng.range(3, 8) * (noite > 0.6 ? 2.5 : 1);
    const praDireita = rng.chance(0.5);
    const v = this.sc.view;
    this.carros.push({
      x: praDireita ? v.x0 - 900 : v.x1 + 900,
      y: praDireita ? 992 : 948,
      v: (praDireita ? 1 : -1) * rng.range(520, 760),
      cor: rng.pick(['#e63956', '#3d7bd9', '#f2c14e', '#e9eef0', '#2b2d3a', '#58b368', '#9aa0b0']),
      giro: 0,
    });
  }
  private desenharCarros(ctx: CanvasRenderingContext2D) {
    const noite = luz(this.est.hora).noite > 0.45;
    const desenha = MOVEIS.carro;
    for (const c of [...this.carros].sort((a, b) => a.y - b.y)) {
      ctx.save();
      ctx.translate(c.x, c.y);
      const s = escalaProf(c.y) * 0.8;
      // passando na frente de você: fica translúcido para não esconder o personagem
      if (Math.abs(c.x - this.eu.x) < 1.9 * M * s + 140) ctx.globalAlpha = 0.45;
      // na frente do prédio onde você está (casa de bonecas): quase transparente
      const dentro = this.dentroDe();
      if (dentro && predioEm(c.x) === dentro) ctx.globalAlpha = 0.25;
      ctx.scale(s, s);
      desenha(ctx, { color: c.cor, flip: c.v < 0, noite, giro: c.giro * (c.v < 0 ? -1 : 1) }, this.sc.t);
      ctx.restore();
    }
  }

  /** Barra do supino entre as mãos de quem está deitado no banco (atravessa em profundidade, como no suporte). */
  private desenharBarras(ctx: CanvasRenderingContext2D) {
    for (const a of this.sc.actors) {
      if (a.motionName !== 'supino') continue;
      const alpha = this.visibilidadeDeFora(a.x, a.y);
      if (alpha <= 0.01) continue;
      const h1 = a.handWorld(true), h2 = a.handWorld(false);
      const mx = (h1.x + h2.x) / 2, my = (h1.y + h2.y) / 2;
      const ex = 0.65 * M * a.scale * 0.42, ey = -0.65 * M * a.scale * 0.9; // direção da profundidade (OX, OY) normalizada à mão
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = '#c9d2d4'; ctx.lineWidth = 5 * a.scale; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(mx - ex, my - ey); ctx.lineTo(mx + ex, my + ey); ctx.stroke();
      for (const k of [-1, 1]) {
        ctx.fillStyle = '#1c1d26';
        ctx.beginPath(); ctx.ellipse(mx + ex * k * 0.92, my + ey * k * 0.92, 9 * a.scale, 26 * a.scale, 0.25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ================================================================== banheiro (banho completo e necessidades)
  /** roteiro em andamento (bloqueia cliques; o relógio corre acelerado) */
  roteiro: { t: number; dur: number; minutos: number; rotulo: string } | null = null;
  /** estado visual do banho (vidraça, água, vapor) e do jato */
  banho: { adulto: boolean; agua: boolean; vapor: number } | null = null;
  jato: { ate: number } | null = null;
  /** roupa de antes do banho/vaso (guardada uma única vez; sempre devolvida no fim do roteiro) */
  private roupaNormal: Actor['outfit'] = undefined;
  private roupaGuardada = false;
  private proxCheiro = 0;

  private adulto() { return this.L.player.age >= IDADE_NUDEZ; }
  private espera(s: number) { return this.d.wait(s); }
  /** troca a roupa do jogador (só adultos chegam a ficar sem roupa) */
  private roupa(estado: 'normal' | 'semParteDeCima' | 'semRoupa') {
    const e = this.eu;
    if (!this.adulto()) return;
    if (!this.roupaGuardada) { this.roupaNormal = e.outfit; this.roupaGuardada = true; }
    if (estado === 'normal') { e.outfit = this.roupaNormal; this.roupaGuardada = false; return; }
    if (estado === 'semParteDeCima') e.outfit = { ...(this.roupaNormal ?? {}), top: 'nu' };
    else e.outfit = { ...(this.roupaNormal ?? {}), top: 'nu', bottom: 'nu', shoes: 'descalco' };
  }

  private async rodarRoteiro(rotulo: string, minutos: number, dur: number, fn: () => Promise<void>) {
    this.emInteracao = true;
    this.roteiro = { t: 0, dur, minutos, rotulo };
    try { await fn(); } finally {
      // segurança: ninguém sai do banheiro sem roupa, aconteça o que acontecer no roteiro
      if (this.roupaGuardada) { this.eu.outfit = this.roupaNormal; this.roupaGuardada = false; }
      this.banho = null;
      this.jato = null;
      this.roteiro = null;
      this.emInteracao = false;
      this.ui.progresso(null);
      this.eu.propF = undefined;
      this.sairDoMovel(this.eu);
      this.ui.atualizar();
    }
  }

  /** Banho de verdade: entra no box, tira a roupa, água, cabelo, sabonete, enxágue, toalha, veste. */
  async roteiroBanho(o: ObjetoMundo) {
    const e = this.eu, adulto = this.adulto();
    await this.rodarRoteiro('Tomando banho', 20, 21, async () => {
      this.posicionar(e, o, o.acoes[0]);
      this.banho = { adulto, agua: false, vapor: 0 };
      if (adulto) {
        this.d.say(e, rng.pick(['Hora do banho!', 'Água quente, por favor...', 'Banho: o único lugar onde eu canto bem.']), 1.6, 'pensa');
        const tira = e.play('tirarRoupa', { fade: 0.2 });
        await this.espera(1.05); this.roupa('semParteDeCima'); sfx.swoosh();
        await this.espera(1.0); this.roupa('semRoupa'); sfx.swoosh();
        await tira;
      } else {
        this.d.say(e, 'Fechando a cortina!', 1.4, 'pensa');
        await this.espera(1.2);
      }
      // abre a água
      this.banho.agua = true;
      sfx.splash();
      e.play('banhoEnxaguar', { fade: 0.3 });
      await this.espera(2.2);
      // cabelo com xampu
      e.play('banhoCabelo', { fade: 0.3 });
      for (let i = 0; i < 6; i++) { this.espuma(e.headWorld().x, e.headWorld().y - 20, 3); if (i % 2 === 0) sfx.splash(); await this.espera(0.55); }
      if (rng.chance(0.4)) this.d.say(e, rng.pick(['🎵 Evidências... 🎵', '🎵 Lá lá lá... 🎵', 'Caiu xampu no olho!!']), 1.8, 'fala');
      // sabonete no corpo
      e.propN = 'sabonete';
      e.play('banhoEnsaboar', { fade: 0.3 });
      for (let i = 0; i < 7; i++) { this.espuma(e.x + rng.range(-20, 20), e.y - rng.range(120, 230) * e.scale, 2); await this.espera(0.5); }
      e.propN = undefined;
      // enxágue
      e.play('banhoEnxaguar', { fade: 0.3 });
      await this.espera(2.4);
      // fecha a água, seca
      this.banho.agua = false;
      sfx.tick();
      e.propN = 'toalha';
      e.play('secarToalha', { fade: 0.3 });
      await this.espera(2.6);
      e.propN = undefined;
      if (adulto) {
        const veste = e.play('vestirRoupa', { fade: 0.2 });
        await this.espera(0.8); this.roupa('semParteDeCima');
        await this.espera(1.0); this.roupa('normal');
        await veste;
      }
      this.banho = null;
      this.est.maosSujas = false;
      this.aplicarEfeito('banho', o.acoes[0].efeito, 'Banho tomado. Cheirosa(o), renovada(o) e gente de novo.');
    });
  }

  /** Vaso: número 1 (homem em pé, com a tampa levantada; mulher sentada) ou número 2 (sentado, celular, força, alívio). */
  async roteiroVaso(o: ObjetoMundo, n: 1 | 2) {
    const e = this.eu, adulto = this.adulto();
    const pp = this.props.get(o.id)!;
    const emPe = n === 1 && this.L.player.sex === 'm';
    await this.rodarRoteiro(n === 1 ? 'Número 1' : 'Número 2', n === 1 ? 3 : 12, n === 1 ? 7 : 14, async () => {
      const acXixi = o.acoes.find((a) => a.id === 'xixi')!, acCoco = o.acoes.find((a) => a.id === 'coco')!;
      if (emPe) {
        this.posicionar(e, o, acXixi);
        pp.opts = { ...pp.opts, tampa: 1 } as typeof pp.opts;
        sfx.tick();
        e.play('xixiEmPe', { fade: 0.25 });
        await this.espera(0.6);
        this.jato = { ate: this.sc.t + 3.4 };
        for (let i = 0; i < 5; i++) { this.respingo(o); await this.espera(0.65); }
        if (rng.chance(0.5)) this.d.say(e, rng.pick(['Ahhh...', '*assobia*', 'Mirar é uma arte.']), 1.4, 'pensa');
        this.jato = null;
        await e.play('sacudir', { fade: 0.1 });
        if (rng.chance(0.35)) { this.ui.registrar('Você esqueceu a tampa levantada. Clássico.', 'neutro'); }
        else pp.opts = { ...pp.opts, tampa: 0 } as typeof pp.opts;
      } else {
        // sentar: abaixa a roupa de baixo (adultos) e senta
        this.posicionar(e, o, acCoco);
        pp.opts = { ...pp.opts, tampa: 1 } as typeof pp.opts; // ninguém senta na tampa fechada
        if (adulto) { if (!this.roupaGuardada) { this.roupaNormal = e.outfit; this.roupaGuardada = true; } e.outfit = { ...(this.roupaNormal ?? {}), bottom: 'nu' }; }
        e.play('sentarVaso', { fade: 0.3 });
        await this.espera(1.2);
        if (n === 1) {
          for (let i = 0; i < 4; i++) { this.respingo(o); await this.espera(0.6); }
          this.d.say(e, 'Ahhh...', 1.2, 'pensa');
        } else {
          e.propN = 'celular';
          e.play('celularVaso', { fade: 0.3 });
          this.d.say(e, rng.pick(['Só três minutinhos no zap...', 'Deixa eu ver as notícias...', 'Melhor lugar pra pensar na vida.']), 2.2, 'pensa');
          await this.espera(3.2);
          e.propN = undefined;
          e.play('esforcoVaso', { fade: 0.2 });
          for (let i = 0; i < 5; i++) { if (this.visibilidadeDeFora(e.x, e.y) > 0.05) this.sc.fx.spawn('suor', e.headWorld().x, e.headWorld().y - 10, 2, { speed: 60 }); await this.espera(0.45); }
          sfx.pop(); await this.espera(0.35); sfx.pop();
          e.setExpr('alivio', 2.5);
          e.play('sentarVaso', { fade: 0.3 });
          this.d.say(e, rng.pick(['Ufa...', 'Missão cumprida.', 'Leve como uma pluma.']), 1.6, 'fala');
          if (this.visibilidadeDeFora(o.x, o.y) > 0.05) this.sc.fx.spawn('fumaca', o.x + 10, o.y - 90, 4, { speed: 30, size: 16, life: 1.6, color: 'rgba(150,190,90,0.5)' });
          await this.espera(1.4);
        }
        // papel e levantar
        e.propF = 'papelHigienico';
        await e.play('limparVaso', { fade: 0.2 });
        if (n === 2) await e.play('limparVaso', { fade: 0.1 });
        e.propF = undefined;
        this.sairDoMovel(e, o);
        this.posicionar(e, o, acXixi);
        pp.opts = { ...pp.opts, tampa: 0 } as typeof pp.opts;
        e.play('parado', { fade: 0.3 });
        if (this.roupaGuardada) { e.outfit = this.roupaNormal; this.roupaGuardada = false; }
        await this.espera(0.3);
      }
      // descarga
      await e.play('puxarDescarga', { fade: 0.15 });
      sfx.whoosh(); sfx.splash();
      for (let k = 0; k <= 10; k++) { pp.opts = { ...pp.opts, agua: 1 - k / 10 } as typeof pp.opts; await this.espera(0.08); }
      pp.opts = { ...pp.opts, agua: 0 } as typeof pp.opts;
      this.est.maosSujas = true;
      const ef = n === 1 ? { nec: { bexiga: 100 } } : { stats: { saude: 1, felicidade: 1 }, nec: { bexiga: 100, higiene: -6 } };
      this.aplicarEfeito(n === 1 ? 'xixi' : 'coco', ef, n === 1 ? 'Alívio imediato.' : 'Leveza na alma (e no corpo).');
      this.ui.registrar('Dica: lave as mãos na pia. As pessoas reparam.', 'neutro');
    });
  }

  async roteiroLavarMaos() {
    const e = this.eu;
    await this.rodarRoteiro('Lavando as mãos', 2, 2.6, async () => {
      e.play('lavarMaos', { fade: 0.2 });
      sfx.splash();
      for (let i = 0; i < 4; i++) { this.espuma(e.handWorld(true).x + e.facing * 10, e.handWorld(true).y, 2); await this.espera(0.5); }
      this.est.maosSujas = false;
      this.aplicarEfeito('lavarMaos', { nec: { higiene: 6 } }, 'Mãos lavadas. Parabéns, cidadão exemplar.');
    });
  }

  private espuma(x: number, y: number, n: number) {
    if (this.visibilidadeDeFora(x, y) <= 0.05) return;
    this.sc.fx.spawn('bolha', x, y, n, { speed: 40, size: 7, life: 1.1, color: 'rgba(255,255,255,0.9)' });
  }
  private respingo(o: ObjetoMundo) {
    const s = escalaProf(o.y);
    if (this.visibilidadeDeFora(o.x, o.y) <= 0.05) return;
    this.sc.fx.spawn('bolha', o.x + 15 * s, o.y - 80 * s, 2, { speed: 30, size: 4, life: 0.4, color: 'rgba(250,225,120,0.8)' });
  }

  /** Necessidades do corpo: acidente quando a bexiga zera, mau cheiro com higiene baixa. */
  private tickCorpo(dt: number) {
    const e = this.eu, est = this.est;
    if (est.nec.bexiga <= 0 && !this.roteiro && !this.emInteracao) {
      est.nec.bexiga = 100;
      est.nec.higiene = Math.min(est.nec.higiene, 5);
      stat(this.L, 'felicidade', -4);
      this.pararUso();
      this.mover = null;
      e.play('nervoso', { fade: 0.2 });
      e.setExpr('envergonhado', 4);
      this.d.say(e, 'Ai não... não deu tempo.', 2.4, 'fala');
      if (this.visibilidadeDeFora(e.x, e.y) > 0.05) this.sc.fx.spawn('lagrima', e.x, e.y - 60, 6, { speed: 40, size: 6, life: 1, color: 'rgba(250,225,120,0.85)' });
      addLog(this.L, 'Você não chegou a tempo ao banheiro. Constrangimento nível máximo.', 'ruim', '😳');
      this.ui.registrar('😳 Não deu tempo de chegar ao banheiro... Higiene lá embaixo. Hora de um banho.', 'ruim');
      for (const n of this.npcs) if (n.estado !== 'interagindo' && Math.abs(n.ator.x - e.x) < 700 && n.papel !== 'passante') {
        if (n.f) mudarFam(n.f, -4);
        n.ator.play('rirDe', { fade: 0.2 });
        n.estado = 'pausa'; n.ate = this.sc.t + 3;
      }
    }
    if (est.nec.higiene < 18) {
      this.proxCheiro -= dt;
      if (this.proxCheiro <= 0) {
        this.proxCheiro = 1.2;
        if (this.visibilidadeDeFora(e.x, e.y) > 0.05) this.sc.fx.spawn('fumaca', e.x + rng.range(-25, 25), e.y - rng.range(60, 180) * e.scale, 1, { speed: 25, size: 12, life: 1.4, color: 'rgba(140,180,80,0.45)' });
      }
    }
  }

  /** Vidraça jateada do box (esconde o corpo no meio), vapor, água e o jato do xixi. */
  private desenharBanheiro(ctx: CanvasRenderingContext2D) {
    const b = this.banho;
    const ch = OBJETOS.find((o) => o.id === 'chuveiro')!;
    if (b) {
      const alpha = this.visibilidadeDeFora(ch.x, ch.y);
      ctx.save();
      ctx.globalAlpha *= alpha;
      const t = this.sc.t;
      const s = escalaProf(ch.y);
      if (b.agua) {
        // água caindo do chuveiro (do crivo até o chão do box)
        const cx = ch.x + 23 * s, cy = ch.y - 424 * s, chao = this.eu.y - 4, queda = chao - cy;
        ctx.strokeStyle = 'rgba(170,215,240,0.75)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 18; i++) {
          const x = cx + ((i * 7) % 40) - 20 + Math.sin(i + t * 3) * 3;
          const y0 = cy + ((t * 700 + i * 43) % queda);
          ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x - 2, Math.min(chao, y0 + 18)); ctx.stroke();
        }
        b.vapor = Math.min(1, b.vapor + 0.004);
      } else b.vapor = Math.max(0, b.vapor - 0.004);
      const x0 = ch.x - 0.55 * M * s, x1 = ch.x + 0.55 * M * s, y0 = ch.y - 2.3 * M * s, y1 = ch.y - 0.08 * M * s;
      if (b.adulto) {
        // vidro transparente em cima e embaixo; faixa jateada (opaca) do peito às coxas — como box de verdade
        ctx.fillStyle = 'rgba(210,235,245,0.22)';
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        // a faixa acompanha o corpo de quem está no box: do peito ao meio da coxa (cabeça, ombros e canelas aparecem)
        const topo = this.eu.topWorld(), pe = this.eu.y - this.eu.elev, alt = pe - topo;
        const fy0 = topo + alt * 0.27, fy1 = topo + alt * 0.66;
        const g = ctx.createLinearGradient(0, fy0 - 14, 0, fy1 + 14);
        g.addColorStop(0, 'rgba(236,246,250,0.55)');
        g.addColorStop(0.08, 'rgba(236,246,250,0.97)');
        g.addColorStop(0.92, 'rgba(236,246,250,0.97)');
        g.addColorStop(1, 'rgba(236,246,250,0.55)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, fy0 - 14, x1 - x0, fy1 - fy0 + 28);
        ctx.strokeStyle = 'rgba(160,190,200,0.6)';
        ctx.lineWidth = 1;
        for (let y = fy0; y < fy1; y += 9) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      } else {
        // menores: cortina fechada (só a cabeça aparece por cima)
        const cTopo = Math.min(ch.y - 1.1 * M * s, this.eu.headWorld().y + 22 * this.eu.scale), alt = y1 - cTopo;
        ctx.fillStyle = '#7fb3d5';
        ctx.fillRect(x0, cTopo, x1 - x0, alt);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let x = x0 + 10; x < x1; x += 22) ctx.fillRect(x, cTopo, 8, alt);
        ctx.fillStyle = '#9aa7b0';
        ctx.fillRect(x0 - 4, cTopo - 6, x1 - x0 + 8, 6);
      }
      // vapor
      if (b.vapor > 0.02) {
        for (let i = 0; i < 7; i++) {
          const vx = x0 + 20 + ((i * 53) % (x1 - x0 - 40)), vy = y0 + 60 + ((i * 97 + t * 30) % 260);
          ctx.fillStyle = `rgba(255,255,255,${0.18 * b.vapor})`;
          ctx.beginPath(); ctx.arc(vx, vy, 30 + (i % 3) * 10, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
    // jato do xixi (sai por trás das mãos, cai na bacia)
    if (this.jato && this.sc.t < this.jato.ate) {
      const vaso = OBJETOS.find((o) => o.id === 'vaso')!;
      const h = this.eu.handWorld(true);
      const sv = escalaProf(vaso.y);
      const x0 = h.x + this.eu.facing * 6, y0 = h.y + 4, x1 = vaso.x + 15 * sv, y1 = vaso.y - 80 * sv;
      ctx.save();
      ctx.globalAlpha *= this.visibilidadeDeFora(this.eu.x, this.eu.y);
      ctx.strokeStyle = 'rgba(245,215,90,0.85)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.lineDashOffset = -this.sc.t * 90;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 6, Math.min(y0, y1) - 26, x1, y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ================================================================== fim do dia
  encerrarDia(motivo: ResumoDia['motivo']) {
    if (this.encerrado) return;
    this.encerrado = true;
    this.pararUso();
    const est = this.est, L = this.L;
    const resumo: ResumoDia = {
      dia: est.dias + 1, motivo, stats: {}, dinheiro: L.money - this.dinheiroIni, fitness: (L.fitness ?? 0) - this.fitnessIni,
      conheceu: [...this.conheceu].map((id) => this.npcs.find((n) => n.p.id === id)?.p.first ?? '').filter(Boolean),
      contatos: this.contatosNovos, momentos: this.momentos,
    };
    for (const k of Object.keys(L.stats) as StatKey[]) if (L.stats[k] !== this.statsIni[k]) resumo.stats[k] = L.stats[k] - this.statsIni[k];
    est.dias++;
    est.diasNoAno++;
    // novo dia: acorda às 7h; dormir de verdade repõe a energia
    est.hora = HORA_ACORDAR;
    est.nec.energia = motivo === 'dormiu' ? 100 : 55;
    est.nec.fome = Math.max(35, est.nec.fome - 20);
    est.x = PONTOS.inicioX;
    est.y = PONTOS.inicioY;
    if (motivo === 'apagou') addLog(L, 'Você apagou de sono longe da cama. Acordou todo(a) torto(a).', 'ruim', '😵');
    this.ui.fimDoDia(resumo);
  }
}

// ------------------------------------------------------------------ utilidades
/** prédio (casa/academia) cuja fachada cobre este x */
function predioEm(x: number) { return FACHADAS.find((f) => f.predio && x >= f.x0 && x <= f.x1)?.predio; }

function relTexto(p: Person) {
  const m: Record<string, string> = { mae: 'Mãe', pai: 'Pai', irmao: 'Irmão', irma: 'Irmã', conjuge: 'Cônjuge', filho: 'Filho', filha: 'Filha', namorado: 'Namorado', namorada: 'Namorada' };
  return m[p.rel] ?? 'Família';
}


/** Cria/atualiza o estado do modo explorar no save (novo ano zera os usos e a contagem de dias). */
export function prepararEstado(L: Life): EstadoExplorar {
  const e = (L.explorar ??= {
    dias: 0, diasNoAno: 0, anoRef: L.player.age, hora: HORA_ACORDAR,
    nec: { energia: 90, fome: 70, diversao: 70, social: 60, higiene: 80, bexiga: 70 }, usos: {}, frequentadores: {},
  });
  // saves anteriores às necessidades novas
  e.nec.higiene ??= 80;
  e.nec.bexiga ??= 70;
  if (e.anoRef !== L.player.age) {
    const passou = Math.max(0, L.player.age - e.anoRef);
    e.anoRef = L.player.age;
    e.diasNoAno = 0;
    e.usos = {};
    // frequentadores que ainda não são contato envelhecem junto (os contatos já envelhecem com L.people)
    for (const lista of Object.values(e.frequentadores)) for (const f of lista ?? []) if (!f.contato) f.pessoa.age += passou;
  }
  if (e.hora >= HORA_LIMITE || e.hora < 0) e.hora = HORA_ACORDAR;
  return e;
}
