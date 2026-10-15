import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsync } from '../../src/components/ui';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function Probe({ request, version }: {
  request: () => Promise<string>;
  version: number;
}) {
  const state = useAsync(request, [version]);
  return createElement('output', null, state.error ? 'erro' : state.loading ? 'carregando' : state.data);
}

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('useAsync: encerramento seguro de telas assíncronas', () => {
  it('ignora resultados obsoletos após mudança de parâmetros', async () => {
    const old = deferred<string>(), current = deferred<string>();
    await act(async () => root.render(createElement(Probe, {
      version: 1, request: () => old.promise,
    })));
    await act(async () => root.render(createElement(Probe, {
      version: 2, request: () => current.promise,
    })));
    await act(async () => old.resolve('resultado antigo'));
    expect(host.textContent).toBe('carregando');
    await act(async () => current.resolve('resultado novo'));
    expect(host.textContent).toBe('resultado novo');
  });

  it('descarta resoluções e rejeições recebidas após desmontagem', async () => {
    const operation = deferred<string>();
    await act(async () => root.render(createElement(Probe, {
      version: 1, request: () => operation.promise,
    })));
    act(() => root.unmount());
    root = createRoot(host);
    await act(async () => operation.resolve('tarde demais'));

    const errorOperation = deferred<string>();
    await act(async () => root.render(createElement(Probe, {
      version: 2, request: () => errorOperation.promise,
    })));
    act(() => root.unmount());
    root = createRoot(host);
    await act(async () => errorOperation.reject(new Error('falha após sair')));
    expect(host.textContent).toBe('');
  });

  it('trata também exceções síncronas do carregador', async () => {
    await act(async () => root.render(createElement(Probe, {
      version: 1,
      request: () => { throw new Error('falha inicial'); },
    })));
    expect(host.textContent).toBe('erro');
  });
});
