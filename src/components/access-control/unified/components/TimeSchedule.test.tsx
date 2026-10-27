import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("../templates/TemplatePicker", () => ({ TemplatePicker: () => null }));
import { TimeSchedule } from "./TimeSchedule";
it.each(["custom", "template"] as const)("%s zaman kaynağını dolu düğmeyle gösterir", (scheduleMode) => {
  const html = renderToStaticMarkup(<TimeSchedule formData={{ scheduleMode, start_time: "", end_time: "", days: [] }} setFormData={() => undefined} />);
  const custom = html.match(/<button[^>]*>Özel saat<\/button>/)?.[0];
  const template = html.match(/<button[^>]*>Şablon kullan<\/button>/)?.[0];
  const selected = scheduleMode === "custom" ? custom : template;
  const unselected = scheduleMode === "custom" ? template : custom;
  expect(selected).toContain('aria-pressed="true"');
  expect(selected).toContain("bg-primary");
  expect(unselected).toContain('aria-pressed="false"');
  expect(unselected).toContain("bg-surface");
  expect(unselected).not.toContain("bg-primary");
});
