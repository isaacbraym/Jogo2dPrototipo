/**
 * Modo Explorar — GENTE: frequentadores que você reencontra, níveis de relação e as interações de cada nível.
 *
 * Caminho de uma amizade (ver docs/EXPLORAR.md):
 *   Desconhecido(a) → Rosto conhecido → Colega de academia → (pegar o contato) → Contato → Amigo(a) → Melhor amigo(a)
 * Antes do contato a relação vive em `Frequentador.fam` (familiaridade). Ao pegar o contato, a pessoa entra em `L.people`
 * (aparece na aba Relações) e passa a usar o sistema normal de vínculo e memória (`bond`, `memo`, INTERACTIONS).
 */
import { RNG, rng } from '../core/rng';
import { Life, Person, makePerson, stat, bond, addLog, he } from '../game/state';
import { INTERACTIONS } from '../game/activities';
import { lembrar, podeNamorar } from '../game/relacoes';
import type { EstadoExplorar, Frequentador, LugarId } from './tipos';

// ------------------------------------------------------------------ níveis
export interface Nivel { n: number; nome: string; cor: string }
export const NIVEIS: Nivel[] = [
  { n: 0, nome: 'Desconhecido(a)', cor: '#9aa0b0' },
  { n: 1, nome: 'Rosto conhecido', cor: '#7fb3d5' },
  { n: 2, nome: 'Colega de academia', cor: '#58b368' },
  { n: 3, nome: 'Contato', cor: '#f2c14e' },
  { n: 4, nome: 'Amigo(a)', cor: '#e8845a' },
  { n: 5, nome: 'Melhor amigo(a)', cor: '#e8335a' },
];

/** Nível da relação: antes do contato vem da familiaridade; depois, do vínculo. */
export function nivelDe(f: Frequentador | undefined, p: Person, L: Life, lugar: LugarId = 'academia'): Nivel {
  const naVida = L.people.includes(p);
  if (naVida) {
    if (['namorado', 'namorada', 'conjuge'].includes(p.rel)) return { n: 5, nome: p.rel === 'conjuge' ? 'Cônjuge' : 'Namoro', cor: '#e8335a' };
    if (p.bond >= 80) return NIVEIS[5];
    if (p.bond >= 50 || p.rel === 'amigo' || p.rel === 'amiga') return NIVEIS[4];
    return NIVEIS[3];
  }
  const fam = f?.fam ?? 0;
  // O nível 2 é o mesmo progresso, mas recebe um nome coerente com o lugar onde a relação nasceu.
  if (fam >= 35) return lugar === 'rua' ? { ...NIVEIS[2], nome: 'Conhecido(a) do bairro' } : NIVEIS[2];
  return fam >= 15 ? NIVEIS[1] : NIVEIS[0];
}

// ------------------------------------------------------------------ frequentadores
const FAVORITOS = ['esteira', 'supino', 'rackPesos'];

/** Gera (uma vez) os frequentadores de um lugar. Eles envelhecem com você e continuam lá nos próximos anos. */
export function garantirFrequentadores(L: Life, est: EstadoExplorar, lugar: LugarId): Frequentador[] {
  const lista = (est.frequentadores[lugar] ??= []);
  if (lista.length) return lista;
  if (lugar === 'academia') {
    const r = new RNG(L.seed + 77);
    const base = Math.max(16, L.player.age);
    for (let i = 0; i < 7; i++) {
      const idade = Math.max(16, Math.min(70, base + r.int(-10, 16) + (i === 6 ? 25 : 0)));
      const p = makePerson(r, { age: idade, rel: 'conhecido', bond: 20 });
      lista.push({ pessoa: p, fam: 0, nomeConhecido: false, encontros: 0, contato: false, assiduidade: r.range(0.45, 0.9), favorito: r.pick(FAVORITOS) });
    }
  } else if (lugar === 'rua') {
    // Moradores usam outra semente para não duplicar a "turma" da academia e persistem no save.
    const r = new RNG(L.seed + 177);
    for (let i = 0; i < 10; i++) {
      const idade = i >= 8 ? r.int(62, 84) : r.int(12, 61);
      const p = makePerson(r, { age: idade, rel: 'conhecido', bond: 20 });
      lista.push({ pessoa: p, fam: 0, nomeConhecido: false, encontros: 0, contato: false, assiduidade: r.range(0.48, 0.92) });
    }
  }
  return lista;
}

