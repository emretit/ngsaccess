import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FormFieldWrapper } from "./FormFieldWrapper";
import { PasswordField } from "./PasswordField";
import { QuerySectionBoundary } from "./QuerySectionBoundary";

describe("ortak form ve bölüm sözleşmeleri", () => {
  it("hata ve ipucunu içteki kontrole bağlar, div'e bağlamaz", () => {
    const html = renderToStaticMarkup(<FormFieldWrapper htmlFor="email" label="E-posta" error="Geçersiz" hint="İş adresiniz"><div><input aria-describedby="existing" /></div></FormFieldWrapper>);
    expect(html).toContain('for="email"');
    expect(html).toContain('aria-describedby="existing email-hint email-error"');
    expect(html).toContain('<div><input');
    expect(html).toContain('role="alert"');
  });
  it("render slot'u kontrol id ve ARIA özelliklerini alır", () => {
    expect(renderToStaticMarkup(<FormFieldWrapper htmlFor="code" label="Kod">{props => <input {...props} />}</FormFieldWrapper>)).toContain('aria-invalid="false"');
  });
  it("şifre kontrolü etiketli, tabbable, kilitlenebilir ve ARIA'yı input'a iletir", () => {
    const html = renderToStaticMarkup(<PasswordField id="password" disabled aria-invalid aria-describedby="error" />);
    expect(html).toContain('type="password"');
    expect(html).toContain('aria-label="Şifreyi göster"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('h-11 w-11');
    expect(html).not.toContain('tabindex="-1"');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain('aria-describedby="error"');
  });
  it("boundary hatayı yakalamak için yalnız kendi bölümünü değiştirir", () => {
    expect(QuerySectionBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const boundary = new QuerySectionBoundary({ children: <p>Veri</p> });
    boundary.state = { failed: true, attempt: 0 };
    expect(renderToStaticMarkup(boundary.render())).toContain('Tekrar Dene');
    expect(renderToStaticMarkup(boundary.render())).not.toContain('Veri</p>');
  });
});
