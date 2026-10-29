// =============================================================================
// Phase 11 — Support & Help center
// =============================================================================
// Read-only contact card from support_settings + ticket creation against
// support_tickets (institution managers can INSERT in their own institution
// per RLS). FAQ + steps section is local content, not fake data.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  HelpCircle,
  Mail,
  Phone,
  MessageCircle,
  Globe,
  PlusCircle,
  Loader2,
  TicketCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  getInstitutionTickets,
  createInstitutionTicket,
  getSupportSettings,
  type InstitutionTicketRow,
  type SupportSettings,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
  permissions?: PermissionMap | null;
}

const STATUS_META: Record<string, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  open:                { label: 'مفتوحة',         tone: 'bg-sky-50 text-sky-700 border-sky-200',         icon: Clock },
  in_progress:         { label: 'قيد المعالجة',   tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Loader2 },
  waiting_institution: { label: 'بانتظاركم',       tone: 'bg-violet-50 text-violet-700 border-violet-200',  icon: AlertCircle },
  resolved:            { label: 'تم الحل',         tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  closed:              { label: 'مغلقة',          tone: 'bg-slate-100 text-slate-600 border-slate-200',     icon: CheckCircle2 },
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'عالية', medium: 'متوسطة', low: 'منخفضة',
};

const CATEGORY_OPTIONS: { value: 'technical' | 'activation' | 'attendance' | 'device' | 'billing' | 'training' | 'general'; label: string }[] = [
  { value: 'technical',  label: 'مشكلة تقنية' },
  { value: 'activation', label: 'تفعيل / حساب' },
  { value: 'attendance', label: 'تسجيل الحضور' },
  { value: 'device',     label: 'مشكلة جهاز' },
  { value: 'billing',    label: 'الاشتراك والفوترة' },
  { value: 'training',   label: 'تدريب فريقنا' },
  { value: 'general',    label: 'استفسار عام' },
];

