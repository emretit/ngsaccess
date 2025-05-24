
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Logo from '@/components/ui/logo';

const LandingHeader = () => {
  const scrollToSection = (sectionId: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="bg-white sticky top-0 z-10 shadow-lg border-b border-gray-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section - Primary renk arka plan */}
          <div className="flex items-center gap-4 bg-primary px-6 py-3 rounded-lg shadow-md">
            <Logo size="lg" variant="full" />
            <Badge 
              variant="outline" 
              className="hidden sm:inline-flex text-xs px-3 py-1 border-white/30 text-white/90 bg-white/10 hover:bg-white/20"
            >
              Cloud
            </Badge>
          </div>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#features" 
              onClick={scrollToSection('features')} 
              className="text-white/90 hover:text-white transition-colors font-medium text-sm tracking-wide hover:underline"
            >
              Özellikler
            </a>
            <a 
              href="#pricing" 
              onClick={scrollToSection('pricing')} 
              className="text-white/90 hover:text-white transition-colors font-medium text-sm tracking-wide hover:underline"
            >
              Fiyatlandırma
            </a>
            <a 
              href="#testimonials" 
              onClick={scrollToSection('testimonials')} 
              className="text-white/90 hover:text-white transition-colors font-medium text-sm tracking-wide hover:underline"
            >
              Hakkımızda
            </a>
            <a 
              href="#contact" 
              onClick={scrollToSection('contact')} 
              className="text-white/90 hover:text-white transition-colors font-medium text-sm tracking-wide hover:underline"
            >
              İletişim
            </a>
          </nav>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button 
              asChild 
              variant="outline" 
              className="hidden sm:inline-flex border-primary text-primary bg-transparent hover:bg-primary hover:text-white"
            >
              <Link to="/login">Giriş Yap</Link>
            </Button>
            <Button 
              asChild 
              className="bg-primary text-white hover:bg-primary/90 font-semibold px-6 py-2 shadow-lg"
            >
              <Link to="/register">Başlayın</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default LandingHeader;
