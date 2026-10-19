# Dalga 3a denetimi — A: backend + Geçiş Kontrol + Denetim Kaydı
Önce `.claude/orca-specs/review-d3a-common.md` oku ve uygula.
## Kapsam
`git diff -- convex src/components/access-control/unified src/hooks/access-rules src/types src/pages/AuditLog.tsx src/pages/AccessControl.tsx src/hooks/useAccessRules.ts`
+ yeni dosyalar: convex/lib/accessRuleSummary*.ts, convex/lib/auditSearch*.ts, src/components/audit/**, src/components/access-control/unified/AccessRuleDetails.tsx.
## Özellikle bak
1. `accessRules.listSummaries` / `getDetails`: yetki + proje kapsamı (başka projenin kuralı/üyesi sızıyor mu), bounded okuma (`.collect()` sınırsız mı), search index kullanımı doğru mu, `accessRules.list` eski sözleşmesi korunmuş mu.
2. `schema.ts` diff'i: yalnız index/search index ekleme mi; mevcut veriyle uyumsuz zorunlu alan var mı (deploy'u kırar mı).
3. `auditLog` searchText: KVKK — yalnız ad benzeri alanlar mı yazılıyor (TC, telefon, e-posta, kart no aranabilir hale gelmemeli); eski kayıtlarda searchText yokken arama davranışı dürüst mü; cursor + filtre değişiminde sıfırlama.
4. Frontend: kural listesi arama/özet, AccessRuleDetails yükleme/hata/boş durumları, proje değişiminde seçim sıfırlama; AuditChangeDetail önce/sonra gösterimi hassas alanları maskeliyor mu.
