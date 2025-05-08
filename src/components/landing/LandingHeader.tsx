
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const LandingHeader = () => {
  // Sayfa içi kaydırma fonksiyonu
  const scrollToSection = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <div className="text-2xl font-bold text-primary mr-2">ngsplus.app</div>
          <Badge variant="outline" className="hidden sm:inline-flex">Cloud</Badge>
        </div>
        
        <nav className="hidden md:flex items-center space-x-6">
          <a href="#features" onClick={scrollToSection('features')} className="text-foreground/80 hover:text-foreground transition-colors">Özellikler</a>
          <a href="#pricing" onClick={scrollToSection('pricing')} className="text-foreground/80 hover:text-foreground transition-colors">Fiyatlandırma</a>
          <a href="#testimonials" onClick={scrollToSection('testimonials')} className="text-foreground/80 hover:text-foreground transition-colors">Hakkımızda</a>
          <a href="#contact" onClick={scrollToSection('contact')} className="text-foreground/80 hover:text-foreground transition-colors">İletişim</a>
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
  );
};

export default LandingHeader;
