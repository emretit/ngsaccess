import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Table, TableHead, TableHeader, TableRow } from "./table";

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
