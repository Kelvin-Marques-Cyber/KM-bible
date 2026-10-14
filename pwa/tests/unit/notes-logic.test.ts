import { describe, expect, it } from 'vitest';
import {
  attachmentMarkdown,
  errorText,
  fileExtension,
  filterNotes,
  isImageFile,
  noteHaystack,
  noteMeta,
  notePreview,
  notebooksOf,
} from '../../src/lib/notes-logic';
import type { Note } from '../../src/lib/store';

const make = (id: string, title: string, body: string, notebook = 'Estudos', tags = ''): Note => ({
  id,
  title,
  body,
  reference: '',
  notebook,
  tags,
  updated_at: 0,
});

const notes = [
  make('a', 'Graça em Romanos', 'Justificação pela fé', 'Estudos', 'soteriologia'),
  make('b', 'Sermão', 'Esboço sobre a CRIAÇÃO', 'Pregações', 'gênesis'),
  make('c', 'Lista', 'compras', '', ''),
  make('d', 'Oração', 'Pai nosso', 'Pregações', 'devocional'),
];

describe('filterNotes (NotesPage)', () => {
  it('sem filtros devolve todas, numa cópia', () => {
    const out = filterNotes(notes, '', '');
    expect(out).toEqual(notes);
    expect(out).not.toBe(notes);
  });

  it('busca ignora acentos e caixa em título, corpo e etiquetas', () => {
    expect(filterNotes(notes, '', 'graca').map((n) => n.id)).toEqual(['a']);
    expect(filterNotes(notes, '', 'criação').map((n) => n.id)).toEqual(['b']);
    expect(filterNotes(notes, '', 'GENESIS').map((n) => n.id)).toEqual(['b']);
    expect(filterNotes(notes, '', '  fé ').map((n) => n.id)).toEqual(['a']);
  });

  it('o caderno é exato e combina com a busca', () => {
    expect(filterNotes(notes, 'Pregações', '').map((n) => n.id)).toEqual(['b', 'd']);
    expect(filterNotes(notes, 'Pregações', 'pai').map((n) => n.id)).toEqual(['d']);
    expect(filterNotes(notes, 'Estudos', 'pai')).toEqual([]);
  });

  it('o texto dobrado fica em cache por objeto', () => {
    expect(noteHaystack(notes[0])).toBe('graca em romanos justificacao pela fe soteriologia');
    expect(noteHaystack(notes[0])).toBe(noteHaystack(notes[0]));
  });
});

describe('cadernos e prévia', () => {
  it('cadernos distintos na ordem de aparição, sem vazios', () => {
    expect(notebooksOf(notes)).toEqual(['Estudos', 'Pregações']);
  });

  it('linha "caderno · etiquetas" como no original', () => {
    expect(noteMeta(notes[0])).toBe('Estudos · soteriologia');
    expect(noteMeta(notes[2])).toBe(' · ');
  });

  it('prévia troca quebras de linha por espaço e limita o tamanho', () => {
    expect(notePreview('linha 1\nlinha 2\r\n\nlinha 3')).toBe('linha 1 linha 2 linha 3');
    const long = notePreview('palavra '.repeat(200), 40);
    expect(long.length).toBeLessThanOrEqual(41);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('anexos', () => {
  it('reconhece as extensões de imagem do original', () => {
    for (const name of ['a.png', 'B.JPG', 'c.jpeg', 'd.webp', 'e.gif']) expect(isImageFile(name)).toBe(true);
    for (const name of ['a.pdf', 'png', 'arquivo', 'foto.png.txt', '.png']) expect(isImageFile(name)).toBe(false);
    expect(fileExtension('C:\\pasta\\Foto.JPEG')).toBe('jpeg');
  });

  it('gera o Markdown com quebras de linha antes e depois', () => {
    expect(attachmentMarkdown('mapa.png', 'id-1')).toBe('\n![mapa.png](attachment:id-1)\n');
    expect(attachmentMarkdown('artigo.pdf', 'id-2')).toBe('\n[artigo.pdf](attachment:id-2)\n');
  });

  it('escapa colchetes do nome do arquivo', () => {
    expect(attachmentMarkdown('nota [v2].pdf', 'x')).toBe('\n[nota \\[v2\\].pdf](attachment:x)\n');
  });

  it('mensagens de erro legíveis', () => {
    expect(errorText(new RangeError('O anexo excede 20 MB.'))).toBe('O anexo excede 20 MB.');
    expect(errorText('falhou')).toBe('falhou');
  });
});
