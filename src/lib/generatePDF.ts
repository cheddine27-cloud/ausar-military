import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function generateAttendanceReport(
  sessionTitle: string,
  cohortName: string,
  attendanceData: Array<{
    studentNumber: string;
    firstName: string;
    lastName: string;
    status: 'حاضر' | 'غائب' | 'معذر';
  }>
) {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // اضبط الاتجاه العربي
  doc.setLanguage('ar');
  
  // عنوان التقرير
  doc.setFontSize(18);
  doc.text('تقرير الحضور', 105, 20, { align: 'center' });
  
  // البيانات الأساسية
  doc.setFontSize(12);
  doc.text(`الجلسة: ${sessionTitle}`, 190, 35, { align: 'right' });
  doc.text(`الفوج: ${cohortName}`, 190, 43, { align: 'right' });
  doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, 190, 51, { align: 'right' });
  
  // جدول البيانات
  const tableData = attendanceData.map((item, index) => [
    index + 1,
    `${item.firstName || ''} ${item.lastName || ''}`.trim(),
    item.studentNumber,
    item.status
  ]);

  autoTable(doc, {
    head: [['#', 'الاسم الكامل', 'الرقم الجامعي', 'الحالة']],
    body: tableData,
    startY: 60,
    styles: {
      font: 'helvetica', // استخدم font متوافق
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      halign: 'center',
      valign: 'middle',
      fontSize: 11
    },
    bodyStyles: {
      halign: 'center',
      valign: 'middle',
      fontSize: 10
    },
    columnStyles: {
      3: {
        cellWidth: 30
      }
    },
    margin: { right: 10, left: 10 },
    didDrawPage: function(data) {
      // Footer
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      const pageWidth = pageSize.getWidth();
      doc.setFontSize(10);
      doc.text(
        `صفحة ${doc.internal.pages.length - 1}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });

  // احفظ الملف
  doc.save(`attendance_report_${new Date().toISOString().split('T')[0]}.pdf`);
}
