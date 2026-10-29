import React from 'react';
import { type LucideIcon } from 'lucide-react';

interface EnterpriseEmptyStateProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  actionButton?: React.ReactNode;
  className?: string;
}

export const EnterpriseEmptyState = React.memo(function EnterpriseEmptyState({
  title,
  description,
  icon: Icon,
  actionButton,
  className = '',
}: EnterpriseEmptyStateProps) {
  return (
    <div className={`text-center py-12 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center justify-center space-y-4 p-6 ${className}`}>
      <div className="bg-slate-50 p-4 rounded-full">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {description && <p className="text-xs text-slate-400 max-w-sm leading-relaxed">{description}</p>}
      </div>
      {actionButton && <div className="pt-2">{actionButton}</div>}
    </div>
  );
});
