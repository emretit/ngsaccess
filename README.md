# NGSPLUS.APP - Personel Devam Kontrol Sistemi

Modern personel devam kontrol ve geçiş sistemleri çözümü sunan web tabanlı
uygulama.

## Kullanılan Teknolojiler

Bu proje aşağıdaki teknolojilerle geliştirilmiştir:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase
- React Query
- React Router

## Kurulum

Projeyi yerel geliştirme ortamınızda çalıştırmak için aşağıdaki adımları takip
edin:

```sh
# Adım 1: Repository'yi klonlayın
git clone <REPO_URL>

# Adım 2: Proje dizinine gidin
cd ngsaccess

# Adım 3: Gerekli bağımlılıkları yükleyin
npm install

# Adım 4: Geliştirme sunucusunu başlatın
npm run dev
```

## API Server

Uygulamanın API sunucusunu çalıştırmak için:

```sh
npm run api
```

Geliştirme modunda API sunucusunu çalıştırmak için:

```sh
npm run dev:api
```

## Derleme

Projeyi derlemek için:

```sh
# Üretim için derleme
npm run build

# Geliştirme modu için derleme
npm run build:dev
```

## Proje Yapısı

- `/src`: Ana kaynak kodu dizini
  - `/components`: Yeniden kullanılabilir UI bileşenleri
  - `/pages`: Sayfa bileşenleri
  - `/hooks`: Özel React hook'ları
  - `/integrations`: Dış servislerle entegrasyonlar
  - `/services`: Servis fonksiyonları
  - `/types`: TypeScript tip tanımlamaları
  - `/utils`: Yardımcı fonksiyonlar
  - `/styles`: CSS stilleri

## Özellikler

- Personel yönetimi
- Cihaz yönetimi
- Erişim kontrolü
- PDKS kayıtları
- Sanal okuyucular
