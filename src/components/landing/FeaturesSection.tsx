import { motion } from 'framer-motion';
import {
  QrCode,
  Cpu,
  MapPin,
  Calendar,
  CalendarDays,
  Plane,
  Sparkles,
  FileSpreadsheet,
  History,
  Users,
  Building2,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface Category {
  value: string;
  label: string;
  features: Feature[];
}

const CATEGORIES: Category[] = [
  {
    value: 'access',
    label: 'Erişim Kontrolü',
    features: [
      {
        icon: QrCode,
        title: 'QR & Kart Tabanlı Geçiş',
        description:
          'Dinamik QR kodları ve fiziksel kart okuyucular ile esnek giriş çıkış yönetimi.',
      },
      {
        icon: Cpu,
        title: 'Hikvision Cihaz Entegrasyonu',
        description:
          'Mevcut kart okuyucularınızla anında uyumlu — tek satır kod gerekmez.',
      },
      {
        icon: MapPin,
        title: 'Zone & Erişim Kuralları',
        description:
          'Bölge bazlı erişim, kapı izinleri ve vardiya bazlı kurallar tek panelden.',
      },
    ],
  },
  {
    value: 'attendance',
    label: 'Devam & Vardiya',
    features: [
      {
        icon: Calendar,
        title: 'Vardiya Yönetimi',
        description:
          'Esnek vardiya planları, gece mesaisi, hafta sonu kuralları ve toplu atama.',
      },
      {
        icon: Plane,
        title: 'İzin Takibi',
        description:
          'Yıllık, hastalık, mazeret, ücretsiz ve doğum izinleri için tek başvuru sistemi.',
      },
      {
        icon: CalendarDays,
        title: 'Resmi Tatil Takvimi',
        description:
          'Türkiye resmi tatilleri otomatik tanımlı, özel tatil günleri eklenebilir.',
      },
    ],
  },
  {
    value: 'reports',
    label: 'Raporlama & AI',
    features: [
      {
        icon: Sparkles,
        title: 'AI Asistanlı Raporlar',
        description:
          'Doğal dilde sorun: "Geçen ay en çok geç kalan kim?" — saniyeler içinde yanıt alın.',
      },
      {
        icon: FileSpreadsheet,
        title: 'PDKS Excel & PDF Export',
        description:
          'Bordro entegrasyonu için hazır şablonlar ve özel filtrelerle hızlı dışa aktarım.',
      },
      {
        icon: History,
        title: 'Audit Log & İz Takibi',
        description:
          'Her işlem kim, ne zaman, ne yaptı detaylarıyla kayıt altında — denetime hazır.',
      },
    ],
  },
  {
    value: 'admin',
    label: 'Yönetim',
    features: [
      {
        icon: Users,
        title: 'Çoklu Kullanıcı & Roller',
        description:
          'IK, yönetici, güvenlik gibi roller için ince ayarlı yetkilendirme.',
      },
      {
        icon: Building2,
        title: 'Multi-tenant Proje Yapısı',
        description:
          'Birden fazla şube, şirket veya proje tek hesap altında yönetilir.',
      },
      {
        icon: Smartphone,
        title: 'iOS & Android Uygulaması',
        description:
          'Sahada QR tarama, ziyaretçi karşılama ve bildirimler — yöneticiniz yanınızda.',
      },
    ],
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Tek platformda tam{' '}
            <span className="text-primary">PDKS çözümü</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Erişim kontrolünden raporlamaya, vardiyadan mobil uygulamaya — modern
            işletmelerin ihtiyaç duyduğu her özellik tek pakette.
          </p>
        </div>

        <Tabs defaultValue="access" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full max-w-3xl mx-auto h-auto p-1 bg-muted/50">
            {CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.value}
                value={cat.value}
                className="py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {CATEGORIES.map((cat) => (
            <TabsContent key={cat.value} value={cat.value} className="mt-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {cat.features.map((feature, idx) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.1 }}
                    className="group rounded-2xl border bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="rounded-xl bg-primary/10 w-12 h-12 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                      <feature.icon className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
};

export default FeaturesSection;
