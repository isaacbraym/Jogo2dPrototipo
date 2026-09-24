# VIVA! — Uma vida, mil escolhas

Protótipo de simulação de vida 2D para navegador. Personagens vetoriais modulares, animação
procedural com esqueleto e IK, eventos com escolhas e consequências, relacionamentos, carreira,
crime, família, morte e herança — tudo desenhado por código, sem nenhum asset externo.

## Repositório e publicação

| | |
|---|---|
| **Repositório** | https://github.com/isaacbraym/Jogo2dPrototipo (branch `main`) |
| **Jogar online** | **https://isaacbraym.github.io/Jogo2dPrototipo/** |
| **Pasta local** | `C:\PROJETOS\Prototipo_Game2d` |
| **Deploy** | Automático: cada push em `main` roda o workflow `.github/workflows/pages.yml` (Actions → "Publicar no GitHub Pages"), que faz `npm ci` + `npm run build` e publica `dist/` no GitHub Pages em ~1 minuto. Nenhum passo manual. |

Para publicar uma mudança: `git push origin main` e aguarde o workflow ficar verde em
https://github.com/isaacbraym/Jogo2dPrototipo/actions.

## Como jogar

- **Online:** https://isaacbraym.github.io/Jogo2dPrototipo/ (qualquer PC ou celular, sem instalar nada).

- **Duplo clique em `Jogar.bat`** (ou `Downloads\VIVA - Jogar.bat`). Ele abre `dist/index.html`
  numa janela de aplicativo do Chrome/Edge. Se o build não existir, ele instala e compila sozinho.
- Desenvolvimento: `npm install` e `npm run dev` → http://localhost:5199
- Build (arquivo único, funciona via `file://`): `npm run build` → `dist/index.html`

## Comandos

