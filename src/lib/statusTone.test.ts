import { describe, expect, it } from "vitest";
import { statusTone, type StatusTone } from "./statusTone";

describe("statusTone", () => {
  it.each<[StatusTone, string]>([
    ["success", "status-success-badge"],
    ["warning", "status-warning-badge"],
    ["danger", "status-danger-badge"],
    ["info", "status-info-badge"],
    ["neutral", "bg-muted text-muted-foreground border-border"],
  ])("%s durumunu semantik token'a eşler", (tone, expected) => {
    expect(statusTone(tone)).toBe(expected);
  });
});
