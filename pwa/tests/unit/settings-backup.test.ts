// Backup/restauração compatíveis com lib/backups.dart (APK, Flutter Web e PWA).
import { Blob as NodeBlob } from 'node:buffer';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_ALGORITHM,
  BACKUP_COLUMNS,
  BackupError,
  backupFileName,
  exportBackup,
  fromBase64,
  restoreBackup,
  safeNotebook,
  toBase64,
} from '../../src/lib/backup';
import { getAll, openDb, put, resetDbConnection } from '../../src/lib/db';
import {
  addCard,
  completed,
  highlight,
  loadPrefs,
  note,
  pref,
  recordReading,
  saveNote,
  savePlace,
  setPref,
  sha256Hex,
  type Attachment,
} from '../../src/lib/store';

// O Blob do jsdom não sobrevive à cópia estruturada do fake-indexeddb nem tem arrayBuffer():
// nos testes, o Blob do Node faz o papel do Blob do navegador.
const OriginalBlob = globalThis.Blob;
beforeAll(() => {
  (globalThis as { Blob: unknown }).Blob = NodeBlob;
});
afterAll(() => {
  (globalThis as { Blob: unknown }).Blob = OriginalBlob;
});

async function wipe() {
  const db = await openDb();
  db.close();
  resetDbConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('km-bible');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await openDb();
  await loadPrefs();
}

const bytesOfBlob = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

async function expectCode(promise: Promise<unknown>, code: string) {
  let caught: unknown = null;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BackupError);
  expect((caught as BackupError).code).toBe(code);
}

/** ZIP no formato do Dart a partir de data.json + arquivos extras, com manifesto correto. */
async function dartZip(data: unknown, extra: Record<string, Uint8Array> = {}, tweak?: (files: Record<string, string>) => void) {
  const files: Record<string, Uint8Array> = { ...extra, 'data.json': strToU8(JSON.stringify(data)) };
  const hashes: Record<string, string> = {};
  for (const [name, content] of Object.entries(files)) hashes[name] = await sha256Hex(content);
  tweak?.(hashes);
  files['manifest.json'] = strToU8(JSON.stringify({ format: 1, application: 'BibliaReformadaBackup', files: hashes }));
  return new Blob([zipSync(files) as BlobPart]);
}

async function seed() {
  await setPref('theme', 'dark');
  await setPref('font_size', 30);
  await setPref('red', false);
  await setPref('disabled_modules', ['KJV']);
  const noteId = await saveNote({ title: 'Graça', body: 'Veja [[João 3:16]] e [[note:outra]].', notebook: 'Estudos Bíblicos', tags: 'graça' });
  await highlight('ARA', ['43:3:16', '43:3:17'], 2);
  await savePlace('bookmarks', '43:3:16', 'ARA', 'João 3:16');
  await savePlace('study_tabs', '45:8:1', 'ARA', 'Romanos 8:1');
  await recordReading('ARA', { book: 43, chapter: 3, verse: 16 });
  await addCard('ARA', { book: 43, chapter: 3, verse: 16 }, 'Porque Deus amou o mundo');
  await completed('arena:abc:1', true);
  const content = new TextEncoder().encode('conteúdo do anexo');
  await put('attachments', {
    id: 'anexo-1',
    note_id: noteId,
    filename: 'nota.txt',
    path: 'attachments/anexo-1.txt',
    sha256: await sha256Hex(content),
    mime: 'text/plain',
    blob: new Blob([content], { type: 'text/plain' }),
  } satisfies Attachment);
  return noteId;
}

beforeEach(async () => {
  await wipe();
});

