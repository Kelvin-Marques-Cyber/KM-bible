# Crônicas da Aliança — estado e continuidade

## Escopo e base

Trabalho iniciado a partir de `290285d86d49ed0f535edb18ee12c506524d7f80`, na branch obrigatória `flutter-web-fiel` de `Kelvin-Marques-Cyber/KM-bible`.

Somente a PWA React/TypeScript/Vite foi alterada. Android não foi alterado, compilado ou publicado. A publicação da PWA permanece sem autorização e não deve ser executada por esta tarefa.

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

Quando o Git local não fornece credenciais de escrita, o envio usa a conexão autenticada do GitHub: blobs + árvore + commit + atualização fast-forward com `expected_sha`. A árvore é conferida contra o commit local; o checkout é sincronizado sem descartar alterações pendentes. Nunca usar force push.

## Validação registrada

- Node `24.19.0` (atende à exigência de 22.18+ do servidor de salas).
- Typecheck e build de produção aprovados.
- Suíte completa da validação seca: **425 testes unitários aprovados** (33 arquivos), incluindo checkpoint contínuo, exportação, recuperação e reinício isolado.
- Servidor de salas existente: **9 testes aprovados**, sem alterar seu motor/servidor/interface.
- Cinco E2E específicos aprovados: movimento/pausa/diálogo/retomada, leitor e cartão na Memorização, recuperação de save danificado e os dois fluxos originais do piloto (incluindo offline e toque).
- E2E de navegador: **36/36 aventuras percorridas offline**, usando teclado real, lendo os três testemunhos, errando/acertando, consultando o códice, concluindo e avançando. Resultado 1 teste aprovado em 5,2 minutos. Validação seca completa ainda pendente nesta etapa.

Testes novos: `tests/unit/campaign-engine.test.ts`, `campaign-screen.test.ts`, `campaign-canvas.test.ts`, `tests/e2e/campaigns.spec.ts`. O E2E existente do piloto foi ajustado exclusivamente à nova entrada destacada e ao retorno pelo mapa.

## Comandos obrigatórios antes de publicar

```bash
cd pwa
KM_DRY_RUN=1 bash scripts/release.sh
```

O script prepara o acervo local, gera catálogo/fontes, verifica tipos, roda toda a suíte unitária, instala/verifica o servidor do Mezuzá, compila, executa todos os E2E e valida a árvore do Pages. `KM_DRY_RUN=1` impede o envio da árvore de publicação. Não rodar sem essa variável enquanto não houver autorização explícita.

## Próximos passos desta rodada

1. A primeira validação seca passou tipos, 425 unitários, nove testes de servidor, build e 17 E2E. O percurso longo falhou por sobrepassar o marco no capítulo 20: o trace mostrou atraso de centenas de milissegundos entre detectar a chegada e soltar a tecla.
2. O condutor do E2E agora faz aproximação em duas velocidades, corrige sobrepassagem com teclas reais e exige distância menor que 2,6 antes de investigar. O alcance e o motor do jogo não foram afrouxados. Os dois fluxos curtos de movimento/recuperação passaram com o novo condutor. Repetir a validação seca inteira.
3. Registrar resultados finais, commit e envio. Não declarar publicação.

As novas verificações pertencem a `tests/e2e/campaigns.spec.ts` e `tests/unit/campaign-screen.test.ts`; o estado funcional do produto está em `CampaignChronicles.tsx`. Não há necessidade de recomeçar o RPG.
