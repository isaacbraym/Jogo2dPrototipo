/**
 * Esteira: executa a lógica VERDADEIRA do jogo (EVENTS / INTERACTIONS / ACTIONS / aggress / startInterview,
 * outcomeFromEvent, registrarResultado, checkAchievements) sobre uma vida isolada, com semente fixa.
 *
 * Execução = função pura (cenário, semente, caminho de escolhas). Cada clique recalcula tudo do início,
 * o que garante que "repetir com a mesma semente" dá o mesmo resultado observável.
 */
import { EVENTS } from '../game/events';
import { ACTIONS, INTERACTIONS } from '../game/activities';
import { CAREERS } from '../game/careers';
import { startInterview } from '../game/interviews';
import { outcomeFromEvent, evChoices, registrarResultado, resolveAction, isPending } from '../game/life';
import { checkAchievements } from '../game/achievements';
import { addLog, Life, playerCast, cast } from '../game/state';
import { Outcome, PendingEvent, SceneReq } from '../game/types';
import type { CastMember } from '../scenes/situations';
import { Cenario, clone, diffVida, Mudanca, motivosEvento, Motivo, estadoObservavel, pessoaPorId } from './vida';
import { comSemente, hashDe } from './det';

export interface CenaCapturada { id: string; data: Record<string, any>; player: CastMember; others: CastMember[]; othersNomes: string[] }

export interface Passo {
  tipo: 'elegibilidade' | 'abertura' | 'decisao' | 'resultado' | 'conquista' | 'bloqueio' | 'erro' | 'pendente';
  ramo: string; // ex.: "raiz", "raiz›next", "raiz›followUp[0]"
  nivel: number;
  titulo: string;
  texto: string;
  icone?: string;
  tom?: string;
  cena?: CenaCapturada;
  react?: Outcome['react'];
  mood?: string;
  escolhas?: { rotulo: string; icone?: string; ok: boolean; idx: number }[];
  escolhida?: number;
  decisao?: number; // índice da decisão no caminho
  mudancas?: Mudanca[];
  motivos?: Motivo[];
  forcado?: string[];
  eventoId?: string;
  outcomeRef?: Outcome;
}

export interface Execucao {
  passos: Passo[];
  pendente: { decisao: number; eventoId: string; escolhas: NonNullable<Passo['escolhas']> } | null;
  inicial: Life;
  final: Life;
  mudancasTotais: Mudanca[];
  forcada: string[];
  hash: string;
  assinatura: string; // resumo dos desfechos (para agrupar sementes)
  observados: { de: string; para: string; detalhe: string }[];
}

const capturarCena = (L: Life, req: SceneReq | undefined): CenaCapturada | undefined => {
  if (!req) return undefined;
  return { id: req.id, data: clone(req.data ?? {}), player: clone(playerCast(L)), others: (req.others ?? []).map((p) => clone(cast(p))), othersNomes: (req.others ?? []).map((p) => `${p.first} (${p.rel})`) };
};

export function executar(cen: Cenario): Execucao {
  return comSemente(cen.semente, () => executarInterno(cen));
}

