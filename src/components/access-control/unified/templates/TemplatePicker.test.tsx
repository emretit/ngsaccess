import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { emptyWeek } from "./schedule";

const state = vi.hoisted(() => ({
  rows: undefined as { _id: string; name: string; isArchived?: boolean; week: ReturnType<typeof emptyWeek> }[] | undefined,
  canManage: true,
  buttons: new Map<string, () => void>(),
  params: new URLSearchParams(),
  query: vi.fn(),
}));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => { state.query(...args); return state.rows; } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.canManage }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p" }) }));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [state.params, (update: (prev: URLSearchParams) => URLSearchParams) => { state.params = update(state.params); }] }));
vi.mock("@/components/ui/button", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...actual, Button: (props: ComponentProps<typeof actual.Button>) => {
    if (props.onClick && typeof props.children === "string") {
      const click = props.onClick;
      state.buttons.set(props.children, () => click({} as React.MouseEvent<HTMLButtonElement>));
    }
    return <actual.Button {...props} />;
  } };
});
import { TemplatePicker } from "./TemplatePicker";
beforeEach(() => {
  state.rows = [];
  state.canManage = true;
  state.buttons.clear();
  state.params = new URLSearchParams("tab=rules&template=old&q=arama");
  state.query.mockClear();
});
const render = (props: Partial<ComponentProps<typeof TemplatePicker>> = {}) => renderToStaticMarkup(<TemplatePicker value="" onChange={() => undefined} {...props} />);
it("boş listede oluşturma yolunu çağıranın değişiklik onayına bırakır", () => {
  const onEdit = vi.fn();
  const html = render({ onEdit });
  expect(html).toContain("Bu projede henüz zaman şablonu yok.");
  expect(html).toContain("Zaman şablonu oluştur");
  expect(html).not.toContain("<select");
  state.buttons.get("Zaman şablonu oluştur")?.();
  expect(onEdit).toHaveBeenCalledOnce();
  expect(state.params.get("tab")).toBe("rules");
  const navigate: () => void = onEdit.mock.calls[0][0];
  navigate();
  expect(state.params.get("tab")).toBe("templates");
  expect(state.params.has("template")).toBe(false);
  expect(state.params.get("q")).toBe("arama");
  expect(state.query).toHaveBeenCalledWith(expect.anything(), { projectId: "p", includeArchived: true });
});
it("onEdit yokken doğrudan zaman şablonlarına gider", () => {
  render();
  state.buttons.get("Zaman şablonu oluştur")?.();
  expect(state.params.get("tab")).toBe("templates");
});
it("seçilebilir liste doluyken boş durumu göstermez", () => {
  state.rows = [{ _id: "t", name: "Mesai", week: emptyWeek() }];
  const html = render();
  expect(html).toContain("Mesai");
  expect(html).toContain("<select");
  expect(html).not.toContain("henüz zaman şablonu yok");
  expect(html).not.toContain("Zaman şablonu oluştur");
});
it("arşivli şablonu yalnız mevcut kurala bağlıysa seçilebilir sayar", () => {
  state.rows = [{ _id: "t", name: "Eski", isArchived: true, week: emptyWeek() }];
  expect(render()).toContain("Seçilebilir zaman şablonu yok (yalnız arşivlenmiş şablonlar var).");
  expect(render()).toContain("Zaman şablonu oluştur");
  expect(render({ currentTemplateId: "t" })).not.toContain("Seçilebilir zaman şablonu yok");
});
it("yükleme sırasında boş durum göstermez ve yetkisiz kullanıcıya oluşturma sunmaz", () => {
  state.rows = undefined;
  expect(render()).toContain("Yükleniyor…");
  expect(render()).not.toContain("henüz zaman şablonu yok");
  state.rows = [];
  state.canManage = false;
  expect(render()).toContain("henüz zaman şablonu yok");
  expect(render()).not.toContain("Zaman şablonu oluştur");
});
