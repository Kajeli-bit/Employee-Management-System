import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const PwaInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(() =>
    typeof window !== "undefined" && isInstalled()
  );
  const [dismissed, setDismissed] = useState(false);
  const [offlineNoticeDismissed, setOfflineNoticeDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const handleInstallAvailable = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setDismissed(false);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const showUpdate = needRefresh;
  const showOfflineReady = offlineReady && !needRefresh && !offlineNoticeDismissed;
  const showInstall = installEvent && !installed && !dismissed;

  if (!showUpdate && !showOfflineReady && !showInstall) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="App availability"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-[0_18px_55px_rgba(39,17,54,0.22)] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[min(28rem,calc(100vw-2.5rem))]"
    >
      {showUpdate && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-brand-950">A new version is ready</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Refresh to use the latest Nilric Staff Portal.</p>
          </div>
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="shrink-0 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Refresh
          </button>
        </div>
      )}

      {showOfflineReady && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-brand-950">App shell ready offline</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Sign-in and company data still need an internet connection.</p>
          </div>
          <button
            type="button"
            onClick={() => setOfflineNoticeDismissed(true)}
            aria-label="Dismiss offline readiness message"
            className="rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {showInstall && (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-brand-950">Keep Nilric close</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">Install the staff portal for a focused, app-like experience.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-700"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={install}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              Install
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default PwaInstallPrompt;
