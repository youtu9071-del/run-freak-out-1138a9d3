import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Share2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logoUrl from "@/assets/freakout-logo.png";

export interface RunShareData {
  username: string;
  avatarUrl?: string | null;
  levelName?: string | null;
  distanceKm: number;
  durationSeconds: number;
  paceLabel: string;
  speedKmh: number;
  fp: number;
  gpsPoints: { lat: number; lng: number }[];
}

const W = 1080;
const H = 1920;
const GREEN = "#22c55e";

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Masque le début et la fin du tracé (confidentialité) sans modifier les données d'origine. */
function privacyTrim<T>(points: T[]): T[] {
  if (points.length < 20) return points;
  const cut = Math.max(1, Math.round(points.length * 0.08));
  return points.slice(cut, points.length - cut);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawCard(data: RunShareData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Fond premium
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, "#08120c");
  bg.addColorStop(0.45, "#0a0f0d");
  bg.addColorStop(1, "#040706");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Halos néon
  const halo = ctx.createRadialGradient(W * 0.5, H * 0.28, 30, W * 0.5, H * 0.28, W * 0.9);
  halo.addColorStop(0, "rgba(34,197,94,0.22)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const halo2 = ctx.createRadialGradient(W * 0.1, H * 0.92, 20, W * 0.1, H * 0.92, W * 0.7);
  halo2.addColorStop(0, "rgba(34,197,94,0.12)");
  halo2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo2;
  ctx.fillRect(0, 0, W, H);

  // Stries diagonales discrètes (dynamisme sportif)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  for (let i = -H; i < W; i += 46) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // Cadre fin
  ctx.strokeStyle = "rgba(34,197,94,0.22)";
  ctx.lineWidth = 3;
  roundRect(ctx, 34, 34, W - 68, H - 68, 56);
  ctx.stroke();

  let logo: HTMLImageElement | null = null;
  try { logo = await loadImage(logoUrl); } catch { /* ignore */ }

  // ── En-tête : logo FREAK-OUT + wordmark
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  if (logo) {
    ctx.save();
    ctx.shadowColor = "rgba(34,197,94,0.55)";
    ctx.shadowBlur = 40;
    ctx.drawImage(logo, 86, 96, 92, 92);
    ctx.restore();
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 46px Outfit, Inter, sans-serif";
  ctx.fillText("FREAK-OUT", logo ? 196 : 86, 144);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "700 28px 'Space Grotesk', Inter, sans-serif";
  ctx.fillText(
    new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(),
    W - 86, 144
  );

  // ── Athlète : avatar + username + niveau
  const headY = 300;
  ctx.textAlign = "left";
  let textX = 86;
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(146, headY, 60, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 86, headY - 60, 120, 120);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(146, headY, 60, 0, Math.PI * 2);
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 5;
      ctx.shadowColor = "rgba(34,197,94,0.6)";
      ctx.shadowBlur = 26;
      ctx.stroke();
      ctx.shadowBlur = 0;
      textX = 236;
    } catch { /* avatar indisponible */ }
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 50px Outfit, Inter, sans-serif";
  ctx.fillText(`@${data.username}`, textX, data.levelName ? headY - 22 : headY);
  if (data.levelName) {
    ctx.fillStyle = GREEN;
    ctx.font = "700 30px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText(data.levelName.toUpperCase(), textX, headY + 30);
  }

  // ── Distance (élément principal)
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(34,197,94,0.7)";
  ctx.shadowBlur = 70;
  ctx.font = "900 260px Outfit, Inter, sans-serif";
  ctx.fillText(data.distanceKm.toFixed(2), W / 2, 560);
  ctx.shadowBlur = 0;

  // Soulignement néon
  const uw = 280;
  const ug = ctx.createLinearGradient(W / 2 - uw, 0, W / 2 + uw, 0);
  ug.addColorStop(0, "rgba(34,197,94,0)");
  ug.addColorStop(0.5, GREEN);
  ug.addColorStop(1, "rgba(34,197,94,0)");
  ctx.fillStyle = ug;
  ctx.fillRect(W / 2 - uw, 660, uw * 2, 4);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "700 38px 'Space Grotesk', Inter, sans-serif";
  ctx.fillText("K I L O M È T R E S", W / 2, 712);

  // ── Tracé GPS dans un panneau vitré
  const mapX = 80, mapY = 780, mapW = W - 160, mapH = 640;
  const panel = ctx.createLinearGradient(mapX, mapY, mapX, mapY + mapH);
  panel.addColorStop(0, "rgba(255,255,255,0.055)");
  panel.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.fillStyle = panel;
  ctx.strokeStyle = "rgba(34,197,94,0.28)";
  ctx.lineWidth = 3;
  roundRect(ctx, mapX, mapY, mapW, mapH, 48);
  ctx.fill();
  ctx.stroke();

  const raw = data.gpsPoints.filter(
    (p) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
  );
  const trimmed = privacyTrim(raw);
  const pts = trimmed.length >= 2 ? trimmed : raw;
  if (pts.length >= 2) {
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const pad = 90;
    const spanLat = Math.max(maxLat - minLat, 1e-5);
    const spanLng = Math.max(maxLng - minLng, 1e-5);
    const scale = Math.min((mapW - pad * 2) / spanLng, (mapH - pad * 2) / spanLat);
    const offX = mapX + mapW / 2 - (spanLng * scale) / 2;
    const offY = mapY + mapH / 2 - (spanLat * scale) / 2;
    const px = (p: { lat: number; lng: number }) => [
      offX + (p.lng - minLng) * scale,
      offY + (maxLat - p.lat) * scale,
    ] as [number, number];

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(34,197,94,0.25)";
    ctx.lineWidth = 30;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 10;
    ctx.shadowColor = "rgba(34,197,94,0.7)";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    ctx.shadowBlur = 0;

    const [sx, sy] = px(pts[0]);
    const [ex, ey] = px(pts[pts.length - 1]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = GREEN;
    ctx.beginPath(); ctx.arc(ex, ey, 17, 0, Math.PI * 2); ctx.fill();
  } else if (pts.length === 1) {
    const cx = mapX + mapW / 2, cy = mapY + mapH / 2;
    ctx.fillStyle = "rgba(34,197,94,0.22)";
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = GREEN;
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "600 30px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText("Point de départ enregistré", cx, cy + 110);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "600 34px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText("Aucun déplacement GPS enregistré", W / 2, mapY + mapH / 2);
  }

  // Filigrane logo dans le coin du panneau
  if (logo) {
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(logo, mapX + mapW - 130, mapY + mapH - 130, 90, 90);
    ctx.restore();
  }

  // ── Statistiques en tuiles vitrées
  const stats: [string, string][] = [
    ["DURÉE", fmtTime(data.durationSeconds)],
    ["ALLURE", `${data.paceLabel} /km`],
    ["VITESSE", `${data.speedKmh.toFixed(1)} km/h`],
    ["FREAK POINTS", `+${data.fp.toFixed(1)}`],
  ];
  const gap = 24;
  const tileW = (W - 160 - gap) / 2;
  const tileH = 150;
  stats.forEach(([label, value], i) => {
    const tx = 80 + (i % 2) * (tileW + gap);
    const ty = 1478 + Math.floor(i / 2) * (tileH + gap);
    const highlight = i === 3;
    ctx.fillStyle = highlight ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.045)";
    ctx.strokeStyle = highlight ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.09)";
    ctx.lineWidth = 2;
    roundRect(ctx, tx, ty, tileW, tileH, 32);
    ctx.fill();
    ctx.stroke();

    const cx = tx + tileW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = highlight ? "rgba(34,197,94,0.85)" : "rgba(255,255,255,0.45)";
    ctx.font = "700 25px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText(label, cx, ty + 46);
    ctx.fillStyle = highlight ? GREEN : "#ffffff";
    ctx.font = "900 60px Outfit, Inter, sans-serif";
    ctx.fillText(value, cx, ty + 104);
  });

  // ── Pied de page brandé
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(80, H - 196, W - 160, 2);

  const footY = H - 118;
  const wordmark = "FREAK-OUT";
  ctx.font = "900 56px Outfit, Inter, sans-serif";
  const wmW = ctx.measureText(wordmark).width;
  const logoSize = logo ? 68 : 0;
  const totalW = wmW + (logo ? logoSize + 24 : 0);
  const startX = W / 2 - totalW / 2;
  if (logo) {
    ctx.save();
    ctx.shadowColor = "rgba(34,197,94,0.6)";
    ctx.shadowBlur = 34;
    ctx.drawImage(logo, startX, footY - logoSize / 2, logoSize, logoSize);
    ctx.restore();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(34,197,94,0.55)";
  ctx.shadowBlur = 26;
  ctx.fillText(wordmark, startX + (logo ? logoSize + 24 : 0), footY);
  ctx.shadowBlur = 0;

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "700 24px 'Space Grotesk', Inter, sans-serif";
  ctx.fillText("R U N   ·   E A R N   ·   R E P E A T", W / 2, H - 62);

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png", 1)
  );
}

