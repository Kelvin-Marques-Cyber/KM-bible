// Peças de interface compartilhadas pelas telas de estudos, Agostinho e
// devocionais: Markdown longo em partes, fontes copiáveis, ligações externas,
// campo de busca, lista virtual dentro da folha e o índice de Agostinho sem o
// pacote integral. Ficam aqui (e não numa tela) para que nenhuma tela importe
// outra estaticamente.
import { BookOpenText, Copy, ExternalLink as ExternalIcon, Search } from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Markdown } from '../components/Markdown';
import { IconButton, ListItem, Small, copyText, cx, message } from '../components/ui';
import { t, tr } from './i18n';
import { useProgressiveCount, useSheetVirtualizer } from './studies-hooks';
import {
  AUGUSTINE_BOOKS,
  AUGUSTINE_EDITION_URL,
  AUGUSTINE_INDEX_CREDITS,
  sourceLabel,
  sourceTitle,
  sourceUrl,
  splitMarkdownSections,
  type Source,
} from './studies-logic';

function Sections({ sections, className }: { sections: string[]; className?: string }) {
  const shown = useProgressiveCount(sections.length, 3, 3);
  return (
    <>
      {sections.slice(0, shown).map((section, i) => (
        <div key={i} className={cx(i > 0 && 'mt-3', i > 2 && 'cv-auto')}>
          <Markdown text={section} className={className} />
        </div>
      ))}
      {shown < sections.length && (
        <p role="status" className="mt-3 text-sm text-muted">
          {t('loading')}
        </p>
      )}
    </>
  );
}

/**
 * Markdown longo (panoramas e dossiês com dezenas de milhares de caracteres):
 * dividido em seções por títulos, desenhadas aos poucos e com content-visibility.
 */
export function LongMarkdown({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const sections = useMemo(() => (text.length > 4000 ? splitMarkdownSections(text) : [text]), [text]);
  return (
    <div style={style}>
      <Sections key={`${text.length}:${text.slice(0, 48)}`} sections={sections} className={className} />
    </div>
  );
}

/** Ligação externa (nova aba), com aparência de botão de texto. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx(
        'inline-flex min-h-[40px] max-w-full items-center gap-2 rounded-full px-3 py-2 text-[15px] font-medium text-primary transition hover:bg-primary/10',
        className,
      )}
    >
      <ExternalIcon size={18} aria-hidden className="shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
      <span className="sr-only">{tr('(abre em nova aba)', '(opens in a new tab)', '(abre en una pestaña nueva)')}</span>
    </a>
  );
}

/** sourceLinks do original: cada fonte abre em nova aba (quando é endereço) ou é copiada. */
export function SourceList({ sources, className }: { sources: Source[]; className?: string }) {
  const items = sources.filter((s) => sourceLabel(s).trim());
  if (items.length === 0) return null;
  return (
    <section className={cx('mt-5', className)} aria-label={t('sources')}>
      <h4 className="text-[15px] font-semibold">{t('sources')}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((source, i) => {
          const url = sourceUrl(source);
          const title = sourceTitle(source);
          const copy = async () => {
            const ok = await copyText(sourceLabel(source));
            message(ok ? t('copy') : t('error'));
          };
          return (
            <li key={i} className="flex items-start gap-1">
              <span className="min-w-0 flex-1 py-2 text-[15px]">
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-1 underline-offset-2 [overflow-wrap:anywhere]">
                    {title}
                  </a>
                ) : (
                  <span className="select-text [overflow-wrap:anywhere]">{title}</span>
                )}
                {url && typeof source !== 'string' && title !== url && (
                  <span className="mt-0.5 block text-xs text-muted [overflow-wrap:anywhere]">{url}</span>
                )}
              </span>
              <IconButton label={`${t('copy')}: ${title}`} icon={Copy} size={18} onClick={() => void copy()} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Campo de busca com rótulo sempre visível e ícone (o filtro em si é aplicado com debounce por quem usa). */
export function SearchField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cx('mt-3 block', className)}>
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <span className="relative block">
        <Search size={19} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-10 pr-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </span>
    </label>
  );
}

/**
 * Lista virtual dentro da área rolável que a contém (folha ou painel): só as
 * linhas perto da tela existem no DOM, e o cabeçalho acima rola junto.
 */
export function VirtualRows<T>({
  rows,
  estimate,
  render,
  rowKey,
  className,
  label,
}: {
  rows: T[];
  estimate: (row: T, index: number) => number;
  render: (row: T, index: number) => ReactNode;
  rowKey: (row: T, index: number) => string;
  className?: string;
  label?: string;
}) {
  const { anchor, virtual, margin } = useSheetVirtualizer({ count: rows.length, estimateSize: (i) => estimate(rows[i], i), overscan: 8 });
  const items = virtual.getVirtualItems();
  return (
    <div ref={anchor} role="list" aria-label={label} className={cx('relative w-full', className)} style={{ height: virtual.getTotalSize() }}>
      {items.map((item) =>
        item.index < rows.length ? (
          <div
            key={rowKey(rows[item.index], item.index)}
            role="listitem"
            data-index={item.index}
            ref={virtual.measureElement}
            className="absolute left-0 right-0 top-0"
            style={{ transform: `translateY(${item.start - margin}px)` }}
          >
            {render(rows[item.index], item.index)}
          </div>
        ) : null,
      )}
    </div>
  );
}

export const editionLinkLabel = () =>
  tr('Consultar edição integral em português', 'View the full Portuguese edition', 'Consultar la edición íntegra en portugués');

/** Sem o pacote integral neste build: índice dos livros e a edição externa. */
export function AugustineUnavailable() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
      <p role="status" className="rounded-xl bg-secondary-container p-3 text-[15px]">
        {tr(
          'O texto integral das Confissões não está disponível nesta versão do aplicativo. Consulte abaixo o índice dos 13 livros e a edição integral em português na fonte.',
          'The full text of the Confessions is not available in this build. See the index of the 13 books below and the full Portuguese edition at the source.',
          'El texto íntegro de las Confesiones no está disponible en esta versión. Consulte abajo el índice de los 13 libros y la edición íntegra en portugués en la fuente.',
        )}
      </p>
      <ul className="mt-3">
        {AUGUSTINE_BOOKS.map((b) => (
          <li key={b.number}>
            <ListItem
              leading={BookOpenText}
              title={`${tr('Livro', 'Book', 'Libro')} ${b.number} · ${b.title}`}
              subtitle={`${b.chapterCount} ${tr('capítulos', 'chapters', 'capítulos')}`}
            />
          </li>
        ))}
      </ul>
      <ExternalLink href={AUGUSTINE_EDITION_URL} className="-ml-3 mt-2">
        {editionLinkLabel()}
      </ExternalLink>
      <Small className="mt-3 select-text">{AUGUSTINE_INDEX_CREDITS}</Small>
    </div>
  );
}
