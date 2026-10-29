// =============================================================================
// Phase 11 — Subscription view (read-only inside Institution Admin)
// =============================================================================
// Institution managers can READ their own subscription via RLS, but UPDATE is
// restricted to super_admin. So this page is purely informational. We never
// show fake billing buttons — only a clear CTA to contact platform owner.
// =============================================================================

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Calendar,
  Users,
  GraduationCap,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  Mail,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getInstitutionSubscriptionDetail,
  getSupportSettings,
  type InstitutionSubscriptionDetail,
  type SupportSettings,
} from '@/lib/institutionAdminApi';

interface Props {
  institutionId: string;
  institutionName: string;
}

const STATUS_TONE: Record<string, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:    { label: 'نشط',           tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  pending:   { label: 'قيد التفعيل',    tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Clock },
  expired:   { label: 'منتهي',          tone: 'bg-rose-50 text-rose-700 border-rose-200',         icon: AlertCircle },
  cancelled: { label: 'ملغي',           tone: 'bg-slate-100 text-slate-600 border-slate-200',     icon: AlertCircle },
  trial:     { label: 'تجريبي',         tone: 'bg-sky-50 text-sky-700 border-sky-200',           icon: Clock },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function InstitutionSubscriptionView({ institutionId, institutionName }: Props) {
  const [sub, setSub] = useState<InstitutionSubscriptionDetail | null>(null);
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, sup] = await Promise.all([
          getInstitutionSubscriptionDetail(institutionId),
          getSupportSettings(),
        ]);
        if (cancelled) return;
        setSub(s);
        setSupport(sup);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        جاري تحميل تفاصيل الاشتراك...
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-900">لا يوجد اشتراك مرتبط</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            مؤسستك «{institutionName}» ليست مرتبطة حالياً بأي باقة اشتراك. يرجى التواصل مع مالك المنصة لتفعيل اشتراك.
          </p>
          <ContactSupportInline support={support} />
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_TONE[sub.status] ?? { label: sub.status, tone: 'bg-slate-100 text-slate-700 border-slate-200', icon: AlertCircle };
  const StatusIcon = statusMeta.icon;
  const remainingDays = daysUntil(sub.end_date ?? sub.current_period_end);

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-600 text-white p-6 shadow-xl">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase opacity-80">الباقة الحالية</p>
            <h1 className="text-3xl font-black mt-1">{sub.plan_name || sub.plan_type}</h1>
            <p className="text-sm opacity-90 mt-1">{institutionName}</p>
          </div>
          <Badge className={`${statusMeta.tone} text-[11px] font-bold gap-1 border`}>
            <StatusIcon className="h-3 w-3" />
            {statusMeta.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <HeroStat label="نوع الفوترة" value={sub.billing_cycle ? translateCycle(sub.billing_cycle) : '—'} />
          <HeroStat label="السعر" value={sub.price != null ? `${sub.price.toLocaleString('ar-DZ')} ${sub.currency || 'DZD'}` : '—'} />
          <HeroStat label="ينتهي في" value={formatDate(sub.end_date ?? sub.current_period_end)} />
          <HeroStat label="متبقّي" value={remainingDays != null ? `${remainingDays} يوم` : '—'} />
        </div>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <LimitCard
          label="حد الطلاب"
          value={sub.student_limit}
          icon={GraduationCap}
          hint="الحد الأقصى للمسجلين"
        />
        <LimitCard
          label="حد الجلسات"
          value={sub.session_limit}
          icon={Layers}
          hint="جلسات حضور لكل دورة"
        />
        <LimitCard
          label="عدد المستخدمين"
          value={sub.max_users}
          icon={Users}
          hint="أساتذة وإداريون"
        />
      </div>

      {/* Period */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-indigo-600" />
          تفاصيل الفترة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DetailRow label="تاريخ البداية" value={formatDate(sub.start_date)} />
          <DetailRow label="تاريخ النهاية" value={formatDate(sub.end_date)} />
          <DetailRow label="حالة الدفع" value={translatePayment(sub.payment_status)} />
        </div>
      </div>

      {/* Notes */}
      {sub.notes && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-black text-slate-900 mb-2">ملاحظات</h3>
          <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{sub.notes}</p>
        </div>
      )}

      {/* Read-only notice */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="text-sm font-black text-amber-900">عرض للقراءة فقط</h4>
            <p className="text-[12px] text-amber-800 leading-relaxed">
              تعديل الاشتراكات يتم من قبل مالك المنصة فقط للحفاظ على دقة الفوترة. لترقية الباقة، أو تجديد الاشتراك،
              أو طلب تعديل الحدود — يرجى التواصل مع فريق Ausar Military.
            </p>
            <ContactSupportInline support={support} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl px-3 py-2.5 border border-white/20">
      <p className="text-[10px] uppercase opacity-80 font-bold">{label}</p>
      <p className="text-sm font-black mt-0.5">{value}</p>
    </div>
  );
}

function LimitCard({ label, value, icon: Icon, hint }: { label: string; value: number | null; icon: React.ComponentType<{ className?: string }>; hint: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] text-slate-500 font-bold uppercase">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value != null ? value.toLocaleString('ar-DZ') : '—'}</p>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2.5">
      <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
      <p className="text-[13px] font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}

function ContactSupportInline({ support }: { support: SupportSettings | null }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {support?.support_email && (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[11px] border-amber-300 hover:bg-amber-100">
          <a href={`mailto:${support.support_email}?subject=Ausar Military%20Subscription%20Inquiry`}>
            <Mail className="h-3 w-3" />
            {support.support_email}
          </a>
        </Button>
      )}
      {support?.support_phone && (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[11px] border-amber-300 hover:bg-amber-100">
          <a href={`tel:${support.support_phone}`}>{support.support_phone}</a>
        </Button>
      )}
    </div>
  );
}

function translateCycle(cycle: string): string {
  switch (cycle) {
    case 'monthly': return 'شهري';
    case 'quarterly': return 'كل 3 أشهر';
    case 'yearly': return 'سنوي';
    case 'one_time': return 'دفعة واحدة';
    default: return cycle;
  }
}

function translatePayment(status: string | null): string {
  switch (status) {
    case 'paid': return 'مدفوع';
    case 'pending': return 'قيد الدفع';
    case 'overdue': return 'متأخر';
    case 'free': return 'مجاني';
    case null:
    case undefined: return '—';
    default: return status as string;
  }
}
