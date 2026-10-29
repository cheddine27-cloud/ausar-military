import { TrendingUp } from 'lucide-react';
import { Panel } from './MetricPanelWidget';

interface WeeklyAttendanceWidgetProps {
  weekly: { label: string; count: number }[];
  weekMax: number;
}

export default function WeeklyAttendanceWidget({ weekly, weekMax }: WeeklyAttendanceWidgetProps) {
  return (
    <Panel title="الحضور خلال آخر 7 أيام" icon={TrendingUp}>
      <div className="h-44 flex items-end gap-1.5 mt-2">
        {weekly.length === 0 ? (
          <div className="w-full text-center text-xs text-slate-400">لا توجد بيانات</div>
        ) : (
          weekly.map((d, i) => {
            const heightPct = Math.max(8, (d.count / weekMax) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
                <span className="text-[9px] font-bold text-slate-500">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-200 to-indigo-500 transition-all"
                  style={{ height: `${heightPct}%` }}
                  title={`${d.label}: ${d.count}`}
                />
                <span className="text-[10px] font-bold text-slate-400">{d.label}</span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
