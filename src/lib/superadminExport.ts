// =============================================================================
// Ausar Military SuperAdmin export utilities (client-side PDF + Excel generators)
// =============================================================================
// يستخدم هذا الملف مكتبات مثبتة في المشروع (jsPDF + jspdf-autotable، exceljs)
// لتوليد تقارير فعلية من بيانات لوحة مالك المنصة دون الحاجة إلى backend جديد.
// - تقرير القطاع PDF / Excel: بيانات مؤسسات القطاع ومؤشراته
// - تقرير الحضور PDF / Excel: تحليل حضور القطاع (12 أسبوعًا)
// - تقرير الأجهزة PDF / Excel: ملخص الأجهزة الموثقة للقطاع
// - ملف المؤسسة: تقرير PDF / Excel شامل + تقرير الطلبة + تقرير الأجهزة
// =============================================================================

interface SectorRow {
  institutionName: string;
  institutionType: string;
  wilaya: string;
  city: string;
  status: string;
  maxStudents: number;
  createdAt: string;
}

interface SectorExportData {
  sectorName: string;
  generatedAt: string;
  rows: SectorRow[];
  kpis: { label: string; value: string | number }[];
}

interface AttendanceExportData {
  sectorName: string;
  generatedAt: string;
  weeklyAttendance: number[];
  attendanceRate: string;
  totalAttendances: number;
  totalSessions: number;
  totalStudents: number;
}

interface DevicesExportData {
  sectorName: string;
  generatedAt: string;
  totalDevices: number;
  institutionsCount: number;
  averagePerInstitution: string;
  recentActivity: { text: string; time: string }[];
}

interface InstitutionFileData {
  generatedAt: string;
  institutionName: string;
  institutionType: string;
  planType: string;
  subscriptionStatus: string;
  studentLimit: string;
  sessionLimit: string;
  periodEnd: string;
  attendanceRate: string;
  students: number;
  cohorts: number;
  sessions: number;
  attendances: number;
  admins: number;
  devices: number;
  recentCohorts: { name: string; level: string; students: number; rate: string; lastSession: string }[];
  recentActivities: { time: string; text: string }[];
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-DZ');
  } catch {
    return '—';
  }
}

function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active': return 'نشطة';
    case 'suspended': return 'مجمدة';
    default: return status || 'غير محددة';
  }
}

function sectorStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active': return 'نشطة';
    case 'frozen':
    case 'suspended': return 'مجمدة';
    default: return status || 'غير محددة';
  }
}

async function saveHtmlAsPdf(html: string, filename: string, landscape = false) {
  const { default: html2pdf } = await import('html2pdf.js');
  const element = document.createElement('div');
  element.innerHTML = html;
  const opt: Record<string, unknown> = {
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' },
  };
  await html2pdf().set(opt).from(element).save();
}

