const HEADERS = [
  "Ad*", "Soyad*", "E-posta*", "T.C. Kimlik No", "Sicil/Bordro Kodu",
  "Kart No*", "Departman", "Pozisyon", "Firma", "Aktif (Evet/Hayır)",
] as const;

export async function createEmployeeImportTemplate() {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kişiler");
  sheet.addRow(["Açıklama: Örnek satırı silip kişileri başlıkların altına ekleyin. Ad, soyad, e-posta ve kart numarası zorunludur."]);
  sheet.addRow([...HEADERS]);
  sheet.addRow(["Ayşe", "Yılmaz", "ayse@example.com", "", "", "AYSE-001", "İnsan Kaynakları", "Uzman", "Örnek A.Ş.", "Evet"]);
  sheet.getRow(1).font = { italic: true, color: { argb: "FF666666" } };
  sheet.getRow(2).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.columns.forEach((column, index) => { column.width = index < 2 ? 18 : 24; });
  return workbook;
}

export async function downloadEmployeeImportTemplate() {
  const workbook = await createEmployeeImportTemplate();
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "kisiler-sablon.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}
