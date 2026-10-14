// Configurações (lib/settings.dart) e AppearanceSettings (também usada na primeira configuração).
// Backup e migração são carregados sob demanda (import dinâmico) para manter esta tela leve.
import {
  Archive,
  ArchiveRestore,
  BookOpen,
  CircleCheck,
  CloudDownload,
  Download,
  ExternalLink,
  HardDrive,
  Heart,
  Keyboard,
  LoaderCircle,
  Moon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sun,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import fontInfo from '../generated/fonts.json';
import { app, fontSize, initApp, isStudy, lineHeight, margins, refresh, set, useApp } from '../lib/app';
import { siteBase } from '../lib/catalog';
import { availableBooks, hasVerse, modules } from '../lib/content';
import { isMemoryOnly } from '../lib/db';
import { ref, refId, refLabel } from '../lib/domain';
import { lang, t, tr } from '../lib/i18n';
import {
  APP_VERSION,
  BUILD_DATE,
  BUILD_ID,
  applyUpdate,
  checkForUpdate,
  formatBytes,
  promptInstall,
  requestPersistence,
  storageInfo,
  usePwa,
} from '../lib/pwa';
import { deleteCaches, isLegacyCache } from '../lib/settings-caches';
import { emit, pref, recordReading, savePlace, setPref } from '../lib/store';
import { ensureFont, fontStack, readingFonts, readingThemes, themeName } from '../lib/themes';
import { Button, Divider, Field, Heading, ListItem, Progress, Select, Small, Toggle, Wrap, cx, message, useAsync } from '../components/ui';
import { openDedication, openInstallHelp, openOffline } from './open';

const REPO_URL = 'https://github.com/Kelvin-Marques-Cyber/KM-bible';
const SAMPLE = 'Lâmpada para os meus pés é a tua palavra.';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const locale = () => (lang() === 'en' ? 'en-US' : lang() === 'es' ? 'es-ES' : 'pt-BR');
function formatDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
}
const errorText = (error: unknown) => String((error as Error)?.message ?? error);

function openOfflineAll(): void {
  openOffline({ autoStart: 'all' });
}
function offlineComplete(): boolean {
  try {
    return localStorage.getItem('km-offline-full') === '1';
  } catch {
    return false;
  }
}

/**
 * Troca de tradução como em AppearanceSettings (Dart): marca edition_chosen e navega
 * para a mesma passagem (ou o primeiro livro da nova edição) SEM fechar a folha aberta.
 */
function chooseTranslation(edition: string): void {
  void setPref('edition_chosen', true, false);
  const target = hasVerse(edition, app.passage) ? app.passage : ref(availableBooks(edition)[0] ?? 1, 1, 1);
  if (!hasVerse(edition, target)) {
    message(t('noContent'));
    return;
  }
  app.translation = edition;
  app.passage = target;
  app.area = 0;
  app.revision++;
  void recordReading(edition, target);
  if (app.activeTab) void savePlace('study_tabs', refId(target), edition, refLabel(target, lang()), app.activeTab);
  emit();
}

/**
 * Controle deslizante com pré-visualização imediata e gravação limitada (a cada 150 ms
 * e ao soltar): evita redesenhar o leitor e gravar no IndexedDB a cada pixel arrastado.
 */
function useLivePref(key: string, value: number): [number, (v: number) => void, () => void] {
  const [local, setLocal] = useState(value);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pending.current === null) setLocal(value);
  }, [value]);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      set(key, v);
    }
  }, [key]);
  useEffect(() => flush, [flush]);
  const change = useCallback(
    (v: number) => {
      setLocal(v);
      pending.current = v;
      if (!timer.current) timer.current = setTimeout(flush, 150);
    },
    [flush],
  );
  return [local, change, flush];
}

