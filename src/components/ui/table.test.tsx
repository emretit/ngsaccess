import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Table, TableHead, TableHeader, TableRow } from "./table";
import { baseWidthFor, fitColumns, type HeaderLayout } from "./table-resize";

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
