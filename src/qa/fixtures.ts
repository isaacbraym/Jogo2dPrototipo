/**
 * Perfis de vida de teste (compartilhados pelo validador `scripts/check-content.ts` e pelo painel de QA).
 * Cada perfil é uma vida válida criada com as funções reais do jogo (newLife, makePerson, hireStaff...).
 */
import { Life, newLife, makePerson, hireStaff, enrollSchool } from '../game/state';
import { randomAppearance } from '../character/appearance';
import { RNG } from '../core/rng';

export type Kind = 'bebe' | 'crianca' | 'teen' | 'universitario' | 'adultoSolteiro' | 'adultoNamorando' | 'casadoFilhos' | 'desempregadoPobre' | 'rico' | 'idoso' | 'casamentoEmCrise' | 'noivoComEx';
export const KINDS: Kind[] = ['bebe', 'crianca', 'teen', 'universitario', 'adultoSolteiro', 'adultoNamorando', 'casadoFilhos', 'desempregadoPobre', 'rico', 'idoso', 'casamentoEmCrise', 'noivoComEx'];
export const BASE_AGE: Record<Kind, number> = { bebe: 1, crianca: 9, teen: 15, universitario: 22, rico: 45, adultoSolteiro: 26, adultoNamorando: 30, casadoFilhos: 40, desempregadoPobre: 35, idoso: 72, casamentoEmCrise: 40, noivoComEx: 28 };
export const ROTULO_PERFIL: Record<Kind, string> = {
  bebe: 'Bebê', crianca: 'Criança na escola', teen: 'Adolescente namorando (nota baixa)', universitario: 'Universitário(a) no 4º ano',
  adultoSolteiro: 'Adulto(a) solteiro(a) empregado(a)', adultoNamorando: 'Adulto(a) namorando, empregado(a)', casadoFilhos: 'Casado(a) com filhos, casa e carro',
  desempregadoPobre: 'Desempregado(a), sem dinheiro, com ficha e ex', rico: 'Rico(a) e famoso(a)', idoso: 'Idoso(a) aposentado(a), viúvo de pais',
  casamentoEmCrise: 'Casado(a) há 10 anos, cônjuge magoado(a) (agredido(a) 2x)', noivoComEx: 'Noivo(a) há 1 ano + ex que ainda gosta de você',
};

export function fixture(kind: Kind, age = BASE_AGE[kind]): Life {
  const r = new RNG(1000 + age * 7 + KINDS.indexOf(kind));
  const sex = r.chance(0.5) ? 'f' : 'm';
  const L = newLife(randomAppearance(r, sex), 'Teste', 'Silva', 'São Paulo', age);
  // newLife já matricula e ajusta a escolaridade para idades 6–17
  if (age >= 5) L.people.push(makePerson(r, { age: age + r.int(-1, 2), rel: sex === 'f' ? 'amiga' : 'amigo', bond: 70 }));
  if (age >= 5 && kind !== 'desempregadoPobre') L.people.push(makePerson(r, { age: age + r.int(-2, 2), rel: 'amigo', bond: 60 }));
  if (kind === 'teen') L.edu.nota = 50;
  if (kind === 'universitario') { L.edu.stage = 'faculdade'; L.edu.curso = 'Computação'; L.edu.faculdade = true; L.flags.anosFacul = 4; }
  if (age >= 18 && kind !== 'desempregadoPobre' && kind !== 'universitario') {
    L.job = { id: 'caixa', title: 'Operador(a) de caixa', salary: 22000, perf: 55, years: 2, level: 0 };
    hireStaff(L, L.job.title);
    L.money = 25000;
    L.licenca = true;
  }
  if (kind === 'teen' || kind === 'adultoNamorando') L.people.push(makePerson(r, { age, sex: sex === 'f' ? 'm' : 'f', rel: sex === 'f' ? 'namorado' : 'namorada', bond: 80 }));
  const par = L.people.find((p) => p.rel === 'namorado' || p.rel === 'namorada');
  if (par) par.metAt = age - 3;
  if (kind === 'rico') { L.money = 2e6; L.fame = 40; }
  if (kind === 'casadoFilhos' || kind === 'idoso') {
    L.people.push(makePerson(r, { age: age + 1, sex: sex === 'f' ? 'm' : 'f', rel: 'conjuge', bond: 70 }));
    L.people.push(makePerson(r, { age: kind === 'idoso' ? 45 : 10, rel: 'filho', bond: 70 }));
    L.people.push(makePerson(r, { age: kind === 'idoso' ? 42 : 7, rel: 'filha', bond: 70 }));
    L.assets.casa = { nome: 'Apartamento', valor: 300000 };
    L.assets.carro = { nome: 'Popular', valor: 40000, cor: '#c2273d' };
  }
  if (kind === 'idoso') { L.retired = true; L.job = null; L.people.forEach((p) => { if (p.rel === 'mae' || p.rel === 'pai') p.alive = false; }); }
  if (kind === 'desempregadoPobre') { L.money = 80; L.crime.ficha = 1; L.people.push(makePerson(r, { age: age + 3, rel: 'ex', bond: 20 })); }
  if (kind === 'casamentoEmCrise') {
    L.job = L.job ?? { id: 'caixa', title: 'Operador(a) de caixa', salary: 22000, perf: 55, years: 2, level: 0 };
    const c = makePerson(r, { age: age + 1, sex: sex === 'f' ? 'm' : 'f', rel: 'conjuge', bond: 22 });
    c.memo = { rancor: 60, medo: 35, gratidao: 5, confianca: 20, agressoes: 2, ultimaAgressao: age - 1, desculpas: 1, desculpasRecusadas: 0, promessasQuebradas: 1, ultimaDesculpa: age - 2, casamento: age - 10, fatos: [{ idade: age - 1, tipo: 'agressao', texto: 'Agressão: dar um tapa.' }] };
    L.people.push(c, makePerson(r, { age: 8, rel: 'filha', bond: 60 }));
    L.assets.casa = { nome: 'Apartamento', valor: 280000 };
  }
  if (kind === 'noivoComEx') {
    const n = makePerson(r, { age, sex: sex === 'f' ? 'm' : 'f', rel: sex === 'f' ? 'namorado' : 'namorada', bond: 82 });
    n.metAt = age - 3;
    n.memo = { rancor: 0, medo: 0, gratidao: 20, confianca: 75, agressoes: 0, desculpas: 0, desculpasRecusadas: 0, promessasQuebradas: 0, noivado: age - 1, fatos: [] };
    const ex = makePerson(r, { age: age + 1, rel: 'ex', bond: 55 });
    ex.memo = { rancor: 10, medo: 0, gratidao: 10, confianca: 50, agressoes: 0, desculpas: 0, desculpasRecusadas: 0, promessasQuebradas: 0, terminos: 1, fatos: [] };
    L.people.push(n, ex);
  }
  if (age >= 8) L.pets.push({ id: 'pet1', name: 'Totó', kind: 'cachorro', color: '#c8843a', age: 3, bond: 70, alive: true });
  return L;
}

