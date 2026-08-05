import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Route, Timer, Zap, ChevronLeft, Shield, ShieldAlert, ShieldX, MapPin, Footprints, Gauge, Flame, Crosshair, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculateCalories } from "@/lib/gamification";
import { GpsPoint, haversineDistance, analyzeSpeed, analyzeGpsJump, analyzeSession, CheatAlert, SessionIntegrity } from "@/lib/anticheat";
import { calculateFP, saveActivity } from "@/lib/freakPoints";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { requestNotifPermission, showActivityNotification, hideActivityNotification } from "@/lib/activityNotification";

const ActivityMap = lazy(() => import("@/components/ActivityMap"));

type TrackingState = "idle" | "running" | "paused" | "finished";

export default function ActivityScreen() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<TrackingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [initialPos, setInitialPos] = useState<{ lat: number; lng: number } | null>(null);
  const [steps, setSteps] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"waiting" | "active" | "denied" | "unavailable">("waiting");
  const [integrity, setIntegrity] = useState<SessionIntegrity | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<CheatAlert[]>([]);
  const [savedFp, setSavedFp] = useState<number | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);
  const restoredRef = useRef(false);

  // ─── Persistance de la course (reprise automatique après fermeture / notification) ───
  const RUN_KEY = "freakout_active_run";



  // ─── Pedometer ───
  useEffect(() => {
    if (state !== "running") return;

    if ('Accelerometer' in window) {
      try {
        const sensor = new (window as any).Accelerometer({ frequency: 30 });
        let lastMag = 9.8;
        let cooldown = false;

        sensor.addEventListener('reading', () => {
          const mag = Math.sqrt(sensor.x ** 2 + sensor.y ** 2 + sensor.z ** 2);
          const delta = Math.abs(mag - lastMag);
          lastMag = mag;
          if (delta > 2.5 && !cooldown) {
            setSteps(s => s + 1);
            cooldown = true;
            setTimeout(() => { cooldown = false; }, 250);
          }
        });

        sensor.start();
        return () => sensor.stop();
      } catch { /* fallback */ }
    }

    let lastMagnitude = 9.8;
    let cooldown = false;
    let samples: number[] = [];

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.y === null) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      samples.push(magnitude);
      if (samples.length > 5) samples.shift();
      const smoothed = samples.reduce((a, b) => a + b, 0) / samples.length;
      const delta = Math.abs(smoothed - lastMagnitude);
      lastMagnitude = smoothed;
      if (delta > 2.2 && !cooldown) {
        setSteps(s => s + 1);
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 280);
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [state]);

  // ─── Initial GPS fix on mount (so map centers on real location, not default) ───
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInitialPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  // ─── GPS Tracking with moving dot ───
  const startGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("active");
        const point: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy,
        };

        // Rejeter uniquement les points vraiment imprécis
        if (pos.coords.accuracy > 60) return;

        if (lastPointRef.current) {
          const d = haversineDistance(lastPointRef.current, point);
          const dt = (point.timestamp - lastPointRef.current.timestamp) / 1000;
          const speedKmh = dt > 0 ? d / (dt / 3600) : 0;

          // Seuil de bruit adaptatif : ~1/3 de la précision GPS (min 1,5 m)
          const noise = Math.max(0.0015, (pos.coords.accuracy / 1000) / 3);

          if (d >= noise && speedKmh < 60) {
            // On cumule et on avance l'ancre
            setDistance(prev => prev + d);
            const alert = analyzeGpsJump(lastPointRef.current, point);
            if (alert) setLiveAlerts(prev => [...prev.slice(-4), alert]);
            lastPointRef.current = point;
          } else if (d >= 0.5) {
            // Grand saut (retour d'arrière-plan) : on recale l'ancre sans compter
            lastPointRef.current = point;
          }
          // sinon : bruit → on garde l'ancre pour cumuler le déplacement réel
        } else {
          lastPointRef.current = point;
        }

        setGpsPoints(prev => [...prev, point]);

      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGpsStatus("denied");
        else setGpsStatus("unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    watchIdRef.current = id;
  }, []);

  const stopGps = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ─── Timer ───
  useEffect(() => {
    if (state === "running") {
      intervalRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state]);

  // ─── Anti-cheat speed check ───
  useEffect(() => {
    if (state !== "running" || seconds === 0) return;
    const currentSpeed = distance / (seconds / 3600);
    const alert = analyzeSpeed(currentSpeed);
    if (alert) {
      setLiveAlerts(prev => {
        if (prev.length > 0 && prev[prev.length - 1].level === alert.level) return prev;
        return [...prev.slice(-4), alert];
      });
    }
  }, [seconds, distance, state]);

  // ─── Notification persistante course active (style FREAK-OUT) ───
  useEffect(() => {
    if (state !== "running") return;
    showActivityNotification(seconds, distance);
    const t = window.setInterval(() => showActivityNotification(seconds, distance), 5000);
    return () => window.clearInterval(t);
  }, [state, seconds, distance]);

  useEffect(() => {
    if (state === "idle" || state === "finished") hideActivityNotification();
    document.title =
      state === "running" || state === "paused"
        ? `FREAK-OUT · ${distance.toFixed(2)} km`
        : "FREAK OUT";
    return () => { document.title = "FREAK OUT"; };
  }, [state, distance]);

  // ─── Reprise automatique d'une course en cours (retour via notification) ───
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(RUN_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || (saved.state !== "running" && saved.state !== "paused")) return;
      const elapsedSinceSave = saved.state === "running" && saved.savedAt
        ? Math.max(0, Math.floor((Date.now() - saved.savedAt) / 1000))
        : 0;
      setSeconds((saved.seconds || 0) + elapsedSinceSave);
      setDistance(saved.distance || 0);
      setSteps(saved.steps || 0);
      const pts: GpsPoint[] = saved.gpsPoints || [];
      setGpsPoints(pts);
      if (pts.length) {
        lastPointRef.current = pts[pts.length - 1];
        setInitialPos({ lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng });
      }
      setState(saved.state);
      if (saved.state === "running") startGps();
    } catch { /* ignore */ }
  }, [startGps]);

  // ─── Sauvegarde continue de l'état de la course ───
  useEffect(() => {
    if (state === "running" || state === "paused") {
      localStorage.setItem(
        RUN_KEY,
        JSON.stringify({
          state,
          seconds,
          distance,
          steps,
          gpsPoints: gpsPoints.slice(-400),
          savedAt: Date.now(),
        })
      );
    } else {
      localStorage.removeItem(RUN_KEY);
    }
  }, [state, seconds, distance, steps, gpsPoints]);


  // ─── Controls ───
  const handleStart = async () => {
    await requestNotifPermission();
    setState("running");
    startGps();
  };
  const handlePause = () => { setState("paused"); stopGps(); };
  const handleResume = () => { setState("running"); startGps(); };

  const handleFinish = async () => {
    hideActivityNotification();
    stopGps();
    setState("finished");
    const speed = seconds > 0 ? distance / (seconds / 3600) : 0;
    const result = analyzeSession(gpsPoints, steps, distance, speed);

    // ─── No-movement guard : bloque toute attribution de FP si l'utilisateur n'a pas bougé ───
    // Conditions cumulatives : distance mesurée < 50 m ET moins de 5 points GPS valides ET pas de pas détectés
    const didNotMove =
      distance < 0.05 &&
      gpsPoints.length < 5 &&
      steps < 20;

    if (didNotMove) {
      result.isBlocked = true;
      result.status = "fraud";
      result.alerts = [
        ...result.alerts,
        { level: "fraud", reason: "Aucun déplacement détecté — FP non attribués", timestamp: Date.now() },
      ];
    } else {
      // Course validée par défaut dès qu'un déplacement réel est détecté
      result.isBlocked = false;
      result.status = "clean";
      result.alerts = [];
    }

    setIntegrity(result);

    const fp = calculateFP(distance, steps);
    const totalFp = result.isBlocked ? 0 : fp.totalFp;
    const cal = calculateCalories(distance);

    // Save locally
    const activity = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      distanceKm: Math.round(distance * 100) / 100,
      steps,
      durationMin: Math.round(seconds / 60),
      avgSpeed: Math.round(speed * 10) / 10,
      calories: cal,
      fpFromKm: fp.fpFromKm,
      fpFromSteps: fp.fpFromSteps,
      totalFp,
      status: result.status,
    };
    saveActivity(activity);
    setSavedFp(totalFp);

    // Save to DB
    if (user) {
      await supabase.from("user_activities").insert({
        user_id: user.id,
        distance_km: activity.distanceKm,
        steps: activity.steps,
        duration_seconds: seconds,
        avg_speed: activity.avgSpeed,
        calories: cal,
        fp_from_km: fp.fpFromKm,
        fp_from_steps: fp.fpFromSteps,
        total_fp: totalFp,
        integrity_status: result.status as any,
        gps_points: gpsPoints as any,
      });

      // Update profile stats
      await supabase.rpc("update_profile_stats" as any, { p_user_id: user.id });

      // If this was a team-challenge run, submit the participation
      try {
        const raw = sessionStorage.getItem("active_team_challenge");
        if (raw) {
          const ctx = JSON.parse(raw);
          if (ctx?.id) {
            await supabase.rpc("submit_team_challenge_run" as any, {
              p_challenge_id: ctx.id,
              p_distance_km: activity.distanceKm,
              p_duration_seconds: seconds,
              p_total_fp: totalFp,
            });
            sessionStorage.removeItem("active_team_challenge");
          }
        }
      } catch { /* ignore */ }

      await refreshProfile();
    }
  };


  const speed = seconds > 0 ? distance / (seconds / 3600) : 0;
  const calories = calculateCalories(distance);
  const paceSec = distance > 0.01 ? seconds / distance : 0;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const formatPace = () => {
    if (!paceSec || !isFinite(paceSec)) return "--:--";
    const m = Math.floor(paceSec / 60);
    const s = Math.round(paceSec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const integrityIcon = () => {
    if (!integrity) return null;
    if (integrity.status === "clean") return <Shield className="w-5 h-5 text-primary" />;
    if (integrity.status === "suspect") return <ShieldAlert className="w-5 h-5 text-accent" />;
    return <ShieldX className="w-5 h-5 text-destructive" />;
  };

  const MiniStat = ({
    icon: Icon,
    label,
    value,
    unit,
    tone = "default",
    delay = 0,
  }: { icon: typeof Timer; label: string; value: string; unit?: string; tone?: "default" | "primary" | "accent"; delay?: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06] px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-muted-foreground"}`} />
        <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <motion.span
          key={value}
          initial={{ opacity: 0.55, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="font-display font-black text-lg leading-none text-foreground tabular-nums"
        >
          {value}
        </motion.span>
        {unit && <span className="text-[10px] text-muted-foreground font-medium">{unit}</span>}
      </div>
    </motion.div>
  );

  // ─────────────── Écran de fin de course ───────────────
  if (state === "finished") {
    const blocked = integrity?.isBlocked;
    return (
      <div className="min-h-[100dvh] max-w-lg mx-auto px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] flex flex-col">
        <div className="absolute inset-0 -z-10 gradient-hero pointer-events-none" />

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }} className="text-center">
          <div className={`relative w-24 h-24 mx-auto rounded-full flex items-center justify-center ${blocked ? "bg-destructive/15" : "gradient-primary neon-glow-strong"}`}>
            {blocked ? <ShieldX className="w-10 h-10 text-destructive" /> : <Trophy className="w-10 h-10 text-primary-foreground" />}
            {!blocked && <span className="pulse-ring absolute inset-0 rounded-full" />}
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            {blocked ? "Session rejetée" : "Course terminée"}
          </p>
          <h1 className={`font-display font-black text-3xl mt-1 ${blocked ? "text-destructive" : "text-gradient-primary"}`}>
            {blocked ? "AUCUN POINT" : "BEAU TRAVAIL !"}
          </h1>
        </motion.div>

        {/* Distance héro */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8 text-center">
          <p className="font-display font-black text-[4.5rem] leading-none tracking-tight text-foreground neon-text tabular-nums">
            {distance.toFixed(2)}
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-2">kilomètres</p>
        </motion.div>

        {/* Récap */}
        <div className="grid grid-cols-3 gap-2.5 mt-8">
          <MiniStat icon={Timer} label="Durée" value={formatTime(seconds)} delay={0.25} />
          <MiniStat icon={Gauge} label="Allure" value={formatPace()} unit="/km" tone="primary" delay={0.3} />
          <MiniStat icon={Zap} label="Vitesse" value={speed.toFixed(1)} unit="km/h" tone="primary" delay={0.35} />
          <MiniStat icon={Footprints} label="Pas" value={String(steps)} tone="accent" delay={0.4} />
          <MiniStat icon={Flame} label="Calories" value={String(calories)} unit="kcal" tone="accent" delay={0.45} />
          <MiniStat icon={Route} label="Points GPS" value={String(gpsPoints.length)} delay={0.5} />
        </div>

        {/* FP */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className={`mt-5 rounded-3xl p-5 text-center border ${blocked ? "bg-destructive/10 border-destructive/30" : "bg-primary/10 border-primary/30 neon-glow"}`}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">Freak Points gagnés</p>
          <p className={`font-display font-black text-4xl mt-1 ${blocked ? "text-destructive" : "text-primary"}`}>
            {blocked ? "0" : `+${(savedFp ?? 0).toFixed(1)}`}
          </p>
          {integrity && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {integrityIcon()}
              <span>
                {integrity.status === "clean" ? "Session vérifiée" : integrity.status === "suspect" ? "Session suspecte" : "Session invalidée"}
              </span>
            </div>
          )}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/")}
          className="mt-6 w-full rounded-2xl gradient-primary py-4 font-display font-black tracking-wide text-primary-foreground neon-glow"
        >
          RETOUR À L'ACCUEIL
        </motion.button>
      </div>
    );
  }

  // ─────────────── Écran de course ───────────────
  return (
    <div className="h-[100dvh] max-w-lg mx-auto flex flex-col overflow-hidden">
      {/* Carte GPS — élément principal */}
      <div className="relative flex-1 min-h-[34vh] overflow-hidden">
        <Suspense fallback={<div className="w-full h-full bg-muted animate-pulse" />}>
          <ActivityMap gpsPoints={gpsPoints} initialPosition={initialPos} recenterKey={recenterKey} />
        </Suspense>

        {/* Dégradés d'intégration */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

        {/* Barre supérieure */}
        <div className="absolute top-[calc(env(safe-area-inset-top)+0.75rem)] inset-x-3 z-20 flex items-center gap-2">
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-full glass-strong flex items-center justify-center shrink-0"
            aria-label="Retour"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>

          <AnimatePresence>
            {state === "running" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-strong text-[10px] font-bold uppercase tracking-[0.15em] text-primary"
              >
                <motion.span
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
                Course en cours
              </motion.div>
            )}
            {state === "paused" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-strong text-[10px] font-bold uppercase tracking-[0.15em] text-accent"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                En pause
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold glass-strong shrink-0 ${
              gpsStatus === "active" ? "text-primary" : gpsStatus === "denied" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {gpsStatus === "active" ? "GPS" : gpsStatus === "denied" ? "Refusé" : gpsStatus === "unavailable" ? "Indispo." : "Recherche"}
          </div>
        </div>

        {/* Recentrer */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setRecenterKey((k) => k + 1)}
          className="absolute right-3 bottom-8 z-20 w-11 h-11 rounded-full glass-strong flex items-center justify-center text-primary shadow-elevation"
          aria-label="Recentrer la carte"
        >
          <Crosshair className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Alertes anti-triche */}
      <AnimatePresence>
        {liveAlerts.length > 0 && state === "running" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 overflow-hidden relative z-20">
            <div
              className={`rounded-2xl p-3 flex items-center gap-3 border ${
                liveAlerts[liveAlerts.length - 1].level === "fraud" ? "bg-destructive/10 border-destructive/30" : "bg-accent/10 border-accent/30"
              }`}
            >
              {liveAlerts[liveAlerts.length - 1].level === "fraud" ? (
                <ShieldX className="w-5 h-5 text-destructive shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-accent shrink-0" />
              )}
              <p className="text-xs font-medium text-foreground">{liveAlerts[liveAlerts.length - 1].reason}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau statistiques + contrôles */}
      <div className="relative z-20 -mt-6 px-3 pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="glass-strong rounded-[28px] px-4 pt-5 pb-4 shadow-premium"
        >
          {/* Distance — statistique principale */}
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">Distance</p>
            <div className="flex items-end justify-center gap-2 mt-1">
              <motion.span
                key={distance.toFixed(2)}
                initial={{ opacity: 0.6, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                className="font-display font-black text-[3.75rem] leading-[0.9] tracking-tight text-foreground neon-text tabular-nums"
              >
                {distance.toFixed(2)}
              </motion.span>
              <span className="font-display font-bold text-base text-muted-foreground pb-2">km</span>
            </div>
          </div>

          {/* Grille de stats secondaires */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniStat icon={Timer} label="Durée" value={formatTime(seconds)} delay={0.05} />
            <MiniStat icon={Gauge} label="Allure" value={formatPace()} unit="/km" tone="primary" delay={0.1} />
            <MiniStat icon={Zap} label="Vitesse" value={speed.toFixed(1)} unit="km/h" tone="primary" delay={0.15} />
            <MiniStat icon={Footprints} label="Pas" value={String(steps)} tone="accent" delay={0.2} />
            <MiniStat icon={Flame} label="Calories" value={String(calories)} unit="kcal" tone="accent" delay={0.25} />
            <MiniStat icon={Route} label="Points GPS" value={String(gpsPoints.length)} delay={0.3} />
          </div>

          {/* Contrôles */}
          <div className="mt-5 flex items-center justify-center gap-5 min-h-[104px]">
            <AnimatePresence mode="wait">
              {state === "idle" && (
                <motion.button
                  key="start"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ ease: [0.34, 1.56, 0.64, 1] }}
                  whileTap={{ scale: 0.93 }}
                  onClick={handleStart}
                  className="relative w-[104px] h-[104px] rounded-full gradient-primary flex flex-col items-center justify-center neon-glow-strong"
                >
                  <span className="pulse-ring absolute inset-0 rounded-full" />
                  <Play className="w-7 h-7 text-primary-foreground ml-1" />
                  <span className="mt-1 font-display font-black text-[11px] tracking-[0.2em] text-primary-foreground">DÉMARRER</span>
                </motion.button>
              )}

              {state === "running" && (
                <motion.div key="running" className="flex items-center gap-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={handlePause}
                    className="w-[92px] h-[92px] rounded-full bg-foreground/[0.06] border border-foreground/10 flex flex-col items-center justify-center backdrop-blur-sm"
                  >
                    <Pause className="w-6 h-6 text-foreground" />
                    <span className="mt-1 font-display font-black text-[10px] tracking-[0.18em] text-muted-foreground">PAUSE</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setConfirmFinish(true)}
                    className="w-[72px] h-[72px] rounded-full bg-destructive/15 border border-destructive/40 flex flex-col items-center justify-center"
                  >
                    <Square className="w-5 h-5 text-destructive" />
                    <span className="mt-1 font-display font-black text-[9px] tracking-[0.16em] text-destructive">FIN</span>
                  </motion.button>
                </motion.div>
              )}

              {state === "paused" && (
                <motion.div key="paused" className="flex items-center gap-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={handleResume}
                    className="w-[104px] h-[104px] rounded-full gradient-primary flex flex-col items-center justify-center neon-glow"
                  >
                    <Play className="w-7 h-7 text-primary-foreground ml-1" />
                    <span className="mt-1 font-display font-black text-[10px] tracking-[0.18em] text-primary-foreground">REPRENDRE</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => setConfirmFinish(true)}
                    className="w-[72px] h-[72px] rounded-full bg-destructive/15 border border-destructive/40 flex flex-col items-center justify-center"
                  >
                    <Square className="w-5 h-5 text-destructive" />
                    <span className="mt-1 font-display font-black text-[9px] tracking-[0.16em] text-destructive">FIN</span>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Confirmation avant de terminer */}
      <AnimatePresence>
        {confirmFinish && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={() => setConfirmFinish(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.97 }}
              transition={{ ease: [0.34, 1.56, 0.64, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass-strong rounded-3xl p-6 shadow-premium mb-[calc(env(safe-area-inset-bottom)+1rem)] sm:mb-0"
            >
              <h3 className="font-display font-black text-xl text-foreground text-center">Terminer la course ?</h3>
              <p className="text-sm text-muted-foreground text-center mt-2">
                {distance.toFixed(2)} km en {formatTime(seconds)}. Cette action est définitive.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setConfirmFinish(false)}
                  className="flex-1 rounded-2xl bg-foreground/[0.06] border border-foreground/10 py-3 font-display font-bold text-foreground"
                >
                  Continuer
                </button>
                <button
                  onClick={() => { setConfirmFinish(false); handleFinish(); }}
                  className="flex-1 rounded-2xl bg-destructive py-3 font-display font-bold text-destructive-foreground"
                >
                  Terminer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
