# Crônicas da Aliança — continuidade

## Escopo autorizado (15/10/2026)

- Repositório KM-bible, branch `flutter-web-fiel`; apenas PWA React/TypeScript/Vite. Não alterar nem compilar Android.
- Primeiro episódio: **O Vale e a Coragem — 1 Samuel 16–17**, com testemunha fictícia, povoado, interior, acampamento, missões, escolhas, inventário, puzzle, encontro pacífico, conclusão canônica, save e leitor bíblico.
- Seis sagas / cerca de 36 episódios constituem expansão planejada, não conteúdo entregue.
- Sistemas e saves de Mezuzá e memorização permanecem independentes.

## Auditoria inicial

Base recebida: `453b5e13aa2775443ce042deb374326b96984a2e`.
PWA usa telas lazy em `screens/ToolsAndGames.tsx`, IndexedDB compartilhado (`lib/db.ts`) e SM-2 existente em `lib/domain.ts`/`screens/Memory.tsx`.
Não havia RPG nesta base. Mezuzá existente é uma adaptação de percurso 7×7, com dado e perguntas, sem equivalência oficial verificada.
Nenhuma alteração de implementação efetuada neste marco; nenhum teste executado ainda.

## Correção expressa de requisitos do Mezuzá

A última instrução do usuário substitui completamente a exigência de xadrez: **regras idênticas ao Novo Mezuzá**, edição confirmada pelo usuário em 15/10/2026. Não introduzir chess.js, peças de xadrez nem tabuleiro 8×8.
O site primário https://mezuza.com.br/ distingue Novo Mezuzá (3.000 perguntas) e Desafio (5.000). Há manual histórico de outra edição em https://mezuzas.blogspot.com/2009/07/mezuza-o-que-e-o-nome-mezuza-vem-de-um.html e vídeo oficial em https://vimeo.com/663815025. Não tratar regras de edições diferentes como equivalentes. Auditoria específica seguirá em `MEZUZA_RULES_AUDIT.md`.

## Implementação em curso

- Motor e conteúdo puro: `src/games/chronicles/engine.ts`, `content.ts`.
- Arte original procedural e câmera: `src/games/chronicles/renderer.ts`, `ChroniclesCanvas.tsx`.
- Integração React, persistência IndexedDB e SM-2 existente.
- Sem dependências de motor desnecessárias; canvas 2D próprio separa renderização e domínio.

## Verificação e retomada

```sh
cd pwa
npm ci
npm run data
npm run fonts
npm run typecheck
npm test
npm run build:app
npm run test:e2e
```

Preservar pipeline de release. Commit/push nesta branch não equivale a publicação do site. Não publicar até validar.
O marco inicial tem a mensagem `docs(games): registrar escopo do RPG e correção para Novo Mezuzá`; consultar `git log -1` para SHA do documento atual (evita autorreferência de hash).
