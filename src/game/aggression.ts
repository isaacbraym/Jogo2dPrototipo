import { Outcome } from './types';
import { Life, Person, stat, bond, addLog, parents, living, money, he, enrollSchool, leaveJobPeople } from './state';
import { rng } from '../core/rng';
import { careerById } from './careers';
import { mem, lembrar, encerrarRelacao } from './relacoes';

export type AggroKind = 'xingar' | 'empurrar' | 'jogarBebida' | 'humilhar' | 'pegadinha' | 'tapa' | 'roubar' | 'soco' | 'chute' | 'cabecada';

export const AGGRO: Record<AggroKind, { sev: number; label: string; icon: string }> = {
  xingar: { sev: 1, label: 'Xingar', icon: '🤬' },
  pegadinha: { sev: 1, label: 'Pegadinha', icon: '🪑' },
  empurrar: { sev: 2, label: 'Empurrar', icon: '✋' },
  jogarBebida: { sev: 2, label: 'Jogar bebida na cara', icon: '🥤' },
  humilhar: { sev: 2, label: 'Humilhar em público', icon: '🫵' },
  tapa: { sev: 3, label: 'Dar um tapa', icon: '🖐️' },
  roubar: { sev: 3, label: 'Roubar a carteira', icon: '👛' },
  soco: { sev: 4, label: 'Dar um soco', icon: '👊' },
  chute: { sev: 4, label: 'Dar um chute', icon: '🦵' },
  cabecada: { sev: 5, label: 'Dar uma cabeçada', icon: '🤕' },
};

type Ctx = 'trabalho' | 'escola' | 'familia' | 'casal' | 'rua';

export function contextOf(L: Life, p: Person): Ctx {
  if (p.rel === 'chefe' || p.rel === 'colegaTrab') return 'trabalho';
  if (p.rel === 'professor' || (p.rel === 'colega' && L.player.age < 18)) return 'escola';
  if (['namorado', 'namorada', 'conjuge'].includes(p.rel)) return 'casal';
  if (['mae', 'pai', 'irmao', 'irma', 'filho', 'filha', 'avo', 'avoM'].includes(p.rel)) return 'familia';
  return 'rua';
}

export function envFor(L: Life, ctx: Ctx, p: Person): string {
  if (ctx === 'trabalho') return careerById(L.job?.id ?? '')?.env ?? 'escritorio';
  if (ctx === 'escola') return p.rel === 'professor' ? 'escola' : 'patio';
  if (ctx === 'familia' || ctx === 'casal') return rng.pick(['sala', 'cozinha']);
  return L.player.age >= 18 ? rng.pick(['boteco', 'ruaDia', 'ruaNoite']) : 'parque';
}

const O = (text: string, tone: Outcome['tone'], extra: Partial<Outcome> = {}): Outcome => ({ text, tone, ...extra });

/** Encadeia uma lista de consequências (cada uma com cena própria). */
function chain(list: Outcome[]): Outcome {
  for (let i = list.length - 2; i >= 0; i--) list[i].next = list[i + 1];
  return list[0];
}

const INJURIES = ['nariz quebrado', 'olho roxo', 'dente a menos', 'costela trincada', 'galo do tamanho de um ovo', 'dedo torcido'];
const CURSES = ['Seu verme!', 'Vai catar coquinho!', 'Mala sem alça!', 'Pé de pano!', 'Cara de mamão!', 'Sua anta!'];

