import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg);

        // فحص التحديثات كل ساعة
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // مراقبة التحديثات الجديدة
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
              }
            });
          }
        });

        // إذا كان فيه service worker في الانتظار
        if (reg.waiting) {
          setShowUpdate(true);
        }
      });

      // مراقبة تفعيل service worker جديد
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ action: 'skipWaiting' });
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed top-4 left-4 right-4 bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-3 z-50">
      <div className="flex items-center gap-2">
        <RefreshCw size={20} className="animate-spin" />
        <span className="text-sm font-medium">📦 تحديث جديد متوفر!</span>
      </div>
      <button
        onClick={handleUpdate}
        className="bg-white text-green-600 px-4 py-1.5 rounded font-bold text-sm hover:bg-green-50 transition-colors shadow-sm"
      >
        تحديث الآن
      </button>
    </div>
  );
}
