vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => mocks.admin, loading: false }) }));
vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ canManage: mocks.admin }),
}));
import { UNSAFE_NavigationContext, type Navigator } from "react-router-dom";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceDetailsPanel } from "./DeviceDetailsPanel";

const mocks = vi.hoisted(() => ({
  admin: true,
  effects: [] as (() => void | (() => void))[],
  navigation: vi.fn(),
  autoFocus: undefined as undefined | ((event: { preventDefault: () => void }) => void),
  formDisabled: false,
  formSuccess: undefined as undefined | (() => void),
  tabValue: "",
  states: [] as unknown[],
  cursor: 0,
  refs: [] as { current: unknown }[], refCursor: 0,
  formState: undefined as undefined | ((brand: "other", dirty: boolean, pending: boolean) => void),
  gatewayPending: undefined as undefined | ((pending: boolean) => void),
  dirty: false,
  query: vi.fn(),
  close: vi.fn(),
  requestClose: vi.fn(),
  sheetChange: undefined as undefined | ((open: boolean) => void),
  tabChange: undefined as undefined | ((tab: string) => void),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
  useRef: (initial: unknown) => {
    const index = mocks.refCursor++;
    return mocks.refs[index] ?? (mocks.refs[index] = { current: initial });
  },
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states))
      mocks.states[index] = typeof initial === "function" ? initial() : initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = typeof value === "function" ? value(mocks.states[index]) : value;
      },
    ];
  },
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ projectId: "p" }),
  useProjectChangeGuard: vi.fn(),
}));
vi.mock("@/lib/navigationGuard", () => ({ installNavigationGuard: mocks.navigation }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => 1000 }));
vi.mock("./DeviceGatewayDanger", () => ({ DeviceGatewayDanger: ({ onPendingChange }: { onPendingChange: (pending: boolean) => void }) => { mocks.gatewayPending = onPendingChange; return <div>gateway-danger</div>; } }));
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
    SheetContent: ({ children, onOpenAutoFocus }: { children?: ReactNode; onOpenAutoFocus: typeof mocks.autoFocus }) => {
      mocks.autoFocus = onOpenAutoFocus;
      return <div>{children}</div>;
    },
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
    onStateChange,
  }: {
    disabled: boolean;
    onSuccess: () => void;
    onStateChange: typeof mocks.formState;
  }) => {
    mocks.formState = onStateChange;
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
const navigator: Navigator = { createHref: () => "/", push: vi.fn(), replace: vi.fn(), go: vi.fn() };
function render(deviceUnavailable = false, open = true, device: { _id: Id<"devices">; name: string; brand?: "hikvision"; hikDevIndex?: string } | null = { _id: "d" as Id<"devices">, name: "Panel" }) {
  mocks.cursor = 0;
  mocks.refCursor = 0;
  return renderToStaticMarkup(
    <UNSAFE_NavigationContext.Provider value={{ navigator, basename: "/", static: true, future: {}, useTransitions: false }}><DeviceDetailsPanel
      open={open}
      deviceUnavailable={deviceUnavailable}
      onClose={mocks.close}
      selectedDevice={device}
      onSuccess={() => {}}
      projectId={"p" as Id<"projects">}
    /></UNSAFE_NavigationContext.Provider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = true;
  mocks.states = [];
  mocks.refs = [];
  mocks.effects = [];
  vi.stubGlobal("window", {});
  mocks.query.mockReturnValue([]);
  mocks.requestClose.mockImplementation((close: () => void) => {
    if (!mocks.dirty) close();
  });
});
describe("cihaz ayrıntısı kapanışı ve sorgu yükü", () => {
  it("yönetici Bilgiler ile açılır; İşlemler ilk ziyarette yüklenip korunur", () => {
    expect(render()).toContain("settings-form");
    expect(mocks.tabValue).toBe("settings");
    expect(render()).not.toContain("command-center");
    expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), {});
    mocks.tabChange?.("overview");
    expect(render()).toContain("command-center");
    mocks.tabChange?.("settings");
    expect(render()).toContain("command-center");
  });
  it("Escape ve X için ortak onOpenChange(false) temiz sheet'i kapatır", () => {
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).toHaveBeenCalledWith(mocks.close);
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it("kirli formda kapatmayı korumaya gönderir", () => {
    render();
    mocks.formState?.("other", true, false);
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).toHaveBeenCalledWith(mocks.close);
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("komut beklerken kapatmayı engeller", () => {
    render();
    mocks.formState?.("other", false, true);
    render();
    mocks.sheetChange?.(false);
    expect(mocks.requestClose).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });
});

it("project_user ayarlarını salt okunur gösterir ve anahtar kartını gizler", () => {
  mocks.admin = false;
  const initial = render();
  expect(mocks.tabValue).toBe("overview");
  expect(initial).toContain("Cihaz ayrıntısı");
  expect(initial).not.toContain("settings-form");
  mocks.tabChange?.("settings");
  const html = render();
  expect(mocks.formDisabled).toBe(true);
  expect(html).toContain("settings-form");
  expect(html).not.toContain("token-card");
});
it("güncelleme başarıyla bitince drawer aynı form sekmesinde açık kalır", () => {
  render();
  mocks.tabChange?.("settings");
  render();
  expect(mocks.tabValue).toBe("settings");
  mocks.formSuccess?.();
  render();
  expect(mocks.tabValue).toBe("settings");
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

it("yeni cihaz başlığı ve marka başlığı ayrıdır", () => {
  expect(render(false, true, null)).toContain("Yeni cihaz");
  mocks.states[1] = "form";
  mocks.states[8] = "hikvision";
  expect(render(false, true, null)).toContain("Yeni cihaz · Hikvision");
});
it("yönetimi yalnız yönetici İşlemler sekmesinde yükler ve gateway pending kapanışı engeller", () => {
  const device = { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision" as const, hikDevIndex: "index" };
  expect(render(false, true, device)).not.toContain("token-card");
  mocks.tabChange?.("overview");
  const html = render(false, true, device);
  expect(html).toContain("Yönetim");
  expect(html).toContain("token-card");
  expect(html).toContain("gateway-danger");
  mocks.gatewayPending?.(true);
  render(false, true, device);
  mocks.sheetChange?.(false);
  expect(mocks.close).not.toHaveBeenCalled();
});
it("kapanışta skip olan proje sorgusu formu iskelete dönüştürmez", () => {
  expect(render()).toContain("settings-form");
  mocks.query.mockReturnValue(undefined);
  const closing = render(false, false);
  expect(closing).toContain("settings-form");
  expect(closing).not.toContain("yükleniyor");
});

it("edit açılışında başlığa, marka seçiminden sonra ada odaklanır", () => {
  render();
  const titleFocus = vi.fn();
  mocks.refs[0].current = { focus: titleFocus };
  const preventDefault = vi.fn();
  mocks.autoFocus?.({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(titleFocus).toHaveBeenCalledOnce();
  mocks.states[1] = "form";
  mocks.states[8] = "hikvision";
  mocks.effects = [];
  render(false, true, null);
  const focus = vi.fn();
  const querySelector = vi.fn(() => ({ focus }));
  mocks.refs[1].current = { querySelector };
  mocks.effects[mocks.effects.length - 1]?.();
  expect(querySelector).toHaveBeenCalledWith('[data-device-brand="hikvision"] input[name="name"]');
  expect(focus).toHaveBeenCalledOnce();
});
it("dirty/pending olduğunda router guard kurar; pending iken onay yolu ilerlemez", () => {
  render();
  mocks.formState?.("other", true, false);
  mocks.effects = [];
  render();
  // Açılış/reset ve proje etkilerini çalıştırmadan navigation effect'ini çalıştır.
  mocks.effects[mocks.effects.length - 2]?.();
  expect(mocks.navigation).toHaveBeenCalledWith(navigator, expect.any(Function), window, false);
  const request = mocks.navigation.mock.calls[mocks.navigation.mock.calls.length - 1]?.[1] as (proceed: () => void) => void;
  const proceed = vi.fn();
  request(proceed);
  expect(mocks.requestClose).toHaveBeenCalledWith(proceed);
  expect(proceed).not.toHaveBeenCalled();
  mocks.formState?.("other", false, true);
  mocks.effects = [];
  render();
  mocks.effects[mocks.effects.length - 2]?.();
  expect(mocks.navigation).toHaveBeenLastCalledWith(navigator, expect.any(Function), window, true);
  mocks.requestClose.mockClear();
  const blocked = mocks.navigation.mock.calls[mocks.navigation.mock.calls.length - 1]?.[1] as (proceed: () => void) => void;
  blocked(proceed);
  expect(mocks.requestClose).not.toHaveBeenCalled();
});
it("yeni picker ve marka formu kapanış render'ında korunur", () => {
  expect(render(false, true, null)).toContain("Marka Seçin");
  expect(render(false, false, null)).toContain("Marka Seçin");
  mocks.states[1] = "form";
  mocks.states[8] = "hikvision";
  mocks.states[9] = ["hikvision"];
  expect(render(false, true, null)).toContain("settings-form");
  mocks.query.mockReturnValue(undefined);
  const closing = render(false, false, null);
  expect(closing).toContain("settings-form");
  expect(closing).not.toContain("yükleniyor");
});
