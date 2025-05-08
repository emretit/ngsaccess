
import React from 'react';
import { Link } from 'react-router-dom';
import { QrCode, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const HeroSection = () => {
  return (
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
  );
};

export default HeroSection;
