/**
 * Memória de relacionamento: cada pessoa LEMBRA do que o jogador fez com ela.
 *
 * O vínculo (`bond`) diz o quanto a pessoa gosta de você HOJE. A memória diz POR QUÊ — e limita o que um gesto
 * genérico consegue consertar. Quem apanhou de você não aceita "consolo" de quem bateu; desculpas repetidas depois
 * de novas agressões perdem o valor; o tempo cura devagar; gratidão amortece mágoas.
 *
 * Save: `Person.memo` é opcional e criado sob demanda (saves antigos continuam válidos). Ver docs/RELACIONAMENTOS.md.
 */
import { Life, Person, bond, stat, addLog, he, money, children } from './state';
import { rng } from '../core/rng';
import { clamp } from '../core/math';

export interface FatoMemoria { idade: number; tipo: TipoFato; texto: string }

export interface Memoria {
  /** mágoa acumulada com o jogador (0..100) */
  rancor: number;
  /** medo do jogador — nasce de violência física (0..100) */
  medo: number;
  /** gratidão por apoio, presentes, favores (0..100) */
  gratidao: number;
  /** quanto acredita no que o jogador promete (0..100) */
  confianca: number;
  /** nº de agressões sofridas */
  agressoes: number;
  /** idade do JOGADOR na última agressão */
  ultimaAgressao?: number;
  /** desculpas aceitas / recusadas */
  desculpas: number;
  desculpasRecusadas: number;
  /** desculpas aceitas seguidas de nova agressão */
  promessasQuebradas: number;
  ultimaDesculpa?: number;
  /** cortou contato: recusa quase tudo até a mágoa baixar */
  afastado?: boolean;
  /** gestos positivos no ano corrente (evita "farmar" vínculo) */
  gestos?: { idade: number; n: number };
  // ---- romance
  noivado?: number;
  casamento?: number;
  divorcio?: number;
  terminos?: number;
  reconciliacoes?: number;
  /** últimos fatos marcantes (mais novo por último) */
  fatos: FatoMemoria[];
}

export type TipoFato =
  | 'agressao' | 'humilhacao' | 'discussao' | 'desculpaAceita' | 'desculpaRecusada' | 'presente' | 'apoio' | 'favor'
  | 'termino' | 'reconciliacao' | 'noivado' | 'casamento' | 'divorcio' | 'pedidoRecusado' | 'traicao' | 'rejeicao';

/** Memória da pessoa (cria com valores neutros coerentes com o vínculo atual). */
export function mem(p: Person): Memoria {
  if (!p.memo) {
    p.memo = {
      rancor: p.bond < 20 ? 25 : 0, medo: 0, gratidao: p.bond > 80 ? 15 : 0, confianca: clamp(Math.round(45 + (p.bond - 50) * 0.5), 10, 90),
      agressoes: 0, desculpas: 0, desculpasRecusadas: 0, promessasQuebradas: 0, fatos: [],
    };
  }
  return p.memo;
}

const lim = (v: number) => clamp(Math.round(v), 0, 100);

