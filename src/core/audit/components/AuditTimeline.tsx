import React from 'react';
import type { AuditRecord } from '../AuditTypes';
import {
  Key,
  Calendar,
  UserPlus,
  Trash2,
  Bell,
  RefreshCw,
  Sliders,
  Settings,
  HelpCircle,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AuditTimelineProps {
  logs: AuditRecord[];
  lang?: 'ar' | 'fr';
}

export default function AuditTimeline({ logs, lang = 'ar' }: AuditTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
        <p className="text-sm text-slate-400">
          {lang === 'ar' ? 'لا توجد سجلات مطابقة لخيارات البحث' : 'Aucun journal correspondant'}
        </p>
      </div>
    );
  }

  // Resolve Lucide icons based on action string keywords
  const getIcon = (action: string, result: string) => {
    if (result === 'failure') return <AlertTriangle className="h-4 w-4 text-rose-500" />;

    const lower = action.toLowerCase();
    if (lower.includes('login') || lower.includes('auth')) return <Key className="h-4 w-4 text-indigo-500" />;
    if (lower.includes('attendance') || lower.includes('rollcall')) return <Calendar className="h-4 w-4 text-emerald-500" />;
    if (lower.includes('create') || lower.includes('add') || lower.includes('register'))
      return <UserPlus className="h-4 w-4 text-sky-500" />;
    if (lower.includes('delete') || lower.includes('remove')) return <Trash2 className="h-4 w-4 text-rose-500" />;
    if (lower.includes('notify') || lower.includes('message') || lower.includes('guardian'))
      return <Bell className="h-4 w-4 text-amber-500" />;
    if (lower.includes('workflow') || lower.includes('transition') || lower.includes('approve'))
      return <FileCheck className="h-4 w-4 text-teal-500" />;
    if (lower.includes('permission') || lower.includes('role')) return <ShieldCheck className="h-4 w-4 text-purple-500" />;
    if (lower.includes('update') || lower.includes('modify') || lower.includes('edit'))
      return <RefreshCw className="h-4 w-4 text-blue-500" />;

    return <Info className="h-4 w-4 text-slate-400" />;
  };

  return (
    <div className="relative border-r-2 border-slate-100 pr-6 mr-3 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {logs.map((log) => {
        const isFailure = log.result === 'failure';
        const isWarning = log.result === 'warning';

        return (
          <div key={log.id} className="relative group animate-in fade-in duration-300">
            {/* Timeline dot */}
            <span className={`absolute right-[-33px] top-1.5 flex h-6 w-6 items-center justify-center rounded-xl border bg-white shadow-sm transition-all group-hover:scale-110 ${
              isFailure ? 'border-rose-200 bg-rose-50' : isWarning ? 'border-amber-200 bg-amber-50' : 'border-slate-200'
            }`}>
              {getIcon(log.action, log.result)}
            </span>

            <div className="bg-white hover:bg-slate-50/50 rounded-2xl p-4 border border-slate-100 shadow-sm transition-all text-right flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1 justify-end md:justify-start md:flex-row-reverse">
                  <span className="font-mono text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-DZ' : 'fr-FR')}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {log.module_id}
                  </span>
                  {log.result !== 'success' && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isFailure ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {log.result === 'failure' ? (lang === 'ar' ? 'فشل' : 'Échec') : (lang === 'ar' ? 'تحذير' : 'Avertissement')}
                    </span>
                  )}
                </div>

                <p className="font-bold text-xs text-slate-900 leading-relaxed">
                  {log.remarks || log.action}
                </p>

                <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap justify-end md:justify-start md:flex-row-reverse">
                  <span>
                    <strong>{lang === 'ar' ? 'الفاعل: ' : 'Acteur : '}</strong>
                    {log.actor_name}
                  </span>
                  {log.target_type && (
                    <span>
                      • <strong>{lang === 'ar' ? 'الهدف: ' : 'Cible : '}</strong>
                      {log.target_type} ({log.target_id?.substring(0, 8)})
                    </span>
                  )}
                </div>
              </div>

              {/* IP / Device Placeholder info */}
              <div className="text-[10px] text-slate-400 font-mono text-left self-end md:self-center">
                <p>IP: {log.ip_address || '—'}</p>
                <p>{log.device_info || 'Client App'}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
