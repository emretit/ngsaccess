import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
describe("tema kontrastı", () => {
  it("siyah ve beyaz referansı 21:1", () => expect(contrastRatio("0 0% 0%", "0 0% 100%")).toBe(21));
  for (const theme of [":root", ".dark"]) {
    const block = css.slice(css.indexOf(`${theme} {`)).split("}")[0];
    const tokens = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
    for (const tone of ["primary", "success", "destructive", "warning", "info"]) {
      it(`${theme} ${tone} dolgu/ön plan ≥4.5`, () => expect(contrastRatio(tokens[tone], tokens[`${tone}-foreground`])).toBeGreaterThanOrEqual(4.5));
      it(`${theme} ${tone} metin/yüzey ≥4.5`, () => expect(contrastRatio(tokens[tone], tokens[`${tone}-subtle`] ?? tokens.card)).toBeGreaterThanOrEqual(4.5));
    }
  }
});
