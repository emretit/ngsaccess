# IDE Smart Panel Entegrasyonu — Session Devir Notu

> Son güncelleme: 2026-06-09. Tüm timestamp'ler UTC+3 (Türkiye).

---

## Proje Genel Durumu

- **Convex deployment:** `notable-tern-4` — DEV deployment ama canlı sistem. Deploy: `npx convex dev --once`
- **MQTT broker:** Hetzner `157.90.114.86:8883` (TLS self-signed, Docker Mosquitto)
- **Bridge servisi:** Hetzner'da systemd `ide-mqtt-bridge` + kullanıcı PC'de `npm run ide-agent` (localhost:8765)
- **IDE Smart UUID:** `SYSTEM.UUID` — 15 haneli (src-id). 16 haneli seri no / PID ile karıştırılmamalı.

---

## Bu Session'da Yapılanlar (2026-06-09)

### 1. Ağ Tarama Özelliği

**Sorun:** Her yeni IDE Smart panel eklenirken IP'yi manuel bulmak gerekiyordu.

**Çözüm:** Admin arayüzünden LAN taraması yapılabilir hale getirildi.

**Değişen dosyalar:**

- `scripts/lib/ide-provision.mjs`
  - `probePanel(ip, port, timeoutMs)` — tek IP'ye anonim `parameter_read` atar; `login_required` veya `success` dönerse IDE Smart panel
  - `scanSubnet(subnet, port, concurrency, timeoutMs)` — 30'lu batch'ler halinde .1–.254 tarar

- `scripts/ide-provision-agent.mjs`
  - `GET /scan?subnet=192.168.1` endpoint'i eklendi
  - `isValidPrivateSubnet()` — RFC 1918 kontrolü (SSRF önlemi; 10.x, 172.16-31.x, 192.168.x)
  - Port 1–65535 aralığı doğrulaması
  - `scanInProgress` bayrağı — çift tıklamada 429

- `src/components/admin/IdeProvisioningCard.tsx`
  - Subnet input + "Tara" butonu
  - Bulunan paneller tıklanabilir liste
  - "Manuel IP gir" toggle

### 2. Layout Düzenlemesi

- `IdeProvisioningCard` **MQTT Varsayılanları** tabından **Cihaz Yönetimi** tabına taşındı
- **MQTT Varsayılanları** tabı tamamen kaldırıldı
- Değişen dosya: `src/components/settings/sections/AdminDashboard.tsx`

Mevcut Admin paneli yapısı:
```
Admin → Proje & Kullanıcı   (AdminProjectsPanel)
Admin → Cihaz Yönetimi      (IdeProvisioningCard üstte + AdminDevicesPanel altta)
```

---

## Bekleyen Güvenlik Açıkları (DÜZELTİLMEDİ)

### Vuln 1 — Email Verification Bypass — HIGH
**Dosya:** `convex/auth.ts:21`

`profile()` callback'i `verified=false`'u yalnızca `companyName` gönderildiğinde set ediyor. Saldırgan `companyName` olmadan doğrudan `signUp` çağırırsa `verified=undefined` kalıyor, guard (`user.verified === false`) geçiyor, `project_admin` rolü otomatik alınıyor.

**Fix:** `companyName` olmayan signup'ı reddet veya her yeni kullanıcıyı varsayılan `verified=false` ile oluştur; davet/admin akışlarını farklı bir mekanizma ile ayırt et.

### Vuln 2 — Unauthenticated `sendEmployeeSetupEmail` — KRİTİK
**Dosya:** `convex/actions/sendEmail.ts:128`

`sendEmployeeSetupEmail` → `action()` (public, auth yok). `employeeAuth.create`/`update` da `mutation()` (public). Herhangi bir anonim saldırgan geçerli `employeeId` ile bu action'ı kendi e-postasıyla çağırıp çalışanın setup linkini ele geçirebilir.

**Fix:**
- `sendEmployeeSetupEmail` → `internalAction`
- `employeeAuth.create` / `employeeAuth.update` → `internalMutation`
- Çağıran taraf `adminMutation` içinden `ctx.scheduler` ile tetiklemeli

### Vuln 3 — HTML Injection in Email Templates — MEDIUM
**Dosya:** `convex/actions/sendEmail.ts:109`

`renderEmailTemplate` user-controlled değerleri (`employeeName`, `projectName`, `name`) HTML escape etmeden interpolate ediyor. `project_admin` phishing içeriği inject edebilir.

**Fix:** `renderEmailTemplate`'e geçmeden önce `escapeHtml()` uygula:
```ts
function escapeHtml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
```

---

## IdeProvisioningCard Kullanım Akışı

1. `npm run ide-agent` çalıştır (panelle aynı LAN'da, `.env.local` dolu olmalı)
2. Admin → Cihaz Yönetimi → Subnet gir → "Tara" (~15-20sn)
3. Listeden paneli seç
4. L3 şifre opsiyonel (boşsa `.env.local`'daki kullanılır)
5. "Broker'a Al" → login → MQTT/LOGGER yaz → reboot → ~30-60sn sonra broker'a bağlanır

---

## Kritik Dosyalar

| Dosya | Açıklama |
|-------|----------|
| `scripts/lib/ide-provision.mjs` | probePanel, scanSubnet, provisionPanel — tek kaynak |
| `scripts/ide-provision-agent.mjs` | localhost:8765 köprü servisi |
| `src/components/admin/IdeProvisioningCard.tsx` | Admin UI provisioning kartı |
| `convex/ideSync.ts` | MQTT op kuyruğu, idePanelUsers roster |
| `convex/lib/accessGraph.ts` | reconcilePanelRosterIde |
| `docs/ide-smart/NGSACCESS_SYNC_ARCHITECTURE.md` | Otoriter mimari doc |
| `infra/mqtt/RUNBOOK.md` | Broker kurulum/bakım |

---

## Temizlenecekler

- `src/components/admin/IdeDefaultsSettings.tsx` — artık hiçbir yerde kullanılmıyor, silinebilir
