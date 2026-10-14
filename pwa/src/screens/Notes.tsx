// Área "Estudos" (NotesPage de lib/notes.dart): confissões, devocionais,
// atalhos de estudo, anotações com busca e cadernos; e o editor de anotações
// (NoteEditor) com salvamento automático, prévia Markdown, anexos e menções.
import { Eye, Landmark, MessagesSquare, Network, Paperclip, Pencil, Plus, Search, Shield, Sunrise, Table2, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { closeSheet } from '../lib/app';
import { t, tr } from '../lib/i18n';
import { attachmentMarkdown, errorText, filterNotes, noteMeta, notePreview, notebooksOf } from '../lib/notes-logic';
import { useAnchoredVirtualizer, VIRTUAL_THRESHOLD } from '../lib/notes-virtual';
import { onBeforeUpdate } from '../lib/pwa';
import { attach, backlinks, deleteNote, note as loadNote, notes as loadNotes, saveNote, storeRevision, subscribe, type Note } from '../lib/store';
import { Markdown } from '../components/Markdown';
import { Action, Button, Card, Chip, ErrorBox, Feature, Field, Heading, ListItem, Spinner, Wrap, message, useAsync, useDebounced } from '../components/ui';
import { openArena, openConfessions, openDevotionals, openGraph, openNewNote, openNote, openStudiesBrowser } from './open';

const useRevision = () => useSyncExternalStore(subscribe, storeRevision);

// ------------------------------------------------------------------ lista
const NoteCard = memo(function NoteCard({ note }: { note: Note }) {
  return (
    <Card onClick={() => openNote(note)} className="mb-2">
      <span className="block px-4 py-3">
        <span className="block text-[15.5px] font-medium leading-snug">{note.title || t('newNote')}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{noteMeta(note)}</span>
        {note.body && (
          <span className="mt-0.5 block text-sm text-muted" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {notePreview(note.body)}
          </span>
        )}
      </span>
    </Card>
  );
});

function newNote() {
  openNewNote().catch((error) => message(`${t('error')}: ${errorText(error)}`));
}

export default function NotesPage() {
  // Recarrega a lista depois de edições (aqui, no editor ou em outra tela).
  const revision = useRevision();
  const state = useAsync(() => loadNotes(), [revision]);
  const all = state.data;
  const [search, setSearch] = useState('');
  const [notebook, setNotebook] = useState('');
  const query = useDebounced(search, 250);

  const notebooks = useMemo(() => notebooksOf(all ?? []), [all]);
  const active = notebook && notebooks.includes(notebook) ? notebook : '';
  const rows = useMemo(() => filterNotes(all ?? [], active, query), [all, active, query]);
  const virtualize = rows.length > VIRTUAL_THRESHOLD;
  const { scroller, anchor, virtual } = useAnchoredVirtualizer({ count: rows.length, estimateSize: () => 112, enabled: virtualize });

  // Nova busca ou caderno: volta a lista ao início (se já tiver rolado além do cabeçalho).
  const listTop = useRef(0);
  useEffect(() => {
    const element = scroller.current;
    if (element && element.scrollTop > listTop.current) element.scrollTop = listTop.current;
  }, [query, active, scroller]);

  const items = virtual.getVirtualItems();
  return (
    <div ref={scroller} className="scroll-area h-full">
      <div className="mx-auto max-w-3xl p-[18px]">
        <Feature
          title={tr('Confissões e catecismos', 'Confessions and catechisms', 'Confesiones y catecismos')}
          subtitle={tr(
            'Westminster · Breve · Maior · Confissões de Agostinho',
            "Westminster · Shorter · Larger · Augustine's Confessions",
            'Westminster · Menor · Mayor · Confesiones de Agustín',
          )}
          icon={Landmark}
          onClick={openConfessions}
        />
        <Feature
          title={tr('Devocionais', 'Devotionals', 'Devocionales')}
          subtitle={tr(
            'Café da Manhã com Spurgeon · Jornada Reformada · leitura diária',
            "Spurgeon's Morning by Morning · Reformed Journey · daily reading",
            'Mañana a mañana con Spurgeon · Jornada Reformada · lectura diaria',
          )}
          icon={Sunrise}
          onClick={openDevotionals}
        />
        <Wrap className="gap-1">
          <Action label={t('apologetics')} icon={Shield} onClick={() => openStudiesBrowser(true)} />
          <Action label={t('desk')} icon={Table2} onClick={() => openStudiesBrowser(false)} />
          <Action label={t('arena')} icon={MessagesSquare} onClick={openArena} />
          <Action label={t('graph')} icon={Network} onClick={() => openGraph()} />
          <Action label={t('newNote')} icon={Plus} onClick={newNote} />
        </Wrap>

        <div
          className="mt-4"
          ref={(element) => {
            if (element) listTop.current = element.offsetTop;
          }}
        >
          <label className="relative block">
            <span className="sr-only">{t('search')}</span>
            <Search size={20} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              placeholder={t('search')}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-outline bg-surface py-2.5 pl-10 pr-3 text-[16px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
        <Wrap className="mt-3">
          <Chip selected={!active} onClick={() => setNotebook('')}>
            {t('all')}
          </Chip>
          {notebooks.map((n) => (
            <Chip key={n} selected={active === n} onClick={() => setNotebook(n)}>
              {n}
            </Chip>
          ))}
        </Wrap>

        <p className="sr-only" aria-live="polite">
          {all ? `${rows.length} ${tr('anotações', 'notes', 'notas')}` : ''}
        </p>
        <section className="mt-3" aria-label={t('notes')}>
          {state.error ? (
            <ErrorBox error={state.error} onRetry={state.reload} />
          ) : !all ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <p className="p-6 text-muted">{t('empty')}</p>
          ) : virtualize ? (
            <div ref={anchor} className="relative" style={{ height: virtual.getTotalSize() }}>
              {items.map((item) => (
                <div
                  key={rows[item.index].id}
                  data-index={item.index}
                  ref={virtual.measureElement}
                  className="absolute left-0 right-0 top-0"
                  style={{ transform: `translateY(${item.start - virtual.options.scrollMargin}px)` }}
                >
                  <NoteCard note={rows[item.index]} />
                </div>
              ))}
            </div>
          ) : (
            rows.map((n) => <NoteCard key={n.id} note={n} />)
          )}
        </section>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- editor
interface Values {
  title: string;
  body: string;
  notebook: string;
  tags: string;
}

export function NoteEditor({ noteId }: { noteId: string }) {
  const state = useAsync(() => loadNote(noteId), [noteId]);
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (state.loading && !state.data) return <Spinner />;
  if (!state.data) return <p className="p-6 text-muted">{t('noContent')}</p>;
  return <Editor key={noteId} initial={state.data} />;
}

function Editor({ initial }: { initial: Note }) {
  const id = initial.id;
  const [values, setValues] = useState<Values>({ title: initial.title, body: initial.body, notebook: initial.notebook, tags: initial.tags });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const latest = useRef(values);
  const dirty = useRef(false);
  const deleted = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const fileInput = useRef<HTMLInputElement>(null);
  const bodyArea = useRef<HTMLTextAreaElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  /** Grava o estado atual (se houver mudança), em fila para manter a ordem das escritas. */
  const save = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (deleted.current || !dirty.current) return queue.current;
    dirty.current = false;
    const v = latest.current;
    queue.current = queue.current.then(async () => {
      if (deleted.current) return;
      try {
        await saveNote({ id, title: v.title, body: v.body, reference: initial.reference, notebook: v.notebook, tags: v.tags });
        if (mounted.current) setError(null);
      } catch (e) {
        dirty.current = true;
        if (mounted.current) setError(`${t('error')}: ${errorText(e)}`);
      }
    });
    return queue.current;
  }, [id, initial.reference]);

  const change = useCallback(
    (field: keyof Values, value: string) => {
      latest.current = { ...latest.current, [field]: value };
      dirty.current = true;
      setValues(latest.current);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 500);
    },
    [save],
  );

  // Salva o que estiver pendente ao fechar, ao ir para segundo plano e antes de atualizar o app.
  useEffect(() => {
    mounted.current = true;
    const flush = () => save();
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    const off = onBeforeUpdate(flush);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      off();
      void flush();
    };
  }, [save]);

  // Corpo cresce com o texto (mínimo de 14 linhas), como o TextField do original.
  useLayoutEffect(() => {
    const area = bodyArea.current;
    if (!area) return;
    area.style.height = 'auto';
    if (area.scrollHeight > 0) area.style.height = `${area.scrollHeight + 2}px`;
  }, [values.body, preview]);

  useEffect(() => {
    if (confirming) confirmButton.current?.focus();
  }, [confirming]);

  const revision = useRevision();
  const links = useAsync(() => backlinks(id), [id, revision]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAttaching(true);
    try {
      const attachmentId = await attach(id, file);
      change('body', latest.current.body + attachmentMarkdown(file.name, attachmentId));
      await save();
    } catch (e) {
      message(errorText(e));
    } finally {
      if (mounted.current) setAttaching(false);
    }
  };

  const remove = async () => {
    deleted.current = true;
    if (timer.current) clearTimeout(timer.current);
    try {
      await queue.current;
      await deleteNote(id);
      closeSheet();
    } catch (e) {
      deleted.current = false;
      setConfirming(false);
      setError(`${t('error')}: ${errorText(e)}`);
    }
  };

  const backlinkRows = (links.data ?? []).filter((n) => n.id !== id);
  return (
    <div className="mx-auto max-w-3xl p-5">
      <Field label={t('title')} value={values.title} onChange={(e) => change('title', e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Field label={t('notebook')} value={values.notebook} onChange={(e) => change('notebook', e.target.value)} />
        <Field label={t('tags')} value={values.tags} onChange={(e) => change('tags', e.target.value)} />
      </div>
      <Wrap className="mt-2 gap-1">
        <Action label={t(preview ? 'edit' : 'preview')} icon={preview ? Pencil : Eye} onClick={() => setPreview((v) => !v)} />
        <Action label={t('attach')} icon={Paperclip} disabled={attaching} onClick={() => fileInput.current?.click()} />
        <Action label={t('delete')} icon={Trash2} onClick={() => setConfirming(true)} />
        <input ref={fileInput} type="file" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => void onFile(e)} />
      </Wrap>

      {confirming && (
        <div role="alertdialog" aria-labelledby="note-delete-title" aria-describedby="note-delete-text" className="mt-2 rounded-2xl bg-danger/10 p-4">
          <p id="note-delete-title" className="font-medium">
            {tr('Excluir esta anotação?', 'Delete this note?', '¿Eliminar esta nota?')}
          </p>
          <p id="note-delete-text" className="mt-1 text-sm text-muted">
            {tr(
              'A anotação e suas ligações serão removidas deste dispositivo. Esta ação não pode ser desfeita.',
              'The note and its links will be removed from this device. This cannot be undone.',
              'La nota y sus enlaces se eliminarán de este dispositivo. Esta acción no se puede deshacer.',
            )}
          </p>
          <Wrap className="mt-3 justify-end">
            <Button variant="text" onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
            <button
              ref={confirmButton}
              type="button"
              onClick={() => void remove()}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-danger bg-surface px-4 py-2 text-[15px] font-medium text-danger transition hover:bg-danger/10"
            >
              <Trash2 size={18} aria-hidden />
              {t('delete')}
            </button>
          </Wrap>
        </div>
      )}

      <div className="mt-2">
        {preview ? (
          <div className="min-h-[14em] rounded-xl px-1 py-2 text-[16px]">
            <Markdown text={values.body} />
          </div>
        ) : (
          <textarea
            ref={bodyArea}
            rows={14}
            value={values.body}
            aria-label={tr('Texto da anotação', 'Note text', 'Texto de la nota')}
            placeholder="Markdown · [[João 3:16]] · [[note:identificador]]"
            onChange={(e) => change('body', e.target.value)}
            className="block w-full resize-y overflow-hidden rounded-xl border border-outline bg-surface px-3 py-2.5 text-[16px] leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        )}
      </div>
      <p className={`mt-2.5 text-sm ${error ? 'text-danger' : 'text-muted'}`} role={error ? 'alert' : 'status'} aria-live="polite">
        {error ?? t('autosaved')}
      </p>

      {backlinkRows.length > 0 && (
        <section className="mt-4">
          <Heading level={3}>{t('backlinks')}</Heading>
          <ul className="mt-1">
            {backlinkRows.map((n) => (
              <li key={n.id}>
                <ListItem title={n.title || t('newNote')} onClick={() => openNote(n)} trailing="chevron" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
