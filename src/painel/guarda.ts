/**
 * Proteção dos saves reais: o painel roda na mesma origem do jogo em desenvolvimento
 * (localhost:5199), então bloqueamos QUALQUER leitura/escrita das chaves do jogo ("viva.*")
 * feita a partir desta página. O painel só usa chaves "painel.*".
 * A única leitura permitida é a preferência de áudio ("viva.audio"), lida pelo motor de som.
 */
export const tentativasBloqueadas: { quando: string; op: string; chave: string }[] = [];

const PERMITIDA_LEITURA = new Set(['viva.audio']);

export function instalarGuardas() {
  const P = Storage.prototype;
  const get = P.getItem, set = P.setItem, rem = P.removeItem, clr = P.clear;
  const registra = (op: string, chave: string) => {
    tentativasBloqueadas.push({ quando: new Date().toLocaleTimeString('pt-BR'), op, chave });
    console.warn(`[painel] ${op} de "${chave}" bloqueada: o painel nunca toca nos saves do jogo.`);
  };
  P.getItem = function (k: string) {
    if (k.startsWith('viva.') && !PERMITIDA_LEITURA.has(k)) { registra('leitura', k); return null; }
    return get.call(this, k);
  };
  P.setItem = function (k: string, v: string) {
    if (k.startsWith('viva.')) { registra('escrita', k); return; }
    return set.call(this, k, v);
  };
  P.removeItem = function (k: string) {
    if (k.startsWith('viva.')) { registra('remoção', k); return; }
    return rem.call(this, k);
  };
  P.clear = function () { registra('limpeza total', '*'); };
  void clr;
}
