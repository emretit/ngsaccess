import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EmployeeFormFields, { DepartmentShiftWarning } from "./EmployeeFormFields";
import type { EmployeeFormData } from "./hooks/useEmployeeFormData";
const permission = vi.hoisted(() => ({ accessRules: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => permission.accessRules }) }));
afterEach(() => { permission.accessRules = true; });
const formData: EmployeeFormData = { firstName: "", lastName: "", email: "", tcNo: "", cardNumber: "", payrollCode: "", companyId: null, departmentId: null, positionId: null, accessRuleId: null, shift: null, shiftId: null, photoUrl: null, notes: "", isActive: true, hourlyRate: null, monthlySalary: null };
function render(autoFocusFirstName: boolean) { return renderToStaticMarkup(<EmployeeFormFields formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} autoFocusFirstName={autoFocusFirstName} />); }
it("02-O8: gives access its own fieldset and unambiguous empty option", () => {
  const html = render(false);
  expect(html).toMatch(/<legend[^>]*>Erişim<\/legend>[\s\S]*<label[^>]*>Erişim kuralı ekle/);
  expect(html).toContain("Kural eklenmesin");
  expect(html).not.toContain("Yeni kural ekleme");
});
it("02-D7: focuses first name only for a new employee", () => {
  expect(render(true)).toMatch(/id="employee-firstName"[^>]*autofocus=""/);
  expect(render(false)).not.toContain('autofocus=""');
});
it("emp-drawer #6/#15: mode-specific email help, TC hint, both tied to inputs", () => {
  const fresh = render(false);
  expect(fresh).toContain("Mobil giriş kurulum bağlantısı bu adrese gönderilir.");
  expect(fresh).toMatch(/id="employee-email"[^>]*aria-describedby="employee-email-hint"/);
  expect(fresh).toMatch(/id="employee-tcNo"[^>]*inputMode="numeric"[^>]*aria-describedby="employee-tcNo-hint"|id="employee-tcNo"[^>]*aria-describedby="employee-tcNo-hint"[^>]*inputMode="numeric"/);
  const edit = renderToStaticMarkup(<MemoryRouter><EmployeeFormFields canViewPay formData={{ ...formData, monthlySalary: 1000, notes: "x" }} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} isEditing /></MemoryRouter>);
  expect(edit).not.toContain("bu adrese gönderilir");
  expect(edit).toContain("Mobil giriş bağlantısı gönder");
  expect(edit).toContain('href="/access-control"');
  expect(edit).toContain("(2 dolu)");
});

it("düzenlemede mevcut aktif/pasif üyelikleri ek kural seçiminin üstünde gösterir", () => {
  const html = renderToStaticMarkup(<MemoryRouter><EmployeeFormFields formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} isEditing memberships={[{ _id: "a", name: "Gündüz", isActive: true }, { _id: "b", name: "Gece", isActive: false }]} /></MemoryRouter>);
  expect(html).toContain("Gündüz"); expect(html).toContain("Gece");
  expect(html).toContain("Aktif"); expect(html).toContain("Pasif");
  expect(html.indexOf("Gündüz")).toBeLessThan(html.indexOf("Ek erişim kuralı"));
  expect(html).toContain("Ek kural seçilmedi");
});
it("boş katalog yardımlarını ve düzenlemede boş üyelik bilgisini gösterir", () => {
  const html = renderToStaticMarkup(<MemoryRouter><EmployeeFormFields formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} isEditing memberships={[]} /></MemoryRouter>);
  for (const text of ["Henüz şirket tanımlı değil.", "Henüz departman tanımlı değil.", "Henüz pozisyon tanımlı değil.", "Etkin erişim kuralı yok.", "Bu kişiye erişim kuralı atanmamış."]) expect(html).toContain(text);
});

it("D-1: pay fields and amounts are hidden without pay.view", () => {
  const props = { formData: { ...formData, hourlyRate: 123, monthlySalary: 45678 }, setFormData: () => {}, companies: [], departments: [], accessRules: [], positions: [] };
  const hidden = renderToStaticMarkup(<EmployeeFormFields {...props} canViewPay={false} />);
  expect(hidden).not.toContain('name="hourlyRate"');
  expect(hidden).not.toContain('name="monthlySalary"');
  expect(hidden).not.toContain('45678');
  const visible = renderToStaticMarkup(<EmployeeFormFields {...props} canViewPay />);
  expect(visible).toContain('name="monthlySalary"');
  expect(visible).toContain('45678');
});