/** A Person "de verdade" de um frequentador (se virou contato, é a que está em L.people). */
export function pessoaDe(L: Life, f: Frequentador): Person {
  if (!f.contato) return f.pessoa;
  return L.people.find((p) => p.id === f.pessoa.id) ?? f.pessoa;
}

/** Familiaridade muda devagar e trava em 100. */
export function mudarFam(f: Frequentador, d: number) {
  f.fam = Math.max(0, Math.min(100, Math.round(f.fam + d)));
}

// ------------------------------------------------------------------ interações do mundo
export interface CtxInteracao {
  L: Life;
  est: EstadoExplorar;
  p: Person;
  f?: Frequentador;
  /** a pessoa está usando um equipamento agora (dá para conversar sem ela parar) */
  ocupada?: string;
  lugar: LugarId;
  /** quantas vezes esta interação já foi feita com esta pessoa HOJE */
  hoje: number;
}

export interface Resultado {
  /** fala do jogador (balão) */
  eu?: string;
  /** resposta da pessoa */
  ela?: string;
  /** resumo para o registro/toast */
  texto: string;
  tom: 'bom' | 'ruim' | 'neutro';
  /** animação física de dois (physical) ou reação da pessoa (movimento) */
  fisico?: string;
  reacaoNpc?: string;
  expr?: string;
  social?: number;
  diversao?: number;
  /** contato recém-adicionado */
  novoContato?: boolean;
}

export interface InteracaoMundo {
  id: string;
  label: string;
  icon: string;
  /** a pessoa precisa parar o que está fazendo? (false = dá para falar com ela treinando) */
  para: boolean;
  pode: (c: CtxInteracao) => boolean;
  run: (c: CtxInteracao) => Resultado;
}

const traco = (p: Person, t: string) => p.traits.includes(t);
const nomeOu = (c: CtxInteracao) => (c.f && !c.f.nomeConhecido ? he(c.p, 'ele', 'ela') : c.p.first);

