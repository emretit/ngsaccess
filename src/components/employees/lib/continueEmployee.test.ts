import { expect, it } from "vitest";
import { resolveContinuingEmployee } from "./continueEmployee";

const ada = { _id: "e1", firstName: "Ada" };

it("P11: kayıt listedeyse açılır, sorgu sürerken beklenir, sorgu döndüğü hâlde listede yoksa takılmaz", () => {
  expect(resolveContinuingEmployee([ada], "e1", undefined)).toBe(ada);
  expect(resolveContinuingEmployee([], "e1", undefined)).toBe("wait");
  expect(resolveContinuingEmployee([], "e1", null)).toBe("missing");
  expect(resolveContinuingEmployee([], "e1", { _id: "e1" })).toBe("missing");
});
