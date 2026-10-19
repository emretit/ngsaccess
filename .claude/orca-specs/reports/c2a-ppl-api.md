# C2a W-ppl-api — kişi cihaz durumu ve erişim geçmişi

İki `authedQuery` hazır: `api.peopleActivity.employeeSyncStatus` ve `api.peopleActivity.employeeRecentReadings`.
Frontend sonuç tiplerini `FunctionReturnType<typeof api.peopleActivity.employeeSyncStatus>` / `FunctionReturnType<typeof api.peopleActivity.employeeRecentReadings>` ile alabilir.

## Kesin sorgu sözleşmesi

```ts
import type { Id } from "convex/_generated/dataModel";

type EmployeeSyncStatusArgs = { employeeId: Id<"employees"> };
type EmployeeSyncStatusResult = null | {
  devices: Array<{
    device: {
      id: Id<"devices">;
      name: string;
      brand: "hikvision" | "ide_smart" | "other" | null;
    };
    status: "queued" | "processing" | "failed" | "verified" | "unknown";
    lastChangedAt: number | null; // epoch ms; hiç kişi kanıtı yoksa null
    errorMessage?: string;
  }>;
  summary: {
    total: number;
    failed: number;
    pending: number; // queued + processing
    verified: number;
    unknown: number;
  };
  scanTruncated: boolean;
  targetsTruncated: boolean;
};

type EmployeeRecentReadingsArgs = {
  employeeId: Id<"employees">;
  limit?: number;
};
type EmployeeRecentReadingsResult = null | Array<{
  _id: Id<"cardReadings">;
  accessTime: string;
  accessStatus: "izin_verildi" | "reddedildi" | null;
  direction: "entry" | "exit" | null;
  deviceId: Id<"devices"> | null;
  deviceName: string | null;
  hikDenialReason: string | null;
}>;
```

Her iki sorgu önce çalışanı okur; kayıt yoksa `null`. Kayıt var fakat projesi yok veya `resolveProjectScope` kapsamı dışında ise `ConvexError("Bu personele erişim yetkiniz yok")`. Oturum/yükleniyor/hata/null/boş dizi durumları frontend'de ayrı ele alınmalıdır.

## Durum anlamı ve sunum

| Durum | Türkçe etiket | Kanıt |
|---|---|---|
| `queued` | Bekliyor | Kişinin son isteği `pending`. |
| `processing` | İşleniyor | Hik `processing` veya IDE `sent`; IDE için cihaz yanıtı bekleniyor. |
| `failed` | Başarısız | Kişinin son isteği `failed`; varsa `errorMessage` son kayıtlı hatadır. |
| `verified` | Doğrulanmış teslim | IDE `upsertUser` + `acked` + sonlu `ackedAt`, veya güvenilir `idePanelUsers.syncedAt` kanıtı. Genel erişim izni / tüm alanların güncelliği iddiası değildir. |
| `unknown` | Bilinmiyor | Kanıt yok/eksik, tarama tamamlanamadı, IDE kartı belirsiz, Hik `done`, onaysız ack veya kişi silme onayı. |

Hikvision için ayrı `sent` eklenmedi; `done` **unknown**. `lastChangedAt` bir “son görülen kayıt zamanı”dır; doğrulanmış durum dışında “son doğrulama” diye etiketlenmemeli. Op üzerinde mevcut `createdAt`, `processingStartedAt/completedAt` veya `sentAt/ackedAt` zamanlarının en yenisi kullanılır; ayrı `failedAt` bulunmadığından kesin hata geçiş zamanı vaat edilmez. Kanıt yokken tarih uydurulmaz (`null`).

İstekler cihaz ve marka bazında `createdAt`, eşitlikte `_creationTime` ve `_id` ile sıralanır. Eski isteğin geç gelen onayı yeni başarısız/bekleyen isteği gizlemez. Özet yalnız dönen hedefleri sayar; `targetsTruncated=true` ise kesin toplam gibi sunulmamalıdır. `scanTruncated=true` için “Durum kayıtları kısmen incelendi” ve `targetsTruncated=true` için “Hedef cihaz listesi kısmen gösteriliyor” önerilir.

## Hedef cihazlar ve IDE kanıtı

