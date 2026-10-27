import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormFeedback } from "./FormFeedback";

describe("FormFeedback", () => {
  it("announces errors as alerts and information as status", () => {
    const error = renderToStaticMarkup(<FormFeedback tone="error" id="save-error">Kaydedilemedi.</FormFeedback>);
    const info = renderToStaticMarkup(<FormFeedback tone="info">Bilgi</FormFeedback>);
    expect(error).toContain('id="save-error" role="alert"');
    expect(error).toContain('text-sm break-words text-destructive');
    expect(error).toContain('Kaydedilemedi.');
    expect(info).toContain('role="status"');
    expect(info).toContain('text-muted-foreground');
    expect(error).not.toContain('border');
  });

  it("uses panel framing and destructive borders for errors", () => {
    const error = renderToStaticMarkup(<FormFeedback tone="error" variant="panel" title="Hata" action={<button>Tekrar dene</button>}><ul><li>Ayrıntı</li></ul></FormFeedback>);
    const info = renderToStaticMarkup(<FormFeedback tone="info" variant="panel">Bilgi</FormFeedback>);
    expect(error).toContain('rounded-md border p-3 border-destructive');
    expect(error).toContain('<p class="font-medium">Hata</p>');
    expect(error).toContain('<ul><li>Ayrıntı</li></ul><button>Tekrar dene</button>');
    expect(info).toContain('rounded-md border p-3');
    expect(info).not.toContain('destructive');
  });
});
