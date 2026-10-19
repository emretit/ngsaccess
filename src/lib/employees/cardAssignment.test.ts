import { describe, expect, it } from "vitest";
import { assignReadCard, distributePastedCards, mergeAssignmentResults, nextEmptyCardAssignment, validateCardNumber, type CardAssignmentRow } from "./cardAssignment";

const rows: CardAssignmentRow[] = [
  { employeeId: "a", employeeName: "Ada", cardNumber: "" },
  { employeeId: "b", employeeName: "Bora", cardNumber: "önceden" },
  { employeeId: "c", employeeName: "Can", cardNumber: "" },
];

describe("cardAssignment", () => {
  it("pastes lines into the next empty rows and skips blank lines", () => {
    const result = distributePastedCards(rows, "123\n\n456");
    expect(result.rows.map((row) => row.cardNumber)).toEqual(["123", "önceden", "456"]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects a duplicate card within the assignment", () => {
    const result = distributePastedCards(rows, "123\n123");
    expect(result.rows.map((row) => row.cardNumber)).toEqual(["123", "önceden", ""]);
    expect(result.rejected).toEqual(["123"]);
    expect(validateCardNumber("123", [{ employeeId: "a", employeeName: "Ada", cardNumber: "123" }, { employeeId: "c", employeeName: "Can", cardNumber: "" }], "c")).toContain("başka bir satırda");
  });

  it("routes reader captures to the next empty row and preserves failed rows for editing", () => {
    const captured = assignReadCard(rows, "card-7");
    expect(captured.rows[0]?.cardNumber).toBe("card-7");
    const merged = mergeAssignmentResults(rows, [{ employeeId: "a", status: "error", message: "Çakışma" }]);
    expect(merged[0]).toMatchObject({ cardNumber: "", status: "error", message: "Çakışma" });
  });

  it("finds the next empty row and validates card format and required values", () => {
    expect(nextEmptyCardAssignment(rows)).toBe(0);
    expect(validateCardNumber("", rows, "a")).toContain("boş");
    expect(validateCardNumber("bad card", rows, "a")).toContain("biçimi");
    expect(validateCardNumber("ok-123", rows, "a")).toBeNull();
  });
});
