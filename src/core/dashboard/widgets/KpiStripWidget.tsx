import type { LucideIcon } from 'lucide-react';
import { Users, UserPlus, Layers, CalendarCheck, TrendingUp, Activity } from 'lucide-react';
import type { InstitutionOverview } from '@/lib/institutionAdminApi';
// التسميات تعتمد على قاموس نوع المؤسسة (جامعة/مدرسة/مركز تكوين...).
// إذا لم يكن المفتاح موجوداً في القاموس نعرض تسمية احتياطية بدلاً من "undefined".

interface KpiStripWidgetProps {
  overview: InstitutionOverview | null;
  labels: Record<string, string | undefined>;
  todayRate: number;
}

function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('ar-DZ');
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'غير متوفر';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString('ar-DZ');
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-4 shadow-lg ring-1 ring-white/10`}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between mb-1.5">
          <Icon className="h-3.5 w-3.5 text-white/80" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">LIVE</span>
        </div>
        <p className="text-[10px] font-medium text-white/80">{label}</p>
        <p className="mt-1 text-xl font-black text-white truncate">{value}</p>
        <p className="mt-0.5 text-[10px] font-semibold text-white/70 truncate">{helper}</p>
      </div>
    </div>
  );
}

export default function KpiStripWidget({ overview, labels, todayRate }: KpiStripWidgetProps) {
  return (
    <section className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        label={`إجمالي ${labels.students ?? 'المستخدمين'}`}
        value={formatNumber(overview?.studentsCount)}
        helper="مسجلون"
        icon={Users}
        tone="from-violet-500 to-violet-700"
      />
      <KpiCard
        label={`إجمالي ${labels.teachers ?? labels.staff ?? 'الموظفين'}`}
        value={formatNumber(overview?.teachersCount)}
        helper="نشطون"
        icon={UserPlus}
        tone="from-emerald-500 to-emerald-700"
      />
      <KpiCard
        label={`${labels.faculty ?? 'الكلية'} / ${labels.dept ?? labels.department ?? 'القسم'}`}
        value={`${formatNumber(overview?.faculties)} / ${formatNumber(overview?.departments)}`}
        helper={`${formatNumber(overview?.specialties)} ${labels.spec ?? labels.specialty ?? 'مسار'}`}
        icon={Layers}
        tone="from-sky-500 to-blue-700"
      />
      <KpiCard
        label="عدد الحصص اليوم"
        value={formatNumber(overview?.sessionsToday)}
        helper={`${formatNumber(overview?.activeSessions)} نشطة الآن`}
        icon={CalendarCheck}
        tone="from-orange-500 to-orange-700"
      />
      <KpiCard
        label="نسبة الحضور اليوم"
        value={`${todayRate}%`}
        helper={`${formatNumber(overview?.attendancesToday)} تسجيل اليوم`}
        icon={TrendingUp}
        tone="from-teal-500 to-teal-700"
      />
      <KpiCard
        label="آخر نشاط"
        value={formatRelativeTime(overview?.lastActivityAt)}
        helper="على مستوى المؤسسة"
        icon={Activity}
        tone="from-indigo-500 to-indigo-700"
      />
    </section>
  );
}
export { Panel, MiniMetric } from './MetricPanelWidget';
export { formatNumber, formatRelativeTime };
