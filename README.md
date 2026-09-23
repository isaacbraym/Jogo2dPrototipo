# VIVA! — Uma vida, mil escolhas

Protótipo de simulação de vida 2D para navegador. Personagens vetoriais modulares, animação
procedural com esqueleto e IK, eventos com escolhas e consequências, relacionamentos, carreira,
crime, família, morte e herança — tudo desenhado por código, sem nenhum asset externo.

## Como jogar

- **Online:** https://isaacbraym.github.io/Jogo2dPrototipo/ (publicado automaticamente pelo GitHub Actions a cada push).

- **Duplo clique em `Jogar.bat`** (ou `Downloads\VIVA - Jogar.bat`). Ele abre `dist/index.html`
  numa janela de aplicativo do Chrome/Edge. Se o build não existir, ele instala e compila sozinho.
- Desenvolvimento: `npm install` e `npm run dev` → http://localhost:5199
- Build (arquivo único, funciona via `file://`): `npm run build` → `dist/index.html`

## Decisão de stack

| Opção avaliada | Veredito |
| --- | --- |
| Phaser / PixiJS (WebGL) | Ótimos para sprites; mas personagens vetoriais *redesenhados por quadro* (expressões interpoladas, roupas deformáveis, milhares de combinações) viram geometria tesselada a cada troca — pior custo/benefício aqui. |
| SVG + GSAP | Qualidade vetorial excelente, mas centenas de nós por personagem × várias pessoas em cena pesam no DOM e dificultam partículas/iluminação. |
| Spine / DragonBones | Exigem assets autorais e editores proprietários; inviável gerar 100% por código. |
| Three.js 2.5D | Sem ganho real para um jogo essencialmente 2D. |
| **Canvas 2D + TypeScript + Vite (escolhido)** | Controle total do pipeline vetorial, gradientes, sombreamento cel, Path2D, composição aditiva de luz; zero assets; ~9 ms/quadro com 8 personagens em renderização por software. |

- **Personagem**: rig esquelético procedural (pelve, tronco, pescoço, cabeça, braços e pernas de 2 ossos),
  IK analítico de 2 ossos, *crossfade* entre poses, keyframes com easing (antecipação, impacto, squash & stretch),
  solver de contato com o chão, mola física para cabelo/brincos, piscadas e olhar dirigido.
- **Expressões**: 23 expressões paramétricas interpoladas (sobrancelha, pálpebras, boca com dentes/língua,
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
  pintura, videogame, prova de direção...).
- **Áudio**: efeitos e trilha generativa sintetizados em WebAudio (sem arquivos).

## Estrutura

```
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
- Abas: Vida (diário), Atividades (30+), Relações, Carreira (16 profissões com promoções), Perfil (bens, 18 conquistas, save).
- Morte gera obituário com momentos marcantes; é possível continuar a linhagem como um dos filhos.

## Salvamento

- Vidas: salvamento automático a cada ano/ação (localStorage) + exportar/importar JSON.
- Personagens: "Salvar"/"Carregar" no editor + exportar/importar JSON.

## Harness de desenvolvimento

`/?test&sit=casamento&age=28&at=5` executa uma situação e congela no instante indicado;
`/?test&env=parque&n=4&ages=5,30,70` mostra uma galeria de personagens.
