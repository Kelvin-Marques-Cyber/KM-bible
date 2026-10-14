// CommentariesPage de lib/reader.dart: comentários da passagem (folha ou painel
// lateral do leitor), guias de leitura, filtro por autor, traduções de estudo
// em português, originais em inglês sob demanda e cópia com citação completa.
import { BookOpenText, ChevronDown, ChevronRight, Coffee, FileText, Languages, Quote } from 'lucide-react';
import { memo, useId, useMemo, useState, type ReactNode } from 'react';
import { app, useApp } from '../lib/app';
import { commentaries, installed, module, modules, type CommentaryEntry } from '../lib/content';
import { refId, refLabel, type Ref } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  DEVOTIONAL_MODULES,
  GUIDE_MODULES,
  PREVIEW_LIMIT,
  authorChipLabels,
  authorIds,
  commentaryCitation,
  commentaryModule,
  filterByAuthors,
  hasHernandesEntry,
  localizedEntries,
  mergeCommentaryGroups,
  previewText,
  sortCommentaries,
  translation,
} from '../lib/commentaries-logic';
import { Action, Button, Chip, ErrorBox, Heading, Progress, Small, Spinner, Toggle, Wrap, copyText, message, useAsync, type Icon } from '../components/ui';
import { Markdown } from '../components/Markdown';
import { openDevotionals, openLongText, openModule } from './open';

/** Seção expansível (ExpansionTile): o conteúdo só é montado quando aberto. */
function Expander({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="border-b border-outline/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl py-3 text-left transition hover:bg-on-surface/5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px]">{title}</span>
          {subtitle && <span className="block text-sm text-muted">{subtitle}</span>}
        </span>
        <ChevronDown size={20} aria-hidden className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

function GuideRow({ title, subtitle, icon: GuideIcon, onClick }: { title: string; subtitle: string; icon: Icon; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-on-surface/5">
      <GuideIcon size={20} aria-hidden className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{title}</span>
        <span className="block text-sm text-muted">{subtitle}</span>
      </span>
      <ChevronRight size={20} aria-hidden className="shrink-0 text-muted" />
    </button>
  );
}

/** "Guias de leitura e referências": material de apoio, fora do corpo de comentários. */
function Guides() {
  const guides = GUIDE_MODULES.filter((id) => installed(id));
  const devotionals = DEVOTIONAL_MODULES.some((id) => installed(id));
  return (
    <Expander title="Guias de leitura e referências" subtitle="Material de apoio, separado dos comentários bíblicos integrais.">
      {guides.map((id) => {
        const info = module(id);
        return (
          <GuideRow
            key={id}
            icon={BookOpenText}
            title={info?.title ?? id}
            subtitle="Guia editorial e referências; não reproduz a obra integral."
            onClick={() => info && openModule(info)}
          />
        );
      })}
      {devotionals && (
        <GuideRow
          icon={Coffee}
          title="Devocionais diários"
          subtitle="Café da Manhã com Spurgeon · Jornada Reformada (referências a Josemar Bessa)."
          onClick={() => openDevotionals()}
        />
      )}
      {guides.length === 0 && !devotionals && <Small className="px-2">{t('noContent')}</Small>}
    </Expander>
  );
}

const CommentaryCard = memo(function CommentaryCard({ entry, referenceLabel, language }: { entry: CommentaryEntry; referenceLabel: string; language: string }) {
  const m = commentaryModule(entry.module_id, module(entry.module_id));
  const pt = translation(entry);
  const englishOnly = !pt && m.language === 'en' && language === 'pt';
  const body = pt?.body ?? entry.body;
  const preview = useMemo(() => previewText(body), [body]);
  const titleId = useId();
  const text = <Markdown text={preview} className="text-[17px]" />;
  return (
    <article aria-labelledby={titleId} className="cv-auto mb-3 rounded-2xl bg-surface-low p-[18px] shadow-sm ring-1 ring-outline/30" style={{ containIntrinsicSize: 'auto 420px' }}>
      <h3 id={titleId} className="text-[16.5px] font-medium leading-snug">
        {m.author} · {pt ? tr('Português (tradução de estudo)', 'Portuguese (study translation)', 'Portugués (traducción de estudio)') : m.language}
      </h3>
      <p className="text-sm text-muted">
        {entry.kind} · {entry.reference} — {entry.end_reference}
      </p>
      <div className="mt-3.5">
        {englishOnly ? (
          <Expander title="Texto original em inglês" subtitle="Esta entrada ainda não tem tradução de estudo em português.">
            {text}
          </Expander>
        ) : (
          text
        )}
      </div>
      {/* Mesma ordem do original: ler completo, situação da tradução, original, copiar, licença. */}
      {body.length > PREVIEW_LIMIT && !englishOnly && (
        <div className="mt-2">
          <Action
            label={tr('Ler comentário completo', 'Read full commentary', 'Leer comentario completo')}
            icon={FileText}
            onClick={() => openLongText(`${m.author} · ${pt?.title.trim() ? pt.title : entry.title}`, body)}
          />
        </div>
      )}
      {pt && pt.status && <Small className="mt-2">{pt.status}</Small>}
      <Wrap className="mt-1 gap-x-1 gap-y-0">
        {pt && (
          <Action
            label={tr('Consultar original em inglês', 'Read the English original', 'Consultar original en inglés')}
            icon={Languages}
            onClick={() => openLongText(`${m.author} · original`, entry.body)}
          />
        )}
        <Action
          label={t('copy')}
          icon={Quote}
          onClick={async () => {
            const ok = await copyText(commentaryCitation(body, m, referenceLabel, entry));
            message(ok ? t('copy') : t('error'));
          }}
        />
      </Wrap>
      <Small className="mt-1.5 break-words">
        {m.license} · {m.source}
      </Small>
    </article>
  );
});

function CommentaryList({ all, reference, language }: { all: CommentaryEntry[]; reference: Ref; language: string }) {
  const [authors, setAuthors] = useState<Set<string>>(() => new Set());
  const [showOriginals, setShowOriginals] = useState(false);
  const sorted = useMemo(() => sortCommentaries(all), [all]);
  const localized = useMemo(
    () => localizedEntries(sorted, language, showOriginals, (id) => module(id)?.language ?? ''),
    [sorted, language, showOriginals],
  );
  const ids = useMemo(() => authorIds(localized), [localized]);
  const labels = useMemo(() => authorChipLabels(ids, module), [ids]);
  const shown = useMemo(() => filterByAuthors(localized, authors), [localized, authors]);
  const referenceLabel = refLabel(reference, language);

  return (
    <>
      {language === 'pt' && !hasHernandesEntry(all) && (
        <p className="py-2 text-[15px]">
          Os comentários integrais de Hernandes Dias Lopes ainda não constam desta edição. O guia de fontes disponível acima é um material diferente.
        </p>
      )}
      {language === 'pt' && (
        <Toggle
          label="Mostrar textos originais em inglês"
          description="Entradas traduzidas aparecem automaticamente quando disponíveis."
          checked={showOriginals}
          onChange={setShowOriginals}
        />
      )}
      {all.length > 0 && localized.length === 0 && (
        <p className="py-2 text-[15px]">Nenhuma tradução instalada para esta passagem. Ative a opção acima para consultar os originais.</p>
      )}
      {ids.length > 0 && (
        <Wrap className="my-3">
          {ids.map((id) => (
            <Chip
              key={id}
              selected={authors.has(id)}
              onClick={() =>
                setAuthors((current) => {
                  const next = new Set(current);
                  if (!next.delete(id)) next.add(id);
                  return next;
                })
              }
            >
              {labels.get(id) ?? id}
            </Chip>
          ))}
        </Wrap>
      )}
      {all.length === 0 && <p className="py-2 text-[15px]">{t('noContent')}</p>}
      <div className="mt-2">
        {shown.map((entry) => (
          <CommentaryCard key={`${entry.module_id}|${entry.id}`} entry={entry} referenceLabel={referenceLabel} language={language} />
        ))}
      </div>
    </>
  );
}

interface Loaded {
  key: string;
  reference: Ref;
  entries: CommentaryEntry[];
  /** Módulos cujo arquivo não pôde ser lido (ex.: sem conexão e fora do cache). */
  failed: string[];
}

/**
 * Carrega módulo a módulo: um pacote indisponível offline não esconde os
 * demais comentários (no original, cada comentarista é independente).
 */
async function loadCommentaries(reference: Ref, source: string, key: string): Promise<Loaded> {
  const ids = modules('commentary', true).map((m) => m.id);
  const results = await Promise.allSettled(ids.map((id) => commentaries(reference, { moduleId: id, sourceTranslation: source })));
  const groups: { id: string; entries: CommentaryEntry[] }[] = [];
  const failed: string[] = [];
  let firstError: unknown = null;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') groups.push({ id: ids[index], entries: result.value });
    else {
      failed.push(ids[index]);
      firstError ??= result.reason;
    }
  });
  if (groups.length === 0 && failed.length > 0) throw firstError;
  return { key, reference, entries: mergeCommentaryGroups(groups), failed };
}

