
# Yerel Llama Modelini Kurma Kılavuzu

Bu belgede, PDKS AI Asistanı için yerel bir Llama modelini nasıl kuracağınız ve yapılandıracağınız anlatılmaktadır.

## Gereksinimler

- Python 3.8 veya üstü
- Git
- CUDA desteği olan bir GPU (opsiyonel ama önerilen)

## Kurulum Adımları

### 1. Llama.cpp Reposunu İndirin

```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
```

### 2. Modeli İndirin

Hugging Face'den Llama modeli indirin. Örneğin:

```bash
# Meta Llama 2'nin 13B quantized versiyonu
wget https://huggingface.co/TheBloke/Llama-2-13B-chat-GGML/resolve/main/llama-2-13b-chat.ggmlv3.q4_0.bin
```

### 3. Web Sunucusunu Başlatın

```bash
# llama.cpp dizininde
python3 -m pip install -r requirements.txt
python3 server.py --model llama-2-13b-chat.ggmlv3.q4_0.bin --host 0.0.0.0 --port 8000
```

### 4. Sunucuyu Test Edin

```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Merhaba, bugün personel devam durumu nedir?", "max_tokens": 100}'
```

## PDKS Uygulamasıyla Entegrasyon

PDKS uygulaması, varsayılan olarak `http://localhost:8000/generate` adresinde çalışan bir Llama sunucusuna bağlanacak şekilde yapılandırılmıştır.

Yerel sunucu adresini değiştirmeniz gerekiyorsa, `src/components/pdks/PDKSAiChat.tsx` dosyasındaki `LOCAL_LLAMA_ENDPOINT` sabitini değiştiriniz.

## Sorun Giderme

1. **Bağlantı Hatası**: Yerel sunucunuzun çalıştığından ve güvenlik duvarı tarafından engellenmediğinden emin olun.

2. **Hafıza Yetersizliği**: Daha küçük bir model (7B veya 3B) kullanmayı deneyin.

3. **CUDA Hataları**: GPU desteğini devre dışı bırakmak için `--n_gpu_layers 0` parametresini ekleyin.
