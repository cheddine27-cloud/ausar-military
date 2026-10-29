// =============================================================================
// Phase 9 — Institution Reports
// =============================================================================
// Real reports page wired to live Supabase queries (RLS does the slicing).
// Five report types (الحضور / الغيابات / التبريرات / الأساتذة / الأفواج),
// shared filter bar, KPI cards, sortable + paginated table, Excel + PDF
// export with full Arabic RTL layout.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Calendar,
  Users,
  GraduationCap,
  Building2,
  Activity,
  AlertCircle,
  Loader2,
  ChevronLeft,
  TrendingDown,
  Star,
  ClipboardList,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getReportSessions,
  getReportTeachers,
  getReportCohorts,
  getReportJustifications,
  buildReportsKpis,
  getInstitutionUnits,
  getInstitutionCohorts,
  getInstitutionUsers,
  type ReportSessionRow,
  type ReportTeacherRow,
  type ReportCohortRow,
  type ReportJustificationRow,
  type ReportsKpis,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';
import {
  exportReportToExcel,
  exportReportToPDF,
  type ReportType,
} from '@/lib/institutionReportsExport';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import { getSectorLabels, type SectorType } from '@/lib/sectorLabels';

interface Props {
  institutionId: string;
  institutionName: string;
  institutionType?: SectorType;
  permissions?: PermissionMap | null;
}

const PAGE_SIZE = 25;

const REPORT_OPTIONS: { value: ReportType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'attendance',     label: 'تقرير الحضور',         description: 'الحصص + معدلات الحضور لكل جلسة',  icon: CheckCircle2 },
  { value: 'absences',       label: 'تقرير الغيابات',       description: 'الجلسات + الغيابات المحسوبة',     icon: TrendingDown },
  { value: 'justifications', label: 'تقرير التبريرات',     description: 'طلبات التبريرات وحالتها',          icon: ClipboardList },
  { value: 'teachers',       label: 'تقرير الأساتذة',       description: 'النشاط لكل أستاذ',                icon: GraduationCap },
  { value: 'cohorts',        label: 'تقرير الأفواج / الأقسام / الفرق', description: 'تجميع لكل مجموعة وعلاقتها بالحضور', icon: Users },
];

type SortDir = 'asc' | 'desc';

function applySort<T>(rows: T[], key: keyof T | null, dir: SortDir): T[] {
  if (!key) return rows;
  const sorted = [...rows].sort((a, b) => {
    const av = a[key] as unknown;
    const bv = b[key] as unknown;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), 'ar');
  });
  return dir === 'asc' ? sorted : sorted.reverse();
}

interface Cohort { id: string; name: string; level: string | null }
interface TeacherOpt { id: string; full_name: string | null; username: string }

