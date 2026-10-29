import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getInstitutionOverview,
  getInstitutionRecentSessions,
  getInstitutionRecentActivity,
  getInstitutionWeeklyAttendance,
  type InstitutionOverview,
  type InstitutionRecentSession,
  type InstitutionRecentActivity,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';
import { getActiveModule } from '@/config/modules';

// Core widget imports
import KpiStripWidget, { formatNumber } from './widgets/KpiStripWidget';
import MetricPanelWidget from './widgets/MetricPanelWidget';
import WeeklyAttendanceWidget from './widgets/WeeklyAttendanceWidget';
import RecentSessionsWidget from './widgets/RecentSessionsWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import WorkflowDashboardCards from '@/core/workflow/components/WorkflowDashboardCards';

interface DashboardProps {
  institutionId: string;
  institutionType: 'military';
  institutionName: string;
  permissions?: PermissionMap | null;
}

function attendanceRateForToday(overview: InstitutionOverview | null): number {
  if (!overview) return 0;
  const expected = overview.studentsCount * Math.max(overview.sessionsToday, 1);
  if (expected <= 0 || overview.sessionsToday === 0) return 0;
  return Math.min(100, Math.round((overview.attendancesToday / expected) * 100));
}

export default function Dashboard({ institutionId, institutionType, institutionName, permissions }: DashboardProps) {
  const [overview, setOverview] = useState<InstitutionOverview | null>(null);
  const [recentSessions, setRecentSessions] = useState<InstitutionRecentSession[]>([]);
  const [recentActivity, setRecentActivity] = useState<InstitutionRecentActivity[]>([]);
  const [weekly, setWeekly] = useState<{ label: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const activeModule = getActiveModule();
  const labels = activeModule.config.dictionary;
  const canViewSubscriptionSummary = can(permissions, PERMISSIONS.subscriptionManage);

  const refreshAll = async () => {
    const isFirst = !overview;
    if (isFirst) setLoading(true);
    else setRefreshing(true);
    try {
      const [ov, sessions, activity, week] = await Promise.all([
        getInstitutionOverview(institutionId),
        getInstitutionRecentSessions(institutionId, 5),
        getInstitutionRecentActivity(institutionId, 6),
        getInstitutionWeeklyAttendance(institutionId),
      ]);
      setOverview(ov);
      setRecentSessions(sessions);
      setRecentActivity(activity);
      setWeekly(week);
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    const interval = setInterval(() => void refreshAll(), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  const todayRate = useMemo(() => attendanceRateForToday(overview), [overview]);
  const weekMax = useMemo(() => Math.max(1, ...weekly.map((w) => w.count)), [weekly]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-indigo-500 font-mono text-sm animate-pulse">
        جاري تحميل لوحة التحكم...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header strip with refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-slate-500">
            آخر تحديث: {lastRefreshed.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })} •
            تحديث تلقائي كل 30 ثانية
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshAll()}
          disabled={refreshing}
          className="gap-2 rounded-lg"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث الآن
        </Button>
      </div>

      {/* Dynamic Workflow Dashboard KPI Cards */}
      <WorkflowDashboardCards institutionId={institutionId} moduleId={activeModule.id} />

      {/* 1. Core KPIs Widget */}
      <KpiStripWidget overview={overview} labels={labels} todayRate={todayRate} />

      {/* 2. Custom/Module-Specific Widgets Row */}
      {activeModule.widgets.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeModule.widgets.map((widget) => {
            const WidgetComponent = widget.component;
            return <WidgetComponent key={widget.id} overview={overview} />;
          })}
        </section>
      )}

      {/* 3. Core Metric Panels */}
      <MetricPanelWidget overview={overview} labels={labels} />

      {/* 4. Weekly charts and lists */}
      <section className="grid gap-4 lg:grid-cols-3">
        <WeeklyAttendanceWidget weekly={weekly} weekMax={weekMax} />
        <RecentSessionsWidget recentSessions={recentSessions} />
        <RecentActivityWidget recentActivity={recentActivity} />
      </section>

      {/* Subscription footer */}
      {canViewSubscriptionSummary && overview?.subscription && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">باقة المؤسسة</p>
            <p className="text-xl font-black mt-1">{overview.subscription.planName ?? 'غير محدد'}</p>
            <p className="text-xs text-slate-400 mt-1">
              {institutionName} • {overview.subscription.status === 'active' ? 'نشطة' : overview.subscription.status ?? '—'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[9px] text-slate-400 font-bold uppercase">حد الطلاب</p>
              <p className="text-sm font-black mt-0.5">
                {overview.subscription.studentLimit !== null ? formatNumber(overview.subscription.studentLimit) : '—'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[9px] text-slate-400 font-bold uppercase">حد الحصص</p>
              <p className="text-sm font-black mt-0.5">
                {overview.subscription.sessionLimit !== null ? formatNumber(overview.subscription.sessionLimit) : '—'}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2">
              <p className="text-[9px] text-slate-400 font-bold uppercase">تنتهي في</p>
              <p className="text-sm font-black mt-0.5">
                {overview.subscription.endDate
                  ? new Date(overview.subscription.endDate).toLocaleDateString('ar-DZ')
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export type { DashboardProps };
