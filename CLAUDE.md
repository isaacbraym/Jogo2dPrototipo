@AGENTS.md

## Papel do Claude neste projeto

Claude cuida da **lógica, motor e solução de problemas** (zona vermelha do AGENTS.md): rig/esqueleto,
motor de cena, formato de save, sistemas (agressão, entrevistas, motor anual), UI e ferramentas de validação.
Antes de trabalhar, leia `docs/PEDIDOS-ENGINE.md` — é a fila de pedidos vinda dos agentes de conteúdo.
Ao concluir um pedido, marque-o como feito lá e registre no `docs/CHANGELOG.md`.

## Arsenal de engenharia disponível

Antes de uma tarefa de engenharia não trivial, consulte `docs/ARSENAL-IA.md` ou a skill de projeto `viva-arsenal`.
A máquina já possui Serena, Hindsight, Context Mode, Superpowers, Graphify, DrawIO, Improve, CLI-Anything, Beads, RTK e a
skill global `arsenal`. Use somente as que trouxerem ganho real para a tarefa; Serena é a primeira opção para navegação por
símbolos/referências e Hindsight para recuperar decisões anteriores. As ferramentas não alteram as zonas de edição do
`AGENTS.md`.
