
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle } from "lucide-react";

const DemoRequestHero = () => {
  return (
    <div className="bg-linear-to-br from-primary to-primary/90 text-white py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 backdrop-blur-sm">
          P
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
          PDKS Sistemi Demo'sunu
          <span className="block text-orange-300">Ücretsiz Deneyin</span>
        </h1>
        
        <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto leading-relaxed">
          Modern personel devam kontrol sistemi ile işletmenizi dijitalleştirin. 
          15 dakikada kurulum, anında kullanıma hazır!
        </p>

        <div className="flex flex-wrap justify-center gap-6 mb-12">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-300" />
            <span className="text-white/90">Ücretsiz 30 Gün</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-300" />
            <span className="text-white/90">Anında Kurulum</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-300" />
            <span className="text-white/90">Teknik Destek</span>
          </div>
        </div>

        <Button 
          size="lg" 
          className="bg-card text-primary hover:bg-muted text-lg px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
        >
          Demo Talep Et
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default DemoRequestHero;
