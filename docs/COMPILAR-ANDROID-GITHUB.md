# Compilar o APK Android 0.4.0 sem computador com Flutter

Este pacote **NÃO contém um APK 0.4.0**. Inclui um workflow de GitHub Actions pronto para **tentar compilar** o aplicativo em um executor Linux.

1. Crie um repositório **privado** no GitHub. O pacote contém conteúdo e recursos de uso pessoal/licenciado, por isso não o exponha publicamente sem verificar as licenças.
2. Extraia a pasta `biblia-reformada` e envie seus arquivos para a raiz do repositório, incluindo `.github/workflows/android-build.yml`, com Git. Se o GitHub rejeitar arquivos grandes, verifique o limite de 100 MB por arquivo.
3. Abra **Actions → Android — APK 0.4.0 → Run workflow**.
4. Quando a execução terminar com sucesso, abra o job e baixe o artefato `Biblia-Reformada-0.4.0-Android-arm64`, que conterá `app-release.apk`.

## Assinatura e atualização sobre a versão 0.3.8

Para atualizar uma versão anteriormente instalada, o Android exige **a mesma chave privada de assinatura** e identificador do aplicativo. Este repositório não contém sua chave privada.

Se você a possuir, configure os GitHub Actions secrets:

- `BIBLIA_KEYSTORE_BASE64`: conteúdo do arquivo JKS codificado em base64 em linha única.
- `BIBLIA_KEY_ALIAS`: alias da chave.
- `BIBLIA_STORE_PASSWORD`: senha do keystore.
- `BIBLIA_KEY_PASSWORD`: senha da chave.

**Não publique sua chave privada no Git.** Sem esses secrets, o workflow utiliza assinatura de debug para um APK de release instalável, porém não é adequado para distribuição e em geral **não atualizará** a instalação 0.3.8. Desinstalar versões anteriores pode apagar dados locais; faça backup antes de tentar.

Para gerar o base64 em um Linux: `base64 -w 0 minha-chave.jks`. Não envie esse resultado em conversas.

## Limitações

Workflow preparado, ainda **não executado em GitHub Actions**. Esta máquina de preparação não dispõe de Flutter/Android SDK nem rede para baixá-los, portanto não foi possível validar a compilação. Erros do workflow serão exibidos nos logs do job.
