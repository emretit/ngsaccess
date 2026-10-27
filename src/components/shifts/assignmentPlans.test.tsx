import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getFunctionName } from 'convex/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import type { ShiftPlan } from '../../../convex/lib/shiftPlan';
import { DayShiftsPicker } from './DayShiftsPicker';
import { RotationEditor, RotationLengthInput, rotationNavigationIndex } from './RotationEditor';
import { AssignmentPatternEditor } from './AssignmentPatternEditor';
import { DepartmentPreviewPanel, departmentPreviewSummary } from './DepartmentTargetPicker';
import { PreviewPanel } from './AssignShiftDialog';
import { AssignmentEditDialog } from './AssignmentEditDialog';
import { ShiftCalendarCell } from './ShiftCalendarCell';
import { ShiftDayDetails } from './ShiftDayDetails';
import { useShiftCalendarData } from './calendar/useShiftCalendarData';
import { resolvedCalendarDay } from './calendar/shiftCalendarModel';
import { openCalendarDay } from './calendar/calendarActions';
import { bulkAssignmentFormSchema, type BulkAssignmentFormValues } from './assignmentFormSchema';
import { assignmentFields, buildRotation, bulkAssignmentRequest, departmentAssignmentRequest, focusAssignmentError, dayShiftsError, mondayOf, planFormError, planPreview, resizeRotation } from './lib/planForm';
import type { Assignment, Department, DepartmentAssignment, Employee, PlanCell, Preview, Shift } from './lib/planning';