| comando | o que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com hot reload (porta 5199) |
| `npm run check` | **validação completa**: typecheck + validador de conteúdo (roda todos os eventos/escolhas/interações, entrevistas e 60 vidas simuladas) |
| `npm run check:quick` | validador rápido |
| `npm run catalog` | regenera `docs/CATALOGO.md` com tudo que existe no jogo |
| `npm run painel` (ou `Painel.bat`) | **Painel de QA local** (http://localhost:5199/painel.html): catálogo, esteira de eventos, laboratório de cenas/animações, calibrador A/B — só desenvolvimento, nunca publicado |
| `npm run build` | typecheck + build de arquivo único em `dist/index.html` |

## Documentação

| documento | conteúdo |
|---|---|
| [`AGENTS.md`](AGENTS.md) | regras para agentes de IA (zonas de edição, comandos, fluxo de entrega) |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | como o jogo funciona por dentro |
| [`docs/CATALOGO.md`](docs/CATALOGO.md) | lista gerada de eventos, cenas, movimentos, expressões, ambientes, objetos e flags |
| [`docs/specs/`](docs/specs) | contratos de conteúdo: eventos/consequências, cenas, animação, ambientes, agressão/entrevistas, humor |
| [`.agents/skills/`](.agents/skills) | receitas passo a passo (criar evento, cena, animação, ambiente, interação, humor, verificação) |
| [`docs/BACKLOG.md`](docs/BACKLOG.md) | ideias priorizadas de conteúdo |
| [`docs/PEDIDOS-ENGINE.md`](docs/PEDIDOS-ENGINE.md) | fila de mudanças de motor |
| [`docs/PAINEL-QA.md`](docs/PAINEL-QA.md) | painel de QA: uso, formatos, limites de edição, colaboração por ID |
| [`docs/DELEGACAO-LUNA.md`](docs/DELEGACAO-LUNA.md) | divisão de trabalho entre agentes + prompt para o GPT Luna |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | histórico de mudanças |

## Decisão de stack

| Opção avaliada | Veredito |
| --- | --- |
| Phaser / PixiJS (WebGL) | Ótimos para sprites; mas personagens vetoriais *redesenhados por quadro* (expressões interpoladas, roupas deformáveis, milhares de combinações) viram geometria tesselada a cada troca — pior custo/benefício aqui. |
| SVG + GSAP | Qualidade vetorial excelente, mas centenas de nós por personagem × várias pessoas em cena pesam no DOM e dificultam partículas/iluminação. |
| Spine / DragonBones | Exigem assets autorais e editores proprietários; inviável gerar 100% por código. |
| Three.js 2.5D | Sem ganho real para um jogo essencialmente 2D. |
| **Canvas 2D + TypeScript + Vite (escolhido)** | Controle total do pipeline vetorial, gradientes, sombreamento cel, Path2D, composição aditiva de luz; zero assets; ~9 ms/quadro com 8 personagens em renderização por software. |

- **Personagem**: rig esquelético procedural (pelve com inclinação, coluna em 2 segmentos (lombar + peito), respiração,
  ombros com *shrug*, pescoço, cabeça, pulsos, braços e pernas de 2 ossos),
  IK analítico de 2 ossos, *crossfade* entre poses, keyframes com easing (antecipação, impacto, squash & stretch),
  solver de contato com o chão, mola física para cabelo/brincos, piscadas e olhar dirigido.
- **Expressões**: 29 expressões paramétricas interpoladas (sobrancelha, pálpebras, boca com dentes/língua,
  lágrimas, rubor, suor, veia de raiva, olhos de coração, olhos tontos...).
- **Aparência**: 60+ parâmetros — corpo, rosto (7 formatos + 5 sliders), pele (16 tons + custom, subtom, sardas,
  pintas, rubor), olhos (8 formatos, 8 sliders, íris), sobrancelhas (8), nariz (8), boca (6), orelhas (5),
  21 penteados com camadas frente/trás, 8 estilos de barba, maquiagem, 11 roupas + 13 contextuais,
  estampas, 7 calças/saias, 6 calçados, óculos, chapéus, brincos, colares. Envelhecimento (bebê → idoso),
  cabelos grisalhos, rugas e **herança genética** (filhos misturam traços dos pais).
- **Ambientes**: 34 cenários com parallax, camadas estáticas em cache, camadas animadas, partículas
  ambientes (chuva, pétalas, vagalumes, folhas) e pós-processamento (tinta, vinheta, flash, fade).
- **Cenas**: 50+ situações roteirizadas por um *Director* assíncrono (nascimento, aniversário, escola,
  valentão, briga, formatura, encontro, beijo, pedido, casamento, término, entrevista, promoção,
  demissão, academia, balada, show, médico, hospital, tropeço, férias, acampamento, cassino, loteria,
  crime, prisão, julgamento, cela, bebê, adoção de pet, passeio, funeral, morte, meditação, briga
  familiar, cinema, casa nova, carro novo, viagem, aposentadoria, cozinha em chamas, biblioteca,
  pintura, videogame, prova de direção, agressão com revide, detenção, diretoria, demissão escoltada,
  boletim de ocorrência, entrevista no local da vaga, churrasco, trânsito, fila do SUS, festa da firma, reunião...).
- **Áudio**: efeitos e trilha generativa sintetizados em WebAudio (sem arquivos).

## Estrutura

```
scripts/       check-content.ts (validador) e catalog.ts (gera docs/CATALOGO.md)
docs/          arquitetura, specs, catálogo, backlog, changelog
.agents/       skills para agentes de IA
src/
  core/        math, rng determinístico, cor, áudio sintetizado
  character/   aparência, rig/IK, poses e movimentos, expressões, corpo, cabeça, cabelo, ator
  render/      primitivas vetoriais, cenário, props (60+ objetos), partículas
  scenes/      ambientes, cena/câmera/director, situações roteirizadas, stage
  game/        estado, eventos, atividades, interações, carreiras, motor anual, save/load
  ui/          título, editor, jogo, retratos, estilos
```

## Jogabilidade

- **+1 ANO** (ou `Espaço`) avança a vida; eventos aparecem com escolhas (`1`–`4`), `Enter` continua, `Esc` pula a cena.
- **Ações físicas**: barra no palco (acenar, dançar, pular, comemorar, rir, chorar, bravo, pensar, meditar, reverência)
  e clique direto nos personagens; na aba *Relações*, interações animadas (abraço, beijo, toca aqui, aperto de mão,
  dança, presente, elogio, discussão, empurrão, tapa, soco...).
- **Agressões com consequência** (estilo BitLife): xingar, pegadinha, empurrar, jogar bebida, humilhar, tapa,
  roubar, soco, chute, cabeçada. A vítima pode se esquivar, revidar ou se machucar; no trabalho vem advertência
  ou justa causa (escoltado pelo segurança); na escola, detenção → suspensão → expulsão conforme reincidência;
  em família/relacionamento, castigo ou término; adultos podem levar B.O., multa, processo e prisão.
- **Entrevistas realistas**: cada vaga tem entrevista no ambiente certo (caixa no mercado, músico no boteco,
  barista na cafeteria, policial na delegacia...), escolha de roupa (terno no boteco pega mal), perguntas com
  humor ácido e um teste prático. A chance de contratação depende das respostas, atributos, ficha e sorte —
  reprovar faz parte.
- Abas: Vida (diário), Atividades (30+), Relações, Carreira (16 profissões com promoções), Perfil (bens, 18 conquistas, save).
- Morte gera obituário com momentos marcantes; é possível continuar a linhagem como um dos filhos.

## Salvamento

- Vidas: salvamento automático a cada ano/ação (localStorage) + exportar/importar JSON.
- Personagens: "Salvar"/"Carregar" no editor + exportar/importar JSON.

## Harness de desenvolvimento

`/?test&sit=casamento&age=28&at=5` executa uma situação e congela no instante indicado;
`/?test&env=parque&n=4&ages=5,30,70&m=dancar&expr=feliz` mostra uma galeria de personagens com movimento/expressão;
`/#demo` abre o jogo direto com um personagem aleatório de 25 anos.
