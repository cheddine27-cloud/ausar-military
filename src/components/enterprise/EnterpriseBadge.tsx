import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface EnterpriseBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export const EnterpriseBadge = React.memo(function EnterpriseBadge({
  label,
  variant = 'default',
  className = '',
}: EnterpriseBadgeProps) {
  const getStyles = (v: BadgeVariant) => {
    switch (v) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border border-amber-100';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border border-rose-100';
      case 'info':
        return 'bg-sky-50 text-sky-700 border border-sky-100';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-100';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all ${getStyles(variant)} ${className}`}>
      {label}
    </span>
  );
});
