/* Web Push service worker for the portal. Served from public/push-sw.js; source copy in features/chat-p2/sw (see WIRING.md).
   Payload from the notify-push Edge Function: { title, body, url, tag }. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "BrandSurge";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Skip the system notification when a focused tab is already on that page; the in-app bell covers it.
      const here = wins.some((w) => w.focused && data.url && new URL(w.url).pathname === new URL(data.url, self.location.origin).pathname);
      if (here) return undefined;
      return self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || undefined,
        icon: "/icon.svg",
        data: { url: data.url || "/home" },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/home", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
