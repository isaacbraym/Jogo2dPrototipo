/** Monta um cenário inicial razoável para qualquer item executável do catálogo. */
import { EVENTS } from '../game/events';
import { ACTIONS, INTERACTIONS } from '../game/activities';
import type { Item } from './catalogo';
import { Cenario, novoCenario, vidaDoPerfil, procurarVidaValida, KINDS, BASE_AGE, ROTULO_PERFIL, Kind } from './vida';

export function cenarioParaItem(it: Item, semente = 1): Cenario | null {
  switch (it.tipo) {
    case 'evento':
    case 'escolha': {
      const evId = it.tipo === 'escolha' ? it.id.split('#')[0] : it.id;
      const ev = EVENTS.find((e) => e.id === evId);
      if (!ev) return null;
      const achado = procurarVidaValida(ev, semente);
      const vida = achado?.vida ?? vidaDoPerfil(perfilPorIdade(ev.min), Math.max(0, ev.min), semente);
      const c = novoCenario({ tipo: 'evento', id: ev.id }, vida, achado ? achado.origem : `nenhum perfil de teste satisfaz ${ev.id}: vida base aos ${ev.min} (monte os pré-requisitos)`, semente);
      if (it.tipo === 'escolha') c.caminho = [Number(it.id.split('#')[1])];
      return c;
    }
    case 'interacao':
    case 'agressao': {
      const id = it.tipo === 'agressao' ? 'agg_' + it.id : it.id;
      const inter = INTERACTIONS.find((i) => i.id === id);
      if (!inter) return null;
      // prioridade de contexto para agressões: trabalho (chefe/colega), depois escola, depois qualquer um
      const prefer = ['colegaTrab', 'chefe', 'colega', 'amigo', 'amiga', 'irmao', 'irma', 'namorada', 'namorado'];
      for (const k of ['adultoSolteiro', 'crianca', 'teen', 'casadoFilhos', 'adultoNamorando', 'idoso'] as Kind[]) {
        const vida = vidaDoPerfil(k, BASE_AGE[k], semente);
        const candidatos = vida.people.filter((p) => p.alive && inter.cond(vida, p)).sort((a, b) => (prefer.indexOf(a.rel) + 99) % 99 - (prefer.indexOf(b.rel) + 99) % 99);
        if (candidatos.length) {
          const p = candidatos[0];
          return novoCenario({ tipo: it.tipo === 'agressao' ? 'agressao' : 'interacao', id: it.tipo === 'agressao' ? it.id : it.id, pessoaId: p.id }, vida, `perfil "${k}" (${ROTULO_PERFIL[k]}); alvo ${p.first} (${p.rel})`, semente);
        }
      }
      return null;
    }
    case 'acao': {
      const a = ACTIONS.find((x) => x.id === it.id);
      if (!a) return null;
      for (const k of KINDS) {
        const idade = Math.max(a.minAge, BASE_AGE[k]);
        if (a.maxAge !== undefined && idade > a.maxAge) continue;
        const vida = vidaDoPerfil(k, idade, semente);
        vida.money = Math.max(vida.money, 100000);
        if (!a.cond || a.cond(vida)) return novoCenario({ tipo: 'acao', id: a.id }, vida, `perfil "${k}" aos ${idade}, dinheiro ≥ R$ 100 mil`, semente);
      }
      return novoCenario({ tipo: 'acao', id: a.id }, vidaDoPerfil('adultoSolteiro', Math.max(26, a.minAge), semente), 'perfil adulto (condição da ação pode falhar)', semente);
    }
    case 'entrevista': {
      const vida = vidaDoPerfil('desempregadoPobre', 28, semente);
      vida.crime.ficha = 0;
      return novoCenario({ tipo: 'entrevista', id: it.id }, vida, 'perfil "desempregadoPobre" aos 28, ficha limpa', semente);
    }
  }
  return null;
}

export function perfilPorIdade(idade: number): Kind {
  let melhor: Kind = 'adultoSolteiro', d = 1e9;
  for (const k of KINDS) { const dd = Math.abs(BASE_AGE[k] - idade); if (dd < d) { d = dd; melhor = k; } }
  return melhor;
}
