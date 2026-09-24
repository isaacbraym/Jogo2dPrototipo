/**
 * "Copiar pedido para Luna": texto estruturado e autocontido para o agente de conteúdo
 * localizar o código pelo ID, reproduzir o caso e devolver variações no formato de proposta.
 */
export interface Pedido {
  tipo: string;
  id: string;
  cadeia: string;
  arquivo: string;
  semente?: number;
  cenario?: string; // nome em qa/cenarios ou JSON resumido
  instante?: string;
  trecho?: string;
  valores?: Record<string, unknown>;
  observacao: string;
  melhoria: string;
  variacoes: number;
  escopoCalibravel: boolean;
}

export function textoPedido(p: Pedido): string {
  const linhas = [
    `## Pedido do painel de QA — ${p.tipo} \`${p.id}\``,
    '',
    `- **Tipo e ID:** ${p.tipo} \`${p.id}\``,
    `- **Cadeia de referências:** ${p.cadeia}`,
    `- **Arquivo de origem:** \`${p.arquivo}\``,
  ];
  if (p.semente !== undefined) linhas.push(`- **Semente:** ${p.semente}`);
  if (p.cenario) linhas.push(`- **Cenário reproduzível:** ${p.cenario}`);
  if (p.instante) linhas.push(`- **Instante:** ${p.instante}`);
  if (p.trecho) linhas.push(`- **Trecho:** \`${p.trecho}\``);
  if (p.valores && Object.keys(p.valores).length) {
    linhas.push('- **Valores atuais:**', '```json', JSON.stringify(p.valores, null, 2), '```');
  }
  linhas.push(
    `- **Observação:** ${p.observacao || '(sem observação)'}`,
    `- **Melhoria desejada:** ${p.melhoria || '(descrever)'}`,
    `- **Variações pedidas:** ${p.variacoes}`,
    '',
    '### Como entregar',
    p.escopoCalibravel
      ? `Este ajuste está no escopo do calibrador. Entregue um arquivo \`qa/propostas/<nome>.json\` no formato "viva-proposta" com ${p.variacoes} variação(ões) (veja docs/PAINEL-QA.md §5). Não edite src/data/calibracao.json à mão: o usuário escolhe e aplica pelo painel.`
      : `Este ajuste exige mudança de código. Localize o id seguindo docs/PAINEL-QA.md §6 ("Localizar pelo ID"), crie ${p.variacoes} variação(ões) como blocos alternativos comentados OU como movimentos/cenas novos com sufixo (\`${p.id}V1\`, \`${p.id}V2\`...) para comparação no painel. Não renomeie nem apague ids existentes e não altere outros conteúdos.`,
    'Rode `npm run check` antes de entregar e registre no docs/CHANGELOG.md.',
  );
  return linhas.join('\n');
}
