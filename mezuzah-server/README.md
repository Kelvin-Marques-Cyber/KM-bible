# Mezuzá 3D — salas multiplayer

**O site GitHub Pages é estático:** o jogo local funciona nele e offline,
mas salas online precisam deste serviço WebSocket em execução numa hospedagem
com endereço público HTTPS/WSS. Não há servidor ativo incluído no Pages.

## Subir o servidor (Node 22.16+)

```bash
cd mezuzah-server
npm install
ALLOWED_ORIGINS="https://kelvin-marques-cyber.github.io,http://localhost:5173" PORT=8787 npm start
```

- `GET /health` devolve o estado do processo e a contagem de salas.
- Execute atrás de proxy HTTPS com upgrade WebSocket habilitado.
- Configure `ALLOWED_ORIGINS` com as origens exatas autorizadas (sem barra final).
- Em produção, **exponha somente WSS**, não WS aberto.
- A aplicação pode apontar para `wss://SEU-SERVIDOR` no formulário de
  **Ferramentas e Games → Salas pela internet**. O endereço opcional
  `VITE_MEZUZAH_WS_URL` permite definir um padrão no momento do build
  do frontend, mas não é exigido para jogar localmente.
- Em Cloud Shell ou outro ambiente efêmero, não deixe o serviço
  em segundo plano esperando que permaneça disponível permanentemente.

## Regras e segurança

- Criar sala com código aleatório de seis caracteres; entrar pelo convite.
- Duas a quatro pessoas; anfitrião inicia.
- Sorteio com `crypto.getRandomValues` no servidor.
- Apenas quem está no turno consegue lançar o dado/responder; o servidor
  valida jogadas com o **mesmo motor usado no jogo local**.
- Salas em memória. O serviço não precisa guardar nomes em banco.
- Retomar vaga com token aleatório da sessão após a desconexão.
- Limite de mensagens, tamanho máximo de payload, restrição de origem.
- Ao reiniciar o servidor ou após a expiração da sala, o estado se perde.
- Nenhum dinheiro real, apostas, prêmios em dinheiro ou compras no jogo.
- Não altere o conteúdo das perguntas sem conferir as referências bíblicas.

## Limitações atuais

Este serviço é uma primeira implementação de salas sincronizadas.
Antes de oferecê-lo em produção pública, submeta-o a testes de carga,
monitoramento, observabilidade, mitigação de abuso e verificação E2E com
múltiplos navegadores. Não há chat nem ranking global. A partida local
não exige este serviço.

## Interface

- **Ferramentas e Games** → **Mezuzá 3D**: partida presencial local.
- **Ferramentas e Games** → **Salas pela internet**: cria/entra por código,
  exibe participantes, joga com dado e perguntas sincronizados e retoma
  sua sessão temporariamente.
- **Memorização**: cartões e revisões anteriores continuam disponíveis.