export default function CommentariesPage({ reference }: { reference: Ref }) {
  useApp();
  const language = lang();
  const source = app.translation;
  const key = `${refId(reference)}|${source}`;
  // Ativar/desativar módulos muda a lista sem trocar a passagem.
  const enabled = modules('commentary', true)
    .map((m) => m.id)
    .join(',');
  const state = useAsync(() => loadCommentaries(reference, source, key), [key, enabled]);
  const stale = state.data !== undefined && state.data.key !== key;
  const failed = state.data?.failed ?? [];

  return (
    <div className="mx-auto max-w-3xl p-5">
      <Small>{t('addressWarning')}</Small>
      <Heading className="mt-1">{refLabel(reference, language)}</Heading>
      {language === 'pt' && (
        <div className="mt-3">
          <Guides />
        </div>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {state.loading ? t('loading') : ''}
      </div>
      {state.error ? (
        <ErrorBox error={state.error} onRetry={state.reload} />
      ) : state.data === undefined ? (
        <Spinner />
      ) : (
        <div aria-busy={stale} className={stale ? 'opacity-60 transition-opacity' : undefined}>
          {stale && <Progress />}
          {failed.length > 0 && !state.loading && (
            <div role="alert" className="my-3 rounded-xl bg-danger/10 p-3 text-[15px]">
              <p>
                {tr(
                  'Alguns comentários não puderam ser carregados agora (verifique a conexão ou baixe-os em Conteúdo offline): ',
                  'Some commentaries could not be loaded right now (check the connection or download them in Offline content): ',
                  'Algunos comentarios no se pudieron cargar ahora (verifique la conexión o descárguelos en Contenido sin conexión): ',
                )}
                {failed.map((id) => module(id)?.title ?? id).join('; ')}.
              </p>
              <Button variant="text" className="mt-1" onClick={state.reload}>
                {t('retry')}
              </Button>
            </div>
          )}
          <CommentaryList all={state.data.entries} reference={state.data.reference} language={language} />
        </div>
      )}
    </div>
  );
}
