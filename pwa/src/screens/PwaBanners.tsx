// Aviso de nova versão, botão de instalação do cabeçalho e ajuda de instalação.
// UpdateBanner e InstallButton fazem parte do pacote inicial (App.tsx): sem dependências pesadas.
import {
  CircleCheck,
  CloudDownload,
  Download,
  LoaderCircle,
  Maximize,
  MonitorDown,
  RefreshCw,
  Smartphone,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { app, isFullscreen } from '../lib/app';
import { t, tr } from '../lib/i18n';
import { applyUpdate, browserName, platform, promptInstall, usePwa } from '../lib/pwa';
import { Button, Heading, IconButton, Small } from '../components/ui';
import { openInstallHelp, openOffline } from './open';

/** Abre o gerenciador offline já iniciando "Baixar tudo" (assinatura estendida em open.tsx). */
export function openOfflineAll(): void {
  openOffline({ autoStart: 'all' });
}

/** "1" quando o download completo terminou (lib/offline.ts); leitura defensiva. */
function offlineComplete(): boolean {
  try {
    return localStorage.getItem('km-offline-full') === '1';
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------- atualização
const LATER_KEY = 'km-update-later';
function laterFor(): string | null {
  try {
    return sessionStorage.getItem(LATER_KEY);
  } catch {
    return null;
  }
}

export function UpdateBanner() {
  const pwa = usePwa();
  const build = pwa.remote?.build ?? 'pending';
  const [hiddenBuild, setHiddenBuild] = useState<string | null>(laterFor);
  const force = pwa.remote?.force === true;
  const [seconds, setSeconds] = useState(5);
  const started = useRef(false);
  const visible = pwa.updating || (pwa.updateReady && (force || hiddenBuild !== build));

  const update = () => {
    if (started.current) return;
    started.current = true;
    void applyUpdate();
  };

  // Publicação obrigatória: contagem regressiva de 5 s e atualização automática.
  const counting = pwa.updateReady && force && !pwa.updating;
  useEffect(() => {
    if (!counting) return;
    setSeconds(5);
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [counting]);
  useEffect(() => {
    if (counting && seconds === 0) update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting, seconds]);

  // Região viva sempre presente: leitores de tela anunciam quando o aviso aparece.
  const announcement = !visible
    ? ''
    : pwa.updating
      ? tr('Atualizando o aplicativo.', 'Updating the app.', 'Actualizando la aplicación.')
      : force
        ? tr(
            'Nova versão obrigatória: será aplicada automaticamente em 5 segundos.',
            'Required new version: it will be applied automatically in 5 seconds.',
            'Nueva versión obligatoria: se aplicará automáticamente en 5 segundos.',
          )
        : t('updateReady');
  const live = (
    <div aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
  if (!visible) return live;
  const later = () => {
    try {
      sessionStorage.setItem(LATER_KEY, build);
    } catch {
      /* sem sessionStorage: oculta só nesta tela */
    }
    setHiddenBuild(build);
  };
  const full = isFullscreen() && app.area === 0;
  const version = pwa.remote?.version;
  const notes = (pwa.remote?.notes ?? []).filter((n) => typeof n === 'string' && n.trim()).slice(0, 3);

  return (
    <>
    {live}
    <section
      aria-labelledby="km-update-title"
      className="fixed inset-x-0 z-[60] mx-auto w-full max-w-lg px-3"
      style={{ bottom: full ? 'calc(var(--safe-bottom) + 12px)' : 'calc(var(--safe-bottom) + 80px)' }}
    >
      <div className="rounded-2xl bg-surface-high p-4 shadow-xl ring-1 ring-outline/50">
        {pwa.updating ? (
          <p id="km-update-title" className="flex items-center gap-3 text-[15px]">
            <LoaderCircle size={20} aria-hidden className="shrink-0 animate-spin text-primary" />
            {tr(
              'Atualizando… suas anotações e configurações são preservadas.',
              'Updating… your notes and settings are kept.',
              'Actualizando… sus notas y configuración se conservan.',
            )}
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <RefreshCw size={22} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h2 id="km-update-title" className="text-[16px] font-semibold">
                  {t('updateReady')}
                  {version ? ` · ${tr('versão', 'version', 'versión')} ${version}` : ''}
                </h2>
                {force ? (
                  <p className="mt-1 text-sm" aria-hidden>
                    {version
                      ? tr(
                          `Atualizando para a versão ${version} em ${seconds} s...`,
                          `Updating to version ${version} in ${seconds} s...`,
                          `Actualizando a la versión ${version} en ${seconds} s...`,
                        )
                      : tr(`Atualizando em ${seconds} s...`, `Updating in ${seconds} s...`, `Actualizando en ${seconds} s...`)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {tr(
                      'Anotações, favoritos e configurações não são apagados.',
                      'Notes, bookmarks and settings are not erased.',
                      'Las notas, marcadores y configuración no se borran.',
                    )}
                  </p>
                )}
                {notes.length > 0 && (
                  <ul className="mt-1.5 list-disc pl-5 text-sm">
                    {notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {!force && (
                <Button variant="text" onClick={later}>
                  {t('later')}
                </Button>
              )}
              <Button onClick={update}>{t('updateNow')}</Button>
            </div>
          </>
        )}
      </div>
    </section>
    </>
  );
}

// ------------------------------------------------------------------ instalação
export function InstallButton() {
  const pwa = usePwa();
  const ios = useMemo(() => platform() === 'ios', []);
  if (pwa.standalone) {
    // iPhone/iPad: depois de instalado, oferece baixar tudo para uso sem internet.
    if (ios && !offlineComplete()) {
      return <IconButton label={tr('Baixar para uso offline', 'Download for offline use', 'Descargar para usar sin conexión')} icon={CloudDownload} onClick={openOfflineAll} />;
    }
    return null;
  }
  if (!pwa.installAvailable && !ios) return null;
  const install = async () => {
    if (pwa.installAvailable && (await promptInstall()) !== 'unavailable') return;
    openInstallHelp();
  };
  return <IconButton label={t('installApp')} icon={Download} onClick={() => void install()} />;
}

type HelpId = 'android-chrome' | 'samsung' | 'firefox-android' | 'ios' | 'desktop-chromium' | 'desktop-firefox' | 'desktop-safari';

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1.5 pl-6 text-[15px] leading-relaxed">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  );
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>;

function helpSections(standalone: boolean): Record<HelpId, { title: string; body: ReactNode }> {
  return {
    'android-chrome': {
      title: tr('Android — Chrome', 'Android — Chrome', 'Android — Chrome'),
      body: (
        <Steps
          items={[
            <>{tr('Toque no menu', 'Tap the menu', 'Toque el menú')} <B>⋮</B> {tr('(canto superior direito).', '(top right corner).', '(esquina superior derecha).')}</>,
            <>
              {tr('Toque em', 'Tap', 'Toque')} <B>{tr('Instalar app', 'Install app', 'Instalar aplicación')}</B> {tr('ou', 'or', 'o')}{' '}
              <B>{tr('Adicionar à tela inicial', 'Add to Home screen', 'Agregar a la pantalla principal')}</B>.
            </>,
            <>{tr('Confirme em', 'Confirm with', 'Confirme en')} <B>{tr('Instalar', 'Install', 'Instalar')}</B>.</>,
          ]}
        />
      ),
    },
    samsung: {
      title: 'Android — Samsung Internet',
      body: (
        <Steps
          items={[
            <>
              {tr('Toque no ícone de instalação na barra de endereço, se aparecer; ou toque no menu', 'Tap the install icon in the address bar, if shown; or tap the menu', 'Toque el icono de instalación en la barra de direcciones, si aparece; o toque el menú')}{' '}
              <B>☰</B> {tr('na barra inferior.', 'in the bottom bar.', 'en la barra inferior.')}
            </>,
            <>
              {tr('Toque em', 'Tap', 'Toque')} <B>{tr('Adicionar página a', 'Add page to', 'Agregar página a')}</B> → <B>{tr('Tela inicial', 'Home screen', 'Pantalla de inicio')}</B>.
            </>,
            <>{tr('Confirme em', 'Confirm with', 'Confirme en')} <B>{tr('Adicionar', 'Add', 'Agregar')}</B>.</>,
          ]}
        />
      ),
    },
    'firefox-android': {
      title: 'Android — Firefox',
      body: (
        <Steps
          items={[
            <>{tr('Toque no menu', 'Tap the menu', 'Toque el menú')} <B>⋮</B>.</>,
            <>
              {tr('Toque em', 'Tap', 'Toque')} <B>{tr('Instalar', 'Install', 'Instalar')}</B> {tr('ou', 'or', 'o')}{' '}
              <B>{tr('Adicionar à tela inicial', 'Add to Home screen', 'Agregar a la pantalla de inicio')}</B>.
            </>,
            <>{tr('Confirme em', 'Confirm with', 'Confirme en')} <B>{tr('Adicionar', 'Add', 'Agregar')}</B>.</>,
          ]}
        />
      ),
    },
    ios: {
      title: tr('iPhone e iPad — Safari', 'iPhone and iPad — Safari', 'iPhone y iPad — Safari'),
      body: (
        <>
          <Steps
            items={[
              <>{tr('Abra este site no', 'Open this site in', 'Abra este sitio en')} <B>Safari</B>.</>,
              <>
                {tr('Toque em', 'Tap', 'Toque')} <B>{tr('Compartilhar', 'Share', 'Compartir')}</B>{' '}
                {tr(
                  '(quadrado com seta para cima, na barra inferior do iPhone ou no alto do iPad).',
                  '(square with an up arrow, in the bottom bar on iPhone or at the top on iPad).',
                  '(cuadrado con flecha hacia arriba, abajo en el iPhone o arriba en el iPad).',
                )}
              </>,
              <>
                {tr('Role a lista e toque em', 'Scroll the list and tap', 'Desplace la lista y toque')} <B>{tr('Adicionar à Tela de Início', 'Add to Home Screen', 'Agregar a inicio')}</B>.
              </>,
              <>{tr('Toque em', 'Tap', 'Toque')} <B>{tr('Adicionar', 'Add', 'Agregar')}</B> {tr('(canto superior direito).', '(top right corner).', '(esquina superior derecha).')}</>,
              <>{tr('Abra a Bíblia Lumen pelo novo ícone na Tela de Início.', 'Open Bíblia Lumen from the new Home Screen icon.', 'Abra Bíblia Lumen desde el nuevo icono de inicio.')}</>,
            ]}
          />
          <p className="mt-3 text-[15px] leading-relaxed">
            <B>{tr('Chrome, Edge ou Firefox no iPhone:', 'Chrome, Edge or Firefox on iPhone:', 'Chrome, Edge o Firefox en iPhone:')}</B>{' '}
            {tr(
              'toque em Compartilhar (ícone na barra de endereço ou no menu) e depois em Adicionar à Tela de Início. Em versões do iOS anteriores à 16.4, outros navegadores não instalam aplicativos: use o Safari.',
              'tap Share (icon in the address bar or in the menu) and then Add to Home Screen. On iOS versions before 16.4, other browsers cannot install apps: use Safari.',
              'toque Compartir (icono en la barra de direcciones o en el menú) y luego Agregar a inicio. En versiones de iOS anteriores a 16.4, otros navegadores no instalan aplicaciones: use Safari.',
            )}
          </p>
          <div className="mt-4 rounded-xl bg-secondary-container p-3">
            <p className="text-[15px] leading-relaxed">
              {tr(
                'Para ler sem internet, baixe todo o conteúdo pelo aplicativo instalado. No iPhone, o app aberto pela Tela de Início tem armazenamento próprio, separado do Safari: faça o download depois de abri-lo pelo ícone.',
                'To read without internet, download all content from the installed app. On iPhone, the app opened from the Home Screen has its own storage, separate from Safari: download after opening it from the icon.',
                'Para leer sin internet, descargue todo el contenido desde la aplicación instalada. En el iPhone, la app abierta desde inicio tiene almacenamiento propio, separado de Safari: descargue después de abrirla desde el icono.',
              )}
            </p>
            <Button className="mt-3" icon={CloudDownload} onClick={openOfflineAll}>
              {tr('Baixar tudo para usar sem internet', 'Download everything for offline use', 'Descargar todo para usar sin internet')}
            </Button>
            {!standalone && (
              <Small className="mt-2">
                {tr(
                  'Você ainda está no navegador: o download feito aqui fica no Safari e não no aplicativo instalado.',
                  'You are still in the browser: a download made here stays in Safari, not in the installed app.',
                  'Aún está en el navegador: la descarga hecha aquí queda en Safari y no en la aplicación instalada.',
                )}
              </Small>
            )}
          </div>
        </>
      ),
    },
    'desktop-chromium': {
      title: tr('Computador — Chrome ou Edge', 'Computer — Chrome or Edge', 'Computadora — Chrome o Edge'),
      body: (
        <Steps
          items={[
            <>
              {tr('Clique no ícone de instalação na barra de endereço (monitor com seta) ', 'Click the install icon in the address bar (monitor with an arrow) ', 'Haga clic en el icono de instalación en la barra de direcciones (monitor con flecha) ')}
              {tr('ou abra o menu', 'or open the menu', 'o abra el menú')} <B>⋮</B> / <B>…</B>.
            </>,
            <>
              {tr('Escolha', 'Choose', 'Elija')} <B>{tr('Instalar Bíblia Lumen', 'Install Bíblia Lumen', 'Instalar Bíblia Lumen')}</B>{' '}
              {tr('(no Edge: Aplicativos → Instalar este site como aplicativo).', '(in Edge: Apps → Install this site as an app).', '(en Edge: Aplicaciones → Instalar este sitio como aplicación).')}
            </>,
            <>{tr('Confirme em', 'Confirm with', 'Confirme en')} <B>{tr('Instalar', 'Install', 'Instalar')}</B>.</>,
          ]}
        />
      ),
    },
    'desktop-firefox': {
      title: tr('Computador — Firefox', 'Computer — Firefox', 'Computadora — Firefox'),
      body: (
        <p className="mt-2 text-[15px] leading-relaxed">
          {tr(
            'O Firefox para computador não instala aplicativos da Web. Use o Chrome ou o Edge para instalar, ou mantenha um favorito (Ctrl+D): o conteúdo já lido continua disponível sem internet neste navegador.',
            'Firefox for desktop does not install web apps. Use Chrome or Edge to install, or keep a bookmark (Ctrl+D): content you already read stays available offline in this browser.',
            'Firefox para computadora no instala aplicaciones web. Use Chrome o Edge para instalar, o guarde un marcador (Ctrl+D): el contenido ya leído sigue disponible sin internet en este navegador.',
          )}
        </p>
      ),
    },
    'desktop-safari': {
      title: tr('Mac — Safari', 'Mac — Safari', 'Mac — Safari'),
      body: (
        <Steps
          items={[
            <>{tr('No Safari 17 (macOS Sonoma) ou posterior, abra o menu', 'In Safari 17 (macOS Sonoma) or later, open the menu', 'En Safari 17 (macOS Sonoma) o posterior, abra el menú')} <B>{tr('Arquivo', 'File', 'Archivo')}</B>.</>,
            <>{tr('Escolha', 'Choose', 'Elija')} <B>{tr('Adicionar ao Dock', 'Add to Dock', 'Añadir al Dock')}</B> {tr('e confirme.', 'and confirm.', 'y confirme.')}</>,
          ]}
        />
      ),
    },
  };
}

function currentHelp(): HelpId {
  const p = platform();
  const browser = browserName();
  if (p === 'ios') return 'ios';
  if (p === 'android') return browser === 'samsung' ? 'samsung' : browser === 'firefox' ? 'firefox-android' : 'android-chrome';
  if (browser === 'firefox') return 'desktop-firefox';
  if (browser === 'safari') return 'desktop-safari';
  return 'desktop-chromium';
}

export function InstallHelp() {
  const pwa = usePwa();
  const current = useMemo(currentHelp, []);
  const sections = helpSections(pwa.standalone);
  const others = (Object.keys(sections) as HelpId[]).filter((id) => id !== current);
  const [status, setStatus] = useState<string | null>(null);
  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') setStatus(t('installed_app'));
    else if (outcome === 'unavailable') setStatus(tr('O navegador não ofereceu a instalação: siga os passos abaixo.', 'The browser did not offer installation: follow the steps below.', 'El navegador no ofreció la instalación: siga los pasos de abajo.'));
  };

  return (
    <div className="mx-auto max-w-3xl p-5">
      {pwa.standalone || pwa.installed ? (
        <p className="flex items-center gap-2 rounded-xl bg-secondary-container p-3 text-[15px]">
          <CircleCheck size={20} aria-hidden className="shrink-0 text-primary" />
          {pwa.standalone
            ? tr('Você já está usando o aplicativo instalado.', 'You are already using the installed app.', 'Ya está usando la aplicación instalada.')
            : t('installed_app')}
        </p>
      ) : (
        pwa.installAvailable && (
          <Button icon={MonitorDown} onClick={() => void install()}>
            {tr('Instalar agora', 'Install now', 'Instalar ahora')}
          </Button>
        )
      )}
      <p role="status" aria-live="polite" className="mt-2 text-sm text-muted">
        {status}
      </p>

      <Heading className="mt-3">{sections[current].title}</Heading>
      <Small className="mt-1">{tr('Detectado neste aparelho.', 'Detected on this device.', 'Detectado en este dispositivo.')}</Small>
      {sections[current].body}

      <Heading level={3} className="mt-6">
        {tr('Vantagens do aplicativo instalado', 'Benefits of the installed app', 'Ventajas de la aplicación instalada')}
      </Heading>
      <ul className="mt-2 space-y-2 text-[15px]">
        {[
          [WifiOff, tr('Funciona sem internet: o que você já leu e o conteúdo baixado.', 'Works offline: what you already read and downloaded content.', 'Funciona sin internet: lo que ya leyó y el contenido descargado.')],
          [Maximize, tr('Tela cheia, sem a barra do navegador.', 'Full screen, without the browser bar.', 'Pantalla completa, sin la barra del navegador.')],
          [Zap, tr('Abre mais rápido, direto da tela inicial.', 'Starts faster, right from the home screen.', 'Abre más rápido, directo desde la pantalla de inicio.')],
          [Smartphone, tr('Atualiza sozinho, sem apagar anotações.', 'Updates itself without erasing notes.', 'Se actualiza solo, sin borrar notas.')],
        ].map(([Icon, text]) => {
          const I = Icon as typeof Zap;
          return (
            <li key={text as string} className="flex items-start gap-3">
              <I size={20} aria-hidden className="mt-0.5 shrink-0 text-primary" />
              <span>{text as string}</span>
            </li>
          );
        })}
      </ul>

      <Heading level={3} className="mt-6">
        {tr('Outros aparelhos e navegadores', 'Other devices and browsers', 'Otros dispositivos y navegadores')}
      </Heading>
      <div className="mt-2 space-y-2">
        {others.map((id) => (
          <details key={id} className="rounded-xl bg-surface-low px-4 py-2 ring-1 ring-outline/30">
            <summary className="cursor-pointer py-1.5 text-[15.5px] font-medium">{sections[id].title}</summary>
            <div className="pb-2">{sections[id].body}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
