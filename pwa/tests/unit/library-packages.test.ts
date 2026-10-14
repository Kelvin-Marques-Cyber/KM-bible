// Validação e instalação de pacotes .biblepkg (port de ContentPackage.parse/install
// e validateGlb de lib/packages.dart). Os pacotes são montados com fflate no teste.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { bibleBook, commentaries, loadUserModules, moduleDocuments, userModule } from '../../src/lib/content';
import { get, getAll } from '../../src/lib/db';
import { ref } from '../../src/lib/domain';
import {
  MAX_PACKAGE_BYTES,
  PackageError,
  buildInstallPlan,
  compareVersions,
  deleteModuleData,
  isSafePath,
  packageErrorText,
  parsePackage,
  sha256,
  sha256Fallback,
  validateGlb,
  writeInstallPlan,
} from '../../src/lib/library-packages-core';
import { errorFromWorker, isPdfFile, matchesKind, missingDependencies, preparePackageFile } from '../../src/lib/packages';

const hex = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const bytes = (value: unknown) => (value instanceof Uint8Array ? value : new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)));

const baseManifest = {
  format_version: 1,
  id: 'TESTE',
  kind: 'bible',
  title: 'Bíblia de Teste',
  version: '1.0.0',
  language: 'pt-BR',
  author: 'Autor',
  license: 'CC BY 4.0',
  license_text: 'Texto da licença.',
  source: 'https://example.org',
  dependencies: [] as string[],
  min_app_version: '0.5.0',
};

interface BuildOptions {
  /** Hashes a usar no manifesto (padrão: corretos para todos os arquivos). */
  hashes?: Record<string, string> | null;
  /** Arquivos que entram no ZIP, mas não no mapa de hashes. */
  unlisted?: Record<string, unknown>;
  noManifest?: boolean;
}

function build(manifest: Record<string, unknown>, files: Record<string, unknown>, options: BuildOptions = {}): Uint8Array {
  const encoded: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(files)) encoded[name] = bytes(value);
  const hashes = options.hashes === undefined ? Object.fromEntries(Object.entries(encoded).map(([n, b]) => [n, hex(b)])) : options.hashes;
  const zip: Record<string, Uint8Array> = { ...encoded };
  for (const [name, value] of Object.entries(options.unlisted ?? {})) zip[name] = bytes(value);
  if (!options.noManifest) zip['manifest.json'] = bytes(hashes === null ? manifest : { ...manifest, files: hashes });
  return zipSync(zip);
}

const bible = (records: unknown[], manifest: Record<string, unknown> = {}) => build({ ...baseManifest, ...manifest }, { 'verses.json': records });
const data = (kind: string, records: unknown[], manifest: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  build({ ...baseManifest, id: `T-${kind}`, kind, ...manifest }, { 'data.json': records, ...extra });

async function rejects(input: Uint8Array, code: string) {
  await expect(parsePackage(input)).rejects.toMatchObject({ name: 'PackageError', code });
}

/** GLB mínimo: cabeçalho + bloco JSON. */
function glb(json: unknown, tweak: { magic?: number; version?: number; length?: number; chunkSize?: number } = {}): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (text.length % 4)) % 4;
  const size = text.length + pad;
  const total = 12 + 8 + size;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, tweak.magic ?? 0x46546c67, true);
  view.setUint32(4, tweak.version ?? 2, true);
  view.setUint32(8, tweak.length ?? total, true);
  view.setUint32(12, tweak.chunkSize ?? size, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(text, 20);
  out.fill(0x20, 20 + text.length);
  return out;
}
const asset = { asset: { version: '2.0' } };

const verses = [
  { reference: '1:1:1', text: 'No princípio criou Deus os céus e a terra.', metadata: { heading: 'A criação', paragraph: true, red_ranges: [] } },
  { reference: '1:1:2', text: 'A terra era sem forma e vazia.' },
  { reference: '1:2:1', text: 'Assim foram acabados os céus.', metadata: { notes: ['nota'] } },
  { reference: '43:3:16', text: 'Porque Deus amou o mundo de tal maneira.', metadata: { red_ranges: [[0, 6]] } },
];

