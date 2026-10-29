import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

export default function StudentPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
      <div className="max-w-md w-full">

        <Card className="shadow-2xl">
          <CardHeader className="text-center space-y-6">
            
            <div className="mx-auto w-28 h-28 bg-slate-950 rounded-3xl flex items-center justify-center shadow-xl border border-cyan-400/20">
              <img
                src="/logo.png"
                alt="Ausar Military Logo"
                className="w-24 h-24 object-contain drop-shadow-xl"
              />
            </div>

            {/* العنوان */}
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Ausar Military
              </CardTitle>
              <p className="text-xl font-semibold text-gray-700 mt-2">تسجيل الحضور</p>
              <CardDescription className="text-lg mt-3">
                مرحباً بك في نظام الحضور الذكي
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* معلومات سريعة */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <p className="text-sm text-blue-900 text-center font-medium">
                ✓ مسح QR Code سريع
              </p>
              <p className="text-sm text-blue-900 text-center font-medium">
                ✓ أو إدخال رمز الجلسة يدوياً
              </p>
            </div>

            {/* زر البدء */}
            <Button 
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg" 
              size="lg"
              onClick={() => navigate('/scan')}
            >
              ابدأ الآن
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-6 space-y-1">
          <p>🎓 نظام آمن وموثوق | Secure & Reliable</p>
          <p className="font-semibold text-gray-500">© 2026 Ausar Military</p>
        </div>
      </div>
    </div>
  );
}
