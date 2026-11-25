import { isValidElement, type FormEvent, type ReactNode } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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
  readers: [] as { brand: string; deviceType: string; isActive: boolean; virtualReaderDoorId?: string }[],
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === "devices:list" ? mocks.readers : { url: null, version: null },
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === "visitors:update" ? mocks.update : mocks.create,
}));
vi.mock("@/lib/notify", () => ({ notify: { success: mocks.success, error: mocks.error } }));
vi.mock("./hooks/useVisitorFormData", () => ({
  useVisitorFormData: () => ({ formData: mocks.formData, setFormData: vi.fn(), hostEmployees: [], isDirty: true }),
}));
vi.mock("./VisitorCardCapture", () => ({ default: () => null }));
vi.mock("@/components/access-control/unified/components/ZoneDeviceTree", () => ({ ZoneDeviceTree: () => <div id="door-tree" /> }));

const visitor: VisitorDetail = {
  visitorCredential: "card",
  _id: "prereg" as Id<"employees">, projectId: "project" as Id<"projects">,
  firstName: "Synthetic", lastName: "Visitor", company: null, cardNumber: "PRE:synthetic-reference",
  hostName: "Test Host", presetRuleName: null, visitStart: null, visitEnd: "2099-01-01T15:00:00.000Z",
  status: "preRegistered", lastSeenAt: null, lastDirection: null, presence: "unknown", hasKvkkConsent: false,
  tcNo: null, sensitiveMasked: false, cardReleased: false, isActive: false,
  hostEmployeeId: "host" as Id<"employees">, presetRuleId: null, email: null,
  visitorPhone: null, visitorCompany: null, visitPurpose: "Meeting", notes: null, kvkkConsent: null, recentReadings: [],
};
const selectedDoor = "door-1" as Id<"doors">;
const existingRule = "visitor-rule" as Id<"accessRules">;
const initialForm: VisitorFormData = {
  firstName: visitor.firstName, lastName: visitor.lastName, visitorPhone: "", visitorCompany: "", visitPurpose: "Meeting",
  hostEmployeeId: visitor.hostEmployeeId, cardNumber: "12345678", selected_doors: [selectedDoor], selected_devices: ["device-1"],
  accessExpiresAt: "2099-01-01T18:00", isActive: true, notes: "", kvkkConsent: false, projectId: visitor.projectId,
};
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
const renderToStaticMarkup = (children: ReactNode) => renderMarkup(<MemoryRouter>{children}</MemoryRouter>);
const noop = () => undefined;

