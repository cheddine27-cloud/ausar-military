import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowRegistry } from '../WorkflowRegistry';
import * as LucideIcons from 'lucide-react';

interface WorkflowDashboardCardsProps {
  institutionId: string;
  moduleId: string;
  lang?: 'ar' | 'fr';
}

export default function WorkflowDashboardCards({ institutionId, moduleId, lang = 'ar' }: WorkflowDashboardCardsProps) {
  const [cardCounts, setCardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const cards = WorkflowRegistry.getDashboardCards(moduleId);

  useEffect(() => {
    async function loadCounts() {
      if (cards.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const counts: Record<string, number> = {};
      try {
        await Promise.all(
          cards.map(async (card) => {
            try {
              const val = await card.countQuery(institutionId);
              counts[card.id] = val;
            } catch (err) {
              console.error(`Failed to execute count query for card ${card.id}:`, err);
              counts[card.id] = 0;
            }
          })
        );
        setCardCounts(counts);
      } catch (err) {
        console.error('Failed to load workflow card counts:', err);
      } finally {
        setLoading(false);
      }
    }
    void loadCounts();
  }, [institutionId, moduleId]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {Array.from({ length: Math.max(1, cards.length) }).map((_, idx) => (
          <Card key={idx} className="border-none shadow-sm bg-slate-50/50 h-24" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {cards.map((card) => {
        // Dynamically resolve icon component
        const IconComponent = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[card.icon] || LucideIcons.Activity;
        const count = cardCounts[card.id] ?? 0;

        // Dynamic Tailwind color styling based on the color string
        const colorClasses: Record<string, { text: string; bg: string; border: string; accentText: string }> = {
          amber: { text: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100', accentText: 'text-amber-600' },
          indigo: { text: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100', accentText: 'text-indigo-600' },
          emerald: { text: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100', accentText: 'text-emerald-600' },
          rose: { text: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100', accentText: 'text-rose-600' },
        };

        const themeColors = colorClasses[card.color] || colorClasses.indigo;

        return (
          <Card key={card.id} className="border-none shadow-sm transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-slate-400">
                {lang === 'ar' ? card.label_ar : card.label_fr}
              </CardTitle>
              <span className={`p-1.5 rounded-lg ${themeColors.bg} ${themeColors.text}`}>
                <IconComponent className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-black ${count > 0 ? themeColors.accentText : 'text-slate-900'}`}>
                {count}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {lang === 'ar' ? 'متابعة مسار العمل المحدث تلقائياً' : 'Suivi du flux mis à jour en temps réel'}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
