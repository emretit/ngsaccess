import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LeaveList } from "./LeaveList";

it.each([false, true])("keeps leave headers with no records (loading=%s)", loading => {
  const html = renderToStaticMarkup(<LeaveList rows={[]} loading={loading} canManage={false} onDetails={() => {}} onEdit={() => {}} />);
  expect(html).toContain("<thead");
  for (const label of ["Kişi", "İzin türü", "Tarih aralığı", "Süre", "Durum", "İşlemler"]) expect(html).toContain(label);
  expect(html).toMatch(/<tbody><tr[^>]*><td[^>]*colSpan="6"/);
  expect(html).toContain(loading ? "İzin kayıtları yükleniyor." : "Henüz izin kaydı yok.");
});
