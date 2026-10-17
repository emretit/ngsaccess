import { expect, it } from "vitest";
import { departmentPath } from "./departmentPath";
it("aynı adlı alt departmanları üst yolu ile ayırır", () => {
  const rows = [
    { _id: "a", name: "A" },
    { _id: "b", name: "B" },
    { _id: "x", name: "Montaj", parentId: "a" },
    { _id: "y", name: "Montaj", parentId: "b" },
  ];
  expect(departmentPath("x", rows)).toBe("A / Montaj");
  expect(departmentPath("y", rows)).toBe("B / Montaj");
});
it("bozuk eski üst ilişkisinde sonlanır", () => {
  expect(
    departmentPath("x", [
      { _id: "x", name: "X", parentId: "y" },
      { _id: "y", name: "Y", parentId: "x" },
    ]),
  ).toBe("Y / X");
  expect(departmentPath("missing", [])).toBe("");
});
