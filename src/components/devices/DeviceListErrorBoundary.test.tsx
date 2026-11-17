import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DeviceListErrorBoundary } from "./DeviceListErrorBoundary";

it("keeps device page identity on failure and retries the existing boundary", () => {
  const boundary = new DeviceListErrorBoundary({ children: <p>Envanter</p> });
  expect(renderToStaticMarkup(boundary.render())).toContain("Envanter");
  boundary.state = DeviceListErrorBoundary.getDerivedStateFromError();
  const fallback = boundary.render();
  const html = renderToStaticMarkup(fallback);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Cihazlar");
  expect(html).toContain("Cihazlar yüklenemedi");
  expect(html).toContain("Bağlantınızı kontrol edip yeniden deneyin.");
  expect(html).toContain("Tekrar Dene");
  expect(html).not.toMatch(/<main\b/);
  const update = vi.spyOn(boundary, "setState").mockImplementation(() => undefined);
  if (!isValidElement<{ children: ReactElement<{ onRetry: () => void }> }>(fallback)) throw new Error("Sayfa şablonu bulunamadı");
  fallback.props.children.props.onRetry();
  expect(update).toHaveBeenCalledExactlyOnceWith({ failed: false });
});
