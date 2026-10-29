import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  Edit3,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  createInstitutionUnit,
  deleteInstitutionUnit,
  getInstitutionUnits,
  updateInstitutionUnit,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';
import { PERMISSIONS, can, type PermissionMap } from '@/lib/permissions';

interface StructureProps {
  institutionId: string;
  institutionType: 'military';
  permissions?: PermissionMap | null;
}

// Per-sector vocabulary and the type chain we expose. The chain dictates which
// "type" a unit can have given its parent's type — this prevents nonsense
// hierarchies like "specialty inside a specialty".
const SECTOR_CONFIG = {
  university: {
    title: 'الهيكل الأكاديمي',
    chain: ['faculty', 'department', 'specialty', 'group'] as const,
    labels: { faculty: 'كلية', department: 'قسم', specialty: 'تخصص', group: 'فوج' } as const,
  },
  school: {
    title: 'الهيكل المدرسي',
    chain: ['school_year', 'class', 'subject'] as const,
    labels: { school_year: 'سنة دراسية', class: 'قسم', subject: 'مادة' } as const,
  },
  primary_school: {
    title: 'الهيكل المدرسي الابتدائي',
    chain: ['school_year', 'class', 'subject'] as const,
    labels: { school_year: 'سنة دراسية', class: 'فوج', subject: 'مادة' } as const,
  },
  training: {
    title: 'هيكل المركز',
    chain: ['branch', 'specialty', 'course', 'group'] as const,
    labels: { branch: 'فرع', specialty: 'تخصص', course: 'دورة', group: 'مجموعة' } as const,
  },
  company: {
    title: 'الهيكل التنظيمي',
    chain: ['branch', 'department', 'team', 'shift'] as const,
    labels: { branch: 'فرع', department: 'قسم', team: 'فريق', shift: 'مناوبة' } as const,
  },
} as const;