const mocks = vi.hoisted(() => ({ query: vi.fn(), inputs: new Map<string, InputHTMLAttributes<HTMLInputElement>>(), clicks: new Map<string, () => void>(), selects: new Map<string, (value: string) => void>(), confirmation: undefined as (() => Promise<void>) | undefined, mutate: vi.fn(), preview: { employeeCount: 42, personalOverrideCount: 5, leaveCount: 2, holidayCount: 1, sameDepartmentConflicts: [] as { departmentAssignmentId: string; shiftName: string; startDate: string; endDate: string }[] } }));
vi.mock('convex/react', () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); mocks.query(name, args); return name === 'shiftPlans:previewDepartmentAssign' ? mocks.preview : name === 'shifts:previewBulkAssign' ? personPreview : []; }, useMutation: (ref: Parameters<typeof getFunctionName>[0]) => (args: unknown) => mocks.mutate(getFunctionName(ref), args) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock('@/lib/notify', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/notify')>(), notify: { success: vi.fn() } }));
vi.mock('@/components/shared/UnsavedChangesDialog', () => ({ useUnsavedChangesGuard: () => ({ dialog: null, requestClose: (close: () => void) => close() }) }));
vi.mock('@/components/shared/ConfirmDestructive', () => ({ ConfirmDestructive: ({ onConfirm }: { onConfirm: () => Promise<void> }) => { mocks.confirmation = onConfirm; return null; } }));
vi.mock('@/components/ui/dialog', () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, DialogFooter: Box };
});
vi.mock('@/components/ui/button', () => ({ Button: ({ children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
  if (typeof children === 'string' && onClick) mocks.clicks.set(children, () => onClick({} as React.MouseEvent<HTMLButtonElement>));
  return <button {...props}>{children}</button>;
} }));
vi.mock('@/components/ui/input', () => ({ Input: (props: InputHTMLAttributes<HTMLInputElement>) => { mocks.inputs.set(props['aria-label'] ?? '', props); return <input {...props} />; } }));
vi.mock('./ShiftSelect', () => ({ ShiftSelect: ({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) => { mocks.selects.set(label, onChange); return <button role="combobox" aria-label={label}>{value}</button>; } }));
const personPreview: Preview = { summary: { total: 1, willAssign: 1, conflict: 0, onLeave: 0, holiday: 0, skipped: 0 }, results: [{ employeeId: 'employee' as Id<'employees'>, employeeName: 'Ada Test', status: 'will_assign', reason: 'Uygun', occurrenceCount: 13, conflict: null, leave: null, holiday: null }] };
const projectId = 'project' as Id<'projects'>;
const employee = { _id: 'employee', projectId, firstName: 'Ada', lastName: 'Test' } as Employee;
const morning = { _id: 'morning', projectId, name: 'Sabah', startTime: '08:00', endTime: '12:00', isActive: true } as Shift;
const evening = { ...morning, _id: 'evening', name: 'Akşam', startTime: '12:30', endTime: '16:00' } as Shift;
const night = { ...morning, _id: 'night', name: 'Gece', startTime: '16:30', endTime: '20:00' } as Shift;
const shifts = [morning, evening, night];
const values: BulkAssignmentFormValues = { employeeIds: [employee._id], shiftId: morning._id, startDate: '2026-10-19', endDate: '2026-10-31', specificDays: false, weekPattern: [] };
const department = { _id: 'department', name: 'Üretim', projectId } as Department;
const assignment = { _id: 'assignment', employeeId: employee._id, projectId, shiftId: morning._id, startDate: values.startDate, endDate: values.endDate } as Assignment;
const departmentAssignment = { _id: 'departmentAssignment', departmentId: department._id, projectId, shiftId: morning._id, startDate: values.startDate, endDate: values.endDate } as DepartmentAssignment;
const baseCell: PlanCell = { employeeId: employee._id, date: values.startDate, kind: 'shifts', source: 'employee', shiftIds: [morning._id], assignmentId: assignment._id };
const dataFor = (cell: PlanCell) => resolvedCalendarDay(employee, cell.date, cell, [assignment], shifts, [departmentAssignment], [department], [], []);
beforeEach(() => { vi.clearAllMocks(); mocks.clicks.clear(); mocks.selects.clear(); mocks.inputs.clear(); mocks.preview.sameDepartmentConflicts = []; });

describe('Plan kurucusu ve doğrulama', () => {
  it('2S·2A·2B örneği altı bağımsız slot üretir ve örnek düğmesi aynı planı gönderir', () => {
    const slots = buildRotation([{ shiftIds: [morning._id], days: 2 }, { shiftIds: [evening._id], days: 2 }, { shiftIds: [], days: 2 }]);
    expect(slots).toEqual([[morning._id], [morning._id], [evening._id], [evening._id], [], []]);
    expect(slots[0]).not.toBe(slots[1]);
    const onChange = vi.fn();
    renderToStaticMarkup(<RotationEditor value={{ kind: 'dayCycle', anchorDate: values.startDate, slots: [[]] }} shifts={shifts} onChange={onChange} />);
    mocks.clicks.get('2 sabah · 2 akşam · 2 boş')?.();
    expect(onChange).toHaveBeenCalledWith({ kind: 'dayCycle', anchorDate: values.startDate, slots });
  });
  it('hafta döngüsü 7N hücre üretir, Pazartesiye bağlanır ve 52 haftada sınırlanır', () => {
    const slots = resizeRotation([[morning._id]], 3, 'weekCycle');
    expect(slots).toHaveLength(21);
    expect(mondayOf('2026-10-23')).toBe('2026-10-19');
    expect(resizeRotation([], 53, 'weekCycle')).toHaveLength(364);
    const html = renderToStaticMarkup(<RotationEditor value={{ kind: 'weekCycle', anchorDate: values.startDate, slots }} shifts={shifts} onChange={() => {}} />);
    expect(html.match(/aria-pressed=/g)).toHaveLength(21);
    expect(html).toContain('aria-label="19.10.2026, Sabah"');
    expect(html).toContain('aria-label="20.10.2026, Boş"');
  });
  it('dokuzuncu vardiya eklenemez; 29 dakika ara uyarılır, 30 dakika kabul edilir', () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({ ...morning, _id: `shift${index}` as Id<'shifts'>, startTime: `${String(index * 2).padStart(2, '0')}:00`, endTime: `${String(index * 2 + 1).padStart(2, '0')}:00` }));
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<DayShiftsPicker value={nine.slice(0, 8).map(s => s._id)} shifts={nine} onChange={onChange} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>\+ Vardiya ekle/);
    mocks.clicks.get('+ Vardiya ekle')?.();
    expect(onChange).not.toHaveBeenCalled();
    expect(dayShiftsError(nine.map(s => s._id), nine)).toContain('en fazla 8');
    const bad = [morning, { ...evening, startTime: '12:29' }];
    expect(dayShiftsError(bad.map(s => s._id), bad)).toContain('en az 30 dakika');
    expect(dayShiftsError([morning._id, evening._id], shifts)).toBe('');
    const warning = renderToStaticMarkup(<DayShiftsPicker value={bad.map(s => s._id)} shifts={bad} onChange={() => {}} />);
    expect(warning).toContain('role="alert"');
    expect(warning).toContain('Ardışık vardiyalar arasında en az 30 dakika olmalıdır');
  });
  it('esnek karışım, boş döngü, 32 gün, 53 hafta ve gece komşuluğu sunucu kurallarıyla reddedilir', () => {
    expect(dayShiftsError([morning._id, evening._id], [morning, { ...evening, scheduleType: 'flexible' }])).toContain('Esnek vardiya');
    for (const plan of [
      { kind: 'dayCycle', anchorDate: values.startDate, slots: [[]] },
      { kind: 'dayCycle', anchorDate: values.startDate, slots: Array.from({ length: 32 }, () => [morning._id]) },
      { kind: 'weekCycle', anchorDate: values.startDate, slots: Array.from({ length: 371 }, () => [morning._id]) },
    ] satisfies ShiftPlan[]) expect(bulkAssignmentFormSchema.safeParse({ ...values, plan }).success).toBe(false);
    const overnight = { ...night, startTime: '22:00', endTime: '07:45' };
    expect(planFormError({ ...values, plan: { kind: 'dayCycle', anchorDate: values.startDate, slots: [[overnight._id], [morning._id]] } }, [overnight, morning])).toContain('ertesi gün');
  });
  it('14 gün önizlemede döngüyü tekrarlar; haftalık seçilmeyen gün atama sayılmaz', () => {
    const plan: ShiftPlan = { kind: 'dayCycle', anchorDate: values.startDate, slots: [[morning._id], []] };
    const preview = planPreview({ ...values, plan });
    expect(preview).toHaveLength(14);
    expect(preview.filter(day => day.shiftIds?.length)).toHaveLength(7);
    expect(preview[13]).toEqual({ date: '2026-11-01', shiftIds: [], outsideRange: true });
    expect(planPreview({ ...values, specificDays: true, weekPattern: ['MON'] }).filter(day => day.shiftIds !== null)).toHaveLength(2);
    const html = renderToStaticMarkup(<AssignmentPatternEditor values={{ ...values, plan }} shifts={shifts} onChange={() => {}} />);
    expect(html).toContain('aria-label="01.11.2026, Boş"');
    expect(html).toContain('aria-label="14 günlük önizleme"');
  });
  it('eski kişi-tek-vardiya payloadı değişmez ve plan alanı hiç gönderilmez', () => {
    const request = bulkAssignmentRequest(values, projectId, false, false);
    expect(request).not.toHaveProperty('plan');
    expect(request).toMatchInlineSnapshot(`
      {
        "calendarConfirmed": false,
        "employeeIds": [
          "employee",
        ],
        "endDate": "2026-10-31",
        "forceConfirm": false,
        "projectId": "project",
        "resultMode": "detailed",
        "shiftId": "morning",
        "startDate": "2026-10-19",
        "weekPattern": undefined,
      }
    `);
    expect(assignmentFields(values, true).plan).toEqual({ kind: 'weekly', shiftIds: [morning._id] });
  });
  it('planlı düzenlemede plan mutationa taşınır', async () => {
    const plan: ShiftPlan = { kind: 'dayCycle', anchorDate: values.startDate, slots: [[morning._id], []] };
    renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={{ ...assignment, plan }} shifts={shifts} shiftName="Sabah" employeeName="Ada" />);
    await mocks.confirmation?.();
    expect(mocks.mutate).toHaveBeenCalledWith('shifts:updateAssignment', expect.objectContaining({ assignmentId: assignment._id, plan, weekPattern: [] }));
  });
});

