import { Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readRuleFilters } from "./accessRulesListModel";
import { RulesFilters } from "./RulesFilters";

describe("01-O3: kurallar arama alanı", () => {
  it("seçicileri üst etiket ve masaüstünde görünür FIELD düzeninde sunar", () => {
    const html = renderToStaticMarkup(
      <RulesFilters {...readRuleFilters(new URLSearchParams())} change={vi.fn()} clear={vi.fn()} />,
    );
    const trigger = html.match(/<button[^>]*id="rule-filter-by"[^>]*>/)?.[0];
    expect(trigger).toBeDefined();
    expect(html).toContain('for="rule-filter-by">Arama alanı</label>');
    expect(trigger).not.toContain("aria-label=");
    expect(trigger).toContain('role="combobox"');
    expect(trigger).toContain("max-md:min-h-11");
    expect(trigger).toContain("w-full min-w-0");
    expect(html).toContain(">Arama alanı</label>");
    expect(html).toContain(">Durum</label>");
    expect(html).toContain(">Tür</label>");
    expect(html).toContain("Filtreleri temizle");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('hidden w-full min-w-0 md:contents');
    expect(html).toContain('placeholder="Kural adı ara"');
  });

  it("Kural, Kişi ve Kapı seçimi değişince arama ipucunu günceller", () => {
    const params = new URLSearchParams("q=Giriş&durum=active&tur=personnel");
    const change = vi.fn((key: string, value: string) => params.set(key, value));
    for (const [value, label, placeholder] of [
      ["person", "Kişi", "Kişi adı ara"],
      ["door", "Kapı", "Kapı adı ara"],
      ["rule", "Kural", "Kural adı ara"],
    ]) {
      const tree = RulesFilters({ ...readRuleFilters(params), change, clear: vi.fn() });
      const panel = Children.toArray(tree.props.children)[0];
      if (!isValidElement<{ children: React.ReactElement<{ children: React.ReactNode }> }>(panel)) throw new Error("Filtre paneli bulunamadı");
      const field = Children.toArray(panel.props.children)[0];
      if (!isValidElement<{ children: React.ReactNode }>(field)) throw new Error("Arama alanı bulunamadı");
      const select = Children.toArray(field.props.children)[0];
      if (!isValidElement<{ onValueChange: (value: string) => void; children: React.ReactNode }>(select)) {
        throw new Error("Arama alanı seçicisi bulunamadı");
      }
      // Exercise the controlled Select callback, then render the URL-backed state.
      select.props.onValueChange(value);
      expect(change).toHaveBeenLastCalledWith("by", value);
      const updated = RulesFilters({ ...readRuleFilters(params), change, clear: vi.fn() });
      expect(renderToStaticMarkup(updated)).toContain(`placeholder="${placeholder}"`);

      const content = Children.toArray(select.props.children)[1];
      if (!isValidElement<{ children: React.ReactNode }>(content)) {
        throw new Error("Arama alanı seçenekleri bulunamadı");
      }
      const option = Children.toArray(content.props.children).find(
        (child) => isValidElement<{ value: string }>(child) && child.props.value === value,
      );
      if (!isValidElement<{ children: React.ReactNode; className: string }>(option)) {
        throw new Error("Arama alanı seçeneği bulunamadı");
      }
      expect(option.props.children).toBe(label);
      expect(option.props.className).toContain("max-md:min-h-11");
    }
    expect(readRuleFilters(params)).toEqual({ search: "Giriş", searchBy: "rule", status: "active", type: "personnel" });
  });
});

it("arama açık kalır ve etkin ikincil filtreleri sayar", () => {
  const html = renderToStaticMarkup(<RulesFilters {...readRuleFilters(new URLSearchParams("q=Ali&by=person&durum=active&tur=personnel"))} change={vi.fn()} clear={vi.fn()} />);
  expect(html).toContain("Filtreler (3)");
  expect(html).toContain('type="search"');
});

it("durum ve tür genel seçeneklerini Tüm X biçiminde korur", () => {
  const tree = RulesFilters({ ...readRuleFilters(new URLSearchParams()), change: vi.fn(), clear: vi.fn() });
  const panel = Children.toArray(tree.props.children)[0];
  if (!isValidElement<{ children: React.ReactNode }>(panel)) throw new Error("Panel bulunamadı");
  const fields = Children.toArray(panel.props.children);
  for (const [index, label] of [[1, "Tüm durumlar"], [2, "Tüm türler"]] as const) {
    const field = fields[index];
    if (!isValidElement<{ children: React.ReactNode }>(field)) throw new Error("Alan bulunamadı");
    const select = Children.toArray(field.props.children)[0];
    if (!isValidElement<{ children: React.ReactNode }>(select)) throw new Error("Seçici bulunamadı");
    const content = Children.toArray(select.props.children)[1];
    if (!isValidElement<{ children: React.ReactNode }>(content)) throw new Error("İçerik bulunamadı");
    const option = Children.toArray(content.props.children)[0];
    if (!isValidElement<{ children: React.ReactNode }>(option)) throw new Error("Seçenek bulunamadı");
    expect(option.props.children).toBe(label);
  }
});
