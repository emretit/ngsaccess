import { afterEach, describe, expect, it, vi } from "vitest";
import { maskChatNames } from "./chatMasking";

describe("asistan isim maskeleme", () => {
  it("aynı kimliği tutarlı numaralandırır, aynı adlı farklı kişileri ayırır", () => {
    const rows = [{ employeeId: "a", employeeName: "Ali Yılmaz" }, { employeeId: "b", employeeName: "Ali Yılmaz" }, { employeeId: "a", employeeName: "Ali Y." }];
    expect(maskChatNames(rows).map(row => row.employeeName)).toEqual(["Personel 1", "Personel 2", "Personel 1"]);
    expect(rows[0].employeeName).toBe("Ali Yılmaz");
  });
  it("kimliksiz adları boşluk ve Türkçe harf normalizasyonuyla eşler", () => {
    expect(maskChatNames([{ name: "IŞIL  YILMAZ" }, { name: "  ışıl yılmaz " }, { name: "Ayşe" }]).map(row => row.name)).toEqual(["Personel 1", "Personel 1", "Personel 2"]);
  });
  it("boş, null ve adı olmayan satırları korur; numara tüketmez", () => {
    expect(maskChatNames([{ name: "" }, { name: "  " }, { name: null }, {}, { name: "Ali" }])).toEqual([{ name: "" }, { name: "  " }, { name: null }, {}, { name: "Personel 1" }]);
  });
  it("her iki ad alanını maskeler ve diğer bilgileri değiştirmez", () => {
    expect(maskChatNames([{ employeeName: "Ali", name: "Ali Yılmaz", time: "09:00" }])).toEqual([{ employeeName: "Personel 1", name: "Personel 1", time: "09:00" }]);
  });
  it("maskeleme kapalıysa önceki veriyi aynen bırakır", () => {
    const rows = [{ name: "Ali Yılmaz" }];
    expect(maskChatNames(rows, false)).toEqual(rows);
    expect(maskChatNames([], true)).toEqual([]);
  });
});


vi.mock("./customFunctions", () => ({ authedAction: (definition: { handler: unknown }) => ({ _handler: definition.handler }) }));
import { processMessage } from "../actions/openaiChat";
import type { ActionCtx } from "../_generated/server";

const processHandler = (processMessage as unknown as { _handler: (ctx: ActionCtx, args: { input: string; dbContext: string; projectId?: string }) => Promise<{ content: string; source: string }> })._handler;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("OpenAI sunucu gizlilik sınırı", () => {
  it("istemci bağlamını sunucu bağlamıyla değiştirir, kullanıcının sorusunu korur", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ choices: [{ message: { content: "Personel 1 bugün geç geldi." } }] }) }));
    vi.stubGlobal("fetch", fetcher);
    const runQuery = vi.fn(async () => '{"employeeName":"Personel 1"}');
    const result = await processHandler({ runQuery } as unknown as ActionCtx, { projectId: "project-a", input: "Ali Yılmaz bugün geç mi geldi?", dbContext: '{"name":"Ali Yılmaz"}' });
    expect(runQuery).toHaveBeenCalledWith(expect.anything(), { projectId: "project-a" });
    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body ?? "{}")) as { messages: { content: string }[] };
    expect(request.messages[0].content).toContain("Personel 1");
    expect(request.messages[0].content).not.toContain("Ali Yılmaz");
    expect(request.messages[1].content).toBe("Ali Yılmaz bugün geç mi geldi?");
    expect(result.content).toBe("Personel 1 bugün geç geldi.");
  });
  it("eski istemcide doğrulanamayan serbest bağlamı dış servise iletmez", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ choices: [{ message: { content: "Önce bir proje seçin." } }] }) }));
    vi.stubGlobal("fetch", fetcher);
    const runQuery = vi.fn(async () => ["project-a", "project-b"]);
    const result = await processHandler({ runQuery } as unknown as ActionCtx, { input: "Durum nedir?", dbContext: "Çalışan adı: Ali Yılmaz" });
    expect(runQuery).toHaveBeenCalledOnce();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ content: "Hangi proje için sorduğunuzu belirlemek üzere sayfayı yenileyin", source: "error" });
  });
  it("eski istemcide tek proje varsa sunucunun maskeli bağlamını kullanır", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetcher = vi.fn(async (_url: string, _init: RequestInit) => ({ ok: true, json: async () => ({ choices: [{ message: { content: "Hazır" } }] }) }));
    vi.stubGlobal("fetch", fetcher);
    const runQuery = vi.fn().mockResolvedValueOnce(["project-a"]).mockResolvedValueOnce("Personel 1");
    const result = await processHandler({ runQuery } as unknown as ActionCtx, { input: "Durum?", dbContext: "Ali Yılmaz" });
    expect(runQuery).toHaveBeenLastCalledWith(expect.anything(), { projectId: "project-a", forceMaskNames: true });
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("Personel 1");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("Ali Yılmaz");
    expect(result.source).toBe("openai");
  });
  it("erişilebilir proje yoksa dış çağrı yapmaz", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const result = await processHandler({ runQuery: vi.fn(async () => []) } as unknown as ActionCtx, { input: "Durum?", dbContext: "Ali" });
    expect(result.source).toBe("error"); expect(fetcher).not.toHaveBeenCalled();
  });

});
