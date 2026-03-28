/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let data = { title: "V|D", body: "", url: "/" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = {
        title: typeof parsed.title === "string" ? parsed.title : data.title,
        body: typeof parsed.body === "string" ? parsed.body : "",
        url: typeof parsed.url === "string" ? parsed.url : "/",
      };
    }
  } catch {
    // ignore
  }

  const rel = data.url && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: rel },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: rel,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.url;
  const path = typeof raw === "string" && raw.startsWith("/") ? raw : "/";
  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url === url && "focus" in c) {
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