function RangeSetting({ label, value, min, max, step, digits, onChange, onCommit }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <label className="block py-1">
      <span className="text-[15px]">
        {label}: {value.toFixed(digits)}
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-[rgb(var(--primary))]"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(Number(e.target.value).toFixed(digits)))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

export function AppearanceSettings() {
  useApp();
  const language = lang();
  const theme = pref('theme', 'sepia');
  const font = pref('font_family', 'EBGaramond');
  const [size, setSize, commitSize] = useLivePref('font_size', fontSize());
  const [height, setHeight, commitHeight] = useLivePref('line_height', lineHeight());
  const [margin, setMargin, commitMargin] = useLivePref('margins', margins());
  const bibles = modules('bible', true);

  useEffect(() => {
    ensureFont(font, siteBase(), fontInfo.format);
  }, [font]);

  return (
    <div className="space-y-4">
      <Select
        label={t('language')}
        value={pref<string>('language', 'pt')}
        onChange={(e) => set('language', e.target.value)}
        options={[
          { value: 'pt', label: 'Português' },
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
        ]}
      />
      <fieldset>
        <legend className="mb-2 text-[15px]">{t('theme')}</legend>
        <Wrap className="gap-2.5">
          {readingThemes.map((item) => {
            const Icon = item.dark ? Moon : Sun;
            return (
              <Chip key={item.id} selected={theme === item.id} onClick={() => set('theme', item.id)}>
                <span
                  aria-hidden
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-outline/60"
                  style={{ background: hex(item.surface) }}
                >
                  <Icon size={14} color={hex(item.accent)} />
                </span>
                {themeName(item, language)}
                <span className="sr-only">{item.dark ? tr('(escuro)', '(dark)', '(oscuro)') : tr('(claro)', '(light)', '(claro)')}</span>
              </Chip>
            );
          })}
        </Wrap>
      </fieldset>
      <Select
        label={t('translation')}
        value={app.translation}
        onChange={(e) => chooseTranslation(e.target.value)}
        options={bibles.map((m) => ({ value: m.id, label: m.title }))}
      />
      <Select
        label={t('font')}
        value={readingFonts[font] ? font : 'EBGaramond'}
        onChange={(e) => {
          // Só a fonte escolhida é baixada (ensureFont), nunca a lista inteira.
          ensureFont(e.target.value, siteBase(), fontInfo.format);
          set('font_family', e.target.value);
        }}
        options={Object.entries(readingFonts).map(([value, label]) => ({ value, label }))}
      />
      <p className="break-words py-1" style={{ fontFamily: fontStack(font), fontSize: size, lineHeight: height }} lang="pt-BR">
        {SAMPLE}
      </p>
      <div>
        <RangeSetting label={t('fontSize')} value={size} min={14} max={48} step={1} digits={0} onChange={setSize} onCommit={commitSize} />
        <RangeSetting label={t('spacing')} value={height} min={1.1} max={2.5} step={0.1} digits={1} onChange={setHeight} onCommit={commitHeight} />
        <RangeSetting label={t('margins')} value={margin} min={8} max={64} step={1} digits={0} onChange={setMargin} onCommit={commitMargin} />
      </div>
    </div>
  );
}

/** Chip com conteúdo livre (amostra de cor do tema). */
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-[40px] items-center gap-2 rounded-lg border py-1 pl-1.5 pr-3 text-sm transition',
        selected ? 'border-transparent bg-secondary-container font-medium' : 'border-outline hover:bg-on-surface/5',
      )}
    >
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Heart; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <Heading level={3} className="flex items-center gap-2">
        {Icon && <Icon size={20} aria-hidden className="text-primary" />}
        {title}
      </Heading>
      {children}
    </section>
  );
}