describe('caminhos e versões', () => {
  it('aceita só caminhos seguros (como o original)', () => {
    expect(isSafePath('verses.json')).toBe(true);
    expect(isSafePath('models/arca.glb')).toBe(true);
    for (const bad of ['/etc/passwd', 'a\\b.json', '../x.json', 'a/../b', 'a//b', 'dir/', 'c:x', '']) expect(isSafePath(bad)).toBe(false);
  });

  it('compara versões semânticas', () => {
    expect(compareVersions([0, 5, 4], [0, 5, 4])).toBe(0);
    expect(compareVersions([0, 5, 5], [0, 5, 4])).toBe(1);
    expect(compareVersions([0, 4, 9], [0, 5, 4])).toBe(-1);
    expect(compareVersions([1, 0, 0], [0, 5, 4])).toBe(1);
  });
});

describe('SHA-256', () => {
  it('a implementação de reserva confere com o Node em vários tamanhos', async () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 4097]) {
      const input = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 255);
      expect(sha256Fallback(input)).toBe(hex(input));
      expect(await sha256(input)).toBe(hex(input));
    }
    // Subvisões (byteOffset diferente de zero).
    const big = new Uint8Array(300).map((_, i) => i & 255);
    expect(sha256Fallback(big.subarray(17, 250))).toBe(hex(big.subarray(17, 250)));
  });
});

