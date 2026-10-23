import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { PdksRulesCheckpointFields } from "./pdksRulesCheckpointFields";
import { PdksRulesConfirmation } from "./pdksRulesConfirmation";
import { pdksRuleSchema, pdksPublishPayload, recommendedPunchRules, tomorrowInTurkey, ruleSummary, checkpointSummary, type PdksRuleValues, type Targets } from "./pdksRulesModel";

const changes = vi.hoisted(() => new Map<string, (value: string) => void>());
vi.mock("./pdksRulesChoice", () => ({ Choice: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => {
  changes.set(id, onChange);
  return <label data-value={value}>{label}<select id={id} value={value} onChange={() => undefined} /></label>;
} }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: Box, AlertDialogContent: Box, AlertDialogHeader: Box, AlertDialogTitle: Box, AlertDialogDescription: Box, AlertDialogFooter: Box, AlertDialogCancel: Box, AlertDialogAction: Box };
});
const deviceId = "device" as Id<"devices">;
const doorId = "door" as Id<"doors">;
const readerId = "reader" as Id<"readers">;
const targets: Targets = {
  devices: [{ deviceId, name: "Panel", selectable: true, reason: null }],
  doors: [{ deviceId, doorId, name: "Kapı", selectable: true, reason: null }],
  readers: [{ deviceId, doorId, readerId, name: "İç okuyucu", direction: "exit", hikReaderNo: 2, selectable: true, reason: null }],
};
it("selected reader defaults to both, selection changes publish payload and summary/confirmation show type", () => {
  let values: PdksRuleValues = { effectiveFrom: tomorrowInTurkey(), punchMode: "legacy", ...recommendedPunchRules, checkpointMode: "selected", targets: [{ targetType: "reader", deviceId, doorId, readerId }] };
  const html = renderToStaticMarkup(<PdksRulesCheckpointFields values={values} targets={targets} change={patch => { values = { ...values, ...patch }; }} toggleTarget={() => undefined} />);
  expect(html).toContain('data-value="both"');
  expect(html).toContain("İç okuyucu");
  expect(html).toContain("Okuyucu 2");
  expect(html).toContain("Mobil ve QR");
  changes.get("pdks-type-reader:reader")?.("exit");
  const payload = pdksPublishPayload("project" as Id<"projects">, pdksRuleSchema.parse(values));
  expect(payload.targets).toEqual([{ targetType: "reader", deviceId, doorId, readerId, pointType: "exit" }]);
  const summary = ruleSummary({ ...payload, _id: "rule" as Id<"pdksRuleVersions">, _creationTime: 0, createdAt: "", createdBy: "user" as Id<"users">, targets: [{ ...values.targets[0], _id: "target" as Id<"pdksCheckpointSelections">, _creationTime: 0, projectId: payload.projectId, ruleVersionId: "rule" as Id<"pdksRuleVersions"> }] }, targets);
  expect(summary).toContain("İç okuyucu: Yalnız çıkış");
  expect(renderToStaticMarkup(<PdksRulesConfirmation confirmation={{ kind: "publish", values }} targets={targets} pending={false} error="" onClose={() => undefined} onConfirm={() => undefined} />)).toContain("İç okuyucu: Yalnız çıkış");
});
it("device and door point types survive validation and untyped targets retain both summary", () => {
  const values = pdksRuleSchema.parse({ effectiveFrom: tomorrowInTurkey(), punchMode: "legacy", ...recommendedPunchRules, checkpointMode: "selected", targets: [{ targetType: "device", deviceId, pointType: "entry" }, { targetType: "door", deviceId, doorId, pointType: "both" }] });
  expect(pdksPublishPayload("project" as Id<"projects">, values).targets?.map(target => target.pointType)).toEqual(["entry", "both"]);
  expect(checkpointSummary([{ targetType: "door", deviceId, doorId }], targets)).toBe("Kapı: Giriş ve çıkış");
});