/** Interações de quem ainda NÃO é contato (desconhecidos e rostos conhecidos). */
export const INTERACOES_ESTRANHO: InteracaoMundo[] = [
  {
    id: 'cumprimentar', label: 'Cumprimentar', icon: '👋', para: false,
    pode: (c) => !!c.f && c.hoje === 0,
    run: (c) => {
      const f = c.f!;
      const frio = traco(c.p, 'rabugento') || traco(c.p, 'tímido');
      mudarFam(f, frio ? 3 : rng.int(4, 7));
      const caloroso = c.lugar === 'academia'
        ? ['E aí! Bom treino!', 'Opa, beleza?', 'Oiê!', 'Fala! Tudo certo?']
        : ['Bom dia!', 'Opa, tudo certo?', 'E aí, vizinhança!', 'Oi! Que mundo pequeno.'];
      const ela = frio ? rng.pick(['*aceno mínimo*', 'Hm.', 'Oi.']) : rng.pick(caloroso);
      return { eu: rng.pick(['Opa, bom dia!', 'E aí, tudo bem?', 'Oi!']), ela, texto: `Você cumprimentou ${nomeOu(c)}.`, tom: 'bom', reacaoNpc: 'acenar', social: 3 };
    },
  },
  {
    id: 'apresentar', label: 'Se apresentar', icon: '🤝', para: true,
    pode: (c) => !!c.f && !c.f.nomeConhecido,
    run: (c) => {
      const f = c.f!;
      f.nomeConhecido = true;
      mudarFam(f, rng.int(8, 12));
      const apelido = c.lugar === 'academia' ? 'o(a) que sempre ocupa o supino' : 'o(a) fiscal não oficial da calçada';
      const ela = traco(c.p, 'tímido') ? `Ah... prazer. ${c.p.first}.` : traco(c.p, 'engraçado') ? `${c.p.first}. Mas pode me chamar de "${apelido}".` : `Prazer, eu sou ${he(c.p, 'o', 'a')} ${c.p.first}!`;
      return { eu: `Oi! Eu sou ${c.L.player.first}.`, ela, texto: `Você conheceu ${c.p.first}.`, tom: 'bom', fisico: 'apertoMao', social: 6 };
    },
  },
  {
    id: 'papoTreino', label: 'Puxar papo sobre o treino', icon: '💬', para: false,
    pode: (c) => !!c.f && c.lugar === 'academia' && c.hoje < 2,
    run: (c) => {
      const f = c.f!;
      if (c.ocupada && traco(c.p, 'rabugento')) {
        mudarFam(f, -3);
        return { eu: 'Treina aqui faz tempo?', ela: 'Tô no meio da série, meu anjo.', texto: `${nomeOu(c)} não gostou de ser interrompido(a) no meio da série.`, tom: 'ruim', reacaoNpc: 'bracosCruzados', social: -2 };
      }
      mudarFam(f, rng.int(6, 10));
      const ela = rng.pick([
        'Uns dois anos. Antes eu só pagava e não vinha.',
        'Comecei esse mês. Tô vivo(a) por teimosia.',
        'Desde que o médico falou a palavra "colesterol".',
        'Faz tempo. Mas meu shape tá em manutenção desde 2019.',
      ]);
      return { eu: rng.pick(['Treina aqui faz tempo?', 'Esse aparelho é bom mesmo?', 'Hoje tá cheio, hein?']), ela, texto: `Você e ${nomeOu(c)} conversaram sobre treino.`, tom: 'bom', social: 7 };
    },
  },
  {
    id: 'elogiarTreino', label: 'Elogiar a disciplina', icon: '🌟', para: false,
    pode: (c) => !!c.f && c.lugar === 'academia',
    run: (c) => {
      const f = c.f!;
      if (c.hoje >= 1) {
        mudarFam(f, -6);
        return { eu: 'Cê manda muito, sério.', ela: 'Tá... obrigado(a) de novo?', texto: `Elogiar duas vezes no mesmo dia ficou estranho. ${nomeOu(c)} se afastou um pouquinho.`, tom: 'ruim', reacaoNpc: 'nervoso', expr: 'desconfiado' };
      }
      mudarFam(f, rng.int(5, 8));
      return { eu: 'Admiro sua disciplina, viu?', ela: rng.pick(['Opa, valeu! Tô tentando!', 'Sério? Hoje eu quase não vim!', 'Ah, que isso... obrigado(a)!']), texto: `${nomeOu(c)} ficou sem graça com o elogio.`, tom: 'bom', expr: 'envergonhado', social: 4 };
    },
  },
  {
    id: 'pedirDica', label: 'Pedir uma dica de treino', icon: '🏋️', para: false,
    pode: (c) => !!c.f && c.f.fam >= 15 && c.lugar === 'academia' && c.hoje === 0,
    run: (c) => {
      const f = c.f!;
      mudarFam(f, rng.int(6, 9));
      stat(c.L, 'inteligencia', 1);
      c.L.fitness = Math.min(100, (c.L.fitness ?? 0) + 1);
      const ela = rng.pick([
        'Desce devagar e sobe forte. E respira, pelo amor.',
        'Coluna reta. Sua lombar vai te agradecer aos 40.',
        'Carga é consequência. Técnica primeiro.',
        'Come proteína. E dorme. O resto é marketing.',
      ]);
      return { eu: 'Posso te pedir uma dica?', ela, texto: `${nomeOu(c)} te deu uma dica de treino que realmente ajudou.`, tom: 'bom', social: 5 };
    },
  },
  {
    id: 'piadaEstranho', label: 'Fazer uma piada', icon: '😂', para: true,
    pode: (c) => !!c.f && c.f.fam >= 20 && c.hoje === 0,
    run: (c) => {
      const f = c.f!;
      const ok = rng.chance(traco(c.p, 'engraçado') ? 0.85 : traco(c.p, 'rabugento') ? 0.3 : 0.62);
      mudarFam(f, ok ? rng.int(7, 11) : -4);
      const piada = rng.pick(c.lugar === 'academia' ? [
        'Sabe por que o frango não vai na academia? Porque já é de granja.',
        'Meu personal disse que eu tenho potencial. Potencial de desistir.',
        'Faço cardio todo dia: corro dos meus boletos.',
      ] : [
        'Meu cardio do bairro é correr quando o ônibus aparece.',
        'A fofoca daqui chega antes da fibra ótica.',
        'A calçada tem mais buraco que minha agenda tem compromisso.',
      ]);
      return ok
        ? { eu: piada, ela: 'HAHAHA! Para, que eu perco a série!', texto: `${nomeOu(c)} riu da sua piada.`, tom: 'bom', fisico: 'piada', social: 8, diversao: 6 }
        : { eu: piada, ela: '...', texto: `A piada morreu no ar. ${nomeOu(c)} deu um sorriso de cortesia.`, tom: 'ruim', reacaoNpc: 'bracosCruzados', expr: 'cansado' };
    },
  },
  {
    id: 'highFiveEstranho', label: 'Toca aqui!', icon: '🙌', para: true,
    pode: (c) => !!c.f && c.f.fam >= 25 && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, rng.int(4, 7));
      return { eu: c.lugar === 'academia' ? 'Boa série! Toca aqui!' : 'Boa! Toca aqui!', ela: 'Aêêê!', texto: `Toca aqui com ${nomeOu(c)}.`, tom: 'bom', fisico: 'highFive', social: 5, diversao: 3 };
    },
  },
  {
    id: 'pegarContato', label: 'Pedir o contato', icon: '📇', para: true,
    pode: (c) => !!c.f && !c.f.contato && c.f.nomeConhecido && c.f.fam >= 35 && c.f.recusouEm !== c.est.dias,
    run: (c) => {
      const f = c.f!;
      const L = c.L;
      let chance = 0.3 + f.fam / 140 + L.stats.aparencia / 500 + L.stats.felicidade / 600;
      if (traco(c.p, 'tímido')) chance -= 0.12;
      if (traco(c.p, 'gentil') || traco(c.p, 'aventureiro')) chance += 0.1;
      const convite = c.lugar === 'academia' ? 'Me passa seu número? A gente combina de treinar junto.' : 'Me passa seu número? A gente combina alguma coisa por aqui.';
      if (!rng.chance(Math.min(0.95, chance))) {
        f.recusouEm = c.est.dias;
        mudarFam(f, -4);
        return { eu: convite, ela: rng.pick(['Ah... melhor a gente se ver por aqui mesmo, tá?', 'Hmm, eu não passo meu número assim, desculpa.', 'Deixa pra próxima, pode ser?']), texto: `${c.p.first} preferiu não passar o contato ainda. Tente mais para a frente.`, tom: 'ruim', reacaoNpc: 'nervoso', expr: 'envergonhado' };
      }
      // vira relacionamento de verdade (aba Relações)
      f.contato = true;
      c.p.rel = 'conhecido';
      c.p.bond = Math.min(60, 25 + Math.round(f.fam * 0.3));
      c.p.metAt = L.player.age;
      if (!L.people.includes(c.p)) L.people.push(c.p);
      const onde = c.lugar === 'academia' ? 'na academia' : 'no bairro';
      lembrar(L, c.p, 'favor', 1, `Trocamos contato ${onde}.`);
      addLog(L, `📇 Você pegou o contato de ${c.p.first} ${onde}.`, 'bom', '📇');
      return { eu: convite, ela: rng.pick(['Claro! Anota aí.', 'Bora! Me chama no zap.', 'Fechou! Vou te seguir também.']), texto: `📇 ${c.p.first} agora está nos seus contatos!`, tom: 'bom', fisico: 'highFive', social: 10, novoContato: true };
    },
  },
  {
    id: 'papoBairro', label: 'Puxar papo sobre o bairro', icon: '🏘️', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.hoje < 2,
    run: (c) => {
      mudarFam(c.f!, rng.int(5, 8));
      const ela = traco(c.p, 'rabugento') ? rng.pick(['Era mais quieto antes.', 'O problema é o barulho. Sempre o barulho.', 'Tem dia que eu sonho com uma rua sem buzina.'])
        : traco(c.p, 'tímido') ? rng.pick(['Eu gosto... é tranquilo.', 'Conheço pouca gente ainda.', 'A praça é meu canto preferido.'])
          : traco(c.p, 'engraçado') ? rng.pick(['O bairro é ótimo. A fofoca vem com frete grátis.', 'Aqui até cachorro sabe quem chegou tarde.', 'Condomínio sem condomínio: todo mundo fiscaliza.'])
            : rng.pick(['Moro por aqui faz tempo.', 'A praça melhorou bastante.', 'É um bairro bom de caminhar.']);
      return { eu: 'Você curte morar por aqui?', ela, texto: `Você conversou sobre o bairro com ${nomeOu(c)}.`, tom: 'bom', social: 6, diversao: 2 };
    },
  },
  {
    id: 'comentarTempo', label: 'Comentar o tempo', icon: '🌤️', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, rng.int(3, 6));
      const periodo = c.est.hora < 11 * 60 ? 'manhã' : c.est.hora >= 18 * 60 ? 'noite' : 'tarde';
      const ela = traco(c.p, 'rabugento') ? rng.pick([`Essa ${periodo} tá enganando.`, 'Tempo bom dura pouco.', 'Se chover, eu avisei.'])
        : traco(c.p, 'tímido') ? rng.pick(['Tá agradável, né?', 'Eu trouxe casaco por garantia.', 'Tomara que continue assim.'])
          : traco(c.p, 'engraçado') ? rng.pick(['Clima indeciso igual grupo de família.', 'Se piorar, culpo o aplicativo.', 'Sol de graça. Milagre urbano.'])
            : rng.pick([`Boa ${periodo} pra ficar na rua.`, 'Tá gostoso hoje.', 'Dá vontade de caminhar.']);
      return { eu: `Tá uma ${periodo} boa, né?`, ela, texto: `Você e ${nomeOu(c)} falaram sobre o tempo.`, tom: 'bom', social: 4 };
    },
  },
  {
    id: 'horasConhecido', label: 'Perguntar as horas', icon: '⌚', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.f.fam >= 10 && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, 3);
      const hh = Math.floor(c.est.hora / 60) % 24, mm = Math.floor(c.est.hora % 60);
      const hora = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      const ela = traco(c.p, 'engraçado') ? rng.pick([`${hora}. Seu celular entrou em greve?`, `${hora}. Cobro a consulta em café.`, `${hora}. Relógio humano às suas ordens.`])
        : traco(c.p, 'rabugento') ? rng.pick([`${hora}.`, `É ${hora}.`, `${hora}. E eu tava quase indo.`])
          : rng.pick([`São ${hora}.`, `${hora}, mais ou menos.`, `Deu ${hora} agora.`]);
      return { eu: 'Que horas são?', ela, texto: `${nomeOu(c)} te passou a hora certa.`, tom: 'bom', social: 3 };
    },
  },
  {
    id: 'pedirInformacaoBairro', label: 'Pedir uma informação', icon: '🧭', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.f.fam >= 8 && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, rng.int(4, 7));
      stat(c.L, 'inteligencia', 1);
      const ela = traco(c.p, 'rabugento') ? rng.pick(['Segue reto. Não tem erro.', 'É ali adiante.', 'Pergunta no comércio, eles sabem tudo.'])
        : traco(c.p, 'tímido') ? rng.pick(['Acho que é depois da praça...', 'Se não me engano, segue reto.', 'Talvez perto da padaria.'])
          : traco(c.p, 'engraçado') ? rng.pick(['Segue o cheiro de pão e a esperança.', 'Reto até a calçada ficar suspeita.', 'Vai pela praça. Se se perder, finge que tá passeando.'])
            : rng.pick(['Passa a praça e segue reto.', 'Fica perto da padaria.', 'É logo depois do ponto de ônibus.']);
      return { eu: 'Sabe me dizer onde fica o comércio?', ela, texto: `${nomeOu(c)} te explicou o caminho.`, tom: 'bom', social: 4 };
    },
  },
  {
    id: 'elogiarLookBairro', label: 'Elogiar o look', icon: '✨', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.f.fam >= 12 && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, traco(c.p, 'rabugento') ? 3 : rng.int(5, 8));
      const ela = traco(c.p, 'rabugento') ? rng.pick(['Valeu.', 'Tá.', 'Obrigado(a)... eu acho.'])
        : traco(c.p, 'tímido') ? rng.pick(['Ah... obrigado(a).', 'Sério? Valeu.', 'Nossa, fiquei sem graça.'])
          : traco(c.p, 'engraçado') ? rng.pick(['Obrigado(a). Promoção e autoestima.', 'Valeu! Hoje eu acertei sem querer.', 'Finalmente alguém reconheceu meu investimento.'])
            : rng.pick(['Valeu! Curti o seu também.', 'Obrigado(a)!', 'Que gentil, valeu mesmo.']);
      return { eu: 'Curti seu look!', ela, texto: `${nomeOu(c)} recebeu o elogio.`, tom: 'bom', expr: 'envergonhado', social: 5, diversao: 2 };
    },
  },
  {
    id: 'moraPorAqui', label: 'Você mora por aqui?', icon: '🏠', para: true,
    pode: (c) => !!c.f && c.lugar === 'rua' && c.f.fam >= 15 && c.hoje === 0,
    run: (c) => {
      mudarFam(c.f!, rng.int(5, 8));
      const ela = traco(c.p, 'rabugento') ? rng.pick(['Moro. Faz tempo.', 'Infelizmente sei até quem estaciona torto.', 'Moro, sim.'])
        : traco(c.p, 'tímido') ? rng.pick(['Moro sim, ali perto.', 'Faz alguns anos.', 'Sim... gosto daqui.'])
          : traco(c.p, 'engraçado') ? rng.pick(['Moro. A rua já me cobra IPTU emocional.', 'Moro e tenho doutorado em barulho de vizinho.', 'Sim. Sou figurinha repetida da praça.'])
            : rng.pick(['Moro sim, duas ruas daqui.', 'Já faz alguns anos.', 'Sim! Sempre passo por essa praça.']);
      return { eu: 'Você mora por aqui?', ela, texto: `Você descobriu um pouco mais sobre ${nomeOu(c)}.`, tom: 'bom', social: 6 };
    },
  },
];

