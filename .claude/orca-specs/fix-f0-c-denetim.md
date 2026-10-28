# DENETİM — Faz 0-C (C-01 UUID tekilliği, C-02 IDE taşıma engeli, C-03 köprü hata kodu)
ÖNCE `/Users/emreaydin/ngsaccess/.claude/orca-specs/fix-denetim-ortak.md` OKU. Fix spec: `.claude/orca-specs/fix-f0-c-cihaz.md`.
Worker raporu: `/tmp/fix-f0-c-cihaz-rapor.md`. Rapor: `/tmp/fix-f0-c-denetim.md`.
Koordinatör kararı (spec'e ek): C-02'de İLK CLAIM SERBEST; engel = proje değişimi + o ideUuid için `idePanelUsers` satırı var (release→claim dahil); roster boşsa taşıma serbest. http.ts'te yalnız /ide-bridge/ack errorCode iletimi izinli.
Dosyalar: convex/devices.ts convex/lib/deviceProvision.ts convex/lib/deviceAssignment.ts convex/adminDevices.ts convex/ideSync.ts convex/http.ts
convex/devicesMutations.characterization.test.ts convex/fixF0Devices.test.ts convex/lib/deviceProvision.ehomeId.test.ts
scripts/lib/ide-mqtt-routing.mjs scripts/lib/ide-mqtt-routing.nodetest.mjs
Özel dikkat: ideUuid'ye yazan TÜM yollar (create/update/claim/admin kayıt/provizyon/migrations) yardımcıyı çağırıyor mu; trim/biçim; aynı cihazın havuz kaydı istisnası
bypass açıyor mu; C-02 kontrolü yarış durumunda; köprü maskesi gerçekten parola/token/kart sızdırmıyor mu; eski köprü sürümüyle geriye uyum; http.ts'te
başka davranış değişmiş mi. Kapılara ek: `node --test scripts/lib/ide-mqtt-routing.nodetest.mjs`.
