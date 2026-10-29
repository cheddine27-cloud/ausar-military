import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileClock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PendingWorkflowsWidgetProps {
  overview?: unknown;
}

export function PendingWorkflowsWidget({ overview }: PendingWorkflowsWidgetProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadCount() {
      const { count: c } = await supabase
        .from('workflow_instances')
        .select('*', { count: 'exact', head: true })
        .not('current_state', 'in', '("closed","completed","approved")');
      if (c !== null) setCount(c);
    }
    void loadCount();
  }, []);

  return (
    <Card className="border-none shadow-sm text-right" dir="rtl">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-bold text-slate-400">إجراءات معلقة بمسار العمل</CardTitle>
        <FileClock className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-black ${count > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{count} مهام</div>
        <p className="text-[10px] text-slate-500 mt-1">بانتظار المراجعة والاعتماد والموافقة</p>
      </CardContent>
    </Card>
  );
}
