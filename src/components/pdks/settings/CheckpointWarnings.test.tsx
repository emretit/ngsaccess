import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CheckpointWarnings } from "./CheckpointWarnings";

const state = vi.hoisted(() => ({ warnings: undefined as { key: string; message: string }[] | undefined }));
vi.mock("convex/react", () => ({ useQuery: () => state.warnings }));
const projectId = "project" as Id<"projects">;
beforeEach(() => { state.warnings = undefined; });

it("renders nothing while loading or when every selected reader matches", () => {
  expect(renderToStaticMarkup(<CheckpointWarnings projectId={projectId} />)).toBe("");
  state.warnings = [];
  expect(renderToStaticMarkup(<CheckpointWarnings projectId={projectId} />)).toBe("");
});

it("lists each warning in an alert", () => {
  state.warnings = [{ key: "unknown:d", message: "Panel: son 7 günde 3 numaralı okuyucudan okuma geldi" }, { key: "moved:r", message: "Panel: okuyucu silinmiş" }];
  const html = renderToStaticMarkup(<CheckpointWarnings projectId={projectId} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("PDKS kuralındaki okuyucularda sorun var");
  expect(html).toContain("3 numaralı okuyucudan");
  expect(html).toContain("okuyucu silinmiş");
});
