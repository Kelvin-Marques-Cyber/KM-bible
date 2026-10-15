# Crônicas da Aliança — continuidade da interface de RPG

## Escopo desta continuação

Base: `646dc6c`, continuação de `Kelvin-Marques-Cyber/KM-bible` na branch `flutter-web-fiel`. Somente a PWA React/TypeScript/Vite participa desta mudança. Android não deve ser alterado ou compilado. Não há publicação autorizada nesta tarefa.

A prioridade é a apresentação e a navegação: abrir Crônicas deve oferecer título, save, atlas e mundo explorável. O motor das seis sagas/36 aventuras, conteúdo bíblico, piloto, leitura, Memorização, Mezuzá e Ferramentas e Games permanecem integrados.

## Fluxo esperado

1. Abrir Crônicas mostra sempre o título sobre um cenário pixel art animado. Um capítulo salvo não ignora o menu.
2. O menu contém **Continuar**, **Novo jogo**, **Aventuras**, **Códice**, **Configurações** e **Voltar**. O piloto tem entrada destacada.
3. Novo jogo e Continuar passam pelos três livros de save. Cada resumo mostra capítulo, saga/modalidade, progresso e última gravação. Novo jogo em um livro ocupado exige confirmação e arquiva os dados anteriores.
4. O atlas apresenta seis regiões e seis marcos por região. A entrada ou retomada de um capítulo ocorre por esses marcos.
5. O cenário ocupa a experiência. Missão atual, dica, interação e atalhos ficam na HUD. Inventário, missões, mapa, códice e pausa são overlays; diálogos pertencem ao rodapé do mundo.
6. `Esc` fecha o overlay atual ou abre pausa; `I/J/M/C` abrem inventário, missões, mapa e códice. Os menus suspendem movimento e devolvem foco ao cenário ao fechar. No celular há botões flutuantes.
7. Voltar ao atlas ou ao título preserva o capítulo ativo. O piloto mantém seus três mapas e save próprio no espaço escolhido.

A arte e o áudio são originais, gerados localmente. Não há cópia de assets, fonte, música ou identidade visual de Stardew Valley. Movimento reduzido e suspensão com aba oculta devem continuar respeitados.

## Arquivos principais

| Arquivo | Responsabilidade |
| --- | --- |
| `src/games/chronicles/GameFront.tsx` e `game-front.css` | Título, mapas de campanha, códice inicial, configurações e cenário animado |
| `SaveSlots.tsx`, `save-slots.ts`, `save-slot-key.ts` | Três livros, catálogo, isolamento e arquivamento antes de sobrescrever |
| `CampaignChronicles.tsx`, `campaign.css` e `campaign-gameplay.css` | HUD, overlays, atalhos, diálogos, leitor/cartões e checkpoints das 36 aventuras |
| `CampaignCanvas.tsx`, `campaign-renderer.ts` | Loop, controles, pintura e animações da exploração |
| `campaign-content.ts`, `campaign-engine.ts` | Conteúdo e regras dos 36 capítulos |
| `campaign-persistence.ts` | Gravações serializadas, backup e recuperação |
| `useGameSheetAccess.ts` | Foco e teclado das janelas externas do leitor/cartões acima do jogo |
| `src/screens/Chronicles.tsx` e `pilot.css` | Piloto ampliado e suas janelas de jogo |
| `ChroniclesCanvas.tsx`, `engine.ts`, `persistence.ts` | Controles, regras e persistência do piloto |
| `campaign-bible.ts`, `CampaignPortrait.tsx`, `campaign-audio.ts` | Referências, retratos e áudio original |
| `tests/e2e/campaigns.spec.ts`, `chronicles.spec.ts` | Percursos completos, slots, retomada, atalhos, menus e tamanhos de tela |

O manual para o jogador está em `RPG_GUIDE.md`.

## Continuação após os commits de 15/10 — mundo vivo e verificação

O trabalho novo do usuário já incluía a abertura em tela inteira, três saves, HUD,
menus, diálogos e refatoração do piloto. Esta continuação **não reescreveu**
essas entregas.

- `campaign-ambient.ts` e `campaign-renderer.ts`: população ambiental
  discreta em povoados/cidades/templos e animais nos cenários pastorais.
  São **silhuetas decorativas que andam**, não NPCs com missões próprias.
  O prólogo da criação e o jardim não recebem testemunhas humanas
  fictícias. O movimento reduzido mantém posições imóveis. O motor e os
  envelopes de save permanecem intocados.
- `renderer.ts` (piloto ampliado): moradores existentes alternam
  gestos e deslocamentos visuais curtos, sem mudar a posição usada para
  colisão, conversa, missões ou save. O modo de movimento reduzido
  continua eliminando essas animações.
- `CampaignCanvas.tsx`: ao abrir pausa, códice ou diálogos, congela o
  relógio visual e limita o redesenho do cenário a aproximadamente 1 FPS,
  reduzindo consumo de bateria no celular. A simulação já estava suspensa
  durante os menus; `tests/unit/campaign-canvas.test.ts` verifica também
  que o tempo da animação fica congelado.