// ------------------------------------------------------------------ atualizações
function UpdatesSection() {
  const pwa = usePwa();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const check = async () => {
    setChecking(true);
    setResult(null);
    try {
      const outcome = await checkForUpdate(true);
      if (outcome === 'current') {
        message(t('upToDate'));
        setResult(t('upToDate'));
      } else if (outcome === 'update') {
        setResult(t('updateReady'));
      } else {
        setResult(tr('Sem conexão: não foi possível verificar agora.', 'Offline: could not check now.', 'Sin conexión: no se pudo verificar ahora.'));
      }
    } finally {
      setChecking(false);
    }
  };
  return (
    <Section title={tr('Atualizações', 'Updates', 'Actualizaciones')} icon={RefreshCw}>
      <Small>
        {tr(
          'Buscar a versão mais recente sem apagar anotações, favoritos ou configurações.',
          'Get the latest version without erasing notes, bookmarks or settings.',
          'Obtener la versión más reciente sin borrar notas, marcadores ni configuración.',
        )}
      </Small>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[15px]">
        <dt className="text-muted">{tr('Versão', 'Version', 'Versión')}</dt>
        <dd>{APP_VERSION}</dd>
        <dt className="text-muted">{tr('Compilação', 'Build', 'Compilación')}</dt>
        <dd className="break-all">{BUILD_ID}</dd>
        <dt className="text-muted">{tr('Data', 'Date', 'Fecha')}</dt>
        <dd>{formatDate(BUILD_DATE)}</dd>
        <dt className="text-muted">{tr('Última verificação', 'Last check', 'Última verificación')}</dt>
        <dd>{pwa.lastCheck ? formatDate(pwa.lastCheck) : tr('ainda não verificado', 'not checked yet', 'aún no verificado')}</dd>
        {pwa.remote && pwa.remote.build !== BUILD_ID && (
          <>
            <dt className="text-muted">{tr('Publicada', 'Published', 'Publicada')}</dt>
            <dd>
              {pwa.remote.version} · {formatDate(pwa.remote.date)}
            </dd>
          </>
        )}
      </dl>
      <Wrap>
        <Button variant="tonal" icon={checking ? LoaderCircle : RefreshCw} onClick={() => void check()} disabled={checking || pwa.updating}>
          {t('checkUpdates')}
        </Button>
        {pwa.updateReady && (
          <Button icon={Download} onClick={() => void applyUpdate()} disabled={pwa.updating}>
            {t('updateNow')}
          </Button>
        )}
      </Wrap>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {checking ? t('loading') : result}
      </p>
      {pwa.swError && <Small className="text-danger">{`Service worker: ${pwa.swError}`}</Small>}
      <Toggle
        label={tr('Atualizar automaticamente', 'Update automatically', 'Actualizar automáticamente')}
        description={tr(
          'Aplica a nova versão quando o aplicativo vai para segundo plano. Anotações e configurações são preservadas.',
          'Applies the new version when the app goes to the background. Notes and settings are kept.',
          'Aplica la nueva versión cuando la aplicación pasa a segundo plano. Las notas y la configuración se conservan.',
        )}
        checked={pref('auto_update', true)}
        onChange={(v) => set('auto_update', v)}
      />
    </Section>
  );
}

// ------------------------------------------------------------------- instalação
function InstallSection() {
  const pwa = usePwa();
  const install = async () => {
    if (pwa.installAvailable) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        message(t('installed_app'));
        return;
      }
      if (outcome === 'dismissed') return;
    }
    openInstallHelp();
  };
  return (
    <Section title={t('installApp')} icon={Download}>
      {pwa.standalone || pwa.installed ? (
        <p className="flex items-center gap-2 text-[15px]">
          <CircleCheck size={20} aria-hidden className="text-primary" />
          {t('installed_app')}
        </p>
      ) : (
        <>
          <Small>
            {tr(
              'Instale para abrir pela tela inicial, em tela cheia e sem internet.',
              'Install to open from the home screen, full screen and offline.',
              'Instale para abrir desde la pantalla de inicio, en pantalla completa y sin internet.',
            )}
          </Small>
          <Wrap>
            <Button icon={Download} onClick={() => void install()}>
              {t('installApp')}
            </Button>
            <Button variant="text" onClick={openInstallHelp}>
              {tr('Como instalar', 'How to install', 'Cómo instalar')}
            </Button>
          </Wrap>
        </>
      )}
    </Section>
  );
}

