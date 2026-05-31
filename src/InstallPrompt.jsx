import React, { useState, useEffect } from "react";
import { Heart, Share, Plus, X } from "lucide-react";

const DISMISS_KEY = "noidue:a2hs-dismissed";

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ si maschera da Mac: lo riconosciamo dal touch
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deferred, setDeferred] = useState(null); // evento beforeinstallprompt (Android/Chrome)
  const [mode, setMode] = useState("ios"); // "ios" | "android"

  useEffect(() => {
    if (isStandalone()) return; // già installata, mai mostrare
    if (localStorage.getItem(DISMISS_KEY)) return; // già rifiutato

    // Android / Chrome desktop: install nativo
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setMode("android");
      setTimeout(() => setShow(true), 1200);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS: nessun evento, mostriamo le istruzioni dopo un attimo
    let t;
    if (isIos()) {
      setMode("ios");
      t = setTimeout(() => setShow(true), 1400);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      if (t) clearTimeout(t);
    };
  }, []);

  const close = (remember = true) => {
    setLeaving(true);
    setTimeout(() => {
      setShow(false);
      setLeaving(false);
      if (remember) localStorage.setItem(DISMISS_KEY, "1");
    }, 280);
  };

  const installAndroid = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    close(true);
  };

  if (!show) return null;

  return (
    <div className={`ip-overlay ${leaving ? "is-leaving" : ""}`} onClick={() => close(true)}>
      <div className={`ip-card ${leaving ? "is-leaving" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ip-close" aria-label="Chiudi" onClick={() => close(true)}>
          <X size={18} />
        </button>

        <div className="ip-icon">
          <Heart size={30} fill="currentColor" />
        </div>

        <h3 className="ip-title">Aggiungi NoiDue alla Home</h3>
        <p className="ip-sub">
          Apri l'app a schermo intero, come una vera applicazione — senza la barra del browser.
        </p>

        {mode === "android" && deferred ? (
          <button type="button" className="ip-btn" onClick={installAndroid}>
            <Plus size={17} /> Installa l'app
          </button>
        ) : (
          <div className="ip-steps">
            <div className="ip-step">
              <span className="ip-step-n">1</span>
              <span className="ip-step-t">
                Tocca <Share size={15} className="ip-inline" /> <b>Condividi</b> nella barra in basso
              </span>
            </div>
            <div className="ip-step">
              <span className="ip-step-n">2</span>
              <span className="ip-step-t">
                Scegli <b>«Aggiungi a Home»</b> <Plus size={14} className="ip-inline" />
              </span>
            </div>
          </div>
        )}

        <button type="button" className="ip-later" onClick={() => close(true)}>
          Più tardi
        </button>
      </div>

      <style>{`
        .ip-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: flex-end; justify-content: center;
          background: rgba(0,0,0,.55);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom));
          animation: ipFade .3s ease both;
        }
        .ip-overlay.is-leaving { animation: ipFadeOut .28s ease both; }

        .ip-card {
          position: relative; width: 100%; max-width: 420px;
          background: linear-gradient(180deg, #2E2320, #1B1512);
          border: 1px solid #4A372C;
          border-radius: 28px;
          padding: 28px 24px 18px;
          text-align: center;
          color: #F2E9DC;
          font-family: 'Inter', system-ui, sans-serif;
          box-shadow: 0 -10px 60px -12px rgba(0,0,0,.7), 0 24px 50px -20px rgba(0,0,0,.6),
                      inset 0 1px 0 rgba(255,255,255,.06);
          animation: ipUp .42s cubic-bezier(.2,.8,.2,1) both;
        }
        .ip-card.is-leaving { animation: ipDown .28s ease both; }

        .ip-close {
          position: absolute; top: 14px; right: 14px;
          width: 32px; height: 32px; border-radius: 50%;
          display: grid; place-items: center;
          color: #897B6E; background: rgba(255,255,255,.05);
          transition: all .2s ease;
        }
        .ip-close:hover { color: #F2E9DC; background: rgba(255,255,255,.1); }

        .ip-icon {
          width: 72px; height: 72px; margin: 4px auto 16px;
          border-radius: 20px;
          background: linear-gradient(135deg, #FF9870, #E5683E);
          display: grid; place-items: center; color: #2a1810;
          box-shadow: 0 12px 30px -10px rgba(255,152,112,.6), inset 0 1px 0 rgba(255,255,255,.3);
        }

        .ip-title {
          font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 600;
          font-size: 24px; letter-spacing: -.02em; line-height: 1.15; margin-bottom: 8px;
        }
        .ip-sub { font-size: 14px; line-height: 1.5; color: #C9B9A6; margin-bottom: 20px; padding: 0 6px; }

        .ip-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; text-align: left; }
        .ip-step {
          display: flex; align-items: center; gap: 12px;
          background: rgba(20,15,13,.5); border: 1px solid #38291F;
          border-radius: 14px; padding: 12px 14px;
        }
        .ip-step-n {
          flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%;
          display: grid; place-items: center; font-size: 13px; font-weight: 700;
          color: #2a1810; background: linear-gradient(135deg, #E8B86A, #B0822E);
        }
        .ip-step-t { font-size: 14px; line-height: 1.4; color: #F2E9DC; }
        .ip-inline { display: inline; vertical-align: -2px; color: #FF9870; margin: 0 1px; }

        .ip-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-height: 50px; border-radius: 999px; margin-bottom: 10px;
          font-weight: 600; font-size: 15px; color: #2a1810;
          background: linear-gradient(135deg, #FF9870, #E5683E);
          box-shadow: 0 14px 28px -12px rgba(255,152,112,.55), inset 0 1px 0 rgba(255,255,255,.25);
        }
        .ip-btn:active { transform: scale(.98); }

        .ip-later {
          width: 100%; padding: 12px; font-size: 14px; font-weight: 500; color: #897B6E;
          transition: color .2s ease;
        }
        .ip-later:hover { color: #C9B9A6; }

        @keyframes ipUp { from { transform: translateY(110%);} to { transform: translateY(0);} }
        @keyframes ipDown { from { transform: translateY(0);} to { transform: translateY(110%);} }
        @keyframes ipFade { from { opacity: 0;} to { opacity: 1;} }
        @keyframes ipFadeOut { from { opacity: 1;} to { opacity: 0;} }

        @media (min-width: 640px) {
          .ip-overlay { align-items: center; }
          .ip-card { animation: ipPop .4s cubic-bezier(.2,.8,.2,1) both; }
          @keyframes ipPop { from { transform: scale(.92); opacity: 0;} to { transform: scale(1); opacity: 1;} }
        }
      `}</style>
    </div>
  );
}
