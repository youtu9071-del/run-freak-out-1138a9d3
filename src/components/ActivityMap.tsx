import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
}

function MapUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true });
  }, [position, map]);
  return null;
}

interface ActivityMapProps {
  gpsPoints: GpsPoint[];
}

export default function ActivityMap({ gpsPoints }: ActivityMapProps) {
  const lastPoint = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;
  const center: [number, number] = lastPoint ? [lastPoint.lat, lastPoint.lng] : [48.8566, 2.3522];

  return (
    <MapContainer
      center={center}
      zoom={16}
      zoomControl={false}
      attributionControl={false}
      className="w-full h-full z-0"
      style={{ background: "hsl(var(--muted))" }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapUpdater position={lastPoint ? [lastPoint.lat, lastPoint.lng] : null} />
      {gpsPoints.length >= 2 && (
        <Polyline
          positions={gpsPoints.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "hsl(142, 71%, 45%)", weight: 4, opacity: 0.9 }}
        />
      )}
      {lastPoint && (
        <Circle
          center={[lastPoint.lat, lastPoint.lng]}
          radius={8}
          pathOptions={{ color: "hsl(142, 71%, 45%)", fillColor: "hsl(142, 71%, 45%)", fillOpacity: 1, weight: 3 }}
        />
      )}
    </MapContainer>
  );
}
