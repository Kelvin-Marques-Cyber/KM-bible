# Crônicas da Aliança — estado e continuidade

## Refatoração imersiva — continuação a partir de `5b3171a`

- A abertura passa sempre pela tela de título, mesmo com capítulo ativo; retomar é uma ação explícita.
- O atlas preserva o ponteiro do último capítulo, sem apagar a retomada ao navegar.
- A experiência ocupa o viewport da PWA e mantém o leitor/cartões em camadas superiores.
- TypeScript e os oito testes de interface conferidos nesta etapa; a validação completa será repetida ao concluir slots e overlays.
- Três slots independentes foram adicionados para aventuras e piloto. O espaço 1 conserva as chaves v1 originais; os demais usam sufixos de slot.
- Novo jogo possui confirmação para sobrescrever; ambos os envelopes são arquivados atomicamente antes de reiniciar o espaço escolhido.
- O menu oferece Continuar, Novo jogo, Aventuras, Códice, Configurações e Voltar. O códice mostra testemunhos reais do slot.
- Typecheck e 65 testes de motor/persistência/interface aprovados nesta etapa.
- Não há build Android nesta refatoração. A release online anterior é independente desta UX em andamento.

## Escopo e base

Trabalho iniciado a partir de `290285d86d49ed0f535edb18ee12c506524d7f80`, na branch obrigatória `flutter-web-fiel` de `Kelvin-Marques-Cyber/KM-bible`.

Somente a PWA React/TypeScript/Vite foi alterada. Android não foi alterado, compilado ou publicado. A publicação da PWA permanece sem autorização e não deve ser executada por esta tarefa.

## Atualização de interface — jogo em primeiro plano

A pedido do usuário, os blocos HTML de página inteira que interrompiam o RPG
foram substituídos por uma apresentação mais imersiva (apenas PWA, sem mudar
as regras nem os saves):

- 36 aventuras: Canvas ocupa a área principal, diário lateral fica oculto até
  selecionar **Missões**, controles de toque viraram HUD flutuante, feedback
  surge no canto e os diálogos são portais React ancorados dentro do cenário,
  em caixas inferiores com rolagem acessível.
- O códice é um painel lateral de jogo, não um documento comprido abaixo do
  palco. Botões de fechar/restaurar e Escape mantidos.
- Piloto ampliado: diálogo também foi ancorado ao cenário; navegação, direção e
  interação foram sobrepostas ao mundo. Inventário, missão, mapa e códice
  agora abrem como painéis de jogo com botão explícito **Voltar ao jogo**.
- Testes unitários de interface foram acrescentados/ajustados sem remover os
  anteriores.
- Arquivos afetados: `CampaignChronicles.tsx`, `campaign.css`,
  `screens/Chronicles.tsx` e as respectivas suítes de teste.

**Estado da validação:** a suíte de 425 unitários / 18 E2E documentada abaixo
corresponde à release **anterior** a esta atualização da interface. As novas
alterações ainda não foram testadas nesta sessão, não foram publicadas no
`gh-pages` e exigem `npx tsc --noEmit`, `npx vitest run`,
`npx playwright test` e inspeção visual em celular e desktop antes de
publicação. Não substituir a versão online até essa conferência.

## Nova camada de jogo — title screen e atlas (15/10/2026)

O pedido do usuário foi explícito: Crônicas da Aliança **não pode mais começar
como uma página HTML com cards**. O fluxo do RPG foi efetivamente modificado:

1. **Ao abrir Crônicas**, `GameFront.tsx` mostra um título de jogo sobre um
   cenário Canvas pixel art animado, com Continuar, Nova jornada / Escolher
   aventura, O Vale e a Coragem, códice e opções. Não há grade de cards no
   primeiro contato.
2. **Atlas da Aliança**: seis regiões selecionáveis posicionadas num mapa
   Canvas com relevo, litoral, árvores, trilhas e marcadores. Cada região
   leva a um segundo mapa com seis capítulos selecionáveis por pontos.
   O jogador entra num capítulo por `Entrar na aventura`.
3. A partida conserva o motor, os 36 episódios, o piloto e o IndexedDB.
   Ao usar `Mapa de aventuras`, o jogador retorna ao atlas, não a uma
   página de blocos HTML.
4. A HUD da campanha fica agora **dentro do palco**; os controles de toque,
   a barra de capítulo, o diário recolhível e os diálogos pertencem ao jogo.
   Novo menu de pausa em pixel art com retomada, missões, códice e atlas.
   Atalhos `J`, `C`, `Esc`. O piloto preserva sua camada imersiva anterior.
5. Capa e atlas usam arte Canvas original gerada por código, sem dependência
   de assets protegidos de Stardew Valley. Música original opcional via
   WebAudio e suporte a movimento reduzido.
6. Testes de navegação unitários e testes E2E das 36 campanhas e do piloto
   foram **adaptados ao novo fluxo**. Os testes anteriores continuam
   preservados.

Principais arquivos novos: `GameFront.tsx`, `game-front.css`.
Arquivos modificados: `CampaignChronicles.tsx`, `campaign.css`,
`tests/unit/campaign-screen.test.ts`,
`tests/e2e/campaigns.spec.ts` e `tests/e2e/chronicles.spec.ts`.

