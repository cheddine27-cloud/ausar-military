import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface IOSNavigator extends Navigator {
  standalone?: boolean;
}

interface IOSWindow extends Window {
  MSStream?: unknown;
}

export default function InstallButton() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const isControlPanel =
    location.pathname.startsWith('/panel-sk2025x') || location.pathname === '/download';

  useEffect(() => {
    // تحقق إذا iPhone/iPad
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as IOSWindow).MSStream;
    const isInStandaloneMode = Boolean((window.navigator as IOSNavigator).standalone);
    
    setIsIOS(isIOSDevice && !isInStandaloneMode);

    // تحقق إذا التطبيق مثبّت مسبقاً
    if (window.matchMedia('(display-mode: standalone)').matches || isInStandaloneMode) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
       e.preventDefault();
       setDeferredPrompt(e as BeforeInstallPromptEvent);
     };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    // إذا iOS - اعرض التعليمات
    if (isIOS) {
      setShowInstructions(true);
      return;
    }

    // إذا Android ويوجد prompt جاهز
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ المستخدم وافق على التثبيت');
      }
      
      setDeferredPrompt(null);
      return;
    }

    // إذا Android لكن ما فيه prompt بعد - اعرض تعليمات يدوية
    setShowInstructions(true);
  };

  // إخفاء الزر إذا التطبيق مثبّت
  if (isInstalled || isControlPanel) return null;

  // نافذة التعليمات
  if (showInstructions) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">📱 تثبيت التطبيق</h3>
            <button 
              onClick={() => setShowInstructions(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <X size={24} />
            </button>
          </div>
          
          {isIOS ? (
            // تعليمات iPhone
            <div className="space-y-4 text-right">
              <p className="text-gray-700">لتثبيت التطبيق على iPhone:</p>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                  <span>اضغط زر <strong>المشاركة</strong> (المربع بالسهم ⬆️) أسفل الشاشة</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                  <span>مرر للأسفل واختر <strong>"Add to Home Screen"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                  <span>اضغط <strong>"Add"</strong> ✅</span>
                </li>
              </ol>
            </div>
          ) : (
            // تعليمات Android
            <div className="space-y-4 text-right">
              <p className="text-gray-700">لتثبيت التطبيق على Android:</p>
              <ol className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-600 flex-shrink-0">1.</span>
                  <span>اضغط القائمة (النقاط الثلاث ⋮) أعلى اليمين</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-600 flex-shrink-0">2.</span>
                  <span>اختر <strong>"Install app"</strong> أو <strong>"إضافة إلى الشاشة الرئيسية"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-green-600 flex-shrink-0">3.</span>
                  <span>اضغط <strong>"Install"</strong> أو <strong>"تثبيت"</strong> ✅</span>
                </li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-600">
                💡 <strong>ملاحظة:</strong> إذا لم تجد الخيار، جرّب تحديث المتصفح أو استخدم Chrome.
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // الزر يظهر دائماً (إلا إذا التطبيق مثبّت)
  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-4 left-4 right-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 hover:from-blue-700 hover:to-blue-600 transition-all z-50 font-medium"
    >
      <Download size={20} />
      <span>ثبّت التطبيق على جهازك</span>
    </button>
  );
}
