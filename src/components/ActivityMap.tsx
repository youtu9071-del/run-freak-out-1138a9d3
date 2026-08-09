import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

interface ActivityMapProps {
  gpsPoints: GpsPoint[];
  initialPosition?: { lat: number; lng: number } | null;
  /** Increment this value to recenter the map on the current position */
  recenterKey?: number;
  /** Photo de profil de l'utilisateur, utilisée comme marqueur si disponible */
  avatarUrl?: string | null;
}

export default function ActivityMap({ gpsPoints, initialPosition, recenterKey = 0, avatarUrl }: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | L.Marker | null>(null);
  const pulseRef = useRef<L.CircleMarker | null>(null);
  const initialCenteredRef = useRef(false);


  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialPosition ? [initialPosition.lat, initialPosition.lng] : [0, 0],
      zoom: initialPosition ? 16 : 2,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Recalculate size on visibility / resize
    const invalidate = () => map.invalidateSize();
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 500);
    const t3 = setTimeout(invalidate, 1200);

    window.addEventListener("resize", invalidate);
    document.addEventListener("visibilitychange", invalidate);

    // Observe container size changes
    const resizeObserver = new ResizeObserver(invalidate);
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener("resize", invalidate);
      document.removeEventListener("visibilitychange", invalidate);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
      pulseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When initialPosition arrives (first GPS fix), recenter map immediately
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initialPosition || initialCenteredRef.current) return;
    map.setView([initialPosition.lat, initialPosition.lng], 16, { animate: true });
    initialCenteredRef.current = true;
    setTimeout(() => map.invalidateSize(), 50);
  }, [initialPosition]);

  // Update polyline + marker when gpsPoints change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (gpsPoints.length === 0) return;

    const latlngs: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);
    const last = latlngs[latlngs.length - 1];

    // Polyline (path)
    if (latlngs.length >= 2) {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: "hsl(142, 71%, 45%)",
          weight: 5,
          opacity: 0.9,
        }).addTo(map);
      }
    }

    // Pulse halo (outer)
    if (pulseRef.current) {
      pulseRef.current.setLatLng(last);
    } else {
      pulseRef.current = L.circleMarker(last, {
        radius: 16,
        color: "hsl(142, 71%, 45%)",
        fillColor: "hsl(142, 71%, 45%)",
        fillOpacity: 0.2,
        weight: 0,
      }).addTo(map);
    }

    // Marqueur : photo de profil si disponible, sinon point vert
    if (markerRef.current) {
      markerRef.current.setLatLng(last);
    } else if (avatarUrl) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:44px;height:44px;border-radius:9999px;overflow:hidden;border:3px solid hsl(142,71%,45%);box-shadow:0 0 0 3px rgba(255,255,255,0.9),0 4px 12px rgba(0,0,0,0.35);background:#000">
          <img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" />
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      markerRef.current = L.marker(last, { icon, interactive: false }).addTo(map);
    } else {
      markerRef.current = L.circleMarker(last, {
        radius: 8,
        color: "#ffffff",
        fillColor: "hsl(142, 71%, 45%)",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    // Auto-center on user
    map.setView(last, map.getZoom() < 14 ? 16 : map.getZoom(), { animate: true });
  }, [gpsPoints, avatarUrl]);


  // Manual recenter
  useEffect(() => {
    if (!recenterKey) return;
    const map = mapRef.current;
    if (!map) return;
    const last = gpsPoints[gpsPoints.length - 1];
    const target = last ? [last.lat, last.lng] : initialPosition ? [initialPosition.lat, initialPosition.lng] : null;
    if (!target) return;
    map.setView(target as [number, number], 17, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  return <div ref={containerRef} className="w-full h-full z-0" style={{ background: "hsl(var(--muted))" }} />;
}
