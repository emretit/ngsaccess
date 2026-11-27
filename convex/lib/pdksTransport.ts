import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { classifyReadingSource } from "./pdksSource";

/** Nonpersistent, report-authorized calculation DTO; raw device bodies never leave this query. */
export const pdksReadingValidator = v.object({
  _id: v.id("cardReadings"), _creationTime: v.number(), projectId: v.optional(v.id("projects")), employeeId: v.optional(v.id("employees")), deviceId: v.optional(v.id("devices")),
  cardNo: v.string(), accessTime: v.string(), accessStatus: v.optional(v.union(v.literal("izin_verildi"), v.literal("reddedildi"))), direction: v.optional(v.union(v.literal("entry"), v.literal("exit"))),
  ideIoId: v.optional(v.number()), hikCardReaderNo: v.optional(v.number()),
  pdksSource: v.union(v.literal("card"), v.literal("pin"), v.literal("qr"), v.literal("mobile"), v.literal("manual"), v.literal("biometric"), v.literal("unknown")),
  unassignedDate: v.optional(v.string()),
});
export type PdksTransportReading = typeof pdksReadingValidator.type;
export function toPdksTransport(reading: Doc<"cardReadings">): PdksTransportReading {
  const { _id, _creationTime, projectId, employeeId, deviceId, cardNo, accessTime, accessStatus, direction, ideIoId, hikCardReaderNo } = reading;
  return { _id, _creationTime, projectId, employeeId, deviceId, cardNo, accessTime, accessStatus, direction, ideIoId, hikCardReaderNo, pdksSource: classifyReadingSource(reading) };
}
