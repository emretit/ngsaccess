// @vitest-environment node
import { expect, it } from "vitest";
import { newHikSearchId } from "./core";

it("Hik searchID stays within the 32-character device limit and is unique", () => {
  const ids = Array.from({ length: 50 }, () => newHikSearchId());
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  expect(new Set(ids).size).toBe(ids.length);
});
