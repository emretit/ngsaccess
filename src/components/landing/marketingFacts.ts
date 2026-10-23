export const marketingFacts = {
  accountCta: 'Hesap oluştur',
  accountDescription: 'Hesap oluşturmak ücretli plan satın almaz.',
  planDescription:
    'Plan kapsamı, çalışan kapasitesi ve ücretlendirme kuruluşunuzun ihtiyaçlarına göre netleştirilir.',
  mobileDescription:
    'Mobil uygulama yakında. Şimdilik işyerinizin web QR girişini kullanın; erişim için yöneticinize başvurun.',
  heroTitle: 'Bulut PDKS ve <br>Geçiş\u00a0Kontrol Sistemi',
  heroDescription:
    'Kart, terminal ve QR ile yapılan giriş-çıkışlar puantaja dönüşür; kapı yetkileri, vardiya ve izinler aynı bulut hesapta.',
  heroCaption: 'Ana Sayfa: günün özeti ve son kart okutmaları. Ekranlardaki veriler örnektir.',
  liveFeed: {
    title: 'Canlı İzleme',
    badge: 'Canlı',
    sample: 'Örnek veri',
    pause: 'Durdur',
    resume: 'Sürdür',
    allowed: 'İzin verildi',
    denied: 'Reddedildi',
    label: 'Canlı İzleme örneği: kart okutmaları izin verildi veya reddedildi olarak listelenir.',
    events: [
      { name: 'Deniz A.', door: 'Otopark', result: 'denied', reason: 'Yetki yok' },
      { name: 'Burak Y.', door: 'Ana Giriş', result: 'allowed' },
      { name: 'Selin K.', door: 'Ana Giriş', result: 'allowed' },
      { name: 'Mert Ç.', door: 'Depo', result: 'allowed' },
      { name: 'Elif Ş.', door: 'Lobi', result: 'denied', reason: 'Saat dışı' },
      { name: 'Can Ö.', door: 'Ana Giriş', result: 'allowed' },
      { name: 'Ece A.', door: 'Otopark', result: 'allowed' },
      { name: 'Zeynep K.', door: 'Depo', result: 'denied', reason: 'Kart tanımlı değil' },
    ],
  },
  nav: [
    {
      href: '/#ozellikler',
      label: 'Özellikler',
    },
    {
      href: '/#kurulum',
      label: 'Nasıl çalışır?',
    },
    {
      href: '/#guvenlik',
      label: 'Güvenlik',
    },
    {
      href: '/#iletisim',
      label: 'İletişim',
    },
  ],
  loginCta: 'Giriş yap',
  menuLabel: 'Menü',
  skipLabel: 'İçeriğe geç',
  heroSecondary: 'Özellikleri incele',
  heroAlt: 'Ana Sayfa: proje özeti, personel ve son kart okumaları',
  hardware: [
    'Entegre olduğumuz markalar',
    'Cihaz modelinizin uygunluğunu kurulumdan önce birlikte değerlendirelim.',
  ],
  hardwareBrands: ['Hikvision', 'Dahua', 'IDE Smart', 'Mavisoft'],
  featuresTitle: 'Kapıdan puantaja,<br>günün bütün kaydı.',
  featuresDescription: 'Kart okutması geçiş kaydına, geçiş kaydı puantaja dönüşür.',
  features: [
    {
      name: 'Canlı İzleme',
      title: 'Geçişleri olurken görün.',
      description: 'İşyerinizdeki kart okumalarını tek akışta izleyin.',
      items: [
        'İzin verilen ve reddedilen geçişleri ayırt edin.',
        'Personel, cihaz ve zaman bilgilerini inceleyin.',
        'Akışı duraklatıp kayıtları kendi hızınızda kontrol edin.',
      ],
      shot: 'canli-izleme',
      alt: 'Canlı İzleme: izin verilen ve reddedilen kart okutmaları, red nedenleriyle',
      caption: 'Reddedilen geçişin nedeni satırda yazar.',
    },
    {
      name: 'PDKS Kayıtları',
      title: 'Çalışma gününü kayıtlardan okuyun.',
      description: 'Giriş ve çıkış kayıtlarını inceleyin, raporlarınızı hazırlayın.',
      items: [
        'Kayıtları kişi ve tarih aralığına göre süzün.',
        'Sonuçları Excel veya PDF olarak dışa aktarın.',
        'PDKS yapay zekâ asistanına kayıtlarınızla ilgili soru sorun.',
      ],
      shot: 'pdks-kayitlari',
      alt: 'PDKS Kayıtları: kişi bazında giriş, çıkış ve çalışma süreleri tablosu',
      caption: 'Günlük, haftalık, aylık görünüm; Excel ve PDF çıktısı.',
    },
    {
      name: 'Geçiş Kontrol',
      title: 'Kimin, hangi kapıdan geçeceği belli olsun.',
      description: 'Geçiş kurallarını projenizdeki kapılar ve kişiler için düzenleyin.',
      items: [
        'Kişi ve grupların kapı yetkilerini yönetin.',
        'Kuralların gün ve saat aralıklarını belirleyin.',
        'Ziyaretçi kayıtlarını aynı projede takip edin.',
      ],
      shot: 'gecis-kontrol',
      alt: 'Geçiş Kontrol: kişi, kapı ve saat aralığıyla tanımlanmış geçiş kuralları',
      caption: 'Her kural kişi, kapı ve saat aralığıyla tanımlanır.',
    },
    {
      name: 'Vardiya ve İzin',
      title: 'Plan ile kaydı birlikte takip edin.',
      description: 'Çalışma takvimini ve izinleri aynı yönetim alanında tutun.',
      items: [
        'Personelin vardiya atamalarını planlayın.',
        'İzin kayıtlarını ve onay durumlarını takip edin.',
        'Günlük çalışma planını takvim üzerinde inceleyin.',
      ],
      shot: 'vardiyalar',
      alt: 'Vardiyalar: haftalık takvimde gündüz ve gece vardiyaları, yıllık izin günleri',
      caption: 'Gece vardiyası ertesi güne taşar, izinler takvimde görünür.',
    },
  ],
  setupTitle: 'Üç adımda kurulum.',
  steps: [
    {
      title: 'Projenizi açın.',
      description: 'Hesabınızı oluşturun ve çalışma alanınızı bir proje altında hazırlayın.',
    },
    {
      title: 'Cihazlarınızı bağlayın.',
      description: 'Uyumlu kart okuyucuları projenize ekleyin, kapı ve okuyucu eşleştirmelerini yapın.',
    },
    {
      title: 'Kişileri ve kuralları ekleyin.',
      description: 'Personeli tanımlayın, geçiş yetkilerini ve çalışma planını düzenleyin.',
    },
  ],
  securityTitle: 'Kim neyi görür,<br>kim neyi değiştirir?',
  securityDescription: 'Erişim projeye, yetki role bağlıdır. Her yönetim işlemi kayda geçer.',
  privacyContact:
    'Kişisel verilerin işlenmesine ilişkin bilgi ve aydınlatma metni talepleriniz için info@ngsteknoloji.com.',
  securityItems: [
    {
      title: 'Proje bazlı erişim',
      description: 'Her kullanıcı yalnız yetkili olduğu projelerin kayıtlarını görür.',
    },
    {
      title: '5 rol, 13 yetki',
      description: 'Kimin kapı açacağı, kimin ücret bilgisini göreceği role göre belirlenir.',
    },
    {
      title: 'Denetim kaydı',
      description: 'Kim, neyi, ne zaman değiştirdi; Denetim Kaydı sayfasında.',
    },
  ],
  contactTitle: 'İşyerinize uygun<br>kapsamı konuşalım.',
  contactNote: 'Plan ve kullanım koşulları için bize ulaşın.',
  contactHelp: 'Cihaz uyumluluğu ve kurulum için de yazabilirsiniz.',
  contactLabels: { email: 'E-posta', phone: 'Telefon', location: 'Konum' },
  email: 'info@ngsteknoloji.com',
  phone: '0 (212) 577 35 72',
  phoneHref: 'tel:+902125773572',
  faqTitle: 'Merak ettikleriniz.',
  faqHelp: 'Cevabını bulamadığınız soruları bize yazın:',
  faq: [
    {
      question: 'Hesap oluşturduğumda ne olur?',
      answer: 'Bu işlem bir kullanıcı hesabı oluşturur. Satış talebi göndermez ve ücretli plan satın almaz.',
    },
    {
      question: 'Mevcut kart okuyucularımı kullanabilir miyim?',
      answer:
        'Hikvision, Dahua, IDE Smart ve Mavisoft entegrasyonları desteklenir. Modelinizin ve bağlantı yönteminizin uygunluğunu kurulumdan önce bizimle değerlendirin.',
    },
    {
      question: 'QR ile giriş nasıl çalışır?',
      answer:
        'İşyerinizin web QR giriş bağlantısı üzerinden giriş kaydı oluşturabilirsiniz. Erişim ve kurulum için yöneticinize başvurun.',
    },
    {
      question: 'Raporları dışa aktarabilir miyim?',
      answer: 'PDKS kayıtlarını Excel veya PDF olarak dışa aktarabilirsiniz.',
    },
    {
      question: 'Birden fazla projeyi yönetebilir miyim?',
      answer:
        'Yetkili olduğunuz projeler arasında geçiş yapabilir, her projenin verileriyle ayrı çalışabilirsiniz.',
    },
    {
      question: 'Plan ve kullanım koşullarını nasıl öğrenebilirim?',
      answer:
        'Plan kapsamı, çalışan kapasitesi ve ücretlendirme için info@ngsteknoloji.com adresine yazın veya 0 (212) 577 35 72 numarasını arayın.',
    },
  ],
  finalTitle: 'Projenizi açın,<br>ilk kapıyı bağlayın.',
  footerDescription: 'Personel ve geçiş yönetimi. NGS Plus, NGS Teknoloji ürünüdür.',
  footerLocation: 'Kadıköy, İstanbul',
  footerPrivacy: 'Bilgi ve aydınlatma metni talepleri:',
} as const;
