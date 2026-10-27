import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadMoreFooter } from "./LoadMoreFooter";

describe("LoadMoreFooter", () => {
  it("renders an enabled outline action and optional summary when more results exist", () => {
    const html = renderToStaticMarkup(<LoadMoreFooter hasMore loading={false} onLoadMore={() => {}} summary={<p>10 kayıt yüklendi</p>} />);
    expect(html).toContain("10 kayıt yüklendi");
    expect(html).toContain("Daha fazla yükle");
    expect(html).toContain("border-line");
    expect(html).not.toContain('disabled=""');
    const disabled = renderToStaticMarkup(<LoadMoreFooter hasMore loading={false} disabled onLoadMore={() => {}} loadMoreLabel="Devam et" />);
    expect(disabled).toContain('disabled=""');
    expect(disabled).toContain("Devam et");
  });

  it("disables the loading action and displays its loading label", () => {
    const html = renderToStaticMarkup(<LoadMoreFooter hasMore loading onLoadMore={() => {}} loadingLabel="Diğer kayıtlar yükleniyor…" />);
    expect(html).toContain('disabled=""');
    expect(html).toContain("Diğer kayıtlar yükleniyor…");
    expect(html).not.toContain("Daha fazla yükle");
  });

  it("renders only the optional muted exhausted message when complete", () => {
    const html = renderToStaticMarkup(<LoadMoreFooter hasMore={false} loading={false} onLoadMore={() => {}} exhaustedLabel="Tümü yüklendi" />);
    expect(html).not.toContain("<button");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("Tümü yüklendi");
    expect(renderToStaticMarkup(<LoadMoreFooter hasMore={false} loading={false} onLoadMore={() => {}} />)).toBe("");
  });
});
