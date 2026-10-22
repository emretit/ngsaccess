import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useConsentDocumentUpload } from "./useConsentDocumentUpload";

const mocks = vi.hoisted(() => ({ states: [] as unknown[], cursor: 0, generate: vi.fn(), claim: vi.fn(), fetch: vi.fn() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [mocks.states[index], (value: unknown) => { mocks.states[index] = value; }];
  },
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":generateUploadUrl") ? mocks.generate : mocks.claim,
}));
let hook: ReturnType<typeof useConsentDocumentUpload>;
function render() {
  mocks.cursor = 0;
  function Harness() { hook = useConsentDocumentUpload(); return null; }
  renderToStaticMarkup(<Harness />);
}
const file = (type = "application/pdf", size = 4) => new File([new Uint8Array(size)], "consent.pdf", { type });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [];
  mocks.generate.mockResolvedValue("https://upload.test");
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ storageId: "storage-a" }) });
  vi.stubGlobal("fetch", mocks.fetch);
  render();
});
afterEach(() => vi.unstubAllGlobals());

describe("rıza belgesi yükleme", () => {
  it.each(["application/pdf", "image/jpeg", "image/png"])("%s dosyası POST ve claim sonrasında kayda hazır olur", async type => {
    const selected = file(type);
    await hook.upload(selected);
    render();
    expect(mocks.fetch).toHaveBeenCalledWith("https://upload.test", { method: "POST", headers: { "Content-Type": type }, body: selected });
    expect(mocks.claim).toHaveBeenCalledWith({ storageId: "storage-a" });
    expect(hook.storageId).toBe("storage-a");
    expect(hook.pending).toBe(false);
    expect(hook.error).toBeUndefined();
  });
  it.each([file("text/plain"), file("application/pdf", 10 * 1024 * 1024 + 1)])("geçersiz dosya sunucuya gönderilmez", async selected => {
    await hook.upload(selected);
    render();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(hook.storageId).toBeUndefined();
    expect(hook.error).toContain("10 MB");
  });
  it("HTTP hatasında claim yapılmaz", async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false });
    await hook.upload(file());
    render();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(hook.error).toBeDefined();
    expect(hook.pending).toBe(false);
  });
  it.each([null, {}, { storageId: 12 }])("bozuk yanıt reddedilir: %j", async payload => {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => payload });
    await hook.upload(file());
    render();
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(hook.error).toContain("geçersiz yanıt");
  });
  it("claim hatası dosyanın forma eklenmesini engeller", async () => {
    mocks.claim.mockRejectedValueOnce(new Error("Sahiplik doğrulanamadı"));
    await hook.upload(file());
    render();
    expect(hook.storageId).toBeUndefined();
    expect(hook.error).toBeDefined();
  });
  it("çift yükleme engellenir ve kapatılmış diyaloğa geç gelen belge eklenmez", async () => {
    let release: (value: string) => void = () => undefined;
    mocks.generate.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve; }));
    const current = hook;
    const upload = current.upload(file());
    await current.upload(file());
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    current.reset();
    release("https://upload.test");
    await upload;
    render();
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(hook.storageId).toBeUndefined();
    expect(hook.pending).toBe(false);
  });
});
