import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { alarmListArgs, AlarmAcknowledgeButton, AlarmFilters, type AlarmFiltersValue } from "./AlarmFilters";

type ElementNode = ReactElement<{ children?: unknown; onChange?: (event: { target: { value: string } }) => void; onClick?: () => void; "aria-label"?: string }>;
function findElement(node: unknown, predicate: (element: ElementNode) => boolean): ElementNode | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const match = findElement(child, predicate); if (match) return match; }
    return undefined;
  }
  if (!node || typeof node !== "object" || !("type" in node) || !("props" in node)) return undefined;
  const element = node as ElementNode;
  if (predicate(element)) return element;
  return findElement(element.props.children, predicate);
}

const value: AlarmFiltersValue = { status: "open", severity: "", deviceId: "", fromDay: "", toDay: "" };
describe("alarm filtre ve onay bileşenleri", () => {
  it("durum filtresi değişince kontrollü sorgu filtresini günceller", () => {
    const onChange = vi.fn();
    const configured = { ...value, severity: "critical" as const, deviceId: "device-id" as Id<"devices">, fromDay: "2026-10-19", toDay: "2026-10-20" };
    const tree = AlarmFilters({ value: configured, devices: [], onChange });
    const status = findElement(tree, node => node.props["aria-label"] === "Durum");
    if (!status?.props.onChange) throw new Error("Durum filtresi bulunamadı");
    status.props.onChange({ target: { value: "acked" } });
    const changed = { ...configured, status: "acked" as const };
    expect(onChange).toHaveBeenCalledWith(changed);
    expect(alarmListArgs("project-id" as Id<"projects">, "alarm", changed)).toEqual({ projectId: "project-id", category: "alarm", status: "acked", severity: "critical", deviceId: "device-id", from: "2026-10-18T21:00:00.000Z", to: "2026-10-20T20:59:59.999Z" });
  });
  it("olay onay düğmesi onay akışını çağırır", () => {
    const onAcknowledge = vi.fn();
    const button = AlarmAcknowledgeButton({ onAcknowledge }) as ElementNode;
    button.props.onClick?.();
    expect(onAcknowledge).toHaveBeenCalledOnce();
  });
});
