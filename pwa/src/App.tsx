import { BookOpen, Download, Gamepad2, Globe, Library, NotebookPen, Search, SlidersHorizontal, WifiOff, X } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import fontInfo from './generated/fonts.json';
import { app, changeArea, closeSheet, isFullscreen, isStudy, set, sheets, step, useApp } from './lib/app';
import { siteBase } from './lib/catalog';
import { isMemoryOnly } from './lib/db';
import { t, tr } from './lib/i18n';
import { usePwa } from './lib/pwa';
import { pref } from './lib/store';
import { ensureFont, fontStack, selectedTheme, themeColorHex, themeVariables } from './lib/themes';
import { IconButton, Spinner, Toasts } from './components/ui';
import { ReaderPage } from './screens/Reader';
import { InstallButton, UpdateBanner } from './screens/PwaBanners';
import { choosePassage, openDevotionals, openSearch, openSettings } from './screens/open';

const ExplorePage = lazy(() => import('./screens/Explore'));
const LibraryPage = lazy(() => import('./screens/Library'));
const NotesPage = lazy(() => import('./screens/Notes'));
const ToolsAndGames = lazy(() => import('./screens/ToolsAndGames'));
const Onboarding = lazy(() => import('./screens/Onboarding'));

const areas = [
  { key: 'bible', icon: BookOpen },
  { key: 'explore', icon: Globe },
  { key: 'library', icon: Library },
  { key: 'studies', icon: NotebookPen },
  { key: 'memory', icon: Gamepad2 },
] as const;

function useTheme() {
  const theme = selectedTheme(pref('theme', 'sepia'));
  const contrast = pref('contrast', false);
  const reduced = pref('reduced_motion', false);
  const font = pref('font_family', 'EBGaramond');
  const language = pref<string>('language', 'pt');
  useEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVariables(theme, contrast))) root.style.setProperty(k, v);
    root.style.setProperty('--reading-font', fontStack(font));
    root.style.colorScheme = theme.dark ? 'dark' : 'light';
    root.classList.toggle('reduced-motion', reduced);
    root.lang = language === 'en' ? 'en' : language === 'es' ? 'es' : 'pt-BR';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', themeColorHex(theme));
    ensureFont(font, siteBase(), fontInfo.format);
    try {
      localStorage.setItem('km-pref:theme', JSON.stringify(theme.id));
    } catch {
      /* modo privado */
    }
  }, [theme, contrast, reduced, font, language]);
}

function useShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Eventos enviados à janela (sem elemento de destino) não têm closest().
      const target = event.target;
      const typing = target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=true]');
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'f') {
        event.preventDefault();
        openSearch();
      } else if ((event.ctrlKey || event.metaKey) && key === 'l') {
        event.preventDefault();
        choosePassage();
      } else if ((event.ctrlKey || event.metaKey) && key === 'e') {
        event.preventDefault();
        set('study', !isStudy());
      } else if (event.key === 'Escape') {
        if (sheets.length) closeSheet();
        else if (isFullscreen()) set('fullscreen', false);
      } else if (event.altKey && !typing && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        step(event.key === 'ArrowLeft' ? -1 : 1);
      } else if (event.altKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        changeArea(Number(event.key) - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

/** Atalhos do manifesto (?acao=pesquisar | devocionais) — executados uma vez. */
function useLaunchAction() {
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('acao');
    if (!action) return;
    params.delete('acao');
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    if (action === 'pesquisar') openSearch();
    else if (action === 'devocionais') openDevotionals();
  }, []);
}

