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
