import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQS = [
  {
    q: 'KVKK uyumlu mu?',
    a: 'Evet. NGS Plus, KVKK kapsamında veri işleme, açık rıza yönetimi ve aydınlatma metni süreçlerine uygundur. Tüm kişisel veriler şifreli olarak saklanır, audit log ile her erişim kayıt altına alınır.',
  },
  {
    q: 'Mevcut kart okuyucularımı kullanabilir miyim?',
    a: 'Büyük ihtimalle evet. Hikvision başta olmak üzere yaygın kart okuyucu markalarıyla doğrudan entegrasyonumuz var. Mevcut donanımınızın uyumluluğu için demo görüşmemizde teknik ekibimiz kontrol eder.',
  },
  {
    q: 'Veriler nerede saklanıyor?',
    a: 'Veriler Türkiye lokasyonlu sunucularda (veya tercih ederseniz AB) ISO 27001 sertifikalı veri merkezlerinde saklanır. Yedeklemeler günlük olarak alınır.',
  },
  {
    q: 'Kaç çalışana kadar destekliyorsunuz?',
    a: 'Ücretsiz plan 5 çalışan, Profesyonel plan 50 çalışan ve Kurumsal plan sınırsız çalışan içindir. 1.000+ çalışanı olan müşterilerimiz aktif olarak sistemi kullanıyor.',
  },
  {
    q: 'Mobil uygulamayı kim kullanır?',
    a: 'Yöneticiler ve güvenlik personeli için tasarlanmıştır: sahada QR tarama, ziyaretçi karşılama, gerçek zamanlı bildirim. Çalışanlar için ayrı bir uygulama gerektirmez — kart veya sabit QR yeterlidir.',
  },
  {
    q: 'İptal ve geri ödeme politikası nedir?',
    a: '14 gün ücretsiz deneme süresinde istediğiniz zaman iptal edebilirsiniz, kart bilgisi alınmaz. Ücretli planlarda ay sonuna kadar iptal hakkınız vardır, sonraki dönem ücretlendirilmez.',
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="py-20 md:py-28 bg-muted/30">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Sıkça Sorulan Sorular
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Aklınıza takılan sorularınız mı var? Cevap bulamazsanız bizimle iletişime geçin.
          </p>
        </div>

        <Accordion type="single" collapsible className="bg-card rounded-2xl border shadow-sm">
          {FAQS.map((faq, idx) => (
            <AccordionItem
              key={idx}
              value={`item-${idx}`}
              className="border-b last:border-0 px-6"
            >
              <AccordionTrigger className="py-5 text-base font-semibold hover:no-underline hover:text-primary text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Başka bir sorunuz mu var?{' '}
          <a
            href="mailto:info@ngsplus.app"
            className="text-primary font-medium hover:underline"
          >
            info@ngsplus.app
          </a>{' '}
          adresinden bize ulaşın.
        </p>
      </div>
    </section>
  );
};

export default FAQSection;
