import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CollapsibleFilters } from "./CollapsibleFilters";

describe("CollapsibleFilters", () => {
  it("connects the collapsed mobile trigger to content that remains visible on desktop", () => {
    const html = renderToStaticMarkup(<CollapsibleFilters><input aria-label="Filter" /></CollapsibleFilters>);
    const controls = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/<button[^>]*class="[^"]*md:hidden/);
    expect(html).toContain('class="hidden md:block"');
    expect(html).toContain('aria-label="Filter"');
  });

  it("shows only positive counts and supports a custom label", () => {
    expect(renderToStaticMarkup(<CollapsibleFilters label="Seçenekler" activeCount={2}>Fields</CollapsibleFilters>)).toContain('Seçenekler (2)');
    for (const activeCount of [0, -1]) {
      expect(renderToStaticMarkup(<CollapsibleFilters activeCount={activeCount}>Fields</CollapsibleFilters>)).toContain('>Filtreler</button>');
    }
  });

  it("reports forced visibility and preserves the desktop contents layout", () => {
    const html = renderToStaticMarkup(<CollapsibleFilters forceOpen desktopDisplay="contents">Fields</CollapsibleFilters>);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('class="block w-full min-w-0 md:contents"');
  });

  it("collapseOn=all folds on desktop too", () => {
    const html = renderToStaticMarkup(<CollapsibleFilters collapseOn="all" activeCount={1}>Fields</CollapsibleFilters>);
    expect(html).not.toContain("md:hidden");
    expect(html).not.toContain("md:block");
    expect(html).toContain('class="hidden"');
    expect(html).toContain("Filtreler (1)");
  });

  it("assigns separate content ids to multiple instances", () => {
    const html = renderToStaticMarkup(<><CollapsibleFilters>First</CollapsibleFilters><CollapsibleFilters>Second</CollapsibleFilters></>);
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map(match => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
