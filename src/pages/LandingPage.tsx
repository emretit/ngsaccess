
import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, Clock, ActivitySquare, Cloud, Lock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="text-2xl font-bold text-primary mr-2">ngsplus.app</div>
            <Badge variant="outline" className="hidden sm:inline-flex">Cloud</Badge>
          </div>
          
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="#features" className="text-foreground/80 hover:text-foreground transition-colors">Özellikler</Link>
            <Link to="#pricing" className="text-foreground/80 hover:text-foreground transition-colors">Fiyatlandırma</Link>
            <Link to="#about" className="text-foreground/80 hover:text-foreground transition-colors">Hakkımızda</Link>
            <Link to="#contact" className="text-foreground/80 hover:text-foreground transition-colors">İletişim</Link>
          </nav>
          
          <div>
            <Button asChild variant="outline" className="mr-2 hidden sm:inline-flex">
              <Link to="/login">Giriş Yap</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Başlayın</Link>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-2xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Modern Personel Devam Kontrol Sistemi
              </h1>
              <p className="mt-6 text-xl text-muted-foreground">
                Güvenli, bulut tabanlı çözümümüzle personel devam takibini ve geçiş kontrolünü kolaylaştırın.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="text-lg">
                  Demo İsteyin <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-lg">
                  Daha Fazla Bilgi
                </Button>
              </div>
            </div>
            <div className="hidden md:block w-full max-w-md">
              <div className="glass-card p-8 shadow-lg bg-card rounded-2xl rotate-3 relative">
                <div className="absolute -top-6 -right-6 w-12 h-12 rounded-full burgundy-gradient flex items-center justify-center text-white">
                  <QrCode className="h-6 w-6" />
                </div>
                <div className="rounded-lg bg-primary/5 p-3 mb-3">
                  <div className="h-2 w-24 bg-primary/10 rounded-full mb-2"></div>
                  <div className="h-2 w-32 bg-primary/10 rounded-full"></div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="success">Giriş</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="success">Giriş</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 my-4">
                  <div className="h-10 w-10 rounded-full bg-primary/20"></div>
                  <div>
                    <div className="h-2 w-24 bg-primary/20 rounded-full mb-2"></div>
                    <div className="h-2 w-16 bg-primary/10 rounded-full"></div>
                  </div>
                  <div className="ml-auto">
                    <Badge variant="warning">Çıkış</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Güçlü Özellikler</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Kapsamlı çözümümüz, modern personel takibi ve geçiş kontrol sistemleri için ihtiyacınız olan her şeyi sunar.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <QrCode className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">QR & Kart Tabanlı Geçiş</h3>
                <p className="text-muted-foreground">
                  Maksimum esneklik için QR kodları ve fiziksel kart okuyucular ile güvenli geçiş kontrolü.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Gerçek Zamanlı Takip</h3>
                <p className="text-muted-foreground">
                  Otomatik zaman takibi ve bildirimlerle çalışanların devam durumunu gerçek zamanlı izleyin.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <ActivitySquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Yapay Zeka Raporları</h3>
                <p className="text-muted-foreground">
                  Güçlü yapay zeka asistanımız ile anlamlı analitikler ve raporlar oluşturun.
                </p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                  <Cloud className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Güvenli Bulut Depolama</h3>
                <p className="text-muted-foreground">
                  Tüm verileriniz kurumsal düzeyde şifrelemeyle bulutta güvenle saklanır.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Basit, Şeffaf Fiyatlandırma</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Kuruluşunuz için en uygun planı seçin
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Ücretsiz</h3>
                  <div className="text-3xl font-bold my-4">₺0<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
                  <p className="text-muted-foreground mb-6">Küçük takımlar için ideal</p>
                  <Button variant="outline" className="w-full">Ücretsiz Başlayın</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      5 çalışana kadar
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Temel raporlar
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      E-posta desteği
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary shadow-lg relative">
              <div className="absolute -top-3 left-0 right-0 mx-auto w-fit">
                <Badge className="px-3 py-1">POPÜLER</Badge>
              </div>
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Profesyonel</h3>
                  <div className="text-3xl font-bold my-4">₺299<span className="text-lg text-muted-foreground font-normal">/ay</span></div>
                  <p className="text-muted-foreground mb-6">Büyüyen işletmeler için</p>
                  <Button className="w-full">14 Günlük Deneme Başlatın</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      50 çalışana kadar
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Gelişmiş raporlar ve yapay zeka analizleri
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Öncelikli destek
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Çoklu geçiş noktaları
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">Kurumsal</h3>
                  <div className="text-3xl font-bold my-4">Özel Fiyat</div>
                  <p className="text-muted-foreground mb-6">Büyük organizasyonlar için</p>
                  <Button variant="outline" className="w-full">Satış Ekibiyle İletişime Geçin</Button>
                  
                  <div className="mt-8 text-left">
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Sınırsız çalışan
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Özel entegrasyonlar
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Özel müşteri temsilcisi
                    </p>
                    <p className="flex items-center text-sm mb-3">
                      <ChevronRight className="h-4 w-4 text-primary mr-2" />
                      Yerinde kurulum seçenekleri
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">Müşterilerimiz Ne Diyor?</h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-2xl mx-auto">
              Türkiye genelinde her boyuttaki işletmeler tarafından tercih ediliyoruz
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "Bu sistem, personel devamını yönetme şeklimizi tamamen değiştirdi. Raporlar inanılmaz ve QR kod sistemi kullanımı çok kolay."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Ahmet Yılmaz</p>
                      <p className="text-sm text-muted-foreground">İK Direktörü, Tekno A.Ş.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "Yapay zeka destekli raporlar bize daha önce hiç sahip olmadığımız içgörüler sağladı. Uygulama süreci sorunsuzdu ve destek ekibi çok hızlı yanıt veriyor."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Elif Kaya</p>
                      <p className="text-sm text-muted-foreground">Operasyon Müdürü, Global Lojistik</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <p className="italic text-muted-foreground">
                      "Güvenlik bizim ana endişemizdi ve bu sistem beklentilerimizi aştı. Bulut depolama güvenli ve geçiş kontrol özellikleri çok sağlam."
                    </p>
                  </div>
                  <div className="mt-auto flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                    <div className="ml-3">
                      <p className="font-medium">Mehmet Can</p>
                      <p className="text-sm text-muted-foreground">CTO, Güvenlik Çözümleri</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-muted py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-2xl font-bold text-primary mb-4">ngsplus.app</div>
              <p className="text-muted-foreground">
                Modern işletmeler için modern personel takibi ve geçiş kontrol sistemleri.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Şirket</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Hakkımızda</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Kariyer</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Basın Kiti</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Kaynaklar</h4>
              <ul className="space-y-2">
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Dökümantasyon</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Yardım Merkezi</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Gizlilik Politikası</Link></li>
                <li><Link to="#" className="text-muted-foreground hover:text-foreground transition-colors">Kullanım Koşulları</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Bize Ulaşın</h4>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">Facebook</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">Twitter</span>
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Lock className="h-5 w-5" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              </div>
              <div className="mt-6">
                <Button variant="outline" className="w-full">İletişime Geçin</Button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} ngsplus.app. Tüm hakları saklıdır.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Gizlilik</Link>
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Koşullar</Link>
              <Link to="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Çerezler</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
