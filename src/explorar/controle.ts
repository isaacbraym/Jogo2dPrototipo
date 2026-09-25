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
import {
  TRECHOS, OBJETOS, PINTORES, DESENHOS, DECORACAO, FLOOR, CHAO_FUNDO, CHAO_FRENTE, MUNDO_X0, MUNDO_X1, PONTOS, trechoEm, luz, coresCeu,
} from './mundo';
import {
  garantirFrequentadores, pessoaDe, nivelDe, INTERACOES_ESTRANHO, INTERACOES_CONTATO, classicasPara, FISICO_DE, PAPO_AMBIENTE,
  puxaConversa, mudarFam, type CtxInteracao, type InteracaoMundo, type Resultado, type Nivel,
} from './gente';
import { NECESSIDADES, type EstadoExplorar, type Frequentador, type ObjetoMundo, type AcaoObjeto, type LugarId, type Necessidade, type Trecho } from './tipos';

// ------------------------------------------------------------------ ritmo do tempo
/** minutos de jogo por segundo real andando pelo mundo */
export const MIN_POR_SEG = 1.5;
/** ações correm em avanço rápido: segundos reais = minutos / esta taxa (mínimo 2,4 s) */
export const AVANCO = 14;
/** quanto cada necessidade cai por hora de jogo */
export const QUEDA_HORA: Record<Necessidade, number> = { energia: 3.2, fome: 5, diversao: 3, social: 2.4 };
/** retorno decrescente: ganho × 1/(1 + usos no ano × fator) */
export const CANSACO_ANO = 0.1;
export const HORA_ACORDAR = 7 * 60;
export const HORA_LIMITE = 26 * 60; // 2h da manhã: apaga de sono