/** Interações novas que só existem no mundo (com contatos). */
export const INTERACOES_CONTATO: InteracaoMundo[] = [
  {
    id: 'treinarJuntos', label: 'Treinar juntos', icon: '🤜🤛', para: true,
    pode: (c) => c.lugar === 'academia' && c.hoje === 0 && c.L.people.includes(c.p),
    run: (c) => {
      bond(c.p, rng.int(5, 9));
      stat(c.L, 'saude', 2);
      c.L.fitness = Math.min(100, (c.L.fitness ?? 0) + 2);
      lembrar(c.L, c.p, 'favor', 1, 'Treinamos juntos.');
      return { eu: 'Bora fazer uma série junto?', ela: 'Bora! Eu conto as repetições, você chora.', texto: `Você e ${c.p.first} treinaram juntos. O vínculo cresceu (e a dor muscular também).`, tom: 'bom', fisico: 'highFive', social: 12, diversao: 8 };
    },
  },
  {
    id: 'cafePadaria', label: 'Tomar um café na padaria (R$ 8)', icon: '☕', para: true,
    pode: (c) => c.lugar === 'rua' && c.hoje === 0 && c.L.people.includes(c.p) && c.L.money >= 8,
    run: (c) => {
      c.L.money -= 8;
      c.est.nec.fome = Math.min(100, c.est.nec.fome + 14);
      bond(c.p, rng.int(5, 8));
      lembrar(c.L, c.p, 'favor', 1, 'Tomamos café na padaria do bairro.');
      return { eu: 'Bora tomar um café na padaria?', ela: rng.pick(['Bora!', 'Só se tiver pão de queijo.', 'Fechou. Eu aceito cafeína.']), texto: `Você e ${c.p.first} tomaram café na padaria.`, tom: 'bom', social: 10, diversao: 5 };
    },
  },
  {
    id: 'sentarBancoPraca', label: 'Sentar juntos no banco da praça', icon: '🪑', para: true,
    pode: (c) => c.lugar === 'rua' && c.hoje === 0 && c.L.people.includes(c.p),
    run: (c) => {
      bond(c.p, rng.int(5, 8));
      lembrar(c.L, c.p, 'favor', 1, 'Ficamos conversando no banco da praça.');
      return { eu: 'Senta ali comigo um pouco?', ela: rng.pick(['Bora, tô sem pressa.', 'Claro. Assunto é o que não falta.', 'Partiu observar a vida alheia com respeito.']), texto: `Você e ${c.p.first} ficaram um tempão conversando na praça.`, tom: 'bom', social: 14, diversao: 4 };
    },
  },
  {
    id: 'caminharJuntos', label: 'Caminhar juntos', icon: '🚶', para: true,
    pode: (c) => c.lugar === 'rua' && c.hoje === 0 && c.L.people.includes(c.p),
    run: (c) => {
      bond(c.p, rng.int(4, 7));
      stat(c.L, 'saude', 1);
      lembrar(c.L, c.p, 'favor', 1, 'Caminhamos juntos pelo bairro.');
      return { eu: 'Bora dar uma volta?', ela: rng.pick(['Vamos!', 'Boa, preciso esticar as pernas.', 'Bora. Sem destino, melhor ainda.']), texto: `Você e ${c.p.first} caminharam pelo bairro.`, tom: 'bom', social: 10, diversao: 4 };
    },
  },
];

