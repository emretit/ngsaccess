import { ACCOUNT_CTA, SETUP_DESCRIPTION } from '@/components/landing/publicCopy';

import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

const DemoRequestHero = () => {
  return (
    <div className="bg-linear-to-br from-primary to-primary/90 text-primary-foreground py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-3xl mx-auto mb-6 backdrop-blur-sm">
          P
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          PDKS hesabınızı
          <span className="block text-primary-foreground">Oluşturun</span>
        </h1>
        
        <p className="text-xl text-primary-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Modern personel devam kontrol sistemi ile işletmenizi dijitalleştirin. 
          {SETUP_DESCRIPTION}
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-12">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
            <span className="text-primary-foreground">{ACCOUNT_CTA}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
            <span className="text-primary-foreground">Adım adım kurulum</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary-foreground" />
            <span className="text-primary-foreground">Teknik Destek</span>
          </div>
        </div>

        <Button 
          onClick={() => {
            document.getElementById('account-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            document.getElementById('account-firstName')?.focus({ preventScroll: true });
          }}
          size="lg" 
          className="bg-card text-primary hover:bg-muted text-lg px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
        >
          {ACCOUNT_CTA}
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default DemoRequestHero;
