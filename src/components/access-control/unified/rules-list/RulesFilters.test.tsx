import { Children, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readRuleFilters } from "./accessRulesListModel";
import { RulesFilters } from "./RulesFilters";

describe("01-O3: kurallar arama alanı", () => {
  it("seçiciyi Arama alanı erişilebilir adı ve görünür Ara önekiyle sunar", () => {
    const html = renderToStaticMarkup(
      <RulesFilters {...readRuleFilters(new URLSearchParams())} change={vi.fn()} clear={vi.fn()} />,
    );
    const trigger = html.match(/<button[^>]*aria-label="Arama alanı"[^>]*>/)?.[0];
    expect(trigger).toBeDefined();
    expect(trigger).toContain('role="combobox"');
    expect(trigger).toContain("max-md:min-h-11");
    expect(trigger).toContain("w-auto min-w-36 max-w-full");
    expect(html).toContain("Ara: ");
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
      const select = Children.toArray(tree.props.children)[0];
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
