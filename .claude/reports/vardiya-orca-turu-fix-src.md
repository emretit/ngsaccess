# Vardiya Orca turu — src görsel düzeltmeleri

- 1 kapandı — `src/components/pdks/dashboard/PdksPlanSummary.tsx:5`, `src/components/pdks/dashboard/PDKSHeatmapView.tsx:108`: compact rozet yalnız N vardiya / Boş gün gösterir; tam adlar title ve aria-label içinde; planlı hücre 42 px, üç kısa satırın satır yükseklikleri sınırlı; tablo ve çekmece tam adları korur.
- 2 kapandı — `src/components/pdks/lib/presentation.ts:34`, `src/components/pdks/dashboard/PdksDaySegments.tsx:21`, `src/components/pdks/dashboard/PDKSHeatmapView.tsx:114`: iki uç yoksa tek —, tek uç varsa aralık korunur; okutmasız heatmap saat satırı gizlenir.
- 3 kapandı — `src/components/shifts/AssignmentEditDialog.tsx:68`, `:150`, `:258`: çoklu planda ortak planSummary hem düzenleme açıklamasında hem onay nesne adında kullanılır; plansız/tek vardiyalı eski metin birebir korunur.

Testler: `src/components/pdks/dashboard/shiftPlans.test.tsx:119` ve yeni `src/components/shifts/AssignmentEditSummary.test.tsx:29`; 9 yeni senaryo, kişi/departman ve üç desen dahil.
Kapılar: `tsc --noEmit -p tsconfig.app.json` exit 0; `eslint src` exit 0, uyarı yok; `vitest run src` 191 dosya / 1253 test başarılı; son yerleşim ayarı ardından hedefli 2 dosya / 22 test tekrar başarılı.
Koordinatörün ask yanıtıyla yalnız `shiftPlans.test.tsx:87` eski —–— beklentisi yeni — çıktısına güncellendi; diğer mevcut beklentiler değiştirilmedi.
Convex'e dokunulmadı, dev server açılmadı; canlı görsel doğrulama koordinatörün Orca turunda yapılabilir; açık soru yok.
