import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLevel } from "@/lib/gamification";

/**
 * Applique dynamiquement la couleur du rang courant au thème global
 * (variables CSS --primary / --ring / --primary-glow / dégradés / halos).
 * Le reste du design (fond sombre, glass, typographies) reste inchangé.
 */
function parseHsl(hsl: string) {
  const [h, s, l] = hsl.split(" ");
  return { h: parseFloat(h), s, l: parseFloat(l) };
}

export default function LevelTheme() {
  const { profile } = useAuth();
  const totalKm = Number(profile?.total_km || 0);

  useEffect(() => {
    const level = getLevel(totalKm);
    const { h, s, l } = parseHsl(level.hsl);
    const glowL = Math.min(l + 20, 85);
    const glow = `${h} ${s} ${glowL}%`;

    const root = document.documentElement;
    root.style.setProperty("--primary", level.hsl);
    root.style.setProperty("--primary-glow", glow);
    root.style.setProperty("--ring", level.hsl);
    root.style.setProperty("--sidebar-primary", level.hsl);
    root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${level.hsl}) 0%, hsl(${glow}) 100%)`);
    root.style.setProperty(
      "--gradient-hero",
      `radial-gradient(ellipse at top, hsl(${h} ${s} 25% / 0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, hsl(${glow} / 0.15) 0%, transparent 50%)`
    );
    root.style.setProperty(
      "--gradient-mesh",
      `radial-gradient(at 20% 0%, hsl(${h} ${s} 30% / 0.35) 0px, transparent 50%), radial-gradient(at 80% 100%, hsl(${glow} / 0.18) 0px, transparent 50%), radial-gradient(at 0% 100%, hsl(30 100% 50% / 0.08) 0px, transparent 50%)`
    );
    root.style.setProperty("--neon-glow", `0 0 24px hsl(${level.hsl} / 0.35), 0 0 48px hsl(${level.hsl} / 0.12)`);
    root.style.setProperty("--neon-glow-strong", `0 0 28px hsl(${level.hsl} / 0.55), 0 0 72px hsl(${glow} / 0.25)`);
    root.style.setProperty("--shadow-premium", `0 20px 50px -20px hsl(${level.hsl} / 0.35), 0 8px 24px -8px hsl(0 0% 0% / 0.5)`);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", `hsl(${level.hsl})`);
  }, [totalKm]);

  return null;
}
