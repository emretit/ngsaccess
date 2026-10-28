"use node";

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { authedAction } from "../lib/customFunctions";
import { isProjectAllowed } from "../lib/auth";
import { searchPersonOnDevice } from "../lib/gateway/persons";
import { readImportCardsPage } from "../lib/gateway/cards";
import { searchFingerprintsOnDevice, readFingerprintTemplates } from "../lib/gateway/biometrics";
import { assertTemplateKey, encryptTemplate } from "../lib/fingerprintCrypto";
import { selectImportFingerprints, type ImportPerson, type ImportRow } from "../lib/hikDeviceImport";

type ImportCtx = ActionCtx & { user: Doc<"users"> };
const MAX_IMPORT_PERSONS = 1000;
const MAX_CARD_PAGES = 1000;

export async function authorizeImportDevice(ctx: ImportCtx, deviceId: Id<"devices">, importing: boolean) {
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

async function countFingers(devIndex: string, employeeNo: string): Promise<number> {
  const searchID = crypto.randomUUID();
  const ids = new Set<string>();
  for (let page = 0; page < 10; page++) {
    const result = await searchFingerprintsOnDevice(devIndex, { searchID, position: page * 30, maxResults: 30, employeeNo });
    if (!result.ok) throw new Error("Parmak izi sayısı okunamadı");
    const before = ids.size;
    for (const fingerprint of result.fingerprints) if (fingerprint.fingerPrintID !== undefined) ids.add(fingerprint.fingerPrintID);
    if (ids.size === before || !result.hasMore) break;
  }
  return ids.size;
}

/** Returns metadata only; fingerprint templates never escape the node action. */
export async function readDevicePersons(devIndex: string, selected?: readonly string[]) {
  const cardsByPerson = new Map<string, string[]>();
  const cardSearch = crypto.randomUUID();
  let cardTotal = 0;
  let position = 0;
  for (let page = 0; page < MAX_CARD_PAGES; page++) {
    const result = await readImportCardsPage(devIndex, position, cardSearch);
    cardTotal = result.total;
    for (const card of result.cards) {
      if (!card.employeeNo) continue;
      const list = cardsByPerson.get(card.employeeNo) ?? [];
      list.push(card.cardNo); cardsByPerson.set(card.employeeNo, list);
    }
    if (!result.hasMore) break;
    if (result.nextPosition <= position || page === MAX_CARD_PAGES - 1) throw new Error("Kart listesi tamamlanamadı");
    position = result.nextPosition;
  }
  const persons: ImportPerson[] = [];
  const searchID = crypto.randomUUID();
  let total = 0;
  position = 0;
  let truncated = false;
  const seen = new Set<string>();
  for (let page = 0; page < 35; page++) {
    const result = await searchPersonOnDevice(devIndex, { searchID, searchResultPosition: position, maxResults: 30 });
    if (!result.ok) throw new Error("Cihaz kişileri okunamadı");
    total = Math.max(total, result.total ?? 0);
    const list = result.persons ?? [];
    for (const person of list) {
      const employeeNo = person.employeeNo.trim();
      if (!employeeNo || seen.has(employeeNo)) continue;
      seen.add(employeeNo);
      if (seen.size > MAX_IMPORT_PERSONS) { truncated = true; break; }
      if (selected && !selected.includes(employeeNo)) continue;
      persons.push({ employeeNo, name: person.name?.trim() || employeeNo, cards: [...new Set(cardsByPerson.get(employeeNo) ?? [])], fingerCount: await countFingers(devIndex, employeeNo) });
    }
    if (truncated || (total > MAX_IMPORT_PERSONS && seen.size >= MAX_IMPORT_PERSONS)) { truncated = true; break; }
    if (list.length === 0 || (result.total !== undefined && (result.nextPosition ?? 0) >= result.total)) break;
    if ((result.nextPosition ?? 0) <= position) throw new Error("Kişi listesi tamamlanamadı");
    position = result.nextPosition ?? position;
  }
  return { persons, totals: { persons: Math.max(total, seen.size), cards: cardTotal }, truncated };
}

export async function runPreviewDeviceImport(ctx: ImportCtx, args: { deviceId: Id<"devices"> }) {
  const target = await authorizeImportDevice(ctx, args.deviceId, false);
  const data = await readDevicePersons(target.devIndex);
  const rows: ImportRow[] = await ctx.runQuery(internal.hikDeviceImport.classifyPersons, { projectId: target.projectId, persons: data.persons });
  return { rows, totals: data.totals, ...(data.truncated ? { truncated: true } : {}) };
}
export const previewDeviceImport = authedAction({ args: { deviceId: v.id("devices") }, handler: runPreviewDeviceImport });

type ImportResult = { created: number; matched: number; conflicts: number; manual: number; consentsRecorded: number; fingerprintsStored: number; fingerprintsSkipped: number; ruleId: Id<"accessRules"> | null };
export async function runImportDevicePersons(ctx: ImportCtx, args: { deviceId: Id<"devices">; employeeNos: string[]; biometricConsentConfirmed: boolean }): Promise<ImportResult> {
  if (args.employeeNos.length > MAX_IMPORT_PERSONS) throw new Error(`Bir aktarımda en fazla ${MAX_IMPORT_PERSONS} kişi seçilebilir`);
  const target = await authorizeImportDevice(ctx, args.deviceId, true);
  const biometricPermission: boolean = await ctx.runQuery(internal.roles.checkPermission, { userId: ctx.user._id, projectId: target.projectId, permission: "biometrics.manage" });
  const biometricEnabled: boolean = await ctx.runQuery(internal.hikDeviceImport.biometricEnabled, { projectId: target.projectId });
  const transferFingers = args.biometricConsentConfirmed && biometricPermission && biometricEnabled;
  const data = await readDevicePersons(target.devIndex, [...new Set(args.employeeNos.map(value => value.trim()))]);
  const classified: ImportRow[] = await ctx.runQuery(internal.hikDeviceImport.classifyPersons, { projectId: target.projectId, persons: data.persons });
  if (transferFingers && classified.some(row => row.status === "new" && row.fingerCount > 0)) await assertTemplateKey();
  const result: ImportResult = { created: 0, matched: 0, conflicts: 0, manual: 0, consentsRecorded: 0, fingerprintsStored: 0, fingerprintsSkipped: 0, ruleId: null };
  for (const person of data.persons) {
    const created: { row: ImportRow; employeeId?: Id<"employees">; ruleId?: Id<"accessRules">; consentRecorded: boolean } = await ctx.runMutation(internal.hikDeviceImport.createPerson, { deviceId: args.deviceId, userId: ctx.user._id, person, consent: transferFingers });
    if (!created.employeeId || !created.ruleId) {
      if (created.row.status === "matched") result.matched++;
      else if (created.row.status === "conflict") result.conflicts++;
      else if (created.row.status === "manual") result.manual++;
      continue;
    }
    result.created++; result.ruleId = created.ruleId;
    if (created.consentRecorded) result.consentsRecorded++;
    let stored = 0;
    try {
      if (transferFingers && created.consentRecorded) {
        const templates = await readFingerprintTemplates(target.devIndex, person.employeeNo);
        const selection = selectImportFingerprints(templates);
        for (const template of selection.accepted) {
          const encrypted = await encryptTemplate(template.fingerData, `${created.employeeId}:${template.fingerPrintID}`);
          await ctx.runMutation(internal.hikDeviceImport.recordSource, { employeeId: created.employeeId, deviceId: args.deviceId, fingerNo: template.fingerPrintID, userId: ctx.user._id, expectedCardNumber: person.employeeNo });
          await ctx.runMutation(internal.employeeFingerprints.upsertEncrypted, { employeeId: created.employeeId, fingerNo: template.fingerPrintID, sourceDeviceId: args.deviceId, enrolledBy: ctx.user._id, expectedCardNumber: person.employeeNo, ...encrypted });
          stored++; result.fingerprintsStored++;
        }
        result.fingerprintsSkipped += selection.skipped;
      } else result.fingerprintsSkipped += person.fingerCount;
    } catch (error) {
      // Kişi zaten oluştu; bir kişinin şablon hatası diğerlerinin aktarımını durdurmaz. Şablon loglanmaz.
      result.fingerprintsSkipped += Math.max(person.fingerCount - stored, 0);
      console.warn(`[hik-import] parmak izi aktarılamadı, employeeNo=${person.employeeNo}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    } finally {
      await ctx.runMutation(internal.hikDeviceImport.scheduleSync, { employeeId: created.employeeId, ruleId: created.ruleId });
    }
  }
  return result;
}
export const importDevicePersons = authedAction({ args: { deviceId: v.id("devices"), employeeNos: v.array(v.string()), biometricConsentConfirmed: v.boolean() }, handler: runImportDevicePersons });
