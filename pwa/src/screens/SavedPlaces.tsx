// savedPlaces de lib/reader.dart: abas de estudo ou favoritos (com o histórico
// de leitura abaixo). Tocar abre a passagem na edição salva; abas continuam
// acompanhando a navegação até outra aba ser escolhida.
import { Bookmark, History, PanelsTopLeft, X } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { app, navigate } from '../lib/app';
import { fromId, refLabel } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import { deletePlace, readingHistory, savedPlaces, storeRevision, subscribe, type HistoryRow, type Place, type PlaceKind } from '../lib/store';
import { placeTitle, sortPlaces } from '../lib/commentaries-logic';
import { Async, Button, Divider, IconButton, ListItem, message, useAsync } from '../components/ui';

const PAGE = 100;

function goTo(reference: string, translation: string, options: { history?: boolean; tab?: string | null } = {}) {
  const r = fromId(reference);
  const previous = app.activeTab;
  if (options.tab !== undefined) app.activeTab = options.tab;
  if (!r || !navigate(r, { edition: translation, history: options.history })) {
    app.activeTab = previous;
    message(t('noContent'));
  }
}

function PlaceList({ kind, rows }: { kind: PlaceKind; rows: Place[] }) {
  const [count, setCount] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const language = lang();
  return (
    <>
      <ul>
        {rows.slice(0, count).map((row) => (
          <li key={row.id} className="cv-auto flex items-center gap-1" style={{ containIntrinsicSize: 'auto 64px' }}>
            <div className="min-w-0 flex-1">
              <ListItem
                leading={kind === 'study_tabs' ? PanelsTopLeft : Bookmark}
                title={placeTitle(row, language)}
                subtitle={row.translation}
                selected={kind === 'study_tabs' && app.activeTab === row.id}
                onClick={() => goTo(row.reference, row.translation, { tab: kind === 'study_tabs' ? row.id : null })}
              />
            </div>
            <IconButton
              label={`${t('delete')}: ${placeTitle(row, language)}`}
              icon={X}
              disabled={busy === row.id}
              onClick={async () => {
                setBusy(row.id);
                try {
                  await deletePlace(kind, row.id);
                  if (app.activeTab === row.id) app.activeTab = null;
                } catch (error) {
                  message(`${t('error')}: ${error instanceof Error ? error.message : String(error)}`);
                } finally {
                  setBusy(null);
                }
              }}
            />
          </li>
        ))}
      </ul>
      {rows.length > count && (
        <Button variant="text" onClick={() => setCount((n) => n + PAGE)}>
          {t('more')}
        </Button>
      )}
    </>
  );
}

function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const [count, setCount] = useState(PAGE);
  const language = lang();
  const valid = rows.filter((row) => fromId(row.reference));
  if (valid.length === 0) return null;
  return (
    <section aria-label={tr('Histórico de leitura', 'Reading history', 'Historial de lectura')}>
      <Divider />
      <ul>
        {valid.slice(0, count).map((row, index) => (
          <li key={row.id ?? `${index}|${row.reference}`} className="cv-auto" style={{ containIntrinsicSize: 'auto 64px' }}>
            <ListItem
              leading={History}
              title={refLabel(fromId(row.reference)!, language)}
              subtitle={row.translation}
              onClick={() => goTo(row.reference, row.translation, { history: false })}
            />
          </li>
        ))}
      </ul>
      {valid.length > count && (
        <Button variant="text" onClick={() => setCount((n) => n + PAGE)}>
          {t('more')}
        </Button>
      )}
    </section>
  );
}

export default function SavedPlacesPage({ kind }: { kind: 'bookmarks' | 'study_tabs' }) {
  // Recarrega quando favoritos/abas mudam (exclusão aqui ou em outra tela).
  const revision = useSyncExternalStore(subscribe, storeRevision);
  const state = useAsync(async () => {
    const [places, history] = await Promise.all([savedPlaces(kind), kind === 'bookmarks' ? readingHistory() : Promise.resolve([] as HistoryRow[])]);
    return { places: sortPlaces(places), history };
  }, [kind, revision]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <Async state={state}>
        {({ places, history }) => (
          <>
            {places.length > 0 && <PlaceList kind={kind} rows={places} />}
            {kind === 'bookmarks' && <HistoryList rows={history} />}
            {places.length === 0 && (kind !== 'bookmarks' || history.length === 0) && <p className="p-4 text-muted">{t('empty')}</p>}
          </>
        )}
      </Async>
    </div>
  );
}
