import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { QrCode, Keyboard, ArrowRight, Wifi, WifiOff, Trash2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getOfflineQueue, clearOfflineQueue, manualSync } from '@/lib/offlineQueue'; // ✅ استخدم manualSync
import { toast } from 'sonner';

export default function StudentScanPage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkPending = () => {
      const queue = getOfflineQueue();
      setPendingCount(queue.length);
    };

    checkPending();
    const interval = setInterval(checkPending, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // ✅ مزامنة يدوية محسّنة مع تقارير مفصلة
  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('لا يوجد اتصال بالإنترنت');
      return;
    }

    setSyncing(true);
    console.log('🔄 Manual sync button clicked');
    
    try {
      const result = await manualSync();
      
      console.log('Sync result:', result);
      
      // تحديث العداد
      setTimeout(() => {
        const remaining = getOfflineQueue().length;
        setPendingCount(remaining);
        setSyncing(false);
        
        if (result.success) {
          if (result.synced > 0) {
            toast.success(result.message);
          } else {
            toast.info(result.message);
          }
        } else {
          toast.error(result.message);
        }
      }, 500);
      
    } catch (error: unknown) {
      console.error('Manual sync error:', error);
      setSyncing(false);
      toast.error('حدث خطأ أثناء الإرسال');
    }
  };

  // ✅ مسح الطوارئ
  const handleClearQueue = () => {
    if (confirm('هل تريد مسح كل الحضورات المعلقة؟')) {
      clearOfflineQueue();
      setPendingCount(0);
      toast.success('تم مسح الحضورات المعلقة');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
      <div className="max-w-2xl w-full space-y-6">
        
        {/* زر الرجوع */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="hover:bg-white/50"
        >
          <ArrowRight className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        {/* إشعار حالة الاتصال */}
        {!isOnline && (
          <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4 flex items-center gap-3">
            <WifiOff className="w-6 h-6 text-orange-600" />
            <div className="flex-1 text-right">
              <p className="font-bold text-orange-900">وضع أوفلاين</p>
              <p className="text-sm text-orange-700">سيتم حفظ الحضور وإرساله عند توفر الإنترنت</p>
            </div>
          </div>
        )}

        {/* إشعار الحضورات المعلقة */}
        {pendingCount > 0 && (
          <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 flex-1">
                <Wifi className="w-6 h-6 text-blue-600 animate-pulse" />
                <div className="text-right">
                  <p className="font-bold text-blue-900">⏳ {pendingCount} حضور معلق</p>
                  <p className="text-sm text-blue-700">
                    {isOnline ? 'اضغط "إرسال الآن" لإرسال الحضور' : 'سيُرسل عند توفر الإنترنت'}
                  </p>
                </div>
              </div>
              {/* زر مسح الطوارئ */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearQueue}
                className="text-red-600 hover:bg-red-50"
                disabled={syncing}
              >
                <Trash2 size={16} />
              </Button>
            </div>

            {/* ✅ زر الإرسال اليدوي */}
            {isOnline && (
              <Button
                onClick={handleManualSync}
                disabled={syncing}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <RefreshCw className="ml-2 h-4 w-4" />
                    إرسال الآن
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* العنوان */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            اختر طريقة التسجيل
          </h1>
          <p className="text-lg text-gray-600">
            يمكنك المسح بالكاميرا أو إدخال الرمز يدوياً
          </p>
        </div>

        {/* البطاقات */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* بطاقة QR Code */}
          <Card 
            className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 hover:border-blue-400"
            onClick={() => navigate('/qr-scanner')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-24 h-24 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <QrCode className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-2xl text-gray-900">مسح QR Code</CardTitle>
              <CardDescription className="text-base">
                استخدم كاميرا الجهاز لمسح الرمز
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg" 
                size="lg"
              >
                فتح الكاميرا
              </Button>
            </CardContent>
          </Card>

          {/* بطاقة إدخال الرمز */}
          <Card 
            className="hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border-2 hover:border-cyan-400"
            onClick={() => navigate('/code-entry')}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-24 h-24 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <Keyboard className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-2xl text-gray-900">إدخال الرمز</CardTitle>
              <CardDescription className="text-base">
                أدخل رمز الجلسة يدوياً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white shadow-lg" 
                variant="outline" 
                size="lg"
              >
                إدخال الرمز
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* معلومة إضافية */}
        <div className="text-center text-sm text-gray-500 mt-6">
          <p>💡 {isOnline ? 'متصل بالإنترنت' : 'يعمل بدون إنترنت'}</p>
        </div>
      </div>
    </div>
  );
}
