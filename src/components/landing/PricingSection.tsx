
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Basit, Şeffaf Fiyatlandırma</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Kuruluşunuz için en uygun planı seçin
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            name="Ücretsiz"
            price="₺0"
            period="/ay"
            description="Küçük takımlar için ideal"
            buttonText="Ücretsiz Başlayın"
            buttonVariant="outline"
            features={[
              "5 çalışana kadar",
              "Temel raporlar",
              "E-posta desteği"
            ]}
          />
          
          <PricingCard
            name="Profesyonel"
            price="₺299"
            period="/ay"
            description="Büyüyen işletmeler için"
            buttonText="14 Günlük Deneme Başlatın"
            buttonVariant="default"
            isPopular
            features={[
              "50 çalışana kadar",
              "Gelişmiş raporlar ve yapay zeka analizleri",
              "Öncelikli destek",
              "Çoklu geçiş noktaları"
            ]}
          />
          
          <PricingCard
            name="Kurumsal"
            price="Özel Fiyat"
            period=""
            description="Büyük organizasyonlar için"
            buttonText="Satış Ekibiyle İletişime Geçin"
            buttonVariant="outline"
            features={[
              "Sınırsız çalışan",
              "Özel entegrasyonlar",
              "Özel müşteri temsilcisi",
              "Yerinde kurulum seçenekleri"
            ]}
          />
        </div>
      </div>
    </section>
  );
};

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  buttonText: string;
  buttonVariant: "default" | "outline";
  features: string[];
  isPopular?: boolean;
}

const PricingCard = ({
  name,
  price,
  period,
  description,
  buttonText,
  buttonVariant,
  features,
  isPopular
}: PricingCardProps) => {
  return (
    <Card className={`${isPopular ? "border-primary shadow-lg" : "border-none shadow-md hover:shadow-lg transition-all"} relative`}>
      {isPopular && (
        <div className="absolute -top-3 left-0 right-0 mx-auto w-fit">
          <Badge className="px-3 py-1">POPÜLER</Badge>
        </div>
      )}
      <CardContent className="pt-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-1">{name}</h3>
          <div className="text-3xl font-bold my-4">
            {price}<span className="text-lg text-muted-foreground font-normal">{period}</span>
          </div>
          <p className="text-muted-foreground mb-6">{description}</p>
          <Button variant={buttonVariant} className="w-full">
            {buttonText}
          </Button>
          
          <div className="mt-8 text-left">
            {features.map((feature, index) => (
              <p key={index} className="flex items-center text-sm mb-3">
                <ChevronRight className="h-4 w-4 text-primary mr-2" />
                {feature}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingSection;