// Tone for each unit type — keeps cards visually distinct.
const TYPE_TONE: Record<string, { bg: string; text: string; ring: string }> = {
  faculty:    { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  department: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  specialty:  { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  group:      { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  school_year:{ bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  class:      { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  subject:    { bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  branch:     { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  course:     { bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200' },
  team:       { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  shift:      { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200' },
};

export default function InstitutionStructure({ institutionId, institutionType, permissions }: StructureProps) {
  const config = SECTOR_CONFIG[institutionType];
  const canManageStructure = can(permissions, PERMISSIONS.structureManage);

  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialog state
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [dialogParent, setDialogParent] = useState<InstitutionUnitRow | null>(null);
  const [dialogUnit, setDialogUnit] = useState<InstitutionUnitRow | null>(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', type: '' });
  const [submitting, setSubmitting] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getInstitutionUnits(institutionId);
      setUnits(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [institutionId]);

  // -------------------------------------------------------------------------
  // Tree assembly
  // -------------------------------------------------------------------------
  // We only render units whose `type` is part of the active sector chain.
  // Anything else is hidden (e.g. a leftover "specialty" in a school view).
  const allowedTypes = useMemo(() => new Set<string>(config.chain), [config]);
  const visibleUnits = useMemo(() => units.filter((u) => allowedTypes.has(u.type)), [units, allowedTypes]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, InstitutionUnitRow[]>();
    visibleUnits.forEach((u) => {
      const key = u.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    });
    map.forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name, 'ar')));
    return map;
  }, [visibleUnits]);

  const roots = childrenByParent.get(null) ?? [];

  const totalsByType = useMemo(() => {
    const t = new Map<string, number>();
    visibleUnits.forEach((u) => t.set(u.type, (t.get(u.type) ?? 0) + 1));
    return t;
  }, [visibleUnits]);

  // -------------------------------------------------------------------------
  // Search filtering: when there is a search term we expand all matching
  // ancestors automatically so results are visible.
  // -------------------------------------------------------------------------
  const matchesSearch = (u: InstitutionUnitRow): boolean => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || (u.code ?? '').toLowerCase().includes(q);
  };

  const idsToShow = useMemo(() => {
    if (!search.trim()) return null;
    const set = new Set<string>();
    const matched = visibleUnits.filter(matchesSearch);
    matched.forEach((u) => {
      set.add(u.id);
      // include ancestors
      let p: string | null = u.parent_id;
      while (p) {
        set.add(p);
        const parent = visibleUnits.find((x) => x.id === p);
        p = parent?.parent_id ?? null;
      }
    });
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, visibleUnits]);

  const isVisible = (u: InstitutionUnitRow) => (idsToShow ? idsToShow.has(u.id) : true);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Type-of-child resolution: the type a new unit gets is one step deeper than
  // its parent in the sector chain.
  // -------------------------------------------------------------------------
  const childTypeOf = (parent: InstitutionUnitRow | null): string | null => {
    if (!parent) return config.chain[0]; // root unit
    const idx = config.chain.indexOf(parent.type as never);
    if (idx < 0 || idx >= config.chain.length - 1) return null; // leaf or unknown
    return config.chain[idx + 1];
  };

  // -------------------------------------------------------------------------
  // Dialog actions
  // -------------------------------------------------------------------------
  const openCreate = (parent: InstitutionUnitRow | null) => {
    if (!canManageStructure) {
      toast.error('ليست لديك صلاحية إدارة الهيكل');
      return;
    }
    const childType = childTypeOf(parent);
    if (!childType) {
      toast.error('لا يمكن إضافة عنصر فرعي تحت هذا النوع');
      return;
    }
    setDialogParent(parent);
    setDialogUnit(null);
    setForm({ name: '', code: '', description: '', type: childType, allowedModes: null });
    setDialogMode('create');
  };

  const openEdit = (unit: InstitutionUnitRow) => {
    if (!canManageStructure) {
      toast.error('ليست لديك صلاحية تعديل الهيكل');
      return;
    }
    setDialogParent(null);
    setDialogUnit(unit);
    setForm({
      name: unit.name,
      code: unit.code ?? '',
      description: unit.description ?? '',
      type: unit.type,
      allowedModes: unit.allowed_modes ?? null,
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setDialogParent(null);
    setDialogUnit(null);
    setForm({ name: '', code: '', description: '', type: '', allowedModes: null });
  };

  const submit = async () => {
    if (!canManageStructure) {
      toast.error('ليست لديك صلاحية إدارة الهيكل');
      return;
    }
    if (!form.name.trim()) {
      toast.error('الاسم مطلوب');
      return;
    }
    setSubmitting(true);
    try {
      if (dialogMode === 'create') {
        const newUnit = await createInstitutionUnit({
          institutionId,
          type: form.type,
          name: form.name,
          code: form.code,
          description: form.description,
          parentId: dialogParent?.id ?? null,
          allowedModes: form.allowedModes,
        });
        toast.success('تم الإنشاء بنجاح');
        if (dialogParent) {
          setExpanded((prev) => new Set(prev).add(dialogParent.id));
        }
        setUnits((prev) => [...prev, newUnit]);
      } else if (dialogMode === 'edit' && dialogUnit) {
        const updated = await updateInstitutionUnit(dialogUnit.id, {
          name: form.name,
          code: form.code,
          description: form.description,
          allowedModes: form.allowedModes,
        });
        setUnits((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        toast.success('تم التحديث بنجاح');
      }
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'تعذر حفظ التغييرات');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (unit: InstitutionUnitRow) => {
    if (!canManageStructure) {
      toast.error('ليست لديك صلاحية حذف عناصر الهيكل');
      return;
    }
    const childCount = (childrenByParent.get(unit.id) ?? []).length;
    const message = childCount > 0
      ? `هذا العنصر يحتوي على ${childCount} عنصر فرعي. الحذف سيُزيلها كلها. هل أنت متأكد؟`
      : 'هل أنت متأكد من حذف هذا العنصر؟';
    if (!confirm(message)) return;

    try {
      await deleteInstitutionUnit(unit.id);
      // Remove the unit and all its descendants locally
      const toRemove = new Set<string>([unit.id]);
      const collect = (parentId: string) => {
        units.forEach((u) => {
          if (u.parent_id === parentId) {
            toRemove.add(u.id);
            collect(u.id);
          }
        });
      };
      collect(unit.id);
      setUnits((prev) => prev.filter((u) => !toRemove.has(u.id)));
      toast.success('تم الحذف بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('تعذر الحذف');
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading && units.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-indigo-500 font-mono text-sm animate-pulse">
        جاري تحميل الهيكل...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + summary row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 rounded-xl">
            <Layers className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{config.title}</h2>
            <p className="text-xs text-slate-500">
              التسلسل: {config.chain.map((t) => (config.labels as Record<string, string>)[t]).join(' ← ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()} className="gap-2 rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
          {canManageStructure && (
            <Button onClick={() => openCreate(null)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4" />
              إضافة {(config.labels as Record<string, string>)[config.chain[0]]}
            </Button>
          )}
        </div>
      </div>

      {/* Type counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.chain.map((type) => (
          <div key={type} className={`rounded-2xl border ${TYPE_TONE[type]?.bg ?? 'bg-slate-50'} border-slate-100 p-3`}>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              {(config.labels as Record<string, string>)[type]}
            </p>
            <p className={`text-2xl font-black mt-0.5 ${TYPE_TONE[type]?.text ?? 'text-slate-900'}`}>
              {(totalsByType.get(type) ?? 0).toLocaleString('ar-DZ')}
            </p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 p-3">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="ابحث بالاسم أو الرمز..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pr-10 rounded-lg bg-slate-50"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 min-h-[280px]">
        {roots.length === 0 ? (
          <EmptyState
            label={`لا توجد ${(config.labels as Record<string, string>)[config.chain[0]]} بعد`}
            actionLabel={`إضافة ${(config.labels as Record<string, string>)[config.chain[0]]}`}
            onAction={() => openCreate(null)}
            canAct={canManageStructure}
          />
        ) : (
          <ul className="space-y-1.5">
            {roots.filter(isVisible).map((root) => (
              <UnitNode
                key={root.id}
                unit={root}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                childrenByParent={childrenByParent}
                isVisible={isVisible}
                labels={config.labels as Record<string, string>}
                canAddChild={!!childTypeOf(root)}
                canManage={canManageStructure}
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              {dialogMode === 'create' ? 'إضافة عنصر جديد' : 'تعديل العنصر'}
            </DialogTitle>
            <DialogDescription className="text-right">
              {dialogMode === 'create' && dialogParent
                ? `سيُضاف تحت "${dialogParent.name}" كـ ${(config.labels as Record<string, string>)[form.type] ?? form.type}`
                : dialogMode === 'create'
                  ? `${(config.labels as Record<string, string>)[form.type] ?? form.type} على المستوى الأعلى`
                  : 'تحديث بيانات العنصر'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>الاسم *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: كلية العلوم"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>الرمز (اختياري)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="مثال: SCI-01"
              />
            </div>
            <div className="space-y-1">
              <Label>الوصف (اختياري)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="وصف مختصر..."
              />
            </div>

            {/* Allowed Attendance Modes for University departments and faculties */}
            {(form.type === 'faculty' || form.type === 'department') && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <Label className="text-xs font-bold text-slate-700">أنماط التحضير المسموحة</Label>
                <p className="text-[10px] text-slate-400">حدد الأنماط المتاحة لهذه الكلية أو القسم. اتركه فارغاً لوراثة إعدادات المؤسسة.</p>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-100 bg-slate-50/50 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={form.allowedModes === null || form.allowedModes.includes('qr')}
                      onChange={(e) => {
                        const current = form.allowedModes ?? ['qr', 'roll_call', 'hybrid'];
                        const next = e.target.checked
                          ? [...current, 'qr']
                          : current.filter((m) => m !== 'qr');
                        setForm((f) => ({ ...f, allowedModes: next.length === 3 ? null : next }));
                      }}
                      className="h-3.5 w-3.5 text-indigo-600 rounded"
                    />
                    <span>QR Code</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-100 bg-slate-50/50 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={form.allowedModes === null || form.allowedModes.includes('roll_call')}
                      onChange={(e) => {
                        const current = form.allowedModes ?? ['qr', 'roll_call', 'hybrid'];
                        const next = e.target.checked
                          ? [...current, 'roll_call']
                          : current.filter((m) => m !== 'roll_call');
                        setForm((f) => ({ ...f, allowedModes: next.length === 3 ? null : next }));
                      }}
                      className="h-3.5 w-3.5 text-indigo-600 rounded"
                    />
                    <span>مناداة</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-100 bg-slate-50/50 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={form.allowedModes === null || form.allowedModes.includes('hybrid')}
                      onChange={(e) => {
                        const current = form.allowedModes ?? ['qr', 'roll_call', 'hybrid'];
                        const next = e.target.checked
                          ? [...current, 'hybrid']
                          : current.filter((m) => m !== 'hybrid');
                        setForm((f) => ({ ...f, allowedModes: next.length === 3 ? null : next }));
                      }}
                      className="h-3.5 w-3.5 text-indigo-600 rounded"
                    />
                    <span>هجين</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>إلغاء</Button>
            <Button onClick={() => void submit()} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
              {submitting ? 'جاري الحفظ...' : dialogMode === 'create' ? 'إنشاء' : 'حفظ'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Tree node
// =============================================================================

interface UnitNodeProps {
  unit: InstitutionUnitRow;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  childrenByParent: Map<string | null, InstitutionUnitRow[]>;
  isVisible: (u: InstitutionUnitRow) => boolean;
  labels: Record<string, string>;
  canAddChild: boolean;
  canManage: boolean;
  onAddChild: (parent: InstitutionUnitRow) => void;
  onEdit: (unit: InstitutionUnitRow) => void;
  onDelete: (unit: InstitutionUnitRow) => void;
}

function UnitNode(props: UnitNodeProps) {
  const { unit, depth, expanded, onToggle, childrenByParent, isVisible, labels, canAddChild, canManage, onAddChild, onEdit, onDelete } = props;
  const children = (childrenByParent.get(unit.id) ?? []).filter(isVisible);
  const isOpen = expanded.has(unit.id);
  const hasChildren = children.length > 0;
  const tone = TYPE_TONE[unit.type] ?? { bg: 'bg-slate-50', text: 'text-slate-700', ring: 'ring-slate-200' };

  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
        style={{ marginInlineStart: depth * 18 }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(unit.id)}
          className={`h-6 w-6 flex items-center justify-center rounded-md ${
            hasChildren ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-200'
          }`}
          aria-label={isOpen ? 'طي' : 'توسيع'}
          disabled={!hasChildren}
        >
          {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />) : <span className="h-2 w-2 rounded-full bg-slate-200" />}
        </button>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tone.bg} ${tone.text}`}>
          {labels[unit.type] ?? unit.type}
        </span>

        <span className="text-sm font-bold text-slate-800 truncate flex-1">{unit.name}</span>

        {unit.code && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
            {unit.code}
          </span>
        )}

        {hasChildren && (
          <span className="text-[10px] font-bold text-slate-400">
            {children.length} فرعي
          </span>
        )}

        {canManage && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {canAddChild && (
            <button
              type="button"
              onClick={() => onAddChild(unit)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
              title="إضافة فرع"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(unit)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-indigo-600 hover:bg-indigo-50"
            title="تعديل"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(unit)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-rose-600 hover:bg-rose-50"
            title="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          </div>
        )}
      </div>

      {isOpen && hasChildren && (
        <ul className="space-y-1 mt-1">
          {children.map((c) => (
            <UnitNode
              key={c.id}
              unit={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              childrenByParent={childrenByParent}
              isVisible={isVisible}
              labels={labels}
              canAddChild={canAddChild && !!props.canAddChild}
              canManage={canManage}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function EmptyState({ label, actionLabel, onAction, canAct }: { label: string; actionLabel: string; onAction: () => void; canAct: boolean }) {
  return (
    <div className="py-12 text-center">
      <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-bold text-slate-500">{label}</p>
      {canAct && (
        <Button onClick={onAction} className="mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
