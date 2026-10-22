self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Club de Beneficios LPRC", {
      body: "Tus notificaciones están conectadas. Abrí el portal para consultar tus beneficios y cupones.",
      icon: "/lprc-app-icon-192.png",
      badge: "/favicon-32x32.png",
      tag: "lprc-beneficios",
      data: { url: "/perfil/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL("/perfil/", self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
