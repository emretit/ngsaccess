import { expect } from "vitest";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A visible label supplies the associated control's accessible name. */
export function expectLabel(html: string, label: string) {
  const labelTag = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${escapeRegExp(label)}</label>`));
  expect(labelTag).not.toBeNull();
  const id = labelTag?.[1];
  if (!id) throw new Error(`Associated label not found: ${label}`);
  const escapedId = escapeRegExp(id);
  const controls = html.match(new RegExp(`<(?:button|input|select)[^>]*id="${escapedId}"[^>]*>`, "g"));
  expect(controls).toHaveLength(1);
  const control = controls?.[0];
  expect(control).not.toContain("aria-label=");
  expect(control).not.toContain("aria-labelledby=");
  expect(html.match(new RegExp(`for="${escapedId}"`, "g"))).toHaveLength(1);
}
