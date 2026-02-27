# PDKS Projesi Geliştirme Planı

> shadcn UI konsepti ile tutarlı tasarım ve sayfa bazlı iyileştirmeler

---

## 📋 Mevcut Durum Analizi

> **Son güncelleme:** Faz 1 tamamlandı. Sidebar layout, ortak bileşenler, AccessDenied entegrasyonu, PDKS header düzeltmesi yapıldı.

| Alan | Durum | Not |
|------|-------|-----|
| shadcn/ui | ✅ Kurulu (54 bileşen) | `src/components/ui/` |
| Tailwind + Burgundy Tema | ✅ Var | `#711A1A` palette tanımlı |
| Dark Mode | ✅ Altyapı hazır | `next-themes`, CSS variables kurulu |
| Sidebar bileşeni | ✅ shadcn Sidebar mevcut | `src/components/ui/sidebar.tsx` |
| Layout | ✅ Sidebar tabanlı | `SidebarProvider` + `AppSidebar` + `SidebarInset` |
| Convex Backend | ✅ Entegre | 30+ modül, real-time |
| Form sistemi | ✅ react-hook-form + zod | Bazı formlarda tutarsız kullanım |
| Bildirimler | ⚠️ Kısmen | Sonner mevcut ama tutarsız kullanım |

**Kritik Sorunlar (güncel):**
1. ~~Header tabanlı navigasyon~~ → ✅ Sidebar tamamlandı
2. `glass-card` / hardcoded `#711A1A` kullanımı → CSS variables'a geçiş
3. ~~PDKS Kayıtları çift header~~ → ✅ Düzeltildi
4. Loading/Empty/Error state'leri tutarsız ve eksik
5. ~~AccessDenied tekrar yazılıyor~~ → ✅ Ortak bileşen kullanılıyor

---

## 🎯 Hedefler

1. **Sidebar Layout**: Dikey sidebar navigasyon (shadcn `Sidebar` ile)
2. **shadcn Standardizasyonu**: Tüm sayfalarda tutarlı bileşen kullanımı
3. **Ortak Bileşenler**: `EmptyState`, `ErrorState`, `AccessDenied`
4. **Dark Mode**: Tüm sayfalarda tam uyum
5. **Responsive**: Mobilde drawer sidebar

---

## 🎨 1. Tema ve Tasarım Sistemi

### CSS Variables Standardizasyonu
- [ ] `hardcoded #711A1A` → `hsl(var(--primary))` ile değiştir (tüm dosyalarda)
  - Etkilenen: `Header.tsx`, `index.css`'deki custom class'lar, sayfa bileşenleri
- [ ] `glass-card` class'ını shadcn `Card` ile değiştir
  - Etkilenen: `Dashboard`, `Devices`, `Employees` sayfaları
- [ ] `.btn-primary`, `.btn-secondary` → shadcn `Button variant` ile değiştir
- [ ] Dark mode: Tüm sayfalarda `dark:` prefix kontrolü yap

### Tutarlı Kullanım Kuralları
```
Durum Göstergesi  → <Badge variant="...">
Loading           → <Skeleton> veya <LoadingSpinner>
Bildirim          → sonner toast()
Onay Dialogi      → <AlertDialog>
Yan Panel         → <Sheet> (sağdan açılan)
Modal             → <Dialog>
Dropdown Menü     → <DropdownMenu>
```

---

## 🧭 2. Layout: Sidebar Dönüşümü

### 2.1 Oluşturulan Bileşenler ✅

**`src/components/layout/AppSidebar.tsx`** (ana bileşen)
```
Sidebar içeriği:
├── [Logo] PDKS kırmızı kare + P harfi
├── [IconButton] Bildirimler (kırmızı nokta badge ile)
├── [Avatar] Kullanıcı baş harfleri
├── [Separator]
├── [Nav] SidebarMenuItem listesi:
│   ├── Kişiler        → /employees
│   ├── Cihazlar       → /devices
│   ├── Geçiş Kontrol  → /access-control
│   ├── PDKS Kayıtları → /pdks-records
│   └── Ayarlar        → /settings
└── [Footer] Çıkış butonu
```

