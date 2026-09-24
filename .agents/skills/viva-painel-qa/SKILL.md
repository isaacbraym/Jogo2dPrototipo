---
name: viva-painel-qa
description: Atender um "pedido do painel de QA" do VIVA! — reproduzir o caso pela semente/cenário, localizar o código pelo ID e entregar variações (proposta JSON no escopo do calibrador ou variantes de código com sufixo), sem alterar outros ids. Use quando receber um texto "Pedido do painel de QA" ou precisar entregar ajustes finos de movimento/expressão.
---

# Atender pedido do Painel de QA (VIVA!)

Referência completa: `docs/PAINEL-QA.md` (§5 formatos, §6 procedimento por ID).

## 1. Ler o pedido
O pedido traz: **tipo e ID**, **cadeia** (ex.: `interacao agg_chute → cena agressao → trecho act:chute#1 → movimento chute → kf2`),
**arquivo:linha**, **semente**, **cenário**, **instante/trecho**, **valores atuais**, observação, melhoria e **nº de variações**,
e diz se o ajuste está **no escopo do calibrador** ou **exige código**.

## 2. Reproduzir (se tiver navegador)
`npm run painel` → Esteira: carregue o cenário citado (`qa/cenarios/<nome>.json`) e a semente → "▶ ver cena no laboratório" →
digite o instante → confira o trecho na lista "Ações do Director". Sem navegador: siga pelo arquivo:linha.

## 3a. Escopo do calibrador (movimento com keyframes / expressão)
- **Não edite código nem `src/data/calibracao.json`.**
- Crie `qa/propostas/<id>-<tema>.json` (formato `viva-proposta`) com as N variações. Cada variação altera só o necessário:
  ```json
  { "nome": "V1 mais peso no quadril", "nota": "por quê", "calibracao": { "formato": "viva-calibracao", "versao": 1,
    "movimentos": { "chute": { "keyframes": { "2": { "pose": { "legN.a": 1.6, "lean": -0.32 } } } } }, "expressoes": {} } }
  ```
- Índice do keyframe = posição no array `keyframes([...])` do movimento (kf0, kf1...). Campos permitidos e limites: tabela da
  SPEC-03 / `src/qa/limites.ts`. Instantes precisam continuar crescentes.
- `npm run check` valida a proposta (limites, ids, keyframes existentes). O usuário compara em A/B e aplica pelo painel.

## 3b. Exige código (movimento procedural, cena, evento, posição/câmera de cena)
1. Abra o arquivo:linha do pedido e identifique o **bloco do id** (do `{`/`case` do item até o fechamento correspondente).
2. Para variações comparáveis, crie **cópias com sufixo** no fim do mesmo registro: `chuteV1`, `chuteV2` (movimentos),
   `agressaoV1` (cenas). Não toque no original. O usuário abre cada uma no laboratório.
3. Quando o usuário escolher, substitua o **conteúdo** do bloco original pelo da variante (mantendo o id), apague as cópias.
4. Nunca renomeie ids, nunca edite outros blocos.

## 4. Entregar
- `npm run check` verde, `npm run catalog`.
- CHANGELOG: "Pedido do painel: <tipo> `<id>` (<cadeia>) → proposta qa/propostas/<arquivo> com N variações" (ou variantes de código).
- Commit no seu branch `luna/<tema>`.