function SheetHost() {
  useApp();
  return (
    <>
      {sheets.map((sheet, index) => (
        <div key={sheet.id} className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={sheet.title}>
          {index === sheets.length - 1 && <button type="button" aria-label={t('close')} className="absolute inset-0 bg-black/35" onClick={closeSheet} />}
          <div
            className={`sheet-enter absolute inset-x-0 bottom-0 mx-auto flex max-w-5xl flex-col rounded-t-3xl bg-surface shadow-2xl ring-1 ring-outline/30 ${sheet.full ? 'top-0 rounded-t-none' : 'top-[6vh]'}`}
            style={{ paddingBottom: 'var(--safe-bottom)' }}
          >
            <div className="flex items-center gap-2 border-b border-outline/40 py-1.5 pl-5 pr-2">
              <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{sheet.title}</h2>
              <IconButton label={t('close')} icon={X} onClick={closeSheet} />
            </div>
            <div className="scroll-area min-h-0 flex-1">
              <Suspense fallback={<Spinner />}>{sheet.render()}</Suspense>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export function App({ storageWarning }: { storageWarning: string | null }) {
  useApp();
  useTheme();
  useShortcuts();
  useLaunchAction();
  const pwa = usePwa();
  const onboarding = !pref('dedication_seen', false) || !pref('onboarding_done', false);
  const full = isFullscreen() && app.area === 0;

  if (onboarding) {
    return (
      <Suspense fallback={<Spinner />}>
        <Onboarding />
        <Toasts />
      </Suspense>
    );
  }

  const page = [<ReaderPage key="r" />, <ExplorePage key="e" />, <LibraryPage key="l" />, <NotesPage key="n" />, <ToolsAndGames key="m" />][app.area];
  return (
    <div className="flex h-full flex-col font-ui" style={{ paddingTop: full ? 'var(--safe-top)' : undefined }}>
      {!full && (
        <header className="flex items-center gap-1 border-b border-outline/40 bg-surface px-2 py-1" style={{ paddingTop: 'calc(var(--safe-top) + 4px)' }}>
          <h1 className="min-w-0 flex-1 truncate pl-2 text-[21px] font-normal">{t(areas[app.area].key)}</h1>
          <InstallButton />
          <IconButton label={t('search')} icon={Search} onClick={openSearch} />
          <IconButton label={t('settings')} icon={SlidersHorizontal} onClick={openSettings} />
        </header>
      )}
      {(!pwa.online || storageWarning || isMemoryOnly()) && (
        <div className="flex items-center gap-2 bg-secondary-container px-4 py-1.5 text-sm" role="status">
          {!pwa.online ? <WifiOff size={16} aria-hidden /> : <Download size={16} aria-hidden />}
          <span>
            {!pwa.online
              ? t('offlineMode')
              : tr(
                  'O navegador bloqueou o armazenamento local: anotações desta sessão não serão guardadas após fechar.',
                  'The browser blocked local storage: notes from this session will not be kept after closing.',
                )}
          </span>
        </div>
      )}
      <main className="relative min-h-0 flex-1">
        <Suspense fallback={<Spinner />}>{page}</Suspense>
      </main>
      {!full && (
        <nav className="border-t border-outline/40 bg-surface-low" style={{ paddingBottom: 'var(--safe-bottom)' }} aria-label="Áreas">
          <ul className="mx-auto flex max-w-3xl">
            {areas.map((item, index) => {
              const Icon = item.icon;
              const selected = app.area === index;
              return (
                <li key={item.key} className="flex-1">
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    aria-label={t(item.key)}
                    onClick={() => changeArea(index)}
                    className="flex w-full flex-col items-center gap-0.5 pb-2 pt-2.5 text-[12.5px]"
                  >
                    <span className={`flex h-8 w-16 items-center justify-center rounded-full transition ${selected ? 'bg-secondary-container' : ''}`}>
                      <Icon size={22} aria-hidden />
                    </span>
                    <span className={`min-h-[2.1em] max-w-[90px] text-center leading-[1.05] ${selected ? 'font-semibold' : ''}`}>
                      {item.key === 'memory' ? (
                        <>
                          <span className="sm:hidden">{tr('Ferramentas', 'Tools', 'Herramientas')}</span>
                          <span className="hidden sm:inline">{t(item.key)}</span>
                        </>
                      ) : t(item.key)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <SheetHost />
      <UpdateBanner />
      <Toasts />
    </div>
  );
}
