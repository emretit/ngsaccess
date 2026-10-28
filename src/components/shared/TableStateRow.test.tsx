import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Table, TableBody } from "@/components/ui/table";
import { TableStateRow } from "./TableStateRow";

const render = (row: ReactElement) => renderToStaticMarkup(<Table><TableBody>{row}</TableBody></Table>);

describe("TableStateRow", () => {
  it("spans every column with a single cell", () => {
    const html = render(<TableStateRow colSpan={7} state="loading" label="Kişiler yükleniyor" />);
    expect(html).toContain('colSpan="7"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Kişiler yükleniyor");
  });

  it("renders a compact empty state inside the body", () => {
    const html = render(<TableStateRow colSpan={3} state="empty" title="Kayıt yok" description="Filtreleri temizleyin." />);
    expect(html).toContain("<tbody");
    expect(html).toContain("Kayıt yok");
    expect(html).toContain("Filtreleri temizleyin.");
  });

  it("renders custom content", () => {
    expect(render(<TableStateRow colSpan={2} state="custom"><p>Tarama sürüyor</p></TableStateRow>)).toContain("Tarama sürüyor");
  });
});
