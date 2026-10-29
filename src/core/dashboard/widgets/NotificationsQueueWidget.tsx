import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function NotificationsQueueWidget() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const { count: c } = await supabase
        .from('communication_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (c !== null) setCount(c);
    }
    void loadCount();
  }, []);

  return (
    <Card className="border-none shadow-sm text-right" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">إشعارات في طابور الإرسال</CardTitle>
        <Send className="h-4 w-4 text-indigo-500" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black ${count > 0 ? 'text-indigo-600 animate-pulse' : 'text-slate-900'}`}>{count} رسائل</div>
        <p className="text-[10px] text-slate-500 mt-1">تنبيهات معلقة جاري معالجتها تلقائياً</p>
      </CardContent>
    </Card>
  );
}
