// Tela de recuperação: exibida quando as últimas aberturas falharam antes de
// desenhar a tela (veja bootStarted em lib/pwa.ts). Leve de propósito — é
// importada diretamente por main.tsx.
import { BookOpen, LifeBuoy, LoaderCircle, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t, tr } from '../lib/i18n';
import { APP_VERSION } from '../lib/pwa';
import { clearAppCache } from '../lib/settings-caches';
import { pref } from '../lib/store';
import { selectedTheme, themeVariables } from '../lib/themes';
import { Button } from '../components/ui';

export function Recovery({ onContinue }: { onContinue: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // App ainda não aplicou o tema: usa o tema salvo para não ofuscar em modo escuro.
  useEffect(() => {
    try {
      const theme = selectedTheme(pref('theme', 'sepia'));
      const root = document.documentElement;
      for (const [k, v] of Object.entries(themeVariables(theme, pref('contrast', false)))) root.style.setProperty(k, v);
      root.style.colorScheme = theme.dark ? 'dark' : 'light';
    } catch {
      /* mantém as cores padrão */
    }
  }, []);

  const clearCache = async () => {
    setBusy(true);
    setStatus(tr('Limpando o cache do aplicativo…', 'Clearing the app cache…', 'Limpiando la caché de la aplicación…'));
    try {
      const result = await clearAppCache();
      setStatus(
        tr(
          `Cache limpo (${result.caches.length} armazenamentos, ${result.workers} service workers). Recarregando…`,
          `Cache cleared (${result.caches.length} caches, ${result.workers} service workers). Reloading…`,
          `Caché limpiada (${result.caches.length} cachés, ${result.workers} service workers). Recargando…`,
        ),
      );
      setTimeout(() => location.reload(), 600);
    } catch (error) {
      setBusy(false);
      setStatus(`${t('error')}: ${String((error as Error)?.message ?? error)}`);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-surface p-5 font-ui text-on-surface" style={{ paddingTop: 'calc(var(--safe-top) + 20px)' }}>
      <div className="w-full max-w-lg">
        <LifeBuoy size={48} aria-hidden className="mb-4 text-primary" />
        <h1 className="text-2xl font-semibold leading-snug">
          {tr('O aplicativo não abriu corretamente', 'The app did not open correctly', 'La aplicación no se abrió correctamente')}
        </h1>
        <p className="mt-3 text-[15.5px] leading-relaxed">
          {tr(
            'A Bíblia Reformada não conseguiu abrir nas últimas tentativas. Isso costuma acontecer quando uma atualização foi interrompida ou o navegador guardou arquivos antigos.',
            'Bíblia Reformada could not open in the last attempts. This usually happens when an update was interrupted or the browser kept old files.',
            'Bíblia Reformada no pudo abrirse en los últimos intentos. Suele ocurrir cuando una actualización se interrumpió o el navegador guardó archivos antiguos.',
          )}
        </p>
        <p className="mt-3 rounded-xl bg-secondary-container p-3 text-[15px] leading-relaxed">
          {tr(
            'Seus dados estão seguros: anotações, destaques, favoritos, cartões de memorização e configurações ficam guardados neste aparelho e não são apagados por nenhuma das opções abaixo.',
            'Your data is safe: notes, highlights, bookmarks, flashcards and settings are kept on this device and are not erased by any of the options below.',
            'Sus datos están seguros: notas, resaltados, marcadores, tarjetas y configuración se guardan en este dispositivo y ninguna de las opciones de abajo los borra.',
          )}
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Button icon={RefreshCw} onClick={() => location.reload()} disabled={busy}>
            {tr('Recarregar', 'Reload', 'Recargar')}
          </Button>
          <Button variant="tonal" icon={busy ? LoaderCircle : Trash2} onClick={() => void clearCache()} disabled={busy}>
            {tr('Limpar cache do aplicativo (mantém anotações)', 'Clear app cache (keeps notes)', 'Limpiar caché de la aplicación (mantiene notas)')}
          </Button>
          <a
            href="./classico.html"
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-outline px-4 py-2 text-[15px] font-medium text-primary transition hover:bg-primary/5"
          >
            <BookOpen size={18} aria-hidden />
            {tr('Abrir versão clássica', 'Open classic version', 'Abrir versión clásica')}
          </a>
          <Button variant="text" icon={Undo2} onClick={onContinue} disabled={busy}>
            {tr('Continuar mesmo assim', 'Continue anyway', 'Continuar de todos modos')}
          </Button>
        </div>
        <p role="status" aria-live="polite" className="mt-4 min-h-[1.5em] text-sm text-muted">
          {status}
        </p>
        <p className="mt-2 text-xs text-muted">
          {tr('Versão', 'Version', 'Versión')} {APP_VERSION}
        </p>
      </div>
    </main>
  );
}
