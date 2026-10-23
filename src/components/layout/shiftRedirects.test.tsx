import { Children, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import App from "@/App";
const state = vi.hoisted(() => ({ path: "/shifts" }));
vi.mock("react-router-dom", () => {
  const Box = ({ children }: { children?: ReactNode }) => <>{children}</>;
  function findRoute(children: ReactNode): ReactNode {
    for (const child of Children.toArray(children)) {
      if (!isValidElement<{ path?: string; children?: ReactNode; element?: ReactNode }>(child)) continue;
      if (child.props.path === state.path) return child.props.element;
      const nested = findRoute(child.props.children);
      if (nested) return nested;
    }
    return null;
  }
  return { BrowserRouter: Box, Route: Box, Routes: ({ children }: { children: ReactNode }) => findRoute(children), Navigate: ({ to, replace }: { to: string; replace: boolean }) => <a href={to} data-replace={replace} />, useLocation: () => ({ pathname: state.path, hash: "" }), useNavigationType: () => "POP" };
});
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/auth/AuthProvider", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ ActiveProjectProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/Layout", () => ({ default: () => null }));
it.each([["/shifts", "/pdks-records?plan=1"], ["/shifts/definitions", "/pdks-records"]])("redirects %s to %s with replacement", (from, to) => {
  state.path = from;
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain(`href="${to}"`);
  expect(html).toContain('data-replace="true"');
});