describe('Departman ve takvim', () => {
  it('departman özeti kişi/kişisel öncelik/izin/tatil sayılarını açıklar, çakışma onay gerektirir', () => {
    expect(departmentPreviewSummary({ ...mocks.preview, sameDepartmentConflicts: [] })).toBe('Alt departmanlar da alır · 42 kişi · 5 kişide kişisel atama öncelikli');
    mocks.preview.sameDepartmentConflicts = [{ departmentAssignmentId: 'row', shiftName: 'Sabah', startDate: values.startDate, endDate: values.endDate }];
    const props = { values: { ...values, target: 'department' as const, employeeIds: [], departmentId: department._id }, projectId, forceConfirm: false, setForceConfirm: vi.fn(), pending: false, onSave: vi.fn() };
    const html = renderToStaticMarkup(<DepartmentPreviewPanel {...props} />);
    expect(html).toContain('2 izin günü · 1 tatil günü');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Departmana uygula/);
    expect(renderToStaticMarkup(<DepartmentPreviewPanel {...props} forceConfirm />)).not.toMatch(/<button[^>]*disabled=""[^>]*>Departmana uygula/);
    expect(mocks.query).toHaveBeenCalledWith('shiftPlans:previewDepartmentAssign', expect.objectContaining({ departmentId: department._id }));
    expect(bulkAssignmentFormSchema.safeParse(props.values).success).toBe(true);
  });
  it.each([
    ['kişi', baseCell, 'data-source="employee"'],
    ['departman', { ...baseCell, source: 'department', assignmentId: undefined, departmentId: department._id, departmentAssignmentId: departmentAssignment._id }, 'Departmandan: Üretim'],
    ['plansız', { ...baseCell, kind: 'none', source: 'project', assignmentId: undefined, shiftIds: [] }, 'atama yok'],
    ['boş', { ...baseCell, kind: 'rest', shiftIds: [] }, 'repeating-linear-gradient'],
    ['çoklu', { ...baseCell, shiftIds: shifts.map(s => s._id) }, '+1'],
  ] satisfies [string, PlanCell, string][])('%s hücre görünümü sunucu kararını gösterir', (_name, cell, expected) => {
    const html = renderToStaticMarkup(<ShiftCalendarCell data={dataFor(cell)} date={cell.date} employeeName="Ada Test" onOpen={() => {}} />);
    expect(html).toContain(expected);
    expect(html).toContain('19 Ekim 2026 Pzt');
    if (cell.source === 'department') expect(html).toContain('border-dashed');
    if (cell.kind === 'rest') expect(html).toContain('Boş');
    if (cell.shiftIds.length === 3) { expect(html.match(/block font-medium/g)).toHaveLength(2); expect(html).toContain('Gece · 16:30–20:00'); }
  });
  it('departman boş günü kişi ataması formuna düşmez; kaynak düzenlemesi ve kişi istisnası açılır', () => {
    const cell: PlanCell = { ...baseCell, source: 'department', kind: 'rest', shiftIds: [], assignmentId: undefined, departmentId: department._id, departmentAssignmentId: departmentAssignment._id };
    const data = dataFor(cell);
    const assign = vi.fn(); const detail = vi.fn(); const editDepartment = vi.fn();
    openCalendarDay(employee, cell.date, true, data, assign, detail);
    expect(assign).not.toHaveBeenCalled(); expect(detail).toHaveBeenCalledOnce();
    renderToStaticMarkup(<ShiftDayDetails employee={employee} date={cell.date} data={data} onClose={() => {}} onAssign={assign} onEdit={() => {}} onEditDepartment={editDepartment} canAssign />);
    mocks.clicks.get('Departman atamasını düzenle')?.(); expect(editDepartment).toHaveBeenCalledWith(departmentAssignment);
    mocks.clicks.get('Bu kişi için değiştir')?.(); expect(assign).toHaveBeenCalledOnce();
  });
  it('takvim planCells ve includePlans true kullanır; 50 kişi sınırını aşmaz', () => {
    const people = Array.from({ length: 60 }, (_, index) => ({ ...employee, _id: `employee${index}` as Id<'employees'> }));
    function Probe() { useShiftCalendarData({ projectId, employees: people, day: values.startDate, effectivePeriod: 'month', search: '', page: 0 }); return null; }
    renderToStaticMarkup(<Probe />);
    expect(mocks.query).toHaveBeenCalledWith('shifts:listAssignments', expect.objectContaining({ includePlans: true, employeeIds: people.slice(0, 50).map(item => item._id) }));
    expect(mocks.query).toHaveBeenCalledWith('shiftPlans:planCells', { projectId, employeeIds: people.slice(0, 50).map(item => item._id), rangeStart: '2026-09-30', rangeEnd: '2026-10-31' });
  });
  it('önceki günün sunucu hücresinden kişi gece vardiyası devamı korunur', () => {
    const overnight = { ...night, startTime: '22:00', endTime: '06:00' };
    const previousAssignment = { ...assignment, shiftId: night._id, startDate: '2026-10-18', endDate: '2026-10-18' };
    const previousCell = { ...baseCell, date: '2026-10-18', shiftIds: [night._id] };
    const data = resolvedCalendarDay(employee, baseCell.date, { ...baseCell, kind: 'none', source: 'project', shiftIds: [], assignmentId: undefined }, [previousAssignment], [overnight], [], [], [], [], previousCell);
    const html = renderToStaticMarkup(<ShiftCalendarCell data={data} date={baseCell.date} employeeName="Ada" onOpen={() => {}} />);
    expect(html).toContain('Önceki günden · 00:00–06:00');
    expect(data.records[0]?.continuation).toBe(true);
  });
  it('geçmiş sürümle çözülen gün o günün saatlerini ve gece devamını gösterir', () => {
    const versioned = { ...baseCell, versionedShifts: [{ shiftId: morning._id, startTime: '22:00', endTime: '06:00', scheduleType: 'fixed' as const, flexible: null }] };
    expect(dataFor(versioned).records[0]?.shift).toMatchObject({ _id: morning._id, startTime: '22:00', endTime: '06:00' });
    expect(dataFor(baseCell).records[0]?.shift).toMatchObject({ startTime: '08:00', endTime: '12:00' });
    const next = resolvedCalendarDay(employee, '2026-10-20', { ...baseCell, date: '2026-10-20', kind: 'none', source: 'project', shiftIds: [], assignmentId: undefined }, [assignment], shifts, [], [], [], [], versioned);
    expect(next.records[0]).toMatchObject({ continuation: true, shift: { startTime: '22:00', endTime: '06:00' } });
  });
  it('sunucunun boş kararı kişisel satır ve vardiya mevcut olsa da bozulmaz', () => {
    const data = dataFor({ ...baseCell, kind: 'rest', shiftIds: [] });
    expect(data.records).toEqual([]); expect(data.resolved?.shifts).toEqual([]);
    const missing = resolvedCalendarDay(employee, baseCell.date, undefined, [assignment], shifts, [], [], [], []);
    expect(missing.records).toEqual([]);
  });
});