/** Interações "clássicas" (aba Relações) oferecidas no mundo, na ordem em que aparecem. */
export const IDS_CLASSICAS = ['conversar', 'elogiar', 'piada', 'highFive', 'abracar', 'dancar', 'consolar', 'desculpas', 'presente', 'paquerar', 'encontro', 'beijar', 'pedirDinheiro', 'discutir'];
/** mínimo de vínculo para cada interação clássica aparecer no mundo (as novas opções "destravam" com a amizade) */
export const VINCULO_MINIMO: Record<string, number> = { abracar: 45, dancar: 40, presente: 30, paquerar: 40, encontro: 45, pedirDinheiro: 60, consolar: 55 };

/** Opções da aba Relações válidas para esta pessoa agora (respeitando o nível de amizade). */
export function classicasPara(L: Life, p: Person) {
  const out = [] as typeof INTERACTIONS;
  for (const id of IDS_CLASSICAS) {
    const it = INTERACTIONS.find((i) => i.id === id);
    if (!it || !it.cond(L, p)) continue;
    const min = VINCULO_MINIMO[id] ?? 0;
    const romance = id === 'paquerar' || id === 'encontro' || id === 'beijar';
    if (p.bond < min && !['mae', 'pai', 'irmao', 'irma', 'filho', 'filha', 'conjuge', 'namorado', 'namorada', 'avo', 'avoM'].includes(p.rel)) continue;
    if (romance && !podeNamorar(L, p)) continue;
    // só faz sentido pedir desculpas a quem está magoado(a)
    if (id === 'desculpas' && (p.memo?.rancor ?? 0) < 10) continue;
    out.push(it);
  }
  return out;
}

