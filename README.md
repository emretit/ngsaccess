# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/83166804-92d3-4cc5-9b0a-abc77364e70d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/83166804-92d3-4cc5-9b0a-abc77364e70d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/83166804-92d3-4cc5-9b0a-abc77364e70d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Kart Okuyucu Cihaz Entegrasyonu

Bu projeye PDKS (Personel Devam Kontrol Sistemi) kart okuyucu cihazları bağlanabilir. Cihazlardan gelen kartları okumak için iki farklı yöntem sunulmuştur:

### 1. Yerel HTTP API Sunucusu

Yerel bir HTTP API sunucusu başlatarak kart okuyucu cihazları doğrudan bu sunucuya bağlayabilirsiniz. Bu yöntem, özellikle aynı ağda çalışan cihazlar için uygundur.

```bash
# API sunucusunu başlatmak için:
npm run api

# Hem Vite geliştirme sunucusunu hem de API sunucusunu aynı anda başlatmak için:
npm run dev:all
```

API sunucusu varsayılan olarak 3001 portunda çalışır ve şu endpoint'i sunar:
- `POST /api/card-reader` - Kart okuma isteklerini karşılar

### 2. Supabase Edge Function

Supabase Edge Function kullanarak internet üzerinden erişilebilen bir API endpoint'i oluşturabilirsiniz. Bu yöntem, farklı lokasyonlardaki cihazlar için uygundur.

Edge Function'ı dağıtmak için:

```bash
# Supabase CLI'yi yükleyin
npm install -g supabase

# Supabase hesabınıza giriş yapın
supabase login

# Edge function'ı güncelleyin
supabase functions deploy card-reader --project-ref=gjudsghhwmnsnndnswho
```

Edge Function URL'i: `https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/card-reader`

### API İstek Formatı

Kart okuyucu cihazlar aşağıdaki JSON formatında istek göndermelidir:

```json
{
  "card_no": "12345678",
  "device_id": "TERMINAL001",
  "ip_address": "192.168.1.100",
  "location": "Ana Giriş"
}
```

Eski format desteği (geriye dönük uyumluluk için):

```json
{
  "user_id": "12345678",
  "serial": "TERMINAL001"
}
```

veya 

```json
{
  "user_id,serial": "12345678,TERMINAL001"
}
```

### API Yanıt Formatı

Başarılı yanıt:

```json
{
  "response": "open_relay",
  "confirmation": "relay_opened",
  "employee_name": "Ahmet Yılmaz",
  "timestamp": "2023-10-15T14:30:45.123Z",
  "reading_id": "1234-5678-90ab-cdef"
}
```

Başarısız yanıt:

```json
{
  "response": "close_relay",
  "error": "Çalışan bulunamadı"
}
```

### Güvenlik

API'ye erişim için `x-api-key` başlığını kullanmanız gerekmektedir. Bu API anahtarı, ortam değişkenlerinde tanımlanmıştır. Geliştirme modunda API anahtarı kontrolü atlanabilir.