- `tests/unit/campaign-ambient.test.ts`: garante ausência de habitantes
  inventados nos prólogos, população restrita a lugares plausíveis,
  posições determinísticas e limite de cinco atores por capítulo.
- `.github/workflows/cronicas-pwa.yml`: workflow de verificação da
  **PWA somente** (Node 22, tipos, unitários e build sem publicar).
  A primeira execução automática em `1843a12` terminou com falha
  **antes de provisionar runner**, sem etapas executadas e com
  0 ms faturáveis; portanto **não houve resultado de testes**.
  Foi alterado para execução manual, para não gerar checks vermelhos
  em cada commit enquanto o runner não estiver disponível.
- Validação real ainda depende de `npx tsc --noEmit`, `npx vitest run`,
  `npx playwright test` e `KM_DRY_RUN=1 bash scripts/release.sh`
  no ambiente com dependências e acervo do projeto.

**Limitações remanescentes:** as 36 aventuras compactas têm três pontos
de investigação e desafio cada uma, não 36 campanhas tão profundas quanto
o piloto. Os moradores acrescentados nesta etapa são ambientais, sem
diálogo individual, rotina persistida ou inteligência de NPC.
Nenhum commit desta continuação publicou em `gh-pages`.

## Persistência e compatibilidade

- O espaço 1 mantém `chronicles:campaigns:v1` e `chronicles:vale-coragem:v1` no object store `meta` do IndexedDB `km-bible`.
- Os espaços 2 e 3 acrescentam `:slot:2` ou `:slot:3` às chaves originais. As chaves do espaço 1 não exigem migração destrutiva.
- O catálogo `chronicles:slots:v1` registra o espaço e a modalidade ativos. Os resumos são calculados a partir dos envelopes; não substituem o estado do jogo.
- Saves de campanha possuem backup em `:backup` e preservação em `:preserved`. Uma sobrescrita explícita arquiva campanha, backup, preservação e piloto do espaço em `chronicles:slots:v1:archive:<slot>:<uuid>` antes de limpar.
- `introduced`, `activeEpisodeId` e `selectedSaga` são extensões opcionais do formato v1. Saves anteriores continuam aceitos.
- Coordenadas, direção, diálogo, descobertas, fase, tentativas e conclusão são preservados. Campanha grava em eventos narrativos, com debounce de movimento e checkpoint periódico; pausa, saída e visibilidade solicitam gravação.
- Exportar pelo códice inicial inclui os três espaços e suas cópias, além do snapshot da sessão da campanha.

O shell da PWA faz precache dos chunks das aventuras. Traduções bíblicas continuam em pacotes separados da Biblioteca. A disponibilidade offline desses textos precisa ser verificada com a tradução instalada. Mezuzá online continua usando seu servidor.

## Testes desta interface

Os testes anteriores não devem ser reduzidos para acomodar a refatoração. O percurso longo continua exigindo movimento por teclas reais, proximidade aos três marcos, erro/acerto, leitura de testemunhos, avanço e **36/36 capítulos offline**. Não injeta coordenadas nem desbloqueia capítulos por atalhos.

Os testes adicionais verificam:

- entrada pelo título, três saves e retomada explícita após recarregar;
- posição salva e diálogo aberto preservados;
- isolamento entre espaços, data/saga/capítulo do resumo e cancelamento da sobrescrita;
- arquivamento do save confirmado e preservação de outro espaço;
- `I/J/M/C/Esc`, exclusividade dos overlays, foco e suspensão da movimentação na campanha e no piloto;
- título, atlas, cenário e diário em retrato, paisagem e desktop;
- consulta bíblica durante o desafio retorna à escolha, com foco restaurado e sem abrir pausa;
- tela cheia nativa usa a raiz HTML e mantém o leitor bíblico visível, com foco restaurado ao fechar;
- controles de toque, leitor/cartões, corrupção e recuperação existentes.

**Validação desta rodada:** em andamento. Os números de testes da release anterior não comprovam esta interface. Atualize esta seção apenas com os resultados efetivamente executados após os ajustes finais.

Comandos obrigatórios:

```bash
cd pwa
npx tsc --noEmit
npx vitest run
npx playwright test
KM_DRY_RUN=1 bash scripts/release.sh
```

O script de release prepara o acervo, gera catálogo/fontes, valida tipos, unitários, servidor do Mezuzá, build, service worker, E2E e árvore de publicação. `KM_DRY_RUN=1` precisa permanecer definido: validação não autoriza publicação.

## Histórico preservado

A release anterior à tela de título/slots registrou 425 unitários, nove testes do servidor Mezuzá e 18 E2E aprovados, incluindo 36/36 offline, em `1edbdb3`. Esses resultados pertencem à versão anterior e servem apenas como referência histórica.

Os capítulos compactos continuam mais curtos que o piloto ampliado. Os cenários são interpretações artísticas; testemunhas fictícias são identificadas, passagens mantêm os acontecimentos bíblicos e não há falas inventadas apresentadas como citações de Deus/Jesus. Não houve certificação pastoral externa.

Commits devem ser frequentes e enviados a `flutter-web-fiel`, sem force push. O modo seco não publica em `gh-pages`. Ao concluir, registre a validação real e eventuais limitações; não anuncie publicação ou aprovação de testes que não foram executados.
