# 05 · Diálogos e interações

Três lugares recebem diálogo novo — escolha o certo:

| Com quem | Onde | Lista |
|---|---|---|
| Desconhecidos e rostos conhecidos (frequentadores da academia) | `src/explorar/gente.ts` 🟡 | `INTERACOES_ESTRANHO` |
| Contatos (já estão na aba Relações) | `src/explorar/gente.ts` 🟡 | `INTERACOES_CONTATO` |
| Gente de passagem na calçada | `src/explorar/gente.ts` 🟡 | `INTERACOES_PASSANTE` |
| Falas soltas de ambiente | `src/explorar/gente.ts` 🟡 | `PAPO_AMBIENTE` (academia), `FALAS_CASA` (família), `puxaConversa()` |
| Interações da aba Relações (menu clássico) | `src/game/activities.ts` 🟢 | `INTERACTIONS` — receita `.agents/skills/viva-criar-interacao/` |

## 1. Formato de uma interação do mundo

```ts
  {
    id: 'pedirInformacao', label: 'Pedir informação', icon: '🗺️', para: true,
    // quando aparece no menu (c.hoje = quantas vezes já fez com essa pessoa HOJE)
    pode: (c) => c.hoje === 0,
    run: (c) => {
      const perdido = rng.chance(0.3);
      return {
        eu: 'Com licença, onde fica a padaria?',
        ela: perdido ? 'Padaria? Moço(a), eu nem sei onde EU fico.' : 'Segue reto, é do lado da farmácia!',
        texto: perdido ? 'A pessoa estava mais perdida que você.' : 'Você recebeu uma informação útil.',
        tom: perdido ? 'neutro' : 'bom',
        reacaoNpc: perdido ? 'darOmbros' : 'apontar',
        social: 2,
        diversao: perdido ? 3 : 0,
      };
    },
  },
```

`CtxInteracao` (o `c`): `L` (a vida), `est` (estado do Explorar: hora, necessidades), `p` (a pessoa), `f` (frequentador:
familiaridade `f.fam`, `f.nomeConhecido`), `ocupada` (id do aparelho que ela está usando), `lugar`, `hoje`.

`Resultado` (o que `run` devolve):

| Campo | O quê |
|---|---|
| `eu` / `ela` | falas em balão (jogador / pessoa). Curtas: até ~70 caracteres cabem bem |
| `texto` | registro no diário do dia (o que aconteceu, com a graça) |
| `tom` | `'bom' \| 'ruim' \| 'neutro'` — cor do registro |
| `fisico` | animação de dois (de `physical()` em `situations.ts`: `apertoMao`, `highFive`, `abracar`, `conversar`...) |
| `reacaoNpc` | movimento só da pessoa (`acenar`, `bracosCruzados`, `rir`, `darOmbros`... — ver `docs/CATALOGO.md`) |
| `expr` | expressão da pessoa (`feliz`, `bravo`, `envergonhado`...) |
| `social` / `diversao` | mudança nas necessidades do jogador |
| `novoContato` | só o "pedir contato" usa |

Consequências extras dentro do `run`: `mudarFam(c.f, ±n)` (familiaridade de desconhecidos), `bond(c.p, ±n)` (vínculo de
contatos), `stat(c.L, 'felicidade', ±n)`, `lembrar(c.L, c.p, 'favor' | 'magoa' ..., peso, 'frase')` (memória do
relacionamento — ver `docs/RELACIONAMENTOS.md`), `c.L.money`.

## 2. Regras de escrita

1. **Toda interação tem consequência** (necessidade, familiaridade, vínculo, stat, dinheiro, memória).
2. **Personalidade importa**: use `traco(c.p, 'tímido' | 'rabugento' | 'engraçado' | 'gentil' ...)` para variar a
   resposta. Pelo menos 2 variações de resposta por interação (`rng.pick([...])`), de preferência 3–5.
3. **Repetição cansa**: com `c.hoje >= 1`, a segunda vez no dia rende menos ou fica esquisita (veja `elogiarTreino`).
4. **Contexto**: use `c.lugar`, `c.est.hora` (manhã/noite), `c.est.nec.higiene` (fedendo?), `c.ocupada` (no meio da
   série) para respostas que "percebem" a situação.
5. **Gênero**: jogador com `(a)` (`"Você foi convidado(a)"`), NPC com `he(c.p, 'ele', 'ela')` / `he(c.p, 'o', 'a')`.
6. **Tom**: humor ácido e carinhoso (SPEC-06). Nada de ofensa a grupos, pessoas/marcas reais, conteúdo sexual com
   menores. Paquera e romance só pelas interações clássicas (elas já checam idade e estado civil — `podeNamorar`).
7. **Passantes** não viram contato e não guardam memória: use só necessidades, humor e, no máximo, um stat pequeno.

## 3. Ideias prontas para passantes (a fila do usuário: "depois melhoramos isso")

Hoje só existem *Cumprimentar* e *Perguntar as horas*. Boas próximas (cada uma com 3–5 respostas e consequência):
- **Pedir informação** (como o exemplo acima).
- **Elogiar o cachorro/look** (só se a pessoa carrega `sacola`/`guardaChuva`? → use `rng` e o horário).
- **Pedir um trocado** (dinheiro +1…+5 com chance baixa; felicidade −1 se humilhante; recusas engraçadas).
- **Comentar o tempo** ("Que calor, hein?" — respostas variando pela `hora`).
- **Perguntar se conhece um bom lugar para comer** (dica que vira texto; diversão +2).

## 4. Como testar

- `npm run dev`, abra `/#explorar`, vá para a calçada (`__ex.teleportar(5000, 850)` no console) e clique num passante.
- Para desconhecidos da academia: `__ex.teleportar(7000, 720)` e clique numa pessoa. Para ver o menu de contato, faça o
  caminho da amizade ou peça ao Claude um cenário de QA.
- Capture o balão: `npm run capturar -- papo "/?ex=5000,850&zoom=1.1#explorar"` (o balão precisa estar na tela no
  instante da captura — no navegador é mais fácil: faça a interação e tire o print).
