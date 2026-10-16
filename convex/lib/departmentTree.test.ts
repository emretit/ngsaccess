import { describe, expect, it } from "vitest";
import { assertDepartmentAncestors } from "./departmentTree";

describe("department ancestors", () => {
  it("accepts an independent parent chain", () => {
    expect(() => assertDepartmentAncestors("child", ["parent", "root"])).not.toThrow();
  });
  it("rejects a self parent", () => {
    expect(() => assertDepartmentAncestors("self", ["self"])).toThrow("Departman kendi alt departmanının altına taşınamaz");
  });
  it("rejects moving beneath a descendant", () => {
    expect(() => assertDepartmentAncestors("moving", ["grandchild", "child", "moving"])).toThrow("kendi alt departmanının");
  });
  it("rejects an existing cycle and a chain that exceeds the walk limit", () => {
    expect(() => assertDepartmentAncestors("moving", ["a", "b", "a"])).toThrow("doğrulanamadı");
    expect(() => assertDepartmentAncestors("moving", ["a"], true)).toThrow("50 adım");
  });
  it("accepts a complete chain of 50 ancestors", () => {
    expect(() => assertDepartmentAncestors("moving", Array.from({ length: 50 }, (_, i) => String(i)))).not.toThrow();
  });
});