// ------------------------------------------------------------------ desenhos próprios registrados como props
for (const [id, fn] of Object.entries(DESENHOS)) {
  PROPS['explorar_' + id] = (ctx, _t, o) => fn(ctx, o as unknown as ObjetoMundo, 0);
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

const escalaProf = (y: number) => 0.9 + clamp((y - CHAO_FUNDO) / (CHAO_FRENTE - CHAO_FUNDO), 0, 1.2) * 0.18;

export class Explorador {
  sc: Scene;
  d: Director;
  eu: Actor;
  npcs: NpcVivo[] = [];
  est: EstadoExplorar;
  props = new Map<string, PlacedProp>();
  ocupado = new Map<string, Actor>();
  /** o que o jogador está fazendo */
  ocupadoEu: { obj: ObjetoMundo; acao: AcaoObjeto; t: number; dur: number } | null = null;
  private mover: { x: number; y: number; correr: boolean; depois?: () => void } | null = null;
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
  zoom = 1.08;

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
      fundo: (ctx, v, t) => {
        for (const tr of TRECHOS) {
          if (tr.x1 < v.x0 - 60 || tr.x0 > v.x1 + 60) continue;
          ctx.save();
          ctx.beginPath();
          ctx.rect(tr.x0, -200, tr.x1 - tr.x0, 1200);
          ctx.clip();
          PINTORES[tr.pintor]?.(ctx, tr, this.est.hora, t);
          ctx.restore();
        }
      },
      frente: (ctx, v) => this.desenharDestaques(ctx, v),
    };
    this.atualizarCeu();
    // objetos
    for (const o of OBJETOS) {
      const id = o.prop ?? 'explorar_' + o.desenho;
      const pp = this.sc.addProp(id, o.x, o.y, { z: 0, scale: o.escala ?? 1, opts: { ...(o.opts ?? {}), flip: o.flip } });
      this.props.set(o.id, pp);
    }
    // decoração (postes acendem à noite)
    for (const dc of DECORACAO) {
      const pp = this.sc.addProp(dc.prop, dc.x, dc.y, { z: 0, scale: dc.escala ?? 1, opts: { ...(dc.opts ?? {}) } });
      if (dc.acende) this.postes.push(pp);
    }
    this.atualizarCeu();
    // jogador
    const x0 = this.est.x ?? PONTOS.cama + 140;
    this.eu = this.sc.addActor(L.player.ap, L.player.age, { x: x0, y: 668, facing: 1, name: L.player.first, z: 0 });
    this.eu.scale = escalaProf(this.eu.y);
    this.popularCasa();
    this.popularPets();
    this.popularAcademia();
    this.sc.focus(this.eu.x, 360, this.zoom);
    this.sc.cam.x = this.sc.cam.tx;
    this.sc.cam.zoom = this.zoom;
    this.sc.onBeat = (dt) => this.tick(dt);
  }

  // ================================================================== consulta
  trechoAtual(): Trecho { return trechoEm(this.eu.x); }
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
    let melhor: ObjetoMundo | null = null;
    for (const o of OBJETOS) {
      const s = o.escala ?? 1;
      if (Math.abs(w.x - o.x) <= (o.w * s) / 2 && w.y <= o.y + 14 && w.y >= o.y - o.h * s) {
        if (!melhor || o.y > melhor.y) melhor = o;
      }
    }
    if (melhor) return { tipo: 'obj', obj: melhor };
    for (const pt of this.pets) if (Math.abs(w.x - pt.pp.x) < 60 && w.y <= pt.pp.y + 10 && w.y >= pt.pp.y - 90) return { tipo: 'pet', id: pt.id, nome: pt.nome };
    if (w.y >= FLOOR - 10) return { tipo: 'chao', x: w.x, y: clamp(w.y, CHAO_FUNDO, CHAO_FRENTE) };
    return { tipo: 'chao', x: w.x, y: this.eu.y };
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
    return nivelDe(n.f, pessoaDe(this.L, n.f!), this.L);
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
      ops.push({ id: 'oi', label: 'Cumprimentar', icon: '👋', run: () => this.interagirMundo(n, PASSANTE[0]) });
      ops.push({ id: 'horas', label: 'Perguntar as horas', icon: '⌚', run: () => this.interagirMundo(n, PASSANTE[1]) });
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
  irPara(x: number, y: number, correr = false, depois?: () => void) {
    // limites por idade (sair de casa, entrar na academia)
    const idade = this.L.player.age;
    let lim1 = MUNDO_X1 - 40;
    for (const tr of TRECHOS) if ((tr.minIdade ?? 0) > idade) { lim1 = Math.min(lim1, tr.x0 - 50); break; }
    if (x > lim1) {
      x = lim1;
      const bloq = TRECHOS.find((tr) => (tr.minIdade ?? 0) > idade);
      if (bloq) this.ui.aviso(bloq.lugar === 'academia' ? 'A academia só aceita a partir de 14 anos.' : 'Você ainda é novo(a) demais para sair sozinho(a).', 'info');
    }
    this.mover = { x: clamp(x, MUNDO_X0 + 40, MUNDO_X1 - 40), y, correr, depois };
  }

  private passo(a: Actor, alvo: { x: number; y: number; correr?: boolean }, dt: number, veloc = 1): boolean {
    const dx = alvo.x - a.x, dy = alvo.y - a.y;
    const dist = Math.hypot(dx, dy * 1.6);
    if (dist < 4) {
      if (a.motionName === 'andar' || a.motionName === 'correr') a.play('parado', { fade: 0.2 });
      return true;
    }
    const v = (alvo.correr ? 330 : 165) * veloc * dt;
    const k = Math.min(1, v / dist);
    a.x += dx * k;
    a.y += dy * k * 0.75;
    if (Math.abs(dx) > 2) a.facing = dx > 0 ? 1 : -1;
    const quer = alvo.correr ? 'correr' : 'andar';
    if (a.motionName !== quer) a.play(quer, { fade: 0.15 });
    return false;
  }

  pararUso() {
    if (!this.ocupadoEu) return;
    const { obj } = this.ocupadoEu;
    this.ocupadoEu = null;
    this.ocupado.delete(obj.id);
    this.eu.elev = 0;
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
    const quem = this.ocupado.get(o.id);
    if (o.exclusivo && quem && quem !== this.eu) return `Ocupado por ${quem.name || 'alguém'}.`;
    if (o.id.startsWith('esteira') || o.id.startsWith('supino') || o.id === 'rackPesos') if (!this.academiaAberta()) return 'A academia está fechada (6h às 23h).';
    return null;
  }

  usar(o: ObjetoMundo, ac: AcaoObjeto) {
    const b = this.bloqueio(o, ac);
    if (b) return this.ui.aviso(b, 'bad');
    this.pararUso();
    const sx = o.x + ac.dx, sy = clamp(o.y + (ac.dy ?? 0) + 28, CHAO_FUNDO, CHAO_FRENTE + 20);
    if (o.exclusivo) this.ocupado.set(o.id, this.eu);
    this.irPara(sx, sy, Math.abs(sx - this.eu.x) > 900, () => this.comecarUso(o, ac, sx, sy));
  }

  private comecarUso(o: ObjetoMundo, ac: AcaoObjeto, sx: number, sy: number) {
    const e = this.eu;
    e.x = sx;
    e.y = sy;
    e.facing = ac.lado ?? 1;
    if (ac.especial) return this.especial(o, ac);
    e.elev = ac.elev ?? 0;
    e.propN = ac.segura;
    e.play(ac.motion, { fade: 0.25 });
    const dur = Math.max(2.4, ac.minutos / AVANCO);
    this.ocupadoEu = { obj: o, acao: ac, t: 0, dur };
  }

  private terminarUso() {
    const u = this.ocupadoEu!;
    this.aplicarEfeito(u.acao.id, u.acao.efeito, u.acao.texto);
    this.pararUso();
    this.ui.atualizar();
  }

  private especial(o: ObjetoMundo, ac: AcaoObjeto) {
    const e = this.eu;
    if (ac.especial === 'dormir') {
      e.elev = 34;
      e.play('deitado', { fade: 0.3 });
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
          this.eu.y = 668;
          this.sc.cam.x = this.sc.cam.tx = x;
          this.sc.fadeTarget = 0;
          this.ui.aviso(`Você desceu em: ${nome}.`, 'info');
          this.ui.atualizar();
        }, 700);
      };
      const ops: OpcaoMenu[] = [
        { id: 'casa', label: 'Ir para casa', icon: '🏠', run: ir(PONTOS.portaCasa - 120, 'Casa') },
        { id: 'academia', label: 'Ir para a academia', icon: '🏋️', bloqueio: this.L.player.age < 14 ? 'A partir de 14 anos.' : undefined, run: ir(PONTOS.portaAcademia + 160, 'Academia') },
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
    if (para) this.soltarNpc(n);
    n.estado = 'interagindo';
    const lado = this.eu.x < n.ator.x ? -1 : 1;
    const gx = n.ator.x + lado * 150;
    await new Promise<void>((res) => this.irPara(gx, n.ator.y, Math.abs(gx - this.eu.x) > 700, res));
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
    if (r.tom === 'bom' && n.f && n.f.fam >= 35 && fam0 < 35) this.ui.aviso(`${n.p.first} agora é seu/sua colega de academia. Já dá para pedir o contato!`, 'ok');
  }

  private fimInteracao(n: NpcVivo) {
    this.emInteracao = false;
    this.eu.z = 0; n.ator.z = 0;
    this.eu.lookAt = null;
    n.ator.lookAt = null;
    this.eu.scale = escalaProf(this.eu.y);
    n.ator.scale = escalaProf(n.ator.y);
    if (n.estado === 'interagindo') { n.estado = 'pausa'; n.ate = this.sc.t + rng.range(1.5, 3); n.ator.play('parado', { fade: 0.3 }); }
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
      this.novoNpc(p, 'familia', 'casa', r.range(tr.x0 + 150, tr.x1 - 150), r.range(640, 690));
    });
  }

  /** Os pets da sua vida andam pela casa (clique para brincar). */
  pets: { pp: PlacedProp; alvo: number; ate: number; nome: string; id: string }[] = [];
  private popularPets() {
    const vivos = (this.L.pets ?? []).filter((p) => p.alive).slice(0, 2);
    vivos.forEach((pet, i) => {
      const x = 1900 + i * 900;
      const pp = this.sc.addProp(pet.kind, x, 690, { z: 0, scale: 0.9, opts: { color: pet.color } });
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
        pt.alvo = clamp(perto ? this.eu.x + rng.range(-160, 160) : pt.pp.x + rng.range(-350, 350), 120, PONTOS.portaCasa - 120);
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
    this.irPara(pt.pp.x - 90, 686, false, () => {
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
      const tr = r.chance(0.5) ? TRECHOS.find((t) => t.id === 'recepcao')! : TRECHOS.find((t) => t.id === 'pesos')!;
      this.novoNpc(p, 'frequentador', 'academia', r.range(tr.x0 + 250, tr.x1 - 200), r.range(640, 690), f);
    }
  }

  private soltarNpc(n: NpcVivo) {
    if (n.obj && this.ocupado.get(n.obj.id) === n.ator) this.ocupado.delete(n.obj.id);
    n.ator.elev = 0;
    n.ator.propN = undefined;
    n.obj = undefined;
    n.acao = undefined;
    if (n.estado === 'usando') n.ator.play('parado', { fade: 0.2 });
  }

  private pensarNpc(n: NpcVivo) {
    const t = this.sc.t;
    if (n.papel === 'passante') return;
    const daCasa = n.papel === 'familia';
    const objs = OBJETOS.filter((o) => (daCasa ? trechoEm(o.x).lugar === 'casa' : trechoEm(o.x).lugar === 'academia') && o.acoes.some((a) => !a.especial));
    const livres = objs.filter((o) => !o.exclusivo || !this.ocupado.has(o.id));
    const fav = n.f?.favorito;
    let o: ObjetoMundo | undefined;
    if (!daCasa && !this.academiaAberta()) {
      // academia fechando: todo mundo vai embora
      n.estado = 'saindo';
      n.alvo = { x: TRECHOS.find((tr) => tr.id === 'recepcao')!.x0 - 200, y: 668 };
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
      n.alvo = { x: clamp(n.ator.x + rng.range(-400, 400), tr.x0 + 80, tr.x1 - 80), y: rng.range(CHAO_FUNDO + 30, CHAO_FRENTE - 10) };
      n.depois = () => { n.estado = 'pausa'; n.ate = this.sc.t + rng.range(2, 5); };
      return;
    }
    const ac = rng.pick(o.acoes.filter((a) => !a.especial));
    if (o.exclusivo) this.ocupado.set(o.id, n.ator);
    n.obj = o;
    n.acao = ac;
    n.estado = 'indo';
    n.alvo = { x: o.x + ac.dx, y: clamp(o.y + (ac.dy ?? 0) + 28, CHAO_FUNDO, CHAO_FRENTE + 20) };
    n.depois = () => {
      const a = n.ator;
      a.x = n.alvo!.x; a.y = n.alvo!.y;
      a.facing = ac.lado ?? 1;
      a.elev = ac.elev ?? 0;
      a.propN = ac.segura;
      a.play(ac.motion, { fade: 0.25 });
      n.estado = 'usando';
      n.ate = this.sc.t + rng.range(12, 28);
    };
  }

  private tickNpcs(dt: number) {
    const t = this.sc.t;
    for (const n of [...this.npcs]) {
      const a = n.ator;
      a.scale = escalaProf(a.y);
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

  private removerNpc(n: NpcVivo) {
    this.soltarNpc(n);
    this.sc.removeActor(n.ator);
    this.npcs = this.npcs.filter((m) => m !== n);
  }

  /** Vida na rua: gente passando (dá para cumprimentar). */
  private tickPassantes(dt: number) {
    const tr = this.trechoAtual();
    if (tr.lugar !== 'rua') return;
    this.proxPassante -= dt;
    if (this.proxPassante > 0 || this.npcs.filter((n) => n.papel === 'passante').length >= 3) return;
    this.proxPassante = rng.range(7, 14);
    const daDireita = rng.chance(0.5);
    const x0 = daDireita ? this.sc.view.x1 + 120 : this.sc.view.x0 - 120;
    const ruas = TRECHOS.filter((t) => t.lugar === 'rua');
    const minX = ruas[0].x0 + 40, maxX = ruas[ruas.length - 1].x1 - 40;
    const p = makePerson(rng, { age: rng.int(12, 80), rel: 'conhecido', bond: 30 });
    const n = this.novoNpc(p, 'passante', 'rua', clamp(x0, minX, maxX), rng.range(CHAO_FUNDO + 20, CHAO_FRENTE));
    n.estado = 'indo';
    n.alvo = { x: daDireita ? minX : maxX, y: n.ator.y };
    if (rng.chance(0.25)) n.ator.propN = rng.pick(['celular', 'sacola', 'guardaChuva']);
  }

  /** Um frequentador toma a iniciativa de falar com você. */
  private tickIniciativa(dt: number) {
    this.proxIniciativa -= dt;
    if (this.proxIniciativa > 0 || this.emInteracao || this.ocupadoEu || this.mover) return;
    this.proxIniciativa = rng.range(20, 40);
    const perto = this.npcs.filter((n) => n.papel === 'frequentador' && (n.estado === 'pausa' || n.estado === 'livre') && Math.abs(n.ator.x - this.eu.x) < 650);
    if (!perto.length) return;
    const n = rng.pick(perto);
    n.estado = 'indo';
    n.alvo = { x: this.eu.x + (n.ator.x > this.eu.x ? 140 : -140), y: this.eu.y };
    n.depois = () => {
      if (this.emInteracao) return;
      n.ator.facing = this.eu.x > n.ator.x ? 1 : -1;
      this.eu.facing = n.ator.x > this.eu.x ? 1 : -1;
      this.d.say(n.ator, puxaConversa(n.p, n.f!), 2.4);
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
    const falas = n.papel === 'familia' ? FALAS_CASA : n.estado === 'usando' ? ['Mais uma!', 'Uff...', 'Queima!', 'Só mais três...'] : PAPO_AMBIENTE;
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
    const tr = trechoEm(this.eu?.x ?? 0);
    const { noite } = luz(this.est.hora);
    this.sc.night = noite * (tr.interno ? 0.18 : 0.42);
    if (this.sc.mundo) { this.sc.mundo.corTopo = c.topo; this.sc.mundo.corBase = '#222'; }
  }

  // ================================================================== laço principal
  private tick(dt: number) {
    if (this.encerrado) return;
    const e = this.eu;
    // uso de objeto em andamento: tempo corre acelerado
    if (this.ocupadoEu) {
      const u = this.ocupadoEu;
      u.t += dt;
      this.avancar((u.acao.minutos * dt) / u.dur);
      this.ui.progresso(Math.min(1, u.t / u.dur), u.acao.label);
      if (u.t >= u.dur) this.terminarUso();
    } else {
      this.avancar(dt * MIN_POR_SEG);
    }
    if (this.mover && !this.emInteracao) {
      const cansado = this.est.nec.energia < 10 ? 0.7 : 1;
      if (this.passo(e, this.mover, dt, cansado)) {
        const dep = this.mover.depois;
        this.mover = null;
        dep?.();
      }
    } else if (this.mover && this.emInteracao) {
      if (this.passo(e, this.mover, dt)) { const dep = this.mover.depois; this.mover = null; dep?.(); }
    }
    e.scale = escalaProf(e.y);
    if (this.direcao && (this.direcao.x || this.direcao.y) && !this.emInteracao && !this.ocupadoEu) {
      this.mover = { x: e.x + this.direcao.x * 90, y: clamp(e.y + this.direcao.y * 40, CHAO_FUNDO, CHAO_FRENTE), correr: this.direcao.correr };
    }
    this.tickNpcs(dt);
    this.tickPets(dt);
    this.tickPassantes(dt);
    if (this.trechoAtual().lugar === 'academia') this.tickIniciativa(dt);
    this.tickPapo(dt);
    // câmera segue
    this.sc.focus(e.x, 360, this.zoom);
    this.est.x = e.x;
    if (this.est.hora >= HORA_LIMITE) this.encerrarDia('apagou');
  }

  pararTeclado() { if (this.mover && !this.mover.depois) this.mover = { ...this.mover, x: this.eu.x, y: this.eu.y }; }
  /** direção do teclado (setas/WASD); a interface atualiza */
  direcao: { x: number; y: number; correr: boolean } | null = null;

  /** contorno do objeto sob o ponteiro (destaque) */
  destaque: ObjetoMundo | null = null;
  private desenharDestaques(ctx: CanvasRenderingContext2D, _v: { x0: number; x1: number }) {
    const o = this.destaque;
    if (!o) return;
    const s = o.escala ?? 1;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,140,0.9)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 3;
    ctx.strokeRect(o.x - (o.w * s) / 2, o.y - o.h * s, o.w * s, o.h * s + 10);
    ctx.restore();
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
    est.x = PONTOS.cama + 140;
    if (motivo === 'apagou') addLog(L, 'Você apagou de sono longe da cama. Acordou todo(a) torto(a).', 'ruim', '😵');
    this.ui.fimDoDia(resumo);
  }
}

// ------------------------------------------------------------------ utilidades
function relTexto(p: Person) {
  const m: Record<string, string> = { mae: 'Mãe', pai: 'Pai', irmao: 'Irmão', irma: 'Irmã', conjuge: 'Cônjuge', filho: 'Filho', filha: 'Filha', namorado: 'Namorado', namorada: 'Namorada' };
  return m[p.rel] ?? 'Família';
}

const FALAS_CASA = ['Alguém viu o controle?', 'Quem comeu meu iogurte?', 'Apaga a luz do quarto!', 'Tem janta hoje?', 'Essa novela tá boa demais.'];

const PASSANTE: InteracaoMundo[] = [
  {
    id: 'oiPassante', label: 'Cumprimentar', icon: '👋', para: false, pode: () => true,
    run: () => ({ eu: 'Bom dia!', ela: rng.pick(['Bom dia!', '*acena de volta*', 'Opa!', 'Te conheço?']), texto: 'Você cumprimentou alguém na rua. Gentileza de graça.', tom: 'bom', reacaoNpc: 'acenar', social: 2 }),
  },
  {
    id: 'horas', label: 'Perguntar as horas', icon: '⌚', para: false, pode: () => true,
    run: () => ({ eu: 'Com licença, que horas são?', ela: rng.pick(['Tá no seu celular, meu bem.', 'Hora de você comprar um relógio.', 'Sei lá, meu celular morreu.', 'Umas... três? Quatro?']), texto: 'Você perguntou as horas. Recebeu sabedoria.', tom: 'neutro', diversao: 2, social: 1 }),
  },
];

/** Cria/atualiza o estado do modo explorar no save (novo ano zera os usos e a contagem de dias). */
export function prepararEstado(L: Life): EstadoExplorar {
  const e = (L.explorar ??= {
    dias: 0, diasNoAno: 0, anoRef: L.player.age, hora: HORA_ACORDAR,
    nec: { energia: 90, fome: 70, diversao: 70, social: 60 }, usos: {}, frequentadores: {},
  });
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
