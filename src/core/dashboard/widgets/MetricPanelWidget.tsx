import type { LucideIcon } from 'lucide-react';
import { Users, Layers, ShieldCheck, Smartphone } from 'lucide-react';
import type { InstitutionOverview } from '@/lib/institutionAdminApi';

export function Panel({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-3xl border border-slate-100 shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      {children}
    </div>
  );
}

export function MiniMetric({
  label,
  value,
  icon: Icon,
  badge,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  badge?: 'attention';
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        <span className="text-xs text-slate-600">{label}</span>
      </div>
      <span
        className={`text-sm font-black ${
          badge === 'attention' ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// تسميات احتياطية إذا لم يكن المفتاح موجوداً في قاموس نوع المؤسسة (لمنع ظهور "undefined")
interface MetricPanelWidgetProps {
  overview: InstitutionOverview | null;
  labels: Record<string, string | undefined>;
}

export default function MetricPanelWidget({ overview, labels }: MetricPanelWidgetProps) {
  const formatNumber = (n: number | null | undefined) => (n ?? 0).toLocaleString('ar-DZ');

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Panel title="المستخدمون" icon={Users}>
        <MiniMetric label={labels.teachers ?? labels.staff ?? 'الموظفين'} value={formatNumber(overview?.teachersCount)} />
        <MiniMetric label={labels.students ?? 'المستخدمين'} value={formatNumber(overview?.studentsCount)} />
        <MiniMetric label="مدراء" value="—" />
      </Panel>

      <Panel title="الهيكل الأكاديمي" icon={Layers}>
        <MiniMetric label={labels.faculty ?? 'الكلية'} value={formatNumber(overview?.faculties)} />
        <MiniMetric label={labels.dept ?? labels.department ?? 'القسم'} value={formatNumber(overview?.departments)} />
        <MiniMetric label={labels.spec ?? labels.specialty ?? 'المسار'} value={formatNumber(overview?.specialties)} />
        <MiniMetric label={labels.groups ?? 'الدفعات'} value={formatNumber(overview?.groups)} />
      </Panel>

      <Panel title="الأجهزة والأمان" icon={ShieldCheck}>
        <MiniMetric label="الأجهزة المرتبطة" value={formatNumber(overview?.devices)} icon={Smartphone} />
        <MiniMetric label="نشطة" value={formatNumber(overview?.activeDevices)} icon={ShieldCheck} />
        <MiniMetric
          label="تبريرات قيد المراجعة"
          value={formatNumber(overview?.pendingJustifications)}
          icon={ShieldCheck}
          badge={overview && overview.pendingJustifications > 0 ? 'attention' : undefined}
        />
      </Panel>
    </section>
  );
}
