import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Table, TableHead, TableHeader, TableRow } from "./table";
import { baseWidthFor, columnWidth, fitColumns, type HeaderLayout } from "./table-resize";

const header = (resizeKey?: string) =>
  renderToStaticMarkup(
    <Table resizeKey={resizeKey}>
      <TableHeader>
        <TableRow>
          <TableHead columnId="select" resizable={false}>Seç</TableHead>
          <TableHead columnId="name">Ad soyad</TableHead>
          <TableHead>İşlemler</TableHead>
        </TableRow>
      </TableHeader>
    </Table>,
  );

describe("Table column resize", () => {
  it("adds a labelled handle only to resizable columns", () => {
    const html = header("employees");
    expect(html.match(/role="separator"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Ad soyad sütun genişliği"');
    expect(html).toContain('data-column-id="select"');
    expect(html).not.toContain('style="table-layout');
  });

  it("stays inert without a resizeKey", () => {
    const html = header();
    expect(html).not.toContain('role="separator"');
    expect(html).not.toContain("data-column-id");
  });
});

describe("Table column fill", () => {
  const header = (container: number): HeaderLayout => ({
    container,
    cells: [
      { id: "select", fixed: true, measured: 0 },
      { id: "name", fixed: false, measured: 0 },
      { id: "email", fixed: false, measured: 0 },
    ],
  });
  const widths = { select: 40, name: 200, email: 200 };

  it("scales resizable columns to fill a wider container, not fixed ones", () => {
    const { fixedSum, scalableSum, scale } = fitColumns(header(840), widths);
    expect(fixedSum).toBe(40);
    expect(scalableSum * scale).toBe(800);
  });

  it("keeps base widths when the container is narrower", () => {
    expect(fitColumns(header(300), widths).scale).toBe(1);
  });

  it("stores a base that renders the dragged column at the cursor", () => {
    const base = baseWidthFor("name", 300, header(840), widths);
    const next = { ...widths, name: base };
    expect(next.name * fitColumns(header(840), next).scale).toBeCloseTo(300);
  });
});


describe("registered column minima", () => {
  const layout: HeaderLayout = { container: 300, cells: [
    { id: "name", fixed: false, measured: 0, minWidth: 160 },
    { id: "email", fixed: false, measured: 0, minWidth: 200 },
  ] };
  it("floors old narrow saved values in render and fit without changing preferences", () => {
    const saved = { name: 12, email: 280, hidden: 20 };
    expect(columnWidth(saved.name, 160)).toBe(160);
    expect(fitColumns(layout, saved)).toEqual({ fixedSum: 0, scalableSum: 440, scale: 1 });
    expect(saved).toEqual({ name: 12, email: 280, hidden: 20 });
    expect(columnWidth(undefined, 200)).toBe(200);
  });
  it("uses visible columns and their current minima for resize calculations", () => {
    const saved = { name: 12, email: 280 };
    const wide = { ...layout, container: 900 };
    const base = baseWidthFor("email", 500, wide, saved);
    expect(base * fitColumns(wide, { ...saved, email: base }).scale).toBeCloseTo(500);
    const mobile = { container: 390, cells: [layout.cells[0]] };
    expect(fitColumns(mobile, saved).scalableSum).toBe(160);
    expect(fitColumns(mobile, saved).scale).toBeCloseTo(390 / 160);
  });
  it("exposes the same floor to headers and accessible resize handles", () => {
    const html = renderToStaticMarkup(<Table resizeKey="minimum-test"><TableHeader><TableRow><TableHead columnId="name" minWidth={160}>Ad</TableHead></TableRow></TableHeader></Table>);
    expect(html).toContain('data-column-min-width="160"');
    expect(html).toContain('min-width:160px');
    expect(html).toContain('aria-valuemin="160"');
  });
});

it("replays a saved profile with registered floors while preserving its storage", () => {
  const saved = JSON.stringify({ name: 12, email: 280 });
  const setItem = vi.fn();
  const removeItem = vi.fn();
  vi.stubGlobal("window", { localStorage: { getItem: () => saved, setItem, removeItem } });
  try {
    const html = renderToStaticMarkup(<Table resizeKey="old-profile"><TableHeader><TableRow><TableHead columnId="name" minWidth={160}>Ad</TableHead><TableHead columnId="email" minWidth={200}>E-posta</TableHead></TableRow></TableHeader></Table>);
    expect(html).toContain("width:calc(160px * var(--table-column-scale, 1))");
    expect(html).toContain("width:calc(280px * var(--table-column-scale, 1))");
    expect(html).toContain('aria-valuenow="160"');
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
