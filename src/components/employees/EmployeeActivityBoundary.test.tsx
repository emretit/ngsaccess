import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmployeeActivityBoundary } from "./EmployeeActivityBoundary";

it.each([
  ["Parmak izi", "Parmak izi kayıtları yüklenemedi."],
  ["Erişim yetkileri", "Erişim yetkileri yüklenemedi."],
  ["Personel formu", "Form yüklenemedi."],
])("%s hatasında yerel yeniden deneme sunar", (title, description) => {
  const boundary = new EmployeeActivityBoundary({ employeeId: "e", projectId: "p", title, description, children: <form data-testid="draft" /> });
  boundary.state = { error: new Error("query unavailable"), attempt: 0 };
  const html = renderToStaticMarkup(boundary.render());
  expect(html).toContain(description);
  expect(html).toContain("Yeniden dene");
  expect(html).not.toContain('data-testid="draft"');
});

it("ekleme panelinde tam yükseklik sarmalayıcı ve kenar boşluklu hata gösterir", () => {
  const boundary = new EmployeeActivityBoundary({ employeeId: "new", projectId: "p", title: "Personel formu", description: "Form yüklenemedi.", className: "h-full", errorClassName: "px-5", children: <form data-testid="draft" /> });
  expect(renderToStaticMarkup(boundary.render())).toMatch(/<div class="h-full"><form data-testid="draft"/);
  boundary.state = { error: new Error("query unavailable"), attempt: 0 };
  expect(renderToStaticMarkup(boundary.render())).toMatch(/<section class="[^"]*px-5[^"]*">/);
});
