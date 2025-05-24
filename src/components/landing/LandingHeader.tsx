
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/ui/logo';

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
    <header className="border-b bg-white sticky top-0 z-10 shadow-sm">
      <div className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Logo size="lg" variant="full" className="mr-2" />
          <Badge variant="outline" className="hidden sm:inline-flex text-sm px-3 py-1">Cloud</Badge>
        </div>
        
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" onClick={scrollToSection('features')} className="text-foreground/80 hover:text-foreground transition-colors font-medium">Özellikler</a>
          <a href="#pricing" onClick={scrollToSection('pricing')} className="text-foreground/80 hover:text-foreground transition-colors font-medium">Fiyatlandırma</a>
          <a href="#testimonials" onClick={scrollToSection('testimonials')} className="text-foreground/80 hover:text-foreground transition-colors font-medium">Hakkımızda</a>
          <a href="#contact" onClick={scrollToSection('contact')} className="text-foreground/80 hover:text-foreground transition-colors font-medium">İletişim</a>
        </nav>
        
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" className="mr-2 hidden sm:inline-flex">
            <Link to="/login">Giriş Yap</Link>
          </Button>
          <Button asChild className="px-6 py-2">
            <Link to="/register">Başlayın</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
