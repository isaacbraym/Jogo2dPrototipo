# Arsenal de IA para desenvolvimento do VIVA!

Este projeto pode usar um conjunto de ferramentas auxiliares já instalado na máquina. Elas existem para reduzir leitura bruta de arquivos, recuperar contexto entre sessões, entender arquitetura e investigar bugs com mais precisão.

O uso é **opcional e orientado pela tarefa**: escolha normalmente 1 a 3 ferramentas que realmente ajudem. As regras de edição, zonas verde/amarela/vermelha e validações de `AGENTS.md` continuam valendo integralmente.

## Estado verificado neste ambiente

Em 2026-09-24, o Claude Code desta máquina está com:

| Ferramenta | Como chega ao Claude | Estado | Melhor uso no VIVA! |
|---|---|---|---|
| **Arsenal** | skill global `arsenal` | disponível | escolher a combinação de ferramentas para uma tarefa |
| **Serena** | MCP | conectado | símbolos, referências, callers, navegação e edição localizada |
| **Hindsight** | MCP + skill | conectado | recuperar decisões e contexto de sessões anteriores |
| **Context Mode** | plugin + MCP | conectado | processar saída grande sem entupir a janela de contexto |
| **Superpowers** | plugin | habilitado | investigação disciplinada de bugs, planejamento e execução |
| **Graphify** | skill + CLI | disponível | mapa amplo da arquitetura e relações entre módulos |
| **DrawIO** | skill + app draw.io | disponível | diagramas editáveis de arquitetura/fluxos |
| **Improve** | skill | disponível | auditoria read-only e planos priorizados de melhoria |
| **CLI-Anything** | skill | disponível | controlar/aproveitar aplicativos externos quando houver CLI adequada |
| **Beads** | CLI `bd` | instalado globalmente | tarefas duráveis, dependências e handoff em projetos longos |
| **RTK** | CLI `rtk` | instalado globalmente | filtrar terminal muito barulhento de forma cirúrgica |

`bd where` informa que **este repositório ainda não possui workspace Beads ativo**. Não inicialize Beads só porque ele existe; use quando o trabalho realmente precisar de acompanhamento durável ou quando o usuário pedir.

## Como escolher rápido

| Situação no projeto | Ferramenta sugerida |
|---|---|
| “Onde este símbolo é usado?” / “quem chama isso?” | **Serena** |
| Alteração precisa em `Actor`, `Contato`, `Scene`, `Life`, `state` etc. | **Serena** antes de varrer arquivos inteiros |
| Entender um subsistema grande e suas dependências | **Graphify**, depois **Serena** nos pontos específicos |
| Bug difícil, regressão intermitente ou comportamento contraditório | **Superpowers** + **Serena**; consulte **Hindsight** se houver histórico |
| “O que já decidimos sobre beijo, contato, chão, rig, save...?” | **Hindsight** |
| Logs, testes, JSON ou saída de terminal muito grandes | **Context Mode**; **RTK** só se ainda fizer sentido filtrar na origem |
| Auditorar qualidade, riscos, dívida técnica ou próximos passos | **Improve** |
| Explicar arquitetura visualmente | **Graphify** → **DrawIO** |
| Automatizar algum programa externo | **CLI-Anything** |
| Trabalho longo com vários bloqueios e dependências | **Beads**, somente se houver/for criado um workspace apropriado |
| Não está claro qual ferramenta ajuda | **Arsenal** |

## Exemplos concretos para este jogo

### Serena — microscópio do código

Use Serena quando a pergunta estiver centrada em **um símbolo ou uma cadeia curta de referências**. Exemplos:

- descobrir todos os lugares que chamam ou alteram `Contato` antes de corrigir beijo/abraço;
- localizar quem lê ou grava um campo de `Life`/estado antes de mexer no save;
- entender os callers de uma função de `Scene` sem abrir dezenas de arquivos;
- fazer uma edição localizada em uma função depois que as referências estiverem claras.

