import { describe, expect, it } from "vitest";
import {
  decideEmployeeDeviceStatuses,
  mergeRecentReadings,
  normalizeActivityCard,
  normalizeRecentReadingsLimit,
  operationBelongsToEmployee,
  uniqueEmployeeCard,
  type EmployeeActivityOperation,
} from "./peopleActivity";

const devices = [
  { id: "hik", name: "Hik kapı", brand: "hikvision" as const },
  { id: "ide", name: "IDE panel", brand: "ide_smart" as const },
];
const complete = { hikvision: false, ide_smart: false };
const base = { _id: "op", _creationTime: 10, createdAt: 10, payload: { employeeId: "person" } };
const hik: EmployeeActivityOperation = { ...base, deviceId: "hik", source: "hikvision", status: "done", completedAt: 20 };
const ide: EmployeeActivityOperation = { ...base, deviceId: "ide", source: "ide_smart", opType: "upsertUser", status: "acked", ackedAt: 20 };
const evidence = { cardNumber: "123", employeeCreatedAt: 1, roster: [] };

describe("kişi cihaz durumu", () => {
  it("Hik done hiçbir zaman verified olmaz; yalnız gerçek IDE ack doğrulanır", () => {
    const result = decideEmployeeDeviceStatuses(devices, "person", [hik, ide], complete);
    expect(result.devices.map(row => [row.status, row.lastChangedAt])).toEqual([["unknown", 20], ["verified", 20]]);
    expect(result.summary).toEqual({ total: 2, failed: 0, pending: 0, verified: 1, unknown: 1 });
  });

  it("ackedAt olmayan ack ve kullanıcı silme onayı verified olmaz", () => {
    for (const op of [{ ...ide, ackedAt: undefined }, { ...ide, opType: "deleteUser" }, { ...ide, ackedAt: NaN }]) {
      expect(decideEmployeeDeviceStatuses(devices, "person", [op], complete).devices[1].status).toBe("unknown");
    }
  });

  it("en yeni isteğin hatasını korur; eski işin geç gelen onayı hatayı gizlemez", () => {
    const failed: EmployeeActivityOperation = { ...ide, _id: "later", createdAt: 30, status: "failed", ackedAt: undefined, sentAt: 31, lastError: "Panel reddetti" };
    const result = decideEmployeeDeviceStatuses(devices, "person", [failed, { ...ide, ackedAt: 50 }], complete);
    expect(result.devices[1]).toMatchObject({ status: "failed", lastChangedAt: 31, errorMessage: "Panel reddetti" });
    expect(result.summary.failed).toBe(1);
  });

  it("yeni başarılı tekrar eski hatayı geçersiz kılar", () => {
    const result = decideEmployeeDeviceStatuses(devices, "person", [
      { ...ide, status: "failed", ackedAt: undefined },
      { ...ide, _id: "retry", createdAt: 30, ackedAt: 40 },
    ], complete);
    expect(result.devices[1].status).toBe("verified");
  });

  it("pending queued; Hik processing ve IDE sent processing olarak sayılır", () => {
    const result = decideEmployeeDeviceStatuses(devices, "person", [{ ...hik, status: "pending" }, { ...ide, status: "sent" }], complete);
    expect(result.devices.map(row => row.status)).toEqual(["queued", "processing"]);
    expect(result.summary.pending).toBe(2);
    expect(decideEmployeeDeviceStatuses(devices, "person", [{ ...hik, status: "processing" }], complete).devices[0].status).toBe("processing");
  });

  it("tarama sınırı ve boş sonuç hiçbir teslim çıkarımı üretmez", () => {
    const truncated = { hikvision: true, ide_smart: true };
    expect(decideEmployeeDeviceStatuses(devices, "person", [], truncated).devices)
      .toEqual(devices.map(device => ({ device, status: "unknown", lastChangedAt: null })));
    expect(decideEmployeeDeviceStatuses(devices, "person", [ide], truncated).devices[1].status).toBe("unknown");
    expect(decideEmployeeDeviceStatuses([], "person", [], complete).summary.total).toBe(0);
  });

  it("başka kişi/cihaz/marka işlemi ve bozuk payload hedefe kanıt olmaz", () => {
    for (const payload of [null, [], "person", { employeeId: "other" }, { cardNumber: "123" }]) {
      expect(operationBelongsToEmployee(payload, "person")).toBe(false);
    }
    const result = decideEmployeeDeviceStatuses(devices, "person", [
      { ...ide, payload: { employeeId: "other" } },
      { ...ide, deviceId: "hik" },
      { ...hik, deviceId: "other" },
    ], complete);
    expect(result.summary.unknown).toBe(2);
  });

  it("IDE kartını normalize ederek tek kişiyle eşler; açık başka employeeId üstün gelir", () => {
    const cardOp = { ...ide, payload: { userRecord: { id: 123 } } };
    expect(decideEmployeeDeviceStatuses(devices, "person", [cardOp], complete, evidence).devices[1].status).toBe("verified");
    const wrongPerson = { ...cardOp, payload: { employeeId: "other", userRecord: { id: 123 } } };
    expect(decideEmployeeDeviceStatuses(devices, "person", [wrongPerson], complete, evidence).devices[1].status).toBe("unknown");
    expect(decideEmployeeDeviceStatuses(devices, "person", [cardOp], complete, { ...evidence, employeeCreatedAt: 11 }).devices[1].status).toBe("unknown");
  });

  it("IDE kartı boş veya çakışık ise ack ve roster yeşil üretmez", () => {
    const conflicting = { ...evidence, cardNumber: null, roster: [{ deviceId: "ide", syncedAt: 40 }] };
    expect(decideEmployeeDeviceStatuses(devices, "person", [ide], complete, conflicting).devices[1].status).toBe("unknown");
  });

  it("roster cihaz onayı kanıtıdır; yeni pending/failed/silme veya eksik tarama tarafından geçersiz kılınır", () => {
    const roster = { ...evidence, roster: [{ deviceId: "ide", syncedAt: 20 }] };
    expect(decideEmployeeDeviceStatuses(devices, "person", [], complete, roster).devices[1])
      .toMatchObject({ status: "verified", lastChangedAt: 20 });
    for (const [status, expected] of [["pending", "queued"], ["failed", "failed"]] as const) {
      expect(decideEmployeeDeviceStatuses(devices, "person", [{ ...ide, status, createdAt: 30 }], complete, roster).devices[1].status).toBe(expected);
    }
    expect(decideEmployeeDeviceStatuses(devices, "person", [{ ...ide, opType: "deleteUser", payload: { ideUserId: 123 } }], complete, roster).devices[1].status).toBe("unknown");
    expect(decideEmployeeDeviceStatuses(devices, "person", [], { ...complete, ide_smart: true }, roster).devices[1].status).toBe("unknown");
    expect(decideEmployeeDeviceStatuses(devices, "person", [], complete, { ...roster, employeeCreatedAt: 21 }).devices[1].status).toBe("unknown");
  });
});