// ------------------------------------------------------------ armazenamento
function StorageSection() {
  const [tick, setTick] = useState(0);
  const info = useAsync(storageInfo, [tick]);
  const [asking, setAsking] = useState(false);
  const data = info.data;
  const ratio = data?.usage && data?.quota ? Math.min(1, data.usage / data.quota) : undefined;
  const persist = async () => {
    setAsking(true);
    try {
      const granted = await requestPersistence();
      message(
        granted
          ? tr('Armazenamento persistente ativado.', 'Persistent storage enabled.', 'Almacenamiento persistente activado.')
          : tr(
              'O navegador não concedeu agora. Instalar o aplicativo ou usá-lo com frequência costuma liberar esta opção.',
              'The browser did not grant it now. Installing the app or using it often usually enables it.',
              'El navegador no lo concedió ahora. Instalar la aplicación o usarla con frecuencia suele habilitarlo.',
            ),
      );
    } finally {
      setAsking(false);
      setTick((n) => n + 1);
    }
  };
  return (
    <Section title={tr('Armazenamento e offline', 'Storage and offline', 'Almacenamiento y sin conexión')} icon={HardDrive}>
      {isMemoryOnly() && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-[15px]">
          <TriangleAlert size={20} aria-hidden className="mt-0.5 shrink-0 text-danger" />
          {tr(
            'O navegador bloqueou o armazenamento local: o que for feito nesta sessão não será guardado.',
            'The browser blocked local storage: what you do in this session will not be kept.',
            'El navegador bloqueó el almacenamiento local: lo que haga en esta sesión no se guardará.',
          )}
        </p>
      )}
      <div aria-live="polite">
        {info.loading && !data ? (
          <Small>{t('loading')}</Small>
        ) : (
          <>
            <p className="text-[15px]">
              {data?.usage !== null && data?.usage !== undefined
                ? tr(
                    `${formatBytes(data.usage)} usados de ${formatBytes(data.quota)} disponíveis para este site.`,
                    `${formatBytes(data.usage)} used of ${formatBytes(data.quota)} available for this site.`,
                    `${formatBytes(data.usage)} usados de ${formatBytes(data.quota)} disponibles para este sitio.`,
                  )
                : tr('O navegador não informa o espaço usado.', 'The browser does not report used space.', 'El navegador no informa el espacio usado.')}
            </p>
            {ratio !== undefined && (
              <div className="mt-2">
                <Progress value={ratio} />
              </div>
            )}
            <p className="mt-2 flex items-center gap-2 text-[15px]">
              <ShieldCheck size={18} aria-hidden className={data?.persisted ? 'text-primary' : 'text-muted'} />
              {data?.persisted === true
                ? tr(
                    'Armazenamento persistente: ativado (o navegador não apaga os dados quando faltar espaço).',
                    'Persistent storage: on (the browser will not erase data when space runs low).',
                    'Almacenamiento persistente: activado (el navegador no borra los datos si falta espacio).',
                  )
                : data?.persisted === false
                  ? tr('Armazenamento persistente: não ativado.', 'Persistent storage: off.', 'Almacenamiento persistente: no activado.')
                  : tr('Armazenamento persistente: não suportado neste navegador.', 'Persistent storage: not supported in this browser.', 'Almacenamiento persistente: no compatible con este navegador.')}
            </p>
            {offlineComplete() && (
              <p className="mt-2 flex items-center gap-2 text-[15px]">
                <CircleCheck size={18} aria-hidden className="text-primary" />
                {tr('Todo o conteúdo foi baixado para uso sem internet.', 'All content was downloaded for offline use.', 'Todo el contenido se descargó para usar sin internet.')}
              </p>
            )}
          </>
        )}
      </div>
      <Wrap>
        {data?.persisted === false && (
          <Button variant="tonal" icon={ShieldCheck} onClick={() => void persist()} disabled={asking}>
            {tr('Proteger dados contra limpeza automática', 'Protect data from automatic cleanup', 'Proteger datos contra limpieza automática')}
          </Button>
        )}
        <Button icon={CloudDownload} onClick={openOfflineAll}>
          {tr('Baixar tudo para usar sem internet', 'Download everything for offline use', 'Descargar todo para usar sin internet')}
        </Button>
        <Button variant="outlined" icon={HardDrive} onClick={() => openOffline()}>
          {t('offlinePacks')}
        </Button>
      </Wrap>
    </Section>
  );
}

