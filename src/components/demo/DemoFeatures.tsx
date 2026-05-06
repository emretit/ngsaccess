
import { Card, CardContent } from "@/components/ui/card";
import { 
  Shield, 
  Clock, 
  Users, 
  BarChart3, 
  Smartphone, 
  Globe 
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Güvenli Erişim Kontrolü",
    description: "RFID kart ve biyometrik teknolojiler ile güvenli giriş-çıkış kontrolü"
  },
  {
    icon: Clock,
    title: "Gerçek Zamanlı Takip",
    description: "Personel hareketlerini anlık olarak izleyin ve raporlayın"
  },
  {
    icon: Users,
    title: "Personel Yönetimi",
    description: "Çalışan bilgilerini merkezi olarak yönetin ve organize edin"
  },
  {
    icon: BarChart3,
    title: "Detaylı Raporlama",
    description: "Kapsamlı analiz ve raporlama araçları ile veri odaklı kararlar alın"
  },
  {
    icon: Smartphone,
    title: "Mobil Uyumluluk",
    description: "Her yerden erişilebilen responsive tasarım ve mobil uygulama"
  },
  {
    icon: Globe,
    title: "Bulut Tabanlı",
    description: "Güvenli bulut altyapısı ile her yerden erişim imkanı"
  }
];

const DemoFeatures = () => {
  return (
    <div className="py-16 px-4 bg-muted/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Neden PDKS Sistemi?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Modern işletmelerin ihtiyaç duyduğu tüm özellikler tek platformda
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DemoFeatures;