export default function InstitutionReports({ institutionId, institutionName, institutionType, permissions }: Props) {
  const labels = getSectorLabels(institutionType);
  const canExportReports = can(permissions, PERMISSIONS.reportsExport);
  const [reportType, setReportType] = useState<ReportType>('attendance');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');

  // Reference data
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);

  // Data
  const [sessions, setSessions] = useState<ReportSessionRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<ReportTeacherRow[]>([]);
  const [cohortRows, setCohortRows] = useState<ReportCohortRow[]>([]);
  const [justifications, setJustifications] = useState<ReportJustificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  // Search + sort + pagination
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const filterPayload = useMemo(
    () => ({
      dateFrom: dateFrom || null,
      dateTo: dateTo ? `${dateTo}T23:59:59` : null,
      unitId: unitFilter === 'all' ? null : unitFilter,
      cohortId: cohortFilter === 'all' ? null : cohortFilter,
      teacherId: teacherFilter === 'all' ? null : teacherFilter,
    }),
    [dateFrom, dateTo, unitFilter, cohortFilter, teacherFilter],
  );

  // Load reference data once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, c, allUsers] = await Promise.all([
        getInstitutionUnits(institutionId),
        getInstitutionCohorts(institutionId),
        getInstitutionUsers(institutionId),
      ]);
      if (cancelled) return;
      setUnits(u);
      setCohorts(c);
      setTeachers(allUsers.filter((x) => x.role === 'teacher').map((x) => ({ id: x.id, full_name: x.full_name, username: x.username })));
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  // Reload data whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [s, t, c, j] = await Promise.all([
        getReportSessions(filterPayload, institutionId),
        getReportTeachers(filterPayload, institutionId),
        getReportCohorts(filterPayload, institutionId),
        getReportJustifications(filterPayload, institutionId),
      ]);
      if (cancelled) return;
      setSessions(s);
      setTeacherRows(t);
      setCohortRows(c);
      setJustifications(j);
      setLoading(false);
      setPage(0);
    })();
    return () => { cancelled = true; };
  }, [institutionId, filterPayload]);

  const kpis: ReportsKpis = useMemo(
    () => buildReportsKpis({ sessions, cohorts: cohortRows, teachers: teacherRows, justifications }),
    [sessions, cohortRows, teacherRows, justifications],
  );

  // Derive the active dataset based on the selected report type
  type Row = ReportSessionRow | ReportTeacherRow | ReportCohortRow | ReportJustificationRow;
  const activeRows: Row[] = useMemo(() => {
    switch (reportType) {
      case 'attendance':
      case 'absences':
        return sessions;
      case 'teachers':
        return teacherRows;
      case 'cohorts':
        return cohortRows;
      case 'justifications':
        return justifications;
    }
  }, [reportType, sessions, teacherRows, cohortRows, justifications]);

  // Filter by free-text search
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [activeRows, search]);

  const sorted = useMemo(() => {
    return applySort(searched, sortKey as keyof Row | null, sortDir);
  }, [searched, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ keyName }: { keyName: string }) => {
    if (sortKey !== keyName) return <ArrowUpDown className="h-3 w-3 inline ms-1 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 inline ms-1" /> : <ArrowDown className="h-3 w-3 inline ms-1" />;
  };

  // Export — gathers display labels from selected filter values
  const buildExportContext = () => {
    const reportLabel = REPORT_OPTIONS.find((r) => r.value === reportType)?.label ?? 'تقرير';
    const unitName = unitFilter !== 'all' ? units.find((u) => u.id === unitFilter)?.name ?? null : null;
    const cohortName = cohortFilter !== 'all' ? cohorts.find((c) => c.id === cohortFilter)?.name ?? null : null;
    const teacherName = teacherFilter !== 'all'
      ? teachers.find((t) => t.id === teacherFilter)
        ? (teachers.find((t) => t.id === teacherFilter)!.full_name || teachers.find((t) => t.id === teacherFilter)!.username)
        : null
      : null;

    return {
      institutionName,
      reportType,
      reportTitle: reportLabel,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      unitName,
      cohortName,
      teacherName,
      kpis,
      sessions,
      teachers: teacherRows,
      cohorts: cohortRows,
      justifications,
    };
  };

  const handleExportExcel = async () => {
    if (!canExportReports) {
      toast.error('ليست لديك صلاحية تصدير التقارير');
      return;
    }
    setExporting('excel');
    try {
      await exportReportToExcel(buildExportContext());
      toast.success('تم تصدير ملف Excel');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تصدير Excel');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (!canExportReports) {
      toast.error('ليست لديك صلاحية تصدير التقارير');
      return;
    }
    setExporting('pdf');
    try {
      await exportReportToPDF(buildExportContext());
      toast.success('تم تصدير ملف PDF');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'تعذر تصدير PDF');
    } finally {
      setExporting(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-DZ') : '—');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              التقارير
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تقارير مفصّلة للحضور والغيابات والتبريرات والأساتذة والأفواج داخل {institutionName}
            </p>
          </div>
          {canExportReports && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={loading || exporting !== null}
                className="gap-2 rounded-xl"
              >
                {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Excel
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPDF}
                disabled={loading || exporting !== null}
                className="gap-2 rounded-xl"
              >
                {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          {[
            { label: 'الجلسات',          value: kpis.totalSessions,        icon: Calendar,    tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'الحضورات',         value: kpis.totalAttendances,     icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'الغيابات',         value: kpis.totalAbsences,        icon: TrendingDown, tone: 'bg-rose-50 text-rose-700' },
            { label: 'نسبة الحضور',      value: `${kpis.attendanceRate}%`, icon: Activity,    tone: 'bg-cyan-50 text-cyan-700' },
            { label: 'تبريرات قيد المراجعة', value: kpis.pendingJustifications, icon: Clock,  tone: 'bg-amber-50 text-amber-700' },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="border border-slate-100 rounded-xl p-3">
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${k.tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2">{k.value}</p>
                <p className="text-[11px] text-slate-500 font-medium">{k.label}</p>
              </div>
            );
          })}
        </div>

        {/* Top-x cards */}
        {(kpis.topAbsentCohort || kpis.topActiveTeacher) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {kpis.topAbsentCohort && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <TrendingDown className="h-5 w-5 text-amber-600" />
                <div className="text-xs flex-1">
                  <p className="text-amber-900 font-bold">{labels.group} الأكثر غياباً</p>
                  <p className="text-amber-700">
                    {kpis.topAbsentCohort.name} <span className="text-amber-600">— {kpis.topAbsentCohort.absences} غياب</span>
                  </p>
                </div>
              </div>
            )}
            {kpis.topActiveTeacher && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                <Star className="h-5 w-5 text-emerald-600" />
                <div className="text-xs flex-1">
                  <p className="text-emerald-900 font-bold">الأستاذ الأكثر نشاطاً</p>
                  <p className="text-emerald-700">
                    {kpis.topActiveTeacher.name} <span className="text-emerald-600">— {kpis.topActiveTeacher.sessions} جلسة</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report type chooser + filters */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
        {/* Report type chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {REPORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = reportType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setReportType(opt.value); setPage(0); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <div className="md:col-span-2">
            <Label className="text-[10px] text-slate-500">من تاريخ</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] text-slate-500">إلى تاريخ</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-lg" />
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">الوحدة الأكاديمية</Label>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="h-9 w-full px-2 rounded-lg border border-slate-200 bg-white text-xs"
            >
              <option value="all">كل الوحدات</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-[10px] text-slate-500">{labels.group}</Label>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="h-9 w-full px-2 rounded-lg border border-slate-200 bg-white text-xs"
            >
              <option value="all">كل الأفواج</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Teacher filter only relevant for some reports */}
        {(reportType === 'attendance' || reportType === 'absences' || reportType === 'teachers') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-slate-500">الأستاذ</Label>
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger className="h-9 rounded-lg text-xs">
                  <SelectValue placeholder="كل الأساتذة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأساتذة</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.full_name || t.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Search + reset */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث في النتائج..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 h-9 rounded-lg"
            />
          </div>
          <span className="text-[11px] text-slate-500 ms-auto">
            {sorted.length} نتيجة
          </span>
          {(search || dateFrom || dateTo || unitFilter !== 'all' || cohortFilter !== 'all' || teacherFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                setSearch('');
                setDateFrom('');
                setDateTo('');
                setUnitFilter('all');
                setCohortFilter('all');
                setTeacherFilter('all');
              }}
            >
              مسح الفلاتر
            </Button>
          )}
        </div>
      </div>

      {/* Results table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs text-slate-500 mt-2">جاري تحميل التقرير...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700 mt-3">لا توجد بيانات للفترة والنطاق المحددَين</p>
            <p className="text-xs text-slate-500 mt-1">جرّب توسيع الفترة أو إزالة بعض الفلاتر</p>
          </div>
        ) : (
          <ResultsTable
            type={reportType}
            rows={paginated as ReportSessionRow[] & ReportTeacherRow[] & ReportCohortRow[] & ReportJustificationRow[]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            SortIcon={SortIcon}
            formatDate={formatDate}
          />
        )}

        {sorted.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs">
            <span className="text-slate-500">صفحة {safePage + 1} من {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8">
                السابق
              </Button>
              <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="h-8">
                التالي
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Results table (per-type)
// =============================================================================
interface TableProps {
  type: ReportType;
  rows: (ReportSessionRow | ReportTeacherRow | ReportCohortRow | ReportJustificationRow)[];
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  SortIcon: React.ComponentType<{ keyName: string }>;
  formatDate: (iso: string | null) => string;
}

function ResultsTable({ type, rows, onSort, SortIcon, formatDate }: TableProps) {
  if (type === 'attendance' || type === 'absences') {
    const data = rows as ReportSessionRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="text-right cursor-pointer" onClick={() => onSort('created_at')}>
              التاريخ <SortIcon keyName="created_at" />
            </TableHead>
            <TableHead className="text-right">الجلسة</TableHead>
            <TableHead className="text-right">الفوج / المسار</TableHead>
            <TableHead className="text-right">الأستاذ</TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('attendance_count')}>
              الحضور <SortIcon keyName="attendance_count" />
            </TableHead>
            <TableHead className="text-center">مسجلون</TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('attendance_rate')}>
              النسبة <SortIcon keyName="attendance_rate" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((r) => (
            <TableRow key={r.id} className="hover:bg-slate-50/60">
              <TableCell className="text-xs text-slate-500 font-mono">{formatDate(r.created_at)}</TableCell>
              <TableCell>
                <div className="text-sm font-bold text-slate-900 truncate max-w-[14rem]">{r.title}</div>
                <div className="text-[10px] text-slate-500 font-mono">{r.code}</div>
              </TableCell>
              <TableCell className="text-[11px] text-slate-700">
                <div className="font-bold text-slate-800">{r.cohort_name ?? '—'}</div>
                {r.unit_path.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5 text-[10px] text-slate-500">
                    {r.unit_path.map((seg, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <ChevronLeft className="h-2.5 w-2.5 text-slate-300" />}
                        <span>{seg}</span>
                      </span>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-xs text-slate-700">{r.professor_name ?? '—'}</TableCell>
              <TableCell className="text-center font-bold text-emerald-700">{r.attendance_count}</TableCell>
              <TableCell className="text-center text-slate-600">{r.enrolled_in_cohort}</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={
                  r.attendance_rate >= 75
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : r.attendance_rate >= 50
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }>
                  {r.attendance_rate}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'teachers') {
    const data = rows as ReportTeacherRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="text-right cursor-pointer" onClick={() => onSort('full_name')}>
              الأستاذ <SortIcon keyName="full_name" />
            </TableHead>
            <TableHead className="text-right">الرتبة / القسم</TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('sessions_count')}>
              الجلسات <SortIcon keyName="sessions_count" />
            </TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('attendances_count')}>
              الحضورات <SortIcon keyName="attendances_count" />
            </TableHead>
            <TableHead className="text-center">طلاب فريدون</TableHead>
            <TableHead className="text-center">أفواج معيّنة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((t) => (
            <TableRow key={t.id} className="hover:bg-slate-50/60">
              <TableCell className="text-sm font-bold text-slate-900">
                {t.full_name || t.username}
              </TableCell>
              <TableCell className="text-xs text-slate-700">
                {[t.rank, t.department].filter(Boolean).join(' • ') || '—'}
              </TableCell>
              <TableCell className="text-center font-bold text-indigo-700">{t.sessions_count}</TableCell>
              <TableCell className="text-center font-bold text-emerald-700">{t.attendances_count}</TableCell>
              <TableCell className="text-center text-slate-700">{t.unique_students_reached}</TableCell>
              <TableCell className="text-center text-slate-700">{t.cohorts_assigned}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (type === 'cohorts') {
    const data = rows as ReportCohortRow[];
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="text-right cursor-pointer" onClick={() => onSort('name')}>
              الفوج <SortIcon keyName="name" />
            </TableHead>
            <TableHead className="text-right">المسار الأكاديمي</TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('students_count')}>
              الطلاب <SortIcon keyName="students_count" />
            </TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('sessions_count')}>
              الجلسات <SortIcon keyName="sessions_count" />
            </TableHead>
            <TableHead className="text-center">الحضورات</TableHead>
            <TableHead className="text-center cursor-pointer" onClick={() => onSort('attendance_rate')}>
              النسبة <SortIcon keyName="attendance_rate" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((c) => (
            <TableRow key={c.id} className="hover:bg-slate-50/60">
              <TableCell className="text-sm font-bold text-slate-900">{c.name}</TableCell>
              <TableCell className="text-[11px] text-slate-700">
                {c.unit_path.length > 0 ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.unit_path.map((seg, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <ChevronLeft className="h-3 w-3 text-slate-300" />}
                        <span className={idx === c.unit_path.length - 1 ? 'font-bold text-indigo-700' : ''}>{seg}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">غير مرتبطة</Badge>
                )}
              </TableCell>
              <TableCell className="text-center text-slate-700">{c.students_count}</TableCell>
              <TableCell className="text-center text-slate-700">{c.sessions_count}</TableCell>
              <TableCell className="text-center font-bold text-emerald-700">{c.attendances_count}</TableCell>
              <TableCell className="text-center">
                <Badge variant="outline" className={
                  c.attendance_rate >= 75
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : c.attendance_rate >= 50
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                }>
                  {c.attendance_rate}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // justifications
  const data = rows as ReportJustificationRow[];
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/80">
          <TableHead className="text-right">الطالب</TableHead>
          <TableHead className="text-right">الفوج / المسار</TableHead>
          <TableHead className="text-right">السبب</TableHead>
          <TableHead className="text-center">الحالة</TableHead>
          <TableHead className="text-right cursor-pointer" onClick={() => onSort('created_at')}>
            قُدِّم في <SortIcon keyName="created_at" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((j) => (
          <TableRow key={j.id} className="hover:bg-slate-50/60">
            <TableCell>
              <div className="text-sm font-bold text-slate-900">{j.student_full_name ?? '—'}</div>
              {j.student_number && <div className="text-[10px] font-mono text-slate-500">{j.student_number}</div>}
            </TableCell>
            <TableCell className="text-[11px] text-slate-700">
              <div className="font-bold">{j.cohort_name ?? '—'}</div>
              {j.unit_path.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-0.5 text-[10px] text-slate-500">
                  {j.unit_path.map((seg, idx) => (
                    <span key={idx} className="flex items-center gap-1">
                      {idx > 0 && <ChevronLeft className="h-2.5 w-2.5 text-slate-300" />}
                      <span>{seg}</span>
                    </span>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="text-xs text-slate-700 max-w-[14rem] truncate" title={j.reason}>{j.reason}</TableCell>
            <TableCell className="text-center">
              {j.status === 'pending' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" />قيد المراجعة</Badge>}
              {j.status === 'approved' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" />مقبول</Badge>}
              {j.status === 'rejected' && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1"><XCircle className="h-3 w-3" />مرفوض</Badge>}
            </TableCell>
            <TableCell className="text-[11px] text-slate-500 font-mono">{formatDate(j.created_at)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
