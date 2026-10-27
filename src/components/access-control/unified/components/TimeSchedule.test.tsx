import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { TimeSchedule } from "./TimeSchedule";
it("kural saatini doğrudan sorar, şablon seçeneği sunmaz", () => {
  const html = renderToStaticMarkup(<TimeSchedule formData={{ start_time: "", end_time: "", days: [] }} setFormData={() => undefined} />);
  expect(html).toContain("Saat kapsamı");
  expect(html).toContain("İzin verilen günler");
  expect(html).not.toContain("Şablon kullan");
  expect(html).not.toContain("Özel saat");
});
