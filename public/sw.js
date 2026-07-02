// FREAK-OUT service worker — installability + activity notification support
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Click sur la notification de course → revenir dans l'app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) client.navigate("/activity");
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow("/activity");
    })()
  );
});

// Contrôle depuis la page : afficher / masquer la notif d'activité
self.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_ACTIVITY_NOTIFICATION") {
    await self.registration.showNotification("FREAK-OUT · Course en cours", {
      body: `${data.time} • ${data.distance} km`,
      tag: "freakout-activity",
      renotify: false,
      silent: true,
      requireInteraction: true,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/activity" },
    });
  }
  if (data.type === "HIDE_ACTIVITY_NOTIFICATION") {
    const notifs = await self.registration.getNotifications({ tag: "freakout-activity" });
    notifs.forEach((n) => n.close());
  }
});
