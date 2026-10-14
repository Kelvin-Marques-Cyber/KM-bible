// DedicationPage e FirstSetup (lib/main.dart). App mostra <Onboarding/> enquanto
// dedication_seen ou onboarding_done forem falsos; openDedication() reabre a dedicatória.
import { ArchiveRestore, BookOpenText, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import fontInfo from '../generated/fonts.json';
import { closeSheet, initApp, refresh, set, useApp } from '../lib/app';
import { siteBase } from '../lib/catalog';
import { t, tr } from '../lib/i18n';
import { pref } from '../lib/store';
import { ensureFont, fontStack } from '../lib/themes';
import { Button, message } from '../components/ui';
import { AppearanceSettings, BackupPanel } from './Settings';

export default function Onboarding() {
  useApp();
  return !pref('dedication_seen', false) ? <DedicationPage first /> : <FirstSetup />;
}

export function DedicationPage({ first = false }: { first?: boolean }) {
  const done = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ensureFont('EBGaramond', siteBase(), fontInfo.format);
    button.current?.focus();
  }, []);

  const proceed = () => {
    if (done.current) return;
    done.current = true;
    if (first) set('dedication_seen', true);
    else closeSheet();
  };

  // Como o Focus(autofocus) + Shortcuts do original: Enter ou Espaço em qualquer ponto continuam.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target instanceof Element ? event.target : null;
      // Botões e campos focados respondem por si (evita fechar duas folhas de uma vez).
      if (target?.closest('button, a, input, textarea, select, summary, [contenteditable=true]')) return;
      event.preventDefault();
      proceed();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first]);

  // Na primeira abertura é a página inteira; reaberta, fica dentro de uma folha (sem outro <main>).
  const Container = first ? 'main' : 'div';
  return (
    <Container
      className={`flex items-center justify-center bg-surface p-8 font-ui text-on-surface ${first ? 'min-h-full' : 'min-h-[70vh]'}`}
      style={first ? { paddingTop: 'calc(var(--safe-top) + 32px)', paddingBottom: 'calc(var(--safe-bottom) + 32px)' } : undefined}
    >
      <div className="flex max-w-xl flex-col items-center text-center">
        <BookOpenText size={60} aria-hidden className="text-primary" />
        <p className="mt-8 text-[32px] leading-[1.4]" style={{ fontFamily: fontStack('EBGaramond') }}>
          Em presente dedicatória à Rebeca Teles
        </p>
        <button
          ref={button}
          type="button"
          onClick={proceed}
          className="mt-10 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-7 py-2 text-[15px] font-medium text-on-primary transition hover:brightness-110"
        >
          {t('continue')}
        </button>
      </div>
    </Container>
  );
}

function LegacyNotice() {
  const [state, setState] = useState<'checking' | 'found' | 'none' | 'running'>('checking');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Barato quando não há nada: indexedDB.databases(); o sql.js só é baixado ao importar.
    void import('../lib/migration')
      .then(async (m) => {
        const [info, source] = await Promise.all([m.migrationStatus(), m.detectLegacy()]);
        if (alive) setState(source && !info.meta ? 'found' : 'none');
      })
      .catch(() => alive && setState('none'));
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'checking' || state === 'none') {
    return status ? (
      <p role="status" className="text-[15px]">
        {status}
      </p>
    ) : null;
  }

  const migrate = async () => {
    setState('running');
    setStatus(tr('Importando os dados da versão anterior…', 'Importing data from the previous version…', 'Importando los datos de la versión anterior…'));
    try {
      const m = await import('../lib/migration');
      const result = await m.runMigrationIfNeeded({ force: true });
      if (result.migrated) {
        const notes = result.counts?.notes ?? 0;
        const text = tr(
          `Dados importados: ${notes} anotações e suas configurações.`,
          `Data imported: ${notes} notes and your settings.`,
          `Datos importados: ${notes} notas y su configuración.`,
        );
        // Tradução e última passagem da versão anterior passam a valer já.
        initApp();
        refresh();
        message(text);
        setStatus(text);
        setState('none');
      } else {
        setStatus(result.error ? `${t('error')}: ${result.error}` : tr('Nada para importar.', 'Nothing to import.', 'Nada para importar.'));
        setState(result.error ? 'found' : 'none');
      }
    } catch (error) {
      setStatus(`${t('error')}: ${String((error as Error)?.message ?? error)}`);
      setState('found');
    }
  };

  return (
    <section aria-labelledby="km-legacy-title" className="rounded-2xl bg-secondary-container p-4">
      <h2 id="km-legacy-title" className="text-[17px] font-semibold">
        {tr('Dados da versão anterior encontrados', 'Data from the previous version found', 'Datos de la versión anterior encontrados')}
      </h2>
      <p className="mt-1 text-[15px] leading-relaxed">
        {tr(
          'Este navegador tem anotações, destaques e configurações da versão anterior da Bíblia Reformada. Importe-os para continuar de onde parou; a versão antiga não é apagada.',
          'This browser has notes, highlights and settings from the previous version of Bíblia Reformada. Import them to continue where you left off; the old version is not erased.',
          'Este navegador tiene notas, resaltados y configuración de la versión anterior de Bíblia Reformada. Impórtelos para continuar donde quedó; la versión anterior no se borra.',
        )}
      </p>
      <Button className="mt-3" icon={state === 'running' ? LoaderCircle : ArchiveRestore} onClick={() => void migrate()} disabled={state === 'running'}>
        {tr('Importar dados da versão anterior', 'Import data from the previous version', 'Importar datos de la versión anterior')}
      </Button>
      <p role="status" aria-live="polite" className="mt-2 text-sm">
        {status}
      </p>
    </section>
  );
}

function FirstSetup() {
  const [restoring, setRestoring] = useState(false);
  return (
    <div className="flex h-full flex-col bg-surface font-ui text-on-surface">
      <header className="border-b border-outline/40 px-5 py-3" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <h1 className="text-[21px]">Bíblia Reformada</h1>
      </header>
      <main className="scroll-area min-h-0 flex-1" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <p className="text-[28px] leading-snug" style={{ fontFamily: fontStack('EBGaramond') }}>
            A Bíblia no centro. Sua leitura e seus estudos, no seu dispositivo.
          </p>
          <LegacyNotice />
          <AppearanceSettings />
          <section aria-labelledby="km-restore-title" className="rounded-2xl bg-surface-low p-4 ring-1 ring-outline/30">
            <h2 id="km-restore-title" className="text-[17px] font-semibold">
              {tr('Já usa a Bíblia Reformada?', 'Already use Bíblia Reformada?', '¿Ya usa Bíblia Reformada?')}
            </h2>
            <p className="mt-1 text-[15px] text-muted">
              {tr(
                'Restaure um backup (.zip ou .bibliaenc) exportado do aplicativo Android, da versão Web ou deste aplicativo.',
                'Restore a backup (.zip or .bibliaenc) exported from the Android app, the web version or this app.',
                'Restaure una copia (.zip o .bibliaenc) exportada de la aplicación Android, de la versión web o de esta aplicación.',
              )}
            </p>
            {restoring ? (
              <div className="mt-3">
                <BackupPanel restoreOnly />
              </div>
            ) : (
              <Button variant="tonal" className="mt-3" icon={ArchiveRestore} onClick={() => setRestoring(true)}>
                {tr('Restaurar backup', 'Restore backup', 'Restaurar copia')}
              </Button>
            )}
          </section>
          <Button className="w-full sm:w-auto" onClick={() => set('onboarding_done', true)}>
            {t('skip')}
          </Button>
        </div>
      </main>
    </div>
  );
}
