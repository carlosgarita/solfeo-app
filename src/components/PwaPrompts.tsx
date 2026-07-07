import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * Superposición discreta que ofrece:
 *   1. Instalar la app cuando el navegador emite `beforeinstallprompt`
 *      (Chrome/Edge en Android/Desktop).
 *   2. Recargar cuando el service worker detecta contenido nuevo.
 *
 * En iOS Safari no existe `beforeinstallprompt`; en su lugar mostramos
 * una tarjeta informativa la primera vez que se abre en Safari móvil.
 */
export function PwaPrompts() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Comprobar actualizaciones cada hora mientras la app esté abierta.
      if (!r) return;
      setInterval(
        () => {
          void r.update();
        },
        60 * 60 * 1000,
      );
    },
  });

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    // Ya está instalada como app: no mostrar nada.
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Safari en iOS reporta `navigator.standalone` cuando la app se abrió como PWA.
    if ((navigator as unknown as { standalone?: boolean }).standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari: mostrar un tip la primera vez (se persiste el "no volver a mostrar").
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const hintDismissed = localStorage.getItem('solfeo:ios-install-hint') === 'dismissed';
    if (isIos && isSafari && !hintDismissed) {
      setShowIosHint(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const doInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    } else {
      setInstallDismissed(true);
    }
  };

  const dismissIosHint = () => {
    localStorage.setItem('solfeo:ios-install-hint', 'dismissed');
    setShowIosHint(false);
  };

  const dismissInstall = () => setInstallDismissed(true);

  const showInstallBanner = installEvent && !installDismissed;

  if (!needRefresh && !showInstallBanner && !showIosHint) return null;

  return (
    <div className="pwa-prompts" role="region" aria-label="Notificaciones de la app">
      {needRefresh && (
        <div className="pwa-toast">
          <div className="pwa-toast-content">
            <strong>Actualización disponible</strong>
            <span>Hay una nueva versión de Solfeo lista.</span>
          </div>
          <div className="pwa-toast-actions">
            <button className="btn btn-ghost pwa-btn" onClick={() => setNeedRefresh(false)}>
              Después
            </button>
            <button className="btn btn-primary pwa-btn" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </button>
          </div>
        </div>
      )}

      {showInstallBanner && (
        <div className="pwa-toast">
          <div className="pwa-toast-content">
            <strong>Instalar Solfeo</strong>
            <span>Añádelo a tu pantalla de inicio y úsalo como app.</span>
          </div>
          <div className="pwa-toast-actions">
            <button className="btn btn-ghost pwa-btn" onClick={dismissInstall}>
              Ahora no
            </button>
            <button className="btn btn-primary pwa-btn" onClick={doInstall}>
              Instalar
            </button>
          </div>
        </div>
      )}

      {showIosHint && (
        <div className="pwa-toast">
          <div className="pwa-toast-content">
            <strong>Añadir a pantalla de inicio</strong>
            <span>
              Toca <span className="pwa-ios-icon" aria-label="Compartir">⎋</span> Compartir y elige{' '}
              <em>Añadir a pantalla de inicio</em> para usar Solfeo como app.
            </span>
          </div>
          <div className="pwa-toast-actions">
            <button className="btn btn-ghost pwa-btn" onClick={dismissIosHint}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
