import { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, GraduationCap, Calendar, ClipboardList, TrendingUp, BookOpen, Award } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Admin, Cohort, Student, Session } from '@/lib/types';

interface ProfessorDetailsViewProps {
  professorId: string;
  professorData: Admin;
}

export default function ProfessorDetailsView({ professorId, professorData }: ProfessorDetailsViewProps) {
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const pdfRef = useRef<HTMLDivElement | null>(null);
  const [activeSessions, setActiveSessions] = useState(0);

  useEffect(() => {
    loadProfessorData();
  }, [professorId]);

  const loadProfessorData = async () => {
    try {
      setLoading(true);

      // جلب الأفواج
      const { data: cohortsData } = await supabase
        .from('cohorts')
        .select('*')
        .eq('professor_id', professorId)
        .order('created_at', { ascending: false });

      const cohortsArray = cohortsData || [];
      setCohorts(cohortsArray);

      const cohortIds = cohortsArray.map(c => c.id);

      if (cohortIds.length > 0) {
        // جلب الطلاب
        const { data: studentsData } = await supabase
          .from('students')
          .select('*')
          .in('cohort_id', cohortIds)
          .order('created_at', { ascending: false });

        setStudents(studentsData || []);

        // جلب الجلسات
        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('*')
          .eq('professor_id', professorId)
          .order('created_at', { ascending: false });

        const allSessions = sessionsData || [];
        setSessions(allSessions);

        // حساب الجلسات النشطة
        const activeCount = allSessions.filter(s => s.status === 'active').length;
        setActiveSessions(activeCount);

        // حساب عدد الحضور
        const sessionIds = allSessions.map(s => s.id);
        if (sessionIds.length > 0) {
          const { count } = await supabase
            .from('attendances')
            .select('*', { count: 'exact', head: true })
            .in('session_id', sessionIds);

          setAttendanceCount(count || 0);
        }
      }
    } catch (error) {
      console.error('Error loading professor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLevel = (level?: string) => {
    const levels: Record<string, string> = {
      'L1': 'لسانس 1',
      'L2': 'لسانس 2',
      'L3': 'لسانس 3',
      'M1': 'ماستر 1',
      'M2': 'ماستر 2',
    };
    return level ? levels[level] || level : '-';
  };

  const getCohortName = (cohortId?: string | null) => {
    const cohort = cohorts.find(c => c.id === cohortId);
    return cohort?.name || '-';
  };

  // حساب الإحصائيات
  const avgStudentsPerCohort = cohorts.length > 0 ? Math.round(students.length / cohorts.length) : 0;
  const avgAttendancePerSession = sessions.length > 0 ? Math.round(attendanceCount / sessions.length) : 0;
  const attendanceRate = students.length > 0 && sessions.length > 0 
    ? Math.round((attendanceCount / (students.length * sessions.length)) * 100) 
    : 0;
     // ✅ دالة PDF
  const exportToPDF = () => {
    if (!pdfRef.current) return;
    html2pdf()
      .set({
        margin: 1,
        filename: `تقرير_الأستاذ_${professorData.username}_${new Date().toLocaleDateString('ar-DZ')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      })
      .from(pdfRef.current)
      .save();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={pdfRef}>
      {/* ✅ زر PDF */}
      <Button onClick={exportToPDF} className="mb-6 gap-2 bg-blue-600 hover:bg-blue-700">
        <Download className="h-4 w-4" /> تصدير PDF
      </Button>

      {/* معلومات الأستاذ */}
      <Card className="border-none shadow-md overflow-hidden dark:bg-slate-900">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Award className="h-6 w-6 text-blue-500" />
            الملف الشخصي للأستاذ
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50/30 dark:bg-slate-800/20 p-6">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
               اسم المستخدم
            </p>
            <p className="font-mono text-lg font-bold text-blue-600 dark:text-blue-400">@{professorData.username}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">الاسم الكامل</p>
            <p className="font-black text-lg">{professorData.fullName || professorData.full_name || '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">البريد الإلكتروني</p>
            <p className="font-medium text-sm flex items-center gap-1.5 truncate">
              {professorData.email || '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">القسم</p>
            <Badge variant="outline" className="text-sm font-bold border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900 font-bold px-3 py-1 mt-1">
              {professorData.department || '—'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'الأفواج', val: cohorts.length, icon: Users, color: 'indigo', sub: 'فوج دراسي', bg: 'bg-indigo-500/10', hoverBg: 'group-hover:bg-indigo-500/20', iconColor: 'text-indigo-500' },
          { label: 'الطلاب', val: students.length, icon: GraduationCap, color: 'emerald', sub: 'طالب مسجل', bg: 'bg-emerald-500/10', hoverBg: 'group-hover:bg-emerald-500/20', iconColor: 'text-emerald-500' },
          { label: 'الجلسات', val: sessions.length, icon: Calendar, color: 'violet', sub: `${activeSessions} نشطة`, bg: 'bg-violet-500/10', hoverBg: 'group-hover:bg-violet-500/20', iconColor: 'text-violet-500' },
          { label: 'سجلات الحضور', val: attendanceCount, icon: ClipboardList, color: 'blue', sub: 'عملية تسجيل', bg: 'bg-blue-500/10', hoverBg: 'group-hover:bg-blue-500/20', iconColor: 'text-blue-500' },
        ].map((item, i) => (
          <Card key={i} className="border-none shadow-sm dark:bg-slate-900 group hover:scale-[1.02] transition-transform duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 ${item.bg} ${item.hoverBg} rounded-2xl transition-colors`}>
                <item.icon className={`h-6 w-6 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-black">{item.val}</p>
                <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-tight">{item.label}</p>
                <p className="text-[10px] text-muted-foreground opacity-70">{item.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* إحصائيات متقدمة بتصميم Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none bg-gradient-to-br from-indigo-500/5 to-blue-500/5 dark:from-indigo-500/10 dark:to-blue-500/10 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl"><TrendingUp className="h-7 w-7 text-indigo-500" /></div>
            <div>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{avgStudentsPerCohort}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase opacity-80">متوسط الطلاب لكل فوج</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl"><BookOpen className="h-7 w-7 text-emerald-500" /></div>
            <div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{avgAttendancePerSession}</p>
              <p className="text-xs font-bold text-muted-foreground uppercase opacity-80">متوسط الحضور لكل جلسة</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl"><Award className="h-7 w-7 text-blue-500" /></div>
            <div>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{attendanceRate}%</p>
              <p className="text-xs font-bold text-muted-foreground uppercase opacity-80">نسبة الحضور الإجمالية</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs defaultValue="cohorts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cohorts">الأفواج ({cohorts.length})</TabsTrigger>
          <TabsTrigger value="students">الطلاب ({students.length})</TabsTrigger>
          <TabsTrigger value="sessions">الجلسات ({sessions.length})</TabsTrigger>
        </TabsList>

        {/* تبويب الأفواج */}
        <TabsContent value="cohorts">
          <Card>
            <CardHeader>
              <CardTitle>الأفواج المسؤول عنها</CardTitle>
            </CardHeader>
            <CardContent>
              {cohorts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">لا توجد أفواج</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>اسم الفوج</TableHead>
                      <TableHead>السنة</TableHead>
                      <TableHead>الشعبة</TableHead>
                      <TableHead>المادة</TableHead>
                      <TableHead>عدد الطلاب</TableHead>
                      <TableHead>الوصف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cohorts.map((cohort) => {
                      const cohortStudents = students.filter(s => s.cohortId === cohort.id || s.cohort_id === cohort.id);
                      return (
                        <TableRow key={cohort.id}>
                          <TableCell className="font-medium">{cohort.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{formatLevel(cohort.level)}</Badge>
                          </TableCell>
                          <TableCell>{cohort.field || '-'}</TableCell>
                          <TableCell>{cohort.subject || '-'}</TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">{cohortStudents.length}</Badge>
                          </TableCell>
                          <TableCell>{cohort.description || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الطلاب */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>قائمة الطلاب</CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8">
                  <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">لا يوجد طلاب</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الرقم الجامعي</TableHead>
                      <TableHead>الاسم الكامل</TableHead>
                      <TableHead>الفوج</TableHead>
                      <TableHead>تاريخ التسجيل</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono font-medium">
                          {student.studentNumber || student.student_number}
                        </TableCell>
                        <TableCell>
                          {(student.firstName || student.first_name) + ' ' + (student.lastName || student.last_name)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getCohortName(student.cohortId || student.cohort_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(student.createdAt || student.created_at || '').toLocaleDateString('ar-DZ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الجلسات */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>الجلسات (أحدث 50)</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">لا توجد جلسات</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>عنوان الجلسة</TableHead>
                      <TableHead>الرمز</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>تاريخ الإنشاء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.slice(0, 50).map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.title}</TableCell>
                        <TableCell className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                          {session.code}
                        </TableCell>
                        <TableCell>
                          {session.status === 'active' ? (
                            <Badge className="bg-green-500">نشطة</Badge>
                          ) : (
                            <Badge variant="secondary">مغلقة</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(session.createdAt || session.created_at || '').toLocaleDateString('ar-DZ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