/** Executa uma agressão e devolve a cadeia de consequências. */
export function aggress(L: Life, p: Person, kind: AggroKind): Outcome {
  const { sev } = AGGRO[kind];
  const ctx = contextOf(L, p);
  const env = envFor(L, ctx, p);
  const age = L.player.age;
  const traitsAngry = p.traits.some((t) => ['rabugento', 'mandão', 'ciumento', 'aventureiro'].includes(t));
  const traitsSoft = p.traits.some((t) => ['tímido', 'gentil'].includes(t));
  const kidVsParent = age < 18 && ['mae', 'pai'].includes(p.rel);
  const victimFrail = p.age > 70 || p.age < 8;

  // esquiva
  const dodged = sev >= 3 && kind !== 'roubar' && rng.chance(0.12 + (p.age < 40 ? 0.08 : 0) - L.fitness / 800);
  // dano na vítima
  const injured = !dodged && sev >= 4 && rng.chance(0.35 + (victimFrail ? 0.4 : 0) + (kind === 'cabecada' ? 0.2 : 0));
  const injury = injured ? rng.pick(INJURIES) : '';
  // revide
  let retaliate = false;
  if (!kidVsParent && !victimFrail && kind !== 'roubar') {
    // memória: mágoa acumulada deixa a vítima mais disposta a revidar; medo a deixa encolhida
    const mm = mem(p);
    const pr = 0.22 + (traitsAngry ? 0.28 : 0) - (traitsSoft ? 0.15 : 0) + sev * 0.05 - (injured ? 0.35 : 0) + (dodged ? 0.25 : 0) + mm.rancor / 250 - mm.medo / 180;
    retaliate = rng.chance(Math.max(0.03, pr));
  }
  const roubado = kind === 'roubar' && !rng.chance(0.3) ? rng.int(2, 40) * 10 : 0;
  const caughtStealing = kind === 'roubar' && roubado === 0;

  // efeitos imediatos
  bond(p, -(sev * 9 + rng.int(3, 10)));
  L.karma -= sev * 3;
  // a vítima lembra (mágoa, medo, confiança) — ver game/relacoes.ts
  lembrar(L, p, kind === 'humilhar' ? 'humilhacao' : 'agressao', kind === 'humilhar' ? 2 : sev, `Agressão: ${AGGRO[kind].label.toLowerCase()}.`);
  if (injured) addLog(L, `${p.first} ficou com ${injury} por minha causa.`, 'ruim', '🩹');
  if (roubado) L.money += roubado;
  let dmg = 0;
  if (retaliate) {
    dmg = rng.int(5, 12) + sev * 2 + (p.age > 18 && p.age < 45 ? 4 : 0);
    stat(L, 'saude', -dmg);
    stat(L, 'aparencia', -rng.int(0, 3));
  }
  stat(L, 'felicidade', traitsAngry ? -2 : -4);

  const verb: Record<AggroKind, string> = {
    xingar: `Você soltou um "${rng.pick(CURSES)}" na cara de ${p.first}.`,
    pegadinha: `Você puxou a cadeira de ${p.first}, que foi de bunda no chão.`,
    empurrar: `Você empurrou ${p.first} sem cerimônia.`,
    jogarBebida: `Você jogou a bebida inteira na cara de ${p.first}.`,
    humilhar: `Você humilhou ${p.first} na frente de todo mundo. A plateia riu. ${p.first} não.`,
    tapa: `PÁ! Um tapa estalado na cara de ${p.first}.`,
    roubar: caughtStealing ? `Você tentou afanar a carteira de ${p.first}... e foi pego(a) com a mão na massa.` : `Você afanou ${money(roubado)} da carteira de ${p.first}. Ninguém viu. Ainda.`,
    soco: dodged ? `Você mandou um soco em ${p.first}... que desviou. Constrangedor.` : `Você acertou um soco em ${p.first}.`,
    chute: dodged ? `Você tentou chutar ${p.first} e quase deslocou o quadril.` : `Você deu um chute em ${p.first}.`,
    cabecada: dodged ? `Cabeçada no vazio. Você quase desmaiou sozinho(a).` : `CABEÇADA! O barulho foi de coco partindo.`,
  };
  let text = verb[kind];
  if (injured) text += ` Resultado: ${p.first} saiu com ${injury}.`;
  if (retaliate) text += ` Só que ${p.first} revidou com gosto e você levou a pior (-${dmg} de saúde).`;
  else if (sev >= 2 && !injured && !kidVsParent) text += ` ${p.first} ficou ${he(p, 'furioso', 'furiosa')} e jurou vingança.`;

  const list: Outcome[] = [];
  list.push(O(text, 'ruim', {
    title: dodged ? 'Errou feio' : retaliate ? 'Deu ruim pra você' : 'Agressão',
    icon: AGGRO[kind].icon,
    scene: { id: 'agressao', others: [p], data: { kind, env, retaliate, injured, dodged, caught: caughtStealing, ctx } },
    mood: retaliate || injured ? 'ferido' : 'tenso',
  }));

  if (retaliate && L.stats.saude < 25) {
    list.push(O('A surra foi tão feia que você terminou o dia no pronto-socorro.', 'ruim', {
      title: 'Pronto-socorro', icon: '🚑',
      scene: { id: 'medico', data: { good: false, titulo: 'Pronto-socorro', fala: 'Quem fez isso com você?! ...Ah, você começou? Tá.' } },
    }));
    L.money -= 1200;
  }

  // ---------------- consequências de contexto
  if (ctx === 'escola') {
    const inf = ((L.flags.infracoes as number) ?? 0) + (sev >= 2 ? 1 : 0.5);
    L.flags.infracoes = inf;
    parents(L).forEach((pp) => bond(pp, -4 - sev));
    if (inf >= 5) {
      L.flags.expulsoes = ((L.flags.expulsoes as number) ?? 0) + 1;
      L.flags.infracoes = 0;
      L.edu.nota = Math.max(0, L.edu.nota - 25);
      stat(L, 'inteligencia', -4);
      stat(L, 'felicidade', -10);
      addLog(L, 'Fui EXPULSO(A) da escola. Minha mãe vai me matar.', 'ruim', '🚪');
      enrollSchool(L);
      list.push(O('A diretora perdeu a paciência: você foi EXPULSO(A). Agora vai estudar numa escola do outro lado da cidade, onde ninguém te conhece — ainda.', 'ruim', {
        title: 'Expulsão!', icon: '🚪', log: false,
        scene: { id: 'diretoria', others: parents(L).slice(0, 1), data: { tipo: 'expulsao' } },
      }));
    } else if (inf >= 3) {
      stat(L, 'felicidade', -6);
      L.edu.nota = Math.max(0, L.edu.nota - 10);
      list.push(O(`Suspensão de ${rng.int(3, 7)} dias. Seus pais foram chamados na diretoria e a cara deles dizia "a gente conversa em casa".`, 'ruim', {
        title: 'Suspensão', icon: '📋',
        scene: { id: 'diretoria', others: parents(L).slice(0, 1), data: { tipo: 'suspensao' } },
      }));
    } else {
      list.push(O('Detenção: uma tarde inteira escrevendo "não devo agredir colegas" no quadro. Sua letra nunca foi tão bonita.', 'ruim', {
        title: 'Detenção', icon: '📝',
        scene: { id: 'detencao', data: { frase: 'Não devo agredir colegas' } },
      }));
    }
  } else if (ctx === 'trabalho' && L.job) {
    const isBoss = p.rel === 'chefe';
    const adv = ((L.flags.advertencias as number) ?? 0) + 1;
    L.flags.advertencias = adv;
    L.job.perf = Math.max(0, L.job.perf - sev * 10);
    const fired = isBoss ? rng.chance(sev >= 2 ? 0.9 : 0.55) : adv >= 2 || (sev >= 3 && rng.chance(0.6));
    if (fired) {
      const title = L.job.title;
      L.job = null;
      L.flags.advertencias = 0;
      L.people.filter((x) => x.rel === 'chefe' || x.rel === 'colegaTrab').forEach((x) => (x.rel = 'conhecido'));
      stat(L, 'felicidade', -12);
      addLog(L, `Demitido(a) por justa causa do cargo de ${title}.`, 'ruim', '📦');
      list.push(O(`${isBoss ? 'Agredir o chefe: estratégia ousada de carreira. ' : ''}Demissão por JUSTA CAUSA. Sem aviso prévio, sem FGTS, sem dignidade — o segurança te acompanhou até a porta com sua caixinha de pertences.`, 'ruim', {
        title: 'Justa causa', icon: '📦', log: false,
        scene: { id: 'demissaoSeguranca', data: { env: envFor(L, 'trabalho', p) } },
      }));
    } else {
      list.push(O('Advertência formal por escrito. O RH marcou uma reunião de "alinhamento de conduta". Próxima dessas, é rua.', 'ruim', {
        title: 'Advertência', icon: '⚠️',
        scene: { id: 'reflexao', data: { titulo: 'Advertência do RH', env: 'escritorio', motion: 'humilhado' } },
      }));
    }
  } else if (ctx === 'familia') {
    living(L).filter((x) => ['mae', 'pai', 'irmao', 'irma', 'filho', 'filha'].includes(x.rel) && x !== p).forEach((x) => bond(x, -sev * 3));
    if (kidVsParent) {
      list.push(O('Castigo: sem celular, sem videogame, sem sobremesa, sem direitos humanos. Por um mês.', 'ruim', {
        title: 'Castigo', icon: '🔒',
        scene: { id: 'brigaFamilia', others: [p] },
      }));
    }
  } else if (ctx === 'casal' && (sev >= 3 || mem(p).rancor >= 70 || mem(p).agressoes >= 3)) {
    // violência na relação: agressão física grave termina na hora; agressões "menores" repetidas também (a memória acumula)
    const extra = encerrarRelacao(L, p, 'parceiro', { consensual: false });
    bond(p, -30);
    list.push(O(`${p.first} fez as malas na mesma noite.${sev < 3 ? ' Não foi uma vez só — foi a gota d’água.' : ''} Relação acabou — e com razão. ${extra}`.trim(), 'ruim', {
      title: 'Fim da relação', icon: '💔',
      scene: { id: 'termino', others: [p] },
    }));
  }

  // ---------------- polícia (adultos)
  if (age >= 18 && (sev >= 3 || caughtStealing)) {
    const pPol = (injured ? 0.55 : 0.15) + sev * 0.06 + (ctx === 'casal' ? 0.3 : 0) + (caughtStealing ? 0.35 : 0);
    if (rng.chance(pPol)) {
      L.crime.ficha += 1;
      const multa = rng.int(5, 30) * 100;
      L.money -= multa;
      if (injured && (L.crime.ficha >= 3 || rng.chance(0.25))) {
        const pena = rng.int(1, 3);
        L.crime.preso = true;
        L.crime.pena = pena;
        stat(L, 'felicidade', -20);
        if (L.job) { addLog(L, `Perdi o emprego de ${L.job.title}: ninguém segura vaga pra presidiário.`, 'ruim', '📦'); L.job = null; leaveJobPeople(L); }
        addLog(L, `Condenado(a) por lesão corporal: ${pena} ano(s) de prisão.`, 'ruim', '⛓️');
        list.push(O(`${p.first} prestou queixa. Laudo do IML + testemunhas = condenação por lesão corporal. ${pena} ano(s) de cadeia pra refletir.`, 'ruim', {
          title: 'Condenado(a)', icon: '⚖️', log: false,
          scene: { id: 'julgamento', data: { guilty: true, fala: `Culpado(a) por lesão corporal! ${pena} ano(s) de reclusão.` } },
          next: O('Bem-vindo(a) ao seu novo endereço. O café é ruim e o colega de cela ronca.', 'ruim', { title: 'Cela', icon: '⛓️', scene: { id: 'cela', data: { sub: `${pena} ano(s) de pena` } }, log: false }),
        }));
      } else {
        addLog(L, `Boletim de ocorrência registrado. Multa de ${money(multa)}.`, 'ruim', '🚓');
        list.push(O(`${p.first} foi direto pra delegacia. Boletim de ocorrência, ficha suja e ${money(multa)} de multa/advogado.`, 'ruim', {
          title: 'Delegacia', icon: '🚓', log: false,
          scene: { id: 'boletim', others: [p] },
        }));
      }
    }
  }
  return chain(list);
}
