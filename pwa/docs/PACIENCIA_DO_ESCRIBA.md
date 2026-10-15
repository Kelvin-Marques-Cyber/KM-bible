# Paciência do Escriba — design de jogo para KM-Bible

**Estado:** documento de design; implementação ainda não iniciada.
**Produto:** PWA KM-Bible · Ferramentas e Games · single-player/offline.
**Proposta:** um verdadeiro jogo de paciência, com progressão visual e treino
bíblico de evocação ativa. A estética é pixel art HD original (não retrô borrado).

## 1. Fantasia e identidade

Nome do jogo: **Paciência do Escriba**.
Subtítulo: *Um verso de cada vez*.

O jogador organiza quatro coleções de cartas numa mesa de madeira em um
scriptorium iluminado, e recupera memórias da Escritura em momentos oportunos.
Não existem apostas, caixas de recompensa aleatória vendidas, gastos,
moeda real nem pressão para entrar diariamente.

**Estética:** pixel art 16-bit/32-bit com desenho em alta definição, sem
ampliação borrada: sprites em múltiplas escalas (1×/2×/3×, filtro
`image-rendering: pixelated` somente nas artes), fundo de arquitetura bíblica
editorial, tinta dourada, pergaminho, lápis-lazúli, madeira, luz suave de vela,
constelações discretas e plantas. A interface textual não deve ser pixelizada:
versículos, referências, enunciados e botões continuam em fonte legível,
com alto contraste e escala acessível.

Base artística: composição de referência 480×270, renderizada com escala
inteira para 1080p/1440p quando possível; cartas físicas em 64×96 ou
96×144 pixels por escala, com bordas nítidas e sombras finas. Conteúdo textual
fora do sprite para não sofrer perda de definição. 30–60fps com animações CSS;
nenhum motor 3D pesado para este jogo.

## 2. O jogo: paciência legítima, sem trapaça

Basear o modo clássico em **Klondike**, com baralho de 52 cartas:
sete colunas, de uma a sete cartas inicialmente, quatro fundações e compra
de uma carta por vez; vitória ao construir as quatro fundações de Ás a Rei,
no respectivo naipe. Construção nas colunas em ordem decrescente, alternando
cores. Somente Rei pode ocupar coluna vazia. É proibido mover peças ocultas.

Personalização temática SEM mudar a lógica: os quatro naipes ganham emblemas
históricos do estudo bíblico, mantendo dois vermelhos e dois escuros:
**Livros da Lei, Profetas, Evangelhos e Cartas**. O título é uma
classificação editorial simplificada para fins de jogo, não uma afirmação
sobre o conteúdo completo do cânon.

Telas de partida: mesa, sete colunas, estoque, descarte, quatro fundações,
contador de movimentos, cronômetro opcional, histórico de jogadas,
dicas não destrutivas, desfazer, pause/continuar e vitória.

Mais tarde: modo comprar três cartas e limite de repasses ao estoque;
conferir suas próprias regras por testes, sem deixar estados insolúveis
por bugs. Distribuição reproduzível por seed, salvamento automático após
cada ação e reinício com a mesma seed.

## 3. Memorização incorporada — sem punir o jogo

O fluxo Klondike deve funcionar mesmo que não haja conteúdos baixados:
paciência pura é sempre acessível offline. Quem quiser aprender liga
**Modo Escrituras**; o modo não adiciona bloqueios arbitrários.

Quando o jogador descobre uma carta antes virada para baixo, preenche
uma fundação, ou conclui uma sequência, aparece uma pequena **Carta de
Recordação**. Eventos de memória têm cadência limitada (por exemplo, até
uma questão por 4–6 movimentos, configurável), para evitar interromper cada
jogada.

A Carta de Recordação pode pedir:

- **Complete o verso:** fragmento cuidadosamente selecionado pelo app,
  mostrando livro/capítulo/verso e omitindo trecho memorável. Responder
  digitando, ou revelar quando necessário.
- **Qual é a referência?:** leitura da passagem e recordação da referência.
- **Qual a continuação?:** escolher entre trechos da tradução instalada,
  deixando claro quando é pergunta de reconhecimento, não evocação livre.
- **Recitação:** falar de memória e avaliar depois que a resposta é revelada,
  sem alegar reconhecimento automático de voz.

A resposta incorreta **não impede nem desfaz a jogada**, nem altera as
regras da paciência. A confirmação de aprendizado é separada da pontuação do
baralho: revelar resposta, então registrar `Novamente`, `Difícil`,
`Bom` ou `Fácil`. Só gravar no histórico SM-2 existente com ação explícita
do usuário; não inferir acerto de uma sequência simples ou de um botão de
fechamento. Novos jogadores podem usar um deck inicial curado somente
com textos e referências verificados no banco bíblico local.

