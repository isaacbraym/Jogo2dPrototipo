/** Cliente da API local do painel (scripts/painel-api.ts, só existe no `npm run dev`). */
async function req(metodo: 'GET' | 'POST', rota: string, corpo?: unknown) {
  const r = await fetch('/__painel/api/' + rota, {
    method: metodo,
    headers: metodo === 'POST' ? { 'Content-Type': 'application/json', 'X-Painel': '1' } : {},
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({ erro: `resposta inválida (${r.status})` }));
  if (!r.ok) throw Object.assign(new Error(j.erro ?? `erro ${r.status}`), { detalhes: j.detalhes, dados: j, status: r.status });
  return j;
}

export const api = {
  estado: () => req('GET', 'estado'),
  listar: (tipo: 'cenarios' | 'propostas') => req('GET', `arquivos?tipo=${tipo}`),
  ler: (tipo: 'cenarios' | 'propostas', nome: string) => req('GET', `arquivo?tipo=${tipo}&nome=${encodeURIComponent(nome)}`),
  salvar: (tipo: 'cenarios' | 'propostas', nome: string, conteudo: unknown) => req('POST', 'arquivo', { tipo, nome, conteudo, autor: 'painel' }),
  previa: (calibracao: unknown) => req('POST', 'calibracao/previa', { calibracao }),
  aplicar: (calibracao: unknown, motivo: string, hashEsperado: string, origem: unknown) => req('POST', 'calibracao/aplicar', { calibracao, motivo, hashEsperado, origem, autor: 'painel', confirmacao: 'QUERO APLICAR' }),
  reverter: (arquivo: string, motivo: string) => req('POST', 'calibracao/reverter', { arquivo, motivo, autor: 'painel', confirmacao: 'QUERO APLICAR' }),
  trava: () => req('GET', 'trava'),
  definirTrava: (liberado: boolean) => req('POST', 'trava', liberado ? { liberado: true, confirmacao: 'QUERO APLICAR' } : { liberado: false }),
};

export const nomeArquivo = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome';
