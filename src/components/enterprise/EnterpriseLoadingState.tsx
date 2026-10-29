import React from 'react';
import { Loader2 } from 'lucide-react';

interface EnterpriseLoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton';
  className?: string;
}

export const EnterpriseLoadingState = React.memo(function EnterpriseLoadingState({
  message = 'جاري التحميل...',
  variant = 'spinner',
  className = '',
}: EnterpriseLoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={`space-y-3 animate-pulse w-full ${className}`}>
        <div className="h-4 bg-slate-100 rounded-md w-3/4"></div>
        <div className="h-3 bg-slate-100 rounded-md w-full"></div>
        <div className="h-3 bg-slate-100 rounded-md w-5/6"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 space-y-3 ${className}`}>
      <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      <p className="text-xs text-slate-500 font-mono">{message}</p>
    </div>
  );
});
