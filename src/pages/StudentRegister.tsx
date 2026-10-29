import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, UserCheck, AlertCircle, CheckCircle, Smartphone, WifiOff } from 'lucide-react';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { decodeQRData, isQRValid } from '@/lib/qrGenerator';
import { AttendanceRegistrationError, registerAttendanceSecure } from '@/lib/attendanceApi';
import { studentRegisterSchema, type StudentRegisterInput } from '@/lib/validations';
import { addToOfflineQueue } from '@/lib/offlineQueue';

interface StudentFormData {
  studentNumber: string;
  firstName: string;
  lastName: string;
}

function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => reject(new Error('تعذر الحصول على الموقع الجغرافي')),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qrData = searchParams.get('qr');
  const sessionId = searchParams.get('sessionId');
  const method = searchParams.get('method') as 'qr' | 'code';

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [offlineSuccess, setOfflineSuccess] = useState(false);
  const [studentData, setStudentData] = useState<StudentFormData | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const { register, handleSubmit, formState: { errors } } = useForm<StudentRegisterInput>({
    resolver: zodResolver(studentRegisterSchema),
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const init = async () => {
      try {
        setFingerprint(await getDeviceFingerprint());

        if (!sessionId || !method) {
          setError('بيانات الجلسة غير مكتملة في الرابط. حاول إعادة المسح.');
          return;
        }

        if (method === 'qr' && qrData) {
          const decoded = decodeQRData(qrData);
          if (!decoded || !isQRValid(decoded, 120)) {
            setError('رمز QR منتهي الصلاحية أو غير صالح');
            return;
          }
          if (decoded.sessionId !== sessionId) {
            setError('رمز QR لا يتطابق مع الجلسة');
          }
        }
      } catch (err) {
        console.error('init error', err);
        setError('حدث خطأ أثناء تهيئة الصفحة.');
      }
    };

    void init();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [sessionId, method, qrData]);

  const onSubmit = async (data: StudentRegisterInput) => {
    setError('');
    setLoading(true);

    try {
      if (!sessionId || !method) {
        setError('معرف الجلسة غير موجود');
        return;
      }

      setStudentData({
        studentNumber: data.studentNumber.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveOffline = () => {
    if (!studentData) return;

    addToOfflineQueue({
      sessionId: sessionId || '',
      sessionCode: sessionId || '',
      studentNumber: studentData.studentNumber,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      method,
      deviceFingerprint: fingerprint,
      timestamp: Date.now(),
      qrData: qrData || undefined,
    });

    setOfflineSuccess(true);
    setTimeout(() => navigate('/'), 4000);
  };

  const submitSecureAttendance = async (location?: { latitude: number; longitude: number }) => {
    if (!studentData || !sessionId) return;

    await registerAttendanceSecure({
      sessionId,
      sessionCode: method === 'code' ? sessionId : undefined,
      sessionToken: sessionId,
      qrData,
      method,
      studentNumber: studentData.studentNumber,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      deviceFingerprint: fingerprint,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });
  };

  const confirmAttendance = async () => {
    if (!studentData || !sessionId) return;
    setError('');
    setLoading(true);

    try {
      if (!navigator.onLine) {
        saveOffline();
        return;
      }

      try {
        await submitSecureAttendance();
      } catch (err) {
        if (err instanceof AttendanceRegistrationError && err.code === 'LOCATION_REQUIRED') {
          const location = await getBrowserPosition();
          await submitSecureAttendance(location);
        } else {
          throw err;
        }
      }

      setSuccess(true);
      setTimeout(() => navigate('/'), 3000);
    } catch (err) {
      console.error(err);
      const rawMsg = err instanceof Error ? err.message : '';
      const friendly =
        rawMsg && !/غير مكتملة|غير صالح|لا يتطابق|غير موجود|حدث خطأ/i.test(rawMsg)
          ? 'الجلسة غير موجودة أو منتهية، أو حدث خطأ تقني. تأكد من الرمز وحاول مرة أخرى.'
          : (rawMsg || 'حدث خطأ أثناء تسجيل الحضور');
      setError(friendly);
      setStudentData(null);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <CardTitle className="text-3xl text-green-700">تم تسجيل الحضور بنجاح!</CardTitle>
            <CardDescription className="text-lg">شكرا لك</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (offlineSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center">
              <WifiOff className="w-12 h-12 text-orange-600" />
            </div>
            <CardTitle className="text-2xl text-orange-700">تم حفظ الحضور محليا</CardTitle>
            <CardDescription className="text-base mt-2">
              سيتم إرسال حضورك تلقائيا عند الاتصال بالإنترنت
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (studentData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full space-y-6">
          <Button
            variant="ghost"
            onClick={() => setStudentData(null)}
            className="mb-4 flex items-center gap-1 text-slate-600 hover:text-slate-800"
            disabled={loading}
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            رجوع
          </Button>

          <Card className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCheck className="w-10 h-10 text-blue-600" />
              </div>
              <CardTitle className="text-2xl text-slate-900">تأكيد الحضور</CardTitle>
              <CardDescription className="text-slate-500">الرجاء تأكيد حضورك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    وضع أوفلاين: سيتم حفظ الحضور وإرساله عند توفر الإنترنت
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertDescription>
                  سيتم التحقق من جهازك وربطه بحسابك عند تأكيد الحضور.
                </AlertDescription>
              </Alert>

              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-slate-600">الاسم الكامل</p>
                <p className="text-lg font-semibold text-slate-900">
                  {studentData.firstName} {studentData.lastName}
                </p>
                <p className="text-sm text-slate-600 mt-2">الرقم الجامعي</p>
                <p className="text-lg font-semibold text-slate-900">{studentData.studentNumber}</p>
              </div>

              <Button
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
                size="lg"
                onClick={confirmAttendance}
                disabled={loading}
              >
                {loading ? 'جاري التسجيل...' : 'تأكيد الحضور'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <UserCheck className="w-10 h-10 text-blue-600" />
            </div>
            <CardTitle className="text-2xl text-slate-900">تسجيل البيانات</CardTitle>
            <CardDescription className="text-slate-500">
              أدخل بياناتك للتحقق من الحضور
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                <Label htmlFor="studentNumber">الرقم الجامعي</Label>
                <Input
                  id="studentNumber"
                  {...register('studentNumber')}
                  placeholder="مثال: 2024001"
                  disabled={loading}
                  className="border-slate-200 focus-visible:ring-blue-500"
                />
                {errors.studentNumber && (
                  <p className="text-sm text-red-500">{errors.studentNumber.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">الاسم</Label>
                <Input
                  id="firstName"
                  {...register('firstName')}
                  placeholder="أدخل اسمك"
                  disabled={loading}
                  className="border-slate-200 focus-visible:ring-blue-500"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">اللقب</Label>
                <Input
                  id="lastName"
                  {...register('lastName')}
                  placeholder="أدخل لقبك"
                  disabled={loading}
                  className="border-slate-200 focus-visible:ring-blue-500"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500">{errors.lastName.message}</p>
                )}
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