// ---------------------------------------------------------------- migração
const COUNT_LABELS: [string, [string, string, string]][] = [
  ['notes', ['anotações', 'notes', 'notas']],
  ['highlights', ['destaques', 'highlights', 'resaltados']],
  ['bookmarks', ['favoritos', 'bookmarks', 'marcadores']],
  ['study_tabs', ['abas de estudo', 'study tabs', 'pestañas de estudio']],
  ['reading_history', ['leituras no histórico', 'history entries', 'lecturas en el historial']],
  ['flashcards', ['cartões', 'flashcards', 'tarjetas']],
  ['review_history', ['revisões', 'reviews', 'repasos']],
  ['learning_progress', ['estudos concluídos', 'completed studies', 'estudios completados']],
  ['preferences', ['preferências', 'preferences', 'preferencias']],
];
function countSummary(counts: Record<string, number> | undefined): string {
  if (!counts) return '';
  const index = lang() === 'en' ? 1 : lang() === 'es' ? 2 : 0;
  return COUNT_LABELS.filter(([key]) => (counts[key] ?? 0) > 0)
    .map(([key, names]) => `${counts[key]} ${names[index]}`)
    .join(' · ');
}

function MigrationSection() {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<'migrate' | 'delete' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const state = useAsync(async () => {
    const m = await import('../lib/migration');
    const [info, databases, source] = await Promise.all([m.migrationStatus(), m.legacyDatabases(), m.detectLegacy()]);
    return { info, databases, source };
  }, [tick]);
  const data = state.data;
  const size = data?.databases.reduce((sum, d) => sum + d.bytes, 0) ?? 0;
  const meta = data?.info.meta;

  const migrate = async () => {
    setBusy('migrate');
    setStatus(tr('Importando os dados da versão anterior…', 'Importing data from the previous version…', 'Importando los datos de la versión anterior…'));
    try {
      const m = await import('../lib/migration');
      const result = await m.runMigrationIfNeeded({ force: true });
      if (result.migrated) {
        const text = `${tr('Migração concluída', 'Migration complete', 'Migración completada')}: ${countSummary(result.counts) || tr('nada novo', 'nothing new', 'nada nuevo')}.`;
        setStatus([text, ...(result.warnings ?? [])].join(' '));
        message(text);
        // Tradução e última passagem importadas passam a valer já.
        initApp();
        refresh();
      } else {
        setStatus(
          result.error
            ? `${t('error')}: ${result.error}`
            : tr('Nenhum dado da versão anterior foi encontrado.', 'No data from the previous version was found.', 'No se encontraron datos de la versión anterior.'),
        );
      }
    } catch (error) {
      setStatus(`${t('error')}: ${errorText(error)}`);
    } finally {
      setBusy(null);
      setTick((n) => n + 1);
    }
  };

  const free = async () => {
    const question = meta
      ? tr(
          `Apagar os bancos da versão clássica (Flutter) deste navegador (≈ ${formatBytes(size)})? As anotações já importadas continuam aqui; a versão clássica, se aberta de novo, terá de baixar o conteúdo outra vez.`,
          `Delete the classic (Flutter) version databases from this browser (≈ ${formatBytes(size)})? Notes already imported stay here; the classic version, if opened again, will have to download its content again.`,
          `¿Borrar las bases de la versión clásica (Flutter) de este navegador (≈ ${formatBytes(size)})? Las notas ya importadas permanecen aquí; la versión clásica, si se abre de nuevo, tendrá que descargar su contenido otra vez.`,
        )
      : tr(
          `Os dados da versão anterior ainda NÃO foram importados. Apagar agora (≈ ${formatBytes(size)}) remove definitivamente as anotações da versão clássica deste navegador. Continuar mesmo assim?`,
          `Data from the previous version has NOT been imported yet. Deleting now (≈ ${formatBytes(size)}) permanently removes the classic version notes from this browser. Continue anyway?`,
          `Los datos de la versión anterior aún NO se importaron. Borrar ahora (≈ ${formatBytes(size)}) elimina definitivamente las notas de la versión clásica de este navegador. ¿Continuar de todos modos?`,
        );
    if (!window.confirm(question)) return;
    setBusy('delete');
    try {
      const m = await import('../lib/migration');
      const result = await m.deleteLegacy();
      await deleteCaches(isLegacyCache).catch(() => []);
      setStatus(
        result.blocked.length
          ? tr(
              'Feche a versão clássica aberta em outras abas para concluir a limpeza.',
              'Close the classic version open in other tabs to finish cleaning up.',
              'Cierre la versión clásica abierta en otras pestañas para terminar la limpieza.',
            )
          : tr(`Espaço liberado (≈ ${formatBytes(size)}).`, `Space freed (≈ ${formatBytes(size)}).`, `Espacio liberado (≈ ${formatBytes(size)}).`),
      );
    } catch (error) {
      setStatus(`${t('error')}: ${errorText(error)}`);
    } finally {
      setBusy(null);
      setTick((n) => n + 1);
    }
  };

  return (
    <Section title={t('migration')} icon={ArchiveRestore}>
      <div className="space-y-2 text-[15px]" aria-live="polite">
        {!data ? (
          <Small>{state.error ? `${t('error')}: ${errorText(state.error)}` : t('loading')}</Small>
        ) : (
          <>
            {meta ? (
              <p>
                {tr(
                  `Dados importados de ${meta.from} em ${formatDate(meta.at)}.`,
                  `Data imported from ${meta.from} on ${formatDate(meta.at)}.`,
                  `Datos importados de ${meta.from} el ${formatDate(meta.at)}.`,
                )}{' '}
                {countSummary(meta.counts)}
              </p>
            ) : data.source ? (
              <p>
                {tr(
                  'Há anotações e configurações da versão anterior (Flutter) neste navegador que ainda não foram importadas.',
                  'There are notes and settings from the previous (Flutter) version in this browser that were not imported yet.',
                  'Hay notas y configuración de la versión anterior (Flutter) en este navegador que aún no se importaron.',
                )}
              </p>
            ) : (
              <p>
                {tr(
                  'Nenhum dado da versão anterior (Flutter) foi encontrado neste navegador.',
                  'No data from the previous (Flutter) version was found in this browser.',
                  'No se encontraron datos de la versión anterior (Flutter) en este navegador.',
                )}
              </p>
            )}
            {meta?.warnings?.map((w) => (
              <Small key={w}>{w}</Small>
            ))}
            {!meta && data.info.failure && (
              <Small className="text-danger">{`${tr('Última tentativa falhou', 'Last attempt failed', 'El último intento falló')}: ${data.info.failure.error}`}</Small>
            )}
          </>
        )}
      </div>
      <Wrap>
        <Button variant="tonal" icon={busy === 'migrate' ? LoaderCircle : ArchiveRestore} onClick={() => void migrate()} disabled={!data?.source || busy !== null}>
          {meta ? tr('Importar novamente', 'Import again', 'Importar de nuevo') : tr('Migrar agora', 'Migrate now', 'Migrar ahora')}
        </Button>
        {data && data.databases.length > 0 && (
          <Button variant="outlined" icon={busy === 'delete' ? LoaderCircle : Trash2} onClick={() => void free()} disabled={busy !== null}>
            {tr('Liberar espaço da versão antiga', 'Free space from the old version', 'Liberar espacio de la versión anterior')} (≈ {formatBytes(size)})
          </Button>
        )}
      </Wrap>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {status}
      </p>
    </Section>
  );
}