**Validação ainda pendente:** não foi possível executar Node/Playwright
contra esta versão atualizada na sessão conectada ao GitHub. O resultado
`425 unitários / 18 E2E` documentado mais abaixo pertence à versão anterior
à abertura nova. Portanto, antes de qualquer publicação, execute
`npx tsc --noEmit`, `npx vitest run`, `npx playwright test` e, por fim,
`KM_DRY_RUN=1 bash scripts/release.sh` em ambiente preparado. Corrija
erros encontrados, sem diminuir a suíte. **Não publicar automaticamente.**

Estado daquela etapa: havia um único save por campanha. A continuação descrita no início deste documento acrescenta três slots com compatibilidade das chaves originais.

## O que está implementado

- **Seis sagas / 36 aventuras compactas**, cada uma com introdução, cenário 2D explorável, movimentação real, colisões, três investigações que exigem proximidade, códice, desafio com novas tentativas, explicação, conclusão e avanço ao próximo capítulo.
- **O Vale e a Coragem**, o piloto ampliado de 1 Samuel 16–17, preservado em uma entrada destacada. Continua com três mapas, NPCs, missões, escolhas, inventário, puzzle e seu próprio save. Os 36 episódios compactos **não equivalem em duração e profundidade ao piloto**.
- Seleção de saga e capítulo, contagem global de 0/36 a 36/36, indicação por saga e retomada do capítulo ativo após fechar/reabrir a área ou recarregar.
- Teclado WASD/setas, Shift, E/Enter; controles móveis com soltura em pointerup/cancel; pausa e limpeza de teclas ao perder foco.
- Canvas 480 × 270 com renderização pixelada, 13 ambientes, chão por cenário, camadas, sombras, água animada, partículas, poses de caminhada, marcos contextuais, efeitos de descoberta, retratos originais e transições. Terreno estático em cache; pintura a 30 fps; frames cancelados com aba oculta; redução de movimento respeitada.
- Trilha e efeitos sintetizados originais, opcionais e desligados inicialmente. Áudio habilitado por gesto, suspenso em pausa/aba oculta e liberado na saída.
- Leitura do intervalo bíblico completo na tradução atual e criação opcional de cartões com texto real instalado. Nenhuma resposta do RPG gera avaliação SM-2 ou marca um versículo como dominado.
- Salvamento, backup, exportação e recuperação sem misturar chaves de outros jogos. Exportação inclui o estado da sessão, mesmo se ainda não foi gravado.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/games/chronicles/CampaignChronicles.tsx` | Seleção, diário, diálogo, desafio, conclusão, leitor/cartões e checkpoints |
| `campaign-content.ts` | Seis sagas, 36 narrativas e referências autorais |
| `campaign-engine.ts` | Estado puro, movimento, colisões, investigação, respostas e validação |
| `campaign-persistence.ts` | IndexedDB, fila de gravações, backup e recuperação |
| `campaign-renderer.ts` | Pixel art procedural, cenário em cache, camadas e animação |
| `CampaignCanvas.tsx` | Loop, foco, teclado, toque, visibilidade e descarte |
| `CampaignPortrait.tsx`, `campaign-audio.ts` | Retratos em pixels e áudio original opcional |
| `campaign-bible.ts` | Intervalo de leitura e âncora individual de memorização |
| `campaign.css` | Interface responsiva, diálogos e transições |
| `src/screens/ToolsAndGames.tsx` | Entrada das campanhas, piloto e jogos existentes |
| `src/screens/Chronicles.tsx` | Piloto original; somente rótulo opcional de retorno acrescentado |

O manual de uso está em `RPG_GUIDE.md`.

## Persistência e compatibilidade

- Save principal das aventuras: `chronicles:campaigns:v1` no object store `meta`.
- Backup do último estado válido: `chronicles:campaigns:v1:backup`.
- Envelope danificado preservado por recuperação/reinício explícito: `chronicles:campaigns:v1:preserved`.
- Piloto: `chronicles:vale-coragem:v1`, independente.
- `introduced`, `activeEpisodeId` e `selectedSaga` são extensões opcionais do formato v1; saves anteriores a esta interface continuam aceitos.
- Saves guardam coordenadas, direção, diálogo, descobertas, fase, tentativas e conclusão. Checkpoints em eventos narrativos; debounce de 450 ms ao mover e checkpoint periódico de 5 s durante movimento contínuo; pausa, saída, pagehide e aba oculta também solicitam gravação.
- Uma fila serializa gravações; snapshots são copiados antes de aguardar o IndexedDB. Atualização de backup e save ocorre em uma transação. Save inválido não substitui o anterior. Recuperação e reinício após corrupção exigem ação explícita do jogador.
- A PWA já faz precache de todos os chunks de aplicação. As 36 aventuras e seus cenários não dependem de rede depois da instalação do shell. Traduções bíblicas continuam em pacotes da Biblioteca; não são embutidas nos textos do RPG.

## Fidelidade narrativa

Os acontecimentos são fixos. Personagens de apoio são identificados como ficção; prólogos e visões usam um emblema/lanterna de leitura. Não há humano fictício antes da criação, participante extra dentro da visão de Isaías, sobrevivente adicional do dilúvio, poderes do jogador ou falas inventadas atribuídas a Deus/Jesus como citações.

A revisão editorial contextual corrigiu as provisões da arca no intervalo citado, a palavra da aliança no Sinai, referências da ceia/fornalha e o contexto de crucificação e sepultamento antes da ressurreição. João 19:16–42 possui botão próprio. Conclusões agora narram o encerramento de cada história, em vez de apresentar instruções de implementação ao jogador. Referências e intervalos foram confrontados com as contagens do catálogo bíblico local. Não houve certificação pastoral externa.

## Commits enviados

| Commit | Etapa |
| --- | --- |
| `22edbf5` | Integração das seis sagas e 36 aventuras; piloto separado |
| `b55c56f` | Retomada, transações, backup/recuperação e 36 percursos testados |
| `3982d63` | Cenários, sprites, retratos, áudio e integração com intervalo de leitura |
| `33374aa` | E2E dos 36 capítulos, recuperação, leitor/cartões e manual de uso |
| `1edbdb3` | Aproximação robusta do condutor E2E sob latência de captura |

Quando o Git local não fornece credenciais de escrita, o envio usa a conexão autenticada do GitHub: blobs + árvore + commit + atualização fast-forward com `expected_sha`. A árvore é conferida contra o commit local; o checkout é sincronizado sem descartar alterações pendentes. Nunca usar force push.

## Validação final — 15/10/2026

O comando obrigatório `KM_DRY_RUN=1 bash scripts/release.sh` terminou com código zero. Resultado:

- **425 testes unitários aprovados**, em 33 arquivos; nenhum teste afrouxado, ignorado ou removido para obter aprovação.
- **9 testes do servidor Mezuzá aprovados**, sem alterar seu código.
- **18 testes E2E aprovados** (6.5m), incluindo os **36/36 capítulos completos offline**, duas equipes em sessões independentes nas salas reais, piloto, memorização, leitor, corrupção/recuperação, atualização, migração e progresso bíblico.
- Typecheck, catálogo completo, build, service worker e árvore de publicação validados.
- Inspeção visual desktop e celular concluída, incluindo cenário, controles, retrato e diálogo.
- Build validado: `1.0.0-1edbdb3-20261015081221 · precache 83 arquivos (1383 KB) · sw 10e68bab0e1a · force=true`.
- Árvore validada: 7431 arquivos, 929.0 MB; maior: assets/assets/content/portuguese.sqlite (18.4 MB).
- **Nenhuma publicação foi efetuada.** O script confirmou `KM_DRY_RUN=1: todos os testes e a arvore passaram; nada publicado.`

Os testes de campanhas somam 61 casos unitários: 49 de conteúdo/motor/persistência, seis da interface e seis de Canvas/áudio/leitura. O E2E longo percorre os 36 capítulos com teclas reais, exige proximidade, lê os testemunhos, testa erro/acerto e avanço e confere 36/36 após reabrir offline. Não injeta coordenadas nem desbloqueia capítulos por atalhos.

A correção do condutor E2E foi motivada por um trace que mostrou centenas de milissegundos entre detectar a chegada e soltar a tecla. O teste agora faz aproximação em duas velocidades e corrige a posição com teclado, mantendo o alcance de 2,6 e exigindo proximidade antes de interagir. O teste inteiro passou novamente, incluindo o capítulo 20.

Testes novos: `tests/unit/campaign-engine.test.ts`, `campaign-screen.test.ts`, `campaign-canvas.test.ts` e `tests/e2e/campaigns.spec.ts`. O E2E existente do piloto foi ajustado à entrada destacada e ao retorno pelo mapa. Os testes existentes também passaram.

## Comandos obrigatórios antes de publicar

```bash
cd pwa
KM_DRY_RUN=1 bash scripts/release.sh
```

O script prepara o acervo local, gera catálogo/fontes, verifica tipos, roda toda a suíte unitária, instala/verifica o servidor do Mezuzá, compila, executa todos os E2E e valida a árvore do Pages. `KM_DRY_RUN=1` impede o envio da árvore de publicação. Não rodar sem essa variável enquanto não houver autorização explícita.

## Estado final e continuidade

Os fluxos obrigatórios das 36 aventuras compactas estão implementados e validados. Não há bug conhecido pendente nos fluxos exercitados. O piloto ampliado, Mezuzá e Memorização permanecem preservados; Android/iOS não tiveram alterações.

A publicação permanece aguardando autorização explícita do usuário. Os commits foram enviados à `flutter-web-fiel`; a árvore de `gh-pages` foi apenas montada e verificada localmente no modo seco.

Para ampliar profundidade, missões ou mapas em uma próxima tarefa, os pontos de entrada são `CampaignChronicles.tsx`, `campaign-content.ts`, `campaign-engine.ts` e `campaign-renderer.ts`. Isso seria expansão das aventuras compactas, não correção de entrega anunciada como campanha longa. Não recomeçar nem substituir o piloto.
