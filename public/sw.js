/* Service Worker de notificaciones push — AMP+ Club de Beneficios */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {
        title: "AMP+ Club de Beneficios",
        body: "Tenés una nueva novedad.",
        url: "/",
      };

      // Si el push trae payload, se usa; si no, se busca el contenido en el server.
      try {
        if (event.data) {
          data = { ...data, ...event.data.json() };
        } else {
          const res = await fetch("/api/push/latest", { cache: "no-store" });
          if (res.ok) {
            const latest = await res.json();
            if (latest && latest.title) data = { ...data, ...latest };
          }
        }
      } catch (e) {
        // Se muestra el mensaje por defecto.
      }

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        data: { url: data.url || "/" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});
