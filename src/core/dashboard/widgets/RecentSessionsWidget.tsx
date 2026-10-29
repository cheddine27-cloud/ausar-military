import { CalendarCheck } from 'lucide-react';
import { Panel } from './MetricPanelWidget';
import type { InstitutionRecentSession } from '@/lib/institutionAdminApi';

interface RecentSessionsWidgetProps {
  recentSessions: InstitutionRecentSession[];
}

export default function RecentSessionsWidget({ recentSessions }: RecentSessionsWidgetProps) {
  return (
    <Panel title="آخر الحصص" icon={CalendarCheck}>
      {recentSessions.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">لا توجد حصص حتى الآن</p>
      ) : (
        <ul className="space-y-2 mt-2">
          {recentSessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {s.cohortName ?? '—'} • {s.professorName ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    s.attendanceRate >= 80
                      ? 'bg-emerald-100 text-emerald-700'
                      : s.attendanceRate >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {s.attendanceRate}%
                </span>
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    s.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.status === 'active' ? 'نشطة' : 'مغلقة'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
