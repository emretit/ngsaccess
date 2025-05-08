
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Linkedin, Instagram, MapPin, Phone, Mail } from 'lucide-react';
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
    <footer className="bg-gray-600 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* İletişim Bölümü */}
          <div>
            <h4 className="font-medium mb-6 text-xl">İLETİŞİM</h4>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="h-5 w-5 mr-3 mt-1 flex-shrink-0" />
                <span>Hasanpaşa Mh. Mandıra Cd. No:4/39<br />Kadıköy / İSTANBUL</span>
              </li>
              <li className="flex items-center">
                <Phone className="h-5 w-5 mr-3 flex-shrink-0" />
                <span>0(212) 577-3572</span>
              </li>
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-3 flex-shrink-0" />
                <a href="mailto:info@ngsplus.app" className="hover:underline">info@ngsplus.app</a>
              </li>
            </ul>
          </div>
          
          {/* En Çok Tıklananlar */}
          <div>
            <h4 className="font-medium mb-6 text-xl">EN ÇOK TIKLANANLAR</h4>
            <ul className="space-y-3">
              <li><a href="#features" onClick={scrollToSection('features')} className="hover:underline transition-colors">Özellikler</a></li>
              <li><a href="#pricing" onClick={scrollToSection('pricing')} className="hover:underline transition-colors">Fiyatlandırma</a></li>
              <li><a href="#testimonials" onClick={scrollToSection('testimonials')} className="hover:underline transition-colors">Hakkımızda</a></li>
              <li><a href="#contact" onClick={scrollToSection('contact')} className="hover:underline transition-colors">İletişim</a></li>
            </ul>
          </div>
          
          {/* Bizi Takip Edin */}
          <div>
            <h4 className="font-medium mb-6 text-xl">BİZİ TAKİP EDİN</h4>
            <div className="flex space-x-4">
              <a href="#" className="bg-white rounded-full p-2 hover:bg-gray-200 transition-colors" aria-label="Facebook">
                <Facebook className="h-6 w-6 text-gray-600" />
              </a>
              <a href="#" className="bg-white rounded-full p-2 hover:bg-gray-200 transition-colors" aria-label="Twitter">
                <Twitter className="h-6 w-6 text-gray-600" />
              </a>
              <a href="#" className="bg-white rounded-full p-2 hover:bg-gray-200 transition-colors" aria-label="LinkedIn">
                <Linkedin className="h-6 w-6 text-gray-600" />
              </a>
              <a href="#" className="bg-white rounded-full p-2 hover:bg-gray-200 transition-colors" aria-label="Instagram">
                <Instagram className="h-6 w-6 text-gray-600" />
              </a>
            </div>
            <div className="mt-6">
              <Logo size="md" variant="full" className="mb-4" />
              <p className="text-sm">
                Modern işletmeler için modern personel takibi ve geçiş kontrol sistemleri.
              </p>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-500 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} NGS Plus. Tüm hakları saklıdır.
          </p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="#" className="text-xs hover:underline">Gizlilik Politikası</a>
            <a href="#" className="text-xs hover:underline">Kullanım Koşulları</a>
            <a href="#" className="text-xs hover:underline">Çerezler</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
