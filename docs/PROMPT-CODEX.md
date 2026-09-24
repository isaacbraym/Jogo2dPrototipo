# Prompt modelo para o Codex (continuidade das animações)

Copie o bloco abaixo, troque só o que está entre `<...>` e envie ao Codex. Ele já inclui a regra de **mostrar a tela do
jogo no chat** a cada passo, para você acompanhar o progresso em tempo real.

```text
Você vai continuar o trabalho de animação do VIVA! (C:\PROJETOS\Prototipo_Game2d).

ANTES DE TUDO, leia inteiros: AGENTS.md, docs/specs/SPEC-07-contato-entre-personagens.md,
docs/specs/SPEC-08-rastreio-de-altura-no-beijo.md e docs/PROMPT-CODEX.md (seção "Como mostrar a tela").
Parta do branch <claude/rastreio-beijo> e crie o seu: git checkout <claude/rastreio-beijo> && git pull && git checkout -b codex/<tema>.

TAREFA: <descreva aqui o que quer — ex.: "no beijo, o homem alto está encurvado demais; quero mais joelho e menos costas">.

COMO TRABALHAR:
1. Deixe `npm run dev` rodando num terminal separado.
2. ANTES de mudar qualquer coisa, capture o estado atual e MOSTRE NO CHAT:
   npm run capturar -- --roteiro <qa/roteiros/beijo-alturas.json>
   Mostre as imagens na resposta (sintaxe Markdown ![nome](caminho), uma por linha, como o comando imprime) e diga em
   1 linha o que vê de errado em cada uma.
3. Faça UMA mudança pequena por vez (na maioria dos casos só números da tabela RASTREIO_BEIJO, dentro das faixas
   seguras da SPEC-08 §5).
4. Depois de CADA mudança: rode de novo o mesmo roteiro e MOSTRE AS NOVAS IMAGENS NO CHAT, lado a lado com a legenda
   "antes → depois" e o que melhorou/piorou. Não acumule várias mudanças sem mostrar a tela.
5. Rode também o traço numérico da SPEC-08 §6.2 quando mexer em altura/contato e cole o resultado.
6. Repita até cumprir TODOS os critérios da SPEC-08 §6.3. Se piorar, desfaça a última mudança.

REGRAS: edite só o necessário para a tarefa; não mude lógica do motor sem necessidade (se precisar, explique por quê
antes); npm run check precisa terminar com "✅ Tudo certo."; registre no docs/CHANGELOG.md (autor Codex); atualize a
tabela de valores de referência da SPEC-08 §6.3 se os números mudarem; commit em pt-BR; git push -u origin codex/<tema>.
NUNCA faça push para main.

ENTREGA FINAL: (1) capturas finais no chat; (2) o que mudou, por arquivo, com os números antigo → novo; (3) traço
numérico final; (4) o que ficou pendente.
```

## Como mostrar a tela (vale para qualquer agente)

O jogo é desenhado em canvas; a forma confiável de ver o resultado é capturar a tela com o comando do projeto — ele
não depende de extensão, painel ou ferramenta de navegador da IA:

```bash
npm run capturar -- <nome> "<caminho>"                   # uma captura
npm run capturar -- --roteiro qa/roteiros/beijo-alturas.json   # várias de uma vez
```

- Usa o Edge/Chrome instalados, em modo headless com **tempo virtual**: a cena avança exatamente o tempo pedido e a
  captura sai no instante certo (o `&at=` da URL congela a cena; o script espera `at + 3 s` de tempo virtual).
- Saída: `qa/capturas/<data_hora>/<nome>.png` (pasta fora do git) e uma linha `![nome](caminho)` por imagem, pronta
  para colar no chat. Se a interface do chat não renderizar imagens locais, **abra/anexe os PNG** pela ferramenta de
  imagem que você tiver e descreva o que vê; nunca afirme que "ficou bom" sem ter olhado a imagem.
- `data={...}` pode ir em JSON puro dentro da URL (o script codifica). Tamanho: `--tam 1280x720`; tempo: `--tempo 9000`.
- Roteiros prontos ficam em `qa/roteiros/*.json` (formato no cabeçalho de `scripts/capturar.ts`). Para uma tarefa
  nova, crie um roteiro novo com os casos e momentos que importam (ex.: 3 casais × chegada/beijo/saída).
- Vitrines da tela de título: `npm run capturar -- vitrine "/?vitrine=casamento" --tempo 6000`.
- Se o comando disser que o jogo não respondeu, suba o `npm run dev` (porta 5199) e rode de novo.
