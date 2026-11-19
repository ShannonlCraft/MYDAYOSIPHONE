/* My Day service worker */
const CACHE_NAME = "myday-v7";
const ASSETS = ["./", "./index.html", "./manifest.json", "./MyDay_Icon_Transparent.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const isPage = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isPage) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      return clients.openWindow("./");
    })
  );
});

const scheduledNotifs = new Map();

self.addEventListener("message", event => {
  const { type, payload } = event.data || {};

  if (type === "SCHEDULE_NOTIF") {
    const { id, title, body, fireAt } = payload;
    const delay = fireAt - Date.now();
    if (delay <= 0) return;
    if (scheduledNotifs.has(id)) clearTimeout(scheduledNotifs.get(id));

    const timer = setTimeout(async () => {
      scheduledNotifs.delete(id);
      try {
        await self.registration.showNotification(title, {
          body,
          icon: "./MyDay_Icon_Transparent.png",
          badge: "./MyDay_Icon_Transparent.png",
          vibrate: [200, 100, 200],
          tag: id,
          requireInteraction: false
        });
      } catch (e) {}
    }, delay);

    scheduledNotifs.set(id, timer);
  }

  if (type === "CANCEL_NOTIF") {
    const { id } = payload;
    if (scheduledNotifs.has(id)) {
      clearTimeout(scheduledNotifs.get(id));
      scheduledNotifs.delete(id);
    }
  }

  if (type === "CLEAR_ALL_NOTIFS") {
    scheduledNotifs.forEach(timer => clearTimeout(timer));
    scheduledNotifs.clear();
  }

  if (type === "SCHEDULE_5AM") {
    const { fireAt } = payload;
    const delay = fireAt - Date.now();
    if (delay <= 0) return;
    if (scheduledNotifs.has("__5am__")) clearTimeout(scheduledNotifs.get("__5am__"));

    const timer = setTimeout(async () => {
      scheduledNotifs.delete("__5am__");
      const allClients = await clients.matchAll({ includeUncontrolled: true });
      allClients.forEach(client => client.postMessage({ type: "WAKE_5AM" }));
    }, delay);

    scheduledNotifs.set("__5am__", timer);
  }
});
