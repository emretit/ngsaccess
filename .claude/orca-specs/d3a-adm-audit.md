# Dalga 3a — ADM UX-1C: Denetim kaydı arama ve okunabilir değişiklik ayrıntısı

**Hedef:** Denetim kaydında kullanıcı/işlem/hedef/metin araması yetkili veri kümesinin tamamında çalışır (sayfa içi değil) ve URL'de kalır; satır klavyeyle açılır/kapanır, değişiklik ayrıntısı Türkçe alan adlarıyla eski→yeni farkı gösterir (ham JSON ikincil), tam kimlik kopyalanır, tüm projeler görünümünde proje sütunu vardır, mobilde tek sütun okunur.

(Rapor: `docs/ux-audit/04_AYARLAR_ADMIN.md` §3 ADM-29 (arama/URL), ADM-31, ADM-37 (denetim kısmı) + §5 UX-1 "1C". Ortak kurallar aşağıda.)

## Bağlam (Dalga 2b'de yapıldı — koru)
`auditLog.list` cursor paginate + index seçimi (`convex/lib/auditLogQuery.ts`), URL filtreleri, kapsam çipi, debounce (`useDebouncedValue`), boş sayfada en çok 5 otomatik loadMore, sabit TR hedef sözlüğü. Action ve metin araması şu an SAYFA İÇİ.

## Bulgular
1. **ADM-29 (arama)** — Metin araması tüm kapsamda: `auditLog`'a search index gerekiyorsa `ask` ile iste (öneri: `searchIndex("search_text", { searchField: "searchText", filterFields: ["projectId", "targetTable", "action", "userId"] })` + yazım anında doldurulan `searchText` alanı — kullanıcı adı, hedef adı/etiketi, not). Alan eklemek şema + tüm auditLog yazım noktalarında doldurma demek: önce yazım noktalarını grep'le say ve `ask`'te raporla; koordinatör karar verir (alternatif: yalnız `userName` + `note` ile sınırlı arama). Eski kayıtlar için "eski kayıtlarda arama yalnız yüklenenlerde" dürüst notu. Action filtresi index'e taşınabiliyorsa (`by_project_action_timestamp` gibi) iste.
2. **ADM-31** — Satır `button`/`aria-expanded`/`aria-controls` ile klavyeden açılır; yeni `src/components/audit/AuditChangeDetail.tsx`: alan bazlı eski→yeni tablo, Türkçe alan etiketleri (`src/components/audit/auditLabels.ts` — hedef tablo + alan adı → Türkçe; bilinmeyen alan ham adla), ham JSON "Teknik ayrıntı" altında; hedef kimliği tam + kopyala düğmesi (adlı); tüm projeler görünümünde proje sütunu; mobilde tek sütun kart.
3. **ADM-37 (denetim)** — `AuditLog.tsx`'teki sabit `bg-green-100/text-green-800` vb. işlem rengi map'i → `StatusBadge`/badge semantik varyantları; useToast varsa notify.
4. Saf mantık (fark hesaplama, etiket eşleme, arama parametresi) → vitest.

## Ownership (yalnız bunlara yaz)
convex/auditLog.ts · convex/lib/auditLogQuery*.ts · convex/lib/auditSearch*.ts (yeni) · src/pages/AuditLog.tsx · src/components/audit/** (yeni) · auditLog'a yazan noktalar YALNIZ koordinatör `searchText` alanını onaylarsa (onay mesajında dosya listesi verilir).

## Kapsam dışı
`getPdksAuditForEmployee` imzası/davranışı (PDKS ekranı kullanıyor) · admin paneli / ayarlar (Dalga 3b ADM) · schema.ts (koordinatör) · ortak bileşenler (SHL).