// Exercise the actual form submit handler and submit hook through the mutation
// boundary. SSR supplies React's hook runtime; no DOM dependency is required.
function renderForm(detail: VisitorDetail | null = visitor) {
  let submit: ((event: FormEvent) => Promise<void>) | undefined;
  function Harness() {
    const form = VisitorForm({ visitor: detail, onClose: noop, onSave: mocks.saved, onStateChange: noop });
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
  mocks.readers = [];
  mocks.update.mockResolvedValue(visitor._id);
  mocks.create.mockResolvedValue("new-visitor");
  // Invalid submissions schedule focus after React displays the errors.
  vi.stubGlobal("requestAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("operator activation of mobile visitor preregistration", () => {
  it("blocks cardless creation when no active kiosk serves the selected doors", async () => {
    mocks.formData = { ...initialForm, credential: "pass", cardNumber: "" };
    await renderForm(null)(formEvent());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("hides the physical card field and offers a single-entry shortcut in pass mode", () => {
    const html = renderToStaticMarkup(<VisitorFormFields formData={{ ...initialForm, credential: "pass", cardNumber: "" }} setFormData={noop} hostEmployees={[]} isEditing={false} />);
    expect(html).not.toContain('id="v_card"');
    expect(html).toContain('id="v_limit"');
    expect(html).toContain("Tek giriş");
    expect(html).toContain("Yalnız girişler sayılır");
  });
  it("submits selected doors and actual card together through the existing update, then reports success", async () => {
    await renderForm()(formEvent());
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      visitorId: visitor._id, projectId: visitor.projectId, doorIds: [selectedDoor], cardNumber: "12345678", isActive: true,
    }));
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty("accessExpiresAt");
    expect(mocks.saved).toHaveBeenCalledExactlyOnceWith({ _id: visitor._id });
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it.each([
    { selected_doors: [] }, { cardNumber: "" }, { cardNumber: "  " }, { accessExpiresAt: "2020-01-01T18:00" },
    { cardNumber: "PRE:synthetic-reference" }, { cardNumber: " IADE:old" }, { cardNumber: "•••• 5678" },
  ])("rejects missing doors or unusable card before issuing any mutation: %j", async patch => {
    mocks.formData = { ...initialForm, ...patch };
    await renderForm()(formEvent());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("requires card and doors even when saving the preregistration without granting access", async () => {
    mocks.formData = { ...initialForm, isActive: false, cardNumber: "", selected_doors: [] };
    await renderForm()(formEvent());
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("recovers an expired preregistration with a future expiry and atomic card/door assignment", async () => {
    await renderForm({ ...visitor, status: "expired", visitEnd: "2020-01-01T15:00:00.000Z" })(formEvent());
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      doorIds: [selectedDoor], cardNumber: "12345678", isActive: true, accessExpiresAt: "2099-01-01T15:00:00.000Z",
    }));
    expect(mocks.saved).toHaveBeenCalledOnce();
  });

  it("keeps first door assignment locked on a cancelled preregistration", () => {
    const html = renderToStaticMarkup(<VisitorForm visitor={{ ...visitor, status: "checkedOut" }} onClose={noop} onSave={noop} onStateChange={noop} />);
    expect(html).not.toContain('id="door-tree"');
    expect(html).toContain("kapılar değiştirilemez");
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

  it("preserves fixed-door updates and the ordinary create contract", async () => {
    await renderForm({ ...visitor, isActive: true, status: "active", presetRuleId: existingRule, cardNumber: "12345678" })(formEvent());
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty("doorIds");
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty("presetRuleId");
    await renderForm(null)(formEvent());
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ doorIds: [selectedDoor], cardNumber: "12345678" }));
    expect(mocks.create.mock.calls[0]?.[0]).not.toHaveProperty("presetRuleId");
  });

  it("unlocks door selection for preregistration while ordinary edits retain their doors", () => {
    const render = (isPreRegistration: boolean) => renderToStaticMarkup(<VisitorFormFields
      formData={initialForm} setFormData={noop} assignedDoors="Ziyaretçi · Lobby"
      hostEmployees={[]} isEditing isPreRegistration={isPreRegistration} />);
    const prereg = render(true);
    const existing = render(false);
    expect(prereg).toContain('id="door-tree"');
    expect(prereg).toContain("teslim edeceğiniz kartı");
    expect(existing).not.toContain('id="door-tree"');
    expect(existing).toContain("Lobby");
    expect(existing).not.toContain("Ziyaretçi · Lobby");
    expect(existing).toContain("kapılar değiştirilemez");
    for (const html of [prereg, existing]) expect(html).not.toContain("Erişim bölgesi oluştur");
  });

  it("does not display the preregistration reference as a physical card", () => {
    const html = renderToStaticMarkup(<VisitorDetailView now={0} detail={visitor} canManage onEdit={noop} onDeleted={noop} />);
    expect(html).toContain("Henüz kart atanmadı");
    expect(html).toContain("Kart ve erişim ata");
    expect(html).not.toContain("synthetic-reference");
    expect(html).not.toContain("Tam numarayı göster");
  });
});

it("preserves active access in update payload even if stale form state requests deactivation", async () => {
  mocks.formData = { ...initialForm, isActive: false };
  await renderForm({ ...visitor, isActive: true, status: "active", presetRuleId: existingRule, cardNumber: "12345678" })(formEvent());
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
});
it.each([
  { patch: { firstName: "", lastName: "", selected_doors: [], cardNumber: "", accessExpiresAt: "" }, id: "v_doors" },
  { patch: { firstName: "", cardNumber: "", accessExpiresAt: "" }, id: "v_expires" },
  { patch: { firstName: "", cardNumber: "" }, id: "v_card" },
  { patch: { firstName: "", lastName: "" }, id: "v_first_name" },
  { patch: { lastName: "" }, id: "v_last_name" },
])("focuses the first invalid visible field $id", async ({ patch, id }) => {
  mocks.formData = { ...initialForm, ...patch };
  const focus = vi.fn();
  const getElementById = vi.fn(() => ({ focus }));
  vi.stubGlobal("document", { getElementById });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
  await renderForm(null)(formEvent());
  expect(getElementById).toHaveBeenCalledExactlyOnceWith(id);
  expect(focus).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
});
