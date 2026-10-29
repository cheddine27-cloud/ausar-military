import { Attendance, Student, Session, Cohort } from './types';

export interface AttendanceExportData {
  attendance: Attendance[];
  students: Student[];
  sessions: Session[];
  cohorts: Cohort[];
}

const columns = [
  { header: 'الرقم الجامعي', key: 'studentNumber', width: 15 },
  { header: 'الاسم الأول', key: 'firstName', width: 15 },
  { header: 'اسم العائلة', key: 'lastName', width: 15 },
  { header: 'الفوج', key: 'cohort', width: 20 },
  { header: 'الجلسة', key: 'session', width: 25 },
  { header: 'التاريخ', key: 'date', width: 15 },
  { header: 'الساعة', key: 'time', width: 12 },
  { header: 'طريقة التسجيل', key: 'method', width: 15 },
  { header: 'الحالة', key: 'status', width: 10 },
];

export async function exportAttendanceToExcel(data: AttendanceExportData) {
  const { default: ExcelJS } = await import('exceljs');
  const { attendance, students, sessions, cohorts } = data;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('سجل الحضور');

  worksheet.columns = columns;
  worksheet.addRows(attendance.map((att) => {
    const studentId = att.studentId || att.student_id;
    const sessionId = att.sessionId || att.session_id;
    const student = students.find((s) => s.id === studentId);
    const session = sessions.find((s) => s.id === sessionId);
    const cohortId = student?.cohortId || student?.cohort_id;
    const cohort = cohorts.find((c) => c.id === cohortId);
    const timestamp = new Date(att.timestamp);

    return {
      studentNumber: student?.studentNumber || student?.student_number || '',
      firstName: student?.firstName || student?.first_name || '',
      lastName: student?.lastName || student?.last_name || '',
      cohort: cohort?.name || '',
      session: session?.title || '',
      date: timestamp.toLocaleDateString('ar-SA'),
      time: timestamp.toLocaleTimeString('ar-SA'),
      method: att.method === 'qr' ? 'QR Code' : 'رمز الجلسة',
      status: 'حاضر',
    };
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
      cell.font = { color: { argb: 'FF006100' } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
