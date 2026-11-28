import { expect, it } from "vitest";
import schema from "./schema";
import { z } from "zod";

const indexes = z.array(z.object({ indexDescriptor: z.string() }));
const exportedTable = z.object({
  indexes, stagedDbIndexes: indexes,
  searchIndexes: indexes, stagedSearchIndexes: indexes,
  vectorIndexes: indexes, stagedVectorIndexes: indexes,
});

it("all deployed and staged index names meet Convex identifier constraints", () => {
  let count = 0;
  for (const [table, definition] of Object.entries(schema.tables)) {
    // Convex strips this internal method from its published declarations.
    const exportDefinition: unknown = Reflect.get(definition, "export");
    if (typeof exportDefinition !== "function") throw new Error(`Cannot export ${table}`);
    const exported = exportedTable.parse(exportDefinition.call(definition));
    const names = new Set<string>();
    for (const index of [
      ...exported.indexes, ...exported.stagedDbIndexes,
      ...exported.searchIndexes, ...exported.stagedSearchIndexes,
      ...exported.vectorIndexes, ...exported.stagedVectorIndexes,
    ]) {
      const name = index.indexDescriptor;
      const context = `${table}.${name}`;
      expect(name.length, context).toBeLessThanOrEqual(64);
      expect(name, context).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect(["by_id", "by_creation_time"], context).not.toContain(name);
      expect(names.has(name), `duplicate ${context}`).toBe(false);
      names.add(name);
      count++;
    }
  }
  expect(count).toBeGreaterThan(0);
});
