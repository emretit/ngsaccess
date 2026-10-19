import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { BatchCardAssignDialog } from "./BatchCardAssignDialog";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn().mockResolvedValue([]), useAction: () => vi.fn().mockResolvedValue(null), useQuery: () => undefined }));
vi.mock("@/hooks/useDevices", () => ({ useDevices: () => ({ devices: [] }) }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogHeader: Part, DialogTitle: Part };
});

const person = (id: string, cardNumber: string): Employee => ({
  _id: id as Id<"employees">, firstName: "Ada", lastName: "Yılmaz", email: "ada@example.com", cardNumber,
});

it("shows cardless selected people, manual entry, reader mode and save action", () => {
  const html = renderToStaticMarkup(<BatchCardAssignDialog open onOpenChange={() => {}} projectId={"projects:1" as Id<"projects">} employees={[person("employees:1", ""), person("employees:2", "existing")]} />);
  expect(html).toContain("Toplu kart ata");
  expect(html).toContain("Ada Yılmaz");
  expect(html).toContain('aria-label="Ada Yılmaz kart numarası"');
  expect(html).toContain("Okut");
  expect(html).toContain("Kaydet");
  expect(html).not.toContain("employees:2");
});

it("shows an informational message when every selected person already has a card", () => {
  const html = renderToStaticMarkup(<BatchCardAssignDialog open onOpenChange={() => {}} projectId={"projects:1" as Id<"projects">} employees={[person("employees:1", "existing")]} />);
  expect(html).toContain("Seçili kişilerin hepsinde kart var.");
});
