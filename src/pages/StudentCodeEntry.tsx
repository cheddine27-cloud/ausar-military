import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Keyboard, AlertCircle, WifiOff } from 'lucide-react';

export default function StudentCodeEntryPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const sessionCode = code.trim().toUpperCase();
      if (!sessionCode) {
        setError('الرجاء إدخال رمز الجلسة');
        return;
      }

      navigate(`/register?sessionId=${encodeURIComponent(sessionCode)}&method=code`);
    } catch (error) {
      console.error('Error:', error);
      setError('حدث خطأ أثناء التحقق من الجلسة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/scan')}
          className="mb-4 flex items-center gap-1 text-slate-600 hover:text-slate-800"
        >
          <ArrowRight className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Keyboard className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-slate-900">إدخال رمز الجلسة</CardTitle>
            <CardDescription className="text-slate-500">
              أدخل الرمز المعروض على السبورة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!isOnline && (
                <Alert>
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    وضع أوفلاين: يمكنك المتابعة، سيحفظ الحضور محليا
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="code">رمز الجلسة</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="مثال: ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="text-center text-2xl font-mono tracking-wider border-slate-200 focus-visible:ring-blue-500"
                  maxLength={6}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
                size="lg"
                disabled={loading}
              >
                {loading ? 'جاري التحقق...' : 'متابعة'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
