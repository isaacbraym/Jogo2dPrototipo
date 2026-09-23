import { Appearance } from '../character/appearance';

export interface Career {
  id: string;
  title: string;
  titles: string[]; // níveis de promoção
  salary: number; // anual (nível 0)
  edu: 'nenhum' | 'medio' | 'faculdade';
  curso?: string;
  minAge: number;
  smarts: number; // inteligência mínima
  looks?: number;
  icon: string;
  env: string;
  motion: string;
  outfit?: Partial<Appearance>;
  fala?: string;
}

export const CAREERS: Career[] = [
  { id: 'caixa', title: 'Operador(a) de caixa', titles: ['Operador(a) de caixa', 'Caixa sênior', 'Supervisor(a) de loja', 'Gerente de loja'], salary: 22000, edu: 'nenhum', minAge: 16, smarts: 0, icon: '🛒', env: 'ruaDia', motion: 'digitar', outfit: { top: 'polo', topColor: '#c2273d', topColor2: '#f4f1ea' } },
  { id: 'barista', title: 'Barista', titles: ['Barista', 'Barista chefe', 'Gerente da cafeteria', 'Dono(a) de franquia'], salary: 24000, edu: 'nenhum', minAge: 16, smarts: 0, icon: '☕', env: 'cozinha', motion: 'cafe', outfit: { top: 'camiseta', topColor: '#2f8f6f' } },
  { id: 'entregador', title: 'Entregador(a)', titles: ['Entregador(a)', 'Entregador(a) veterano(a)', 'Coordenador(a) de logística', 'Diretor(a) de logística'], salary: 26000, edu: 'nenhum', minAge: 18, smarts: 0, icon: '🛵', env: 'ruaDia', motion: 'andar', outfit: { top: 'jaqueta', topColor: '#e4572e', hat: 'bone', hatColor: '#e4572e' } },
  { id: 'cozinheiro', title: 'Cozinheiro(a)', titles: ['Ajudante de cozinha', 'Cozinheiro(a)', 'Sous-chef', 'Chef executivo(a)'], salary: 30000, edu: 'nenhum', minAge: 18, smarts: 20, icon: '👨‍🍳', env: 'cozinha', motion: 'cozinhar', outfit: { top: 'chef', hat: 'chefe' } },
  { id: 'musico', title: 'Músico(a)', titles: ['Músico(a) de bar', 'Músico(a) de turnê', 'Artista revelação', 'Estrela da música'], salary: 20000, edu: 'nenhum', minAge: 16, smarts: 0, looks: 30, icon: '🎸', env: 'palco', motion: 'tocarViolao' },
  { id: 'policial', title: 'Policial', titles: ['Soldado', 'Cabo', 'Sargento', 'Delegado(a)'], salary: 52000, edu: 'medio', minAge: 18, smarts: 35, icon: '👮', env: 'ruaDia', motion: 'maosNaCintura', outfit: { top: 'policial', hat: 'quepe' } },
  { id: 'professor', title: 'Professor(a)', titles: ['Professor(a) substituto(a)', 'Professor(a)', 'Coordenador(a)', 'Diretor(a) escolar'], salary: 48000, edu: 'faculdade', curso: 'Pedagogia', minAge: 21, smarts: 50, icon: '🧑‍🏫', env: 'escola', motion: 'apontar' },
  { id: 'enfermeiro', title: 'Enfermeiro(a)', titles: ['Técnico(a) de enfermagem', 'Enfermeiro(a)', 'Enfermeiro(a) chefe', 'Diretor(a) de enfermagem'], salary: 58000, edu: 'faculdade', curso: 'Enfermagem', minAge: 21, smarts: 50, icon: '🩺', env: 'hospital', motion: 'pensando', outfit: { top: 'jaleco', topColor: '#5ec3e8' } },
  { id: 'medico', title: 'Médico(a)', titles: ['Residente', 'Médico(a)', 'Especialista', 'Chefe da cirurgia'], salary: 160000, edu: 'faculdade', curso: 'Medicina', minAge: 24, smarts: 75, icon: '⚕️', env: 'hospital', motion: 'pensando', outfit: { top: 'jaleco', topColor: '#3d7bd9' } },
  { id: 'programador', title: 'Programador(a)', titles: ['Dev júnior', 'Dev pleno', 'Dev sênior', 'CTO'], salary: 90000, edu: 'faculdade', curso: 'Computação', minAge: 20, smarts: 60, icon: '💻', env: 'escritorio', motion: 'digitar', outfit: { top: 'moletom' } },
  { id: 'advogado', title: 'Advogado(a)', titles: ['Estagiário(a) jurídico', 'Advogado(a)', 'Sócio(a)', 'Juiz(a)'], salary: 110000, edu: 'faculdade', curso: 'Direito', minAge: 23, smarts: 65, icon: '⚖️', env: 'tribunal', motion: 'apontar', outfit: { top: 'blazer', topColor: '#23242b', topColor2: '#1f3f7a' } },
  { id: 'engenheiro', title: 'Engenheiro(a)', titles: ['Engenheiro(a) trainee', 'Engenheiro(a)', 'Engenheiro(a) sênior', 'Diretor(a) de engenharia'], salary: 100000, edu: 'faculdade', curso: 'Engenharia', minAge: 22, smarts: 65, icon: '🏗️', env: 'escritorio', motion: 'digitar', outfit: { top: 'camisa', topColor: '#9fd3ee' } },
  { id: 'artista', title: 'Artista plástico(a)', titles: ['Artista iniciante', 'Artista', 'Artista renomado(a)', 'Lenda das artes'], salary: 26000, edu: 'nenhum', minAge: 18, smarts: 20, icon: '🎨', env: 'parque', motion: 'pintar' },
  { id: 'atleta', title: 'Atleta', titles: ['Atleta amador(a)', 'Atleta profissional', 'Atleta de seleção', 'Campeão(ã) olímpico(a)'], salary: 60000, edu: 'nenhum', minAge: 18, smarts: 0, looks: 40, icon: '🏅', env: 'academia', motion: 'levantarPeso', outfit: { top: 'esporte' } },
  { id: 'empresario', title: 'Empreendedor(a)', titles: ['Fundador(a) de startup', 'CEO', 'Investidor(a)', 'Magnata'], salary: 70000, edu: 'faculdade', curso: 'Administração', minAge: 22, smarts: 55, icon: '📈', env: 'escritorio', motion: 'telefone', outfit: { top: 'blazer' } },
  { id: 'ator', title: 'Ator/Atriz', titles: ['Figurante', 'Ator/Atriz coadjuvante', 'Protagonista', 'Estrela de cinema'], salary: 30000, edu: 'nenhum', minAge: 18, smarts: 20, looks: 60, icon: '🎬', env: 'palco', motion: 'reverencia' },
];

export const CURSOS = ['Medicina', 'Direito', 'Computação', 'Engenharia', 'Pedagogia', 'Enfermagem', 'Administração', 'Artes', 'Psicologia'];

export function careerById(id: string) {
  return CAREERS.find((c) => c.id === id);
}