/** Registra um fato e ajusta os sentimentos. `sev` = intensidade (agressão: 1–5). */
export function lembrar(L: Life, p: Person, tipo: TipoFato, sev = 1, texto?: string) {
  const m = mem(p);
  const idade = L.player.age;
  // gratidão amortece mágoas pequenas (até 30%)
  const amortece = 1 - Math.min(0.3, m.gratidao / 300);
  switch (tipo) {
    case 'agressao': {
      if (m.ultimaDesculpa !== undefined && (m.ultimaAgressao === undefined || m.ultimaDesculpa >= m.ultimaAgressao)) m.promessasQuebradas++;
      m.agressoes++;
      m.ultimaAgressao = idade;
      m.rancor = lim(m.rancor + (8 + sev * 11) * amortece + m.agressoes * 3);
      if (sev >= 2) m.medo = lim(m.medo + sev * 9 + (m.agressoes > 2 ? 10 : 0));
      m.confianca = lim(m.confianca - (6 + sev * 5));
      m.gratidao = lim(m.gratidao - sev * 6);
      break;
    }
    case 'humilhacao': m.rancor = lim(m.rancor + 18 * amortece); m.confianca = lim(m.confianca - 8); break;
    case 'discussao': m.rancor = lim(m.rancor + 5 * amortece); break;
    case 'traicao': m.rancor = lim(m.rancor + 45); m.confianca = lim(m.confianca - 50); break;
    case 'rejeicao': case 'pedidoRecusado': m.rancor = lim(m.rancor + 12 * amortece); break;
    case 'termino': m.rancor = lim(m.rancor + 10 + p.bond / 5); m.terminos = (m.terminos ?? 0) + 1; break;
    case 'divorcio': m.rancor = lim(m.rancor + 15 + p.bond / 4); m.divorcio = idade; break;
    case 'desculpaAceita': {
      m.desculpas++;
      m.ultimaDesculpa = idade;
      m.rancor = lim(m.rancor - rng.int(12, 22) / (1 + m.promessasQuebradas * 0.6));
      m.medo = lim(m.medo - 6);
      m.confianca = lim(m.confianca + 3);
      break;
    }
    case 'desculpaRecusada': m.desculpasRecusadas++; break;
    case 'presente': m.gratidao = lim(m.gratidao + 5); break;
    case 'apoio': m.gratidao = lim(m.gratidao + 4); m.rancor = lim(m.rancor - 2); break;
    case 'favor': m.gratidao = lim(m.gratidao + 12 * sev); m.confianca = lim(m.confianca + 5); break;
    case 'reconciliacao': m.reconciliacoes = (m.reconciliacoes ?? 0) + 1; m.rancor = lim(m.rancor * 0.6); break;
    case 'noivado': m.noivado = idade; break;
    case 'casamento': m.casamento = idade; m.noivado = undefined; break;
  }
  if (texto) {
    m.fatos.push({ idade, tipo, texto });
    if (m.fatos.length > 12) m.fatos.splice(0, m.fatos.length - 12);
  }
  aplicarAfastamento(L, p);
  limitarVinculo(p);
}

/** Teto de vínculo: quem guarda mágoa ou medo não volta a te amar 100%. */
export function tetoVinculo(p: Person): number {
  const m = mem(p);
  return clamp(Math.round(100 - m.rancor * 0.75 - m.medo * 0.35), 5, 100);
}
export function limitarVinculo(p: Person) {
  const t = tetoVinculo(p);
  if (p.bond > t) p.bond = t;
}

function aplicarAfastamento(L: Life, p: Person) {
  const m = mem(p);
  if (!m.afastado && m.rancor >= 85 && m.agressoes >= 2 && p.bond <= 15) {
    m.afastado = true;
    addLog(L, `${p.first} cortou contato comigo. Não atende, não responde, bloqueou em tudo.`, 'ruim', '🚫');
  }
}

// ------------------------------------------------------------------------------------------ reações
export type TipoGesto = 'carinho' | 'conversa' | 'romance' | 'consolo' | 'pedido' | 'diversao';

export interface Reacao { aceita: boolean; fator: number; motivo?: 'afastado' | 'causador' | 'medo' | 'magoa' | 'cansou' | 'frio'; texto?: string; nota?: string }

/** Anos desde a última agressão do jogador contra a pessoa (Infinity se nunca). */
export function anosDesdeAgressao(L: Life, p: Person) {
  const m = mem(p);
  return m.ultimaAgressao === undefined ? Infinity : L.player.age - m.ultimaAgressao;
}

/**
 * Decide se a pessoa aceita um gesto positivo e quanto ele vale (fator 0..1 sobre o ganho de vínculo).
 * Regras: afastamento bloqueia; quem você machucou recusa consolo; medo recusa contato físico; mágoa reduz o efeito
 * e pode recusar; gestos repetidos no mesmo ano rendem cada vez menos.
 */
