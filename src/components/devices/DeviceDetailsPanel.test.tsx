vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ isAdmin: mocks.admin }),
}));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceDetailsPanel } from "./DeviceDetailsPanel";

const mocks = vi.hoisted(() => ({
  admin: true,
  formDisabled: false,
  formSuccess: undefined as undefined | (() => void),
  tabValue: "",
  states: [] as unknown[],
  cursor: 0,
  dirty: false,
  query: vi.fn(),
  close: vi.fn(),
  requestClose: vi.fn(),
  sheetChange: undefined as undefined | ((open: boolean) => void),
  tabChange: undefined as undefined | ((tab: string) => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states))
      mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = value;
      },
    ];
  },
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ projectId: "p" }),
  useProjectChangeGuard: vi.fn(),
}));
vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    mocks.dirty = dirty;
    return { requestClose: mocks.requestClose, dialog: null };
  },
}));
vi.mock("@/components/ui/sheet", () => {
  const Part = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Sheet: ({
      children,
      onOpenChange,
    }: {
      children?: ReactNode;
      onOpenChange: (next: boolean) => void;
    }) => {
      mocks.sheetChange = onOpenChange;
      return <div>{children}</div>;
    },
    SheetContent: Part,
    SheetHeader: Part,
    SheetTitle: Part,
    SheetDescription: Part,
  };
});
vi.mock("@/components/ui/tabs", () => {
  const Part = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Tabs: ({
      children,
      onValueChange,
      value,
    }: {
      children?: ReactNode;
      value: string;
      onValueChange: (value: string) => void;
    }) => {
      mocks.tabValue = value;
      mocks.tabChange = onValueChange;
      return <div>{children}</div>;
    },
    TabsContent: Part,
    TabsList: Part,
    TabsTrigger: Part,
  };
});
vi.mock("./DeviceForm", () => ({
  DeviceForm: ({
    disabled,
    onSuccess,
  }: {
    disabled: boolean;
    onSuccess: () => void;
  }) => {
    mocks.formDisabled = disabled;
    mocks.formSuccess = onSuccess;
    return <div>settings-form</div>;
  },
}));
vi.mock("./DeviceCommandCenter", () => ({
  DeviceCommandCenter: () => <div>command-center</div>,
}));
vi.mock("./DeviceApiTokenCard", () => ({
  DeviceApiTokenCard: () => <div>token-card</div>,
}));
vi.mock("@/components/shared/QuerySectionBoundary", () => ({
  QuerySectionBoundary: ({ children }: { children: ReactNode }) => children,
}));
function render(deviceUnavailable = false) {
  mocks.cursor = 0;
  return renderToStaticMarkup(
    <DeviceDetailsPanel
      open
      deviceUnavailable={deviceUnavailable}
      onClose={mocks.close}
      selectedDevice={{ _id: "d" as Id<"devices">, name: "Panel" }}
      onSuccess={() => {}}
      projectId={"p" as Id<"projects">}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = true;
  mocks.states = [];
  mocks.query.mockReturnValue([]);
  mocks.requestClose.mockImplementation((close: () => void) => {
    if (!mocks.dirty) close();
  });
});
describe("cihaz ayrıntısı kapanışı ve sorgu yükü", () => {
  it("ilk açılışta genel bakışı yükler, proje sorgusunu ve ayar formunu erteler", () => {
    expect(render()).not.toContain("settings-form");
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), "skip");
    mocks.tabChange?.("settings");
    expect(render()).toContain("settings-form");
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), {});
    mocks.tabChange?.("overview");
    expect(render()).toContain("settings-form");
  });
  it("Escape ve X için ortak onOpenChange(false) temiz sheet'i kapatır", () => {
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).toHaveBeenCalledWith(mocks.close);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("kirli formda kapatmayı korumaya gönderir", () => {
    mocks.states = [
      "overview",
      "form",
      true,
      false,
      "other",
      [],
      { other: { dirty: true, pending: false } },
    ];
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).toHaveBeenCalledWith(mocks.close);
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("komut beklerken kapatmayı engeller", () => {
    mocks.states = ["overview", "form", false, true];
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});

it("project_user ayarlarını salt okunur gösterir ve anahtar kartını gizler", () => {
  mocks.admin = false;
  render();
  mocks.tabChange?.("settings");
  const html = render();
  expect(mocks.formDisabled).toBe(true);
  expect(html).toContain("settings-form");
  expect(html).not.toContain("token-card");
});
it("güncelleme başarıyla bitince drawer açık kalır ve genel bakışa döner", () => {
  render();
  mocks.tabChange?.("settings");
  render();
  expect(mocks.tabValue).toBe("settings");
  mocks.formSuccess?.();
  render();
  expect(mocks.tabValue).toBe("overview");
  expect(mocks.close).not.toHaveBeenCalled();
});
it("başlık cihazın canlı adını gösterir", () => {
  mocks.query.mockReturnValue({ device: { name: "Güncel panel adı" } });
  expect(render()).toContain("Güncel panel adı");
});

it("silinen veya havuza alınan cihazda formu ve komutları kaldırıp uyarı gösterir", () => {
  render();
  mocks.tabChange?.("settings");
  const html = render(true);
  expect(html).toContain("Cihaz artık bu projede bulunmuyor");
  expect(html).not.toContain("settings-form");
  expect(html).not.toContain("command-center");
  expect(html).not.toContain("token-card");
  mocks.sheetChange?.(false);
  expect(mocks.close).toHaveBeenCalledOnce();
});
