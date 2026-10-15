/** Atividades autorais do KM-Bible. Não reproduzem os cartões comerciais. */
export const RULES_SOURCE = 'https://mezuzas.blogspot.com/2009/07/mezuza-o-que-e-o-nome-mezuza-vem-de-um.html';

export type ClassicKind = 'questions' | 'reading' | 'reference-search' | 'word-search' | 'meaning' | 'song' | 'complete-verse';
export type ClassicScope = 'individual' | 'collective';
export type ClassicActivity = {
  number: number;
  kind: ClassicKind;
  scope: ClassicScope;
  prompt: string;
  answer: string;
  reference: string;
};
export type ClassicCard = { id: string; activities: readonly ClassicActivity[] };

export const CLASSIC_KIND_LABELS: Readonly<Record<ClassicKind, string>> = {
  questions: 'Perguntas e respostas',
  reading: 'Leitura de passagens',
  'reference-search': 'Espadas para o ar',
  'word-search': 'Desembainhar espadas',
  meaning: 'Dê o significado',
  song: 'Cantai ao Senhor',
  'complete-verse': 'Complete o versículo',
};

function card(id: string, activities: Omit<ClassicActivity, 'number'>[]): ClassicCard {
  return Object.freeze({ id, activities: Object.freeze(activities.map((a, i) => Object.freeze({ number: i + 1, ...a }))) });
}

