import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Share2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

async function drawCard(data: RunShareData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Fond premium sombre
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07100b");
  bg.addColorStop(0.5, "#0a0f0c");
  bg.addColorStop(1, "#050807");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Halo néon
  const halo = ctx.createRadialGradient(W * 0.5, H * 0.32, 40, W * 0.5, H * 0.32, W * 0.85);
  halo.addColorStop(0, "rgba(34,197,94,0.20)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // ── En-tête : avatar + username
  const headY = 150;
  let textX = 90;
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(140, headY, 60, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 80, headY - 60, 120, 120);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(140, headY, 60, 0, Math.PI * 2);
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 5;
      ctx.stroke();
      textX = 230;
    } catch { /* avatar indisponible */ }
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 52px Outfit, Inter, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`@${data.username}`, textX, data.levelName ? headY - 20 : headY);
  if (data.levelName) {
    ctx.fillStyle = "#22c55e";
    ctx.font = "700 32px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText(data.levelName.toUpperCase(), textX, headY + 32);
  }

  // ── Distance (élément principal)
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(34,197,94,0.65)";
  ctx.shadowBlur = 60;
  ctx.font = "900 250px Outfit, Inter, sans-serif";
  ctx.fillText(data.distanceKm.toFixed(2), W / 2, 470);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 40px 'Space Grotesk', Inter, sans-serif";
  ctx.fillText("K I L O M È T R E S", W / 2, 600);

  // ── Tracé GPS
  const mapX = 80, mapY = 690, mapW = W - 160, mapH = 700;
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.strokeStyle = "rgba(34,197,94,0.25)";
  ctx.lineWidth = 3;
  const r = 48;
  ctx.beginPath();
  ctx.moveTo(mapX + r, mapY);
  ctx.arcTo(mapX + mapW, mapY, mapX + mapW, mapY + mapH, r);
  ctx.arcTo(mapX + mapW, mapY + mapH, mapX, mapY + mapH, r);
  ctx.arcTo(mapX, mapY + mapH, mapX, mapY, r);
  ctx.arcTo(mapX, mapY, mapX + mapW, mapY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const raw = data.gpsPoints.filter(
    (p) => isFinite(p.lat) && isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
  );
  const pts = privacyTrim(raw).length >= 2 ? privacyTrim(raw) : raw;
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
    // Glow
    ctx.strokeStyle = "rgba(34,197,94,0.28)";
    ctx.lineWidth = 26;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    // Trait
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 9;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = px(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
    // Départ / arrivée
    const [sx, sy] = px(pts[0]);
    const [ex, ey] = px(pts[pts.length - 1]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#22c55e";
    ctx.beginPath(); ctx.arc(ex, ey, 16, 0, Math.PI * 2); ctx.fill();
  } else if (pts.length === 1) {
    const cx = mapX + mapW / 2, cy = mapY + mapH / 2;
    ctx.fillStyle = "rgba(34,197,94,0.25)";
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#22c55e";
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "600 30px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText("Point de départ enregistré", cx, cy + 110);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "600 34px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText("Aucun déplacement GPS enregistré", W / 2, mapY + mapH / 2);
  }


  // ── Statistiques
  const stats: [string, string][] = [
    ["DURÉE", fmtTime(data.durationSeconds)],
    ["ALLURE", `${data.paceLabel} /km`],
    ["VITESSE", `${data.speedKmh.toFixed(1)} km/h`],
    ["FREAK POINTS", `+${data.fp.toFixed(1)}`],
  ];
  const colW = (W - 160) / 2;
  stats.forEach(([label, value], i) => {
    const cx = 80 + colW * (i % 2) + colW / 2;
    const cy = 1500 + Math.floor(i / 2) * 160;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "700 26px 'Space Grotesk', Inter, sans-serif";
    ctx.fillText(label, cx, cy);
    ctx.fillStyle = i === 3 ? "#22c55e" : "#ffffff";
    ctx.font = "900 62px Outfit, Inter, sans-serif";
    ctx.fillText(value, cx, cy + 62);
  });

  // ── Branding
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(80, H - 190, W - 160, 3);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 54px Outfit, Inter, sans-serif";
  ctx.shadowColor = "rgba(34,197,94,0.6)";
  ctx.shadowBlur = 30;
  ctx.fillText("FREAK-OUT", W / 2, H - 110);
  ctx.shadowBlur = 0;

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
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center px-5 py-6"
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 w-10 h-10 rounded-full glass-strong flex items-center justify-center"
      >
        <X className="w-5 h-5 text-foreground" />
      </button>

      {busy || !url ? (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs uppercase tracking-[0.25em]">Génération…</p>
        </div>
      ) : (
        <>
          <motion.img
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            src={url}
            alt="Carte de performance FREAK-OUT"
            className="max-h-[65vh] w-auto rounded-3xl border border-primary/25 shadow-2xl"
          />
          <div className="mt-6 w-full max-w-sm flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 rounded-2xl gradient-primary py-4 font-display font-black text-primary-foreground neon-glow flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" /> PARTAGER
            </button>
            <button
              onClick={handleSave}
              className="rounded-2xl px-5 py-4 bg-foreground/[0.06] border border-foreground/10 text-foreground flex items-center justify-center"
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
