/**
 * API local do Painel de QA — existe SOMENTE no `vite` de desenvolvimento (plugin com apply: 'serve').
 * Nunca entra no build (dist/index.html) nem no GitHub Pages.
 *
 * Escrita permitida (lista fechada):
 *   qa/cenarios/<nome>.json     cenários de reprodução (formato "viva-cenario")
 *   qa/propostas/<nome>.json    propostas/variações de calibração (formato "viva-proposta")
 *   src/data/calibracao.json    calibração aplicada (só via /calibracao/aplicar|reverter, validada)
 *   qa/historico/*.json         cópia automática antes de cada aplicação/reversão
 *   qa/auditoria.jsonl          trilha de alterações (append-only)
 * Qualquer outro caminho é recusado. Nomes: [a-z0-9-_], sem barras. Saves de jogadores (localStorage)
 * nunca passam por aqui.
 */
import type { Plugin, ViteDevServer } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Calibracao, validarCalibracao, validarContraRegistros, serializar, diffTexto } from '../src/qa/calibracao';

// caminhos definidos a partir da raiz do Vite em configureServer
let ARQ_CALIB = '';
let ARQ_AUDIT = '';
const DIR = { cenarios: '', propostas: '', historico: '' };
function definirRaiz(raiz: string) {
  ARQ_CALIB = path.join(raiz, 'src/data/calibracao.json');
  ARQ_AUDIT = path.join(raiz, 'qa/auditoria.jsonl');
  DIR.cenarios = path.join(raiz, 'qa/cenarios');
  DIR.propostas = path.join(raiz, 'qa/propostas');
  DIR.historico = path.join(raiz, 'qa/historico');
}
const NOME = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * TRAVA: o painel começa travado a cada vez que o servidor sobe. Travado = nenhuma gravação no projeto
 * (tudo é só prévia/teste). Destravar exige confirmação explícita; aplicar/reverter trava de novo sozinho.
 */
let liberado = false;
function exigirLiberado() {
  if (!liberado) throw new Erro(423, 'Painel TRAVADO: nada é gravado no projeto. Clique no cadeado e confirme que deseja aplicar.');
}
const FORMATO: Record<'cenarios' | 'propostas', string> = { cenarios: 'viva-cenario', propostas: 'viva-proposta' };
const MAX = 1_000_000;

const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

async function lerCorpo(req: IncomingMessage): Promise<any> {
  let tam = 0;
  const partes: Buffer[] = [];
  for await (const c of req) {
    tam += (c as Buffer).length;
    if (tam > MAX) throw new Erro(413, 'corpo grande demais');
    partes.push(c as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
  } catch {
    throw new Erro(400, 'JSON inválido');
  }
}

class Erro extends Error {
  constructor(public status: number, msg: string, public detalhes?: unknown) { super(msg); }
}

function enviar(res: ServerResponse, status: number, dados: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(dados));
}

async function auditar(entrada: Record<string, unknown>) {
  await fs.mkdir(path.dirname(ARQ_AUDIT), { recursive: true });
  await fs.appendFile(ARQ_AUDIT, JSON.stringify({ ts: new Date().toISOString(), ...entrada }) + '\n', 'utf8');
}

async function lerCalib(): Promise<string> {
  return fs.readFile(ARQ_CALIB, 'utf8');
}

/** Valida contra os registros reais carregando os módulos do jogo pelo SSR do Vite. */
async function validarRegistros(server: ViteDevServer, c: Calibracao): Promise<string[]> {
  try {
    const mod = await server.ssrLoadModule('/src/character/calibracao.ts');
    const expr = await server.ssrLoadModule('/src/character/expressions.ts');
    return validarContraRegistros(c, {
      keyframes: (id) => {
        const orig = mod.KF_ORIGINAIS.get(id);
        const k = orig ?? mod.keyframesDe(id);
        return k === null ? null : k === undefined ? undefined : k.map((f: [number]) => f[0]);
      },
      expressao: (id) => id in expr.EXPRESSIONS,
    });
  } catch (e) {
    return [`não foi possível carregar os registros para validar: ${(e as Error).message}`];
  }
}

