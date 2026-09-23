# Changelog

Entradas mais novas no topo. Cada lote registra: data, agente, o que foi criado (com ids), flags novas, consequências,
verificação e pendências. Modelo em `.agents/skills/viva-verificar-e-entregar/SKILL.md`.

## 2026-09-23 — Documentação, validador e preparação para delegação (Claude)
- **Ferramentas:** `npm run check` (typecheck + `scripts/check-content.ts`: ids únicos, referências literais, pose/expressão
  finitas, todos os eventos × 10 perfis de vida × todas as escolhas, ações, interações, agressões, entrevistas de todas as
  carreiras e 60 vidas simuladas), `npm run check:quick`, `npm run catalog` (gera `docs/CATALOGO.md`).
- **Docs:** `AGENTS.md`, `CLAUDE.md`, `docs/ARQUITETURA.md`, `docs/specs/SPEC-01..06`, `docs/BACKLOG.md`,
  `docs/PEDIDOS-ENGINE.md`, `docs/DELEGACAO-LUNA.md`; 7 skills em `.agents/skills/`.
- **Código:** `HELD` exportado de `render/props.ts` (para o validador); `tsx` e `@types/node` como devDependencies.
- **CI:** `pages.yml` roda o validador rápido antes de publicar; novo `check.yml` valida branches (ex.: `luna/*`) e PRs.

## 2026-09-23 — Expansão: realismo, consequências e agressões (Claude)
- Agressões com consequência estilo BitLife (10 tipos): esquiva, revide, ferimento, advertência/justa causa, detenção →
  suspensão → expulsão, castigo, término, B.O., julgamento e prisão (`game/aggression.ts`).
- Entrevistas realistas por vaga (`game/interviews.ts`): ambiente certo, roupa, perguntas ácidas, teste prático, probabilidade.
- Rig: coluna em 2 segmentos, respiração, ombros, punhos, inclinação de quadril. 25+ movimentos, 6 expressões.
- Novos ambientes: `mercado`, `boteco`, `cafeteria`, `delegaciaInterna`, `diretoria`.
- Novas cenas: `agressao`, `detencao`, `diretoria`, `demissaoSeguranca`, `boletim`, `entrevista2`, `churrasco`, `transito`,
  `filaHospital`, `festaFirma`, `reuniao`. Novos eventos: `churrasco`, `golpeZap`, `piramide`, `transito`, `filaSUS`,
  `festaFirma`, `chefeHumilha`, `provocacaoEscola`, `recuperacao`, `vizinho`.
- `react` e `mood` nos resultados: fim do "sorriso depois do soco". Editor mobile com close na parte editada.
- Correções: teste prático da entrevista não entrega a resposta; fila do hospital com cadeiras; condenação tira o emprego.

## 2026-09-23 — Protótipo inicial (Claude)
- Editor de personagem modular, 34 ambientes, 50+ situações, motor de vida anual, carreiras, relações, conquistas,
  save/load, trilha sintetizada, `Jogar.bat`, deploy no GitHub Pages.
