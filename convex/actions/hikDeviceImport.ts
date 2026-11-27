"use node";

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import { gatewayApiCall, newHikSearchId } from "../lib/gateway/core";
import { searchPersonOnDevice } from "../lib/gateway/persons";
import { searchFingerprintsOnDevice, readFingerprintTemplates } from "../lib/gateway/biometrics";
import { assertTemplateKey, encryptTemplate } from "../lib/fingerprintCrypto";
import { selectImportFingerprints, type ImportPerson, type ImportRow } from "../lib/hikDeviceImport";
import { MAX_FINGERPRINTS_PER_EMPLOYEE } from "../lib/fingerprintSlots";

type ImportCtx = ActionCtx & { user: Doc<"users"> };

export async function authorizeImportDevice(ctx: ImportCtx, deviceId: Id<"devices">, importing: boolean): Promise<{ device: Doc<"devices">; projectId: Id<"projects">; devIndex: string }> {
  const projectIds: Id<"projects">[] = await ctx.runQuery(internal.users.listProjectIdsForCurrentUser, {});
  const device: Doc<"devices"> | null = await ctx.runQuery(internal.devices.getByIdInternal, { id: deviceId });
  if (!device?.projectId || !isProjectAllowed(projectIds, device.projectId)) throw new Error("Bu cihaza erişim yetkiniz yok");
  for (const permission of importing ? ["devices.manage", "employees.manage"] as const : ["devices.manage"] as const) {
    const allowed: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: device.projectId, permission });
    if (!allowed) throw new Error("Bu işlem için yetkiniz yok");
  }
  if (device.brand !== "hikvision" || device.hikTransport !== "gateway" || !device.hikDevIndex) throw new Error("Bu işlem yalnız kayıtlı Hikvision gateway cihazlarında desteklenir");
  return { device, projectId: device.projectId, devIndex: device.hikDevIndex };
}


// A page does at most 1 person search, 10 card searches and 10 optional
// fingerprint metadata searches. No roster-wide scan is hidden in a call.
export const IMPORT_PAGE_SIZE = 10;
type ImportCursor = { position: number; searchID: string };
type ImportTotals = { persons: number; cards: number };
type DevicePersonsPage = { persons: ImportPerson[]; totals: ImportTotals; nextCursor?: ImportCursor };
type ImportPreview = { rows: ImportRow[]; biometricEnabled: boolean; totals: ImportTotals; nextCursor?: ImportCursor };
type CreatedPerson = { row: ImportRow; employeeId?: Id<"employees">; ruleId?: Id<"accessRules"> };
const cursorValidator = v.object({ position: v.number(), searchID: v.string() });

async function readPersonCards(devIndex: string, employeeNo: string): Promise<string[]> {
  const response = await gatewayApiCall("/ISAPI/AccessControl/CardInfo/Search", "POST", {
    CardInfoSearchCond: { searchID: newHikSearchId(), searchResultPosition: 0, maxResults: 3, EmployeeNoList: [{ employeeNo }] },
  }, devIndex);
  if (response.status !== 200) throw new Error("Kart listesi okunamadı");
  const data = response.data as Record<string, unknown> | undefined;
  const wrap = (data?.CardInfoSearch ?? data?.CardInfo) as Record<string, unknown> | undefined;
  if (!wrap) throw new Error("Kart listesi yanıtı geçersiz");
  const list = wrap.CardInfo ?? wrap.InfoList;
  const cards: string[] = [];
  for (const item of Array.isArray(list) ? list.slice(0, 3) : []) {
    if (item && typeof item === "object" && "cardNo" in item && typeof item.cardNo === "string") cards.push(item.cardNo.trim());
  }
  return [...new Set(cards)];
}

