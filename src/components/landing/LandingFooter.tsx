
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/logo';

const LandingFooter = () => {
  // Sayfa içi kaydırma fonksiyonu
  const scrollToSection = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <footer className="bg-muted py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Logo size="md" variant="full" className="mb-4" />
            <p className="text-muted-foreground">
              Modern işletmeler için modern personel takibi ve geçiş kontrol sistemleri.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-4">Şirket</h4>
            <ul className="space-y-2">
              <li><a href="#testimonials" onClick={scrollToSection('testimonials')} className="text-muted-foreground hover:text-foreground transition-colors">Hakkımızda</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Kariyer</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Basın Kiti</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-4">Kaynaklar</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Dökümantasyon</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Yardım Merkezi</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Gizlilik Politikası</a></li>
              <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Kullanım Koşulları</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-4">Bize Ulaşın</h4>
            <div className="flex space-x-4">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Facebook className="h-5 w-5" />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5" />
                <span className="sr-only">Twitter</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Linkedin className="h-5 w-5" />
                <span className="sr-only">LinkedIn</span>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-5 w-5" />
                <span className="sr-only">Email</span>
              </a>
            </div>
            <div className="mt-6">
              <Button variant="outline" className="w-full">İletişime Geçin</Button>
            </div>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} NGS Plus. Tüm hakları saklıdır.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Gizlilik</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Koşullar</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Çerezler</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
