# Crônicas da Aliança — continuidade

## Escopo autorizado (15/10/2026)

- Repositório KM-bible, branch `flutter-web-fiel`; apenas PWA React/TypeScript/Vite. Não alterar nem compilar Android.
- Primeiro episódio: **O Vale e a Coragem — 1 Samuel 16–17**, com testemunha fictícia, povoado, interior, acampamento, missões, escolhas, inventário, puzzle, encontro pacífico, conclusão canônica, save e leitor bíblico.
- Seis sagas / 36 aventuras compactas têm conteúdo, motor e interface de exploração integrados. Não equivalem em profundidade ao piloto ampliado.
- Sistemas e saves de Mezuzá e memorização permanecem independentes.

## Auditoria inicial

Base recebida: `453b5e13aa2775443ce042deb374326b96984a2e`.
PWA usa telas lazy em `screens/ToolsAndGames.tsx`, IndexedDB compartilhado (`lib/db.ts`) e SM-2 existente em `lib/domain.ts`/`screens/Memory.tsx`.
Não havia RPG nesta base. Mezuzá existente é uma adaptação de percurso 7×7, com dado e perguntas, sem equivalência oficial verificada.
Nenhuma alteração de implementação efetuada neste marco; nenhum teste executado ainda.

## Requisitos confirmados do Mezuzá

O usuário confirmou expressamente que o SOL acertou ao implementar a **adaptação do Mezuzá Clássico** (não xadrez e não Novo Mezuzá). A diferença entre edições está registrada em `MEZUZA_RULES_AUDIT.md`.

- O tabuleiro físico original e seus cartões comerciais não foram reproduzidos integralmente: o percurso padrão 12+12+centro é **autoral e ajustável**, com 30 atividades autorais distribuídas em três cartas (sete dinâmicas).
- Não anunciar esta edição digital como uma cópia idêntica ao produto comercial; sim, uma **adaptação baseada em procedimentos documentados do clássico**.
- `MezuzahClassic.tsx` e `MezuzahClassicOnline.tsx` substituem a modalidade antiga no menu sem apagar saves legados.
- O servidor local `mezuzah-server/server.mjs` utiliza o motor clássico, valida jogadas e possui testes Node. Salas públicas exigem hospedagem WebSocket WSS, não fornecida pelo Pages.
- Não trocar o jogo por xadrez 8×8 nem misturar as regras do Novo Mezuzá e da edição Clássica.

## Entregas existentes na branch

- **Piloto RPG:** `src/games/chronicles/engine.ts`, `content.ts`, `renderer.ts`, `ChroniclesCanvas.tsx`, `src/screens/Chronicles.tsx`, persistência `chronicles/persistence.ts`.
- **Uma campanha ampliada disponível:** `O Vale e a Coragem`, com três mapas (povoado, casa e acampamento), missões principais/secundárias, diálogos, puzzle, resolução pacífica de conflito, narrativa canônica de 1 Samuel 16–17 e códice com referências e flashcards.
- **Pixel art procedural:** Canvas 2D original, controles teclado/toque e efeitos de iluminação; 36 aventuras compactas adicionais têm cenários próprios e fluxo de três investigações + desafio. Polimento e validação completa em andamento.
- **Mezuzá Clássico:** motor local e serviço de salas WebSocket separados, com interface e tabuleiro 3D, modo sem WebGL e testes unitários e E2E incluídos.
- **Memorização:** permanece acessível e preservada na mesma área `Ferramentas e Games`.
- O frontend PWA continua sem dependência de motor de jogo adicional.
- Auditoria subsequente: commits `746a1b34` (a release agora instala dependências e testa o servidor de salas antes dos E2E) e `9341f3a6` (checkpoint periódico do RPG a cada 5 segundos durante movimentação contínua).
- Esses commits foram salvos no GitHub; **a nova sequência de testes e publicação ainda precisa ser executada no ambiente do usuário**. Não afirmar que a build foi validada ou publicada.

## Validação pós-auditoria e publicação

Verificar o Node 22.18+ (necessário para o servidor que importa TypeScript) e executar:

```bash
cd ~/KM-bible-pwa
git pull --ff-only origin flutter-web-fiel
source ~/.cache/km-bible-content-venv/bin/activate
cd pwa
KM_DRY_RUN=1 bash scripts/release.sh
```

A release agora possui **nove estágios**, incluindo `npm ci` isolado e `npm test` no servidor antes de rodar Playwright com dois navegadores. `KM_DRY_RUN=1` deve impedir o envio ao Pages; somente após todos os testes aprovados executar `bash scripts/release.sh` sem dry run.

Também verificar visualmente no celular o WebGL 3D, o fallback sem WebGL, a rota dos três mapas, a retenção do save offline, e o ciclo multiplayer via WSS hospedado. O vídeo/inspeção do tabuleiro real e revisão pastoral das passagens não fazem parte da validação automatizada.

**Não** declarar as seis sagas nem o servidor WSS público concluídos até sua implementação/hospedagem real.

## Continuação a partir de 290285d8 — integração

- `CampaignChronicles.tsx` criado e integrado ao menu, com seis sagas, seis capítulos por saga, introduções, movimentação, três investigações presenciais, códice, desafio, conclusão, avanço e reinício individual.
- Piloto preservado em entrada destacada e com persistência independente. Mezuzá e Memorização não tiveram seus motores alterados.
- Progresso v1 aceita campos opcionais de capítulo ativo, saga selecionada e introdução já lida; saves v1 anteriores continuam aceitos.
- Leitor e criação de cartões reutilizam `showPassage`/`createCard`, carregando texto de `verse(app.translation, ...)`. Nenhuma avaliação SM-2 é feita pelo RPG.
- Interface distingue aventuras compactas de campanha ampliada.
- Validação desta etapa: `npm run typecheck` aprovado; 25 testes aprovados nos quatro arquivos da interface, piloto e Ferramentas e Games, após geração obrigatória do catálogo/fontes. E2E completo ainda pendente.
- Próximos arquivos: `campaign-persistence.ts` (backup e recuperação), `CampaignCanvas.tsx` (arte, desempenho e ciclo de vida), testes de todos os 36 fluxos. Nenhuma publicação autorizada ou efetuada.
