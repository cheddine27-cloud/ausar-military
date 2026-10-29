const CACHE_NAME = 'Ausar Military-v2.5.0-official-domain';
const CANONICAL_ORIGIN = 'https://Ausar Military.app';
const LEGACY_HOSTS = ['smartattend-seven.vercel.app'];
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ حذف كاش قديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// استقبال رسالة من التطبيق لتفعيل التحديث
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Fetch Strategy: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  // ✅ تجاهل طلبات POST/PATCH/DELETE - فقط GET يُحفظ
  if (event.request.method !== 'GET') {
    return;
  }

  // ✅ تجاهل chrome-extension و Vercel analytics
  const url = event.request.url;
  const requestUrl = new URL(url);
  if (LEGACY_HOSTS.includes(requestUrl.hostname) && event.request.mode === 'navigate') {
    event.respondWith(Response.redirect(
      `${CANONICAL_ORIGIN}${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}`,
      308
    ));
    return;
  }

  if (url.includes('chrome-extension') || 
      url.includes('_vercel/insights') ||
      url.includes('/_vercel/') ||
      url.startsWith('chrome://')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ✅ تحقق أن الاستجابة صالحة قبل الحفظ
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          })
          .catch((err) => {
            // تجاهل أخطاء الكاش بصمت
            console.warn('Cache put failed:', err);
          });
        return response;
      })
      .catch((err) => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          throw err;
        });
      })
  );
});
