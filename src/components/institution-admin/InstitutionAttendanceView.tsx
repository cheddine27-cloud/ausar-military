// =============================================================================
// Phase 11 — Attendance & Absences view
// =============================================================================
// Real list of sessions inside the institution with KPIs, filters and a
// per-session detail dialog (attended vs absent students). All data comes
// from Supabase; institutional RLS already scopes the rows.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  Search,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ChevronLeft,
  TrendingUp,
  Fingerprint,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionAttendanceSessions,
  getSessionAttendanceDetail,
  getInstitutionUnits,
  getInstitutionCohorts,
  getInstitutionUsers,
  type InstitutionAttendanceSession,
  type SessionAttendanceDetail,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
}

const PAGE_SIZE = 25;

export default function InstitutionAttendanceView({ institutionId, institutionType }: Props) {
  const labels = getSectorLabels(institutionType);

  const [sessions, setSessions] = useState<InstitutionAttendanceSession[]>([]);
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<SessionAttendanceDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, u, c, allUsers] = await Promise.all([
          getInstitutionAttendanceSessions(institutionId),
          getInstitutionUnits(institutionId),
          getInstitutionCohorts(institutionId),
          getInstitutionUsers(institutionId),
        ]);
        if (cancelled) return;
        setSessions(list);
        setUnits(u);
        setCohorts(c.map((x) => ({ id: x.id, name: x.name })));
        setTeachers(
          allUsers
            .filter((x) => x.role === 'teacher')
            .map((x) => ({ id: x.id, name: x.full_name || x.username })),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions
      .filter((s) => (term ? `${s.title} ${s.code} ${s.cohort_name ?? ''} ${s.professor_name ?? ''}`.toLowerCase().includes(term) : true))
      .filter((s) => (dateFrom ? new Date(s.created_at) >= new Date(dateFrom) : true))
      .filter((s) => (dateTo ? new Date(s.created_at) <= new Date(`${dateTo}T23:59:59`) : true))
      .filter((s) => (unitFilter === 'all' ? true : s.unit_id === unitFilter))
      .filter((s) => (cohortFilter === 'all' ? true : s.cohort_id === cohortFilter))
      .filter((s) => (teacherFilter === 'all' ? true : s.professor_id === teacherFilter));
  }, [sessions, search, dateFrom, dateTo, unitFilter, cohortFilter, teacherFilter]);

  const kpi = useMemo(() => {
    const totalSessions = filtered.length;
    const totalAttended = filtered.reduce((s, x) => s + x.attended_count, 0);
    const totalAbsent = filtered.reduce((s, x) => s + x.absent_count, 0);
    const totalEnrolled = filtered.reduce((s, x) => s + x.enrolled_count, 0);
    const rate = totalEnrolled > 0 ? Math.round((totalAttended / totalEnrolled) * 100) : 0;
    return { totalSessions, totalAttended, totalAbsent, rate };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);

  const openDetail = async (sessionId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await getSessionAttendanceDetail(sessionId);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-indigo-600" />
              الحضور والغيابات
            </h2>
            <p className="text-xs text-slate-500 mt-1">قائمة جلسات الحضور داخل المؤسسة مع تفاصيل كل جلسة</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile label="إجمالي الجلسات" value={kpi.totalSessions} icon={CalendarCheck} tone="from-indigo-500 to-indigo-700" />
        <KpiTile label={`حضور ${labels.learners}`} value={kpi.totalAttended} icon={CheckCircle2} tone="from-emerald-500 to-emerald-700" />
        <KpiTile label={`غياب ${labels.learners}`} value={kpi.totalAbsent} icon={XCircle} tone="from-rose-500 to-rose-700" />
        <KpiTile label="نسبة الحضور" value={`${kpi.rate}%`} icon={TrendingUp} tone="from-violet-500 to-violet-700" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-[11px] text-slate-600 mb-1 block">بحث</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="h-9 pr-10"
                placeholder="عنوان الجلسة، الرمز، الفوج، الأستاذ..."
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9" />
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">الوحدة</Label>
            <Select value={unitFilter} onValueChange={(v) => { setUnitFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الوحدات</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">{labels.group}</Label>
            <Select value={cohortFilter} onValueChange={(v) => { setCohortFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل {labels.groups}</SelectItem>
                {cohorts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-1">
            <Label className="text-[11px] text-slate-600 mb-1 block">{labels.educator}</Label>
            <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل {labels.educators}</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">الجلسة</TableHead>
                    <TableHead className="text-right">{labels.group}</TableHead>
                    <TableHead className="text-right">{labels.educator}</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">عدد {labels.learners}</TableHead>
                    <TableHead className="text-right">حضور</TableHead>
                    <TableHead className="text-right">غياب</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                    <TableHead className="text-right">الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((s) => (
                    <TableRow key={s.id} className="hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-[13px]">{s.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.code}</div>
                      </TableCell>
                      <TableCell className="text-[12px] text-slate-700">{s.cohort_name ?? '—'}</TableCell>
                      <TableCell className="text-[12px] text-slate-700">{s.professor_name ?? '—'}</TableCell>
                      <TableCell className="text-[12px] text-slate-600">{new Date(s.created_at).toLocaleDateString('ar-DZ')}</TableCell>
                      <TableCell className="text-[12px] font-bold">{s.enrolled_count}</TableCell>
                      <TableCell className="text-[12px] font-bold text-emerald-700">{s.attended_count}</TableCell>
                      <TableCell className="text-[12px] font-bold text-rose-700">{s.absent_count}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${s.attendance_rate >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : s.attendance_rate >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {s.attendance_rate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => openDetail(s.id)}>
                          <Eye className="h-3 w-3" />
                          تفاصيل
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[11px] text-slate-500">
                عرض {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} من {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 gap-1 text-[11px]">
                  السابق
                </Button>
                <span className="text-[11px] text-slate-600">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="h-8 gap-1 text-[11px]">
                  التالي
                  <ChevronLeft className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل الجلسة</DialogTitle>
            <DialogDescription>
              {detail?.session.title} • {detail?.session.cohort_name ?? '—'}
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="p-8 text-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label={`${labels.learners}`} value={detail.session.enrolled_count} />
                <MiniStat label="الحضور" value={detail.session.attended_count} tone="emerald" />
                <MiniStat label="الغياب" value={detail.session.absent_count} tone="rose" />
                <MiniStat label="النسبة" value={`${detail.session.attendance_rate}%`} tone="violet" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto">
                <ListPanel
                  title={`الحاضرون (${detail.attended.length})`}
                  empty="لا حضور مسجل"
                  tone="emerald"
                  rows={detail.attended.map((a) => ({
                    primary: a.student_name ?? '—',
                    secondary: a.student_number ?? '—',
                    extra: new Date(a.timestamp).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' }),
                    deviceFingerprint: a.device_fingerprint,
                  }))}
                />
                <ListPanel
                  title={`الغائبون (${detail.absent.length})`}
                  empty="لا غياب"
                  tone="rose"
                  rows={detail.absent.map((a) => ({
                    primary: a.student_name ?? '—',
                    secondary: a.student_number ?? '—',
                  }))}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 p-4">تعذر تحميل التفاصيل.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tone} flex items-center justify-center text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 font-bold uppercase">{label}</p>
        <p className="text-xl font-black text-slate-900">{typeof value === 'number' ? value.toLocaleString('ar-DZ') : value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' | 'rose' | 'violet' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700 bg-emerald-50' : tone === 'rose' ? 'text-rose-700 bg-rose-50' : tone === 'violet' ? 'text-violet-700 bg-violet-50' : 'text-slate-700 bg-slate-50';
  return (
    <div className={`rounded-xl border border-slate-100 px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
      <p className="text-lg font-black">{typeof value === 'number' ? value.toLocaleString('ar-DZ') : value}</p>
    </div>
  );
}

function shortFingerprint(value?: string | null) {
  if (!value) return null;
  return value.length > 18 ? `${value.slice(0, 18)}...` : value;
}

function ListPanel({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  rows: { primary: string; secondary: string; extra?: string; deviceFingerprint?: string | null }[];
  tone: 'emerald' | 'rose';
}) {
  return (
    <div className={`rounded-xl border ${tone === 'emerald' ? 'border-emerald-100' : 'border-rose-100'}`}>
      <div className={`px-3 py-2 text-[12px] font-bold ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{title}</div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500 px-3 py-4 text-center">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {rows.map((r, i) => (
            <li key={i} className="px-3 py-2 flex items-center justify-between text-[12px]">
              <div>
                <p className="font-bold text-slate-900">{r.primary}</p>
                <p className="text-[10px] text-slate-500 font-mono">{r.secondary}</p>
                {r.deviceFingerprint && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-indigo-700" dir="ltr">
                    <Fingerprint className="h-3 w-3 shrink-0" />
                    <code className="font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                      {shortFingerprint(r.deviceFingerprint)}
                    </code>
                  </p>
                )}
              </div>
              {r.extra && <span className="text-[10px] text-slate-500 font-mono">{r.extra}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
        <Users className="h-6 w-6 text-indigo-500" />
      </div>
      <h3 className="text-lg font-black text-slate-900">لا توجد جلسات حضور</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        لم يتم فتح أي جلسة حضور بعد ضمن النطاق الحالي. عند فتح الأستاذ لجلسة وتسجيل الحضور ستظهر هنا.
      </p>
    </div>
  );
}
