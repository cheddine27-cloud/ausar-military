// =============================================================================
// Phase 9 — Reports export utilities (Excel + PDF)
// =============================================================================
// We deliberately keep this file framework-agnostic and dynamic-import the
// heavy libraries (exceljs / html2pdf.js) so we don't blow up the main bundle.
// =============================================================================

import type {
  ReportSessionRow,
  ReportTeacherRow,
  ReportCohortRow,
  ReportJustificationRow,
  ReportsKpis,
} from './institutionAdminApi';

export type ReportType = 'attendance' | 'absences' | 'justifications' | 'teachers' | 'cohorts';

export interface ExportContext {
  institutionName: string;
  reportType: ReportType;
  reportTitle: string;
  dateFrom: string | null;
  dateTo: string | null;
  unitName: string | null;
  cohortName: string | null;
  teacherName: string | null;
  kpis: ReportsKpis;
  sessions: ReportSessionRow[];
  teachers: ReportTeacherRow[];
  cohorts: ReportCohortRow[];
  justifications: ReportJustificationRow[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ar-DZ');
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ar-DZ', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(s: ReportJustificationRow['status']): string {
  switch (s) {
    case 'pending': return 'قيد المراجعة';
    case 'approved': return 'مقبول';
    case 'rejected': return 'مرفوض';
    default: return s;
  }
}

function pickTableForType(ctx: ExportContext): { headers: string[]; rows: (string | number)[][] } {
  switch (ctx.reportType) {
    case 'attendance':
    case 'absences': {
      const headers = ['التاريخ', 'الجلسة', 'الرمز', 'الفوج', 'المسار الأكاديمي', 'الأستاذ', 'الحضور', 'مسجلون', 'النسبة %'];
      const rows = ctx.sessions.map((s) => [
        fmtDate(s.created_at),
        s.title,
        s.code,
        s.cohort_name ?? '—',
        s.unit_path.join(' / ') || '—',
        s.professor_name ?? '—',
        s.attendance_count,
        s.enrolled_in_cohort,
        s.attendance_rate,
      ]);
      return { headers, rows };
    }
    case 'teachers': {
      const headers = ['الأستاذ', 'الرتبة', 'القسم', 'الجلسات', 'الحضورات', 'طلاب فريدون', 'أفواج معيّنة'];
      const rows = ctx.teachers.map((t) => [
        t.full_name || t.username,
        t.rank ?? '—',
        t.department ?? '—',
        t.sessions_count,
        t.attendances_count,
        t.unique_students_reached,
        t.cohorts_assigned,
      ]);
      return { headers, rows };
    }
    case 'cohorts': {
      const headers = ['الفوج', 'المسار الأكاديمي', 'الطلاب', 'الجلسات', 'الحضورات', 'النسبة %'];
      const rows = ctx.cohorts.map((c) => [
        c.name,
        c.unit_path.join(' / ') || '—',
        c.students_count,
        c.sessions_count,
        c.attendances_count,
        c.attendance_rate,
      ]);
      return { headers, rows };
    }
    case 'justifications': {
      const headers = ['الطالب', 'الرقم', 'الفوج', 'المسار', 'السبب', 'الحالة', 'قُدِّم في', 'تمت المراجعة'];
      const rows = ctx.justifications.map((j) => [
        j.student_full_name ?? '—',
        j.student_number ?? '—',
        j.cohort_name ?? '—',
        j.unit_path.join(' / ') || '—',
        j.reason,
        statusLabel(j.status),
        fmtDateTime(j.created_at),
        fmtDateTime(j.reviewed_at),
      ]);
      return { headers, rows };
    }
  }
}

// -----------------------------------------------------------------------------
// Excel export (exceljs)
// -----------------------------------------------------------------------------

export async function exportReportToExcel(ctx: ExportContext): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ausar Military';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(ctx.reportTitle.slice(0, 31), {
    views: [{ rightToLeft: true }],
  });

  // Header block (rows 1..6)
  sheet.addRow(['Ausar Military', ctx.reportTitle]);
  sheet.addRow(['المؤسسة', ctx.institutionName]);
  const periodLabel = [
    ctx.dateFrom ? `من ${fmtDate(ctx.dateFrom)}` : null,
    ctx.dateTo ? `إلى ${fmtDate(ctx.dateTo)}` : null,
  ].filter(Boolean).join(' ');
  sheet.addRow(['الفترة', periodLabel || 'كل الفترات']);
  const scopeLabel = [
    ctx.unitName ? `وحدة: ${ctx.unitName}` : null,
    ctx.cohortName ? `فوج: ${ctx.cohortName}` : null,
    ctx.teacherName ? `أستاذ: ${ctx.teacherName}` : null,
  ].filter(Boolean).join(' • ');
  sheet.addRow(['النطاق', scopeLabel || 'كل المؤسسة']);
  sheet.addRow(['تاريخ التصدير', fmtDateTime(new Date().toISOString())]);
  sheet.addRow([]);

  // KPIs block
  sheet.addRow(['المؤشرات الرئيسية']);
  sheet.addRow(['إجمالي الجلسات',  ctx.kpis.totalSessions]);
  sheet.addRow(['إجمالي الحضورات', ctx.kpis.totalAttendances]);
  sheet.addRow(['إجمالي الغيابات', ctx.kpis.totalAbsences]);
  sheet.addRow(['نسبة الحضور %',   ctx.kpis.attendanceRate]);
  sheet.addRow(['تبريرات قيد المراجعة', ctx.kpis.pendingJustifications]);
  sheet.addRow(['تبريرات مقبولة',  ctx.kpis.approvedJustifications]);
  sheet.addRow(['تبريرات مرفوضة',  ctx.kpis.rejectedJustifications]);
  if (ctx.kpis.topAbsentCohort) {
    sheet.addRow(['الفوج الأكثر غياباً', `${ctx.kpis.topAbsentCohort.name} (${ctx.kpis.topAbsentCohort.absences})`]);
  }
  if (ctx.kpis.topActiveTeacher) {
    sheet.addRow(['الأستاذ الأكثر نشاطاً', `${ctx.kpis.topActiveTeacher.name} (${ctx.kpis.topActiveTeacher.sessions})`]);
  }
  sheet.addRow([]);

  // Style header bold
  for (let r = 1; r <= 5; r++) {
    sheet.getRow(r).getCell(1).font = { bold: true };
  }
  sheet.getRow(7).font = { bold: true, size: 13 };

  // Data block
  const { headers, rows } = pickTableForType(ctx);
  const headerRowIdx = sheet.rowCount + 1;
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  if (rows.length === 0) {
    sheet.addRow(['لا توجد بيانات للفترة والنطاق المحددَين']);
  } else {
    rows.forEach((r) => sheet.addRow(r));
  }

  // Auto width
  sheet.columns.forEach((col, idx) => {
    let max = headers[idx]?.length ?? 12;
    rows.forEach((r) => {
      const v = String(r[idx] ?? '');
      if (v.length > max) max = v.length;
    });
    col.width = Math.min(40, Math.max(12, max + 2));
  });

  // Borders for the data block
  if (rows.length > 0) {
    const lastRow = sheet.rowCount;
    for (let r = headerRowIdx; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        };
      });
    }
  }

  // Trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ctx.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------------
