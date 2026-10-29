// =============================================================================
// Phase 5 — Scope Picker
// =============================================================================
// A radio-tree picker that lets the institution manager bind a user
// (faculty_admin / department_admin / staff / viewer) to either:
//   - the entire institution (NULL unit_id), or
//   - a specific institution_unit (and implicitly its descendants via
//     private.user_can_view_unit)
//
// This is a presentational component: it receives the units list and the
// current selection, and emits the chosen unit_id (or null = institution).
// =============================================================================

import { useMemo, useState } from 'react';
import { Building2, Layers, BookOpen, Users, Check, Search, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { InstitutionUnitRow } from '@/lib/institutionAdminApi';

interface Props {
  units: InstitutionUnitRow[];
  /** Currently selected unit_id, or null = institution-wide */
  value: string | null;
  /** Whether "institution-wide" is allowed (some roles may want to forbid it) */
  allowInstitutionWide?: boolean;
  onChange: (unitId: string | null) => void;
  institutionName?: string;
}

// Pretty labels per unit type
const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  faculty:     { label: 'كلية',      icon: Building2, tone: 'text-indigo-600' },
  department:  { label: 'قسم',       icon: Layers,    tone: 'text-cyan-600' },
  specialty:   { label: 'تخصص',      icon: BookOpen,  tone: 'text-emerald-600' },
  group:       { label: 'فوج',       icon: Users,     tone: 'text-purple-600' },
  school_year: { label: 'سنة دراسية', icon: Layers,   tone: 'text-amber-600' },
  class:       { label: 'صف',        icon: Users,     tone: 'text-amber-600' },
  subject:     { label: 'مادة',      icon: BookOpen,  tone: 'text-rose-600' },
  branch:      { label: 'فرع',       icon: Layers,    tone: 'text-cyan-600' },
  course:      { label: 'دورة',      icon: BookOpen,  tone: 'text-emerald-600' },
  team:        { label: 'فريق',      icon: Users,     tone: 'text-indigo-600' },
  shift:       { label: 'وردية',     icon: Users,     tone: 'text-amber-600' },
};

interface UnitNode extends InstitutionUnitRow {
  depth: number;
}

/** Flatten the tree depth-first so we can render with indentation. */
function flattenTree(units: InstitutionUnitRow[]): UnitNode[] {
  const childrenByParent = new Map<string | null, InstitutionUnitRow[]>();
  units.forEach((u) => {
    const key = u.parent_id ?? null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(u);
  });

  const result: UnitNode[] = [];
  const visit = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? [];
    // Sort siblings alphabetically by name for stability
    [...children]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((u) => {
        result.push({ ...u, depth });
        visit(u.id, depth + 1);
      });
  };
  visit(null, 0);
  return result;
}

export default function ScopePicker({
  units,
  value,
  allowInstitutionWide = true,
  onChange,
  institutionName,
}: Props) {
  const [search, setSearch] = useState('');

  const flat = useMemo(() => flattenTree(units), [units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((u) => u.name.toLowerCase().includes(q) || (u.code ?? '').toLowerCase().includes(q));
  }, [flat, search]);

  return (
    <div className="space-y-2">
      {/* Search */}
      {units.length > 6 && (
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ابحث في الكليات والأقسام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 h-9 rounded-lg"
          />
        </div>
      )}

      <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto p-1.5 space-y-0.5">
        {/* Institution-wide option */}
        {allowInstitutionWide && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right transition-all ${
              value === null
                ? 'bg-purple-50 border border-purple-300 shadow-sm'
                : 'hover:bg-slate-50 border border-transparent'
            }`}
          >
            <div
              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === null ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
              }`}
            >
              {value === null && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>
            <Globe className="h-4 w-4 text-purple-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900">المؤسسة كاملة</p>
              <p className="text-[10px] text-slate-500 truncate">
                يرى ويدير جميع كليات وأقسام {institutionName ?? 'المؤسسة'}
              </p>
            </div>
          </button>
        )}

        {/* Tree of units */}
        {filtered.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-6">
            {units.length === 0
              ? 'لا توجد كليات أو أقسام بعد. أنشئ الهيكل أولاً من تبويب "الهيكل".'
              : 'لا نتائج مطابقة'}
          </p>
        )}

        {filtered.map((u) => {
          const meta = TYPE_META[u.type] ?? { label: u.type, icon: Layers, tone: 'text-slate-600' };
          const Icon = meta.icon;
          const selected = value === u.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onChange(u.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right transition-all ${
                selected
                  ? 'bg-indigo-50 border border-indigo-300 shadow-sm'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
              style={{ paddingInlineStart: `${0.75 + u.depth * 1.25}rem` }}
            >
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                }`}
              >
                {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>
              <Icon className={`h-3.5 w-3.5 ${meta.tone}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {meta.label}{u.code ? ` • ${u.code}` : ''}
                </p>
              </div>
              {selected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
