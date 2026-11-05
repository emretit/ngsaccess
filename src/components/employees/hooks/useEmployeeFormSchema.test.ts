import { expect, it } from "vitest";
import { employeeFormSchema } from "./useEmployeeFormSchema";
const required = { firstName: "Ada", lastName: "Test", email: "ada@example.test", cardNumber: "123" };
it.each([undefined, "", "2026-11-01", "2028-02-29"])("accepts an optional calendar date %s", accessStartsAt => {
  expect(employeeFormSchema.safeParse({ ...required, accessStartsAt }).success).toBe(true);
});
it.each(["", "  ", "ada@example.test"])("accepts an optional email %j", email => {
  expect(employeeFormSchema.safeParse({ ...required, email }).success).toBe(true);
});
it.each(["ada", "ada@", "a b@example.test"])("rejects a malformed email %j", email => {
  expect(employeeFormSchema.safeParse({ ...required, email }).success).toBe(false);
});
it.each(["2026-02-30", "2026-13-01", "invalid", "2026-1-01"])("rejects invalid form calendar date %s", accessStartsAt => {
  expect(employeeFormSchema.safeParse({ ...required, accessStartsAt }).success).toBe(false);
});
it.each([undefined, "", " 10000000146 "])("accepts an empty or checksum-valid TC %j", tcNo => {
  expect(employeeFormSchema.safeParse({ ...required, tcNo }).success).toBe(true);
});
it.each(["12345678901", "10000000147", "01234567890", "123"])("rejects a TC that fails the checksum %j", tcNo => {
  const result = employeeFormSchema.safeParse({ ...required, tcNo });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.path).toEqual(["tcNo"]);
});
