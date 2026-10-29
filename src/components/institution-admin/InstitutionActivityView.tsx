// =============================================================================
// Phase 11 — Activity log view
// =============================================================================
// Read activity_logs scoped to the institution (RLS allows tenant SELECT).
// Today, activity_logs INSERT is super_admin-only, so most institutions will
// have an empty list. We surface a clean Empty State explaining this rather
// than fake events.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Search,
  Loader2,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronLeft,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  getInstitutionActivityLog,
  type InstitutionActivityRow,
} from '@/lib/institutionAdminApi';

interface Props {
  institutionId: string;
  institutionName: string;
}

const PAGE_SIZE = 25;

const CATEGORY_LABEL: Record<string, string> = {
  attendance:   'حضور',
  security:     'أمن',
  subscription: 'اشتراك',
  report:       'تقرير',
  user:         'مستخدمون',
  institution:  'مؤسسة',
  system:       'نظام',
};

const OUTCOME_META: Record<string, { label: string; tone: string; icon: React.ComponentType<{ className?: string }> }> = {
  success:  { label: 'ناجح',  tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  warning:  { label: 'تحذير', tone: 'bg-amber-50 text-amber-700 border-amber-200',     icon: AlertTriangle },
  rejected: { label: 'مرفوض', tone: 'bg-rose-50 text-rose-700 border-rose-200',         icon: XCircle },
  pending:  { label: 'منتظر', tone: 'bg-slate-100 text-slate-700 border-slate-200',     icon: Clock },
};

const PRIORITY_TONE: Record<string, string> = {
  high:   'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-sky-50 text-sky-700 border-sky-200',
  info:   'bg-slate-100 text-slate-600 border-slate-200',
};

export default function InstitutionActivityView({ institutionId }: Props) {
  const [rows, setRows] = useState<InstitutionActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getInstitutionActivityLog(institutionId, 500);
        if (!cancelled) setRows(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [institutionId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => (term ? `${r.title} ${r.description ?? ''} ${r.actor_name ?? ''}`.toLowerCase().includes(term) : true))
      .filter((r) => (categoryFilter === 'all' ? true : r.category === categoryFilter))
      .filter((r) => (priorityFilter === 'all' ? true : r.priority === priorityFilter))
      .filter((r) => (dateFrom ? new Date(r.created_at) >= new Date(dateFrom) : true))
      .filter((r) => (dateTo ? new Date(r.created_at) <= new Date(`${dateTo}T23:59:59`) : true));
  }, [rows, search, categoryFilter, priorityFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-100 p-5">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          سجل النشاط
        </h2>
        <p className="text-xs text-slate-500 mt-1">العمليات الإدارية والأمنية المسجّلة على نطاق المؤسسة</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Label className="text-[11px] text-slate-600 mb-1 block">بحث</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="h-9 pr-10"
                placeholder="عنوان، وصف، مستخدم..."
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">القسم</Label>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأقسام</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-slate-600 mb-1 block">الأولوية</Label>
            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="info">للعلم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-slate-600 mb-1 block">من</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} className="h-9" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600 mb-1 block">إلى</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} className="h-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Filter className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">لا نتائج مطابقة للفلاتر الحالية</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">القسم</TableHead>
                    <TableHead className="text-right">العملية</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">الأولوية</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const meta = OUTCOME_META[r.outcome_status] ?? OUTCOME_META.success;
                    const Icon = meta.icon;
                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50/60 align-top">
                        <TableCell className="text-[11px] text-slate-600 whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700 border-slate-200">
                            {CATEGORY_LABEL[r.category] ?? r.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-bold text-slate-900 text-[13px]">{r.title}</p>
                          {r.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 max-w-md truncate">{r.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-[12px] text-slate-700">{r.actor_name ?? 'النظام'}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] gap-1 border ${meta.tone}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[r.priority] ?? PRIORITY_TONE.info}`}>
                            {r.priority}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-[11px] text-slate-500">
                عرض {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} من {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="h-8 gap-1 text-[11px]">السابق</Button>
                <span className="text-[11px] text-slate-600">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} className="h-8 gap-1 text-[11px]">
                  التالي <ChevronLeft className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="h-14 w-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
        <Activity className="h-6 w-6 text-indigo-500" />
      </div>
      <h3 className="text-lg font-black text-slate-900">لا توجد عمليات مسجّلة</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
        لم يتم تسجيل أي عملية إدارية على هذه المؤسسة بعد.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1 rounded-full border border-sky-200 text-[11px]">
        <Info className="h-3 w-3" />
        كتابة سجل النشاط الموسّع ستتفعّل في تحديث قادم
      </div>
    </div>
  );
}
