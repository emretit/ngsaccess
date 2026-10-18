import { describe, expect, it } from "vitest";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
// Load the installed SDK implementation without adding its source tree to app tsc.
const sdkPath = new URL("../../node_modules/convex/dist/esm/server/impl/database_impl.js", import.meta.url).href;
const { setupReader } = await import(/* @vite-ignore */ sdkPath) as {
  setupReader: () => GenericDatabaseReader<DataModel>;
};
import { auditActorIndex, maskAuditEmail, mergeAuditActors } from "./auditActors";

const id = (value: string) => value as Id<"users">;
const callerId = id("caller");
const base = { callerId, memberIds: [callerId], users: [{ _id: callerId, name: "Çağıran" }] };

describe("denetim aktörleri", () => {
  it("Sistem filtresi işlem/varlık indeksinden önce gelir ve çelişkili kullanıcıyı reddeder", () => {
    expect(auditActorIndex("p", "employees", undefined, "delete", "system")).toBe("by_project_user_timestamp");
    expect(auditActorIndex(undefined, "employees", undefined, "delete", "system")).toBe("by_user_timestamp");
    expect(auditActorIndex("p", "employees", "u", "delete")).toBe("by_project_action_timestamp");
    expect(() => auditActorIndex("p", undefined, "u", undefined, "system")).toThrow("birlikte");
  });

  it("kurulu Convex SDK eksik userId eşitliğini iki indeks türünde de undefined olarak serileştirir", () => {
    const db = setupReader();
    const project = db.query("auditLog").withIndex("by_project_user_timestamp", q => q.eq("projectId", "p" as Id<"projects">).eq("userId", undefined));
    const global = db.query("auditLog").withIndex("by_user_timestamp", q => q.eq("userId", undefined));
    const search = db.query("auditLog").withSearchIndex("search_text", q => q.search("searchText", "tatil").eq("userId", undefined));
    // This is an SDK serialization contract test; it does not contact a deployment.
    const eq = { type: "Eq", fieldPath: "userId", value: { $undefined: null } };
    expect(project).toMatchObject({ state: { query: { source: { range: expect.arrayContaining([eq]) } } } });
    expect(global).toMatchObject({ state: { query: { source: { range: [eq] } } } });
    expect(search).toMatchObject({ state: { query: { source: { filters: expect.arrayContaining([eq]) } } } });
  });

  it("son ad snapshotını ve son görülmeyi ayrı tutar; silinmiş/eski üyeleri ve Sistemi birleştirir", () => {
    const result = mergeAuditActors({ ...base,
      users: [...base.users, { _id: id("removed"), name: "Yeni ad" }, { _id: id("member"), name: "Üye" }],
      memberIds: [id("member")],
      events: [
        { userId: id("deleted"), userName: "Eski ad", timestamp: 1 },
        { userId: id("deleted"), userName: "Son ad", timestamp: 3 },
        { userId: id("deleted"), timestamp: 4 },
        { userId: id("removed"), userName: "Önceki ad", timestamp: 2 },
        { timestamp: 5 },
      ],
    });
    expect(result.includesSystem).toBe(true);
    expect(result.actors.find(actor => actor.userId === "deleted")).toMatchObject({ label: "Son ad", status: "deleted", lastSeenAt: 4 });
    expect(result.actors.find(actor => actor.userId === "removed")).toMatchObject({ label: "Yeni ad", status: "removed" });
    expect(result.actors.find(actor => actor.userId === "member")?.status).toBe("member");
    expect(result.actors.find(actor => actor.userId === callerId)?.status).toBe("member");
  });

  it("aynı adlı aktörleri tam e-posta/kimlik eklemeden ayırır ve Türkçe etikette arar", () => {
    const users = ["one", "two"].map(value => ({ _id: id(value), fullName: "İPEK", email: "ipek@example.com" }));
    const result = mergeAuditActors({ ...base, users: [...base.users, ...users],
      memberIds: users.map(user => user._id), search: "  ipek  ",
      events: users.map(user => ({ userId: user._id, timestamp: 1 })),
    });
    expect(result.actors).toHaveLength(2);
    expect(new Set(result.actors.map(actor => actor.label)).size).toBe(2);
    expect(JSON.stringify(result.actors)).not.toContain("ipek@example.com");
    expect(result.actors.every(actor => actor.status === "active")).toBe(true);
    expect(maskAuditEmail("e@example.com")).toBe("e***@example.com");
  });

  it("2.000 olay ve 2.000 üyeyi tekilleştirir; kesik üyelik taramasından çıkarılma iddiası üretmez", () => {
    const events = Array.from({ length: 2000 }, (_, i) => ({ userId: id(`event-${i}`), userName: "İPEK", timestamp: i }));
    const members = Array.from({ length: 2000 }, (_, i) => ({ _id: id(`member-${i}`), name: `Üye ${i}` }));
    const result = mergeAuditActors({ ...base, events, users: [...base.users, ...members], memberIds: members.map(user => user._id) });
    expect(result.actors).toHaveLength(4001);
    expect(new Set(result.actors.map(actor => actor.label)).size).toBe(4001);
    const partial = mergeAuditActors({ ...base, membershipComplete: false,
      users: [...base.users, { _id: id("old"), name: "Eski" }],
      events: [{ userId: id("old"), timestamp: 1 }],
    });
    expect(partial.actors.find(actor => actor.userId === "old")?.status).toBe("active");
  });

  it("e-posta olan snapshotı maskeler ve global kapsamda eski üyeliği removed diye işaretlemez", () => {
    const result = mergeAuditActors({ ...base, allProjects: true,
      users: [...base.users, { _id: id("old"), name: "old@example.com" }],
      events: [{ userId: id("old"), timestamp: 1 }, { userId: id("missing"), timestamp: 2 }],
    });
    expect(result.actors.find(actor => actor.userId === "old")).toMatchObject({ label: "o***@example.com", status: "active" });
    expect(result.actors.find(actor => actor.userId === "missing")?.label).toBe("Silinmiş kullanıcı");
    expect(result.includesSystem).toBe(false);
  });
});
