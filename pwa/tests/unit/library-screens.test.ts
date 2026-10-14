// Teste de fumaça da Biblioteca: lista de módulos, importação de .biblepkg com
// aceite de licença, página do módulo (remover/restaurar) e conteúdo offline
// ("Baixar tudo" com Cache API em memória). Dados reais de public/data/v1.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync } from 'fflate';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/lib/app';
import { installed, loadUserModules, module, userModule } from '../../src/lib/content';
import { buildInstallPlan, deleteModuleData, parsePackage, writeInstallPlan } from '../../src/lib/library-packages-core';
import { DATA_CACHE, FULL_FLAG, resetOfflineState } from '../../src/lib/offline';
import { removeModule } from '../../src/lib/packages';
import { pref, setPref } from '../../src/lib/store';
import LibraryPage, { ModulePage, OfflinePage } from '../../src/screens/Library';

const dataDir = `${resolve(process.cwd(), 'public/data/v1')}/`;

class MemoryCache {
  entries = new Map<string, Response>();
  async match(input: RequestInfo | URL) {
    return this.entries.get(new URL(String(input instanceof Request ? input.url : input)).href)?.clone();
  }
  async put(input: RequestInfo | URL, response: Response) {
    const body = await response.arrayBuffer();
    this.entries.set(new URL(String(input instanceof Request ? input.url : input)).href, new Response(body, { status: 200 }));
  }
  async keys() {
    return [...this.entries.keys()].map((u) => new Request(u));
  }
  async delete(input: RequestInfo | URL) {
    return this.entries.delete(new URL(String(input instanceof Request ? input.url : input)).href);
  }
}
let cache = new MemoryCache();

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const path = decodeURIComponent(url.pathname.replace(/^.*\/data\/v1\//, ''));
    // Arquivos de dados grandes não são lidos: só o índice, documentos e licenças.
    if (path === 'files.json' || path.startsWith('docs/') || path.startsWith('licenses/')) {
      try {
        return new Response(await readFile(dataDir + path, 'utf8'), { status: 200 });
      } catch {
        return new Response('', { status: 404 });
      }
    }
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('caches', { open: async (name: string) => (name === DATA_CACHE ? cache : new MemoryCache()) });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  app.translation = 'BLN4';
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function render(element: ReactElement): HTMLElement {
  host = document.createElement('div');
  host.style.height = '800px';
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

async function until(check: () => boolean, timeout = 8000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Botões: ${buttons().map((b) => b.textContent).join("|")} Conteúdo: ${document.body.textContent?.slice(0, 800)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

const buttons = (scope: ParentNode = document.body) => [...scope.querySelectorAll('button')];
const button = (text: string, scope: ParentNode = document.body) => buttons(scope).find((b) => b.textContent?.includes(text));
const click = (element: Element | null | undefined) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};

function packageFile(name = 'teste.biblepkg'): File {
  const verses = new TextEncoder().encode(JSON.stringify([{ reference: '43:3:16', text: 'Porque Deus amou o mundo.' }]));
  const manifest = {
    format_version: 1,
    id: 'TESTE-UI',
    kind: 'bible',
    title: 'Bíblia Importada de Teste',
    version: '1.0.0',
    language: 'pt-BR',
    author: 'Autor',
    license: 'CC BY 4.0',
    license_text: 'Pode usar livremente.',
    source: 'https://example.org',
    dependencies: [],
    files: { 'verses.json': createHash('sha256').update(verses).digest('hex') },
  };
  const zip = zipSync({ 'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)), 'verses.json': verses });
  return new File([zip as BlobPart], name, { type: 'application/zip' });
}

function choose(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('LibraryPage', () => {
  afterAll(async () => {
    await deleteModuleData('TESTE-UI');
    await loadUserModules();
  });

  it('mostra ARA, filtros e módulos; filtra por tipo', async () => {
    const view = render(createElement(LibraryPage));
    expect(view.textContent).toContain('Almeida Revista e Atualizada (ARA)');
    expect(button('Ler Bíblia ARA', view)).toBeTruthy();
    expect(button('Importar módulo (.biblepkg)', view)).toBeTruthy();
    expect(view.textContent).toContain('Conteúdo offline');
    expect(view.textContent).toContain(module('BLN4')!.title);
    click(button('Comentários', view));
    expect(view.textContent).not.toContain(module('BLN4')!.title);
    expect(view.textContent).toContain(module('Barnes')!.title);
    click(button('Modelos 3D', view));
    expect(view.textContent).toContain(module('APP-3D')!.title);
  });

  it('recusa PDF com a mensagem do original', async () => {
    const view = render(createElement(LibraryPage));
    choose(view.querySelector('input[type=file]')!, new File(['%PDF'], 'ARA.pdf', { type: 'application/pdf' }));
    expect(view.textContent).toContain('PDF não pode ser importado diretamente. A ARA já está instalada');
  });

  it('importa um pacote: licença exige a declaração de direitos antes de instalar', async () => {
    const view = render(createElement(LibraryPage));
    choose(view.querySelector('input[type=file]')!, packageFile());
    await until(() => !!document.body.querySelector('[role=dialog]'));
    const dialog = document.body.querySelector('[role=dialog]')!;
    expect(dialog.textContent).toContain('Bíblia Importada de Teste');
    expect(dialog.textContent).toContain('Autor · pt-BR · 1.0.0');
    expect(dialog.textContent).toContain('Pode usar livremente.');
    const install = buttons(dialog).find((b) => b.textContent === 'Importar módulo')!;
    expect(install.disabled).toBe(true);
    click(dialog.querySelector('input[type=checkbox]'));
    expect(install.disabled).toBe(false);
    click(install);
    await until(() => view.textContent!.includes('Concluído · Bíblia Importada de Teste'));
    expect(document.body.querySelector('[role=dialog]')).toBeNull();
    expect(installed('TESTE-UI')).toBe(true);
    expect(view.textContent).toContain('Bíblia Importada de Teste');
  });

  it('pacote inválido mostra o erro e o cancelamento não instala', async () => {
    const view = render(createElement(LibraryPage));
    choose(view.querySelector('input[type=file]')!, new File(['lixo'], 'ruim.biblepkg'));
    await until(() => view.textContent!.includes('Não foi possível concluir:'));
    expect(view.textContent).toContain('.biblepkg válido');
  });
});

describe('ModulePage', () => {
  it('confissão: lista os textos do módulo e abre licença sob demanda', async () => {
    const view = render(createElement(ModulePage, { moduleId: 'WCF' }));
    await until(() => view.textContent!.includes('Conteúdo disponível · 33 textos'));
    expect(view.querySelectorAll('ul li').length).toBe(33);
    expect(view.textContent).toContain(`${module('WCF')!.author} · ${module('WCF')!.language}`);
    const details = view.querySelector('details')!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(details.textContent).toContain(`versão ${module('WCF')!.version}`);
  });

  it('devocional com centenas de textos usa lista virtual', async () => {
    const view = render(createElement(ModulePage, { moduleId: 'EXP-SPURGEON-DIARIO' }));
    await until(() => view.textContent!.includes('Conteúdo disponível · 366 textos'));
    expect(view.querySelectorAll('ul li').length).toBeLessThan(366);
  });

  it('Bíblia: resumo de livros/versículos e botão Ler; guia de fontes mostra o aviso', async () => {
    const view = render(createElement(ModulePage, { moduleId: 'BLN4' }));
    expect(view.textContent).toMatch(/66 livros · 1\.189 capítulos · [\d.]+ versículos/);
    expect(button('Ler', view)).toBeTruthy();
    act(() => root?.unmount());
    host?.remove();
    const guide = render(createElement(ModulePage, { moduleId: 'HDL-GUIA-FONTES' }));
    expect(guide.textContent).toContain('Este é um guia de fontes e leitura, não uma edição integral dos comentários do autor.');
    expect(guide.textContent).toMatch(/8 comentários/);
  });

  it('remove e restaura um módulo embutido', async () => {
    const view = render(createElement(ModulePage, { moduleId: 'Barnes' }));
    click(button('Remover módulo', view));
    await until(() => pref<string[]>('disabled_modules', []).includes('Barnes'));
    expect(installed('Barnes')).toBe(false);
    await until(() => button('Restaurar', view)?.disabled === false);
    click(button('Restaurar', view));
    await until(() => !pref<string[]>('disabled_modules', []).includes('Barnes'));
    expect(installed('Barnes')).toBe(true);
  }, 20_000);

  it('mantém ao menos uma Bíblia instalada e troca a tradução atual removida', async () => {
    const bibles = ['ARA', 'ASV', 'porblt2022eb', 'BLTR', 'Darby', 'FreBDM1744', 'SpaRV', 'TR', 'Webster', 'OSHB', 'YLT'];
    await setPref('disabled_modules', bibles);
    await expect(removeModule('BLN4')).rejects.toThrow('Mantenha ao menos uma Bíblia instalada.');
    await setPref('disabled_modules', []);

    app.translation = 'ASV';
    const view = render(createElement(ModulePage, { moduleId: 'ASV' }));
    click(button('Remover módulo', view));
    await until(() => app.translation !== 'ASV');
    expect(installed(app.translation)).toBe(true);
    await setPref('disabled_modules', []);
  });

  it('módulo importado: desativa, ativa e apaga os dados com confirmação', async () => {
    const records = new TextEncoder().encode(
      JSON.stringify([
        { id: 'b', title: 'Segundo estudo', body: 'Texto 2' },
        { id: 'a', title: 'Primeiro estudo', body: 'Texto 1' },
      ]),
    );
    const manifest = {
      format_version: 1,
      id: 'TESTE-ESTUDO',
      kind: 'study',
      title: 'Estudos Importados',
      version: '2.0.0',
      language: 'pt-BR',
      author: 'Autora',
      license: 'CC BY-SA 4.0',
      license_text: 'Licença do estudo.',
      source: 'https://example.org/estudos',
      dependencies: [],
      files: { 'data.json': createHash('sha256').update(records).digest('hex') },
    };
    const zip = zipSync({ 'manifest.json': new TextEncoder().encode(JSON.stringify(manifest)), 'data.json': records });
    await writeInstallPlan(await buildInstallPlan(await parsePackage(zip)));
    await loadUserModules();
    try {
      const view = render(createElement(ModulePage, { moduleId: 'TESTE-ESTUDO' }));
      await until(() => view.textContent!.includes('Conteúdo disponível · 2 textos'));
      expect(view.textContent).toContain('Autora · pt-BR');
      expect(view.textContent).toContain('Primeiro estudo');

      click(button('Remover módulo', view));
      await until(() => userModule('TESTE-ESTUDO')?.enabled === false && !!button('Ativar módulo', view));
      expect(installed('TESTE-ESTUDO')).toBe(false);

      click(button('Ativar módulo', view));
      await until(() => userModule('TESTE-ESTUDO')?.enabled === true && !!button('Remover módulo', view));

      click(button('Apagar dados do módulo', view));
      const confirm = view.querySelector('[role=alertdialog]')!;
      expect(confirm.textContent).toContain('Estudos Importados');
      click(button('Cancelar', confirm));
      expect(view.querySelector('[role=alertdialog]')).toBeNull();
      expect(userModule('TESTE-ESTUDO')).toBeTruthy();

      click(button('Apagar dados do módulo', view));
      click(buttons(view.querySelector('[role=alertdialog]')!).find((b) => b.textContent === 'Apagar'));
      await until(() => userModule('TESTE-ESTUDO') === undefined);
    } finally {
      await deleteModuleData('TESTE-ESTUDO');
      await loadUserModules();
    }
  });
});

describe('OfflinePage', () => {
  beforeEach(() => {
    cache = new MemoryCache();
    resetOfflineState();
    localStorage.removeItem(FULL_FLAG);
  });

  it('lista os grupos e baixa tudo ao abrir com autoStart="all"', async () => {
    const view = render(createElement(OfflinePage, { autoStart: 'all' }));
    expect(view.textContent).toContain('Usar 100% sem internet');
    await until(() => view.textContent!.includes('Tudo pronto: o aplicativo funciona sem internet'), 20_000);
    expect(localStorage.getItem(FULL_FLAG)).toBe('1');
    expect(view.textContent).toContain('Referências cruzadas');
    expect(view.textContent).toContain('Modelos 3D');
    expect(view.textContent).toContain('Baixado');
    expect(cache.entries.size).toBeGreaterThan(1000);
  }, 30_000);

  it('mostra o botão "Baixar tudo" e remove um grupo', async () => {
    const view = render(createElement(OfflinePage));
    await until(() => !!button('Baixar tudo para usar sem internet', view) && view.textContent!.includes('Não baixado'));
    expect(button('Baixar o essencial', view)).toBeTruthy();
    click(button('Baixar o essencial', view));
    await until(() => view.textContent!.includes('Essencial disponível sem internet'), 20_000);
    const remove = buttons(view).find((b) => b.getAttribute('aria-label')?.endsWith('Referências cruzadas'));
    click(remove);
    await until(() => !buttons(view).some((b) => b.getAttribute('aria-label')?.startsWith('Remover do aparelho: Referências cruzadas')));
    expect(view.textContent).toContain('Armazenamento');
  }, 30_000);

  it('no iPhone fora da Tela de Início, orienta a instalar antes, mas permite baixar', async () => {
    const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    );
    try {
      const view = render(createElement(OfflinePage));
      expect(view.textContent).toContain('Adicionar à Tela de Início');
      expect(view.textContent).toContain('O Safari pode apagar os dados');
      // Habilitado assim que a lista de arquivos carrega (no iPhone o download continua permitido).
      await until(() => button('Baixar tudo para usar sem internet', view)?.disabled === false);
    } finally {
      agent.mockRestore();
    }
  });
});