**`src/components/layout/AppSidebarNav.tsx`** (nav item'ları)
- `SidebarMenuButton` ile aktif sayfa vurgusu
- `useLocation()` ile aktif route tespiti
- Aktif item: koyu kırmızı arka plan + beyaz metin/ikon

**`src/components/Layout.tsx`** (güncelleme)
```tsx
// Şu an: Header + children
// Hedef: SidebarProvider + AppSidebar + main content
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

### 2.2 Responsive Davranış
- [ ] Masaüstü: Sabit dikey sidebar (genişlik: 240px)
- [ ] Tablet: Collapsible (icon-only mod)
- [ ] Mobil: `Sheet` drawer olarak açılır, hamburger butonu

### 2.3 Header'dan Sidebar'a Geçiş Kontrol Listesi ✅
- [x] `Header.tsx` → Sidebar ile değiştirildi
- [x] `Layout.tsx` → `SidebarProvider` wrapper
- [ ] Her sayfadaki manuel padding/margin ayarlarını gözden geçir
- [x] `SidebarTrigger` + AppHeader (sayfa başlığı için hazır)

---

## 📦 3. Ortak Bileşenler

### `src/components/shared/EmptyState.tsx` ✅
```tsx
// Props: icon, title, description, action?
// Kullanım: Tablo/liste boşsa göster
```
Kullanılacak yerler: `EmployeeTable`, `DeviceList`, `CardReadings`, `PDKSTable`

### `src/components/shared/ErrorState.tsx` ✅
```tsx
// Props: title, description, onRetry?
// Kullanım: Convex query hata döndüğünde
```

### `src/components/shared/AccessDenied.tsx` ✅
```tsx
// Props: message?
// Kullanım: useProjectAccess() false döndüğünde
```
Etkilenen sayfalar: `Devices.tsx`, `Employees.tsx` — AccessDenied kullanıyor ✅

---

## 📄 4. Sayfa Bazlı İyileştirmeler

### 🏠 Dashboard (`src/pages/Index.tsx`)
- [ ] `StatsGrid` → shadcn `Card` + istatistik layout
- [ ] `ActivitySummaryCard` içerik zenginleştirme
- [ ] `QuickLinksGrid` hover efektleri (shadcn `Card` ile)
- [ ] `RecentReadingsTable` → shadcn `Table`
- [ ] Loading: tüm kartlarda `Skeleton`
- [ ] Empty state: `EmptyState` bileşeni

### 👥 Kişiler (`src/pages/Employees.tsx`)
- [ ] `EmployeeFilters` → shadcn `Input`, `Select`, `Button`
- [ ] `EmployeeTable` → shadcn `Table` (sütun sıralama ekle)
- [ ] Silme onayı → `AlertDialog` (şu an direkt silme var mı?)
- [ ] Detay paneli → `Sheet` (sağdan açılan)
- [ ] `DepartmentTree` → shadcn `Collapsible`
- [ ] Fotoğraf yükleme → `Dialog` içinde
- [ ] Empty state: `EmptyState` bileşeni
- [ ] Bulk actions → `DropdownMenu`

### 📱 Cihazlar (`src/pages/Devices.tsx`)
- [ ] `ZoneDoorTreePanel` → shadcn `Collapsible` / Accordion
- [ ] `DeviceDetailsPanel` → shadcn `Sheet`
- [ ] `QRCodeDialog` → shadcn `Dialog` (büyük ihtimalle zaten var, kontrol et)
- [ ] `AssignLocationForm` → `react-hook-form` + zod + shadcn `Form`
- [ ] Cihaz durumu → `Badge` (variant: "default"=online, "destructive"=offline, "outline"=unknown)
- [ ] Proje erişimi yok → `<AccessDenied />`
- [ ] Empty state: `EmptyState` bileşeni

### 🛡️ Geçiş Kontrol (`src/pages/AccessControl.tsx`)
- [ ] `AccessControlSidebar` → shadcn `Sidebar` item yapısına veya `Tabs`
- [ ] `UnifiedAccessControl` formları → shadcn `Form`
- [ ] `TemporaryAccess` form → shadcn `DatePicker`, `Select`
- [ ] `CardReadings` → shadcn `Table` + filtre
- [ ] `AddDoorDialog` / `AddZoneDialog` → shadcn `Dialog`
- [ ] Breadcrumb ekle (sayfa + alt sekme)
- [ ] `GroupDevicesManager` → `Dialog` + `Table`

### 📊 PDKS Kayıtları (`src/pages/PDKSRecords.tsx`)
- [x] **Çift header sorununu çöz** ✅
  - Sayfa header'ı sadeleştirildi, Layout AppHeader ile uyumlu
- [ ] `PDKSSummaryCards` → shadcn `Card`
- [ ] `PDKSFilterBar` → shadcn `Input`, `Select`, shadcn `DatePicker`
- [ ] `PDKSTableView` → shadcn `Table` + `Pagination`
- [ ] `PDKSChartView` → Recharts + shadcn `Card` wrapper
- [ ] `AiChatPanel` → shadcn `Sheet` (sağdan açılır)
- [ ] Mobil AI drawer → shadcn `Drawer` (Vaul zaten kurulu)
- [ ] Export butonu → `DropdownMenu` (Excel/CSV seçeneği)

### ⚙️ Ayarlar (`src/pages/Settings.tsx`)
- [ ] `SettingsSidebar` → shadcn `Tabs` veya dikey `SidebarMenu`
- [ ] `GeneralSettings` → shadcn `Form` + `Input`, `Select`
- [ ] `ShiftSettings` → shadcn `Table`, `Switch`, `Dialog`
- [ ] `NotificationSettings` → shadcn `Switch`, `Select`
- [ ] `MailSettings` → shadcn `Input`, test butonu
- [ ] `AdminUsersPanel` → shadcn `Table`, `Dialog`
- [ ] Kaydet butonları → tutarlı `Button variant="default"` (sağ alt)
- [ ] Onboarding progress → `OnboardingProgress` bileşeni kontrol et

### 👤 Profil (`src/pages/Profile.tsx`)
- [ ] Profil kartı → shadcn `Card` + `Avatar`
- [ ] `ProfileForm` → shadcn `Form`
- [ ] Şifre değiştirme → shadcn `Dialog`
- [ ] `ProfilePhoto` → fotoğraf upload dialog

### 🔧 Diğer Sayfalar
- [ ] **VirtualReaders** (`/virtual-readers`): `DeviceList` benzeri UI
- [ ] **SystemAdmin** (`/system-admin`): `UserTable` → shadcn `Table`, `UserFormDialog` → shadcn `Dialog`
- [ ] **Login/Register**: shadcn `Card`, `Form`, `Input`
- [ ] **LandingPage**: CTA butonları → shadcn `Button` variants

---

## 📋 Detaylı TODO (Güncel)

### Tamamlanan ✅
- [x] Sidebar CSS variables (index.css)
- [x] EmptyState, ErrorState, AccessDenied bileşenleri
- [x] AppSidebar + AppSidebarNav
- [x] Layout.tsx — SidebarProvider + AppSidebar
- [x] Header → Sidebar ile değiştirildi
- [x] Devices, Employees — AccessDenied kullanımı
- [x] PDKS Kayıtları — çift header düzeltmesi

### Bekleyen
- [ ] Dashboard shadcn Card iyileştirmeleri
- [ ] Hardcoded #711A1A → CSS variables (tüm proje)
- [ ] glass-card → shadcn Card (sayfa bazlı)
- [ ] Geçiş Kontrol, Ayarlar, Profil sayfa iyileştirmeleri
- [ ] EmptyState kullanımı (EmployeeTable, DeviceList vb.)
- [ ] ErrorState kullanımı (Employees error durumu)

---

## 📅 Uygulama Sırası

### Faz 1 — Altyapı ✅ TAMAMLANDI
> Diğer her şey buna bağlı

| # | Görev | Durum |
|---|-------|-------|
| 1 | `AppSidebar.tsx` oluştur | ✅ |
| 2 | `AppSidebarNav.tsx` oluştur | ✅ |
| 3 | `Layout.tsx` güncelle (SidebarProvider) | ✅ |
| 4 | `Header.tsx` → Sidebar ile değiştirildi | ✅ |
| 5 | `EmptyState.tsx` oluştur | ✅ |
| 6 | `ErrorState.tsx` oluştur | ✅ |
| 7 | `AccessDenied.tsx` oluştur | ✅ |
| 8 | Sidebar CSS variables eklendi | ✅ |

### Faz 2 — Ana Sayfalar
| # | Sayfa | Öncelik |
|---|-------|---------|
| 1 | PDKS Kayıtları (çift header fix) | Yüksek |
| 2 | Dashboard | Orta |
| 3 | Kişiler | Orta |
| 4 | Cihazlar | Orta |

### Faz 3 — İkincil Sayfalar
| # | Sayfa |
|---|-------|
| 1 | Geçiş Kontrol |
| 2 | Ayarlar |
| 3 | Profil |

### Faz 4 — Polish
| # | Görev |
|---|-------|
| 1 | Dark mode tam uyum kontrolü |
| 2 | Responsive test (mobil/tablet) |
| 3 | Loading skeleton'ları ekle |
| 4 | Error boundary ekle |
| 5 | Diğer sayfalar (SystemAdmin, VirtualReaders) |

---

## 📁 Oluşturulacak / Güncellenecek Dosyalar

```
src/
├── components/
│   ├── layout/
│   │   ├── AppSidebar.tsx        # YENİ — Ana sidebar
│   │   ├── AppSidebarNav.tsx     # YENİ — Nav item'ları
│   │   └── AppSidebarHeader.tsx  # YENİ — Logo + kullanıcı bölümü
│   ├── shared/
│   │   ├── EmptyState.tsx        # YENİ — Veri yok durumu
│   │   ├── ErrorState.tsx        # YENİ — Hata durumu
│   │   └── AccessDenied.tsx      # YENİ — Proje erişimi yok
│   ├── Layout.tsx                # GÜNCELLE — SidebarProvider wrapper
│   └── Header.tsx                # KALDIR veya sadeleştir
```

---

## ✅ Her Sayfa İçin Kontrol Listesi

- [ ] shadcn `Card`, `Button`, `Input`, `Select` kullanılıyor mu?
- [ ] Hardcoded renkler → CSS variables?
- [ ] Loading → `Skeleton` veya `LoadingSpinner`?
- [ ] Boş veri → `<EmptyState />`?
- [ ] Hata → `<ErrorState />`?
- [ ] Proje erişimi yok → `<AccessDenied />`?
- [ ] Silme işlemi → `<AlertDialog>` ile onay?
- [ ] Responsive (mobil) davranış doğru mu?
- [ ] Dark mode (`dark:` class'ları) uyumlu mu?
- [ ] Toast bildirimleri `sonner` kullanıyor mu?

---

## ⚠️ Dikkat Edilecek Noktalar

1. **Convex real-time**: Tüm data `useQuery`/`useMutation` ile geliyor, loading state'leri Convex pattern'e uygun olmalı (`undefined` = loading, `null` = not found)
2. **`useProjectAccess` hook'u**: Proje bazlı erişim kontrolü tüm sayfalarda var, `AccessDenied` bileşeni bunu kullanacak
3. **Sidebar bileşeni**: `src/components/ui/sidebar.tsx` zaten mevcut (shadcn), sadece `AppSidebar.tsx` içinde kullanılacak
4. **`next-themes`**: Dark mode altyapısı hazır, sadece bileşenlerin `dark:` class'larını kontrol etmek yeterli
5. **`Vaul` (Drawer)**: Mobil drawer için zaten kurulu, `src/components/ui/drawer.tsx` var

---

## 🌐 MCP Browser Test Sonucu (26.02.2026)

| URL | Durum | Not |
|-----|-------|-----|
| `http://localhost:8080/` | ✅ Çalışıyor | Landing page görünüyor (PDKS Sistemi, Giriş Yap, Demo İsteyin) |
| `http://localhost:8080/login` | ⚠️ | Auth yükleme veya yönlendirme |
| `http://localhost:8080/employees` | ⚠️ | Giriş gerekebilir |
| `http://localhost:8080/home` | ⚠️ | Giriş gerekebilir |

**Öneri:** Giriş yapıldıktan sonra sidebar layout'u `/home` veya `/employees` sayfasında kontrol edilmeli.
