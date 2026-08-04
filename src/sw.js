import { precacheAndRoute } from "workbox-precaching";

// Forzar la activación inmediata del nuevo Service Worker sin esperar a cerrar pestañas
self.addEventListener("install", () => {
  self.skipWaiting();
});

// Precarga los recursos compilados por Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// Escuchar evento Push
self.addEventListener("push", function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Recordatorio", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "⏰ Recordatorio de Órbita";
  const options = {
    body: data.body || "Tienes una tarea pendiente.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/",
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Escuchar clic en la notificación para abrir la app
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(windowClients) {
      // Si hay una ventana abierta, enfocarla
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // Si no, abrir una nueva pestaña
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