describe('exportação', () => {
  it('gera o ZIP no formato do aplicativo original', async () => {
    const noteId = await seed();
    const blob = await exportBackup();
    const files = unzipSync(await bytesOfBlob(blob));
    const names = Object.keys(files).sort();
    expect(names).toContain(`notes/Estudos_Bíblicos/${noteId}.md`);
    expect(names).toContain('attachments/anexo-1.txt');
    expect(names).toContain('data.json');
    expect(names).toContain('manifest.json');
    expect(strFromU8(files[`notes/Estudos_Bíblicos/${noteId}.md`])).toBe('# Graça\n\nVeja [[João 3:16]] e [[note:outra]].\n');

    const manifest = JSON.parse(strFromU8(files['manifest.json']));
    expect(manifest.format).toBe(1);
    expect(manifest.application).toBe('BibliaReformadaBackup');
    for (const name of names.filter((n) => n !== 'manifest.json')) expect(manifest.files[name]).toBe(await sha256Hex(files[name]));

    const data = JSON.parse(strFromU8(files['data.json']));
    expect(Object.keys(data).sort()).toEqual(Object.keys(BACKUP_COLUMNS).sort());
    // Preferências: valor é o TEXTO JSON, como jsonEncode do Dart.
    const prefs = Object.fromEntries((data.preferences as { key: string; value: string }[]).map((p) => [p.key, p.value]));
    expect(prefs.theme).toBe('"dark"');
    expect(prefs.font_size).toBe('30');
    expect(prefs.red).toBe('false');
    expect(prefs.disabled_modules).toBe('["KJV"]');
    // Colunas exatamente iguais às do personal.sqlite (o restore do Dart exige o mesmo conjunto).
    for (const [table, rows] of Object.entries(data) as [keyof typeof BACKUP_COLUMNS, Record<string, unknown>[]][]) {
      for (const row of rows) expect(Object.keys(row).sort()).toEqual([...BACKUP_COLUMNS[table]].sort());
    }
    expect(data.highlights).toHaveLength(2);
    expect(data.highlights[0]).not.toHaveProperty('book');
    expect(data.attachments[0]).not.toHaveProperty('blob');
    expect(data.reading_history[0].id).toBeTypeOf('number');
    expect(data.note_links.length).toBeGreaterThan(0);
  });

  it('nome do arquivo com a data local', () => {
    const date = new Date(2026, 0, 5);
    expect(backupFileName(false, date)).toBe('Biblia-Estudos-2026-01-05.zip');
    expect(backupFileName(true, date)).toBe('Biblia-Estudos-2026-01-05.bibliaenc');
  });

  it('caderno seguro como safe() do Dart', () => {
    expect(safeNotebook('Estudos Bíblicos/2024')).toBe('Estudos_Bíblicos_2024');
    expect(safeNotebook('')).toBe('_');
    expect(safeNotebook('a'.repeat(90))).toHaveLength(70);
  });

  it('base64 em pedaços igual ao btoa', () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 31) % 256);
    const encoded = toBase64(bytes);
    expect(encoded).toBe(Buffer.from(bytes).toString('base64'));
    expect([...fromBase64(encoded)]).toEqual([...bytes]);
  });

  it('senha curta é recusada', async () => {
    await expectCode(exportBackup('curta'), 'shortPassword');
  });
});

