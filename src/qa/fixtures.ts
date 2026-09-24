/**
 * Perfis de vida de teste (compartilhados pelo validador `scripts/check-content.ts` e pelo painel de QA).
 * Cada perfil é uma vida válida criada com as funções reais do jogo (newLife, makePerson, hireStaff...).
 */
import { Life, newLife, makePerson, hireStaff, enrollSchool } from '../game/state';
import { randomAppearance } from '../character/appearance';
import { RNG } from '../core/rng';

export type Kind = 'bebe' | 'crianca' | 'teen' | 'universitario' | 'adultoSolteiro' | 'adultoNamorando' | 'casadoFilhos' | 'desempregadoPobre' | 'rico' | 'idoso';
export const KINDS: Kind[] = ['bebe', 'crianca', 'teen', 'universitario', 'adultoSolteiro', 'adultoNamorando', 'casadoFilhos', 'desempregadoPobre', 'rico', 'idoso'];
export const BASE_AGE: Record<Kind, number> = { bebe: 1, crianca: 9, teen: 15, universitario: 22, rico: 45, adultoSolteiro: 26, adultoNamorando: 30, casadoFilhos: 40, desempregadoPobre: 35, idoso: 72 };
export const ROTULO_PERFIL: Record<Kind, string> = {
  bebe: 'Bebê', crianca: 'Criança na escola', teen: 'Adolescente namorando (nota baixa)', universitario: 'Universitário(a) no 4º ano',
  adultoSolteiro: 'Adulto(a) solteiro(a) empregado(a)', adultoNamorando: 'Adulto(a) namorando, empregado(a)', casadoFilhos: 'Casado(a) com filhos, casa e carro',
  desempregadoPobre: 'Desempregado(a), sem dinheiro, com ficha e ex', rico: 'Rico(a) e famoso(a)', idoso: 'Idoso(a) aposentado(a), viúvo de pais',
};

export function fixture(kind: Kind, age = BASE_AGE[kind]): Life {
  const r = new RNG(1000 + age * 7 + KINDS.indexOf(kind));
  const sex = r.chance(0.5) ? 'f' : 'm';
  const L = newLife(randomAppearance(r, sex), 'Teste', 'Silva', 'São Paulo', age);
  if (age >= 6 && age < 18) { L.edu.stage = age < 14 ? 'fundamental' : 'medio'; enrollSchool(L); }
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
  if (age >= 8) L.pets.push({ id: 'pet1', name: 'Totó', kind: 'cachorro', color: '#c8843a', age: 3, bond: 70, alive: true });
  return L;
}