// PDF export (html2pdf.js — full Arabic RTL support)
// -----------------------------------------------------------------------------

function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportReportToPDF(ctx: ExportContext): Promise<void> {
  const { default: html2pdf } = await import('html2pdf.js');

  const { headers, rows } = pickTableForType(ctx);
  const periodLabel = [
    ctx.dateFrom ? `من ${fmtDate(ctx.dateFrom)}` : null,
    ctx.dateTo ? `إلى ${fmtDate(ctx.dateTo)}` : null,
  ].filter(Boolean).join(' ') || 'كل الفترات';
  const scopeLabel = [
    ctx.unitName ? `وحدة: ${ctx.unitName}` : null,
    ctx.cohortName ? `فوج: ${ctx.cohortName}` : null,
    ctx.teacherName ? `أستاذ: ${ctx.teacherName}` : null,
  ].filter(Boolean).join(' • ') || 'كل المؤسسة';

  const kpiCards: { label: string; value: string | number }[] = [
    { label: 'إجمالي الجلسات',       value: ctx.kpis.totalSessions },
    { label: 'إجمالي الحضورات',     value: ctx.kpis.totalAttendances },
    { label: 'إجمالي الغيابات',     value: ctx.kpis.totalAbsences },
    { label: 'نسبة الحضور',          value: `${ctx.kpis.attendanceRate}%` },
    { label: 'تبريرات قيد المراجعة', value: ctx.kpis.pendingJustifications },
    { label: 'تبريرات مقبولة',      value: ctx.kpis.approvedJustifications },
    { label: 'تبريرات مرفوضة',      value: ctx.kpis.rejectedJustifications },
  ];

  const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
          direction: rtl; text-align: right;
          padding: 20px; color: #1e293b;
        }
        .brand-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .brand { font-size: 22px; font-weight: 900; color: #4f46e5; }
        .meta { font-size: 11px; color: #64748b; }
        h1 { font-size: 18px; margin: 4px 0; }
        .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 16px; }
        .header table { width: 100%; font-size: 12px; }
        .header td { padding: 4px 8px; }
        .header td.k { color: #64748b; width: 28%; }
        .header td.v { color: #1e293b; font-weight: bold; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .kpi { background: #f1f5f9; border-radius: 8px; padding: 10px; text-align: center; }
        .kpi .label { font-size: 10px; color: #64748b; }
        .kpi .value { font-size: 18px; font-weight: 900; color: #1e293b; margin-top: 4px; }
        .top-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .top-card { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 12px; }
        .top-card.green { background: #d1fae5; border-left-color: #10b981; }
        table.data { width: 100%; border-collapse: collapse; font-size: 10px; }
        table.data th {
          background: #4f46e5; color: white; padding: 8px 6px;
          font-weight: bold; text-align: center; border: 1px solid #4338ca;
        }
        table.data td { padding: 6px; border: 1px solid #e2e8f0; text-align: center; vertical-align: middle; }
        table.data tr:nth-child(even) td { background: #f8fafc; }
        .empty { background: #fff7ed; padding: 24px; text-align: center; border-radius: 8px;
                 color: #c2410c; font-size: 13px; }
        .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="brand-row">
        <div class="brand">Ausar Military</div>
        <div class="meta">تاريخ التصدير: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
      </div>

      <div class="header">
        <h1>${escapeHtml(ctx.reportTitle)}</h1>
        <table>
          <tr><td class="k">المؤسسة</td><td class="v">${escapeHtml(ctx.institutionName)}</td></tr>
          <tr><td class="k">الفترة</td><td class="v">${escapeHtml(periodLabel)}</td></tr>
          <tr><td class="k">النطاق</td><td class="v">${escapeHtml(scopeLabel)}</td></tr>
        </table>
      </div>

      <div class="kpis">
        ${kpiCards.map((k) => `
          <div class="kpi">
            <div class="label">${escapeHtml(k.label)}</div>
            <div class="value">${escapeHtml(k.value)}</div>
          </div>
        `).join('')}
      </div>

      ${(ctx.kpis.topAbsentCohort || ctx.kpis.topActiveTeacher) ? `
        <div class="top-bar">
          ${ctx.kpis.topAbsentCohort ? `
            <div class="top-card">الفوج الأكثر غياباً: <strong>${escapeHtml(ctx.kpis.topAbsentCohort.name)}</strong> — ${ctx.kpis.topAbsentCohort.absences} غياب</div>
          ` : ''}
          ${ctx.kpis.topActiveTeacher ? `
            <div class="top-card green">الأستاذ الأكثر نشاطاً: <strong>${escapeHtml(ctx.kpis.topActiveTeacher.name)}</strong> — ${ctx.kpis.topActiveTeacher.sessions} جلسة</div>
          ` : ''}
        </div>
      ` : ''}

      ${rows.length === 0 ? `
        <div class="empty">لا توجد بيانات للفترة والنطاق المحددَين.</div>
      ` : `
        <table class="data">
          <thead>
            <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      `}

      <div class="footer">Ausar Military — منصة الحضور الذكي • ${escapeHtml(ctx.institutionName)}</div>
    </body>
    </html>
  `;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  await html2pdf()
    .set({
      margin: 8,
      filename: `${ctx.reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    })
    .from(wrapper)
    .save();

  document.body.removeChild(wrapper);
}
