import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button'; // ✅ أضف هذا السطر
import { BarChart3, Users, Calendar, CheckCircle, TrendingUp, GraduationCap, Award, Clock, Eye, UserMinus, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentAdmin } from '@/lib/database';
import { useInstitutionUI } from '@/config/institutions';
import type { Admin, Cohort, Student, Session } from '@/lib/types';

interface TopProfessor {
  id: string;
  username: string;
  full_name?: string | null;
  sessions?: Array<{ count: number | null }> | null;
}

export default function AnalyticsTab() {
  const ui = useInstitutionUI();
  const [stats, setStats] = useState({
    totalAdmins: 0,
    totalProfessors: 0,
    totalCohorts: 0,
    totalStudents: 0,
    totalSessions: 0,
    totalAttendance: 0,
    activeSessions: 0,
    attendanceRate: 0,
    totalExcluded: 0,
    totalAtRisk: 0,
  });
  const [topProfessors, setTopProfessors] = useState<TopProfessor[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const admin = getCurrentAdmin();
      setIsSuperAdmin(admin?.role === 'super_admin');

      // تجهيز الاستعلامات
      let adminsQ = supabase.from('admins').select('*', { count: 'exact', head: true });
      let profsQ = supabase.from('admins').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
      let cohortsQ = supabase.from('cohorts').select('*', { count: 'exact', head: true });
      let studentsQ = supabase.from('students').select('*', { count: 'exact', head: true });
      let sessionsQ = supabase.from('sessions').select('*', { count: 'exact', head: true });
      let attenQ = supabase.from('attendances').select('*', { count: 'exact', head: true });
      let activeSessionsQ = supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active');
      let totalSessQ = supabase.from('sessions').select('id');
      let recentQ = supabase.from('sessions').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(5);

      // تطبيق العزل إذا لم يكن المدير العام
      if (admin && admin.role !== 'super_admin' && admin.institution_id) {
        adminsQ = adminsQ.eq('institution_id', admin.institution_id);
        profsQ = profsQ.eq('institution_id', admin.institution_id);
        cohortsQ = cohortsQ.eq('institution_id', admin.institution_id);
        studentsQ = studentsQ.eq('institution_id', admin.institution_id);
        sessionsQ = sessionsQ.eq('institution_id', admin.institution_id);
        attenQ = attenQ.eq('institution_id', admin.institution_id);
        activeSessionsQ = activeSessionsQ.eq('institution_id', admin.institution_id);
        totalSessQ = totalSessQ.eq('institution_id', admin.institution_id);
        recentQ = recentQ.eq('institution_id', admin.institution_id);
      }

      // تنفيذ الاستعلامات الإحصائية معاً
      const [
        { count: adminsCount },
        { count: professorsCount },
        { count: cohortsCount },
        { count: studentsCount },
        { count: sessionsCount },
        { count: attendanceCount },
        { count: activeSessionsCount }
      ] = await Promise.all([
        adminsQ, profsQ, cohortsQ, studentsQ, sessionsQ, attenQ, activeSessionsQ
      ]);

      // حساب معدل الحضور
      const totalStudents = studentsCount || 0;
      const totalSessionsData = await totalSessQ;
      const attendanceRate = totalStudents && totalSessionsData.data?.length 
        ? Math.round((attendanceCount || 0) / (totalStudents * (totalSessionsData.data?.length || 1)) * 100)
        : 0;

      // حساب الإقصاء والتحذير
      const { data: allStudents } = await supabase.from('students').select('id, cohort_id');
      const { data: allSessions } = await supabase.from('sessions').select('id, cohort_id');
      const { data: allAttendance } = await supabase.from('attendances').select('student_id, session_id');

      let excludedCount = 0;
      let atRiskCount = 0;

      if (allStudents && allSessions && allAttendance) {
        allStudents.forEach(student => {
          const studentCohortSessions = allSessions.filter(s => s.cohort_id === student.cohort_id);
          const studentAttendedCount = allAttendance.filter(a => a.student_id === student.id && studentCohortSessions.some(ss => ss.id === a.session_id)).length;
          const absences = studentCohortSessions.length - studentAttendedCount;
          if (absences >= 5) excludedCount++;
          else if (absences >= 3) atRiskCount++;
        });
      }
      setStats({
        totalAdmins: adminsCount || 0,
        totalProfessors: professorsCount || 0,
        totalCohorts: cohortsCount || 0,
        totalStudents: studentsCount || 0,
        totalSessions: sessionsCount || 0,
        totalAttendance: attendanceCount || 0,
        activeSessions: activeSessionsCount || 0,
        attendanceRate,
        totalExcluded: excludedCount,
        totalAtRisk: atRiskCount,
      });

      // أنشط الأساتذة (للسوبر أدمن فقط حالياً)
      if (admin?.role === 'super_admin') {
        // نبسط الاستعلام لزيادة الموثوقية وتجنب خطأ 400
        const { data: topProfData } = await supabase
          .from('admins')
          .select(`
            id, 
            username, 
            full_name,
            sessions(count)
          `)
          .eq('role', 'teacher')
          .limit(5);

        // نقوم بالترتيب يدوياً في الواجهة لضمان التوافق
        const sortedProfs = ((topProfData || []) as TopProfessor[])
          .sort((a, b) => (b.sessions?.[0]?.count || 0) - (a.sessions?.[0]?.count || 0));
        
        setTopProfessors(sortedProfs);
      }

      // آخر الجلسات النشطة
      const { data: recentData } = await recentQ;
      setRecentSessions(recentData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      {/* ✅ العنوان */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            لوحة التحكم الرئيسية
          </h1>
          <p className="text-gray-600">نظرة شاملة على أداء النظام</p>
        </div>
        <div className="text-sm text-gray-500">
          آخر تحديث: {new Date().toLocaleString('ar-DZ')}
        </div>
      </div>

      {/* ✅ إحصائيات سريعة - 8 بطاقات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-all border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-lg">إجمالي الأعضاء</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.totalAdmins}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-lg">الأساتذة</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.totalProfessors}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <GraduationCap className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg">{ui.dictionary.cohorts}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.totalCohorts}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">{ui.dictionary.students}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">{stats.totalStudents}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Calendar className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">الجلسات الكلية</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold text-indigo-600">{stats.totalSessions}</div>
            <div className="flex items-center gap-1 text-sm text-indigo-400">
              <Clock className="h-3 w-3" />
              {stats.activeSessions} نشطة حالياً
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-emerald-200 bg-emerald-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg">الحضور الإجمالي</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats.totalAttendance}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-violet-200 bg-violet-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-xl">
                <TrendingUp className="h-5 w-5 text-violet-600" />
              </div>
              <CardTitle className="text-lg">معدل الحضور</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-600">{stats.attendanceRate}%</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-blue-200 bg-blue-50/50 col-span-1 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl">
                <Award className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg">تقييم النظام</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              stats.attendanceRate >= 75 ? 'text-emerald-600' : 
              stats.attendanceRate >= 50 ? 'text-indigo-600' : 'text-rose-600'
            }`}>
              {stats.attendanceRate >= 75 ? 'أداء ممتاز' : stats.attendanceRate >= 50 ? 'أداء جيد' : 'يتطلب مراقبة'}
            </div>
          </CardContent>
        </Card>

        {/* ✅ إحصائيات الإقصاء */}
        <Card className="hover:shadow-lg transition-all border-rose-200 bg-rose-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-xl">
                <UserMinus className="h-5 w-5 text-rose-600" />
              </div>
              <CardTitle className="text-lg">طلاب مقصيون</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
             <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-rose-600">{stats.totalExcluded}</div>
                <div className="text-xs text-rose-400 font-medium">(غابوا 5+)</div>
             </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-lg">تحت الخطر</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
             <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-amber-600">{stats.totalAtRisk}</div>
                <div className="text-xs text-amber-400 font-medium">(3-4 غيابات)</div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ✅ أنشط الأساتذة */}
        {isSuperAdmin && (
          <Card className="hover:shadow-xl transition-all">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                أنشط الأساتذة
              </CardTitle>
              <CardDescription>أكثر الأساتذة نشاطاً هذا الشهر</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProfessors.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">لا توجد بيانات</p>
                ) : (
                  topProfessors.map((prof, index) => (
                    <div key={prof.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{prof.username}</div>
                          <div className="text-sm text-gray-500">{prof.full_name}</div>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-emerald-600">
                          {prof.sessions?.count || 0} جلسة
                        </div>
                        <div className="text-sm text-gray-500">
                          {prof.attendances?.count || 0} حضور
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ✅ آخر الجلسات النشطة */}
        <Card className="hover:shadow-xl transition-all">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              الجلسات النشطة
            </CardTitle>
            <CardDescription>الجلسات المفتوحة حالياً</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>لا توجد جلسات نشطة حالياً</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الرمز</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>الأستاذ</TableHead>
                    <TableHead className="text-left">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSessions.slice(0, 5).map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-mono bg-blue-50 px-3 py-2 rounded">
                        {session.code}
                      </TableCell>
                      <TableCell className="font-medium">{session.title}</TableCell>
                      <TableCell>{session.professor_name || 'غير محدد'}</TableCell>
                      <TableCell className="text-left">
                        {new Date(session.created_at || session.createdAt).toLocaleDateString('ar-DZ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ✅ ملخص الأداء العام */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">ملخص الأداء</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 p-0">
          <div className="p-6 text-center">
            <div className="text-4xl font-bold text-emerald-600 mb-2">{stats.attendanceRate}%</div>
            <div className="text-lg font-semibold text-gray-900 mb-1">معدل الحضور</div>
            <div className={`text-sm ${
              stats.attendanceRate >= 75 ? 'text-emerald-600' : 
              stats.attendanceRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            } font-medium`}>
              {stats.attendanceRate >= 75 ? 'ممتاز 👍' : 
               stats.attendanceRate >= 50 ? 'جيد 👌' : 'يحتاج تحسين ⚠️'}
            </div>
          </div>
          <div className="p-6 border-l border-gray-200 md:border-l-0 md:border-t">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{ui.dictionary.students} الإجماليين:</span>
                <span className="font-semibold">{stats.totalStudents}</span>
              </div>
              <div className="flex justify-between">
                <span>الجلسات الإجمالية:</span>
                <span className="font-semibold">{stats.totalSessions}</span>
              </div>
              <div className="flex justify-between">
                <span>الحضور الإجمالي:</span>
                <span className="font-semibold">{stats.totalAttendance}</span>
              </div>
            </div>
          </div>
          <div className="p-6 border-l border-gray-200 md:border-l md:border-t md:col-span-2">
            <Button 
              onClick={() => loadDashboardData()}
              variant="outline" 
              className="w-full"
            >
              ♻️ تحديث البيانات
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
