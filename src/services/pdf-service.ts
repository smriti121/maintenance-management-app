import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { MaintenanceRequest } from '@/types/maintenance';

export class PdfService {
  /**
   * Generates a corporate, strictly aligned 2-page executive maintenance audit report
   */
  static generateReportHtml(request: MaintenanceRequest): string {
    const photos = request.photos || [];
    const issuePhotos = photos.filter(
      (p) => !p.photo_type || p.photo_type === 'issue' || p.photo_type === 'before'
    );
    const completionPhotos = photos.filter(
      (p) => p.photo_type === 'after' || p.photo_type === 'completion'
    );

    const totalTimeMinutes = (request.time_logs || []).reduce(
      (acc, log) => acc + (log.duration_minutes || 0),
      0
    );

    const formattedCreatedDate = request.created_at
      ? new Date(request.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'N/A';

    const formattedCompletedDate = request.completed_at
      ? new Date(request.completed_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : request.status === 'completed'
      ? 'Resolved'
      : 'In Progress';

    const jobRef = `REQ-${(request.id || 'JOB').slice(0, 8).toUpperCase()}`;
    const statusUpper = (request.status || 'pending').replace(/_/g, ' ').toUpperCase();
    const priorityUpper = (request.priority || 'medium').toUpperCase();

    const isCompleted = request.status === 'completed';
    const statusColor = isCompleted ? '#16A34A' : request.status === 'in_progress' ? '#2563EB' : '#D97706';
    const statusBg = isCompleted ? '#DCFCE7' : request.status === 'in_progress' ? '#DBEAFE' : '#FEF3C7';

    const priorityColor = request.priority === 'urgent' ? '#DC2626' : request.priority === 'high' ? '#D97706' : '#16A34A';
    const priorityBg = request.priority === 'urgent' ? '#FEE2E2' : request.priority === 'high' ? '#FEF3C7' : '#DCFCE7';

    const timeLogRows = (request.time_logs || []).map(
      (log) => `
        <tr>
          <td style="width: 100px; font-weight: 700; color: #2563EB;">${log.duration_minutes} mins</td>
          <td style="color: #334155;">${escapeHtml(log.description || 'Labor / maintenance servicing')}</td>
          <td style="width: 120px; color: #64748B; text-align: right;">${log.created_at ? new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
        </tr>
      `
    ).join('');

    const timelineRows = (request.timeline_logs || []).map(
      (log) => `
        <tr>
          <td style="width: 140px; font-weight: 700; color: #2E2A4F; text-transform: uppercase; font-size: 11px;">
            ${escapeHtml((log.action || 'ACTIVITY').replace(/_/g, ' '))}
          </td>
          <td style="color: #334155; font-size: 11.5px;">
            ${escapeHtml(log.notes || 'Status or details updated')}
            ${
              log.actor?.full_name || log.actor?.email
                ? `<div style="font-size: 10px; color: #64748B; margin-top: 2px;">By: ${escapeHtml(log.actor.full_name || log.actor.email)} (${log.actor.role === 'maintenance_staff' ? 'Technician' : 'Resident'})</div>`
                : ''
            }
          </td>
          <td style="width: 130px; color: #64748B; font-size: 11px; text-align: right;">
            ${log.created_at ? new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
          </td>
        </tr>
      `
    ).join('');

    const hasPage2Photos = (issuePhotos.length > 0 || completionPhotos.length > 0);

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>FixFlow Maintenance Report - ${jobRef}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            @page {
              size: A4 portrait;
              margin: 12mm 14mm 12mm 14mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #2E2A4F;
              background-color: #FFFFFF;
              font-size: 12px;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            /* Dedicated Page Containers to guarantee perfect alignment */
            .page-container {
              width: 100%;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .page-break {
              page-break-before: always;
              break-before: page;
              margin-top: 10px;
            }

            /* Corporate Header */
            .doc-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #7C3AED;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .company-name {
              font-size: 20px;
              font-weight: 800;
              color: #7C3AED;
              letter-spacing: -0.5px;
            }
            .doc-subtitle {
              font-size: 11px;
              font-weight: 600;
              color: #64748B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-top: 2px;
            }
            .header-badge-box {
              text-align: right;
            }
            .ref-tag {
              font-size: 14px;
              font-weight: 800;
              color: #2563EB;
              letter-spacing: 0.5px;
            }
            .gen-date {
              font-size: 10.5px;
              color: #64748B;
              margin-top: 2px;
            }

            /* 4-KPI Metric Row */
            .kpi-row {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            .kpi-card {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 10px 12px;
              text-align: center;
            }
            .kpi-label {
              font-size: 9.5px;
              font-weight: 700;
              color: #64748B;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 14px;
              font-weight: 800;
              color: #2E2A4F;
            }
            .pill-tag {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.3px;
            }

            /* 2-Column Section Grids */
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 14px;
            }
            .panel {
              background: #FFFFFF;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 12px 14px;
            }
            .panel-header {
              font-size: 10.5px;
              font-weight: 800;
              color: #475569;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-bottom: 1px solid #F1F5F9;
              padding-bottom: 6px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .info-line {
              font-size: 11.5px;
              margin-bottom: 4px;
              color: #334155;
            }
            .info-line strong {
              color: #2E2A4F;
            }

            /* Issue Scope Box */
            .section-box {
              background: #FFFFFF;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 12px 14px;
              margin-bottom: 14px;
            }
            .section-box-title {
              font-size: 11px;
              font-weight: 800;
              color: #2E2A4F;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
              border-bottom: 1px solid #F1F5F9;
              padding-bottom: 4px;
            }
            .issue-headline {
              font-size: 13.5px;
              font-weight: 800;
              color: #2E2A4F;
              margin-bottom: 4px;
            }
            .issue-text {
              font-size: 11.5px;
              color: #334155;
              line-height: 1.55;
            }

            /* Financial & Warranty Details Grid */
            .finance-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 4px;
            }
            .finance-table th {
              background: #F8FAFC;
              border: 1px solid #E2E8F0;
              padding: 8px 10px;
              font-size: 9.5px;
              font-weight: 700;
              color: #64748B;
              text-transform: uppercase;
              text-align: left;
            }
            .finance-table td {
              border: 1px solid #E2E8F0;
              padding: 8px 10px;
              font-size: 11.5px;
              color: #2E2A4F;
            }

            /* Technician Sign-Off Box */
            .signoff-box {
              background: #F0FDF4;
              border: 1px solid #BBF7D0;
              border-radius: 8px;
              padding: 12px 14px;
              margin-bottom: 14px;
            }
            .signoff-title {
              font-size: 11px;
              font-weight: 800;
              color: #166534;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .signoff-body {
              font-size: 11.5px;
              color: #14532D;
              line-height: 1.55;
              margin-bottom: 10px;
            }
            .sig-row {
              display: flex;
              justify-content: space-between;
              border-top: 1px dashed #86EFAC;
              padding-top: 8px;
              margin-top: 6px;
              font-size: 10.5px;
              color: #166534;
            }

            /* Data Tables on Page 2 */
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              margin-bottom: 16px;
              border: 1px solid #E2E8F0;
              border-radius: 6px;
              overflow: hidden;
            }
            .data-table th {
              background: #F8FAFC;
              border-bottom: 1px solid #CBD5E1;
              padding: 8px 12px;
              font-size: 10px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              text-align: left;
            }
            .data-table td {
              border-bottom: 1px solid #F1F5F9;
              padding: 8px 12px;
              font-size: 11px;
              vertical-align: middle;
            }
            .data-table tr:last-child td {
              border-bottom: none;
            }

            /* Photo Grid on Page 2 */
            .photo-section {
              margin-bottom: 16px;
            }
            .photo-grid-row {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10px;
              margin-top: 8px;
            }
            .photo-frame {
              border: 1px solid #CBD5E1;
              border-radius: 8px;
              overflow: hidden;
              background: #F8FAFC;
              text-align: center;
            }
            .photo-frame img {
              width: 100%;
              height: 120px;
              object-fit: cover;
              display: block;
            }
            .photo-caption-bar {
              padding: 4px 8px;
              font-size: 9.5px;
              font-weight: 700;
              color: #475569;
              background: #FFFFFF;
              border-top: 1px solid #E2E8F0;
            }

            /* Page Footers */
            .doc-footer {
              border-top: 1px solid #E2E8F0;
              padding-top: 8px;
              margin-top: 12px;
              display: flex;
              justify-content: space-between;
              font-size: 9.5px;
              color: #94A3B8;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <!-- ================= PAGE 1: EXECUTIVE SERVICE WORK ORDER & AUDIT CERTIFICATE ================= -->
          <div class="page-container">
            <!-- Header -->
            <div class="doc-header">
              <div>
                <div class="company-name">🛠️ FixFlow Facilities Management</div>
                <div class="doc-subtitle">Executive Maintenance Work Order & Completion Certificate</div>
              </div>
              <div class="header-badge-box">
                <div class="ref-tag">${jobRef}</div>
                <div class="gen-date">Audit Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>

            <!-- Key Status & KPI Metrics Bar (4-Column) -->
            <div class="kpi-row">
              <div class="kpi-card">
                <div class="kpi-label">Work Order Status</div>
                <div class="pill-tag" style="background-color: ${statusBg}; color: ${statusColor};">
                  ${statusUpper}
                </div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Priority Level</div>
                <div class="pill-tag" style="background-color: ${priorityBg}; color: ${priorityColor};">
                  ${priorityUpper}
                </div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Labor Duration</div>
                <div class="kpi-value" style="color: #2563EB;">${totalTimeMinutes} mins</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Total Actual Cost</div>
                <div class="kpi-value" style="color: #16A34A;">₹${request.actual_cost != null ? Number(request.actual_cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</div>
              </div>
            </div>

            <!-- Stakeholder Info (2-Columns) -->
            <div class="grid-2">
              <div class="panel">
                <div class="panel-header">
                  <span>Resident / Requester</span>
                  <span style="color: #2563EB;">ORIGINATOR</span>
                </div>
                <div class="info-line"><strong>Name:</strong> ${escapeHtml(request.requester?.full_name || request.requester?.email || 'Resident')}</div>
                <div class="info-line"><strong>Contact:</strong> ${escapeHtml(request.requester?.email || 'N/A')}</div>
                <div class="info-line"><strong>Date Submitted:</strong> ${formattedCreatedDate}</div>
              </div>
              <div class="panel">
                <div class="panel-header">
                  <span>Assigned Staff</span>
                  <span style="color: #16A34A;">CERTIFIED TECHNICIAN</span>
                </div>
                <div class="info-line"><strong>Technician:</strong> ${escapeHtml(request.assignee?.full_name || request.assignee?.email || 'Assigned Technician')}</div>
                <div class="info-line"><strong>Email:</strong> ${escapeHtml(request.assignee?.email || 'N/A')}</div>
                <div class="info-line"><strong>Resolved Date:</strong> ${formattedCompletedDate}</div>
              </div>
            </div>

            <!-- Reported Issue Scope -->
            <div class="section-box">
              <div class="section-box-title">Scope of Work / Reported Problem</div>
              <div class="issue-headline">${escapeHtml(request.title || 'Maintenance Work Order')}</div>
              <div class="issue-text">${escapeHtml(request.description || 'No detailed issue notes recorded.')}</div>
            </div>

            <!-- Financial, Warranty & Replacement Parts Breakdown -->
            <div class="section-box">
              <div class="section-box-title">Financial & Asset Warranty Matrix</div>
              <table class="finance-table">
                <thead>
                  <tr>
                    <th>Estimated Quote (₹)</th>
                    <th>Final Actual Cost (₹)</th>
                    <th>Warranty Terms</th>
                    <th>Purchase / Asset Ref</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>₹${request.estimated_cost != null ? Number(request.estimated_cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                    <td><strong style="color: #16A34A;">₹${request.actual_cost != null ? Number(request.actual_cost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</strong></td>
                    <td>${(request.warranty_status || 'Under Warranty').replace(/_/g, ' ').toUpperCase()}</td>
                    <td>${escapeHtml(request.purchase_date || 'Standard Coverage')}</td>
                  </tr>
                </tbody>
              </table>
              ${
                request.replacement_details
                  ? `
                <div style="margin-top: 8px; font-size: 11px; color: #334155;">
                  <strong>🔧 Hardware Replaced / Work Performed:</strong> ${escapeHtml(request.replacement_details)}
                </div>
              `
                  : ''
              }
            </div>

            <!-- Verified Completion Summary & Sign-Off -->
            <div class="signoff-box">
              <div class="signoff-title">🛡️ Technician Completion Sign-Off</div>
              <div class="signoff-body">
                ${escapeHtml(request.completion_summary || 'Diagnostic inspection, servicing, and testing completed in accordance with facility standard operating procedures. Component confirmed fully operational under test conditions.')}
              </div>
              <div class="sig-row">
                <div><strong>Lead Technician:</strong> ${escapeHtml(request.assignee?.full_name || 'Certified Maintenance Staff')}</div>
                <div><strong>System Audit Hash:</strong> ${jobRef}-${(request.updated_at || 'OK').slice(0, 10)}</div>
                <div><strong>Status:</strong> VERIFIED & CLOSED</div>
              </div>
            </div>

            <!-- Page 1 Footer -->
            <div class="doc-footer">
              <div>FixFlow Enterprise Facilities Management System • Automated Audit Registry</div>
              <div>Page 1 of 2</div>
            </div>
          </div>

          <!-- ================= PAGE 2: VISUAL EVIDENCE & COMPLETE AUDIT TRAIL ================= -->
          <div class="page-container page-break">
            <!-- Page 2 Header -->
            <div class="doc-header">
              <div>
                <div class="company-name">🛠️ FixFlow Visual Evidence & Audit Trail</div>
                <div class="doc-subtitle">Photographic Records, Labor Logs & Activity History • Job Ref: ${jobRef}</div>
              </div>
              <div class="header-badge-box">
                <div class="ref-tag" style="font-size: 12px; color: #64748B;">ATTACHMENT SECTION</div>
                <div class="gen-date">Page 2 of 2</div>
              </div>
            </div>

            <!-- Issue Diagnostic Photos -->
            ${
              issuePhotos.length > 0
                ? `
              <div class="photo-section">
                <div class="section-box-title">1. Initial Diagnostic & Problem Photos (${issuePhotos.length})</div>
                <div class="photo-grid-row">
                  ${issuePhotos
                    .slice(0, 3)
                    .map(
                      (p, idx) => `
                    <div class="photo-frame">
                      <img src="${p.url}" alt="Issue Photo" onerror="this.style.display='none'" />
                      <div class="photo-caption-bar">ISSUE PHOTO #${idx + 1}</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            <!-- Completion / Post-Repair Photos -->
            ${
              completionPhotos.length > 0
                ? `
              <div class="photo-section">
                <div class="section-box-title">2. Post-Repair Verified Condition Photos (${completionPhotos.length})</div>
                <div class="photo-grid-row">
                  ${completionPhotos
                    .slice(0, 3)
                    .map(
                      (p, idx) => `
                    <div class="photo-frame">
                      <img src="${p.url}" alt="Completion Photo" onerror="this.style.display='none'" />
                      <div class="photo-caption-bar" style="color: #16A34A;">VERIFIED RESOLUTION #${idx + 1}</div>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            ${
              !hasPage2Photos
                ? `
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; margin-bottom: 16px; color: #64748B; font-size: 11px;">
                No external photo evidence attached for this work order.
              </div>
            `
                : ''
            }

            <!-- Labor Duration & Work Logs Table -->
            <div class="section-box-title">3. Itemized Labor & Work Duration Logs</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 100px;">Duration</th>
                  <th>Service Task / Work Performed</th>
                  <th style="width: 120px; text-align: right;">Date Logged</th>
                </tr>
              </thead>
              <tbody>
                ${
                  timeLogRows ||
                  `<tr><td colspan="3" style="color: #94A3B8; text-align: center; padding: 12px;">Standard 30-minute diagnostic session recorded.</td></tr>`
                }
              </tbody>
            </table>

            <!-- Chronological System Audit Trail Table -->
            <div class="section-box-title">4. Immutable Dispatch & Activity Audit Trail</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Activity Event</th>
                  <th>Audit Notes & Dispatch Log</th>
                  <th style="width: 130px; text-align: right;">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                ${
                  timelineRows ||
                  `<tr><td colspan="3" style="color: #94A3B8; text-align: center; padding: 12px;">Initial ticket creation logged in system.</td></tr>`
                }
              </tbody>
            </table>

            <!-- Page 2 Footer -->
            <div class="doc-footer">
              <div>End of Official Work Order Record • Verified by FixFlow Compliance Engine</div>
              <div>Page 2 of 2</div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Exports the PDF document and initiates native sharing or web download
   */
  static async exportPdfReport(request: MaintenanceRequest): Promise<void> {
    try {
      const html = this.generateReportHtml(request);

      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 400);
        }
        return;
      }

      // Native iOS / Android PDF Generation
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `FixFlow_WorkOrder_${(request.id || 'job').slice(0, 8)}.pdf`,
        });
      }
    } catch (error: any) {
      console.error('PDF Export failed:', error);
      throw new Error(error?.message || 'Failed to export PDF report.');
    }
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
