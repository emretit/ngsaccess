import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { EmployeeImportDialog } from "./EmployeeImportDialog";
import type { Id } from "../../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useAction: () => vi.fn() }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogHeader: Part, DialogTitle: Part };
});

it("presents the first file selection step and states the size and row limits", () => {
  const html = renderToStaticMarkup(<EmployeeImportDialog open onOpenChange={() => {}} projectId={"projects:1" as Id<"projects">} />);
  expect(html).toContain("Kişileri Excel’den içe aktar");
  expect(html).toContain("5 MB ve 1000 kişi satırı");
  expect(html).toContain('aria-label="Excel dosyası seç"');
});
