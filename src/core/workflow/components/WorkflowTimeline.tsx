import { useEffect, useState } from 'react';
import { WorkflowService } from '../WorkflowService';
import type { WorkflowEvent } from '../WorkflowTypes';
import { CheckCircle2, Clock, Activity, ArrowRightLeft, MessageSquare } from 'lucide-react';

interface WorkflowTimelineProps {
  entityType: string;
  entityId: string;
  lang?: 'ar' | 'fr';
}

export default function WorkflowTimeline({ entityType, entityId, lang = 'ar' }: WorkflowTimelineProps) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      try {
        const data = await WorkflowService.getTimelineEvents(entityType, entityId);
        setEvents(data);
      } catch (err) {
        console.error('Failed to load workflow timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadTimeline();
  }, [entityType, entityId]);

  if (loading) {
    return <p className="text-xs text-slate-400 py-4 text-center">جاري تحميل سجل مسار العمل...</p>;
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <p className="text-xs text-slate-400">لا يوجد سجل لمسار العمل حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <p className="font-bold text-xs text-slate-400 mb-3 flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5" />
        {lang === 'ar' ? 'سجل العمل والمراحل الزمنية:' : 'Historique des étapes :'}
      </p>

      <div className="relative border-r-2 border-slate-100 pr-4 mr-2 space-y-5">
        {events.map((event, idx) => {
          const isInitial = event.action === 'initialize';
          const isLast = idx === events.length - 1;

          return (
            <div key={event.id} className="relative group">
              {/* Vertical line connector marker */}
              <span className={`absolute right-[-23px] top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-white ${
                isLast ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-300'
              }`}>
                {isInitial ? (
                  <Clock className="h-2 w-2 text-slate-400" />
                ) : (
                  <CheckCircle2 className={`h-2.5 w-2.5 ${isLast ? 'text-indigo-600' : 'text-slate-500'}`} />
                )}
              </span>

              <div className="bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 border border-slate-100 transition-all text-right">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(event.created_at).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-FR', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
                    {event.actor_name || (lang === 'ar' ? 'نظام تلقائي' : 'Système')}
                  </span>
                </div>

                <div className="text-xs text-slate-600 font-medium">
                  {event.notes || event.action}
                </div>

                {event.from_state !== 'none' && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400 bg-white border border-slate-100 rounded px-1.5 py-0.5 w-max">
                    <span>{event.from_state}</span>
                    <ArrowRightLeft className="h-2.5 w-2.5" />
                    <span className="font-bold text-slate-600">{event.to_state}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
