# Apologética presbiteriana — conteúdo e imagens

## Estrutura

O catálogo mantém **30 tradições**, com **oito assuntos por tradição**.
A interpretação presbiteriana é explicitamente identificada como confessional:
ela não é apresentada como posição oficial das tradições estudadas.

- `assets/apologetica/*.md`: panoramas impessoais revisados, preservados.
- `assets/content/apologetica-editorial.json`: 30 introduções próprias,
  240 eixos distintos e descrição visual por tradição.
- `scripts/ampliar_apologetica.py`: gera o suplemento impessoal.
- `scripts/gerar_dossies_especificos.py`: **substitui** os textos reformados
  repetitivos por dossiês extensos, com oito capítulos, fontes e referências.
- `assets/apologetica_reformada/*.md`: artefatos gerados, não editados à mão.
- `pwa/scripts/apologetics_visuals.py`: 30 artes editoriais SVG e catálogo
  opcional de fotografias documentais com licenças identificadas.
- `pwa/scripts/build_data.py`: empacota os dossiês, as artes e os metadados
  no acervo versionado `data/v1/apologetica/`.
- `pwa/src/components/ApologeticsVisual.tsx`: galeria com imagem contextual,
  indicação explícita de ilustração/fotografia e fonte/licença.

## Garantias

O processo de publicação exige, antes de aceitar o build:

1. Todos os 30 módulos, cada um com **no mínimo 7.000 caracteres de
   argumentação reformada aprofundada**.
2. Oito eixos próprios por tradição, todos incorporados ao documento final.
3. Nenhum texto integral idêntico a outro e pelo menos dez seções por documento.
4. Todas as 30 imagens locais válidas como SVG, sem bibliotecas de imagens
   externas necessárias para funcionar offline.
5. Links externos de fotografias devidamente atribuídos, com arte local
   sempre disponível caso a imagem remota falhe.
6. Preservação dos panoramas impessoais e dos materiais previamente revisados.

Os SVGs representam **ilustrações editoriais**, não fotografias de locais
identificados nem registros de ritos. As imagens CC0/domínio público
referenciadas no Wikimedia Commons são documentais; sua exibição depende de
rede e é opcional. O conteúdo offline permanece completo sem elas.

## Publicação segura

Na raiz do repositório, com ambiente virtual que contenha as dependências de
`scripts/requirements-content.txt`:

```bash
cd pwa
bash scripts/release.sh
```

O script prepara o acervo, gera dados e fontes, verifica TypeScript e testes
unitários, compila a PWA, executa testes E2E e **só então publica**. Nenhuma
etapa deste fluxo compila o aplicativo Android.

## Evolução editorial

Para aprofundar um módulo, editar primeiro o perfil em
`assets/content/apologetica-editorial.json` e conferir as fontes originais
em `assets/content/editorial-expansion.json`. Evitar afirmações não
representativas, caricaturas e citações sem comprovação. A revisão pastoral
e teológica humana continua recomendada para conteúdos confessionais.
