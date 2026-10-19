import { describe, expect, it } from "vitest";
import { topologyPreview } from "./topologyPreview";
import { HIK_MODELS, MANUAL_MODEL_ID } from "../../../convex/lib/hikModels";

describe("yeni cihaz kayıt özeti", () => {
  it("Hikvision modeli seçilmeden varsayılan kapı sayısını vaat etmez", () => {
    expect(topologyPreview({ brand: "hikvision", hik_model: "", hik_door_count: 4 })).toBe("Model seçin");
  });
  it("katalog modeli seçildiğinde kapı ve okuyucu sayısını modele göre gösterir", () => {
    const model = HIK_MODELS[0];
    expect(topologyPreview({ brand: "hikvision", hik_model: model.id })).toBe(`${model.doorCount} kapı · ${model.doorCount * model.defaultReadersPerDoor} okuyucu oluşturulacak.`);
  });
  it("manuel modelde ve IDE panelde kullanıcının kapı sayısını gösterir", () => {
    expect(topologyPreview({ brand: "hikvision", hik_model: MANUAL_MODEL_ID, hik_door_count: 2 })).toBe("2 kapı oluşturulacak.");
    expect(topologyPreview({ brand: "ide_smart", ide_door_count: 8 })).toBe("8 kapı oluşturulacak.");
  });
});
