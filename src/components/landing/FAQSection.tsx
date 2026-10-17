import { marketingFacts } from "./marketingFacts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const FAQS = [
  {
    q: 'KVKK uyumlu mu?',
    a: 'Kuruluşunuzun veri işleme ve aydınlatma yükümlülükleri ayrıca değerlendirilmelidir. Ürün kapsamı ve sözleşme bilgileri için bizimle iletişime geçin.',
  },
  {
    q: 'Mevcut kart okuyucularımı kullanabilir miyim?',
    a: 'Büyük ihtimalle evet. Hikvision başta olmak üzere yaygın kart okuyucu markalarıyla doğrudan entegrasyonumuz var. Mevcut donanımınızın uyumluluğu için demo görüşmemizde teknik ekibimiz kontrol eder.',
  },
  {
    q: 'Veriler nerede saklanıyor?',
    a: 'Barındırma lokasyonu ve yedekleme koşulları için güncel sözleşme bilgilerini bizimle iletişime geçerek öğrenebilirsiniz.',
  },
  {
    q: 'Kaç çalışana kadar destekliyorsunuz?',
    a: marketingFacts.planDescription,
  },
  {
    q: 'Mobil uygulamayı kim kullanır?',
    a: marketingFacts.mobileDescription,
  },
  {
    q: 'İptal ve geri ödeme politikası nedir?',
    a: marketingFacts.trialDescription,
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
