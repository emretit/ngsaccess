import { renderToStaticMarkup } from "react-dom/server";
import { Router, type Navigator } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { installNavigationGuard } from "@/lib/navigationGuard";
import { resetDeviceFiltersForProject } from "@/lib/deviceDisplay";
import { useDeviceUrlSync } from "./useDeviceDeepLink";
function setup(pending = false) {
  const replace = vi.fn();
  const push = vi.fn();
  const navigator: Navigator = { createHref: () => "/", replace, push, go: vi.fn() };
  let sync: ReturnType<typeof useDeviceUrlSync> | undefined;
  function Harness() { sync = useDeviceUrlSync(); return null; }
  renderToStaticMarkup(<Router navigator={navigator} location={{ pathname: "/devices", search: "?deviceId=one&zoneId=zone", hash: "#drawer", state: { test: true }, key: "key" }}><Harness /></Router>);
  let confirm: (() => void) | undefined;
  const request = vi.fn((proceed: () => void) => { confirm = proceed; });
  const browser = { history: { state: { idx: 1 }, go: vi.fn() } as unknown as History, addEventListener: vi.fn() };
  const dispose = installNavigationGuard(navigator, request, browser, pending);
  return { navigator, replace, push, request, dispose, sync: (update: (params: URLSearchParams) => URLSearchParams) => sync?.(update), confirm: () => confirm?.() };
}
it("dirty URL eşitlemesi sormaz; drawer linki tek onaydan sonra ilerler", () => {
  const state = setup();
  try {
    state.sync(params => { params.set("deviceId", "one"); return params; });
    expect(state.request).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenCalledWith(expect.objectContaining({ pathname: "/devices", hash: "#drawer", search: "?deviceId=one&zoneId=zone" }), { test: true });
    state.navigator.push("/people");
    expect(state.request).toHaveBeenCalledOnce();
    expect(state.push).not.toHaveBeenCalled();
    state.confirm();
    expect(state.push).toHaveBeenCalledExactlyOnceWith("/people");
  } finally { state.dispose(); }
});
it("onaylı kapanış URL replace'i ikinci onay açmaz, proje reset'i de iç senkron yolunu kullanır", () => {
  const state = setup();
  try {
    const requestClose = vi.fn((proceed: () => void) => proceed());
    requestClose(() => state.sync(params => { params.delete("deviceId"); return params; }));
    expect(requestClose).toHaveBeenCalledOnce();
    expect(state.request).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenLastCalledWith(expect.objectContaining({ search: "?zoneId=zone" }), { test: true });
    state.sync(resetDeviceFiltersForProject);
    expect(state.request).not.toHaveBeenCalled();
    expect(state.replace).toHaveBeenLastCalledWith(expect.objectContaining({ search: "" }), { test: true });
  } finally { state.dispose(); }
});
it("pending normal push/replace'i engeller", () => {
  const state = setup(true);
  try {
    state.navigator.push("/people");
    state.navigator.replace("/settings");
    state.confirm();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.replace).not.toHaveBeenCalled();
  } finally { state.dispose(); }
});
it("guard hook'tan önce kuruluysa da iç senkron onay istemez ve router replace'ini çağırır", () => {
  const replace = vi.fn();
  const navigator: Navigator = { createHref: () => "/", replace, push: vi.fn(), go: vi.fn() };
  const request = vi.fn();
  const browser = { history: { state: { idx: 1 }, go: vi.fn() } as unknown as History, addEventListener: vi.fn() };
  const dispose = installNavigationGuard(navigator, request, browser);
  let sync: ReturnType<typeof useDeviceUrlSync> | undefined;
  function Harness() { sync = useDeviceUrlSync(); return null; }
  try {
    renderToStaticMarkup(<Router navigator={navigator} location={{ pathname: "/devices", search: "?deviceId=one", hash: "", state: null, key: "key" }}><Harness /></Router>);
    sync?.(params => { params.delete("deviceId"); return params; });
    expect(request).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ search: "" }), null);
  } finally { dispose(); }
  sync?.(params => { params.set("deviceId", "two"); return params; });
  expect(replace).toHaveBeenLastCalledWith(expect.objectContaining({ search: "?deviceId=two" }), null);
});
