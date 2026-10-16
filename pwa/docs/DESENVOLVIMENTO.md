# PWA Bíblia Reformada — guia de desenvolvimento

## Arquitetura em uma página

```
assets/ (SQLite, JSON, .biblepkg)  ──scripts/build_data.py──▶  public/data/v1/**  (arquivos pequenos, sob demanda)
                                                         └──▶  src/generated/catalog.json (índice embutido no bundle)
src/
  main.tsx            abertura: IndexedDB → preferências → render → service worker
  App.tsx             cabeçalho, 5 áreas (Bíblia, Explorar, Biblioteca, Estudos, Memorização), folhas, atalhos
  lib/
    domain.ts         referências (livro:cap:vers), parseRef, fold, tokenize, SM-2, datas históricas
    catalog.ts        tipos do catálogo + packUrl(pack, arquivo) → data/v1/<pack>/<arquivo>?v=<hash>
    fetcher.ts        fetchJson/fetchOptional com cache em memória; OfflineError/NotFoundError
    content.ts        TODO o acesso ao acervo: bíblias, comentários, referências cruzadas, original/léxico,
                      temas, documentos, estudos, contexto, 3D, apologética, Agostinho, módulos do usuário
    db.ts             IndexedDB mínimo (stores pessoais + módulos importados)
    store.ts          dados pessoais com os MESMOS nomes do personal.sqlite (backup compatível com o APK)
    app.ts            estado global (tradução, passagem, área), navigate/step, pilha de folhas + botão voltar
    i18n.ts / labels.ts  t('chave') (tabela do app original) e tr(pt, en, es) para frases novas
    themes.ts         14 temas, 15 fontes de leitura, cores derivadas com contraste AA
    scripture.ts      linkScriptureReferences (citações clicáveis), wikiTargets
    pwa.ts            instalação, atualização automática, armazenamento persistente
  components/ui.tsx   Button, Action, IconButton, Chip, Wrap, Card, ListItem, Feature, Field, TextArea,
                      Select, Toggle, Slider, Divider, Heading, Small, Spinner, Progress, ErrorBox,
                      message() (toast), useAsync/Async, useDebounced, copyText, cx
  components/Markdown.tsx  Markdown seguro (DOMPurify) com links biblia:/confession:/attachment:
  screens/open.tsx    TODAS as aberturas de telas (openCommentaries(ref), openStudy(s), ...), lazy por módulo
```

## Regras de desempenho (obrigatórias)

1. Nada grande na abertura. Use as funções de `content.ts`, que baixam um livro/capítulo/balde por vez.
2. Listas com centenas de itens: `@tanstack/react-virtual` (veja `Reader.tsx`) ou paginação ("Mostrar mais").
3. Pesquisas: debounce de 250 ms (`useDebounced`) e trabalho pesado em Web Worker.
4. Cada tela é um módulo carregado sob demanda via `screens/open.tsx`; não importe telas pesadas
   estaticamente a partir de outras telas — use as funções `open*`.
5. Nada de novas dependências sem necessidade. Ícones: `lucide-react` (confira o nome em
   `node_modules/lucide-react/dist/lucide-react.d.ts`).

## Convenções de interface

- Tokens Tailwind do tema: `bg-surface`, `bg-surface-low`, `bg-surface-high`, `text-on-surface`, `text-muted`,
  `border-outline`, `bg-primary`/`text-on-primary`, `bg-primary-container`/`text-on-primary-container`,
  `bg-secondary-container`, `text-danger`. Texto bíblico/obras: `font-reading` + `fontSize()`/`lineHeight()`.
- Conteúdo de folha: `<div className="mx-auto max-w-3xl p-5">…</div>` (ou `max-w-reading` para leitura).
- Textos em português do Brasil por padrão; use `t('chave')` quando a chave existir em `labels.ts`,
  senão `tr('pt', 'en', 'es')`.
- Acessibilidade: todo botão só com ícone tem `label`; foco visível; role/aria corretos; teclado funciona.
- Cópia com citação, fontes e licenças sempre visíveis, como no aplicativo original.

## Dados pessoais

`store.ts` mantém as tabelas `preferences` (aqui `prefs`), `notes`, `note_links`, `highlights`, `bookmarks`,
`study_tabs`, `reading_history`, `attachments`, `flashcards`, `review_history`, `learning_progress`.
Os backups (.zip / .bibliaenc) usam o formato do APK: `data.json` + `notes/<caderno>/<id>.md` +
`attachments/` + `manifest.json` com SHA-256, e AES-256-GCM + PBKDF2-SHA256 (210 000 iterações).

## Primeiro build em um clone novo

A PWA precisa de artefatos locais gerados que não são versionados: os 30
dossiês de apologética (mínimo de 7.000 caracteres cada) e o texto estruturado
de Agostinho (278 capítulos). Desde a Bíblia Lumen, `npm run build` valida e
prepara esses dados automaticamente antes de compilar. Não exclua os
conteúdos editoriais para contornar erros de preparação.

Uma única vez, na raiz do clone:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/requirements-content.txt
cd pwa
npm ci
npm run build
```

Em builds seguintes, se o acervo continuar completo, o pré-build não executa
novamente o processamento de PDF nem os geradores editoriais. Para verificar a
regra sem preparar o acervo real, execute
`python3 -m unittest discover -s tests -p 'test_ensure_content.py'` dentro de
`pwa`.

**Importante:** execute npm sempre em `pwa/`, onde está o `package.json`.
A versão antiga Flutter fica na raiz. Não rode `npm audit fix --force` como
solução de compilação: ele pode atualizar dependências de forma incompatível.

## Comandos

```
npm run data      # gera public/data/v1 e src/generated/catalog.json
npm run fonts     # WOFF2 das fontes de leitura
npm run dev       # desenvolvimento
npm run build     # tudo + dist/ pronto para publicar
npm test          # testes unitários (vitest)
npm run test:e2e  # testes de ponta a ponta (Playwright)
npx tsc --noEmit  # checagem de tipos
```