async function listar(tipo: 'cenarios' | 'propostas') {
  await fs.mkdir(DIR[tipo], { recursive: true });
  const nomes = (await fs.readdir(DIR[tipo])).filter((f) => f.endsWith('.json')).sort();
  const out = [];
  for (const f of nomes) {
    try {
      const j = JSON.parse(await fs.readFile(path.join(DIR[tipo], f), 'utf8'));
      const st = await fs.stat(path.join(DIR[tipo], f));
      out.push({ nome: f.replace(/\.json$/, ''), titulo: j.titulo ?? '', alvo: j.alvo ?? j.evento ?? '', atualizado: st.mtime.toISOString() });
    } catch {
      out.push({ nome: f.replace(/\.json$/, ''), titulo: '(arquivo ilegível)', alvo: '', atualizado: '' });
    }
  }
  return out;
}

function tipoValido(t: unknown): 'cenarios' | 'propostas' {
  if (t === 'cenarios' || t === 'propostas') return t;
  throw new Erro(400, 'tipo deve ser "cenarios" ou "propostas"');
}
function nomeValido(n: unknown): string {
  if (typeof n !== 'string' || !NOME.test(n)) throw new Erro(400, 'nome inválido (use a-z, 0-9, - e _)');
  return n;
}

export function painelApi(): Plugin {
  return {
    name: 'viva-painel-api',
    apply: 'serve',
    configureServer(server) {
      definirRaiz(server.config.root);
      server.middlewares.use('/__painel/api', async (req, res) => {
        try {
          // só a própria origem local pode chamar (evita que outro site dispare escrita)
          const origem = req.headers.origin;
          if (origem && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) throw new Erro(403, 'origem não permitida');
          if (req.method !== 'GET' && req.headers['x-painel'] !== '1') throw new Erro(403, 'cabeçalho X-Painel ausente');
          const url = new URL(req.url ?? '/', 'http://localhost');
          const rota = url.pathname.replace(/^\/+/, '');

          if (req.method === 'GET' && rota === 'estado') {
            const texto = await lerCalib();
            await fs.mkdir(DIR.historico, { recursive: true });
            const historico = (await fs.readdir(DIR.historico)).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 50);
            let auditoria: unknown[] = [];
            try {
              auditoria = (await fs.readFile(ARQ_AUDIT, 'utf8')).trim().split('\n').filter(Boolean).slice(-300).map((l) => JSON.parse(l)).reverse();
            } catch { /* ainda não existe */ }
            return enviar(res, 200, { calibracao: JSON.parse(texto), hash: hash(texto), historico, auditoria, liberado });
          }
          if (req.method === 'GET' && rota === 'trava') return enviar(res, 200, { liberado });
          if (req.method === 'POST' && rota === 'trava') {
            const b = await lerCorpo(req);
            if (b.liberado === true) {
              if (b.confirmacao !== 'QUERO APLICAR') throw new Erro(400, 'para destravar envie a confirmação explícita');
              liberado = true;
            } else liberado = false;
            // travar/destravar não grava nada no projeto (só as aplicações são auditadas)
            return enviar(res, 200, { liberado });
          }
          if (req.method === 'GET' && rota === 'arquivos') {
            return enviar(res, 200, await listar(tipoValido(url.searchParams.get('tipo'))));
          }
          if (req.method === 'GET' && rota === 'arquivo') {
            const tipo = tipoValido(url.searchParams.get('tipo'));
            const nome = nomeValido(url.searchParams.get('nome'));
            return enviar(res, 200, JSON.parse(await fs.readFile(path.join(DIR[tipo], nome + '.json'), 'utf8')));
          }
          if (req.method === 'POST' && rota === 'arquivo') {
            const b = await lerCorpo(req);
            exigirLiberado();
            const tipo = tipoValido(b.tipo);
            const nome = nomeValido(b.nome);
            const c = b.conteudo;
            if (!c || typeof c !== 'object' || c.formato !== FORMATO[tipo]) throw new Erro(400, `conteúdo precisa ter "formato": "${FORMATO[tipo]}"`);
            if (tipo === 'propostas') {
              for (const v of c.variacoes ?? []) {
                const erros = validarCalibracao(v.calibracao);
                if (erros.length) throw new Erro(422, `variação "${v.nome}" inválida`, erros);
              }
            }
            await fs.mkdir(DIR[tipo], { recursive: true });
            const destino = path.join(DIR[tipo], nome + '.json');
            const existia = await fs.stat(destino).then(() => true, () => false);
            await fs.writeFile(destino, JSON.stringify(c, null, 2) + '\n', 'utf8');
            await auditar({ acao: existia ? 'sobrescrever' : 'salvar', arquivo: `qa/${tipo}/${nome}.json`, autor: b.autor ?? 'painel' });
            return enviar(res, 200, { ok: true, arquivo: `qa/${tipo}/${nome}.json` });
          }
          if (req.method === 'POST' && (rota === 'calibracao/previa' || rota === 'calibracao/aplicar')) {
            const b = await lerCorpo(req);
            const nova = b.calibracao as Calibracao;
            const erros = validarCalibracao(nova);
            if (!erros.length) erros.push(...(await validarRegistros(server, nova)));
            const antes = await lerCalib();
            const depois = erros.length ? antes : serializar(nova);
            const diff = diffTexto(antes.trimEnd(), depois.trimEnd());
            if (rota === 'calibracao/previa' || erros.length) return enviar(res, erros.length ? 422 : 200, { erros, diff, antes, depois });
            exigirLiberado();
            if (b.confirmacao !== 'QUERO APLICAR') throw new Erro(400, 'aplicação sem confirmação explícita');
            if (b.hashEsperado && b.hashEsperado !== hash(antes)) throw new Erro(409, 'src/data/calibracao.json mudou desde a prévia; gere a prévia de novo');
            if (typeof b.motivo !== 'string' || b.motivo.trim().length < 3) throw new Erro(400, 'informe o motivo da alteração');
            await fs.mkdir(DIR.historico, { recursive: true });
            const copia = `calibracao-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            await fs.writeFile(path.join(DIR.historico, copia), antes, 'utf8');
            await fs.writeFile(ARQ_CALIB, depois, 'utf8');
            liberado = false; // trava de novo depois de cada aplicação
            await auditar({ acao: 'aplicar-calibracao', arquivo: 'src/data/calibracao.json', copiaAnterior: `qa/historico/${copia}`, antes: hash(antes), depois: hash(depois), motivo: b.motivo.trim(), autor: b.autor ?? 'painel', origem: b.origem ?? null, diff: diff.split('\n').filter((l) => l.startsWith('+ ') || l.startsWith('- ')) });
            return enviar(res, 200, { ok: true, copiaAnterior: copia, diff, hash: hash(depois) });
          }
          if (req.method === 'POST' && rota === 'calibracao/reverter') {
            const b = await lerCorpo(req);
            exigirLiberado();
            if (b.confirmacao !== 'QUERO APLICAR') throw new Erro(400, 'reversão sem confirmação explícita');
            if (typeof b.arquivo !== 'string' || !/^calibracao-[0-9TZ-]+\.json$/.test(b.arquivo)) throw new Erro(400, 'arquivo de histórico inválido');
            const texto = await fs.readFile(path.join(DIR.historico, b.arquivo), 'utf8');
            const c = JSON.parse(texto);
            const erros = [...validarCalibracao(c), ...(await validarRegistros(server, c))];
            if (erros.length) throw new Erro(422, 'a versão do histórico não é mais válida com o código atual', erros);
            const antes = await lerCalib();
            const copia = `calibracao-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            await fs.writeFile(path.join(DIR.historico, copia), antes, 'utf8');
            const depois = serializar(c);
            await fs.writeFile(ARQ_CALIB, depois, 'utf8');
            liberado = false;
            await auditar({ acao: 'reverter-calibracao', para: `qa/historico/${b.arquivo}`, copiaAnterior: `qa/historico/${copia}`, antes: hash(antes), depois: hash(depois), autor: b.autor ?? 'painel', motivo: b.motivo ?? '' });
            return enviar(res, 200, { ok: true, diff: diffTexto(antes.trimEnd(), depois.trimEnd()) });
          }
          throw new Erro(404, `rota desconhecida: ${req.method} ${rota}`);
        } catch (e) {
          const er = e instanceof Erro ? e : new Erro(500, (e as Error).message);
          enviar(res, er.status, { erro: er.message, detalhes: er.detalhes ?? null });
        }
      });
    },
  };
}