export default function InstitutionSupportView({ institutionId, institutionName, institutionType, permissions }: Props) {
  const labels = getSectorLabels(institutionType);
  const canCreateTicket = can(permissions, PERMISSIONS.supportCreateTicket) || can(permissions, PERMISSIONS.supportManage);
  const [tickets, setTickets] = useState<InstitutionTicketRow[]>([]);
  const [support, setSupport] = useState<SupportSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [draft, setDraft] = useState({
    category: 'general' as 'technical' | 'activation' | 'attendance' | 'device' | 'billing' | 'training' | 'general',
    priority: 'medium' as 'high' | 'medium' | 'low',
    title: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [t, sup] = await Promise.all([
        getInstitutionTickets(institutionId),
        getSupportSettings(),
      ]);
      setTickets(t);
      setSupport(sup);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => ['open', 'in_progress', 'waiting_institution'].includes(t.status)).length;
    const resolved = tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length;
    return { open, resolved, total: tickets.length };
  }, [tickets]);

  const submit = async () => {
    if (!canCreateTicket) {
      toast.error('ليست لديك صلاحية إنشاء تذكرة دعم');
      return;
    }
    if (!draft.title.trim() || !draft.description.trim()) {
      toast.error('يرجى تعبئة العنوان والوصف');
      return;
    }
    setSubmitting(true);
    try {
      const res = await createInstitutionTicket({ ...draft, institutionId });
      if (res.ok) {
        toast.success(`تم إنشاء التذكرة ${res.ticketNumber}. سيتواصل معكم فريق Ausar Military قريباً.`);
        setOpenCreate(false);
        setDraft({ category: 'general', priority: 'medium', title: '', description: '' });
        await loadAll();
      } else {
        toast.error(res.error || 'تعذر إنشاء التذكرة');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      q: `كيف يسجّل ${labels.learner} حضوره؟`,
      a: `يقوم ${labels.educator} بفتح جلسة من تطبيق الويب، ثم يعرض رمز QR أو رمزاً رقمياً مؤقتاً. يفتح ${labels.learner} تطبيق Ausar Military للأندرويد، يقوم بمسح الرمز، ويُسجَّل حضوره خلال ثوانٍ مع ربط جهازه تلقائياً لمنع الغش.`,
    },
    {
      q: 'هل يمكن تسجيل الحضور من جهازين مختلفين؟',
      a: `لا. يربط النظام ${labels.learner} بأول جهاز يستعمله (بصمة الجهاز device fingerprint). إذا غيّر الهاتف، يمكن للمدير إلغاء ربط الجهاز من تبويب «الأجهزة والأمان» ليرتبط الطالب تلقائياً بالجهاز الجديد عند أول حضور.`,
    },
    {
      q: 'كيف أضيف مستخدمين جدداً؟',
      a: 'من تبويب «المستخدمون» يمكنك إنشاء حسابات: مدير كلية، مدير قسم، أستاذ، أو مشاهد للقراءة فقط. النظام يولّد رابط الدخول والكلمة السرية تلقائياً ويمكنك مشاركتها معهم.',
    },
    {
      q: `كيف أنظّم ${labels.groups} والهيكل الأكاديمي؟`,
      a: `من «الهيكل» تنشئ شجرة من الكليات/الأقسام/التخصصات حسب نوع المؤسسة. ثم في «${labels.groups}» تُنشئ مجموعات مرتبطة بالنطاق المناسب. الأستاذ المربوط بمجموعة سيرى فقط ${labels.learners} هذه المجموعة.`,
    },
    {
      q: 'هل يمكن تصدير التقارير؟',
      a: 'نعم، من تبويب «التقارير» يمكنك تصدير: تقرير الحضور، الغيابات، التبريرات، الأساتذة، والأفواج. التصدير متوفر بصيغة PDF و Excel مع تنسيق RTL عربي.',
    },
    {
      q: 'كيف أنشئ تذكرة دعم؟',
      a: 'من نفس هذه الصفحة (تبويب الدعم)، اضغط على زر «إنشاء تذكرة جديدة»، حدد نوع المشكلة وأولويتها، اكتب وصفاً مختصراً، وسيتواصل معكم فريق Ausar Military خلال 24 ساعة عمل.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-600" />
              الدعم والمساعدة
            </h2>
            <p className="text-xs text-slate-500 mt-1">تواصل مع فريق Ausar Military، أنشئ تذكرة دعم، أو تصفّح الأسئلة الشائعة</p>
          </div>
          {canCreateTicket && (
            <Button onClick={() => setOpenCreate(true)} className="gap-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95">
              <PlusCircle className="h-4 w-4" />
              إنشاء تذكرة دعم
            </Button>
          )}
        </div>
      </div>

      {/* Contact card */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-600 text-white rounded-3xl p-6 shadow-xl">
        <h3 className="text-lg font-black mb-4">قنوات التواصل المباشر</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {support?.support_email && (
            <ContactPill href={`mailto:${support.support_email}`} icon={Mail} label="البريد الإلكتروني" value={support.support_email} />
          )}
          {support?.support_phone && (
            <ContactPill href={`tel:${support.support_phone}`} icon={PhoneCall} label="الهاتف" value={support.support_phone} />
          )}
          {support?.whatsapp_number && (
            <ContactPill href={`https://wa.me/${support.whatsapp_number.replace(/[^0-9]/g, '')}`} icon={MessageCircle} label="واتساب" value={support.whatsapp_number} external />
          )}
          {support?.help_center_url && (
            <ContactPill href={support.help_center_url} icon={Globe} label="الموقع" value="Ausar Military.com" external />
          )}
          {!support && (
            <p className="text-[12px] opacity-90 col-span-full">جاري تحميل معلومات الدعم...</p>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatTile label="تذاكر مفتوحة" value={stats.open} icon={Clock} tone="from-amber-500 to-amber-700" />
        <StatTile label="تذاكر محلولة" value={stats.resolved} icon={CheckCircle2} tone="from-emerald-500 to-emerald-700" />
        <StatTile label="إجمالي التذاكر" value={stats.total} icon={TicketCheck} tone="from-indigo-500 to-indigo-700" />
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-black text-slate-900 mb-4">أسئلة شائعة</h3>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="border border-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-slate-50/60"
              >
                <span className="font-bold text-slate-900 text-[13px]">{f.q}</span>
                {openFaq === i ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-[12px] text-slate-700 leading-relaxed">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tickets list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900">تذاكر الدعم</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">آخر التذاكر المنشأة من «{institutionName}»</p>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <TicketCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">لا توجد تذاكر دعم بعد. أنشئ أول تذكرة عند الحاجة.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tickets.map((t) => {
              const meta = STATUS_META[t.status] ?? STATUS_META.open;
              const Icon = meta.icon;
              return (
                <li key={t.id} className="px-5 py-3 hover:bg-slate-50/60">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                          {t.ticket_number}
                        </code>
                        <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200">
                          {CATEGORY_OPTIONS.find((c) => c.value === t.category)?.label ?? t.category}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${t.priority === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : t.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                          {PRIORITY_LABEL[t.priority] ?? t.priority}
                        </Badge>
                      </div>
                      <p className="font-bold text-slate-900 text-[13px]">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{t.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                        <span>{new Date(t.created_at).toLocaleDateString('ar-DZ', { dateStyle: 'medium' })}</span>
                        {t.created_by_name && <span>• بواسطة {t.created_by_name}</span>}
                      </div>
                    </div>
                    <Badge className={`text-[10px] gap-1 border ${meta.tone}`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء تذكرة دعم</DialogTitle>
            <DialogDescription>صف المشكلة بوضوح ليتمكن فريق Ausar Military من مساعدتك بسرعة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] mb-1 block">نوع المشكلة</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft((d) => ({ ...d, category: v as typeof draft.category }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] mb-1 block">الأولوية</Label>
                <Select value={draft.priority} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as typeof draft.priority }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="low">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[11px] mb-1 block">العنوان</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="مثال: بعض الطلاب لا يستطيعون تسجيل الحضور"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-[11px] mb-1 block">الوصف</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                rows={5}
                placeholder="فصّل المشكلة، الخطوات التي تكررها، ومتى تظهر..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={submitting}>إلغاء</Button>
            <Button onClick={submit} disabled={submitting} className="gap-1">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال التذكرة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactPill({ href, icon: Icon, label, value, external }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; value: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="bg-white/15 hover:bg-white/25 backdrop-blur rounded-xl px-3 py-3 border border-white/20 flex items-center gap-2.5 transition-colors group"
    >
      <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase opacity-80 font-bold">{label}</p>
        <p className="text-[12px] font-bold truncate">{value}</p>
      </div>
      <ChevronLeft className="h-3 w-3 opacity-60 shrink-0" />
    </a>
  );
}

function StatTile({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
        <p className="text-xl font-black text-slate-900">{value.toLocaleString('ar-DZ')}</p>
      </div>
    </div>
  );
}
