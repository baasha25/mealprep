// PrepFlow storefront service worker: web push only (no offline caching).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "PrepFlow", body: "", url: "/", tag: "prepflow" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* plain-text payload */
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/leaf-192.png",
      badge: "/icons/leaf-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w && w.url.includes(url)) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
