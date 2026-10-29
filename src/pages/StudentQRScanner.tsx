import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Camera, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { QRPayload } from '@/lib/types';

export default function StudentQRScannerPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setError('');
      setScanning(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      stream.getTracks().forEach(track => track.stop());

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {}
      );

    } catch (err: unknown) {
      console.error('Camera error:', err);
      const errorName = err instanceof DOMException ? err.name : '';
      if (errorName === 'NotAllowedError') {
        setError('تم رفض الوصول للكاميرا. الرجاء السماح بالوصول من إعدادات المتصفح.');
      } else if (errorName === 'NotFoundError') {
        setError('لم يتم العثور على كاميرا في هذا الجهاز.');
      } else if (errorName === 'NotReadableError') {
        setError('الكاميرا قيد الاستخدام من تطبيق آخر.');
      } else {
        setError('فشل في فتح الكاميرا. تأكد من السماح بالوصول للكاميرا.');
      }
      setScanning(false);
    }
  };

  const handleScan = async (data: string) => {
    try {
      const payload: QRPayload = JSON.parse(data);
      if (!payload.sessionId) {
        setError('رمز QR غير صالح');
        setScanning(false);
        return;
      }

      if (payload.timestamp && Date.now() - payload.timestamp > 2 * 60 * 1000) {
        setError('رمز QR منتهي الصلاحية');
        setScanning(false);
        return;
      }

      navigate(
        `/register?sessionId=${encodeURIComponent(payload.sessionId)}&method=qr&qr=${encodeURIComponent(data)}`,
        { replace: true }
      );
    } catch (err) {
      setError('رمز QR غير صالح');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(console.warn);
    }
    setScanning(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-2xl w-full space-y-6">
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
              <Camera className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-slate-900">مسح QR Code</CardTitle>
            <CardDescription className="text-slate-500">
              وجه الكاميرا نحو رمز QR المعروض على السبورة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div id="qr-reader" className="w-full rounded-xl overflow-hidden bg-slate-100" />

            <div className="flex gap-3">
              {!scanning ? (
                <Button onClick={startScanning} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  تشغيل الكاميرا
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="outline" className="flex-1">
                  إيقاف المسح
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/code-entry')} className="flex-1">
                إدخال الرمز
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
