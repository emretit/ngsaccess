import { describe, expect, it, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { loadRuleEditor } from "./loadRuleEditor";

const ruleId = "rule" as Id<"accessRules">;
const member = (id: string) => ({ _id: `member-${id}`, groupId: ruleId, employeeId: id, createdAt: "2026-01-01" });

function client(failSecondPage = false) {
  const query = vi.fn(async (reference: Parameters<ConvexReactClient["query"]>[0], args?: unknown) => {
    if (getFunctionName(reference) === "accessRules:getDetails") {
      return { _id: ruleId, name: "Rule", scheduleTemplateId: "template", groupMembers: [member("preview-only")], groupDevices: [], groupDoors: [], membersTruncated: true };
    }
    const input = args as { kind: string; paginationOpts: { cursor: string | null } };
    if (input.kind === "people") {
      if (input.paginationOpts.cursor === "people-next") {
        if (failSecondPage) throw new Error("second page failed");
        return { kind: "people", page: [member("b")], isDone: true, continueCursor: "done" };
      }
      return { kind: "people", page: [member("a")], isDone: false, continueCursor: "people-next" };
    }
    if (input.kind === "doors") return { kind: "doors", page: [{ doorId: "door", doors: { deviceId: "panel" } }], isDone: true, continueCursor: "done" };
    return { kind: "devices", page: [{ _id: "panel-link", deviceId: "panel" }], isDone: true, continueCursor: "done" };
  });
  // This fixture implements only the two queries exercised by the loader.
  return { query: query as unknown as ConvexReactClient["query"] };
}

describe("editor cursor snapshot", () => {
  it("loads all pages of every kind and never uses truncated getDetails membership", async () => {
    const convex = client();
    const result = await loadRuleEditor(convex, ruleId);
    expect(result.scheduleTemplateId).toBe("template");
    expect(result.groupMembers?.map(row => row.employeeId)).toEqual(["a", "b"]);
    expect(result.groupDevices?.map(row => row.deviceId)).toEqual(["panel"]);
    expect(result.groupDoors).toEqual([{ doorId: "door", deviceId: "panel" }]);
    expect(convex.query).toHaveBeenCalledTimes(5);
  });
  it("rejects on a later page failure instead of opening a partial editor", async () => {
    await expect(loadRuleEditor(client(true), ruleId)).rejects.toThrow("second page failed");
  });
});