export async function readDevicePersons(devIndex: string, selected?: readonly string[], cursor?: ImportCursor, includeFingers = true): Promise<DevicePersonsPage> {
  const position = cursor?.position ?? 0;
  if (!Number.isSafeInteger(position) || position < 0 || (cursor && cursor.searchID.length > 128)) throw new Error("Geçersiz aktarım imleci");
  const searchID = cursor?.searchID ?? newHikSearchId();
  const result = await searchPersonOnDevice(devIndex, { searchID, searchResultPosition: position, maxResults: IMPORT_PAGE_SIZE });
  if (!result.ok) throw new Error("Cihaz kişileri okunamadı");
  const list = result.persons ?? [];
  if (list.length > IMPORT_PAGE_SIZE) throw new Error("Cihaz istenen sayfa boyutunu aştı; aktarım durduruldu");
  const persons: ImportPerson[] = [];
  for (const person of list.slice(0, IMPORT_PAGE_SIZE)) {
    const employeeNo = person.employeeNo.trim();
    if (!employeeNo || (selected && !selected.includes(employeeNo)) || persons.some(row => row.employeeNo === employeeNo)) continue;
    const cards = await readPersonCards(devIndex, employeeNo);
    let fingerCount = 0;
    if (includeFingers) {
      try {
        const fingers = await searchFingerprintsOnDevice(devIndex, { searchID: newHikSearchId(), position: 0, maxResults: 30, employeeNo });
        if (fingers.ok) fingerCount = new Set(fingers.fingerprints.map(finger => finger.fingerPrintID).filter(id => id !== undefined)).size;
      } catch { /* Metadata failure never hides the person list. */ }
    }
    persons.push({ employeeNo, name: person.name?.trim() || employeeNo, cards, fingerCount,
      ...(person.Valid ? { valid: person.Valid } : {}),
      ...(person.doorRight !== undefined ? { doorRight: person.doorRight } : {}),
      ...(person.RightPlan ? { rightPlans: person.RightPlan } : {}),
    });
  }
  const next = result.nextPosition ?? position + list.length;
  const hasMore = list.length > 0 && (result.total !== undefined ? next < result.total : list.length >= IMPORT_PAGE_SIZE);
  if (hasMore && next <= position) throw new Error("Kişi listesi tamamlanamadı");
  return { persons, totals: { persons: result.total ?? next, cards: persons.reduce((sum, person) => sum + person.cards.length, 0) },
    ...(hasMore ? { nextCursor: { position: next, searchID } } : {}) };
}

export async function runPreviewDeviceImport(ctx: ImportCtx, args: { deviceId: Id<"devices">; cursor?: ImportCursor }): Promise<ImportPreview> {
  const target = await authorizeImportDevice(ctx, args.deviceId, false);
  const biometricEnabled: boolean = await ctx.runQuery(internal.hikDeviceImport.biometricEnabled, { projectId: target.projectId });
  const permitted: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: target.projectId, permission: "biometrics.manage" });
  const data = await readDevicePersons(target.devIndex, undefined, args.cursor, biometricEnabled && permitted);
  const rows: ImportRow[] = await ctx.runQuery(internal.hikDeviceImport.classifyPersons, { projectId: target.projectId, persons: data.persons });
  return { rows, biometricEnabled, totals: data.totals, ...(data.nextCursor ? { nextCursor: data.nextCursor } : {}) };
}
export const previewDeviceImport = authedAction({
  args: { deviceId: v.id("devices"), cursor: v.optional(cursorValidator) },
  handler: (ctx, args): Promise<ImportPreview> => runPreviewDeviceImport(ctx, args),
});

