// =============================================================================
// Phase 6 — Teacher Assignments Dialog
// =============================================================================
// A dialog that lets institution managers control which cohorts a given
// teacher can see. Backed by `teacher_assignments`. Two-pane layout:
//   - Left: searchable cohort list with checkboxes (default scope)
//   - Right: existing assignments (including subject-level ones with unit_id)
//
// The dialog reads/writes via institutionAdminApi:
//   getTeacherAssignments / replaceTeacherAssignments /
//   createTeacherAssignment / deleteTeacherAssignment
//
// RLS guarantees: only the calling institution's rows are visible/writable.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Search, Check, X, Save, Trash2, Layers, BookOpen, Users, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getTeacherAssignments,
  replaceTeacherAssignments,
  createTeacherAssignment,
  deleteTeacherAssignment,
  getInstitutionCohorts,
  getInstitutionUnits,
  type TeacherAssignmentRow,
  type InstitutionUnitRow,
} from '@/lib/institutionAdminApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
  institutionId: string;
  /** Called whenever assignments change so the parent can refresh counters. */
  onSaved?: () => void;
}

type CohortOption = { id: string; name: string; level: string | null };

// Subject-level unit types we surface in the optional "narrow to subject" picker
const SUBJECT_LIKE_TYPES = new Set(['subject', 'course', 'class']);

