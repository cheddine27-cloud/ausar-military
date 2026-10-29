import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarCheck,
  Clock,
  Layers,
  Percent,
  TrendingUp,
  UserMinus,
  Users,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAllAttendance, getAllCohorts, getAllSessions, getAllStudents } from '@/lib/database';
import type { Attendance, Cohort, Session, Student } from '@/lib/types';

interface TeacherStatsTabProps {
  teacherId: string;
}

interface DayPoint {
  label: string;
  count: number;
}

interface RecentSessionRow {
  session: Session;
  cohort: Cohort | null;
  present: number;
  expected: number;
  rate: number;
}

interface CohortRate {
  cohort: Cohort;
  present: number;
  expected: number;
  rate: number;
}

interface StudentAbsenceRow {
  student: Student;
  cohort: Cohort | null;
  expected: number;
  present: number;
  absences: number;
}

function getSessionDate(session: Session): string {
  return session.created_at || session.createdAt || new Date().toISOString();
}

function getSessionCohortId(session: Session): string | null {
  return session.cohort_id || session.cohortId || null;
}

function getAttendanceSessionId(attendance: Attendance): string | null {
  return attendance.session_id || attendance.sessionId || null;
}

function getAttendanceStudentId(attendance: Attendance): string | null {
  return attendance.student_id || attendance.studentId || null;
}

function getStudentCohortId(student: Student): string | null {
  return student.cohort_id || student.cohortId || null;
}

function getStudentNumber(student: Student): string {
  return student.student_number || student.studentNumber || '—';
}

function getStudentName(student: Student): string {
  return [student.first_name || student.firstName, student.last_name || student.lastName]
    .filter(Boolean)
    .join(' ') || 'طالب بدون اسم';
}

function formatNumber(value: number): string {
  return value.toLocaleString('ar-DZ');
}

function formatRate(value: number): string {
  return `${value.toLocaleString('ar-DZ')}%`;
}

function buildLastSevenDays(attendances: Attendance[]): DayPoint[] {
  const buckets: DayPoint[] = [];
  const counts = new Map<string, number>();

  attendances.forEach((attendance) => {
    const dayKey = new Date(attendance.timestamp).toISOString().slice(0, 10);
    counts.set(dayKey, (counts.get(dayKey) ?? 0) + 1);
  });

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    buckets.push({
      label: date.toLocaleDateString('ar-DZ', { weekday: 'short' }),
      count: counts.get(key) ?? 0,
    });
  }

  return buckets;
}