describe("IDE kart kimliği", () => {
  it("baştaki sıfırları kaldırır; geçersiz kartları reddeder", () => {
    expect(normalizeActivityCard("000123")).toBe("123");
    for (const value of ["", " ", null, {}, true, "abc", 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(normalizeActivityCard(value)).toBeNull();
    }
  });
  it("normalize çakışma ve eksik sahip taraması unknown kalır", () => {
    const owners = [{ _id: "person", cardNumber: "00123" }];
    expect(uniqueEmployeeCard(owners, "person", false)).toBe("123");
    expect(uniqueEmployeeCard([...owners, { _id: "other", cardNumber: "123" }], "person", false)).toBeNull();
    expect(uniqueEmployeeCard(owners, "person", true)).toBeNull();
    expect(uniqueEmployeeCard(owners, "missing", false)).toBeNull();
  });
});

describe("son geçişler", () => {
  const row = (id: string, day: number, projectId: string | undefined = "project") => ({
    _id: id, accessTime: `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`, projectId,
  });
  it("durum listelerini yeni→eski birleştirip limitten önce projeyi süzer", () => {
    const result = mergeRecentReadings([
      [row("old", 1), row("other-project", 20, "other"), row("new", 10)],
      [row("middle", 5)],
      [row("legacy-status", 8), { ...row("orphan", 19), projectId: undefined }],
    ], "project", 3);
    expect(result.map(item => item._id)).toEqual(["new", "legacy-status", "middle"]);
  });
  it("aynı zaman için deterministik sıra ve boş liste", () => {
    expect(mergeRecentReadings([[row("a", 1)], [row("b", 1)]], "project", 1)[0]._id).toBe("b");
    expect(mergeRecentReadings([[], []], "project")).toEqual([]);
  });
  it("varsayılan 10, tavan 50, alt sınır 1; kesir ve finite olmayan argüman", () => {
    expect(normalizeRecentReadingsLimit()).toBe(10);
    expect(normalizeRecentReadingsLimit(100)).toBe(50);
    expect(normalizeRecentReadingsLimit(-2)).toBe(1);
    expect(normalizeRecentReadingsLimit(2.9)).toBe(2);
    expect(normalizeRecentReadingsLimit(NaN)).toBe(10);
    const rows = Array.from({ length: 60 }, (_, i) => row(String(i), 1));
    expect(mergeRecentReadings([rows], "project")).toHaveLength(10);
    expect(mergeRecentReadings([rows], "project", 60)).toHaveLength(50);
  });
});
