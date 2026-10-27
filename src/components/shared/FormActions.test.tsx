import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormActions } from "./FormActions";

const onClose = () => {};

describe("FormActions", () => {
  it("keeps default labels, outline cancellation and sticky styling", () => {
    const html = renderToStaticMarkup(<FormActions isLoading={false} onClose={onClose} />);
    expect(html).toContain('>Vazgeç</button>');
    expect(html).toContain('>Kaydet</button>');
    expect(html).toContain('type="button"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('border border-line');
    expect(html).toContain('sticky bottom-0 flex justify-end gap-3 border-t bg-background px-5 py-3');
    expect(html).not.toContain('disabled=""');
  });

  it("uses the busy label and disables both buttons while loading", () => {
    const html = renderToStaticMarkup(<FormActions isLoading busyLabel="Atanıyor..." onClose={onClose} />);
    expect(html).toContain('Atanıyor...');
    expect(html).not.toContain('>Kaydet</button>');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it("disables only submit for a validation or conflict lock", () => {
    const html = renderToStaticMarkup(<FormActions isLoading={false} submitDisabled onClose={onClose} />);
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).not.toContain('disabled=""');
    expect(buttons[1]).toContain('disabled=""');
  });

  it("uses DialogFooter alignment without sticky, border, background or padding", () => {
    const html = renderToStaticMarkup(<FormActions layout="dialog" isLoading={false} onClose={onClose} />);
    const container = html.slice(0, html.indexOf('>'));
    expect(container).toContain('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2');
    expect(container).not.toMatch(/sticky|border|bg-|p[xy]?-/);
  });

  it("supports custom labels, external form submission and left aligned extra actions", () => {
    const html = renderToStaticMarkup(<FormActions isLoading={false} onClose={onClose} cancelLabel="İptal" submitLabel="Ekle" form="add-zone" extraActions={<button type="button">Önizle</button>} className="custom-actions" />);
    expect(html).toContain('>İptal</button>');
    expect(html).toContain('>Ekle</button>');
    expect(html).toContain('form="add-zone"');
    expect(html).toContain('<div class="mr-auto"><button type="button">Önizle</button></div>');
    expect(html).toContain('custom-actions');
  });
});
