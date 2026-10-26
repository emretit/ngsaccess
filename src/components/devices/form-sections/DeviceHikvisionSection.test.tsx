import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { expect, it, vi } from "vitest";
import { Form } from "@/components/ui/form";
import { DeviceHikvisionSection } from "./DeviceHikvisionSection";
import { buildDeviceFormValues } from "../hooks/buildDeviceFormValues";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ServerDevice } from "@/types/device";
vi.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => <div data-disabled={disabled}>{children}</div>, SelectContent: Part, SelectItem: ({ children, value }: { children?: ReactNode; value: string }) => <div data-option={value}>{children}</div>, SelectTrigger: Part, SelectValue: Part };
});
function Harness({ device }: { device?: ServerDevice }) {
  const form = useForm<FormValues>({ defaultValues: buildDeviceFormValues(device, "hikvision") });
  return <Form {...form}><DeviceHikvisionSection form={form} device={device} /></Form>;
}
it("5.4: new and gateway devices only offer Gateway", () => {
  for (const device of [undefined, { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision" as const, hikTransport: "gateway" as const }]) {
    const html = renderToStaticMarkup(<Harness device={device} />);
    expect(html).toContain('data-option="gateway"');
    expect(html).not.toContain('data-option="localBridge"');
  }
});
it("5.4: existing Windows device keeps its transport and read-only SDK fields", () => {
  const html = renderToStaticMarkup(<Harness device={{ _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision", hikTransport: "localBridge", deviceIp: "192.168.1.1", deviceUsername: "admin", devicePassword: "secret", hikPort: 8000 }} />);
  expect(html).toContain('data-option="localBridge"');
  expect(html).toContain('data-disabled="true"');
  expect(html).toContain("salt okunur");
  expect(html.match(/readonly=""/gi)).toHaveLength(4);
  expect(html).toContain('value="8000"');
});
