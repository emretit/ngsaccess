import { Children, isValidElement, type FormEvent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "./hooks/useVisitorFormData";
import VisitorForm from "./VisitorForm";
import VisitorFormFields from "./VisitorFormFields";
import { VisitorDetailView } from "./VisitorSlideOverPanel";

const mocks = vi.hoisted(() => ({
  formData: undefined as VisitorFormData | undefined,
  create: vi.fn(), update: vi.fn(), saved: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({ url: null, version: null }),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === "visitors:update" ? mocks.update : mocks.create,
}));
vi.mock("@/lib/notify", () => ({ notify: { success: mocks.success, error: mocks.error } }));
vi.mock("./hooks/useVisitorFormData", () => ({
  useVisitorFormData: () => ({ formData: mocks.formData, setFormData: vi.fn(), presetRules: [], hostEmployees: [], optionsLoading: false, isDirty: true }),
}));
vi.mock("./VisitorCardCapture", () => ({ default: () => null }));

const visitor: VisitorDetail = {
  _id: "prereg" as Id<"employees">, projectId: "project" as Id<"projects">,
  firstName: "Synthetic", lastName: "Visitor", company: null, cardNumber: "PRE:synthetic-reference",
  hostName: "Test Host", presetRuleName: null, visitStart: null, visitEnd: "2099-01-01T15:00:00.000Z",
  status: "preRegistered", lastSeenAt: null, lastDirection: null, presence: "unknown", hasKvkkConsent: false,
  tcNo: null, sensitiveMasked: false, cardReleased: false, isActive: false,
  hostEmployeeId: "host" as Id<"employees">, presetRuleId: null, email: null,
  visitorPhone: null, visitorCompany: null, visitPurpose: "Meeting", notes: null, kvkkConsent: null, recentReadings: [],
};
const selectedRule = "visitor-rule" as Id<"accessRules">;
const initialForm: VisitorFormData = {
  firstName: visitor.firstName, lastName: visitor.lastName, visitorPhone: "", visitorCompany: "", visitPurpose: "Meeting",
  hostEmployeeId: visitor.hostEmployeeId, cardNumber: "12345678", presetRuleId: selectedRule,
  accessExpiresAt: "2099-01-01T18:00", isActive: true, notes: "", kvkkConsent: false, projectId: visitor.projectId,
};
const noop = () => undefined;

// Exercise the actual form submit handler and submit hook through the mutation
// boundary. SSR supplies React's hook runtime; no DOM dependency is required.
function renderForm(detail: VisitorDetail | null = visitor) {
  let submit: ((event: FormEvent) => Promise<void>) | undefined;
  function Harness() {
    const tree = VisitorForm({ visitor: detail, onClose: noop, onSave: mocks.saved, onStateChange: noop });
    const form = Children.toArray(tree.props.children as ReactNode).find(child => isValidElement(child) && child.type === "form");
    if (isValidElement<{ onSubmit: (event: FormEvent) => Promise<void> }>(form)) submit = form.props.onSubmit;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!submit) throw new Error("Visitor form submit handler was not rendered");
  return submit;
}
function formEvent(): FormEvent {
  return { preventDefault: vi.fn() } as unknown as FormEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.formData = { ...initialForm };
  mocks.update.mockResolvedValue(visitor._id);
  mocks.create.mockResolvedValue("new-visitor");
  // Invalid submissions schedule focus after React displays the errors.
  vi.stubGlobal("requestAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("operator activation of mobile visitor preregistration", () => {
  it("submits selected region and actual card together through the existing update, then reports success", async () => {
    await renderForm()(formEvent());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      visitorId: visitor._id, projectId: visitor.projectId, presetRuleId: selectedRule, cardNumber: "12345678", isActive: true,
    }));
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty("accessExpiresAt");
    expect(mocks.saved).toHaveBeenCalledExactlyOnceWith({ _id: visitor._id });
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it.each([
    { presetRuleId: null }, { cardNumber: "" }, { cardNumber: "  " }, { accessExpiresAt: "2020-01-01T18:00" },
    { cardNumber: "PRE:synthetic-reference" }, { cardNumber: " IADE:old" }, { cardNumber: "•••• 5678" },
  ])("rejects missing region or unusable card before issuing any mutation: %j", async patch => {
    mocks.formData = { ...initialForm, ...patch };
    await renderForm()(formEvent());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("requires card and region even when saving the preregistration without granting access", async () => {
    mocks.formData = { ...initialForm, isActive: false, cardNumber: "", presetRuleId: null };
    await renderForm()(formEvent());
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recovers an expired preregistration with a future expiry and atomic card/region assignment", async () => {
    await renderForm({ ...visitor, status: "expired", visitEnd: "2020-01-01T15:00:00.000Z" })(formEvent());
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      presetRuleId: selectedRule, cardNumber: "12345678", isActive: true, accessExpiresAt: "2099-01-01T15:00:00.000Z",
    }));
    expect(mocks.saved).toHaveBeenCalledOnce();
  });

  it("keeps first-region assignment locked on a cancelled preregistration", () => {
    const html = renderToStaticMarkup(<VisitorForm visitor={{ ...visitor, status: "checkedOut" }} onClose={noop} onSave={noop} onStateChange={noop} />);
    expect(html.match(/<button[^>]*id="v_zone"[^>]*>/)?.[0]).toMatch(/\sdisabled[\s=>]/);
    expect(html).not.toContain("Erişim bölgesi oluştur");
    expect(html).not.toContain("Erişimi etkinleştir");
  });

  it("keeps the form open and reports no success when the server rejects assignment", async () => {
    mocks.update.mockRejectedValue(new Error("Assignment rejected"));
    const values = { ...mocks.formData };
    await renderForm()(formEvent());
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
    expect(mocks.formData).toEqual(values);
  });

  it("waits for backend confirmation and suppresses a second submit during activation", async () => {
    let finish: ((value: Id<"employees">) => void) | undefined;
    mocks.update.mockReturnValue(new Promise<Id<"employees">>(resolve => { finish = resolve; }));
    const submit = renderForm();
    const first = submit(formEvent());
    await submit(formEvent());
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.saved).not.toHaveBeenCalled();
    finish?.(visitor._id);
    await first;
    expect(mocks.saved).toHaveBeenCalledOnce();
  });

  it("preserves fixed-region updates and the ordinary create contract", async () => {
    await renderForm({ ...visitor, isActive: true, status: "active", presetRuleId: selectedRule, cardNumber: "12345678" })(formEvent());
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty("presetRuleId");
    await renderForm(null)(formEvent());
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ presetRuleId: selectedRule, cardNumber: "12345678" }));
  });

  it("unlocks region assignment for preregistration while ordinary edits retain their region", () => {
    const render = (isPreRegistration: boolean) => renderToStaticMarkup(<VisitorFormFields
      formData={initialForm} setFormData={noop} presetRules={[{ id: selectedRule, name: "Lobby" }]}
      hostEmployees={[]} isEditing isPreRegistration={isPreRegistration} onNewZone={noop} />);
    const prereg = render(true);
    const existing = render(false);
    expect(prereg.match(/<button[^>]*id="v_zone"[^>]*>/)?.[0]).not.toMatch(/\sdisabled[\s=>]/);
    expect(prereg).toContain("Erişim bölgesi oluştur");
    expect(prereg).toContain("teslim edeceğiniz kartı");
    expect(existing.match(/<button[^>]*id="v_zone"[^>]*>/)?.[0]).toMatch(/\sdisabled[\s=>]/);
    expect(existing).toContain("erişim bölgesi değiştirilemez");
  });

  it("does not display the preregistration reference as a physical card", () => {
    const html = renderToStaticMarkup(<VisitorDetailView now={0} detail={visitor} canManage onEdit={noop} onDeleted={noop} />);
    expect(html).toContain("Henüz kart atanmadı");
    expect(html).toContain("Kart ve erişim ata");
    expect(html).not.toContain("synthetic-reference");
    expect(html).not.toContain("Tam numarayı göster");
  });
});
