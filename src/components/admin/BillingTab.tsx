import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, ShieldCheck, CreditCard, Rocket, Building, AlertCircle } from 'lucide-react';
import { getInstitutionSubscription, getCurrentAdmin } from '@/lib/database';
import type { Subscription } from '@/lib/types';

export default function BillingTab() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    const admin = getCurrentAdmin();
    if (admin?.institution_id) {
      const sub = await getInstitutionSubscription(admin.institution_id);
      setSubscription(sub);
    }
    setLoading(false);
  };

  const plans = [
    {
      name: 'Free',
      type: 'free',
      price: '0 DA',
      description: 'مثالي للكليات الصغيرة أو الاختبارات الأولية.',
      features: ['حتى 100 طالب', 'حتى 500 جلسة حضور', 'تصدير Excel/PDF بسيط', 'دعم فني عبر البريد'],
      icon: <Rocket className="h-6 w-6 text-slate-400" />,
      color: 'slate'
    },
    {
      name: 'Professional',
      type: 'pro',
      price: '2,500 DA / شهر',
      description: 'للجامعات التي تبحث عن أمان وميزات متقدمة.',
      features: ['حتى 1000 طالب', 'جلسات غير محدودة', 'تصدير تقارير متقدمة', 'السور الجغرافي (Geofencing)', 'أمان QR ديناميكي'],
      icon: <Zap className="h-6 w-6 text-amber-500" />,
      color: 'amber',
      popular: true
    },
    {
      name: 'Enterprise',
      type: 'enterprise',
      price: 'تواصل معنا',
      description: 'حلول مخصصة للمؤسسات التعليمية الكبرى.',
      features: ['طلاب غير محدودين', 'تكامل API مخصص', 'مدير حساب مخصص', 'دعم 24/7', 'استضافة خاصة'],
      icon: <Crown className="h-6 w-6 text-indigo-500" />,
      color: 'indigo'
    }
  ];

  if (loading) return <div className="p-12 text-center animate-pulse text-indigo-600">جاري تحميل بيانات الاشتراك...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <CreditCard className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">إدارة الاشتراك والفوترة</h1>
            <p className="text-slate-500 text-sm">تحكم في باقة مؤسستك وتابع حدود الاستخدام</p>
          </div>
        </div>
      </div>

      {/* الحالة الحالية */}
      <Card className="border-none shadow-sm bg-indigo-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <Building className="h-32 w-32" />
        </div>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-indigo-100">الخطة الحالية</CardTitle>
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none px-4 py-1">
              {subscription?.status === 'active' ? 'نشط' : 'غير نشط'}
            </Badge>
          </div>
          <div className="text-4xl font-black mt-2 uppercase tracking-tight">
            {subscription?.plan_type || 'FREE'} PLAN
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                 <p className="text-xs text-indigo-300 font-bold mb-1 uppercase tracking-widest">حد الطلاب (Capacity)</p>
                 <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold">{subscription?.student_limit || 100} طالب</span>
                    <span className="text-xs text-indigo-400">متاح للمؤسسة</span>
                 </div>
              </div>
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                 <p className="text-xs text-indigo-300 font-bold mb-1 uppercase tracking-widest">تاريخ الانتهاء</p>
                 <div className="flex justify-between items-end">
                    <span className="text-2xl font-bold">
                       {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ar-DZ') : 'دائم (Free)'}
                    </span>
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>

      {/* مقارنة الخطط */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan_type === plan.type;
          return (
            <Card key={plan.name} className={`relative flex flex-col border-2 transition-all hover:shadow-xl ${isCurrent ? 'border-indigo-500 shadow-lg' : 'border-slate-100'}`}>
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                  الأكثر طلباً
                </div>
              )}
              <CardHeader className="text-center pt-8">
                <div className="mx-auto mb-4">{plan.icon}</div>
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="h-10">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3 pt-4">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardContent className="pt-0 pb-8">
                <Button 
                  className={`w-full h-11 rounded-xl text-sm font-bold shadow-md shadow-indigo-100 ${isCurrent ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 border-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'خطتك الحالية' : 'ترقية الآن'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-4">
         <AlertCircle className="h-6 w-6 text-amber-600 mt-1" />
         <div>
            <h4 className="font-bold text-amber-900">هل تحتاج لباقة مخصصة؟</h4>
            <p className="text-sm text-amber-700 mt-1">إذا كانت مؤسستك التعليمية تضم أكثر من 5000 طالب، يرجى التواصل مع فريق المبيعات لدينا للحصول على عرض سعر مخصص يتناسب مع احتياجاتكم.</p>
         </div>
      </div>
    </div>
  );
}