export function reacao(L: Life, p: Person, gesto: TipoGesto): Reacao {
  const m = mem(p);
  const nome = p.first;
  const recente = anosDesdeAgressao(L, p) <= 1;
  if (m.afastado) return { aceita: false, fator: 0, motivo: 'afastado', texto: rng.pick([`${nome} cortou contato com você. A mensagem ficou com um tique só.`, `${nome} te viu de longe e atravessou a rua.`, `${nome} mandou dizer que não quer conversa. Nem por carta.`]) };
  if (gesto === 'consolo' && (recente || m.rancor >= 35)) {
    return { aceita: false, fator: 0, motivo: 'causador', texto: rng.pick([`Consolar ${nome}? Você é o motivo do choro. ${he(p, 'Ele', 'Ela')} se afastou sem dizer nada.`, `"Agora você quer me consolar? Foi VOCÊ quem me machucou." — ${nome}, saindo da sala.`, `${nome} recusou o ombro amigo. Difícil aceitar consolo de quem causou o estrago.`]) };
  }
  if ((gesto === 'carinho' || gesto === 'romance') && m.medo >= 40 && rng.chance(0.4 + m.medo / 200)) {
    return { aceita: false, fator: 0, motivo: 'medo', texto: rng.pick([`${nome} se encolheu quando você chegou perto. O medo ainda está ali.`, `${nome} deu um passo pra trás. Depois de tudo, qualquer movimento seu assusta.`]) };
  }
  // chance de recusar pela mágoa (atenuada por gratidão e vínculo)
  const pRecusa = clamp((m.rancor - 15) / 100 + (recente ? 0.25 : 0) - m.gratidao / 250 - p.bond / 400, 0, 0.92);
  if (rng.chance(pRecusa)) {
    return { aceita: false, fator: 0, motivo: 'magoa', texto: rng.pick([`${nome} te olhou com frieza: "Não é assim que se resolve."`, `${nome} até ouviu, mas não quis papo. A mágoa falou mais alto.`, `${nome} respondeu com um "hum" que doeu mais que um grito.`]) };
  }
  // cansaço: muitos gestos no mesmo ano
  const g = m.gestos && m.gestos.idade === L.player.age ? m.gestos.n : 0;
  if (g >= 5 && rng.chance(0.15 * (g - 4))) return { aceita: false, fator: 0, motivo: 'cansou', texto: `${nome} pediu um tempo: "Calma, você já veio aqui ${g} vezes este ano."` };
  let fator = 1 / (1 + 0.45 * g);
  fator *= 1 - m.rancor / 130;
  if (m.medo > 20) fator *= 1 - m.medo / 200;
  fator = clamp(fator, 0.05, 1);
  let nota: string | undefined;
  if (m.rancor >= 30) nota = `(${nome} ainda guarda mágoa: o gesto ajudou pouco.)`;
  else if (g >= 3) nota = `(De tanto repetir, o gesto já não tem o mesmo efeito.)`;
  return { aceita: true, fator, nota };
}

export function contarGesto(L: Life, p: Person) {
  const m = mem(p);
  if (!m.gestos || m.gestos.idade !== L.player.age) m.gestos = { idade: L.player.age, n: 0 };
  m.gestos.n++;
}

/** Chance de aceitar um pedido de desculpas (0..1). */
export function chanceDesculpas(L: Life, p: Person) {
  const m = mem(p);
  const mesmoAno = m.ultimaDesculpa === L.player.age;
  let c = 0.5 + p.bond / 250 - m.rancor / 140 - m.promessasQuebradas * 0.14 - m.medo / 400 + m.gratidao / 400 + (p.traits.includes('gentil') ? 0.15 : 0) - (p.traits.includes('rabugento') ? 0.12 : 0);
  if (mesmoAno) c -= 0.2;
  if (m.afastado) c -= 0.3;
  return clamp(c, 0.03, 0.92);
}

/** Etiquetas para a interface (o que a pessoa sente e por quê). */
export function descreverMemoria(p: Person): { texto: string; tom: 'bom' | 'ruim' | 'neutro' }[] {
  if (!p.memo) return [];
  const m = p.memo;
  const out: { texto: string; tom: 'bom' | 'ruim' | 'neutro' }[] = [];
  if (m.afastado) out.push({ texto: '🚫 Cortou contato', tom: 'ruim' });
  if (m.rancor >= 60) out.push({ texto: '💢 Muita mágoa', tom: 'ruim' });
  else if (m.rancor >= 25) out.push({ texto: '😒 Magoado(a)', tom: 'ruim' });
  if (m.medo >= 40) out.push({ texto: '😨 Tem medo de você', tom: 'ruim' });
  if (m.confianca <= 25) out.push({ texto: '🤨 Não confia em você', tom: 'ruim' });
  else if (m.confianca >= 80) out.push({ texto: '🤝 Confia muito', tom: 'bom' });
  if (m.gratidao >= 40) out.push({ texto: '🙏 Grato(a)', tom: 'bom' });
  if (m.promessasQuebradas >= 2) out.push({ texto: `🧩 ${m.promessasQuebradas} promessas quebradas`, tom: 'ruim' });
  if (m.noivado !== undefined) out.push({ texto: '💍 Noivado', tom: 'bom' });
  if (m.divorcio !== undefined) out.push({ texto: `⚖️ Divorciados aos ${m.divorcio}`, tom: 'neutro' });
  return out;
}

