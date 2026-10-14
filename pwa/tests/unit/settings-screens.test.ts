// Teste de fumaça das telas de Configurações, primeira abertura, avisos da PWA e recuperação.
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openSheet, sheets } from '../../src/lib/app';
import { clear } from '../../src/lib/db';
import { loadPrefs, pref } from '../../src/lib/store';
import SettingsPage from '../../src/screens/Settings';
import Onboarding, { DedicationPage } from '../../src/screens/Onboarding';
import { InstallButton, InstallHelp, UpdateBanner } from '../../src/screens/PwaBanners';
import { Recovery } from '../../src/screens/Recovery';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(async () => {
  await clear('prefs');
  await loadPrefs();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  sheets.length = 0;
});

function render(element: ReactElement): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

async function until(check: () => boolean, timeout = 3000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Tempo esgotado. Conteúdo: ${host?.textContent?.slice(0, 600)}`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
}

const byText = (selector: string, text: string) =>
  [...host!.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text || el.getAttribute('aria-label') === text) as HTMLElement | undefined;
const click = (element: Element | undefined) => {
  if (!element) throw new Error('Elemento não encontrado');
  act(() => (element as HTMLElement).click());
};

describe('Configurações', () => {
  it('mostra aparência, alterna opções e seções da PWA', async () => {
    render(createElement(SettingsPage));
    expect(host!.textContent).toContain('Lâmpada para os meus pés é a tua palavra.');
    for (const title of ['Atualizações', 'Instalar aplicativo', 'Armazenamento e offline', 'Migração da versão anterior', 'Backup e restauração']) {
      expect(byText('h3', title)).toBeDefined();
    }
    expect(host!.textContent).toContain('Criado por Kelvin e Silva Marques');
    expect(host!.querySelector('a[href="./classico.html"]')).not.toBeNull();
    expect(host!.querySelector('a[href="https://github.com/Kelvin-Marques-Cyber/KM-bible"]')).not.toBeNull();
    // 14 temas
    expect(host!.querySelectorAll('fieldset button[aria-pressed]')).toHaveLength(14);

    // Alternância (Números dos versículos, padrão ligado).
    const numbers = [...host!.querySelectorAll('label')].find((l) => l.textContent?.includes('Números dos versículos'))!.querySelector('input')!;
    expect(numbers.checked).toBe(true);
    click(numbers);
    expect(pref('numbers', true)).toBe(false);

    // Tema
    click(byText('fieldset button', 'Meia-noite(escuro)'));
    expect(pref('theme', 'sepia')).toBe('midnight');

    // Controle de tamanho: pré-visualização imediata, gravação limitada.
    const range = host!.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(range, '30');
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const sample = [...host!.querySelectorAll('p')].find((p) => p.textContent === 'Lâmpada para os meus pés é a tua palavra.')!;
    expect(sample.style.fontSize).toBe('30px');
    await until(() => pref<number>('font_size', 23) === 30);

    // Migração: nada encontrado neste navegador de teste.
    await until(() => host!.textContent!.includes('Nenhum dado da versão anterior'));
  });
});

describe('Primeira abertura', () => {
  it('dedicatória e depois a configuração inicial', async () => {
    render(createElement(Onboarding));
    expect(host!.textContent).toContain('Em presente dedicatória à Rebeca Teles');
    click(byText('button', 'Continuar'));
    expect(pref('dedication_seen', false)).toBe(true);
    await until(() => host!.textContent!.includes('A Bíblia no centro. Sua leitura e seus estudos, no seu dispositivo.'));
    expect(byText('button', 'Restaurar backup')).toBeDefined();
    click(byText('button', 'Começar a ler'));
    expect(pref('onboarding_done', false)).toBe(true);
  });

  it('Enter continua; fora da primeira abertura apenas fecha a folha', () => {
    render(createElement(Onboarding));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });
    expect(pref('dedication_seen', false)).toBe(true);
    act(() => root!.unmount());
    root = null;

    act(() => openSheet('Dedicatória', () => null));
    expect(sheets).toHaveLength(1);
    render(createElement(DedicationPage));
    click(byText('button', 'Continuar'));
    expect(sheets).toHaveLength(0);
  });
});

describe('Avisos da PWA e recuperação', () => {
  it('sem atualização pendente o aviso fica oculto; ajuda de instalação completa', () => {
    render(createElement('div', null, createElement(UpdateBanner), createElement(InstallButton)));
    expect(host!.querySelector('section')).toBeNull();
    expect(host!.querySelector('button')).toBeNull(); // computador sem oferta de instalação
    act(() => root!.unmount());
    root = null;
    render(createElement(InstallHelp));
    expect(host!.textContent).toContain('Vantagens do aplicativo instalado');
    expect(host!.textContent).toContain('Adicionar à Tela de Início');
    expect(host!.textContent).toContain('Baixar tudo para usar sem internet');
    expect(host!.textContent).toContain('Firefox');
  });

  it('recuperação explica que os dados estão seguros e continua', () => {
    const onContinue = vi.fn();
    render(createElement(Recovery, { onContinue }));
    expect(host!.textContent).toContain('Seus dados estão seguros');
    expect(byText('button', 'Limpar cache do aplicativo (mantém anotações)')).toBeDefined();
    expect(host!.querySelector('a[href="./classico.html"]')).not.toBeNull();
    click(byText('button', 'Continuar mesmo assim'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