As revisões vencidas vêm primeiro, misturadas com novos cartões em dose
configurável. Evitar repetição de um mesmo cartão na mesma sessão e incluir
opção `Agora não`. Não misturar diretamente cartas baralho com
`Flashcard`: são tipos e estados distintos.

## 4. Progressão e feedback

A sessão oferece **duas vitórias independentes**:
- vitória da paciência (as quatro fundações completas);
- estudo realizado (cartões conscientemente revisados, com revisão
  espaçada). Uma derrota no baralho não invalida o estudo.

Motivadores saudáveis: coleção de **selos de manuscritos** obtidos em metas
claras (primeira partida, primeiro verso lembrado, dez referências estudadas);
cenários desbloqueáveis **Biblioteca do Monte**, **Observatório dos Salmos**,
**Sala do Copista** (todos locais e gratuitos); emblemas totalmente
cosméticos. Nenhuma relação entre pontos digitais e bênçãos divinas.

Modos de duração: **Pausa 5 min** (sem limite forçado), **Partida
clássica** (vitória completa), **Estudo** (selecionar livro/deck/tema).
Sair a qualquer instante preserva o estado. Não usar recompensas de login
compulsório.

## 5. Integração com o app existente

Quinta área: `Ferramentas e Games` → novo card
**Paciência do Escriba** ao lado de Mezuzá 3D e Memorização.
Preservar integralmente a tela `Memory.tsx`.

Reaproveitar as APIs já existentes:
- `pwa/src/lib/notes-memory.ts`: `dueCards`, `cardPrompt`, `clozeText`
  e o mapeamento de tipos de revisão.
- `pwa/src/lib/store.ts`: `cards()` e `reviewCard(card, grade)` para
  acessar e registrar as revisões reais.
- `pwa/src/lib/content.ts`: conteúdo da tradução já instalada, sem
  baixar bibliotecas externas ou misturar edições de forma inadvertida.
- `pwa/src/lib/labels.ts`, `i18n.ts`: interface localizada em pt-BR,
  inglês e espanhol.

Estrutura sugerida:
`src/lib/escriba-solitaire.ts` (motor puro),
`src/lib/escriba-memory.ts` (seleção/escalonamento),
`src/screens/EscribaSolitaire.tsx` (orquestração),
`src/components/escriba/` (baralho, mesa, desafios, skins),
`public/game/escriba/` (assets HD licenciados ou originais),
`tests/unit/escriba-solitaire.test.ts`,
`tests/unit/escriba-memory.test.ts`,
`tests/e2e/escriba.spec.ts`.

Estado salvo versionado: `gameVersion`, `seed`, baralho, estoque,
descarte, fundações, colunas, histórico de desfazer limitado e preferências;
em IndexedDB/localStorage com recuperação suave se houver corrupção.
Guardas de acessibilidade: toque para selecionar + tocar destino, teclado,
foco visível, modo alto contraste, `prefers-reduced-motion`, descrições ARIA
e fallback gráfico sem WebGL. Não exibir texto de versículo apenas em PNG.

## 6. Etapas de implementação e aceitação

**Etapa A — MVP:** adicionar card, motor Klondike legítimo, jogo totalmente
jogável e testável, 52 cartas, movimento, compra, descarte, vitória,
desfazer, pausa, persistência local. Sem alterações no Android.

**Etapa B — Memória:** ponte para Flashcards, revisões vencidas, revelação
da resposta, autoavaliação SM-2 explícita, preferências de desafio e
referência à tradução instalada. Nunca punir o baralho por erro bíblico.

**Etapa C — Pixel art HD:** sprites originais, cartas temáticas, cenário
com parallax discreto, transições e efeitos sonoros opcionais, 1080p/1440p
nítido, layout móvel vertical com pilhas roláveis; desempenho e acessibilidade.

**Etapa D — Testes e release:** propriedades de conservação das 52 cartas
em todas as ações; alternância de cor; fundações em ordem; proteção contra
movimentos ilegais; seed reproduzível; undo; migração de saves; revisões
registradas uma vez; offline; iPhone e Android/PWA; teclado; teste E2E
com viewport móvel. Publicar **somente após 100% do typecheck, unitários,
build e testes de ponta a ponta**.

**Não misturar este trabalho à publicação do Mezuzá ainda em andamento.**
Toda implementação futura deve ocorrer em commits próprios e só entrar na
release quando a versão em teste estiver estável.
