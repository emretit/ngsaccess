import { Star, Quote } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface Testimonial {
  quote: string;
  name: string;
  title: string;
  initials: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Bu sistem, personel devamını yönetme şeklimizi tamamen değiştirdi. Raporlar inanılmaz ve QR kod sistemi kullanımı çok kolay. 200 kişilik fabrikamızda 2 günde devreye aldık.',
    name: 'Ahmet Yılmaz',
    title: 'İK Direktörü, Tekno A.Ş.',
    initials: 'AY',
    rating: 5,
  },
  {
    quote:
      'Yapay zeka destekli raporlar bize daha önce hiç sahip olmadığımız içgörüler sağladı. Uygulama süreci sorunsuzdu ve destek ekibi çok hızlı yanıt veriyor.',
    name: 'Elif Kaya',
    title: 'Operasyon Müdürü, Global Lojistik',
    initials: 'EK',
    rating: 5,
  },
  {
    quote:
      'Güvenlik bizim ana endişemizdi ve bu sistem beklentilerimizi aştı. KVKK uyumu hazır, audit log işimizi çok kolaylaştırdı.',
    name: 'Mehmet Can',
    title: 'CTO, Güvenlik Çözümleri',
    initials: 'MC',
    rating: 5,
  },
  {
    quote:
      'Mevcut Hikvision kart okuyucularımızla anında çalıştı. Yeni donanım almadan devreye aldık — bu bizim için çok değerliydi.',
    name: 'Selin Aydın',
    title: 'IT Müdürü, Anadolu Üretim',
    initials: 'SA',
    rating: 5,
  },
  {
    quote:
      'Bordro entegrasyonu için Excel exportu mükemmel. Aylık raporları hazırlamak 3 saatten 10 dakikaya düştü.',
    name: 'Burak Şen',
    title: 'Muhasebe Yöneticisi, Logitek',
    initials: 'BŞ',
    rating: 5,
  },
  {
    quote:
      'Mobil uygulama saha ekibimiz için harika. Şantiyede QR kod ile vardiya kontrolü yapabilmek inanılmaz pratik.',
    name: 'Deniz Aksoy',
    title: 'Şantiye Şefi, İnşa Yapı',
    initials: 'DA',
    rating: 5,
  },
];

const PARTNER_LOGOS = ['Tekno', 'Global Lojistik', 'Anadolu', 'Logitek', 'İnşa Yapı', 'Güvenlik+'];

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="py-20 md:py-28 bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12 md:mb-14 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Türkiye'nin önde gelen şirketleri{' '}
            <span className="text-primary">NGS Plus</span> kullanıyor
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            KOBİ'den kurumsala, üretimden lojistiğe — her ölçekte işletme tercih ediyor.
          </p>
        </div>

        {/* Logo bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 items-center mb-16 opacity-60 hover:opacity-100 transition-opacity">
          {PARTNER_LOGOS.map((logo) => (
            <div
              key={logo}
              className="flex items-center justify-center text-center font-semibold text-muted-foreground tracking-wide"
            >
              {logo}
            </div>
          ))}
        </div>

        {/* Carousel */}
        <Carousel
          opts={{ align: 'start', loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {TESTIMONIALS.map((t) => (
              <CarouselItem
                key={t.name}
                className="pl-4 md:basis-1/2 lg:basis-1/3"
              >
                <TestimonialCard testimonial={t} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="hidden md:flex items-center justify-end gap-2 mt-6">
            <CarouselPrevious className="static translate-y-0" />
            <CarouselNext className="static translate-y-0" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => {
  return (
    <div className="rounded-2xl border bg-card p-6 h-full flex flex-col hover:shadow-lg hover:border-primary/30 transition-all">
      <Quote className="h-8 w-8 text-primary/20 mb-4" />

      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <Star
            key={i}
            className="h-4 w-4 fill-amber-400 text-amber-400"
          />
        ))}
      </div>

      <p className="text-foreground/80 leading-relaxed flex-1">
        {testimonial.quote}
      </p>

      <div className="mt-6 flex items-center gap-3 pt-4 border-t">
        <div className="h-10 w-10 rounded-full burgundy-gradient flex items-center justify-center text-white text-sm font-semibold">
          {testimonial.initials}
        </div>
        <div>
          <div className="font-semibold text-sm">{testimonial.name}</div>
          <div className="text-xs text-muted-foreground">{testimonial.title}</div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialsSection;
