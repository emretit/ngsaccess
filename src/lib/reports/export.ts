import { notify } from '@/lib/notify';
import { neutralizeSpreadsheetFormula } from '@/lib/spreadsheetSafety';
import type { ReportColumn, ReportDefinition, ReportFormat } from './registry';
import { formatReportDate, type ReportRow } from './rows';
export const PDF_MAX_ROWS = 2000;
export const PDF_ROW_LIMIT_MESSAGE = 'PDF en fazla 2.000 satır destekler; daha büyük raporlar için Excel kullanın.';
/** Hidden identifiers stay hidden; every horizontal part repeats visible identifiers. */
export function pdfColumnChunks(columns: readonly ReportColumn[], pinnedColumns?: readonly string[]): ReportColumn[][] {
  if (columns.length === 0) return [];
  const pinnedKeys = pinnedColumns ?? [columns[0].key];
  const pinned = columns.filter(column => pinnedKeys.includes(column.key));
  const remaining = columns.filter(column => !pinnedKeys.includes(column.key));
  const capacity = Math.max(1, 7 - pinned.length);
  if (remaining.length === 0) return [pinned];
  const chunks: ReportColumn[][] = [];
  for (let i = 0; i < remaining.length; i += capacity) chunks.push([...pinned, ...remaining.slice(i, i + capacity)]);
  return chunks;
}
export interface ReportExportMeta { from: string; to: string; projectName?: string; columns: readonly ReportColumn[] }
function safeSpreadsheetValue(value: string | number | null): string | number {
  if (typeof value === 'number') return value;
  return neutralizeSpreadsheetFormula(value ?? '');
}
export function buildCsv(columns: readonly ReportColumn[], rows: readonly ReportRow[]): string {
  const escape = (value: string | number | null) => {
    const text = String(safeSpreadsheetValue(value));
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '\uFEFF' + [columns.map(column => escape(column.label)).join(';'), ...rows.map(row => columns.map(column => escape(column.value(row))).join(';'))].join('\r\n');
}
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Canvas uses the installed system font, preserving Turkish glyphs in every PDF viewer. */
async function exportPdf(def: ReportDefinition, rows: readonly ReportRow[], meta: ReportExportMeta, filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const width = 1684, height = 1190, margin = 60, rowHeight = 56;
  const chunks = pdfColumnChunks(meta.columns, def.pinnedColumns);
  let pageNumber = 0;
  for (const columns of chunks) {
    const colWidth = (width - margin * 2) / columns.length;
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    let y = 0;
    const wrap = (value: string): string[] => {
      const lines: string[] = []; let line = '';
      if (!ctx) throw new Error('PDF için çizim alanı oluşturulamadı.');
      for (const character of value.replace(/[\r\n]+/g, ' ')) {
        if (ctx.measureText(line + character).width > colWidth - 20 && line) { lines.push(line); line = ''; }
        line += character;
      }
      return [...lines, line];
    };
    const drawCells = (cells: string[][], start: number, count: number, top: number) => {
      if (!ctx) return;
      const context = ctx;
      cells.forEach((lines, i) => lines.slice(start, start + count).forEach((line, index) => context.fillText(line, margin + i * colWidth + 10, top + 23 + index * 24)));
    };
    const startPage = () => {
      canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('PDF için çizim alanı oluşturulamadı.');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#252523'; ctx.font = '600 30px system-ui'; ctx.fillText(def.title, margin, 65);
      ctx.font = '19px system-ui'; ctx.fillText(`${meta.projectName ?? ''} · ${formatReportDate(meta.from)} – ${formatReportDate(meta.to)} · İstanbul saati (UTC+3)`, margin, 104);
      ctx.font = '600 18px system-ui';
      const headers = columns.map(column => wrap(column.label));
      const headerLines = Math.max(...headers.map(lines => lines.length));
      const headerHeight = Math.max(rowHeight, headerLines * 24 + 16);
      ctx.fillStyle = '#f3f3f2'; ctx.fillRect(margin, 135, width - margin * 2, headerHeight);
      ctx.fillStyle = '#252523'; drawCells(headers, 0, headerLines, 135);
      ctx.font = '19px system-ui'; y = 135 + headerHeight;
    };
    const finishPage = () => {
      if (!ctx) return;
      ctx.fillStyle = '#646461'; ctx.font = '18px system-ui'; ctx.fillText(`Sayfa ${pageNumber + 1} · ${rows.length} kayıt`, margin, height - 35);
      if (pageNumber > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      pageNumber += 1;
    };
    startPage();
    for (const row of rows) {
      const cells = columns.map(column => wrap(String(column.value(row) ?? '—')));
      const maxLines = Math.max(...cells.map(lines => lines.length));
      const fullHeight = Math.max(rowHeight, maxLines * 24 + 16);
      if (y + fullHeight > height - 75 && y > 220) { finishPage(); startPage(); }
      let line = 0;
      while (line < maxLines) {
        const capacity = Math.max(1, Math.floor((height - 75 - y - 16) / 24));
        const count = Math.min(capacity, maxLines - line);
        const cellHeight = Math.max(rowHeight, count * 24 + 16);
        drawCells(cells, line, count, y);
        if (ctx) {
          ctx.strokeStyle = '#e2e2e0'; ctx.beginPath(); ctx.moveTo(margin, y + cellHeight); ctx.lineTo(width - margin, y + cellHeight); ctx.stroke();
        }
        y += cellHeight; line += count;
        if (line < maxLines) { finishPage(); startPage(); }
      }
    }
    finishPage();
  }
  pdf.save(filename);
}
export async function exportReport(format: ReportFormat, def: ReportDefinition, rows: readonly ReportRow[], meta: ReportExportMeta): Promise<void> {
  if (format === 'pdf' && rows.length > PDF_MAX_ROWS) { notify.info(PDF_ROW_LIMIT_MESSAGE); return; }
  const ext = format === 'excel' ? 'xlsx' : format;
  const filename = `rapor-${def.slug}-${meta.from}_${meta.to}.${ext}`;
  if (format === 'csv') { download(new Blob([buildCsv(meta.columns, rows)], { type: 'text/csv;charset=utf-8' }), filename); return; }
  if (format === 'pdf') { await exportPdf(def, rows, meta, filename); return; }
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Rapor', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.addRow([def.title]); sheet.addRow([meta.projectName ?? '', `${formatReportDate(meta.from)} – ${formatReportDate(meta.to)}`, 'İstanbul saati (UTC+3)']); sheet.addRow([]);
  const excelColumns = excelReportColumns(meta.columns);
  sheet.addRow(excelColumns.map(column => column.fullLabel ?? column.label));
  rows.forEach(row => sheet.addRow(excelColumns.map(column => safeSpreadsheetValue(column.value(row)))));
  sheet.getRow(4).font = { bold: true };
  sheet.columns.forEach((column, index) => { const reportColumn = excelColumns[index]; column.width = reportColumn?.key.startsWith('day:') ? 12 : reportColumn?.key === 'name' ? 28 : 22; });
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

export function excelReportColumns(columns: readonly ReportColumn[]): ReportColumn[] {
  return columns.flatMap(column => column.minutesValue ? [column, { key: `${column.key}:minutes`, label: `${column.fullLabel ?? column.label} (dk)`, defaultVisible: true, value: column.minutesValue }] : [column]);
}
