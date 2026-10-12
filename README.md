# Bíblia Reformada

Criado por Kelvin e Silva Marques.

**Em presente dedicatória à Rebeca Teles**

Aplicativo Flutter para leitura bíblica e estudo presbiteriano local. Nenhuma conta, publicidade ou serviço remoto é necessário para ler, pesquisar ou guardar os estudos. A identidade doutrinária é explicitamente reformada; a Mesa de Estudos começa em exposição descritiva, e a Apologética começa em defesa presbiteriana.

## Conteúdo e recursos desta reconstrução

- Leitor com histórico, passagem digitada, capítulos, leitura contínua do livro, títulos e números opcionais, seleção múltipla, destaques, favoritos e abas de estudo.
- Temas claro, escuro e sépia; interface em português, inglês e espanhol; fonte, tamanho, espaçamento, margens, contraste e movimento reduzido configuráveis.
- Comparação de edições e comentários sincronizados por referências. Quando falta um mapeamento textual, a comparação numérica é explicitamente identificada.
- Notas Markdown, cadernos, etiquetas, links entre notas e passagens, backlinks, anexos locais e exportação/restauração com verificação de integridade. Backup opcional com AES-256-GCM.
- Confissão de Fé: 33 capítulos; Breve Catecismo: 107 perguntas; Catecismo Maior: 196 perguntas. Originais históricos completos em inglês e guias próprios em português. Guias **não são uma tradução oficial da IPB**. A Confissão de 1647 é distinguida das revisões posteriores.
- Doze estudos em três níveis, exposição da posição interlocutora, defesa reformada, objeção forte, réplica e comparação. Laboratório com exercícios e verificação da estrutura da resposta; a ferramenta não certifica a verdade de uma resposta teológica.
- Catálogo de Van Til, Bahnsen, Schaeffer, Calvino, Bavinck e Plantinga, com distinção metodológica e bibliografias.
- Needle 2 local: interpretação estruturada com esquema fixo, confiança mínima e validação. A aplicação só apresenta estudos registrados. Pesquisa tradicional permanece disponível. O desempenho e a precisão em português no aparelho ainda precisam de avaliação ampla.
- Atlas local Natural Earth, 38 lugares, três sequências de viagens e 24 acontecimentos. Datas alternativas, lugares discutidos e trechos sem dados são identificados. Linhas no mapa não representam distâncias reais de estradas. Comparação cronológica exclui ano zero.
- 136 modelos GLB originais, com camadas e referências, associados a 321 blocos de até quatro capítulos nos 66 livros. O leitor abre diretamente os recursos do bloco atual; a galeria oferece pesquisa e categorias. Inclui santuários, arquitetura, instrumentos, navegação, utensílios, trabalho, plantas e animais. Objetos, contexto cultural, metáforas e visões são identificados. Rotação, zoom e alternativa textual. São esquemas interpretativos, não levantamentos arqueológicos ou modelos fotorrealistas.
- Léxico histórico Strong e corpora OSHB/Tischendorf, com consulta por lema, forma, Strong e morfologia. Glosas históricas em inglês; original não é artificialmente alinhado palavra por palavra à tradução.
- Cinco modos de flashcard, repetição espaçada local e lembrete diário opcional.
- Pesquisa local FTS5 em Bíblia, notas, documentos, estudos, comentários e léxico. Importação de módulos validada por manifesto e hashes.

## Edições e licenças

| Módulo | Idioma | Condição |
|---|---|---|
| Bíblia Livre BLN4 e BLTR | Português | CC BY 3.0 BR; atribuição integral em `assets/licenses/BIBLIA-LIVRE.md` |
| American Standard Version 1901 | Inglês | Domínio público; metadados CrossWire preservados |
| Reina-Valera 1909 | Espanhol | Domínio público; metadados CrossWire preservados |
| Textus Receptus 1550/1894 | Grego | CC BY-NC-SA 4.0 conforme o módulo CrossWire |
| Westminster Leningrad Codex / OSHB | Hebraico/aramaico | Texto WLC em domínio público; morfologia CC BY 4.0, com atribuição |
| Matthew Henry Concise; Barnes NT | Inglês | Obras históricas em domínio público |
| Westminster original 1647 | Inglês | Domínio público; guias próprios em português identificados |
| Strong / Tischendorf / MorphGNT | Originais; glosas em inglês | Licenças e proveniência em `assets/licenses/STRONG-TIS.md` |
| RA / ARA, NAA, ARC, NTLH | Português | Direitos reservados da SBB; pacote autorizado necessário |
| Hernandes Dias Lopes; Josemar Bessa | Português | Catálogo; obras não incluídas sem pacote autorizado |

