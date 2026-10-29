import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ArabicReshaper from 'arabic-persian-reshaper';
import { Attendance, Student, Session, Cohort } from './types';

export interface AttendancePDFData {
  attendance: Attendance[];
  students: Student[];
  sessions: Session[];
  cohorts: Cohort[];
  title?: string;
}

// ✅ دالة مساعدة لتحويل النص العربي
function reshapeArabic(text: string): string {
  try {
    return ArabicReshaper.convertArabic(text);
  } catch (error) {
    console.error('Error reshaping Arabic text:', error);
    return text;
  }
}

export function exportAttendanceToPDF(data: AttendancePDFData) {
  const { attendance, students, sessions, cohorts, title = 'تقرير الحضور والغياب' } = data;
  
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  // Add title
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text(reshapeArabic(title), doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
  
  // Add date
  doc.setFontSize(10);
  const dateStr = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  doc.text(dateStr, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
  
  // Prepare table data
  const tableData = attendance.map(att => {
    const student = students.find(s => s.id === att.studentId || s.id === att.student_id);
    const session = sessions.find(s => s.id === att.sessionId || s.id === att.session_id);
    const cohort = cohorts.find(c => c.id === student?.cohortId || c.id === student?.cohort_id);
    
    const studentNumber = student?.studentNumber || student?.student_number || '';
    const studentName = `${student?.firstName || student?.first_name || ''} ${student?.lastName || student?.last_name || ''}`;
    const cohortName = cohort?.name || '';
    const sessionTitle = session?.title || '';
    const date = new Date(att.timestamp).toLocaleDateString('en-GB');
    const time = new Date(att.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    const method = att.method === 'qr' ? 'QR Code' : reshapeArabic('رمز الجلسة');
    const status = reshapeArabic('حاضر');
    
    return [
      studentNumber,
      reshapeArabic(studentName),
      reshapeArabic(cohortName),
      reshapeArabic(sessionTitle),
      date,
      time,
      method,
      status
    ];
  });
  
  // Add table
  autoTable(doc, {
    head: [[
      reshapeArabic('الرقم الجامعي'),
      reshapeArabic('الاسم'),
      reshapeArabic('الفوج'),
      reshapeArabic('الجلسة'),
      reshapeArabic('التاريخ'),
      reshapeArabic('الساعة'),
      reshapeArabic('الطريقة'),
      reshapeArabic('الحالة')
    ]],
    body: tableData,
    startY: 30,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 4,
      halign: 'center',
      valign: 'middle',
      lineColor: [100, 100, 100],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [68, 114, 196],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      fontSize: 10
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0]
    },
    alternateRowStyles: {
      fillColor: [240, 248, 255]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 20 },
      5: { cellWidth: 20 },
      6: { cellWidth: 20 },
      7: { cellWidth: 20 }
    },
    margin: { top: 30, right: 10, bottom: 15, left: 10 }
  });
  
  // Add footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    const footerText = reshapeArabic(`صفحة ${i} من ${pageCount}`);
    doc.text(
      footerText,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const timestamp = new Date().toISOString().split('T')[0];
  doc.save(`attendance_report_${timestamp}.pdf`);
}