Em código de zona vermelha, Serena ajuda a diminuir a área tocada, mas **não dá permissão para ignorar a zona vermelha**.

### Hindsight — memória histórica

Consulte Hindsight quando uma decisão atual puder depender do que já foi tentado ou decidido em sessões anteriores. É especialmente útil para temas recorrentes do VIVA!, como:

- rastreio de altura e contato entre personagens;
- alinhamento dos pés/chão;
- decisões sobre rig e animações;
- regras de save e compatibilidade;
- bugs que voltaram depois de uma correção anterior.

Evite criar outra memória paralela no projeto para a mesma finalidade.

### Graphify — mapa da cidade

Use Graphify quando a pergunta for ampla: “como esse pedaço inteiro funciona?”. Bons alvos são `src/scenes`, `src/character`, `src/game` ou um fluxo que atravesse vários desses diretórios. Depois do mapa amplo, use Serena para entrar nos símbolos que realmente precisam de alteração.

### Superpowers — processo de engenharia

É indicado para bugs difíceis, mudanças com várias etapas e tarefas em que vale formular hipóteses e validar cada uma. No VIVA!, combina bem com Serena: Superpowers organiza a investigação; Serena fornece a navegação precisa.

### Context Mode e RTK — não gastar contexto à toa

Context Mode já está integrado e deve ser preferido ao despejar milhares de linhas de log/teste na conversa. RTK é uma ferramenta manual complementar para comandos particularmente barulhentos; não configure um segundo mecanismo automático de compressão.

### Improve — auditoria, não implementação

Use para levantar bugs prováveis, riscos, gargalos, testes ausentes e melhorias priorizadas. O resultado serve como plano para Claude/Codex implementar depois. Não trate Improve como o agente que vai editar o código.

### DrawIO

Use quando um diagrama editável ajudar a entender uma área grande: fluxo anual, relações entre `Life`/eventos/cenas, pipeline de contato/animação, QA ou save. Para arquitetura grande, uma boa rota é Graphify primeiro e DrawIO depois.

### CLI-Anything

Serve para tarefas em que um aplicativo externo precisa participar do fluxo. Não force seu uso para tarefas que já são resolvidas diretamente por código, navegador ou CLI nativa.

### Beads

Use apenas para trabalho que precise sobreviver a sessões, tenha dependências/bloqueios ou precise ser retomado por outro agente. O CLI está instalado, porém este repositório não tem workspace Beads ativo no momento.

## Arsenal: roteador quando houver dúvida

O Arsenal global é a camada de roteamento. Em vez de chamar tudo, ele recomenda poucas ferramentas adequadas ao objetivo.

Exemplos de consulta local:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ai-arsenal\scripts\arsenal.ps1" recommend "investigar bug no contato entre personagens"

powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ai-arsenal\scripts\arsenal.ps1" tool serena

powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.ai-arsenal\scripts\arsenal.ps1" doctor
```

No Claude Code, a skill global `arsenal` também pode ser usada diretamente quando o roteamento for útil.

## Regras para não virar bagunça

1. Comece pela ferramenta mais específica; normalmente 1 a 3 bastam.
2. Não rode Graphify/Improve/diagramas pesados por rotina se uma busca localizada resolve.
3. Context Mode continua sendo a infraestrutura automática de contexto; não crie compressor concorrente.
4. Hindsight continua sendo a memória histórica; não duplique essa memória em arquivos improvisados.
5. Preserve qualquer WIP de outro agente. Antes de editar, confira `git status` e trabalhe somente nos arquivos necessários.
6. Não altere autenticação, endpoint, backend, plugins globais ou configuração do `codex-chatgpt-web` para executar uma tarefa do VIVA!.
7. Ferramentas auxiliares não mudam as zonas de edição nem as exigências de validação descritas em `AGENTS.md`.

