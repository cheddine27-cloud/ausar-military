import html2pdf from 'html2pdf.js';
import { Attendance, Student, Session, Cohort } from './types';

export interface AttendancePDFData {
  attendance: Attendance[];
  students: Student[];
  sessions: Session[];
  cohorts: Cohort[];
  title?: string;
}

export function exportAttendanceToPDF(data: AttendancePDFData) {
  const { attendance, students, sessions, cohorts, title = 'تقرير الحضور والغياب' } = data;
  
  // إنشاء HTML
  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          direction: rtl;
          text-align: right;
          padding: 20px;
        }
        h1 {
          text-align: center;
          color: #333;
          margin-bottom: 10px;
        }
        .date {
          text-align: center;
          color: #666;
          margin-bottom: 20px;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          background-color: #4472C4;
          color: white;
          padding: 10px;
          border: 1px solid #ddd;
          font-size: 11px;
        }
        td {
          padding: 8px;
          border: 1px solid #ddd;
          text-align: center;
          font-size: 10px;
        }
        tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 10px;
          color: #999;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="date">${new Date().toLocaleDateString('en-GB')}</div>
      
      <table>
        <thead>
          <tr>
            <th>الرقم الجامعي</th>
            <th>الاسم</th>
            <th>الفوج</th>
            <th>الجلسة</th>
            <th>التاريخ</th>
            <th>الساعة</th>
            <th>الطريقة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${attendance.map(att => {
            const student = students.find(s => s.id === att.studentId || s.id === att.student_id);
            const session = sessions.find(s => s.id === att.sessionId || s.id === att.session_id);
            const cohort = cohorts.find(c => c.id === student?.cohortId || c.id === student?.cohort_id);
            
            const studentNumber = student?.studentNumber || student?.student_number || '';
            const studentName = `${student?.firstName || student?.first_name || ''} ${student?.lastName || student?.last_name || ''}`;
            const cohortName = cohort?.name || '';
            const sessionTitle = session?.title || '';
            const date = new Date(att.timestamp).toLocaleDateString('en-GB');
            const time = new Date(att.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            const method = att.method === 'qr' ? 'QR Code' : 'رمز الجلسة';
            
            return `
              <tr>
                <td>${studentNumber}</td>
                <td>${studentName}</td>
                <td>${cohortName}</td>
                <td>${sessionTitle}</td>
                <td>${date}</td>
                <td>${time}</td>
                <td>${method}</td>
                <td>حاضر</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        تم الإنشاء بتاريخ ${new Date().toLocaleDateString('en-GB')}
      </div>
    </body>
    </html>
  `;
  
  // تحويل HTML إلى PDF
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  
  const opt = {
    margin: 10,
    filename: `attendance_report_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
  };
  
  html2pdf().set(opt).from(element).save();
}
