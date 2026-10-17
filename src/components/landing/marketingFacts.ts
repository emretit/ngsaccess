// Süre, fiyat, kapasite ve müşteri referansı ancak ürün onayından sonra eklenir.
export const marketingFacts = {
  accountCta: "Hesap oluştur",
  accountDescription: "Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez ve ücretli plan satın almaz.",
  setupDescription: "Hesabınızı oluşturun, projenizi adım adım hazırlayın.",
  trialDescription: "Deneme süresi ve kullanım koşulları için bizimle iletişime geçin.",
  planDescription: "Plan kapsamı, çalışan kapasitesi ve ücretlendirme kuruluşunuzun ihtiyaçlarına göre netleştirilir. Hesap oluşturmak ücretli plan satın almaz.",
  mobileDescription: "Mobil uygulama yakında. Şimdilik işyerinizin web QR girişini kullanın; erişim için yöneticinize başvurun.",
  capabilities: [
    { value: "Personel", label: "Devam takibi", description: "Giriş ve çıkış kayıtlarını görüntüleyin." },
    { value: "Proje", label: "Ortak çalışma", description: "Yetkili olduğunuz projenin verileriyle çalışın." },
    { value: "Vardiya", label: "Çalışma planı", description: "Çalışma takvimini ve izinleri yönetin." },
    { value: "Rapor", label: "Kayıt inceleme", description: "Personel kayıtlarını inceleyip dışa aktarın." },
  ],
} as const;
export const ACCOUNT_CTA = marketingFacts.accountCta;
export const ACCOUNT_DESCRIPTION = marketingFacts.accountDescription;
export const SETUP_DESCRIPTION = marketingFacts.setupDescription;