// ------------------------------------------------------------------------------------------ passagem do tempo
/** Chamado 1x por ano pelo motor anual: o tempo cura (devagar) e a pensão é paga. */
export function relacoesAnual(L: Life, note: (t: string, tom: 'bom' | 'ruim' | 'neutro' | 'especial', icone: string) => void) {
  for (const p of L.people) {
    if (!p.alive || !p.memo) continue;
    const m = p.memo;
    const rabugento = p.traits.includes('rabugento');
    const semAgressaoRecente = anosDesdeAgressao(L, p) >= 2;
    m.rancor = lim(m.rancor - (semAgressaoRecente ? (rabugento ? 3 : 6) : 1));
    m.medo = lim(m.medo - (semAgressaoRecente ? 7 : 2));
    m.gratidao = lim(m.gratidao - 3);
    if (semAgressaoRecente && m.confianca < 55) m.confianca = lim(m.confianca + 2);
    if (m.afastado && m.rancor < 40) { m.afastado = false; note(`${p.first} voltou a falar comigo. Frio, mas falou.`, 'neutro', '📞'); }
    limitarVinculo(p);
  }
  // pensão alimentícia: filhos menores de um casamento desfeito
  const pensao = L.flags.pensaoDesde !== undefined ? children(L).filter((k) => k.alive && k.age < 18).length : 0;
  if (pensao > 0) {
    const valor = Math.round(Math.max(3000, (L.job?.salary ?? 0) * 0.08) * pensao);
    L.money -= valor;
    note(`Paguei ${money(valor)} de pensão alimentícia este ano.`, 'neutro', '🧾');
  } else if (L.flags.pensaoDesde !== undefined) delete L.flags.pensaoDesde;
}

/** Aplica os efeitos de um fim de relação (usado pela interação, eventos e pelo motor anual). */
export function encerrarRelacao(L: Life, p: Person, quem: 'jogador' | 'parceiro', o: { consensual?: boolean; semDiario?: boolean } = {}): string {
  const m = mem(p);
  const eraCasamento = p.rel === 'conjuge';
  const textos: string[] = [];
  if (eraCasamento) {
    lembrar(L, p, 'divorcio', 1, quem === 'jogador' ? 'Você pediu o divórcio.' : `${p.first} pediu o divórcio.`);
    const advogado = o.consensual ? 1500 : 6000;
    L.money -= advogado;
    textos.push(`Advogado e cartório: ${money(advogado)}.`);
    if (L.money > 0) {
      const parte = Math.round(L.money * (o.consensual ? 0.5 : rng.range(0.4, 0.65)));
      L.money -= parte;
      textos.push(`Partilha: ${money(parte)} ficaram com ${p.first}.`);
    }
    if (L.assets.casa) {
      const casa = L.assets.casa;
      if (rng.chance(0.5)) { L.money += Math.round(casa.valor / 2); delete L.assets.casa; textos.push(`A casa foi vendida e dividida (${money(Math.round(casa.valor / 2))} para você).`); }
      else textos.push('Você ficou com a casa. E com o financiamento.');
    }
    const menores = children(L).filter((k) => k.alive && k.age < 18);
    for (const k of children(L)) bond(k, -rng.int(6, 16));
    if (menores.length) { L.flags.pensaoDesde = L.player.age; textos.push(`Pensão alimentícia para ${menores.length} filho(s) até os 18.`); }
    stat(L, 'felicidade', o.consensual ? -8 : -15);
  } else {
    lembrar(L, p, 'termino', 1, quem === 'jogador' ? 'Você terminou o namoro.' : `${p.first} terminou o namoro.`);
    stat(L, 'felicidade', quem === 'jogador' ? -5 : -10);
  }
  m.noivado = undefined;
  p.rel = 'ex';
  bond(p, -(o.consensual ? 10 : 25));
  if (!o.semDiario) addLog(L, eraCasamento ? `Divórcio de ${p.first}. ${textos.join(' ')}` : `Fim do namoro com ${p.first}.`, 'ruim', eraCasamento ? '⚖️' : '💔');
  return textos.join(' ');
}

/** Idade mínima e diferença aceitável para romance (evita pares inadequados). */
export function podeNamorar(L: Life, p: Person) {
  const a = L.player.age, b = p.age;
  if (a < 14 || b < 14) return false;
  if (a < 18 || b < 18) return a < 18 && b < 18 && Math.abs(a - b) <= 2;
  return Math.abs(a - b) <= Math.max(8, Math.min(a, b) * 0.4);
}
