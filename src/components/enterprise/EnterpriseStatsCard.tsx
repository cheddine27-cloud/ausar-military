import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';

interface EnterpriseStatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  iconColorClass?: string;
  valueColorClass?: string;
  className?: string;
}

export const EnterpriseStatsCard = React.memo(function EnterpriseStatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconColorClass = 'text-indigo-500',
  valueColorClass = 'text-slate-900',
  className = '',
}: EnterpriseStatsCardProps) {
  return (
    <Card className={`border-none shadow-sm text-right ${className}`} dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColorClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black ${valueColorClass}`}>{value}</div>
        {description && <p className="text-[10px] text-slate-500 mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
});
