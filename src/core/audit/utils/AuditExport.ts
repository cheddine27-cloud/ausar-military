import type { AuditRecord } from '../AuditTypes';

export const AuditExport = {
  /**
   * Generates a CSV string from audit records and triggers a browser download.
   */
  exportToCSV(records: AuditRecord[], filename = 'audit_logs_export.csv'): void {
    if (records.length === 0) return;

    // Define CSV columns
    const headers = [
      'Audit ID',
      'Module ID',
      'Action',
      'Actor Name',
      'Target Type',
      'Target ID',
      'Result',
      'Remarks',
      'IP Address',
      'Device Info',
      'Date/Time'
    ];

    // Map records to rows
    const rows = records.map((r) => [
      r.id,
      r.module_id,
      r.action,
      r.actor_name,
      r.target_type || '',
      r.target_id || '',
      r.result,
      `"${(r.remarks || '').replace(/"/g, '""')}"`,
      r.ip_address || '',
      r.device_info || '',
      new Date(r.created_at).toISOString()
    ]);

    // Construct CSV content (using BOM for proper Excel Arabic character encoding)
    const BOM = '\uFEFF';
    const csvContent =
      BOM +
      [headers.join(','), ...rows.map((row) => row.map((val) => `"${val}"`).join(','))].join('\n');

    // Trigger download in browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
};
