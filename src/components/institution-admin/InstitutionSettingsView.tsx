// =============================================================================
// Phase 11 — Institution Settings (read-only inside Institution Admin)
// =============================================================================
// Display the institution's basic identity fields. Updating these is a
// super_admin-only operation by RLS, so this view is informational only.
// We DO NOT invent missing columns (no fake email/phone fields).
// =============================================================================

import { useEffect, useState } from 'react';
import {
  Settings,
  Building2,
  MapPin,
  Hash,
  Tag,
  Languages,
  AlertCircle,
  Mail,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { getSupportSettings, type SupportSettings } from '@/lib/institutionAdminApi';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
}

interface InstitutionRow {
  id: string;
  name: string;
  type: string;
  status: string | null;
  wilaya: string | null;
  city: string | null;
  code: string | null;
  image_url: string | null;
  max_students: number | null;
  settings_allowed_modes?: string[] | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  university: 'جامعة',
  school:     'مدرسة',
  training:   'مركز تكوين',
  company:    'شركة',
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  active:    { label: 'نشطة',   tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:   { label: 'معلّقة', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  suspended: { label: 'موقوفة', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

import { toast } from 'sonner';

export default function InstitutionSettingsView({ institutionId, institutionType }: Props) {
  const labels = getSectorLabels(institutionType);
  const [data, setData] = useState<InstitutionRow | null>(null);
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowedModes, setAllowedModes] = useState<string[]>(['qr', 'roll_call', 'hybrid']);
  const [updatingModes, setUpdatingModes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: row }, sup] = await Promise.all([
        supabase
          .from('institutions')
          .select('id, name, type, status, wilaya, city, code, image_url, max_students, settings_allowed_modes, created_at')
          .eq('id', institutionId)
          .maybeSingle(),
        getSupportSettings(),
      ]);
      if (cancelled) return;
      if (row) {
        setData(row as InstitutionRow);
        setAllowedModes((row as InstitutionRow).settings_allowed_modes ?? ['qr', 'roll_call', 'hybrid']);
      }
      setSupport(sup);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  const handleToggleMode = async (mode: string) => {
    if (updatingModes) return;
    const nextModes = allowedModes.includes(mode)
      ? allowedModes.filter((m) => m !== mode)
      : [...allowedModes, mode];

    if (nextModes.length === 0) {
      toast.error('يجب تفعيل نمط حضور واحد على الأقل');
      return;
    }

    setAllowedModes(nextModes);
    setUpdatingModes(true);

    const { error } = await supabase
      .from('institutions')
      .update({ settings_allowed_modes: nextModes })
      .eq('id', institutionId);

    setUpdatingModes(false);

    if (error) {
      toast.error(`فشل تحديث الأنماط المسموحة: ${error.message}`);
    } else {
      toast.success('تم تحديث أنماط التحضير المسموحة بنجاح');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        جاري تحميل الإعدادات...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
        <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-black text-slate-900">تعذر تحميل بيانات المؤسسة</h3>
      </div>
    );
  }

  const typeLabel = TYPE_LABEL[data.type] ?? data.type;
  const statusMeta = data.status ? STATUS_LABEL[data.status] : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-600" />
              إعدادات المؤسسة
            </h2>
            <p className="text-xs text-slate-500 mt-1">معلومات الهوية الأساسية وإعدادات العرض</p>
          </div>
          {statusMeta && (
            <Badge className={`text-[11px] font-bold border ${statusMeta.tone}`}>{statusMeta.label}</Badge>
          )}
        </div>
      </div>

      {/* Identity card */}
      <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center gap-4">
          {data.image_url ? (
            <img src={data.image_url} alt={data.name} className="h-20 w-20 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-indigo-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-2xl font-black text-slate-900">{data.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{typeLabel}</p>
            <p className="text-[11px] text-slate-400 font-mono mt-1">ID: {data.id}</p>
          </div>
        </div>
      </div>

      {/* Basic info grid */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-black text-slate-900 mb-4">معلومات أساسية</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="اسم المؤسسة" icon={Building2} value={data.name} />
          <Field label="نوع المؤسسة" icon={Tag} value={typeLabel} />
          <Field label="الولاية" icon={MapPin} value={data.wilaya ?? '—'} />
          <Field label="المدينة" icon={MapPin} value={data.city ?? '—'} />
          <Field label="الرمز / الكود" icon={Hash} value={data.code ?? '—'} />
          <Field label="الحد الأقصى للمسجلين" icon={ShieldCheck} value={data.max_students != null ? data.max_students.toLocaleString('ar-DZ') : '—'} />
        </div>
      </div>
      {/* Allowed Attendance Modes */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-black text-slate-900 mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          أنماط التحضير المتاحة للأساتذة
        </h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          قم بتحديد الأنماط التي يمكن للأساتذة والمكونين اختيارها لتسجيل الحضور.
        </p>

        {data.type === 'military' ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-right">
            <p className="text-sm text-slate-600 font-bold leading-relaxed">
              ℹ️ بالنسبة للجامعات، يتم التحكم في صلاحيات التحضير بشكل مرن على مستوى **الأقسام والكليات** من قبل العميد أو رئيس القسم في تبويب الهيكل الأكاديمي.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* QR Code */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">QR Code فقط</span>
                <span className="text-[10px] text-slate-400">يسجل الطلاب الحضور عبر هواتفهم</span>
              </div>
              <input
                type="checkbox"
                checked={allowedModes.includes('qr')}
                disabled={updatingModes}
                onChange={() => void handleToggleMode('qr')}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Smart Roll Call */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">مناداة ذكية فقط</span>
                <span className="text-[10px] text-slate-400">يقوم الأستاذ بالمناداة يدوياً من الشاشة</span>
              </div>
              <input
                type="checkbox"
                checked={allowedModes.includes('roll_call')}
                disabled={updatingModes}
                onChange={() => void handleToggleMode('roll_call')}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </div>

            {/* Hybrid */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">مناداة هجينة (QR + مناداة)</span>
                <span className="text-[10px] text-slate-400">تحضير QR أولاً ثم مناداة للمتبقين</span>
              </div>
              <input
                type="checkbox"
                checked={allowedModes.includes('hybrid')}
                disabled={updatingModes}
                onChange={() => void handleToggleMode('hybrid')}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Display settings */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-black text-slate-900 mb-4 flex items-center gap-2">
          <Languages className="h-4 w-4 text-indigo-600" />
          إعدادات العرض
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="اللغة الافتراضية" icon={Languages} value="العربية (RTL)" />
          <Field label={`تسمية ${labels.learners}`} icon={Tag} value={labels.learners} />
          <Field label={`تسمية ${labels.educators}`} icon={Tag} value={labels.educators} />
          <Field label={`تسمية ${labels.groups}`} icon={Tag} value={labels.groups} />
          <Field label="عنوان الهيكل" icon={Tag} value={labels.structureTitle} />
        </div>
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          هذه التسميات تتغيّر تلقائياً حسب نوع المؤسسة في كل لوحة تحكم Ausar Military.
        </p>
      </div>

      {/* Read-only notice */}
      <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="text-sm font-black text-amber-900">عرض للقراءة فقط</h4>
            <p className="text-[12px] text-amber-800 leading-relaxed">
              تعديل بيانات المؤسسة الأساسية (الاسم، النوع، العنوان، الكود) يتم من قبل مالك المنصة فقط لضمان سلامة البيانات
              عبر جميع المؤسسات. لطلب أي تعديل، يرجى التواصل مع فريق Ausar Military.
            </p>
            {support?.support_email && (
              <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-[11px] border-amber-300 hover:bg-amber-100">
                <a href={`mailto:${support.support_email}?subject=${encodeURIComponent(`طلب تعديل بيانات ${data.name}`)}`}>
                  <Mail className="h-3 w-3" />
                  مراسلة الدعم
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-slate-400" />
        <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
      </div>
      <p className="text-[13px] font-bold text-slate-900">{value}</p>
    </div>
  );
}
