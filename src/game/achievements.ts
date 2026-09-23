import { Life, children, spouse, friends } from './state';

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  desc: string;
  check: (L: Life) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'formado', name: 'Diplomado(a)', icon: '🎓', desc: 'Conclua uma faculdade.', check: (L) => !!L.edu.faculdade },
  { id: 'casado', name: 'Felizes para sempre', icon: '💍', desc: 'Case-se com alguém.', check: (L) => !!spouse(L) },
  { id: 'pais', name: 'Família formada', icon: '👶', desc: 'Tenha um filho.', check: (L) => children(L).length > 0 },
  { id: 'familiaGrande', name: 'Casa cheia', icon: '👨‍👩‍👧‍👦', desc: 'Tenha 3 filhos ou mais.', check: (L) => children(L).length >= 3 },
  { id: 'rico', name: 'Primeiro milhão', icon: '💰', desc: 'Junte R$ 1 milhão.', check: (L) => L.money >= 1_000_000 },
  { id: 'casa', name: 'Casa própria', icon: '🏡', desc: 'Compre uma casa.', check: (L) => !!L.assets.casa },
  { id: 'topo', name: 'Topo da carreira', icon: '🏆', desc: 'Chegue ao último nível de uma carreira.', check: (L) => !!L.job && L.job.level >= 3 },
  { id: 'popular', name: 'Popular', icon: '🤝', desc: 'Tenha 5 amigos.', check: (L) => friends(L).length >= 5 },
  { id: 'pet', name: 'Melhor amigo', icon: '🐾', desc: 'Adote um pet.', check: (L) => L.pets.length > 0 },
  { id: 'preso', name: 'Ficha suja', icon: '⛓️', desc: 'Vá para a prisão.', check: (L) => L.crime.ficha > 0 && (L.crime.preso || !!L.flags.foiPreso) },
  { id: 'anjo', name: 'Coração de ouro', icon: '😇', desc: 'Alcance carma altíssimo.', check: (L) => L.karma >= 85 },
  { id: 'fitness', name: 'Corpo de atleta', icon: '💪', desc: 'Chegue a 90% de forma física.', check: (L) => L.fitness >= 90 },
  { id: 'genio', name: 'Gênio', icon: '🧠', desc: 'Inteligência máxima.', check: (L) => L.stats.inteligencia >= 100 },
  { id: 'famoso', name: 'Celebridade', icon: '🌟', desc: 'Fique famoso(a).', check: (L) => L.fame >= 15 },
  { id: 'noventa', name: 'Vida longa', icon: '🧓', desc: 'Chegue aos 90 anos.', check: (L) => L.player.age >= 90 },
  { id: 'centenario', name: 'Centenário', icon: '💯', desc: 'Chegue aos 100 anos.', check: (L) => L.player.age >= 100 },
  { id: 'geracao', name: 'Legado', icon: '🌳', desc: 'Continue a vida como herdeiro(a).', check: (L) => L.generation >= 2 },
  { id: 'carro', name: 'Pé na estrada', icon: '🚗', desc: 'Compre um carro.', check: (L) => !!L.assets.carro },
];

/** Retorna conquistas recém-desbloqueadas (e as marca no estado). */
export function checkAchievements(L: Life): Achievement[] {
  if (L.crime.preso) L.flags.foiPreso = 1;
  const out: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    const k = 'ach_' + a.id;
    if (!L.flags[k] && a.check(L)) {
      L.flags[k] = L.player.age;
      out.push(a);
    }
  }
  return out;
}
