import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Trash2,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Calendar,
  User,
  Search,
  RefreshCw,
  ChevronRight,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { getAllDevices, deactivateDevice } from '@/lib/database';

interface DeviceRow {
  id: string;
  student_id: string;
  device_fingerprint: string;
  last_used: string | null;
  is_active: boolean | null;
  institution_id: string | null;
  students?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    student_number?: string | null;
    cohort_id?: string | null;
    institution_id?: string | null;
  } | null;
}

export default function DevicesTab() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllDevices();
      setDevices((data as unknown as DeviceRow[]) || []);
    } catch (err) {
      console.error('Failed to load devices', err);
      toast.error('تعذر تحميل قائمة الأجهزة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('هل تريد إلغاء تفعيل هذا الجهاز؟ سيُطلب من الطالب ربط جهاز جديد عند تسجيل الحضور القادم.')) {
      return;
    }
    const ok = await deactivateDevice(id);
    if (ok) {
      toast.success('تم إلغاء تفعيل الجهاز بنجاح');
      loadData();
    } else {
      toast.error('تعذر إلغاء تفعيل الجهاز');
    }
  };

  const copyFingerprint = async (fp: string, id: string) => {
    try {
      await navigator.clipboard.writeText(fp);
      setCopiedId(id);
      toast.success('تم نسخ البصمة');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('تعذر النسخ');
    }
  };

  const filteredDevices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      const first = d.students?.first_name?.toLowerCase() || '';
      const last = d.students?.last_name?.toLowerCase() || '';
      const sn = (d.students?.student_number || '').toLowerCase();
      const fp = (d.device_fingerprint || '').toLowerCase();
      return (
        first.includes(q) ||
        last.includes(q) ||
        `${first} ${last}`.includes(q) ||
        sn.includes(q) ||
        fp.includes(q)
      );
    });
  }, [devices, searchQuery]);

  const activeCount = useMemo(() => devices.filter((d) => d.is_active !== false).length, [devices]);

  if (loading && devices.length === 0)
    return (
      <Card>
        <CardContent className="p-12 text-center animate-pulse text-indigo-500 font-black tracking-widest uppercase text-xs">
          جاري فحص سلامة الأجهزة...
        </CardContent>
      </Card>
    );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Smartphone className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة الأجهزة الموثوقة</h1>
              <p className="text-slate-500 text-sm">مراقبة الأجهزة المربوطة بطلاب الأفواج التي تدرّسها</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11 px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm"
              onClick={loadData}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث البيانات
            </Button>
            <div className="relative min-w-[280px]">
              <Search className="absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث بالاسم، الرقم، أو البصمة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pr-10 rounded-xl border-slate-200 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-100">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[10px] tracking-widest pl-4">
                          بصمة الجهاز الموثوق
                        </TableHead>
                        <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[10px] tracking-widest">
                          المستخدم (الطالب)
                        </TableHead>
                        <TableHead className="py-5 text-right font-black text-slate-600 uppercase text-[10px] tracking-widest">
                          آخر نشاط
                        </TableHead>
                        <TableHead className="py-5 text-center font-black text-slate-600 uppercase text-[10px] tracking-widest">
                          الحالة
                        </TableHead>
                        <TableHead className="py-5 text-left font-black text-slate-600 uppercase text-[10px] tracking-widest pr-4">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDevices.length > 0 ? (
                        filteredDevices.map((d) => {
                          const isActive = d.is_active !== false;
                          const fp = d.device_fingerprint || '';
                          const fpShort = fp ? `${fp.slice(0, 12)}…` : '—';
                          return (
                            <TableRow
                              key={d.id}
                              className="group hover:bg-indigo-50/20 transition-colors border-b border-slate-50 last:border-0"
                            >
                              <TableCell className="py-4 pl-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                    <Fingerprint className="h-5 w-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={() => copyFingerprint(fp, d.id)}
                                          className="text-[11px] font-mono text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/50 max-w-[140px] truncate hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                        >
                                          {copiedId === d.id ? (
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="h-3 w-3 opacity-50" />
                                          )}
                                          <span dir="ltr">{fpShort}</span>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className="font-mono text-[11px]">
                                        <div dir="ltr">{fp || 'لا توجد بصمة'}</div>
                                        <div className="text-[10px] opacity-70 mt-1">انقر للنسخ</div>
                                      </TooltipContent>
                                    </Tooltip>
                                    <span className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">
                                      ID: {d.id.split('-')[0]}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-700 text-sm">
                                    {d.students?.first_name || ''} {d.students?.last_name || ''}
                                    {!d.students?.first_name && !d.students?.last_name && (
                                      <span className="text-slate-400">طالب غير معروف</span>
                                    )}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-mono">
                                    {d.students?.student_number || 'بدون رقم'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-4">
                                <div className="flex flex-col text-right">
                                  {d.last_used ? (
                                    <>
                                      <span className="text-[12px] font-bold text-slate-600">
                                        {new Date(d.last_used).toLocaleTimeString('ar-DZ', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(d.last_used).toLocaleDateString('ar-DZ')}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[11px] text-slate-300">لم يُستخدم بعد</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 text-center">
                                <div className="flex justify-center flex-col items-center gap-1">
                                  {isActive ? (
                                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 transition-all group-hover:scale-105">
                                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span className="text-[10px] font-black uppercase tracking-wider">نشط</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">
                                      <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                      <span className="text-[10px] font-black uppercase tracking-wider">معطّل</span>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 pr-4">
                                <div className="flex justify-end gap-1">
                                  {isActive && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-9 w-9 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                          onClick={() => handleDeactivate(d.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>إلغاء تفعيل الجهاز</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-32 text-center text-slate-400">
                            {searchQuery ? 'لا نتائج مطابقة لبحثك' : 'لا توجد أجهزة مسجلة حالياً'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border-none bg-slate-900 text-white shadow-2xl shadow-slate-900/10 overflow-hidden relative">
              <div className="absolute right-0 top-0 h-40 w-40 bg-indigo-500/20 rounded-full -mr-20 -mt-20 blur-2xl" />
              <CardHeader className="relative z-10 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" />
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-indigo-200">
                    إحصائيات الأمان
                  </CardTitle>
                </div>
                <CardDescription className="text-slate-400 text-xs">
                  تحليل أداء الأجهزة الموثوقة
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-4xl font-black text-indigo-400">{devices.length}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">جهاز مسجل</span>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-2xl font-black text-emerald-500">{activeCount}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">نشطة</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">معدل الأجهزة النشطة</span>
                    <span className="font-mono text-emerald-400">
                      {devices.length > 0 ? Math.round((activeCount / devices.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full transition-all duration-700"
                      style={{
                        width: `${devices.length > 0 ? (activeCount / devices.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-indigo-100 bg-indigo-50/30 border shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-1 text-indigo-600">
                  <ShieldAlert className="h-5 w-5" />
                  <CardTitle className="text-sm font-bold">سياسة الأمان الموحدة</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                  يسمح النظام بجهاز واحد فقط لكل طالب لضمان منع التلاعب. عند إلغاء تفعيل جهاز طالب، سيُطلب منه ربط حسابه بجهاز جديد في المرة القادمة التي يحاول فيها تسجيل الحضور.
                </p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-[10px] text-indigo-900 font-black uppercase mt-3 hover:no-underline"
                >
                  دليل سياسات الأمان <ChevronRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>

            <div className="p-6 rounded-3xl border border-dashed border-slate-200 bg-white/50 flex flex-col items-center text-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <User className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-700">دعم فني (للطلاب)</h4>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">
                  إذا واجه الطالب مشكلة "جهاز غير معروف"
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full text-[11px] font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50 h-9"
              >
                إرسال تقرير حالة
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
