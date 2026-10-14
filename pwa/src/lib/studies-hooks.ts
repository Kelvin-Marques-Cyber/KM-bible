// Ganchos de interface da área de estudos: lista virtual que rola junto com a
// folha, revelação progressiva de textos longos e rolagem ao topo.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Ancestral rolável mais próximo (normalmente a área de rolagem da folha). */
export function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
    node = node.parentElement;
  }
  return typeof document !== 'undefined' ? ((document.scrollingElement as HTMLElement | null) ?? null) : null;
}

/** Volta a área rolável que contém o elemento ao início (troca de capítulo/leitura). */
export function scrollToTop(element: HTMLElement | null): void {
  const parent = findScrollParent(element);
  if (!parent) return;
  if (typeof parent.scrollTo === 'function') parent.scrollTo({ top: 0 });
  else parent.scrollTop = 0;
}

/**
 * Virtualizador cuja lista fica dentro de uma área rolável externa (a folha):
 * o cabeçalho acima da lista rola junto. Coloque `anchor` no elemento que
 * recebe a altura total; itens usam translateY(item.start - margin).
 */
export function useSheetVirtualizer(options: { count: number; estimateSize: (index: number) => number; overscan?: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    setScroller(findScrollParent(anchor.current));
  }, []);

  useLayoutEffect(() => {
    const element = anchor.current;
    if (!scroller || !element) return;
    const isRoot = scroller === document.scrollingElement;
    const measure = () => {
      const top = element.getBoundingClientRect().top;
      const offset = isRoot ? top + window.scrollY : top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setMargin((previous) => (Math.abs(previous - offset) > 0.5 ? offset : previous));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // O conteúdo acima da lista pode mudar de altura (quebra de linha, seções).
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    let node: HTMLElement | null = element;
    while (node && node !== scroller) {
      let sibling = node.previousElementSibling;
      while (sibling) {
        observer.observe(sibling);
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
    }
    return () => observer.disconnect();
  }, [scroller]);

  const virtual = useVirtualizer({
    count: options.count,
    getScrollElement: () => scroller,
    estimateSize: options.estimateSize,
    overscan: options.overscan ?? 6,
    scrollMargin: margin,
    initialRect: { width: 360, height: 800 },
  });
  return { anchor, virtual, margin };
}

const idle = (callback: () => void): (() => void) => {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(callback, { timeout: 250 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(callback, 16);
  return () => clearTimeout(id);
};

/**
 * Quantos itens mostrar agora: começa com `first` e cresce `step` a cada pausa
 * do navegador até `total` (textos longos aparecem logo, sem travar a tela).
 * Para recomeçar com outro conteúdo, remonte o componente (prop `key`).
 */
export function useProgressiveCount(total: number, first = 4, step = 4): number {
  const [shown, setShown] = useState(() => Math.min(total, first));
  useEffect(() => {
    if (shown >= total) return;
    return idle(() => setShown((n) => Math.min(total, n + step)));
  }, [shown, total, step]);
  return Math.min(shown, total);
}