/** Ação física (physical) que representa uma interação clássica no mundo. */
export const FISICO_DE: Record<string, string> = {
  conversar: 'conversar', elogiar: 'elogiar', piada: 'piada', highFive: 'highFive', abracar: 'abracar', dancar: 'dancar',
  consolar: 'consolar', desculpas: 'desculpas', presente: 'presente', paquerar: 'conversar', encontro: 'abracar', beijar: 'beijar',
  pedirDinheiro: 'pedirDinheiro', discutir: 'discutir', fofocar: 'fofocar', brincar: 'brincar', massagem: 'massagem',
};

/** Falas que os frequentadores trocam entre si (vida no ambiente). */
export const PAPO_AMBIENTE = [
  'Hoje é dia de quê?', 'Peito e tríceps. Sempre.', 'Viu o preço do whey?', 'Esse ar-condicionado é decorativo?',
  'Três séries de doze.', 'Bora que tá pago!', 'Amanhã eu venho. Com certeza. Talvez.', 'Quem deixou o halter no chão??',
];

/** Frases de quem puxa conversa com VOCÊ (iniciativa do NPC). */
export function puxaConversa(p: Person, f: Frequentador, lugar: LugarId = 'academia'): string {
  if (lugar === 'rua') {
    if (f.fam < 10) return rng.pick(['Você mora por aqui?', 'A praça tá tranquila hoje, né?', 'Opa, licença!']);
    if (!f.nomeConhecido) return rng.pick(['Te vejo sempre por aqui!', 'A gente sempre se cruza nessa rua, né?']);
    return rng.pick(['E aí! Passeando?', 'Olha quem apareceu na praça!', 'Bora dar uma volta no quarteirão?']);
  }
  if (f.fam < 10) return rng.pick(['Você é novo(a) aqui?', 'Vai usar esse aparelho? Posso revezar?', 'Opa, licença!']);
  if (!f.nomeConhecido) return rng.pick(['Te vejo sempre por aqui!', 'E aí, firme no treino?']);
  return rng.pick([`E aí! Bora treinar?`, 'Olha quem apareceu!', 'Tava sentindo falta do meu parceiro de sofrimento!']);
}