// --------------------------------------------------------------------- backup
function downloadBlob(blob: Blob, name: string): string {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return url;
}

/** Exportar/restaurar (.zip ou .bibliaenc). Também usado na primeira configuração (somente restaurar). */
export function BackupPanel({ restoreOnly = false }: { restoreOnly?: boolean }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ url: string; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (saved) URL.revokeObjectURL(saved.url);
  }, [saved]);

  const exportNow = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const backup = await import('../lib/backup');
      const blob = await backup.exportBackup(password || undefined);
      const name = backup.backupFileName(!!password);
      setSaved({ url: downloadBlob(blob, name), name });
      setStatus(`${t('success')}: ${name}`);
    } catch (error) {
      setStatus(`${t('error')}: ${errorText(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const backup = await import('../lib/backup');
      const count = await backup.restoreBackup(file, password || undefined);
      refresh();
      setStatus(`${t('restore')}: ${count}`);
      message(`${t('restore')}: ${count}`);
    } catch (error) {
      setStatus(`${t('error')}: ${errorText(error)}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label={t('password')}
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {password.length > 0 && password.length < 8 && (
        <Small>{tr('Use pelo menos oito caracteres para exportar com senha.', 'Use at least eight characters to export with a password.', 'Use al menos ocho caracteres para exportar con contraseña.')}</Small>
      )}
      <Wrap>
        {!restoreOnly && (
          <Button icon={Archive} onClick={() => void exportNow()} disabled={busy}>
            {t('export')}
          </Button>
        )}
        <Button variant={restoreOnly ? 'tonal' : 'outlined'} icon={ArchiveRestore} onClick={() => input.current?.click()} disabled={busy}>
          {restoreOnly ? tr('Restaurar backup', 'Restore backup', 'Restaurar copia') : t('restore')}
        </Button>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".zip,.bibliaenc,application/zip,application/octet-stream"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void restore(file);
          }}
        />
      </Wrap>
      {busy && <Progress />}
      <div role="status" aria-live="polite" className="select-text text-[15px]">
        {status}
        {saved && !busy && (
          <a href={saved.url} download={saved.name} className="ml-2 inline-flex items-center gap-1 text-primary underline">
            <Download size={16} aria-hidden />
            {tr('Salvar novamente', 'Save again', 'Guardar de nuevo')}
          </a>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ licenças
const COMPONENT_LICENSES: [string, string][] = [
  ['React / React DOM', 'MIT'],
  ['@tanstack/react-virtual', 'MIT'],
  ['marked', 'MIT'],
  ['DOMPurify', 'Apache-2.0 / MPL-2.0'],
  ['fflate', 'MIT'],
  ['sql.js (SQLite)', 'MIT / Public Domain'],
  ['lucide-react', 'ISC'],
  ['fake-indexeddb', 'Apache-2.0'],
  [tr('Fontes de leitura (Google Fonts)', 'Reading fonts (Google Fonts)', 'Fuentes de lectura (Google Fonts)'), 'SIL Open Font License 1.1'],
];

const SHORTCUTS =
  'Ctrl+F · Pesquisa / Search\nCtrl+L · Passagem / Passage\nCtrl+E · Leitura / Estudo\nAlt+← / → · Capítulos\nAlt+1…5 · Áreas principais\nEsc · Fechar painéis / sair da tela cheia\nTab / Shift+Tab · Foco\nEnter / Espaço · Ativar';

function Expandable({ title, icon: Icon, children }: { title: string; icon: typeof Heart; children: ReactNode }) {
  return (
    <details className="group rounded-xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-3 text-[15.5px] hover:bg-on-surface/5">
        <Icon size={22} aria-hidden className="shrink-0 text-primary" />
        <span className="flex-1">{title}</span>
        <span aria-hidden className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="px-4 pb-3">{children}</div>
    </details>
  );
}

// ------------------------------------------------------------------- página
export default function SettingsPage() {
  useApp();
  const toggles: [string, string, boolean][] = [
    ['numbers', 'numbers', true],
    ['headings', 'headings', true],
    ['paragraphs', 'paragraphs', false],
    ['red', 'red', true],
    ['wholeBook', 'whole_book', false],
    ['contrast', 'contrast', false],
    ['reducedMotion', 'reduced_motion', false],
  ];
  return (
    <div className="mx-auto max-w-3xl p-[22px]">
      <AppearanceSettings />
      <Divider className="my-7" />
      <div>
        {toggles.map(([label, key, fallback]) => (
          <Toggle key={key} label={t(label)} checked={pref(key, fallback)} onChange={(v) => set(key, v)} />
        ))}
        <Toggle label={t('studyMode')} checked={isStudy()} onChange={(v) => set('study', v)} />
        <Toggle
          label={tr('Comentários em tela dividida', 'Split commentary panel', 'Comentarios en pantalla dividida')}
          checked={pref('split_comments', true)}
          onChange={(v) => set('split_comments', v)}
        />
      </div>
      <Divider className="my-7" />
      <UpdatesSection />
      <Divider className="my-7" />
      <InstallSection />
      <Divider className="my-7" />
      <StorageSection />
      <Divider className="my-7" />
      <MigrationSection />
      <Divider className="my-7" />
      <Section title={t('backup')} icon={Archive}>
        <BackupPanel />
      </Section>
      <Divider className="my-7" />
      <ListItem title={t('dedication')} leading={Heart} onClick={openDedication} trailing="chevron" />
      <Expandable title={t('keyboard')} icon={Keyboard}>
        <p className="select-text whitespace-pre-line text-[15px] leading-relaxed">{SHORTCUTS}</p>
      </Expandable>
      <a href="./classico.html" className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-on-surface/5">
        <BookOpen size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] leading-snug">{t('classic')}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {tr(
              'Abre a versão anterior do aplicativo (mais pesada), com os mesmos textos.',
              'Opens the previous version of the app (heavier), with the same texts.',
              'Abre la versión anterior de la aplicación (más pesada), con los mismos textos.',
            )}
          </span>
        </span>
        <ExternalLink size={18} aria-hidden className="mt-1 shrink-0 text-muted" />
      </a>
      <Expandable title={tr('Licenças dos componentes', 'Component licenses', 'Licencias de componentes')} icon={Scale}>
        <ul className="space-y-1 text-[15px]">
          {COMPONENT_LICENSES.map(([name, license]) => (
            <li key={name} className="flex flex-wrap justify-between gap-x-4">
              <span>{name}</span>
              <span className="text-muted">{license}</span>
            </li>
          ))}
        </ul>
        <Small className="mt-2">
          {tr(
            'As licenças de cada Bíblia, comentário e obra aparecem na Biblioteca, na página de cada módulo.',
            'The license of each Bible, commentary and work is shown in the Library, on each module page.',
            'La licencia de cada Biblia, comentario y obra aparece en la Biblioteca, en la página de cada módulo.',
          )}
        </Small>
      </Expandable>
      <div className="px-3 py-3">
        <p className="text-[15.5px]">Bíblia Reformada</p>
        <p className="mt-0.5 whitespace-pre-line text-sm text-muted">
          {`Criado por Kelvin e Silva Marques\nEm presente dedicatória à Rebeca Teles\n${tr('Versão', 'Version', 'Versión')} ${APP_VERSION}`}
        </p>
      </div>
      <p className="px-3 pb-2 text-[15px] leading-relaxed">
        {tr(
          'As edições bíblicas e obras teológicas conservam suas autorias e licenças próprias. Os guias em português são sínteses de estudo; consulte os textos confessionais completos e as fontes.',
          'Bible editions and theological works keep their own authorship and licenses. The Portuguese guides are study summaries; consult the complete confessional texts and the sources.',
          'Las ediciones bíblicas y obras teológicas conservan su autoría y licencias propias. Las guías en portugués son síntesis de estudio; consulte los textos confesionales completos y las fuentes.',
        )}
      </p>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mx-3 mb-4 inline-flex items-center gap-1.5 text-[15px] text-primary underline underline-offset-2"
      >
        {tr('Código-fonte no GitHub', 'Source code on GitHub', 'Código fuente en GitHub')}
        <ExternalLink size={16} aria-hidden />
        <span className="sr-only">{tr('(abre em nova aba)', '(opens in a new tab)', '(abre en una pestaña nueva)')}</span>
      </a>
    </div>
  );
}
