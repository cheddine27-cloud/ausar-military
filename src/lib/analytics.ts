import { Attendance, Student, Session, Cohort } from './types';

export interface AttendanceStats {
  totalStudents: number;
  totalSessions: number;
  totalAttendance: number;
  attendanceRate: number;
}

export interface CohortAttendance {
  cohortId: string;
  cohortName: string;
  present: number;
  absent: number;
  total: number;
  rate: number;
}

export interface SessionAttendance {
  sessionId: string;
  sessionTitle: string;
  date: string;
  present: number;
  total: number;
  rate: number;
}

export interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  studentNumber: string;
  cohortName: string;
  present: number;
  absent: number;
  total: number;
  rate: number;
}

export async function calculateOverallStats(
  students: Student[],
  sessions: Session[],
  attendance: Attendance[]
): Promise<AttendanceStats> {
  const totalStudents = students.length;
  const totalSessions = sessions.filter(s => s.status === 'closed').length;
  const totalAttendance = attendance.length;
  const expectedAttendance = totalStudents * totalSessions;
  const attendanceRate = expectedAttendance > 0 ? (totalAttendance / expectedAttendance) * 100 : 0;
  
  return {
    totalStudents,
    totalSessions,
    totalAttendance,
    attendanceRate: Math.round(attendanceRate * 10) / 10
  };
}

export async function calculateCohortAttendance(
  cohorts: Cohort[],
  students: Student[],
  sessions: Session[],
  attendance: Attendance[]
): Promise<CohortAttendance[]> {
  const closedSessions = sessions.filter(s => s.status === 'closed');
  
  return cohorts.map(cohort => {
    const cohortStudents = students.filter(s => 
      s.cohortId === cohort.id || s.cohort_id === cohort.id
    );
    const cohortAttendance = attendance.filter(att => 
      cohortStudents.some(s => s.id === (att.studentId || att.student_id))
    );
    
    const total = cohortStudents.length * closedSessions.length;
    const present = cohortAttendance.length;
    const absent = total - present;
    const rate = total > 0 ? (present / total) * 100 : 0;
    
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      present,
      absent,
      total,
      rate: Math.round(rate * 10) / 10
    };
  });
}

export async function calculateSessionAttendance(
  sessions: Session[],
  students: Student[],
  attendance: Attendance[]
): Promise<SessionAttendance[]> {
  return sessions
    .filter(s => s.status === 'closed')
    .map(session => {
      const sessionAttendance = attendance.filter(att => 
        (att.sessionId || att.session_id) === session.id
      );
      const present = sessionAttendance.length;
      const total = students.length;
      const rate = total > 0 ? (present / total) * 100 : 0;
      
      return {
        sessionId: session.id,
        sessionTitle: session.title,
        date: new Date(session.createdAt || session.created_at).toLocaleDateString('ar-SA'),
        present,
        total,
        rate: Math.round(rate * 10) / 10
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function calculateStudentAttendance(
  students: Student[],
  cohorts: Cohort[],
  sessions: Session[],
  attendance: Attendance[]
): Promise<StudentAttendanceRecord[]> {
  const closedSessions = sessions.filter(s => s.status === 'closed');
  const totalSessions = closedSessions.length;
  
  return students.map(student => {
    const cohort = cohorts.find(c => c.id === (student.cohortId || student.cohort_id));
    const studentAttendance = attendance.filter(att => 
      (att.studentId || att.student_id) === student.id
    );
    
    const present = studentAttendance.length;
    const total = totalSessions;
    const absent = total - present;
    const rate = total > 0 ? (present / total) * 100 : 0;
    
    return {
      studentId: student.id,
      studentName: `${student.firstName || student.first_name} ${student.lastName || student.last_name}`,
      studentNumber: student.studentNumber || student.student_number,
      cohortName: cohort?.name || '',
      present,
      absent,
      total,
      rate: Math.round(rate * 10) / 10
    };
  })
  .sort((a, b) => a.rate - b.rate);
}

export function getWeeklyAttendance(
  attendance: Attendance[],
  weeksBack: number = 4
): { week: string; count: number }[] {
  const now = new Date();
  const weeks: { week: string; count: number }[] = [];
  
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekAttendance = attendance.filter(att => {
      const attDate = new Date(att.timestamp);
      return attDate >= weekStart && attDate <= weekEnd;
    });
    
    const weekLabel = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
    weeks.push({
      week: weekLabel,
      count: weekAttendance.length
    });
  }
  
  return weeks;
}