it("offers an optional date and access hint, hidden for visitors", () => {
  const html = render(false);
  expect(html).toContain("Erişim başlangıcı");
  expect(html).toMatch(/<button[^>]*id="employee-accessStartsAt"/);
  expect(html).not.toContain('type="date"');
  expect(html).toContain("Bu tarihten önce kart, QR ve mobil erişim reddedilir.");
  const visitor = renderToStaticMarkup(<EmployeeFormFields isVisitor formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} />);
  expect(visitor).not.toContain('id="employee-accessStartsAt"');
});

it("departman planı uyarısı yalnız mevcut çalışanın departmanı gerçekten değişince gösterilir", () => {
  const original = "department-a" as NonNullable<EmployeeFormData["departmentId"]>;
  const changed = "department-b" as NonNullable<EmployeeFormData["departmentId"]>;
  const renderWarning = (isEditing: boolean, departmentId: EmployeeFormData["departmentId"]) => renderToStaticMarkup(<DepartmentShiftWarning isEditing={isEditing} originalDepartmentId={original} departmentId={departmentId} />);
  expect(renderWarning(true, changed)).toContain("Departman vardiya planı geçmiş günlere de uygulanır; kapanmış dönem için kişiye vardiya atayın.");
  expect(renderWarning(true, null)).toContain('role="status"');
  expect(renderWarning(true, original)).toBe("");
  expect(renderWarning(false, changed)).toBe("");
});

it("taslaktan değişmiş departmanla yeniden açılışta özgün çalışan departmanına göre uyarır", () => {
  const original = "department-a" as NonNullable<EmployeeFormData["departmentId"]>;
  const changed = "department-b" as NonNullable<EmployeeFormData["departmentId"]>;
  const props = { isEditing: true, originalDepartmentId: original, formData: { ...formData, departmentId: changed }, setFormData: () => {}, companies: [], departments: [], accessRules: [], positions: [], memberships: [] };
  const renderDraft = () => renderToStaticMarkup(<MemoryRouter><EmployeeFormFields {...props} /></MemoryRouter>);
  expect(renderDraft()).toContain("Departman vardiya planı geçmiş günlere de uygulanır");
  expect(renderDraft()).toContain("Departman vardiya planı geçmiş günlere de uygulanır");
  expect(renderToStaticMarkup(<MemoryRouter><EmployeeFormFields {...props} formData={{ ...props.formData, departmentId: original }} /></MemoryRouter>)).not.toContain("Departman vardiya planı geçmiş günlere de uygulanır");
});

it("K-01: erişim kuralı seçimi yetki yoksa pasiftir ve nedeni açıklanır", () => {
  permission.accessRules = false;
  const denied = render(false);
  expect(denied).toMatch(/<select[^>]*id="employee-accessRuleId"[^>]*disabled=""[^>]*aria-describedby="[^"]*employee-accessRuleId-permission/);
  expect(denied).toContain("Kural eklemek için erişim kurallarını yönetme yetkisi gerekir.");
  permission.accessRules = true;
  expect(render(false)).not.toMatch(/<select[^>]*id="employee-accessRuleId"[^>]*disabled/);
});

it("K-02: düzenlemede proje alanı pasiftir ve güvenli yeniden kayıt yolunu açıklar", () => {
  const html = renderToStaticMarkup(<MemoryRouter><EmployeeFormFields formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} isEditing /></MemoryRouter>);
  expect(html).toMatch(/<input[^>]*id="employee-projectId"[^>]*disabled=""/);
  expect(html).toContain("Kişi başka projeye taşınamaz. Yeni projede yeni kayıt açın, eski kaydı işten çıkarın.");
  expect(render(false)).not.toContain('id="employee-projectId"');
});

it("connects shared field errors and hints to the existing employee controls", () => {
  const html = renderToStaticMarkup(<EmployeeFormFields canViewPay formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} errors={{ email: "E-posta geçersiz", hourlyRate: "Ücret geçersiz" }} />);
  const emailInput = html.match(/<input[^>]*id="employee-email"[^>]*>/)?.[0];
  expect(emailInput).toContain('name="email"');
  expect(emailInput).toContain('aria-invalid="true"');
  expect(emailInput).toContain('aria-describedby="employee-email-hint employee-email-error"');
  expect(html).toMatch(/<p[^>]*id="employee-email-error"[^>]*role="alert">E-posta geçersiz/);
  const payInput = html.match(/<input[^>]*id="employee-hourlyRate"[^>]*>/)?.[0];
  expect(payInput).toContain('name="hourlyRate"');
  expect(payInput).toContain('aria-describedby="employee-pay-hint employee-hourlyRate-error"');
  expect(payInput).toContain('aria-invalid="true"');
  expect(html).toMatch(/<p[^>]*id="employee-hourlyRate-error"[^>]*role="alert">Ücret geçersiz/);
});
