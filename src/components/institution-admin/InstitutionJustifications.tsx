// =============================================================================
// Phase 8 — Absence Justifications page
// =============================================================================
// Pending → Approved / Rejected workflow for institution managers. Read access
// is hierarchical (RLS at DB level via student.cohort.unit_id). Writes still
// go through can_manage_institution (P10 will tighten further).
//
// Documented limits (no fake logic invented):
//   - There is no `attendances.status` column. Approving a justification only
//     marks the justification itself; it does NOT toggle absence to "excused".
//   - notifications.insert is super_admin-only by RLS, so we cannot create a
//     notification for the teacher/student from this UI. We surface a toast
//     hint asking the manager to inform the teacher manually.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  FileCheck2,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  Calendar,
  User as UserIcon,
  GraduationCap,
  Building2,
  ChevronLeft,
  Hourglass,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionJustifications,
  buildJustificationStats,
  reviewJustification,
  updateJustificationNote,
  getInstitutionUnits,
  type JustificationRow,
  type JustificationStats,
  type JustificationStatus,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';
import type { PermissionMap } from '@/lib/permissions';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
  permissions?: PermissionMap | null;
}

const PAGE_SIZE = 25;

const STATUS_META: Record<JustificationStatus, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:  { label: 'قيد المراجعة', tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Clock },
  approved: { label: 'مقبول',         tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'مرفوض',         tone: 'bg-rose-50 text-rose-700 border-rose-200',         icon: XCircle },
};

