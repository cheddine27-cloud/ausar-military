import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AutomationsExecutedWidget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const { count: c } = await supabase
        .from('automation_history')
        .select('*', { count: 'exact', head: true });
      if (c !== null) setCount(c);
    }
    void loadCount();
  }, []);

  return (
    <Card className="border-none shadow-sm text-right" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">قواعد أتمتة تم تشغيلها</CardTitle>
        <Cpu className="h-4 w-4 text-emerald-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-slate-900">{count} مؤتمتة</div>
        <p className="text-[10px] text-slate-500 mt-1">تنبيهات وإجراءات تمت برمجياً بالكامل</p>
      </CardContent>
    </Card>
  );
}
