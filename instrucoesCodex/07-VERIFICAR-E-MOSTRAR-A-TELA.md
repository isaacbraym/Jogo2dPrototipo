# 07 · Verificar e mostrar a tela no chat

O usuário acompanha o progresso **vendo a tela no chat**. Nenhuma entrega visual sem imagem. Nunca diga "ficou bom" sem
ter aberto e olhado a captura.

## 1. Capturas (Edge/Chrome headless, sem depender de ferramenta de IA)

Com `npm run dev` rodando:

```bash
npm run capturar -- <nome> "<caminho>" [--tempo 5000] [--tam 1280x720]
```
```bash
npm run capturar -- --roteiro qa/roteiros/explorar.json
```

Saída: `qa/capturas/<data_hora>/<nome>.png` + uma linha `![nome](caminho)` por imagem. Cole essas linhas na resposta; se
o chat não renderizar imagem local, **abra o PNG** com a ferramenta de imagem que você tiver e descreva o que vê.
(O Edge headless às vezes falha na primeira vez — o script já tenta 3 vezes. Se falhar mesmo assim, rode de novo.)

### Parâmetros do modo Explorar (`/#explorar` = vida aleatória)

| Parâmetro | Exemplo | Faz |
|---|---|---|
| `ex=x,y` | `ex=3350,860` | põe o personagem ali (vai para o ponto andável mais perto) |
| `zoom=` | `zoom=0.55` (longe) … `1.3` (perto) | zoom da câmera |
| `hora=` | `hora=21` | hora do dia (0–24) — teste sempre dia **e** noite |
| `usar=obj:acao` | `usar=supino1:supino` | começa a ação na hora (sem requisitos; a ação fica rodando até você clicar) — ótimo para ver sentar/deitar/treinar |
| `idade=` | `idade=12` | idade da vida aleatória (menores: sem rua antes de 8, sem academia antes de 14, banho com cortina) |

A ordem é `/?<parâmetros>#explorar`, por exemplo:
```bash
npm run capturar -- supino "/?usar=supino1&zoom=1.1&hora=9#explorar"
```

Posições úteis (x, y): quarto `700,712` · banheiro `1450,712` · cozinha `2100,712` · sala `3000,712` ·
calçada em frente de casa `3350,860` · praça `4700,760` · ponto de ônibus `5700,860` · academia cardio `6900,720` ·
musculação `8200,720` · comércio `9500,860`.

### Parâmetros das cenas (resumo — detalhes em `AGENTS.md` §2)

- Cena congelada: `/?test&sit=<idCena>&age=30&at=4&data={"action":"abracar"}`
- Galeria de movimento: `/?test&env=<idAmbiente>&n=3&m=<movimento>&expr=<expressao>`
- Vitrine da tela de título: `/?vitrine=casamento` (`--tempo 6000`)

### Roteiro próprio para a sua tarefa

Crie `qa/roteiros/<tarefa>.json` com as telas antes/depois que provam o trabalho:

```json
{
  "tempo": 5000,
  "capturas": [
    { "nome": "sala-dia", "url": "/?ex=3000,712&zoom=0.8&hora=15#explorar" },
    { "nome": "sala-noite", "url": "/?ex=3000,712&zoom=0.8&hora=21#explorar" },
    { "nome": "piano-tocando", "url": "/?usar=piano:tocarPiano&zoom=1.1#explorar" }
  ]
}
```

## 2. No navegador (quando você tem um)

Console do jogo em `/#explorar`: `__ex` é o controlador.
- `__ex.teleportar(x, y)`, `__ex.zoom = 0.6`, `__ex.testarUso('cama', 'cochilar')`
- `__ex.est.hora = 21 * 60; __ex.avancar(0)` (noite), `__ex.est.nec.higiene = 5` (testar cheiro)
- `__ex.npcs` (quem está e o que faz), `__ex.carros`, `__ex.ocupado` (quem usa o quê)

## 3. Checklist de entrega (copie na resposta final)

```
- [ ] npm run check — sem erros (avisos de cobertura explicados)
- [ ] npm run catalog — rodado (se criou conteúdo)
- [ ] Capturas antes/depois no chat (dia e noite; perto e longe quando for cenário)
- [ ] Escala e profundidade conferidas (guia 01 §6)
- [ ] CHANGELOG com data, agente e ids criados
- [ ] Nada na zona vermelha editado (ou pedido aberto em docs/PEDIDOS-ENGINE.md)
- [ ] Commit no branch codex/<tema>, mensagem em português — sem push em main
```