describe('C1 denetim düzeltmeleri', () => {
  it('pasif mevcut vardiyanın neden kaydedilemediğini açıklar ve kaydetmeyi kapatır', () => {
    const props = { open: true, onOpenChange: () => {}, assignment, shifts: [{ ...morning, isActive: false }], shiftName: 'Sabah', employeeName: 'Ada' };
    const html = renderToStaticMarkup(<AssignmentEditDialog {...props} />);
    expect(html).toContain('Bu vardiya pasif; kaydetmek için aktif bir vardiya seçin.');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Kaydet/);
    const active = renderToStaticMarkup(<AssignmentEditDialog {...props} shifts={shifts} />);
    expect(active).not.toContain('Bu vardiya pasif;');
    expect(active).not.toMatch(/<button[^>]*disabled=""[^>]*>Kaydet/);
  });
  it('364 slot yalnız bir Tab durağı kullanır; oklar, Home ve End sınırları korur', () => {
    const html = renderToStaticMarkup(<RotationEditor value={{ kind: 'weekCycle', anchorDate: values.startDate, slots: resizeRotation([[morning._id]], 52, 'weekCycle') }} shifts={shifts} onChange={() => {}} />);
    expect(html.match(/aria-pressed="true" tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false" tabindex="-1"/g)).toHaveLength(363);
    for (const [index, key, expected] of [[0, 'ArrowRight', 1], [0, 'ArrowLeft', 0], [0, 'ArrowDown', 7], [7, 'ArrowUp', 0], [363, 'ArrowRight', 363], [10, 'Home', 7], [10, 'End', 13]] as const)
      expect(rotationNavigationIndex(index, 364, key)).toBe(expected);
    expect(rotationNavigationIndex(10, 364, 'End', true)).toBe(363);
    expect(rotationNavigationIndex(10, 364, 'Tab')).toBeUndefined();
  });
  it('uzunluk yazılırken planı değiştirmez, blur ile 12yi uygular ve sınırı kısar', () => {
    const onCommit = vi.fn();
    renderToStaticMarkup(<RotationLengthInput value={1} max={31} label="Döngü uzunluğu" onCommit={onCommit} />);
    const input = mocks.inputs.get('Döngü uzunluğu');
    input?.onChange?.({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
    input?.onChange?.({ target: { value: '12' } } as React.ChangeEvent<HTMLInputElement>);
    expect(onCommit).not.toHaveBeenCalled();
    input?.onBlur?.({ currentTarget: { value: '12' } } as React.FocusEvent<HTMLInputElement>);
    expect(onCommit).toHaveBeenLastCalledWith(12);
    input?.onBlur?.({ currentTarget: { value: '99' } } as React.FocusEvent<HTMLInputElement>);
    expect(onCommit).toHaveBeenLastCalledWith(31);
    input?.onBlur?.({ currentTarget: { value: '' } } as React.FocusEvent<HTMLInputElement>);
    expect(onCommit).toHaveBeenLastCalledWith(1);
  });
  it('kişi boş günü etiketinde çift virgül yoktur ve varsayılan hücrenin metni solmaz', () => {
    const rest = renderToStaticMarkup(<ShiftCalendarCell data={dataFor({ ...baseCell, kind: 'rest', shiftIds: [] })} date={baseCell.date} employeeName="Ada Test" onOpen={() => {}} />);
    expect(rest).toContain('aria-label="Ada Test, 19 Ekim 2026 Pzt, Boş, ayrıntıları aç"');
    expect(rest).not.toContain(', ,');
    const fallback = renderToStaticMarkup(<ShiftCalendarCell data={dataFor({ ...baseCell, source: 'employee' })} date={baseCell.date} employeeName="Ada Test" onOpen={() => {}} />);
    expect(fallback).not.toMatch(/class="group[^"]*opacity-/);
    expect(fallback).not.toContain('Varsayılan vardiya');
    expect(fallback).toContain('<span class="block font-medium">Sabah</span>');
  });
  it.each(['weekly', 'dayCycle'] as const)('%s kişisel satırın ikinci vardiyasıyla çakışmayı işaretler', kind => {
    const plan: ShiftPlan = kind === 'weekly' ? { kind, shiftIds: [morning._id, evening._id] } : { kind, anchorDate: values.startDate, slots: [[morning._id, evening._id], []] };
    const late = { ...night, startTime: '15:30', endTime: '18:00' };
    const other = { ...assignment, _id: 'other' as Id<'shiftAssignments'>, shiftId: late._id };
    const data = resolvedCalendarDay(employee, values.startDate, baseCell, [{ ...assignment, plan }, other], [morning, evening, late], [], [], [], []);
    expect(data.conflict).toBe(true);
    const rest = resolvedCalendarDay(employee, '2026-10-20', { ...baseCell, date: '2026-10-20', kind: 'rest', shiftIds: [] }, [{ ...assignment, plan }, other], [morning, evening, late], [], [], [], []);
    expect(rest.conflict).toBe(kind === 'weekly');
  });
  it('boş döngünün tek hatası sunucunun plan mesajıdır; hata paragrafına odaklanır', () => {
    const result = bulkAssignmentFormSchema.safeParse({ ...values, shiftId: '', plan: { kind: 'dayCycle', anchorDate: values.startDate, slots: [[], []] } });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map(issue => ({ path: issue.path, message: issue.message }))).toEqual([{ path: ['plan'], message: 'Döngüde en az bir dolu gün olmalıdır' }]);
    const focus = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    focusAssignmentError({ current: { focus } }, true);
    expect(focus).toHaveBeenCalledOnce();
    const html = renderToStaticMarkup(<AssignmentPatternEditor values={values} shifts={shifts} onChange={() => {}} errors={{ plan: 'Döngüde en az bir dolu gün olmalıdır' }} />);
    expect(html).toContain('tabindex="-1" role="alert"');
    vi.unstubAllGlobals();
  });
  it('eski updateAssignment payloadı plan anahtarı içermez', async () => {
    renderToStaticMarkup(<AssignmentEditDialog open onOpenChange={() => {}} assignment={assignment} shifts={shifts} shiftName="Sabah" employeeName="Ada" />);
    await mocks.confirmation?.();
    expect(mocks.mutate).toHaveBeenCalledWith('shifts:updateAssignment', {
      assignmentId: assignment._id, shiftId: morning._id, startDate: values.startDate, endDate: values.endDate, weekPattern: [], forceConfirm: false, calendarConfirmed: false,
    });
    expect(mocks.mutate.mock.calls[0]?.[1]).not.toHaveProperty('plan');
  });
  it('assignDepartment isteği hedef, plan ve açık çakışma onayını taşır', () => {
    const plan: ShiftPlan = { kind: 'dayCycle', anchorDate: values.startDate, slots: [[morning._id], []] };
    const request = departmentAssignmentRequest({ ...values, target: 'department', departmentId: department._id, plan }, projectId, true);
    expect(request).toEqual({ projectId, departmentId: department._id, shiftId: morning._id, startDate: values.startDate, endDate: values.endDate, weekPattern: undefined, plan, forceConfirm: true });
    expect(request).not.toHaveProperty('employeeIds');
    expect(departmentAssignmentRequest({ ...values, departmentId: department._id }, projectId, false)).not.toHaveProperty('plan');
  });
  it('planlı kişi önizlemesinde bugünkü karar listesi ve durum etiketi korunur', () => {
    const plan: ShiftPlan = { kind: 'weekly', shiftIds: [morning._id, evening._id] };
    const html = renderToStaticMarkup(<PreviewPanel values={{ ...values, plan }} projectId={projectId} forceConfirm={false} calendarConfirmed={false} setForceConfirm={() => {}} setCalendarConfirmed={() => {}} pending={false} onSave={() => {}} />);
    expect(html).toContain('Ada Test');
    expect(html).toContain('Atanacak');
    expect(html).toContain('Uygun · 13 başlangıç günü');
    expect(html).toContain('Önizlenen kişilere uygula');
    expect(mocks.query).toHaveBeenCalledWith('shifts:previewBulkAssign', expect.objectContaining({ employeeIds: [employee._id], plan }));
  });
});

describe('Birleşik denetim: kaynak bağımsız gece devamı', () => {
  it.each(['department'] as const)('%s kaynaklı 22–06 vardiyası sonraki gün hücre ve detayında görünür', source => {
    const overnight = { ...night, startTime: '22:00', endTime: '06:00' };
    const previousCell: PlanCell = { ...baseCell, date: '2026-10-18', source, assignmentId: undefined, shiftIds: [night._id], ...(source === 'department' ? { departmentId: department._id, departmentAssignmentId: departmentAssignment._id } : {}) };
    const cell: PlanCell = { ...baseCell, kind: 'none', source: 'project', shiftIds: [], assignmentId: undefined };
    const data = resolvedCalendarDay(employee, cell.date, cell, [], [overnight], [departmentAssignment], [department], [], [], previousCell);
    expect(data.records).toEqual([]);
    expect(data.inheritedContinuations?.map(item => item.shift._id)).toEqual([night._id]);
    const html = renderToStaticMarkup(<ShiftCalendarCell data={data} date={cell.date} employeeName="Ada" onOpen={() => {}} />);
    expect(html).toContain('Önceki günden · 00:00–06:00');
    const assign = vi.fn(), detail = vi.fn(), editDepartment = vi.fn();
    openCalendarDay(employee, cell.date, true, data, assign, detail);
    expect(assign).not.toHaveBeenCalled();
    expect(detail).toHaveBeenCalledWith({ employee, date: cell.date });
    const detailHtml = renderToStaticMarkup(<ShiftDayDetails employee={employee} date={cell.date} data={data} onClose={() => {}} onAssign={assign} onEdit={() => {}} onEditDepartment={editDepartment} canAssign />);
    expect(detailHtml).toContain('Önceki günden · 00:00–06:00');
    expect(detailHtml).toContain(source === 'department' ? 'Departmandan: Üretim' : 'Varsayılan vardiya');
    if (source === 'department') {
      mocks.clicks.get('Departman atamasını düzenle')?.();
      expect(editDepartment).toHaveBeenCalledWith(departmentAssignment);
    }
  });
  it('önceki hücredeki gündüz ve esnek vardiyadan gece devamı üretmez', () => {
    const flexible = { ...night, scheduleType: 'flexible' as const, startTime: '22:00', endTime: '06:00' };
    const previousCell: PlanCell = { ...baseCell, date: '2026-10-18', source: 'employee', assignmentId: undefined, shiftIds: [morning._id, night._id] };
    const data = resolvedCalendarDay(employee, baseCell.date, baseCell, [assignment], [morning, flexible], [], [], [], [], previousCell);
    expect(data.inheritedContinuations).toBeUndefined();
    expect(data.records.map(record => record.continuation)).toEqual([false]);
  });
});
