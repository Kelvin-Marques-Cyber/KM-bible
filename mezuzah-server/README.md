# Mezuzá clássico — salas multiplayer

O GitHub Pages é estático. Partidas locais funcionam no site e offline; salas
online exigem este serviço em uma hospedagem com endereço público HTTPS/WSS.
Não há hospedagem online incluída nem configurada por esta implementação.

## Executar e verificar (Node 22.18+)

```bash
cd mezuzah-server
npm ci
npm test
ALLOWED_ORIGINS="https://kelvin-marques-cyber.github.io,http://localhost:5173" PORT=8787 npm start
```

Use um proxy HTTPS com upgrade WebSocket e configure `ALLOWED_ORIGINS` com
origens exatas, sem barra final. A interface aceita a URL WSS do serviço;
`VITE_MEZUZAH_WS_URL` pode fornecer um valor padrão no build do frontend.
`GET /health` retorna `{status:"ok",rules:"mezuzah-classic-v2",rooms:N}`.

O servidor anterior permanece em `legacy-server.mjs`, executável por
`npm run start:legacy`. Ele implementa o percurso antigo de 49 casas e não
representa as regras clássicas solicitadas. Não use os protocolos em conjunto.

## Regras e autoridade

O serviço importa o mesmo motor clássico usado pela PWA. O anfitrião informa
quem é o mais velho e quantos passos existem no percurso externo e na estrela
do tabuleiro físico adotado; o piloto não afirma que uma contagem presumida é
universal a todas as edições comerciais.

- Duas a quatro pessoas ou equipes; o mais velho começa.
- O participante anterior é o leitor/monitor da rodada.
- Só o leitor retira um cartão; a seleção aleatória acontece no servidor.
- Só o participante da vez escolhe o número de 1 a 10.
- Só o leitor registra o acerto observado. A elegibilidade individual ou
  coletiva é validada pelo servidor; o leitor não pode marcar ponto próprio.
- Acerto avança um passo. Vence quem completa os dois percursos e o centro.
- O aplicativo não avalia automaticamente leitura oral, canto ou fala.
  Participantes devem estar presencialmente juntos ou em chamada própria.
- Os cartões incluídos são autorais; não são cópias dos cartões comerciais.

## Protocolo WebSocket

`create {name,maxPlayers}`, `join {name,code}` e `resume {code,token}` autenticam
uma conexão. O servidor responde `welcome {code,token,id}` e `room`. Guarde o
token apenas na sessão do próprio participante. O token tem 48 caracteres
hexadecimais e não aparece nos snapshots ou nas mensagens dos demais.

O snapshot `room` contém `code`, `hostId`, `maxPlayers`, `players`
(`id,name,online`), `game` (ClassicGame ou null), `revision` e `readerId`.
`game.pending.answer` fica vazio para quem não é o leitor. O cliente usa
`isClassicSnapshot` para validar essa visão pública; o servidor usa o estado
completo canônico do motor. Como o baralho autoral é distribuído na própria
PWA para funcionar offline, a ocultação na interface não promete sigilo
criptográfico contra um participante que inspecione os arquivos do cliente.

Toda ação de partida exige `expectedRevision` e `expectedRoundId` do snapshot
mais recente; no lobby ambos começam em zero. A revisão aumenta em cada
mutação e continua aumentando nas revanches, protegendo também contra ações
atrasadas da partida anterior.

```text
start/restart {oldestIndex,route:{outerSteps,starSteps},expectedRevision,expectedRoundId}
draw          {expectedRevision,expectedRoundId}
choose        {number,expectedRevision,expectedRoundId}
resolve       {winnerId:string|null,expectedRevision,expectedRoundId}
```

Só o anfitrião inicia ou reinicia e todos precisam estar conectados. Toda
mensagem inválida devolve `error {message}` e o snapshot atual ao remetente.
O cliente nunca escolhe o cartão sorteado ou aplica pontuação por conta própria.

## Retomada, expiração e limites

Após o início, a vaga e a identidade permanecem reservadas ao token. Retomar
uma sessão revoga a conexão anterior. No lobby, sair remove a vaga e reorganiza
os assentos; o anfitrião é transferido ao primeiro participante restante.

Salas ficam em memória: reiniciar o processo perde o estado. Uma sala expira
após quatro horas sem ações válidas ou dez minutos com todos desconectados.
Há limite de 200 salas, 12 mensagens por segundo por conexão, payload de 4 KiB
e restrição de origem. Execute os testes WebSocket reais antes de oferecer o
serviço; uma hospedagem pública ainda exige testes de carga e monitoramento.
