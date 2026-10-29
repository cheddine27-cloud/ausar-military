import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function FailedNotificationsWidget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const { count: c } = await supabase
        .from('communication_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');
      if (c !== null) setCount(c);
    }
    void loadCount();
  }, []);

  return (
    <Card className="border-none shadow-sm text-right" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">إشعارات فشل إرسالها</CardTitle>
        <AlertCircle className="h-4 w-4 text-rose-500" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black ${count > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{count} رسائل</div>
        <p className="text-[10px] text-slate-500 mt-1">تنبيهات لم تصل للأولياء بسبب مشاكل الاتصال</p>
      </CardContent>
    </Card>
  );
}