describe('restauração', () => {
  it('ida e volta sem senha', async () => {
    const noteId = await seed();
    const blob = await exportBackup();
    await wipe();
    expect(pref('theme', 'sepia')).toBe('sepia');

    const count = await restoreBackup(blob);
    expect(count).toBe(1);
    expect(pref('theme', 'sepia')).toBe('dark');
    expect(pref('font_size', 23)).toBe(30);
    expect(pref('red', true)).toBe(false);
    expect(pref<string[]>('disabled_modules', [])).toEqual(['KJV']);
    expect((await note(noteId))?.title).toBe('Graça');
    const highlights = await getAll<{ reference: string; book: number; color: number }>('highlights');
    expect(highlights.map((h) => h.book)).toEqual([43, 43]);
    expect(highlights[0].color).toBe(2);
    expect(await getAll('bookmarks')).toHaveLength(1);
    expect(await getAll('study_tabs')).toHaveLength(1);
    expect(await getAll('reading_history')).toHaveLength(1);
    expect(await getAll('flashcards')).toHaveLength(1);
    expect(await getAll('learning_progress')).toHaveLength(1);
    const links = await getAll<{ source_id: string; target_id: string; kind: string }>('note_links');
    expect(links).toEqual(
      expect.arrayContaining([
        { source_id: noteId, target_id: '43:3:16', kind: 'biblical' },
        { source_id: noteId, target_id: 'outra', kind: 'personal' },
      ]),
    );
    const [attachment] = await getAll<Attachment>('attachments');
    expect(attachment.path).toBe('attachments/anexo-1.txt');
    expect(new TextDecoder().decode(await bytesOfBlob(attachment.blob!))).toBe('conteúdo do anexo');
  });

  it('ida e volta criptografada (AES-256-GCM + PBKDF2)', async () => {
    const noteId = await seed();
    const blob = await exportBackup('senha-segura');
    const bytes = await bytesOfBlob(blob);
    expect(bytes[0]).toBe(123); // "{"
    const envelope = JSON.parse(new TextDecoder().decode(bytes));
    expect(envelope.encrypted).toBe(1);
    expect(envelope.algorithm).toBe(BACKUP_ALGORITHM);
    expect(fromBase64(envelope.salt)).toHaveLength(16);
    expect(fromBase64(envelope.nonce)).toHaveLength(12);
    expect(fromBase64(envelope.mac)).toHaveLength(16);
    expect(Object.keys(envelope).sort()).toEqual(['algorithm', 'ciphertext', 'encrypted', 'mac', 'nonce', 'salt']);

    // Conferência independente do formato: PBKDF2-SHA256 210 000 + AES-GCM com AAD.
    const subtle = globalThis.crypto.subtle;
    const material = await subtle.importKey('raw', new TextEncoder().encode('senha-segura'), 'PBKDF2', false, ['deriveKey']);
    const key = await subtle.deriveKey(
      { name: 'PBKDF2', salt: fromBase64(envelope.salt) as BufferSource, iterations: 210000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const cipher = fromBase64(envelope.ciphertext);
    const mac = fromBase64(envelope.mac);
    const sealed = new Uint8Array(cipher.length + 16);
    sealed.set(cipher);
    sealed.set(mac, cipher.length);
    const zip = new Uint8Array(
      await subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.nonce) as BufferSource, additionalData: new TextEncoder().encode('BibliaReformadaBackup:1') }, key, sealed as BufferSource),
    );
    expect(Object.keys(unzipSync(zip))).toContain('manifest.json');

    await wipe();
    await expectCode(restoreBackup(blob), 'passwordRequired');
    await expectCode(restoreBackup(blob, 'senha-errada'), 'wrongPassword');
    expect(await restoreBackup(blob, 'senha-segura')).toBe(1);
    expect((await note(noteId))?.body).toContain('João 3:16');
  }, 30_000);

  it('detecta adulteração', async () => {
    await seed();
    // Texto cifrado alterado: a etiqueta GCM não confere.
    const encrypted = JSON.parse(new TextDecoder().decode(await bytesOfBlob(await exportBackup('senha-segura'))));
    const cipher = fromBase64(encrypted.ciphertext);
    cipher[10] ^= 0xff;
    const tampered = new Blob([JSON.stringify({ ...encrypted, ciphertext: toBase64(cipher) })]);
    await expectCode(restoreBackup(tampered, 'senha-segura'), 'wrongPassword');

    // data.json alterado sem atualizar o manifesto.
    const files = unzipSync(await bytesOfBlob(await exportBackup()));
    const data = JSON.parse(strFromU8(files['data.json']));
    data.notes[0].title = 'Alterado';
    files['data.json'] = strToU8(JSON.stringify(data));
    await expectCode(restoreBackup(new Blob([zipSync(files) as BlobPart])), 'integrity');

    // Arquivo fora do manifesto.
    const extra = unzipSync(await bytesOfBlob(await exportBackup()));
    extra['notes/intruso.md'] = strToU8('x');
    await expectCode(restoreBackup(new Blob([zipSync(extra) as BlobPart])), 'unexpectedFile');

    // Anexo com bytes trocados (manifesto refeito, mas sha256 da linha não confere).
    const swapped = unzipSync(await bytesOfBlob(await exportBackup()));
    const swappedData = JSON.parse(strFromU8(swapped['data.json']));
    await expectCode(dartZip(swappedData, { 'attachments/anexo-1.txt': strToU8('outro conteúdo') }).then((b) => restoreBackup(b)), 'attachmentIntegrity');
  }, 30_000);

  it('aplica as validações do restore do Dart', async () => {
    const valid = { notes: [{ id: 'n1', title: 't', body: 'b', reference: '', notebook: 'Estudos', tags: '', updated_at: 1 }] };
    await expectCode(dartZip({ ...valid, segredos: [] }).then((b) => restoreBackup(b)), 'unknownTable');
    await expectCode(dartZip({ notes: {} }).then((b) => restoreBackup(b)), 'invalidTable');
    await expectCode(dartZip({ notes: [{ ...valid.notes[0], extra: 1 }] }).then((b) => restoreBackup(b)), 'invalidRow');
    await expectCode(dartZip({ notes: [{ id: 'n1', title: 't' }] }).then((b) => restoreBackup(b)), 'invalidRow');
    await expectCode(dartZip({ notes: [{ ...valid.notes[0], tags: true }] }).then((b) => restoreBackup(b)), 'invalidRow');
    await expectCode(dartZip({ notes: [{ ...valid.notes[0], id: '../x' }] }).then((b) => restoreBackup(b)), 'invalidId');
    await expectCode(
      dartZip({ attachments: [{ id: 'a1', note_id: 'n1', filename: 'f.png', path: '/x/a1.png', sha256: 'abc' }] }).then((b) => restoreBackup(b)),
      'missingAttachment',
    );
    await expectCode(dartZip(valid, {}, (h) => (h['data.json'] = '0'.repeat(64))).then((b) => restoreBackup(b)), 'integrity');
    await expectCode(restoreBackup(new Blob([strToU8('isto não é zip')])), 'invalidZip');
    // Caminho inseguro dentro do ZIP.
    const unsafe = zipSync({ '../fora.txt': strToU8('x'), 'data.json': strToU8('{}') });
    await expectCode(restoreBackup(new Blob([unsafe as BlobPart])), 'unsafe');
    // Manifesto de outro aplicativo.
    const foreign = zipSync({ 'data.json': strToU8('{}'), 'manifest.json': strToU8(JSON.stringify({ format: 2, application: 'Outro', files: {} })) });
    await expectCode(restoreBackup(new Blob([foreign as BlobPart])), 'unsupported');
    await expectCode(restoreBackup(new Blob([zipSync({ 'data.json': strToU8('{}') }) as BlobPart])), 'incomplete');
  });

  it('restaura um backup montado à mão no formato do APK (Dart)', async () => {
    // Nota já existente e MAIS NOVA que a do backup: não pode ser sobrescrita.
    await put('notes', { id: 'n-nova', title: 'Minha versão', body: 'local', reference: '', notebook: 'Estudos', tags: '', updated_at: 9_000_000_000_000 });
    const attachment = strToU8('PNG-bytes');
    const data = {
      preferences: [
        { key: 'theme', value: '"midnight"' },
        { key: 'font_size', value: '27.0' },
        { key: 'line_height', value: '1.8' },
        { key: 'study', value: 'true' },
        { key: 'translation', value: '"ARA"' },
        { key: 'quebrada', value: 'não-json' },
      ],
      notes: [
        { id: 'n1', title: 'Fé', body: 'Ligada a [[Romanos 8:1]] e [[note:n2]]', reference: '45:8:1', notebook: 'Sermões', tags: 'fé', updated_at: 1_700_000_000_000 },
        { id: 'n2', title: 'Esperança', body: 'Sem links', reference: '', notebook: 'Estudos', tags: '', updated_at: 1_700_000_000_001 },
        { id: 'n-nova', title: 'Versão antiga', body: 'velha', reference: '', notebook: 'Estudos', tags: '', updated_at: 1_600_000_000_000 },
      ],
      note_links: [{ source_id: 'n1', target_id: 'lixo', kind: 'personal' }],
      highlights: [{ reference: '45:8:1', translation: 'ARA', color: 3 }],
      bookmarks: [{ id: 'b1', reference: '19:23:1', translation: 'ARA', title: 'Salmo 23' }],
      study_tabs: [{ id: 't1', reference: '1:1:1', translation: 'BLN4', title: 'Gênesis 1' }],
      reading_history: [
        { id: 1, reference: '1:1:1', translation: 'ARA', created_at: 1_700_000_000_000 },
        { id: 2, reference: '43:1:1', translation: 'ARA', created_at: 1_700_000_100_000 },
      ],
      attachments: [{ id: 'a1', note_id: 'n1', filename: 'mapa.png', path: '/data/user/0/app/attachments/a1.png', sha256: await sha256Hex(attachment) }],
      flashcards: [
        { id: 'c1', reference: '43:3:16', translation: 'ARA', text: 'Porque Deus amou', topic: '', mode: 'reference_to_text', repetitions: 2, interval: 6, ease: 2.6, due: 1_700_000_000_000 },
      ],
      review_history: [{ id: 'r1', card_id: 'c1', grade: 4, reviewed_at: 1_700_000_000_000 }],
      learning_progress: [{ id: 'arena:s1:2', completed: 1, updated_at: 1_700_000_000_000 }],
    };
    const blob = await dartZip(data, {
      'notes/Sermões/n1.md': strToU8('# Fé\n\nLigada a [[Romanos 8:1]] e [[note:n2]]\n'),
      'notes/Estudos/n2.md': strToU8('# Esperança\n\nSem links\n'),
      'notes/Estudos/n-nova.md': strToU8('# Versão antiga\n\nvelha\n'),
      'attachments/a1.png': attachment,
    });

    const count = await restoreBackup(blob);
    expect(count).toBe(2); // n1 e n2; n-nova local é mais nova
    expect((await note('n-nova'))?.title).toBe('Minha versão');
    expect((await note('n1'))?.notebook).toBe('Sermões');
    expect(pref('theme', 'sepia')).toBe('midnight');
    expect(pref('font_size', 23)).toBe(27);
    expect(pref('line_height', 1.6)).toBe(1.8);
    expect(pref('study', false)).toBe(true);
    expect(pref('quebrada', '')).toBe('não-json');
    expect(localStorage.getItem('km-pref:theme')).toBe('"midnight"');

    const links = await getAll<{ source_id: string; target_id: string; kind: string }>('note_links');
    expect(links.find((l) => l.target_id === 'lixo')).toBeUndefined();
    expect(links).toEqual(
      expect.arrayContaining([
        { source_id: 'n1', target_id: '45:8:1', kind: 'biblical' },
        { source_id: 'n1', target_id: 'n2', kind: 'personal' },
      ]),
    );
    const [highlightRow] = await getAll<{ reference: string; translation: string; color: number; book: number }>('highlights');
    expect(highlightRow).toEqual({ reference: '45:8:1', translation: 'ARA', color: 3, book: 45 });
    const history = await getAll<{ id: number; reference: string }>('reading_history');
    expect(history.map((h) => h.id)).toEqual([1, 2]);
    const [card] = await getAll<{ ease: number; repetitions: number }>('flashcards');
    expect(card.ease).toBe(2.6);
    expect(card.repetitions).toBe(2);
    const [stored] = await getAll<Attachment>('attachments');
    expect(stored.path).toBe('attachments/a1.png');
    expect(stored.mime).toBe('image/png');
    expect(strFromU8(await bytesOfBlob(stored.blob!))).toBe('PNG-bytes');

    // Reexportar o que veio do Dart mantém o formato aceito pelo Dart.
    const again = unzipSync(await bytesOfBlob(await exportBackup()));
    const reData = JSON.parse(strFromU8(again['data.json']));
    expect(reData.preferences.find((p: { key: string }) => p.key === 'font_size').value).toBe('27');
    expect(again['attachments/a1.png']).toBeDefined();
    expect(again['notes/Sermões/n1.md']).toBeDefined();
  });

  it('conflito de anexo com o mesmo id e conteúdo diferente', async () => {
    const local = strToU8('local');
    await put('attachments', { id: 'a1', note_id: 'n1', filename: 'x.txt', path: 'attachments/a1.txt', sha256: await sha256Hex(local), blob: new Blob([local]) });
    const remote = strToU8('remoto');
    const blob = await dartZip(
      { attachments: [{ id: 'a1', note_id: 'n1', filename: 'x.txt', path: 'x', sha256: await sha256Hex(remote) }] },
      { 'attachments/a1.txt': remote },
    );
    await expectCode(restoreBackup(blob), 'attachmentConflict');
  });
});
