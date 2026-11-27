// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() && entry.name !== "_generated" ? files(join(root, entry.name)) : entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [join(root, entry.name)] : []);
}
function unsafeRegistrations(source: string, ast = ts.createSourceFile("guard.ts", source, ts.ScriptTarget.Latest, true)): string[] {
  const result: string[] = [];
  for (const node of ast.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const moduleName = node.moduleSpecifier.text.replace(/\.(js|ts)$/, "");
    if (!moduleName.endsWith("/_generated/server") && moduleName !== "convex/server") continue;
    const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
    if (!bindings) { if (ts.isExportDeclaration(node) && !node.isTypeOnly) result.push("wildcard registration escape"); continue; }
    if (ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings)) { result.push("namespace registration escape"); continue; }
    for (const specifier of bindings.elements) {
      const name = (specifier.propertyName ?? specifier.name).text;
      if (["mutation", "internalMutation", "mutationGeneric", "internalMutationGeneric"].includes(name)) result.push(name);
    }
  }
  return result;
}
function migrationsWithoutHooks(source: string, ast = ts.createSourceFile("guard.ts", source, ts.ScriptTarget.Latest, true)): string[] {
  const constructors = new Set(["Migrations"]);
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== "@convex-dev/migrations") continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const specifier of bindings.elements) {
      if ((specifier.propertyName ?? specifier.name).text === "Migrations") constructors.add(specifier.name.text);
    }
  }
  const violations: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isNewExpression(node) && (
      ts.isIdentifier(node.expression) && constructors.has(node.expression.text) ||
      ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "Migrations"
    )) {
      const options = node.arguments?.[1];
      // Require an explicit wrapped builder; spreads alone can hide the default raw builder.
      const hooked = options && ts.isObjectLiteralExpression(options) && options.properties.some(property =>
        ts.isShorthandPropertyAssignment(property) && property.name.text === "internalMutation" ||
        ts.isPropertyAssignment(property) && property.name.getText(ast).replace(/["']/g, "") === "internalMutation" &&
          ts.isIdentifier(property.initializer) && property.initializer.text === "internalMutation");
      if (!hooked) violations.push(node.expression.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;
}
it("all production registrations install hooks for insert, patch, replace and delete, including scheduled helper callers", () => {
  // Registration-level protection covers dynamic table names and helper calls; inspecting
  // only literal insert strings misses employeeCascade continuation/retention writes.
  for (const path of files(join(process.cwd(), "convex"))) {
    const source = readFileSync(path, "utf8");
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    expect(migrationsWithoutHooks(source, ast), path).toEqual([]);
    if (path === join(process.cwd(), "convex/lib/dashboardMutations.ts")) continue;
    expect(unsafeRegistrations(source, ast), path).toEqual([]);
  }
  const wrapper = readFileSync(join(process.cwd(), "convex/lib/dashboardMutations.ts"), "utf8");
  expect(wrapper).toMatch(/export const mutation = customMutation\(baseMutation, customCtx\(withDashboardSummary\)\)/);
  expect(wrapper).toMatch(/export const internalMutation = customMutation\(baseInternalMutation, customCtx\(withDashboardSummary\)\)/);
}, 30_000);
it.each(["insert", "patch", "replace", "delete"])("rejects a raw continuation performing %s even alongside a safe import", operation => {
  expect(unsafeRegistrations(`import { internalMutation as raw } from "../_generated/server";
    import { mutation } from "./dashboardMutations";
    export const continuation = raw({ handler: ctx => ctx.db.${operation}(id, value) });`)).toEqual(["internalMutation"]);
});
it("rejects namespace imports, re-exports and direct generic registration", () => {
  expect(unsafeRegistrations(`import * as raw from "./_generated/server";`)).toHaveLength(1);
  expect(unsafeRegistrations(`export { internalMutation as unsafe } from "./_generated/server";`)).toEqual(["internalMutation"]);
  expect(unsafeRegistrations(`export * from "./_generated/server.js";`)).toEqual(["wildcard registration escape"]);
  expect(unsafeRegistrations(`import { mutationGeneric } from "convex/server";`)).toEqual(["mutationGeneric"]);
});

it("requires internalMutation on every migrations constructor, including aliases and nested declarations", () => {
  expect(migrationsWithoutHooks(`const a = new Migrations<DataModel>(components.migrations, { internalMutation });`)).toEqual([]);
  expect(migrationsWithoutHooks(`const a = new Migrations(components.migrations, { internalMutation: internalMutation });`)).toEqual([]);
  expect(migrationsWithoutHooks(`new Migrations(components.migrations); new Migrations(components.migrations, {});`)).toHaveLength(2);
  expect(migrationsWithoutHooks(`import { Migrations as MigrationRunner } from "@convex-dev/migrations";
    function setup() { return new MigrationRunner(components.migrations); }`)).toEqual(["MigrationRunner"]);
  expect(migrationsWithoutHooks(`new migrations.Migrations(components.migrations, { other: internalMutation });`)).toHaveLength(1);
});
