# Bíblia Lumen

Criado por Kelvin e Silva Marques.

**Em presente dedicatória à Rebeca Teles**

Aplicativo para leitura bíblica e estudo presbiteriano. Nenhuma conta, publicidade ou serviço remoto é necessário para ler, pesquisar ou guardar os estudos: tudo fica no seu dispositivo. A identidade doutrinária é explicitamente reformada; a Mesa de Estudos começa em exposição descritiva, e a Apologética começa em defesa presbiteriana.

## Onde usar

| Plataforma | Como obter |
|---|---|
| Navegador, Android, iPhone e computador (PWA) | <https://kelvin-marques-cyber.github.io/KM-bible/> — instalável pelo próprio navegador, funciona sem internet e se atualiza sozinho |
| Android (APK) | Arquivo `BibliaReformada-<versão>-arm64.apk` publicado em *Releases* |
| Versão clássica (Flutter Web) | <https://kelvin-marques-cyber.github.io/KM-bible/classico.html> |
| iPhone (IPA) | Compilação pelo workflow de iOS; veja [docs/INSTALAR-iOS.md](docs/INSTALAR-iOS.md) |

**Instalar a PWA:** no Android (Chrome/Edge/Samsung Internet) use "Instalar aplicativo"; no iPhone, abra no Safari → Compartilhar → "Adicionar à Tela de Início". Em *Configurações → Armazenamento e offline*, o botão **"Baixar tudo para usar sem internet"** deixa todo o acervo disponível offline.

## Recursos

- **Leitura:** histórico, passagem digitada, capítulos, leitura contínua do livro, títulos e números opcionais, seleção múltipla, destaques em quatro cores, favoritos e abas de estudo. Comentários ao lado do texto em telas largas.
- **Aparência:** 14 temas (claros, escuros e sépia), 15 fontes de leitura, tamanho, espaçamento, margens, contraste e movimento reduzido; interface em português, inglês e espanhol.
- **Comparação e comentários:** edições lado a lado, comentários sincronizados por referência e referências cruzadas. Quando falta mapeamento textual, a comparação numérica é identificada.
- **Comentários de João Calvino em português:** as 11.063 entradas têm tradução de estudo (tradução automática, marcada como "revisão necessária"); o original em inglês continua disponível em cada comentário.
- **Devocionais (em Estudos):** Café da Manhã com Spurgeon (366 dias) e Jornada Reformada (Josemar Bessa); outros devocionais importados aparecem automaticamente.
- **Notas:** Markdown, cadernos, etiquetas, links entre notas e passagens (`[[João 3:16]]`, `[[note:UUID]]`), backlinks e anexos. Backup em ZIP ou cifrado (`.bibliaenc`, AES-256-GCM), compatível entre o APK e a PWA.
- **Confissões:** Confissão de Fé (33 capítulos), Breve Catecismo (107 perguntas), Catecismo Maior (196 perguntas), com os originais de 1647 e guias próprios em português — os guias **não são tradução oficial da IPB**. Confissões de Agostinho em 13 livros.
- **Estudos e apologética:** 253 estudos, incluindo 27 trilhas com oito assuntos por tradição, em três níveis: exposição da posição interlocutora, defesa reformada, objeção forte, réplica e comparação. Laboratório com exercícios (a ferramenta verifica a estrutura da resposta, não certifica a verdade teológica). Catálogo de Van Til, Bahnsen, Schaeffer, Calvino, Bavinck e Plantinga.
- **Idioma original:** léxico Strong e corpora OSHB/Tischendorf, consulta por lema, forma, Strong e morfologia; glosas em português com acesso separado aos originais.
- **Contexto:** atlas Natural Earth (38 lugares, 3 sequências de viagens, 24 acontecimentos), linha do tempo sem ano zero e 628 temas bíblicos com 52.211 ligações a passagens (Torrey, domínio público).
- **Modelos 3D:** 136 modelos GLB originais associados a 321 blocos de até quatro capítulos nos 66 livros — esquemas interpretativos, não levantamentos arqueológicos.
- **Memorização:** cinco modos de flashcard e repetição espaçada.
- **Pesquisa** em Bíblia, notas, documentos, estudos, comentários, temas e léxico.
- **Módulos:** importação de pacotes `.biblepkg` validados por manifesto, licença e hashes.

## Edições e licenças

| Módulo | Idioma | Condição |
|---|---|---|
| Almeida Revista e Atualizada (ARA) | Português | © Sociedade Bíblica do Brasil; incluída com autorização informada pelo responsável do projeto |
| Bíblia Livre BLN4 e BLTR | Português | CC BY 3.0 BR; atribuição integral em `assets/licenses/BIBLIA-LIVRE.md` |
| American Standard Version 1901 | Inglês | Domínio público; metadados CrossWire preservados |
| Reina-Valera 1909 | Espanhol | Domínio público; metadados CrossWire preservados |
| Textus Receptus 1550/1894 | Grego | CC BY-NC-SA 4.0 conforme o módulo CrossWire |
| Westminster Leningrad Codex / OSHB | Hebraico/aramaico | Texto WLC em domínio público; morfologia CC BY 4.0, com atribuição |
| Matthew Henry Concise; Barnes NT; Calvino | Inglês (Calvino também em pt-BR de estudo) | Obras históricas em domínio público |
| Westminster original 1647 | Inglês | Domínio público; guias próprios em português identificados |
| Strong / Tischendorf / MorphGNT | Originais; glosas | Licenças e proveniência em `assets/licenses/STRONG-TIS.md` |
| NAA, ARC, NTLH | Português | Direitos reservados da SBB; não incluídas |
| Hernandes Dias Lopes; Josemar Bessa | Português | Guias de fontes; obras integrais só com pacote autorizado |

