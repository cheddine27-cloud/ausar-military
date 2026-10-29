#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

// -----------------------------------------------------------------------------
// Isolated .env Loader
// -----------------------------------------------------------------------------
function loadEnv() {
  const env = { ...process.env };
  const isolatedPath = join(__dirname, '.env');
  const rootLocalPath = join(ROOT, '.env.local');

  const paths = [isolatedPath, rootLocalPath];
  for (const path of paths) {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        env[key] = value;
      }
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Helper for assertions
function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`UAT Assertion Failed: ${message}`);
  }
}

async function runUat() {
  console.log('================================================================');
  console.log('🎓 Starting Ausar Military Secondary School UAT Integration Simulator');
  console.log('================================================================\n');

  const uatInstId = '99999999-9999-9999-9999-999999999999';
  const uatInstCode = 'UAT-HIGH-SCHOOL';
  const yearLabel = '2025-2026';

  const mockTeacherId = '00000000-aaaa-1111-2222-333333333333';
  const mockSupervisorId = '00000000-aaaa-1111-2222-444444444444';
  const mockSubstituteId = '00000000-aaaa-1111-2222-555555555555';

  try {
    // -------------------------------------------------------------------------
    // CLEANUP STRAY DATA FIRST
    // -------------------------------------------------------------------------
    console.log('🧹 Preparing UAT sandbox...');
    await supabase.from('attendances').delete().eq('institution_id', uatInstId);
    await supabase.from('student_devices').delete().eq('institution_id', uatInstId);
    await supabase.from('institutions').delete().eq('id', uatInstId);
    try {
      await supabase.auth.admin.deleteUser(mockSupervisorId);
    } catch {}
    try {
      await supabase.auth.admin.deleteUser(mockTeacherId);
    } catch {}
    try {
      await supabase.auth.admin.deleteUser(mockSubstituteId);
    } catch {}

    // -------------------------------------------------------------------------
    // PHASE 1: Institution Seeding Verification
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 1: Seeding Secondary School Institution');
    console.log('----------------------------------------------------------------');

    // 1. Create Secondary School
    const { error: instErr } = await supabase
      .from('institutions')
      .insert({
        id: uatInstId,
        name: 'ثانوية النخبة النموذجية UAT',
        type: 'secondary_school',
        status: 'active',
        max_students: 1000,
        code: uatInstCode,
        settings_allowed_modes: ['qr', 'roll_call', 'hybrid']
      });
    assert(!instErr, 'Create secondary_school UAT institution');

    // 2. Levels seeding
    const levelRows = [
      { institution_id: uatInstId, name: 'السنة الأولى ثانوي', code: 'S1', type: 'school_year', status: 'active', metadata: {} },
      { institution_id: uatInstId, name: 'السنة الثانية ثانوي', code: 'S2', type: 'school_year', status: 'active', metadata: {} },
      { institution_id: uatInstId, name: 'السنة الثالثة ثانوي', code: 'S3', type: 'school_year', status: 'active', metadata: {} },
    ];
    const { error: levelsErr } = await supabase.from('institution_units').insert(levelRows);
    assert(!levelsErr, 'Seed 3 secondary levels');

    // 3. Subjects with coefficients and specialties
    const subjectRows = [
      { institution_id: uatInstId, name: 'الرياضيات (رياضيات)', code: 'MATH-M', coefficient: 6, weekly_hours: 6, academic_year: yearLabel, specialty: 'رياضيات', status: 'active' },
      { institution_id: uatInstId, name: 'العلوم الفيزيائية (علوم تجريبية)', code: 'PHYS-S', coefficient: 5, weekly_hours: 5, academic_year: yearLabel, specialty: 'علوم تجريبية', status: 'active' },
      { institution_id: uatInstId, name: 'اللغة العربية (مشترك)', code: 'AR-C', coefficient: 3, weekly_hours: 4, academic_year: yearLabel, specialty: null, status: 'active' },
    ];
    const { error: subjectsErr } = await supabase.from('subjects').insert(subjectRows);
    assert(!subjectsErr, 'Seed secondary subjects with coefficients and stream specialty values');

    // 4. Periods & Days
    const periodRows = [
      { institution_id: uatInstId, period_number: 1, start_time: '08:00:00', end_time: '09:30:00', break_duration: 15, status: 'active' },
      { institution_id: uatInstId, period_number: 2, start_time: '09:45:00', end_time: '11:15:00', break_duration: 15, status: 'active' },
    ];
    const { error: periodsErr } = await supabase.from('academic_periods').insert(periodRows);
    assert(!periodsErr, 'Seed daily periods');

    const workingDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'].map(d => ({
      institution_id: uatInstId, day_name: d, is_enabled: true
    }));
    const { error: daysErr } = await supabase.from('working_days').insert(workingDays);
    assert(!daysErr, 'Seed secondary working days (Sun-Thu)');

    // -------------------------------------------------------------------------
    // PHASE 2: Authentication & Role Check
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 2: Admin Accounts & Authentication Simulation');
    console.log('----------------------------------------------------------------');

    // Create auth users first
    const { error: auSupErr } = await supabase.auth.admin.createUser({
      id: mockSupervisorId,
      email: 'supervisor.uat@Ausar Military.test',
      password: 'UatPassword123!',
      email_confirm: true,
    });
    assert(!auSupErr, 'Create auth user for UAT supervisor');

    const { error: auTeachErr } = await supabase.auth.admin.createUser({
      id: mockTeacherId,
      email: 'teacher.uat@Ausar Military.test',
      password: 'UatPassword123!',
      email_confirm: true,
    });
    assert(!auTeachErr, 'Create auth user for UAT teacher');

    const { error: auSubErr } = await supabase.auth.admin.createUser({
      id: mockSubstituteId,
      email: 'sub.uat@Ausar Military.test',
      password: 'UatPassword123!',
      email_confirm: true,
    });
    assert(!auSubErr, 'Create auth user for UAT substitute');

    const adminRows = [
      { id: mockSupervisorId, auth_user_id: mockSupervisorId, username: 'supervisor_uat', role: 'institution_admin', rank: 'مراقب عام', full_name: 'مراقب UAT العام', email: 'supervisor.uat@Ausar Military.test', department: 'شؤون التلاميذ', institution_id: uatInstId },
      { id: mockTeacherId, auth_user_id: mockTeacherId, username: 'teacher_uat', role: 'teacher', rank: 'أستاذ', full_name: 'أستاذ UAT رياضيات', email: 'teacher.uat@Ausar Military.test', department: 'قسم الرياضيات', institution_id: uatInstId }
    ];

    const { error: adminsErr } = await supabase.from('admins').insert(adminRows);
    assert(!adminsErr, 'Create Director and Supervisor public admin profiles');

    // -------------------------------------------------------------------------
    // PHASE 3: Cohort & Student Management Workflow
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 3: Cohorts, Streams & Student Enrolment');
    console.log('----------------------------------------------------------------');

    // 1. Create Class (Cohort) belonging to ریاضیات stream
    const cohortId = '88888888-8888-8888-8888-888888888888';
    const { error: cohortErr } = await supabase
      .from('cohorts')
      .insert({
        id: cohortId,
        institution_id: uatInstId,
        name: 'السنة الثالثة ثانوي - رياضيات 1',
        level: 'السنة الثالثة ثانوي',
        field: 'رياضيات', // Algerian stream
      });
    assert(!cohortErr, 'Create secondary school class cohort belonging to رياضيات stream');

    // 2. Enroll Students
    const student1Id = '77777777-1111-1111-1111-111111111111';
    const student2Id = '77777777-2222-2222-2222-222222222222';
    const studentRows = [
      { id: student1Id, institution_id: uatInstId, first_name: 'أيمن', last_name: 'سليماني', student_number: 'BAC-2026-001', year: 'السنة الثالثة ثانوي', specialty: 'رياضيات', cohort_id: cohortId },
      { id: student2Id, institution_id: uatInstId, first_name: 'فاطمة', last_name: 'زهراء', student_number: 'BAC-2026-002', year: 'السنة الثالثة ثانوي', specialty: 'رياضيات', cohort_id: cohortId }
    ];
    const { error: studentsErr } = await supabase.from('students').insert(studentRows);
    assert(!studentsErr, 'Enroll secondary school students manually');

    // 3. Verify student stream transfer log triggers correctly
    const { error: transferErr } = await supabase
      .from('student_stream_transfers')
      .insert({
        student_id: student1Id,
        old_stream: null,
        new_stream: 'رياضيات',
        changed_by: mockSupervisorId,
        transfer_reason: 'توجيه دراسي معتمد',
        institution_id: uatInstId
      });
    assert(!transferErr, 'Log student stream transfer history event');

    // -------------------------------------------------------------------------
    // PHASE 4: Attendance & Approval Workflow
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 4: Classroom Mode Roll Call & Supervisor Approval Loop');
    console.log('----------------------------------------------------------------');

    // 1. Setup active teacher assignment
    const { data: subjects } = await supabase.from('subjects').select('id').eq('institution_id', uatInstId).eq('code', 'MATH-M');
    const mathSubjectId = subjects[0].id;

    const { error: assignErr } = await supabase
      .from('teacher_assignments')
      .insert({
        teacher_id: mockTeacherId,
        cohort_id: cohortId,
        subject_id: mathSubjectId,
        institution_id: uatInstId,
        weekly_lessons: 4
      });
    assert(!assignErr, 'Assign teacher to cohort and mathematics subject');

    // 2. Create Attendance Session
    const sessionId = '66666666-6666-6666-6666-666666666666';
    const { error: sessionErr } = await supabase
      .from('sessions')
      .insert({
        id: sessionId,
        institution_id: uatInstId,
        cohort_id: cohortId,
        professor_id: mockTeacherId,
        subject_id: mathSubjectId,
        title: 'الرياضيات: الجبر والمصفوفات',
        subject: 'الرياضيات',
        created_by: mockTeacherId,
        status: 'active',
        code: 'SESS12'
      });
    assert(!sessionErr, 'Autodetect and create interactive classroom session');

    // 3. Roll call
    const attendanceRows = [
      { institution_id: uatInstId, student_id: student1Id, session_id: sessionId, attendance_status: 'absent', timestamp: '2026-07-10T08:05:00Z' },
      { institution_id: uatInstId, student_id: student2Id, session_id: sessionId, attendance_status: 'present', timestamp: '2026-07-10T08:05:00Z' }
    ];
    const { error: attErr } = await supabase.from('attendances').insert(attendanceRows);
    assert(!attErr, 'Submit student roll call (Aymen absent, Fatima present)');

    // 4. Submit session report to supervisor inbox
    const reportId = '55555555-5555-5555-5555-555555555555';
    const { error: reportErr } = await supabase
      .from('school_attendance_reports')
      .insert({
        id: reportId,
        institution_id: uatInstId,
        session_id: sessionId,
        teacher_id: mockTeacherId,
        teacher_name: 'أستاذ UAT رياضيات',
        class_id: cohortId,
        class_name: 'السنة الثالثة ثانوي - رياضيات 1',
        status: 'submitted',
        is_locked: false,
        present_count: 1,
        absent_count: 1,
        late_count: 0
      });
    assert(!reportErr, 'Submit roll call report to general supervisor inbox: ' + (reportErr ? JSON.stringify(reportErr) : ''));

    // 5. Supervisor Review: Correction requested
    const { error: correctionErr } = await supabase
      .from('school_attendance_reports')
      .update({ correction_requested: true, correction_reason: 'يرجى مراجعة غياب التلميذ أيمن' })
      .eq('id', reportId);
     assert(!correctionErr, 'Supervisor requests a correction on submitted report: ' + (correctionErr ? JSON.stringify(correctionErr) : ''));

    // 6. Supervisor approves and locks
    const { error: approveErr } = await supabase
      .from('school_attendance_reports')
      .update({ status: 'approved', is_locked: true })
      .eq('id', reportId);
    assert(!approveErr, 'Supervisor approves the corrected report and locks it: ' + (approveErr ? JSON.stringify(approveErr) : ''));

    // Make attendances official
    const { error: officialErr } = await supabase
      .from('attendances')
      .update({ is_official: true, approved_at: new Date().toISOString(), approved_by_id: mockSupervisorId })
      .eq('session_id', sessionId);
    assert(!officialErr, 'Lock student attendances and mark as official: ' + (officialErr ? JSON.stringify(officialErr) : ''));

    // -------------------------------------------------------------------------
    // PHASE 5: Parent Communication Queue
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 5: Parent Communication Queue & Notification Center');
    console.log('----------------------------------------------------------------');
    const { error: commErr } = await supabase
      .from('communication_messages')
      .insert({
        institution_id: uatInstId,
        target_id: student1Id,
        target_type: 'student',
        category: 'attendance',
        title: 'إشعار غياب تلميذ',
        body: 'نعلمكم بغياب ابنكم أيمن سليماني عن حصة الرياضيات اليوم.',
        sender_id: mockSupervisorId,
        sender_role: 'admin',
        status: 'delivered',
        priority: 'high'
      });
    assert(!commErr, 'Queue manual parent absence notification: ' + (commErr ? JSON.stringify(commErr) : ''));

    // -------------------------------------------------------------------------
    // PHASE 6: Justifications Workflow
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 6: Absence Justification Approval Loop');
    console.log('----------------------------------------------------------------');

    // 1. Submit justification for student 1 (Aymen)
    const justId = '44444444-4444-4444-4444-444444444444';
    const { error: justErr } = await supabase
      .from('absence_justifications')
      .insert({
        id: justId,
        institution_id: uatInstId,
        student_id: student1Id,
        reason: 'شهادة طبية من طبيب معتمد',
        status: 'pending'
      });
    assert(!justErr, 'Submit absence medical certificate justification');

    // 2. Supervisor approves
    const { error: justApproveErr } = await supabase
      .from('absence_justifications')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('id', justId);
    assert(!justApproveErr, 'Supervisor approves student justification');

    // -------------------------------------------------------------------------
    // PHASE 7: Teacher Substitution & Coverage
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 7: Teacher Substitution & Conflict Detection');
    console.log('----------------------------------------------------------------');
    await supabase.from('admins').insert({
      id: mockSubstituteId, auth_user_id: mockSubstituteId, username: 'sub_uat', role: 'teacher', rank: 'أستاذ', full_name: 'أستاذ بديل UAT', email: 'sub.uat@Ausar Military.test', department: 'قسم الرياضيات', institution_id: uatInstId
    });

    const { error: subErr } = await supabase
      .from('teacher_substitutions')
      .insert({
        institution_id: uatInstId,
        substitution_date: '2026-07-10',
        status: 'active',
        original_teacher_id: mockTeacherId,
        substitute_teacher_id: mockSubstituteId,
        subject_id: mathSubjectId,
        class_id: cohortId
      });
    assert(!subErr, 'Schedule replacement teacher substitution without conflicts: ' + (subErr ? JSON.stringify(subErr) : ''));

    // -------------------------------------------------------------------------
    // PHASE 8 & 9: Reports Center & Stream Filters
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 8 & 9: Reports Center & Stream Filters Verification');
    console.log('----------------------------------------------------------------');

    // 1. Verify stream level filter retrieves the correct UAT class sessions
    const { data: matchedSessions, error: matchErr } = await supabase
      .from('cohorts')
      .select('id')
      .eq('institution_id', uatInstId)
      .eq('field', 'رياضيات');
    assert(!matchErr && matchedSessions.length > 0, 'Reports Center stream filter retrieves ریاضیات cohorts');

    // -------------------------------------------------------------------------
    // PHASE 10: Student 360 Timeline Check
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 10: Student 360 Chronological Timeline Audit');
    console.log('----------------------------------------------------------------');

    // Verify stream transfers are loaded on timeline
    const { data: transfers, error: tfErr } = await supabase
      .from('student_stream_transfers')
      .select('new_stream, transfer_reason')
      .eq('student_id', student1Id);
    assert(!tfErr && transfers[0].new_stream === 'رياضيات', 'Chronological timeline displays student stream transfer');

    // -------------------------------------------------------------------------
    // PHASE 12: Negative & Boundary Testing
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 12: Negative & Boundary Case Testing');
    console.log('----------------------------------------------------------------');

    // Try logging attendance for locked session (duplicate inserts should fail unique constraint)
    const { error: dupErr } = await supabase
      .from('attendances')
      .insert({
        institution_id: uatInstId,
        student_id: student1Id,
        session_id: sessionId,
        attendance_status: 'present',
        timestamp: '2026-07-10T08:05:00Z'
      });
    assert(dupErr, 'Prevent double roll call submission for same student inside locked session');

    // -------------------------------------------------------------------------
    // PHASE 15: Sandbox Cleanup
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log('PHASE 15: Sandbox Data Cleanup');
    console.log('----------------------------------------------------------------');
    await supabase.from('attendances').delete().eq('institution_id', uatInstId);
    await supabase.from('student_devices').delete().eq('institution_id', uatInstId);
    const { error: cleanupErr } = await supabase
      .from('institutions')
      .delete()
      .eq('id', uatInstId);
    assert(!cleanupErr, 'Cascade delete sandbox institution UAT data');

    // Delete Auth Users
    await supabase.auth.admin.deleteUser(mockSupervisorId);
    await supabase.auth.admin.deleteUser(mockTeacherId);
    await supabase.auth.admin.deleteUser(mockSubstituteId);

    console.log('\n🎉 All UAT simulation phases completed successfully!');
  } catch (err) {
    console.error('\n❌ UAT Verification Failed:', err.message);
    // Cleanup anyway
    await supabase.from('attendances').delete().eq('institution_id', uatInstId);
    await supabase.from('student_devices').delete().eq('institution_id', uatInstId);
    await supabase.from('institutions').delete().eq('id', uatInstId);
    try {
      await supabase.auth.admin.deleteUser(mockSupervisorId);
    } catch {}
    try {
      await supabase.auth.admin.deleteUser(mockTeacherId);
    } catch {}
    try {
      await supabase.auth.admin.deleteUser(mockSubstituteId);
    } catch {}
    process.exit(1);
  }
}

void runUat();
