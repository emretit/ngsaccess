import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PdksRulesPunchFields } from "./pdksRulesPunchFields";
import { PdksRulesConfirmation } from "./pdksRulesConfirmation";
import { pdksRuleSchema, pdksPublishPayload, recommendedPunchRules, tomorrowInTurkey, ruleSummary, type PdksRuleValues } from "./pdksRulesModel";
const changes = vi.hoisted(() => new Map<string, (value: string) => void>());
vi.mock("./pdksRulesChoice", () => ({ Choice: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => {
  changes.set(id, onChange);
  return <label data-value={value}>{label}</label>;
} }));
vi.mock("@/components/ui/input", () => ({ Input: ({ id, value, onChange }: { id: string; value: number; onChange: (event: { target: { value: string } }) => void }) => {
  changes.set(id, value => onChange({ target: { value } }));
  return <input id={id} value={value} readOnly />;
} }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: Box, AlertDialogContent: Box, AlertDialogHeader: Box, AlertDialogTitle: Box, AlertDialogDescription: Box, AlertDialogFooter: Box, AlertDialogCancel: Box, AlertDialogAction: Box };
});
it("calculation choice and interval go to publish payload, summary and confirmation", () => {
  let values: PdksRuleValues = { effectiveFrom: tomorrowInTurkey(), punchMode: "legacy", ...recommendedPunchRules, checkpointMode: "all", targets: [] };
  const html = renderToStaticMarkup(<PdksRulesPunchFields values={values} change={patch => { values = { ...values, ...patch }; }} />);
  expect(html).toContain('data-value="firstLast"');
  expect(html).toContain("Çalışma süresi hesabı");
  expect(html).toContain("Tekrar okutma aralığı (dk)");
  changes.get("pdks-calculation-mode")?.("eachPunch");
  changes.get("pdks-min-punch-interval")?.("3");
  const payload = pdksPublishPayload("project" as Id<"projects">, pdksRuleSchema.parse(values));
  expect(payload).toMatchObject({ calculationMode: "eachPunch", minPunchIntervalMinutes: 3 });
  const summary = ruleSummary({ ...payload, _id: "rule" as Id<"pdksRuleVersions">, _creationTime: 0, createdAt: "", createdBy: "user" as Id<"users">, targets: [] }, undefined);
  expect(summary).toContain("Her giriş-çıkışı topla");
  expect(summary).toContain("3 dk");
  const confirmation = renderToStaticMarkup(<PdksRulesConfirmation confirmation={{ kind: "publish", values }} pending={false} error="" onClose={() => undefined} onConfirm={() => undefined} />);
  expect(confirmation).toContain("Her giriş-çıkışı topla");
  expect(confirmation).toContain("3 dk");
});
it("defaults preserve firstLast and one minute, validates bounds", () => {
  const values: PdksRuleValues = { effectiveFrom: tomorrowInTurkey(), punchMode: "legacy", ...recommendedPunchRules, checkpointMode: "all", targets: [] };
  expect(pdksPublishPayload("project" as Id<"projects">, values).calculationMode).toBeUndefined();
  expect(pdksPublishPayload("project" as Id<"projects">, values).minPunchIntervalMinutes).toBeUndefined();
  for (const minPunchIntervalMinutes of [-1, 61, NaN, Infinity]) expect(pdksRuleSchema.safeParse({ ...values, minPunchIntervalMinutes }).success).toBe(false);
  for (const minPunchIntervalMinutes of [0, 1, 60]) expect(pdksRuleSchema.safeParse({ ...values, minPunchIntervalMinutes }).success).toBe(true);
});