Licença, autoria, versão e fonte de cada módulo também aparecem na Biblioteca do aplicativo. Os modelos 3D são CC BY 4.0; o código próprio segue a condição de `LICENSE`.

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `pwa/` | Aplicativo web/PWA (React + TypeScript + Vite + Tailwind) publicado no GitHub Pages |
| `lib/`, `android/`, `ios/` | Aplicativo Flutter (APK Android, IPA e versão clássica) |
| `assets/` | Acervo comum: bancos SQLite, módulos `.biblepkg`, Agostinho, apologética, modelos 3D, licenças |
| `scripts/` | Preparação do acervo, traduções, compilação e publicação |
| `docs/` | Guias de compilação e instalação |

## PWA (`pwa/`)

Requisitos: Node.js 20+ e Python 3.10+.

```sh
cd pwa
npm ci
npm run data      # gera os dados estáticos fragmentados (public/data/v1) a partir de assets/
npm run fonts     # fontes de leitura em WOFF2
npm run dev       # desenvolvimento em http://localhost:5173
npm test          # testes unitários (Vitest)
npm run test:e2e  # testes de ponta a ponta (Playwright) sobre o build de produção
```

**Publicação:** `bash pwa/scripts/release.sh` verifica tipos, roda os testes unitários, compila, roda os testes de ponta a ponta e só então publica em `gh-pages` e confere o site no ar (`KM_DRY_RUN=1` faz tudo menos o envio). A versão clássica fica em `classico.html`.

Como funciona:

- **Leve:** a abertura baixa cerca de 1 MB; textos, comentários e índices são carregados por livro e capítulo, sob demanda, e ficam guardados para uso offline.
- **Atualização obrigatória:** o app consulta `app-version.json` ao abrir, ao voltar à tela, ao reconectar e a cada 30 minutos. Uma nova publicação é aplicada sozinha, sem limpar cache; a versão Flutter antiga também é substituída automaticamente. Anotações e preferências nunca são apagadas.
- **Migração:** na primeira abertura, anotações, destaques, favoritos, abas, histórico, flashcards e preferências da versão Flutter Web são importados do navegador, sem apagar os dados antigos.
- **Detalhes técnicos:** [pwa/docs/DESENVOLVIMENTO.md](pwa/docs/DESENVOLVIMENTO.md).

## Android (APK)

Requisitos: Flutter 3.47.7 / Dart 3.13.5, Android SDK 36, JDK 17, NDK 28.2.13676358, CMake 3.22.1. Android mínimo 7.0 (API 24); gera APK ARM64.

```sh
bash scripts/build_android_otimizado.sh   # prepara o acervo e compila
# ou, com o acervo já preparado:
flutter pub get
flutter build apk --release --target-platform android-arm64
```

Para atualizar um app já instalado, o APK precisa ser assinado com a mesma chave: configure `android/key.properties` com a sua chave pessoal (chaves e senhas nunca vão para o repositório). Um APK assinado com outra chave só instala após desinstalar o anterior — faça backup antes e restaure depois.

## iOS

iOS 15+. A compilação usa macOS com Xcode e CocoaPods; o workflow `.github/workflows/ios-build.yml` gera o IPA sem assinatura em um executor macOS (`bash scripts/build_ios.sh` faz o mesmo). O SideStore pode reassinar e instalar com uma conta Apple gratuita; a assinatura pessoal costuma precisar de renovação a cada sete dias. Veja [docs/INSTALAR-iOS.md](docs/INSTALAR-iOS.md).

## Validação e limites

- Flutter: `test/core_test.dart` verifica referências, conteúdos reais, remoção/atualização sem perda de notas, arquivos inválidos, backups, criptografia, datas, revisão, cobertura 3D e fluxos de interface.
- PWA: testes unitários em `pwa/tests/unit` (incluindo um que impede a remoção da dedicatória) e de ponta a ponta em `pwa/tests/e2e` (atualização, substituição da versão antiga, uso offline, migração, manifesto e fluxo principal).
- Testes automáticos não substituem testes em aparelhos reais, análise com leitores de tela nem revisão pastoral do conteúdo.
- O atlas é uma base inicial: não contém fronteiras históricas completas de todas as épocas.
- Traduções de estudo (incluindo Calvino) são identificadas e precisam de revisão editorial; os originais permanecem disponíveis.

## Arquitetura

Conteúdo e dados pessoais ficam separados. Pacotes têm identidade estável, licença e hashes; remover um conteúdo desativa o módulo e preserva notas e cache. Dados pessoais nunca são enviados automaticamente; o APK de produção não solicita Internet. No Flutter, a apresentação está em `lib/`, referências, revisão e validação em `domain.dart` e a persistência em `store.dart`; na PWA, os dados pessoais ficam no IndexedDB do navegador, no mesmo formato do backup do APK.

## Regenerar os modelos 3D

Execute `python3 scripts/build_model_collection.py` depois de gerar `catalogue.sqlite`. O script usa somente geometria original e a base bíblica local, valida referências e cobertura, e recria os GLBs, as associações e o índice de pesquisa.