export default function InstitutionJustifications({ institutionId, institutionName, institutionType }: Props) {
  const labels = getSectorLabels(institutionType);
  const [rows, setRows] = useState<JustificationRow[]>([]);
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JustificationStatus>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  // Detail / action dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<JustificationRow | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'note' | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [list, u] = await Promise.all([
        getInstitutionJustifications(institutionId),
        getInstitutionUnits(institutionId),
      ]);
      setRows(list);
      setUnits(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const stats: JustificationStats = useMemo(() => buildJustificationStats(rows), [rows]);

  // Compute filtered + paginated rows
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (unitFilter !== 'all') {
        if (unitFilter === 'unscoped' && r.unit_id !== null) return false;
        if (unitFilter !== 'unscoped' && r.unit_id !== unitFilter) return false;
      }
      if (fromTs && new Date(r.created_at).getTime() < fromTs) return false;
      if (toTs && new Date(r.created_at).getTime() > toTs) return false;
      if (!q) return true;
      const hay = [
        r.student_full_name ?? '',
        r.student_number ?? '',
        r.cohort_name ?? '',
        r.professor_name ?? '',
        r.session_title ?? '',
        r.session_code ?? '',
        r.reason,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, unitFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, unitFilter, dateFrom, dateTo]);

  const openDetail = (j: JustificationRow) => {
    setDetailTarget(j);
    setAdminNoteDraft(j.admin_note ?? '');
    setDetailOpen(true);
  };

  const handleApprove = async () => {
    if (!detailTarget) return;
    setBusy('approve');
    try {
      const ok = await reviewJustification({
        justificationId: detailTarget.id,
        status: 'approved',
        adminNote: adminNoteDraft || null,
      });
      if (!ok) {
        toast.error('تعذر قبول التبرير');
        return;
      }
      toast.success('تم قبول التبرير');
      // Manager-side hint: notifications cannot be created from frontend (RLS),
      // so we ask the manager to inform the teacher manually for now.
      toast.info('💡 لم يُرسَل إشعار آلي للأستاذ — أبلغه يدوياً (سنُؤتمت ذلك في مرحلة لاحقة)', {
        duration: 5000,
      });
      setDetailOpen(false);
      setDetailTarget(null);
      await loadAll();
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (!detailTarget) return;
    if (!adminNoteDraft.trim()) {
      toast.error('يرجى كتابة سبب الرفض في خانة الملاحظة');
      return;
    }
    setBusy('reject');
    try {
      const ok = await reviewJustification({
        justificationId: detailTarget.id,
        status: 'rejected',
        adminNote: adminNoteDraft,
      });
      if (!ok) {
        toast.error('تعذر رفض التبرير');
        return;
      }
      toast.success('تم رفض التبرير');
      toast.info(`💡 لم يُرسَل إشعار آلي — أبلغ ${labels.learner} يدوياً`, { duration: 5000 });
      setDetailOpen(false);
      setDetailTarget(null);
      await loadAll();
    } finally {
      setBusy(null);
    }
  };

  const handleSaveNote = async () => {
    if (!detailTarget) return;
    setBusy('note');
    try {
      const ok = await updateJustificationNote(detailTarget.id, adminNoteDraft || null);
      if (!ok) {
        toast.error('تعذر حفظ الملاحظة');
        return;
      }
      toast.success('تم حفظ الملاحظة');
      await loadAll();
      // refresh local target to reflect new note
      const fresh = (await getInstitutionJustifications(institutionId)).find((r) => r.id === detailTarget.id);
      if (fresh) setDetailTarget(fresh);
    } finally {
      setBusy(null);
    }
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('ar-DZ', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('ar-DZ');
  };

  return (
    <div className="space-y-5">
      {/* Header + KPIs */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-amber-600" />
              التبريرات
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              مراجعة طلبات تبرير الغيابات داخل {institutionName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {[
            { label: 'الإجمالي',          value: stats.total,             icon: FileCheck2,  tone: 'bg-slate-50 text-slate-700' },
            { label: 'قيد المراجعة',     value: stats.pending,           icon: Clock,        tone: 'bg-amber-50 text-amber-700' },
            { label: 'مقبولة هذا الشهر', value: stats.approvedThisMonth, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'مرفوضة هذا الشهر', value: stats.rejectedThisMonth, icon: XCircle,      tone: 'bg-rose-50 text-rose-700' },
            {
              label: 'متوسط المعالجة',
              value: stats.avgProcessingHours !== null ? `${stats.avgProcessingHours} س` : 'غير متوفر حالياً',
              icon: Hourglass,
              tone: 'bg-indigo-50 text-indigo-700',
            },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="border border-slate-100 rounded-xl p-3">
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${k.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xl font-black text-slate-900 mt-2">{k.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
              </div>
            );
          })}
        </div>

        {/* Soft empty hint when there are zero justifications */}
        {!loading && stats.total === 0 && (
          <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1 text-xs text-slate-600 leading-relaxed">
              لا توجد طلبات تبرير بعد. سيظهر هنا كل طلب يقدّمه {labels.learners} للأستاذ أو الإدارة، 
              ويمكنك مراجعته وقبوله أو رفضه مع إضافة ملاحظة إدارية.
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div className="md:col-span-2 relative">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث: اسم، فوج، أستاذ، سبب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-10 rounded-lg"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | JustificationStatus)}>
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="approved">مقبولة</SelectItem>
              <SelectItem value="rejected">مرفوضة</SelectItem>
            </SelectContent>
          </Select>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700"
          >
            <option value="all">كل الوحدات الأكاديمية</option>
            <option value="unscoped">بدون وحدة</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 rounded-lg text-xs"
              placeholder="من"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 rounded-lg text-xs"
              placeholder="إلى"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {filtered.length} من {rows.length} طلب
          </span>
          {(search || statusFilter !== 'all' || unitFilter !== 'all' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setUnitFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="text-right">{labels.learner}</TableHead>
              <TableHead className="text-right">المسار / {labels.group}</TableHead>
              <TableHead className="text-right">الحصة</TableHead>
              <TableHead className="text-right">الأستاذ</TableHead>
              <TableHead className="text-right">السبب</TableHead>
              <TableHead className="text-right">قُدِّم في</TableHead>
              <TableHead className="text-center">الحالة</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            )}
            {!loading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                  {rows.length === 0 ? 'لا توجد تبريرات بعد' : 'لا نتائج مطابقة للفلاتر'}
                </TableCell>
              </TableRow>
            )}
            {!loading && paginated.map((j) => {
              const meta = STATUS_META[j.status];
              const Icon = meta.icon;
              return (
                <TableRow key={j.id} className="hover:bg-slate-50/60">
                  <TableCell>
                    <div className="font-bold text-slate-900 text-sm">
                      {j.student_full_name || '—'}
                    </div>
                    {j.student_number && (
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {j.student_number}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-700">
                    {j.unit_path && j.unit_path.length > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {j.unit_path.map((seg, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            {idx > 0 && <ChevronLeft className="h-3 w-3 text-slate-300" />}
                            <span className={idx === j.unit_path!.length - 1 ? 'font-bold text-indigo-700' : ''}>
                              {seg}
                            </span>
                          </span>
                        ))}
                        {j.cohort_name && <span className="text-slate-500"> / {j.cohort_name}</span>}
                      </div>
                    ) : (
                      <span className="text-slate-500">{j.cohort_name ?? '—'}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {j.session_title ? (
                      <div>
                        <div className="font-bold text-slate-800 truncate max-w-[12rem]">{j.session_title}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{j.session_code} • {formatDate(j.session_created_at)}</div>
                      </div>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">{j.professor_name || '—'}</TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[14rem] truncate" title={j.reason}>
                    {j.reason}
                  </TableCell>
                  <TableCell className="text-[11px] text-slate-500 font-mono">{formatDateTime(j.created_at)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={`${meta.tone} font-bold gap-1`}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-indigo-700 hover:bg-indigo-50 gap-1"
                        onClick={() => openDetail(j)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold">عرض</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              صفحة {safePage + 1} من {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8"
              >
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="h-8"
              >
                التالي
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-amber-600" />
              تفاصيل طلب التبرير
            </DialogTitle>
            <DialogDescription>
              راجع البيانات وقرّر القبول أو الرفض. عند الرفض يُنصح بكتابة سبب واضح.
            </DialogDescription>
          </DialogHeader>

          {detailTarget && (
            <div className="space-y-4">
              {/* Student + status */}
              <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 border border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold mb-0.5 flex items-center gap-1">
                    <UserIcon className="h-3 w-3" /> {labels.learner}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{detailTarget.student_full_name || '—'}</p>
                  {detailTarget.student_number && (
                    <p className="text-[10px] text-slate-500 font-mono">{detailTarget.student_number}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold mb-0.5">الحالة الحالية</p>
                  {(() => {
                    const meta = STATUS_META[detailTarget.status];
                    const Icon = meta.icon;
                    return (
                      <Badge variant="outline" className={`${meta.tone} font-bold gap-1`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold mb-0.5 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> {labels.group}
                  </p>
                  <p className="text-xs text-slate-700">{detailTarget.cohort_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold mb-0.5 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> المسار الأكاديمي
                  </p>
                  {detailTarget.unit_path && detailTarget.unit_path.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      {detailTarget.unit_path.map((seg, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          {idx > 0 && <ChevronLeft className="h-3 w-3 text-slate-300" />}
                          <span className={idx === detailTarget.unit_path!.length - 1 ? 'font-bold text-indigo-700' : 'text-slate-600'}>
                            {seg}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">—</p>
                  )}
                </div>
              </div>

              {/* Session */}
              {detailTarget.session_title && (
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-xs">
                  <p className="text-[10px] text-slate-500 font-bold mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> الحصة المعنية
                  </p>
                  <p className="font-bold text-slate-800">{detailTarget.session_title}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {detailTarget.session_code} • {formatDateTime(detailTarget.session_created_at)} • الأستاذ: {detailTarget.professor_name ?? '—'}
                  </p>
                </div>
              )}

              {/* Reason */}
              <div>
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" /> سبب الغياب (نص {labels.learner})
                </Label>
                <div className="mt-1 bg-white border border-slate-200 rounded-xl p-3 text-sm text-slate-800 whitespace-pre-wrap">
                  {detailTarget.reason}
                </div>
                {detailTarget.attachment_url && (
                  <a
                    href={detailTarget.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-700 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    فتح المرفق
                  </a>
                )}
              </div>

              {/* Admin note */}
              <div>
                <Label className="text-xs">ملاحظة إدارية {detailTarget.status === 'rejected' && <span className="text-rose-600">*</span>}</Label>
                <Textarea
                  rows={3}
                  value={adminNoteDraft}
                  onChange={(e) => setAdminNoteDraft(e.target.value)}
                  placeholder="ملاحظة تظهر في السجل (مثلاً: شهادة طبية معتمدة / السبب غير مقنع...)"
                  className="text-sm"
                />
                {detailTarget.status !== 'pending' && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    تمت المراجعة بواسطة {detailTarget.reviewer_name ?? '—'} في {formatDateTime(detailTarget.reviewed_at)}
                  </p>
                )}
              </div>

              {/* Note about attendance status limitation */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 leading-relaxed flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span>
                  ملاحظة: قبول التبرير يسجّل الموافقة في هذا السجل فقط. لا يوجد حالياً عمود
                  <code className="bg-amber-100 px-1 rounded mx-1">attendances.status</code>
                  لتحويل الغياب تلقائياً إلى "بعذر". هذا التحويل يحتاج ترقية مستقبلية.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setDetailOpen(false)}
              disabled={busy !== null}
            >
              إغلاق
            </Button>
            {detailTarget && detailTarget.status !== 'pending' && (
              <Button
                variant="outline"
                onClick={handleSaveNote}
                disabled={busy !== null}
                className="gap-1"
              >
                {busy === 'note' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                حفظ الملاحظة فقط
              </Button>
            )}
            {detailTarget && detailTarget.status !== 'rejected' && (
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={busy !== null}
                className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                {busy === 'reject' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                رفض
              </Button>
            )}
            {detailTarget && detailTarget.status !== 'approved' && (
              <Button
                onClick={handleApprove}
                disabled={busy !== null}
                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {busy === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                قبول
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
