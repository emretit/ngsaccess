# Dropdown audit — özet (2026-10-27)

2 Codex worker (gpt-6.1-sol medium), salt okuma. **23 bulgu: Y0 / O17 / D6.** Ayrıntı: W1 (13) + W2 (10) raporları.
Tarayıcı örnek kontrolü (Orca, /visitors → Ziyaretçi kaydet Sheet): Select popup'ı en üstte, genişlik tetikleyiciyle aynı (438/440 px); tarih popover'ı `z-[9999]` ile üstte, ekrandan taşmıyor. Katman (Z) sorunu görülmedi.

## Kök sebepler (öncelik sırası)

| # | Kök sebep | Bulgular | Düzeltme | Süre |
|---|---|---|---|---|
| 1 | Popup yükseklik sınırı yok | W1 #4 popover.tsx:20, W2 #5 PDKSSavedViews.tsx:60, W1 #2 date-picker.tsx:141 | popover + dropdown-menu wrapper'ına `max-h-[var(--radix-*-content-available-height)] overflow-y-auto`; date-picker ay/yıl listeleri collision'lı popup | ~20 dk |
| 2 | Boş / yükleniyor durumu yok | W1 #8-11 (MonitoringPersonPicker, AssignLocationForm, ClaimDeviceDialog, DeviceZoneSection), W2 #2 ShiftSelect, W2 #7-8 PDKSFilterBar | Select wrapper'larda "Kayıt yok" disabled öğe / yükleniyor metni; kaybolan seçili ID için fallback etiket | ~45 dk |
| 3 | Combobox tetikleyicileri form alanından farklı | W1 #6-7 MonitoringPersonPicker, W2 #3-4 EmployeePicker, W2 #9-10 AiChatMessage/PDKSDateNavigator, W1 #12 RulesFilters, W2 #1 ShiftSelect | ortak combobox tetikleyici sınıfı (h-9, border-input, ChevronDown, placeholder rengi) + popup genişliği `--radix-popover-trigger-width` | ~30 dk |
| 4 | Primitive küçükleri | W1 #5 Select placeholder rengi, W1 #3 `z-[9999]` → belgeli seviye, W1 #13 VisitorCombobox seçili check, W1 #1 date-picker ay/yıl listesi klavye/odak, W2 #6 uzun ad truncate | tek tek | ~30 dk |

Gözlem (tarayıcı): "Ziyaretçi erişim bölgesi" tetikleyicisi ↕ (ChevronsUpDown), diğerleri ⌄ — #3 kapsamında eşitle.

## Dikkat
- `src/components/access-control/**` altında Geçiş Kontrol oturumu aktif (30+ kirli dosya, 2026-10-27 14:35). W1 #12 RulesFilters ve VisitorCombobox dışındaki access-control dokunuşlarını o oturum commit'leyince yap; önce `git status --porcelain <dosya>` bak.

## Düzeltme durumu (2026-10-27 15:00) — 21/23 kapandı, 2 bilinçli korundu
- Primitive (koordinatör): popover + dropdown-menu (alt menü dahil) `available-height` sınırı + scroll; Select placeholder rengi `data-placeholder`; date-picker ay/yıl listeleri iç içe Radix Popover (Escape yalnız alt listeyi kapatır, açılışta seçili yıla kayar + odaklanır, ok tuşlarıyla gezinme, `aria-pressed`), `z-[9999]` kaldırıldı; YENİ `ui/combobox-trigger.tsx` (`ComboboxTrigger` + `COMBOBOX_CONTENT_CLASS`).
- Tüketiciler (run_0de8cc79e586, 2 Codex worker): W1 #6-#11, #13; W2 #2-#4, #6-#10. W1 #12 RulesFilters mobil `min-h-11` kaldırıldı (arama input'uyla aynı satır).
- Korunan: W2 #1 ShiftSelect mobil `min-h-11` (UI audit 2'de bilinçli, a3b60391); W2 #5 primitive ile kapandı.
- Kapılar: tsc 0, eslint 0 error, vitest 443 dosya / 5063 test. Orca: PDKS tarih seçici yıl listesi (2026 ortada, Escape katmanı) + İzinler kişi combobox'ı (36 px, ✓, popup 240 px) doğrulandı.
- Commit pathspec: .claude/pathspec-dropdown-fix.txt (commit/push/yayın YOK).
