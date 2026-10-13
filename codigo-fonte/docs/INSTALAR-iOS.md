# Instalação pessoal no iPhone

Criado por Kelvin e Silva Marques.

O arquivo iOS é compilado em uma máquina macOS com Xcode. Você pode usar o executor macOS do GitHub Actions sem possuir um Mac. O fluxo gera um IPA real para aparelho, sem assinatura de distribuição; o iPhone exige que ele seja reassinado antes da instalação. Não é necessário pagar a anuidade para testar com a assinatura pessoal gratuita do SideStore.

## Gerar o arquivo

Quando o código estiver no seu repositório privado, abra **Actions → iOS — IPA para instalação pessoal → Run workflow**. Uma tag `v...` também inicia a compilação. Após a execução terminar com sucesso, abra **Artifacts** e baixe `Biblia-Reformada-iOS-...`. Extraia o arquivo `Biblia-Reformada-v...-iOS-sem-assinatura.ipa` ou o ZIP iOS. O fluxo registra SHA-256, verifica o executável ARM64, o código Flutter compilado e os arquivos de conteúdo.

O executor precisa de Internet para obter Flutter e dependências. Em repositórios privados, minutos e armazenamento consomem a cota da sua conta; macOS custa mais que Linux. Não há promessa de gratuidade ilimitada. Este projeto limita a execução a 45 minutos, cancela execuções substituídas e guarda os artefatos por sete dias. Baixe também o ZIP: o artefato do Actions não é backup permanente.

Alternativa em um Mac ou outro executor macOS:

```sh
bash scripts/build_ios.sh
```

`bash` executa o roteiro; `scripts/build_ios.sh` é o caminho do roteiro. Ele instala dependências locais, usa `flutter build ios --release --no-codesign` e empacota o aplicativo real em `dist/`. `--release` cria a versão otimizada; `--no-codesign` deixa a assinatura para a instalação pessoal. O empacotador recusa arquivos sem executável Mach-O ARM64 e sem código Flutter AOT; renomear um ZIP ou APK para IPA não gera um aplicativo iOS.

## Instalar com SideStore

1. Siga o [guia oficial atualizado do SideStore](https://docs.sidestore.io/docs/installation/install). Para a instalação inicial no Linux, o [iLoader oficial](https://github.com/nab138/iloader) oferece versões Linux, inclusive RPM. Use a versão apropriada ao seu sistema e as instruções de emparelhamento do projeto.
2. Conecte e autorize o iPhone no computador. Instale o SideStore, conclua o emparelhamento e configure a VPN local indicada no guia. Ative o Modo de Desenvolvedor se solicitado pelo iOS.
3. Entre no SideStore com sua própria conta Apple e renove primeiro o próprio SideStore, como orienta seu guia.
4. Transfira o IPA para o aplicativo Arquivos do iPhone. No SideStore, use a opção de adicionar aplicativo e selecione esse IPA. O SideStore reassina e instala usando sua conta.
5. A conta gratuita normalmente exige renovação em até sete dias e admite três aplicativos ativos, incluindo o SideStore. Mantenha o mecanismo de renovação configurado. O aplicativo bíblico funciona offline após instalado; a renovação da assinatura é uma exigência do método de instalação, separada da leitura.

A versão mínima deste aplicativo é iOS 15. A documentação do SideStore pode mudar: confira seu guia para a versão do seu iPhone. Este projeto ainda precisa de teste de instalação, leitura, SQLite, modelos 3D, notificações em um iPhone físico. A execução bem-sucedida do workflow comprova compilação, não todos os fluxos no aparelho. Não se depende de jailbreak nem de JIT para a versão Flutter release.

## Sua RA pessoal

O código e o IPA deste workflow usam as edições com licenças documentadas. Sua RA autorizada não é enviada ao GitHub. Após instalar, transfira `ara.biblepkg` do seu ZIP **Pessoal**, abra **Biblioteca → Importar módulo** e escolha o pacote. Consulte a licença e selecione a RA no leitor. A autorização que você informou permanece pessoal, sem compartilhar o pacote ou um aplicativo que o incorpore.

Anotações e configurações são locais. Antes de reinstalar ou trocar o método de assinatura, exporte seus estudos em **Configurações → Backup**. Preserve seus ZIPs e use a mesma identidade de aplicativo nas atualizações.

## Fontes do procedimento

- [Flutter: preparar desenvolvimento iOS](https://docs.flutter.dev/platform-integration/ios/setup).
- [GitHub: cobrança e cotas de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- [SideStore: instalação](https://docs.sidestore.io/docs/installation/install) e [limitações da conta gratuita](https://docs.sidestore.io/docs/faq).
- [iLoader: repositório oficial e instalação](https://github.com/nab138/iloader).

Procedimento consultado em 12 de outubro de 2026. O workflow é próprio deste projeto; o exemplo público [hoangnd107/flutter-app-template](https://github.com/hoangnd107/flutter-app-template/blob/main/.github/workflows/ios-build.yml) demonstra a mesma técnica de compilar sem assinatura e empacotar o aplicativo.
