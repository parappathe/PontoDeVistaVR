# PontoDeVistaVR

Ponto de Vista: quebra-cabeça em VR para o Meta Quest 3 no navegador (WebXR), sem instalar nada.
Uma galeria branca de uns 3 x 3 m (cabe na sala de verdade, não precisa andar com analógico). No
meio flutuam pedaços soltos e coloridos; de um ponto exato do espaço eles se alinham e formam uma
figura. O corpo é o controle: andar, abaixar, ficar na ponta dos pés, inclinar a cabeça. Achou o
ponto, a figura trava, brilha e vai para uma moldura na parede (a galeria vira o museu do seu
progresso). 15 fases em 3 grupos. Também joga no PC com mouse e teclado. Tudo em português.

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos **https://parappathe.github.io/PontoDeVistaVR/** (ou a
página inicial https://parappathe.github.io/) e apertar "Entrar em VR". Para atualizar o site:
commitar e rodar `python publicar.py PontoDeVistaVR` na pasta `C:\claude code`.

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8804` (o painel de
visualização usa `.claude/launch.json`). O `serve.py` manda o navegador não guardar cache;
`python serve.py --https` serve para abrir no Quest pela rede de casa.

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Achar o ponto | Andar, abaixar, ficar na ponta dos pés, inclinar a cabeça | Clique na tela trava o mouse para olhar; WASD ou setas andam; Shift ou C abaixa, Espaço sobe (ponta dos pés), X volta a ficar de pé |
| Pegar pedaço solto (grupo Mexer) | Gatilho ou botão lateral: pega o pedaço perto da mão (20 cm) ou o que o raio aponta. Segurando e soltando | Segurar o botão do mouse com a mira em cima do pedaço; soltar o botão solta |
| Girar / afastar o pedaço | Girar o pulso; analógico para os lados gira, para frente/trás afasta/aproxima | Roda do mouse ou Q/E giram; R afasta, F aproxima |
| Dica (depois de 1 min) | A ou X | H |
| Pausa | B ou Y | Esc ou P |
| Andar/virar sem sair do lugar (opcional) | Analógico esquerdo anda devagar; direito vira 30° | - |
| Menu | Apontar e gatilho | Clique |

Retorno sem entregar a resposta: uma nota contínua (duas vozes que batem quando a figura está
embaralhada e ficam afinadas, com uma quinta por cima, quando ela se alinha) e poeira que se
organiza no desenho da figura quando você chega bem perto. A cabeça tem que ficar a até 15 cm do
ponto e todos os pedaços a menos de 5° do lugar, por 0,3 s; aí a figura trava (sino, vibração),
os pedaços deslizam até virar uma peça só e brilham.

"Recentralizar" (na pausa, só no VR) põe o centro da galeria onde o jogador está, de frente para
-z. Também acontece ao entrar no VR. Com a opção "Ajustar à altura" (menu), a fase inteira é
escalada pela altura dos olhos medida ao recentralizar (1,6 m = tamanho original, entre 0,85 e
1,12): quem é baixo consegue as fases "na ponta dos pés" e a ilusão continua perfeita.

### Fases (em `js/levels.js`)

- **Grupo 1, Olhar** (só achar o ponto): 1 Peixe (de pé), 2 Casa (agachado), 3 Pássaro (ponta dos
  pés), 4 Barco (meio agachado), 5 Rosto (mestre: 15 pedaços, ponto baixo num canto).
- **Grupo 2, Mexer** (pegadas no chão mostram onde ficar e a altura; alguns pedaços estão fora do
  lugar e têm que ser pegos e encaixados): 6 Chave (1 pedaço), 7 Árvore (2), 8 Gato (2, agachado),
  9 Foguete (3), 10 Relógio (mestre: 4, ponta dos pés). Pedaço solto que é solto perto do lugar
  certo (5° de direção, ±20% de distância, 25° de giro, contando a simetria) encaixa com um clique.
- **Grupo 3, Tornar real** (a figura alinhada vira objeto de verdade): 11 A ponte (robozinho
  atravessa), 12 Escada impossível (até uma plataforma que flutua), 13 A chave da porta (a chave
  voa até a fechadura, gira, a portinha abre e o robô entra), 14 Dois olhares (ponte e depois
  escada, de dois pontos de vista em sequência), 15 O caminho (mestre: escada e depois chave com 2
  pedaços soltos; o robô entra pela porta).

Passar uma fase libera a próxima. Progresso salvo no navegador (localStorage, chave
`pontodevistavr.v1`): fases feitas e melhor tempo; opções de som, ajuste de altura e FPS.
Dica: depois de 60 s na etapa. Nos grupos 1 e 3 mostra uma pegada azul transparente 15 a 25 cm ao
lado do ponto certo, com a altura aproximada escrita; no grupo 2 faz piscar os pedaços fora do lugar.

## Como testar

- `node tests/run.js` (ou `npm test`), sem som: matemática; construção da ilusão (cada fragmento
  na reta olho → pedaço e escalado pelo mesmo k); para cada etapa de cada fase: do ponto certo
  alinha, a 6 cm ainda alinha, a 30 cm (6 direções) não alinha e de lado/cima/baixo a figura some
  (erro médio > 7°), nenhum dos 400 pontos sorteados na sala alinha, a nota de guia sobe ao se
  aproximar; pontos dentro de 1,3 m do centro e entre 0,9 e 1,8 m de altura; fragmentos dentro da
  sala e longe do olho; pedaços soltos ao alcance da mão, começando fora do lugar; encaixe (perto
  encaixa, longe ou girado não, meia volta só serve em peça simétrica); e o **robô**
  (`tests/robot.js`) que anda até cada ponto, encaixa os pedaços com um errinho de propósito e
  termina **todas** as 15 fases (inclusive as de duas etapas, robozinho e porta). Tem que terminar
  com "Tudo certo".
- No navegador (console), objeto `pv.dev`:
  - `pv.dev.loadLevel(1)` carrega a fase 1 (número de 1 a 15);
  - `pv.dev.stand()` leva a cabeça ao ponto de vista sem arrumar nada (para ver os soltos);
  - `pv.dev.solve()` leva a cabeça ao ponto e encaixa os pedaços soltos da etapa atual;
  - `pv.dev.advance(3)` roda 3 s de jogo na hora (o painel escondido não anima a página);
  - `pv.dev.solveAll()` resolve a fase inteira; `pv.dev.state()` mostra o estado e a nota.
  - `pv._hold` expõe pegar/girar/soltar do mouse (usado para testar o encaixe pelo caminho do PC).
- **Só dá para testar no óculos:** conforto e altura dos pontos, se a tolerância (15 cm / 5°) é
  boa com a cabeça de verdade, pegar e girar pedaço com o controle e com as mãos (pinça), raio do
  controle, vibração, recentralizar, ajuste de altura, som, FPS.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", mira, altura dos olhos e textos do PC |
| `js/math3.js` | Vetores e quatérnios em arrays, câmera sem rolagem, sorteio com semente. Sem navegador |
| `js/figures.js` | As figuras 2D (peças `bar`, `rect`, `disc`, `arc`, `tri`, `cube`), ponte e escada feitas por função, geometria, simetria e pontos sorteados de cada peça. Sem navegador |
| `js/anamorph.js` | A ilusão: planos da figura, `buildStage` (gera os fragmentos), `measure` (alinhamento e notas), `snapCheck` (encaixe), poeira, tolerâncias (`TOL`, `SNAP`, `ROOM`). Sem navegador |
| `js/levels.js` | As 15 fases e os 3 grupos, plataformas, porta e caminho do robô. Sem navegador |
| `js/game.js` | `Game`: etapas, trava, fusão, brilho, robô andando, chave voando, porta, dica, pose de cada pedaço para desenhar. Sem navegador |
| `js/main.js` | Liga tudo: render, cabeça, controles do Quest, mouse/teclado, segurar pedaços, menus, pausa, recentralizar, som, depuração (`pv.dev`) |
| `js/scene.js` | Galeria (sala, luz, molduras e placa), desenho 2D das figuras nas molduras, malhas dos fragmentos, plataformas, porta, robô, pegadas e poeira |
| `js/ui.js` | Painel de menu 3D (o mesmo do TeatroSombras/ArcoFlechaVR, com cores e quadradinho de fase próprios) e etiqueta de texto |
| `js/audio.js` | Sons sintetizados: zumbido que afina, sino, encaixe, robô, chave, porta |
| `js/save.js` | Progresso e opções salvos |
| `tests/run.js`, `tests/robot.js` | Testes e o jogador robô |
| `serve.py` | Servidor local sem cache (porta 8804; `--https` para o Quest) |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas (metros, "galeria"): chão y = 0, centro da sala x = z = 0, paredes em ±1,75, área de
jogo (tapete) ±1,5, pontos de vista a até 1,3 m do centro. No PC o jogador começa em
(0; 1,6; 1,35) olhando para -z. Molduras: 4 por parede na ordem norte, leste, sul, oeste (a 16ª é
a placa da galeria).

## Regras e convenções do projeto

- `math3.js`, `figures.js`, `anamorph.js`, `levels.js` e `game.js` não podem usar navegador nem
  Three.js: os testes rodam no Node.
- Fragmentos sempre gerados a partir da figura + ponto de vista (homotetia de centro no olho:
  `k` vezes mais longe e `k` vezes maior); nunca posicionar fragmento à mão. O `k` fica nas faixas
  0,38–0,62 ou 1,55–2,2 (longe de 1, senão o pedaço não esconde nada). Peça com `on: i` fica na
  frente da peça i (k menor).
- Figura nova: peças 2D em `figures.js`, com cor forte. Fase nova: em `levels.js`, com semente
  própria; se `buildStage` reclamar que um pedaço não coube na sala, troque a semente ou o centro.
- Mexeu em figura, fase ou tolerância: rodar `node tests/run.js`.
- Desempenho de Quest: sem sombras, sem pós-processamento, 3 luzes simples, materiais Lambert.

## Decisões

- Ideia pedida pelo Eduardo: quebra-cabeça de perspectiva ("o corpo é o controle"), no mesmo
  caminho dos outros jogos VR (WebXR, Three.js local, GitHub Pages).
- Alinhamento medido pela direção de cada fragmento visto do olho contra a direção do lugar dele
  na figura, mais a diferença de tamanho aparente (pesa pouco, mas faz a figura "desmontar"
  também quando se anda para frente/trás na linha de visão). A nota de guia não usa a distância
  até o ponto: só o que se vê.
- Duas notas: `score` (escala de 9°, guia o som de longe) e `fine` (2,5°, a poeira só se organiza
  perto). A trava exige 15 cm e 5°.
- Pedaços soltos ficam a ~52 cm do ponto de vista (ao alcance da mão) e começam deslocados por um
  giro "de câmera" em volta do olho, mais uma rolagem: assim no PC, pegando do ponto e virando a
  câmera para o buraco, a direção já volta certa e só falta girar com a roda.
- Encaixe por proximidade ao soltar (com simetria da peça), para não exigir precisão de 6 graus
  de liberdade com o controle.
- No grupo 3 a figura fica num plano vertical que é o próprio objeto (lateral da ponte e da
  escada): ao fundir, os pedaços vão para k = 1 e o objeto é de verdade, então o robô anda nele.
- Ajuste de altura por escala uniforme da fase (não mexe na sala nem nas molduras).
- Porta 8804 (a 8794 é de outro projeto).

## Pendências / problemas conhecidos

- **Nada foi testado no Quest ainda**: alturas dos pontos (principalmente "ponta dos pés" e o
  1,70 m), tolerância com a cabeça de verdade, pegar/girar com controle e com as mãos, raio,
  vibração, recentralizar, ajuste de altura, som e FPS.
- O jogo no navegador do PC foi conferido só por um Chrome sem tela (prints e `pv.dev`), sem
  pessoa jogando: mouse travado (pointer lock), Esc e roda do mouse não foram usados de verdade.
- Em sala real menor que 3 x 3 m alguns pontos podem ficar perto da parede: use o analógico
  esquerdo para andar ou recentralize mais para o meio.
