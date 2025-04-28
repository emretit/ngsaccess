
# GPT4All Kurulum Kılavuzu

Bu kılavuz, PDKS AI Asistanı için GPT4All'un nasıl kurulacağını ve yapılandırılacağını anlatmaktadır.

## GPT4All Nedir?

GPT4All, yerel bilgisayarda çalışabilen, hafif ve açık kaynaklı bir AI dil modelidir. İnternet bağlantısı gerektirmez ve verileriniz cihazınızda kalır.

## Kurulum Adımları

### 1. GPT4All Uygulamasını İndirin

[GPT4All resmi web sitesinden](https://gpt4all.io/index.html) işletim sisteminize uygun sürümü indirin:
- Windows
- macOS
- Linux

### 2. Modeli İndirin

Uygulama ilk açıldığında model indiricisi otomatik olarak başlayacaktır.
Önerilen modeller:
- GPT4All-J v1.3-groovy
- Mistral 7B
- Wizard 13B

### 3. API Sunucusunu Etkinleştirin

1. GPT4All uygulamasını açın
2. Ayarlar (⚙️) simgesine tıklayın
3. "Serve" sekmesine gidin
4. "Enable API Server" seçeneğini işaretleyin
5. Port numarasını "4891" olarak ayarlayın (varsayılan)
6. "Save" (Kaydet) butonuna tıklayın

API sunucusu şimdi http://localhost:4891 adresinde çalışmaya başlamalıdır.

### 4. Test Edin

API sunucusunu test etmek için, bir terminal veya komut istemi açın ve aşağıdaki komutu çalıştırın:

```bash
curl -X POST http://localhost:4891/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt4all-j-v1.3-groovy", "prompt": "Merhaba, bugün nasılsın?", "max_tokens": 100}'
```

Başarılı bir yanıt, modelin çalıştığını gösterecektir.

## Sorun Giderme

1. **Bağlantı Hatası**: GPT4All uygulamasının açık olduğundan ve API sunucusunun etkinleştirildiğinden emin olun.

2. **Model Yüklenme Sorunu**: Eğer model düzgün yüklenmiyorsa, uygulamayı yeniden başlatın ve modeli tekrar indirin.

3. **Performans Sorunları**: 
   - Düşük RAM'li sistemlerde daha küçük modelleri tercih edin
   - GPU kullanımını etkinleştirin (ayarlardan)

4. **Port Çakışması**: Eğer 4891 portu başka bir uygulama tarafından kullanılıyorsa, farklı bir port seçin ve uygulama kodunda `constants.ts` dosyasındaki port numarasını güncelleyin.

