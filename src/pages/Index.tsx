
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Users, 
  Clock, 
  FileText, 
  CheckCircle, 
  ArrowRight, 
  Key, 
  Cpu,
  Lock,
  Fingerprint,
  Calendar 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Index() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background to-primary/5 -z-10"></div>
        <div className="container px-4 mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
                Güvenli Kartlı Geçiş Sistemleri
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Personel Takip ve <span className="text-primary">Geçiş Kontrol</span> Çözümleri
              </h1>
              <p className="text-lg text-muted-foreground md:text-xl max-w-2xl">
                İşletmeniz için özel olarak tasarlanmış, güvenli, hızlı ve kolay yönetilebilir personel devam kontrol sistemi ile tanışın.
              </p>
              <div className="flex flex-wrap gap-4 pt-4">
                <Button asChild size="lg" className="gap-2">
                  <Link to="/access-control">
                    Hemen Deneyin <ArrowRight size={16} />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/devices">
                    Cihazları Keşfedin
                  </Link>
                </Button>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl border">
                {isVideoPlaying ? (
                  <video 
                    className="w-full aspect-video object-cover"
                    autoPlay 
                    controls 
                    onEnded={() => setIsVideoPlaying(false)}
                  >
                    <source src="https://example.com/pdks-video.mp4" type="video/mp4" />
                    Tarayıcınız video oynatmayı desteklemiyor.
                  </video>
                ) : (
                  <div className="relative">
                    <img 
                      src="/placeholder.svg" 
                      alt="PDKS Sistemi" 
                      className="w-full aspect-video object-cover" 
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                      onClick={() => setIsVideoPlaying(true)}
                    >
                      <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-y-8 border-y-transparent border-l-12 border-l-white ml-1"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Güvenliğiniz İçin Tasarlandı</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              PDKS sistemimiz, işletmenizin güvenlik ve personel takip ihtiyaçlarını tek bir platformda birleştirir.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Fingerprint />}
              title="Güvenli Erişim"
              description="Çalışanlarınızın sadece yetkili oldukları alanlara erişimini sağlar."
            />
            <FeatureCard 
              icon={<Clock />}
              title="Mesai Takibi"
              description="Personel giriş-çıkış saatlerini otomatik kaydeder ve raporlar."
            />
            <FeatureCard 
              icon={<Calendar />}
              title="Vardiya Yönetimi"
              description="Vardiyaları kolayca planlayın ve takip edin."
            />
            <FeatureCard 
              icon={<FileText />}
              title="Gelişmiş Raporlama"
              description="Giriş-çıkış kayıtları ve erişim verileri hakkında detaylı raporlar."
            />
            <FeatureCard 
              icon={<Cpu />}
              title="Gelişmiş Cihazlar"
              description="Modern donanım ve yazılım ile entegre cihaz yönetimi."
            />
            <FeatureCard 
              icon={<Shield />}
              title="Veri Güvenliği"
              description="Tüm verileriniz SSL şifreleme ile güvence altında tutulur."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-background to-primary/5">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">500+</div>
              <p className="text-muted-foreground">Aktif İşletme</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">50.000+</div>
              <p className="text-muted-foreground">Çalışan</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">99,9%</div>
              <p className="text-muted-foreground">Hizmet Sürekliliği</p>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">24/7</div>
              <p className="text-muted-foreground">Teknik Destek</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container px-4 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nasıl Çalışır?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Basit adımlarla personel devam kontrol sisteminizi kurabilir ve yönetebilirsiniz.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold">Cihazları Kurun</h3>
              <p className="text-muted-foreground">Kartlı geçiş cihazlarını ilgili giriş noktalarına monte edin.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold">Personeli Tanımlayın</h3>
              <p className="text-muted-foreground">Çalışanlarınızı sisteme ekleyin ve kart atayın.</p>
            </div>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold">Yönetin ve İzleyin</h3>
              <p className="text-muted-foreground">Panelden tüm giriş-çıkışları izleyin ve raporlar alın.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container px-4 mx-auto">
          <div className="bg-card rounded-2xl p-8 md:p-12 shadow-lg border">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-4">
                <h2 className="text-3xl font-bold">Hemen Başlayın</h2>
                <p className="text-lg text-muted-foreground">
                  İşletmeniz için özel tasarlanmış PDKS çözümlerini keşfedin ve güvenliğinizi üst seviyeye taşıyın.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Button asChild size="lg">
                    <Link to="/access-control">
                      Demo İnceleyin <ArrowRight size={16} />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/employees">
                      Personel Yönetimi
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Lock className="h-28 w-28 text-primary opacity-80" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }) {
  return (
    <Card className="h-full transition-all hover:shadow-md">
      <CardContent className="flex flex-col items-center text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
