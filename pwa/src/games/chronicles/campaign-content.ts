/** 36 episódios narrativos autorais, uma jornada por período da história bíblica.
 * Um episódio narra acontecimentos bíblicos fixos e tarefas opcionais de
 * observação; testemunhas adicionais são identificadas como ficção.
 * Não reproduz diálogos bíblicos inventados como se fossem citações.
 */
export type ChronicleEpisode = {
  id: string; saga: number; number: number; title: string;
  reference: { b: number; c: number; v: number; label: string };
  setting: string; hero: string; intro: string;
  stations: {name:string;discovery:string}[];
  trial: {prompt:string;choices:string[];correct:number;explanation:string};
  ending:string;
};
export const CAMPAIGN_SAGAS = [
  {
    "id": "origins",
    "title": "Origens e Promessa",
    "caption": "Da criação à providência no Egito",
    "color": "#8cc7a2"
  },
  {
    "id": "exodus",
    "title": "Libertação e Caminho",
    "caption": "Do cativeiro à terra prometida",
    "color": "#d8bd81"
  },
  {
    "id": "kings",
    "title": "Reis, Profetas e Ruínas",
    "caption": "Coragem, sabedoria e fidelidade",
    "color": "#ce927a"
  },
  {
    "id": "return",
    "title": "Exílio e Retorno",
    "caption": "Esperança em terra estrangeira",
    "color": "#a6aad4"
  },
  {
    "id": "messiah",
    "title": "O Caminho do Messias",
    "caption": "O Evangelho em cidades e caminhos",
    "color": "#e2bf95"
  },
  {
    "id": "witnesses",
    "title": "Testemunhas e Esperança",
    "caption": "A igreja nasce e anuncia Cristo",
    "color": "#9acbcb"
  }
] as const;
export const CAMPAIGN_EPISODES: ChronicleEpisode[] = [
  {
    "id": "creation",
    "saga": 0,
    "number": 1,
    "title": "O Primeiro Alvorecer",
    "reference": {
      "b": 1,
      "c": 1,
      "v": 1,
      "label": "Gênesis 1:1–31"
    },
    "setting": "garden",
    "hero": "Leitor do prólogo",
    "intro": "A criação é apresentada pela voz do narrador bíblico; nenhuma testemunha humana fictícia é colocada antes da criação.",
    "stations": [
      {
        "name": "O firmamento",
        "discovery": "O texto distingue a expansão dos céus, as águas e o aparecimento da terra."
      },
      {
        "name": "A terra fértil",
        "discovery": "Plantas produzem segundo suas espécies; o relato atribui a vida criada à palavra divina."
      },
      {
        "name": "A vida abundante",
        "discovery": "A humanidade aparece ao fim do relato, feita à imagem de Deus; não como criadora de si mesma."
      }
    ],
    "trial": {
      "prompt": "Quem é apresentado como autor da criação?",
      "choices": [
        "Os primeiros reis",
        "O Senhor Deus",
        "O acaso como pessoa"
      ],
      "correct": 1,
      "explanation": "Gênesis começa atribuindo a Deus os céus e a terra."
    },
    "ending": "A história da Bíblia se inicia com a criação, não com um herói humano. O relato culmina na dignidade da vida humana."
  },
  {
    "id": "garden",
    "saga": 0,
    "number": 2,
    "title": "O Jardim e a Escolha",
    "reference": {
      "b": 1,
      "c": 3,
      "v": 1,
      "label": "Gênesis 3:1–24"
    },
    "setting": "garden",
    "hero": "Leitor da narrativa",
    "intro": "A beleza do jardim contrasta com a ruptura da confiança. Observe a progressão do texto sem representar a desobediência como brincadeira.",
    "stations": [
      {
        "name": "A árvore",
        "discovery": "A ordem divina já havia sido apresentada antes da conversa com a serpente."
      },
      {
        "name": "O esconderijo",
        "discovery": "Adão e Eva percebem sua nudez e se escondem ao ouvir a voz do Senhor."
      },
      {
        "name": "O caminho guardado",
        "discovery": "A saída do jardim marca uma mudança profunda na condição humana narrada em Gênesis."
      }
    ],
    "trial": {
      "prompt": "O que sucede à desobediência no relato?",
      "choices": [
        "Construção do templo",
        "Conquista de Jericó",
        "Ruptura e saída do jardim"
      ],
      "correct": 2,
      "explanation": "O capítulo descreve vergonha, consequências e expulsão do jardim."
    },
    "ending": "A narrativa mostra como a transgressão atinge relações, trabalho e vida. Não reescreva suas consequências."
  },
  {
    "id": "ark",
    "saga": 0,
    "number": 3,
    "title": "Madeira Sobre as Águas",
    "reference": {
      "b": 1,
      "c": 6,
      "v": 13,
      "label": "Gênesis 6:13–22"
    },
    "setting": "flood",
    "hero": "Leitor do relato de Noé",
    "intro": "Nuvens escuras e madeira empilhada cercam uma tarefa extraordinária. O foco está na ordem dada a Noé e na sua obediência.",
    "stations": [
      {
        "name": "A madeira preparada",
        "discovery": "O relato bíblico fornece dimensões e instruções precisas para a arca."
      },
      {
        "name": "O abrigo",
        "discovery": "Noé recebe ordem de entrar com sua família e preservar seres vivos conforme a instrução."
      },
      {
        "name": "As provisões",
        "discovery": "Noé recebe a instrução de reunir alimento para sua família e para os animais (Gênesis 6:21)."
      }
    ],
    "trial": {
      "prompt": "Quem recebeu a ordem de construir a arca?",
      "choices": [
        "Noé",
        "Abraão",
        "Moisés"
      ],
      "correct": 0,
      "explanation": "Gênesis 6 atribui a obra a Noé, que segue as instruções recebidas."
    },
    "ending": "Noé cumpre o que lhe foi ordenado. A continuação de Gênesis narra o dilúvio, a preservação de sua família e a aliança."
  },
  {
    "id": "babel",
    "saga": 0,
    "number": 4,
    "title": "Vozes de Babel",
    "reference": {
      "b": 1,
      "c": 11,
      "v": 1,
      "label": "Gênesis 11:1–9"
    },
    "setting": "city",
    "hero": "Um mensageiro anônimo (ficção)",
    "intro": "A planície reúne trabalhadores e tijolos; a ambição é fazer um nome para si. A perspectiva do jogo acompanha o cenário sem alterar a intervenção divina.",
    "stations": [
      {
        "name": "O forno de tijolos",
        "discovery": "Os construtores usam tijolo cozido e betume, materiais citados no próprio texto."
      },
      {
        "name": "A torre erguida",
        "discovery": "O objetivo declarado inclui fazer um nome e evitar a dispersão."
      },
      {
        "name": "A praça das línguas",
        "discovery": "O relato atribui a dispersão dos povos à confusão da linguagem."
      }
    ],
    "trial": {
      "prompt": "Qual era um objetivo dos construtores?",
      "choices": [
        "Reconstruir o templo",
        "Fazer um nome para si",
        "Atravessar o mar Vermelho"
      ],
      "correct": 1,
      "explanation": "Gênesis 11 relata o desejo de construir cidade e torre para não serem dispersos."
    },
    "ending": "A tentativa de exaltação coletiva termina na dispersão; os personagens secundários são narrativos."
  },
  {
    "id": "abram",
    "saga": 0,
    "number": 5,
    "title": "A Estrada da Promessa",
    "reference": {
      "b": 1,
      "c": 12,
      "v": 1,
      "label": "Gênesis 12:1–9"
    },
    "setting": "desert",
    "hero": "Uma guia de caravanas (ficção)",
    "intro": "No caminho entre tendas, o chamado de Abrão rompe com a segurança do conhecido. A viagem não deve ser reduzida a uma simples missão por recompensa.",
    "stations": [
      {
        "name": "O ponto de partida",
        "discovery": "O Senhor chama Abrão a sair de sua terra, parentela e casa paterna."
      },
      {
        "name": "A caravana",
        "discovery": "Abrão parte com Sarai, Ló e seus bens rumo à terra que lhe seria mostrada."
      },
      {
        "name": "O altar",
        "discovery": "Após atravessar a terra, Abrão constrói altar ao Senhor em Siquém."
      }
    ],
    "trial": {
      "prompt": "Que promessa acompanha o chamado de Abrão?",
      "choices": [
        "Fundar Roma",
        "Ser faraó do Egito",
        "Ser bênção para famílias da terra"
      ],
      "correct": 2,
      "explanation": "Gênesis 12 liga a chamada de Abrão a uma promessa de bênção abrangente."
    },
    "ending": "O caminho continua apesar das incertezas; não se presume que os auxiliares fictícios tenham ouvido o chamado."
  },
  {
    "id": "joseph",
    "saga": 0,
    "number": 6,
    "title": "Sonhos no Egito",
    "reference": {
      "b": 1,
      "c": 41,
      "v": 14,
      "label": "Gênesis 41:14–46"
    },
    "setting": "palace",
    "hero": "Um escriba anônimo (ficção)",
    "intro": "Um jovem hebreu é chamado da prisão ao palácio. Sua interpretação dos sonhos precede a organização de provisões para anos difíceis.",
    "stations": [
      {
        "name": "A sala dos sonhos",
        "discovery": "O faraó relata sete vacas e sete espigas, em imagens de abundância e escassez."
      },
      {
        "name": "A mesa de escrita",
        "discovery": "José atribui a revelação do significado dos sonhos a Deus, não à própria habilidade."
      },
      {
        "name": "Os celeiros",
        "discovery": "A administração dos anos de fartura busca preparar o Egito para sete anos de fome."
      }
    ],
    "trial": {
      "prompt": "Quem interpreta os sonhos do faraó?",
      "choices": [
        "José",
        "Arão",
        "Daniel"
      ],
      "correct": 0,
      "explanation": "José atribui a Deus a interpretação e recomenda planejamento durante a abundância."
    },
    "ending": "A providência aparece numa história de adversidades reais. A atividade do escriba no cenário é inventada."
  },
  {
    "id": "moses",
    "saga": 1,
    "number": 7,
    "title": "Às Margens do Nilo",
    "reference": {
      "b": 2,
      "c": 2,
      "v": 1,
      "label": "Êxodo 2:1–10"
    },
    "setting": "river",
    "hero": "Uma moradora do Nilo (ficção)",
    "intro": "No Egito, a família de um bebê enfrenta um decreto cruel. Esta etapa observa a coragem de mulheres e o cuidado que preserva Moisés.",
    "stations": [
      {
        "name": "O cesto",
        "discovery": "A mãe coloca o menino numa arca de juncos impermeabilizada."
      },
      {
        "name": "A margem do rio",
        "discovery": "A irmã vigia de longe o destino do bebê deixado entre os juncos."
      },
      {
        "name": "O palácio próximo",
        "discovery": "A filha do faraó encontra o menino e o acolhe; a criança é chamada Moisés."
      }
    ],
    "trial": {
      "prompt": "Quem encontra a criança entre os juncos?",
      "choices": [
        "Uma sacerdotisa de Baal",
        "A filha do faraó",
        "A rainha Ester"
      ],
      "correct": 1,
      "explanation": "Êxodo 2 descreve a descoberta por uma filha do faraó."
    },
    "ending": "A libertação começa em ações de proteção e coragem, antes das grandes manifestações públicas."
  },
  {
    "id": "bush",
    "saga": 1,
    "number": 8,
    "title": "Fogo que Não Consome",
    "reference": {
      "b": 2,
      "c": 3,
      "v": 1,
      "label": "Êxodo 3:1–15"
    },
    "setting": "mountain",
    "hero": "Um pastor viajante (ficção)",
    "intro": "O deserto oferece silêncio, pedras e uma chama extraordinária. Moisés recebe a missão de conduzir os israelitas para fora do Egito.",
    "stations": [
      {
        "name": "A encosta",
        "discovery": "Moisés apascenta o rebanho de Jetro perto de Horebe, o monte de Deus."
      },
      {
        "name": "A sarça",
        "discovery": "O anjo do Senhor aparece numa chama de fogo no meio da sarça, que não se consome."
      },
      {
        "name": "A senda de volta",
        "discovery": "A missão aponta para o sofrimento dos israelitas, que Deus diz ter visto."
      }
    ],
    "trial": {
      "prompt": "O que chama atenção de Moisés?",
      "choices": [
        "Um navio no deserto",
        "Uma escada de pedra",
        "Uma sarça em chamas que não se consome"
      ],
      "correct": 2,
      "explanation": "A sarça ardente marca o encontro de Moisés com a vocação descrita em Êxodo 3."
    },
    "ending": "A narrativa não apresenta a sarça como objeto mágico controlável pelo jogador."
  },
  {
    "id": "passover",
    "saga": 1,
    "number": 9,
    "title": "A Noite da Páscoa",
    "reference": {
      "b": 2,
      "c": 12,
      "v": 1,
      "label": "Êxodo 12:1–28"
    },
    "setting": "egypt",
    "hero": "Uma vizinha israelita (ficção)",
    "intro": "Noite de preparação, temor e esperança. O relato distingue instruções para as famílias e a libertação anunciada.",
    "stations": [
      {
        "name": "A porta",
        "discovery": "O sangue do cordeiro é posto nas ombreiras e na verga conforme a instrução do capítulo."
      },
      {
        "name": "A mesa",
        "discovery": "A refeição inclui cordeiro assado, pães sem fermento e ervas amargas."
      },
      {
        "name": "O caminho de saída",
        "discovery": "As famílias comem preparadas para partir; a Páscoa é memorial para gerações futuras."
      }
    ],
    "trial": {
      "prompt": "Qual alimento acompanha o cordeiro da Páscoa?",
      "choices": [
        "Pães sem fermento",
        "Uvas do vale de Escol",
        "Maná do deserto"
      ],
      "correct": 0,
      "explanation": "Êxodo 12 menciona pães ázimos e ervas amargas na refeição pascal."
    },
    "ending": "A Páscoa é um memorial instituído no contexto da libertação; o jogo não simula nem substitui rito religioso."
  },
  {
    "id": "sea",
    "saga": 1,
    "number": 10,
    "title": "Entre o Mar e o Medo",
    "reference": {
      "b": 2,
      "c": 14,
      "v": 10,
      "label": "Êxodo 14:10–31"
    },
    "setting": "sea",
    "hero": "Uma jovem israelita (ficção)",
    "intro": "O povo vê o exército se aproximando e o mar à frente. O desafio é compreender as etapas do relato, não comandar o milagre.",
    "stations": [
      {
        "name": "O acampamento",
        "discovery": "Os israelitas temem a perseguição egípcia e clamam diante da ameaça."
      },
      {
        "name": "A margem",
        "discovery": "Moisés exorta o povo a observar o livramento do Senhor."
      },
      {
        "name": "A travessia",
        "discovery": "O texto descreve o vento forte e o mar dividido, permitindo passagem em terra seca."
      }
    ],
    "trial": {
      "prompt": "Quem conduz o povo na travessia narrada?",
      "choices": [
        "Saul",
        "Moisés",
        "Josué como rei"
      ],
      "correct": 1,
      "explanation": "Êxodo 14 apresenta Moisés e a intervenção do Senhor diante do mar."
    },
    "ending": "O livramento não é uma habilidade adquirida, mas ação divina na narrativa bíblica."
  },
  {
    "id": "sinai",
    "saga": 1,
    "number": 11,
    "title": "Vozes no Sinai",
    "reference": {
      "b": 2,
      "c": 20,
      "v": 1,
      "label": "Êxodo 20:1–21"
    },
    "setting": "mountain",
    "hero": "Um jovem do acampamento (ficção)",
    "intro": "Ao pé do monte, o povo recebe instruções que ordenam o relacionamento com Deus e o próximo. O jogo convida a observar a responsabilidade da aliança.",
    "stations": [
      {
        "name": "O monte",
        "discovery": "Trovões, relâmpagos, som de trombeta e fumaça acompanham o cenário narrado."
      },
      {
        "name": "A palavra da aliança",
        "discovery": "Os mandamentos começam recordando o Senhor que tirou Israel do Egito."
      },
      {
        "name": "O acampamento",
        "discovery": "O povo teme e pede que Moisés lhes fale em vez de ouvir diretamente a voz."
      }
    ],
    "trial": {
      "prompt": "Com que declaração o Decálogo começa?",
      "choices": [
        "Jerusalém já era capital",
        "Salomão construiu o templo",
        "Deus tirou Israel do Egito"
      ],
      "correct": 2,
      "explanation": "Êxodo 20 inicia com a lembrança da libertação do Egito."
    },
    "ending": "A obediência responde ao Deus da aliança, não a uma pontuação produzida por desafios."
  },
  {
    "id": "jericho",
    "saga": 1,
    "number": 12,
    "title": "Ao Redor de Jericó",
    "reference": {
      "b": 6,
      "c": 6,
      "v": 1,
      "label": "Josué 6:1–27"
    },
    "setting": "city",
    "hero": "Um carregador do acampamento (ficção)",
    "intro": "Jericó está fechada e cercada de muralhas. O episódio acompanha a obediência à instrução dada a Josué, com a violência do texto tratada sem espetáculo.",
    "stations": [
      {
        "name": "A muralha",
        "discovery": "A cidade está rigorosamente fechada aos israelitas."
      },
      {
        "name": "As trombetas",
        "discovery": "Os sacerdotes levam trombetas enquanto a arca acompanha a marcha."
      },
      {
        "name": "O portão arruinado",
        "discovery": "A narrativa associa a queda dos muros à marcha, ao toque e ao grito do povo."
      }
    ],
    "trial": {
      "prompt": "Quem lidera os israelitas neste episódio?",
      "choices": [
        "Josué",
        "Gideão",
        "Ezequias"
      ],
      "correct": 0,
      "explanation": "Josué 6 apresenta Josué na liderança do povo diante de Jericó."
    },
    "ending": "A conquista é narrada em seu contexto histórico-teológico, sem transformar sofrimento em recompensa lúdica."
  },
  {
    "id": "ruth",
    "saga": 2,
    "number": 13,
    "title": "O Caminho de Rute",
    "reference": {
      "b": 8,
      "c": 1,
      "v": 16,
      "label": "Rute 1:6–22"
    },
    "setting": "fields",
    "hero": "Uma mulher da aldeia (ficção)",
    "intro": "Duas viúvas caminham em direção a Belém. O vínculo entre Rute e Noemi introduz lealdade, perda e esperança.",
    "stations": [
      {
        "name": "A estrada",
        "discovery": "Noemi decide voltar para Judá após ouvir notícias de alimento na terra."
      },
      {
        "name": "A encruzilhada",
        "discovery": "Orfa retorna, enquanto Rute insiste em acompanhar Noemi."
      },
      {
        "name": "Os campos de Belém",
        "discovery": "A chegada ocorre no início da colheita da cevada, como observa o texto."
      }
    ],
    "trial": {
      "prompt": "Quem decide permanecer com Noemi?",
      "choices": [
        "Débora",
        "Rute",
        "Orfa"
      ],
      "correct": 1,
      "explanation": "Rute 1 descreve o compromisso de Rute com Noemi."
    },
    "ending": "O foco é a fidelidade em meio à vulnerabilidade, não uma idealização da pobreza."
  },
  {
    "id": "samuel",
    "saga": 2,
    "number": 14,
    "title": "A Voz na Noite",
    "reference": {
      "b": 9,
      "c": 3,
      "v": 1,
      "label": "1 Samuel 3:1–21"
    },
    "setting": "temple",
    "hero": "Um auxiliar do santuário (ficção)",
    "intro": "O jovem Samuel serve sob os cuidados de Eli quando uma voz interrompe a noite. A busca pela fonte da voz conduz ao reconhecimento do chamado.",
    "stations": [
      {
        "name": "O lampadário",
        "discovery": "O texto diz que a lâmpada de Deus ainda não se havia apagado."
      },
      {
        "name": "O quarto de Eli",
        "discovery": "Samuel pensa que Eli o chama e vai até ele diversas vezes."
      },
      {
        "name": "A sala silenciosa",
        "discovery": "Eli compreende que o Senhor chama o menino e lhe orienta como responder."
      }
    ],
    "trial": {
      "prompt": "Quem ajuda Samuel a reconhecer o chamado?",
      "choices": [
        "Natã",
        "Gamaliel",
        "Eli"
      ],
      "correct": 2,
      "explanation": "Eli instrui Samuel sobre como responder ao Senhor."
    },
    "ending": "Não atribua novas palavras reveladas ao ajudante fictício da exploração."
  },
  {
    "id": "david",
    "saga": 2,
    "number": 15,
    "title": "O Vale e a Coragem",
    "reference": {
      "b": 9,
      "c": 17,
      "v": 17,
      "label": "1 Samuel 17:17–50"
    },
    "setting": "fields",
    "hero": "Neri (personagem fictício)",
    "intro": "Este capítulo retoma o piloto completo: provisões, acampamento, escolhas e o encontro decisivo no vale de Elá.",
    "stations": [
      {
        "name": "O pão entregue",
        "discovery": "Jessé encarrega Davi de levar mantimentos aos seus irmãos."
      },
      {
        "name": "A linha do vale",
        "discovery": "Davi ouve o desafio do filisteu e observa a reação do povo."
      },
      {
        "name": "O ribeiro",
        "discovery": "Davi escolhe cinco pedras lisas, elemento explícito do relato."
      }
    ],
    "trial": {
      "prompt": "Quem confronta Golias segundo o texto?",
      "choices": [
        "Davi",
        "Samuel",
        "Salomão"
      ],
      "correct": 0,
      "explanation": "Davi confronta o filisteu confiando no Senhor."
    },
    "ending": "Este capítulo possui também um episódio de exploração ampliada disponível como piloto separado."
  },
  {
    "id": "solomon",
    "saga": 2,
    "number": 16,
    "title": "Um Coração Atento",
    "reference": {
      "b": 11,
      "c": 3,
      "v": 3,
      "label": "1 Reis 3:3–15"
    },
    "setting": "palace",
    "hero": "Um servidor de corte (ficção)",
    "intro": "Em Gibeão, Salomão pede sabedoria em vez de vantagens imediatas. A corte enfrenta decisões que exigem discernimento.",
    "stations": [
      {
        "name": "O caminho de Gibeão",
        "discovery": "Salomão vai ao alto lugar principal para oferecer sacrifícios."
      },
      {
        "name": "A visão noturna",
        "discovery": "O Senhor aparece a Salomão em sonho e lhe pergunta o que deseja."
      },
      {
        "name": "O salão do juízo",
        "discovery": "Salomão pede coração compreensivo para julgar o povo e distinguir bem e mal."
      }
    ],
    "trial": {
      "prompt": "O que Salomão pede principalmente?",
      "choices": [
        "Riqueza acima de todos",
        "Um coração que saiba discernir",
        "Vida interminável"
      ],
      "correct": 1,
      "explanation": "1 Reis 3 relata que a súplica por sabedoria agrada ao Senhor."
    },
    "ending": "A sabedoria régia é apresentada como responsabilidade, e não como superpoder."
  },
  {
    "id": "elijah",
    "saga": 2,
    "number": 17,
    "title": "No Monte Carmelo",
    "reference": {
      "b": 11,
      "c": 18,
      "v": 20,
      "label": "1 Reis 18:20–39"
    },
    "setting": "mountain",
    "hero": "Um observador no Carmelo (ficção)",
    "intro": "Israel está dividido entre lealdades. O episódio acompanha os acontecimentos no monte sem permitir controlar a ação de Deus.",
    "stations": [
      {
        "name": "O altar restaurado",
        "discovery": "Elias repara o altar do Senhor que estava derrubado."
      },
      {
        "name": "As doze pedras",
        "discovery": "Elias toma doze pedras, evocando as tribos dos filhos de Jacó."
      },
      {
        "name": "A água derramada",
        "discovery": "A narrativa descreve água sobre o holocausto e a lenha antes da oração de Elias."
      }
    ],
    "trial": {
      "prompt": "Quantas pedras Elias utiliza no altar?",
      "choices": [
        "Três",
        "Quarenta",
        "Doze"
      ],
      "correct": 2,
      "explanation": "1 Reis 18:31 informa que Elias tomou doze pedras."
    },
    "ending": "O monte é cenário de confronto de lealdades; a manifestação divina não é uma mecânica de magia."
  },
  {
    "id": "isaiah",
    "saga": 2,
    "number": 18,
    "title": "O Chamado de Isaías",
    "reference": {
      "b": 23,
      "c": 6,
      "v": 1,
      "label": "Isaías 6:1–13"
    },
    "setting": "temple",
    "hero": "Leitor do testemunho profético",
    "intro": "Uma visão de santidade expõe a indignidade humana e culmina num envio profético. O episódio é narrado, não coloca personagens fictícios dentro da visão.",
    "stations": [
      {
        "name": "O trono",
        "discovery": "Isaías descreve o Senhor assentado sobre alto e sublime trono."
      },
      {
        "name": "O louvor",
        "discovery": "Serafins proclamam a santidade divina na visão do profeta."
      },
      {
        "name": "O altar",
        "discovery": "Uma brasa tocando os lábios simboliza purificação antes do chamado."
      }
    ],
    "trial": {
      "prompt": "Quem responde ao chamado dizendo estar disponível?",
      "choices": [
        "Isaías",
        "Jeremias como rei",
        "Davi"
      ],
      "correct": 0,
      "explanation": "Isaías 6 apresenta o profeta dispondo-se a ser enviado pelo Senhor."
    },
    "ending": "A visão pertence ao relato profético; o jogador a observa como narrativa bíblica."
  },
  {
    "id": "daniel",
    "saga": 3,
    "number": 19,
    "title": "Mesa na Babilônia",
    "reference": {
      "b": 27,
      "c": 1,
      "v": 3,
      "label": "Daniel 1:3–21"
    },
    "setting": "palace",
    "hero": "Um aprendiz de escriba (ficção)",
    "intro": "Jovens exilados vivem sob uma nova corte e seus costumes. Daniel decide não se contaminar com a porção das iguarias reais.",
    "stations": [
      {
        "name": "A escola da corte",
        "discovery": "Jovens da casa real e nobreza são selecionados para aprender cultura e língua dos caldeus."
      },
      {
        "name": "A mesa",
        "discovery": "Daniel pede um tratamento que preserve suas convicções."
      },
      {
        "name": "O posto de inspeção",
        "discovery": "Ao final dos dez dias, o resultado da prova é observado pelo oficial."
      }
    ],
    "trial": {
      "prompt": "O que Daniel propõe comer durante a prova?",
      "choices": [
        "Pães ázimos e vinho",
        "Legumes e água",
        "Carne do sacrifício"
      ],
      "correct": 1,
      "explanation": "Daniel 1:12 registra o pedido de legumes e água."
    },
    "ending": "A identidade no exílio se expressa por decisão e fidelidade, não por superioridade cultural automática."
  },
  {
    "id": "furnace",
    "saga": 3,
    "number": 20,
    "title": "A Fornalha de Babilônia",
    "reference": {
      "b": 27,
      "c": 3,
      "v": 1,
      "label": "Daniel 3:1–30"
    },
    "setting": "city",
    "hero": "Um assistente da corte (ficção)",
    "intro": "Uma imagem de ouro e uma ordem pública colocam três homens diante de uma escolha de consciência.",
    "stations": [
      {
        "name": "A grande imagem",
        "discovery": "Nabucodonosor ergue uma imagem de ouro na planície de Dura."
      },
      {
        "name": "O anúncio",
        "discovery": "O decreto exige prostração quando os instrumentos soarem."
      },
      {
        "name": "A fornalha",
        "discovery": "Sadraque, Mesaque e Abede-Nego recusam adorar a imagem, mesmo sob ameaça."
      }
    ],
    "trial": {
      "prompt": "Quais três homens recusam adorar a imagem?",
      "choices": [
        "Pedro, Tiago e João",
        "Corá, Datã e Abirão",
        "Sadraque, Mesaque e Abede-Nego"
      ],
      "correct": 2,
      "explanation": "Daniel 3 narra a recusa desses três jovens."
    },
    "ending": "A narrativa centra-se na fidelidade e no livramento; não faz da fornalha um espetáculo jogável."
  },
  {
    "id": "lions",
    "saga": 3,
    "number": 21,
    "title": "A Janela de Daniel",
    "reference": {
      "b": 27,
      "c": 6,
      "v": 10,
      "label": "Daniel 6:10–24"
    },
    "setting": "palace",
    "hero": "Uma servidora do palácio (ficção)",
    "intro": "Um decreto busca transformar a oração de Daniel em crime. A perseverança do personagem torna-se alvo de intriga.",
    "stations": [
      {
        "name": "A janela aberta",
        "discovery": "Daniel continua orando três vezes ao dia voltado para Jerusalém."
      },
      {
        "name": "O pergaminho selado",
        "discovery": "O decreto é firmado e usado pelos adversários de Daniel."
      },
      {
        "name": "A entrada da cova",
        "discovery": "O rei ordena que Daniel seja levado à cova dos leões."
      }
    ],
    "trial": {
      "prompt": "Quantas vezes ao dia Daniel orava, segundo o relato?",
      "choices": [
        "Três",
        "Uma",
        "Sete"
      ],
      "correct": 0,
      "explanation": "Daniel 6:10 afirma que Daniel orava três vezes ao dia."
    },
    "ending": "A fidelidade é exercida mesmo sob ameaça; a proteção divina não pode ser adquirida por pontos."
  },
  {
    "id": "esther",
    "saga": 3,
    "number": 22,
    "title": "Coragem no Palácio",
    "reference": {
      "b": 17,
      "c": 4,
      "v": 10,
      "label": "Ester 4:10–17"
    },
    "setting": "palace",
    "hero": "Uma costureira de Susã (ficção)",
    "intro": "A ameaça ao povo judeu exige coragem e prudência. Ester precisa decidir como se apresentar diante do rei.",
    "stations": [
      {
        "name": "O corredor real",
        "discovery": "Ninguém deve entrar sem ser chamado, sob risco previsto na lei persa."
      },
      {
        "name": "A mensagem de Mardoqueu",
        "discovery": "O pedido recorda o perigo que também alcança Ester."
      },
      {
        "name": "O preparo",
        "discovery": "Ester pede jejum entre os judeus de Susã antes de comparecer ao rei."
      }
    ],
    "trial": {
      "prompt": "O que Ester solicita antes de ir ao rei?",
      "choices": [
        "Uma nova torre",
        "Jejum",
        "Uma corrida de cavalos"
      ],
      "correct": 1,
      "explanation": "Ester 4 registra o pedido de jejum por três dias."
    },
    "ending": "O foco está na responsabilidade de Ester e no risco real do ato."
  },
  {
    "id": "ezra",
    "saga": 3,
    "number": 23,
    "title": "O Livro da Lei",
    "reference": {
      "b": 15,
      "c": 7,
      "v": 6,
      "label": "Esdras 7:6–10"
    },
    "setting": "temple",
    "hero": "Um aprendiz de leitura (ficção)",
    "intro": "O retorno do exílio traz também a tarefa de ensinar a Lei. O estudo, a prática e o ensino caminham juntos.",
    "stations": [
      {
        "name": "O rolo",
        "discovery": "Esdras é descrito como escriba versado na Lei de Moisés."
      },
      {
        "name": "O caminho para Jerusalém",
        "discovery": "O escriba parte da Babilônia durante o reinado de Artaxerxes."
      },
      {
        "name": "A assembleia",
        "discovery": "Esdras dispõe o coração a buscar, cumprir e ensinar a Lei do Senhor."
      }
    ],
    "trial": {
      "prompt": "Que três ações Esdras determina em seu coração?",
      "choices": [
        "Comprar, vender e conquistar",
        "Esquecer, fugir e esconder",
        "Buscar, cumprir e ensinar a Lei"
      ],
      "correct": 2,
      "explanation": "Esdras 7:10 apresenta busca, prática e ensino da Lei."
    },
    "ending": "O jogo usa leitura e interpretação como desafios, sem inventar conteúdos secretos."
  },
  {
    "id": "nehemiah",
    "saga": 3,
    "number": 24,
    "title": "Pedras de Jerusalém",
    "reference": {
      "b": 16,
      "c": 6,
      "v": 1,
      "label": "Neemias 6:1–16"
    },
    "setting": "city",
    "hero": "Um carregador de pedras (ficção)",
    "intro": "A reconstrução dos muros de Jerusalém enfrenta oposição e tentativas de distração. Neemias mantém o trabalho.",
    "stations": [
      {
        "name": "O muro",
        "discovery": "As brechas da muralha haviam sido fechadas, embora as portas ainda não estivessem assentadas."
      },
      {
        "name": "A carta",
        "discovery": "Os adversários tentam chamar Neemias para encontros que desviariam o serviço."
      },
      {
        "name": "Os portões",
        "discovery": "A obra é concluída apesar da pressão e da oposição."
      }
    ],
    "trial": {
      "prompt": "Em quantos dias o muro foi concluído?",
      "choices": [
        "Cinquenta e dois",
        "Sete",
        "Quatrocentos"
      ],
      "correct": 0,
      "explanation": "Neemias 6:15 informa a conclusão do muro em cinquenta e dois dias."
    },
    "ending": "A conclusão não ignora riscos políticos e sociais da reconstrução."
  },
  {
    "id": "birth",
    "saga": 4,
    "number": 25,
    "title": "A Noite de Belém",
    "reference": {
      "b": 42,
      "c": 2,
      "v": 1,
      "label": "Lucas 2:1–20"
    },
    "setting": "village",
    "hero": "Uma moradora de Belém (ficção)",
    "intro": "Uma viagem até Belém e o nascimento de Jesus são anunciados com simplicidade no Evangelho. A aventura evita detalhes não presentes no texto.",
    "stations": [
      {
        "name": "O recenseamento",
        "discovery": "O decreto de César Augusto motiva o deslocamento de José."
      },
      {
        "name": "O abrigo",
        "discovery": "Jesus nasce, é envolto em panos e colocado numa manjedoura."
      },
      {
        "name": "O campo",
        "discovery": "Pastores recebem o anúncio do nascimento e vão até Belém."
      }
    ],
    "trial": {
      "prompt": "Onde o menino Jesus é colocado?",
      "choices": [
        "No templo de Jerusalém",
        "Numa manjedoura",
        "Num trono de ouro"
      ],
      "correct": 1,
      "explanation": "Lucas 2:7 descreve a manjedoura."
    },
    "ending": "A narrativa distingue os dados do Evangelho das cenografias imaginativas posteriores."
  },
  {
    "id": "baptism",
    "saga": 4,
    "number": 26,
    "title": "Às Águas do Jordão",
    "reference": {
      "b": 40,
      "c": 3,
      "v": 13,
      "label": "Mateus 3:13–17"
    },
    "setting": "river",
    "hero": "Um viajante junto ao Jordão (ficção)",
    "intro": "Pessoas vêm até o rio para ouvir João Batista. O texto apresenta o batismo de Jesus e a declaração celestial.",
    "stations": [
      {
        "name": "A margem",
        "discovery": "João batiza no Jordão, chamando as pessoas ao arrependimento."
      },
      {
        "name": "A chegada",
        "discovery": "Jesus vem da Galileia ao Jordão para ser batizado por João."
      },
      {
        "name": "O testemunho",
        "discovery": "O Evangelho relata o Espírito descendo como pomba e uma voz vinda dos céus."
      }
    ],
    "trial": {
      "prompt": "Quem batiza Jesus?",
      "choices": [
        "Pedro",
        "Nicodemos",
        "João Batista"
      ],
      "correct": 2,
      "explanation": "Mateus 3 apresenta João batizando Jesus."
    },
    "ending": "O jogo não oferece recriação sacramental; apresenta o testemunho da passagem."
  },
  {
    "id": "samaritan",
    "saga": 4,
    "number": 27,
    "title": "O Caminho de Jericó",
    "reference": {
      "b": 42,
      "c": 10,
      "v": 25,
      "label": "Lucas 10:25–37"
    },
    "setting": "desert",
    "hero": "Um viajante da estrada (ficção)",
    "intro": "A parábola do bom samaritano confronta desculpas para omitir socorro. A aventura explora como o texto conta a história.",
    "stations": [
      {
        "name": "A estrada perigosa",
        "discovery": "Na parábola, um homem desce de Jerusalém para Jericó e cai entre salteadores."
      },
      {
        "name": "A distância",
        "discovery": "Um sacerdote e um levita passam sem socorrer o ferido."
      },
      {
        "name": "O abrigo",
        "discovery": "Um samaritano cuida do homem, leva-o a uma hospedaria e providencia assistência."
      }
    ],
    "trial": {
      "prompt": "Quem age com misericórdia na parábola?",
      "choices": [
        "O samaritano",
        "Os salteadores",
        "O sacerdote"
      ],
      "correct": 0,
      "explanation": "Lucas 10 identifica o samaritano como aquele que usou de misericórdia."
    },
    "ending": "O jogo representa uma parábola, não um registro de uma viagem histórica específica."
  },
  {
    "id": "storm",
    "saga": 4,
    "number": 28,
    "title": "Silêncio Sobre as Águas",
    "reference": {
      "b": 41,
      "c": 4,
      "v": 35,
      "label": "Marcos 4:35–41"
    },
    "setting": "sea",
    "hero": "Um observador da narrativa",
    "intro": "A noite cai sobre a travessia e uma tempestade assusta os discípulos. O relato focaliza a autoridade de Jesus.",
    "stations": [
      {
        "name": "A embarcação",
        "discovery": "Jesus e os discípulos entram no barco para atravessar o mar."
      },
      {
        "name": "As ondas",
        "discovery": "O vento forte lança água no barco enquanto Jesus dorme."
      },
      {
        "name": "A calmaria",
        "discovery": "Jesus repreende o vento e diz ao mar que se aquiete."
      }
    ],
    "trial": {
      "prompt": "O que acontece após Jesus repreender o vento?",
      "choices": [
        "Um templo surge",
        "Grande bonança",
        "O barco desaparece"
      ],
      "correct": 1,
      "explanation": "Marcos 4:39 descreve que o vento cessou e houve grande bonança."
    },
    "ending": "A história é sobre Jesus, não sobre uma técnica humana de controlar o clima."
  },
  {
    "id": "supper",
    "saga": 4,
    "number": 29,
    "title": "A Mesa da Aliança",
    "reference": {
      "b": 42,
      "c": 22,
      "v": 7,
      "label": "Lucas 22:7–23"
    },
    "setting": "upper",
    "hero": "Leitor da narrativa",
    "intro": "Na última ceia, palavras e sinais dirigem a atenção à entrega de Cristo. O episódio evita tratar a cerimônia cristã como minijogo.",
    "stations": [
      {
        "name": "A sala preparada",
        "discovery": "Os discípulos preparam o lugar para comer a Páscoa."
      },
      {
        "name": "O pão",
        "discovery": "Jesus toma o pão, dá graças e o distribui aos discípulos."
      },
      {
        "name": "O cálice",
        "discovery": "A narrativa apresenta o cálice ligado à nova aliança no sangue de Jesus."
      }
    ],
    "trial": {
      "prompt": "A que aliança Jesus associa o cálice?",
      "choices": [
        "À aliança com Noé apenas",
        "À construção de Babel",
        "À nova aliança"
      ],
      "correct": 2,
      "explanation": "Lucas 22:20 relaciona o cálice à nova aliança."
    },
    "ending": "A ceia é apresentada como ensinamento de Jesus; não é substituída por rituais digitais."
  },
  {
    "id": "resurrection",
    "saga": 4,
    "number": 30,
    "title": "O Jardim da Ressurreição",
    "reference": {
      "b": 43,
      "c": 20,
      "v": 1,
      "label": "João 20:1–18"
    },
    "setting": "garden",
    "hero": "Leitor do testemunho pascal",
    "intro": "Após a crucificação e a morte de Jesus (João 19:16–30), seu corpo é sepultado. No primeiro dia da semana, Maria Madalena encontra a pedra retirada. O relato acompanha o encontro com Jesus ressuscitado, que transforma seu luto.",
    "stations": [
      {
        "name": "O sepulcro",
        "discovery": "Jesus morreu na cruz e foi sepultado (João 19:30–42). Ao chegar ao sepulcro, Maria observa que a pedra foi removida da entrada (João 20:1)."
      },
      {
        "name": "O jardim",
        "discovery": "Ela chora e ainda não reconhece Jesus quando ele se aproxima."
      },
      {
        "name": "O chamado",
        "discovery": "Ao ouvir seu nome, Maria reconhece Jesus e anuncia aos discípulos o que viu."
      }
    ],
    "trial": {
      "prompt": "Quem encontra Jesus no jardim segundo João 20?",
      "choices": [
        "Maria Madalena",
        "A rainha Ester",
        "Rute"
      ],
      "correct": 0,
      "explanation": "João 20 apresenta Maria Madalena diante de Jesus ressuscitado."
    },
    "ending": "A ressurreição permanece acontecimento central do testemunho cristão, não uma recompensa do jogador."
  },
  {
    "id": "pentecost",
    "saga": 5,
    "number": 31,
    "title": "Vento em Jerusalém",
    "reference": {
      "b": 44,
      "c": 2,
      "v": 1,
      "label": "Atos 2:1–13"
    },
    "setting": "city",
    "hero": "Um peregrino em Jerusalém (ficção)",
    "intro": "Uma multidão está reunida na cidade quando os discípulos são alcançados pelo Espírito Santo. O episódio acompanha a comunicação da mensagem em várias línguas.",
    "stations": [
      {
        "name": "A casa",
        "discovery": "Atos descreve som como de vento impetuoso enchendo a casa."
      },
      {
        "name": "A multidão",
        "discovery": "Judeus vindos de várias nações ouvem os discípulos em suas línguas."
      },
      {
        "name": "A praça",
        "discovery": "As pessoas reagem com surpresa e perguntas sobre o ocorrido."
      }
    ],
    "trial": {
      "prompt": "Por que a multidão se admira?",
      "choices": [
        "As moedas mudaram de valor",
        "Ouvem em suas próprias línguas",
        "O templo desapareceu"
      ],
      "correct": 1,
      "explanation": "Atos 2 apresenta a audição da mensagem em diferentes línguas."
    },
    "ending": "Pentecostes é testemunho da ação do Espírito, não um sistema de poderes do RPG."
  },
  {
    "id": "stephen",
    "saga": 5,
    "number": 32,
    "title": "A Firmeza de Estêvão",
    "reference": {
      "b": 44,
      "c": 7,
      "v": 54,
      "label": "Atos 7:54–60"
    },
    "setting": "city",
    "hero": "Um observador da narrativa",
    "intro": "O testemunho de Estêvão encontra uma reação violenta. A cena é contada com sobriedade, respeitando a gravidade do martírio.",
    "stations": [
      {
        "name": "A assembleia",
        "discovery": "O discurso de Estêvão relembra a história de Israel."
      },
      {
        "name": "A cidade",
        "discovery": "A multidão o conduz para fora, conforme o relato."
      },
      {
        "name": "A oração",
        "discovery": "Estêvão ora pelo perdão dos seus agressores."
      }
    ],
    "trial": {
      "prompt": "O que Estêvão pede em oração por seus agressores?",
      "choices": [
        "Que recebam um trono",
        "Que destruam a cidade",
        "Que a culpa não lhes seja imputada"
      ],
      "correct": 2,
      "explanation": "Atos 7:60 registra a oração de Estêvão por seus ofensores."
    },
    "ending": "O episódio evita transformar o martírio em espetáculo ou pontuação."
  },
  {
    "id": "damascus",
    "saga": 5,
    "number": 33,
    "title": "A Estrada de Damasco",
    "reference": {
      "b": 44,
      "c": 9,
      "v": 1,
      "label": "Atos 9:1–19"
    },
    "setting": "desert",
    "hero": "Um viajante da estrada (ficção)",
    "intro": "Saulo caminha para Damasco buscando prender seguidores do Caminho. O encontro narrado em Atos altera o rumo de sua vida.",
    "stations": [
      {
        "name": "A estrada",
        "discovery": "Saulo leva cartas para as sinagogas de Damasco."
      },
      {
        "name": "A luz",
        "discovery": "Uma luz do céu o cerca e ele cai por terra."
      },
      {
        "name": "A casa em Damasco",
        "discovery": "Ananias é enviado para encontrá-lo e acompanhá-lo no início da nova caminhada."
      }
    ],
    "trial": {
      "prompt": "Quem recebe ordem de visitar Saulo em Damasco?",
      "choices": [
        "Ananias",
        "Cornélio",
        "Áquila"
      ],
      "correct": 0,
      "explanation": "Atos 9 identifica Ananias como aquele que foi enviado a Saulo."
    },
    "ending": "A conversão de Saulo pertence à narrativa apostólica; o personagem fictício não causa a visão."
  },
  {
    "id": "cornelius",
    "saga": 5,
    "number": 34,
    "title": "A Porta Aberta",
    "reference": {
      "b": 44,
      "c": 10,
      "v": 24,
      "label": "Atos 10:24–48"
    },
    "setting": "village",
    "hero": "Um mensageiro em Cesareia (ficção)",
    "intro": "Uma casa se reúne para ouvir Pedro. O capítulo examina como o anúncio do Evangelho alcança também pessoas de outras nações.",
    "stations": [
      {
        "name": "A casa de Cornélio",
        "discovery": "Cornélio espera Pedro com parentes e amigos próximos."
      },
      {
        "name": "A chegada",
        "discovery": "Pedro explica que não deve considerar nenhum ser humano comum ou impuro."
      },
      {
        "name": "A mensagem",
        "discovery": "Pedro anuncia Jesus, sua morte e ressurreição aos reunidos."
      }
    ],
    "trial": {
      "prompt": "Quem é recebido na casa de Cornélio para anunciar a mensagem?",
      "choices": [
        "Salomão",
        "Pedro",
        "Moisés"
      ],
      "correct": 1,
      "explanation": "Atos 10 relata a ida de Pedro até Cornélio."
    },
    "ending": "O encontro ajuda a compreender a ampliação da comunidade cristã sem apagar o contexto judaico de Pedro."
  },
  {
    "id": "philippi",
    "saga": 5,
    "number": 35,
    "title": "Perto do Rio em Filipos",
    "reference": {
      "b": 44,
      "c": 16,
      "v": 11,
      "label": "Atos 16:11–15"
    },
    "setting": "river",
    "hero": "Uma comerciante no porto (ficção)",
    "intro": "A missão de Paulo chega a Filipos. Próximo de um rio, mulheres se reúnem para oração e Lídia ouve a mensagem.",
    "stations": [
      {
        "name": "O porto",
        "discovery": "Paulo e seus companheiros chegam à região da Macedônia."
      },
      {
        "name": "O rio",
        "discovery": "No sábado, procuram um lugar de oração fora das portas da cidade."
      },
      {
        "name": "A casa de Lídia",
        "discovery": "Lídia, comerciante de púrpura, acolhe os viajantes após ouvir a mensagem."
      }
    ],
    "trial": {
      "prompt": "Qual era a ocupação de Lídia?",
      "choices": [
        "Pescadora de Cafarnaum",
        "Soldado romano",
        "Vendedora de púrpura"
      ],
      "correct": 2,
      "explanation": "Atos 16:14 identifica Lídia como vendedora de púrpura."
    },
    "ending": "O diálogo oferece contexto de hospitalidade e fé, sem criar palavras atribuídas a Paulo."
  },
  {
    "id": "newjerusalem",
    "saga": 5,
    "number": 36,
    "title": "A Cidade da Esperança",
    "reference": {
      "b": 66,
      "c": 21,
      "v": 1,
      "label": "Apocalipse 21:1–27"
    },
    "setting": "city",
    "hero": "Leitor da visão de João",
    "intro": "A visão profética descreve nova criação, consolação e a santa cidade. O jogo não confunde símbolo profético com arquitetura arqueológica.",
    "stations": [
      {
        "name": "O novo céu",
        "discovery": "João relata novo céu e nova terra, pois os primeiros haviam passado."
      },
      {
        "name": "A cidade",
        "discovery": "A nova Jerusalém desce do céu, preparada como noiva adornada."
      },
      {
        "name": "A promessa",
        "discovery": "O texto anuncia que Deus enxugará dos olhos toda lágrima."
      }
    ],
    "trial": {
      "prompt": "O que a visão promete sobre a morte?",
      "choices": [
        "Já não haverá morte",
        "A morte governará sempre",
        "Todos voltarão ao Egito"
      ],
      "correct": 0,
      "explanation": "Apocalipse 21:4 anuncia o fim da morte e do pranto."
    },
    "ending": "O encerramento conduz o jogador à esperança escatológica, sem inventar uma cronologia além da visão."
  }
];
