// Notification persistante FREAK-OUT pendant une course

export async function requestNotifPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export async function showActivityNotification(seconds: number, distanceKm: number) {
  if (!("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.active) return;
  reg.active.postMessage({
    type: "SHOW_ACTIVITY_NOTIFICATION",
    time: formatTime(seconds),
    distance: distanceKm.toFixed(2),
  });
}

export async function hideActivityNotification() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg?.active) return;
  reg.active.postMessage({ type: "HIDE_ACTIVITY_NOTIFICATION" });
}