type ImportResult = { created: number; matched: number; conflicts: number; manual: number; fingerprintsStored: number; fingerprintsSkipped: number; ruleId: Id<"accessRules"> | null; nextCursor?: ImportCursor };
export async function runImportDevicePersons(ctx: ImportCtx, args: { deviceId: Id<"devices">; employeeNos: string[]; grantFullDeviceAccess?: boolean; cursor?: ImportCursor }): Promise<ImportResult> {
  if (args.employeeNos.length > IMPORT_PAGE_SIZE) throw new Error("Bir aktarımda en fazla 10 kişi seçilebilir");
  const target = await authorizeImportDevice(ctx, args.deviceId, true);
  if (args.grantFullDeviceAccess && !await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: target.projectId, permission: "accessRules.manage" })) throw new Error("Erişim kapsamını genişletmek için erişim kuralı yönetimi yetkisi gerekir");
  const biometricPermission: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: target.projectId, permission: "biometrics.manage" });
  const biometricEnabled: boolean = await ctx.runQuery(internal.hikDeviceImport.biometricEnabled, { projectId: target.projectId });
  const transferFingers = biometricPermission && biometricEnabled;
  const data = await readDevicePersons(target.devIndex, [...new Set(args.employeeNos.map(value => value.trim()))], args.cursor, transferFingers);
  if (transferFingers && data.persons.some(person => person.fingerCount > 0)) await assertTemplateKey();
  const createdRows: CreatedPerson[] = await ctx.runMutation(internal.hikDeviceImport.createPersons, {
    deviceId: args.deviceId, userId: ctx.user._id, persons: data.persons, grantFullDeviceAccess: args.grantFullDeviceAccess === true,
  });
  const result: ImportResult = { created: 0, matched: 0, conflicts: 0, manual: 0, fingerprintsStored: 0, fingerprintsSkipped: 0, ruleId: null,
    ...(data.nextCursor ? { nextCursor: data.nextCursor } : {}) };
  type Source = { employeeId: Id<"employees">; deviceId: Id<"devices">; userId: Id<"users">; fingerNo: number; expectedCardNumber: string; encData: string; iv: string; keyVersion: string };
  const sources: Source[] = [];
  const matchedIds = new Set<Id<"employees">>();
  for (const created of createdRows) {
    const person = created.row;
    const employeeId = created.employeeId ?? person.matchedEmployeeId;
    if (created.employeeId) { result.created++; result.ruleId = created.ruleId ?? result.ruleId; }
    else if (person.status === "matched") result.matched++;
    else if (person.status === "conflict") result.conflicts++;
    else if (person.status === "manual") result.manual++;
    if (!employeeId) continue;
    if (!transferFingers || person.fingerCount === 0) { result.fingerprintsSkipped += person.fingerCount; continue; }
    try {
      const templates = await readFingerprintTemplates(target.devIndex, person.employeeNo);
      const selection = selectImportFingerprints(templates);
      const existing: Doc<"employeeFingerprints">[] = await ctx.runQuery(internal.employeeFingerprints.listInternal, { employeeId });
      const storedSlots = new Set(existing.map(template => template.fingerPrintID));
      for (const template of selection.accepted) {
        if (storedSlots.has(template.fingerPrintID)) continue;
        if (storedSlots.size >= MAX_FINGERPRINTS_PER_EMPLOYEE) { result.fingerprintsSkipped++; continue; }
        const encrypted = await encryptTemplate(template.fingerData, `${employeeId}:${template.fingerPrintID}`);
        sources.push({ employeeId, deviceId: args.deviceId, userId: ctx.user._id, fingerNo: template.fingerPrintID, expectedCardNumber: person.employeeNo, ...encrypted });
        storedSlots.add(template.fingerPrintID);
        if (!created.employeeId) matchedIds.add(employeeId);
      }
      result.fingerprintsSkipped += selection.skipped;
    } catch {
      result.fingerprintsSkipped += person.fingerCount;
      console.warn("[hik-import] parmak izi aktarılamadı");
    }
  }
  if (sources.length) {
    await ctx.runMutation(internal.hikDeviceImport.recordSources, { sources });
    result.fingerprintsStored = sources.length;
    for (const employeeId of matchedIds) await ctx.scheduler.runAfter(0, internal.actions.hikFingerprint.pushFingerprintToDevices, { employeeId, excludeDeviceId: args.deviceId });
  }
  return result;
}
// Old clients may still send the consent flag; authorization is always server-side.
export const importDevicePersons = authedAction({ args: { deviceId: v.id("devices"), employeeNos: v.array(v.string()), cursor: v.optional(cursorValidator), biometricConsentConfirmed: v.optional(v.boolean()), grantFullDeviceAccess: v.optional(v.boolean()) }, handler: (ctx, { biometricConsentConfirmed: _legacy, ...args }): Promise<ImportResult> => runImportDevicePersons(ctx, args) });
