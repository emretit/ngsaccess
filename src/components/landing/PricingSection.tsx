import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

type Billing = 'monthly' | 'yearly';

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  customLabel?: string;
  buttonText: string;
  buttonVariant: 'default' | 'outline';
  features: string[];
  popular?: boolean;
  ctaPath: string;
}

const PLANS: Plan[] = [
  {
    name: 'Başlangıç',
    description: 'Küçük takımlar için ideal',
    monthlyPrice: 399,
    yearlyPrice: 319,
    buttonText: 'Hemen Başla',
    buttonVariant: 'outline',
    ctaPath: '/register',
    features: [
      '10 çalışana kadar',
      'QR kodla giriş çıkış',
      'Temel raporlar',
      'E-posta desteği',
    ],
  },
  {
    name: 'Profesyonel',
    description: 'Büyüyen işletmeler için',
    monthlyPrice: 799,
    yearlyPrice: 639,
    buttonText: '14 Gün Ücretsiz Dene',
    buttonVariant: 'default',
    popular: true,
    ctaPath: '/register',
    features: [
      '50 çalışana kadar',
      'Kart okuyucu entegrasyonu',
      'AI asistanlı raporlar',
      'Vardiya & izin yönetimi',
      'Çoklu geçiş noktası',
      'Öncelikli destek',
    ],
  },
  {
    name: 'Kurumsal',
    description: 'Büyük organizasyonlar için',
    monthlyPrice: null,
    yearlyPrice: null,
    customLabel: 'Özel Fiyat',
    buttonText: 'Satış Ekibiyle Görüş',
    buttonVariant: 'outline',
    ctaPath: '/demo-request?plan=enterprise',
    features: [
      'Sınırsız çalışan',
      'Hikvision & özel entegrasyonlar',
      'SLA & yerinde kurulum',
      'Özel müşteri temsilcisi',
      'KVKK & ISO uyum desteği',
      'Tek oturum açma (SSO)',
    ],
  },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat('tr-TR').format(price);

const PricingSection = () => {
  const [billing, setBilling] = useState<Billing>('monthly');
  const navigate = useNavigate();

  return (
    <section id="pricing" className="py-20 md:py-28 bg-muted/30">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10 md:mb-12 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Basit, şeffaf fiyatlandırma
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Kuruluşunuzun büyüklüğüne göre uygun planı seçin. İstediğiniz zaman değiştirin.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-12">
          <span
            className={`text-sm font-medium transition-colors ${
              billing === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Aylık
          </span>
          <Switch
            checked={billing === 'yearly'}
            onCheckedChange={(checked) => setBilling(checked ? 'yearly' : 'monthly')}
            aria-label="Faturalandırma periyodu"
          />
          <span
            className={`text-sm font-medium transition-colors flex items-center gap-2 ${
              billing === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            Yıllık
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
              %20 indirim
            </Badge>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PLANS.map((plan, idx) => {
            const price =
              billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className={`relative rounded-2xl border bg-card p-8 ${
                  plan.popular
                    ? 'border-primary shadow-xl shadow-primary/10 md:scale-[1.03]'
                    : 'border-border shadow-sm hover:shadow-md transition-shadow'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-white shadow-md flex items-center gap-1 px-3 py-1">
                      <Sparkles className="h-3 w-3" />
                      EN POPÜLER
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6 min-h-[80px]">
                  {price === null ? (
                    <div className="text-3xl font-bold">{plan.customLabel}</div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold">
                          ₺{formatPrice(price)}
                        </span>
                        <span className="text-muted-foreground">
                          /ay{billing === 'yearly' && price > 0 ? ' (yıllık)' : ''}
                        </span>
                      </div>
                      {billing === 'yearly' && plan.monthlyPrice && plan.monthlyPrice > 0 && (
                        <div className="text-xs text-muted-foreground line-through mt-1">
                          ₺{formatPrice(plan.monthlyPrice)}/ay
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Button
                  variant={plan.buttonVariant}
                  className={`w-full mb-6 ${
                    plan.buttonVariant === 'default'
                      ? 'bg-primary hover:bg-primary/90 shadow-md shadow-primary/20'
                      : ''
                  }`}
                  onClick={() => navigate(plan.ctaPath)}
                >
                  {plan.buttonText}
                </Button>

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          * Tüm fiyatlara KDV dahildir. İstediğiniz zaman iptal edebilirsiniz.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
