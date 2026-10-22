import { neutralizeSpreadsheetFormula } from './spreadsheetSafety';

export function safeRows(rows: string[][]) {
  return rows.map(row => row.map(neutralizeSpreadsheetFormula));
}
export function csvExport(rows: string[][]) {
  return '\uFEFF' + safeRows(rows).map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\r\n');
}
export function downloadExport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function xlsxExport(rows: string[][], sheetName: string) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRows(safeRows(rows));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  sheet.columns.forEach((column, i) => { column.width = i === 0 ? 25 : 30; });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function exportFilenamePart(value: string) {
  return Array.from(value, character => character.charCodeAt(0) < 32 || /[\\/:*?"<>|]/.test(character) ? '-' : character).join('');
}
