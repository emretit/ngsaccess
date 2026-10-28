import { expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import { classifyImportPerson, splitDevicePersonName, selectImportFingerprints } from "./hikDeviceImport";
import { hikWallClockToUtcISO, toUtcISO } from "./trDate";
const projectId = "p" as Id<"projects">;
const person = { employeeNo: "1", name: "Okan ISMAN", cards: [], fingerCount: 1 };
it("classifies exact project matches, cross project and padded conflicts, multiple and mismatching cards", () => {
  const employee = { _id: "e" as Id<"employees">, projectId, cardNumber: "1" };
  expect(classifyImportPerson(person, projectId, [employee]).status).toBe("matched");
  expect(classifyImportPerson(person, projectId, [{ ...employee, projectId: "other" as Id<"projects"> }]).status).toBe("conflict");
  expect(classifyImportPerson(person, projectId, [{ ...employee, cardNumber: "0001" }]).status).toBe("conflict");
  expect(classifyImportPerson({ ...person, cards: ["1", "2"] }, projectId, []).status).toBe("manual");
  expect(classifyImportPerson({ ...person, cards: ["2"] }, projectId, []).status).toBe("manual");
  expect(classifyImportPerson({ ...person, cards: ["1"] }, projectId, []).status).toBe("new");
});
it("splits the last word as surname, keeping single-word names", () => {
  expect(splitDevicePersonName("  Okan Ali ISMAN ")).toEqual({ firstName: "Okan Ali", lastName: "ISMAN" });
  expect(splitDevicePersonName("Okan")).toEqual({ firstName: "Okan", lastName: "" });
});
it("accepts legacy slots 6-10 but caps five distinct valid fingers", () => {
  expect(selectImportFingerprints([6, 6, 7, 8, 9, 10, 1, 0, 11].map(fingerPrintID => ({ fingerPrintID })))).toEqual({ accepted: [6, 7, 8, 9, 10].map(fingerPrintID => ({ fingerPrintID })), skipped: 4 });
});
it("ignores the device offset only for history, validates calendar dates", () => {
  expect(hikWallClockToUtcISO("2026-09-14T15:37:19+08:00")).toBe("2026-09-14T12:37:19.000Z");
  expect(hikWallClockToUtcISO("2026-09-14T15:37:19Z")).toBe("2026-09-14T12:37:19.000Z");
  expect(toUtcISO("2026-09-14T15:37:19+08:00")).toBe("2026-09-14T07:37:19.000Z");
  expect(hikWallClockToUtcISO("2026-02-30T15:37:19+08:00")).toBeUndefined();
});
