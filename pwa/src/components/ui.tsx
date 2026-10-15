// Componentes básicos com aparência Material 3 (como os widgets do app Flutter).
import { ChevronRight, LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '../lib/i18n';

// Aceita ícones do lucide-react e componentes simples com as mesmas props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Icon = ComponentType<any>;
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

type Variant = 'filled' | 'tonal' | 'outlined' | 'text';
export function Button({
  variant = 'filled',
  icon: IconComponent,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: Icon }) {
  const styles: Record<Variant, string> = {
    filled: 'bg-primary text-on-primary hover:brightness-110',
    tonal: 'bg-primary-container text-on-primary-container hover:brightness-95',
    outlined: 'border border-outline text-primary hover:bg-primary/5',
    text: 'text-primary hover:bg-primary/10',
  };
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full px-4 py-2 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
    >
      {IconComponent && <IconComponent size={18} aria-hidden />}
      {children}
    </button>
  );
}

/** Equivalente a action(texto, ícone, callback) do original. */
export function Action({ label, icon, onClick, disabled }: { label: string; icon: Icon; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="text" icon={icon} onClick={onClick} disabled={disabled} title={label} className="px-3">
      {label}
    </Button>
  );
}

export function IconButton({
  label,
  icon: IconComponent,
  active,
  className,
  size = 22,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: Icon; active?: boolean; size?: number }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      {...rest}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-on-surface/10 disabled:opacity-40',
        active && 'bg-primary-container text-on-primary-container',
        className,
      )}
    >
      <IconComponent size={size} aria-hidden />
    </button>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  icon: IconComponent,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: Icon;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition',
        selected ? 'border-transparent bg-secondary-container font-medium' : 'border-outline hover:bg-on-surface/5',
        className,
      )}
    >
      {IconComponent && <IconComponent size={16} aria-hidden />}
      {children}
    </button>
  );
}

export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('block w-full rounded-2xl bg-surface-low text-left shadow-sm ring-1 ring-outline/30', onClick && 'transition hover:bg-surface-high', className)}
    >
      {children}
    </Tag>
  );
}

export function ListItem({
  title,
  subtitle,
  leading: Leading,
  trailing,
  onClick,
  selected,
  lines = 2,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: Icon;
  trailing?: ReactNode | 'chevron';
  onClick?: () => void;
  selected?: boolean;
  lines?: number;
}) {
  const content = (
    <>
      {Leading && <Leading size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />}
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px] leading-snug">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block whitespace-pre-line text-sm text-muted" style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {subtitle}
          </span>
        )}
      </span>
      {trailing === 'chevron' ? <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" /> : trailing}
    </>
  );
  const classes = cx('flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left', selected && 'bg-secondary-container');
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(classes, 'transition hover:bg-on-surface/5')}>
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

/** feature() do original: cartão com ícone, título, subtítulo e seta. */
export function Feature({ title, subtitle, icon, onClick }: { title: string; subtitle: string; icon: Icon; onClick: () => void }) {
  return (
    <Card onClick={onClick} className="mb-2.5">
      <span className="flex items-center gap-4 px-4 py-3.5">
        {(() => {
          const I = icon;
          return <I size={28} aria-hidden className="shrink-0 text-primary" />;
        })()}
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-medium">{title}</span>
          <span className="block text-sm text-muted">{subtitle}</span>
        </span>
        <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
      </span>
    </Card>
  );
}

export function Field({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <input
        {...rest}
        className="w-full rounded-xl border border-outline bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export function TextArea({ label, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm text-muted">{label}</span>}
      <textarea
        {...rest}
        className="w-full rounded-xl border border-outline bg-surface px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </label>
  );
}

export function Select({
  label,
  options,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm text-muted">{label}</span>
      <select
        {...rest}
        className="w-full rounded-xl border border-outline bg-surface px-3 py-2.5 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[15.5px]">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="absolute inset-0 rounded-full border-2 border-outline bg-surface-high transition peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-outline transition peer-checked:left-6 peer-checked:h-5 peer-checked:w-5 peer-checked:bg-on-primary" />
      </span>
    </label>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, digits = 0 }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; digits?: number }) {
  return (
    <label className="block py-1">
      <span className="text-[15px]">
        {label}: {value.toFixed(digits)}
      </span>
      <input type="range" className="mt-1 w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('my-5 border-outline/50', className)} />;
}

export function Heading({ children, level = 2, className }: { children: ReactNode; level?: 1 | 2 | 3; className?: string }) {
  const sizes = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-[17px]' } as const;
  const Tag = `h${level}` as 'h1';
  return <Tag className={cx('font-semibold leading-snug', sizes[level], className)}>{children}</Tag>;
}

export const Small = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cx('text-sm text-muted', className)}>{children}</p>
);

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 p-8 text-muted">
      <LoaderCircle className="animate-spin" size={22} aria-hidden />
      <span className="text-sm">{label ?? t('loading')}</span>
    </div>
  );
}

export function Progress({ value }: { value?: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded bg-primary/15" role="progressbar" aria-valuenow={value === undefined ? undefined : Math.round(value * 100)}>
      <div className={cx('h-full bg-primary', value === undefined && 'w-1/3 animate-pulse')} style={value === undefined ? undefined : { width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="m-4 rounded-xl bg-danger/10 p-4 text-[15px]">
      <p>{text}</p>
      {onRetry && (
        <Button variant="text" className="mt-2" onClick={onRetry}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- toasts
const toasts: { id: number; text: string }[] = [];
let toastId = 0;
const toastListeners = new Set<() => void>();
let toastSnapshot = toasts.slice();
const notifyToasts = () => {
  toastSnapshot = toasts.slice();
  toastListeners.forEach((l) => l());
};
export function message(text: string): void {
  const id = ++toastId;
  toasts.push({ id, text });
  notifyToasts();
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id);
    if (index >= 0) toasts.splice(index, 1);
    notifyToasts();
  }, 3200);
}
export function Toasts() {
  const items = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toastSnapshot,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto max-w-md rounded-xl bg-on-surface px-4 py-3 text-[15px] text-surface shadow-lg">
          {item.text}
        </div>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- hooks
export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  useEffect(() => {
    const run = ++latest.current;
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    // A requisição pode terminar depois que a tela ou o ambiente de teste
    // desmontar. Nunca atualizar React a partir de uma Promise obsoleta.
    // Preserve a execução imediata do carregador, como antes desta correção.
    // Converter throws síncronos em rejeições tratadas também impede que
    // exceções escapem do efeito quando a tela está sendo montada.
    let task: Promise<T>;
    try {
      task = Promise.resolve(fn());
    } catch (error) {
      task = Promise.reject(error);
    }
    task.then(
      (data) => {
        if (active && run === latest.current)
          setState({ data, error: null, loading: false });
      },
      (error) => {
        if (active && run === latest.current)
          setState({ data: undefined, error, loading: false });
      },
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, reload };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setCurrent(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return current;
}

export function Async<T>({ state, children, loading }: { state: AsyncState<T>; children: (data: T) => ReactNode; loading?: ReactNode }) {
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (state.data === undefined) return <>{loading ?? <Spinner />}</>;
  return <>{children(state.data)}</>;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

export { cx };