export default function RunShareCard({ data, onClose }: { data: RunShareData; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let alive = true;
    drawCard(data)
      .then((blob) => {
        if (!alive) return;
        blobRef.current = blob;
        setUrl(URL.createObjectURL(blob));
        setBusy(false);
      })
      .catch(() => {
        if (!alive) return;
        setBusy(false);
        toast.error("Impossible de générer l'image");
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileName = `freakout-${data.distanceKm.toFixed(2)}km.png`;

  const handleShare = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "FREAK-OUT" });
        return;
      } catch { /* annulé */ }
    } else {
      handleSave();
    }
  };

  const handleSave = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    toast.success("Image enregistrée");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center px-5 py-6"
    >
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full bg-primary/10 blur-3xl" />

      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 w-10 h-10 rounded-full glass-strong flex items-center justify-center z-10"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>

      <div className="relative z-10 flex items-center gap-2 mb-4">
        <img src={logoUrl} alt="FREAK-OUT" loading="lazy" width={28} height={28} className="w-7 h-7" />
        <span className="font-display font-black tracking-[0.2em] text-sm text-foreground">FREAK-OUT</span>
      </div>

      {busy || !url ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-[0.25em]">Génération…</p>
        </div>
      ) : (
        <>
          <motion.img
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }}
            src={url}
            alt="Carte de performance FREAK-OUT"
            className="relative z-10 max-h-[62vh] w-auto rounded-[1.75rem] border border-primary/30 shadow-[0_30px_80px_-20px_rgba(34,197,94,0.45)]"
          />
          <div className="relative z-10 mt-6 w-full max-w-sm flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 rounded-2xl gradient-primary py-4 font-display font-black tracking-wide text-primary-foreground neon-glow flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Share2 className="w-5 h-5" /> PARTAGER
            </button>
            <button
              onClick={handleSave}
              className="rounded-2xl px-5 py-4 bg-foreground/[0.06] border border-foreground/10 text-foreground flex items-center justify-center active:scale-[0.98] transition-transform"
              aria-label="Enregistrer"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
