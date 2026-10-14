// Peças de interface compartilhadas pelas telas de estudo conectado, temas e
// documentos: seção expansível, citações bíblicas em chips, fontes copiáveis e
// aviso compacto de falha com nova tentativa.
import { BookOpen, ChevronDown, ExternalLink, Link as LinkIcon, RotateCw } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { Button, Chip, Wrap, copyText, cx, message } from '../components/ui';
import { showPassage } from '../screens/open';
import { refId, refLabel, type Ref } from './domain';
import { lang, t, tr } from './i18n';

/** ExpansionTile do original: só monta o conteúdo quando aberto (economia de CPU). */
export function Disclosure({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={cx('mt-4 rounded-2xl ring-1 ring-outline/40', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-on-surface/5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-medium leading-snug">{title}</span>
          {subtitle && <span className="mt-0.5 block text-sm text-muted">{subtitle}</span>}
        </span>
        <ChevronDown size={20} aria-hidden className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div id={id} className="min-w-0 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

/** Passagens como chips; cada uma abre a prévia (showPassage) na edição de origem indicada. */
export function RefChips({
  refs,
  sourceEdition,
  initial = 80,
  step = 80,
  className,
}: {
  refs: Ref[];
  sourceEdition?: string;
  initial?: number;
  step?: number;
  className?: string;
}) {
  const [count, setCount] = useState(initial);
  const language = lang();
  if (refs.length === 0) return null;
  const rest = refs.length - count;
  return (
    <div className={className}>
      <Wrap>
        {refs.slice(0, count).map((r) => (
          <Chip key={refId(r)} icon={BookOpen} onClick={() => showPassage(r, sourceEdition ? { sourceEdition } : {})}>
            {refLabel(r, language)}
          </Chip>
        ))}
      </Wrap>
      {rest > 0 && (
        <Button variant="text" className="mt-2" onClick={() => setCount((c) => c + step)}>
          {tr('Mostrar mais', 'Show more', 'Mostrar más')} ({rest})
        </Button>
      )}
    </div>
  );
}

type Source = string | { title: string; url: string };
const sourceLabel = (s: Source) => (typeof s === 'string' ? s : `${s.title}\n${s.url}`);
const sourceUrl = (s: Source) => (typeof s === 'string' ? /https?:\/\/[^\s)]+/.exec(s)?.[0] : s.url) ?? null;

/** sourceLinks() de common.dart: tocar copia a fonte; endereços web também podem ser abertos. */
export function SourceLinks({ sources, className }: { sources: Source[]; className?: string }) {
  const list = sources.filter((s) => sourceLabel(s).trim());
  if (list.length === 0) return null;
  return (
    <section className={cx('mt-5', className)}>
      <h3 className="text-[15px] font-semibold">{t('sources')}</h3>
      <ul className="mt-1">
        {list.map((s, i) => {
          const label = sourceLabel(s);
          const url = sourceUrl(s);
          return (
            <li key={i} className="flex items-start gap-1">
              <button
                type="button"
                title={tr('Copiar fonte', 'Copy source', 'Copiar fuente')}
                className="flex min-h-[40px] min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-primary hover:bg-primary/10"
                onClick={async () => message((await copyText(label)) ? t('copy') : t('error'))}
              >
                <LinkIcon size={16} aria-hidden className="mt-0.5 shrink-0" />
                <span className="min-w-0 whitespace-pre-line [overflow-wrap:anywhere]">{label}</span>
              </button>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tr('Abrir fonte em nova aba', 'Open source in a new tab', 'Abrir fuente en una pestaña nueva')}
                  title={tr('Abrir fonte em nova aba', 'Open source in a new tab', 'Abrir fuente en una pestaña nueva')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-on-surface/10"
                >
                  <ExternalLink size={17} aria-hidden />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Falha discreta de uma seção opcional: as demais partes da tela continuam visíveis. */
export function InlineError({ error, onRetry, what }: { error: unknown; onRetry?: () => void; what?: string }) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="my-2 flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1">
        {what ? `${what}: ` : ''}
        {text}
      </span>
      {onRetry && (
        <Button variant="text" icon={RotateCw} className="min-h-[36px] px-3 py-1 text-sm" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
