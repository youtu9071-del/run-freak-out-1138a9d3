// FREAK-OUT service worker — installability + activity notification support
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Click sur une notification FREAK-OUT → toujours ouvrir/mettre au premier plan
// l'application et rediriger vers la page d'accueil ("/"). Jamais de 404.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const TARGET = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        try { await client.focus(); } catch { /* ignore */ }
        if ("navigate" in client) {
          try { await client.navigate(new URL(TARGET, self.location.origin).href); } catch { /* ignore */ }
        }
        return;
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(new URL(TARGET, self.location.origin).href);
      }
    })()
  );
});


// Contrôle depuis la page : afficher / masquer la notif d'activité
self.addEventListener("message", async (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_ACTIVITY_NOTIFICATION") {
    await self.registration.showNotification("FREAK-OUT", {
      body: `Course en cours · ${data.time} • ${data.distance} km`,
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