export const CLASSIC_CARDS: readonly ClassicCard[] = Object.freeze([
  card('km-classic-01', [
    { kind: 'questions', scope: 'individual', prompt: 'Quem recebeu a tarefa de construir a arca antes do dilúvio?', answer: 'Noé.', reference: 'Gênesis 6:13–22' },
    { kind: 'reading', scope: 'individual', prompt: 'Leia em voz alta Salmo 23:1–3 na tradução bíblica combinada pelo grupo.', answer: 'O monitor acompanha a leitura na mesma tradução e confere se foi feita sem erros.', reference: 'Salmo 23:1–3' },
    { kind: 'reference-search', scope: 'collective', prompt: 'Encontrem João 3:16. Apresentem a referência e leiam o texto ao monitor.', answer: 'Conferir João 3:16 na Bíblia apresentada. O monitor registra quem cumpriu primeiro.', reference: 'João 3:16' },
    { kind: 'word-search', scope: 'collective', prompt: 'Encontrem uma passagem bíblica que contenha a palavra “pastor” e mostrem-na ao monitor.', answer: 'Exemplo possível: Salmo 23:1. Aceitar outra passagem bíblica que contenha a palavra na tradução adotada.', reference: 'Salmo 23:1' },
    { kind: 'meaning', scope: 'individual', prompt: 'No ensino bíblico, o que significa agir com misericórdia?', answer: 'Demonstrar compaixão e cuidado com quem precisa; aceitar uma explicação equivalente.', reference: 'Lucas 10:30–37' },
    { kind: 'song', scope: 'collective', prompt: 'Cantem um trecho de louvor que contenha a palavra “Senhor”.', answer: 'O monitor confere a presença da palavra no trecho cantado. Não há avaliação automática de voz.', reference: 'Salmo 96:1–2' },
    { kind: 'complete-verse', scope: 'individual', prompt: 'O monitor lê o início de Salmo 23:1 na tradução combinada; complete o restante sem consultar.', answer: 'Conferir a continuação diretamente em Salmo 23:1 na tradução combinada, sem exigir outra tradução.', reference: 'Salmo 23:1' },
    { kind: 'questions', scope: 'collective', prompt: 'Em que cidade Jesus nasceu?', answer: 'Belém da Judeia.', reference: 'Mateus 2:1' },
    { kind: 'reading', scope: 'individual', prompt: 'Leia em voz alta Efésios 2:8–10 na tradução combinada pelo grupo.', answer: 'O monitor acompanha Efésios 2:8–10 na mesma tradução e confere a leitura sem erros.', reference: 'Efésios 2:8–10' },
    { kind: 'meaning', scope: 'collective', prompt: 'Explique com suas palavras o que é perdoar alguém.', answer: 'Deixar a ofensa e renunciar à vingança contra o ofensor; aceitar explicação equivalente coerente com a passagem.', reference: 'Colossenses 3:13' },
  ]),
  card('km-classic-02', [
    { kind: 'questions', scope: 'individual', prompt: 'Quem conduziu o povo de Israel na travessia do mar relatada em Êxodo?', answer: 'Moisés.', reference: 'Êxodo 14:21–22' },
    { kind: 'reading', scope: 'individual', prompt: 'Leia em voz alta Mateus 5:13–16 na tradução combinada.', answer: 'O monitor acompanha os versículos na mesma tradução e confere a leitura sem erros.', reference: 'Mateus 5:13–16' },
    { kind: 'reference-search', scope: 'collective', prompt: 'Encontrem Gênesis 1:1 e leiam o versículo ao monitor.', answer: 'Conferir Gênesis 1:1. O monitor registra quem apresentou e leu a referência primeiro.', reference: 'Gênesis 1:1' },
    { kind: 'word-search', scope: 'collective', prompt: 'Encontrem uma passagem com a palavra “luz” e mostrem a referência ao monitor.', answer: 'Exemplo possível: Mateus 5:14. Aceitar outra passagem que contenha a palavra na tradução adotada.', reference: 'Mateus 5:14' },
    { kind: 'meaning', scope: 'individual', prompt: 'O que significa ser próximo de alguém na parábola do bom samaritano?', answer: 'Agir com misericórdia e prestar ajuda a quem necessita; aceitar uma formulação equivalente.', reference: 'Lucas 10:36–37' },
    { kind: 'song', scope: 'collective', prompt: 'Cantem um trecho de louvor que inclua a palavra “amor”.', answer: 'O monitor ouve o trecho e confere a palavra indicada; o aplicativo não julga canto ou microfone.', reference: 'Salmo 100:1–5' },
    { kind: 'complete-verse', scope: 'individual', prompt: 'O monitor lê o início de Gênesis 1:1 na tradução combinada. Complete o versículo sem consultar.', answer: 'Conferir a continuação em Gênesis 1:1 na tradução escolhida pelo grupo.', reference: 'Gênesis 1:1' },
    { kind: 'questions', scope: 'collective', prompt: 'Qual discípulo negou conhecer Jesus três vezes?', answer: 'Pedro.', reference: 'Lucas 22:54–62' },
    { kind: 'reference-search', scope: 'individual', prompt: 'Localize Romanos 12:2 e leia o versículo ao monitor.', answer: 'Conferir a localização e leitura de Romanos 12:2 na Bíblia utilizada.', reference: 'Romanos 12:2' },
    { kind: 'meaning', scope: 'collective', prompt: 'O que é gratidão? Dê uma explicação breve relacionada à vida cristã.', answer: 'Reconhecer e agradecer os benefícios recebidos; aceitar formulação equivalente.', reference: '1 Tessalonicenses 5:18' },
  ]),
  card('km-classic-03', [
    { kind: 'questions', scope: 'individual', prompt: 'Quem interpretou os sonhos do faraó e recebeu autoridade no Egito?', answer: 'José.', reference: 'Gênesis 41:25–44' },
    { kind: 'reading', scope: 'individual', prompt: 'Leia em voz alta 1 Coríntios 13:4–7 na tradução combinada.', answer: 'O monitor acompanha a passagem na mesma tradução e confere a leitura sem erros.', reference: '1 Coríntios 13:4–7' },
    { kind: 'reference-search', scope: 'collective', prompt: 'Encontrem Filipenses 4:6 e leiam o texto ao monitor.', answer: 'Conferir Filipenses 4:6. O monitor identifica quem realizou o desafio primeiro.', reference: 'Filipenses 4:6' },
    { kind: 'word-search', scope: 'collective', prompt: 'Encontrem uma passagem bíblica que contenha a palavra “paz”.', answer: 'Exemplo possível: João 14:27. Aceitar outra passagem com a palavra na tradução adotada.', reference: 'João 14:27' },
    { kind: 'meaning', scope: 'individual', prompt: 'Explique o que significa servir ao próximo.', answer: 'Ajudar e cuidar das pessoas com disposição e humildade; aceitar uma explicação equivalente.', reference: 'Gálatas 5:13' },
    { kind: 'song', scope: 'collective', prompt: 'Cantem um trecho de louvor que inclua a palavra “Deus”.', answer: 'O monitor confere se a palavra aparece no trecho cantado, com julgamento presencial ou por chamada.', reference: 'Salmo 47:6' },
    { kind: 'complete-verse', scope: 'individual', prompt: 'O monitor lê o início de João 11:35 na tradução combinada. Complete o versículo sem consultar.', answer: 'Conferir o texto completo de João 11:35 na tradução adotada.', reference: 'João 11:35' },
    { kind: 'questions', scope: 'collective', prompt: 'Que profeta foi lançado na cova dos leões?', answer: 'Daniel.', reference: 'Daniel 6:16–23' },
    { kind: 'word-search', scope: 'individual', prompt: 'Localize uma passagem bíblica com a palavra “fé” e mostre-a ao monitor.', answer: 'Exemplo possível: Hebreus 11:1. Aceitar outra passagem que contenha a palavra na tradução adotada.', reference: 'Hebreus 11:1' },
    { kind: 'meaning', scope: 'collective', prompt: 'O que significa perseverar na prática do bem?', answer: 'Continuar fazendo o bem sem desistir diante das dificuldades; aceitar uma formulação equivalente.', reference: 'Gálatas 6:9' },
  ]),
]);
