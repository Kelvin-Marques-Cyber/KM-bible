// Peças de interface compartilhadas pelas telas de estudos, Agostinho e
// devocionais: Markdown longo em partes, fontes copiáveis e ligações externas.
import { Copy, ExternalLink as ExternalIcon } from 'lucide-react';
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Markdown } from '../components/Markdown';
import { IconButton, copyText, cx, message } from '../components/ui';
import { t } from './i18n';
import { useProgressiveCount } from './studies-hooks';
import { sourceLabel, sourceTitle, sourceUrl, splitMarkdownSections, type Source } from './studies-logic';

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
        'inline-flex min-h-[40px] items-center gap-2 rounded-full px-3 py-2 text-[15px] font-medium text-primary transition hover:bg-primary/10',
        className,
      )}
    >
      <ExternalIcon size={18} aria-hidden className="shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
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
                  <span className="[overflow-wrap:anywhere]">{title}</span>
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
