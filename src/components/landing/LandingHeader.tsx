
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const LandingHeader = () => {
  return (
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
  );
};

export default LandingHeader;
