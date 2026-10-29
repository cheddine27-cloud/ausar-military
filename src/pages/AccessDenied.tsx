import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { logoutAdmin } from '@/lib/database';

/**
 * Shown when a user is authenticated but their role doesn't match any of
 * Ausar Military's known admin/teacher roles. Defensive UX: never leave the user
 * on a blank screen.
 */
export default function AccessDeniedPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/panel-sk2025x/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">الوصول مرفوض</h1>
          <p className="mt-2 text-slate-600 leading-relaxed">
            حسابك مسجّل لكن صلاحياته الحالية لا تسمح بالدخول إلى أي لوحة تحكم.
            تواصل مع إدارة مؤسستك للتحقق من دورك.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={handleLogout} className="w-full bg-slate-900 hover:bg-slate-800">
            تسجيل الخروج والعودة لصفحة الدخول
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowRight className="w-4 h-4" />
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    </div>
  );
}