function executarInterno(cen: Cenario): Execucao {
  const L: Life = clone(cen.vida);
  const inicial = clone(L);
  const passos: Passo[] = [];
  const forcada: string[] = [];
  const observados: Execucao['observados'] = [];
  let decisao = 0;
  let pendente: Execucao['pendente'] = null;
  const alvoChave = `${cen.alvo.tipo}:${cen.alvo.id}`;

  const snap = () => clone(L);

  const processarResultado = (o: Outcome, ramo: string, nivel: number, origem: string, antes: Life) => {
    registrarResultado(L, o); // exatamente o que a tela do jogo faz
    const cena = capturarCena(L, o.scene);
    if (cena) {
      observados.push({ de: origem, para: `cena:${cena.id}`, detalhe: `Outcome.scene${Object.keys(cena.data).length ? ' data=' + JSON.stringify(cena.data) : ''}` });
      if (cena.id === 'interacao' && cena.data.action) observados.push({ de: `cena:interacao`, para: `acaoCorporal:${cena.data.action}`, detalhe: 'data.action' });
      if (cena.data.env) observados.push({ de: `cena:${cena.id}`, para: `ambiente:${cena.data.env}`, detalhe: 'data.env' });
    }
    for (const lado of ['npc', 'player'] as const) {
      const r = o.react?.[lado];
      if (r?.motion) observados.push({ de: origem, para: `movimento:${r.motion}`, detalhe: `react.${lado}.motion` });
      if (r?.expr) observados.push({ de: origem, para: `expressao:${r.expr}`, detalhe: `react.${lado}.expr` });
      if (r?.emote) observados.push({ de: origem, para: `emote:${r.emote}`, detalhe: `react.${lado}.emote` });
    }
    passos.push({
      tipo: 'resultado', ramo, nivel, titulo: o.title ?? (o.tone === 'bom' ? 'Deu certo!' : o.tone === 'ruim' ? 'Que pena...' : o.tone === 'especial' ? 'Momento especial!' : 'Resultado'),
      texto: o.text + (o.skipCard ? '\n[sem cartão: skipCard]' : ''), icone: o.icon, tom: o.tone, cena, react: o.react, mood: o.mood,
      mudancas: diffVida(antes, L), outcomeRef: o,
    });
    if (o.next) processarResultado(o.next, ramo + '›next', nivel + 1, origem, snap());
    if (o.followUp) {
      observados.push({ de: origem, para: `evento-cadeia:${o.followUp.ev.id}`, detalhe: 'followUp' });
      processarPendente(o.followUp, ramo + '›followUp', nivel + 1);
    }
  };

  const processarPendente = (pe: PendingEvent, ramo: string, nivel: number): boolean => {
    if (pendente) return false;
    const ev = pe.ev;
    const cenaAb = capturarCena(L, ev.scene?.(L, pe.ctx));
    const titulo = typeof ev.title === 'function' ? ev.title(L, pe.ctx) : ev.title;
    const escolhas = ev.choices ? evChoices(L, pe).map((c) => ({ rotulo: c.c.label, icone: c.c.icon, ok: c.ok, idx: c.i })) : undefined;
    const origemEv = EVENTS.includes(ev) ? `evento:${ev.id}` : alvoChave;
    if (cenaAb) observados.push({ de: origemEv, para: `cena:${cenaAb.id}`, detalhe: 'LifeEvent.scene (abertura)' });
    passos.push({ tipo: 'abertura', ramo, nivel, titulo, texto: ev.text(L, pe.ctx), icone: ev.icon, cena: cenaAb, escolhas, eventoId: ev.id });
    let idx: number | null = null;
    if (ev.choices?.length) {
      const d = decisao++;
      const pedido = cen.caminho[d];
      if (pedido === undefined) {
        pendente = { decisao: d, eventoId: ev.id, escolhas: escolhas! };
        passos.push({ tipo: 'pendente', ramo, nivel, titulo: 'Aguardando escolha', texto: `Decisão ${d + 1}: escolha uma opção de "${titulo}".`, escolhas, decisao: d, eventoId: ev.id });
        return false;
      }
      const esc = escolhas!.find((e) => e.idx === pedido);
      if (!esc) { passos.push({ tipo: 'erro', ramo, nivel, titulo: 'Escolha inexistente', texto: `O caminho pede a escolha ${pedido}, mas o evento tem ${escolhas!.length}.` }); return false; }
      const forcadaEsc: string[] = [];
      if (!esc.ok) {
        if (!cen.forcar.escolhaDesabilitada) { passos.push({ tipo: 'bloqueio', ramo, nivel, titulo: 'Escolha desabilitada', texto: `"${esc.rotulo}" está desabilitada nesta vida (cond da escolha = falso). Marque "forçar escolha desabilitada" para executá-la mesmo assim.` }); return false; }
        forcadaEsc.push('escolha desabilitada executada');
        forcada.push(`escolha "${esc.rotulo}" desabilitada`);
      }
      passos.push({ tipo: 'decisao', ramo, nivel, titulo: `Escolha ${pedido + 1}: ${esc.rotulo}`, texto: '', escolhida: pedido, decisao: d, forcado: forcadaEsc, eventoId: ev.id, escolhas });
      if (EVENTS.includes(ev)) observados.push({ de: `evento:${ev.id}`, para: `escolha:${ev.id}#${pedido}`, detalhe: 'escolhida na execução' });
      idx = pedido;
    }
    const antes = snap();
    let o: Outcome;
    try {
      o = outcomeFromEvent(L, pe, idx);
    } catch (e) {
      passos.push({ tipo: 'erro', ramo, nivel, titulo: 'Exceção na lógica do jogo', texto: (e as Error).stack ?? String(e) });
      return false;
    }
    const origem = idx !== null && EVENTS.includes(ev) ? `escolha:${ev.id}#${idx}` : origemEv;
    processarResultado(o, ramo, nivel, origem, antes);
    return true;
  };

  try {
    switch (cen.alvo.tipo) {
      case 'evento': {
        const ev = EVENTS.find((e) => e.id === cen.alvo.id);
        if (!ev) { passos.push({ tipo: 'erro', ramo: 'raiz', nivel: 0, titulo: 'Evento inexistente', texto: cen.alvo.id }); break; }
        const motivos = motivosEvento(L, ev);
        const falhas = motivos.filter((m) => !m.ok);
        const forcaveis: Record<string, boolean | undefined> = { idade: cen.forcar.idade, unica: cen.forcar.unica, condicao: cen.forcar.condicao, peso: cen.forcar.condicao, preso: cen.forcar.condicao };
        const naoForcadas = falhas.filter((m) => !forcaveis[m.chave]);
        passos.push({ tipo: 'elegibilidade', ramo: 'raiz', nivel: 0, titulo: falhas.length ? (naoForcadas.length ? 'Indisponível nesta vida' : 'FORÇADA com condição ignorada') : 'Elegível no sorteio anual', texto: motivos.map((m) => `${m.ok ? '✔' : '✘'} ${m.rotulo}: ${m.detalhe}`).join('\n'), motivos, forcado: falhas.filter((m) => forcaveis[m.chave]).map((m) => m.rotulo) });
        if (naoForcadas.length) { passos.push({ tipo: 'bloqueio', ramo: 'raiz', nivel: 0, titulo: 'Não executado', texto: 'Monte os pré-requisitos (painel ao lado) ou marque os itens a ignorar em "Forçar". Execuções forçadas são identificadas como tal.' }); break; }
        for (const f of falhas) forcada.push(`${f.rotulo}: ${f.detalhe}`);
        let ctx: any = {};
        if (ev.setup) {
          ctx = ev.setup(L);
          if (ctx === null) { passos.push({ tipo: 'bloqueio', ramo: 'raiz', nivel: 0, titulo: 'setup(L) devolveu null', texto: 'O próprio evento cancelou a execução nesta vida (ex.: pessoa necessária não existe). Não é forçável: ajuste a vida.' }); break; }
        }
        if (ev.once) L.flags['ev_' + ev.id] = 1; // o sorteio anual marca antes de apresentar
        processarPendente({ ev, ctx }, 'raiz', 0);
        break;
      }
      case 'interacao':
      case 'agressao': {
        const id = cen.alvo.tipo === 'agressao' ? 'agg_' + cen.alvo.id : cen.alvo.id;
        const it = INTERACTIONS.find((i) => i.id === id);
        const p = pessoaPorId(L, cen.alvo.pessoaId);
        if (!it) { passos.push({ tipo: 'erro', ramo: 'raiz', nivel: 0, titulo: 'Interação inexistente', texto: id }); break; }
        if (!p) { passos.push({ tipo: 'bloqueio', ramo: 'raiz', nivel: 0, titulo: 'Escolha a pessoa-alvo', texto: 'Interações precisam de uma pessoa da vida (aba Pessoas do cenário).' }); break; }
        const ok = it.cond(L, p) && p.alive;
        passos.push({ tipo: 'elegibilidade', ramo: 'raiz', nivel: 0, titulo: ok ? 'Disponível no menu da pessoa' : cen.forcar.condicao ? 'FORÇADA com condição ignorada' : 'Indisponível para esta pessoa', texto: `cond(L, ${p.first} [${p.rel}, ${p.age} anos, vínculo ${p.bond}]) = ${it.cond(L, p)}${p.alive ? '' : ' · pessoa morta'}`, forcado: !ok && cen.forcar.condicao ? ['condição'] : [] });
        if (!ok && !cen.forcar.condicao) break;
        if (!ok) forcada.push('condição da interação ignorada');
        L.yearsActions++;
        const antes = snap();
        const o = it.run(L, p);
        processarResultado(o, 'raiz', 0, `interacao:${id}`, antes);
        break;
      }
      case 'acao': {
        const a = ACTIONS.find((x) => x.id === cen.alvo.id);
        if (!a) { passos.push({ tipo: 'erro', ramo: 'raiz', nivel: 0, titulo: 'Ação inexistente', texto: cen.alvo.id }); break; }
        const idadeOk = L.player.age >= a.minAge && (a.maxAge === undefined || L.player.age <= a.maxAge);
        const condOk = !a.cond || a.cond(L);
        const ok = idadeOk && condOk;
        passos.push({ tipo: 'elegibilidade', ramo: 'raiz', nivel: 0, titulo: ok ? 'Disponível na aba Atividades' : cen.forcar.condicao ? 'FORÇADA com condição ignorada' : 'Indisponível', texto: `idade ${L.player.age} (mín ${a.minAge}${a.maxAge !== undefined ? ', máx ' + a.maxAge : ''}) ${idadeOk ? '✔' : '✘'} · cond ${condOk ? '✔' : '✘'}` });
        if (!ok && !cen.forcar.condicao) break;
        if (!ok) forcada.push('condição/idade da ação ignoradas');
        const antes = snap();
        const r = resolveAction(L, a); // cobra custo como o jogo
        if (typeof r === 'string') { passos.push({ tipo: 'bloqueio', ramo: 'raiz', nivel: 0, titulo: 'O jogo recusou a ação', texto: r }); break; }
        if (isPending(r)) processarPendente(r, 'raiz', 0);
        else processarResultado(r, 'raiz', 0, `acao:${a.id}`, antes);
        break;
      }
      case 'entrevista': {
        const c = CAREERS.find((x) => x.id === cen.alvo.id);
        if (!c) { passos.push({ tipo: 'erro', ramo: 'raiz', nivel: 0, titulo: 'Carreira inexistente', texto: cen.alvo.id }); break; }
        passos.push({ tipo: 'elegibilidade', ramo: 'raiz', nivel: 0, titulo: 'Entrevista', texto: `Inteligência ${L.stats.inteligencia} (exige ${c.smarts}) · aparência ${L.stats.aparencia}${c.looks ? ` (exige ${c.looks})` : ''} · ficha ${L.crime.ficha}` });
        processarPendente(startInterview(L, c), 'raiz', 0);
        break;
      }
    }
  } catch (e) {
    passos.push({ tipo: 'erro', ramo: 'raiz', nivel: 0, titulo: 'Exceção na lógica do jogo', texto: (e as Error).stack ?? String(e) });
  }

  if (!pendente && passos.some((p) => p.tipo === 'resultado')) {
    // a tela do jogo verifica conquistas ao fim de cada cadeia (e registra no diário)
    const antes = snap();
    const got = checkAchievements(L);
    for (const a of got) addLog(L, `Conquista desbloqueada: ${a.name}`, 'especial', a.icon);
    if (got.length) passos.push({ tipo: 'conquista', ramo: 'fim', nivel: 0, titulo: 'Conquistas', texto: got.map((a) => `${a.icon} ${a.name}`).join(', '), mudancas: diffVida(antes, L) });
  }

  const final = clone(L);
  const obs = estadoObservavel(final);
  const assinatura = passos.filter((p) => p.tipo === 'resultado' || p.tipo === 'bloqueio' || p.tipo === 'erro').map((p) => `${p.titulo}|${p.cena?.id ?? '-'}|${JSON.stringify(p.cena?.data ?? {})}`).join(' ⟶ ');
  return { passos, pendente, inicial, final, mudancasTotais: diffVida(inicial, final), forcada, hash: hashDe({ obs, passos: passos.map((p) => [p.tipo, p.titulo, p.texto, p.cena?.id, p.cena?.data]) }), assinatura, observados };
}

