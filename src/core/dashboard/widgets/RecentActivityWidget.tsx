import { Clock } from 'lucide-react';
import { Panel } from './MetricPanelWidget';
import type { InstitutionRecentActivity } from '@/lib/institutionAdminApi';

interface RecentActivityWidgetProps {
  recentActivity: InstitutionRecentActivity[];
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'غير متوفر';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(iso).toLocaleDateString('ar-DZ');
}

export default function RecentActivityWidget({ recentActivity }: RecentActivityWidgetProps) {
  return (
    <Panel title="النشاط الأخير" icon={Clock}>
      {recentActivity.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">لا يوجد نشاط مسجّل</p>
      ) : (
        <ul className="space-y-2 mt-2">
          {recentActivity.map((a) => (
            <li key={a.id} className="flex items-start gap-2 rounded-xl border border-slate-100 px-3 py-2">
              <div
                className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                  a.priority === 'high'
                    ? 'bg-rose-500'
                    : a.priority === 'medium'
                      ? 'bg-amber-500'
                      : a.outcomeStatus === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-slate-300'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-800 truncate">{a.title}</p>
                {a.description && <p className="text-[10px] text-slate-500 truncate">{a.description}</p>}
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {formatRelativeTime(a.createdAt)}
                  {a.actorName ? ` • ${a.actorName}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
export { formatRelativeTime };
