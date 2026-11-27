import { describe, expect, it } from "vitest";
import { employeeNaturalKey } from "./employeeListKeys";

describe("Turkish natural index keys", () => {
  it("matches the original numeric Turkish comparator for names, case, email and card values", () => {
    const values = ["Ada", "ada", "ADA", "Âda", "Işık", "ışık", "İpek", "ipek", "Çağrı", "cagri", "Oya", "Öykü", "Şule", "Sule", "Ümit", "umit", "Ali 2", "Ali 10", "Ali 002", "", "A", "a b", "a-b", "00123", "123", "8", "20", "a@b.test", "a_b", "A B", "A-B"].filter(value => employeeNaturalKey(value) !== undefined);
    const rows = values.map((value, id) => ({ value, id: String(id).padStart(3, "0") }));
    const expected = [...rows].sort((a, b) => a.value.localeCompare(b.value, "tr", { numeric: true }) || a.id.localeCompare(b.id));
    const actual = [...rows].sort((a, b) => {
      const ka = `${employeeNaturalKey(a.value)}\u0000${a.id}`;
      const kb = `${employeeNaturalKey(b.value)}\u0000${b.id}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    expect(actual).toEqual(expected);
  });
  it("always produces deterministic keys for Unicode without disabling project pagination", () => {
    for (const name of ["Zoë", "张", "â", "ä", "ß", "Ada\u00a0Test", "O’Neil"]) {
      expect(employeeNaturalKey(name)).toEqual(expect.any(String));
      expect(employeeNaturalKey(name)).toBe(employeeNaturalKey(name));
    }
    expect(employeeNaturalKey("Ada\u00a0Test")).toBe(employeeNaturalKey("Ada Test"));
  });
});