// ------------------------------------------------------------------ rua e casa (conteúdo: pode acrescentar no fim das listas)
/** Falas soltas da família pela casa (balões aleatórios). */
export const FALAS_CASA = ['Alguém viu o controle?', 'Quem comeu meu iogurte?', 'Apaga a luz do quarto!', 'Tem janta hoje?', 'Essa novela tá boa demais.'];

/**
 * O que dá para fazer com quem passa na calçada (gente de passagem: não vira contato, não fica salva).
 * `para: false` = a pessoa responde andando. Acrescente novas no fim (ver instrucoesCodex/05-DIALOGOS-E-INTERACOES.md).
 */
export const INTERACOES_PASSANTE: InteracaoMundo[] = [
  {
    id: 'oiPassante', label: 'Cumprimentar', icon: '👋', para: false, pode: () => true,
    run: () => ({ eu: 'Bom dia!', ela: rng.pick(['Bom dia!', '*acena de volta*', 'Opa!', 'Te conheço?']), texto: 'Você cumprimentou alguém na rua. Gentileza de graça.', tom: 'bom', reacaoNpc: 'acenar', social: 2 }),
  },
  {
    id: 'horas', label: 'Perguntar as horas', icon: '⌚', para: false, pode: () => true,
    run: () => ({ eu: 'Com licença, que horas são?', ela: rng.pick(['Tá no seu celular, meu bem.', 'Hora de você comprar um relógio.', 'Sei lá, meu celular morreu.', 'Umas... três? Quatro?']), texto: 'Você perguntou as horas. Recebeu sabedoria.', tom: 'neutro', diversao: 2, social: 1 }),
  },
];
