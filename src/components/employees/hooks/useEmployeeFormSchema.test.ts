import { expect, it } from "vitest";
import { employeeFormSchema } from "./useEmployeeFormSchema";
const required = { firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "123" };
it.each([undefined, "", "2026-11-01", "2028-02-29"])("accepts an optional calendar date %s", accessStartsAt => {
  expect(employeeFormSchema.safeParse({ ...required, accessStartsAt }).success).toBe(true);
});
it.each(["2026-02-30", "2026-13-01", "invalid", "2026-1-01"])("rejects invalid form calendar date %s", accessStartsAt => {
  expect(employeeFormSchema.safeParse({ ...required, accessStartsAt }).success).toBe(false);
});
