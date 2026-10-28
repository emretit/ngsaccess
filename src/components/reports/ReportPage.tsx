import { useAuth } from '@/components/auth/AuthProvider';
import { useState, type ReactNode } from 'react';
import { Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableStateRow } from '@/components/shared/TableStateRow';
import { periodError } from '@/lib/reports/period';
import { PaginationBar, pageRange } from '@/components/shared/PaginationBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { STATUS_META } from '@/components/pdks/statusMeta';
import { notify } from '@/lib/notify';
import { PDF_MAX_ROWS, PDF_ROW_LIMIT_MESSAGE, exportReport, type ReportExportMeta } from '@/lib/reports/export';
import { reportColumns, type ReportDefinition, type ReportFormat } from '@/lib/reports/registry';
import { readHiddenColumns, saveHiddenColumns, toggleHiddenColumn, type ColumnScope } from '@/lib/reports/columns';
import type { ReportRow } from '@/lib/reports/rows';

export interface ReportPageProps {
  definition: ReportDefinition; rows: readonly ReportRow[]; days?: readonly string[];
  projectId?: string; onClear?: () => void; meta: Omit<ReportExportMeta, 'columns'>; loading?: boolean; hasMoreTransactions?: boolean; loadedCount?: number; children?: ReactNode;
}
export function ReportPage(props: ReportPageProps) {
  const { profile } = useAuth();
  const scope = props.projectId && profile?._id ? { projectId: props.projectId, userId: profile._id } : undefined;
  return <ReportTable key={`${scope?.projectId}:${scope?.userId}:${props.definition.slug}`} {...props} scope={scope} />;
}
function ReportTable({ definition, rows, days, meta, loading = false, hasMoreTransactions = false, loadedCount, children, onClear, scope }: ReportPageProps & { scope?: ColumnScope }) {
  const periodDays = definition.monthlyDays && !periodError(meta.from, meta.to)
    ? Array.from({ length: (Date.parse(`${meta.to}T00:00:00Z`) - Date.parse(`${meta.from}T00:00:00Z`)) / 86400000 + 1 }, (_, index) => new Date(Date.parse(`${meta.from}T00:00:00Z`) + index * 86400000).toISOString().slice(0, 10))
    : [];
  const columns = reportColumns(definition, days?.length ? days : periodDays);
  const [hidden, setHidden] = useState(() => readHiddenColumns(definition.slug, scope));
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const visible = columns.filter(column => !column.exportOnly && !hidden.includes(column.key) && (column.defaultVisible || hidden.includes(`show:${column.key}`)));
  const pdfOverLimit = rows.length > PDF_MAX_ROWS;
  const pageCount = Math.max(1, Math.ceil(rows.length / 50));
  const currentPage = Math.min(page, pageCount);
  const toggle = (key: string, defaultVisible: boolean) => {
    const next = toggleHiddenColumn(hidden, key, defaultVisible);
    setHidden(next); saveHiddenColumns(definition.slug, next, scope);
  };
  const runExport = async (format: ReportFormat) => {
    if (exporting) return;
    setExporting(true);
    try { await exportReport(format, definition, rows, { ...meta, columns: visible, days: days ?? meta.days }); }
    catch (error: unknown) { notify.error('Rapor dışa aktarılamadı', error); }
    finally { setExporting(false); }
  };
  const emptyTitle = ({ devamsizlar: 'Bu dönemde devamsız kişi yok.', 'erken-cikanlar': 'Bu dönemde erken çıkan kişi yok.', mola: 'Bu dönemde mola kaydı yok.', 'gec-kalanlar': 'Bu dönemde geç kalan kişi yok.' } as Record<string, string>)[definition.slug] ?? 'Kayıt bulunamadı';
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground" role="status">{loadedCount === undefined ? `${rows.length} kayıt` : `Yüklenen ${loadedCount} kayıt${rows.length !== loadedCount ? ` · Filtreye uyan ${rows.length}` : ''}`}</p>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Columns3 className="mr-2 h-4 w-4" aria-hidden="true" />Kolonlar</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 max-w-[calc(100vw-32px)] overflow-y-auto"><DropdownMenuLabel>Görünür kolonlar</DropdownMenuLabel>{columns.filter(column => !column.exportOnly).map(column => <DropdownMenuCheckboxItem key={column.key} checked={visible.some(item => item.key === column.key)} disabled={visible.length === 1 && visible[0]?.key === column.key} onSelect={event => event.preventDefault()} onCheckedChange={() => toggle(column.key, column.defaultVisible)}>{column.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={loading || rows.length === 0 || visible.length === 0 || exporting}><Download className="mr-2 h-4 w-4" aria-hidden="true" />{exporting ? 'Hazırlanıyor…' : 'Dışa aktar'}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">{definition.formats.map(format => <DropdownMenuItem key={format} disabled={format === 'pdf' && pdfOverLimit} title={format === 'pdf' && pdfOverLimit ? PDF_ROW_LIMIT_MESSAGE : undefined} onSelect={() => { void runExport(format); }}>{format === 'pdf' && pdfOverLimit ? 'PDF (en fazla 2.000 satır)' : reportExportLabel(format, definition)}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    {pdfOverLimit && definition.formats.includes('pdf') && <p className="text-xs text-muted-foreground">{PDF_ROW_LIMIT_MESSAGE}</p>}
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface">
      <Table aria-label={definition.title}><TableHeader><TableRow>{visible.map(column => <TableHead scope="col" key={column.key} title={column.fullLabel} aria-label={column.fullLabel} className={`${column.key === 'name' ? 'sticky left-0 z-20 bg-surface' : ''} whitespace-nowrap ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>{column.label}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{loading ? <TableStateRow colSpan={Math.max(1, visible.length)} state="loading" label="Rapor yükleniyor…" /> : rows.length === 0 ? hasMoreTransactions ? <TableStateRow colSpan={Math.max(1, visible.length)} state="custom"><p role="status" className="text-sm text-muted-foreground">Taranan kayıtlarda eşleşme yok. Daha eski kayıtlar için “Daha fazla yükle”.</p></TableStateRow> : <TableStateRow colSpan={Math.max(1, visible.length)} state="empty" title={emptyTitle} description="Seçili dönem ve filtreler için." action={onClear ? { label: 'Filtreleri temizle', onClick: onClear } : undefined} /> : rows.slice((currentPage - 1) * 50, currentPage * 50).map(row => <TableRow key={row.id}>{visible.map(column => <TableCell key={column.key} className={`${column.key === 'name' ? 'sticky left-0 z-10 bg-surface' : ''} ${column.key === 'punches' ? 'min-w-64 max-w-lg whitespace-normal break-words' : 'whitespace-nowrap'} tabular-nums ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''}`}>
          {column.key === 'status' && row.kind === 'daily' ? <StatusBadge tone={STATUS_META[row.cell.status].tone}>{STATUS_META[row.cell.status].label}</StatusBadge> : column.key === 'result' && row.kind === 'transaction' ? <StatusBadge tone={row.transaction.result === 'granted' ? 'success' : row.transaction.result === 'denied' ? 'danger' : 'neutral'}>{column.value(row) ?? '—'}</StatusBadge> : column.value(row) ?? '—'}
        </TableCell>)}</TableRow>)}</TableBody></Table>
      {!loading && rows.length > 0 && <PaginationBar summary={`${pageRange(rows.length, currentPage, 50)} / ${rows.length} kayıt`} page={currentPage} pageCount={pageCount} onPrevious={() => setPage(Math.max(1, currentPage - 1))} onNext={() => setPage(Math.min(pageCount, currentPage + 1))} />}
    </div>
    {children}
  </div>;
}

export function reportExportLabel(format: ReportFormat, definition: ReportDefinition): string {
  if (format === 'excel' && definition.excelLayout) return ({ personBlocks: 'Excel (kişi blokları)', personSheets: 'Excel (kişi başına sayfa)', statusMatrix: 'Excel (renkli durum tablosu)' })[definition.excelLayout];
  return ({ excel: 'Excel (.xlsx)', csv: 'CSV', pdf: 'PDF' })[format];
}
