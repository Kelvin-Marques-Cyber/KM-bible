// Ganchos de interface da área "estudo conectado": lista virtual que rola junto
// com a folha (o cabeçalho e o texto compartilham a mesma barra de rolagem) e
// carregamento adiado até a seção se aproximar da tela.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Ancestral rolável mais próximo (a área de rolagem da folha, normalmente). */
export function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  let node = element.parentElement;
  while (node) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return node;
    node = node.parentElement;
  }
  return (typeof document !== 'undefined' ? (document.scrollingElement as HTMLElement | null) : null) ?? null;
}

/**
 * Virtualizador ancorado num elemento dentro de um contêiner rolável externo.
 * `anchor` deve ser colocado no elemento que recebe a altura total da lista.
 */
export function useParentVirtualizer(options: {
  count: number;
  estimateSize: (index: number) => number;
  getItemKey?: (index: number) => number | string;
  overscan?: number;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    if (!scroller) setScroller(findScrollParent(anchor.current));
  });

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
    // O conteúdo acima da lista pode crescer (seções expansíveis, imagens).
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [scroller]);

  const virtual = useVirtualizer({
    count: options.count,
    getScrollElement: () => scroller,
    estimateSize: options.estimateSize,
    ...(options.getItemKey ? { getItemKey: options.getItemKey } : {}),
    overscan: options.overscan ?? 4,
    scrollMargin: margin,
    initialRect: { width: 360, height: 800 },
  });
  return { anchor, virtual, margin };
}

function viewportRoot(element: HTMLElement): HTMLElement | null {
  const parent = findScrollParent(element);
  return parent && parent !== document.scrollingElement ? parent : null;
}

/** true quando o elemento está perto da área visível (ou quando não há IntersectionObserver). */
export function useNearViewport<T extends HTMLElement>(rootMargin = '600px'): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      const id = setTimeout(() => setNear(true), 300);
      return () => clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { root: viewportRoot(element), rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, rootMargin]);
  return [ref, near];
}
