import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { loginAdmin, resolveLandingRoute } from '@/lib/database';
import { loginSchema, type LoginInput } from '@/lib/validations';

/**
 * Unified login page for ALL administrative & teaching roles in Ausar Military:
 *   - Super Admin (platform owner)
 *   - Institution Owner / Institution Admin
 *   - Faculty / Department Admin
 *   - Teacher
 *
 * Students do NOT log in here — they use the Flutter / web attendance flow.
 *
 * Routing after a successful login is centralized in `resolveLandingRoute`
 * (see src/lib/database.ts) so adding a new role only touches one place.
 */
export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setError('');
    setIsSubmitting(true);

    try {
      const admin = await loginAdmin(data.username, data.password);

      if (!admin) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }

      navigate(resolveLandingRoute(admin.role));
    } catch {
      setError('تعذر تسجيل الدخول، حاول مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <div className="max-w-md w-full space-y-6">

        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:bg-white/50"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Button>

        <Card className="shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <img
                src="/logo.png"
                alt="Ausar Military Logo"
                className="w-24 h-24 drop-shadow-lg"
              />
            </div>

            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>

            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Ausar Military
              </CardTitle>
              <p className="text-lg font-semibold text-gray-700 mt-1">تسجيل الدخول إلى لوحة التحكم</p>
              <CardDescription className="mt-2">
                مالك المنصة، مدير المؤسسة، أو الأستاذ — أدخل بياناتك للمتابعة
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم أو البريد الإلكتروني</Label>
                <Input
                  id="username"
                  {...register('username')}
                  placeholder="مثال: taher أو taher@univ-skikda.dz"
                  className="text-right"
                  autoComplete="username"
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder="••••••••"
                  className="text-right"
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-800">
                  💼 للحصول على بيانات الدخول، يرجى التواصل مع إدارة مؤسستك
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-gray-500">
          <p>🔒 محمي بنظام أمان متقدم | Secured System</p>
        </div>
      </div>
    </div>
  );
}