const RTL_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; color: #1e293b; }
  .brand { font-size: 20px; font-weight: 900; color: #4f46e5; }
  .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
  h1 { font-size: 17px; margin: 4px 0; }
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 14px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi { background: #f1f5f9; border-radius: 8px; padding: 8px; text-align: center; }
  .kpi .label { font-size: 10px; color: #64748b; }
  .kpi .value { font-size: 16px; font-weight: 900; color: #1e293b; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background-color: #4f46e5; color: #fff; padding: 8px; font-size: 11px; text-align: right; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-size: 10.5px; }
  tr:nth-child(even) td { background-color: #f8fafc; }
  .footer { text-align: center; margin-top: 14px; font-size: 10px; color: #94a3b8; }
  h2 { font-size: 14px; margin: 14px 0 6px; }
`;

// -----------------------------------------------------------------------------
// 1) تقرير القطاع (ملف القطاع)
// -----------------------------------------------------------------------------
export async function exportSectorReportPDF(data: SectorExportData): Promise<void> {
  const kpiCards = data.kpis.map((kpi) => `
    <div class="kpi"><div class="label">${kpi.label}</div><div class="value">${kpi.value}</div></div>
  `).join('');
  const rows = data.rows.map((row) => `
    <tr>
      <td>${row.institutionName}</td>
      <td>${row.institutionType}</td>
      <td>${row.wilaya || '—'}</td>
      <td>${row.city || '—'}</td>
      <td>${statusLabel(row.status)}</td>
      <td>${row.maxStudents}</td>
      <td>${fmtDate(row.createdAt)}</td>
    </tr>
  `).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">${data.generatedAt}</div>
      <h1>تقرير قطاع: ${data.sectorName}</h1>
    </div>
    <div class="kpis">${kpiCards}</div>
    <h2>مؤسسات القطاع</h2>
    <table>
      <thead><tr><th>المؤسسة</th><th>النوع</th><th>الولاية</th><th>المدينة</th><th>الحالة</th><th>السعة</th><th>تاريخ الإضافة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `تقرير_القطاع_${data.sectorName}_${dateSlug()}.pdf`);
}

export async function exportSectorReportExcel(data: SectorExportData): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ausar Military';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(data.sectorName.slice(0, 31), { views: [{ rightToLeft: true }] });
  sheet.addRow(['Ausar Military', `تقرير قطاع: ${data.sectorName}`]);
  sheet.addRow(['تاريخ التصدير', data.generatedAt]);
  sheet.addRow([]);
  for (const kpi of data.kpis) {
    sheet.addRow([kpi.label, kpi.value]);
  }
  sheet.addRow([]);
  const headerRow = sheet.addRow(['المؤسسة', 'النوع', 'الولاية', 'المدينة', 'الحالة', 'السعة', 'تاريخ الإضافة']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  });
  for (const row of data.rows) {
    sheet.addRow([row.institutionName, row.institutionType, row.wilaya || '', row.city || '', statusLabel(row.status), row.maxStudents, fmtDate(row.createdAt)]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `تقرير_القطاع_${data.sectorName}_${dateSlug()}.xlsx`);
}

// -----------------------------------------------------------------------------
// 2) تقرير الحضور (تحليل 12 أسبوعًا للقطاع)
// -----------------------------------------------------------------------------
export async function exportAttendanceReportPDF(data: AttendanceExportData): Promise<void> {
  const kpiCards = [
    { label: 'تسجيلات الحضور', value: data.totalAttendances },
    { label: 'إجمالي الجلسات', value: data.totalSessions },
    { label: 'إجمالي الطلبة', value: data.totalStudents },
    { label: 'نسبة الحضور', value: `${data.attendanceRate}%` },
  ].map((kpi) => `
    <div class="kpi"><div class="label">${kpi.label}</div><div class="value">${kpi.value}</div></div>
  `).join('');
  const rows = data.weeklyAttendance.map((value, index) => {
    const weeksAgo = 11 - index;
    const endOfAgo = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000);
    const startOfAgo = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    return `
      <tr>
        <td>الأسبوع ${data.weeklyAttendance.length - index} (${fmtDate(startOfAgo.toISOString())} — ${fmtDate(endOfAgo.toISOString())})</td>
        <td>${value}%</td>
      </tr>
    `;
  }).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">${data.generatedAt}</div>
      <h1>تقرير الحضور: ${data.sectorName}</h1>
    </div>
    <div class="kpis">${kpiCards}</div>
    <h2>تحليل الحضور (آخر 12 أسبوعًا)</h2>
    <table>
      <thead><tr><th>الفترة</th><th>مؤشر النشاط %</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">مؤشر النشاط نسبة مئوية معيارية مشتقة من سجلات الحضور الحقيقية</div>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `تقرير_الحضور_${data.sectorName}_${dateSlug()}.pdf`);
}

export async function exportAttendanceReportExcel(data: AttendanceExportData): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ausar Military';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`حضور ${data.sectorName}`.slice(0, 31), { views: [{ rightToLeft: true }] });
  sheet.addRow(['Ausar Military', `تقرير الحضور: ${data.sectorName}`]);
  sheet.addRow(['تاريخ التصدير', data.generatedAt]);
  sheet.addRow([]);
  sheet.addRow(['تسجيلات الحضور', data.totalAttendances]);
  sheet.addRow(['إجمالي الجلسات', data.totalSessions]);
  sheet.addRow(['إجمالي الطلبة', data.totalStudents]);
  sheet.addRow(['نسبة الحضور', `${data.attendanceRate}%`]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(['الفترة', 'مؤشر النشاط %']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  });
  data.weeklyAttendance.forEach((value, index) => {
    const weeksAgo = 11 - index;
    const startOfAgo = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000);
    const endOfAgo = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000);
    sheet.addRow([`الأسبوع ${data.weeklyAttendance.length - index} (${fmtDate(startOfAgo.toISOString())} — ${fmtDate(endOfAgo.toISOString())})`, `${value}%`]);
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `تقرير_الحضور_${data.sectorName}_${dateSlug()}.xlsx`);
}

// -----------------------------------------------------------------------------
// 3) تقرير الأجهزة (القطاع)
// -----------------------------------------------------------------------------
export async function exportDevicesReportPDF(data: DevicesExportData): Promise<void> {
  const kpiCards = [
    { label: 'الأجهزة الموثقة', value: data.totalDevices },
    { label: 'المؤسسات', value: data.institutionsCount },
    { label: 'متوسط الأجهزة لكل مؤسسة', value: data.averagePerInstitution },
  ].map((kpi) => `
    <div class="kpi"><div class="label">${kpi.label}</div><div class="value">${kpi.value}</div></div>
  `).join('');
  const rows = data.recentActivity.map((entry) => `
    <tr><td>${entry.text}</td><td>${entry.time}</td></tr>
  `).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">${data.generatedAt}</div>
      <h1>تقرير الأجهزة: ${data.sectorName}</h1>
    </div>
    <div class="kpis">${kpiCards}</div>
    <h2>آخر نشاط الأجهزة</h2>
    <table>
      <thead><tr><th>النشاط</th><th>التوقيت</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `تقرير_الأجهزة_${data.sectorName}_${dateSlug()}.pdf`);
}

export async function exportDevicesReportExcel(data: DevicesExportData): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ausar Military';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`أجهزة ${data.sectorName}`.slice(0, 31), { views: [{ rightToLeft: true }] });
  sheet.addRow(['Ausar Military', `تقرير الأجهزة: ${data.sectorName}`]);
  sheet.addRow(['تاريخ التصدير', data.generatedAt]);
  sheet.addRow([]);
  sheet.addRow(['الأجهزة الموثقة', data.totalDevices]);
  sheet.addRow(['المؤسسات', data.institutionsCount]);
  sheet.addRow(['متوسط الأجهزة لكل مؤسسة', data.averagePerInstitution]);
  sheet.addRow([]);
  const headerRow = sheet.addRow(['النشاط', 'التوقيت']);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  });
  for (const entry of data.recentActivity) {
    sheet.addRow([entry.text, entry.time]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `تقرير_الأجهزة_${data.sectorName}_${dateSlug()}.xlsx`);
}

// -----------------------------------------------------------------------------
// 4) ملف المؤسسة (QuickReports)
// -----------------------------------------------------------------------------
export async function exportInstitutionReportPDF(data: InstitutionFileData): Promise<void> {
  const kpiCards = [
    { label: 'الطلبة', value: data.students },
    { label: 'الأفواج', value: data.cohorts },
    { label: 'الجلسات', value: data.sessions },
    { label: 'الحضور', value: `${data.attendanceRate}%` },
    { label: 'الإدارة', value: data.admins },
    { label: 'الأجهزة', value: data.devices },
    { label: 'الخطة', value: data.planType || 'غير محددة' },
    { label: 'الاشتراك', value: data.subscriptionStatus || 'غير محددة' },
  ].map((kpi) => `
    <div class="kpi"><div class="label">${kpi.label}</div><div class="value">${kpi.value}</div></div>
  `).join('');
  const cohortRows = data.recentCohorts.map((cohort) => `
    <tr>
      <td>${cohort.name}</td>
      <td>${cohort.level || '—'}</td>
      <td>${cohort.students}</td>
      <td>${cohort.rate}%</td>
      <td>${cohort.lastSession || '—'}</td>
    </tr>
  `).join('');
  const activityRows = data.recentActivities.map((entry) => `
    <tr><td>${entry.text}</td><td>${entry.time}</td></tr>
  `).join('');
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">تاريخ التصدير: ${data.generatedAt}</div>
      <h1>ملف المؤسسة: ${data.institutionName}</h1>
    </div>
    <div class="kpis">${kpiCards}</div>
    <h2>الهيكل الأكاديمي والسعة</h2>
    <table>
      <thead><tr><th>البيان</th><th>القيمة</th></tr></thead>
      <tbody>
        <tr><td>حد الطلبة (الباقة)</td><td>${data.studentLimit}</td></tr>
        <tr><td>حد الجلسات</td><td>${data.sessionLimit}</td></tr>
        <tr><td>نهاية الفترة الحالية</td><td>${data.periodEnd}</td></tr>
      </tbody>
    </table>
    <h2>أفواج المؤسسة</h2>
    <table>
      <thead><tr><th>الفوج</th><th>المستوى</th><th>الطلبة</th><th>نسبة الحضور</th><th>آخر جلسة</th></tr></thead>
      <tbody>${cohortRows}</tbody>
    </table>
    <h2>آخر النشاطات</h2>
    <table>
      <thead><tr><th>النشاط</th><th>التوقيت</th></tr></thead>
      <tbody>${activityRows}</tbody>
    </table>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `ملف_المؤسسة_${data.institutionName}_${dateSlug()}.pdf`);
}

export async function exportInstitutionReportExcel(data: InstitutionFileData): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ausar Military';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(data.institutionName.slice(0, 31), { views: [{ rightToLeft: true }] });
  sheet.addRow(['Ausar Military', `ملف المؤسسة: ${data.institutionName}`]);
  sheet.addRow(['تاريخ التصدير', data.generatedAt]);
  sheet.addRow([]);
  const kpis: [string, string | number][] = [
    ['الطلبة', data.students],
    ['الأفواج', data.cohorts],
    ['الجلسات', data.sessions],
    ['الحضور', `${data.attendanceRate}%`],
    ['الإدارة', data.admins],
    ['الأجهزة', data.devices],
    ['الخطة', data.planType || 'غير محددة'],
    ['الاشتراك', data.subscriptionStatus || 'غير محددة'],
    ['حد الطلبة', data.studentLimit],
    ['حد الجلسات', data.sessionLimit],
    ['نهاية الفترة الحالية', data.periodEnd],
  ];
  for (const [label, value] of kpis) {
    sheet.addRow([label, value]);
  }
  sheet.addRow([]);
  if (data.recentCohorts.length > 0) {
    const headerRow = sheet.addRow(['الفوج', 'المستوى', 'الطلبة', 'نسبة الحضور', 'آخر جلسة']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    });
    for (const cohort of data.recentCohorts) {
      sheet.addRow([cohort.name, cohort.level || '', cohort.students, `${cohort.rate}%`, cohort.lastSession || '']);
    }
  }
  sheet.addRow([]);
  if (data.recentActivities.length > 0) {
    const headerRow = sheet.addRow(['النشاط', 'التوقيت']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    });
    for (const entry of data.recentActivities) {
      sheet.addRow([entry.text, entry.time]);
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(buffer as ArrayBuffer, `ملف_المؤسسة_${data.institutionName}_${dateSlug()}.xlsx`);
}

export async function exportPeopleReportPDF(institutionName: string, peopleReportLabel: string, studentsCount: number, generatedAt: string): Promise<void> {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">تاريخ التصدير: ${generatedAt}</div>
      <h1>${peopleReportLabel}: ${institutionName}</h1>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="label">إجمالي السجلات</div><div class="value">${studentsCount}</div></div>
    </div>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `${peopleReportLabel}_${institutionName}_${dateSlug()}.pdf`);
}

export async function exportDevicesFileReportPDF(institutionName: string, devices: number, institutionsCount: number, generatedAt: string): Promise<void> {
  const avg = institutionsCount > 0 ? (devices / institutionsCount).toFixed(1) : '0';
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${RTL_CSS}</style></head><body>
    <div class="header">
      <div class="brand">Ausar Military</div>
      <div class="meta">تاريخ التصدير: ${generatedAt}</div>
      <h1>تقرير الأجهزة: ${institutionName}</h1>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="label">الأجهزة الموثقة</div><div class="value">${devices}</div></div>
      <div class="kpi"><div class="label">متوسط الأجهزة</div><div class="value">${avg}</div></div>
    </div>
    <div class="footer">تقرير مولّد آليًا من لوحة مالك المنصة — Ausar Military</div>
  </body></html>`;
  await saveHtmlAsPdf(html, `تقرير_الأجهزة_${institutionName}_${dateSlug()}.pdf`);
}

// -----------------------------------------------------------------------------
// أدوات مساعدة عامة
// -----------------------------------------------------------------------------
function dateSlug(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowGeneratedAt(): string {
  return new Date().toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' });
}

function downloadBlob(data: ArrayBuffer, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type { SectorRow, SectorExportData, AttendanceExportData, DevicesExportData, InstitutionFileData };