export default function TeacherAssignmentsDialog({
  open,
  onOpenChange,
  teacherId,
  teacherName,
  institutionId,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [units, setUnits] = useState<InstitutionUnitRow[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignmentRow[]>([]);

  // Local state for the cohort checkbox grid
  const [selectedCohortIds, setSelectedCohortIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // State for adding a subject-level assignment
  const [subjectCohortId, setSubjectCohortId] = useState('');
  const [subjectUnitId, setSubjectUnitId] = useState('');
  const [subjectAdding, setSubjectAdding] = useState(false);

  // Load everything when the dialog opens or teacher changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [cohortsData, unitsData, assignmentsData] = await Promise.all([
        getInstitutionCohorts(institutionId),
        getInstitutionUnits(institutionId),
        getTeacherAssignments(teacherId, institutionId),
      ]);
      if (cancelled) return;
      setCohorts(cohortsData);
      setUnits(unitsData);
      setAssignments(assignmentsData);
      // Default scope = assignments without unit_id (cohort-only)
      setSelectedCohortIds(
        new Set(
          assignmentsData
            .filter((a) => a.unit_id === null)
            .map((a) => a.cohort_id),
        ),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, teacherId, institutionId]);

  // Derived: subject-level assignments only (those with unit_id)
  const subjectAssignments = useMemo(
    () => assignments.filter((a) => a.unit_id !== null),
    [assignments],
  );

  // Derived: filtered cohorts for the search
  const filteredCohorts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cohorts;
    return cohorts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.level ?? '').toLowerCase().includes(q),
    );
  }, [cohorts, search]);

  // Subject-like units to surface in the "narrow by subject" select
  const subjectLikeUnits = useMemo(
    () => units.filter((u) => SUBJECT_LIKE_TYPES.has(u.type)),
    [units],
  );

  const toggleCohort = (cohortId: string) => {
    setSelectedCohortIds((prev) => {
      const next = new Set(prev);
      if (next.has(cohortId)) {
        next.delete(cohortId);
      } else {
        next.add(cohortId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCohortIds(new Set(filteredCohorts.map((c) => c.id)));
  };

  const clearAll = () => {
    setSelectedCohortIds(new Set());
  };

  const handleSaveDefaultScope = async () => {
    setSaving(true);
    try {
      const result = await replaceTeacherAssignments({
        teacherId,
        cohortIds: Array.from(selectedCohortIds),
        institutionId,
      });
      const summary = [
        result.added > 0 ? `${result.added} مضاف` : null,
        result.removed > 0 ? `${result.removed} محذوف` : null,
        result.kept > 0 ? `${result.kept} ثابت` : null,
      ]
        .filter(Boolean)
        .join(' • ');
      toast.success(summary ? `تم حفظ التعيينات (${summary})` : 'لا تغييرات');
      // Reload assignments
      const fresh = await getTeacherAssignments(teacherId, institutionId);
      setAssignments(fresh);
      onSaved?.();
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('duplicate') || msg.includes('unique') || err?.status === 409) {
        toast.error('هذا التعيين للأستاذ (أو جزء منه) موجود بالفعل في النظام.');
      } else {
        toast.error(err instanceof Error ? err.message : 'تعذر حفظ التعيينات');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubject = async () => {
    if (!subjectCohortId || !subjectUnitId) {
      toast.error('اختر الفوج والمادة');
      return;
    }
    setSubjectAdding(true);
    try {
      await createTeacherAssignment({
        teacherId,
        cohortId: subjectCohortId,
        unitId: subjectUnitId,
        institutionId,
      });
      toast.success('تم إضافة تعيين على مستوى المادة');
      const fresh = await getTeacherAssignments(teacherId, institutionId);
      setAssignments(fresh);
      setSubjectCohortId('');
      setSubjectUnitId('');
      onSaved?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر الإضافة';
      // Friendly message for the unique constraint
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('هذا التعيين موجود مسبقاً');
      } else {
        toast.error(msg);
      }
    } finally {
      setSubjectAdding(false);
    }
  };

  const handleDeleteSubject = async (assignmentId: string) => {
    const ok = await deleteTeacherAssignment(assignmentId);
    if (ok) {
      toast.success('تم حذف التعيين');
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      onSaved?.();
    } else {
      toast.error('تعذر الحذف');
    }
  };

  const totalSelected = selectedCohortIds.size;
  const totalAvailable = cohorts.length;
  const noCohorts = totalAvailable === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            تعيينات الأستاذ
          </DialogTitle>
          <DialogDescription>
            اختر الأفواج التي يستطيع هذا الأستاذ <strong>{teacherName}</strong> إدارتها ومتابعة حضورها.
            الأستاذ بدون أي تعيين لن تظهر له الأفواج حتى يتم ربطه بفوج.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">جاري التحميل...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Empty state */}
            {noCohorts && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  لا توجد أفواج بعد في مؤسستك. أنشئ أفواجاً أولاً من تبويب "الهيكل" قبل تعيين الأساتذة.
                </div>
              </div>
            )}

            {/* Section 1: default cohort scope */}
            {!noCohorts && (
              <section className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      الأفواج المسندة (نطاق افتراضي)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      الأستاذ سيرى كل الأفواج المؤشّرة هنا، ويستطيع فتح جلسات لها.
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {totalSelected} / {totalAvailable}
                  </Badge>
                </div>

                {/* Search + bulk actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="ابحث في الأفواج..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pr-10 h-9 rounded-lg"
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={selectAll} className="gap-1">
                    <Check className="h-3.5 w-3.5" /> الكل
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAll} className="gap-1">
                    <X className="h-3.5 w-3.5" /> لا شيء
                  </Button>
                </div>

                {/* Cohort grid */}
                <div className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto p-1.5">
                  {filteredCohorts.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6">لا نتائج</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {filteredCohorts.map((c) => {
                        const isSelected = selectedCohortIds.has(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCohort(c.id)}
                            className={`text-right flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                              {c.level && (
                                <p className="text-[10px] text-slate-500">{c.level}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Section 2: subject-level assignments (cohort + unit) */}
            {subjectLikeUnits.length > 0 && (
              <section className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-cyan-600" />
                    تعيينات على مستوى المادة (اختياري)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    لإسناد أستاذ لمادة واحدة فقط داخل فوج معيّن (مفيد للجامعات والمدارس).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px] text-slate-500">الفوج</Label>
                    <Select value={subjectCohortId} onValueChange={setSubjectCohortId}>
                      <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue placeholder="اختر فوجاً" />
                      </SelectTrigger>
                      <SelectContent>
                        {cohorts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">المادة</Label>
                    <Select value={subjectUnitId} onValueChange={setSubjectUnitId}>
                      <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue placeholder="اختر مادة" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectLikeUnits.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      onClick={handleAddSubject}
                      disabled={!subjectCohortId || !subjectUnitId || subjectAdding}
                      className="w-full h-9 rounded-lg bg-cyan-600 hover:bg-cyan-700"
                    >
                      {subjectAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إضافة'}
                    </Button>
                  </div>
                </div>

                {subjectAssignments.length > 0 && (
                  <ul className="space-y-1.5">
                    {subjectAssignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-900">{a.cohort_name ?? '—'}</span>
                          <span className="text-slate-400 mx-1.5">/</span>
                          <span className="text-cyan-700">{a.unit_name ?? '—'}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeleteSubject(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إغلاق
          </Button>
          {!noCohorts && (
            <Button
              type="button"
              onClick={handleSaveDefaultScope}
              disabled={saving || loading}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التعيينات
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