Os detalhes da licença, autoria, versão e fonte também são exibidos na biblioteca do aplicativo. Não existe assinatura obrigatória.

A **RA fornecida pelo usuário** foi convertida em pacote pessoal: 66 livros, 1.189 capítulos, 31.104 marcadores de versículo nesta edição. Sua numeração difere de edições baseadas no esquema KJV em quatro capítulos. A integridade dos marcadores e amostras por livro foram verificadas; isso não equivale a revisão editorial integral palavra por palavra. A autorização declarada é para uso pessoal, sem compartilhar com outras pessoas. O PDF e o pacote ficam em `assets/private/`, excluídos do ZIP público de código e do Git. O APK pessoal pode contê-los. NAA, ARC, NTLH e comentários protegidos **não são anunciados como instalados**.

## Compilação

Requisitos: Flutter 3.47.7 / Dart 3.13.5, Android SDK 36, JDK 17 com compilador, NDK 28.2.13676358, CMake 3.22.1. Android mínimo 24; biblioteca Needle incluída para ARM64. Interfaces e fontes suportam outras plataformas, mas a rotina de compilação pessoal gera Android ARM64.

```sh
flutter pub get
python3 scripts/prepare_optional_content.py
flutter analyze
flutter test
flutter build apk --release --target-platform android-arm64
```

Configure `android/key.properties` com sua chave pessoal. As chaves e senhas não pertencem ao ZIP de código. O script `scripts/android_build.py` é uma conveniência para este ambiente de reconstrução; em uma máquina comum, use o SDK/JDK instalados e os comandos Flutter acima.

**iOS:** iOS 15+. A compilação usa macOS com Xcode e CocoaPods; você pode usar o executor do GitHub Actions sem possuir um Mac. O workflow `.github/workflows/ios-build.yml`, iniciado manualmente ou por uma tag `v...`, compila e empacota o IPA real sem assinatura. O roteiro `bash scripts/build_ios.sh` faz o mesmo em um executor macOS. O empacotador recusa arquivos sem binários Mach-O ARM64, conteúdo íntegro e código Flutter AOT. O SideStore pode reassinar e instalar com uma conta Apple gratuita; veja [o guia](docs/INSTALAR-iOS.md). A assinatura pessoal costuma precisar de renovação em sete dias. Minutos e artefatos de repositórios privados usam a cota do GitHub. O workflow está preparado, mas **ainda não foi executado nesta reconstrução**; não existe IPA compilado entregue nesta etapa. A RA pessoal pode ser importada localmente após instalar.

## Validação e limites

Os testes em `test/core_test.dart` verificam referências, conteúdos reais, remoção/atualização sem perda de notas, arquivos inválidos, backups, criptografia, datas, revisão, intenções, cobertura 3D de todos os capítulos e fluxos de interface. A compilação não substitui testes em aparelhos reais, análise de acessibilidade com leitores de tela nem revisão pastoral do conteúdo. O atlas é uma base inicial limitada: não contém uma coleção completa de fronteiras históricas de todas as épocas. Conteúdos teológicos originais e glosas não são traduzidos automaticamente ao trocar o idioma da interface.

## Arquitetura e portabilidade

Apresentação em `lib/`; referências, revisão e validação em `domain.dart`; persistência em `store.dart`; conteúdo e dados pessoais em bancos separados. Pacotes têm identidade estável, licença e hashes. Remover conteúdo desativa o módulo e preserva o cache e as notas; a origem e as condições permanecem consultáveis. Dados pessoais não são enviados automaticamente. A versão Android de produção não solicita Internet.

Notas podem usar `[[João 3:16]]` e `[[note:UUID]]`. Backups ZIP contêm Markdown por caderno, anexos, relações e metadados; `.bibliaenc` é o mesmo pacote autenticado e cifrado. Os dados pessoais pertencem ao usuário.

Cada checkpoint da reconstrução é salvo em um ZIP numerado. Nenhum repositório remoto foi criado ou publicado nesta etapa.

## Regenerar os modelos

Execute `python3 scripts/build_model_collection.py` depois de gerar `catalogue.sqlite`. O script usa somente geometria original e a base bíblica local, valida as referências e a cobertura, recria os GLBs, as associações e o índice de pesquisa. A licença dos modelos é CC BY 4.0, com autoria e condições indicadas em cada recurso. O código próprio mantém a condição indicada em `LICENSE`.
