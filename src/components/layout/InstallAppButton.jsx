import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

// "Install app" in the top bar. Android/desktop Chrome and Edge offer a real
// install prompt (beforeinstallprompt); iPhone Safari has none, so there it
// explains Share → Add to Home Screen. Hidden once Relay runs as an app.

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

export function InstallAppButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (event) => { event.preventDefault(); setPrompt(event); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (prompt) {
    return (
      <button type="button" className="btn sm install-app" onClick={async () => {
        prompt.prompt();
        const choice = await prompt.userChoice.catch(() => null);
        if (choice?.outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}>
        <Download size={13} /> <span>Install app</span>
      </button>
    );
  }

  if (!isIos()) return null;
  return (
    <div className="install-app-wrap">
      <button type="button" className="btn sm install-app" onClick={() => setShowIosHelp((open) => !open)} aria-expanded={showIosHelp}>
        <Download size={13} /> <span>Install app</span>
      </button>
      {showIosHelp && (
        <div className="install-app-help" role="dialog" aria-label="Install Relay on iPhone">
          <button type="button" className="install-app-close" aria-label="Close" onClick={() => setShowIosHelp(false)}><X size={13} /></button>
          In Safari, tap <Share size={13} aria-label="Share" /> <b>Share</b>, then <b>Add to Home Screen</b>.
          Relay then opens from its own icon, full screen.
        </div>
      )}
    </div>
  );
}
