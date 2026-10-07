/*
 * 단톡 웹앱용 서비스 워커
 * - 단톡 화면 파일만 다룬다(아래 TALK_FILES). 다른 페이지(운영관리자·전자결재 등)와 Supabase·CDN 요청은 건드리지 않는다.
 * - 항상 네트워크를 먼저 쓰고(고친 내용이 바로 반영되게), 연결이 끊겼을 때만 마지막으로 받은 화면을 보여준다.
 */
const CACHE = "talk-shell-v1";
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
