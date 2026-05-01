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
}

export default function ActivityMap({ gpsPoints }: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [48.8566, 2.3522],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Fix sizing issues when container becomes visible
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
      polylineRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update polyline + marker when gpsPoints change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (gpsPoints.length === 0) return;

    const latlngs: [number, number][] = gpsPoints.map((p) => [p.lat, p.lng]);
    const last = latlngs[latlngs.length - 1];

    // Polyline
    if (latlngs.length >= 2) {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: "hsl(142, 71%, 45%)",
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
      }
    }

    // Marker (current position)
    if (markerRef.current) {
      markerRef.current.setLatLng(last);
    } else {
      markerRef.current = L.circleMarker(last, {
        radius: 8,
        color: "hsl(142, 71%, 45%)",
        fillColor: "hsl(142, 71%, 45%)",
        fillOpacity: 1,
        weight: 3,
      }).addTo(map);
    }

    map.setView(last, map.getZoom(), { animate: true });
  }, [gpsPoints]);

  return <div ref={containerRef} className="w-full h-full z-0" style={{ background: "hsl(var(--muted))" }} />;
}
