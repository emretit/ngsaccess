import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { useDeviceDeepLink } from "./useDeviceDeepLink";
const mocks = vi.hoisted(() => ({
  handled: { current: null as string | null },
  effects: [] as (() => void)[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => mocks.handled,
  useEffect: (effect: () => void) => mocks.effects.push(effect),
}));
const first = { _id: "first" as Id<"devices">, name: "İlk cihaz" };
const second = { _id: "second" as Id<"devices">, name: "İkinci cihaz" };
const onOpen = vi.fn();
const restore = vi.fn();
function render(id: string | null, open = false, loading = false, activeId?: string | null) {
  function Harness() {
    useDeviceDeepLink(id, [first, second], loading, open, onOpen, activeId, restore);
    return null;
  }
  renderToStaticMarkup(<Harness />);
  mocks.effects.splice(0).forEach((effect) => effect());
}
beforeEach(() => {
  mocks.handled.current = null;
  mocks.effects = [];
  onOpen.mockClear();
  restore.mockClear();
});
it("ilk kapatıştan sonra URL eski kimliği korusa da yeniden açmaz", () => {
  render("first");
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(first);
  render("first", true); // open drawer
  render("first", false); // X / Escape, router has not cleared URL yet
  render("first", false); // list subscription updates before router
  expect(onOpen).toHaveBeenCalledOnce();
  render(null);
  render("first");
  expect(onOpen).toHaveBeenCalledTimes(2);
});
it("yükleme bitince açar ve yeni URL kimliğini işler", () => {
  render("first", false, true);
  expect(onOpen).not.toHaveBeenCalled();
  render("first");
  render("second");
  expect(onOpen).toHaveBeenLastCalledWith(second);
  expect(onOpen).toHaveBeenCalledTimes(2);
});

it("panel açıkken farklı cihaz isteyen URL'yi mevcut kimliğe döndürür ve formu değiştirmez", () => {
  render("first");
  render("second", true, false, "first");
  expect(restore).toHaveBeenCalledExactlyOnceWith("first");
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(first);
  render("first", true, false, "first");
  expect(restore).toHaveBeenCalledOnce();
});
it("yeni cihaz taslağı açıkken gelen derin bağlantıyı temizler", () => {
  render("second", true, false, null);
  expect(restore).toHaveBeenCalledExactlyOnceWith(null);
  expect(onOpen).not.toHaveBeenCalled();
});