describe('ContentPackage.parse', () => {
  it('aceita uma Bíblia válida', async () => {
    const pkg = await parsePackage(bible(verses));
    expect(pkg.manifest.id).toBe('TESTE');
    expect(pkg.records).toHaveLength(4);
    expect(pkg.expanded).toBeGreaterThan(0);
  });

  it('recusa pacotes acima de 80 MB antes de descompactar', async () => {
    await rejects(new Uint8Array(MAX_PACKAGE_BYTES + 1), 'too_large');
    const huge = { size: MAX_PACKAGE_BYTES + 1, arrayBuffer: () => Promise.reject(new Error('não deveria ler')) } as unknown as Blob;
    await expect(preparePackageFile(huge, undefined, { worker: false })).rejects.toMatchObject({ code: 'too_large' });
  });

  it('recusa ZIP corrompido', async () => {
    await rejects(new TextEncoder().encode('não é um zip'), 'invalid_zip');
  });

  it('recusa caminhos inseguros', async () => {
    for (const name of ['../fora.json', '/abs.json', 'a\\b.json', 'c:x.json', 'a//b.json']) {
      await rejects(build(baseManifest, { 'verses.json': verses }, { unlisted: { [name]: 'x' } }), 'unsafe_path');
    }
  });

  it('exige manifest.json, formato, tipo e identificador válidos', async () => {
    await rejects(build(baseManifest, { 'verses.json': verses }, { noManifest: true }), 'missing_manifest');
    await rejects(bible(verses, { format_version: 2 }), 'unsupported');
    await rejects(bible(verses, { kind: 'video' }), 'unsupported');
    await rejects(bible(verses, { id: '-comeca-com-hifen' }), 'unsupported');
    await rejects(bible(verses, { id: 'tem espaço' }), 'unsupported');
    await rejects(bible(verses, { id: 'x'.repeat(81) }), 'unsupported');
    await expect(parsePackage(bible(verses, { id: `A${'x'.repeat(79)}` }))).resolves.toBeTruthy();
    await rejects(build(baseManifest, { 'verses.json': verses }, { unlisted: { 'manifest.json': '{inválido' }, noManifest: true }), 'invalid_json');
  });

  it('exige os campos obrigatórios como texto não vazio', async () => {
    for (const key of ['title', 'version', 'language', 'author', 'license', 'license_text', 'source']) {
      await expect(parsePackage(bible(verses, { [key]: '   ' }))).rejects.toMatchObject({ code: 'missing_field', detail: key });
      await expect(parsePackage(bible(verses, { [key]: 3 }))).rejects.toMatchObject({ code: 'missing_field' });
    }
  });

  it('valida dependências e versão mínima do aplicativo (≤ 0.5.4)', async () => {
    await rejects(bible(verses, { dependencies: 'BLN4' }), 'invalid_dependencies');
    await rejects(bible(verses, { dependencies: [1] }), 'invalid_dependencies');
    await rejects(bible(verses, { min_app_version: '0.5' }), 'invalid_min_version');
    await rejects(bible(verses, { min_app_version: 5 }), 'invalid_min_version');
    await rejects(bible(verses, { min_app_version: '0.5.5' }), 'newer_app');
    await rejects(bible(verses, { min_app_version: '1.0.0' }), 'newer_app');
    await expect(parsePackage(bible(verses, { min_app_version: '0.5.4' }))).resolves.toBeTruthy();
    await expect(parsePackage(bible(verses, { min_app_version: null }))).resolves.toBeTruthy();
  });

  it('confere o SHA-256 de cada arquivo e recusa arquivos não listados', async () => {
    await rejects(build(baseManifest, { 'verses.json': verses }, { hashes: null }), 'missing_hashes');
    await rejects(build(baseManifest, { 'verses.json': verses }, { hashes: { 'verses.json': '0'.repeat(64) } }), 'integrity');
    await rejects(build(baseManifest, { 'verses.json': verses }, { hashes: { 'verses.json': hex(bytes(verses)), 'falta.json': '0'.repeat(64) } }), 'integrity');
    await rejects(build(baseManifest, { 'verses.json': verses }, { unlisted: { 'extra.txt': 'oi' } }), 'unexpected_file');
  });

  it('exige verses.json (Bíblia) ou data.json (demais) com até 500 000 registros', async () => {
    await rejects(build(baseManifest, { 'data.json': verses }), 'missing_records');
    await rejects(build({ ...baseManifest, kind: 'study' }, { 'verses.json': verses }), 'missing_records');
    await rejects(bible({} as unknown as unknown[]), 'invalid_records');
    await rejects(bible(['texto']), 'invalid_records');
    await rejects(bible(new Array(500_001).fill(0)), 'invalid_records');
  });

  it('valida versículos, títulos e intervalos de palavras de Jesus', async () => {
    await rejects(bible([{ reference: '1:1', text: 'x' }]), 'invalid_verse');
    await rejects(bible([{ reference: '67:1:1', text: 'x' }]), 'invalid_verse');
    await rejects(bible([{ reference: '1:1:1', text: '' }]), 'invalid_verse');
    await rejects(bible([{ reference: '1:1:1', text: 'a' }, { reference: '1:1:1', text: 'b' }]), 'invalid_verse');
    await rejects(bible([{ reference: '1:1:1', text: 'abc', metadata: [] }]), 'invalid_metadata');
    await rejects(bible([{ reference: '1:1:1', text: 'abc', metadata: { heading: 3 } }]), 'invalid_heading');
    for (const range of [[0, 4], [2, 2], [3, 1], [-1, 2], [0, 1.5], [0], 'x']) {
      await rejects(bible([{ reference: '1:1:1', text: 'abc', metadata: { red_ranges: [range] } }]), 'invalid_red_range');
    }
    await rejects(bible([{ reference: '1:1:1', text: 'abc', metadata: { red_ranges: 'x' } }]), 'invalid_red_range');
    await expect(parsePackage(bible([{ reference: '1:1:1', text: 'abc', metadata: { red_ranges: [[0, 3]], heading: null } }]))).resolves.toBeTruthy();
  });

  it('valida comentários, documentos, léxicos, atlas e identificadores', async () => {
    await rejects(data('commentary', [{ id: 'a', reference: '1:1:1', body: 'x' }, { id: 'a', reference: '1:1:2', body: 'y' }]), 'invalid_record_id');
    await rejects(data('commentary', [{ reference: '1:1:1', body: 'x' }]), 'invalid_record_id');
    await rejects(data('commentary', [{ id: 'a', reference: '1:2:1', end_reference: '1:1:1', body: 'x' }]), 'invalid_commentary');
    await rejects(data('commentary', [{ id: 'a', reference: '1:1:1' }]), 'invalid_commentary');
    await rejects(data('commentary', [{ id: 'a', reference: 'Gn 1:1', body: 'x' }]), 'invalid_commentary');
    for (const kind of ['dictionary', 'confession', 'study']) {
      await rejects(data(kind, [{ id: 'a', title: 'T' }]), 'invalid_document');
      await rejects(data(kind, [{ id: 'a', body: 'B' }]), 'invalid_document');
      await expect(parsePackage(data(kind, [{ id: 'a', title: 'T', body: 'B' }]))).resolves.toBeTruthy();
    }
    await rejects(data('lexicon', [{ id: 'G1', lemma: 'α' }]), 'invalid_lexeme');
    await expect(parsePackage(data('lexicon', [{ id: 'G1', lemma: 'α', gloss: 'alfa' }]))).resolves.toBeTruthy();
    await rejects(data('atlas', [{ id: 'p', places: [{ lat: 91, lon: 0 }] }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', places: [{ lat: 0, lon: -181 }] }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', places: [{ lat: '31', lon: 35 }] }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', events: [{ start: 0 }] }]), 'invalid_date');
    await rejects(data('atlas', [{ id: 'p', events: [{ start: -1000, end: 10.5 }] }]), 'invalid_date');
    await expect(parsePackage(data('atlas', [{ id: 'p', places: [{ lat: 31.7, lon: 35.2 }], events: [{ start: -1000, end: -960 }] }]))).resolves.toBeTruthy();
  });
});

describe('atlas e modelos: campos que o aplicativo percorre', () => {
  it('locations (lidas pelo atlas) passam pela mesma conferência de coordenadas que places', async () => {
    await rejects(data('atlas', [{ id: 'p', locations: [{ id: 'jer', lat: 95, lon: 35 }] }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', locations: [{ id: 'jer', ancient: 'Jerusalém' }] }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', locations: 'Jerusalém' }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', metadata: { locations: [{ lat: 0, lon: 200 }] } }]), 'invalid_coordinates');
    await rejects(data('atlas', [{ id: 'p', metadata: { events: [{ start: 0 }] } }]), 'invalid_date');
    await rejects(data('atlas', [{ id: 'p', events: [{ start: -30, references: '43:3:16' }] }]), 'invalid_metadata');
    const ok = await parsePackage(
      data('atlas', [{ id: 'p', title: 'Atlas', locations: [{ id: 'jer', lat: 31.78, lon: 35.22 }], events: [{ id: 'e', start: -30, references: ['43:3:16'] }] }]),
    );
    const plan = await buildInstallPlan(ok);
    const docs = plan.rows.find((r) => r.key === 'docs')!.value as unknown[][];
    expect((docs[0][5] as { locations: unknown[] }).locations).toHaveLength(1);
  });

  it('modelos: referências e camadas, quando presentes, precisam ser listas', async () => {
    const model = (row: Record<string, unknown>) => data('model', [{ id: 'arca', title: 'Arca', file: 'arca.glb', ...row }], {}, { 'arca.glb': glb(asset) });
    await rejects(model({ references: '6:25:10' }), 'invalid_metadata');
    await rejects(model({ metadata: { layers: 'Estrutura' } }), 'invalid_metadata');
    await expect(parsePackage(model({ references: ['2:25:10'], layers: ['Estrutura', 'Querubins'] }))).resolves.toBeTruthy();
  });
});

describe('validateGlb', () => {
  it('aceita glTF 2.0 binário sem recursos externos', () => {
    expect(() => validateGlb(glb(asset))).not.toThrow();
    expect(() => validateGlb(glb({ ...asset, buffers: [{ byteLength: 4 }], extensionsRequired: [] }))).not.toThrow();
  });

  it('recusa cabeçalhos, blocos e documentos inválidos', () => {
    const code = (fn: () => void) => {
      try {
        fn();
      } catch (error) {
        return (error as PackageError).code;
      }
      return null;
    };
    expect(code(() => validateGlb(new Uint8Array(10)))).toBe('invalid_glb_size');
    expect(code(() => validateGlb(new Uint8Array(20 * 1024 * 1024 + 1)))).toBe('invalid_glb_size');
    expect(code(() => validateGlb(glb(asset, { magic: 0x12345678 })))).toBe('invalid_glb_header');
    expect(code(() => validateGlb(glb(asset, { version: 1 })))).toBe('invalid_glb_header');
    expect(code(() => validateGlb(glb(asset, { length: 999 })))).toBe('invalid_glb_header');
    expect(code(() => validateGlb(glb(asset, { chunkSize: 10_000 })))).toBe('invalid_glb_length');
    const truncated = glb(asset);
    const longer = new Uint8Array(truncated.length + 4);
    longer.set(truncated);
    new DataView(longer.buffer).setUint32(8, longer.length, true);
    expect(code(() => validateGlb(longer))).toBe('invalid_glb_chunk');
    expect(code(() => validateGlb(glb({ asset: { version: '1.0' } })))).toBe('unsupported_gltf');
    expect(code(() => validateGlb(glb({ nodes: [] })))).toBe('unsupported_gltf');
    expect(code(() => validateGlb(glb({ ...asset, extensionsRequired: ['KHR_draco_mesh_compression'] })))).toBe('unsupported_gltf');
    expect(code(() => validateGlb(glb({ ...asset, buffers: [{ uri: 'externo.bin', byteLength: 4 }] })))).toBe('external_glb');
    expect(code(() => validateGlb(glb({ ...asset, images: [{ uri: 'https://example.org/x.png' }] })))).toBe('external_glb');
  });

  it('modelos exigem o arquivo GLB listado no pacote', async () => {
    await rejects(data('model', [{ id: 'arca', title: 'Arca', file: 'arca.glb' }]), 'missing_glb');
    await rejects(data('model', [{ id: 'arca', title: 'Arca', file: 'arca.glb' }], {}, { 'arca.glb': glb({ asset: { version: '1.0' } }) }), 'unsupported_gltf');
    await expect(parsePackage(data('model', [{ id: 'arca', title: 'Arca', file: 'arca.glb' }], {}, { 'arca.glb': glb(asset) }))).resolves.toBeTruthy();
  });
});

describe('preparação da instalação (ContentPackage.install)', () => {
  it('Bíblia: livros por chave b:<livro>, metadados compactos e índice de versículos', async () => {
    const plan = await buildInstallPlan(
      await parsePackage(
        bible([...verses].reverse(), {
          mappings: [{ source_reference: '43:3:16', target_translation: 'BLN4', target_reference: '43:3:16' }],
          metadata: { versification: 'KJV' },
        }),
      ),
      1234,
    );
    expect(plan.record).toMatchObject({ id: 'TESTE', enabled: true, installedAt: 1234, records: 4 });
    expect(plan.record.manifest).not.toHaveProperty('files');
    expect(plan.record.manifest.license_text).toBe('Texto da licença.');
    expect(plan.record.books).toEqual({ '1': [2, 1], '43': [0, 0, 16] });
    expect(plan.record.mappings).toEqual([{ source_reference: '43:3:16', target_translation: 'BLN4', target_reference: '43:3:16', kind: 'editorial' }]);
    const genesis = plan.rows.find((r) => r.key === 'b:1')!.value as { b: number; c: unknown[][] };
    expect(genesis.b).toBe(1);
    expect(genesis.c[0]).toEqual([
      [1, 'No princípio criou Deus os céus e a terra.', { h: 'A criação', p: 1 }],
      [2, 'A terra era sem forma e vazia.'],
    ]);
    expect(genesis.c[1]).toEqual([[1, 'Assim foram acabados os céus.', { n: ['nota'] }]]);
    const john = plan.rows.find((r) => r.key === 'b:43')!.value as { c: unknown[][] };
    expect(john.c[2]).toEqual([[16, 'Porque Deus amou o mundo de tal maneira.', { r: [[0, 6]] }]]);
    await expect(buildInstallPlan(await parsePackage(bible(verses, { mappings: [{ source_reference: 'x' }] })))).rejects.toMatchObject({ code: 'invalid_mapping' });
  });

  it('comentário: linhas por livro, intervalo entre livros, padrões do original', async () => {
    const plan = await buildInstallPlan(
      await parsePackage(
        data('commentary', [
          { id: 'c1', reference: '1:1:1', end_reference: '1:1:5', body: 'Corpo', title: 'Título', commentary_kind: 'devotional', bibliography: 'Livro X' },
          { id: 'c2', reference: '1:50:26', end_reference: '2:1:3', body: 'Ponte' },
        ]),
      ),
    );
    expect(plan.record.commentaryBooks).toEqual([1, 2]);
    const genesis = plan.rows.find((r) => r.key === 'c:1')!.value as unknown[][];
    expect(genesis[0]).toEqual(['T-commentary:c1', 1_001_001, 1_001_005, 'Título', 'Corpo', 'devotional', 'Livro X']);
    expect(genesis[1]).toEqual(['T-commentary:c2', 1_050_026, 2_001_003, 'Gênesis 50:26', 'Ponte', 'exegesis', 'Bíblia de Teste']);
    const exodus = plan.rows.find((r) => r.key === 'c:2')!.value as unknown[][];
    expect(exodus).toHaveLength(1);
    expect(exodus[0][0]).toBe('T-commentary:c2');
  });

  it('documentos, atlas e modelos: chave "docs"; modelo guarda o GLB como Blob', async () => {
    const study = await buildInstallPlan(await parsePackage(data('study', [{ id: 's1', title: 'Estudo', body: 'Texto', reference: '43:3:16', metadata: { level: 2 } }])));
    expect(study.rows).toEqual([{ module: 'T-study', key: 'docs', value: [['T-study:s1', 'study', 'Estudo', 'Texto', '43:3:16', { level: 2 }]] }]);

    const atlas = await buildInstallPlan(await parsePackage(data('atlas', [{ id: 'a1', title: 'Mapa', body: 'B', places: [{ lat: 1, lon: 2 }], metadata: { x: 1 } }])));
    const doc = (atlas.rows[0].value as unknown[][])[0];
    expect(doc[5]).toMatchObject({ x: 1, id: 'a1', places: [{ lat: 1, lon: 2 }] });

    const model = glb(asset);
    const plan = await buildInstallPlan(await parsePackage(data('model', [{ id: 'arca', title: 'Arca', file: 'arca.glb' }], { title: 'Modelos' }, { 'arca.glb': model })));
    const docs = plan.rows.find((r) => r.key === 'docs')!.value as unknown[][];
    const key = `glb:${hex(model)}`;
    expect(docs[0].slice(0, 5)).toEqual(['T-model:arca', 'model', 'Arca', '', '']);
    expect(docs[0][5]).toMatchObject({ id: 'arca', file: 'arca.glb', local_key: key });
    const blob = plan.rows.find((r) => r.key === key)!.value as Blob;
    expect(blob.size).toBe(model.length);

    await expect(buildInstallPlan(await parsePackage(data('study', [{ id: 's', title: 'T', body: 'B', metadata: [1] }])))).rejects.toMatchObject({ code: 'invalid_metadata' });
  });

  it('léxico: valida ocorrências e guarda os registros em "lexicon"', async () => {
    const rows = [{ id: 'G1', lemma: 'α', gloss: 'alfa', occurrences: [{ reference: '66:1:8', surface: 'Ἄλφα', position: 1 }] }];
    const plan = await buildInstallPlan(await parsePackage(data('lexicon', rows)));
    expect(plan.rows).toEqual([{ module: 'T-lexicon', key: 'lexicon', value: rows }]);
    await expect(buildInstallPlan(await parsePackage(data('lexicon', [{ id: 'G1', lemma: 'α', gloss: 'a', occurrences: [{ reference: '66:1:8', surface: 'x' }] }])))).rejects.toMatchObject({
      code: 'invalid_occurrence',
    });
  });
});

describe('gravação atômica no IndexedDB', () => {
  beforeEach(async () => {
    for (const id of ['TESTE', 'T-commentary', 'T-study']) await deleteModuleData(id);
    await loadUserModules();
  });

  it('instala, substitui os dados anteriores e apaga tudo', async () => {
    await writeInstallPlan(await buildInstallPlan(await parsePackage(bible(verses))));
    await loadUserModules();
    expect(userModule('TESTE')?.books?.['43']).toEqual([0, 0, 16]);
    const book = await bibleBook('TESTE', 43);
    expect(book?.c[2][0][1]).toBe('Porque Deus amou o mundo de tal maneira.');

    // Reinstalação do mesmo id: os livros antigos somem.
    await writeInstallPlan(await buildInstallPlan(await parsePackage(bible([{ reference: '19:23:1', text: 'O Senhor é o meu pastor.' }], { version: '2.0.0' }))));
    await loadUserModules();
    expect(userModule('TESTE')?.manifest.version).toBe('2.0.0');
    expect(await get('user_module_data', ['TESTE', 'b:43'])).toBeUndefined();
    expect(await bibleBook('TESTE', 19)).toMatchObject({ b: 19 });

    await deleteModuleData('TESTE');
    await loadUserModules();
    expect(userModule('TESTE')).toBeUndefined();
    const left = (await getAll<{ module: string }>('user_module_data')).filter((r) => r.module === 'TESTE');
    expect(left).toHaveLength(0);
  });

  it('comentários e documentos importados aparecem nas consultas de content.ts', async () => {
    await writeInstallPlan(await buildInstallPlan(await parsePackage(data('commentary', [{ id: 'c1', reference: '43:3:16', end_reference: '43:3:18', body: 'Amor de Deus' }]))));
    await writeInstallPlan(await buildInstallPlan(await parsePackage(data('study', [{ id: 's1', title: 'Estudo', body: 'Texto' }]))));
    await loadUserModules();
    const found = await commentaries(ref(43, 3, 17), { moduleId: 'T-commentary' });
    expect(found.map((c) => c.body)).toEqual(['Amor de Deus']);
    expect((await moduleDocuments('T-study')).map((d) => d.id)).toEqual(['T-study:s1']);
  });

  it('importação completa pela via direta (sem worker), com dependências conferidas', async () => {
    const blob = new Blob([bible(verses, { dependencies: ['NAO-EXISTE'] }) as BlobPart]);
    const stages: string[] = [];
    const prepared = await preparePackageFile(blob, (s) => stages.push(s), { worker: false });
    expect(prepared.manifest.id).toBe('TESTE');
    expect(prepared.records).toBe(4);
    await expect(prepared.install()).rejects.toMatchObject({ code: 'missing_dependency', detail: 'NAO-EXISTE' });

    const ok = await preparePackageFile(new Blob([bible(verses, { dependencies: ['BLN4'] }) as BlobPart]), (s) => stages.push(s), { worker: false });
    await ok.install((s) => stages.push(s));
    expect(userModule('TESTE')?.enabled).toBe(true);
    expect(stages).toEqual(expect.arrayContaining(['read', 'unzip', 'verify', 'validate', 'prepare', 'write']));
  });

  it('worker que não inicia (construtor recusa módulos, como no Safari 14) cai para a thread principal', async () => {
    const original = (globalThis as { Worker?: unknown }).Worker;
    let constructed = 0;
    (globalThis as { Worker?: unknown }).Worker = class {
      constructor() {
        constructed++;
        throw new TypeError('Module scripts are not supported');
      }
    };
    try {
      const prepared = await preparePackageFile(new Blob([bible(verses, { id: 'TESTE-SEM-WORKER' }) as BlobPart]), undefined, { worker: true });
      expect(constructed).toBe(1);
      expect(prepared.manifest.id).toBe('TESTE-SEM-WORKER');
      await prepared.install();
      expect(userModule('TESTE-SEM-WORKER')?.enabled).toBe(true);
    } finally {
      (globalThis as { Worker?: unknown }).Worker = original;
      await deleteModuleData('TESTE-SEM-WORKER');
      await loadUserModules();
    }
  });
});

describe('utilidades da biblioteca', () => {
  it('mensagens nos três idiomas e reconstrução de erros vindos do worker', () => {
    const error = new PackageError('integrity', 'verses.json');
    expect(error.message).toBe('Falha de integridade (SHA-256): verses.json.');
    expect(packageErrorText(error, 'en')).toBe('Integrity failure: verses.json.');
    expect(packageErrorText(error, 'es')).toBe('Fallo de integridad (SHA-256): verses.json.');
    const rebuilt = errorFromWorker({ code: 'newer_app', message: 'x' });
    expect(rebuilt).toBeInstanceOf(PackageError);
    expect(errorFromWorker({ code: 'whatever', message: 'falhou' }).message).toBe('falhou');
  });

  it('dependências ausentes, PDF e filtros', () => {
    expect(missingDependencies({ dependencies: ['A', 'B', 3] }, (id) => id === 'A')).toEqual(['B']);
    expect(missingDependencies({}, () => false)).toEqual([]);
    expect(isPdfFile({ name: 'ARA.PDF' })).toBe(true);
    expect(isPdfFile({ name: 'x.bin', type: 'application/pdf' })).toBe(true);
    expect(isPdfFile({ name: 'ARA.biblepkg' })).toBe(false);
    expect(matchesKind({ kind: 'model_collection' }, 'model')).toBe(true);
    expect(matchesKind({ kind: 'bible' }, 'commentary')).toBe(false);
    expect(matchesKind({ kind: 'bible' }, '')).toBe(true);
  });
});

// Pacotes reais do repositório (quando presentes): o validador precisa aceitá-los.
const bundled = resolve(process.cwd(), '../assets/bundled');
// KM_ALL_PACKAGES=1 confere todos os pacotes do repositório (inclusive os grandes).
const real = (
  process.env.KM_ALL_PACKAGES && existsSync(bundled)
    ? readdirSync(bundled).filter((name) => name.endsWith('.biblepkg'))
    : ['PTBR-Guia-Hernandes-Fontes-PTBR.biblepkg', 'PTBR-Panoramas-66-Livros-PTBR.biblepkg', 'PTBR-Cafe-da-Manha-366-PTBR.biblepkg', 'porblt2022eb.biblepkg']
).filter((name) => existsSync(join(bundled, name)));
describe.skipIf(real.length === 0)('pacotes reais', () => {
  it.each(real)('%s é aceito e preparado', async (name) => {
    const pkg = await parsePackage(new Uint8Array(readFileSync(join(bundled, name))));
    const plan = await buildInstallPlan(pkg);
    expect(plan.rows.length).toBeGreaterThan(0);
    expect(plan.record.manifest.id).toBe(pkg.manifest.id);
  }, 120_000);
});
