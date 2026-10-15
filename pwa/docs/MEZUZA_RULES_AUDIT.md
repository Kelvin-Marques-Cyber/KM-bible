# Auditoria das regras — Mezuzá clássico

Verificação realizada em 15/10/2026. A edição de referência confirmada pelo usuário é **Mezuzá clássico**. A confirmação anterior de Novo Mezuzá foi corrigida pelo próprio usuário. Não misturar o clássico, o Novo Mezuzá e o Mezuzá Desafio. O pedido de xadrez foi expressamente substituído pelas regras do Mezuzá.

## Fontes e limites

| Fonte | Natureza | Resultado verificável |
| --- | --- | --- |
| [Tudo sobre o Mezuzá — Bible Toys, 25/07/2009](https://mezuzas.blogspot.com/2009/07/mezuza-o-que-e-o-nome-mezuza-vem-de-um.html) | Publicação primária histórica atribuída ao fabricante | Componentes, sete dinâmicas, procedimento de turno, modos individual/coletivo, avanço e condição geral de vitória. As imagens do tabuleiro e cartão não carregam. |
| [Mezuzá — site oficial atual](https://mezuza.com.br/) | Fabricante, catálogo atual | Distingue Novo Mezuzá e Mezuzá Desafio. A descrição atual com oito dinâmicas não substitui o manual clássico. |
| [Manual do jogo Mezuzá — Bible Toys, Vimeo](https://vimeo.com/663815025) | Vídeo primário de 08/01/2022 | Vídeo reproduzível de aproximadamente 5min20s; sem legenda/transcrição disponibilizada no player consultado. Apresenta edições posteriores. Não foi usado para atribuir exceções ao clássico. |
| [Mezuzá (1998) — Ludopedia](https://ludopedia.com.br/jogo/mezuza) | Catálogo colaborativo, secundário | Diferencia a edição histórica das edições de 2018. A ficha reúne descrições de produtos diferentes; não deve decidir regras. |
| [Tabuleiro, fotografia 151374](https://ludopedia.com.br/jogo/mezuza/imagens/151374) e [151370](https://ludopedia.com.br/jogo/mezuza/imagens/151370) | Fotos secundárias publicadas por maioni em 04/05/2020 | As duas imagens exibem a mesma foto de 494×366 pixels. Resolução insuficiente para validar percurso e casas. |

## Regras documentadas para o clássico

Resumo factual da publicação de 2009:

- Componentes: um tabuleiro, quatro peças, 500 cartões. Participação mínima de dois; grupos organizados em até quatro equipes.
- Dinâmicas: perguntas bíblicas; leitura sem erros; busca de referência (Espadas para o ar); busca de palavra (Desembainhar espadas); significado/sinônimo; louvor contendo palavra indicada (Cantai ao Senhor); completar versículo sem erros.
- Começa o participante/monitor mais velho. O participante/monitor à direita retira cartão; quem joga escolhe número de 1 a 10. Lê-se a dinâmica correspondente. Em grupos, responde o monitor da equipe. Turnos em sentido horário.
- Individual: somente participante/equipe da vez; sem repasse. Acerto permite um passo.
- Coletivo: todos podem participar, exceto leitor e seu parceiro/equipe. O vencedor recebe um passo.
- Aproximadamente um minuto é sugestão para resposta, não prazo obrigatório.
- Vitória: alcançar primeiro o centro da Estrela de Davi depois de percorrer as circunvizinhanças de Israel e completar uma volta ao redor da estrela.

Fonte: [Bible Toys, procedimentos gerais e atenção](https://mezuzas.blogspot.com/2009/07/mezuza-o-que-e-o-nome-mezuza-vem-de-um.html).

## Lacunas que impedem afirmar reprodução integral

1. **Percurso físico:** quantidade, ordem e nomes das etapas; ponto inicial; transição exata da rota de Israel para a estrela; contagem da volta; acesso ao centro. Nenhum número de casas foi confirmado nesta auditoria. Não derivar 49 casas da implementação existente nem fazer contagem especulativa pela fotografia.
2. **Cartões:** acervo e associação efetiva dos números 1–10 a cada dinâmica, escopo individual/coletivo e resposta. Não foi obtida uma coleção oficial de cartões legível.
3. **Julgamento:** desempate em desafios coletivos, tentativas malsucedidas, respostas simultâneas, variantes aceitáveis de texto, organização de leitura ou canto e situações contestadas. A publicação geral não resolve esses casos.
4. **Ciclo do baralho:** embaralhamento, descarte, repetição e eventual esgotamento não foram especificados nas fontes verificadas.
5. **Adaptação digital:** avaliação de voz/canto/leitura, mediação remota, ordem de quem respondeu primeiro e eventual uso de um árbitro precisam de comportamento explícito. Não apresentar uma escolha de produto como regra publicada pelo fabricante.

## Inadequações encontradas na implementação anterior

Constatações de código no início desta auditoria; outros trabalhos em paralelo podem modificá-las posteriormente.

| Área | Implementação encontrada | Consequência |
| --- | --- | --- |
| `src/lib/mezuzah-game.ts` | Grade 7×7, 49 posições em serpentina; dado de seis faces | O movimento depende de sorteio, sem correspondência demonstrada com os procedimentos publicados. |
| Mesmo arquivo | Casas de avanço/retorno, bônus de dois passos e recuo por resposta incorreta | Modificadores e penalidades sem fundamento nas regras verificadas. |
| Mesmo arquivo | 30 questões de múltipla escolha; pontos de sabedoria de 1–3 | Banco autoral reduzido e formato único; não implementa as sete dinâmicas nem o conjunto comercial. |
| Mesmo arquivo | Vitória ao alcançar posição final numérica | Não representa as três condições geográficas/estrela/centro. |
| `src/screens/Mezuzah.tsx` | Texto “jornada bíblica original” e regras de dado/49 casas | A identidade pode sugerir fidelidade ao produto original sem documentação suficiente. |
| `src/screens/MezuzahOnline.tsx` e servidor | Ações `roll` e `answer` usando o mesmo motor legado | Validação no servidor torna o estado consistente, mas não comprova fidelidade das regras. |
| Testes existentes | Verificam grade, dado, bônus, penalidades e chegada | Verificam o comportamento legado; não são testes de conformidade ao clássico. |

## Encaminhamento técnico

- Preservar partidas e versão legadas antes da troca. Se acessíveis ao usuário, identificá-las como **adaptação anterior**, com regras próprias.
- Separar regras comprovadas do conteúdo dos cartões e dos dados do percurso. Tornar o percurso configurável evita acoplar um total inventado ao motor.
- Implementar escolha 1–10, leitura, escopo individual/coletivo, um avanço por acerto/vencedor e mediação da resposta com base no procedimento documentado.
- Não configurar um total de casas supostamente oficial sem tabuleiro/manual legível. Uma partida mediada, conferida no tabuleiro físico, pode registrar avanços e marcos; deve declarar essa dependência e não se anunciar como reprodução integral automática.
- Substituir testes do dado por testes de elegibilidade, ausência de repasse, exclusão do leitor/equipe, avanço único, sentido do turno, persistência e equivalência da validação no servidor. Concluir os testes do percurso quando a configuração oficial for verificável.
- Antes de afirmar “regras idênticas”, registrar a fonte legível do percurso e dos cartões, resolver as lacunas acima e validar uma partida completa usando essa edição física.

Esta auditoria não altera o motor, a interface ou o servidor e não afirma que o trabalho de reprodução integral está concluído.
