/*
 * 단톡 웹앱용 서비스 워커
 * - 단톡 화면 파일만 다룬다(아래 TALK_FILES). 다른 페이지(운영관리자·전자결재 등)와 Supabase·CDN 요청은 건드리지 않는다.
 * - 항상 네트워크를 먼저 쓰고(고친 내용이 바로 반영되게), 연결이 끊겼을 때만 마지막으로 받은 화면을 보여준다.
 */
const CACHE = "talk-shell-v3";
const TALK_FILES = [
  "talk.html", "talk.webmanifest",
  "assets/style.css", "assets/site.js", "assets/sb.js",
  "assets/icons/talk-192.png", "assets/icons/talk-512.png",
];
const BASE = new URL("./", self.location).href;
const isTalkFile = url => url.startsWith(BASE) && TALK_FILES.includes(url.slice(BASE.length).split(/[?#]/)[0]);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(TALK_FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("talk-shell-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
/* ── 휴대폰 알림 (Web Push) ──
 * 서버(talk-push)가 보낸 { title, body, room } 을 알림으로 띄운다.
 * 단톡 화면을 지금 보고 있으면 띄우지 않는다(화면에 이미 실시간으로 보이므로). 같은 방 알림은 하나로 묶는다. */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "단톡", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const watching = wins.some(w => w.visibilityState === "visible" && w.focused && /talk\.html/.test(w.url));
    if (watching) return;
    await self.registration.showNotification(d.title || "단톡", {
      body: d.body || "새 메시지가 있습니다.",
      icon: "assets/icons/talk-192.png",
      badge: "assets/icons/talk-192.png",
      tag: "talk-" + (d.room || "all"),
      renotify: true,
      // 결재 알림처럼 연결 화면(url)이 있으면 그 화면을, 없으면 그 대화방을 연다
      data: { url: d.url || ("talk.html?room=" + encodeURIComponent(d.room || "")) },
    });
  })());
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "talk.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (/talk\.html/.test(url)) {
      const w = wins.find(c => /talk\.html/.test(c.url));
      if (w) { await w.focus(); w.postMessage({ type: "open-room", url }); return; }
    } else if (wins.length && wins[0].navigate) {
      // 열려 있는 단톡·전자결재 창을 그 화면으로 옮긴다
      try { const w = await wins[0].focus(); await (w || wins[0]).navigate(url); return; } catch (err) { /* 아래에서 새 창 */ }
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !isTalkFile(req.url)) return; // 나머지는 브라우저가 평소대로 처리
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split(/[?#]/)[0], copy)); }
      return res;
    }).catch(() => caches.match(req.url.split(/[?#]/)[0]))
  );
});
