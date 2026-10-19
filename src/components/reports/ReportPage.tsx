import { useState, type ReactNode } from 'react';
import { Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import { PaginationBar, pageRange } from '@/components/shared/PaginationBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { STATUS_META } from '@/components/pdks/statusMeta';
import { notify } from '@/lib/notify';
import { PDF_MAX_ROWS, PDF_ROW_LIMIT_MESSAGE, exportReport, type ReportExportMeta } from '@/lib/reports/export';
import { reportColumns, type ReportDefinition, type ReportFormat } from '@/lib/reports/registry';
import { readHiddenColumns, saveHiddenColumns, toggleHiddenColumn } from '@/lib/reports/columns';
import type { ReportRow } from '@/lib/reports/rows';

export interface ReportPageProps {
  definition: ReportDefinition; rows: readonly ReportRow[]; days?: readonly string[];
  meta: Omit<ReportExportMeta, 'columns'>; loading?: boolean; loadedCount?: number; children?: ReactNode;
}
export function ReportPage({ definition, rows, days, meta, loading = false, loadedCount, children }: ReportPageProps) {
  const columns = reportColumns(definition, days);
  const [hidden, setHidden] = useState(() => readHiddenColumns(definition.slug));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const visible = columns.filter(column => !column.exportOnly && !hidden.includes(column.key) && (column.defaultVisible || hidden.includes(`show:${column.key}`)));
  const pdfOverLimit = rows.length > PDF_MAX_ROWS;
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pageCount);
  const toggle = (key: string, defaultVisible: boolean) => {
    const next = toggleHiddenColumn(hidden, key, defaultVisible);
    setHidden(next); saveHiddenColumns(definition.slug, next);
  };
  const runExport = async (format: ReportFormat) => {
    if (exporting) return;
    setExporting(true);
    try { await exportReport(format, definition, rows, { ...meta, columns: visible }); }
    catch (error: unknown) { notify.error('Rapor dışa aktarılamadı', error); }
    finally { setExporting(false); }
  };
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground" role="status">{loadedCount === undefined ? `${rows.length} kayıt` : `Yüklenen ${loadedCount} kayıt${rows.length !== loadedCount ? ` · Filtreye uyan ${rows.length}` : ''}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 className="mr-2 h-4 w-4" aria-hidden="true" />Kolonlar</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 max-w-[calc(100vw-32px)] overflow-y-auto"><DropdownMenuLabel>Görünür kolonlar</DropdownMenuLabel>{columns.filter(column => !column.exportOnly).map(column => <DropdownMenuCheckboxItem key={column.key} checked={visible.some(item => item.key === column.key)} disabled={visible.length === 1 && visible[0]?.key === column.key} onSelect={event => event.preventDefault()} onCheckedChange={() => toggle(column.key, column.defaultVisible)}>{column.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={loading || rows.length === 0 || visible.length === 0 || exporting}><Download className="mr-2 h-4 w-4" aria-hidden="true" />{exporting ? 'Hazırlanıyor…' : 'Dışa aktar'}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">{definition.formats.map(format => <DropdownMenuItem key={format} disabled={format === 'pdf' && pdfOverLimit} title={format === 'pdf' && pdfOverLimit ? PDF_ROW_LIMIT_MESSAGE : undefined} onSelect={() => { void runExport(format); }}>{format === 'pdf' && pdfOverLimit ? 'PDF (en fazla 2.000 satır)' : ({ excel: 'Excel (.xlsx)', csv: 'CSV', pdf: 'PDF' })[format]}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    {pdfOverLimit && definition.formats.includes('pdf') && <p className="text-xs text-muted-foreground">{PDF_ROW_LIMIT_MESSAGE}</p>}
    {loading ? <SectionSkeleton rows={5} label="Rapor yükleniyor…" /> : rows.length === 0 ? <EmptyState title="Kayıt bulunamadı" description="Bu dönem ve filtrelerle eşleşen kayıt yok. Filtreleri değiştirebilirsiniz." /> : <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
      <Table aria-label={definition.title}><TableHeader><TableRow>{visible.map(column => <TableHead scope="col" key={column.key} className={`whitespace-nowrap ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.slice((currentPage - 1) * 50, currentPage * 50).map(row => <TableRow key={row.id}>{visible.map(column => <TableCell key={column.key} className={`whitespace-nowrap tabular-nums ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
          {column.key === 'status' && row.kind === 'daily' ? <StatusBadge tone={STATUS_META[row.cell.status].tone}>{STATUS_META[row.cell.status].label}</StatusBadge> : column.key === 'result' && row.kind === 'transaction' ? <StatusBadge tone={row.transaction.result === 'granted' ? 'success' : row.transaction.result === 'denied' ? 'danger' : 'neutral'}>{column.value(row) ?? '—'}</StatusBadge> : column.value(row) ?? '—'}
        </TableCell>)}</TableRow>)}</TableBody></Table>
      <PaginationBar summary={`${pageRange(rows.length, currentPage, 50)} / ${rows.length} kayıt`} page={currentPage} pageCount={pageCount} onPrevious={() => setPage(Math.max(1, currentPage - 1))} onNext={() => setPage(Math.min(pageCount, currentPage + 1))} />
    </div>}
    {children}
  </div>;
}
