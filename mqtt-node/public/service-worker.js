const CACHE_NAME = "sensor-dashboard-cache-v1";
const urlsToCache = [
    "/",
    "/index.html",
    "/past.html",
    "/temperature.html",
    "/soilMoisture1.html",
    "/soilMoisture2.html",
    "/soilMoisture3.html",
    "/humidity.html",
    "/styles.css",
    "/scripts.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
self.addEventListener('push', event => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-128.png'
    });
});

self.addEventListener("push", event => {
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-128.png',
        badge: '/icons/badge-128.png'
    };
    
    if (Notification.permission === "granted") {
        event.waitUntil(
            self.registration.showNotification(data.title || "Sensor Alert", options)
        );
    } else {
        console.warn("Push notification not shown because permission is not granted.");
    
    }
});