export default function TeacherStatsTab({ teacherId }: TeacherStatsTabProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [sessionRows, cohortRows, studentRows, attendanceRows] = await Promise.all([
          getAllSessions(),
          getAllCohorts(),
          getAllStudents(),
          getAllAttendance(),
        ]);

        if (cancelled) return;
        setSessions(sessionRows.filter((session) => session.professor_id === teacherId || session.created_by === teacherId || session.createdBy === teacherId));
        setCohorts(cohortRows);
        setStudents(studentRows);
        setAttendances(attendanceRows);
      } catch {
        if (!cancelled) setError('تعذر تحميل إحصائيات الأستاذ حالياً.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  const stats = useMemo(() => {
    const cohortById = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
    const studentsByCohort = new Map<string, Student[]>();
    students.forEach((student) => {
      const cohortId = getStudentCohortId(student);
      if (!cohortId) return;
      const list = studentsByCohort.get(cohortId) ?? [];
      list.push(student);
      studentsByCohort.set(cohortId, list);
    });

    const sessionIds = new Set(sessions.map((session) => session.id));
    const attendancesForSessions = attendances.filter((attendance) => {
      const sessionId = getAttendanceSessionId(attendance);
      return sessionId ? sessionIds.has(sessionId) : false;
    });

    const attendanceBySession = new Map<string, number>();
    const attendanceByStudent = new Map<string, number>();
    attendancesForSessions.forEach((attendance) => {
      const sessionId = getAttendanceSessionId(attendance);
      const studentId = getAttendanceStudentId(attendance);
      if (sessionId) attendanceBySession.set(sessionId, (attendanceBySession.get(sessionId) ?? 0) + 1);
      if (studentId) attendanceByStudent.set(studentId, (attendanceByStudent.get(studentId) ?? 0) + 1);
    });

    let expectedAttendance = 0;
    sessions.forEach((session) => {
      const cohortId = getSessionCohortId(session);
      expectedAttendance += cohortId ? studentsByCohort.get(cohortId)?.length ?? 0 : 0;
    });

    const totalAttendances = attendancesForSessions.length;
    const absences = Math.max(0, expectedAttendance - totalAttendances);
    const attendanceRate = expectedAttendance > 0 ? Math.round((totalAttendances / expectedAttendance) * 100) : 0;

    const recentSessions: RecentSessionRow[] = [...sessions]
      .sort((a, b) => new Date(getSessionDate(b)).getTime() - new Date(getSessionDate(a)).getTime())
      .slice(0, 5)
      .map((session) => {
        const cohortId = getSessionCohortId(session);
        const expected = cohortId ? studentsByCohort.get(cohortId)?.length ?? 0 : 0;
        const present = attendanceBySession.get(session.id) ?? 0;
        return {
          session,
          cohort: cohortId ? cohortById.get(cohortId) ?? null : null,
          present,
          expected,
          rate: expected > 0 ? Math.round((present / expected) * 100) : 0,
        };
      });

    const cohortAccumulator = new Map<string, { present: number; expected: number }>();
    sessions.forEach((session) => {
      const cohortId = getSessionCohortId(session);
      if (!cohortId) return;
      const current = cohortAccumulator.get(cohortId) ?? { present: 0, expected: 0 };
      current.present += attendanceBySession.get(session.id) ?? 0;
      current.expected += studentsByCohort.get(cohortId)?.length ?? 0;
      cohortAccumulator.set(cohortId, current);
    });

    const bestCohort = Array.from(cohortAccumulator.entries())
      .map<CohortRate | null>(([cohortId, value]) => {
        const cohort = cohortById.get(cohortId);
        if (!cohort || value.expected === 0) return null;
        return {
          cohort,
          present: value.present,
          expected: value.expected,
          rate: Math.round((value.present / value.expected) * 100),
        };
      })
      .filter((item): item is CohortRate => Boolean(item))
      .sort((a, b) => b.rate - a.rate || b.present - a.present)[0] ?? null;

    const sessionsByCohort = new Map<string, number>();
    sessions.forEach((session) => {
      const cohortId = getSessionCohortId(session);
      if (!cohortId) return;
      sessionsByCohort.set(cohortId, (sessionsByCohort.get(cohortId) ?? 0) + 1);
    });

    const absentStudents: StudentAbsenceRow[] = students
      .map((student) => {
        const cohortId = getStudentCohortId(student);
        const expected = cohortId ? sessionsByCohort.get(cohortId) ?? 0 : 0;
        const present = attendanceByStudent.get(student.id) ?? 0;
        return {
          student,
          cohort: cohortId ? cohortById.get(cohortId) ?? null : null,
          expected,
          present,
          absences: Math.max(0, expected - present),
        };
      })
      .filter((row) => row.expected > 0 && row.absences > 0)
      .sort((a, b) => b.absences - a.absences || a.present - b.present)
      .slice(0, 6);

    // v3.0 — Late rate
    const totalLate = attendancesForSessions.filter(
      (a) => a.attendance_status === 'late',
    ).length;
    const lateRate = expectedAttendance > 0 ? Math.round((totalLate / expectedAttendance) * 100) : 0;
    const absenceRate = expectedAttendance > 0 ? Math.round((absences / expectedAttendance) * 100) : 0;

    // v3.0 — Student risk per student: absenceRate based on attendance_status
    const studentRisks: Array<{
      student: Student;
      cohort: Cohort | null;
      expected: number;
      present: number;
      absences: number;
      absenceRate: number;
    }> = students
      .map((student) => {
        const cohortId = getStudentCohortId(student);
        const expected = cohortId ? sessionsByCohort.get(cohortId) ?? 0 : 0;
        const present = attendanceByStudent.get(student.id) ?? 0;
        const abs = Math.max(0, expected - present);
        const rate = expected > 0 ? Math.round((abs / expected) * 100) : 0;
        return {
          student,
          cohort: cohortId ? cohortById.get(cohortId) ?? null : null,
          expected,
          present,
          absences: abs,
          absenceRate: rate,
        };
      })
      .filter((r) => r.expected > 0 && r.absenceRate >= 30)
      .sort((a, b) => b.absenceRate - a.absenceRate);

    return {
      assignedCohorts: cohorts.length,
      assignedStudents: students.length,
      totalSessions: sessions.length,
      activeSessions: sessions.filter((session) => session.status === 'active').length,
      totalAttendances,
      absences,
      attendanceRate,
      absenceRate,
      lateRate,
      totalLate,
      recentSessions,
      bestCohort,
      absentStudents,
      studentRisks,
      weekly: buildLastSevenDays(attendancesForSessions),
    };
  }, [attendances, cohorts, sessions, students]);

  const maxWeekly = Math.max(1, ...stats.weekly.map((point) => point.count));
  const hasData = stats.assignedCohorts > 0 || stats.totalSessions > 0 || stats.totalAttendances > 0;

  if (loading) {
    return (
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="p-12 text-center text-sm font-bold text-indigo-600 dark:text-indigo-300">
          جاري تحميل إحصائياتك...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-3xl border-rose-200 bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/30">
        <CardContent className="flex items-center gap-3 p-6 text-sm font-bold text-rose-700 dark:text-rose-200">
          <Activity className="h-5 w-5" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className="rounded-3xl border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-3xl bg-slate-100 p-5 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <BarChart3 className="h-12 w-12" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">لا توجد إحصائيات بعد</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
              ستظهر الإحصائيات هنا بعد ربط أفواج بك وإنشاء جلسات حضور. لا توجد بيانات وهمية في هذه الصفحة.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="أفواجي" value={formatNumber(stats.assignedCohorts)} icon={Layers} tone="indigo" />
        <StatCard label="طلابي" value={formatNumber(stats.assignedStudents)} icon={Users} tone="sky" />
        <StatCard label="جلساتي" value={formatNumber(stats.totalSessions)} helper={`${formatNumber(stats.activeSessions)} نشطة`} icon={CalendarCheck} tone="emerald" />
        <StatCard label="نسبة الحضور" value={formatRate(stats.attendanceRate)} helper={`${formatNumber(stats.totalAttendances)} حضور`} icon={Percent} tone="amber" />
      </div>

      {/* v3.0 — Session Statistics */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
          <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          إحصائيات الجلسات
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/70 dark:bg-indigo-950/30">
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">إجمالي الجلسات</p>
            <p className="mt-1 text-3xl font-black text-indigo-800 dark:text-indigo-100">{formatNumber(stats.totalSessions)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/70 dark:bg-emerald-950/30">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">نسبة الحضور</p>
            <p className="mt-1 text-3xl font-black text-emerald-800 dark:text-emerald-100">{formatRate(stats.attendanceRate)}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">نسبة الغياب</p>
            <p className="mt-1 text-3xl font-black text-rose-800 dark:text-rose-100">{formatRate(stats.absenceRate ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">نسبة التأخر</p>
            <p className="mt-1 text-3xl font-black text-amber-800 dark:text-amber-100">{formatRate(stats.lateRate ?? 0)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
              الحضور خلال آخر 7 أيام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
              {stats.weekly.map((point) => {
                const height = Math.max(8, (point.count / maxWeekly) * 100);
                return (
                  <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">{formatNumber(point.count)}</span>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-indigo-500 to-cyan-400"
                      style={{ height: `${height}%` }}
                      title={`${point.label}: ${point.count}`}
                    />
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-lg font-black text-slate-900 dark:text-white">أفضل فوج حضوراً</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.bestCohort ? (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/70 dark:bg-emerald-950/30">
                <div>
                  <p className="text-2xl font-black text-emerald-800 dark:text-emerald-100">{stats.bestCohort.cohort.name}</p>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-200">
                    {formatNumber(stats.bestCohort.present)} حضور من أصل {formatNumber(stats.bestCohort.expected)}
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stats.bestCohort.rate}%` }} />
                </div>
                <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
                  {formatRate(stats.bestCohort.rate)}
                </Badge>
              </div>
            ) : (
              <EmptyBlock text="لا يمكن حساب أفضل فوج قبل وجود حضور مسجل." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <Clock className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              آخر الجلسات
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSessions.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <Table>
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead className="min-w-[220px] text-right font-black text-slate-700 dark:text-slate-100">الجلسة</TableHead>
                      <TableHead className="min-w-[120px] text-right font-black text-slate-700 dark:text-slate-100">الفوج</TableHead>
                      <TableHead className="text-center font-black text-slate-700 dark:text-slate-100">الحضور</TableHead>
                      <TableHead className="text-center font-black text-slate-700 dark:text-slate-100">النسبة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentSessions.map((row) => (
                      <TableRow key={row.session.id} className="border-slate-200 dark:border-slate-700">
                        <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                          <div>{row.session.title}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {new Date(getSessionDate(row.session)).toLocaleDateString('ar-DZ')}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-200">{row.cohort?.name ?? '—'}</TableCell>
                        <TableCell className="text-center font-bold text-slate-700 dark:text-slate-200">
                          {formatNumber(row.present)} / {formatNumber(row.expected)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                            {formatRate(row.rate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyBlock text="لا توجد جلسات بعد." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <UserMinus className="h-5 w-5 text-rose-600 dark:text-rose-300" />
              الطلاب الأكثر غياباً
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.absentStudents.length > 0 ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <Table>
                  <TableHeader className="bg-slate-100 dark:bg-slate-800">
                    <TableRow>
                      <TableHead className="min-w-[190px] text-right font-black text-slate-700 dark:text-slate-100">الطالب</TableHead>
                      <TableHead className="min-w-[120px] text-right font-black text-slate-700 dark:text-slate-100">الفوج</TableHead>
                      <TableHead className="text-center font-black text-slate-700 dark:text-slate-100">غيابات</TableHead>
                      <TableHead className="text-center font-black text-slate-700 dark:text-slate-100">حضور</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.absentStudents.map((row) => (
                      <TableRow key={row.student.id} className="border-slate-200 dark:border-slate-700">
                        <TableCell>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{getStudentName(row.student)}</div>
                          <div className="mt-1 text-xs font-mono text-slate-500 dark:text-slate-400">{getStudentNumber(row.student)}</div>
                        </TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-200">{row.cohort?.name ?? '—'}</TableCell>
                        <TableCell className="text-center font-black text-rose-700 dark:text-rose-200">{formatNumber(row.absences)}</TableCell>
                        <TableCell className="text-center font-bold text-slate-700 dark:text-slate-200">
                          {formatNumber(row.present)} / {formatNumber(row.expected)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyBlock text="لا توجد غيابات محسوبة داخل أفواجك حالياً." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* v3.0 — Student Risk Detection */}
      {(stats.studentRisks?.length ?? 0) > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-700">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              Student Risk Detection
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              طلاب بنسبة غياب تتجاوز 30%
            </p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.studentRisks?.slice(0, 10).map((row) => (
              <div key={row.student.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900 dark:text-slate-100">
                    {getStudentName(row.student)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {row.cohort?.name ?? '—'} &bull; {formatNumber(row.absences)} غيابة / {formatNumber(row.expected)} جلسة
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        row.absenceRate >= 50 ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, row.absenceRate)}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-black ${
                      row.absenceRate >= 50
                        ? 'text-rose-600 dark:text-rose-300'
                        : 'text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {formatRate(row.absenceRate)}
                  </span>
                  {row.absenceRate >= 50 ? (
                    <span title="Absences fréquentes" className="text-lg">🚨</span>
                  ) : (
                    <span title="Étudiant à risque" className="text-lg">⚠️</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'indigo' | 'sky' | 'emerald' | 'amber';
}) {
  const tones = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/30 dark:text-indigo-200',
    sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200',
  } satisfies Record<typeof tone, string>;

  return (
    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-black text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950 dark:text-white">{value}</p>
          {helper && <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{helper}</p>}
        </div>
        <div className={`rounded-2xl border p-3 ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
      {text}
    </div>
  );
}
