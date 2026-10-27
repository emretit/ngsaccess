import type { FormEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { VisitorNoticeCard, VisitorRetentionForm } from "./VisitorNoticeCard";

const state = vi.hoisted(() => ({ days: null as number | null, draft: undefined as string | undefined,
  preview: { count: 120, capped: true } as { count: number; capped: boolean } | undefined,
  mutate: vi.fn(), success: vi.fn(), error: vi.fn(), query: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); state.query(name, args);
    if (name === "privacyRetention:getVisitorNotice") return { visitorKvkkUrl: "", visitorKvkkVersion: "" };
    if (name === "privacyRetention:getVisitorRetention") return { visitorRetentionDays: state.days };
    return args === "skip" ? undefined : state.preview;
  },
  useMutation: () => state.mutate,
}));
vi.mock("@/lib/notify", () => ({ notify: { success: state.success, error: state.error } }));
vi.mock("../../SettingsFormState", async importOriginal => ({
  ...await importOriginal<typeof import("../../SettingsFormState")>(),
  useSettingsDraft: (source: object) => ({ values: "days" in source && state.draft !== undefined ? { days: state.draft } : source,
    dirty: state.draft !== undefined, remoteChanged: false, reset: vi.fn(), change: vi.fn() }),
}));
const projectId = "project" as Id<"projects">;
function submitHandler() {
  let submit: ((event: FormEvent) => Promise<void>) | undefined;
  function Harness() {
    const form = VisitorRetentionForm({ projectId });
    submit = form.props.onSubmit;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  if (!submit) throw new Error("Missing retention form");
  return () => submit?.({ preventDefault: vi.fn() } as unknown as FormEvent);
}
beforeEach(() => {
  vi.clearAllMocks(); state.days = null; state.draft = undefined; state.preview = { count: 120, capped: true };
  state.mutate.mockResolvedValue(null);
});
describe("visitor retention settings", () => {
  it("shows a labelled numeric field and the disabled default", () => {
    const html = renderToStaticMarkup(<VisitorNoticeCard projectId={projectId} />);
    expect(html).toContain("Ziyaretçi kayıtlarını saklama süresi (gün)");
    expect(html).toContain('for="visitor-retention-days"');
    expect(html).toContain('type="number"'); expect(html).toContain('min="30"'); expect(html).toContain('max="3650"');
    expect(html).toContain("boş = silinmez"); expect(html).toContain("otomatik silme kapalıdır");
    expect(state.query).toHaveBeenCalledWith("privacyRetention:previewVisitorRetention", "skip");
  });
  it("previews first activation with a lower-bound count and saves with a notification", async () => {
    state.draft = "90";
    const html = renderToStaticMarkup(<VisitorRetentionForm projectId={projectId} />);
    expect(html).toContain("en az 120 pasif ziyaretçi kaydı");
    expect(state.query).toHaveBeenCalledWith("privacyRetention:previewVisitorRetention", { projectId, days: 90 });
    await submitHandler()();
    expect(state.mutate).toHaveBeenCalledWith({ projectId, days: 90 });
    expect(state.success).toHaveBeenCalledWith("Ziyaretçi kayıtlarını saklama süresi kaydedildi");
  });
  it("previews a shortened duration and waits until its count is ready", async () => {
    state.days = 365; state.draft = "90";
    const html = renderToStaticMarkup(<VisitorRetentionForm projectId={projectId} />);
    expect(html).toContain("en az 120 pasif ziyaretçi kaydı");
    expect(state.query).toHaveBeenCalledWith("privacyRetention:previewVisitorRetention", { projectId, days: 90 });
    state.preview = undefined;
    await submitHandler()();
    expect(state.mutate).not.toHaveBeenCalled();
    state.preview = { count: 120, capped: false };
    await submitHandler()();
    expect(state.mutate).toHaveBeenCalledWith({ projectId, days: 90 });
  });
  it("does not request a preview when extending the duration", () => {
    state.days = 90; state.draft = "365";
    renderToStaticMarkup(<VisitorRetentionForm projectId={projectId} />);
    expect(state.query).toHaveBeenCalledWith("privacyRetention:previewVisitorRetention", "skip");
  });
  it("waits for the first preview before enabling deletion", async () => {
    state.draft = "90"; state.preview = undefined;
    await submitHandler()();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("clears an existing duration to disable retention", async () => {
    state.days = 90; state.draft = "";
    await submitHandler()();
    expect(state.mutate).toHaveBeenCalledWith({ projectId, days: null });
  });
  it.each(["29", "3651", "90.5"])("rejects invalid value %s before saving", async draft => {
    state.draft = draft;
    await submitHandler()();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("reports a failed save without success notification", async () => {
    state.draft = "90"; state.mutate.mockRejectedValue(new Error("failed"));
    await submitHandler()();
    expect(state.error).toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
  });
});
