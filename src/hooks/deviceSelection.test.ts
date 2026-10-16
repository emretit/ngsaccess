import { describe, expect, it } from "vitest";
import { visibleSelection, deleteDeviceSelection } from "./useDeviceTable";

describe("görünür cihaz seçimi", () => {
  it("filtre dışında veya önceki projede kalan seçim silmeye gitmez", () => {
    expect(visibleSelection(["A"], ["B"])).toEqual([]);
    expect(visibleSelection(["A", "B"], ["B", "C"])).toEqual(["B"]);
  });
  it("boş listede seçim kalmaz", () => {
    expect(visibleSelection(["A"], [])).toEqual([]);
  });
});

it("kısmi silmede tüm sonuçları bekler ve yalnız başarısız cihazları yeniden seçer", async () => {
  const attempted: string[] = [];
  const result = await deleteDeviceSelection(["A", "B", "C"], async (id) => {
    attempted.push(id);
    if (id === "B") throw new Error("Yetki yok");
  });
  expect(attempted).toEqual(["A", "B", "C"]);
  expect(result).toEqual({ deleted: 2, failed: ["B"] });
});
