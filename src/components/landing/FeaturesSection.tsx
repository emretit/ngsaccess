
import React from 'react';
import { QrCode, Clock, ActivitySquare, Cloud } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Güçlü Özellikler</h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
            Kapsamlı çözümümüz, modern personel takibi ve geçiş kontrol sistemleri için ihtiyacınız olan her şeyi sunar.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<QrCode className="h-6 w-6 text-primary" />}
            title="QR & Kart Tabanlı Geçiş"
            description="Maksimum esneklik için QR kodları ve fiziksel kart okuyucular ile güvenli geçiş kontrolü."
          />
          
          <FeatureCard
            icon={<Clock className="h-6 w-6 text-primary" />}
            title="Gerçek Zamanlı Takip"
            description="Otomatik zaman takibi ve bildirimlerle çalışanların devam durumunu gerçek zamanlı izleyin."
          />
          
          <FeatureCard
            icon={<ActivitySquare className="h-6 w-6 text-primary" />}
            title="Yapay Zeka Raporları"
            description="Güçlü yapay zeka asistanımız ile anlamlı analitikler ve raporlar oluşturun."
          />
          
          <FeatureCard
            icon={<Cloud className="h-6 w-6 text-primary" />}
            title="Güvenli Bulut Depolama"
            description="Tüm verileriniz kurumsal düzeyde şifrelemeyle bulutta güvenle saklanır."
          />
        </div>
      </div>
    </section>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => {
  return (
    <Card className="border-none shadow-md hover:shadow-lg transition-all">
      <CardContent className="pt-6">
        <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

export default FeaturesSection;
