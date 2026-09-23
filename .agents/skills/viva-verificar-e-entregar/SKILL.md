---
name: viva-verificar-e-entregar
description: Verificar, documentar e entregar um lote de trabalho no VIVA! (npm run check, harness visual, catálogo, CHANGELOG, commit no branch). Use ao terminar qualquer lote de conteúdo, antes de dizer que acabou.
---

# Verificar e entregar um lote (VIVA!)

## 1. Validação automática (obrigatória)
```bash
npm run check      # typecheck + validador completo — precisa terminar com "✅ Tudo certo."
npm run build      # garante que o jogo empacota
```
- **Erro** (`❌`) = corrigir antes de seguir. A mensagem diz arquivo:linha ou o evento/escolha/perfil que falhou.
- **Aviso de cobertura** = um evento/escolha seu nunca rodou nos perfis de teste. Normalmente a `cond` está estreita
  demais. Corrija ou justifique no CHANGELOG.
- Nunca "conserte" o validador (`scripts/` é zona vermelha). Se achar que ele está errado, registre em `docs/PEDIDOS-ENGINE.md`.

## 2. Verificação visual (se tiver navegador)
Com `npm run dev` rodando:
- cada cena nova: `http://localhost:5199/?test&sit=<id>&age=30&at=<seg>` (2–3 instantes, 2 idades);
- cada movimento novo: `http://localhost:5199/?test&env=sala&n=3&ages=8,30,75&m=<id>&def=1`;
- cada ambiente novo: `http://localhost:5199/?test&env=<id>&n=3`;
- jogo real: `http://localhost:5199/#demo` → avance anos e use as interações novas.
Procure: personagem cortado, sobreposição, sorriso em cena de dor, pés afundando, texto estourando o balão.
Sem navegador: diga isso explicitamente no CHANGELOG ("verificação visual pendente").

## 3. Documentação (obrigatória)
1. `npm run catalog` (atualiza `docs/CATALOGO.md`).
2. `docs/CHANGELOG.md` — nova entrada no topo:
   ```md
   ## 2026-09-24 — Lote Luna 01: vida adulta e boletos (GPT Luna 6 Max)
   **Eventos (6):** `pixErrado`, `vizinhoVinganca` (retorno de `pixExposto`), ...
   **Cenas (3):** `furadeiraDomingo`, ...  **Movimentos (2):** `espreguicar`, ...  **Ambientes (1):** `loterica`
   **Flags novas:** `pixExposto` (idade em que expôs o golpista)
   **Consequências:** resumo das cadeias criadas.
   **Verificação:** npm run check ✅ · visual: ok nas cenas X, Y (ou "pendente").
   **Pendências/pedidos de engine:** ...
   ```
3. Flags novas na tabela da SPEC-01. Itens do BACKLOG marcados `[x]`.

## 4. Commit
```bash
git checkout -b luna/<tema>          # uma vez por lote (se ainda não estiver no branch)
git add -A
git commit -m "feat(conteudo): <resumo do lote>"
```
**Não faça push em `main`** nem altere configurações do GitHub sem o usuário autorizar explicitamente.
Se o usuário autorizar o push para publicar: `git push -u origin luna/<tema>` e avise que falta o merge em `main`
(o deploy do site só roda a partir de `main`).
