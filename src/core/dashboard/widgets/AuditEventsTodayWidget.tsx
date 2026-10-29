import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AuditEventsTodayWidget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const today = new Date().toISOString().split('T')[0];
      const { count: c } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00Z`);
      if (c !== null) setCount(c);
    }
    void loadCount();
  }, []);

  return (
    <Card className="border-none shadow-sm text-right" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">سجلات الأمان والعمليات اليوم</CardTitle>
        <ShieldAlert className="h-4 w-4 text-sky-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-slate-900">{count} عمليات</div>
        <p className="text-[10px] text-slate-500 mt-1">سجل المراقبة والتدقيق الفوري للأمان</p>
      </CardContent>
    </Card>
  );
}
