/**
 * v3.0 — Smart Attendance API
 * Roll Call & Hybrid attendance operations.
 *
 * Security: All writes include institution_id from the session row,
 * so RLS tenant isolation is enforced automatically.
 * No existing RLS policies are changed.
 */
import { supabase } from './supabase';
import type { RollCallStudentRow, RollCallMark, AttendanceSource, AttendanceStatus } from './types';

// ---------------------------------------------------------------------------
// Fetch students for a cohort (teacher-scoped, ordered by name)
// ---------------------------------------------------------------------------
export interface CohortStudentRow {
  id: string;
  student_number: string | null;
  first_name: string | null;
  last_name: string | null;
  cohort_id: string | null;
  institution_id: string | null;
}

/**
 * Fetches students belonging to a cohort.
 * Uses existing RLS — teacher only sees students in their institution.
 * Ordered alphabetically by last_name then first_name.
 */
export async function getStudentsForCohort(cohortId: string): Promise<CohortStudentRow[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_number, first_name, last_name, cohort_id, institution_id')
    .eq('cohort_id', cohortId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) throw new Error(`Erreur chargement étudiants: ${error.message}`);
  return (data ?? []) as CohortStudentRow[];
}

// ---------------------------------------------------------------------------
// Fetch existing QR attendances for a session (for Hybrid mode)
// ---------------------------------------------------------------------------
export interface ExistingAttendanceRow {
  student_id: string | null;
  attendance_source: string | null;
  attendance_status: string | null;
}

export async function getSessionAttendances(sessionId: string): Promise<ExistingAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendances')
    .select('student_id, attendance_source, attendance_status')
    .eq('session_id', sessionId);

  if (error) throw new Error(`Erreur chargement présences: ${error.message}`);
  return (data ?? []) as ExistingAttendanceRow[];
}

// ---------------------------------------------------------------------------
// Build Roll Call list from cohort students
// Hybrid mode: filters out students already marked via QR
// ---------------------------------------------------------------------------
export function buildRollCallList(
  students: CohortStudentRow[],
  existingAttendances: ExistingAttendanceRow[] = [],
): RollCallStudentRow[] {
  const markedStudentIds = new Set(
    existingAttendances.map((a) => a.student_id).filter(Boolean),
  );

  return students
    .filter((s) => !markedStudentIds.has(s.id))
    .map((s) => ({
      studentId: s.id,
      studentNumber: s.student_number ?? '—',
      fullName: [s.last_name, s.first_name].filter(Boolean).join(' ') || 'طالب',
      mark: null as RollCallMark,
    }));
}

// ---------------------------------------------------------------------------
// Save a single Roll Call mark immediately (real-time, no batch)
// ---------------------------------------------------------------------------
export interface SaveMarkResult {
  ok: boolean;
  error?: string;
}

export async function saveRollCallMark(params: {
  sessionId: string;
  studentId: string;
  institutionId: string;
  mark: 'present' | 'absent' | 'late';
}): Promise<SaveMarkResult> {
  const source: AttendanceSource = 'roll_call';
  const status: AttendanceStatus = params.mark;

  // Upsert: if student already has a record in this session, update it.
  // This handles the Undo scenario gracefully.
  const { error } = await supabase.from('attendances').upsert(
    {
      session_id: params.sessionId,
      student_id: params.studentId,
      institution_id: params.institutionId,
      method: 'roll_call',
      attendance_source: source,
      attendance_status: status,
      timestamp: new Date().toISOString(),
    },
    {
      onConflict: 'session_id,student_id',
      ignoreDuplicates: false,
    },
  );

  if (error) {
    console.error('[SmartAttendance] saveRollCallMark error:', error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Batch save all Roll Call results at end of session
// Used as a fallback if per-student saves had issues (offline recovery)
// ---------------------------------------------------------------------------
export async function batchSaveRollCallResults(params: {
  sessionId: string;
  institutionId: string;
  marks: Array<{ studentId: string; mark: 'present' | 'absent' | 'late' }>;
}): Promise<{ saved: number; errors: number }> {
  let saved = 0;
  let errors = 0;

  for (const item of params.marks) {
    const result = await saveRollCallMark({
      sessionId: params.sessionId,
      studentId: item.studentId,
      institutionId: params.institutionId,
      mark: item.mark,
    });
    if (result.ok) saved++;
    else errors++;
  }

  return { saved, errors };
}

// ---------------------------------------------------------------------------
// Update session attendance_mode
// ---------------------------------------------------------------------------
export async function updateSessionAttendanceMode(
  sessionId: string,
  mode: 'qr' | 'roll_call' | 'hybrid',
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('sessions')
    .update({ attendance_mode: mode })
    .eq('id', sessionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Compute Roll Call summary statistics
// ---------------------------------------------------------------------------
export function computeRollCallSummary(rows: RollCallStudentRow[]) {
  const present = rows.filter((r) => r.mark === 'present').length;
  const absent = rows.filter((r) => r.mark === 'absent').length;
  const late = rows.filter((r) => r.mark === 'late').length;
  const unmarked = rows.filter((r) => r.mark === null).length;
  const total = rows.length;
  const marked = total - unmarked;
  const presentRate = marked > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return { total, present, absent, late, unmarked, presentRate };
}
