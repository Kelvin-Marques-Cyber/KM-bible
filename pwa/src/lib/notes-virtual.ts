// Lista virtual que rola junto com o restante da página (cabeçalho, filtros e
// lista compartilham a mesma barra de rolagem), usada em Estudos e Memorização.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useRef, useState } from 'react';

/** Acima deste número de linhas a lista é virtualizada. */
export const VIRTUAL_THRESHOLD = 60;

/**
 * `scroller` vai no contêiner rolável da página; `anchor` no elemento que recebe
 * a altura total da lista. A distância entre os dois vira o scrollMargin.
 */
export function useAnchoredVirtualizer(options: { count: number; estimateSize: (index: number) => number; enabled: boolean; overscan?: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const { enabled } = options;

  useLayoutEffect(() => {
    const outer = scroller.current;
    const inner = anchor.current;
    if (!enabled || !outer || !inner) return;
    const measure = () => {
      const offset = inner.getBoundingClientRect().top - outer.getBoundingClientRect().top + outer.scrollTop;
      setMargin((previous) => (Math.abs(previous - offset) > 0.5 ? offset : previous));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    // Cabeçalhos podem mudar de altura (chips quebram linha, avisos aparecem).
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    let node: Element | null = inner;
    while (node && node !== outer) {
      for (const sibling of Array.from(node.parentElement?.children ?? [])) if (sibling !== node) observer.observe(sibling);
      node = node.parentElement;
    }
    return () => observer.disconnect();
  }, [enabled]);

  const virtual = useVirtualizer({
    count: enabled ? options.count : 0,
    getScrollElement: () => scroller.current,
    estimateSize: options.estimateSize,
    overscan: options.overscan ?? 6,
    scrollMargin: margin,
    initialRect: { width: 360, height: 800 },
  });
  return { scroller, anchor, virtual, margin };
}
