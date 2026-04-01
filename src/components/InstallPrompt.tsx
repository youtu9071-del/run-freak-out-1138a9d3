import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("pwa-dismissed") === "true") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Toujours afficher le prompt après 2s si le navigateur ne supporte pas beforeinstallprompt
    // (iOS Safari, Firefox, etc.)
    const timer = setTimeout(() => {
      setShow(true);
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback pour iOS / navigateurs sans beforeinstallprompt
      alert("Pour installer FREAK OUT :\n\n📱 iPhone : Appuie sur le bouton Partager ⬆️ puis \"Sur l'écran d'accueil\"\n\n🤖 Android : Menu ⋮ puis \"Installer l'application\"");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    sessionStorage.setItem("pwa-dismissed", "true");
  };

  if (dismissed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 20 }}
        className="fixed bottom-24 right-4 left-4 sm:left-auto z-50 flex items-center gap-3 rounded-2xl bg-card border border-primary/30 p-4 neon-glow max-w-xs shadow-lg sm:right-4"
      >
        <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm text-foreground">Installer FREAK OUT</p>
          <p className="text-xs text-muted-foreground">Ajouter à l'écran d'accueil</p>
          <button
            onClick={handleInstall}
            className="mt-2 px-4 py-1.5 rounded-lg gradient-primary font-display font-bold text-xs text-primary-foreground"
          >
            Installer
          </button>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground shrink-0 self-start">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
