---
name: viva-criar-interacao
description: Criar interações com pessoas (aba Relações), atividades (aba Atividades), novos tipos de agressão e conteúdo de entrevistas de emprego no VIVA!, sempre com consequências variadas por contexto. Use ao editar src/game/activities.ts, aggression.ts ou interviews.ts.
---

# Criar interação, atividade, agressão ou entrevista (VIVA!)

Specs: `SPEC-01` (Outcome/consequências), `SPEC-05` (agressão/entrevistas), `SPEC-06` (tom)

## Interação com pessoa (`INTERACTIONS`, `src/game/activities.ts`)
```ts
{
  id: 'pedirConselho', label: 'Pedir conselho', icon: '🧓', group: 'Conversa',
  cond: (L, p) => L.player.age >= 10 && p.age > L.player.age + 15,
  run: (L, p) => {
    if (rng.chance(0.25)) { bond(p, -2); return O(`${p.first} aconselhou você a "investir em imóveis". Você tem ${money(L.money)}.`, 'neutro', { scene: sc(L, p, 'conversar') }); }
    bond(p, rng.int(3, 7)); stat(L, 'inteligencia', 2);
    return O(`${p.first} deu um conselho bom de verdade. Você vai ignorar, mas foi bom.`, 'bom', { scene: sc(L, p, 'conversar'), react: { npc: { expr: 'convencido' } } });
  },
},
```
- Acrescente **antes** do `...(Object.keys(AGGRO)...)` gerado automaticamente.
- `cond` por idade/relação (`p.rel`), `romantic(p)` para casal.
- A **mesma interação deve dar resultados diferentes por contexto**: relação (chefe × amigo × mãe), idade, vínculo (`p.bond`), traços (`p.traits`).
- Cena: `sc(L, p, acao)` usa ações de `physical()` (lista no CATALOGO). Precisa de ação nova? Crie o `case` (skill `viva-criar-cena`).

## Atividade (`ACTIONS`)
`{ id, label, icon, desc, group, minAge, maxAge?, cost?, cond?, run(L) }` — `cost` é cobrado pela UI. Pode retornar um
`PendingEvent` (`{ ev, ctx }`) para abrir escolhas. Grupos existentes no CATALOGO.

## Agressão nova
Siga "Como adicionar um tipo novo" na SPEC-05 (tipo + `AGGRO` + `verb` + `case` na cena `agressao`). Pense nas consequências
em **todos os contextos** (escola, trabalho, família, casal, rua) e escreva-as no CHANGELOG.

## Entrevista
- Perguntas novas: acrescente em `GENERIC` (valem para todas as vagas) ou em `INTERVIEWS[id].questions`.
- Cada pergunta: 1 resposta sensata (+2), 1 engraçada que funciona (+1..+3), 1 desastre (−2..−3), cada uma com `reply` ácido e `expr` do entrevistador.
- Frases de reprovação: acrescente em `REJECT`.
- Depois: `npm run check` e confira a linha "Contratação aleatória" (15–60% é o alvo).

## Consequências variadas (checklist)
- [ ] Pelo menos 2 desfechos possíveis por ação arriscada.
- [ ] Efeito em quem sofre a ação (vínculo, saúde, relação), não só no jogador.
- [ ] Contexto muda o resultado (lugar/relação/idade).
- [ ] Algo fica "lembrado" quando fizer sentido (flag → evento futuro).
