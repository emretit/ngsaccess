import { describe, expect, it } from "vitest";
import { assertPeopleProject, assertUploadOwner, assertEmployeePhotoClaim } from "./peopleScope";

describe("Kişi ilişkilerinin proje kapsamı", () => {
  for (const label of ["Çalışan ve departman", "Çalışan ve şirket", "Departman ve üst departman", "Çalışan ve vardiya", "İzin ve çalışan"]) {
    it(`${label}: başka proje reddedilir`, () => {
      expect(() => assertPeopleProject("a", "b", label)).toThrow(`${label} aynı projede olmalıdır`);
      expect(() => assertPeopleProject("a", "a", label)).not.toThrow();
    });
  }
  it("projesiz ilişkileri kabul etmez", () => {
    expect(() => assertPeopleProject(undefined, undefined, "İlişki")).toThrow();
    expect(() => assertPeopleProject("a", undefined, "İlişki")).toThrow();
  });
});
describe("Bağlanmamış yükleme sahipliği", () => {
  it("yalnız sahibi erişir", () => expect(() => assertUploadOwner("u1", "u1")).not.toThrow());
  it("başka kullanıcıya kapalıdır", () => expect(() => assertUploadOwner("u1", "u2")).toThrow("yalnız yükleyen"));
  it("sahibi olmayan yeni dosya için süre istisnası yoktur", () => expect(() => assertUploadOwner(undefined, "u1")).toThrow());
});

describe("Personel fotoğrafını bağlama", () => {
  it("yeni yüklemeyi sahibi bağlar", () => expect(() => assertEmployeePhotoClaim("u1", "u1")).not.toThrow());
  it("başkasının bekleyen yüklemesini reddeder", () => expect(() => assertEmployeePhotoClaim("u1", "u2")).toThrow());
  it("aynı personele bağlı dosyayı tekrar kaydeder", () => expect(() => assertEmployeePhotoClaim(undefined, "u2", "e1", "e1")).not.toThrow());
  it("başka personelin dosyasını reddeder", () => expect(() => assertEmployeePhotoClaim(undefined, "u1", "e1", "e2")).toThrow());
  it("sahipsiz dosyayı yeni personele bağlamaz", () => expect(() => assertEmployeePhotoClaim(undefined, "u1")).toThrow());
  it("başka personele bağlı dosyayı pending sahibi de alamaz", () => expect(() => assertEmployeePhotoClaim("u1", "u1", "e1", "e2")).toThrow());
});
