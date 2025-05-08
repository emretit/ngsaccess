
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingFooter = () => {
  return (
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
  );
};

export default LandingFooter;
