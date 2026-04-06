import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Square, Route, Timer, Zap, ChevronLeft, Shield, ShieldAlert, ShieldX, MapPin, Footprints } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculateCalories } from "@/lib/gamification";
import { GpsPoint, haversineDistance, analyzeSpeed, analyzeGpsJump, analyzeSession, CheatAlert, SessionIntegrity } from "@/lib/anticheat";
import { calculateFP, saveActivity } from "@/lib/freakPoints";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Polyline, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Component to recenter map on user position
function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

type TrackingState = "idle" | "running" | "paused" | "finished";

export default function ActivityScreen() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [state, setState] = useState<TrackingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [steps, setSteps] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<"waiting" | "active" | "denied" | "unavailable">("waiting");
  const [integrity, setIntegrity] = useState<SessionIntegrity | null>(null);
  const [liveAlerts, setLiveAlerts] = useState<CheatAlert[]>([]);
  const [savedFp, setSavedFp] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GpsPoint | null>(null);

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

        if (pos.coords.accuracy > 50) return;

        if (lastPointRef.current) {
          const d = haversineDistance(lastPointRef.current, point);
          if (d > 0.003 && d < 0.5) {
            setDistance(prev => prev + d);
          }
          const alert = analyzeGpsJump(lastPointRef.current, point);
          if (alert) setLiveAlerts(prev => [...prev.slice(-4), alert]);
        }

        lastPointRef.current = point;
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

  // ─── Controls ───
  const handleStart = () => { setState("running"); startGps(); };
  const handlePause = () => { setState("paused"); stopGps(); };
  const handleResume = () => { setState("running"); startGps(); };

  const handleFinish = async () => {
    stopGps();
    setState("finished");
    const speed = seconds > 0 ? distance / (seconds / 3600) : 0;
    const result = analyzeSession(gpsPoints, steps, distance, speed);
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
      refreshProfile();
    }
  };

  const speed = seconds > 0 ? distance / (seconds / 3600) : 0;
  const calories = calculateCalories(distance);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const integrityIcon = () => {
    if (!integrity) return null;
    if (integrity.status === "clean") return <Shield className="w-5 h-5 text-primary" />;
    if (integrity.status === "suspect") return <ShieldAlert className="w-5 h-5 text-accent" />;
    return <ShieldX className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col max-w-lg mx-auto">
      {/* Map area with Leaflet */}
      <div className="relative h-[45vh] overflow-hidden">
        <MapContainer
          center={gpsPoints.length > 0 ? [gpsPoints[gpsPoints.length - 1].lat, gpsPoints[gpsPoints.length - 1].lng] : [48.8566, 2.3522]}
          zoom={16}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full z-0"
          style={{ background: "hsl(var(--muted))" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapUpdater position={gpsPoints.length > 0 ? [gpsPoints[gpsPoints.length - 1].lat, gpsPoints[gpsPoints.length - 1].lng] : null} />
          {/* Polyline trace */}
          {gpsPoints.length >= 2 && (
            <Polyline
              positions={gpsPoints.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "hsl(142, 71%, 45%)", weight: 4, opacity: 0.9 }}
            />
          )}
          {/* Current position dot */}
          {gpsPoints.length > 0 && (
            <Circle
              center={[gpsPoints[gpsPoints.length - 1].lat, gpsPoints[gpsPoints.length - 1].lng]}
              radius={8}
              pathOptions={{ color: "hsl(142, 71%, 45%)", fillColor: "hsl(142, 71%, 45%)", fillOpacity: 1, weight: 3 }}
            />
          )}
        </MapContainer>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent z-10" />

        {/* GPS Status */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold glass ${
            gpsStatus === "active" ? "text-primary" :
            gpsStatus === "denied" ? "text-destructive" :
            "text-muted-foreground"
          }`}>
            <MapPin className="w-3.5 h-3.5" />
            {gpsStatus === "active" ? "GPS actif" :
             gpsStatus === "denied" ? "GPS refusé" :
             gpsStatus === "unavailable" ? "GPS indisponible" :
             "En attente"}
          </div>
        </div>

        {/* Steps badge */}
        {(state === "running" || state === "paused") && (
          <div className="absolute top-4 left-14 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold glass text-accent">
            <Footprints className="w-3.5 h-3.5" />
            <span className="font-display">{steps}</span>
            <span className="text-muted-foreground">pas</span>
          </div>
        )}

        <button
          onClick={() => navigate("/")}
          className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full glass flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Live cheat alerts */}
      <AnimatePresence>
        {liveAlerts.length > 0 && state === "running" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 overflow-hidden">
            <div className={`rounded-xl p-3 mt-2 flex items-center gap-3 border ${
              liveAlerts[liveAlerts.length - 1].level === "fraud"
                ? "bg-destructive/10 border-destructive/30"
                : "bg-accent/10 border-accent/30"
            }`}>
              {liveAlerts[liveAlerts.length - 1].level === "fraud"
                ? <ShieldX className="w-5 h-5 text-destructive shrink-0" />
                : <ShieldAlert className="w-5 h-5 text-accent shrink-0" />
              }
              <p className="text-xs font-medium text-foreground">{liveAlerts[liveAlerts.length - 1].reason}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="flex-1 px-4 -mt-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border p-6 mb-4">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Distance</p>
            <p className="font-display font-black text-5xl text-foreground neon-text">{distance.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">km</p>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <Timer className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{formatTime(seconds)}</p>
              <p className="text-[10px] text-muted-foreground">Durée</p>
            </div>
            <div className="text-center">
              <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{speed.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">km/h</p>
            </div>
            <div className="text-center">
              <Footprints className="w-4 h-4 text-accent mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{steps}</p>
              <p className="text-[10px] text-muted-foreground">pas</p>
            </div>
            <div className="text-center">
              <Route className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="font-display font-bold text-lg">{calories}</p>
              <p className="text-[10px] text-muted-foreground">kcal</p>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <AnimatePresence mode="wait">
            {state === "idle" && (
              <motion.button key="start" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} whileTap={{ scale: 0.9 }}
                onClick={handleStart} className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center neon-glow-strong">
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </motion.button>
            )}
            {state === "running" && (
              <motion.div key="controls" className="flex items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handlePause} className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                  <Pause className="w-6 h-6 text-foreground" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleFinish} className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center">
                  <Square className="w-6 h-6 text-destructive-foreground" />
                </motion.button>
              </motion.div>
            )}
            {state === "paused" && (
              <motion.div key="paused" className="flex items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleResume} className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center neon-glow">
                  <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={handleFinish} className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center">
                  <Square className="w-6 h-6 text-destructive-foreground" />
                </motion.button>
              </motion.div>
            )}
            {state === "finished" && (
              <motion.div key="finished" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full">
                {integrity && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl p-4 mb-4 border flex items-center gap-3 ${
                      integrity.status === "clean" ? "bg-primary/10 border-primary/30" :
                      integrity.status === "suspect" ? "bg-accent/10 border-accent/30" :
                      "bg-destructive/10 border-destructive/30"
                    }`}>
                    {integrityIcon()}
                    <div className="text-left flex-1">
                      <p className="font-display font-bold text-sm">
                        {integrity.status === "clean" ? "Session vérifiée ✓" :
                         integrity.status === "suspect" ? "Session suspecte ⚠️" :
                         "Session bloquée 🚫"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Confiance : {integrity.confidence}% {integrity.alerts.length > 0 && `• ${integrity.alerts.length} alerte(s)`}
                      </p>
                    </div>
                  </motion.div>
                )}

                <p className="font-display font-black text-2xl text-primary neon-text mb-2">
                  {integrity?.isBlocked ? "SESSION REJETÉE 🚫" : "COURSE TERMINÉE ! 🎉"}
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  {steps > 0 && `${steps} pas • `}{gpsPoints.length} points GPS
                </p>
                {savedFp !== null && !integrity?.isBlocked && (
                  <p className="text-lg font-bold text-primary mb-4">+{savedFp.toFixed(1)} Freak Points 💰</p>
                )}
                {integrity?.isBlocked && (
                  <p className="text-sm text-destructive mb-4">Aucun point attribué</p>
                )}
                <button onClick={() => navigate("/")} className="rounded-xl gradient-primary px-8 py-3 font-display font-bold text-primary-foreground">
                  RETOUR
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