- Ortak `getEmployeeTargetDevices` çıkarıldı; üyelik → aynı projedeki kural → grup cihazları → aynı projedeki cihaz yolu kullanılır. Yeni sorgu, mevcut push hattı gibi yalnız aktif kuralları ve aktif cihazları alır; cihazlar tekilleştirilir. Eski silme snapshot'ı limitsiz ve aktiflik filtresiz davranışını korur.
- Hik payload'ında açık `employeeId` eşleşir. IDE için açık `employeeId` varsa başka kişiye ait ID kart eşleşmesiyle geçersiz kılınmaz; yoksa `upsertUser.userRecord.id` / `deleteUser.ideUserId`, `String(Number(cardNumber))` normalizasyonuyla eşleşir. Güvensiz/boş/sayısal olmayan kart reddedilir.
- Koordinatörün `msg_3c87a734f70c` yönlendirmesiyle eklenen IDE kart/roster yolu: aynı projedeki personelde normalize kartın tek sahibi kanıtlanır; çakışma veya eksik sahip taraması halinde bütün IDE hedefleri bilinmiyor kalır. Yeni kişinin oluşturulmasından önceki kart işlemi/roster, yeni kişiye kanıt sayılmaz.
- `idePanelUsers` yalnız `ideSync.markAck` başarılı kullanıcı onayı ve `seedPanelUsers` cihazdan okunan roster aracılığıyla yazılır (`convex/ideSync.ts`); enqueue/sent adımında yazılmaz. `by_uuid_card` sonucu tekil, aynı proje ve aynı cihaz olmalı. Yalnız kişi işlemi yokken roster doğrulaması kullanılır; bir işlem varsa onun durumu esastır. Kartın geçmişte aynı mevcut kişiye yeniden atanması için ayrı tarih alanı yoktur; bu alan tam güncel yetki garantisi vermez.
- Her markanın herhangi bir durum aralığı sınırı dolarsa o markanın **bütün** hedefleri unknown olur; mevcut ack/roster bile eksik taramayı yeşile çeviremez. `errorMessage` ve zaman, varsa en son görülen kaydın bilgisi olarak kalabilir.

## Okuma sınırları

| Kaynak | Sınır / index |
|---|---|
| Kişi üyelikleri | `by_project_employee.take(100)`; en çok 100 kural get. |
| Grup cihaz bağlantıları | `by_project_group.take(kalan)`; tüm kurallar toplamında 500 bağlantı, en çok 500 cihaz get. |
| Hik kuyruk | 4 durum × 100, `by_project_status_created`, yeni→eski. |
| IDE kuyruk | 4 durum × 100, aynı index, yeni→eski. Marka hedefi yoksa o kuyruğa okuma yapılmaz. |
| IDE kart sahipliği | `employees.by_project.take(500)`; yalnız IDE hedefi ve geçerli kart varsa. |
| IDE roster | Hedef IDE cihazı başına `by_uuid_card.take(2)`; en çok 500 cihaz. 2 sonuç tekillik kanıtını reddeder. |
| Son geçişler | `by_employee_status_time`, izin/verilmeyen/eski boş durum için 3 ayrı `order("desc").take(L)`; en çok 150 okuma. |
| Geçiş cihaz adları | Dönen okumaların tekil cihazları için en çok L (50) get. |

Tam sınırda da muhafazakâr olarak eksik sayılır (100/500). Operasyon taraması yalnız çalışanın projesi içindir; legacy `projectId` eksik op'lar kişiye ait kesin durum diye sunulmaz. Ortak auth/`resolveProjectScope` helper'larının mevcut kapsam okumaları değiştirilmedi; yukarıdaki sınırlar yeni aktivite/veri okumaları içindir.

Geçiş `limit` varsayılan 10, en çok 50, en az 1; kesir aşağı yuvarlanır, finite olmayan değer 10 olur. Üç durum listesinin birleşimi zaman azalan, eşitlikte ID azalan sıralanır; farklı/eksik proje okumaları limitten önce atılır. Proje filtresi sınırlı index okumasından sonra olduğu için bozuk eski proje satırları varsa istenenden az kayıt dönebilir. Durum boş eski okumalar `accessStatus:null` ile korunur; biyometri/PDKS filtresi yapılmaz. Cihaz yoksa veya başka projedeyse adı `null` döner.

## Doğrulama ve teslim

- `node_modules/.bin/tsc --noEmit -p convex/tsconfig.json`: **geçti**.
- `node_modules/.bin/tsc --noEmit -p tsconfig.app.json`: **5 kapsam dışı PDKS hatası** (`PDKSHeatmapView.tsx`, `pdksSummary.test.ts`, `pdksSummary.ts` ×2, `PDKSRecords.tsx`); kendi dosyalarında 0 hata.
- `node_modules/.bin/eslint src convex`: **0 hata, 2 kapsam dışı uyarı**; kendi dört TS dosyasında ayrıca lint temiz.
- `node_modules/.bin/vitest run`: **79 dosya / 767 test geçti**; yeni saf mantık testleri **15** adet (Hik done, IDE onay, yeni hata, eksik tarama, kart/roster, sıralama/limit dahil).
- Şema, cardReadings.ts, frontend, DB, deploy, commit/push değiştirilmedi. Canlı cihaz/oturum testi yapılmadı; koordinatör UI'da null/boş/unknown/failed/verified ve eksik tarama sunumunu kontrol etmeli.

Dosyalar: `convex/peopleActivity.ts`, `convex/lib/peopleActivity.ts`, `convex/lib/peopleActivity.test.ts`, `convex/lib/peopleHikSnapshot.ts` ve `_generated/api.d.ts` içindeki yalnız iki yeni modül satır çifti.