/** Explora sementes para o mesmo cenário+caminho, agrupando desfechos distintos. */
export function explorarSementes(cen: Cenario, de: number, ate: number) {
  const grupos = new Map<string, { assinatura: string; sementes: number[]; exemplo: Execucao }>();
  for (let s = de; s <= ate; s++) {
    const ex = executar({ ...cen, semente: s });
    const g = grupos.get(ex.assinatura);
    if (g) g.sementes.push(s);
    else grupos.set(ex.assinatura, { assinatura: ex.assinatura, sementes: [s], exemplo: ex });
  }
  return [...grupos.values()].sort((a, b) => b.sementes.length - a.sementes.length);
}

/** Todos os caminhos de escolha até uma profundidade (para "percorrer todas as escolhas"). */
export function todosOsCaminhos(cen: Cenario, maxDecisoes = 6, limite = 200): number[][] {
  const out: number[][] = [];
  const fila: number[][] = [[]];
  while (fila.length && out.length < limite) {
    const cam = fila.shift()!;
    const ex = executar({ ...cen, caminho: cam });
    if (!ex.pendente || cam.length >= maxDecisoes) { out.push(cam); continue; }
    for (const e of ex.pendente.escolhas) if (e.ok || cen.forcar.escolhaDesabilitada) fila.push([...cam, e.idx]);
  }
  return out;
}
